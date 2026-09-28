# HANDOFF: Lab for Hire, Session 1 (playable demo)

**Instance:** Playfair (William Playfair, inventor of the line graph and bar chart; also "play fair").
The next instance picks a new name. Don't reuse this one.

## Shipped this session
| File | Version | What |
|---|---|---|
| `index.html` | game v0.1.1 · engine v0.1.0 | The whole game: one self-contained file, content snapshot embedded |
| `LabForHire_Content_v0.2.0.xlsx` | schema v0.2.0 | Content seed (supersedes v0.1.0) |
| `tools/` | n/a | Export, embed, and test tools that operate on `index.html` |

## v0.1.1 (iPad pass)
- Replaced CSS `color-mix()` with plain rgba tokens. `color-mix()` needs iPadOS 16.2+, and on older iPads every gridline would have vanished.
- Buttons use `touch-action: manipulation` (no double-tap zoom delay).
- Touch plotting was verified in an emulated iPad (Chromium). **Not yet tested in real Safari/WebKit.** Jake should run one real-device check.
- Portrait iPad (< 920 px) stacks the graph above the question, so students scroll. Landscape keeps the graph beside the question. A sticky or collapsible graph for portrait is a candidate for the next round.
- Shared iPad carts: progress is per device and browser, so students on a shared iPad share progress. Options for later: "Reset my progress" between users, or a no-PII local lab-badge picker.

## Where things stand
- **Jake's live Sheet** (view link in chat, ID `1D2uX2xzW87ykVcJ5uv3lDvwwdxfmvOOefkTN9QDOSqY`) still holds **v0.1.0**. Nobody has edited it yet.
  - Jake should re-import v0.2.0 into the SAME file (File → Import → Upload → *Replace spreadsheet*). That keeps the Sheet ID the Apps Script feed will bind to.
  - After the import, Jake confirms the dropdowns survived. I couldn't verify them from a view-only link.
- **The demo is not yet wired to the Sheet.** `index.html` carries a content snapshot exported from the xlsx.
  - Rule 9 note: the snapshot is a *generated* copy, never hand-edited, and it is replaced wholesale by `tools/embed_content.py`. The Sheet stays the single source of truth for content. The snapshot goes away when the Apps Script feed lands. Jake can overrule this reading.
- **Content decisions Jake approved in principle** ("build on what we have; teacher gives feedback"). Nothing has been reviewed by Hanson yet.

## Content provenance (tell Hanson)
- **MOVIN-MOLECULES:** her 5 data points; original questions. **Build mode**: students choose axes, choose a scale, plot, TALK check, then certify.
- **COLD-PACK:** her own example from the request. **Sample data.** Wording says "dissolves", not "reacts". Coldest ≠ best: urea wins on cost.
- **PHASE-PROBE:** **real water data**. Her worksheet's phase data table was never available.
  - Her worksheet key implies a simplified diagram. On real water, 100°C at 4 atm is a liquid, so her Q1 would have two right answers there.
- **DRY-ICE:** **real CO₂ data**, rounded, on a **log pressure axis**. This fills the gap the unit test exposed (the nitrogen diagram uses a log axis; Lesson 5 never practices one).
- **BOUNCE-LAB:** sample data following the gas law. Two visuals: a text table with a "?" row, and a bar graph.
- **No unit-test items are used**, not even paraphrased. The test served as a blueprint for skills and misconceptions only.
- Unit test Table 2 has physically inconsistent numbers: its 120 kPa "vacuum" is above atmospheric pressure. Flagged to Jake; not reused.

## Architecture
- One HTML file, three script blocks:
  - `lfh-content`: JSON snapshot.
  - `engine`: pure logic, no DOM. Node-testable.
  - `app-js`: the UI.
- **One phase-state function** (`LFH.phaseModel`) both paints the diagram regions and is what the harness checks the answer keys against. They cannot disagree.
- **Branching:**
  - Calibration tags route to **code-generated drills**: 12 generators, fresh data every time.
  - Archive tags route to Sheet-authored Check questions.
  - Calibration is prioritized over Archive.
  - The second wrong answer reveals the solution.
  - While a side mission is waiting, answering and plotting are locked.
- **Drill contexts carry the trend directions they physically allow.** A drill must never show particle speed falling as temperature rises; this is enforced by a test.
- **Scoring:** 3 rep for first try, 2 after a side mission, 1 if the answer is revealed. Stars come from the percentage. Rank and equipment unlock by rep. Calibration Bay free practice adds +1 rep per correct answer.
- **Progress** lives in `localStorage` (`lfh.progress.v1`), wrapped in try/catch. No accounts, no student data. COPPA surface: none.
- **Teacher preview:** `?preview=1` shows drafts, unlocks everything, and shows validator results.

## Tests (all green at handoff)
- `node tools/test_engine.js index.html <content.json>` runs:
  - content validation;
  - 31 phase answer-key checks plus 3 traced paths against the drawing function;
  - grading (MC / pick-N / select-all routing);
  - build-mode diagnosis (the equal-spacing error lands on CAL-SPACING);
  - 300 rolls × 12 drills, each checked for 1 correct answer, no duplicates, no NaN, and science honesty.
- `python3 tools/play.py index.html` is a headless full playthrough of all 5 cases. It answers every question from the embedded key and forces one Archive detour. Expect 0 JS errors.
- **Visual review:** screenshots at 1366×768 (Chromebook), 390 px (phone), and dark mode.

## Known limits / next session
1. **Apps Script feed:** `doGet` returns this same JSON shape from the live Sheet.
   - Port `LFH.validate` verbatim into Apps Script (same JS) and add a "Check my case" menu.
   - Game: fetch the feed on GitHub Pages and fall back to the snapshot.
   - The published claude.ai artifact CANNOT fetch external URLs (CSP), so it stays snapshot-only.
2. Phase diagrams are Read-only. Build mode covers line graphs only.
3. Case questions are fixed. Only the drills regenerate. Procedural case variants would be a later round.
4. "Build your CER" multi-step question type (claim → evidence → reasoning), proposed but not built.
5. Hanson's feedback pass on wording, difficulty, and case length (7–8 questions each).
