import os
import uvicorn
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from auth import router as auth_router
from pty_manager import router as pty_router
from fs_api import router as fs_router

from dotenv import load_dotenv

# Load config.env from project root if present
config_env_path = Path(__file__).parent.parent / "config.env"
if config_env_path.exists():
    load_dotenv(config_env_path)

app = FastAPI(
    title="The Sovereign Terminal",
    description="Touch-Controlled Mobile/Tablet-First Linux Server Workstation Gateway",
    version="1.0.0"
)

# CORS Middleware Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API & WebSocket Routers
app.include_router(auth_router)
app.include_router(pty_router)
app.include_router(fs_router)

@app.get("/health")
def health_check():
    return {
        "status": "online",
        "service": "The Sovereign Terminal Gateway",
        "port": os.getenv("PORT", "2068")
    }

# Mount static React frontend dist folder if built
DIST_DIR = Path(__file__).parent.parent / "dist"
if DIST_DIR.exists():
    app.mount("/", StaticFiles(directory=str(DIST_DIR), html=True), name="static")

def get_ssl_certificates():
    cert_path_str = os.getenv("SSL_CERT_PATH", str(Path(__file__).parent / "certs" / "cert.pem"))
    key_path_str = os.getenv("SSL_KEY_PATH", str(Path(__file__).parent / "certs" / "key.pem"))
    cert_file = Path(cert_path_str).resolve()
    key_file = Path(key_path_str).resolve()

    if cert_file.exists() and key_file.exists():
        print(f"Loaded SSL certificate: {cert_file}")
        return str(cert_file), str(key_file)

    print(f"Warning: ENABLE_HTTPS is set to true, but certificate files were not found.")
    print(f"Expected cert: {cert_file}")
    print(f"Expected key: {key_file}")
    print("Please see docs/HTTPS_AND_NETWORKING_GUIDE.md for Tailscale, Nginx Proxy Manager, or SSL certificate setup.")
    return None, None

if __name__ == "__main__":
    default_port = "2068" if os.getenv("ENV", "development") == "development" else "2069"
    port = int(os.getenv("PORT", default_port))
    enable_https = os.getenv("ENABLE_HTTPS", "false").lower() in ("true", "1", "yes")

    ssl_cert, ssl_key = (None, None)
    if enable_https:
        ssl_cert, ssl_key = get_ssl_certificates()

    print(f"Starting Sovereign Terminal Gateway on port {port} (HTTPS: {enable_https})...")

    if enable_https and ssl_cert and ssl_key:
        uvicorn.run(
            "main:app",
            host="0.0.0.0",
            port=port,
            ssl_certfile=ssl_cert,
            ssl_keyfile=ssl_key,
            reload=True
        )
    else:
        uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
