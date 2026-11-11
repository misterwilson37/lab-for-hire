# Lab for Hire

A science data-reading game for 7th grade. Students run a lab for hire: clients email jobs, the evidence is in graphs and tables, the pay buys equipment and decorations for a lab that is theirs. Built for Hanson's science classes; made by Jake Wilson with Claude. Game **v0.6.0**.

Wrong answers are diagnosed, not just marked wrong:
- A graph-**reading** error sends the student to **Calibration** for practice on a freshly generated graph ("Watch one", then "Your turn").
- A **science** error sends them to **the Archive** for a reteach and a new question.

After either side mission the student returns and retries. There is no timer anywhere, and getting help never costs money.

## How it plays
1. A student names their lab (from a word builder: no free text).
2. The lab is the home screen. Tap the **laptop** for job emails, the **desk** for the workbench, or **Store and decorate**.
3. They accept a job and do the science at the workbench: build graphs, read data, answer, with side missions when stuck.
4. They get paid, and the client replies.
5. They spend the money in the **store**: equipment unlocks new kinds of jobs; furniture, pets, posters, and paint make the lab theirs. Anything taken out waits in **Storage**. Building a graph earns a framed copy of it for the wall.
6. **Cold Pack is a job template:** plan a fair test, run it, analyze, recommend (claim, evidence, reasoning). The client comes back with new rules and new data every time.
7. **Backups:** Ledger → *Save my lab* puts a backup file in the student's Google Drive; *Load my lab* brings it back on a new or wiped iPad.

## Try it
Open `index.html` in a browser. Add `?preview=1` to the address to release every job, show drafts, and see where the content came from.

**Deploy:** GitHub Pages serves `main`, so pushing `index.html` to `main` is the deploy. Share the Pages address in Google Classroom. There are no logins and no student data; progress is saved in each student's own browser.

## Where the content lives
In a Google Sheet that Hanson can edit (see `sheet/README.md`). The game reads it through a small script in the Sheet (`apps-script/INSTALL.md`, a ten-minute one-time setup that has not been done yet). Until then, and whenever the Sheet can't be reached, the game uses the copy of the content built into the page. A mistake in one case holds back that case only; everything else keeps working.

## For whoever works on the code
Read `CLAUDE.md` (rules and commands), then `HANDOFF.md` (where things stand).
```
bash dev/setup.sh        one-time: openpyxl, playwright, Chromium
python3 build.py         rebuild index.html and the Sheet script after editing anything in src/
bash dev/check.sh        every check (about two minutes); run before each commit
```
- `src/`: the sources. `engine.js` (all rules, testable without a browser), `lab.js` (draws the room and store), `app.js` (screens), `shell.html` (page and styles), `sheet-script.gs` (the Sheet side).
- `index.html` and `apps-script/LabForHire.gs` are **generated**: never edit them by hand.
- `dev/art/`: the room art is baked from 3D models (`python3 dev/art/bake.py` after `bash dev/art/setup.sh`).
- `docs/`: design, decisions, roadmap, Hanson's brief, content rules, where everything came from.

## Credits
Room models: Kenney (kenney.nl), CC0. Lab equipment, posters, and frames are homemade in the same style. Scientist portraits are public domain in the US (`dev/art/portraits/CREDITS.md`). Fonts: Fredoka and Atkinson Hyperlegible (SIL Open Font License). No license has been chosen for the code yet.
