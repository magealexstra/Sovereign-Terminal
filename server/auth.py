import os
import secrets
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, Response, Request, HTTPException, status

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Read auth mode & tokens from environment
# AUTH_MODE options: 'token' (default) | 'pam' | 'disabled'
DEFAULT_ENABLE_AUTH = os.getenv("ENABLE_AUTH", "true").lower() in ("true", "1", "yes")
AUTH_MODE = os.getenv("AUTH_MODE", DEFAULT_ENABLE_AUTH and "token" or "disabled").lower()
ENABLE_AUTH = (AUTH_MODE != "disabled")
SERVER_AUTH_TOKEN = os.getenv("SERVER_AUTH_TOKEN", "sovereign_terminal_token")
if SERVER_AUTH_TOKEN == "sovereign_terminal_token":
    logger.warning("SECURITY WARNING: Using default SERVER_AUTH_TOKEN. Please set SERVER_AUTH_TOKEN environment variable for production deployment.")

SESSION_COOKIE_NAME = "sovereign_session"

# Optional OS-specific PAM dependencies (Linux only)
try:
    import spwd
except ImportError:
    spwd = None

try:
    import crypt
except ImportError:
    crypt = None

try:
    from passlib.hash import sha512_crypt
except ImportError:
    sha512_crypt = None

try:
    import pam
except ImportError:
    pam = None

try:
    import pamela
except ImportError:
    pamela = None

try:
    import grp
except ImportError:
    grp = None

# Active valid session tokens in memory mapping session_token -> metadata dict
active_sessions = {}

def cleanup_expired_sessions(max_age_seconds: int = 30 * 24 * 3600):
    """Evict expired session tokens from active_sessions dictionary."""
    now = datetime.now(timezone.utc)
    expired = [
        token for token, data in active_sessions.items()
        if (now - data.get("created_at", now)).total_seconds() > max_age_seconds
    ]
    for token in expired:
        del active_sessions[token]

def is_user_sudoer(username: str) -> bool:
    """Check if Linux username belongs to administrative groups (sudo, wheel, or root)."""
    if not username or username == "root" or username == "admin":
        return True
    if grp:
        for group_name in ("sudo", "wheel"):
            try:
                g = grp.getgrnam(group_name)
                if username in g.gr_mem:
                    return True
            except KeyError:
                continue
    return False

def authenticate_pam(username: str, password: str) -> bool:
    """Validate username & password against Linux system PAM module."""
    # Attempt direct shadow verification first (most reliable in Docker)
    try:
        if spwd:
            shadow_info = spwd.getspnam(username)
            if shadow_info.sp_pwdp not in ('', '!', '*'):
                if crypt:
                    hashed_input = crypt.crypt(password, shadow_info.sp_pwdp)
                    if hashed_input == shadow_info.sp_pwdp:
                        return True
                elif sha512_crypt:
                    if sha512_crypt.verify(password, shadow_info.sp_pwdp):
                        return True
    except Exception as e:
        logger.error(f"Shadow hash verification bypassed: {e}")
        pass

    try:
        if pam:
            p = pam.pam()
            return p.authenticate(username, password, service='common-auth')
        elif pamela:
            return pamela.authenticate(username, password, service='common-auth')
        else:
            raise ImportError("Neither 'pam' nor 'pamela' modules are installed.")
    except Exception as e:
        logger.error(f"PAM authentication fatal error: {e}")
        raise Exception(f"Server misconfiguration: PAM module crashed ({e})")

def is_authenticated(request: Request) -> bool:
    if AUTH_MODE == "disabled":
        return True
    cleanup_expired_sessions()
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

    cleanup_expired_sessions()

    username = payload.get("username", "")
    password = payload.get("password", "")

    authenticated = False
    if AUTH_MODE == "pam":
        if not username or not password:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Username and password required for PAM authentication"
            )
        try:
            authenticated = authenticate_pam(username, password)
        except Exception as e:
            logger.error(f"PAM authentication failed: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Authentication service internal error"
            )
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
        "username": username if AUTH_MODE == "pam" else "admin",
        "created_at": datetime.now(timezone.utc)
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
        username = session_info.get("username", "admin")
        sudoer = is_user_sudoer(username) if AUTH_MODE == "pam" else True
        return {
            "status": "valid",
            "auth_mode": AUTH_MODE,
            "auth_enabled": AUTH_MODE != "disabled",
            "username": username,
            "is_sudoer": sudoer
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

