"""Repo hygiene: the things that rot silently. Run via `bash dev/check.sh` (step 6) or directly: python3 dev/tests/test_repo.py"""
import json, os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
fails, passed = [], 0
def ok(c, m):
    global passed
    if c: passed += 1
    else: fails.append(m); print("FAIL", m)
def rd(p): return open(os.path.join(ROOT, p), encoding="utf-8", errors="replace").read()
SKIP_DIRS = {".git", "node_modules", "incoming", "__pycache__"}
def walk():
    for d, ds, fs in os.walk(ROOT):
        ds[:] = [x for x in ds if x not in SKIP_DIRS]
        for f in fs: yield os.path.relpath(os.path.join(d, f), ROOT)
files = list(walk())

# 1. the files a new session depends on exist
for p in ["CLAUDE.md", "README.md", "HANDOFF.md", "build.py", "index.html", ".gitignore", ".claude/settings.json", ".claude/hooks/protect_generated.py",
          "src/shell.html", "src/engine.js", "src/app.js", "src/sheet-script.gs", "src/config.json", "src/content.json", "src/art.json",
          "apps-script/LabForHire.gs", "apps-script/appsscript.json", "apps-script/INSTALL.md", "sheet/UPGRADE-LIVE-SHEET.md",
          "docs/START-HERE.md", "docs/ARCHITECTURE.md", "docs/DECISIONS.md", "docs/ROADMAP.md", "docs/CONTENT-GUIDE.md", "docs/CLIENT-BRIEF.md",
          "docs/PLAYTEST-LOG.md", "docs/ITEMS-CONFLICT.md", "docs/PROVENANCE.md", "incoming/README.md", "dev/check.sh", "dev/setup.sh"]:
    ok(os.path.exists(os.path.join(ROOT, p)), f"missing required file: {p}")
ok(any(re.match(r"sheet/LabForHire_Content_v[\d.]+\.xlsx$", f) for f in files), "the seed workbook is in sheet/")

# 2. every relative markdown link resolves
for f in [f for f in files if f.endswith(".md")]:
    for m in re.finditer(r"\[[^\]]*\]\(([^)\s]+)\)", rd(f)):
        t = m.group(1).split("#")[0]
        if not t or re.match(r"^(https?:|mailto:)", t): continue
        ok(os.path.exists(os.path.normpath(os.path.join(ROOT, os.path.dirname(f), t))), f"{f}: broken link -> {t}")

# 3. file paths named in backticks exist (so docs can't point at things that moved)
PLACEHOLDER = re.compile(r"[<>*{}]|X\.Y\.Z|\.\.\.|^incoming/|bake/scene|bake/bake|lab-manifest|lab\.html|scene\.js|/sprites|/models|node_modules|^dev/art/package|^/|^~|\.env|settings\.local|CLAUDE\.local|^\.\./|^\w+://")
EXT = r"(?:md|py|js|json|gs|sh|html|xlsx|tsv|css)"
for f in ["CLAUDE.md", "README.md", "HANDOFF.md"] + [f for f in files if f.startswith("docs/") or f.startswith("sheet/") or f.startswith("dev/README")]:
    if not f.endswith(".md"): continue
    for m in re.finditer(r"`([A-Za-z0-9_.\-/]+\.%s)`" % EXT, rd(f)):
        t = m.group(1)
        if PLACEHOLDER.search(t) or t in ("index.html",) and False: continue
        cands = [t, os.path.join(os.path.dirname(f), t), "dev/" + t, "dev/tests/" + t, "dev/art/" + t, "dev/content/" + t, "apps-script/" + t, "sheet/" + t, "docs/" + t, "src/" + t]
        ok(any(os.path.exists(os.path.join(ROOT, c)) for c in cands), f"{f}: names `{t}`, which doesn't exist")

# 4. Claude Code configuration is valid and the guard hook really guards
try:
    cfg = json.loads(rd(".claude/settings.json")); ok(True, "")
    hook = cfg["hooks"]["PreToolUse"][0]["hooks"][0]["command"]
    ok("protect_generated.py" in hook and os.path.exists(os.path.join(ROOT, ".claude/hooks/protect_generated.py")), "settings.json points at a hook that exists")
    ok(all(any(a.endswith("__" + w) for a in cfg["permissions"]["ask"]) for w in ["update_values", "append_values", "batch_clear_values", "update_spreadsheet", "insert_dimension"]), "every Sheet write tool is on the ask list")
    ok("Bash(git push *)" in cfg["permissions"]["ask"], "git push asks first")
except Exception as e:
    ok(False, f".claude/settings.json is invalid: {e}")
def hook(path, raw=None):
    ev = raw if raw is not None else json.dumps({"tool_input": {"file_path": path}})
    return subprocess.run([sys.executable, os.path.join(ROOT, ".claude/hooks/protect_generated.py")], input=ev, text=True, capture_output=True, env=dict(os.environ, CLAUDE_PROJECT_DIR=ROOT)).returncode
for g in ["index.html", "apps-script/LabForHire.gs", "apps-script/appsscript.json", "src/content.json", "src/art.json", "src/../index.html"]:
    ok(hook(os.path.join(ROOT, g)) == 2, f"the hook blocks edits to {g}")
for s in ["src/app.js", "src/engine.js", "src/shell.html", "src/sheet-script.gs", "src/config.json", "docs/DECISIONS.md", "dev/tests/test_engine.js"]:
    ok(hook(os.path.join(ROOT, s)) == 0, f"the hook allows edits to {s}")
ok(hook("/tmp/index.html") == 0 and hook("", raw="not json") == 0, "the hook never blocks outside the project or on a malformed event")

# 5. size and shape of CLAUDE.md (it is loaded into every session: keep it tight)
ok(len(rd("CLAUDE.md").splitlines()) <= 200, f"CLAUDE.md is {len(rd('CLAUDE.md').splitlines())} lines (keep it under 200; put detail in docs/)")
ok(all(f"rule" in rd("CLAUDE.md").lower() for _ in [0]) and re.search(r"Rule 9|\*\*Single Source of Truth", rd("CLAUDE.md")), "CLAUDE.md carries the standing rules")
ok(re.search(r"v(\d+\.\d+\.\d+) \(game\)", rd("src/shell.html")).group(1) in rd("HANDOFF.md"), "HANDOFF.md names the current game version")

# 6. no secrets, no emails, no student-data patterns, no leftovers
TEXT = (".md", ".py", ".js", ".json", ".gs", ".sh", ".html", ".tsv", ".css", ".txt", ".gitignore")
for f in files:
    if f.endswith(".xlsx") or f == "src/art.json" or f == "index.html": continue
    if not f.endswith(TEXT): continue
    t = rd(f)
    for m in re.finditer(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}", t): ok(False, f"{f}: email address {m.group(0)}")
    for pat, what in [(r"sk-[A-Za-z0-9]{20,}", "an API key"), (r"AKIA[0-9A-Z]{16}", "an AWS key"), (r"AIza[0-9A-Za-z_-]{30,}", "a Google API key"), (r"-----BEGIN [A-Z ]*PRIVATE KEY", "a private key"),
                      (r"sumnerschools\.org", "a school-district address"), (r"(?i)\bpassword\s*[:=]\s*['\"][^'\"]+", "a hard-coded password")]:
        ok(not re.search(pat, t), f"{f}: looks like {what}")
ok(not any(f.endswith((".png", ".jpg", ".jpeg", ".gif", ".env")) or os.path.basename(f).startswith(".env") for f in files), "no images or .env files in the repo (art ships inside src/art.json)")
ok(not any(os.path.sep + "__pycache__" in os.path.sep + f or f.endswith(".pyc") for f in files), "no Python cache files")
big = [(f, os.path.getsize(os.path.join(ROOT, f))) for f in files if os.path.getsize(os.path.join(ROOT, f)) > 700_000]
ok(not big, f"unexpectedly large files: {big}")
print(f"{passed} repo checks passed")
sys.exit(1 if fails else 0)
