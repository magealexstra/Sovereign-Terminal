import os
import uvicorn
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from auth import router as auth_router
from pty_manager import router as pty_router
from fs_api import router as fs_router

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

if __name__ == "__main__":
    port = int(os.getenv("PORT", "2068"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
