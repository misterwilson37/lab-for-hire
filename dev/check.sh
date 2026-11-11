#!/usr/bin/env bash
# Run EVERY check. Usage (from anywhere): bash dev/check.sh
# First time on a machine? Run: bash dev/setup.sh
set -euo pipefail
DEV="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; ROOT="$(dirname "$DEV")"
cd "$ROOT"
echo "== 1/6 generated files are exactly what src/ builds (nothing hand-edited, nothing stale)"
python3 build.py --check
echo "== 2/6 engine: logic, answer keys, drills, economy, content rules, the content chooser"
node dev/tests/test_engine.js index.html
echo "== 3/6 Sheet reader: real seed data through the real Apps Script, plus the messes real Sheets get"
node dev/tests/test_feed.js
echo "== 4/6 whole game, start to finish, in a real browser"
python3 dev/tests/play.py index.html
echo "== 5/6 Sheet -> browser: live edits, offline, broken cases, old-layout Sheet, mid-class edits"
python3 dev/tests/play_feed.py index.html
echo "== 6/6 repo hygiene: docs links resolve, hook guards generated files, no secrets or student data"
python3 dev/tests/test_repo.py
echo "== ALL CHECKS PASSED"
echo "   (Changed the room art? Also run: python3 dev/art/overlay_check.py)"
