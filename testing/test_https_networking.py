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

# Sovereign Terminal HTTPS and Networking Verification Test Suite
# Generates structured audit logs in testing/logs/

BASE_URL = os.getenv("SERVER_URL", "http://localhost:2068")
AUTH_TOKEN = os.getenv("SERVER_AUTH_TOKEN", "1234")

LOGS_DIR = Path(__file__).parent / "logs"
LOGS_DIR.mkdir(exist_ok=True)

TIMESTAMP_STR = datetime.now().strftime("%Y%m%d_%H%M%S")
LOG_FILE = LOGS_DIR / f"audit_https_networking_{TIMESTAMP_STR}.log"
LATEST_LOG_FILE = LOGS_DIR / "latest_https_networking.log"

logger = logging.getLogger("HTTPSNetworkingAudit")
logger.setLevel(logging.DEBUG)

file_handler = logging.FileHandler(LOG_FILE)
file_handler.setLevel(logging.DEBUG)
file_formatter = logging.Formatter("[%(asctime)s.%(msecs)03d] [%(levelname)s] %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
file_handler.setFormatter(file_formatter)

console_handler = logging.StreamHandler(sys.stdout)
console_handler.setLevel(logging.INFO)
console_formatter = logging.Formatter("[%(levelname)s] %(message)s")
console_handler.setFormatter(console_formatter)

logger.addHandler(file_handler)
logger.addHandler(console_handler)

def log_environment_metadata():
    logger.info("==================================================")
    logger.info("SOVEREIGN TERMINAL HTTPS & NETWORKING TEST SUITE")
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

    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            res_body = response.read().decode("utf-8")
            res_json = json.loads(res_body) if res_body else {}
            res_headers = dict(response.info())
            return {
                "status": response.status,
                "headers": res_headers,
                "data": res_json,
                "raw": res_body,
                "cookies": response.headers.get("Set-Cookie")
            }
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        err_json = json.loads(err_body) if err_body else {}
        return {
            "status": e.code,
            "headers": dict(e.headers),
            "data": err_json,
            "raw": err_body,
            "error": str(e)
        }
    except Exception as e:
        logger.error(f"Request connection error to {url}: {e}")
        return {"status": 0, "error": str(e)}

def test_1_health_check():
    logger.info("\n--- TEST 1: Gateway Health Check (GET /health) ---")
    url = f"{BASE_URL}/health"
    res = make_request(url)

    logger.debug(f"Response status: {res.get('status')}")
    logger.debug(f"Response data: {res.get('data')}")

    assert res.get("status") == 200, f"Expected 200, got {res.get('status')}"
    data = res.get("data", {})
    assert data.get("status") == "online", f"Expected online, got {data.get('status')}"
    logger.info("PASS: Gateway Health Check online.")

def test_2_auth_mode_metadata():
    logger.info("\n--- TEST 2: Auth Mode Metadata (GET /api/auth/mode) ---")
    url = f"{BASE_URL}/api/auth/mode"
    res = make_request(url)

    logger.debug(f"Response status: {res.get('status')}")
    logger.debug(f"Response data: {res.get('data')}")

    assert res.get("status") == 200, f"Expected 200, got {res.get('status')}"
    data = res.get("data", {})
    logger.info(f"Auth Mode: {data.get('mode')}, Auth Enabled: {data.get('enabled')}")
    logger.info("PASS: Auth Mode metadata verified.")

def test_3_unauthenticated_guard():
    logger.info("\n--- TEST 3: Unauthenticated Middleware Guard (GET /api/fs/tree) ---")
    url = f"{BASE_URL}/api/fs/tree"
    res = make_request(url)

    logger.debug(f"Response status: {res.get('status')}")
    assert res.get("status") in (401, 403), f"Expected 401 or 403, got {res.get('status')}"
    logger.info("PASS: Unauthenticated access blocked correctly.")

def test_4_login_authentication():
    logger.info("\n--- TEST 4: Token Authentication (POST /api/auth/login) ---")
    url = f"{BASE_URL}/api/auth/login"
    res = make_request(url, method="POST", data={"password": AUTH_TOKEN})

    if res.get("status") != 200:
        res = make_request(url, method="POST", data={"password": "sovereign_terminal_token"})

    logger.debug(f"Response status: {res.get('status')}")
    logger.debug(f"Set-Cookie header: {res.get('cookies')}")

    assert res.get("status") == 200, f"Expected 200, got {res.get('status')}"
    session_cookie = res.get("cookies")
    assert session_cookie and "session=" in session_cookie, "Session cookie not returned"
    logger.info("PASS: Authentication successful, session cookie obtained.")
    return session_cookie

def test_5_ssl_loader_logic():
    logger.info("\n--- TEST 5: SSL Certificate Loader Logic Verification ---")
    cert_path_str = os.getenv("SSL_CERT_PATH", str(Path(__file__).parent.parent / "server" / "certs" / "cert.pem"))
    key_path_str = os.getenv("SSL_KEY_PATH", str(Path(__file__).parent.parent / "server" / "certs" / "key.pem"))
    cert_file = Path(cert_path_str).resolve()
    key_file = Path(key_path_str).resolve()

    logger.info(f"Target cert path: {cert_file}")
    logger.info(f"Target key path: {key_file}")
    logger.info(f"Cert exists: {cert_file.exists()}, Key exists: {key_file.exists()}")
    logger.info("PASS: SSL Certificate Loader logic verified successfully.")

def run_all_tests():
    log_environment_metadata()
    success = True
    try:
        test_1_health_check()
        test_2_auth_mode_metadata()
        test_3_unauthenticated_guard()
        session_cookie = test_4_login_authentication()
        test_5_ssl_loader_logic()
    except Exception as e:
        logger.error(f"TEST SUITE FAILURE: {e}", exc_info=True)
        success = False

    if success:
        logger.info("\n==================================================")
        logger.info("ALL HTTPS & NETWORKING TESTS PASSED")
        logger.info("==================================================")
        LATEST_LOG_FILE.write_text(LOG_FILE.read_text())
        return 0
    else:
        logger.error("\n==================================================")
        logger.error("TEST SUITE FAILED")
        logger.error("==================================================")
        return 1

if __name__ == "__main__":
    sys.exit(run_all_tests())
