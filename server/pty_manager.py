import os
import pwd
import pty
import select
import shutil
import struct
import fcntl
import termios
import asyncio
import subprocess
import json
from pathlib import Path
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, Request
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
            fmt = "#{session_name}|#{session_attached}|#{session_windows}"
            if use_pam and target_user:
                cmd = ["su", "-", target_user, "-c", f"{_get_tmux_base_str()} list-sessions -F '{fmt}'"]
            else:
                cmd = _get_tmux_base() + ["list-sessions", "-F", fmt]

            res = subprocess.run(cmd, capture_output=True, text=True, check=False)
            if res.returncode == 0 and res.stdout:
                sessions = []
                detail = []
                for line in res.stdout.splitlines():
                    parts = line.strip().split("|")
                    if not parts or not parts[0]:
                        continue
                    name = parts[0]
                    attached = len(parts) > 1 and parts[1] == "1"
                    windows = int(parts[2]) if len(parts) > 2 and parts[2].isdigit() else 1
                    sessions.append(name)
                    detail.append({"name": name, "attached": attached, "windows": windows})
                return {"sessions": sessions, "detail": detail}
        except Exception:
            pass

    return {"sessions": [], "detail": []}


@router.get("/api/terminal/cwd")
def get_session_cwd(session: str = "main", user: dict = Depends(require_auth)):
    """Get real-time working directory of an active tmux session."""
    target_user = user.get("username") if (AUTH_MODE == "pam" and ENABLE_AUTH and user) else None
    if _tmux_bin:
        try:
            if target_user:
                cmd = ["su", "-", target_user, "-c", f"{_get_tmux_base_str()} display-message -p -t '{session}' '#{{pane_current_path}}'"]
            else:
                cmd = _get_tmux_base() + ["display-message", "-p", "-t", session, "#{pane_current_path}"]

            res = subprocess.run(cmd, capture_output=True, text=True, check=False)
            if res.returncode == 0 and res.stdout.strip():
                cwd = res.stdout.strip()
                if os.path.isdir(cwd):
                    return {"status": "ok", "cwd": cwd}
        except Exception:
            pass

    default_cwd = os.getenv("SOVEREIGN_ROOT", str(Path.home()))
    return {"status": "ok", "cwd": default_cwd}


@router.delete("/api/terminal/sessions")
def kill_all_sessions(user: dict = Depends(require_auth)):
    """Kill ALL tmux sessions and immediately rewarm the server."""
    if not _tmux_bin:
        raise HTTPException(status_code=503, detail="tmux not available")
    use_pam = (AUTH_MODE == "pam" and ENABLE_AUTH)
    target_user = user.get("username") if (use_pam and user) else None
    try:
        if use_pam and target_user:
            cmd = ["su", "-", target_user, "-c", f"{_get_tmux_base_str()} kill-server"]
        else:
            cmd = _get_tmux_base() + ["kill-server"]
        subprocess.run(cmd, capture_output=True, text=True, check=False)
        # Rewarm so the next connection finds a live server immediately
        subprocess.run(_get_tmux_base() + ["start-server"],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
        return {"status": "ok", "message": "All sessions killed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/terminal/sessions/{session_id}")
def kill_session(session_id: str, user: dict = Depends(require_auth)):
    """Kill a specific tmux session by name."""
    if not _tmux_bin:
        raise HTTPException(status_code=503, detail="tmux not available")
    use_pam = (AUTH_MODE == "pam" and ENABLE_AUTH)
    target_user = user.get("username") if (use_pam and user) else None
    try:
        if use_pam and target_user:
            cmd = ["su", "-", target_user, "-c", f"{_get_tmux_base_str()} kill-session -t '{session_id}'"]
        else:
            cmd = _get_tmux_base() + ["kill-session", "-t", session_id]
        res = subprocess.run(cmd, capture_output=True, text=True, check=False)
        if res.returncode == 0:
            return {"status": "ok", "killed": session_id}
        return {"status": "error", "detail": res.stderr.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/terminal/sessions/sweep")
async def sweep_sessions(request: Request, user: dict = Depends(require_auth)):
    """Kill tmux sessions that are not in the provided active UI-tab list."""
    if not _tmux_bin:
        raise HTTPException(status_code=503, detail="tmux not available")
    use_pam = (AUTH_MODE == "pam" and ENABLE_AUTH)
    target_user = user.get("username") if (use_pam and user) else None

    body = await request.json()
    active_ids = set(body.get("active", []))

    # Fetch the current live session list
    try:
        if use_pam and target_user:
            cmd = ["su", "-", target_user, "-c", f"{_get_tmux_base_str()} list-sessions -F '#S'"]
        else:
            cmd = _get_tmux_base() + ["list-sessions", "-F", "#S"]
        res = subprocess.run(cmd, capture_output=True, text=True, check=False)
        if res.returncode != 0 or not res.stdout:
            return {"status": "ok", "swept": []}
        live_sessions = [s.strip() for s in res.stdout.splitlines() if s.strip()]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    swept = []
    for sess in live_sessions:
        if sess not in active_ids:
            try:
                if use_pam and target_user:
                    kill_cmd = ["su", "-", target_user, "-c", f"{_get_tmux_base_str()} kill-session -t '{sess}'"]
                else:
                    kill_cmd = _get_tmux_base() + ["kill-session", "-t", sess]
                subprocess.run(kill_cmd, capture_output=True, text=True, check=False)
                swept.append(sess)
            except Exception:
                pass
    return {"status": "ok", "swept": swept}


@router.post("/api/terminal/config")
async def apply_tmux_config(request: Request, user: dict = Depends(require_auth)):
    """Apply tmux runtime configuration options (history-limit, escape-time)."""
    if not _tmux_bin:
        raise HTTPException(status_code=503, detail="tmux not available")
    use_pam = (AUTH_MODE == "pam" and ENABLE_AUTH)
    target_user = user.get("username") if (use_pam and user) else None

    body = await request.json()
    options = {}
    if "historyLimit" in body:
        options["history-limit"] = str(max(1000, min(500000, int(body["historyLimit"]))))
    if "escapeTimeMs" in body:
        options["escape-time"] = str(max(0, min(500, int(body["escapeTimeMs"]))))

    applied = []
    for opt, val in options.items():
        try:
            if use_pam and target_user:
                cmd = ["su", "-", target_user, "-c", f"{_get_tmux_base_str()} set-option -g {opt} {val}"]
            else:
                cmd = _get_tmux_base() + ["set-option", "-g", opt, val]
            res = subprocess.run(cmd, capture_output=True, text=True, check=False)
            if res.returncode == 0:
                applied.append(f"{opt}={val}")
        except Exception:
            pass

    return {"status": "ok", "applied": applied}

SUDO_MACRO_SECRET = os.getenv("SUDO_MACRO_SECRET", "")

_tmux_bin = shutil.which("tmux") or shutil.which("tmux", path="/usr/local/bin:/usr/bin:/bin")

# Context-Aware Socket Resolution
# Only use the host's custom socket path if we are actually in pass-through mode.
# Otherwise, ignore it and let tmux safely fall back to its default isolated sandbox behavior.
_socket_path = os.environ.get("TMUX_SOCKET_PATH")
if os.environ.get("DEPLOYMENT_MODE") != "pass-through":
    _socket_path = None

def _get_tmux_base():
    return [_tmux_bin, "-S", _socket_path] if _socket_path else [_tmux_bin]

def _get_tmux_base_str():
    return f"{_tmux_bin} -S '{_socket_path}'" if _socket_path else _tmux_bin

# Pre-warm the tmux server at module load time if we are in pass-through mode and the socket is missing.
# Wait, if we are in sandbox mode, we definitely want to pre-warm the isolated server!
# So we run start-server unconditionally if we are in sandbox mode, or if pass-through has no socket set.
if _tmux_bin and (os.environ.get("DEPLOYMENT_MODE") != "pass-through" or not os.environ.get("TMUX_SOCKET_PATH")):
    subprocess.run(_get_tmux_base() + ["start-server"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)


def set_pty_size(fd, rows, cols):
    """Set Linux PTY window size via TIOCSWINSZ ioctl signal."""
    try:
        size = struct.pack("HHHH", rows, cols, 0, 0)
        fcntl.ioctl(fd, termios.TIOCSWINSZ, size)
    except Exception as e:
        print(f"Error setting PTY size: {e}")


@router.websocket("/ws/terminal")
async def websocket_terminal(websocket: WebSocket, session: str = "main", cwd: str = ""):
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
    target_cwd = cwd if (cwd and os.path.isdir(cwd)) else os.getenv("SOVEREIGN_ROOT", str(Path.home()))

    uinfo = None
    if use_pam and target_user:
        try:
            uinfo = pwd.getpwnam(target_user)
            tmux_dir = f"/tmp/tmux-{uinfo.pw_uid}"
            if os.path.exists(tmux_dir):
                os.chown(tmux_dir, uinfo.pw_uid, uinfo.pw_gid)
                os.chmod(tmux_dir, 0o700)
        except Exception as e:
            print(f"Warning: Failed to setup user context for {target_user}: {e}", flush=True)

    if tmux_bin:
        # THE GATEKEEPER: Prevent the Trapped Server Race Condition
        if os.environ.get("DEPLOYMENT_MODE") == "pass-through" and _socket_path:
            if not os.path.exists(_socket_path):
                await websocket.close(code=1011, reason="Host tmux server is offline. Please start it on the host.")
                return

        # Attach to existing session (-A) if available, or create new one if not.
        cmd = _get_tmux_base() + ["new-session", "-A", "-D", "-s", session, "-c", target_cwd]
    else:
        cmd = [shutil.which("bash") or "/bin/sh"]

    master_fd, slave_fd = pty.openpty()

    env = os.environ.copy()
    env["TERM"] = "xterm-256color"
    env["COLORTERM"] = "truecolor"
    
    if use_pam and target_user and uinfo:
        env["USER"] = uinfo.pw_name
        env["HOME"] = uinfo.pw_dir
        env["LOGNAME"] = uinfo.pw_name
    else:
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
            
        if use_pam and target_user and uinfo:
            import sys
            try:
                os.initgroups(target_user, uinfo.pw_gid)
                os.setgid(uinfo.pw_gid)
                os.setuid(uinfo.pw_uid)
            except Exception as e:
                print(f"FATAL: Could not drop privileges to {target_user}: {e}", file=sys.stderr)
                os._exit(1)

    try:
        print(f"Executing: {cmd}", flush=True)
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
    except (FileNotFoundError, PermissionError) as e:
        os.close(slave_fd)
        os.close(master_fd)
        await websocket.close(code=1011, reason=f"Failed to start terminal: {str(e)}")
        return
        
    os.close(slave_fd)

    set_pty_size(master_fd, 24, 80)

    # NOTE: Global tmux options (window-size manual, status-position bottom, mouse on)
    # are now set via /etc/tmux.conf baked into the container image.

    # Poll tmux has-session until the session is initialized and available
    if tmux_bin:
        for _ in range(100):  # max 5 seconds (100 * 0.05s)
            if proc.poll() is not None:
                break
            if use_pam and target_user:
                check_cmd = ["su", "-", target_user, "-c", f"{_get_tmux_base_str()} has-session -t {session}"]
            else:
                check_cmd = _get_tmux_base() + ["has-session", "-t", session]
            
            res = subprocess.run(check_cmd, capture_output=True, text=True, check=False)
            if res.returncode == 0:
                break
            await asyncio.sleep(0.05)

    await websocket.send_text(json.dumps({"type": "ready"}))

    loop = asyncio.get_event_loop()

    async def pty_read_loop():
        try:
            while True:
                try:
                    data = await loop.run_in_executor(
                        None,
                        lambda: os.read(master_fd, 1024) if select.select([master_fd], [], [], 0.1)[0] else None
                    )
                except OSError:
                    break
                    
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
                    payload = json.loads(msg)
                    msg_type = payload.get("type")

                    if msg_type == "debug":
                        print(f"DEBUG FROM FRONTEND: {payload.get('msg')}", flush=True)
                        continue

                    if msg_type == "resize":
                        cols = int(payload.get("cols", 80))
                        rows = int(payload.get("rows", 24))
                        force_refresh = bool(payload.get("force_refresh", False))
                        set_pty_size(master_fd, rows, cols)
                        if force_refresh:
                            try:
                                os.write(master_fd, b"\x0c")
                            except Exception as e:
                                print(f"Error writing PTY redraw command: {e}")
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
        except OSError:
            pass
            
        try:
            proc.terminate()
            proc.wait(timeout=1.0)
        except (ProcessLookupError, OSError):
            pass
        except subprocess.TimeoutExpired:
            proc.kill()
