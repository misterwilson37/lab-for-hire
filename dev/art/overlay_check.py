"""Prove the bake against the truth (Jake's "prove it on real data" rule).
For several labs, render the WHOLE lab as one real 3D scene (bake.html renderFull), then render the same lab the way
students' iPads will (the real index.html: the room module stacking the baked pictures over code-drawn walls), and diff.
usage (from the repo root, after dev/art/setup.sh and a build):  python3 dev/art/overlay_check.py [report_dir]
Exits 1 if the starter lab has any wrong area beyond 1-pixel outlines, or any lab is under 98.5% within 8 shades.
"""
import sys, os, io, json, base64, re, tempfile
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
from harness import serve, GL_ARGS
from playwright.sync_api import sync_playwright

rep = sys.argv[1] if len(sys.argv) > 1 else os.path.join(tempfile.gettempdir(), "lfh_overlay"); os.makedirs(rep, exist_ok=True)
page = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
block = lambda i: json.loads(re.search(r'<script id="%s"[^>]*>([\s\S]*?)</script>' % i, page).group(1).replace("<\\/", "</"))
items = {i["id"]: i for i in block("lfh-content")["items"]}
man = block("lfh-art")["manifest"]
W, H = man["frame"]["w"], man["frame"]["h"]

def not_edge(mask):
    """Big differences that survive a 3x3 erosion: real wrong areas, not 1-pixel anti-aliased outlines."""
    m = mask.copy()
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            m &= np.roll(np.roll(mask, dy, 0), dx, 1)
    return int(m.sum())

LABS = {
  "starter": None,  # LFH.lab.defaultState: desk, chair, shelf, plant, beaker, laptop, line poster
  "upgraded": {"placed": {"rug": "rug-round", "poster-back": "poster-line", "poster-left": "poster-bars", "plant": "plant-potted", "shelf": "shelf-open",
                          "bench": "lab-bench", "bench-1": "beaker", "bench-2": "microscope", "bench-3": "calorimeter", "chair": "chair-desk",
                          "machine": "grow-cabinet", "pet": "pet-cat", "shelf-top": "books",
                          "table": "work-table", "table-1": "tube-rack", "table-2": "flask"},
               "paint": {"wall": "wall-lavender", "floor": "floor-periwinkle", "trim": "trim-purple", "tiles": "tiles-checker"}},
  "designer": {"placed": {"rug": "rug-long", "poster-back": "poster-scatter", "plant": "plant-potted", "shelf": "shelf-closed",
                          "bench": "desk", "bench-1": "flask", "bench-2": "tube-rack", "bench-3": "beaker", "chair": "chair-cushion",
                          "machine": "materials-tester", "pet": "pet-dog", "poster-left": "graph-frame"},
               "paint": {"wall": "wall-any", "floor": "floor-lilac", "trim": "trim-teal", "tiles": "tiles-stripes"}, "colors": {"wall": "#CFE8D5"}},
  "frankenstein": {"placed": {"poster-back": "poster-tesla", "poster-left": "poster-lovelace", "plant": "plant-potted", "shelf": "shelf-open", "shelf-top": "fk-candles",
                          "bench": "desk", "bench-1": "pressure-gauge", "bench-2": "laptop", "bench-3": "flask", "chair": "chair-desk",
                          "machine": "fk-coil", "lantern": "fk-lantern", "pet": "pet-bunny"},
               "paint": {"wall": "fk-walls", "floor": "floor-lilac", "trim": "trim-purple", "tiles": "tiles-plain"}},
}
b3d, blab = serve(HERE, 8765), serve(ROOT, 8766)
results = {}
with sync_playwright() as p:
    br = p.chromium.launch(args=GL_ARGS)
    ref = br.new_page(); ref.goto(b3d + "/bake.html"); ref.wait_for_function("window.READY", timeout=60000)
    lab = br.new_page(viewport={"width": W, "height": H}, device_scale_factor=1)
    lab.route("**/fonts.googleapis.com/**", lambda r: r.abort())
    lab.add_init_script("window.__OVERLAY = true")
    lab.goto(blab + "/index.html"); lab.wait_for_function("window.LabRoom && window.LFH")
    for name, spec in LABS.items():
        st = lab.evaluate("""(spec) => {
            const items = window.__i || (window.__i = JSON.parse(document.getElementById('lfh-content').textContent).items);
            window.__a = window.__a || JSON.parse(document.getElementById('lfh-art').textContent);
            const m = window.__a.manifest;
            let s = LFH.lab.defaultState(items, m);
            if (spec) { s.owned = items.map(i => i.id); s.rooms.main = { placed: spec.placed, paint: spec.paint, colors: spec.colors || {} }; }
            return LFH.lab.normalize(s, items, m);
        }""", spec)
        rm = st["rooms"]["main"]
        placed = [[s["id"], items[rm["placed"][s["id"]]]["sprite"]] for s in man["slots"] if rm["placed"].get(s["id"])
                  and (not s.get("parent") or rm["placed"].get(s["parent"]))]
        anyc = {"wall": "#FFE7A8", "floor": "#CFE8D5", "trim": "#E0413A"}  # ANY_DEFAULT in the module
        paint = {k: (rm["colors"].get(k) or anyc[k]) if items[v]["sprite"] == "any" else items[v]["sprite"] for k, v in rm["paint"].items()}
        url = ref.evaluate("([p,pl]) => api.renderFull(p, pl, '#EEEAF8')", [paint, placed])
        truth = Image.open(io.BytesIO(base64.b64decode(url.split(",", 1)[1]))).convert("RGB")
        bg = "#%02x%02x%02x" % truth.getpixel((2, 2))
        lab.evaluate("""([st, bg, W, H]) => {
            const m = JSON.parse(JSON.stringify(window.__a.manifest));
            m.view = [0, 0, W, H];
            document.body.innerHTML = '<div id=t style="width:' + W + 'px"></div>';
            document.body.style.cssText = 'margin:0;padding:0;background:' + bg;
            document.documentElement.style.padding = '0';
            if (!document.getElementById('ovcss')) { const css = document.createElement('style'); css.id = 'ovcss'; css.textContent = '.lr-stage{border-radius:0!important;background:' + bg + '!important}'; document.head.appendChild(css); }
            LabRoom.mount(document.getElementById('t'), { state: st, manifest: m, items: window.__i, sprites: window.__a.sprites, readOnly: true });
        }""", [st, bg, W, H])
        lab.wait_for_timeout(400)
        comp = Image.open(io.BytesIO(lab.screenshot(clip={"x": 0, "y": 0, "width": W, "height": H}))).convert("RGB")
        a, c = np.asarray(truth).astype(int), np.asarray(comp).astype(int)
        d = np.abs(a - c).max(axis=2); n = d.size
        r = {"mean_abs": round(float(d.mean()), 3), "identical_%": round(float(100 * (d == 0).sum() / n), 2),
             "within_2_%": round(float(100 * (d <= 2).sum() / n), 2), "within_8_%": round(float(100 * (d <= 8).sum() / n), 2),
             "over_32_px": int((d > 32).sum()), "over_32_not_edge_px": not_edge(d > 32), "max": int(d.max())}
        results[name] = r; print(name, r)
        truth.save(os.path.join(rep, f"{name}_truth_3d.png")); comp.save(os.path.join(rep, f"{name}_stacked.png"))
        heat = np.clip(d * 8, 0, 255).astype(np.uint8)
        Image.fromarray(255 - heat).save(os.path.join(rep, f"{name}_diff_x8.png"))
    br.close()
json.dump(results, open(os.path.join(rep, "overlay_report.json"), "w"), indent=1)
bad = [n for n, r in results.items() if r["within_8_%"] < 98.5] + (["starter (wrong pixels)"] if results["starter"]["over_32_not_edge_px"] else [])
print("report:", rep); print("OVERLAY CHECK FAILED: " + ", ".join(bad) if bad else "OVERLAY CHECK PASSED")
sys.exit(1 if bad else 0)
