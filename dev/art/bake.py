"""Bake the Lab for Hire room: every layer rendered alone through ONE locked camera + ONE light rig,
trimmed to its pixels, plus manifest.json with positions. Then run: python3 dev/art/embed_art.py index.html dev/art/sprites
Needs: node/npm (three.js), Playwright Chromium. Models come from the Kenney CC0 mirror on GitHub."""
import os, subprocess, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__)); os.chdir(HERE)
MODELS = {"furniture-kit": ["desk", "laptop", "chairdesk", "kitchencabinet", "kitchencabinetdrawer", "bookcaseopen", "books", "pottedplant",
                            "plantsmall1", "plantsmall2", "lampsquaretable", "rugrounded"],
          "cube-pets": ["animal-cat", "animal-penguin", "animal-dog"],
          "graveyard-kit": ["candle-multiple", "lantern-candle", "pumpkin-carved", "character-skeleton"]}
os.makedirs("models", exist_ok=True)
for pack, names in MODELS.items():
    for n in names:
        f = f"models/{n}.glb"
        if not os.path.exists(f):
            urllib.request.urlretrieve(f"https://raw.githubusercontent.com/Hidencod/tge-assets/main/packs/{pack}/{n}.glb", f)
if not os.path.exists("node_modules/three"):
    subprocess.run(["npm", "install", "three@0.160.0", "--silent", "--no-save"], check=True)
import base64, io, json, os, subprocess, time
from PIL import Image
from playwright.sync_api import sync_playwright
os.makedirs("sprites", exist_ok=True)
srv = subprocess.Popen(["python3", "-m", "http.server", "8766"], cwd=HERE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1.2)
imgs = {}
try:
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        pg = b.new_page(viewport={"width": 1200, "height": 900})
        pg.on("pageerror", lambda e: print("ERR", e))
        pg.goto("http://localhost:8766/bake.html"); pg.wait_for_function("window.READY", timeout=30000)
        layers = pg.evaluate("window.LAYERS"); paints = pg.evaluate("window.PAINTS")
        for key in [f"base-{x}" for x in paints] + [l["key"] for l in layers]:
            data = pg.evaluate(f"window.bake('{key}')", ) if False else pg.evaluate("k => window.bake(k)", key)
            imgs[key] = Image.open(io.BytesIO(base64.b64decode(data.split(",")[1]))).convert("RGBA")
        b.close()
finally:
    srv.terminate()
boxes = {k: im.getchannel("A").point(lambda a: 255 if a > 6 else 0).getbbox() for k, im in imgs.items()}
empty = [k for k, v in boxes.items() if v is None]; assert not empty, f"empty layers: {empty}"
fx0 = min(v[0] for v in boxes.values()); fy0 = min(v[1] for v in boxes.values())
fx1 = max(v[2] for v in boxes.values()); fy1 = max(v[3] for v in boxes.values())
FW, FH = fx1 - fx0, fy1 - fy0
man = {"frame": {"w": FW, "h": FH}, "layers": {}, "order": []}
slot_of = {l["key"]: l["slot"] for l in layers}
for i, (k, im) in enumerate(imgs.items()):
    x0, y0, x1, y1 = boxes[k]
    crop = im.crop((x0, y0, x1, y1)); crop.save(f"sprites/{k}.png", optimize=True)
    man["layers"][k] = {"slot": slot_of.get(k, "base"), "x": x0 - fx0, "y": y0 - fy0, "w": x1 - x0, "h": y1 - y0}
    if not k.startswith("base-"): man["order"].append(k)
json.dump(man, open("sprites/manifest.json", "w"), indent=1)
tot = sum(os.path.getsize(f"sprites/{f}") for f in os.listdir("sprites") if f.endswith(".png"))
print("frame", FW, FH, "| layers", len(imgs), "| sprite bytes", tot // 1024, "KB")
