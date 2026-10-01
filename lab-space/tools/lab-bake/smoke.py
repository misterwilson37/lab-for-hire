"""Smoke test for lab.html (lab space v0.2.0): clicks through like a student, then reloads to prove the lab was saved.
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
    saved = lambda: json.loads(pg.evaluate("localStorage.getItem('lfh.labDemo')"))
    room = lambda: saved()["lab"]["rooms"]["main"]
    def act(): pg.wait_for_timeout(80); pg.click(".lr-card.on .lr-act"); pg.wait_for_timeout(80)
    def tab(name): pg.click('.lr-tabs button:has-text("%s")' % name); pg.wait_for_timeout(80)
    def spot(label): pg.locator('.lr-slot-focus[aria-label^="%s"]' % label).focus(); pg.keyboard.press("Enter"); pg.wait_for_timeout(80)
    def back(): pg.click(".lr-back"); pg.wait_for_timeout(80)

    # ---- v0.1.0 behavior ----
    check(funds() == "$100", "starts with $100 (got %s)" % funds())
    check(pg.locator(".lr-svg image").count() == 7, "starter lab shows 7 items")
    check(pg.locator('.lr-slot-focus[aria-label^="Second table"]').count() == 1, "only the empty Work Table spot shows; its 2 spots stay hidden")
    pg.click("#job"); pg.click("#job"); pg.wait_for_timeout(100)
    check(funds() == "$220", "two finished jobs pay +$60 each (got %s)" % funds())
    check(pg.locator("#rankName").inner_text() == "Technician", "40 rep reaches Technician")
    pg.click('[data-k="microscope"]'); act()
    check(funds() == "$70", "microscope costs $150 (got %s)" % funds())
    check(pg.locator(".lr-chip").count() >= 1, "owning the microscope shows an unlock chip")
    tab("Paint"); pg.click('[data-k="wall-lavender"]'); act()
    check(funds() == "$30", "lavender walls cost $40 (got %s)" % funds())
    check(saved()["lab"].get("v") == 2, "saves in the v2 (wing-ready) shape")
    check(room()["paint"]["wall"] == "wall-lavender", "wall paint saved as the item ID")
    check("microscope" in room()["placed"].values(), "microscope is placed in the lab")
    check(pg.evaluate("localStorage.getItem('lfh.progress')") is None, "demo never touches the real game's lfh.progress")
    spot("Floor machine"); check(pg.locator(".lr-back").count() == 1, "tapping a room spot opens that spot's list"); back()
    pg.reload(); pg.wait_for_timeout(500)
    check(funds() == "$30", "funds survive a reload")
    check(pg.locator(".lr-svg image").count() >= 8, "placed items survive a reload")

    # ---- v0.2.0: Work Table ----
    for _ in range(8): pg.click("#job")
    pg.wait_for_timeout(100)
    tab("Store"); pg.click('[data-k="work-table"]'); act()
    check(funds() == "$390", "Work Table costs $120 (got %s)" % funds())
    check(room()["placed"].get("table") == "work-table", "Work Table goes in the second-table spot")
    check(pg.locator('.lr-slot-focus[aria-label^="Second table, back"]').count() == 1, "buying the Work Table opens its 2 spots")
    spot("Second table, back"); pg.click('[data-k="microscope"]'); act()
    check(room()["placed"].get("table-1") == "microscope", "microscope moves onto the Work Table")
    back()
    spot("Second table: Work Table"); pg.click('.lr-act.alt:has-text("Leave this spot empty")'); pg.wait_for_timeout(80)
    st = pg.locator(".lr-status").inner_text()
    check("table" not in room()["placed"] and "microscope" not in room()["placed"].values(), "taking out the table sends what's on it to storage")
    check("Microscope" in st and "storage" in st, "status line says what went to storage (%s)" % st)
    back()
    # ---- Storage tab ----
    check(pg.locator('.lr-tabs button:has-text("Storage (2)")').count() == 1, "Storage tab counts 2 stored things")
    tab("Storage")
    check(pg.locator('h3.lr-group:has-text("In storage") + .lr-list .lr-card').count() == 2, "Storage lists the 2 stored things")
    check(pg.locator('h3.lr-group:has-text("Awards to earn")').count() == 1, "Storage shows awards still to earn")
    pg.click('[data-k="work-table"]'); act()
    check(room()["placed"].get("table") == "work-table", "Put it in my lab from Storage")
    # ---- Any Color ----
    tab("Paint"); pg.click('[data-k="wall-any"]'); act()
    check(funds() == "$90", "Any Color Walls costs $300 (got %s)" % funds())
    pg.click('[data-k="wall-any"]'); pg.wait_for_timeout(80)
    check(pg.locator(".lr-color").count() == 16 and pg.locator('.lr-more input[type="color"]').count() == 1, "owned Any Color shows 16 presets plus a full picker")
    pg.click('[data-k="wall-any#1F8FBF"]'); pg.wait_for_timeout(80)
    check(room()["paint"]["wall"] == "wall-any" and room()["colors"].get("wall") == "#1F8FBF", "picked color is saved")
    wall_fill = pg.evaluate("[...document.querySelectorAll('.lr-svg polygon')].map(p=>p.getAttribute('fill'))")
    check(len(set(wall_fill)) > 3 and "#f7f5fa" not in [w.lower() for w in wall_fill], "room repaints with the picked color")
    # ---- Award ----
    pg.click("#award"); pg.wait_for_timeout(100)
    check("graph-frame" in saved()["lab"]["owned"] and saved()["lab"]["awards"]["graph-frame"]["points"], "graph award is owned and its graph saved")
    check(room()["placed"].get("poster-left") == "graph-frame", "new award goes up in the empty poster spot")
    check(pg.locator('.lr-svg g[transform^="matrix"] polyline').count() == 1, "the student's graph is drawn on the frame")
    pg.click("#award"); pg.wait_for_timeout(100)
    check(pg.locator('.lr-svg g[transform^="matrix"] rect').count() == 4, "a newer graph replaces the old one (bar graph, 4 bars)")
    # ---- v1 save migration ----
    pg.evaluate("""localStorage.setItem('lfh.labDemo', JSON.stringify({rep: 40, lab: {funds: 55, owned: ['desk','chair-desk','shelf-open','plant-potted','beaker','flask','poster-line','wall-white','floor-lilac','trim-purple','tiles-plain','pet-cat','wall-mint'],
        placed: {bench: 'desk', 'bench-1': 'beaker', 'bench-2': 'flask', chair: 'chair-desk', shelf: 'shelf-open', plant: 'plant-potted', 'poster-back': 'poster-line', pet: 'pet-cat'},
        paint: {wall: 'wall-mint', floor: 'floor-lilac', trim: 'trim-purple', tiles: 'tiles-plain'}}}))""")
    pg.reload(); pg.wait_for_timeout(500)
    check(funds() == "$55" and pg.locator(".lr-svg image").count() == 8, "a v0.1.0 save opens with its funds and items")
    pg.click("#job"); pg.wait_for_timeout(100)
    check(saved()["lab"].get("v") == 2 and room()["paint"]["wall"] == "wall-mint" and room()["placed"]["pet"] == "pet-cat", "a v0.1.0 save is upgraded to v2 without losing anything")
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
