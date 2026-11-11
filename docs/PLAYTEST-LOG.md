# Playtest log

What testing found, in order. Each entry is a real defect and the rule that came from it. Tests now cover all of these.

## Round 0: design review (before code)
- Hanson's request surfaced the core need: a wrong answer should say *why* it's wrong. That became the error-tag system (D2).
- The first demo's questions were adapted from her lesson's anticipated misconceptions rather than copied from her worksheet.

## Round 1: iPad pass
- **`color-mix()` would silently drop every gridline on iPadOS before 16.2.** Replaced with plain rgba tokens. Rule: no `color-mix()`.
- Buttons got `touch-action: manipulation` (no double-tap zoom delay).

## Round 2: Jake's first playthrough (seven findings, all fixed)
1. **The setup was forgotten by the axis step.** The case brief is now always available, and shown in full during the axis and scale steps.
2. **The side mission taught the wrong skill.** Choosing *which variable goes on the x-axis* shared a tag with *reading a value off an axis*, and the explanation was phrased as a question. Fixed with their own tag (`CAL-AXIS-CHOICE`) and drill (`variable-placement`: eight experiments, including ones where temperature is the measured y-variable and randomized column order). Side-mission text is now statements, and a test fails any that contain a "?". Side missions now "Watch one" then "Your turn".
3. **A second miss said only "Not quite."** It now states the answer and the reason.
4. **Kept:** the build, analyze flow. ("I do like the format of the build.")
5. **A question asked for a value the student had just plotted** (the 100 C point). Now asks about unmeasured temperatures (650 m/s reads backward to 20 C; 80 C interpolates to about 725). A regression test enforces it. *Rule: never ask for what the student just entered.*
6. **"Greatest increase" ignored rate.** (-20 to 0 and 0 to 40 are equally steep.) Replaced with a pick-two on steepness, and the matching drill's trap requires a long section that rises more in total but isn't steepest.
7. **The ocean question wasn't answerable from the graph.** It now asks whether *this* graph can answer a pressure question (no: pressure isn't on it), so the graph itself is the evidence.

## Found by testing, not by people
- A drill showed particle speed *falling* as temperature rose, and air temperature climbing 150 C in 20 hours. Drill contexts now carry allowed trends, realistic steps, and ceilings; a test rejects unbelievable draws (D18).
- Progress wasn't saved between individual plotted points, so a reload restarted the graph. Autosave now runs on every render of a job screen.
- The "Certified" stamp covered data points. It now lands in the quadrant with the fewest points.
- Legends collided with chart titles, and edge markers were clipped in half. Legends got their own row; markers render outside the clip.
- The practice screen rendered one tick before its first graph existed (a crash). Fixed; the playthrough covers it.
- A blank price would have read as free (`null >= 0` is true in JavaScript). Validation now requires a number.
- A test that assumed the built-in snapshot had no timestamp failed once the snapshot was refreshed. Tests now pin their own timestamps.

## Found while building the Sheet feed (Nov 2026)
- **The seed workbook had ten blank rows under seven headers** (header notes were attached to row 11, a builder bug since v0.1.0). The live Sheet inherited them. The reader now skips blank rows and matches columns by header name; the seed is fixed (v0.3.1). (D13)
- **The live Sheet was on the old layout** and had a competing Items catalog. The schema gate now refuses such a Sheet so jobs can't silently pay $0 (D15), and the conflict was settled in v0.6.0 (`DECISIONS.md` D26).

## Still untested (be honest)
- Real iPad Safari (everything so far is emulated Chromium: desktop, 810x1080 iPad portrait, 390 phone, dark mode).
- Google's real servers for the Apps Script (tested against a stand-in).
- Real students.
