"""Dump a content workbook as raw grids (what Apps Script's getValues/getDisplayValues would return).
No interpretation happens here: the transform from grid to game content lives ONLY in Apps Script (Rule 9).
Usage: python3 xlsx_to_grid.py book.xlsx > grid.json"""
import json, sys
from openpyxl import load_workbook
wb = load_workbook(sys.argv[1], data_only=True)
def disp(v):
    if v is None: return ""
    if isinstance(v, bool): return "TRUE" if v else "FALSE"
    if isinstance(v, float): return str(int(v)) if v.is_integer() else repr(v)
    return str(v)
out = {}
for ws in wb.worksheets:
    rows = [list(r) for r in ws.iter_rows(values_only=True)]
    while rows and all(c in (None, "") for c in rows[-1]): rows.pop()          # getDataRange() trims trailing blank rows
    out[ws.title] = {"values": [["" if c is None else c for c in r] for r in rows], "display": [[disp(c) for c in r] for r in rows]}
json.dump(out, sys.stdout)
