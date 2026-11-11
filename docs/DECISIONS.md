# Decision log

The reasoning behind the project, so it survives the move out of the original conversation. Format: **decision**, why, what it costs. "Open" means Jake hasn't decided yet. If you want to reverse one, read the cost line first.

## Product

**D1. A custom game, not Deck.Toys, Blooket, or Google Forms.**
Hanson wanted Deck.Toys' adventure paths, Blooket's replayability, and Forms' branching. None of them *diagnoses why* an answer is wrong: Blooket ignores it, and Forms branching has to be hand-built per branch. The heart of the design is that every wrong option is tagged with the mistake it reveals, and the tag picks the help. That requires owning the engine. *Cost:* we own the code, the testing, and iPad compatibility.

**D2. Every wrong answer is diagnosed; help is a place you visit, not a penalty.**
Two kinds of help: **Calibration** (graph-reading errors, practiced on freshly generated graphs) and **Archive** (science errors: a reteach plus a teacher-written Check question). Calibration comes first when both apply: fix the reading, then the science. *Why:* Hanson's #4 and #5. *Cost:* every distractor must be tagged, which makes authoring slower and is enforced by validation.

**D3. Calibration practice is generated; Archive practice is authored.**
Thirteen drill generators produce unlimited fresh graphs (so there is nothing to memorize); science reteaches need a human's judgment about misconceptions, so teachers write them in the Sheet. *Cost:* a new graph-reading skill needs engine code, while a new science misconception needs only Sheet rows.

**D4. Side missions teach before they ask ("Watch one", then "Your turn").** (Jake's playtest.)
The first version only quizzed, and used the wrong skill's tag. A worked example with the answer stated comes first; a second miss reveals the answer with the reason. *Cost:* each Calibration drill must produce a clear worked example.

**D5. No timer, ever; speed is never rewarded.** (Hanson: "speed shouldn't be the main way to win.")
Pay rewards evidence quality and finished side missions. Getting help earns money rather than costing it. *Cost:* none technically, but any future "bonus" mechanic must be checked against this.

**D6. Build mode: table, then graph, then analyze.** (Hanson's own lesson structure; Jake: "I do like the format of the build".)
The student chooses the axes, chooses a scale, plots the points, passes a TALK check (Title, All data, Labels, Key), and certifies the graph before questions. A mistake routes to a side mission; the graph is certified correct before interpretation so every later answer rests on good data. *Cost:* only line graphs are buildable so far (phase diagrams and bar graphs are on the roadmap).

**D7. Spiral review, not new instruction.**
Hanson's units rarely leave room to practice graph skills, so the game is skill-first: the science changes by unit, the graph skills repeat. Cases are costumes over a stable skill ladder (read a value, scale, trend, compare, predict, evidence, apply the science).

**D8. Ownership drives return visits: the student runs a lab.** (Hanson's feedback.)
Clients email jobs; money earns equipment; **equipment unlocks job types** (so her year of content becomes the shop catalog); cosmetics (paint, posters, pets, a Frankenstein theme pack) make the lab theirs. *Cost:* an economy to balance, art to maintain, and the Items conflict (D21).

**D9. The room is the home screen; the laptop is the business side, the workbench is the science side; one way in to each thing.**
The inbox carries jobs, locked teaser jobs, and client replies; the shop sells gear; the training sim is free practice; the ledger shows funds and rank. Work never happens on the laptop. Guardrails: three taps from room to work, a job fits in about 15 minutes and autosaves, the room gets out of the way during work, and equipment unlocks job types, never practice. Locked jobs are visible as teaser emails so the goal is visible.

**D10. Two currencies.**
`rep` is never spent and drives rank; `funds` are earned and spent. A replay with the same data pays 25%; new data or new requirements pay in full (the second needs job templates, on the roadmap).

## Data and content

**D11. The Google Sheet is the single source of truth for content, read through an Apps Script feed.** (Rule 9)
Teachers know Sheets and can edit without a developer. The game fetches the Sheet's content live. The built-in snapshot is an explicit offline cache, refreshed from the feed by a tool; it is never hand-edited. The earlier Python Sheet reader was deleted when the Apps Script reader arrived, so there is exactly one reader. *Cost:* the Apps Script can't be run on Google's servers from the build environment, so the first deploy is a real test.

**D12. The Sheet's script contains the game's own engine.**
The rules for what is valid content exist once (`src/engine.js`) and are copied into the Sheet's script by `build.py`. Teachers' "Check my content" therefore uses exactly the rules students' games use. *Cost:* changing the engine requires rebuilding the script (enforced by `build.py --check`).

**D13. The reader matches columns by header name and skips blank rows.** (Rule 10: found on real data.)
The seed workbook had ten blank rows under seven headers (a bug in the seed builder, fixed in v0.3.1), and the live Sheet inherited them. A position-based reader would have silently lost data. Reading by header also survives teachers inserting or reordering columns.

**D14. Quarantine: one bad case never freezes the rest.**
A teacher editing during class will make mistakes. Any case with an error is held back; bad items, tags, and Check questions are skipped with warnings (and jobs that need them are held, never given away free); orphan rows are ignored. Only structural problems refuse the whole feed, in which case the game uses the last good copy, then the built-in content. *Cost:* silent degradation could hide problems, so "Check my content" and the `?preview=1` banner state exactly what is held and why.

**D15. A schema gate refuses a Sheet on an older layout.**
The Sheet declares its schema on `Start Here`. If it differs from the game's, the feed is refused, because an old-layout Sheet would otherwise make every job pay $0 and empty the shop *without any error*. Found by reconstructing the live Sheet as it really was.

**D16. Real data is used when it exists, and labelled; sample data is invented only when needed, and labelled.**
The water phase diagram uses real vapor-pressure data, so it disagrees with Hanson's simplified worksheet key (on real water, 100 C at 4 atm is a liquid). CO2 uses real, rounded data on a **log** pressure axis (the unit test's nitrogen diagram uses one and Lesson 5 never practiced it). The cold-pack and bounce cases use realistic *sample* data, and say so in teacher notes.

**D17. Original content only.**
Never reuse state-test items or STEMscopes worksheet items, even paraphrased (copyright and test security). Worksheets and tests serve as a blueprint of skills and misconceptions. Hanson's worksheet items are not in the repo.

**D18. Believability is tested.**
A drill once showed air temperature rising 150 C in 20 hours, and another showed particle speed falling as temperature rose. Each drill context now carries allowed trends, realistic steps, and ceilings, and a test rejects anything unbelievable.

## Platform

**D19. One static HTML file on GitHub Pages; no accounts; progress in the browser.**
Students open a Google Classroom link and play. No login means no compliance surface (COPPA and Tennessee privacy law) for the demo. *Cost:* a student's lab lives on one device until the save code is built.

**D20. All storage goes through `LFH.store`.** (Firestore later.)
Jake wants Firestore eventually. When it arrives it replaces the adapter's functions and nothing else. It also brings the COPPA and Tennessee privacy work (reuse TypeThatBook's), Rule 11 for any teacher view, and a Rule 10 harness first.

**D21. Room art: Kenney CC0 3D models baked to layered sprites through one locked camera. OPEN: which Items catalog wins.**
No artist was available, and image generators can't keep 40 items consistent. Kenney's CC0 models plus a few homemade primitives (beaker, flask, microscope, rack), all rendered through the same isometric camera and lighting, look like one set with no hand-curation. Items go in fixed **slots**, and each is rendered alone so layers stack with no alignment math. Recolors are code. *Open:* a parallel conversation built a different catalog and art pipeline (39 items, flexible slots, different art recipes). Two catalogs for one shop violate Rule 9. See `ITEMS-CONFLICT.md`.

**D22. iPad Safari first.**
Students are on 1:1 iPads. No `color-mix()`, touch-friendly targets, portrait stacks the graph above the question (a sticky graph is on the roadmap). Real-device testing is still owed.

**D23. The repo is source plus a build, with generated files committed.** (v0.4.1)
`index.html` was a 390 KB generated file with everything embedded, which is hard to edit. `src/` holds the sources, `build.py` generates the two shipped artifacts, and `--check` plus a Claude Code hook guard against hand-editing them. *Cost:* one build step before committing.

## Security and privacy

**D24. The Sheets connector is account-wide, so it connects only to a tertiary account that owns no student data.**
Connectors mirror an account's permissions; there is no per-file picker. The content Sheet lives in a separate account. Claude Code is configured to ask before any Sheet write. The feed is public, and the Sheet holds no student data.

**D25. Tests run against real data, and every harness that matters failed first.**
The seed workbook, a reconstruction of the live Sheet (the real 39-row Items tab is a fixture), and the shipped snapshot are the fixtures. Examples of real bugs caught: the seed's misplaced header notes (ten blank rows), `null >= 0` letting a blank price read as free, progress not saving between plotted points, a test that silently depended on the snapshot's age.
