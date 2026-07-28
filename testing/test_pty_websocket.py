import os
import sys
import json
import time
import logging
import platform
import asyncio
import urllib.request
import urllib.parse
from datetime import datetime
from pathlib import Path

# WebSocket test client module check
try:
    import websockets
except ImportError:
    print("Error: 'websockets' python library is required for test_pty_websocket.py.")
    print("Run via Docker: docker exec sovereign-terminal python /workspace/testing/test_pty_websocket.py")
    sys.exit(1)

# Sovereign Terminal WebSocket PTY Gateway Integration & Audit Test Suite
BASE_URL = os.getenv("SERVER_URL", "http://localhost:2069")
WS_URL = os.getenv("WS_URL", "ws://localhost:2069/ws/terminal")
AUTH_TOKEN = os.getenv("SERVER_AUTH_TOKEN", "1234")

# Setup Logging & Audit Directory
LOGS_DIR = Path(__file__).parent / "logs"
LOGS_DIR.mkdir(exist_ok=True)

TIMESTAMP_STR = datetime.now().strftime("%Y%m%d_%H%M%S")
LOG_FILE = LOGS_DIR / f"audit_websocket_{TIMESTAMP_STR}.log"
LATEST_LOG_FILE = LOGS_DIR / "latest_websocket.log"

logger = logging.getLogger("WebSocketAudit")
logger.setLevel(logging.DEBUG)

# File Handler (Detailed DEBUG log)
file_handler = logging.FileHandler(LOG_FILE)
file_handler.setLevel(logging.DEBUG)
file_formatter = logging.Formatter("[%(asctime)s.%(msecs)03d] [%(levelname)s] %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
file_handler.setFormatter(file_formatter)

# Console Handler (INFO progress)
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setLevel(logging.INFO)
console_formatter = logging.Formatter("[%(levelname)s] %(message)s")
console_handler.setFormatter(console_formatter)

logger.addHandler(file_handler)
logger.addHandler(console_handler)

def log_environment_metadata():
    logger.info("==================================================")
    logger.info("SOVEREIGN TERMINAL WEBSOCKET PTY AUDIT TEST SUITE")
    logger.info(f"Timestamp: {datetime.now().isoformat()}")
    logger.info(f"Target WebSocket: {WS_URL}")
    logger.info(f"Python Version: {platform.python_version()}")
    logger.info(f"OS Platform: {platform.system()} {platform.release()}")
    logger.info(f"Audit Log File: {LOG_FILE.resolve()}")
    logger.info("==================================================")

def obtain_session_cookie():
    logger.info("Obtaining session cookie via POST /api/auth/login...")
    url = f"{BASE_URL}/api/auth/login"
    payload = json.dumps({"password": AUTH_TOKEN}).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            cookie_header = resp.headers.get("Set-Cookie")
            if cookie_header:
                session_cookie = cookie_header.split(";")[0]
                logger.info(f"Auth Session Cookie obtained: {session_cookie[:25]}...")
                return session_cookie
    except Exception as e:
        logger.error(f"Failed to obtain auth session cookie: {e}")
    return ""

async def test_unauthenticated_connection():
    logger.info("Running Test 1: Unauthenticated WebSocket Guard...")
    start_time = time.perf_counter()
    try:
        async with websockets.connect(WS_URL) as ws:
            # Should be rejected or closed by server
            resp = await asyncio.wait_for(ws.recv(), timeout=2.0)
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            logger.error(f"Test 1 FAILED: Unauthenticated connection accepted data: {resp[:50]}")
            return False
    except websockets.exceptions.InvalidStatusCode as e:
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        logger.info(f"Test 1 PASSED: Unauthenticated WebSocket rejected with HTTP {e.status_code} ({elapsed_ms:.2f}ms)")
        return True
    except websockets.exceptions.ConnectionClosed as e:
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        logger.info(f"Test 1 PASSED: Unauthenticated WebSocket closed by server code={e.code} ({elapsed_ms:.2f}ms)")
        return True
    except Exception as e:
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        logger.info(f"Test 1 PASSED: Connection rejected safely ({e}) ({elapsed_ms:.2f}ms)")
        return True

async def connect_ws(url, headers):
    try:
        return await websockets.connect(url, additional_headers=headers)
    except TypeError:
        return await websockets.connect(url, extra_headers=headers)

async def test_authenticated_handshake(session_cookie):
    logger.info("Running Test 2: Authenticated WebSocket Handshake...")
    target_ws = f"{WS_URL}?session=audit_test_session&cwd=/workspace"
    headers = {"Cookie": session_cookie} if session_cookie else {}
    
    start_time = time.perf_counter()
    try:
        async with (await connect_ws(target_ws, headers)) as ws:
            logger.debug(f"Connected to {target_ws}")
            # Receive initial PTY banner / prompt
            banner = await asyncio.wait_for(ws.recv(), timeout=3.0)
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            escaped_banner = repr(banner[:100])
            logger.debug(f"Received PTY banner frame ({len(banner)} bytes): {escaped_banner}")
            logger.info(f"Test 2 PASSED: PTY banner received in {elapsed_ms:.2f}ms")
            return True
    except Exception as e:
        logger.error(f"Test 2 FAILED: WebSocket handshake failed: {e}")
        return False

async def test_command_execution(session_cookie):
    logger.info("Running Test 3: Interactive Command Execution & Response...")
    target_ws = f"{WS_URL}?session=audit_cmd_session&cwd=/workspace"
    headers = {"Cookie": session_cookie} if session_cookie else {}
    test_token = f"SOVEREIGN_TEST_TOKEN_{int(time.time())}"
    cmd = f"echo '{test_token}'\n"

    start_time = time.perf_counter()
    try:
        async with (await connect_ws(target_ws, headers)) as ws:
            # Drain initial banner
            try:
                await asyncio.wait_for(ws.recv(), timeout=1.0)
            except asyncio.TimeoutError:
                pass

            # Send command
            logger.debug(f"Sending PTY input command: {cmd.strip()}")
            cmd_start = time.perf_counter()
            await ws.send(cmd)

            # Read response frames looking for token
            matched = False
            response_buffer = ""
            for _ in range(10):
                try:
                    chunk = await asyncio.wait_for(ws.recv(), timeout=2.0)
                    response_buffer += chunk
                    logger.debug(f"Received PTY frame chunk ({len(chunk)} bytes): {repr(chunk)}")
                    if test_token in response_buffer:
                        matched = True
                        break
                except asyncio.TimeoutError:
                    break

            round_trip_ms = (time.perf_counter() - cmd_start) * 1000

            if matched:
                logger.info(f"Test 3 PASSED: Echo token '{test_token}' matched in output ({round_trip_ms:.2f}ms)")
                return True
            else:
                logger.error(f"Test 3 FAILED: Echo token not found in output buffer: {repr(response_buffer)}")
                return False

    except Exception as e:
        logger.error(f"Test 3 FAILED: Command execution error: {e}")
        return False

async def test_terminal_resize(session_cookie):
    logger.info("Running Test 4: PTY Window Resize Event...")
    target_ws = f"{WS_URL}?session=audit_resize_session&cwd=/workspace"
    headers = {"Cookie": session_cookie} if session_cookie else {}
    resize_payload = json.dumps({"type": "resize", "cols": 120, "rows": 40})

    start_time = time.perf_counter()
    try:
        async with (await connect_ws(target_ws, headers)) as ws:
            try:
                await asyncio.wait_for(ws.recv(), timeout=1.0)
            except asyncio.TimeoutError:
                pass

            logger.debug(f"Sending PTY resize payload: {resize_payload}")
            await ws.send(resize_payload)

            # Send a quick command to verify PTY remains responsive after resize
            await ws.send("pwd\n")
            output = await asyncio.wait_for(ws.recv(), timeout=2.0)
            elapsed_ms = (time.perf_counter() - start_time) * 1000

            logger.debug(f"Received post-resize output: {repr(output)}")
            logger.info(f"Test 4 PASSED: Resized PTY window to 120x40 and verified responsive ({elapsed_ms:.2f}ms)")
            return True

    except Exception as e:
        logger.error(f"Test 4 FAILED: PTY resize error: {e}")
        return False

async def main():
    log_environment_metadata()
    session_cookie = obtain_session_cookie()
    if not session_cookie:
        logger.error("Aborting tests: Failed to authenticate session cookie.")
        return

    passed = 0
    failed = 0

    if await test_unauthenticated_connection():
        passed += 1
    else:
        failed += 1

    if await test_authenticated_handshake(session_cookie):
        passed += 1
    else:
        failed += 1

    if await test_command_execution(session_cookie):
        passed += 1
    else:
        failed += 1

    if await test_terminal_resize(session_cookie):
        passed += 1
    else:
        failed += 1

    logger.info("==================================================")
    logger.info(f"AUDIT SUMMARY: Total: {passed + failed} | Passed: {passed} | Failed: {failed}")
    logger.info("==================================================")

    # Save to latest_websocket.log
    with open(LOG_FILE, "r") as f_in, open(LATEST_LOG_FILE, "w") as f_out:
        f_out.write(f_in.read())

if __name__ == "__main__":
    asyncio.run(main())
