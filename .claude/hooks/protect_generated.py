#!/usr/bin/env python3
"""PreToolUse hook for Edit|Write: refuse to edit GENERATED files, and say how to change them properly.
Exit code 2 blocks the tool call and sends stderr to Claude as the reason. Anything unexpected exits 0 (never block on a malformed event)."""
import json, os, sys
HOW = {
    "index.html": "edit src/shell.html, src/engine.js, src/lab.js, or src/app.js, then run: python3 build.py",
    "apps-script/LabForHire.gs": "edit src/sheet-script.gs (or src/engine.js, which it contains), then run: python3 build.py",
    "apps-script/appsscript.json": "it is written by build.py",
    "src/content.json": "it is the offline copy of the live Sheet: python3 dev/content/embed_content.py <feed URL>",
    "src/art.json": "it is baked: edit dev/art/scene.js (or the Items tab), then: python3 dev/art/bake.py && python3 build.py",
}
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(0)
path = (data.get("tool_input") or {}).get("file_path") or ""
if not path:
    sys.exit(0)
root = os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or os.getcwd()
rel = os.path.relpath(os.path.realpath(path), os.path.realpath(root)).replace(os.sep, "/")
if rel in HOW:
    print(f"BLOCKED: {rel} is GENERATED, so a hand edit would be overwritten (and build.py --check would fail). To change it: {HOW[rel]}", file=sys.stderr)
    sys.exit(2)
sys.exit(0)
