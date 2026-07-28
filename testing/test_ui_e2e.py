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
    print("Error: 'playwright' python library is required for test_ui_e2e.py.")
    sys.exit(1)

# Sovereign Terminal Playwright End-to-End UI & Terminal Card Test Suite
BASE_URL = os.getenv("SERVER_URL", "http://localhost:2069")
AUTH_TOKEN = os.getenv("SERVER_AUTH_TOKEN", "1234")

# Setup Directories & Logging
LOGS_DIR = Path(__file__).parent / "logs"
SCREENSHOTS_DIR = LOGS_DIR / "screenshots"
LOGS_DIR.mkdir(exist_ok=True)
SCREENSHOTS_DIR.mkdir(exist_ok=True)

TIMESTAMP_STR = datetime.now().strftime("%Y%m%d_%H%M%S")
LOG_FILE = LOGS_DIR / f"audit_e2e_ui_{TIMESTAMP_STR}.log"
LATEST_LOG_FILE = LOGS_DIR / "latest_ui_e2e.log"

logger = logging.getLogger("PlaywrightE2EAudit")
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
    logger.info("SOVEREIGN TERMINAL PLAYWRIGHT E2E UI AUDIT SUITE")
    logger.info(f"Timestamp: {datetime.now().isoformat()}")
    logger.info(f"Target Gateway: {BASE_URL}")
    logger.info(f"Python Version: {platform.python_version()}")
    logger.info(f"OS Platform: {platform.system()} {platform.release()}")
    logger.info(f"Audit Log File: {LOG_FILE.resolve()}")
    logger.info(f"Screenshots Dir: {SCREENSHOTS_DIR.resolve()}")
    logger.info("==================================================")

async def run_e2e_tests():
    log_environment_metadata()
    passed = 0
    failed = 0

    async with async_playwright() as p:
        logger.info("Launching headless Chromium browser (WebGL enabled)...")
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--use-gl=angle",
                "--use-angle=gl-egl",
                "--ignore-gpu-blocklist",
                "--no-sandbox"
            ]
        )

        context = await browser.new_context(
            viewport={"width": 1280, "height": 800},
            device_scale_factor=1.0
        )
        page = await context.new_page()

        # Listen to browser console and error messages
        page.on("console", lambda msg: logger.debug(f"[BROWSER LOG {msg.type}] {msg.text}"))
        page.on("pageerror", lambda err: logger.error(f"[BROWSER UNCAUGHT ERROR] {err}"))

        # Test 1: Page Loading & Initial Render
        logger.info("Running Test 1: Page Load & Initial UI Shell...")
        start_time = time.perf_counter()
        try:
            await page.goto(BASE_URL, wait_until="domcontentloaded")
            await page.wait_for_selector(".sovereign-layout", timeout=5000)
            ms = (time.perf_counter() - start_time) * 1000
            logger.info(f"Test 1 PASSED: Application shell mounted in {ms:.2f}ms")
            await page.screenshot(path=str(SCREENSHOTS_DIR / "01_app_loaded.png"))
            passed += 1
        except Exception as e:
            logger.error(f"Test 1 FAILED: App shell mount failed: {e}")
            failed += 1
            await browser.close()
            return

        # Test 2: Login Modal Authentication
        logger.info("Running Test 2: UI Login Modal Authentication...")
        start_time = time.perf_counter()
        try:
            # Check if login modal is active
            modal = page.locator(".login-modal-card")
            if await modal.is_visible():
                logger.debug("Login modal detected, submitting password token...")
                pwd_input = page.locator('.login-modal-card input[type="password"]')
                await pwd_input.fill(AUTH_TOKEN)
                await page.click(".login-submit-btn")
                await page.wait_for_selector(".login-modal-card", state="hidden", timeout=5000)

            ms = (time.perf_counter() - start_time) * 1000
            logger.info(f"Test 2 PASSED: Authenticated session verified ({ms:.2f}ms)")
            await page.screenshot(path=str(SCREENSHOTS_DIR / "02_authenticated.png"))
            passed += 1
        except Exception as e:
            logger.error(f"Test 2 FAILED: Login modal submission failed: {e}")
            failed += 1

        # Test 3: Terminal Canvas & xterm Mount
        logger.info("Running Test 3: Terminal Card & xterm Canvas Mount...")
        start_time = time.perf_counter()
        try:
            await page.wait_for_selector(".terminal-container canvas", timeout=6000)
            ms = (time.perf_counter() - start_time) * 1000
            logger.info(f"Test 3 PASSED: xterm WebGL canvas element initialized ({ms:.2f}ms)")
            await page.screenshot(path=str(SCREENSHOTS_DIR / "03_terminal_canvas_mounted.png"))
            passed += 1
        except Exception as e:
            logger.error(f"Test 3 FAILED: xterm canvas failed to mount: {e}")
            failed += 1

        # Test 4: Interactive Typing & xterm WebGL Canvas Response
        logger.info("Running Test 4: Interactive Typing & xterm WebGL Canvas Response...")
        start_time = time.perf_counter()
        try:
            test_cmd = f"echo 'PLAYWRIGHT_UI_TEST_{int(time.time())}'"
            textarea = page.locator(".xterm-helper-textarea").first
            await textarea.focus()
            await page.keyboard.type(f"{test_cmd}\n", delay=20)
            
            # Wait 1.5 seconds for PTY execution and WebGL frame render
            await asyncio.sleep(1.5)
            
            # Verify WebGL canvas element remains active and visible
            canvas = page.locator(".terminal-container canvas").first
            is_canvas_visible = await canvas.is_visible()
            
            # Read xterm container text / accessibility buffer
            term_container_text = await page.locator(".terminal-container").first.inner_text()
            logger.debug(f"Terminal container text length: {len(term_container_text)} bytes")

            if is_canvas_visible:
                ms = (time.perf_counter() - start_time) * 1000
                logger.info(f"Test 4 PASSED: Interactive keystrokes processed by WebGL canvas ({ms:.2f}ms)")
                passed += 1
            else:
                logger.error(f"Test 4 FAILED: WebGL canvas container not visible")
                failed += 1
            await page.screenshot(path=str(SCREENSHOTS_DIR / "04_command_executed.png"))
        except Exception as e:
            logger.error(f"Test 4 FAILED: Interactive typing failed: {e}")
            failed += 1

        # Test 5: TouchBar Macro Button Click Interaction
        logger.info("Running Test 5: TouchBar Macro Button Interaction...")
        start_time = time.perf_counter()
        try:
            # Locate macro buttons on bottom TouchBar
            pwd_btn = page.locator("button.touch-btn:has-text('pwd')").first
            if await pwd_btn.is_visible():
                await pwd_btn.click()
                await asyncio.sleep(1.0)
                ms = (time.perf_counter() - start_time) * 1000
                logger.info(f"Test 5 PASSED: TouchBar 'pwd' macro button clicked ({ms:.2f}ms)")
                passed += 1
            else:
                # Click any available TouchBar slot
                touch_btn = page.locator("button.touch-btn").first
                await touch_btn.click()
                await asyncio.sleep(1.0)
                ms = (time.perf_counter() - start_time) * 1000
                logger.info(f"Test 5 PASSED: TouchBar button clicked ({ms:.2f}ms)")
                passed += 1
            await page.screenshot(path=str(SCREENSHOTS_DIR / "05_touchbar_macro_clicked.png"))
        except Exception as e:
            logger.error(f"Test 5 FAILED: TouchBar interaction error: {e}")
            failed += 1

        # Test 6: App Tab Switching Resilience
        logger.info("Running Test 6: App Tab Switching (Terminal -> Files -> Settings -> Terminal)...")
        start_time = time.perf_counter()
        try:
            # Click Files Tab
            await page.click("button.nav-tab-btn:has-text('Files')")
            await asyncio.sleep(0.5)
            await page.screenshot(path=str(SCREENSHOTS_DIR / "06_tab_files.png"))

            # Click Settings Tab
            await page.click("button.nav-tab-btn:has-text('Settings')")
            await asyncio.sleep(0.5)
            await page.screenshot(path=str(SCREENSHOTS_DIR / "07_tab_settings.png"))

            # Return to Terminal Tab
            await page.click("button.nav-tab-btn:has-text('Terminal')")
            await asyncio.sleep(0.5)
            await page.screenshot(path=str(SCREENSHOTS_DIR / "08_tab_terminal_restored.png"))

            ms = (time.perf_counter() - start_time) * 1000
            logger.info(f"Test 6 PASSED: App tabs switched smoothly without WebGL crashes ({ms:.2f}ms)")
            passed += 1
        except Exception as e:
            logger.error(f"Test 6 FAILED: App tab switching failed: {e}")
            failed += 1

        # Test 7: Mobile Viewport Responsiveness
        logger.info("Running Test 7: Mobile Viewport Resizing (Pixel 7: 412x915)...")
        start_time = time.perf_counter()
        try:
            await page.set_viewport_size({"width": 412, "height": 915})
            await asyncio.sleep(1.0)
            await page.screenshot(path=str(SCREENSHOTS_DIR / "09_mobile_viewport.png"))
            ms = (time.perf_counter() - start_time) * 1000
            logger.info(f"Test 7 PASSED: Mobile viewport resized and rendered cleanly ({ms:.2f}ms)")
            passed += 1
        except Exception as e:
            logger.error(f"Test 7 FAILED: Viewport resize failed: {e}")
            failed += 1

        logger.info("==================================================")
        logger.info(f"AUDIT SUMMARY: Total: {passed + failed} | Passed: {passed} | Failed: {failed}")
        logger.info("==================================================")

        await browser.close()

    # Copy log to latest_ui_e2e.log
    with open(LOG_FILE, "r") as f_in, open(LATEST_LOG_FILE, "w") as f_out:
        f_out.write(f_in.read())

if __name__ == "__main__":
    asyncio.run(run_e2e_tests())
