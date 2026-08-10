import os
import time
import shutil
import zipfile
import subprocess
from io import BytesIO
from pathlib import Path
from fastapi import APIRouter, HTTPException, UploadFile, File, Response, Depends, Request
from auth import require_auth, AUTH_MODE, is_user_sudoer, active_sessions, SESSION_COOKIE_NAME

try:
    import pwd
except ImportError:
    pwd = None

router = APIRouter(prefix="/api/fs", tags=["filesystem"], dependencies=[Depends(require_auth)])

SOVEREIGN_ROOT = os.getenv("SOVEREIGN_ROOT", str(Path.home()))
TRASH_DIR = os.getenv("TRASH_DIR", os.path.join(SOVEREIGN_ROOT, "_temp_trash"))

# Trash Safety vs Permanent Deletion Configuration
# Default is True (moves deleted items to _temp_trash)
# Set SAFE_TRASH_MODE=false or ENABLE_PERMANENT_DELETE=true in config.env to enable permanent removal
SAFE_TRASH_MODE = os.getenv("SAFE_TRASH_MODE", "true").lower() in ("true", "1", "yes")
ENABLE_PERMANENT_DELETE = os.getenv("ENABLE_PERMANENT_DELETE", "false").lower() in ("true", "1", "yes")

def get_safe_path(target_path: str) -> Path:
    """Ensure path is absolute and normalized, expanding ~ to the server user's home directory."""
    return Path(target_path).expanduser().resolve()


def get_local_trash_dir(target_path: Path) -> Path:
    """Traverse parent directories to find workspace root or filesystem mount point."""
    curr = target_path.resolve()
    while curr != curr.parent:
        if os.path.ismount(curr) or str(curr) == str(Path(SOVEREIGN_ROOT).resolve()):
            trash_dir = curr / "_temp_trash"
            trash_dir.mkdir(parents=True, exist_ok=True)
            return trash_dir
        curr = curr.parent
    fallback = Path(SOVEREIGN_ROOT) / "_temp_trash"
    fallback.mkdir(parents=True, exist_ok=True)
    return fallback


def run_with_user_privileges(request: Request, func, *args, **kwargs):
    """Run function with effective UID/GID dropped to active PAM user (if AUTH_MODE == 'pam')."""
    if AUTH_MODE != "pam" or not pwd:
        return func(*args, **kwargs)

    cookie_token = request.cookies.get(SESSION_COOKIE_NAME)
    session_info = active_sessions.get(cookie_token, {})
    username = session_info.get("username")

    if not username or username in ("root", "admin"):
        return func(*args, **kwargs)

    try:
        pw_info = pwd.getpwnam(username)
        target_uid = pw_info.pw_uid
        target_gid = pw_info.pw_gid
    except KeyError:
        return func(*args, **kwargs)

    orig_egid = os.getegid()
    orig_euid = os.geteuid()
    try:
        os.setegid(target_gid)
        os.seteuid(target_uid)
        return func(*args, **kwargs)
    finally:
        os.seteuid(orig_euid)
        os.setegid(orig_egid)


@router.get("/tree")
def get_directory_tree(path: str = SOVEREIGN_ROOT):
    """
    Returns directory tree listing, file sizes, permissions, and file type metadata.
    """
    p = get_safe_path(path)
    if not p.exists() or not p.is_dir():
        raise HTTPException(status_code=404, detail="Directory not found")

    items = []
    try:
        for entry in os.scandir(p):
            try:
                is_dir = entry.is_dir(follow_symlinks=True)
                stat = entry.stat(follow_symlinks=False)
                size_str = f"{stat.st_size / 1024:.1f} KB" if not is_dir else ""
                resolved_path = str(Path(entry.path).resolve())
                items.append({
                    "name": entry.name,
                    "isDir": is_dir,
                    "path": resolved_path,
                    "size": size_str
                })
            except Exception:
                items.append({
                    "name": entry.name,
                    "isDir": False,
                    "path": str(Path(entry.path)),
                    "size": "N/A"
                })
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied")

    items.sort(key=lambda x: (not x["isDir"], x["name"].lower()))
    return {"currentPath": str(p), "items": items}

@router.get("/read")
def read_file(path: str):
    """
    Reads raw UTF-8 text for CodeMirror 6 text editor tabs.
    """
    p = get_safe_path(path)
    if not p.exists() or p.is_dir():
        raise HTTPException(status_code=404, detail="File not found")
    try:
        with open(p, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
        return {"path": str(p), "content": content}
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied to read file")
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"File system error: {str(e)}")

@router.post("/save")
def save_file(payload: dict):
    """
    Writes edited content directly to server file system.
    """
    target_path = payload.get("path")
    content = payload.get("content", "")
    if not target_path:
        raise HTTPException(status_code=400, detail="Missing file path")

    p = get_safe_path(target_path)
    p.parent.mkdir(parents=True, exist_ok=True)
    try:
        with open(p, "w", encoding="utf-8") as f:
            f.write(content)
        return {"status": "saved", "path": str(p)}
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied to save file")
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"File system error: {str(e)}")

@router.post("/create")
def create_item(payload: dict):
    """
    Creates a new file or directory.
    """
    target_path = payload.get("path")
    item_type = payload.get("type", "file")
    if not target_path:
        raise HTTPException(status_code=400, detail="Missing path")

    p = get_safe_path(target_path)
    try:
        if item_type == "directory":
            p.mkdir(parents=True, exist_ok=True)
        else:
            p.parent.mkdir(parents=True, exist_ok=True)
            p.touch(exist_ok=True)
        return {"status": "created", "path": str(p)}
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied to create item")
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"File system error: {str(e)}")

@router.post("/delete")
def delete_item_permanently(payload: dict, request: Request):
    """
    Explicit Permanent Deletion Endpoint.
    Permanently removes target files (os.remove) or directories (shutil.rmtree).
    Supports optional use_sudo: true for authenticated sudoers.
    """
    target_path = payload.get("path")
    use_sudo = payload.get("use_sudo", False)
    if not target_path:
        raise HTTPException(status_code=400, detail="Missing path")

    p = get_safe_path(target_path)
    if not p.exists():
        raise HTTPException(status_code=404, detail="Item not found")

    cookie_token = request.cookies.get(SESSION_COOKIE_NAME)
    session_info = active_sessions.get(cookie_token, {})
    username = session_info.get("username", "admin")

    def _do_delete():
        if p.is_dir():
            shutil.rmtree(p)
        else:
            os.remove(p)

    try:
        if use_sudo:
            if not is_user_sudoer(username):
                raise HTTPException(status_code=403, detail="User is not authorized for sudo elevation")
            _do_delete()
        else:
            run_with_user_privileges(request, _do_delete)
        return {"status": "deleted_permanently", "path": str(p)}
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied to delete item")
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"Permanent deletion failed: {str(e)}")


@router.post("/trash")
def archive_to_local_trash(payload: dict, request: Request):
    """
    Archive to Dynamic Local Trash Endpoint.
    Moves target item into the local _temp_trash directory on its active storage mount point.
    Supports optional use_sudo: true for authenticated sudoers.
    """
    target_path = payload.get("path")
    use_sudo = payload.get("use_sudo", False)
    if not target_path:
        raise HTTPException(status_code=400, detail="Missing path")

    p = get_safe_path(target_path)
    if not p.exists():
        raise HTTPException(status_code=404, detail="Item not found")

    cookie_token = request.cookies.get(SESSION_COOKIE_NAME)
    session_info = active_sessions.get(cookie_token, {})
    username = session_info.get("username", "admin")

    trash_dir = get_local_trash_dir(p)
    dest_path = trash_dir / p.name
    if dest_path.exists():
        dest_path = trash_dir / f"{p.stem}_{int(time.time())}{p.suffix}"

    def _do_trash():
        shutil.move(str(p), str(dest_path))

    try:
        if use_sudo:
            if not is_user_sudoer(username):
                raise HTTPException(status_code=403, detail="User is not authorized for sudo elevation")
            _do_trash()
        else:
            run_with_user_privileges(request, _do_trash)
        return {"status": "trashed", "destination": str(dest_path), "mode": "local_trash"}
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied to move item to trash")
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"Archive to trash failed: {str(e)}")

@router.post("/move")
def move_items(payload: dict, request: Request):
    """
    Move one or more items to a destination directory.
    Batch operation — all sources move to the same destination.
    Timestamp-suffix conflict resolution matches /trash pattern.
    """
    sources = payload.get("sources", [])
    destination = payload.get("destination")
    use_sudo = payload.get("use_sudo", False)
    if not sources or not destination:
        raise HTTPException(status_code=400, detail="Missing sources or destination")

    dest_dir = get_safe_path(destination)
    if not dest_dir.exists() or not dest_dir.is_dir():
        raise HTTPException(status_code=404, detail="Destination directory not found")

    cookie_token = request.cookies.get(SESSION_COOKIE_NAME)
    session_info = active_sessions.get(cookie_token, {})
    username = session_info.get("username", "admin")

    moved = []
    def _do_move():
        for src_str in sources:
            p = get_safe_path(src_str)
            if not p.exists():
                continue
            dest_path = dest_dir / p.name
            if dest_path.exists():
                dest_path = dest_dir / f"{p.stem}_{int(time.time())}{p.suffix}"
            shutil.move(str(p), str(dest_path))
            moved.append(str(dest_path))

    try:
        if use_sudo:
            if not is_user_sudoer(username):
                raise HTTPException(status_code=403, detail="User is not authorized for sudo elevation")
            _do_move()
        else:
            run_with_user_privileges(request, _do_move)
        return {"status": "moved", "moved": moved, "destination": str(dest_dir)}
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied to move items")
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"Move failed: {str(e)}")


@router.post("/copy")
def copy_items(payload: dict, request: Request):
    """
    Copy one or more items to a destination directory.
    Uses copy2 for files (preserves metadata) and copytree for directories.
    Timestamp-suffix conflict resolution matches /trash pattern.
    """
    sources = payload.get("sources", [])
    destination = payload.get("destination")
    use_sudo = payload.get("use_sudo", False)
    if not sources or not destination:
        raise HTTPException(status_code=400, detail="Missing sources or destination")

    dest_dir = get_safe_path(destination)
    if not dest_dir.exists() or not dest_dir.is_dir():
        raise HTTPException(status_code=404, detail="Destination directory not found")

    cookie_token = request.cookies.get(SESSION_COOKIE_NAME)
    session_info = active_sessions.get(cookie_token, {})
    username = session_info.get("username", "admin")

    copied = []
    def _do_copy():
        for src_str in sources:
            p = get_safe_path(src_str)
            if not p.exists():
                continue
            dest_path = dest_dir / p.name
            if dest_path.exists():
                dest_path = dest_dir / f"{p.stem}_{int(time.time())}{p.suffix}"
            if p.is_dir():
                shutil.copytree(str(p), str(dest_path))
            else:
                shutil.copy2(str(p), str(dest_path))
            copied.append(str(dest_path))

    try:
        if use_sudo:
            if not is_user_sudoer(username):
                raise HTTPException(status_code=403, detail="User is not authorized for sudo elevation")
            _do_copy()
        else:
            run_with_user_privileges(request, _do_copy)
        return {"status": "copied", "copied": copied, "destination": str(dest_dir)}
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied to copy items")
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"Copy failed: {str(e)}")


@router.post("/rename")
def rename_item(payload: dict, request: Request):
    """
    Rename a single file or directory in place.
    Returns 409 if an item with the new name already exists — no silent overwrite.
    Path separators in new_name are rejected to prevent traversal.
    """
    source = payload.get("source")
    new_name = payload.get("new_name", "").strip()
    use_sudo = payload.get("use_sudo", False)
    if not source or not new_name:
        raise HTTPException(status_code=400, detail="Missing source or new_name")
    if "/" in new_name or "\\" in new_name:
        raise HTTPException(status_code=400, detail="New name cannot contain path separators")

    p = get_safe_path(source)
    if not p.exists():
        raise HTTPException(status_code=404, detail="Item not found")

    dest_path = p.parent / new_name
    if dest_path.exists():
        raise HTTPException(status_code=409, detail=f"An item named '{new_name}' already exists in this directory")

    cookie_token = request.cookies.get(SESSION_COOKIE_NAME)
    session_info = active_sessions.get(cookie_token, {})
    username = session_info.get("username", "admin")

    def _do_rename():
        os.rename(str(p), str(dest_path))

    try:
        if use_sudo:
            if not is_user_sudoer(username):
                raise HTTPException(status_code=403, detail="User is not authorized for sudo elevation")
            _do_rename()
        else:
            run_with_user_privileges(request, _do_rename)
        return {"status": "renamed", "source": str(p), "destination": str(dest_path)}
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied to rename item")
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"Rename failed: {str(e)}")


@router.post("/compress")
def compress_items(payload: dict):
    """
    Compress one or more items into a ZIP archive saved to disk in the destination directory.
    Single item: named <item_name>.zip. Multiple items: archive_<timestamp>.zip.
    Reuses zipfile module already present in this module.
    """
    sources = payload.get("sources", [])
    destination = payload.get("destination")
    if not sources or not destination:
        raise HTTPException(status_code=400, detail="Missing sources or destination")

    dest_dir = get_safe_path(destination)
    if not dest_dir.exists() or not dest_dir.is_dir():
        raise HTTPException(status_code=404, detail="Destination directory not found")

    if len(sources) == 1:
        src_stem = Path(sources[0]).name
        zip_name = f"{src_stem}.zip"
    else:
        zip_name = f"archive_{int(time.time())}.zip"

    zip_path = dest_dir / zip_name
    if zip_path.exists():
        zip_path = dest_dir / f"archive_{int(time.time())}.zip"

    try:
        with zipfile.ZipFile(str(zip_path), "w", zipfile.ZIP_DEFLATED) as zf:
            for src_str in sources:
                p = get_safe_path(src_str)
                if not p.exists():
                    continue
                if p.is_dir():
                    for root, _, files in os.walk(p):
                        for file in files:
                            abs_file = Path(root) / file
                            rel_path = abs_file.relative_to(p.parent)
                            zf.write(abs_file, rel_path)
                else:
                    zf.write(str(p), p.name)
        return {"status": "compressed", "archive": str(zip_path)}
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied to compress items")
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"Compression failed: {str(e)}")


@router.post("/git-commit")
def git_commit_file(payload: dict):
    """
    Universal Git Save & Commit Touch Macro.
    Auto-detects Git repos and executes git add & git commit.
    """
    target_path = payload.get("path")
    if not target_path:
        raise HTTPException(status_code=400, detail="Missing path")

    p = get_safe_path(target_path)
    file_dir = p.parent

    res = subprocess.run(["git", "rev-parse", "--is-inside-work-tree"], cwd=file_dir, capture_output=True, text=True)
    if res.returncode != 0:
        return {"status": "saved", "git": False, "message": "File saved (not inside a Git repository)"}

    try:
        subprocess.run(["git", "add", str(p)], cwd=file_dir, check=True)
        subprocess.run(["git", "commit", "-m", f"Update {p.name}"], cwd=file_dir, check=True)
        return {"status": "committed", "git": True, "message": f"Committed {p.name} cleanly to Git"}
    except subprocess.CalledProcessError as e:
        return {"status": "saved", "git": False, "message": f"Saved file, but Git commit failed: {e}"}

@router.get("/download")
def download_file(path: str):
    """
    Universal Binary File Stream & On-The-Fly Multi-File ZIP Archiver.
    """
    p = get_safe_path(path)
    if not p.exists():
        raise HTTPException(status_code=404, detail="Item not found")

    if p.is_file():
        return StreamingResponse(
            open(p, "rb"),
            media_type="application/octet-stream",
            headers={"Content-Disposition": f'attachment; filename="{p.name}"'}
        )

    zip_buffer = BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, _, files in os.walk(p):
            for file in files:
                abs_file = Path(root) / file
                rel_path = abs_file.relative_to(p.parent)
                zf.write(abs_file, rel_path)
    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{p.name}.zip"'}
    )

@router.post("/upload")
async def upload_files(target_dir: str, files: list[UploadFile] = File(...)):
    """
    Single or Batch Multipart Binary File Uploader.
    """
    p = get_safe_path(target_dir)
    if not p.exists() or not p.is_dir():
        raise HTTPException(status_code=404, detail="Target directory not found")

    uploaded = []
    for file in files:
        dest_file = p / Path(file.filename).name  # .name strips any directory traversal sequences
        with open(dest_file, "wb") as f:
            shutil.copyfileobj(file.file, f)
        uploaded.append(file.filename)

    return {"status": "uploaded", "files": uploaded, "target": str(p)}
