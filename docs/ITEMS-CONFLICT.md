# The Items catalog conflict (open: Jake decides)

**Rule 9:** one shop, one catalog. Two exist. Neither has been overwritten or merged. Until Jake decides, the game refuses the live Sheet (its layout is older than the game expects), so students keep the built-in content and nothing breaks.

## How it happened
The room and shop were built in two places at once. In the main conversation (v0.3.0), an `Items` tab (22 items) and a baked room (27 layers) were built into the game. Separately, a "lab-space" conversation built its own catalog (39 items), a different slot system, and an art pipeline (`bake/scene.js` "recipes", `bake/bake.py`, `lab-manifest.json`, a `lab.html` demo). That conversation also wrote an `Items` tab and an `Items Legend` tab into the live Sheet. **Its code and art have never been seen by the main project.**

## The two designs, side by side

| | **This game (v0.3.0)** | **Lab-space (in the live Sheet)** |
|---|---|---|
| Size | 22 items | 39 items |
| Art | 27 baked layers in `src/art.json` from `dev/art/bake.html`; one fixed slot per item | "Recipes" in `bake/scene.js` (not in this repo), baked by its own `bake.py` into `lab-manifest.json` |
| Slots | `room`, `bench-1..3`, `machine`, `pet`, `shelf`, `shelf-top`, `plant`, `rug`, `wall-a/b`, `desk-lamp`, `grow`, `corner` | `bench`, `chair`, `shelf`, `shelf-top`, `plant`, `machine`, `rug`, `poster`, `pet`, `table`, `paint-wall`, `paint-floor`, `paint-trim`, `paint-tiles`, and **`bench-item`** (fits any of 3 bench spots) |
| Starter lab | Hard-coded "fixed" layers (desk, laptop, chair, bench, starter glass) | **Defined in the Sheet:** Price 0 means owned from the start, placed in row order |
| Paint | 3 whole-room paint items | Separate wall, floor, trim, tile pieces; plus "Any Color" purchases (a color picker) |
| Rank required | A rank **name** ("Lab Tech") | A rank **number** (0, 1, 2 index into the ranks) |
| Unlocks | One **CaseID**; the case lists one required item | A case **type** (`cells`, `plant-growth`, `materials`, `reactions`): one microscope unlocks every cells case |
| Kind | Equipment, Decor, Pet, Theme, Paint | Equipment, Cosmetic, Theme |
| Rules | `LFH.shopState`, `LFH.buy`, `SLOT_NEEDS` (shelf-top needs a shelf) are built and tested | Not seen |

The lab-space Items rows are fixtures in `dev/tests/fixtures/lab_space_items.tsv` (transcribed from the live Sheet on Nov 10, 2026, descriptions omitted). Counts by slot:

| Slot | Items |
|---|---|
| `bench-item` | 5 |
| `poster` | 4 |
| `paint-wall` | 4 |
| `paint-floor` | 3 |
| `paint-trim` | 3 |
| `paint-tiles` | 3 |
| `machine` | 3 |
| `pet` | 3 |
| `bench` | 2 |
| `chair` | 2 |
| `shelf` | 2 |
| `rug` | 2 |
| `plant` | 1 |
| `shelf-top` | 1 |
| `table` | 1 |

Kinds: {'Cosmetic': 32, 'Equipment': 7}. Starter (Price 0) items: desk, chair-desk, shelf-open, plant-potted, beaker, flask, poster-line, wall-white, floor-lilac, trim-purple, tiles-plain.

## Where the two overlap (same art key; slots compared)

| Item | Sprite | Their slot | This game's slot | |
|---|---|---|---|---|
| `desk` | `desk` | `bench` | `fixed` | DIFFERENT |
| `microscope` | `microscope` | `bench-item` | `bench-1` | DIFFERENT |
| `materials-tester` | `materials-tester` | `machine` | `machine` | same |
| `tube-rack` | `tube-rack` | `bench-item` | `bench-2` | DIFFERENT |
| `books` | `books` | `shelf-top` | `shelf-top` | same |
| `pet-cat` | `pet-cat` | `pet` | `pet` | same |
| `pet-dog` | `pet-dog` | `pet` | `pet` | same |

Most overlapping keys sit in *different* slots, which is why the game's art validator (`LFH.fitToArt`) would skip them.

## Recommendation
**Adopt the lab-space catalog and art; keep this game's economy and shell.** Its data model is the better one:
- the starter lab defined in the Sheet (no hard-coded fixed layers);
- bench items that fit any of 3 spots (less rigid than one slot per item);
- paint split into pieces, with "Any Color" as a premium purchase;
- unlock-by-case-type (Hanson adds many cells cases; one microscope unlocks them all).

## What a merge involves (for whichever instance does it)
1. **Get their output.** Jake uploads the lab-space conversation's zip to `incoming/lab-space/` (git-ignored). Read its HANDOFF first.
2. **Compare art.** Render both rooms through one camera. If the recipes reproduce this game's look (Kenney CC0 models, homemade glassware, locked isometric camera), port the recipe system into `dev/art/` and rebake. If not, decide which art wins; do not run two pipelines (Rule 9).
3. **Data model.** Add a `Case type` column to Cases (or keep `Requires item` and derive the type), make `Unlocks` mean a case type, and decide rank as numbers or names (one, not both: update `LFH.vocab` and the Lists tab together).
4. **Starter lab from the Sheet.** Replace the hard-coded `fixed` layers: Price 0 rows become owned at the start and are placed in row order. `LFH.freshProgress` changes; add a migration for any saved lab (no students have saves yet, so this is cheap now and expensive later).
5. **Slots.** Replace `bench-1..3` with `bench-item` x 3, `poster` x 2, and paint split. Update `LFH.SLOT_NEEDS`, `roomScreen`/`visibleLayers` in `src/app.js`, and the Decorate ghosts.
6. **Rules and tests.** Keep `shopState`, `buy`, `payout`, `jobs`; extend tests (the playthrough must still buy, place, and unlock). `fitToArt`/`validateArt` must agree with the new slots.
7. **Delete the loser** (Rule 9), upgrade the live Sheet (`sheet/UPGRADE-LIVE-SHEET.md`), and run `bash dev/check.sh`.

## If Jake picks "keep this game's catalog" instead
Rename the live Sheet's `Items` tab (keep it, don't destroy it) to `Items (lab-space draft)`, import the seed's `Items` (`sheet/LabForHire_Content_v0.3.1.xlsx`), and continue with the upgrade runbook. The 39-item catalog is shelved, not lost.

## If Jake picks "pause the shop"
Nothing changes: the built-in content keeps working. Revisit when he and Hanson meet.
