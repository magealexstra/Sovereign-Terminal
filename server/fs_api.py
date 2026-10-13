"""
fs_api.py - File explorer REST routes (browse, edit, move, copy, archive, delete,
compress, download, upload, git commit).

Path rules:
  - get_safe_path() follows symlinks. Routes that read or write a file's
    content use it, so they act on the file the link points at.
  - get_entry_path() keeps the final path component as given. Routes that
    delete, archive, rename, move, copy or compress an entry use it, so a
    symlink is acted on as a link and never as the tree it points at.

Privileges: when AUTH_MODE is "pam", every route that touches the file system
runs with the effective UID/GID of the logged-in user (run_with_user_privileges).
"""

import contextlib
import os
import shutil
import stat
import subprocess
import tempfile
import time
import urllib.parse
import uuid
import zipfile
from contextlib import contextmanager
from pathlib import Path
from typing import Annotated

from auth import (
    AUTH_MODE,
    SESSION_COOKIE_NAME,
    active_sessions,
    is_user_sudoer,
    require_auth,
)
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse

try:
    import pwd
except ImportError:
    pwd = None

router = APIRouter(prefix="/api/fs", tags=["filesystem"], dependencies=[Depends(require_auth)])

SOVEREIGN_ROOT = os.getenv("SOVEREIGN_ROOT", str(Path.home()))

# Largest file /read will load into the editor.
READ_MAX_BYTES = 64 * 1024 * 1024

# Limits for building a zip (compress and folder download).
ZIP_MAX_ENTRIES = 200_000
ZIP_MAX_BYTES = 32 * 1024 ** 3
# A folder download is built in a temporary file that stays in memory up to this size.
ZIP_SPOOL_BYTES = 64 * 1024 * 1024

GIT_TIMEOUT_SECONDS = 30
IO_CHUNK_BYTES = 1024 * 1024


def format_size(size_bytes: int) -> str:
    """Return human-readable file size: B / KB / MB / GB / TB at 1 decimal place."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 ** 2:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 ** 3:
        return f"{size_bytes / 1024 ** 2:.1f} MB"
    elif size_bytes < 1024 ** 4:
        return f"{size_bytes / 1024 ** 3:.1f} GB"
    else:
        return f"{size_bytes / 1024 ** 4:.1f} TB"


def get_safe_path(target_path: str) -> Path:
    """Return an absolute path with ~ expanded to the server user's home and every symlink followed."""
    if not isinstance(target_path, str) or not target_path:
        raise HTTPException(status_code=400, detail="Missing path")
    if "\0" in target_path:
        raise HTTPException(status_code=400, detail="Invalid path")
    try:
        return Path(target_path).expanduser().resolve()
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail="Invalid path") from exc


def get_entry_path(target_path: str) -> Path:
    """
    Return an absolute path to a directory entry without following the entry itself.

    Every parent component is resolved, the last one is kept as given, so a
    symlink stays a symlink. Raises 400 for a path with no entry name (the
    filesystem root).
    """
    if not isinstance(target_path, str) or not target_path:
        raise HTTPException(status_code=400, detail="Missing path")
    if "\0" in target_path:
        raise HTTPException(status_code=400, detail="Invalid path")
    try:
        raw = Path(target_path).expanduser()
        if raw.name in ("", ".", ".."):
            entry = raw.resolve()
        else:
            entry = raw.parent.resolve() / raw.name
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail="Invalid path") from exc
    if not entry.name:
        raise HTTPException(status_code=400, detail="Refusing to act on the filesystem root")
    return entry


def get_local_trash_dir(target_path: Path) -> Path:
    """Find the workspace root or filesystem mount point above an entry and return its _temp_trash folder."""
    root = Path(SOVEREIGN_ROOT).resolve()
    curr = target_path.parent.resolve()
    while curr != curr.parent:
        if os.path.ismount(curr) or curr == root:
            trash_dir = curr / "_temp_trash"
            trash_dir.mkdir(parents=True, exist_ok=True)
            return trash_dir
        curr = curr.parent
    fallback = root / "_temp_trash"
    fallback.mkdir(parents=True, exist_ok=True)
    return fallback


def unique_dest(directory: Path, name: str) -> Path:
    """Return directory/name, or a timestamped variant of the name when that entry exists."""
    candidate = directory / name
    if not os.path.lexists(candidate):
        return candidate
    stem, suffix = Path(name).stem, Path(name).suffix
    stamp = int(time.time())
    candidate = directory / f"{stem}_{stamp}{suffix}"
    counter = 1
    while os.path.lexists(candidate):
        counter += 1
        candidate = directory / f"{stem}_{stamp}_{counter}{suffix}"
    return candidate


def session_username(request: Request) -> str:
    """Return the logged-in user's name from the session cookie ("admin" when the session has none)."""
    session_info = active_sessions.get(request.cookies.get(SESSION_COOKIE_NAME), {})
    return session_info.get("username", "admin")


def run_with_user_privileges(request: Request, func, *args, **kwargs):
    """Run function with effective UID/GID dropped to active PAM user (if AUTH_MODE == 'pam')."""
    if AUTH_MODE != "pam" or not pwd:
        return func(*args, **kwargs)

    session_info = active_sessions.get(request.cookies.get(SESSION_COOKIE_NAME), {})
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


def run_for_request(request: Request, use_sudo: bool, func):
    """Run func as the server user when an authorised sudoer asked for elevation, else as the logged-in user."""
    if use_sudo:
        if not is_user_sudoer(session_username(request)):
            raise HTTPException(status_code=403, detail="User is not authorized for sudo elevation")
        return func()
    return run_with_user_privileges(request, func)


def user_can_read(request: Request, path: Path) -> bool:
    """Return True when the logged-in user may open the file for reading."""
    def _probe():
        with open(path, "rb"):
            return True
    try:
        return run_with_user_privileges(request, _probe)
    except OSError:
        return False


def require_readable(request: Request, path: Path) -> None:
    """Raise 403 unless the logged-in user may read the file; media routes call this before serving."""
    if not user_can_read(request, path):
        raise HTTPException(status_code=403, detail="Permission denied to read file")


@contextmanager
def fs_errors(denied: str, failed: str):
    """Turn file system errors raised inside the block into HTTP errors the front end can show."""
    try:
        yield
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=denied) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Item not found") from exc
    except FileExistsError as exc:
        raise HTTPException(status_code=409, detail="An item with that name already exists") from exc
    except (IsADirectoryError, NotADirectoryError) as exc:
        raise HTTPException(status_code=400, detail=f"{failed}: wrong kind of item ({exc.strerror})") from exc
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"{failed}: {exc}") from exc


def _require_str(payload: dict, key: str) -> str:
    value = payload.get(key)
    if not isinstance(value, str) or not value:
        raise HTTPException(status_code=400, detail=f"Missing {key}")
    return value


def _require_sources(payload: dict) -> list[str]:
    sources = payload.get("sources")
    if (
        not isinstance(sources, list)
        or not sources
        or not all(isinstance(s, str) and s for s in sources)
    ):
        raise HTTPException(status_code=400, detail="Missing sources or destination")
    return sources


def _existing_entries(sources: list[str]) -> list[Path]:
    """Return the entry path of each source; 404 naming every source that does not exist."""
    entries = [get_entry_path(s) for s in sources]
    missing = [str(e) for e in entries if not os.path.lexists(e)]
    if missing:
        raise HTTPException(status_code=404, detail=f"Item not found: {', '.join(missing)}")
    return entries


def _destination_dir(payload: dict) -> Path:
    dest_dir = get_safe_path(_require_str(payload, "destination"))
    if not dest_dir.is_dir():
        raise HTTPException(status_code=404, detail="Destination directory not found")
    return dest_dir


@router.get("/tree")
def get_directory_tree(request: Request, path: str = SOVEREIGN_ROOT):
    """
    Returns directory tree listing, file sizes and file type metadata.
    Each item's path is the entry's own path, so a symlink is listed as the link.
    """
    p = get_safe_path(path)

    def _list():
        if not p.is_dir():
            raise HTTPException(status_code=404, detail="Directory not found")
        items = []
        with os.scandir(p) as entries:
            for entry in entries:
                try:
                    is_dir = entry.is_dir()
                    size_str = ""
                    if not is_dir:
                        try:
                            size = entry.stat().st_size
                        except OSError:
                            size = entry.stat(follow_symlinks=False).st_size
                        size_str = format_size(size)
                    items.append({"name": entry.name, "isDir": is_dir, "path": entry.path, "size": size_str})
                except OSError:
                    items.append({"name": entry.name, "isDir": False, "path": entry.path, "size": "N/A"})
        return items

    with fs_errors("Permission denied", "Could not list directory"):
        items = run_with_user_privileges(request, _list)
    items.sort(key=lambda x: (not x["isDir"], x["name"].lower()))
    return {"currentPath": str(p), "items": items}


@router.get("/read")
def read_file(path: str, request: Request):
    """
    Reads raw UTF-8 text for CodeMirror 6 text editor tabs.
    """
    p = get_safe_path(path)

    def _read():
        st = os.stat(p)
        if stat.S_ISDIR(st.st_mode):
            raise HTTPException(status_code=404, detail="File not found")
        if not stat.S_ISREG(st.st_mode):
            raise HTTPException(status_code=400, detail="Not a regular file")
        if st.st_size > READ_MAX_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File is larger than the {READ_MAX_BYTES // (1024 * 1024)} MB editor limit",
            )
        with open(p, "r", encoding="utf-8", errors="replace") as f:
            return f.read()

    with fs_errors("Permission denied to read file", "File system error"):
        content = run_with_user_privileges(request, _read)
    return {"path": str(p), "content": content}


@router.post("/save")
def save_file(payload: dict, request: Request):
    """
    Writes edited content directly to server file system.
    """
    p = get_safe_path(payload.get("path"))
    content = payload.get("content", "")
    if not isinstance(content, str):
        raise HTTPException(status_code=400, detail="Content must be text")

    def _save():
        p.parent.mkdir(parents=True, exist_ok=True)
        with open(p, "w", encoding="utf-8") as f:
            f.write(content)

    with fs_errors("Permission denied to save file", "File system error"):
        run_with_user_privileges(request, _save)
    return {"status": "saved", "path": str(p)}


@router.post("/create")
def create_item(payload: dict, request: Request):
    """
    Creates a new file or directory using the active PAM user's privileges (if AUTH_MODE == 'pam').
    """
    p = get_safe_path(payload.get("path"))
    item_type = payload.get("type", "file")
    if item_type not in ("file", "directory"):
        raise HTTPException(status_code=400, detail="Type must be file or directory")

    def _do_create():
        if item_type == "directory":
            p.mkdir(parents=True, exist_ok=True)
        else:
            p.parent.mkdir(parents=True, exist_ok=True)
            p.touch(exist_ok=True)

    with fs_errors("Permission denied to create item", "File system error"):
        run_with_user_privileges(request, _do_create)
    return {"status": "created", "path": str(p)}


@router.post("/delete")
def delete_item_permanently(payload: dict, request: Request):
    """
    Permanently removes a file, a directory tree, or a symlink (only the link, never its target).
    Supports optional use_sudo: true for authenticated sudoers.
    """
    p = get_entry_path(payload.get("path"))
    use_sudo = payload.get("use_sudo") is True
    if not os.path.lexists(p):
        raise HTTPException(status_code=404, detail="Item not found")

    def _do_delete():
        if p.is_dir() and not p.is_symlink():
            shutil.rmtree(p)
        else:
            os.unlink(p)

    with fs_errors("Permission denied to delete item", "Permanent deletion failed"):
        run_for_request(request, use_sudo, _do_delete)
    return {"status": "deleted_permanently", "path": str(p)}


@router.post("/trash")
def archive_to_local_trash(payload: dict, request: Request):
    """
    Archive endpoint: moves the item (or the symlink itself) into the _temp_trash folder at the
    workspace root or the root of the item's mount point.
    Supports optional use_sudo: true for authenticated sudoers.
    """
    p = get_entry_path(payload.get("path"))
    use_sudo = payload.get("use_sudo") is True
    if not os.path.lexists(p):
        raise HTTPException(status_code=404, detail="Item not found")

    dest_path = None

    def _do_trash():
        nonlocal dest_path
        trash_dir = get_local_trash_dir(p)
        dest_path = unique_dest(trash_dir, p.name)
        shutil.move(str(p), str(dest_path))

    with fs_errors("Permission denied to move item to trash", "Archive to trash failed"):
        run_for_request(request, use_sudo, _do_trash)
    return {"status": "trashed", "destination": str(dest_path), "mode": "local_trash"}


@router.post("/move")
def move_items(payload: dict, request: Request):
    """
    Move one or more items to a destination directory.
    Batch operation - all sources move to the same destination.
    A name clash gets a timestamp suffix. Every source must exist or nothing moves.
    """
    sources = _require_sources(payload)
    use_sudo = payload.get("use_sudo") is True
    dest_dir = _destination_dir(payload)
    entries = _existing_entries(sources)

    moved = []

    def _do_move():
        for p in entries:
            dest_path = unique_dest(dest_dir, p.name)
            shutil.move(str(p), str(dest_path))
            moved.append(str(dest_path))

    try:
        with fs_errors("Permission denied to move items", "Move failed"):
            run_for_request(request, use_sudo, _do_move)
    except HTTPException as exc:
        if moved:
            exc.detail = f"{exc.detail} (moved {len(moved)} of {len(entries)} items before the error)"
        raise
    return {"status": "moved", "moved": moved, "destination": str(dest_dir)}


@router.post("/copy")
def copy_items(payload: dict, request: Request):
    """
    Copy one or more items to a destination directory.
    Uses copy2 for files (preserves metadata) and copytree for directories.
    A name clash gets a timestamp suffix. Every source must exist or nothing is copied.
    """
    sources = _require_sources(payload)
    use_sudo = payload.get("use_sudo") is True
    dest_dir = _destination_dir(payload)
    entries = _existing_entries(sources)

    copied = []

    def _do_copy():
        for p in entries:
            dest_path = unique_dest(dest_dir, p.name)
            if p.is_dir():
                shutil.copytree(str(p), str(dest_path))
            else:
                shutil.copy2(str(p), str(dest_path))
            copied.append(str(dest_path))

    try:
        with fs_errors("Permission denied to copy items", "Copy failed"):
            run_for_request(request, use_sudo, _do_copy)
    except HTTPException as exc:
        if copied:
            exc.detail = f"{exc.detail} (copied {len(copied)} of {len(entries)} items before the error)"
        raise
    return {"status": "copied", "copied": copied, "destination": str(dest_dir)}


@router.post("/rename")
def rename_item(payload: dict, request: Request):
    """
    Rename a single file, directory or symlink in place. For a symlink the link itself changes name.
    Returns 409 if an item with the new name already exists - no silent overwrite.
    Path separators in new_name are rejected to prevent traversal.
    """
    source = _require_str(payload, "source")
    new_name = payload.get("new_name")
    new_name = new_name.strip() if isinstance(new_name, str) else ""
    use_sudo = payload.get("use_sudo") is True
    if not new_name:
        raise HTTPException(status_code=400, detail="Missing source or new_name")
    if "/" in new_name or "\\" in new_name or "\0" in new_name or new_name in (".", ".."):
        raise HTTPException(status_code=400, detail="New name cannot contain path separators")

    p = get_entry_path(source)
    if not os.path.lexists(p):
        raise HTTPException(status_code=404, detail="Item not found")

    dest_path = p.parent / new_name
    if os.path.lexists(dest_path):
        raise HTTPException(status_code=409, detail=f"An item named '{new_name}' already exists in this directory")

    def _do_rename():
        os.rename(str(p), str(dest_path))

    with fs_errors("Permission denied to rename item", "Rename failed"):
        run_for_request(request, use_sudo, _do_rename)
    return {"status": "renamed", "source": str(p), "destination": str(dest_path)}


class ZipLimitError(Exception):
    """A zip would hold more entries or bytes than ZIP_MAX_ENTRIES / ZIP_MAX_BYTES allow."""


def _zip_add_source(zf, src: Path, own_file, budget: dict, skipped: list) -> None:
    """
    Add src (a file, or a folder with all its subfolders, empty ones included) under its own name.

    own_file is the archive being written (an os.stat_result); it is never added to itself.
    Files that cannot be stored (broken links, sockets, pipes, linked folders) are added to
    skipped by path. An unreadable file raises PermissionError.
    """
    def _fail(error):
        raise error

    def _add_file(fs_path: str, arcname: str) -> None:
        try:
            st = os.stat(fs_path)
        except OSError:
            skipped.append(fs_path)
            return
        if own_file is not None and (st.st_dev, st.st_ino) == (own_file.st_dev, own_file.st_ino):
            return
        if not stat.S_ISREG(st.st_mode):
            skipped.append(fs_path)
            return
        budget["entries"] += 1
        budget["bytes"] += st.st_size
        if budget["entries"] > ZIP_MAX_ENTRIES or budget["bytes"] > ZIP_MAX_BYTES:
            raise ZipLimitError
        zf.write(fs_path, arcname)

    if not src.is_dir():
        _add_file(str(src), src.name)
        return

    for root, dirs, files in os.walk(src, onerror=_fail):
        arc_dir = Path(root).relative_to(src.parent)
        budget["entries"] += 1
        if budget["entries"] > ZIP_MAX_ENTRIES:
            raise ZipLimitError
        zf.write(root, str(arc_dir))
        skipped.extend(os.path.join(root, d) for d in dirs if os.path.islink(os.path.join(root, d)))
        for name in files:
            _add_file(os.path.join(root, name), str(arc_dir / name))


@router.post("/compress")
def compress_items(payload: dict, request: Request):
    """
    Compress one or more items into a ZIP archive saved in the destination directory.
    Single item: named <item_name>.zip. Multiple items: archive_<timestamp>.zip. A name clash
    gets a timestamp suffix. The archive is built under a temporary name and renamed when
    complete, so a failure leaves nothing behind. Runs as the logged-in user.
    Response: {"status", "archive", "skipped"} where skipped lists paths that could not be stored.
    """
    sources = _require_sources(payload)
    dest_dir = _destination_dir(payload)
    entries = _existing_entries(sources)

    names = [e.name for e in entries]
    if len(set(names)) != len(names):
        raise HTTPException(status_code=400, detail="Two selected items have the same name")

    zip_name = f"{names[0]}.zip" if len(entries) == 1 else f"archive_{int(time.time())}.zip"

    def _do_compress():
        partial = dest_dir / f".{zip_name}.{uuid.uuid4().hex}.partial"
        skipped: list[str] = []
        budget = {"entries": 0, "bytes": 0}
        try:
            with open(partial, "xb") as fh, zipfile.ZipFile(
                fh, "w", zipfile.ZIP_DEFLATED, strict_timestamps=False
            ) as zf:
                own_file = os.fstat(fh.fileno())
                for src in entries:
                    _zip_add_source(zf, src, own_file, budget, skipped)
            final = unique_dest(dest_dir, zip_name)
            os.replace(partial, final)
            return final, skipped
        finally:
            with contextlib.suppress(OSError):
                partial.unlink(missing_ok=True)

    try:
        with fs_errors("Permission denied to compress items", "Compression failed"):
            archive, skipped = run_with_user_privileges(request, _do_compress)
    except ZipLimitError as exc:
        raise HTTPException(
            status_code=413,
            detail=(
                f"Too large to compress: the limit is {ZIP_MAX_ENTRIES} entries "
                f"and {ZIP_MAX_BYTES // 1024 ** 3} GB"
            ),
        ) from exc
    return {"status": "compressed", "archive": str(archive), "skipped": skipped}


@router.post("/git-commit")
def git_commit_file(payload: dict, request: Request):
    """
    Universal Git Save & Commit Touch Macro.
    Auto-detects Git repos and runs git add and git commit for the one file. A file that is
    saved but not committed (no repository, nothing changed, commit refused) comes back as
    status "saved" with git false and a message saying why.
    """
    p = get_safe_path(payload.get("path"))
    file_dir = p.parent
    if not file_dir.is_dir():
        raise HTTPException(status_code=404, detail="Directory not found")
    if not shutil.which("git"):
        return {"status": "saved", "git": False, "message": "File saved (Git is not installed on this server)"}

    def _git(*args):
        return subprocess.run(
            ["git", *args],
            cwd=file_dir,
            capture_output=True,
            text=True,
            timeout=GIT_TIMEOUT_SECONDS,
            stdin=subprocess.DEVNULL,
            check=False,
        )

    def _last_line(res) -> str:
        text = (res.stderr or res.stdout or "").strip()
        return text.splitlines()[-1] if text else f"exit code {res.returncode}"

    def _do_commit():
        try:
            if _git("rev-parse", "--is-inside-work-tree").returncode != 0:
                return {"status": "saved", "git": False, "message": "File saved (not inside a Git repository)"}
            added = _git("add", "--", str(p))
            if added.returncode != 0:
                return {"status": "saved", "git": False,
                        "message": f"Saved file, but git add failed: {_last_line(added)}"}
            committed = _git("commit", "-m", f"Update {p.name}", "--", str(p))
        except subprocess.TimeoutExpired:
            return {"status": "saved", "git": False,
                    "message": f"Saved file, but Git did not finish within {GIT_TIMEOUT_SECONDS} seconds"}
        if committed.returncode == 0:
            return {"status": "committed", "git": True, "message": f"Committed {p.name} cleanly to Git"}
        output = f"{committed.stdout}\n{committed.stderr}"
        if any(text in output for text in ("nothing to commit", "nothing added to commit", "no changes added")):
            return {"status": "saved", "git": False, "message": f"File saved (no changes to commit in {p.name})"}
        return {"status": "saved", "git": False,
                "message": f"Saved file, but Git commit failed: {_last_line(committed)}"}

    with fs_errors("Permission denied to run Git here", "Git failed"):
        return run_with_user_privileges(request, _do_commit)


def _attachment_header(name: str) -> str:
    """Build a Content-Disposition value that survives quotes and non-ASCII characters in a file name."""
    fallback = "".join(c if 32 <= ord(c) < 127 and c not in '"\\' else "_" for c in name)
    return f"attachment; filename=\"{fallback}\"; filename*=UTF-8''{urllib.parse.quote(name)}"


def _stream_and_close(fh):
    """Yield a binary file in fixed-size chunks and close it afterwards."""
    try:
        while True:
            chunk = fh.read(IO_CHUNK_BYTES)
            if not chunk:
                break
            yield chunk
    finally:
        fh.close()


@router.get("/download")
def download_file(path: str, request: Request):
    """
    Universal Binary File Stream & On-The-Fly Folder ZIP Archiver.
    A folder is zipped into a temporary file that spills from memory to disk past ZIP_SPOOL_BYTES.
    """
    p = get_safe_path(path)

    def _open_file():
        st = os.stat(p)
        if stat.S_ISREG(st.st_mode):
            return open(p, "rb"), st.st_size
        if not stat.S_ISDIR(st.st_mode):
            raise HTTPException(status_code=400, detail="Not a regular file or folder")
        spool = tempfile.SpooledTemporaryFile(max_size=ZIP_SPOOL_BYTES)  # noqa: SIM115 (closed by _stream_and_close)
        try:
            with zipfile.ZipFile(spool, "w", zipfile.ZIP_DEFLATED, strict_timestamps=False) as zf:
                _zip_add_source(zf, p, None, {"entries": 0, "bytes": 0}, [])
            size = spool.tell()
            spool.seek(0)
        except BaseException:
            spool.close()
            raise
        return spool, size

    try:
        with fs_errors("Permission denied to download item", "Download failed"):
            fh, size = run_with_user_privileges(request, _open_file)
    except ZipLimitError as exc:
        raise HTTPException(status_code=413, detail="Folder is too large to download as one archive") from exc

    is_file = p.is_file()
    return StreamingResponse(
        _stream_and_close(fh),
        media_type="application/octet-stream" if is_file else "application/zip",
        headers={
            "Content-Disposition": _attachment_header(p.name if is_file else f"{p.name}.zip"),
            "Content-Length": str(size),
        },
    )


@router.post("/upload")
def upload_files(target_dir: str, request: Request, files: Annotated[list[UploadFile], File()]):
    """
    Single or Batch Multipart Binary File Uploader.
    A plain def handler: the copy to disk runs in the thread pool and never blocks the event loop.
    Each file is written to a temporary name and renamed over its final name when complete, so a
    failed upload never leaves a truncated file in place of an existing one.
    """
    p = get_safe_path(target_dir)
    if not p.is_dir():
        raise HTTPException(status_code=404, detail="Target directory not found")

    names = []
    for file in files:
        # Keep only the last component of either separator style; it also strips traversal sequences.
        name = (file.filename or "").replace("\\", "/").rsplit("/", 1)[-1]
        if name in ("", ".", ".."):
            raise HTTPException(status_code=400, detail="Upload has no usable file name")
        names.append(name)

    uploaded = []

    def _do_upload():
        for file, name in zip(files, names, strict=True):
            partial = p / f".{name}.{uuid.uuid4().hex}.partial"
            try:
                with open(partial, "xb") as out:
                    shutil.copyfileobj(file.file, out, IO_CHUNK_BYTES)
                os.replace(partial, p / name)
            finally:
                with contextlib.suppress(OSError):
                    partial.unlink(missing_ok=True)
            uploaded.append(name)

    try:
        with fs_errors("Permission denied to upload here", "Upload failed"):
            run_with_user_privileges(request, _do_upload)
    except HTTPException as exc:
        if uploaded:
            exc.detail = f"{exc.detail} (uploaded {len(uploaded)} of {len(names)} files before the error)"
        raise
    return {"status": "uploaded", "files": uploaded, "target": str(p)}
