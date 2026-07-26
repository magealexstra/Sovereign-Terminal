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
from auth import AUTH_MODE, ENABLE_AUTH, SESSION_COOKIE_NAME, active_sessions

router = APIRouter(tags=["terminal"])

SUDO_MACRO_SECRET = os.getenv("SUDO_MACRO_SECRET", "")

_tmux_bin = shutil.which("tmux")

# Pre-warm the tmux server at module load time.
# This ensures the server socket exists before any WebSocket session connects,
# eliminating the "error connecting" race on first connection.
if _tmux_bin:
    subprocess.run([_tmux_bin, "start-server"], capture_output=True, check=False)


def set_pty_size(fd, rows, cols):
    """Set Linux PTY window size via TIOCSWINSZ ioctl signal."""
    try:
        size = struct.pack("HHHH", rows, cols, 0, 0)
        fcntl.ioctl(fd, termios.TIOCSWINSZ, size)
    except Exception as e:
        print(f"Error setting PTY size: {e}")


@router.websocket("/ws/terminal")
async def websocket_terminal(websocket: WebSocket, session: str = "main", cwd: str = "/workspace"):
    if AUTH_MODE != "disabled":
        cookie_token = websocket.cookies.get(SESSION_COOKIE_NAME)
        if not cookie_token or cookie_token not in active_sessions:
            await websocket.close(code=1008)
            return

    await websocket.accept()

    tmux_bin = _tmux_bin
    target_cwd = cwd if (cwd and os.path.isdir(cwd)) else os.getenv("WORKSPACE_ROOT", "/workspace")

    if tmux_bin:
        # Attach to existing session (-A) if available, or create new one if not.
        cmd = [tmux_bin, "new-session", "-A", "-s", session, "-c", target_cwd]
    else:
        cmd = [shutil.which("bash") or "/bin/sh"]

    master_fd, slave_fd = pty.openpty()

    env = os.environ.copy()
    env["TERM"] = "xterm-256color"
    env["COLORTERM"] = "truecolor"
    if os.getenv("TZ"):
        env["TZ"] = os.getenv("TZ")

    def preexec():
        os.setsid()
        try:
            fcntl.ioctl(slave_fd, termios.TIOCSCTTY, 0)
        except Exception:
            pass

    proc = subprocess.Popen(
        cmd,
        preexec_fn=preexec,
        stdin=slave_fd,
        stdout=slave_fd,
        stderr=slave_fd,
        universal_newlines=False,
        cwd=target_cwd,
        env=env
    )
    os.close(slave_fd)

    set_pty_size(master_fd, 24, 80)

    # NOTE: Global tmux options (window-size manual, status-position bottom, mouse on)
    # are now set via /root/.tmux.conf baked into the container image.
    # We do NOT call subprocess.run set-option here — doing so per-session caused
    # race conditions that crashed the tmux server when multiple tabs opened quickly.

    loop = asyncio.get_event_loop()

    async def pty_read_loop():
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
                        if tmux_bin:
                            try:
                                # Resize the tmux window to match the new PTY dimensions.
                                # No send-keys C-l — tmux redraws automatically on resize.
                                subprocess.run(
                                    [tmux_bin, "resize-window", "-t", f"{session}:0",
                                     "-x", str(cols), "-y", str(rows)],
                                    capture_output=True, check=False
                                )
                                subprocess.run(
                                    [tmux_bin, "refresh-client", "-t", session],
                                    capture_output=True, check=False
                                )
                            except Exception:
                                pass
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
