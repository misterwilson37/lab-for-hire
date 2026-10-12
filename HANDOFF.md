# HANDOFF: Lab for Hire (main game)

**Updated:** Oct 12, 2026, game v0.4.0: backup **save file** to Google Drive is BUILT (save, load, wiped-device restore)
**Instances:**
- Playfair (William Playfair, inventor of the line graph and bar chart; also "play fair"): v0.1.0–v0.3.0.
- **Minard** (Charles Joseph Minard, whose 1869 Napoleon's-march chart puts six variables on one page): v0.4.0.
- The next instance picks a new name.
**People:**
- **Jake Wilson**: builder and deployer. GitHub Pages via the browser; no CLI.
- **Hanson**: 7th-grade science teacher and client. Offers content, standards alignment, misconceptions, and student feedback. Open to an in-person planning chat with Jake.

---

## 1. Current shipped state
| File | Version | What |
|---|---|---|
| `index.html` | game v0.4.0 · engine v0.4.0 · content schema 0.3.0 | The whole game in one file: code, a content snapshot, and the baked room art (27 layers, ~130 KB). Deploy by uploading to GitHub Pages. |
| `LabForHire_Content_v0.3.0.xlsx` | schema v0.3.0 | Content seed (unchanged in v0.4.0). Has the Items tab (the shop), Requires item + Pay columns on Cases, and Status Teaser. |
| `dev/` | n/a | Builder tools only (see `dev/README.md`). `bash dev/check.sh` runs every check. Subfolders: `tests/`, `content/`, `art/`. All tools operate on `index.html`, the only copy of the code. |

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
- **Progress** is stored in `localStorage` only. No accounts, no PII. A **backup file** in the student's Google Drive carries it between devices (section 6a).

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
- **Save file** (BUILT in v0.4.0; replaces the earlier "save code" idea): a backup file the student keeps in Google Drive. No accounts and no PII.
  - Ellis is **1:1 iPad**, so per-device saving mostly works. The backup covers device swaps, home play, and wiped devices.
  - **Jake ruled out QR codes:** when the iPads die, they die hard, so anything stored only on the device is gone. Drive survives.
  - (Correction to an earlier note: shared carts are not the main case.)
- **Real logins and a teacher dashboard** are deferred. When they come, they bring Firebase, the COPPA/TN privacy work (reusable from TTB), and Rule 11 (student and teacher numbers must match).

## 5a. The UX shell (agreed Sept 30, 2026)
**The room is the home screen. Every activity happens at an object in it.**
- **The laptop is the business side** (on the desk from day one):
  - **Inbox:** jobs, client replies, mentor messages.
  - **Supply shop:** buy gear.
  - **Training sim:** today's Calibration Bay free practice.
  - **Ledger:** funds and rep.
- **The workbench is the science side.** The flow is brief → plan the test → run it and get the data → analyze, with side missions → recommend → get paid.
  - The analyze view is the current two-panel layout: graph pinned, questions on a clipboard.
- **One way in to each thing.** Work never happens on the laptop.
- **Inbox details:**
  - **Locked jobs are teaser emails** that state the requirement ("🔒 Requires a microscope"). The goal is visible.
  - **Client replies respond to the student's recommendation.** A strong one gets full pay and a thank-you. A weak one gets partial pay plus a **follow-up job**. This is how "new requirements or new data" arrives: as a story, not a replay button.
  - **Repeat clients** return with sequels.
  - **A mentor character** signs the Archive reteaches.
  - **Teacher release:** a Sheet column releases jobs per unit, so the inbox follows Hanson's pacing. An optional class-wide "featured job" too.
- **Room details:**
  - Laptop plus a starter bench from day one.
  - Empty slots show faint outlines with prices: the room is the wishlist.
  - The lab is named from a **word builder** (no free text, so no moderation and no PII).
  - The pet reacts when a job is finished.
- **Guardrails:**
  - The room disappears during work.
  - Three taps max from the room to working.
  - A job fits in about 15 minutes and **autosaves mid-job**.
  - **Equipment unlocks job types, never practice.** The training sim and review are always free.

## 5b. Firestore (later, after the game and space work)
Jake wants Firestore eventually. **Build for it now:**
- **All progress lives in ONE versioned object.**
- **All reads and writes go through ONE storage adapter** (`LFH.store.load()` / `LFH.store.save()`). Today it wraps localStorage. Later it swaps to Firestore with no other code changes.
- Never write localStorage directly anywhere else.

When Firestore lands, it brings:
- **COPPA/TN privacy work.** Reuse the TTB compliance docs and consent tracking.
- **Rule 11.** A teacher view of funds, stars, or progress must read the same record through proven-identical readers.
- **Rule 10 harness first.**
- **The save file** may then be retired, or kept as an offline backup.

## 6. Lab space: BUILT in v0.3.0 (the separate conversation is no longer needed)
- **Status:** built and merged in v0.3.0. `LAB_BRIEF.md` and the kickoff folder are retired.
- **What's in the game now:**
  - Lab name word builder on first run.
  - **Room home screen** with tappable Laptop and Workbench hotspots plus labeled buttons.
  - **Decorate mode:** faded ghosts with price tags on empty slots; tap one to shop that slot.
  - **Laptop apps:**
    - Inbox: mentor welcome, job offers, 🔒 teasers, client replies with pay. Phone-style on narrow screens.
    - Supply shop: 22 items in 5 sections, with buttons that say why you can't buy yet.
    - Training sim: the old Calibration Bay.
    - Ledger: funds, rep, rank, jobs table, rename, reset, and a preview-only +$100.
  - **The bench runs the existing case flow**, with autosave on every step and resume after a reload.
  - **Pay** goes to funds, and a reply email arrives.
  - The pet hops and speaks on return; a toast shows if there's no pet.
- **Rules live in the engine and are Node-tested:** `LFH.payout`, `LFH.jobs`, `LFH.shopState` / `LFH.buy`, `LFH.migrate`, `LFH.validateArt`, `LFH.SLOT_NEEDS` (shelf-top needs a shelf).
- **Storage adapter:** `LFH.store.load()` / `.save()` (section 5b) is the ONLY code that touches localStorage.
  - Key `lfh.progress`; v1 saves migrate.
  - Progress object: `{ v: 2, labName, funds, owned, placed, cases, bayCorrect, bayBest, inbox: { read, arrived, seq }, history[], activeJob }`.
- **Room art:** `dev/art/bake.py` renders `bake.html` (layout, slots, homemade equipment) to trimmed PNG layers plus a manifest. `dev/art/embed_art.py` swaps the art into `index.html`.
  - The layout lives in `bake.html`. Slot names there must match the Items tab (`validateArt` enforces this).
  - Starter layers are slot `fixed`: desk, laptop, chair, bench, starter glassware.
  - Paint = base layers `base-lavender` / `base-mint` / `base-sky`.
- **Original design notes (still accurate):**
- **Art pipeline (proven):**
  - Kenney **CC0 3D models**, from the GitHub mirror `Hidencod/tge-assets`, which the sandbox can download: Furniture Kit, Space Kit, Cube Pets, and Graveyard Kit (a Frankenstein theme pack).
  - The missing lab gear (beaker, flask, tube rack, microscope) is built from primitives in the same low-poly style.
  - **One locked isometric camera plus one lighting rig** makes everything match with no hand-curation.
  - Recolors are code. Posters can be little data graphs.
- **Recommended build:** bake each item, alone in its slot through the locked camera, to a transparent PNG. The PNGs stack with no anchor math, so the iPad just layers images and needs no WebGL.
- **Slots, not free placement.**
- **The merge contract, as built:**
  - Module `LabRoom.mount(el, { state, items, onChange })` in a `<script id="lab">` block.
  - Lab state `{ funds, owned, placed, paint }` inside `lfh.progress`.
  - New Sheet tab **Items**: `ItemID · Name · Slot · Price · Kind · Unlocks · Rank required · Sprite · Description`.

## 6a. Save file: BUILT in v0.4.0 (Minard)
- **Where:** Ledger → *Back up your lab* (Save / Load, plus "Last backup: today / 3 days ago / never"). The first-run name screen also has *Load my lab from a backup file*, because a wiped iPad lands there first.
- **Save:** on iPad it opens the **share sheet** (`navigator.share` with a file), where the student picks *Save to Files → Google Drive* or the Drive app. Anywhere the share sheet can't take files, it **downloads** instead. "Last backup" only updates when the save goes through (a cancelled share sheet doesn't count).
- **Load:** the file picker (`accept=.json`). The game shows what's in the file (lab name, funds, jobs done, backup date) and, if this device already has a lab, says plainly that it will be **replaced**. Then it confirms.
- **File:** `<LabName>-lab-backup-YYYY-MM-DD.json` = `{ "lab-for-hire-save": 1, game, savedAt, lab, check, progress }`. `progress` is the whole progress object (including a mid-job `activeJob`) plus `backedUpAt`.
- **Refused files, each with a kid-readable reason:** not a save, hand-edited or damaged (FNV-1a checksum over `progress`), from a newer game version, truncated. The checksum is a speed bump against editing your funds, not security.
- **Rule 9:** the file is a snapshot, not a second live record. Loading **replaces** the device's progress through `LFH.store` and never merges, so there is still exactly one record the game reads.
- **Engine:** `LFH.exportSave`, `LFH.importSave`, `LFH.checksum`, `LFH.saveSummary`, `LFH.hasProgress`, `LFH.backupAge`. New progress field: `backedUpAt` (still `v: 2`; `migrate` fills it in for old saves).
- **Proof (Rule 10 style):** `play.py` takes the lab the full five-job loop just built, saves it through the real button, wipes `localStorage`, reloads, and is refused an edited copy, then restores from the real file and asserts `labName, funds, owned, placed, cases, history, inbox, bayCorrect, bayBest` are identical, and the cat is still in the room. A deliberately broken restore (funds zeroed) was confirmed to **fail** this harness before shipping.
- **The claude.ai preview link can't save files** (artifact pages block downloads and file sharing), and it still shows v0.3.0. Test the save file on the GitHub Pages URL.
- **Not tested:** the iPad share sheet and the Drive file picker themselves. Headless Chromium has no share sheet, so the harness exercises the download fallback. This is part of Jake's real-iPad check (section 8).

## 7. Recommended session order (main game)
0. **Done in v0.3.0:** the storage adapter, funds, shop, lab shell, and merged room (old items 2 and 4).
1. **Apps Script feed.**
   - `doGet` on the Sheet returns this same JSON shape.
   - Port `LFH.validate` verbatim (it's plain JS) plus a "Check my case" menu.
   - The game fetches the feed on GitHub Pages and falls back to the snapshot.
   - The claude.ai artifact can't fetch external URLs (CSP), so the preview stays snapshot-only.
   - After this, Hanson edits the Sheet and the game updates with no re-upload.
2. **Done in v0.4.0:** the save file (section 6a). Storage adapter, funds, and store were already done in v0.3.0.
3. **Job templates, Plan stage, and Recommendation (CER) stage.** Rebuild Cold Pack as the first template job; it's her own example.
4. **Merge the lab-space module** once its conversation delivers.
5. **Content packs by unit with Hanson:** she writes cases and misconceptions in the Sheet, and the engine stays ours.

## 7a. Known gaps in v0.4.0 (honest list)
- **Next up (agreed with Jake Oct 12):** the Cold Pack job template + Plan stage + CER Recommendation (item 3), then the Apps Script feed when Hanson is ready to author. **Hanson is overwhelmed: ease of use is priority one.** Build from her own example and ask her only yes/no questions.
- The save file's **iPad share sheet + Drive picker** path is untested on real hardware (section 6a).
- Students who never tap *Save my lab* still lose their lab when an iPad dies. A gentle nudge (e.g., after every 2nd paid job, if the last backup is older than a week) would help; not built.
- **Job templates, the Plan-the-test stage, and the Recommendation (CER) stage** are not built. Replays reuse the same data (they pay 25%).
- **Follow-up jobs** after weak work aren't generated. The reply email says so in words only.
- **The mentor's welcome email text lives in code (`mailBody`)**, not the Sheet. It should move to a Messages tab when the feed lands.
- **Teacher release per unit** isn't built. Jobs release by path order, and Teasers always show.
- The Bounce Lab gate means the 5th job needs an $80 purchase. Watch whether that feels like a goal or a wall.
- Everything is tested in Chromium (desktop, 810×1080 iPad portrait, dark mode). **Real-iPad Safari is still untested.**

## 8. Open items waiting on people
- **Jake:**
  - **Drive check on a student iPad** (blocks trusting the save file): in Safari, open the game, Ledger → *Save my lab*. Does the share sheet offer *Save to Files → Google Drive* (or the Drive app)? Then *Load my lab*: does the picker show Google Drive? If Drive is missing, the Drive app needs installing/signing in (a tech-office question).
  - Re-import `LabForHire_Content_v0.3.0.xlsx` into the SAME Sheet (File → Import → Upload → *Replace spreadsheet*), then confirm the dropdowns survived.
  - **One real-iPad Safari playthrough.** Everything so far is emulated Chromium, not WebKit.
  - **Rule 9 ruling:** is the embedded content snapshot OK as a generated build artifact until the feed lands? Playfair's and Minard's reading: yes. Jake asked for context Oct 12 and was told this is only needed when the feed is built. (Jake didn't recognize "Rule 9" by number: say "Single Source of Truth, your rule" when raising it.)
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
  - `lfh-content`: a generated JSON snapshot. Never hand-edit it; `dev/content/embed_content.py` replaces it.
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
  - `node dev/tests/test_engine.js index.html <content.json>`: validation, phase keys, grading, build diagnosis, playtest regressions, 300 rolls × 13 drills, **plus** payout math, save migration, job release and gating, shop rules, and art-to-Items agreement.
  - `python3 dev/tests/play.py index.html`: **the whole loop**, ending with the backup → wipe → restore proof (section 6a). It names the lab, then for every job: inbox, accept, build/answer, paid, celebrate. Funds must equal before + paid. Bounce Lab must stay locked until the gauge is bought. A mid-build reload must resume at point 3. Plus an Archive detour, a reply per job, and a pet appearing in the room. 0 JS errors expected.
- **Content update path until the feed exists:** export the Sheet → `dev/content/export_json.py` → `dev/content/embed_content.py` → `bash dev/check.sh` → upload.
- **Art update path:** edit `dev/art/bake.html` → `python3 dev/art/bake.py` → `python3 dev/art/embed_art.py index.html dev/art/sprites` → `bash dev/check.sh`. Add matching Items rows if there's new art.
