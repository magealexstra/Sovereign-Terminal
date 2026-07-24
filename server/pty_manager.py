import os
import pty
import select
import shutil
import struct
import fcntl
import termios
import asyncio
import subprocess
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(tags=["terminal"])

SUDO_MACRO_SECRET = os.getenv("SUDO_MACRO_SECRET", "")

def set_pty_size(fd, rows, cols):
    """Set Linux PTY window size via TIOCSWINSZ ioctl signal."""
    try:
        size = struct.pack("HHHH", rows, cols, 0, 0)
        fcntl.ioctl(fd, termios.TIOCSWINSZ, size)
    except Exception as e:
        print(f"Error setting PTY size: {e}")

@router.websocket("/ws/terminal")
async def websocket_terminal(websocket: WebSocket, session: str = "mobile-voice"):
    await websocket.accept()

    # Determine command to execute: tmux session or bash fallback
    tmux_bin = shutil.which("tmux")
    if tmux_bin:
        cmd = [tmux_bin, "new-session", "-A", "-s", session]
    else:
        cmd = [shutil.which("bash") or "/bin/sh"]

    # Allocate Linux Pseudoterminal (PTY)
    master_fd, slave_fd = pty.openpty()
    
    # Prepare environment variables with xterm-256color and truecolor
    env = os.environ.copy()
    env["TERM"] = "xterm-256color"
    env["COLORTERM"] = "truecolor"

    # Spawn child process attached to slave PTY
    proc = subprocess.Popen(
        cmd,
        preexec_fn=os.setsid,
        stdin=slave_fd,
        stdout=slave_fd,
        stderr=slave_fd,
        universal_newlines=False,
        cwd=os.getenv("WORKSPACE_ROOT", "/workspace"),
        env=env
    )
    os.close(slave_fd)

    # Initial PTY size
    set_pty_size(master_fd, 24, 80)

    loop = asyncio.get_event_loop()

    async def pty_read_loop():
        """Read output from Linux PTY and stream to WebSocket."""
        try:
            while True:
                data = await loop.run_in_executor(
                    None,
                    lambda: os.read(master_fd, 1024) if select.select([master_fd], [], [], 0.1)[0] else None
                )
                if data:
                    await websocket.send_text(data.decode("utf-8", errors="replace"))
                elif proc.poll() is not None:
                    break
                await asyncio.sleep(0.01)
        except Exception as e:
            print(f"PTY read loop ended: {e}")

    read_task = asyncio.create_task(pty_read_loop())

    try:
        while True:
            msg = await websocket.receive_text()
            
            if msg.startswith("{") and msg.endswith("}"):
                try:
                    import json
                    payload = json.loads(msg)
                    msg_type = payload.get("type")

                    if msg_type == "resize":
                        cols = payload.get("cols", 80)
                        rows = payload.get("rows", 24)
                        set_pty_size(master_fd, rows, cols)
                        continue
                    elif msg_type == "sudo_macro":
                        if SUDO_MACRO_SECRET:
                            os.write(master_fd, (SUDO_MACRO_SECRET + "\n").encode("utf-8"))
                        continue
                except Exception:
                    pass
            
            os.write(master_fd, msg.encode("utf-8"))

    except WebSocketDisconnect:
        print("WebSocket client disconnected")
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        read_task.cancel()
        try:
            os.close(master_fd)
            proc.terminate()
        except Exception:
            pass
