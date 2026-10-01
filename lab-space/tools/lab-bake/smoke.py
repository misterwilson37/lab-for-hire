"""Smoke test for lab.html: clicks through like a student, then reloads to prove the lab was saved.
usage: python3 smoke.py <folder containing lab.html>
Also screenshots the handoff's test sizes (1366x768, iPad 1080x810 and 810x1080, phone 390x844) plus dark mode into /tmp.
"""
import sys, json
from harness import serve, GL_ARGS
from playwright.sync_api import sync_playwright

base = serve(sys.argv[1], 8767)
fails = []
def check(ok, what):
    print(("PASS " if ok else "FAIL ") + what)
    if not ok: fails.append(what)

with sync_playwright() as p:
    b = p.chromium.launch(args=GL_ARGS)
    ctx = b.new_context(viewport={"width": 1180, "height": 820})
    pg = ctx.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    # font requests are blocked on purpose (school filters may block Google Fonts); their load errors don't count
    pg.on("console", lambda m: m.type == "error" and "Failed to load resource" not in m.text and errs.append(m.text))
    pg.on("requestfailed", lambda r: "fonts.g" not in r.url and errs.append("failed to load " + r.url))
    pg.route("**/fonts.g*/**", lambda r: r.abort())
    pg.goto(base + "/lab.html"); pg.wait_for_timeout(500)
    funds = lambda: pg.locator(".lr-funds").inner_text()
    check(funds() == "$100", "starts with $100 (got %s)" % funds())
    check(pg.locator(".lr-svg image").count() == 7, "starter lab shows 7 items")
    pg.click("#job"); pg.click("#job"); pg.wait_for_timeout(100)
    check(funds() == "$220", "two finished jobs pay +$60 each (got %s)" % funds())
    check(pg.locator("#rankName").inner_text() == "Technician", "40 rep reaches Technician")
    # buy the microscope from the store and put it on the bench
    pg.click('[data-k="microscope"]'); pg.wait_for_timeout(100)
    pg.click(".lr-card.on .lr-act"); pg.wait_for_timeout(100)
    check(funds() == "$70", "microscope costs $150 (got %s)" % funds())
    act = pg.locator(".lr-card.on .lr-act")
    if act.count() and "Put it" in act.inner_text(): act.click(); pg.wait_for_timeout(100)
    check(pg.locator(".lr-chip").count() >= 1, "owning the microscope shows an unlock chip")
    # paint: buy the lavender wall
    pg.click('.lr-tabs button:has-text("Paint")'); pg.wait_for_timeout(100)
    pg.click('[data-k="wall-lavender"]'); pg.wait_for_timeout(100); pg.click(".lr-card.on .lr-act"); pg.wait_for_timeout(100)
    act = pg.locator(".lr-card.on .lr-act")
    if act.count() and "Put it" in act.inner_text(): act.click(); pg.wait_for_timeout(100)
    check(funds() == "$30", "lavender walls cost $40 (got %s)" % funds())
    saved = json.loads(pg.evaluate("localStorage.getItem('lfh.labDemo')"))
    check(saved["lab"]["paint"]["wall"] == "wall-lavender", "wall paint saved as the item ID")
    check("microscope" in saved["lab"]["placed"].values(), "microscope is placed in the lab")
    check(pg.evaluate("localStorage.getItem('lfh.progress')") is None, "demo never touches the real game's lfh.progress")
    # tap a room spot: the floor machine spot (empty in the starter lab)
    pg.locator('.lr-slot-focus[aria-label^="Floor machine"]').focus(); pg.keyboard.press("Enter"); pg.wait_for_timeout(100)
    check(pg.locator(".lr-back").count() == 1, "tapping a room spot opens that spot's list")
    pg.reload(); pg.wait_for_timeout(500)
    check(funds() == "$30", "funds survive a reload")
    check(pg.locator(".lr-svg image").count() >= 8, "placed items survive a reload")
    pg.click("#reset"); pg.wait_for_timeout(100)
    check(funds() == "$100", "Reset demo returns to $100")
    check(not errs, "no JavaScript errors " + (str(errs) if errs else ""))
    ctx.close()
    for name, w, h, scheme in [("desk_1366", 1366, 768, "light"), ("ipad_land", 1080, 810, "light"), ("ipad_port", 810, 1080, "light"),
                               ("phone", 390, 844, "light"), ("ipad_dark", 1080, 810, "dark")]:
        c = b.new_context(viewport={"width": w, "height": h}, color_scheme=scheme); q = c.new_page()
        q.route("**/fonts.g*/**", lambda r: r.abort()); q.goto(base + "/lab.html"); q.wait_for_timeout(500)
        wide = q.evaluate("document.body.scrollWidth <= innerWidth")
        check(wide, f"{name}: no sideways scrolling"); q.screenshot(path=f"/tmp/{name}.png"); c.close()
    b.close()
print("ALL PASS" if not fails else f"{len(fails)} FAILED")
sys.exit(1 if fails else 0)
