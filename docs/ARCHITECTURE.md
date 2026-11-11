# Architecture

How Lab for Hire fits together, and where to change what. Pair with `DECISIONS.md` (why) and `CONTENT-GUIDE.md` (what good content looks like).

## The big picture

```
  Google Sheet (source of truth for content)
        |  Apps Script bound to the Sheet (src/sheet-script.gs + a copy of the engine)
        |    reads by HEADER NAME, serves JSON, caches 60s, adds the "Lab for Hire" menu
        v
  GET https://script.google.com/macros/s/.../exec        students' feed = Live + Teaser cases
                                    ...?include=draft    preview feed (adds Drafts)
        |
        v
  index.html in the student's browser (GitHub Pages)
     LFH.content.choose():  recent saved copy -> live feed -> last good saved copy -> built-in snapshot
     LFH.prepare():         quarantine bad cases, skip bad items/tags, fit shop to the baked art
     progress (funds, items, stars, saved job) lives in this browser only: localStorage via LFH.store
```

Nothing is sent back to any server. There are no accounts and no student data.

## Build pipeline

`python3 build.py` assembles two generated outputs from `src/`:
- `index.html` = `src/shell.html` with markers replaced by `src/engine.js`, `src/app.js`, `src/content.json`, `src/art.json`, `src/config.json`.
- `apps-script/LabForHire.gs` = **the same `src/engine.js`** + `src/sheet-script.gs`. The Sheet therefore validates content with exactly the rules the game uses (one copy of the rules: Rule 9). `python3 build.py --check` fails if either is stale.

`src/content.json` is an offline cache of the Sheet (refresh with `dev/content/embed_content.py <feed URL>`). `src/art.json` is the baked room (produced by `dev/art/`).

## The Sheet (schema 0.3.0)

**Cases** (columns: `CaseID`, `Status`, `Path order`, `Title`, `Client`, `Client pitch (students read this first)`, `Win message`, `Requires item`, `Pay`, `Standard`, `Teacher notes`)
: One row per job: a client with a problem. Status: Live (students), Teaser (a locked advertisement), Draft (hidden). Path order sets release order. `Requires item` (an ItemID) gates the job behind equipment; `Pay` is the top fee in funds.

**Items** (columns: `ItemID`, `Name`, `Slot`, `Price`, `Kind`, `Unlocks`, `Rank required`, `Sprite`, `Description`)
: The shop: one row per thing students can buy. Slot decides where it sits in the room; Kind decides the shop section; `Unlocks` is the CaseID it advertises (the case's `Requires item` must point back).

**Visuals** (columns: `VisualID`, `CaseID`, `Tab label`, `Type`, `Title`, `Student builds it?`, `X label`, `X unit`, `X min`, `X max`, `X step`, `X scale`, `Y label`, `Y unit`, `Y min`, `Y max`, `Y step`, `Y scale`, `Notes`)
: The graphs and tables for each case. `Student builds it?` = Yes (line graphs only) turns on Build mode. X/Y min, max, step set the gridlines; `Log` scale gives a decade axis.

**Data** (columns: `VisualID`, `Series`, `X`, `Y`, `Point label`, `Notes`)
: One row per plotted point. Line graph: one Series name per line. Bar graph: Series is the bar's label. Phase diagram: Series must be Melting line, Boiling line, or Sublimation line.

**Tables** (columns: `VisualID`, `Row`, `Col 1`, `Col 2`, `Col 3`, `Col 4`, `Col 5`, `Col 6`)
: The cells of each data table (Row 0 = header). Text is fine ('Slow', '?', '$0.85').

**Questions** (columns: `QID`, `CaseID`, `Order`, `Role`, `Check for tag`, `Skill`, `Type`, `Shows visual(s)`, `Prompt`, `Why it's right (shown after a correct answer)`)
: One row per question. Role Main = part of a case; Check = the fresh question after an Archive side mission (blank CaseID = usable from any case; `Check for tag` says which tag it re-tests). `Shows visual(s)` pins specific visuals (comma-separated; blank = all of the case's).

**Options** (columns: `QID`, `Letter`, `Option text`, `Correct?`, `Error tag`)
: One row per answer choice. Correct? = Yes marks right answers. EVERY wrong option needs an Error tag: the tag decides the side mission. On a Select-all question a tag on a correct option means 'if missed, send them here'.

**SideMissions** (columns: `TagID`, `Kind`, `Mission title (students see)`, `Explanation (students see)`, `Teacher note (what this error means)`, `Drill (Calibration only)`)
: One row per error tag. Kind Calibration (graph-reading; needs a Drill the game can generate) or Archive (science; needs at least one Check question).

**Lists** (columns: `Status`, `VisualType`, `QuestionType`, `Role`, `Skill`, `Kind`, `Drill`, `Correct`, `Build`, `AxisScale`, `PhaseSeries`, `ItemKind`, `Rank`)
: The dropdown vocabularies. The GAME is the authority (`LFH.vocab()`); 'Check my content' warns when this tab disagrees.

**Start Here** (columns: free text)
: Teacher-facing guide. Line 1 declares the schema version the game checks (`Schema version 0.3.0`).


The game reads the Sheet only through the feed. The reader matches columns by header name (so inserted or reordered columns are fine), skips blank rows, and tolerates a missing `Pay` or `Requires item` column (with a warning). A Sheet whose `Start Here` line 1 declares a different schema than the game's is **refused** (`LFH.content.judge`). Required dropdowns in the seed workbook are listed in `sheet/UPGRADE-LIVE-SHEET.md`.

### Error tags in the seed (25)

| Tag | Kind | Title students see | What the error means (teacher note) | Drill |
|---|---|---|---|---|
| `CAL-SCALE` | Calibration | Scale Drift Detected | Misread the axis interval, or snapped a between-gridline point to the nearest line. | `scale-read` |
| `CAL-AXIS` | Calibration | Crossed Wires | Answered with the x-value when the y-value was asked (or the reverse). | `axis-read` |
| `CAL-AXIS-CHOICE` | Calibration | Which Variable Goes Where | Put the measured (dependent) variable on the x-axis. Lesson 5, Step 1. | `variable-placement` |
| `CAL-POINT` | Calibration | Wrong Target | Read a neighboring data point instead of the requested one. | `point-find` |
| `CAL-SPACING` | Calibration | Uneven Ground | Judged the size of a change by how long the segment is; ignored uneven x-intervals. Also fires when plotting uneven data at even spacing. | `uneven-spacing` |
| `CAL-TREND` | Calibration | Zoom Out | Misdescribed the overall direction, or let one segment override the whole pattern. | `trend-read` |
| `CAL-PREDICT` | Calibration | Follow the Path | Extrapolated from the wrong part of the curve (e.g., used the early steep slope). | `extrapolate` |
| `CAL-REGION` | Calibration | Lost the Map | Located the (T, P) point in the wrong region. | `phase-region` |
| `CAL-TRACE` | Calibration | Retrace the Route | Traced a change in the wrong direction, or missed crossing a boundary. | `phase-trace` |
| `CAL-LOG` | Calibration | The Stretchy Ruler | Read a log axis as if it were evenly spaced. Tested on the unit test's nitrogen diagram; not practiced in Lesson 5. | `log-read` |
| `CAL-TABLE` | Calibration | Row and Column Check | Read the wrong row or the wrong column of a data table. | `table-read` |
| `CAL-SERIES` | Calibration | Wrong Line | Read a value or trend from the wrong data series on a multi-line graph. | `series-read` |
| `CAL-SCALE-CHOICE` | Calibration | Blueprint Check | Chose a scale that cuts off data, uses unequal intervals, or squashes the data (Lesson 5, Step 2). | `scale-choose` |
| `SCI-KE-TEMP` | Archive | Temperature Is the Speedometer | Hanson's named misconception: picking the highest-pressure point for greatest kinetic energy. |  |
| `SCI-MOTION-STATES` | Archive | Know Your States | Read the phase correctly but matched it to the wrong particle motion (Hanson's second named misconception). |  |
| `SCI-PARTICLES-STOP` | Archive | Particles Never Clock Out | Believes frozen, cold, or high-pressure particles stop moving. |  |
| `SCI-SPEED-TEMP` | Archive | Heat Speeds Things Up | Believes particle speed plateaus or reverses as temperature rises. |  |
| `SCI-GRAPH-PURPOSE` | Archive | Right Tool for the Job | Lesson 5's central idea: different graphs answer different questions. |  |
| `SCI-EVIDENCE` | Archive | Evidence Check | Chose true-but-irrelevant statements as evidence, or missed valid evidence. Supports CER writing. |  |
| `SCI-PARTICLES-CHANGE` | Archive | Same Particles, New Moves | Believes particles themselves grow, shrink, gain mass, break apart, or are destroyed (unit test distractor pattern). |  |
| `SCI-PRESSURE-SOURCE` | Archive | Tiny Collisions | Attributes pressure to the weight of gas, suction, or air sneaking in (unit test distractor pattern). |  |
| `SCI-COMPRESS` | Archive | Mind the Gap | Explains compressibility by weight or particle size instead of spacing. |  |
| `SCI-PARTICLE-MODEL` | Archive | Think Particles | Gave a non-particle explanation (rubber got stiff, can got weak). These are tempting because they sound plausible. |  |
| `SCI-ENDO-EXO` | Archive | Follow the Energy | Believes 'cold' is transferred, or reverses the direction of thermal energy flow. |  |
| `SCI-PHASE-NAMES` | Archive | Name That Change | Mixed up phase-change vocabulary or melting point vs. boiling point. |  |

## The feed (JSON)

`schema`, `sheetSchema`, `generated` (ISO time), `source`, `draft`, then `cases`, `items`, `visuals` (with `x`/`y` axis objects), `data`, `tables`, `questions`, `options`, `tags`, `lists`, and the reader's own `errors` (blocking) and `warnings`. The built-in snapshot has the same shape minus the diagnostics.

## Engine (`src/engine.js`, `LFH.*`): public surface

| Area | Functions |
|---|---|
| Content model | `load(C)` (indexes cases, visuals, questions, options, tags), `spec(C, v)` |
| Axes and geometry | `isLog`, `toUnit`, `fromUnit`, `ticks` (linear and log; log ticks carry minor lines) |
| Phase diagrams | `phaseModel(spec)` returns `{ state(T, P) }`. It both paints the regions and is what tests check answer keys against. |
| Grading | `required(type)`, `grade(options, selected, tags)` returns `{ correct, tags }` with Calibration tags ordered before Archive |
| Validation | `validateDetailed(C)` (every problem tagged with its `caseId` and a level), `validate(C)`, `validateArt(C, ART)`, `vocab()`, `checkLists(lists)` |
| Quarantine | `quarantine(C)` returns `{ C, held, warnings, errors }`; `dropCases`; `fitToArt(C, ART)`; `prepare(C, ART)` (all three) |
| Content selection | `content.choose(deps)` (pure; fetch and storage injected), `content.judge`, `content.url`, `SCHEMA`, `schemaOk` |
| Build mode | `buildAxisOptions`, `buildScaleOptions`, `buildReveal`, `snapUnits`, `checkPlot` (diagnoses equal-spacing, scale, and point errors) |
| Drills | `drills` (13 generators), `makeDrill(id)` (re-rolls bad draws: duplicates, NaN, unbelievable values), `drillNames` |
| Business | `RANKS`, `rankOf`, `nextRank`, `rankIndex`, `rep`, `payout`, `jobs`, `shopState`, `buy`, `SLOT_NEEDS` |
| Progress | `freshProgress`, `migrate` (v1 to v2), `sanitizeProgress`, `reconcileJob` |
| Utilities | `util` (seeded-capable random helpers, `fmt`, `withUnit`), `rng` |

The 13 drills: `scale-read axis-read point-find uneven-spacing trend-read extrapolate phase-region phase-trace log-read table-read series-read variable-placement scale-choose`. Each drill context carries its allowed trend directions, realistic gridline steps, and a ceiling; `makeDrill` rejects anything unbelievable.

## App (`src/app.js`)

- **Boot:** read `src/` blobs from the page, `LFH.content.choose(...)`, then `start(CONTENT)`.
- **State:** one object `S` (`screen`, `caseId`, `qi`, `sel`, `fb`, `mission`, `build`, ...). `go(patch)` merges and re-renders; `render()` picks a screen function. Events are delegated from `#app` by `data-*` attributes (`data-act`, `data-opt`, `data-mail`, `data-buy`, `data-bay`, ...).
- **Screens:** `name` (lab-name word builder), `room` (home), `laptop` (Inbox / Supply shop / Training sim / Ledger), `bench` (empty bench), `intro`, `build`, `question`, `mission` (Watch one, then Your turn), `report`, `bay` (free practice).
- **The room:** 27 baked PNG layers positioned by a manifest and stacked in fixed slot order (back to front). Equipment slots show faded "ghost" layers with price tags in Decorate mode. Hotspots sit over the laptop and bench.
- **A job** (case): optional Build mode (axes, scale, plot, TALK check, certify), then questions. Autosaved to `P.activeJob` on every render of a job screen and resumed through `LFH.reconcileJob`.
- **Storage:** `LFH.store` (`load`, `save`, `cacheGet`, `cachePut`) is the only code that touches `localStorage`.

### Progress object (`lfh.progress`, v2)

`{ v: 2, labName, funds, owned: {itemId: true}, placed: {slot: itemId}, cases: {caseId: {best, stars, plays, done}}, bayCorrect, bayBest, inbox: {read, arrived, seq}, history: [{caseId, stars, pay, missions, replay}], activeJob }`. `migrate` upgrades v1; `sanitizeProgress` repairs it against current content.

## Economy and scoring

- Per question: **3** points on the first try, **2** after a side mission, **1** if the answer had to be shown. Stars: 3 at 85% of points or more, 2 at 60% or more, else 1.
- **Pay** (`LFH.payout`): `round5(pay * (0.4 + 0.6 * points/max)) + $5 per side mission`; a repeat of a finished job pays 25%. Rough work still earns at least 40%.
- **Reputation** (`LFH.rep`) = best points per case + correct Training-sim answers. It is never spent and drives rank (Lab Intern 0, Lab Tech 25, Data Analyst 60, Senior Scientist 110, Lab Director 170).
- **Funds** are earned from jobs and spent in the shop. Equipment can unlock a job (`Requires item`); everything else is cosmetic. Practice is always free.

## Branching help flow

Wrong answer -> `LFH.grade` returns tags (Calibration first) -> **Side mission** -> Calibration: **Watch one** (worked example with the answer stated) then **Your turn** (a freshly generated graph); Archive: the reteach plus a Check question -> back to the question with a **Remember** strip -> a second miss **reveals the answer with the reason**. Build-mode steps (axis choice, scale choice, plotting) use the same machinery with their own tags.

## Tests (`bash dev/check.sh`, six steps)

1. `build.py --check`: nothing generated is stale or hand-edited.
2. `test_engine.js`: validation, 31 phase answer keys and traced paths, grading, build diagnosis, playtest regressions, 300 rolls of each of 13 drills (one correct answer, no duplicates, no NaN, science-honest, believable), payout math, migration, jobs and shop rules, art-to-Items agreement, quarantine cascades, the content chooser (12 scenarios), resume safety.
3. `test_feed.js`: the real Apps Script against the real seed workbook through a stand-in for Google (CacheService with the 100 KB limit, real gzip, locks, dialogs). Proves exact parity with the shipped snapshot, then ten blank rows, reversed columns, missing columns, held-back cases, drafts, duplicates, caching, expiry, chunking, error paths, the menu, and a reconstruction of the live Sheet as found.
4. `play.py`: the entire game in Chromium (name the lab, every job through the inbox, funds equal before plus paid, a locked job opens on purchase, reload mid-build resumes, an Archive detour).
5. `play_feed.py`: the real Apps Script builds each feed and Chromium plays against it (live edits, offline, a broken case, the old-layout Sheet, a question added mid-job, a case removed mid-job).
6. `test_repo.py`: docs links resolve, the guard hook works, no secrets or student data.
