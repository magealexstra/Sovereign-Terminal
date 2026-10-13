import asyncio
import logging
import os
import sys
import traceback
from datetime import datetime
from pathlib import Path

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

# Load .env BEFORE importing routers — auth.py reads SERVER_AUTH_TOKEN at
# module-import time, so load_dotenv must run first or it captures the default.
config_env_path = Path(__file__).parent.parent / ".env"
if config_env_path.exists():
    load_dotenv(config_env_path)

from auth import ENABLE_HTTPS
from auth import router as auth_router
from fs_api import router as fs_router
from fs_audio import router as fs_audio_router
from fs_video import router as fs_video_router
from pty_manager import router as pty_router
from user_settings import router as user_settings_router

logger = logging.getLogger("main")

app = FastAPI(
    title="The Sovereign Terminal",
    description="Touch-Controlled Mobile/Tablet-First Linux Server Workstation Gateway",
    version="1.0.0"
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # The traceback is formatted here, where the exception is live; the log write runs in another thread.
    trace = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))
    log_dir = Path.home() / ".local" / "share" / "sovereign-terminal" / "logs"
    
    def sync_log_write():
        log_dir.mkdir(parents=True, exist_ok=True)
        log_file = log_dir / "server_error.log"
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(f"[{timestamp}] Unhandled Exception on {request.method} {request.url}\n")
            f.write(trace)
            f.write("-" * 80 + "\n")

    try:
        await asyncio.to_thread(sync_log_write)
    except OSError:
        # The log file is not writable (permissions, full disk): the server log gets the traceback instead.
        logger.error("Unhandled exception on %s %s\n%s", request.method, request.url, trace)

    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error. Please check the server logs."}
    )

# CORS: the page and the API come from one origin (the built page is served here, the dev server
# and every documented proxy forward to it), so a browser needs no CORS headers for them. Another
# origin is allowed only when it is named in ALLOWED_ORIGINS, or is one of the local dev origins below.
# Credentials are never combined with "*": that would let any site read answers made with the login cookie.
raw_allowed_origins = os.getenv("ALLOWED_ORIGINS")
if raw_allowed_origins:
    allowed_origins = [origin.strip() for origin in raw_allowed_origins.split(",") if origin.strip()]
else:
    allowed_origins = ["http://localhost:2065", "http://127.0.0.1:2065", "http://localhost:5173"]
allow_cors_credentials = "*" not in allowed_origins
if not allow_cors_credentials:
    logger.warning("ALLOWED_ORIGINS contains '*': cross-origin requests are allowed without the login cookie.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=allow_cors_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API & WebSocket Routers
app.include_router(auth_router)
app.include_router(pty_router)
app.include_router(fs_video_router)  # before fs_router so the /stream route takes precedence
app.include_router(fs_audio_router)  # before fs_router
app.include_router(fs_router)
app.include_router(user_settings_router)

@app.get("/health")
def health_check():
    return {
        "status": "online",
        "service": "The Sovereign Terminal Gateway",
        "port": os.getenv("PORT", "2069")
    }

@app.get("/api/config")
def get_config():
    return {
        "rootDir": os.getenv("SOVEREIGN_ROOT", str(Path.home()))
    }

# Mount static React frontend dist folder if built
DIST_DIR = Path(__file__).parent.parent / "dist"
if DIST_DIR.exists():
    app.mount("/", StaticFiles(directory=str(DIST_DIR), html=True), name="static")

def get_ssl_certificates():
    """Return the certificate and key paths, or stop the server: HTTPS was asked for and cannot be served."""
    cert_path_str = os.getenv("SSL_CERT_PATH", str(Path(__file__).parent / "certs" / "cert.pem"))
    key_path_str = os.getenv("SSL_KEY_PATH", str(Path(__file__).parent / "certs" / "key.pem"))
    cert_file = Path(cert_path_str).resolve()
    key_file = Path(key_path_str).resolve()

    if cert_file.exists() and key_file.exists():
        print(f"Loaded SSL certificate: {cert_file}")
        return str(cert_file), str(key_file)

    # Serving plain HTTP here would send the login over the network unprotected, and the session
    # cookie (marked Secure for HTTPS) would never be kept by the browser, so login could not work.
    sys.exit(
        "ENABLE_HTTPS is set to true, but the certificate files were not found.\n"
        f"Expected cert: {cert_file}\n"
        f"Expected key: {key_file}\n"
        "Provide the certificate and key (SSL_CERT_PATH, SSL_KEY_PATH), or set ENABLE_HTTPS=false "
        "when a proxy or tunnel in front of the server provides HTTPS."
    )

if __name__ == "__main__":
    default_port = "2069"
    port = int(os.getenv("PORT", default_port))

    ssl_cert, ssl_key = get_ssl_certificates() if ENABLE_HTTPS else (None, None)

    print(f"Starting Sovereign Terminal Gateway on port {port} (HTTPS: {ENABLE_HTTPS})...")

    if ssl_cert and ssl_key:
        uvicorn.run(
            "main:app",
            host="0.0.0.0",
            port=port,
            ssl_certfile=ssl_cert,
            ssl_keyfile=ssl_key,
        )
    else:
        uvicorn.run("main:app", host="0.0.0.0", port=port)
