#!/usr/bin/env bash
# Run EVERY check against the game. Usage (from anywhere): bash dev/check.sh
# 1) export the Sheet seed to JSON  2) engine tests  3) full headless playthrough
set -euo pipefail
DEV="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; ROOT="$(dirname "$DEV")"
XLSX="$(ls "$ROOT"/LabForHire_Content_v*.xlsx | sort -V | tail -1)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
echo "== content: $(basename "$XLSX")"
python3 "$DEV/content/export_json.py" "$XLSX" "$TMP/content.json"
echo "== engine tests"
node "$DEV/tests/test_engine.js" "$ROOT/index.html" "$TMP/content.json"
echo "== full playthrough (needs Playwright + Chromium)"
python3 "$DEV/tests/play.py" "$ROOT/index.html"
echo "== ALL CHECKS PASSED"
