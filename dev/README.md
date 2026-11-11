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
| `tests/grid_tools.js`, `gas_mock.js`, `xlsx_to_grid.py`, `fixtures/` | Shared helpers. `fixtures/lab_space_items.tsv` is the 39-row Items tab as it stood in the live Sheet before the Nov 2026 rebuild |
| `content/embed_content.py` | Refresh the game's built-in offline content from the live feed (writes `src/content.json`, then builds) |
| `art/scene.js`, `bake.html`, `bake.py`, `setup.sh` | The room: camera, lights, spots, and every item's recipe (`scene.js`); the bake page (`bake.html`); rendering each item alone in each spot and writing `src/art.json` (`bake.py`) |
| `art/overlay_check.py` | Proof that the stacked pictures match a true 3D render of the same lab. Run it after any re-bake |
| `art/portraits/` | The source photos for the scientist posters, with their licenses (`portraits/CREDITS.md`) |

## The six checks
1. `python3 build.py --check`: generated files are exactly what `src/` builds
2. `test_engine.js`  3. `test_feed.js`  4. `play.py`  5. `play_feed.py`  6. `test_repo.py`

## Common jobs (run from the repo root)
```
python3 build.py                                                   after editing anything in src/
python3 dev/content/embed_content.py "https://script.google.com/macros/s/XXXX/exec"     refresh the offline content copy
bash dev/art/setup.sh                                              once, before the first bake (three.js and the Kenney models)
python3 dev/art/bake.py && python3 build.py                        re-bake the room after editing dev/art/scene.js or the Items tab
python3 dev/art/overlay_check.py                                   prove the bake against a real 3D render
```
`setup.sh` downloads the Kenney CC0 models and three.js into `dev/art/models` and `dev/art/node_modules`. Those and `dev/art/sprites` are git-ignored leftovers.

## Rules of thumb
- **Edit `src/`, never generated files.** A hook blocks it and check step 1 catches it. If you change `src/engine.js`, run `python3 build.py`: the Sheet's script contains a copy.
- **Add a test with every behavior**, against real data when you can (the seed workbook, the live-Sheet reconstruction).
- Tests pin their own timestamps and never depend on what the built-in snapshot happens to contain.
