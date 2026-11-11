# Upgrading the live Sheet to schema 0.3.0 (a runbook)

**Nothing here has been done.** It restructures a shared Sheet, so each write waits for Jake's go-ahead. Do it with the Sheets connector (every write tool asks first in this repo's settings) or by hand. Claude Code can read the seed workbook with openpyxl and write the values through the connector.

## What was found (read-only, Nov 10, 2026)
The live Sheet, "Lab for Hire (Claude Controlled)" (ID `1M4VycqB1kpXEfEmt8aLGQBWvZVk6S7EiKKyk7Uiwffg`, owned by the tertiary account):
- `Start Here` line 1 declares **schema 0.2.1**; the game needs **0.3.0**, so the game refuses this Sheet.
- `Cases` has the 9 old columns (no `Requires item`, no `Pay`), only 5 cases (no Teasers), and its first case starts at **row 12**: rows 2 to 11 are blank. (A bug in the v0.3.0 seed builder attached header notes to row 11. Fixed in seed v0.3.1. Check the other tabs: Visuals, Data, Tables, Questions, and Options probably have the same ten blank rows.)
- `Lists` lacks the `Teaser` status and the `ItemKind` and `Rank` columns.
- `Items` (39 rows) and `Items Legend` came from the lab-space conversation: a different design (`ITEMS-CONFLICT.md`).
- Header tooltips are missing (seed bug).

## Step 0: decide the Items catalog (`ITEMS-CONFLICT.md`)
Step 6 depends on the answer. Steps 1 to 5 and 7 to 9 do not.

## Step 1: back up
File > Make a copy > "Lab for Hire (backup before 0.3.0 upgrade)". Rollback is the copy.

## Step 2: Cases
1. Verify rows 2 to 11 are entirely blank, then delete them.
2. Insert two columns after `Win message`: **`Requires item`** and **`Pay`**. Final header order (match by name, so order only matters for readability): `CaseID, Status, Path order, Title, Client, Client pitch (students read this first), Win message, Requires item, Pay, Standard, Teacher notes`.
3. Fill `Pay`: MOVIN-MOLECULES 60, COLD-PACK 70, PHASE-PROBE 80, DRY-ICE 90, BOUNCE-LAB 90. Fill `Requires item` per the Items decision (in this game's catalog: BOUNCE-LAB requires `pressure-gauge`).
4. Add the three **Teaser** rows (CELL-CLINIC, GREENHOUSE, BRACE-DESIGN) from the seed's Cases tab, with `Requires item` = the item that unlocks them in the chosen catalog.
5. Set `Status` validation to the Lists dropdown (below).

## Step 3: blank rows in the other tabs
For Visuals, Data, Tables, Questions, Options: read the first 12 rows of column A with `get_values`; if rows 2 to 11 are blank, delete them. (The feed reader skips blank rows, so this is tidiness, not correctness.)

## Step 4: Lists
Add to `Lists`: `Teaser` under `Status`; a new `ItemKind` column (`Equipment, Decor, Pet, Theme, Paint`) and `Rank` column (`Lab Intern, Lab Tech, Data Analyst, Senior Scientist, Lab Director`). If the lab-space design wins, `ItemKind` and `Rank` change to match (one design, not both). Copy the other columns from the seed. The authority is `LFH.vocab()` in `src/engine.js`; `Lab for Hire > Check my content` lists any disagreement.

## Step 5: Start Here
Replace its text with the seed's `Start Here` (it declares `Schema version 0.3.0` on line 1 and documents the new tabs).

## Step 6: Items
- **Adopt lab-space:** keep the tab; do the merge in `ITEMS-CONFLICT.md` first, then align columns.
- **Keep this game's:** rename the current `Items` tab to `Items (lab-space draft)` (do not delete it) and import the seed's `Items`. Delete `Items Legend`, or keep it with the draft.

## Step 7: header tooltips
The seed has tooltips on header cells (Cases B1 C1 H1 I1; Visuals F1 K1 L1; Data B1 E1; Tables B1; Questions B1 E1 H1; Options E1; Items C1 F1 H1). Notes can be set with `update_spreadsheet` (an updateCells request with a `note`). Optional, but teachers read them.

## Step 8: dropdowns (data validation)
The seed's dropdowns, exactly. Columns that gained dropdowns or moved must be re-pointed.

| Tab | Column | Range | Dropdown source | Blank allowed |
|---|---|---|---|---|
| Cases | Status | `B2:B500` | `=Lists!$A$2:$A$4` | no |
| Cases | Requires item | `H2:H500` | `=Items!$A$2:$A$500` | yes |
| Visuals | CaseID | `B2:B500` | `=Cases!$A$2:$A$500` | no |
| Visuals | Type | `D2:D500` | `=Lists!$B$2:$B$5` | no |
| Visuals | Student builds it? | `F2:F500` | `=Lists!$I$2:$I$2` | yes |
| Visuals | X scale | `L2:L500` | `=Lists!$J$2:$J$3` | yes |
| Visuals | Y scale | `R2:R500` | `=Lists!$J$2:$J$3` | yes |
| Data | VisualID | `A2:A3000` | `=Visuals!$A$2:$A$500` | no |
| Tables | VisualID | `A2:A2000` | `=Visuals!$A$2:$A$500` | no |
| Questions | CaseID | `B2:B1000` | `=Cases!$A$2:$A$500` | yes |
| Questions | Role | `D2:D1000` | `=Lists!$D$2:$D$3` | no |
| Questions | Check for tag | `E2:E1000` | `=SideMissions!$A$2:$A$500` | yes |
| Questions | Skill | `F2:F1000` | `=Lists!$E$2:$E$9` | no |
| Questions | Type | `G2:G1000` | `=Lists!$C$2:$C$5` | no |
| Options | QID | `A2:A3000` | `=Questions!$A$2:$A$1000` | no |
| Options | Correct? | `D2:D3000` | `=Lists!$H$2:$H$2` | yes |
| Options | Error tag | `E2:E3000` | `=SideMissions!$A$2:$A$500` | yes |
| SideMissions | Kind | `B2:B500` | `=Lists!$F$2:$F$3` | no |
| SideMissions | Drill (Calibration only) | `F2:F500` | `=Lists!$G$2:$G$14` | yes |
| Items | Kind | `E2:E500` | `=Lists!$L$2:$L$6` | no |
| Items | Unlocks | `F2:F500` | `=Cases!$A$2:$A$500` | yes |
| Items | Rank required | `G2:G500` | `=Lists!$M$2:$M$6` | yes |

## Step 9: verify
1. In the Sheet: **Lab for Hire > Check my content** (after the script is installed, `apps-script/INSTALL.md`). Expect "Everything students will see looks good", 5 live jobs, 3 teasers. Fix anything it lists.
2. Open the game with `?preview=1`. The Ledger banner should say **"Content: the live Sheet"**. If it says it used the built-in content, the banner names the reason.
3. Edit a case title in the Sheet, click **Send my edits to students now**, reload the game: the new title appears.
4. `bash dev/check.sh`, then refresh the built-in fallback: `python3 dev/content/embed_content.py "<feed URL>"`.

## Never
Put student data in this Sheet or in any sheet owned by this account.
