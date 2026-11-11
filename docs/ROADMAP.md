# Roadmap

Ordered by what unblocks what. Every item lists **acceptance** (how you know it's done) and **test** (what must exist). Rules in `CLAUDE.md` apply to all of it. "Jake decides" items cannot start without him.

## P0: unblock the live game

### P0.1 Decide the Items catalog (Jake decides)
Two incompatible catalogs exist for one shop. See `ITEMS-CONFLICT.md`. Recommendation: adopt the lab-space catalog's data model (Sheet-defined starter lab, flexible bench spots, split paint, unlock-by-case-type), keep this game's economy and shell.
**Acceptance:** one catalog in the Sheet and the engine; the other deleted in the same deploy (Rule 9). **Test:** `validateArt` agrees with the Items tab; the full playthrough buys, places, and unlocks.

### P0.2 Upgrade the live Sheet to schema 0.3.0 (Jake says go)
Runbook: `sheet/UPGRADE-LIVE-SHEET.md`. Needs the Sheets connector with approval on each write.
**Acceptance:** `Lab for Hire > Check my content` says "Everything students will see looks good"; the game with `?preview=1` says "Content: the live Sheet".

### P0.3 Deploy the feed and verify it on Google's real servers
Steps: `apps-script/INSTALL.md`, then `python3 build.py --feed-url <the /exec URL>`.
**Acceptance:** the `/exec` URL returns JSON; the game shows Sheet edits within about a minute; CORS works from the GitHub Pages origin; the district filter doesn't block `script.google.com` (if it does, document the fallback behavior to Jake). Record results in `HANDOFF.md` ("verified" vs "assumed").

### P0.4 One real-iPad Safari playthrough (Jake does it; fix what breaks)
All testing so far is Chromium. Check touch plotting, the room hotspots, the laptop, portrait layout, dark mode.

## P1: make it safe to hand to students

### P1.1 Save code
A lab lives on one device today. **Spec:** a short copyable code (and/or QR) that serializes `P` (funds, owned, placed, cases, history, labName; not `inbox.seq`-style ephemera) with a version and a checksum; "Move my lab" in the Ledger shows it, "I have a code" on the name screen restores it, with a confirm before overwriting. No accounts, no PII (the lab name is from a word builder).
**Acceptance:** round trip on two browser profiles; a corrupted or v-mismatched code is rejected with a plain message; restore runs through `LFH.migrate` and `LFH.sanitizeProgress`. **Test:** engine round-trip tests including a v1 save; a Playwright two-context test.

### P1.2 Sticky graph in portrait
In portrait the graph stacks above the question and scrolls away. **Spec:** pin the visual (collapsible) while answering. **Acceptance:** at 810x1080 and 390x844 the graph stays visible or one tap away while the options are on screen.

### P1.3 Move the mentor's welcome text into the Sheet
It lives in `mailBody` (`src/app.js`). Add a `Messages` tab (`MessageID`, `Subject`, `Body`, `Show when`) so Hanson can edit it. Needs a schema bump to 0.4 and a Sheet migration (ask Jake).

### P1.4 Teacher release per unit
Jobs release by path order today. **Spec:** an optional `Release` column (a date or "when Hanson says") and a class-wide "featured job". Keep the quarantine and schema-gate guarantees.

## P2: the investigation loop (Hanson's instructional priority)

These three together are her "plan, analyze, recommend" idea. Build them on one case first (Cold Pack, her own example).

### P2.1 Job templates (real replay)
A repeat of a job should present *new requirements or new data*. **Spec:** a case may declare a data model (e.g., substance temperature curves from a few parameters) and requirement variants (budget, target temperature); each play samples fresh values and the questions' answer keys are *computed*, not stored. Pay: same data 25%; fresh data in full.
**Acceptance:** two plays of one job never repeat an answer key; every generated key is checked by the same function that draws the graph (as `phaseModel` does). **Test:** 300 rolls per template (one correct answer, no duplicates, believable numbers), like the drills.

### P2.2 "Plan the test" stage
Before data appears, the student chooses what to change, what to keep the same, and how many trials. Reuse the branching engine with new tags: changed two things at once, nothing to compare against, one trial. Optional twist: each test costs lab funds, so a sloppy plan wastes budget but is never fatal.
**Acceptance:** each planning mistake routes to a side mission; a good plan unlocks the data. Authoring is Sheet-driven.

### P2.3 Recommendation (CER) stage
End every job with a recommendation the client pays for: pick the claim, the evidence (pick two), and the reasoning. Not auto-graded prose; structured choices. Client replies in character, and a weak recommendation earns partial pay plus a **follow-up job** (a story-shaped "new data" replay).
**Acceptance:** the reply email reflects the recommendation quality; a follow-up job appears in the inbox.

### P2.4 Build mode for more visuals
Only line graphs are buildable. Add bar graphs (choose categories, scale, draw bars) and phase diagrams (plot the boundary points, label the regions, as Lesson 5 does).

## P3: content (Hanson's lane, with Claude Code's help)

- Cases for each upcoming unit (`CLIENT-BRIEF.md` table). Use `/new-case`. Each unlocks via equipment (a `Requires item` or case type, per P0.1).
- More Archive reteaches and Check questions per misconception (3 or more per tag so repeats don't feel scripted).
- Real-data cases where real data exist (log axes, multi-series).

## P4: later

- **Firestore** (Jake wants it after the game works): progress through `LFH.store` only; reuse TypeThatBook's COPPA and Tennessee privacy work; a teacher dashboard triggers Rule 11 (both views read the same record via proven-identical readers) and Rule 10 (a harness on real data first).
- A teacher "class view" without accounts (e.g., the save code plus an optional anonymous class code). Needs a privacy review before anything is stored.
- Accessibility pass: screen-reader labels for SVG graphs (data tables as alternatives), keyboard-only play throughout, reduced-motion audit.
- Rename `LFH.drillNames` strings and tag titles with Hanson's reading-level feedback.
