# HANDOFF: Lab for Hire

**Updated:** Nov 12, 2026 · **Game v0.6.0** (engine 0.6.0, room module 0.4.0, content schema 0.5.0, **Sheet script 0.2.0**)
**Session names so far:** Playfair (v0.1 to v0.3, and the v0.4.1 feed and repo work), Hooke (the lab-space room), Minard (save file and Cold Pack template), **Nightingale** (this session: merged all three). The next session picks a new one.
**People:** **Jake Wilson**: builder and deployer (GitHub Pages serves `main`). **Hanson**: 7th-grade science teacher and client; owns content, standards, misconceptions, and student feedback.

This file is the state of the world. Rules and commands: `CLAUDE.md`. Why things are the way they are: `docs/DECISIONS.md`. What to build next: `docs/ROADMAP.md`. The live Sheet: `sheet/README.md`.

## 1. What happened this session (v0.6.0): three projects became one
Before Nov 11 there were three half-finished copies, and no single one had all the work:
- **GitHub `main`** (v0.5.0, Minard): Cold Pack job template and the Drive save file, but no connection to the Sheet.
- **A zip from the claude.ai conversation** (labelled v0.4.1, Playfair): the Sheet feed, quarantine, `src/` layout, docs and guard rails, but none of v0.5.0.
- **`lab-space/`** (v0.3.0, Hooke): a better room and a 50-item catalog, never merged into either game.

They are now one game, by a three-way merge from the shared v0.3.0 ancestor. Nothing was dropped on purpose. What changed:
- **Game lines merged.** Template jobs (Cold Pack) go through quarantine and safe resume like Sheet cases; a save file loaded from Drive is sanitized against today's content.
- **One lab, one store** (this closed the old "Items catalog conflict"). The lab-space room replaced the game's old room, shop, and art. `src/lab.js` draws it; the rules live in the engine as `LFH.lab`. Progress is v3: one `lab` record, and money lives only in `progress.funds`. Old saves migrate.
- **New art:** a laptop on the desk and a pressure gauge, in the same style. Tapping the laptop in the room opens it; tapping the desk, the chair, or anything on the desk goes to the workbench.
- **The framed "Your Graph" award** is earned by finishing a Build-mode job, and shows the student's own points.
- **Content schema 0.5.0.** Items: Kind is Equipment, Cosmetic, Theme, or Award; Slot is a kind of spot; Rank required is a rank *name*; **Unlocks is a short note students read** ("cell cases"), and a case names the equipment it needs in Cases > Requires item.
- **Tests combined and extended.** `bash dev/check.sh` (six steps) and `python3 dev/art/overlay_check.py` all pass.

## 1a. Nov 12: one tab per case (built; waiting on Jake to install it)
Hanson found the old Sheet hard to approach, and Jake's read was that the tab-to-tab workflow was the problem. So the Sheet is now **one tab per case, filled top to bottom, with no IDs to type**:
- `sheet/LabForHire_Content_v0.6.0.xlsx` is the new workbook: Start Here (six steps), a tab for each of the 8 cases, **New case template**, **Practice questions**, SideMissions, Items, and a hidden Lists tab. Made from the row-layout fixture by `dev/content/make_case_tabs.py`.
- The Sheet's script (v0.2.0) finds case tabs by itself: any tab whose top-left cell says `CASE` is a case; `CHECKS` marks practice questions; `CASE TEMPLATE` is ignored. It still reads the old row tabs if they exist, so both layouts work.
- Menu **Lab for Hire > New case** copies the template, asks for a title, and fills in the Case ID, Draft status, and the next Order number. It is the only thing the script writes.
- **Check my content** now reports problems by tab, question, choice, and row.
- The Mistake dropdown shows plain words ("Graph: read the wrong point | CAL-POINT"); the descriptions live in the last column of SideMissions.
- **Proof** (`dev/tests/test_tabs.js`, 56 checks, part of `bash dev/check.sh`): the script reads the case-tab workbook to exactly the same cases, graphs, data, tables, questions, and answer choices as the row workbook; the game's built-in copy is that content; two deliberate breaks of the reader were confirmed to fail the tests.
- **To install (Jake):** paste the complete `apps-script/LabForHire.gs` over the script in the Sheet and deploy a **new version** (Deploy > Manage deployments > pencil > Version: New version; the address stays the same), THEN import the workbook (File > Import > Upload > Replace spreadsheet). Script first: the new script reads either layout, the old one cannot read the new workbook.
- **Installed by Jake and VERIFIED ON GOOGLE'S REAL SERVERS (Nov 12):** the live feed reports schema 0.5.0, no errors, no warnings; all eight sections are identical to the game's built-in copy; the game's own acceptance check passes with nothing held back; the dropdown lists match the game's vocabulary. Repeat any time with `node dev/content/check_live.js` (the environment's network must allow `script.google.com` and `script.googleusercontent.com`).
- **Not verified:** with Hanson (whether she finds it approachable is the real test); *New case* and *Check my content* clicked on the real Sheet; the game in a browser showing "Content: the live Sheet".

## 2. State at a glance
| Thing | State |
|---|---|
| Game (5 live jobs, 3 teasers, room, laptop, store, storage, paint, awards, Build mode, branching help, Cold Pack template, save file) | **Built; every check passes** |
| Live Sheet content | **One tab per case (workbook v0.6.0), imported by Jake on Nov 12 and verified through the feed** |
| Apps Script feed | **Live and verified on Google's servers (Nov 12)**: `node dev/content/check_live.js` shows it identical to the built-in copy. Not yet checked: the district filter on student iPads |
| Real iPad Safari | **Not tested** |
| Real students | Not yet. Development only until Hanson is comfortable (Jake, Nov 11) |

## 3. History: the Nov 11 connector rebuild (superseded on Nov 12 by a file import; nothing left to do here)
The live Sheet ("Lab for Hire (Claude Controlled)", ID `1M4VycqB1kpXEfEmt8aLGQBWvZVk6S7EiKKyk7Uiwffg`) was rebuilt in place to match the row-layout workbook (v0.5.0, now `dev/tests/fixtures/LabForHire_rows_v0.5.0.xlsx`). Every tab was written, and the old tabs are kept as hidden copies named "old ... (before Nov 11 rebuild)". **Work stopped before verification** because every write needed a manual approval click (Jake's organization disables "Always allow" for connectors in this product), and Jake asked to pause.

Still to do, in order (about four Sheet calls):
1. **Verify** every row against the seed (the checksum method in `sheet/README.md`). Until this passes, treat the Sheet as *probably* right, not proven.
2. Delete the hidden scratch tab `zz_check`.
3. Optional tidy: header notes, and dropdowns on any column that lacks them.
4. Then Jake pastes the script (`apps-script/INSTALL.md`), and the real proof runs: **Lab for Hire > Check my content** in the Sheet, then `python3 build.py --feed-url <the /exec URL>` and `?preview=1`.

## 4. Hanson and approachability (background to section 1a; the design below is now built)
Hanson found the whole thing hard to approach when she and Jake met. Jake's read (Nov 11): the hard part is **the workflow across all the tabs**. One question means rows in Questions and Options, linked by IDs to Cases, Visuals, Data, and SideMissions.

**Proposed, not built, and not yet agreed:** one tab per case. She duplicates a template tab and fills it top to bottom: the client and pitch, the data table, then each question with its answer choices and the mistake each wrong choice reveals. No IDs to type, nothing to cross-reference. SideMissions and Items stay as shared tabs. Only the Sheet's reader (`src/sheet-script.gs`) would change; the game would not. Until then: she hands over raw material in any form, Claude drafts the case (`/new-case`), and she reviews it in preview with yes/no answers.

## 5. Verified, and NOT verified
**Verified** (`bash dev/check.sh`): the engine's rules (including 2,000 generated Cold Pack jobs checked against their own graphs, the lab rules, and save migration); the Apps Script reader against the real seed workbook and a reconstruction of the Sheet as it was found; the whole game start to finish in Chromium, including the store, storage, paint, the award, backup and restore; seven Sheet-to-browser scenarios. The room art matches a true 3D render (starter lab: no wrong pixels beyond 1-pixel outlines).
**NOT verified:**
- **Real-iPad Safari**, including the share sheet and Drive picker for the save file, and the color picker for Any Color paint.
- Whether the district filter allows `script.google.com` and `*.github.io`.
- Real students. Whether 11 items on the first Cold Pack play fits 15 minutes.

## 6. Known gaps (honest list)
- `docs/ARCHITECTURE.md` was updated at the top for v0.6.0 but its body still describes parts of v0.4.1 in places. Trust the code and this file where they differ.
- The game is now about 1.4 MB (the room art is inside the page). Fine on school Wi-Fi; worth knowing.
- On the home screen the room is small on a laptop-sized window; the gap under the desk is not tappable (the desk top, chair, and items are).
- The pet no longer hops when a job is finished; a message says what the pet thinks instead.
- Old v2 saves keep their money and any items that still exist, but their room is laid out fresh. No students have saves yet.
- The mentor's welcome email still lives in code, not the Sheet. Teacher release per unit is not built. Non-template jobs still replay the same data at 25% pay.

## 7. Open items by person
**Jake:**
- Fix or work around the approval prompts before the next Sheet session (ask the organization admin about "Always allow" for connectors, or expect about four clicks).
- Paste the script into the Sheet and deploy it (`apps-script/INSTALL.md`, about ten minutes), then send the `/exec` URL.
- One real-iPad Safari playthrough, including *Save my lab* to Drive.
- Decide whether to pursue the one-tab-per-case layout (section 4), ideally with Hanson looking at a mock-up.
- Choose a license before making the repo public.
**Hanson:** play the preview; rule on the real-water diagram disagreeing with her worksheet key, the sample data, and "dissolves" vs "reacts"; say whether the plan questions match how she teaches fair tests; pick which unit comes first; say when the framed graph should be earned (today: finishing any Build-mode job).

## 8. Where things are
`CLAUDE.md` (rules and commands) · `docs/ARCHITECTURE.md` · `docs/DECISIONS.md` · `docs/ROADMAP.md` · `docs/CONTENT-GUIDE.md` · `docs/CLIENT-BRIEF.md` (Hanson's words) · `docs/PLAYTEST-LOG.md` · `docs/PROVENANCE.md` · `sheet/` (seed workbook and the live Sheet's status) · `apps-script/` (generated script and `INSTALL.md`) · `src/` (the sources) · `dev/` (tests, the art bake, tools) · `incoming/` (drop zone).

## 9. Session log
- **Playfair** (claude.ai): built the game through v0.3.0; later the Sheet feed and the repo layout (v0.4.1).
- **Hooke** (claude.ai): the lab-space room, catalog, and art bake (v0.3.0 of that module).
- **Minard** (claude.ai): save file (v0.4.0) and the Cold Pack job template (v0.5.0).
- **Nightingale** (Claude Code, Nov 11, 2026): found the three-way fork; merged it into v0.6.0; added the laptop and pressure gauge; rebuilt the live Sheet's content (verification pending).
