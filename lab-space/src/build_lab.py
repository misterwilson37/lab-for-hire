"""Assemble lab.html from src/lab_template.html + the bake outputs (Rule 9: generated, never hand-edited).
usage: python3 build_lab.py <bake_out_dir> <lab.html out>
Embeds items, manifest, and every sprite as a data URI, so the page is one self-contained file
(works as a claude.ai artifact and on GitHub Pages alike)."""
import sys, os, json, base64
here = os.path.dirname(os.path.abspath(__file__))
def main(bake, out):
    t = open(os.path.join(here, "lab_template.html"), encoding="utf-8").read()
    items = json.load(open(os.path.join(bake, "lab-items.json"), encoding="utf-8"))
    man = json.load(open(os.path.join(bake, "lab-manifest.json")))
    sprites = {}
    for f in [v["file"] for v in man["sprites"].values()] + list(man["thumbs"].values()):
        b = open(os.path.join(bake, "lab-sprites", f), "rb").read()
        sprites[f] = "data:image/png;base64," + base64.b64encode(b).decode()
    enc = lambda o: json.dumps(o, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    for k, v in (("/*ITEMS*/", items), ("/*MANIFEST*/", man), ("/*SPRITES*/", sprites)):
        assert t.count(k) == 1, k
        t = t.replace(k, enc(v))
    open(out, "w", encoding="utf-8").write(t)
    print(f"wrote {out} ({os.path.getsize(out)/1024:.0f} KB)")
if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
