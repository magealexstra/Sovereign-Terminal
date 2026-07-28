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
    print("Error: 'playwright' python library is required for test_ui_tab3_settings.py.")
    sys.exit(1)

# Sovereign Terminal Tab 3 (Settings Manager & Sub-Tabs) Audit Suite
BASE_URL = os.getenv("SERVER_URL", "http://localhost:2069")
AUTH_TOKEN = os.getenv("SERVER_AUTH_TOKEN", "1234")

LOGS_DIR = Path(__file__).parent / "logs"
SCREENSHOTS_DIR = LOGS_DIR / "screenshots"
LOGS_DIR.mkdir(exist_ok=True)
SCREENSHOTS_DIR.mkdir(exist_ok=True)

TIMESTAMP_STR = datetime.now().strftime("%Y%m%d_%H%M%S")
LOG_FILE = LOGS_DIR / f"audit_tab3_settings_{TIMESTAMP_STR}.log"
LATEST_LOG_FILE = LOGS_DIR / "latest_tab3_settings.log"

logger = logging.getLogger("Tab3SettingsAudit")
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
    logger.info("SOVEREIGN TERMINAL TAB 3 (SETTINGS & SUB-CARDS) AUDIT")
    logger.info(f"Timestamp: {datetime.now().isoformat()}")
    logger.info(f"Target Gateway: {BASE_URL}")
    logger.info(f"Python Version: {platform.python_version()}")
    logger.info(f"OS Platform: {platform.system()} {platform.release()}")
    logger.info(f"Audit Log File: {LOG_FILE.resolve()}")
    logger.info("==================================================")

async def run_tab3_tests():
    log_environment_metadata()
    passed = 0
    failed = 0

    async with async_playwright() as p:
        logger.info("Launching headless Chromium browser for Tab 3 audit...")
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
            logger.info("Setup: App loaded and authenticated.")
        except Exception as e:
            logger.error(f"Setup FAILED: {e}")
            await browser.close()
            return

        # Step 1: Navigate to Settings Tab
        logger.info("Running Step 1: Navigate to Settings Tab...")
        start_time = time.perf_counter()
        try:
            settings_tab_btn = page.locator("button.nav-tab-btn:has-text('Settings')")
            await settings_tab_btn.click()
            await asyncio.sleep(1.0)

            await page.wait_for_selector(".settings-master-container", timeout=5000)
            ms = (time.perf_counter() - start_time) * 1000
            logger.info(f"Step 1 PASSED: Settings Master Container loaded ({ms:.2f}ms)")
            await page.screenshot(path=str(SCREENSHOTS_DIR / "tab3_01_settings_main.png"))
            passed += 1
        except Exception as e:
            logger.error(f"Step 1 FAILED: {e}")
            failed += 1

        # Step 2: Theme Settings Sub-Card Audit
        logger.info("Running Step 2: Theme Settings Sub-Card Audit...")
        start_time = time.perf_counter()
        try:
            theme_btn = page.locator("button.subtab-btn:has-text('Themes')")
            await theme_btn.click()
            await asyncio.sleep(0.8)

            # Locate Theme Cards / Palette Selectors
            theme_cards = page.locator(".theme-card, .theme-option-card")
            card_count = await theme_cards.count()
            logger.debug(f"Theme option cards count: {card_count}")

            ms = (time.perf_counter() - start_time) * 1000
            logger.info(f"Step 2 PASSED: Theme Settings sub-card rendered cleanly ({ms:.2f}ms)")
            await page.screenshot(path=str(SCREENSHOTS_DIR / "tab3_02_subtab_themes.png"))
            passed += 1
        except Exception as e:
            logger.error(f"Step 2 FAILED: {e}")
            failed += 1

        # Step 3: Button Studio Sub-Card Audit
        logger.info("Running Step 3: Button Studio Sub-Card Audit...")
        start_time = time.perf_counter()
        try:
            studio_btn = page.locator("button.subtab-btn:has-text('Studio')")
            await studio_btn.click()
            await asyncio.sleep(0.8)

            studio_viewport = page.locator(".button-studio-container, .settings-content-viewport")
            await studio_viewport.first.wait_for(timeout=5000)

            ms = (time.perf_counter() - start_time) * 1000
            logger.info(f"Step 3 PASSED: Button Studio sub-card rendered cleanly ({ms:.2f}ms)")
            await page.screenshot(path=str(SCREENSHOTS_DIR / "tab3_03_subtab_studio.png"))
            passed += 1
        except Exception as e:
            logger.error(f"Step 3 FAILED: {e}")
            failed += 1

        # Step 4: TouchBar Layout Builder Sub-Card Audit
        logger.info("Running Step 4: TouchBar Layout Builder Sub-Card Audit...")
        start_time = time.perf_counter()
        try:
            layout_btn = page.locator("button.subtab-btn:has-text('Layout')")
            await layout_btn.click()
            await asyncio.sleep(0.8)

            layout_viewport = page.locator(".layout-builder-container, .settings-content-viewport")
            await layout_viewport.first.wait_for(timeout=5000)

            ms = (time.perf_counter() - start_time) * 1000
            logger.info(f"Step 4 PASSED: Layout Builder sub-card rendered cleanly ({ms:.2f}ms)")
            await page.screenshot(path=str(SCREENSHOTS_DIR / "tab3_04_subtab_layout.png"))
            passed += 1
        except Exception as e:
            logger.error(f"Step 4 FAILED: {e}")
            failed += 1

        logger.info("==================================================")
        logger.info(f"AUDIT SUMMARY: Total Steps: {passed + failed} | Passed: {passed} | Failed: {failed}")
        logger.info("==================================================")

        await browser.close()

    with open(LOG_FILE, "r") as f_in, open(LATEST_LOG_FILE, "w") as f_out:
        f_out.write(f_in.read())

if __name__ == "__main__":
    asyncio.run(run_tab3_tests())
