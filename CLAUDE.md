# Lab for Hire: project brief for Claude Code

A game that teaches 7th graders to read tables, graphs, and phase diagrams. Students run a "lab for hire": clients email jobs, students do the science at a workbench, get paid, and spend the money on a lab that is theirs. Built for Hanson's science classes at Jake Wilson's school (Sumner County, TN; students are on 1:1 iPads). One static page on GitHub Pages, content in a Google Sheet, no accounts, no student data.

It began in three claude.ai conversations that were merged into this repo in Nov 2026 (v0.6.0). Everything you need to continue is in this repo. GitHub Pages serves `main`; the project is development-only until Hanson is comfortable, so pushing to `main` is fine for now (Jake, Nov 11, 2026).

**Read first:** `HANDOFF.md` (where things stand, what is unfinished, decisions waiting on Jake). Read `docs/ARCHITECTURE.md` and `docs/DECISIONS.md` before changing design. `sheet/README.md` is the live Sheet's status.

## Commands
```
bash dev/setup.sh                  one-time: node, python3, openpyxl, playwright + Chromium
python3 build.py                   rebuild generated files after editing anything in src/
bash dev/check.sh                  ALL six checks (run before every commit; takes ~2 minutes)
python3 build.py --feed-url URL    point the game at the live Sheet's Apps Script (empty string turns it off)
```
Open `index.html` directly in a browser to play. Add `?preview=1` to release every job, show drafts, and show where the content came from.

## Edit vs generated (this matters most)
| Edit these (sources of truth) | Never hand-edit (generated) | How to change it |
|---|---|---|
| `src/shell.html` `src/engine.js` `src/lab.js` `src/app.js` | `index.html` | `python3 build.py` |
| `src/sheet-script.gs` | `apps-script/LabForHire.gs` (contains a copy of the engine) | `python3 build.py` |
| `src/config.json` (feed address) | | `python3 build.py --feed-url URL` |
| | `src/content.json` (offline copy of the Sheet) | `python3 dev/content/embed_content.py <feed URL>` |
| | `src/art.json` (baked room art) | edit `dev/art/scene.js` (or the Items tab), then `bash dev/art/setup.sh` once, `python3 dev/art/bake.py`, `python3 build.py`, and `python3 dev/art/overlay_check.py` |

A hook in `.claude/` blocks Edit/Write on generated files, and `python3 build.py --check` (step 1 of `dev/check.sh`) catches a hand edit made any other way. **Whenever you change `src/engine.js`, run `python3 build.py`**: the Sheet's script contains a copy of the engine, and the two must never drift.

## Where things live
- `src/engine.js`: all game logic, pure and Node-testable (`LFH.*`): content model, graphs math, phase model, grading, validation, quarantine, the content chooser, economy, drills.
- `src/lab.js`: draws the room and the store (`LabRoom.mount`). UI only: the lab's rules are `LFH.lab` in the engine.
- `src/app.js`: UI only (SVG rendering, screens, events). It must not hold game rules.
- `src/sheet-script.gs`: the Google Sheet side (menu, reader, feed).
- `sheet/`: the seed workbook (the test fixture and reference copy) and the live Sheet's status. `docs/`: design docs. `dev/`: tests and tools. `incoming/`: drop zone for files from outside (see its README).

## Jake's standing rules (non-negotiable)
1. Coding sessions end with an updated **HANDOFF.md and README.md**.
2. **Bug reports:** if a report doesn't match the code, stop and ask Jake. Don't chase theories. After 1 to 2 files without a clean explanation, stop speculating and ask.
3. **Version bumps** on every shipped file: patch and minor are automatic; **a major bump needs Jake's explicit sign-off.**
4. **Never retain student-identifying data** from school projects. There is none in this project; keep it that way (no names, emails, IDs, or free-text from students, anywhere).
5. When Jake must hand-deploy something (e.g. paste into Apps Script), give the **complete file**, never a diff or patch.
6. For substantial work, **work incrementally on disk with a syntax check between edits.**
7. In a long session, once there's enough context, **pick a fun, lighthearted name for yourself**, never one a predecessor used, and log it in HANDOFF.md. Used so far: **Playfair, Hooke, Minard, Nightingale**.
8. If asked to add ads to any project, **lead with theatrical (non-profane) disapproval** before helping.
9. **Single Source of Truth.** Adding a second record of an existing quantity requires deleting the first in the same deploy. If the first can't be deleted, ship work on the blocker instead. **Say out loud when a request would break this, and ask Jake to explicitly overrule it.** (Examples: funds live only in `progress.funds`, never in the lab record; there is one item catalog, the Sheet's Items tab.)
10. **Prove it on real data first.** No number becomes authoritative until a harness fails against real production data before the fix and passes after. Synthetic-only suites are not enough. Flag it when a request would break this.
11. **The two numbers match.** Where a user-facing view and an admin/teacher view show the same quantity, both read the same record through readers proven identical, with a harness asserting agreement (including timezone and week-boundary edges). If you can't demonstrate agreement, say so plainly and treat it as the blocker. (Relevant when a teacher dashboard arrives.)

## Things the game guarantees (don't break them; each has a test)
- **No timer, ever.** Speed is never rewarded. Pay rewards evidence quality and finished side missions (`LFH.payout`).
- **Branching help is the heart of the design.** Every wrong option carries an error tag; Calibration (graph-reading, practiced on freshly generated graphs: "Watch one", then "Your turn") comes before Archive (science, teacher-written reteach + check question). A second miss reveals the answer with the reason. Getting help never costs money.
- **One bad case never freezes the rest.** `LFH.quarantine` holds back a case with any error; everything else plays. An unreadable feed, or a Sheet whose declared schema differs from the game's, is refused and the game falls back (last good copy, then built-in content). A Sheet on an old layout must never make jobs pay $0 or empty the store.
- **Students keep their place** when content changes mid-job (`LFH.reconcileJob`, `LFH.sanitizeProgress`). Drafts never reach students.
- **The lab is one record, and it is always drawable.** `LFH.lab.normalize` repairs any saved lab against today's Items tab; one of each item; whatever is owned but not out is in storage; money lives only in `progress.funds`.
- **Template jobs** (Cold Pack) are generated by the engine (`LFH.TEMPLATES`, `LFH.instance`); a harness checks thousands of generated jobs against their own graphs.
- **All storage goes through `LFH.store`** (`load`, `save`, `cacheGet`, `cachePut`). Nothing else touches `localStorage`, so Firestore can replace it later without other changes.
- **One state function paints and checks the phase diagram** (`LFH.phaseModel`), so a drawn region can never disagree with an answer key.

## Content and pedagogy rules (each one came from a real playtest)
- A question must **never be answerable by copying a value the student just plotted** (Build mode asks about unmeasured points: read backward, or interpolate).
- A question must be answerable **from its visual**, or be explicitly *about* what the visual can't show.
- Side-mission explanations are **statements, never questions**. Teach before asking ("Watch one").
- "Greatest change" must account for rate: steepness, not raw difference. Distractors should be real misconceptions, each tagged.
- Every generated value must be **physically believable** (each drill context carries allowed trends, realistic steps, and ceilings).
- Never reuse state-test items or STEMscopes worksheet items (copyright, and test security). Write original questions; use sources as a skill and misconception blueprint only.
Full detail: `docs/CONTENT-GUIDE.md`.

## Platform and quality constraints
- **iPad Safari first.** Don't use `color-mix()` (old iPadOS silently drops every gridline). Buttons use `touch-action: manipulation`. Test at 1366x768, 810x1080, 390 wide, and dark mode. Real-iPad Safari is **not yet tested**.
- Colors are tokens redefined for dark mode. Never encode meaning in color alone (markers and dashes differ too). Respect `prefers-reduced-motion`.
- One self-contained HTML file (no build tooling for students); Google Fonts are optional with fallbacks.
- The Sheet script cannot be run on Google's servers from here. It is tested against a stand-in (`dev/tests/gas_mock.js`), so **the first live deploy is a real test** (see HANDOFF section 5).

## Google Sheet safety
- The content Sheet is "Lab for Hire (Claude Controlled)", owned by a **tertiary Google account**. The Sheets connector is account-wide for whatever account it connects, so it must never be pointed at an account that owns student-data sheets (Skyward attendance, faculty directory, etc.).
- Jake gave standing permission for Sheet edits on Nov 11, 2026, so `.claude/settings.json` allows the Sheet tools. His organization still makes every connector write ask for a click, so **for bulk changes build an `.xlsx` for him to import (File > Import > Replace spreadsheet) instead of many connector calls**. Back up before restructuring (duplicate the tab), and verify afterwards (`sheet/README.md`).
- The feed is public and contains no student data. Keep it that way.

## How to work
- Prefer small, verified steps. After each change: `python3 build.py` (if you touched src/) and the relevant test; before a commit: `bash dev/check.sh`.
- When you add behavior, add the test that would have caught its absence, against real data where possible (the seed workbook, the reconstruction of the live Sheet in `dev/tests/fixtures/`).
- Version bumps live in the `<!-- Lab for Hire vX.Y.Z -->` comment in `src/shell.html` (game), `LFH.version` in `src/engine.js` (engine), the app comment in `src/app.js`, `VERSION` in `src/lab.js`, and `LFH.SCHEMA` (content schema; bumping it means a Sheet migration, so ask Jake).
- Update `HANDOFF.md` and `README.md` at the end of every session (rule 1). Keep this file short; put detail in `docs/`.
