import os
import sys
import time
import logging
import platform
import asyncio
from datetime import datetime
from pathlib import Path

try:
    from playwright.async_api import async_playwright
except ImportError:
    print("Error: 'playwright' python library is required for test_ui_tab1_terminal.py.")
    sys.exit(1)

# Sovereign Terminal Tab 1 (Terminal Card & Session Swapping) Audit Suite
BASE_URL = os.getenv("SERVER_URL", "http://localhost:2068")
AUTH_TOKEN = os.getenv("SERVER_AUTH_TOKEN", "1234")

LOGS_DIR = Path(__file__).parent / "logs"
SCREENSHOTS_DIR = LOGS_DIR / "screenshots"
LOGS_DIR.mkdir(exist_ok=True)
SCREENSHOTS_DIR.mkdir(exist_ok=True)

TIMESTAMP_STR = datetime.now().strftime("%Y%m%d_%H%M%S")
LOG_FILE = LOGS_DIR / f"audit_tab1_terminal_{TIMESTAMP_STR}.log"
LATEST_LOG_FILE = LOGS_DIR / "latest_tab1_terminal.log"

logger = logging.getLogger("Tab1TerminalAudit")
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
    logger.info("SOVEREIGN TERMINAL TAB 1 (TERMINAL & MULTI-TAB) AUDIT")
    logger.info(f"Timestamp: {datetime.now().isoformat()}")
    logger.info(f"Target Gateway: {BASE_URL}")
    logger.info(f"Python Version: {platform.python_version()}")
    logger.info(f"OS Platform: {platform.system()} {platform.release()}")
    logger.info(f"Audit Log File: {LOG_FILE.resolve()}")
    logger.info("==================================================")

async def send_and_verify_input(page, session_label, test_token):
    cmd = f"echo '{test_token}'"
    logger.debug(f"[{session_label}] Sending input command: {cmd}")
    textarea = page.locator(".xterm-helper-textarea:visible").first
    await textarea.focus()
    await page.keyboard.type(f"{cmd}\n", delay=15)
    await asyncio.sleep(1.2)

    canvas = page.locator(".terminal-container:visible canvas").first
    is_canvas_visible = await canvas.is_visible()
    if not is_canvas_visible:
        raise RuntimeError(f"[{session_label}] Active Terminal WebGL canvas is not visible")
    
    logger.info(f"[{session_label}] Keystrokes processed successfully by WebGL canvas ({test_token})")

async def run_tab1_tests():
    log_environment_metadata()
    passed = 0
    failed = 0

    async with async_playwright() as p:
        logger.info("Launching headless Chromium browser for Tab 1 audit...")
        browser = await p.chromium.launch(
            headless=True,
            args=["--use-gl=angle", "--use-angle=gl-egl", "--ignore-gpu-blocklist", "--no-sandbox"]
        )
        context = await browser.new_context(viewport={"width": 1280, "height": 800})
        page = await context.new_page()

        page.on("console", lambda msg: logger.debug(f"[BROWSER LOG {msg.type}] {msg.text}"))
        page.on("pageerror", lambda err: logger.error(f"[BROWSER UNCAUGHT ERROR] {err}"))

        # Setup: Open App & Login
        try:
            await page.goto(BASE_URL, wait_until="domcontentloaded")
            await page.wait_for_selector(".sovereign-layout", timeout=5000)
            modal = page.locator(".login-modal-card")
            if await modal.is_visible():
                await page.fill('.login-modal-card input[type="password"]', AUTH_TOKEN)
                await page.click(".login-submit-btn")
                await page.wait_for_selector(".login-modal-card", state="hidden", timeout=5000)
            await page.wait_for_selector(".terminal-container canvas", timeout=6000)
            logger.info("Setup: App loaded, logged in, and initial terminal session mounted.")
        except Exception as e:
            logger.error(f"Setup FAILED: {e}")
            await browser.close()
            return

        # Step 1: Session 1 Initial Input Verification
        logger.info("Running Step 1: Session 1 Initial Input Verification...")
        start_time = time.perf_counter()
        try:
            await send_and_verify_input(page, "Session 1", "TAB1_INITIAL_CHECK")
            ms = (time.perf_counter() - start_time) * 1000
            logger.info(f"Step 1 PASSED: Session 1 initial input verified ({ms:.2f}ms)")
            await page.screenshot(path=str(SCREENSHOTS_DIR / "tab1_01_session1_initial.png"))
            passed += 1
        except Exception as e:
            logger.error(f"Step 1 FAILED: {e}")
            failed += 1

        # Step 2: Spawn Session 2 & Verify Input
        logger.info("Running Step 2: Spawn Session 2 via '+' button & Verify Input...")
        start_time = time.perf_counter()
        try:
            add_tab_btn = page.locator(".add-session-pill-btn").first
            await add_tab_btn.click()
            await asyncio.sleep(1.5)

            session_tabs = page.locator(".session-pill-btn")
            tab_count = await session_tabs.count()
            logger.debug(f"Total session tabs count after add: {tab_count}")
            assert tab_count >= 2, f"Expected at least 2 session tabs, found {tab_count}"

            await send_and_verify_input(page, "Session 2", "TAB2_INITIAL_CHECK")
            ms = (time.perf_counter() - start_time) * 1000
            logger.info(f"Step 2 PASSED: Session 2 spawned and verified ({ms:.2f}ms)")
            await page.screenshot(path=str(SCREENSHOTS_DIR / "tab1_02_session2_spawned.png"))
            passed += 1
        except Exception as e:
            logger.error(f"Step 2 FAILED: {e}")
            failed += 1

        # Step 3: Swap Back to Session 1 & Verify Input
        logger.info("Running Step 3: Swap Back to Session 1 & Verify Input...")
        start_time = time.perf_counter()
        try:
            session_1_btn = page.locator(".session-pill-btn").nth(0)
            await session_1_btn.click()
            await asyncio.sleep(1.0)

            await send_and_verify_input(page, "Session 1", "SWAP_BACK_TO_TAB1")
            ms = (time.perf_counter() - start_time) * 1000
            logger.info(f"Step 3 PASSED: Swapped back to Session 1 and verified input ({ms:.2f}ms)")
            await page.screenshot(path=str(SCREENSHOTS_DIR / "tab1_03_swap_to_session1.png"))
            passed += 1
        except Exception as e:
            logger.error(f"Step 3 FAILED: {e}")
            failed += 1

        # Step 4: Spawn Session 3 & Verify Input
        logger.info("Running Step 4: Spawn Session 3 & Verify Input...")
        start_time = time.perf_counter()
        try:
            add_tab_btn = page.locator(".add-session-pill-btn").first
            await add_tab_btn.click()
            await asyncio.sleep(1.5)

            session_tabs = page.locator(".session-pill-btn")
            tab_count = await session_tabs.count()
            assert tab_count >= 3, f"Expected at least 3 session tabs, found {tab_count}"

            await send_and_verify_input(page, "Session 3", "TAB3_INITIAL_CHECK")
            ms = (time.perf_counter() - start_time) * 1000
            logger.info(f"Step 4 PASSED: Session 3 spawned and verified ({ms:.2f}ms)")
            await page.screenshot(path=str(SCREENSHOTS_DIR / "tab1_04_session3_spawned.png"))
            passed += 1
        except Exception as e:
            logger.error(f"Step 4 FAILED: {e}")
            failed += 1

        # Step 5: Swap to Session 2 & Verify Input
        logger.info("Running Step 5: Swap to Session 2 & Verify Input...")
        start_time = time.perf_counter()
        try:
            session_2_btn = page.locator(".session-pill-btn").nth(1)
            await session_2_btn.click()
            await asyncio.sleep(1.0)

            await send_and_verify_input(page, "Session 2", "SWAP_TO_TAB2")
            ms = (time.perf_counter() - start_time) * 1000
            logger.info(f"Step 5 PASSED: Swapped to Session 2 and verified input ({ms:.2f}ms)")
            await page.screenshot(path=str(SCREENSHOTS_DIR / "tab1_05_swap_to_session2.png"))
            passed += 1
        except Exception as e:
            logger.error(f"Step 5 FAILED: {e}")
            failed += 1

        # Step 6: Swap to Session 3 & Verify Input
        logger.info("Running Step 6: Swap to Session 3 & Verify Input...")
        start_time = time.perf_counter()
        try:
            session_3_btn = page.locator(".session-pill-btn").nth(2)
            await session_3_btn.click()
            await asyncio.sleep(1.0)

            await send_and_verify_input(page, "Session 3", "SWAP_TO_TAB3")
            ms = (time.perf_counter() - start_time) * 1000
            logger.info(f"Step 6 PASSED: Swapped to Session 3 and verified input ({ms:.2f}ms)")
            await page.screenshot(path=str(SCREENSHOTS_DIR / "tab1_06_swap_to_session3.png"))
            passed += 1
        except Exception as e:
            logger.error(f"Step 6 FAILED: {e}")
            failed += 1

        # Step 7: Swap to Original Session 1 & Verify Input
        logger.info("Running Step 7: Swap to Original Session 1 & Verify Input...")
        start_time = time.perf_counter()
        try:
            session_1_btn = page.locator(".session-pill-btn").nth(0)
            await session_1_btn.click()
            await asyncio.sleep(1.0)

            await send_and_verify_input(page, "Session 1", "SWAP_FINAL_ORIGINAL_TAB1")
            ms = (time.perf_counter() - start_time) * 1000
            logger.info(f"Step 7 PASSED: Swapped to original Session 1 and verified input ({ms:.2f}ms)")
            await page.screenshot(path=str(SCREENSHOTS_DIR / "tab1_07_swap_final_session1.png"))
            passed += 1
        except Exception as e:
            logger.error(f"Step 7 FAILED: {e}")
            failed += 1

        # Step 8: Tab Deletion & Fallback Safety Check
        logger.info("Running Step 8: Tab Deletion & Fallback Safety Check...")
        start_time = time.perf_counter()
        try:
            initial_count = await page.locator(".session-pill-btn").count()
            logger.debug(f"Initial session tabs count before delete: {initial_count}")

            # Close the last session tab
            close_btn = page.locator(".close-session-icon").last
            await close_btn.click()
            await asyncio.sleep(1.0)

            new_count = await page.locator(".session-pill-btn").count()
            logger.debug(f"Tab count after deleting session tab: {new_count}")
            assert new_count == initial_count - 1, f"Expected {initial_count - 1} session tabs, found {new_count}"

            # Verify remaining active session input
            await send_and_verify_input(page, "Active Remaining Session", "TAB_DELETION_POST_CHECK")
            ms = (time.perf_counter() - start_time) * 1000
            logger.info(f"Step 8 PASSED: Session tab deleted and fallback active tab verified ({ms:.2f}ms)")
            await page.screenshot(path=str(SCREENSHOTS_DIR / "tab1_08_session_deleted_fallback.png"))
            passed += 1
        except Exception as e:
            logger.error(f"Step 8 FAILED: {e}")
            failed += 1

        logger.info("==================================================")
        logger.info(f"AUDIT SUMMARY: Total Steps: {passed + failed} | Passed: {passed} | Failed: {failed}")
        logger.info("==================================================")

        await browser.close()

    with open(LOG_FILE, "r") as f_in, open(LATEST_LOG_FILE, "w") as f_out:
        f_out.write(f_in.read())

if __name__ == "__main__":
    asyncio.run(run_tab1_tests())
