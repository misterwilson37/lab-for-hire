"""Rule 10: prove bake -> stack against the truth.
For several labs, render the WHOLE lab as one real 3D scene (bake.html renderFull), then render the same lab
the way students' iPads will (lab.html: SVG room polygons + stacked sprites) at the same frame size, and diff.
usage: python3 overlay_check.py <build_dir> <report_dir>
"""
import sys, os, io, json, base64
import numpy as np
from PIL import Image
from harness import serve, GL_ARGS
from playwright.sync_api import sync_playwright

build, rep = sys.argv[1], sys.argv[2]; os.makedirs(rep, exist_ok=True)
items = {i["id"]: i for i in json.load(open(os.path.join(build, "lab-items.json")))}
man = json.load(open(os.path.join(build, "lab-manifest.json")))
W, H = man["frame"]["w"], man["frame"]["h"]

def not_edge(mask):
    """Big differences that survive a 3x3 erosion: real wrong areas, not 1-pixel anti-aliased outlines."""
    m = mask.copy()
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            m &= np.roll(np.roll(mask, dy, 0), dx, 1)
    return int(m.sum())

LABS = {
  "starter": None,  # LabRoom.defaultState
  "upgraded": {"placed": {"rug": "rug-round", "poster-back": "poster-line", "poster-left": "poster-bars", "plant": "plant-potted", "shelf": "shelf-open",
                          "bench": "lab-bench", "bench-1": "beaker", "bench-2": "microscope", "bench-3": "calorimeter", "chair": "chair-desk",
                          "machine": "grow-cabinet", "pet": "pet-cat", "shelf-top": "books"},
               "paint": {"wall": "wall-lavender", "floor": "floor-periwinkle", "trim": "trim-purple", "tiles": "tiles-checker"}},
  "designer": {"placed": {"rug": "rug-long", "poster-back": "poster-scatter", "poster-left": "poster-line", "plant": "plant-potted", "shelf": "shelf-closed",
                          "bench": "desk", "bench-1": "flask", "bench-2": "tube-rack", "bench-3": "beaker", "chair": "chair-cushion",
                          "machine": "materials-tester", "pet": "pet-dog"},
               "paint": {"wall": "wall-mint", "floor": "floor-lilac", "trim": "trim-teal", "tiles": "tiles-stripes"}},
  "frankenstein": {"placed": {"poster-back": "poster-bars", "plant": "plant-potted", "shelf": "shelf-open", "shelf-top": "fk-candles",
                          "bench": "desk", "bench-1": "beaker", "bench-2": "flask", "chair": "chair-desk",
                          "machine": "fk-coil", "lantern": "fk-lantern", "pet": "pet-bunny"},
               "paint": {"wall": "fk-walls", "floor": "floor-lilac", "trim": "trim-purple", "tiles": "tiles-plain"}},
}
b3d, blab = serve(os.path.dirname(os.path.abspath(__file__)), 8765), serve(build, 8766)
results = {}
with sync_playwright() as p:
    br = p.chromium.launch(args=GL_ARGS)
    ref = br.new_page(); ref.goto(b3d + "/bake.html"); ref.wait_for_function("window.READY", timeout=60000)
    lab = br.new_page(viewport={"width": W, "height": H}, device_scale_factor=1)
    lab.route("**/fonts.googleapis.com/**", lambda r: r.abort())
    lab.goto(blab + "/lab.html")
    for name, spec in LABS.items():
        st = lab.evaluate("""(spec) => {
            const items = window.__i || (window.__i = JSON.parse(document.getElementById('lab-items').textContent));
            window.__m = window.__m || JSON.parse(document.getElementById('lab-manifest').textContent);
            let s = LabRoom.defaultState(items, window.__m);
            if (spec) { s.owned = items.map(i => i.id); s.placed = spec.placed; s.paint = spec.paint; }
            return LabRoom.normalize(s, items, window.__m);
        }""", spec)
        placed = [[s["id"], items[st["placed"][s["id"]]]["sprite"]] for s in man["slots"] if st["placed"].get(s["id"])
                  and (not s.get("parent") or st["placed"].get(s["parent"]))]
        paint = {k: items[v]["sprite"] for k, v in st["paint"].items()}
        url = ref.evaluate("([p,pl]) => api.renderFull(p, pl, '#EEEAF8')", [paint, placed])
        truth = Image.open(io.BytesIO(base64.b64decode(url.split(",", 1)[1]))).convert("RGB")
        bg = "#%02x%02x%02x" % truth.getpixel((2, 2))
        lab.evaluate("""([st, bg, W, H]) => {
            const m = window.__m || (window.__m = JSON.parse(document.getElementById('lab-manifest').textContent));
            const items = window.__i || (window.__i = JSON.parse(document.getElementById('lab-items').textContent));
            const sprites = window.__s || (window.__s = JSON.parse(document.getElementById('lab-sprites').textContent));
            m.view = [0, 0, W, H];
            document.body.innerHTML = '<div id=t style="width:' + W + 'px"></div>';
            document.body.style.cssText = 'margin:0;padding:0;background:' + bg;
            document.documentElement.style.padding = '0';
            const css = document.createElement('style'); css.textContent = '.lr-stage{border-radius:0!important;background:' + bg + '!important}'; document.head.appendChild(css);
            LabRoom.mount(document.getElementById('t'), { state: st, manifest: m, items: items, sprites: sprites, readOnly: true });
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
