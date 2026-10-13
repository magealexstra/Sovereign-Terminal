import asyncio
import contextlib
import json
import os
import re
import shutil
import tempfile
import threading
from pathlib import Path
from typing import Annotated

from auth import AUTH_MODE, require_auth
from fastapi import APIRouter, Depends, HTTPException, status

router = APIRouter(prefix="/api/user", tags=["user_settings"])

CurrentSession = Annotated[dict, Depends(require_auth)]

# A name that may become part of a file path: no separators, no leading dot.
_SAFE_USERNAME = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_.@-]*$")

# One save at a time, so two quick saves cannot interleave their temp files and renames.
_save_lock = threading.Lock()


def get_user_config_path(session_info: dict) -> Path:
    """
    Resolves the server-side configuration file path for the authenticated user.
    In PAM mode:      /home/{username}/.config/sovereign-terminal/settings.json
    PAM fallback:     ~/.local/share/sovereign-terminal/profiles/{username}.json
    In Token mode:    ~/.local/share/sovereign-terminal/profiles/default.json
    """
    username = session_info.get("username", "admin")
    profile_dir = Path.home() / ".local" / "share" / "sovereign-terminal" / "profiles"

    if AUTH_MODE == "pam" and username and username != "admin":
        if not _SAFE_USERNAME.match(username):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This user name cannot be used for a settings file"
            )
        user_home_config = Path(f"/home/{username}/.config/sovereign-terminal/settings.json")
        try:
            user_home_config.parent.mkdir(parents=True, exist_ok=True)
            return user_home_config
        except OSError:
            # Fall back to the XDG data dir if /home/{username} is read-only
            profile_dir.mkdir(parents=True, exist_ok=True)
            return profile_dir / f"{username}.json"

    profile_dir.mkdir(parents=True, exist_ok=True)
    return profile_dir / "default.json"


def _write_settings_file(config_path: Path, payload: dict) -> None:
    """Write the file whole or not at all: a temp file in the same folder, then a rename over the target."""
    with _save_lock:
        config_path.parent.mkdir(parents=True, exist_ok=True)
        fd, temp_name = tempfile.mkstemp(dir=config_path.parent, prefix=config_path.name + ".", suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2)
                f.flush()
                os.fsync(f.fileno())
            if config_path.exists():
                shutil.copymode(config_path, temp_name)
            os.replace(temp_name, config_path)
        except BaseException:
            with contextlib.suppress(OSError):
                os.unlink(temp_name)
            raise


@router.get("/settings")
def get_user_settings(session_info: CurrentSession):
    """Retrieve server-persisted XDG settings for the logged-in user."""
    config_path = get_user_config_path(session_info)
    if not config_path.exists():
        return {"status": "empty", "settings": {}, "path": str(config_path)}
    try:
        with open(config_path, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError) as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to read settings: {e}"
        ) from e
    if not isinstance(data, dict):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to read settings: the stored file does not hold a settings object"
        )
    return {"status": "ok", "settings": data, "path": str(config_path)}


@router.post("/settings")
async def save_user_settings(payload: dict, session_info: CurrentSession):
    """Save user settings server-side to XDG config path or profile folder."""
    config_path = await asyncio.to_thread(get_user_config_path, session_info)
    try:
        await asyncio.to_thread(_write_settings_file, config_path, payload)
    except (OSError, TypeError, ValueError) as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save user settings: {e}"
        ) from e
    return {"status": "success", "message": "Settings saved server-side", "path": str(config_path)}
