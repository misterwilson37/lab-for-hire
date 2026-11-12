"""Turn the row-layout workbook (Cases / Visuals / Data / Tables / Questions / Options, linked by IDs) into the
one-tab-per-case workbook teachers use: every case is one tab, filled top to bottom, with no IDs to type.

Usage (from the repo root):
    python3 dev/content/make_case_tabs.py [rows.xlsx] [out.xlsx]
Defaults: dev/tests/fixtures/LabForHire_rows_v0.5.0.xlsx -> sheet/LabForHire_Content_v0.6.0.xlsx

This only LAYS OUT the same content differently. The one reader is the Sheet's script (src/sheet-script.gs), and
dev/tests/test_tabs.js proves that it reads both workbooks to exactly the same game content.
"""
import os, sys, copy
from openpyxl import load_workbook, Workbook
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.comments import Comment

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "dev/tests/fixtures/LabForHire_rows_v0.5.0.xlsx")
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, "sheet/LabForHire_Content_v0.6.0.xlsx")

# ---------- read the row layout ----------
src = load_workbook(SRC)
def table(name):
    rows = list(src[name].iter_rows(values_only=True)); head = [str(h or "").strip() for h in rows[0]]
    return [dict(zip(head, r)) for r in rows[1:] if r and r[0] not in (None, "")]
def col(row, start):      # a column by the start of its header ("Client pitch (students read this first)")
    for k, v in row.items():
        if k.lower().startswith(start.lower()): return "" if v is None else v
    raise KeyError(start)
CASES, VIS, DATA, TABLES, QS, OPTS, TAGS = (table(n) for n in ("Cases", "Visuals", "Data", "Tables", "Questions", "Options", "SideMissions"))
# Each mistake in plain words, for the Mistake dropdown. After the workbook is imported these live in the Sheet (SideMissions, last column).
PLAIN = {
    "CAL-SCALE": "Graph: misread the scale (what each gridline is worth)", "CAL-AXIS": "Graph: read the wrong axis (x instead of y, or y instead of x)",
    "CAL-AXIS-CHOICE": "Graph: put the variable on the wrong axis", "CAL-POINT": "Graph: read the wrong point", "CAL-SPACING": "Graph: judged a change by length, not steepness",
    "CAL-TREND": "Graph: got the overall trend wrong", "CAL-PREDICT": "Graph: predicted from the wrong part of the line", "CAL-REGION": "Phase diagram: put the point in the wrong region",
    "CAL-TRACE": "Phase diagram: traced the change the wrong way", "CAL-LOG": "Graph: read a log scale as if it were evenly spaced", "CAL-TABLE": "Table: read the wrong row or column",
    "CAL-SERIES": "Graph: read the wrong line or bar", "CAL-SCALE-CHOICE": "Graph: chose a poor scale",
    "SCI-KE-TEMP": "Science: thinks pressure, not temperature, sets particle energy", "SCI-MOTION-STATES": "Science: matched the wrong particle motion to the state",
    "SCI-PARTICLES-STOP": "Science: thinks particles stop moving", "SCI-SPEED-TEMP": "Science: doesn't connect hotter with faster particles",
    "SCI-GRAPH-PURPOSE": "Science: used the wrong kind of graph for the question", "SCI-EVIDENCE": "Science: picked evidence that doesn't support the claim",
    "SCI-PARTICLES-CHANGE": "Science: thinks the particles themselves change", "SCI-PRESSURE-SOURCE": "Science: wrong idea of what causes pressure",
    "SCI-COMPRESS": "Science: wrong reason gases can be squeezed", "SCI-PARTICLE-MODEL": "Science: explained it without particles",
    "SCI-ENDO-EXO": "Science: thinks cold flows, or reversed the energy flow", "SCI-PHASE-NAMES": "Science: mixed up phase-change words",
    "PLAN-ONE-CHANGE": "Planning: changed more than one thing", "PLAN-CONTROL": "Planning: left out the control", "PLAN-TRIALS": "Planning: didn't repeat the test",
    "PLAN-MEASURE": "Planning: measured the wrong thing", "CER-CRITERIA": "Recommending: didn't check every rule",
}
missing = [t["TagID"] for t in TAGS if t["TagID"] not in PLAIN]
assert not missing, f"no plain-words description for: {missing}"
pick = lambda tag: f"{PLAIN[tag]} | {tag}" if tag else ""     # what the Mistake dropdown shows; the reader keeps the tag

# ---------- look ----------
LABEL = PatternFill("solid", fgColor="EDE7F6"); BAND_V = PatternFill("solid", fgColor="CDE7FF"); BAND_Q = PatternFill("solid", fgColor="D5F0E0")
TOP = PatternFill("solid", fgColor="5B3FB8"); NOTE = PatternFill("solid", fgColor="FFF7D6")
thin = Side(style="thin", color="C9C0E0"); BOX = Border(left=thin, right=thin, top=thin, bottom=thin)
WRAP = Alignment(wrap_text=True, vertical="top")
WIDTHS = {"A": 22, "B": 62, "C": 14, "D": 58, "E": 14, "F": 12, "G": 12}
LISTS = {"Status": "=Lists!$A$2:$A$4", "VisualType": "=Lists!$B$2:$B$5", "QuestionType": "=Lists!$C$2:$C$5", "Skill": "=Lists!$E$2:$E$9",
         "Yes": "=Lists!$H$2:$H$2", "AxisScale": "=Lists!$J$2:$J$3", "Mistake": "=Lists!$O$2:$O$200", "Item": "=Items!$A$2:$A$300"}

class Tab:
    """Writes one tab top to bottom. Column A = shaded label, the cells to its right = white boxes to fill in."""
    def __init__(self, ws, marker, blurb):
        self.ws, self.r, self.dv = ws, 1, {}
        for c, w in WIDTHS.items(): ws.column_dimensions[c].width = w
        a = ws.cell(1, 1, marker); a.fill = TOP; a.font = Font(bold=True, color="FFFFFF")
        b = ws.cell(1, 2, blurb); b.fill = TOP; b.font = Font(color="FFFFFF"); b.alignment = WRAP
        for j in range(3, 8): ws.cell(1, j).fill = TOP
        ws.row_dimensions[1].height = 48; ws.freeze_panes = "B2"
        ws.sheet_view.showGridLines = False
    def blank(self): self.r += 1
    def field(self, label, values=(), lists=(), note=None, tall=False):
        self.r += 1; r = self.r
        a = self.ws.cell(r, 1, label); a.fill = LABEL; a.font = Font(bold=True); a.alignment = WRAP; a.border = BOX
        if note: a.comment = Comment(note, "Lab for Hire")
        vals = list(values) if isinstance(values, (list, tuple)) else [values]
        n = max(len(vals), len(lists), 1)
        for j in range(n):
            c = self.ws.cell(r, 2 + j, vals[j] if j < len(vals) and vals[j] not in (None, "") else None); c.border = BOX; c.alignment = WRAP
            if j < len(lists) and lists[j]: self.dv.setdefault(lists[j], []).append(c.coordinate)
        if tall: self.ws.row_dimensions[r].height = 62
        return r
    def band(self, label, text, fill):
        self.r += 1
        for j in range(1, 8): self.ws.cell(self.r, j).fill = fill
        self.ws.cell(self.r, 1, label).font = Font(bold=True); self.ws.cell(self.r, 2, text).font = Font(bold=True)
    def caption(self, *texts):
        self.r += 1
        for j, t in enumerate(texts): c = self.ws.cell(self.r, 2 + j, t); c.font = Font(italic=True, color="6B6388", size=9); c.alignment = WRAP
    def finish(self):
        for key, cells in self.dv.items():
            d = DataValidation(type="list", formula1=LISTS[key], allow_blank=True, showErrorMessage=False)
            for c in cells: d.add(c)
            self.ws.add_data_validation(d)

def visual_block(t, n, v=None, points=(), rows=(), blanks=(8, 0)):
    t.band("GRAPH OR TABLE", f"Graph or table {n}" + ("" if v else "  (delete this whole block if the case doesn't need one)"), BAND_V)
    g = (lambda k: col(v, k)) if v else (lambda k: "")
    t.field("Type", g("Type"), ["VisualType"], note="Line graph, Bar graph, Data table, or Phase diagram.")
    t.field("Title", g("Title"))
    t.field("Tab label", g("Tab label"), note="The short name on the button students tap to see this one, such as Graph or Cost table.")
    t.field("Student builds it?", g("Student builds it"), ["Yes"], note="Yes on a line graph = students build the graph from the data before answering questions.")
    kind = g("Type")
    if kind != "Data table":
        t.caption("What the axis measures", "Unit", "Starts at", "Ends at", "Counts by", "Linear or Log")
        for a in ("X", "Y"):
            t.field(f"{a} axis", [g(f"{a} label"), g(f"{a} unit"), g(f"{a} min"), g(f"{a} max"), g(f"{a} step"), g(f"{a} scale")], [None, None, None, None, None, "AxisScale"])
        t.caption("Which line or bar (phase diagrams: Melting line, Boiling line, Sublimation line)", "X", "Y", "Label on the point (optional)")
        for p in points: t.field("Point", [col(p, "Series"), col(p, "X"), col(p, "Y"), col(p, "Point label")])
        for _ in range(blanks[0]): t.field("Point", ["", "", "", ""])
    if kind == "Data table" or not v:
        t.caption("A data table instead? Type it here exactly as students should see it. The first row is the headings.")
        for cells in rows: t.field("Table row", [c for c in cells])
        for _ in range(blanks[1]): t.field("Table row", ["", "", "", "", "", ""])
    t.blank()

def question_block(t, title, q=None, opts=(), for_tag=None, choices=5, labels=None):
    t.band("QUESTION", title, BAND_Q)
    g = (lambda k: col(q, k)) if q else (lambda k: "")
    if for_tag is not None: t.field("For mistake", pick(for_tag), ["Mistake"], note="Which mistake sends a student to this practice question.")
    t.field("Prompt", g("Prompt"), tall=True)
    t.field("Type", g("Type"), ["QuestionType"], note="Multiple choice = 1 right answer. Pick two / Pick three = exactly that many. Select all that apply = at least 1.")
    t.field("Skill", g("Skill"), ["Skill"])
    if for_tag is None:
        show = ", ".join(labels.get(x.strip(), x.strip()) for x in str(g("Shows visual")).split(",") if x.strip()) if q else ""
        t.field("Show only", show, note="Leave blank to keep every graph and table on screen. Or name the one(s) to show, by tab label, separated by commas.")
    t.field("Why it's right", g("Why it"), tall=True, note="Students read this after a correct answer. Write a statement, not a question.")
    t.caption("Answer choice", "Right? (Yes)", "If a student picks this wrong answer, which mistake is it?")
    for o in opts: t.field("Choice", [col(o, "Option text"), col(o, "Correct"), pick(col(o, "Error tag"))], [None, "Yes", "Mistake"])
    for _ in range(max(0, choices - len(opts))): t.field("Choice", ["", "", ""], [None, "Yes", "Mistake"])
    t.blank()

def case_tab(wb, name, c=None, color="25845A"):
    ws = wb.create_sheet(name[:31]); ws.sheet_properties.tabColor = color
    t = Tab(ws, "CASE" if c else "CASE TEMPLATE", "Fill in the white boxes from top to bottom. Leave the shaded labels alone. Students can't see a case until its Status is Live."
            if c else "Don't type here. Use the menu: Lab for Hire > New case. It makes a copy of this tab for you to fill in.")
    g = (lambda k: col(c, k)) if c else (lambda k: "")
    cid = g("CaseID")
    t.field("Case ID", cid, note="Made for you. Please don't change it once students have played this case: their progress is saved under it.")
    t.field("Status", g("Status") or "Draft", ["Status"], note="Draft = only you can see it (in teacher preview). Live = students get it. Teaser = an ad for a case you haven't written yet.")
    t.field("Order", g("Path order"), note="Cases unlock in this order: 1 first.")
    t.field("Title", g("Title"))
    t.field("Client", g("Client"), note="Who is asking for help, such as: Coach Rivera, athletic trainer")
    t.field("Client pitch", g("Client pitch"), tall=True, note="Students read this first. What does the client need, and why?")
    t.field("Win message", g("Win message"), tall=True, note="Shown when the job is finished.")
    t.field("Pay", g("Pay"), note="Dollars for a perfect job. Around 60 to 120.")
    t.field("Requires equipment", g("Requires item"), ["Item"], note="Optional. Students must own this item (from the Items tab) to take the job.")
    t.field("Standard", g("Standard"))
    t.field("Teacher notes", g("Teacher notes"), tall=True, note="Only for teachers: where the data came from, what to watch for.")
    if c:
        qs = sorted([q for q in QS if q["CaseID"] == cid and q["Role"] == "Main"], key=lambda q: q["Order"])
        vis = [v for v in VIS if v["CaseID"] == cid]
        code = (qs[0]["QID"].rsplit("-", 1)[0] if qs else vis[0]["VisualID"].rsplit("-", 1)[0] if vis else "")
        if code and code != cid: t.field("Short code", code, note="Optional. A short name used to number this case's questions.")
        t.blank()
        labels = {v["VisualID"]: (col(v, "Tab label") or col(v, "Type")) for v in vis}
        for n, v in enumerate(vis, 1):
            pts = [d for d in DATA if d["VisualID"] == v["VisualID"]]
            rows = [[r.get(f"Col {k}") for k in range(1, 7)] for r in sorted([r for r in TABLES if r["VisualID"] == v["VisualID"]], key=lambda r: r["Row"])]
            visual_block(t, n, v, pts, rows, blanks=(0, 0))
        for n, q in enumerate(qs, 1):
            question_block(t, f"Question {n}", q, [o for o in OPTS if o["QID"] == q["QID"]], labels=labels, choices=0)
        if not qs and g("Status") != "Teaser": pass      # a job template: the game writes its questions
    else:
        t.blank()
        visual_block(t, 1, blanks=(8, 6))
        for n in range(1, 9): question_block(t, f"Question {n}" + ("" if n < 8 else "  (need more? copy a whole question block and paste it below)"), labels={})
    t.finish()
    return ws

def copy_sheet(wb, name, hidden=False):
    s, d = src[name], wb.create_sheet(name)
    for row in s.iter_rows():
        for c in row:
            n = d.cell(c.row, c.column, c.value)
            if c.has_style: n.font, n.fill, n.border, n.alignment, n.number_format = copy.copy(c.font), copy.copy(c.fill), copy.copy(c.border), copy.copy(c.alignment), c.number_format
            if c.comment: n.comment = Comment(c.comment.text, "Lab for Hire")
    for k, dim in s.column_dimensions.items(): d.column_dimensions[k].width = dim.width
    for dv in s.data_validations.dataValidation: d.add_data_validation(copy.copy(dv))
    d.freeze_panes = s.freeze_panes; d.sheet_properties.tabColor = s.sheet_properties.tabColor
    if hidden: d.sheet_state = "hidden"
    return d

wb = Workbook(); wb.remove(wb.active)
# Start Here: short, and about what to DO
ws = wb.create_sheet("Start Here"); ws.sheet_properties.tabColor = "5B3FB8"; ws.column_dimensions["A"].width = 26; ws.column_dimensions["B"].width = 110
START = [
    ("Lab for Hire", "Schema version 0.5.0. This Sheet is where the game's cases live. Every case is one tab. Students see changes about a minute after you make them."),
    ("", ""),
    ("To write a new case", ""),
    ("1. Start it", "Menu: Lab for Hire > New case. Type a title. You get a new tab, already marked Draft, so students can't see it yet."),
    ("2. Fill it in", "Work from top to bottom: who the client is, the graph or table, then each question with its answer choices. Fill the white boxes; leave the shaded labels alone."),
    ("3. Wrong answers", "For every wrong answer choice, pick the mistake it shows from the dropdown (they are written in plain words). That is how the game knows which kind of help to give. Right answers: put Yes in the Right? box. Need a mistake that isn't listed? Add a row to SideMissions."),
    ("4. Check it", "Menu: Lab for Hire > Check my content. It tells you, by tab and row, anything that needs fixing. One broken case never affects the others."),
    ("5. Try it", "Open the game with ?preview=1 on the end of its address. Drafts show up there, only for you."),
    ("6. Turn it on", "Change the case's Status to Live. Done."),
    ("", ""),
    ("The other tabs", ""),
    ("Each case", "A tab per case. Look at Movin' Molecules for a finished example with a graph students build, or The Winter Bounce Test for a table plus a bar graph."),
    ("New case template", "The blank that New case copies. Don't type in it."),
    ("Practice questions", "The fresh question a student gets after a science (Archive) side mission. Each one says which mistake it is for."),
    ("SideMissions", "The list of mistakes and the help students get for each. Calibration = a graph-reading mistake (the game makes fresh practice graphs). Archive = a science mistake (you write the reteach here)."),
    ("Items", "The lab store: equipment, furniture, pets, paint. Price 0 = part of every student's starter lab."),
    ("", ""),
    ("Good to know", ""),
    ("The Cold Pack case", "It is a job template: the game makes new data and new questions each time, so its tab has no graph or questions. You can still edit its title, client, pitch, win message, and pay."),
    ("Phase diagrams", "The lines must be named Melting line, Boiling line, or Sublimation line. The game works out the solid, liquid, and gas regions, and checks your answer keys against them."),
    ("Log scales", "For an axis like 0.1, 1, 10, 100: put Log in the last box of that axis row, start above 0, and leave Counts by blank."),
    ("Nothing breaks", "If a case has a problem, the game holds back that one case and keeps running the rest. If the whole Sheet can't be read, students get the last good copy."),
]
for i, (a, b) in enumerate(START, 1):
    ca, cb = ws.cell(i, 1, a or None), ws.cell(i, 2, b or None); cb.alignment = WRAP; ca.alignment = WRAP
    if a and not b: ca.font = Font(bold=True, size=13, color="5B3FB8")
    elif a: ca.font = Font(bold=True)
ws["A1"].font = Font(bold=True, size=15, color="5B3FB8")

for c in sorted(CASES, key=lambda c: c["Path order"]):
    case_tab(wb, col(c, "Title"), c, color={"Live": "25845A", "Teaser": "9A93B5"}.get(c["Status"], "C98313"))
case_tab(wb, "New case template", None, color="C98313")

ws = wb.create_sheet("Practice questions"); ws.sheet_properties.tabColor = "6547CF"
t = Tab(ws, "CHECKS", "After a science (Archive) side mission, the student gets one of these to try the idea again. Each says which mistake it is for. To add one, copy a whole question block.")
for n, q in enumerate([q for q in QS if q["Role"] == "Check"], 1):
    question_block(t, f"Practice question {n}", q, [o for o in OPTS if o["QID"] == q["QID"]], for_tag=col(q, "Check for tag"), choices=0)
for n in range(3): question_block(t, "A new practice question", for_tag="", choices=3)
t.finish()

SM = copy_sheet(wb, "SideMissions"); copy_sheet(wb, "Items")
h = SM.cell(1, 7, "In plain words (shown in the Mistake dropdown)"); h.font = copy.copy(SM.cell(1, 1).font); h.fill = copy.copy(SM.cell(1, 1).fill); h.alignment = copy.copy(SM.cell(1, 1).alignment)
SM.column_dimensions["G"].width = 58
for r in range(2, SM.max_row + 1):
    if SM.cell(r, 1).value: SM.cell(r, 7, PLAIN[SM.cell(r, 1).value]).alignment = WRAP
L = copy_sheet(wb, "Lists", hidden=True)
L.cell(1, 15, "MistakePick").font = copy.copy(L.cell(1, 1).font)
for r in range(2, 201): L.cell(r, 15, f'=IF(SideMissions!A{r}="","",IF(SideMissions!G{r}="",SideMissions!A{r},SideMissions!G{r}&" | "&SideMissions!A{r}))')
wb.save(OUT)
print("wrote", os.path.relpath(OUT, ROOT), "tabs:", ", ".join(wb.sheetnames))
