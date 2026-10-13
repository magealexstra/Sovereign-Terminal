import asyncio
import codecs
import collections
import contextlib
import fcntl
import json
import logging
import os
import pty
import pwd
import re
import shlex
import shutil
import signal
import struct
import subprocess
import sys
import termios
from pathlib import Path
from typing import Annotated

from auth import (
    AUTH_MODE,
    ENABLE_AUTH,
    SESSION_COOKIE_NAME,
    require_auth,
    session_for_token,
)
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
    WebSocket,
    WebSocketDisconnect,
)

logger = logging.getLogger("pty_manager")

SESSION_REGEX = re.compile(r"^[a-zA-Z0-9_-]+$")

# The logged-in session's metadata ('username', 'mode'); a request without a live session gets 401 first.
CurrentUser = Annotated[dict, Depends(require_auth)]

router = APIRouter(tags=["terminal"])

# In PAM mode tmux runs as the logged-in user; in every other mode as the server user.
_USE_PAM = AUTH_MODE == "pam" and ENABLE_AUTH

# Seconds a tmux command may run before the request fails.
_TMUX_TIMEOUT = 10

# Largest read from a PTY at once, and how much unsent output may queue before reading pauses.
_PTY_READ_SIZE = 65536
_PTY_QUEUE_LIMIT = 1 << 20

# How often an idle terminal checks that its process is still alive.
_EXIT_CHECK_SECONDS = 1.0

# A control message is a short JSON object; longer text is never parsed as one.
_MAX_CONTROL_LENGTH = 1024

_READY_FRAME = json.dumps({"type": "ready"})

# What tmux prints when there is no server, or none to connect to: an empty list, not a failure.
_NO_SERVER_MARKERS = ("no server running", "error connecting to", "no sessions")


def validate_session_id(session_id: str) -> str:
    if not session_id or not SESSION_REGEX.match(session_id):
        raise HTTPException(status_code=400, detail="Invalid session identifier")
    return session_id


# Number of open terminal sockets per tmux session name. Used by sweep_sessions()
# to avoid killing sessions that are live on another device or browser tab.
_active_ws_sessions: dict[str, int] = {}


def _ws_acquire(session: str) -> None:
    _active_ws_sessions[session] = _active_ws_sessions.get(session, 0) + 1


def _ws_release(session: str) -> None:
    remaining = _active_ws_sessions.get(session, 0) - 1
    if remaining > 0:
        _active_ws_sessions[session] = remaining
    else:
        _active_ws_sessions.pop(session, None)


_tmux_bin = shutil.which("tmux") or shutil.which("tmux", path="/usr/local/bin:/usr/bin:/bin")

# Context-Aware Socket Resolution
# Only use the host's custom socket path if we are actually in pass-through mode.
# Otherwise, ignore it and let tmux fall back to its default isolated server.
_socket_path = os.environ.get("TMUX_SOCKET_PATH")
if os.environ.get("DEPLOYMENT_MODE") != "pass-through":
    _socket_path = None

_project_tmux_conf = Path(__file__).parent / "tmux.conf"
_conf_args = ["-f", str(_project_tmux_conf)] if _project_tmux_conf.exists() else []


def _get_tmux_base():
    cmd = [_tmux_bin]
    if _conf_args:
        cmd.extend(_conf_args)
    if _socket_path:
        cmd.extend(["-S", _socket_path])
    return cmd


def _tmux_cmd(target_user: str | None, *args: str) -> list[str]:
    """The command line for one tmux call; through `su` when it must run as another user."""
    if target_user:
        return ["su", "-", target_user, "-c", shlex.join([*_get_tmux_base(), *args])]
    return [*_get_tmux_base(), *args]


def _run_tmux(target_user: str | None, *args: str) -> subprocess.CompletedProcess:
    """Run one tmux call and return its result. Raises OSError or TimeoutExpired when it cannot run."""
    return subprocess.run(
        _tmux_cmd(target_user, *args),
        capture_output=True, text=True, check=False,
        stdin=subprocess.DEVNULL, timeout=_TMUX_TIMEOUT,
    )


def _run_tmux_for_route(target_user: str | None, *args: str) -> subprocess.CompletedProcess:
    """Like _run_tmux, with a failure to run turned into an HTTP error the front end can show."""
    try:
        return _run_tmux(target_user, *args)
    except subprocess.TimeoutExpired as e:
        raise HTTPException(status_code=504, detail="tmux did not answer in time") from e
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"Could not run tmux: {e}") from e


def _acting_user(session_info: dict) -> str | None:
    """The user tmux must run as: the PAM login in PAM mode, otherwise None (the server user)."""
    if _USE_PAM:
        return session_info.get("username") or None
    return None


def _parse_session_line(line: str) -> dict | None:
    # The last two fields are numbers; a session name may itself contain the separator.
    parts = line.strip().rsplit("|", 2)
    if len(parts) != 3 or not parts[0]:
        return None
    name, attached, windows = parts
    return {"name": name, "attached": attached == "1", "windows": int(windows) if windows.isdigit() else 1}


def _list_live_sessions(target_user: str | None) -> list[dict]:
    """Every tmux session as {name, attached, windows}. No tmux server running is an empty list."""
    res = _run_tmux_for_route(
        target_user, "list-sessions", "-F", "#{session_name}|#{session_attached}|#{session_windows}"
    )
    if res.returncode != 0:
        stderr = res.stderr.strip()
        if any(marker in stderr.lower() for marker in _NO_SERVER_MARKERS):
            return []
        raise HTTPException(status_code=500, detail=f"tmux could not list sessions: {stderr or res.returncode}")
    return [s for s in map(_parse_session_line, res.stdout.splitlines()) if s]


async def _json_object(request: Request) -> dict:
    """The request body as a JSON object, or a 400."""
    try:
        body = await request.json()
    except ValueError as e:
        raise HTTPException(status_code=400, detail="The request body is not valid JSON") from e
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="The request body must be a JSON object")
    return body


@router.get("/api/terminal/sessions")
def list_sessions(user: CurrentUser):
    if not _tmux_bin:
        return {"sessions": [], "detail": []}
    detail = _list_live_sessions(_acting_user(user))
    return {"sessions": [s["name"] for s in detail], "detail": detail}


@router.get("/api/terminal/cwd")
def get_session_cwd(user: CurrentUser, session: str = "main"):
    """Get real-time working directory of an active tmux session."""
    validate_session_id(session)
    if _tmux_bin:
        try:
            res = _run_tmux(_acting_user(user), "display-message", "-p", "-t", session, "#{pane_current_path}")
        except (OSError, subprocess.TimeoutExpired) as e:
            logger.warning("Failed to get tmux session cwd for '%s': %s", session, e)
        else:
            cwd = res.stdout.strip()
            if res.returncode == 0 and cwd and os.path.isdir(cwd):
                return {"status": "ok", "cwd": cwd}

    # No such session yet, or no tmux: new terminals start in the default folder.
    return {"status": "ok", "cwd": os.getenv("SOVEREIGN_ROOT", str(Path.home()))}


@router.delete("/api/terminal/sessions/{session_id}")
def kill_session(session_id: str, user: CurrentUser):
    """Kill a specific tmux session by name."""
    validate_session_id(session_id)
    if not _tmux_bin:
        raise HTTPException(status_code=503, detail="tmux not available")
    # "=" asks tmux for this exact name, never a session whose name merely starts with it.
    res = _run_tmux_for_route(_acting_user(user), "kill-session", "-t", f"={session_id}")
    if res.returncode == 0:
        return {"status": "ok", "killed": session_id}
    stderr = res.stderr.strip()
    if "can't find session" in stderr or any(m in stderr.lower() for m in _NO_SERVER_MARKERS):
        raise HTTPException(status_code=404, detail=f"No tmux session named '{session_id}'")
    raise HTTPException(status_code=500, detail=f"tmux could not kill the session: {stderr or res.returncode}")


@router.post("/api/terminal/sessions/sweep")
async def sweep_sessions(user: CurrentUser):
    """Kill tmux sessions that are detached (no active client).

    Logic is simple: attached = keep, detached = kill.
    tmux's own #{session_attached} flag is the sole authority.
    """
    if not _tmux_bin:
        raise HTTPException(status_code=503, detail="tmux not available")
    target_user = _acting_user(user)

    live_sessions = await asyncio.to_thread(_list_live_sessions, target_user)

    swept = []
    failed = []
    for live in live_sessions:
        sess = live["name"]
        if not SESSION_REGEX.match(sess):
            continue
        if live["attached"]:
            # Session has an active client — leave it alone.
            logger.debug("Sweep keeping '%s' — attached", sess)
            continue
        if sess in _active_ws_sessions:
            # WS just opened; tmux may not have registered the client yet.
            logger.debug("Sweep keeping '%s' — WebSocket connecting", sess)
            continue
        # Detached and no active WS — it's a zombie. Kill it.
        try:
            res = await asyncio.to_thread(_run_tmux, target_user, "kill-session", "-t", f"={sess}")
        except (OSError, subprocess.TimeoutExpired) as e:
            logger.warning("Failed to kill swept session '%s': %s", sess, e)
            failed.append(sess)
            continue
        if res.returncode == 0:
            swept.append(sess)
            logger.info("Swept zombie session '%s'", sess)
        else:
            logger.warning("tmux refused to kill swept session '%s': %s", sess, res.stderr.strip())
            failed.append(sess)
    return {"status": "ok", "swept": swept, "failed": failed}


@router.post("/api/terminal/sessions/sync-subagents")
async def sync_subagent_sessions(request: Request, user: CurrentUser):
    """Return live tmux sessions that are not in the provided active UI-tab list."""
    if not _tmux_bin:
        raise HTTPException(status_code=503, detail="tmux not available")

    body = await _json_object(request)
    raw_active = body.get("active", [])
    active_ids = {a for a in raw_active if isinstance(a, str)} if isinstance(raw_active, list) else set()

    live_sessions = await asyncio.to_thread(_list_live_sessions, _acting_user(user))
    return {"status": "ok", "new_sessions": [s["name"] for s in live_sessions if s["name"] not in active_ids]}


def _whole_number(body: dict, key: str, low: int, high: int) -> str:
    """body[key] as a whole number clamped to [low, high], as the text tmux expects."""
    try:
        value = int(body[key])
    except (TypeError, ValueError) as e:
        raise HTTPException(status_code=400, detail=f"{key} must be a whole number") from e
    return str(max(low, min(high, value)))


@router.post("/api/terminal/config")
async def apply_tmux_config(request: Request, user: CurrentUser):
    """Apply tmux runtime configuration options (history-limit, escape-time)."""
    if not _tmux_bin:
        raise HTTPException(status_code=503, detail="tmux not available")
    target_user = _acting_user(user)

    body = await _json_object(request)
    options = {}
    if "historyLimit" in body:
        options["history-limit"] = _whole_number(body, "historyLimit", 1000, 500000)
    if "escapeTimeMs" in body:
        options["escape-time"] = _whole_number(body, "escapeTimeMs", 0, 500)
    if not options:
        raise HTTPException(status_code=400, detail="Nothing to apply: send historyLimit or escapeTimeMs")

    applied = []
    failures = []
    for opt, val in options.items():
        try:
            res = await asyncio.to_thread(_run_tmux, target_user, "set-option", "-g", opt, val)
        except (OSError, subprocess.TimeoutExpired) as e:
            failures.append(f"{opt}: {e}")
            continue
        if res.returncode == 0:
            applied.append(f"{opt}={val}")
        else:
            failures.append(f"{opt}: {res.stderr.strip() or res.returncode}")
    if failures:
        logger.warning("Failed to set tmux options: %s", "; ".join(failures))
        raise HTTPException(status_code=500, detail="tmux refused the setting: " + "; ".join(failures))

    return {"status": "ok", "applied": applied}


def _prewarm_tmux() -> None:
    """Start the tmux server (it loads the project config) so the first terminal finds it running.

    Skipped when a host socket is in use: that server belongs to the host.
    """
    if not _tmux_bin or _socket_path:
        return
    try:
        subprocess.run(
            [*_get_tmux_base(), "start-server"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, stdin=subprocess.DEVNULL,
            check=False, timeout=_TMUX_TIMEOUT,
        )
    except (OSError, subprocess.TimeoutExpired) as e:
        logger.warning("Could not pre-warm the tmux server: %s", e)


_prewarm_tmux()


def set_pty_size(fd, rows, cols):
    """Set Linux PTY window size via TIOCSWINSZ ioctl signal."""
    try:
        size = struct.pack("HHHH", rows, cols, 0, 0)
        fcntl.ioctl(fd, termios.TIOCSWINSZ, size)
    except (OSError, struct.error) as e:
        logger.warning("Error setting PTY size: %s", e)


class _TerminalStartError(Exception):
    """The terminal process could not be started; the text is shown to the user as the close reason."""


def _make_preexec(slave_fd: int, target_user: str | None, uinfo):
    """The child-side setup: new session, controlling terminal, and the drop to the user in PAM mode."""
    def preexec():
        os.setsid()
        # Best effort: without a controlling terminal the shell still runs, only without job control.
        with contextlib.suppress(OSError):
            fcntl.ioctl(slave_fd, termios.TIOCSCTTY, 0)

        if target_user and uinfo:
            try:
                os.initgroups(target_user, uinfo.pw_gid)
                os.setgid(uinfo.pw_gid)
                os.setuid(uinfo.pw_uid)
            except OSError as e:
                sys.stderr.write(f"FATAL: Could not drop privileges to {target_user}: {e}\n")
                os._exit(1)
    return preexec


async def _open_terminal(session: str, cwd: str, takeover: str, target_user: str | None):
    """Start the shell (a tmux client, or bash without tmux) on a new PTY. Returns (process, master fd)."""
    target_cwd = cwd if (cwd and os.path.isdir(cwd)) else os.getenv("SOVEREIGN_ROOT", str(Path.home()))

    uinfo = None
    if target_user:
        try:
            uinfo = pwd.getpwnam(target_user)
        except KeyError as e:
            # Running on as the server user would hand this login the server's rights.
            raise _TerminalStartError("No system account for this login") from e
        tmux_dir = f"/tmp/tmux-{uinfo.pw_uid}"
        try:
            if os.path.exists(tmux_dir):
                os.chown(tmux_dir, uinfo.pw_uid, uinfo.pw_gid)
                os.chmod(tmux_dir, 0o700)
        except OSError as e:
            logger.warning("Failed to set up the tmux folder for %s: %s", target_user, e)

    if _tmux_bin:
        # THE GATEKEEPER: Prevent the Trapped Server Race Condition
        if _socket_path and not os.path.exists(_socket_path):
            raise _TerminalStartError("Host tmux server is offline. Please start it on the host.")

        # Attach to existing session (-A). Use -D (detach other clients) ONLY if takeover is requested.
        cmd = _get_tmux_base() + ["new-session", "-A"]
        if takeover.lower() in ("true", "1", "yes"):
            cmd.append("-D")
        cmd += ["-s", session, "-c", target_cwd]
    else:
        cmd = [shutil.which("bash") or "/bin/sh"]

    env = os.environ.copy()
    env["TERM"] = "xterm-256color"
    env["COLORTERM"] = "truecolor"
    if uinfo:
        env["USER"] = uinfo.pw_name
        env["HOME"] = uinfo.pw_dir
        env["LOGNAME"] = uinfo.pw_name
    else:
        if not env.get("USER"):
            env["USER"] = os.getenv("USER", "root")
        if not env.get("HOME"):
            env["HOME"] = os.getenv("HOME", "/root")

    master_fd, slave_fd = pty.openpty()
    try:
        logger.info("Executing PTY command: %s", cmd)
        # preexec_fn is how the child gets its own session, the controlling terminal and the
        # user's identity; it makes only system calls, and the fork happens off the event loop.
        proc = await asyncio.to_thread(
            subprocess.Popen,
            cmd,
            preexec_fn=_make_preexec(slave_fd, target_user, uinfo),
            stdin=slave_fd,
            stdout=slave_fd,
            stderr=slave_fd,
            cwd=target_cwd,
            env=env,
        )
    except BaseException as e:
        os.close(master_fd)
        if isinstance(e, (OSError, subprocess.SubprocessError)):
            raise _TerminalStartError(f"Failed to start terminal: {e}"[:120]) from e
        raise
    finally:
        os.close(slave_fd)

    # Reads and writes wait on the event loop instead of blocking it.
    os.set_blocking(master_fd, False)
    set_pty_size(master_fd, 24, 80)
    return proc, master_fd


async def _wait_for_tmux_session(proc, session: str, target_user: str | None) -> None:
    """Wait (up to 5 s) until tmux reports the session, or the client process has ended."""
    for _ in range(100):
        if proc.poll() is not None:
            return
        try:
            res = await asyncio.to_thread(_run_tmux, target_user, "has-session", "-t", f"={session}")
        except (OSError, subprocess.TimeoutExpired) as e:
            logger.warning("tmux has-session failed: %s", e)
            res = None
        if res is not None and res.returncode == 0:
            return
        await asyncio.sleep(0.05)


async def _write_pty(fd: int, data: bytes) -> None:
    """Write all of data to the PTY, waiting for room instead of blocking the event loop."""
    loop = asyncio.get_running_loop()

    def wake(room: asyncio.Future) -> None:
        if not room.done():
            room.set_result(None)

    view = memoryview(data)
    while view:
        try:
            view = view[os.write(fd, view):]
        except BlockingIOError:
            room = loop.create_future()
            loop.add_writer(fd, wake, room)
            try:
                await room
            finally:
                loop.remove_writer(fd)


async def _pump_pty_output(master_fd: int, proc, websocket: WebSocket, session_alive) -> None:
    """Send the PTY's output to the browser until the process ends or the login is gone.

    The loop wakes only when the PTY has data (plus once per _EXIT_CHECK_SECONDS to see whether
    the process ended). Output read while a send is in flight goes out as one frame, and reading
    pauses while too much is queued.
    """
    loop = asyncio.get_running_loop()
    decoder = codecs.getincrementaldecoder("utf-8")(errors="replace")
    queue: collections.deque[bytes] = collections.deque()
    queued = 0
    wakeup = asyncio.Event()
    paused = False
    ended = False

    def on_readable():
        nonlocal queued, paused, ended
        try:
            data = os.read(master_fd, _PTY_READ_SIZE)
        except BlockingIOError:
            return
        except OSError:
            # EIO: the slave side is closed, the process is gone.
            data = b""
        if not data:
            ended = True
            loop.remove_reader(master_fd)
        else:
            queue.append(data)
            queued += len(data)
            if queued >= _PTY_QUEUE_LIMIT:
                loop.remove_reader(master_fd)
                paused = True
        wakeup.set()

    loop.add_reader(master_fd, on_readable)
    try:
        while True:
            try:
                async with asyncio.timeout(_EXIT_CHECK_SECONDS):
                    await wakeup.wait()
            except TimeoutError:
                if proc.poll() is not None and not queue:
                    break
                continue
            wakeup.clear()
            if queue:
                data = b"".join(queue)
                queue.clear()
                queued = 0
                if paused and not ended:
                    loop.add_reader(master_fd, on_readable)
                    paused = False
                text = decoder.decode(data)
                if text:
                    if not session_alive():
                        await websocket.close(code=1008, reason="Signed out")
                        return
                    await websocket.send_text(text)
            if ended and not queue:
                break
        tail = decoder.decode(b"", final=True)
        if tail:
            await websocket.send_text(tail)
    except (WebSocketDisconnect, RuntimeError) as e:
        logger.debug("PTY output stopped, the socket is closed: %s", e)
    except Exception:
        logger.exception("PTY read loop ended with an error")
    finally:
        loop.remove_reader(master_fd)


def _resize_request(msg: str) -> tuple[int, int, bool] | None:
    """(rows, cols, force_refresh) when msg is a resize control message, else None (it is typed text)."""
    if len(msg) > _MAX_CONTROL_LENGTH or msg[:1] != "{" or msg[-1:] != "}":
        return None
    try:
        payload = json.loads(msg)
    except ValueError:
        return None
    if not isinstance(payload, dict) or payload.get("type") != "resize":
        return None
    try:
        cols = int(payload.get("cols", 80))
        rows = int(payload.get("rows", 24))
    except (TypeError, ValueError):
        logger.warning("Ignored a resize message with a size that is not a number")
        return (0, 0, False)
    return rows, cols, bool(payload.get("force_refresh", False))


async def _receive_terminal_input(websocket: WebSocket, master_fd: int, session_alive) -> None:
    """Pass the browser's frames to the PTY: resize messages set its size, everything else is typed text."""
    while True:
        msg = await websocket.receive_text()
        if not session_alive():
            await websocket.close(code=1008, reason="Signed out")
            return

        resize = _resize_request(msg)
        if resize is None:
            await _write_pty(master_fd, msg.encode("utf-8"))
            continue
        rows, cols, force_refresh = resize
        if not (0 < rows <= 0xFFFF and 0 < cols <= 0xFFFF):
            continue
        set_pty_size(master_fd, rows, cols)
        if force_refresh:
            try:
                await _write_pty(master_fd, b"\x0c")
            except OSError as e:
                logger.warning("Error writing PTY redraw command: %s", e)


async def _stop_terminal(pump_task, master_fd, proc) -> None:
    """Release everything a terminal socket took: the output task, the PTY and the process group."""
    if pump_task is not None:
        pump_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await pump_task
    if master_fd is not None:
        with contextlib.suppress(OSError):
            os.close(master_fd)
    if proc is None:
        return
    if proc.poll() is None:
        try:
            pgid = os.getpgid(proc.pid)
            # The child made its own session, so its group is its pid; anything else is not ours to kill.
            if pgid == proc.pid:
                os.killpg(pgid, signal.SIGKILL)
            else:
                proc.kill()
        except OSError:
            pass
    try:
        await asyncio.to_thread(proc.wait, 1.0)
    except subprocess.TimeoutExpired:
        logger.warning("Terminal process %s did not exit after SIGKILL", proc.pid)


@router.websocket("/ws/terminal")
async def websocket_terminal(websocket: WebSocket, session: str = "main", cwd: str = "", takeover: str = "false"):
    if not SESSION_REGEX.match(session):
        await websocket.close(code=1008, reason="Invalid session name")
        return

    token = websocket.cookies.get(SESSION_COOKIE_NAME)
    session_info = {}
    if AUTH_MODE != "disabled":
        session_info = session_for_token(token)
        if session_info is None:
            await websocket.close(code=1008)
            return
    target_user = _acting_user(session_info)

    def session_alive() -> bool:
        return AUTH_MODE == "disabled" or session_for_token(token) is not None

    await websocket.accept()
    _ws_acquire(session)
    logger.debug("WS connected to session '%s' — open sockets: %s", session, _active_ws_sessions)

    proc = master_fd = pump_task = None
    try:
        try:
            proc, master_fd = await _open_terminal(session, cwd, takeover, target_user)
        except _TerminalStartError as e:
            await websocket.close(code=1011, reason=str(e))
            return

        if _tmux_bin:
            await _wait_for_tmux_session(proc, session, target_user)

        await websocket.send_text(_READY_FRAME)
        pump_task = asyncio.create_task(_pump_pty_output(master_fd, proc, websocket, session_alive))
        await _receive_terminal_input(websocket, master_fd, session_alive)

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except OSError as e:
        # Writing to a PTY whose process has ended.
        logger.info("Terminal ended: %s", e)
    except Exception:
        logger.exception("WebSocket terminal error")
        with contextlib.suppress(RuntimeError, WebSocketDisconnect):
            await websocket.close(code=1011, reason="Terminal error")
    finally:
        try:
            await _stop_terminal(pump_task, master_fd, proc)
        finally:
            _ws_release(session)
            logger.debug("WS closed for session '%s' — open sockets: %s", session, _active_ws_sessions)
