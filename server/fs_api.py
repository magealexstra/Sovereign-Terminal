import os
import time
import shutil
import zipfile
import subprocess
from io import BytesIO
from pathlib import Path
from fastapi import APIRouter, HTTPException, UploadFile, File, Response, Depends
from fastapi.responses import StreamingResponse
from auth import require_auth

router = APIRouter(prefix="/api/fs", tags=["filesystem"], dependencies=[Depends(require_auth)])

WORKSPACE_ROOT = os.getenv("WORKSPACE_ROOT", str(Path(__file__).parent.parent))
TRASH_DIR = os.getenv("TRASH_DIR", os.path.join(WORKSPACE_ROOT, "_temp_trash"))

# Trash Safety vs Permanent Deletion Configuration
# Default is True (moves deleted items to _temp_trash)
# Set SAFE_TRASH_MODE=false or ENABLE_PERMANENT_DELETE=true in config.env to enable permanent removal
SAFE_TRASH_MODE = os.getenv("SAFE_TRASH_MODE", "true").lower() in ("true", "1", "yes")
ENABLE_PERMANENT_DELETE = os.getenv("ENABLE_PERMANENT_DELETE", "false").lower() in ("true", "1", "yes")

def get_safe_path(target_path: str) -> Path:
    """Ensure path is absolute and normalized."""
    return Path(target_path).resolve()


@router.get("/tree")
def get_directory_tree(path: str = WORKSPACE_ROOT):
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
def delete_item(payload: dict):
    """
    File Deletion Handler with Configurable Safety Mode.
    
    • Default (SAFE_TRASH_MODE=true): Moves deleted target to ./_temp_trash/
    • Permanent Mode (ENABLE_PERMANENT_DELETE=true): Permanently removes target.
    """
    target_path = payload.get("path")
    if not target_path:
        raise HTTPException(status_code=400, detail="Missing path")

    p = get_safe_path(target_path)
    if not p.exists():
        raise HTTPException(status_code=404, detail="Item not found")

    # If permanent deletion is explicitly enabled by administrator
    if ENABLE_PERMANENT_DELETE or not SAFE_TRASH_MODE:
        try:
            if p.is_dir():
                shutil.rmtree(p)
            else:
                os.remove(p)
            return {"status": "deleted_permanently", "path": str(p)}
        except PermissionError:
            raise HTTPException(status_code=403, detail="Permission denied to delete item")
        except OSError as e:
            raise HTTPException(status_code=500, detail=f"Permanent deletion failed: {e}")

    # Default Safe Mode: Move to _temp_trash
    os.makedirs(TRASH_DIR, exist_ok=True)
    dest_path = Path(TRASH_DIR) / p.name

    if dest_path.exists():
        dest_path = Path(TRASH_DIR) / f"{p.stem}_{int(time.time())}{p.suffix}"

    try:
        shutil.move(str(p), str(dest_path))
        return {"status": "trashed", "destination": str(dest_path), "mode": "safe_trash"}
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied to move item to trash")
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"File system error: {str(e)}")

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
        dest_file = p / file.filename
        with open(dest_file, "wb") as f:
            shutil.copyfileobj(file.file, f)
        uploaded.append(file.filename)

    return {"status": "uploaded", "files": uploaded, "target": str(p)}
