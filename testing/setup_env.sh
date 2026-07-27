#!/usr/bin/env bash
# Sovereign Terminal Automated Testing Environment Provisioning Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="${SCRIPT_DIR}/venv"

echo "=== Provisioning Sovereign Terminal Test Environment ==="

if [ ! -d "${VENV_DIR}" ]; then
    echo "Creating Python virtual environment in ${VENV_DIR}..."
    python3 -m venv "${VENV_DIR}"
else
    echo "Existing virtual environment found in ${VENV_DIR}."
fi

echo "Upgrading pip and installing testing dependencies..."
"${VENV_DIR}/bin/pip" install --upgrade pip
"${VENV_DIR}/bin/pip" install -r "${SCRIPT_DIR}/requirements.txt"

echo "Installing Playwright headless Chromium browser binary..."
"${VENV_DIR}/bin/playwright" install chromium

echo "=== Test Environment Provisioning Complete ==="
echo "Virtual environment ready at: ${VENV_DIR}"
echo "Run tests using:"
echo "  ${VENV_DIR}/bin/python ${SCRIPT_DIR}/test_fastapi.py"
echo "  ${VENV_DIR}/bin/python ${SCRIPT_DIR}/test_pty_websocket.py"
echo "  ${VENV_DIR}/bin/python ${SCRIPT_DIR}/test_ui_e2e.py"
