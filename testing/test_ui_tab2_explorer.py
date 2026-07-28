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
    print("Error: 'playwright' python library is required for test_ui_tab2_explorer.py.")
    sys.exit(1)

# Sovereign Terminal Tab 2 (File Explorer & CodeEditor) Audit Suite
BASE_URL = os.getenv("SERVER_URL", "http://localhost:2069")
AUTH_TOKEN = os.getenv("SERVER_AUTH_TOKEN", "1234")

LOGS_DIR = Path(__file__).parent / "logs"
SCREENSHOTS_DIR = LOGS_DIR / "screenshots"
LOGS_DIR.mkdir(exist_ok=True)
SCREENSHOTS_DIR.mkdir(exist_ok=True)

TIMESTAMP_STR = datetime.now().strftime("%Y%m%d_%H%M%S")
LOG_FILE = LOGS_DIR / f"audit_tab2_explorer_{TIMESTAMP_STR}.log"
LATEST_LOG_FILE = LOGS_DIR / "latest_tab2_explorer.log"

logger = logging.getLogger("Tab2ExplorerAudit")
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
    logger.info("SOVEREIGN TERMINAL TAB 2 (FILES & CODEEDITOR) AUDIT")
    logger.info(f"Timestamp: {datetime.now().isoformat()}")
    logger.info(f"Target Gateway: {BASE_URL}")
    logger.info(f"Python Version: {platform.python_version()}")
    logger.info(f"OS Platform: {platform.system()} {platform.release()}")
    logger.info(f"Audit Log File: {LOG_FILE.resolve()}")
    logger.info("==================================================")

async def run_tab2_tests():
    log_environment_metadata()
    passed = 0
    failed = 0

    async with async_playwright() as p:
        logger.info("Launching headless Chromium browser for Tab 2 audit...")
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

        # Step 1: Navigate to Files Tab & Ensure Tree Sub-Tab Active
        logger.info("Running Step 1: Navigate to Files Tab...")
        start_time = time.perf_counter()
        try:
            files_tab_btn = page.locator("button.nav-tab-btn:has-text('Files')")
            await files_tab_btn.click()
            await asyncio.sleep(0.5)

            # Ensure Tree subtab is active and refresh directory contents
            tree_subtab_btn = page.locator("button.subtab-btn:has-text('Files')")
            if await tree_subtab_btn.is_visible():
                await tree_subtab_btn.click()
            await asyncio.sleep(0.5)

            refresh_btn = page.locator("button.tb-btn[title='Refresh Directory']")
            if await refresh_btn.is_visible():
                await refresh_btn.click()
            await asyncio.sleep(1.2)

            ms = (time.perf_counter() - start_time) * 1000
            logger.info(f"Step 1 PASSED: Files tab and FileExplorer view loaded in {ms:.2f}ms")
            await page.screenshot(path=str(SCREENSHOTS_DIR / "tab2_01_explorer_tab.png"))
            passed += 1
        except Exception as e:
            logger.error(f"Step 1 FAILED: {e}")
            failed += 1

        # Step 2: Directory Tree Item Audit
        logger.info("Running Step 2: Directory Tree Item Audit...")
        start_time = time.perf_counter()
        try:
            await page.wait_for_selector(".tree-item", timeout=6000)
            file_items = page.locator(".tree-item")
            item_count = await file_items.count()
            logger.debug(f"FileExplorer directory item count: {item_count}")
            assert item_count > 0, "No directory items found in FileExplorer"

            ms = (time.perf_counter() - start_time) * 1000
            logger.info(f"Step 2 PASSED: FileExplorer rendered {item_count} items ({ms:.2f}ms)")
            passed += 1
        except Exception as e:
            logger.error(f"Step 2 FAILED: {e}")
            failed += 1

        # Step 3: Open File into CodeEditor
        logger.info("Running Step 3: Open File into CodeEditor Sub-Tab...")
        start_time = time.perf_counter()
        try:
            # Click a file item (not folder)
            target_file_item = page.locator(".tree-item:has(.tree-item-name:has-text('.py')), .tree-item:has(.tree-item-name:has-text('.md')), .tree-item:has(.tree-item-name:has-text('.json'))").first
            if await target_file_item.is_visible():
                await target_file_item.click()
            else:
                await page.locator(".tree-item").last.click()

            await asyncio.sleep(1.5)
            # Verify Editor view or CodeMirror container mounted
            editor_container = page.locator(".cm-editor, .code-editor-container")
            await editor_container.first.wait_for(timeout=5000)

            ms = (time.perf_counter() - start_time) * 1000
            logger.info(f"Step 3 PASSED: Opened file into CodeEditor sub-tab ({ms:.2f}ms)")
            await page.screenshot(path=str(SCREENSHOTS_DIR / "tab2_02_editor_opened.png"))
            passed += 1
        except Exception as e:
            logger.error(f"Step 3 FAILED: {e}")
            failed += 1

        # Step 4: CodeMirror Content Inspection
        logger.info("Running Step 4: CodeMirror Text Editor Content Inspection...")
        start_time = time.perf_counter()
        try:
            cm_content = await page.locator(".cm-content").first.inner_text()
            logger.debug(f"CodeMirror content length: {len(cm_content)} bytes")
            assert len(cm_content) > 0, "CodeMirror editor content is empty"

            ms = (time.perf_counter() - start_time) * 1000
            logger.info(f"Step 4 PASSED: CodeMirror editor content populated ({ms:.2f}ms)")
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
    asyncio.run(run_tab2_tests())
