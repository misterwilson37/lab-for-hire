"""Refresh the game's BUILT-IN content (the offline fallback) from the live feed.
Usage (from the repo root):  python3 dev/content/embed_content.py <feed URL  or  a saved feed .json file>
Writes src/content.json, then runs build.py. The Sheet stays the one source of truth; the built-in copy is only a cache so the
game works with no network. Refuses a feed that has blocking errors, drafts, or the wrong schema, so a half-finished edit can
never become the fallback."""
import json, os, subprocess, sys, urllib.request
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if len(sys.argv) != 2: sys.exit(__doc__)
source = sys.argv[1]
raw = urllib.request.urlopen(source, timeout=30).read().decode("utf-8") if source.startswith("http") else open(source, encoding="utf-8").read()
c = json.loads(raw)
def refuse(why): sys.exit("REFUSED: " + why)
if c.get("errors"): refuse("the feed reports blocking errors: " + "; ".join(c["errors"][:3]))
if c.get("draft") or any(x.get("status") == "Draft" for x in c.get("cases", [])): refuse("this feed includes Drafts. Use the students' feed (no ?include=draft).")
if not str(c.get("schema", "")).startswith("0.5"): refuse(f"schema {c.get('schema')} is not the one this game reads (0.5.x)")
if c.get("sheetSchema") and not str(c["sheetSchema"]).startswith("0.5"): refuse(f"the Sheet says schema {c['sheetSchema']}; upgrade the Sheet first")
for k in ("errors", "warnings", "lists", "draft", "sheetSchema"): c.pop(k, None)     # diagnostics belong to the live feed, not the snapshot
c["source"] = "snapshot of the live feed"
data = json.dumps(c, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
open(os.path.join(ROOT, "src/content.json"), "w", encoding="utf-8").write(data)
subprocess.run([sys.executable, os.path.join(ROOT, "build.py")], check=True, cwd=ROOT)
print(f"embedded {len(c['cases'])} cases / {len(c['questions'])} questions ({len(data) // 1024} KB), generated {c.get('generated', '?')}. Now run: bash dev/check.sh")
