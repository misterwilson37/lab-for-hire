"""The room art bake.  Items (the Sheet's Items tab) -> src/art.json  (+ loose PNGs in dev/art/sprites/ for the overlay check)

Every item is rendered ALONE, IN ITS SPOT, through the ONE locked camera and lighting rig (scene.js), to a
full-frame transparent PNG, then cropped to its bounding box with the offset kept. Because every sprite shares
the room's frame, the game just stacks images in spot order: no anchor math.

usage (from the repo root, after `bash dev/art/setup.sh`):
    python3 dev/art/bake.py                      items from src/content.json (the built-in copy of the Sheet)
    python3 dev/art/bake.py <content.json | Items.xlsx>
Then run: python3 build.py && bash dev/check.sh
src/art.json is a build artifact: never hand-edit it; change the Items tab or scene.js and re-bake.
"""
import sys, os, io, json, base64, re
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
from harness import serve, GL_ARGS
from playwright.sync_api import sync_playwright

MANIFEST_VERSION = "0.4.0"
THUMB = 112  # store thumbnails: 56 CSS px at 2x
PAINT = {"paint-wall": "wall", "paint-floor": "floor", "paint-trim": "trim", "paint-tiles": "tiles"}

def read_items(path):
    """Only id, slot, and sprite matter to the bake. Content rules (prices, kinds, ranks) are checked by the engine, not here."""
    if path.endswith(".json"):
        return [{"id": i["id"], "slot": i["slot"], "sprite": i["sprite"]} for i in json.load(open(path, encoding="utf-8"))["items"]]
    from openpyxl import load_workbook
    rows = list(load_workbook(path, data_only=True)["Items"].iter_rows(values_only=True))
    head = [str(h or "").strip().lower() for h in rows[0]]; ix = {k: head.index(k) for k in ("itemid", "slot", "sprite")}
    return [{"id": str(r[ix["itemid"]]).strip(), "slot": str(r[ix["slot"]] or "").strip(), "sprite": str(r[ix["sprite"]] or "").strip()} for r in rows[1:] if r and r[ix["itemid"]] not in (None, "")]

def validate(items, slot_types, recipes):
    errs = []
    for it in items:
        if it["slot"] in PAINT: continue
        if it["slot"] not in slot_types: errs.append(f'{it["id"]}: unknown Slot "{it["slot"]}"')
        elif it["sprite"] not in recipes: errs.append(f'{it["id"]}: Sprite "{it["sprite"]}" has no recipe in scene.js RECIPES')
    if errs: sys.exit("Items the bake can't draw:\n  " + "\n  ".join(errs))

def main(src):
    items = read_items(src)
    out = os.path.join(HERE, "sprites"); os.makedirs(out, exist_ok=True)
    for f in os.listdir(out): os.remove(os.path.join(out, f))
    base = serve(HERE)
    with sync_playwright() as p:
        b = p.chromium.launch(args=GL_ARGS); pg = b.new_page()
        errors = []; pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.goto(base + "/bake.html"); pg.wait_for_function("window.READY", timeout=60000)
        meta = pg.evaluate("({v: api.sceneVersion, frame: api.frame, slots: api.slots, recipes: api.recipes})")
        slot_types = {s["type"] for s in meta["slots"]}
        validate(items, slot_types, set(meta["recipes"]))
        light = pg.evaluate("api.measure()")
        room = pg.evaluate("api.faces()")
        jobs = []
        for it in items:
            if it["slot"] in PAINT: continue
            for s in meta["slots"]:
                if s["type"] == it["slot"] and (it["sprite"], s["id"]) not in jobs: jobs.append((it["sprite"], s["id"]))
        sprites = {}
        for recipe, slot in jobs:
            url = pg.evaluate("([r,s,o]) => api.bakeItem(r,s,o)", [recipe, slot, light["shadowOpacity"]])
            im = Image.open(io.BytesIO(base64.b64decode(url.split(",", 1)[1]))).convert("RGBA")
            box = im.getchannel("A").point(lambda a: 255 if a > 2 else 0).getbbox()
            if not box: sys.exit(f"{recipe}@{slot} rendered nothing")
            crop = im.crop(box); fname = f"{recipe}__{slot}.png"
            crop.save(os.path.join(out, fname), optimize=True)
            sprites[f"{recipe}@{slot}"] = {"file": fname, "x": box[0], "y": box[1], "w": box[2] - box[0], "h": box[3] - box[1]}
            print(f"  baked {recipe:18s} @ {slot:12s} {box[2]-box[0]:4d}x{box[3]-box[1]:<4d} at ({box[0]},{box[1]})")
        thumbs = {}
        for recipe in dict.fromkeys(r for r, _ in jobs):
            slot = next(s for r, s in jobs if r == recipe)
            url = pg.evaluate("([r,s]) => api.bakeThumb(r,s)", [recipe, slot])
            im = Image.open(io.BytesIO(base64.b64decode(url.split(",", 1)[1]))).convert("RGBA")
            im = im.crop(im.getchannel("A").point(lambda a: 255 if a > 2 else 0).getbbox())
            im.thumbnail((THUMB, THUMB), Image.LANCZOS)
            im = im.quantize(colors=128, method=Image.FASTOCTREE)  # thumbs only; room sprites stay full RGBA
            fname = f"thumb__{recipe}.png"; im.save(os.path.join(out, fname), optimize=True)
            thumbs[recipe] = fname
        # framed award posters: canvas corners per poster spot (only if some item uses the frame)
        canvases = {}
        if any(it["sprite"] == "poster-frame" for it in items):
            for s in meta["slots"]:
                if s["type"] == "poster": canvases[s["id"]] = pg.evaluate("(s) => api.canvasFor(s)", s["id"])
        if errors: sys.exit("page errors: " + "; ".join(errors))
        b.close()

    # hit area per slot = union of every sprite that can go there (so an empty spot is still tappable)
    slots = []
    for s in meta["slots"]:
        boxes = [v for k, v in sprites.items() if k.endswith("@" + s["id"])]
        x0 = min(v["x"] for v in boxes); y0 = min(v["y"] for v in boxes)
        x1 = max(v["x"] + v["w"] for v in boxes); y1 = max(v["y"] + v["h"] for v in boxes)
        e = {"id": s["id"], "type": s["type"], "label": s["label"], "parent": s.get("parent"), "required": bool(s.get("required")),
             "hit": [x0, y0, x1 - x0, y1 - y0]}
        if s["id"] in canvases: e["canvas"] = canvases[s["id"]]; e["normal"] = "pz" if s.get("wall") == "back" else "px"
        slots.append(e)
    pts = [pt for f in room["faces"] for pt in f["points"]]
    xs = [p[0] for p in pts] + [v["x"] for v in sprites.values()] + [v["x"] + v["w"] for v in sprites.values()]
    ys = [p[1] for p in pts] + [v["y"] for v in sprites.values()] + [v["y"] + v["h"] for v in sprites.values()]
    pad = 16
    view = [int(min(xs)) - pad, int(min(ys)) - pad]; view += [int(max(xs)) + pad - view[0], int(max(ys)) + pad - view[1]]
    view = [max(0, view[0]), max(0, view[1]), min(meta["frame"]["w"], view[2]), min(meta["frame"]["h"], view[3])]
    manifest = {
        "manifestVersion": MANIFEST_VERSION, "sceneVersion": meta["v"], "generatedFrom": os.path.basename(src),
        "frame": meta["frame"], "view": view,
        "room": {"faces": room["faces"], "tilesAfter": room["tilesAfter"], "tiles": room["tiles"],
                 "tileDarken": room["tileDarken"], "shade": light["shade"]},
        "shadowOpacity": light["shadowOpacity"],
        "slots": slots, "sprites": sprites, "thumbs": thumbs,
    }
    data = {f: "data:image/png;base64," + base64.b64encode(open(os.path.join(out, f), "rb").read()).decode() for f in sorted(os.listdir(out))}
    json.dump(manifest, open(os.path.join(out, "manifest.json"), "w"), indent=1)
    art = json.dumps({"manifest": manifest, "sprites": data}, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    open(os.path.join(ROOT, "src/art.json"), "w", encoding="utf-8").write(art)
    print(f"{len(items)} items, {len(sprites)} sprites + {len(thumbs)} thumbnails -> src/art.json ({len(art) // 1024} KB), view {view}")

if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "src/content.json"))
