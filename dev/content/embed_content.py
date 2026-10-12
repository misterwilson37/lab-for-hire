"""Replace the content snapshot inside index.html with a freshly exported content.json.
Usage: python3 dev/content/embed_content.py index.html content.json
index.html stays the ONLY copy of the game code; this swaps just the data block."""
import re, sys
html_path, json_path = sys.argv[1], sys.argv[2]
html = open(html_path, encoding="utf-8").read()
data = open(json_path, encoding="utf-8").read().replace("</", "<\\/")
new, n = re.subn(r'(<script id="lfh-content" type="application/json">)[\s\S]*?(</script>)',
                 lambda m: m.group(1) + data + m.group(2), html, count=1)
assert n == 1, "content block not found"
open(html_path, "w", encoding="utf-8").write(new)
print("embedded", len(data) // 1024, "KB of content into", html_path)
