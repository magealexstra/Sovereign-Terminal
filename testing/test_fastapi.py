import os
import sys
import json
import time
import logging
import platform
import urllib.request
import urllib.parse
from datetime import datetime
from pathlib import Path

# Sovereign Terminal REST & FastAPI Integration Test Suite
# Generates structured audit logs in testing/logs/

BASE_URL = os.getenv("SERVER_URL", "http://localhost:2069")
AUTH_TOKEN = os.getenv("SERVER_AUTH_TOKEN", "1234")

# Setup Logging & Audit Directory
LOGS_DIR = Path(__file__).parent / "logs"
LOGS_DIR.mkdir(exist_ok=True)

TIMESTAMP_STR = datetime.now().strftime("%Y%m%d_%H%M%S")
LOG_FILE = LOGS_DIR / f"audit_fastapi_{TIMESTAMP_STR}.log"
LATEST_LOG_FILE = LOGS_DIR / "latest_fastapi.log"

logger = logging.getLogger("FastAPIAudit")
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
    logger.info("SOVEREIGN TERMINAL FASTAPI AUDIT TEST SUITE")
    logger.info(f"Timestamp: {datetime.now().isoformat()}")
    logger.info(f"Target Gateway: {BASE_URL}")
    logger.info(f"Python Version: {platform.python_version()}")
    logger.info(f"OS Platform: {platform.system()} {platform.release()}")
    logger.info(f"Audit Log File: {LOG_FILE.resolve()}")
    logger.info("==================================================")

def make_request(url, method="GET", data=None, cookies=None):
    headers = {"Content-Type": "application/json"}
    if cookies:
        headers["Cookie"] = cookies

    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)

    start_time = time.perf_counter()
    logger.debug(f"HTTP REQUEST: {method} {url}")
    if data:
        logger.debug(f"HTTP PAYLOAD: {json.dumps(data)}")

    try:
        with urllib.request.urlopen(req) as resp:
            elapsed_ms = (time.perf_counter() - start_time) * 1000
            resp_body = resp.read().decode("utf-8")
            cookie_header = resp.headers.get("Set-Cookie")
            json_resp = json.loads(resp_body) if resp_body else {}
            logger.debug(f"HTTP RESPONSE [{resp.status}] ({elapsed_ms:.2f}ms): {json.dumps(json_resp)}")
            return resp.status, json_resp, cookie_header, elapsed_ms
    except urllib.error.HTTPError as e:
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        resp_body = e.read().decode("utf-8")
        try:
            json_resp = json.loads(resp_body) if resp_body else {"error": str(e)}
        except Exception:
            json_resp = {"raw": resp_body}
        logger.debug(f"HTTP ERROR [{e.code}] ({elapsed_ms:.2f}ms): {json.dumps(json_resp)}")
        return e.code, json_resp, None, elapsed_ms

def run_tests():
    log_environment_metadata()
    passed = 0
    failed = 0

    # Test 1: Health Check Endpoint
    logger.info("Running Test 1: Health Check Endpoint...")
    status, body, _, ms = make_request(f"{BASE_URL}/health")
    if status == 200 and body.get("status") == "online":
        logger.info(f"Test 1 PASSED: Health status online ({ms:.2f}ms)")
        passed += 1
    else:
        logger.error(f"Test 1 FAILED: Unexpected health response: {body}")
        failed += 1

    # Test 2: Auth Mode Metadata
    logger.info("Running Test 2: Auth Mode Metadata...")
    status, body, _, ms = make_request(f"{BASE_URL}/api/auth/mode")
    if status == 200 and "auth_mode" in body:
        logger.info(f"Test 2 PASSED: Auth mode '{body.get('auth_mode')}' verified ({ms:.2f}ms)")
        passed += 1
    else:
        logger.error(f"Test 2 FAILED: Auth mode check failed: {body}")
        failed += 1

    # Test 3: Unauthenticated Access Guard
    logger.info("Running Test 3: Unauthenticated Access Guard...")
    status, body, _, ms = make_request(f"{BASE_URL}/api/fs/tree")
    if status == 401:
        logger.info(f"Test 3 PASSED: Unauthenticated request rejected with HTTP 401 ({ms:.2f}ms)")
        passed += 1
    else:
        logger.error(f"Test 3 FAILED: Guard failed, expected 401 got {status}")
        failed += 1

    # Test 4: Authenticated Login
    logger.info("Running Test 4: Authenticated Login...")
    login_payload = {"password": AUTH_TOKEN}
    status, body, cookie_header, ms = make_request(f"{BASE_URL}/api/auth/login", method="POST", data=login_payload)
    session_cookie = ""
    if status == 200 and cookie_header:
        session_cookie = cookie_header.split(";")[0]
        logger.info(f"Test 4 PASSED: Authenticated session established ({ms:.2f}ms)")
        passed += 1
    else:
        logger.error(f"Test 4 FAILED: Login failed: {body}")
        failed += 1

    # Test 5: Directory Tree (/api/fs/tree)
    logger.info("Running Test 5: Workspace Directory Tree...")
    status, body, _, ms = make_request(f"{BASE_URL}/api/fs/tree", cookies=session_cookie)
    if status == 200 and "items" in body:
        logger.info(f"Test 5 PASSED: Path '{body.get('currentPath')}' returned {len(body.get('items'))} items ({ms:.2f}ms)")
        passed += 1
    else:
        logger.error(f"Test 5 FAILED: Directory tree request failed: {body}")
        failed += 1

    # Test 6: System Directory Resolution (/etc)
    logger.info("Running Test 6: System Directory Resolution (/etc)...")
    etc_url = f"{BASE_URL}/api/fs/tree?path=" + urllib.parse.quote("/etc")
    status, body, _, ms = make_request(etc_url, cookies=session_cookie)
    if status == 200 and body.get("currentPath") == "/etc":
        logger.info(f"Test 6 PASSED: Normalized path '/etc' returned {len(body.get('items'))} items ({ms:.2f}ms)")
        passed += 1
    else:
        logger.error(f"Test 6 FAILED: Extended path resolution failed: {body}")
        failed += 1

    # Test 7: Read File Content (/api/fs/read)
    logger.info("Running Test 7: UTF-8 File Reading...")
    main_py_path = urllib.parse.quote("/workspace/server/main.py")
    status, body, _, ms = make_request(f"{BASE_URL}/api/fs/read?path={main_py_path}", cookies=session_cookie)
    if status == 200 and "content" in body:
        logger.info(f"Test 7 PASSED: File '{body.get('path')}' read {len(body.get('content'))} bytes ({ms:.2f}ms)")
        passed += 1
    else:
        logger.error(f"Test 7 FAILED: File read failed: {body}")
        failed += 1

    # Test 8: Invalid Credential Rejection
    logger.info("Running Test 8: Invalid Credential Rejection Guard...")
    bad_login_payload = {"password": "INVALID_WRONG_TOKEN_999"}
    status, body, _, ms = make_request(f"{BASE_URL}/api/auth/login", method="POST", data=bad_login_payload)
    if status == 401:
        logger.info(f"Test 8 PASSED: Invalid password token correctly rejected with HTTP 401 ({ms:.2f}ms)")
        passed += 1
    else:
        logger.error(f"Test 8 FAILED: Expected 401 for bad token, got {status}")
        failed += 1

    # Test 9: Session Verification (/api/auth/verify)
    logger.info("Running Test 9: Session Cookie Verification Endpoint...")
    status, body, _, ms = make_request(f"{BASE_URL}/api/auth/verify", cookies=session_cookie)
    if status == 200 and body.get("status") == "valid":
        logger.info(f"Test 9 PASSED: Session cookie verified for user '{body.get('username')}' ({ms:.2f}ms)")
        passed += 1
    else:
        logger.error(f"Test 9 FAILED: Session verification failed: {body}")
        failed += 1

    logger.info("==================================================")
    logger.info(f"AUDIT SUMMARY: Total: {passed + failed} | Passed: {passed} | Failed: {failed}")
    logger.info("==================================================")

    # Save to latest_fastapi.log
    with open(LOG_FILE, "r") as f_in, open(LATEST_LOG_FILE, "w") as f_out:
        f_out.write(f_in.read())

if __name__ == "__main__":
    run_tests()
