#!/usr/bin/env bash
# One-time setup for the tools the checks need: node, python3, openpyxl, playwright + Chromium. Safe to re-run.
set -uo pipefail
command -v node >/dev/null    || { echo "Install Node.js first: https://nodejs.org"; exit 1; }
command -v python3 >/dev/null || { echo "Install Python 3 first: https://www.python.org"; exit 1; }
python3 -c "import openpyxl, playwright" 2>/dev/null || { echo "Installing openpyxl + playwright..."; python3 -m pip install openpyxl playwright || python3 -m pip install --user openpyxl playwright || exit 1; }
python3 - << 'PY' 2>/dev/null || { echo "Installing Chromium for Playwright (a one-time ~150 MB download)..."; python3 -m playwright install chromium || exit 1; }
from playwright.sync_api import sync_playwright
with sync_playwright() as p: p.chromium.launch().close()
PY
echo "Ready. Now run: bash dev/check.sh"
