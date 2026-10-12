"""Replace the baked room art inside index.html. Usage: python3 dev/art/embed_art.py index.html dev/art/sprites
index.html stays the ONLY copy of the game code; this swaps just the art block (generated: never hand-edit)."""
import base64, json, re, sys
html_path, sprite_dir = sys.argv[1], sys.argv[2]
man = json.load(open(f"{sprite_dir}/manifest.json"))
for k, L in man["layers"].items():
    L["src"] = "data:image/png;base64," + base64.b64encode(open(f"{sprite_dir}/{k}.png", "rb").read()).decode()
html = open(html_path, encoding="utf-8").read()
new, n = re.subn(r'(<script id="lfh-art" type="application/json">)[\s\S]*?(</script>)', lambda m: m.group(1) + json.dumps(man, separators=(",", ":")) + m.group(2), html, count=1)
assert n == 1, "art block not found"
open(html_path, "w", encoding="utf-8").write(new)
print("embedded", len(man["layers"]), "layers into", html_path, "- now run test_engine.js: it checks every shop item has art")
