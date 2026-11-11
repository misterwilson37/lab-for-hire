# dev/: builder tools (students and teachers never need this folder)

**One command runs everything:** `bash dev/check.sh`. First time on a machine: `bash dev/setup.sh` (installs the rest; needs Node and Python 3).

| Path | What |
|---|---|
| `check.sh` | The six checks, in order (see below) |
| `setup.sh` | One-time install of openpyxl, playwright, and Chromium. Safe to re-run |
| `tests/test_engine.js` | The engine: rules, answer keys, 13 drills x 300 rolls, economy, content rules, quarantine, the content chooser, resume safety |
| `tests/test_feed.js` | The real Apps Script on the real seed workbook (through `gas_mock.js`, a stand-in for Google), plus the messes real Sheets get |
| `tests/play.py` | The entire game in Chromium, start to finish |
| `tests/play_feed.py` | The real Apps Script builds each feed (`make_feeds.js`); Chromium plays against it |
| `tests/test_repo.py` | Docs links, file references, the guard hook, no secrets or student data |
| `tests/grid_tools.js`, `gas_mock.js`, `xlsx_to_grid.py`, `fixtures/` | Shared helpers. `fixtures/lab_space_items.tsv` is the real 39-row Items tab from the live Sheet |
| `content/embed_content.py` | Refresh the game's built-in offline content from the live feed (writes `src/content.json`, then builds) |
| `art/bake.html`, `bake.py`, `embed_art.py` | The room: layout and homemade equipment (`bake.html`), rendering to sprites (`bake.py`), and writing `src/art.json` (`embed_art.py`) |

## The six checks
1. `python3 build.py --check`: generated files are exactly what `src/` builds
2. `test_engine.js`  3. `test_feed.js`  4. `play.py`  5. `play_feed.py`  6. `test_repo.py`

## Common jobs (run from the repo root)
```
python3 build.py                                                   after editing anything in src/
python3 dev/content/embed_content.py "https://script.google.com/macros/s/XXXX/exec"     refresh the offline content copy
python3 dev/art/bake.py && python3 dev/art/embed_art.py            re-bake the room after editing dev/art/bake.html
```
`bake.py` downloads the Kenney CC0 models and three.js on first run into `dev/art/models` and `dev/art/node_modules`. Those and `dev/art/sprites` are git-ignored leftovers.

## Rules of thumb
- **Edit `src/`, never generated files.** A hook blocks it and check step 1 catches it. If you change `src/engine.js`, run `python3 build.py`: the Sheet's script contains a copy.
- **Add a test with every behavior**, against real data when you can (the seed workbook, the live-Sheet reconstruction).
- Tests pin their own timestamps and never depend on what the built-in snapshot happens to contain.
