# Lab for Hire

A science data-reading game for 7th grade. Students run a lab for hire. Clients bring problems, and the evidence is in graphs and tables.

Wrong answers are diagnosed, not just marked wrong:
- A graph-**reading** error sends the student to **Calibration Bay** for practice on a freshly generated graph.
- A **science** error sends them to **the Archive** for a reteach and a new question.

After either side mission, the student returns and retries. There is no timer anywhere.

## Deploy
- **GitHub Pages:** upload `index.html`. That's the whole game, with no other files needed. Share the URL in Google Classroom.
- **Teacher preview:** add `?preview=1` to the URL. This shows drafts, unlocks every case, and runs the content check.
- **Progress** is saved in each student's own browser (`localStorage`). There are no logins and no student data. Clearing browser data resets progress.

## Content lives in the Google Sheet
Content comes from the Sheet (schema v0.2.1). Its tabs are:
- **Cases:** one row per case.
- **Visuals:** graphs and tables; set **Student builds it?** = Yes on a line graph to turn on Build mode.
- **Data:** the plotted points.
- **Tables:** the table cells.
- **Questions**
- **Options:** one row per choice. A wrong choice needs an **Error tag**.
- **SideMissions:** one row per tag.
- **Lists:** dropdown vocabulary. Don't edit it.

The Sheet's *Start Here* tab explains every rule.

Question types:
- Multiple choice
- Pick two
- Pick three
- Select all that apply

Visual types:
- Line graph (linear or log axes, multi-series)
- Bar graph
- Data table (text allowed)
- Phase diagram (Melting / Boiling / Sublimation lines; regions are computed)

## Updating the game's content (until the live feed exists)
1. Export the Sheet as .xlsx.
2. `python3 tools/export_json.py Sheet.xlsx content.json`
3. `python3 tools/embed_content.py index.html content.json`
4. `node tools/test_engine.js index.html content.json` must print **ALL TESTS PASSED**. If a phase diagram's data changed, add its answer-key checkpoints to the harness first.
5. `python3 tools/play.py index.html` (needs Playwright) must show 0 JS errors.
6. Upload `index.html`.

## Code layout (inside index.html)
- `<script id="lfh-content">` holds the content JSON (generated; never hand-edit).
- `<script id="engine">` holds `LFH`, the pure logic:
  - content model;
  - axes (linear and log);
  - `phaseModel`, which is used by both the renderer and the answer-key tests;
  - `grade` and `validate`;
  - build-mode checks;
  - 13 drill generators behind `makeDrill`, which re-rolls any bad random draw.
- `<script id="app-js">` holds the UI (side missions run as "Watch one", then "Your turn"):
  - SVG renderer;
  - hub (case path, Calibration Bay, lab shelf);
  - case flow, Build mode, side missions, report card, free practice.

## Design
- **Palette:** borrowed from Hanson's lesson decks (pink, violet, sky) on lavender paper.
  - Calibration Bay is sky blue; the Archive is violet.
  - Every token is redefined for dark mode.
- **Type:** Fredoka (display) and Atkinson Hyperlegible (everything students read).
- **Accessibility:**
  - Multi-series graphs use marker shapes *and* dash patterns, never color alone.
  - Keyboard plotting works (arrow keys + Enter).
  - Visible focus rings.
  - Reduced motion is respected.
