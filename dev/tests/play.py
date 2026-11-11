"""Headless playthrough of the whole Lab for Hire loop (v0.5.0).
Usage: python3 dev/tests/play.py index.html (or just: bash dev/check.sh)
Name the lab -> laptop -> inbox -> accept each job -> do the work (answers from the embedded key)
-> paid -> reply email -> shop. Also proves: Bounce Lab stays locked until the pressure gauge is bought,
a mid-job reload resumes where the student left off, an Archive detour works, and (v0.4.0) the lab the
loop just built survives a wiped device via the backup file: identical progress, and a hand-edited file is refused.
v0.5.0: Cold Pack is a JOB TEMPLATE. The first play is Hanson's example: plan (with a forced planning mistake and
its Archive detour), run (with a reload that must resume at the Run step), analyze, and a strong CER recommendation,
which must bring a sequel email. A deliberately weak sequel must bring a follow-up email with fresh data."""
import json, os, re, sys
import tempfile
from playwright.sync_api import sync_playwright
HTML = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else "index.html")
src = open(HTML, encoding="utf-8").read()
C = json.loads(re.search(r'<script id="lfh-content" type="application/json">([\s\S]*?)</script>', src).group(1).replace("<\\/", "</"))
correct = {}
for o in C["options"]:
    if o["correct"]: correct.setdefault(o["qid"], []).append(o["text"])
url = "file://" + HTML
errs, log = [], []
def pick(pg, texts):
    for t in texts: [b for b in pg.query_selector_all("[data-opt]") if b.inner_text().strip() == t][0].click()
def funds(pg): return int(pg.inner_text(".funds").strip("$"))
def accept(pg, cid):
    pg.click("[data-act=inbox]"); pg.click(f"[data-mail='job-{cid}']"); pg.click(f"[data-accept='{cid}']"); pg.click("[data-act=begin]")
def build(pg, c):
    vis = next((v for v in C["visuals"] if v["caseId"] == c["id"] and v["build"]), None)
    if not vis: return
    for step in ("Temperature", "up to 800"):
        [x for x in pg.query_selector_all("[data-bopt]") if step in x.inner_text()][0].click()
    X, Y = vis["x"], vis["y"]
    for k, (x, y) in enumerate([(d["x"], d["y"]) for d in C["data"] if d["visualId"] == vis["id"]]):
        if k == 2:   # mid-build reload: the job must resume at point 3 with two points placed
            pg.reload(); pg.wait_for_timeout(200); pg.click("[data-act=bench]")
            assert "Point 3 of 5" in pg.inner_text("main"), "resume after reload failed"; log.append("resume after reload: OK")
        box = pg.query_selector(".plot-target").bounding_box(); sx, sy = box["width"] / 640, box["height"] / 440
        pg.mouse.click(box["x"] + (80 + (x - X["min"]) / (X["max"] - X["min"]) * 536) * sx, box["y"] + (52 + (1 - (y - Y["min"]) / (Y["max"] - Y["min"])) * 324) * sy)
        pg.click("[data-act=place]")
    [b for b in pg.query_selector_all("[data-title]") if b.inner_text().strip() == vis["title"]][0].click()
    pg.click("[data-act=certify]"); pg.click("[data-act=toQuestions]")
def template_job(pg, cid, offer_js, mistakes=True, weak=False):
    """Drive a generated job. Answers come from the engine's instance for this exact offer (same seed = same job)."""
    qs = pg.evaluate(f"LFH.instance({json.dumps(cid)}, {offer_js}).qs.map(q => ({{prompt: q.prompt, stage: q.stage, label: q.label || '', planNote: q.planNote || '', right: q.options.filter(o => o.correct).map(o => o.text), wrong: q.options.filter(o => !o.correct).map(o => o.text)}}))")
    pg.click("[data-act=begin]")
    planned = 0
    for q in qs:
        if pg.query_selector("[data-act=analyze]"):
            if mistakes:   # reload on the Run screen: the job must come back to the Run screen
                pg.reload(); pg.wait_for_timeout(200); pg.click("[data-act=bench]")
                assert pg.query_selector("[data-act=analyze]"), "run screen did not resume after reload"; log.append("template resume at Run step: OK")
            assert "average of the 3 trials" in pg.inner_text("main")
            pg.click("[data-act=analyze]")
        assert pg.inner_text(".prompt") == q["prompt"], f"expected {q['prompt']!r}, got {pg.inner_text('.prompt')!r}"
        if mistakes and q["stage"] == "plan" and planned == 0:   # a planning mistake -> Archive side mission -> back with a Remember strip
            pick(pg, [q["wrong"][0]]); pg.click("[data-act=submit]"); pg.click("[data-act=mission]")
            assert "The Archive" in pg.inner_text("main")
            cq = next(x for x in C["questions"] if x["role"] == "Check" and x["prompt"] == pg.inner_text(".prompt"))
            assert cq["forTag"].startswith("PLAN-"), cq["forTag"]
            pick(pg, correct[cq["id"]]); pg.click("[data-act=mcheck]"); pg.click("[data-act=return]")
            assert pg.query_selector(".remember"), "Remember strip missing after plan mission"
        if weak and q["label"] == "Claim":   # two wrong claims -> answer shown -> weak recommendation
            for w in q["wrong"][:2]:
                if pg.query_selector("[data-act=mission]"): pg.click("[data-act=mission]"); pg.click("[data-opt]"); pg.click("[data-act=mcheck]"); pg.click("[data-act=return]")
                pick(pg, [w]); pg.click("[data-act=submit]")
            assert pg.query_selector(".fb-reveal"), "second wrong claim should reveal the answer"
            pg.click("[data-act=next]"); continue
        pick(pg, q["right"]); pg.click("[data-act=submit]")
        assert "Correct" in pg.inner_text(".fb"), f"{q['prompt'][:50]} not graded correct"
        if q["stage"] == "plan":
            planned += 1
            assert q["planNote"] in pg.inner_text(".plan-card"), "plan card should list the decision"
        pg.click("[data-act=next]")
    assert pg.query_selector(".rec-verdict"), "report should show the recommendation verdict"
    return "good" in pg.get_attribute(".rec-verdict", "class")
def answer_all(pg, c):
    qs = sorted([q for q in C["questions"] if q["caseId"] == c["id"] and q["role"] == "Main"], key=lambda q: q["order"])
    for q in qs:
        if q["id"] == "PH-04":   # forced Archive detour on Hanson's named misconception
            [b for b in pg.query_selector_all("[data-opt]") if "Charlie" in b.inner_text()][0].click(); pg.click("[data-act=submit]")
            pg.click("[data-act=mission]")
            cq = next(x for x in C["questions"] if x["role"] == "Check" and x["prompt"] == pg.inner_text(".prompt"))
            pick(pg, correct[cq["id"]]); pg.click("[data-act=mcheck]"); pg.click("[data-act=return]")
            assert pg.query_selector(".remember"), "Remember strip missing after mission"
        pick(pg, correct[q["id"]]); pg.click("[data-act=submit]")
        assert "Correct" in pg.inner_text(".fb"), f"{q['id']} not graded correct"
        pg.click("[data-act=next]")
with sync_playwright() as p:
    br = p.chromium.launch(); pg = br.new_page(viewport={"width": 1366, "height": 900})
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(url); pg.wait_for_timeout(300)
    pg.click("[data-name-adj=Curious]"); pg.click("[data-name-noun=Comet]"); pg.click("[data-act=nameDone]")
    assert "The Curious Comet Lab" in pg.inner_text(".wordmark")
    jobs = sorted([c for c in C["cases"] if c["status"] == "Live"], key=lambda c: c["order"])
    lab = lambda: json.loads(pg.evaluate("localStorage.getItem('lfh.progress')"))["lab"]
    placed = lambda: lab()["rooms"]["main"]["placed"]
    # ---- the starter lab, and the room as the way in: tapping the laptop opens the inbox, tapping the bench goes to the workbench ----
    pg.wait_for_selector("#labroom image")
    assert placed().get("bench") == "desk" and placed().get("bench-2") == "laptop" and "bench-3" not in placed(), f"starter lab: {placed()}"
    def tap_item(sprite_key, fx=0.5, fy=0.6):   # a real tap on the picture of an item in the room
        box = pg.evaluate("""([k, fx, fy]) => { const A = JSON.parse(document.getElementById('lfh-art').textContent), sp = A.manifest.sprites[k];
            const svg = document.querySelector('#labroom svg'), pt = svg.createSVGPoint(); pt.x = sp.x + sp.w * fx; pt.y = sp.y + sp.h * fy;
            const c = pt.matrixTransform(svg.getScreenCTM()); return [c.x, c.y]; }""", [sprite_key, fx, fy])
        pg.wait_for_timeout(250); pg.mouse.click(box[0], box[1])
    tap_item("laptop@bench-2"); assert pg.query_selector(".laptop"), "tapping the laptop in the room opens it"
    pg.click("[data-act=room]"); pg.wait_for_selector("#labroom image")
    tap_item("desk@bench", 0.8, 0.75); assert "Your bench is clear" in pg.inner_text("main"), "tapping the bench goes to the workbench: " + pg.inner_text("main")[:300]
    pg.click("[data-act=room]")
    log.append("starter lab is right; tapping the laptop and the bench in the room works")
    for c in jobs:
        if c.get("requires"):
            pg.click("[data-act=inbox]"); pg.click(f"[data-mail='job-{c['id']}']")
            assert not pg.query_selector(f"[data-accept='{c['id']}']"), f"{c['id']} should be locked"
            item = next(i for i in C["items"] if i["id"] == c["requires"])
            pg.click("[data-act=decorate]"); pg.click(f"[data-item='{item['id']}']")
            assert f"Unlocks {item['unlocks']}" in pg.inner_text(f"[data-item='{item['id']}']"), "the store says what the equipment unlocks"
            pg.click(f"[data-buy='{item['id']}']")
            assert item["id"] in lab()["owned"], "bought equipment is owned"
            log.append(f"bought {item['id']} to unlock {c['id']}"); pg.click("[data-act=room]")
        before = funds(pg)
        if c["id"] == "COLD-PACK":   # job template, first play = Hanson's example
            pg.click("[data-act=inbox]"); pg.click("[data-mail='job-COLD-PACK']")
            assert "Colder than 10°C at 2 minutes" in pg.inner_text(".mail-view"), "first Cold Pack email shows her rules"
            pg.click("[data-accept='COLD-PACK']")
            strong = template_job(pg, "COLD-PACK", "{n: 1, variant: 'classic', seed: 1}")
            assert strong, "a perfect recommendation should be strong"
        else:
            accept(pg, c["id"]); build(pg, c); answer_all(pg, c)
        paid = int(re.search(r"\$(\d+)", pg.inner_text(".pay-line")).group(1))
        pg.click("[data-act=celebrate]"); after = funds(pg)
        assert after == before + paid, f"{c['id']}: funds {before} + {paid} != {after}"
        log.append(f"{c['id']}: paid ${paid}, funds now ${after}")
        if c["id"] == "MOVIN-MOLECULES":   # the graph the student built is framed on the wall (an Award: earned, never sold)
            aw = lab()["awards"].get("graph-frame"); spec = next(v for v in C["visuals"] if v["id"] == "MM-GRAPH")
            want = sorted([[d["x"], d["y"]] for d in C["data"] if d["visualId"] == "MM-GRAPH"])
            assert aw and sorted(aw["points"]) == want and aw["title"] == c["title"], f"award should carry the built graph's real points: {aw}"
            assert placed().get("poster-left") == "graph-frame" and pg.query_selector("#labroom polyline"), "the framed graph is on the wall, drawn from those points"
            log.append("built graph earned the framed 'Your Graph' award, on the wall")
    # ---- the client comes back: strong work earned a sequel (hot packs); do it badly on purpose -> follow-up ----
    store = lambda: json.loads(pg.evaluate("localStorage.getItem('lfh.progress')"))
    off = store()["offers"]["COLD-PACK"]; assert off["n"] == 2 and off["variant"] == "hot" and off["kind"] == "sequel", off
    pg.click("[data-act=inbox]"); pg.click("[data-mail='offer-COLD-PACK-2']")
    assert "Warmer than" in pg.inner_text(".mail-view") and "HOT packs" in pg.inner_text(".mail-view"), "sequel email states the new rules"
    before = funds(pg); pg.click("[data-offer='COLD-PACK']")
    strong = template_job(pg, "COLD-PACK", json.dumps(off), mistakes=False, weak=True)
    assert not strong, "two wrong claims should be a weak recommendation"
    paid = int(re.search(r"\$(\d+)", pg.inner_text(".pay-line")).group(1)); pg.click("[data-act=celebrate]")
    assert funds(pg) == before + paid, "sequel pay adds up"; assert 70 * 0.25 < paid <= 56 + 5 * 3, f"weak sequel: partial fee (not the 25% replay rate, not the full fee), got {paid}"
    off3 = store()["offers"]["COLD-PACK"]; assert off3["n"] == 3 and off3["variant"] == "followup", off3
    log.append(f"COLD-PACK sequel (hot packs, weak on purpose): paid ${paid}; follow-up #3 offered with fresh data")
    pg.click("[data-act=inbox]")
    replies = [m for m in pg.query_selector_all(".mail") if "payment enclosed" in m.inner_text()]
    assert len(replies) == len(jobs) + 1, "a reply email per finished job"
    pg.click("[data-mail='offer-COLD-PACK-3']"); assert "fresh batch" in pg.inner_text(".mail-view"), "follow-up explains the fresh data"
    # ---- the store: buy, paint, a table that opens two more spots, storage ----
    pg.click("[data-act=decorate]"); f0 = funds(pg)
    pg.click("[data-item='pet-cat']"); pg.click("[data-buy='pet-cat']")
    assert placed().get("pet") == "pet-cat" and funds(pg) == f0 - 80, "buying the cat puts it in the room and takes the price (top bar and save agree)"
    pg.click("[data-item='work-table']"); pg.click("[data-buy='work-table']")
    assert placed().get("table") == "work-table" and funds(pg) == f0 - 200, "the work table is bought and placed"
    assert pg.query_selector("[data-buy='microscope']") is None
    pg.click("[data-item='microscope']"); f1 = funds(pg); want = f"Need ${150 - f1} more" if f1 < 150 else "Buy for $150"
    assert pg.inner_text(".lr-card.on .lr-act") == want, f"the microscope button should say '{want}' with ${f1}: " + pg.inner_text(".lr-card.on .lr-act")
    pg.click(".lr-tabs button:has-text('Paint')"); pg.click("[data-item='wall-lavender']"); pg.click("[data-buy='wall-lavender']")
    assert lab()["rooms"]["main"]["paint"]["wall"] == "wall-lavender" and funds(pg) == f0 - 240, "paint applies right away"
    pg.click(".lr-tabs button:has-text('Store')"); pg.click("[data-item='work-table']"); pg.click(".lr-card.on .lr-act")   # take the table out
    assert "table" not in placed() and "work-table" in lab()["owned"], "taking something out sends it to storage; it is still owned"
    assert "Storage (1)" in pg.inner_text(".lr-tabs"), "the Storage tab counts it"
    pg.click(".lr-tabs button:has-text('Storage')"); pg.click("[data-item='work-table']"); pg.click(".lr-card.on .lr-act")
    assert placed().get("table") == "work-table", "and storage puts it back"
    assert json.loads(pg.evaluate("localStorage.getItem('lfh.progress')"))["funds"] == funds(pg), "the saved funds and the top bar are the same number"
    pg.click("[data-act=room]"); pg.wait_for_selector("#labroom image")
    assert len(pg.query_selector_all("#labroom image")) >= 9, "cat and table should be in the room"
    log.append("store: bought a cat, a work table, and paint; storage round trip OK")
    pg.screenshot(path=os.path.join(tempfile.gettempdir(), "lfh_play_end_room.png"))   # never write into the repo
    # ---- Save file: back up the REAL lab this loop built, wipe the device, restore from the file ----
    store = lambda: json.loads(pg.evaluate("localStorage.getItem('lfh.progress')"))
    before = store(); before_funds = funds(pg)
    pg.click("[data-act=laptop]"); pg.click("[data-app=ledger]")
    assert "Last backup: never" in pg.inner_text(".backup"), "fresh lab should say never backed up"
    with pg.expect_download() as dl: pg.click("[data-act=saveFile]")
    save_path = os.path.join(tempfile.gettempdir(), "lfh_play_backup.json"); dl.value.save_as(save_path)
    assert dl.value.suggested_filename.startswith("Curious-Comet-lab-backup-"), dl.value.suggested_filename
    assert "Last backup: today" in pg.inner_text(".backup"), "ledger should show today's backup"
    pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(200)
    assert pg.query_selector("[data-act=nameDone]"), "wiped device should start at the name screen"
    # hand-edited file is refused, and nothing changes
    BAD = os.path.join(tempfile.gettempdir(), "lfh_bad.json")
    bad = json.load(open(save_path)); bad["progress"]["funds"] = 99999; json.dump(bad, open(BAD, "w"))
    with pg.expect_file_chooser() as fc: pg.click("[data-act=loadFile]")
    fc.value.set_files(BAD); pg.wait_for_timeout(200)
    assert "changed or damaged" in pg.inner_text("main"), "edited save should be refused"
    assert pg.query_selector("[data-act=nameDone]"), "refused file must leave the device untouched"
    # the real file restores the lab
    dialogs = []
    pg.once("dialog", lambda d: (dialogs.append(d.message), d.accept()))
    with pg.expect_file_chooser() as fc: pg.click("[data-act=loadFile]")
    fc.value.set_files(save_path); pg.wait_for_timeout(300)
    assert dialogs and "The Curious Comet Lab" in dialogs[0] and f"${before_funds}" in dialogs[0], dialogs
    after = store()
    for k in ("labName", "funds", "lab", "cases", "history", "inbox", "bayCorrect", "bayBest", "offers"):
        assert after[k] == before[k], f"restore changed {k}: {before[k]!r} -> {after[k]!r}"
    assert funds(pg) == before_funds and "The Curious Comet Lab" in pg.inner_text(".wordmark"), "room shows the restored lab"
    pg.wait_for_selector("#labroom image"); assert len(pg.query_selector_all("#labroom image")) >= 9, "restored room still has the cat and the table"
    log.append(f"backup -> wipe -> restore: OK ({before_funds} funds, {sum(1 for c in after['cases'].values() if c.get('done'))} jobs, edited file refused)")
    br.close()
print("\n".join(log)); print("JS errors:", errs)
