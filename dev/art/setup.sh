#!/usr/bin/env bash
# One-time setup for the art bake (only needed when the room art changes): three.js + the 17 Kenney CC0 models. Safe to re-run.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
python3 -c "import PIL, playwright" 2>/dev/null || python3 -m pip install pillow playwright
npm install --silent
sh fetch_models.sh
echo "Ready. Bake with: python3 dev/art/bake.py"
