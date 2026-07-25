import os
import secrets
from fastapi import APIRouter, Response, Request, HTTPException, status

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Read server auth token from environment
SERVER_AUTH_TOKEN = os.getenv("SERVER_AUTH_TOKEN", "sovereign_terminal_token")
SESSION_COOKIE_NAME = "sovereign_session"

# Active valid session tokens in memory
active_sessions = set()

def is_authenticated(request: Request) -> bool:
    cookie_token = request.cookies.get(SESSION_COOKIE_NAME)
    if not cookie_token:
        return False
    return cookie_token in active_sessions

@router.post("/login")
def login(payload: dict, response: Response):
    password = payload.get("password", "")
    if not secrets.compare_digest(password, SERVER_AUTH_TOKEN):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token"
        )
    
    # Generate secure random session token
    session_token = secrets.token_hex(32)
    active_sessions.add(session_token)
    
    # Set HttpOnly SameSite=Strict cookie
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_token,
        httponly=True,
        samesite="strict",
        secure=False,  # Set true if HTTPS
        max_age=30 * 24 * 3600 # 30 days session
    )
    return {"status": "authenticated", "message": "HttpOnly session established"}

@router.get("/verify")
def verify(request: Request):
    if is_authenticated(request):
        return {"status": "valid"}
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")

@router.post("/logout")
def logout(request: Request, response: Response):
    cookie_token = request.cookies.get(SESSION_COOKIE_NAME)
    if cookie_token in active_sessions:
        active_sessions.remove(cookie_token)
    response.delete_cookie(SESSION_COOKIE_NAME)
    return {"status": "logged_out"}
