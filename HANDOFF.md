# HANDOFF: Lab for Hire

**Updated:** Nov 10, 2026 · **Game v0.4.1** (engine 0.4.0, content schema 0.3.0, Sheet script 0.1.0) · **Repo baseline commit, tag `v0.4.1`**
**Session names so far:** Playfair (the claude.ai conversation that built everything up to here). The next session picks a new one (rule 7).
**People:** **Jake Wilson**: builder and deployer (GitHub Pages). **Hanson**: 7th-grade science teacher and client; owns content, standards, misconceptions, and student feedback.

This file is the *state of the world*. Rules and commands: `CLAUDE.md`. Why things are the way they are: `docs/DECISIONS.md`. What to build next: `docs/ROADMAP.md`. Setup for Jake: `docs/START-HERE.md`.

## 0. The move to Claude Code (what changed in v0.4.1)
The project moved from a claude.ai conversation into this git repo. **No behavior changed.** The rebuilt `index.html` differs from v0.4.0 in two comment lines only (proved by diff). What changed is the *shape*:
- `index.html` was a 390 KB generated file with everything embedded. It is now built from `src/` by `python3 build.py`. **Edit `src/`, never the generated files** (a hook and `build.py --check` enforce this).
- One command runs every check: `bash dev/check.sh` (6 steps).
- `CLAUDE.md`, `.claude/` (permissions, a guard hook, slash commands), and `docs/` carry the context that used to live in conversation.
- The Python Sheet reader was already retired (Apps Script is the one reader).

## 1. State at a glance
| Thing | State |
|---|---|
| Game (5 live jobs, 3 teasers, lab room, laptop, shop, ledger, Build mode, branching help) | **Built and tested.** Preview: https://claude.ai/artifact/3Dmvj54n6hjBkBSsdE3Egb (built-in content only; claude.ai blocks the live feed) |
| Live Sheet feed (Apps Script, quarantine, safe resume) | **Built and tested against a stand-in. NOT deployed.** `apps-script/INSTALL.md` |
| The live Sheet itself | On the **old v0.2.1 layout**; needs upgrading (`sheet/UPGRADE-LIVE-SHEET.md`). The game correctly refuses it, so students are unaffected |
| Items catalog | **Two competing catalogs. Jake decides.** (1a) |
| Real iPad Safari | **Not tested** |
| Real students | Not yet |

**The live content Sheet:** "Lab for Hire (Claude Controlled)", ID `1M4VycqB1kpXEfEmt8aLGQBWvZVk6S7EiKKyk7Uiwffg`, owned by one of Jake's **tertiary** Google accounts. The Sheets connector attached to Claude is account-wide for that account, so it must never be pointed at an account that owns student data. (An older Sheet, ID `1D2uX2xzW87ykVcJ5uv3lDvwwdxfmvOOefkTN9QDOSqY`, is superseded.)

## 1a. READ FIRST: the open decision (Rule 9)
The room and shop were built in two places at once. This game has a 22-item catalog and a baked 27-layer room. A parallel "lab-space" conversation built a different 39-item catalog, a different slot system, and a different art pipeline, and wrote an `Items` tab and an `Items Legend` tab into the live Sheet. **Its code and art have never been seen by this project.** Two catalogs for one shop violate Rule 9, so one must go. Nothing has been overwritten or merged.

**Recommendation:** adopt the lab-space catalog's data model (starter lab defined in the Sheet, bench items that fit any of 3 spots, split paint, unlock-by-case-type) and keep this game's economy, inbox, shop rules, and storage. That needs Jake to upload that conversation's zip to `incoming/lab-space/`. Options and the merge plan: `docs/ITEMS-CONFLICT.md`.
**Until decided:** nothing breaks (the game refuses the old-layout Sheet and uses its built-in content, and `?preview=1` says why).

## 2. What the game is
A 7th-grade science data-reading game. Students run a "lab for hire". Full detail: `docs/ARCHITECTURE.md`.
- **Five live jobs:** Movin' Molecules (**Build mode**: choose axes, choose a scale, plot, TALK check, certify, then analyze), The Cold Pack Challenge (multi-line graph + cost table; the coldest option isn't the best), Mission to Kestrel-b (real water phase diagram), Fog for Frankenstein (real CO2 phase diagram on a **log** axis), The Winter Bounce Test (text table + bar graph). **Three locked teaser jobs** advertise the year ahead (cells, plant growth, medical design).
- **Branching help** (Hanson: "awesome"; sacred): every wrong option is tagged; Calibration (graph-reading) before Archive (science); Calibration side missions run "Watch one" then "Your turn" on freshly generated graphs; a second miss reveals the answer with the reason; getting help never costs money.
- **The lab:** a baked isometric room (27 layers); the laptop holds Inbox (jobs, locked teasers, client replies), Supply shop (22 items), Training sim (13 skills, unlimited fresh graphs), Ledger. The workbench runs the jobs. Pay rewards evidence quality and finished side missions, never speed.
- **Safe live editing:** a bad case is held back, the rest play; an unreadable or old-layout Sheet is refused (last good copy, then built-in content); a student mid-job keeps their place when content changes; drafts never reach students.
- **Storage:** browser only (`localStorage` via `LFH.store`). No accounts, no student data.

## 3. Verified, and NOT verified
**Verified** (`bash dev/check.sh`): the engine's rules; the Apps Script reader against the real seed workbook (exact parity with the shipped snapshot) and a reconstruction of the live Sheet, including blank rows, reversed or missing columns, held-back cases, caching, expiry, chunking, and the menu; the whole game and every Sheet-to-browser scenario in real Chromium (desktop, 810x1080 iPad portrait, 390 phone, dark mode).
**NOT verified:**
- **Google's real servers.** `getActiveSpreadsheet()` in a web app, `CacheService` gzip round-trips, the authorization prompt, and CORS from GitHub Pages to `script.google.com` were exercised only against a stand-in. **The first deploy is a real test.** If the feed fails, the game silently uses its built-in content, so it never breaks, but it won't show Sheet edits.
- **Real-iPad Safari.** Everything is emulated Chromium.
- **District content filter** may block `script.google.com`; students would keep playing with built-in content.
- Real students.

## 4. What to do next, in order (details: `docs/ROADMAP.md`)
1. **Jake decides the Items catalog** (1a).
2. **Upgrade the live Sheet** to schema 0.3.0 (`sheet/UPGRADE-LIVE-SHEET.md`; every write asks Jake first).
3. **Deploy the feed** (`apps-script/INSTALL.md`), then `python3 build.py --feed-url <the /exec URL>`, and verify on Google's servers.
4. **A real-iPad Safari playthrough** (Jake), and fix what breaks.
5. Save code, sticky graph in portrait, mentor text into the Sheet, teacher release per unit.
6. The investigation loop: job templates (real replay), Plan-the-test, Recommendation (CER), then Build mode for bar graphs and phase diagrams.
7. Content by unit with Hanson (`/new-case`). Later: Firestore (Rules 10 and 11).

## 5. Open items by person
**Jake:** decide Items; say "go" on the Sheet upgrade; deploy the feed (can the tertiary account deploy a web app as "Anyone"? and does the district filter allow `script.google.com` and `*.github.io`?); one real-iPad playthrough; choose a license before publishing the repo publicly; confirm the embedded content snapshot is acceptable under Rule 9 as an *explicit offline cache* of the live feed (my reading: yes; overrule if not).
**Hanson:** play the preview, ideally with a few students; rule on the real-water diagram disagreeing with her worksheet key, on the sample data, and on "dissolves" vs "reacts"; is 7 to 8 questions per case right; which unit first.

## 6. Where things are
`CLAUDE.md` (rules and commands) · `docs/ARCHITECTURE.md` (engine API, Sheet schema, tests) · `docs/DECISIONS.md` (25 decisions, with costs) · `docs/ROADMAP.md` (backlog with acceptance criteria) · `docs/CONTENT-GUIDE.md` (writing cases) · `docs/CLIENT-BRIEF.md` (Hanson's words, verbatim) · `docs/PLAYTEST-LOG.md` · `docs/ITEMS-CONFLICT.md` · `docs/PROVENANCE.md` · `docs/START-HERE.md` · `sheet/` (seed workbook + upgrade runbook) · `apps-script/` (generated script + `INSTALL.md`) · `dev/` (tests and tools) · `incoming/` (drop zone).

## 7. Session log
- **Playfair** (claude.ai): built the game, the lab shell, the Sheet feed; found the seed bug and the Items conflict; moved the project into this repo.
