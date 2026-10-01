# HANDOFF: Lab for Hire (main game)

**Updated:** Sept 30, 2026, end of the Playfair sessions (section 6 and session order updated by Hooke, the lab-space instance)
**Instance:** Playfair (William Playfair, inventor of the line graph and bar chart; also "play fair"). The next instance picks a new name.
**People:**
- **Jake Wilson**: builder and deployer. GitHub Pages via the browser; no CLI.
- **Hanson**: 7th-grade science teacher and client. Offers content, standards alignment, misconceptions, and student feedback. Open to an in-person planning chat with Jake.

---

## 1. Current shipped state
| File | Version | What |
|---|---|---|
| `index.html` | game v0.2.0 · engine v0.2.0 · content schema 0.2.1 | The whole game: one self-contained file with an embedded content snapshot. Deploy by uploading to GitHub Pages. |
| `LabForHire_Content_v0.2.1.xlsx` | schema v0.2.1 | Content seed for the Google Sheet (the source of truth) |
| `tools/` | n/a | `export_json.py`, `embed_content.py`, `test_engine.js`, `play.py`. All operate on `index.html`, which stays the only copy of the code. |
| `lab-space-kickoff/` | n/a | Brief, render test, and concept image for the separate lab-space conversation (section 6) |

- **Preview link** (Jake and Hanson only; students need the GitHub Pages URL): https://claude.ai/artifact/3Dmvj54n6hjBkBSsdE3Egb. Add `?preview=1` to unlock all cases and show content-check results.
- **Live Sheet ID:** `1D2uX2xzW87ykVcJ5uv3lDvwwdxfmvOOefkTN9QDOSqY` (view link shared). It was last confirmed holding v0.1.0.

## 2. What the game is today
A 7th-grade science data-reading game. Students run a "Lab for Hire," and clients bring cases built on graphs and tables.
- **Five cases:**
  - Movin' Molecules: **Build mode** (choose axes, choose a scale, plot, TALK check, certify, then analyze)
  - Cold Pack (multi-line graph plus a cost table)
  - Water phase diagram (real data)
  - Frankenstein fog (real CO₂ data, log pressure axis)
  - Winter Bounce (text table plus a bar graph)
- **Question types:** multiple choice, pick two, pick three, select all.
- **Branching** (Hanson calls it "awesome"; it must survive every future change):
  - Every wrong option carries an error tag.
  - **Calibration Bay** handles graph-reading errors. It runs **"Watch one"** (a worked example with the answer stated) and then **"Your turn"** (a freshly generated graph), using 13 drill generators.
  - **The Archive** handles science errors: a reteach plus a Sheet-authored check question.
  - After either, the student returns to the case with a "Remember:" strip showing, and retries.
  - A second miss reveals the answer with the reason.
  - Calibration is prioritized over Archive.
- **Calibration Bay free practice:** 13 skills, unlimited new graphs, streaks.
- **Rank, rep, and a lab shelf** of emoji equipment. Placeholder: to be replaced by the real lab (section 5).
- **Progress** is stored in `localStorage` only. No accounts, no PII.

## 3. Playtest history (all fixed)
- **v0.1.1 iPad pass:**
  - `color-mix()` replaced with rgba tokens. On pre-16.2 iPadOS, every gridline would have vanished.
  - Buttons use `touch-action: manipulation`.
- **v0.2.0 Jake playtest, 7 findings:**
  1. The case brief is now always available.
  2. Axis *choice* got its own tag and drill (`CAL-AXIS-CHOICE` / `variable-placement`). It had been sharing `CAL-AXIS`, which is about *reading* an axis.
  3. Side missions now show before they ask ("Watch one" first).
  4. A second miss states the answer and the reason.
  5. **Build-mode questions never ask for a value the student just plotted.** MM-01 reads backward (650 m/s → 20°C) and MM-02 interpolates (80°C → about 725). Keep this rule.
  6. **Steepness, not "greatest amount":** MM-04 is a pick-two with a steepness tie. The drill's trap requires a long section that rises strictly more in total but is not steepest.
  7. MM-08 asks whether *this* graph can answer a pressure question (no: pressure isn't on the axes).
- **Found while fixing:** drill contexts could produce absurd values. Each context now has realistic y-steps and a ceiling, and the re-roll wrapper rejects violations.

**Standing content rules learned from playtests:**
- No question may be answerable by copying student input.
- A question must be answerable from its visual, or be explicitly *about* what the visual can't show.
- Side-mission explanations are statements, never questions (a test enforces this).
- Every drill value must be physically believable.

## 4. Hanson's feedback (the new direction)
Her words, summarized:
- **"Please don't abandon it!"** Keep the branching support. The opening is an incredible starting point.
- **Ownership is her idea for the "one more round" feeling.** Students build and run their own lab: accept client jobs, earn money from investigations, buy equipment, customize the space, and unlock new case types. Something that belongs to them and keeps growing.
- **Instructional priority, from the updated standards:** plan investigations, analyze evidence, develop models, apply understanding. Planning is the gap the current game doesn't touch.
- **Her job pattern:**
  - A client needs a material for a purpose.
  - Students decide how to compare the options fairly.
  - They examine the resulting data and answer several connected questions.
  - They make an evidence-backed recommendation, and completion earns something for their lab.
  - A later client brings **different requirements or new data**, so students work the evidence again.
- **Her year-long content ideas:**
  - Medical design cases (**7.ETS1.1**)
  - Reaction investigations (**7.PS3.1**)
  - Plant-growth investigations (**7.LS1.4**)
  - Plus the earlier unit list: cells 7.LS1.1–1.3, sensory 7.LS1.5, respiration and photosynthesis 7.LS1.7 / 7.PS3.2 / 7.LS2.1, genes and mutations 7.LS3.1–3.2.

## 5. Agreed design for the next phase
- **Two currencies:**
  - `rep` is never spent and drives rank (it exists today).
  - `funds` are earned and spent in the store.
  - Funds pay for **evidence quality and completed side missions**, never for speed, so getting help is never a loss.
  - A replay with the same data pays a little; **new requirements or new data pay full**.
- **Purchases unlock content**, so her year becomes the store catalog. Cosmetics sit on top (paint, posters, pets, theme packs).
  - Microscope → cell cases
  - Greenhouse → plant growth
  - Materials tester → 7.ETS1.1 design
  - Calorimeter → 7.PS3.1 reactions
- **Job templates** (a new engine piece and the key to real replay): the same client and investigation, with requirement parameters that vary per play and data **generated from a simple model** instead of fixed rows.
- **"Plan the test" stage** before the data appears. Students choose what to change, what to keep the same, and how many trials to run. New diagnostic tags cover changing two things, no comparison or control, and one trial. An optional twist: tests cost lab funds, so a sloppy plan wastes budget but is never fatal.
- **"Recommendation" stage at the end of each job:** claim, then evidence, then reasoning, which is her CER structure and what the client pays for.
- **Save code:** a short copy/paste or QR code that carries a student's lab between devices, with no accounts and no PII.
  - Ellis is **1:1 iPad**, so per-device saving mostly works. The save code covers device swaps, home play, and wiped devices.
  - (Correction to an earlier note: shared carts are not the main case.)
- **Real logins and a teacher dashboard** are deferred. When they come, they bring Firebase, the COPPA/TN privacy work (reusable from TTB), and Rule 11 (student and teacher numbers must match).

## 6. Lab space: separate conversation, already kicked off
- **Status: DELIVERED (Hooke session, Sept 30, 2026).** Everything lives in `lab-space/`: the standalone demo `lab.html`, the `LabRoom` module v0.1.0, the generated sprites and manifest, the Items tab seed `LabForHire_Items_v0.1.0.xlsx`, the bake tools, and the Rule 10 overlay proof. **`lab-space/HANDOFF.md` has the merge guide (its §3) and the open items (its §8).** Demo preview: https://claude.ai/artifact/W1e2gm52CSZ64hcQbpPpyx. The kickoff notes below are kept for history.
- **Art pipeline (proven):**
  - Kenney **CC0 3D models**, from the GitHub mirror `Hidencod/tge-assets`, which the sandbox can download: Furniture Kit, Space Kit, Cube Pets, and Graveyard Kit (a Frankenstein theme pack).
  - The missing lab gear (beaker, flask, tube rack, microscope) is built from primitives in the same low-poly style.
  - **One locked isometric camera plus one lighting rig** makes everything match with no hand-curation.
  - Recolors are code. Posters can be little data graphs.
- **Recommended build:** bake each item, alone in its slot through the locked camera, to a transparent PNG. The PNGs stack with no anchor math, so the iPad just layers images and needs no WebGL.
- **Slots, not free placement.**
- **Contract for merging** (details in `LAB_BRIEF.md`):
  - Module `LabRoom.mount(el, { state, items, onChange })` in a `<script id="lab">` block.
  - Lab state `{ funds, owned, placed, paint }` inside `lfh.progress`.
  - New Sheet tab **Items**: `ItemID · Name · Slot · Price · Kind · Unlocks · Rank required · Sprite · Description`.
- **To start:** upload `LAB_BRIEF.md`, `render_test.html`, the concept image, and this HANDOFF, then say "Build the lab-space skeleton from this brief."

## 7. Recommended session order (main game)
1. **Apps Script feed.**
   - `doGet` on the Sheet returns this same JSON shape.
   - Port `LFH.validate` verbatim (it's plain JS) plus a "Check my case" menu.
   - The game fetches the feed on GitHub Pages and falls back to the snapshot.
   - The claude.ai artifact can't fetch external URLs (CSP), so the preview stays snapshot-only.
   - After this, Hanson edits the Sheet and the game updates with no re-upload.
2. **Funds, store stub, and save code.** The real store now exists (`lab-space/`), so this session can wire funds straight into the `LabRoom` state shape `{ funds, owned, placed, paint }` inside `lfh.progress`. The save code must carry the lab too.
3. **Job templates, Plan stage, and Recommendation (CER) stage.** Rebuild Cold Pack as the first template job; it's her own example.
4. **Merge the lab-space module.** Delivered; follow `lab-space/HANDOFF.md` §3. The Items tab bumps the content schema to 0.3.0.
5. **Content packs by unit with Hanson:** she writes cases and misconceptions in the Sheet, and the engine stays ours.

## 8. Open items waiting on people
- **Jake:**
  - Re-import `LabForHire_Content_v0.2.1.xlsx` into the SAME Sheet (File → Import → Upload → *Replace spreadsheet*), then confirm the dropdowns survived.
  - **One real-iPad Safari playthrough.** Everything so far is emulated Chromium, not WebKit.
  - **Rule 9 ruling:** is the embedded content snapshot OK as a generated build artifact until the feed lands? Playfair's reading: yes.
  - **Apps Script deploy:** can district Workspace deploy as "Anyone" for home access, or is it domain-only?
  - Check that the district content filter allows `*.github.io` (Google Fonts is optional; the game falls back).
- **Hanson:**
  - Play the preview, ideally with a few students.
  - Rulings needed: the real water diagram disagreeing with her worksheet key; sample data; "dissolves" vs "reacts."
  - Case length (7–8 questions): OK?
  - Which unit to build first.

## 9. Content provenance (tell Hanson)
- **MOVIN-MOLECULES:** her Lesson 5 data points; original questions.
- **COLD-PACK:** her example. **Sample data.** Coldest ≠ best: urea wins on cost.
- **PHASE-PROBE:** **real water data**. Her worksheet's phase table was never available. On real water, her worksheet Q1 has two right answers.
- **DRY-ICE:** **real CO₂ data**, rounded, on a log axis. It fills the unit test's log-scale gap.
- **BOUNCE-LAB:** sample data following the gas law.
- **No unit-test items are used**, even paraphrased (test security plus copyright). STEMscopes worksheet items are a blueprint only.
- Unit test Table 2 has a physically inconsistent "vacuum" at 120 kPa, above atmospheric. Not reused.

## 10. Architecture (for the next builder)
- **`index.html` has three script blocks:**
  - `lfh-content`: a generated JSON snapshot. Never hand-edit it; `tools/embed_content.py` replaces it.
  - `engine` (`LFH`): pure logic, Node-testable.
  - `app-js`: UI and SVG rendering.
- **`LFH.phaseModel` is the ONE state function.** It paints the phase regions and it is what the tests check the answer keys against.
- **Drills:**
  - All go through `LFH.makeDrill`, which re-rolls bad draws (duplicates, NaN, unbelievable values).
  - Drill contexts declare their allowed trend directions, realistic y-steps, and ceilings.
- **iPad rules:**
  - No `color-mix()`.
  - `touch-action: manipulation`.
  - Test at 1366×768, 810/1080 (iPad), 390 (phone), and dark mode.
  - Portrait iPad stacks the graph above the question, so students scroll. **A sticky graph for portrait is a to-do.**
- **Tests (all green at handoff):**
  - `node tools/test_engine.js index.html <content.json>`: validation, 31 phase keys plus traced paths, grading, build diagnosis, playtest regressions, and 300 rolls × 13 drills (correctness, uniqueness, honesty, realism).
  - `python3 tools/play.py index.html`: a full headless playthrough with an Archive detour, 0 JS errors expected.
- **Content update path until the feed exists:** export the Sheet → `export_json.py` → `embed_content.py` → both tests → upload.
