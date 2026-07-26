import os
import secrets
from fastapi import APIRouter, Response, Request, HTTPException, status

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Read auth mode & tokens from environment
# AUTH_MODE options: 'token' (default) | 'pam' | 'disabled'
DEFAULT_ENABLE_AUTH = os.getenv("ENABLE_AUTH", "true").lower() in ("true", "1", "yes")
AUTH_MODE = os.getenv("AUTH_MODE", DEFAULT_ENABLE_AUTH and "token" or "disabled").lower()
ENABLE_AUTH = (AUTH_MODE != "disabled")
SERVER_AUTH_TOKEN = os.getenv("SERVER_AUTH_TOKEN", "sovereign_terminal_token")
SESSION_COOKIE_NAME = "sovereign_session"

# Active valid session tokens in memory mapping session_token -> metadata dict
active_sessions = {}

def authenticate_pam(username: str, password: str) -> bool:
    """Validate username & password against Linux system PAM module."""
    try:
        import pam
        p = pam.pam()
        return p.authenticate(username, password)
    except ImportError:
        try:
            import pamela
            return pamela.authenticate(username, password)
        except Exception as e:
            print(f"PAM module import/auth error: {e}")
            return False
    except Exception as e:
        print(f"PAM authentication error: {e}")
        return False

def is_authenticated(request: Request) -> bool:
    if AUTH_MODE == "disabled":
        return True
    cookie_token = request.cookies.get(SESSION_COOKIE_NAME)
    if not cookie_token:
        return False
    return cookie_token in active_sessions

def require_auth(request: Request):
    if not is_authenticated(request):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )

@router.get("/mode")
def get_auth_mode():
    """Public metadata route returning current active authentication mode."""
    return {"auth_mode": AUTH_MODE, "auth_enabled": AUTH_MODE != "disabled"}

@router.post("/login")
def login(payload: dict, response: Response):
    if AUTH_MODE == "disabled":
        return {"status": "authenticated", "message": "Auth disabled by server configuration", "mode": "disabled"}

    username = payload.get("username", "")
    password = payload.get("password", "")

    authenticated = False
    if AUTH_MODE == "pam":
        if not username or not password:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Username and password required for PAM authentication"
            )
        authenticated = authenticate_pam(username, password)
    else:
        # Default AUTH_MODE == "token"
        if not password:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Password token required"
            )
        authenticated = secrets.compare_digest(password, SERVER_AUTH_TOKEN)

    if not authenticated:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    
    # Generate secure random session token
    session_token = secrets.token_hex(32)
    active_sessions[session_token] = {
        "mode": AUTH_MODE,
        "username": username if AUTH_MODE == "pam" else "admin"
    }
    
    # Set HttpOnly SameSite=Strict cookie
    enable_https = os.getenv("ENABLE_HTTPS", "false").lower() in ("true", "1", "yes")
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_token,
        httponly=True,
        samesite="strict",
        secure=enable_https,
        max_age=30 * 24 * 3600 # 30 days session
    )
    return {"status": "authenticated", "mode": AUTH_MODE}

@router.get("/verify")
def verify(request: Request):
    if is_authenticated(request):
        cookie_token = request.cookies.get(SESSION_COOKIE_NAME)
        session_info = active_sessions.get(cookie_token, {})
        return {
            "status": "valid",
            "auth_mode": AUTH_MODE,
            "auth_enabled": AUTH_MODE != "disabled",
            "username": session_info.get("username", "admin")
        }
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unauthorized",
        headers={"X-Auth-Mode": AUTH_MODE}
    )

@router.post("/logout")
def logout(request: Request, response: Response):
    cookie_token = request.cookies.get(SESSION_COOKIE_NAME)
    if cookie_token in active_sessions:
        del active_sessions[cookie_token]
    response.delete_cookie(SESSION_COOKIE_NAME)
    return {"status": "logged_out"}
