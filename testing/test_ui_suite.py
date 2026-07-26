import os
import sys
import subprocess
import logging
from datetime import datetime
from pathlib import Path

# Sovereign Terminal Master Test Orchestrator
# Executes all API, WebSocket, and UI sub-card test suites sequentially.

LOGS_DIR = Path(__file__).parent / "logs"
LOGS_DIR.mkdir(exist_ok=True)

TIMESTAMP_STR = datetime.now().strftime("%Y%m%d_%H%M%S")
MASTER_LOG_FILE = LOGS_DIR / f"audit_master_suite_{TIMESTAMP_STR}.log"
LATEST_MASTER_LOG = LOGS_DIR / "latest_master_suite.log"

logger = logging.getLogger("MasterTestSuite")
logger.setLevel(logging.DEBUG)

file_handler = logging.FileHandler(MASTER_LOG_FILE)
file_handler.setLevel(logging.DEBUG)
file_formatter = logging.Formatter("[%(asctime)s.%(msecs)03d] [%(levelname)s] %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
file_handler.setFormatter(file_formatter)

console_handler = logging.StreamHandler(sys.stdout)
console_handler.setLevel(logging.INFO)
console_formatter = logging.Formatter("[%(levelname)s] %(message)s")
console_handler.setFormatter(console_formatter)

logger.addHandler(file_handler)
logger.addHandler(console_handler)

TEST_DIR = Path(__file__).parent

TEST_SCRIPTS = [
    ("REST API & Gateway Suite", TEST_DIR / "test_fastapi.py"),
    ("WebSocket PTY Engine Suite", TEST_DIR / "test_pty_websocket.py"),
    ("Tab 1 Terminal & Multi-Tab Swap Suite", TEST_DIR / "test_ui_tab1_terminal.py"),
    ("Tab 2 Files & CodeEditor Suite", TEST_DIR / "test_ui_tab2_explorer.py"),
    ("Tab 3 Settings & Sub-Cards Suite", TEST_DIR / "test_ui_tab3_settings.py"),
]

def run_suite():
    logger.info("==================================================")
    logger.info("SOVEREIGN TERMINAL MASTER TEST SUITE ORCHESTRATOR")
    logger.info(f"Timestamp: {datetime.now().isoformat()}")
    logger.info(f"Master Audit Log: {MASTER_LOG_FILE.resolve()}")
    logger.info("==================================================")

    results = []
    for title, script_path in TEST_SCRIPTS:
        logger.info(f"\n---> Executing Suite Module: {title} ({script_path}) <---")
        cmd = [sys.executable, script_path]
        try:
            res = subprocess.run(cmd, capture_output=True, text=True)
            if res.returncode == 0:
                logger.info(f"[MODULE PASSED] {title}")
                logger.debug(res.stdout)
                results.append((title, "PASSED", 0))
            else:
                logger.error(f"[MODULE FAILED] {title} (Exit Code: {res.returncode})")
                logger.error(res.stderr or res.stdout)
                results.append((title, "FAILED", res.returncode))
        except Exception as e:
            logger.error(f"[MODULE ERROR] {title}: {e}")
            results.append((title, "ERROR", 1))

    logger.info("\n==================================================")
    logger.info("MASTER TEST SUITE SUMMARY REPORT")
    logger.info("==================================================")
    passed_count = sum(1 for _, status, _ in results if status == "PASSED")
    total_count = len(results)

    for title, status, code in results:
        logger.info(f"  * {title}: {status}")

    logger.info(f"\nFinal Score: {passed_count}/{total_count} Test Suites Passed.")
    logger.info("==================================================")

    with open(MASTER_LOG_FILE, "r") as f_in, open(LATEST_MASTER_LOG, "w") as f_out:
        f_out.write(f_in.read())

if __name__ == "__main__":
    run_suite()
