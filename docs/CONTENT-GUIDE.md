# Content guide: writing cases that work

For Hanson (who writes content in the Google Sheet) and for any instance helping her. The engine enforces the mechanical rules; this explains the *craft*, and why. Run **Lab for Hire > Check my content** in the Sheet as you go.

## What a case is
A **client with a problem**, one investigation, and about 7 questions. The student looks at the client's data (a graph, a table, or both), answers questions that climb a ladder of thinking, and makes a decision the client can use. A case is a costume over a skill, because the same skills repeat across cases (that is the spiral review).

| Piece (Sheet tab) | What to write |
|---|---|
| Case (`Cases`) | CaseID, Title, Client ("Coach Rivera, athletic trainer"), a 3 to 4 sentence pitch the student reads first, a Win message, Pay (60 to 120), Status (start as **Draft**) |
| Visuals (`Visuals`, `Data`, `Tables`) | Line graph, bar graph, data table, or phase diagram, with axis labels, units, min/max/step |
| Questions (`Questions`, `Options`) | About 7, each with Skill, Type, the prompt, "Why it's right", and 3 to 5 options |
| Equipment gate | Optional: `Requires item`, so the job unlocks when the student buys the right equipment |

## The skill ladder (use most rungs in order)
1. **Read a value** (off a graph or table).  2. **Read the scale** (between gridlines; log axes).  3. **Identify a trend.**  4. **Compare** (greatest change, which is steepest).  5. **Predict / extrapolate.**  6. **Evaluate a claim / Select evidence.**  7. **Apply the science.** End with a decision the client pays for.

## Question types
Multiple choice (exactly 1 correct), **Pick two** (exactly 2), **Pick three** (exactly 3; the game won't let a student submit until they've picked that many), **Select all that apply** (at least 1). Use pick-N for evidence and claims; use select-all sparingly, since partial picks are very diagnostic.

## The rules that came from real playtests
1. **Never ask for a value the student just plotted or was just given.** (They copy it. Ask about an unmeasured point: read backward from a y-value, or interpolate between points.)
2. **The question must be answerable from the visual**, or be explicitly *about* what the visual can't show ("Can THIS graph tell Rook whether water is a gas at high pressure? No: pressure isn't on it").
3. **"Greatest change" has two meanings.** A big total change over a long span can be *less steep* than a small change over a short one. Ask for **steepness** when you mean rate, and make the long, gentle stretch a tempting wrong answer.
4. **Every wrong option reveals a real mistake, and gets its tag.** Distractors are *misconceptions*, not nonsense. If you can't name the mistake, rewrite the option.
5. **Numbers must be believable** for the context. If it would make a science teacher wince, it will make a student distrust the game.
6. **Real data when it exists, labelled; sample data labelled as sample** (Teacher notes).
7. **Original wording.** Never copy state-test or STEMscopes worksheet items, even paraphrased. Use them only to learn which skills and misconceptions to cover.
8. **Prompts a 7th grader reads quickly.** Short sentences; define the job in the pitch, not in every question.

## Error tags: the heart of the design
Each wrong option carries a tag that says what mistake it reveals. The tag picks the help.
- **Calibration tags** (`CAL-...`) mean a *graph-reading* mistake. The game sends the student to a worked example, then a freshly generated graph. These need no writing from you: the game generates the practice.
- **Archive tags** (`SCI-...`) mean a *science* mistake. The student gets your short reteach and then a **Check question** (a fresh question on the same idea, in the `Questions` tab with Role = Check and `Check for tag` set). **Write 2 or 3 Check questions per Archive tag** so repeats don't feel scripted.
- On **Select all**, a tag on a *correct* option means "if a student misses this, send them here".
- Calibration help comes before Archive help when both apply: fix the reading, then the science.

The 25 tags in the seed (with what each means) are listed in `ARCHITECTURE.md`. Reuse them. A new misconception needs a `SideMissions` row (a title, an explanation that is a *statement* never a question, a teacher note) and at least one Check question. A new *graph-reading* skill needs engine code (a new drill), so ask a developer.

## Build mode (the student constructs the graph first)
Set `Student builds it?` = Yes on a **line graph**. The student chooses the axes, chooses a scale, plots every point (tap the grid), passes the TALK check, and certifies the graph before questions. Tips: use uneven x-values (e.g. -20, 0, 40, 100, 120) because "plotted at equal spacing" is the classic error and the game catches it; remember rule 1 above, because the student plotted every point.

## Phase diagrams
Give the Melting, Boiling, and Sublimation lines as `Data` rows (series names must match exactly). The regions are computed from your lines, and **the answer-key check uses the same code that draws them**, so a drawn region can never disagree with a key. Questions to cover: state at a (T, P); particle motion for that state; which point has the greatest average kinetic energy (the temperature, not the pressure: that's `SCI-KE-TEMP`); trace a change at constant pressure or constant temperature.

## Equipment, jobs, and the shop
A job can require equipment (`Requires item`). Equipment *unlocks job types*; cosmetics just decorate. Practice is always free, so a student short on funds is never locked out of learning. Put new equipment in `Items` (see `ITEMS-CONFLICT.md` before adding anything; the catalog is being decided).

## Checklist before you set a case to Live
- [ ] Status is Draft until every box is ticked, then Live.
- [ ] Every question has exactly the right number of correct options for its type.
- [ ] Every wrong option has an error tag; every Archive tag has 2 or more Check questions.
- [ ] No question can be answered by copying a plotted or given value.
- [ ] Every question is answerable from its visual (or says why it isn't).
- [ ] Numbers are believable; sample data is labelled in Teacher notes.
- [ ] All wording is original.
- [ ] **Lab for Hire > Check my content** shows the case isn't held back.
- [ ] You played it with `?preview=1`.

## If a case disappears for students
It is being **held back**. Open **Check my content**: it names the case and the exact problem in plain words (for example, "MM-01: Multiple choice has 0 correct answers"). Other cases keep working in the meantime.
