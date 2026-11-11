"""Put freshly baked room art into the game.  Usage (from the repo root):  python3 dev/art/embed_art.py [dev/art/sprites]
Writes src/art.json from bake.py's output, then runs build.py. test_engine.js fails if a shop item has no art in its slot."""
import base64, json, os, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sprite_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "dev/art/sprites")
man = json.load(open(f"{sprite_dir}/manifest.json"))
for k, L in man["layers"].items():
    L["src"] = "data:image/png;base64," + base64.b64encode(open(f"{sprite_dir}/{k}.png", "rb").read()).decode()
open(os.path.join(ROOT, "src/art.json"), "w", encoding="utf-8").write(json.dumps(man, separators=(",", ":")))
subprocess.run([sys.executable, os.path.join(ROOT, "build.py")], check=True, cwd=ROOT)
print("embedded", len(man["layers"]), "layers. Now run: bash dev/check.sh")
