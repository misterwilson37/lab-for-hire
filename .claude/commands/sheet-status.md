---
description: Read-only report on the live Google Sheet (never writes)
---
Using the Google Sheets connector, report on the live content Sheet WITHOUT writing anything. Read only: tab names, header rows, row counts, the Start Here schema line, and the Lists tab.

Compare with sheet/README.md and the seed workbook in sheet/, and say plainly: which schema version the Sheet declares, which tabs or columns are missing or extra, whether any blank rows sit under a header, whether the hidden "old ..." backup tabs and the zz_check scratch tab are still there, and what sheet/README.md says is still to do. If any write tool prompts for approval, deny it: this command only reads.
