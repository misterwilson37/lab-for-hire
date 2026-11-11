"""Real browser, real feeds: the Apps Script (running on the real seed data) builds each feed, Chromium plays against it.
Usage: python3 play_feed.py <path to index.html>      (needs node, Playwright + Chromium)"""
import json, os, re, subprocess, sys, tempfile
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
HTML = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "../../index.html"))
tmp = tempfile.mkdtemp(); subprocess.run(["node", os.path.join(HERE, "make_feeds.js"), tmp], check=True, stdout=subprocess.DEVNULL)
FEEDS = {n[:-5]: open(os.path.join(tmp, n)).read() for n in os.listdir(tmp)}
src = open(HTML, encoding="utf-8").read()
page_file = os.path.join(tmp, "page.html")
open(page_file, "w", encoding="utf-8").write(src.replace('{"feedUrl": ""}', '{"feedUrl": "https://feed.test/exec"}', 1))
URL = "file://" + page_file
state = {"feed": "seed", "fail": False, "hits": 0}
errs, log = [], []
def handler(route):
    state["hits"] += 1
    if state["fail"]: return route.abort()
    route.fulfill(status=200, content_type="application/json", headers={"access-control-allow-origin": "*"}, body=FEEDS[state["feed"]])
def key_for(feed):
    c = json.loads(FEEDS[feed]); k = {}
    for o in c["options"]:
        if o["correct"]: k.setdefault(o["qid"], []).append(o["text"])
    return c, k
def new_page(br, preview=False, ctx=None):
    ctx = ctx or br.new_context(viewport={"width": 1366, "height": 900})
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e))); pg.route("https://feed.test/**", handler)
    pg.goto(URL + ("?preview=1" if preview else "")); pg.wait_for_selector("main")
    return pg, ctx
def name_lab(pg):
    if pg.query_selector("[data-act=nameDone]"):
        pg.click("[data-name-adj=Curious]"); pg.click("[data-name-noun=Comet]"); pg.click("[data-act=nameDone]")
def mail_text(pg): pg.click("[data-act=inbox]"); return pg.inner_text(".mail-list")
with sync_playwright() as p:
    br = p.chromium.launch()
    # 1. Hanson edits the Sheet -> the game shows it (title, pay, and shop price)
    state["feed"] = "edited"; pg, ctx = new_page(br); name_lab(pg)
    t = mail_text(pg); assert "Edited By Hanson" in t, "edited title should reach the inbox"
    pg.click("[data-mail='job-MOVIN-MOLECULES']"); assert "Pays up to $75" in pg.inner_text(".mail-view"), "edited pay should show"
    pg.click("[data-app=shop]"); card = [c for c in pg.query_selector_all(".item") if "Lab cat" in c.inner_text()][0]; assert "$90" in card.inner_text(), "edited price should show"
    log.append("1. edits in the Sheet reach the game: title, pay, shop price: OK")
    # 2. the network dies: the last good copy keeps the edits
    state["fail"] = True; pg.close(); pg, ctx = new_page(br, ctx=ctx)
    assert "Edited By Hanson" in mail_text(pg), "offline should fall back to the last good copy"; log.append("2. offline: the last good copy still shows the edits: OK")
    # 3. a brand-new device that is offline gets the built-in content
    pg2, _ = new_page(br); name_lab(pg2); assert "Movin' Molecules" in mail_text(pg2) and "Edited By" not in pg2.inner_text(".mail-list"); log.append("3. offline on a fresh device: built-in content: OK")
    state["fail"] = False; ctx.close()
    # 4. one broken case is held back; the rest still play
    state["feed"] = "broken"; pg, ctx = new_page(br); name_lab(pg); t = mail_text(pg)
    assert "Movin' Molecules" not in t and pg.query_selector("[data-mail='job-COLD-PACK']"), "broken case held, next job open"; log.append("4. one broken case is held back, the next job is open: OK"); ctx.close()
    # 5. the Sheet as found (old layout): students get the built-in content; the teacher is told exactly why
    state["feed"] = "asfound"; pg, ctx = new_page(br); name_lab(pg); assert "Movin' Molecules" in mail_text(pg) and any(i["id"] == "CELL-CLINIC" for i in json.loads(FEEDS["seed"])["cases"]) and pg.query_selector("[data-mail='job-CELL-CLINIC']"), "students keep the full built-in game"
    ctx.close(); pg, ctx = new_page(br, preview=True); name_lab(pg); pg.click("[data-act=inbox]"); pg.click("[data-app=ledger]")
    b = pg.inner_text(".preview-banner"); assert "The live Sheet was NOT used" in b and "needs upgrading" in b and "built into this page" in b, "preview banner explains: " + b[:200]
    log.append("5. old-layout Sheet: students unaffected; teacher preview says why: OK"); ctx.close()
    # 6. Hanson adds a question and an answer choice while a student is mid-job: the student resumes safely
    state["feed"] = "seed"; pg, ctx = new_page(br, preview=True)   # preview releases every job, so the second one can start directly
    name_lab(pg); pg.click("[data-act=inbox]"); pg.click("[data-mail='job-PHASE-PROBE']"); pg.click("[data-accept='PHASE-PROBE']"); pg.click("[data-act=begin]")
    cseed, kseed = key_for("seed")
    qs = sorted([q for q in cseed["questions"] if q["caseId"] == "PHASE-PROBE" and q["role"] == "Main"], key=lambda q: q["order"]); assert len(qs) == 8
    def answer(q, key):
        for t in key[q["id"]]: [b for b in pg.query_selector_all("[data-opt]") if b.inner_text().strip() == t][0].click()
        pg.click("[data-act=submit]"); assert "Correct" in pg.inner_text(".fb"); pg.click("[data-act=next]")
    for q in qs[:3]: answer(q, kseed)
    state["feed"] = "midjob_after"; pg.reload(); pg.wait_for_selector("main"); pg.click("[data-act=bench]")
    prog = pg.get_attribute(".progress", "aria-label"); assert prog == "Question 4 of 9", "should resume at question 4 of the NEW 9: " + str(prog)
    cafter, kafter = key_for("midjob_after")
    qa = sorted([q for q in cafter["questions"] if q["caseId"] == "PHASE-PROBE" and q["role"] == "Main"], key=lambda q: q["order"]); assert len(qa) == 9
    for q in qa[3:]: answer(q, kafter)
    assert "Job complete" in pg.inner_text("main"), "the job should finish after the edit"; log.append("6. a question + an answer choice added mid-job: the student resumes at the right place and finishes: OK")
    # 7. the case a student is part-way through is removed: the bench is simply clear
    pg.click("[data-act=celebrate]"); pg.click("[data-act=inbox]"); pg.click("[data-mail='job-PHASE-PROBE']"); pg.click("[data-accept='PHASE-PROBE']"); pg.click("[data-act=begin]")
    state["feed"] = "removed"; pg.reload(); pg.wait_for_selector("main"); pg.click("[data-act=bench]")
    assert "Your bench is clear" in pg.inner_text("main"), "removed case: no crash, empty bench"; log.append("7. the case a student was mid-way through is removed: empty bench, no crash: OK")
    br.close()
print("\n".join(log)); print("requests to the feed:", state["hits"]); print("JS errors:", errs); sys.exit(1 if errs else 0)
