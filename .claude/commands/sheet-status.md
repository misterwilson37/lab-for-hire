---
description: Read-only report on the live Google Sheet (never writes)
---
Using the Google Sheets connector, report on the live content Sheet WITHOUT writing anything. Read only: tab names, header rows, row counts, the Start Here schema line, and the Lists tab.

Compare with the schema in docs/ARCHITECTURE.md (section "The Sheet") and say plainly: which schema version the Sheet declares, which tabs or columns are missing or extra, how many blank rows sit under any header, and whether the Items tab matches this game's design or the lab-space design (docs/ITEMS-CONFLICT.md). Finish with the next step from sheet/UPGRADE-LIVE-SHEET.md. If any write tool prompts for approval, deny it: this command only reads.
