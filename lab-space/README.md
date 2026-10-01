# Lab for Hire: lab space (v0.1.0)

The student-owned lab: an isometric room with 14 spots, a store, paint, and buy / place / take out.
This folder is a **standalone demo** plus everything needed to merge it into the main game (`index.html`) later.

## Try it
Open `lab.html`. It is one self-contained file (about 600 KB, every image built in), so it works from GitHub Pages,
from a claude.ai preview, or straight off a disk.

- **Finish a job (+$60)** stands in for real case work: +$60 lab funds and +20 rep.
- **Reset demo** returns to the starter lab and $100.
- The demo saves under its own browser key, `lfh.labDemo`. It never reads or writes the real game's `lfh.progress`,
  even though both live on the same `github.io` address.

## What's in here
| Path | What | Hand-edit? |
|---|---|---|
| `lab.html` | The demo. Built from `src/lab_template.html` by `src/build_lab.py`. | No: generated |
| `lab-sprites/` | One transparent PNG per item per spot, plus store thumbnails | No: generated |
| `lab-manifest.json` | Frame, room polygons, shading, slots, sprite positions | No: generated |
| `lab-items.json` | The Items tab as JSON | No: generated |
| `LabForHire_Items_v0.1.0.xlsx` | One-time seed for the **Items** tab of the content Sheet | Seed only; the Sheet is the source of truth |
| `src/lab_template.html` | Demo page + the `LabRoom` module (`<script id="lab">`) | **Yes: edit this** |
| `src/build_lab.py` | Injects items, manifest and sprites into the template, writes `lab.html` | Yes |
| `tools/lab-bake/` | The bake: `scene.js` (camera, lights, room, slots, recipes), `bake.html`, `bake.py`, checks | Yes |
| `overlay-check/` | Rule 10 proof: the real 3D lab vs. the stacked sprites | No: generated |
| `HANDOFF.md` | State of the work, merge guide, open items | Yes |

## Rebuilding (needs a Claude session; Jake has no CLI)
Setup, once per sandbox: in `tools/lab-bake/`, run `npm install`, then download the Kenney models listed in
`HANDOFF.md` §6 into `tools/lab-bake/models/`. Playwright's Chromium needs
`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader` for WebGL (already in `harness.py`).

```
cd tools/lab-bake
python3 bake.py <Items.xlsx> <build_dir>             # validates the Items tab, bakes sprites, writes manifest + items JSON
python3 ../../src/build_lab.py <build_dir> <build_dir>/lab.html
python3 smoke.py <build_dir>                          # clicks through like a student; must print ALL PASS
python3 overlay_check.py <build_dir> <report_dir>     # Rule 10 proof
```

## Changing items
Edit the **Items** tab in the Sheet, export it as .xlsx, and rebuild.
- Changing a name, price, description, rank, or unlock needs **no new art**: rebuild only.
- A new item can reuse any existing look by putting that look's name in the **Sprite** column.
- A brand-new look needs a new recipe in `tools/lab-bake/scene.js` and a re-bake.
- Paint rows put a color (`#RRGGBB`) or a pattern (`none`, `checker`, `stripes`) in **Sprite**. No art needed.

Models: Kenney (kenney.nl) Furniture Kit, Space Kit, Cube Pets, Graveyard Kit, CC0. Lab glassware, microscope,
calorimeter, lab bench, grow cabinet, materials tester, spark coil and the graph posters are built from primitives.
