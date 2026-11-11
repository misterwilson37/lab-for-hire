# Lab for Hire

A game that teaches 7th graders to read tables, graphs, and phase diagrams. Students run a "lab for hire": clients email jobs, students do the science at a workbench, get paid, and spend the money on a lab that is theirs. Wrong answers are *diagnosed*, not just marked wrong: a graph-reading mistake sends the student to practice on a freshly generated graph; a science mistake sends them to a short reteach and a new question. There is no timer anywhere.

Built for Hanson's science classes at Jake Wilson's school. One static page, content in a Google Sheet, no accounts, no student data.

## Play it
Open `index.html` in a browser. Add `?preview=1` to release every job, show drafts, and see where the content came from. Progress is saved in the browser only.

## For students
Deploy `index.html` (GitHub Pages) and share the link in Google Classroom. That one file is the whole game.

## For teachers (content)
Content lives in a Google Sheet. After the one-time setup in `apps-script/INSTALL.md`, edit the Sheet and students get it within about a minute. The Sheet's **Lab for Hire > Check my content** menu says what students will see and why anything is held back. Writing guide: `docs/CONTENT-GUIDE.md`.

While you edit during class: one bad case is held back and the rest keep working; if the whole Sheet is unreadable the game keeps its last good copy; students mid-job keep their place; drafts never reach students.

## For developers
```
bash dev/setup.sh        one-time: node, python3, openpyxl, playwright + Chromium
python3 build.py         rebuild index.html and apps-script/LabForHire.gs after editing src/
bash dev/check.sh        run all six checks
```
**Edit `src/`; never hand-edit generated files** (`index.html`, `apps-script/LabForHire.gs`, `src/content.json`, `src/art.json`).

```
src/            sources: shell.html, engine.js (all game logic), app.js (UI), sheet-script.gs, config.json
                + generated inputs: content.json (offline copy of the Sheet), art.json (baked room)
index.html      GENERATED game (committed: GitHub Pages serves it)
apps-script/    GENERATED Sheet script, plus INSTALL.md for the ten-minute setup
sheet/          seed workbook (a one-time import) and the live-Sheet upgrade runbook
docs/           architecture, decisions, roadmap, content guide, client brief, playtest log, provenance
dev/            tests (engine, Sheet reader, browser playthroughs) and tools (content refresh, art baking)
.claude/        Claude Code settings, a guard hook, slash commands
incoming/       drop zone for files from outside (git-ignored)
```

Point the game at the live Sheet: `python3 build.py --feed-url "https://script.google.com/macros/s/.../exec"`.
Refresh the built-in offline copy from the live feed: `python3 dev/content/embed_content.py "<feed URL>"`.
Re-bake the room art: edit `dev/art/bake.html`, then `python3 dev/art/bake.py` and `python3 dev/art/embed_art.py`.

**Start with `HANDOFF.md`** (state, blockers, next steps) and `CLAUDE.md` (rules for working on this). Design reasoning: `docs/DECISIONS.md`. Backlog: `docs/ROADMAP.md`.

## Privacy
No accounts, no tracking, no student data. Progress stays in each browser. The content Sheet and the public feed contain only questions, data, and shop items.
