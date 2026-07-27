import os
import pty
import select
import shutil
import struct
import fcntl
import termios
import asyncio
import subprocess
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from auth import AUTH_MODE, ENABLE_AUTH, SESSION_COOKIE_NAME, active_sessions, require_auth

router = APIRouter(tags=["terminal"])

@router.get("/api/terminal/sessions")
def list_sessions(user: dict = Depends(require_auth)):
    target_user = None
    use_pam = (AUTH_MODE == "pam" and ENABLE_AUTH)
    if use_pam and user:
        target_user = user.get("username")

    if _tmux_bin:
        try:
            if use_pam and target_user:
                cmd = ["su", "-", target_user, "-c", f"{_tmux_bin} list-sessions -F '#S'"]
            else:
                cmd = [_tmux_bin, "list-sessions", "-F", "#S"]

            res = subprocess.run(cmd, capture_output=True, text=True, check=False)
            if res.returncode == 0 and res.stdout:
                sessions = [s.strip() for s in res.stdout.splitlines() if s.strip()]
                return {"sessions": sessions}
        except Exception:
            pass

    return {"sessions": []}

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
    use_pam = (AUTH_MODE == "pam" and ENABLE_AUTH)
    target_user = None

    if AUTH_MODE != "disabled":
        cookie_token = websocket.cookies.get(SESSION_COOKIE_NAME)
        if not cookie_token or cookie_token not in active_sessions:
            await websocket.close(code=1008)
            return
        if use_pam:
            target_user = active_sessions[cookie_token].get("username")

    await websocket.accept()

    tmux_bin = _tmux_bin
    target_cwd = cwd if (cwd and os.path.isdir(cwd)) else os.getenv("WORKSPACE_ROOT", "/workspace")

    if tmux_bin:
        # Attach to existing session (-A) if available, or create new one if not.
        if use_pam and target_user:
            cmd = ["su", "-", target_user, "-c", f"{tmux_bin} new-session -A -D -s {session} -c {target_cwd}"]
        else:
            cmd = [tmux_bin, "new-session", "-A", "-D", "-s", session, "-c", target_cwd]
    else:
        if use_pam and target_user:
            cmd = ["su", "-", target_user]
        else:
            cmd = [shutil.which("bash") or "/bin/sh"]

    master_fd, slave_fd = pty.openpty()

    env = os.environ.copy()
    env["TERM"] = "xterm-256color"
    env["COLORTERM"] = "truecolor"
    if not env.get("USER"):
        env["USER"] = os.getenv("USER", "root")
    if not env.get("HOME"):
        env["HOME"] = os.getenv("HOME", "/root")
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

                    if msg_type == "debug":
                        print(f"DEBUG FROM FRONTEND: {payload.get('msg')}", flush=True)
                        continue

                    if msg_type == "resize":
                        cols = int(payload.get("cols", 80))
                        rows = int(payload.get("rows", 24))
                        print(f"RESIZE COMMAND RECEIVED: cols={cols}, rows={rows}", flush=True)
                        set_pty_size(master_fd, rows, cols)
                        
                        if _tmux_bin:
                            if use_pam and target_user:
                                subprocess.run(["su", "-", target_user, "-c", f"{_tmux_bin} refresh-client -t {session}"], check=False)
                            else:
                                subprocess.run([_tmux_bin, "refresh-client", "-t", session], check=False)
                        continue

                    elif msg_type == "sudo_macro":
                        if SUDO_MACRO_SECRET:
                            os.write(master_fd, (SUDO_MACRO_SECRET + "\n").encode("utf-8"))
                        continue

                except Exception as e:
                    print(f"ERROR in websocket JSON processing: {e}", flush=True)
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
