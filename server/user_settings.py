import os
import json
from pathlib import Path
from fastapi import APIRouter, Request, Response, HTTPException, status, Depends
from auth import require_auth, active_sessions, SESSION_COOKIE_NAME, AUTH_MODE

router = APIRouter(prefix="/api/user", tags=["user_settings"])

def get_user_config_path(request: Request) -> Path:
    """
    Resolves the server-side configuration file path for the authenticated user.
    In PAM mode: /home/{username}/.config/sovereign-terminal/settings.json
    Fallback: /workspace/.sovereign_profiles/{username}.json
    In Token mode: /workspace/.sovereign_profiles/default.json
    """
    cookie_token = request.cookies.get(SESSION_COOKIE_NAME)
    session_info = active_sessions.get(cookie_token, {})
    username = session_info.get("username", "admin")

    if AUTH_MODE == "pam" and username and username != "admin":
        user_home_config = Path(f"/home/{username}/.config/sovereign-terminal/settings.json")
        try:
            user_home_config.parent.mkdir(parents=True, exist_ok=True)
            return user_home_config
        except Exception:
            # Fallback to shared workspace profile directory if /home/{username} is read-only
            fallback_dir = Path(os.getenv("WORKSPACE_ROOT", "/workspace")) / ".sovereign_profiles"
            fallback_dir.mkdir(parents=True, exist_ok=True)
            return fallback_dir / f"{username}.json"
    else:
        profile_dir = Path(os.getenv("WORKSPACE_ROOT", "/workspace")) / ".sovereign_profiles"
        profile_dir.mkdir(parents=True, exist_ok=True)
        return profile_dir / "default.json"

@router.get("/settings", dependencies=[Depends(require_auth)])
def get_user_settings(request: Request):
    """Retrieve server-persisted XDG settings for the logged-in user."""
    config_path = get_user_config_path(request)
    if config_path.exists():
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return {"status": "ok", "settings": data, "path": str(config_path)}
        except Exception as e:
            return {"status": "error", "message": f"Failed to read settings: {e}", "settings": {}}
    return {"status": "empty", "settings": {}, "path": str(config_path)}

@router.post("/settings", dependencies=[Depends(require_auth)])
async def save_user_settings(request: Request):
    """Save user settings server-side to XDG config path or profile folder."""
    config_path = get_user_config_path(request)
    try:
        payload = await request.json()
        config_path.parent.mkdir(parents=True, exist_ok=True)
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)
        return {"status": "success", "message": "Settings saved server-side", "path": str(config_path)}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save user settings: {e}"
        )
