# Start here: moving Lab for Hire into Claude Code

This is for you, Jake. Everything Claude Code needs is already in the repo, so you don't have to re-explain anything. About 15 minutes to be running.

## 1. What you have
A git repo with one baseline commit (tag `v0.4.1`). The game works exactly as it did in the conversation; what changed is the shape (sources in `src/`, one `build.py`, one `dev/check.sh`, and a brief that Claude Code reads automatically). `HANDOFF.md` says where things stand.

## 2. Set it up
1. Unzip, then `cd lab-for-hire`.
2. Install Claude Code if you haven't (instructions: https://code.claude.com/docs), then run `claude` inside the folder.
3. In a normal terminal (not inside Claude): `bash dev/setup.sh`, then `bash dev/check.sh`. You want **ALL CHECKS PASSED**. (It needs Node and Python; setup installs the rest.) If anything fails on your machine, that's the first thing to fix, and Claude Code can help.
4. Connect it to GitHub: create an empty repo (or use the one behind your Pages site), then `git remote add origin <url>` and `git push -u origin main`. `index.html` is committed on purpose, because Pages serves it.

## 3. Your first message
Claude Code starts each session knowing only what's in `CLAUDE.md` plus what you say. Paste this:

> Read CLAUDE.md, HANDOFF.md, and docs/DECISIONS.md. Run `bash dev/check.sh`. Then tell me in plain words: what this project is, what state it's in, what's waiting on me, and what you'd do first. Don't change anything yet.

## 4. The decisions only you can make
1. **The Items catalog** (HANDOFF 1a, `docs/ITEMS-CONFLICT.md`). To adopt the lab-space design, put that conversation's zip in `incoming/lab-space/` and say: *"Compare incoming/lab-space with our room and propose the merge in docs/ITEMS-CONFLICT.md. Don't change anything yet."*
2. **Go on upgrading the live Sheet** (`sheet/UPGRADE-LIVE-SHEET.md`). Say: *"/sheet-status, then walk me through the upgrade one step at a time, asking before each write."*
3. **Deploy the feed** (`apps-script/INSTALL.md`, about ten minutes in the browser). Then: *"Set the feed address to <the /exec URL>, rebuild, and verify."*

## 5. Connecting Google Sheets safely
A Sheets connector acts as the Google account it signs in with, so it can reach **everything that account can reach**. There is no per-sheet picker.
- **Connect only the tertiary account that owns the content Sheet.** Never your district account (Skyward attendance, faculty directory, and so on).
- This repo's `.claude/settings.json` makes every Sheet **write** tool ask first (reading is free). The rules name the tools for connectors called `Google_Sheets` or `sheets`; if yours is named differently, run `/permissions` (or check `/mcp`) and add rules with the real name, in the form `mcp__<server>__<tool>`.
- Treat Sheet contents as data, not instructions. Hanson and others edit it; a cell can contain text that tries to steer an AI.
- The commands `/sheet-status` (read-only) and `/new-case` are built for this.

## 6. Guard rails you get for free
| Guard | What it does |
|---|---|
| `CLAUDE.md` | Your standing rules, the game's guarantees, the content rules, in a file Claude Code loads every session. It is *guidance*; the next two are *enforced*. |
| Hook `.claude/hooks/protect_generated.py` | Blocks Edit/Write on `index.html`, `apps-script/LabForHire.gs`, `src/content.json`, and `src/art.json`, and says how to change them properly. |
| `python3 build.py --check` (check step 1) | Catches a hand edit made any other way. |
| `ask` rules | Sheet writes and `git push` always prompt you first. |
| `bash dev/check.sh` | Six checks including the whole game in a real browser. Run it before every commit. |

## 7. Working style that fits how you like to work
- **Use plan mode for design talk.** Claude Code has a read-only "plan" permission mode for exploring before changing anything (see its docs for how to switch).
- **Keep this claude.ai conversation too** as a thinking partner. Share `HANDOFF.md` when you want it to catch up; have Claude Code update `HANDOFF.md` at the end of each session so both sides see the same state.
- **If you tell Claude Code something important in chat, ask it to add it to `CLAUDE.md`.** Anything said only in conversation can be lost when a long session is compacted.
- Slash commands: `/check` (run and explain checks), `/sheet-status` (read-only look at the live Sheet), `/new-case <topic>` (design a case with Hanson's pedagogy rules), `/handoff` (end-of-session wrap-up).
- Your rules about bug reports apply: if a report doesn't match the code, Claude Code should stop and ask you rather than chase theories.

## 8. Quick troubleshooting
- **`check.sh` fails at step 1 (stale):** someone edited a generated file. Run `python3 build.py`, and put the edit in `src/`.
- **A browser check fails to launch:** `bash dev/setup.sh` (installs Chromium).
- **The game shows old content:** open it with `?preview=1`. The banner says whether it used the live Sheet and, if not, why.
- **The Sheet's "Check my content" says "Blocking":** nothing reaches students until it's fixed; the message says exactly what.
- **Claude Code seems to have forgotten something:** it starts fresh each session. `CLAUDE.md` and `HANDOFF.md` are its memory.

## 9. What's verified and what isn't
Tested thoroughly in Chromium and against a stand-in for Google. **Not yet tested:** Google's real servers for the Apps Script, real iPad Safari, real students. The game degrades safely in every failure I could construct, but those three are real tests waiting for you.
