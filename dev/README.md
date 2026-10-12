# dev/: builder tools (students and teachers never need this folder)

| Folder | What | Run |
|---|---|---|
| `check.sh` | Runs every check: exports the Sheet, runs the engine tests, runs the full playthrough | `bash dev/check.sh` |
| `tests/` | `test_engine.js` (logic, answer keys, drills, economy, art-to-Items agreement) and `play.py` (headless play of the whole loop) | via `check.sh` |
| `content/` | `export_json.py` (Sheet .xlsx → JSON) and `embed_content.py` (JSON → index.html) | see below |
| `art/` | `bake.html` (room layout + homemade equipment), `bake.py` (renders layers), `embed_art.py` (layers → index.html) | see below |

**`index.html` is the only copy of the game code.** Tools swap generated blocks (content, art) inside it. Never hand-edit those blocks.

**Update content** (until the live Sheet feed exists):
```
python3 dev/content/export_json.py LabForHire_Content_vX.Y.Z.xlsx /tmp/content.json
python3 dev/content/embed_content.py index.html /tmp/content.json
bash dev/check.sh
```

**Re-bake the room art** (after editing `dev/art/bake.html`):
```
python3 dev/art/bake.py
python3 dev/art/embed_art.py index.html dev/art/sprites
bash dev/check.sh
```
`bake.py` downloads Kenney CC0 models and three.js on first run, into `dev/art/models` and `dev/art/node_modules`. Those folders, and `dev/art/sprites`, are build leftovers. Delete them before zipping.
