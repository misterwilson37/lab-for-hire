/* Shared by the feed tests: load the real seed workbook as a grid, mess it up the ways real Sheets get messed up,
   and run the real Apps Script code against it. */
const fs = require("fs"), path = require("path"), cp = require("child_process");
const { makeGas } = require("./gas_mock.js");
const ROOT = path.resolve(__dirname, "../..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const block = (id) => html.match(new RegExp(`<script id="${id}"[^>]*>([\\s\\S]*?)</script>`))[1].replace(/<\\\//g, "</");
const snapshot = JSON.parse(block("lfh-content")), ART = JSON.parse(block("lfh-art"));
const gasSrc = fs.readFileSync(path.join(ROOT, "apps-script/LabForHire.gs"), "utf8");
const xlsx = fs.readdirSync(path.join(ROOT, "sheet")).filter((f) => /^LabForHire_Content_v.*\.xlsx$/.test(f)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).pop();
const SEED = JSON.parse(cp.execFileSync("python3", [path.join(__dirname, "xlsx_to_grid.py"), path.join(ROOT, "sheet", xlsx)], { maxBuffer: 1 << 26 }).toString());
const clone = (x) => JSON.parse(JSON.stringify(x));
const hdr = (g, tab) => g[tab].values[0].map((h) => String(h));
const col = (g, tab, name) => { const i = hdr(g, tab).findIndex((h) => h.toLowerCase().startsWith(name.toLowerCase())); if (i < 0) throw new Error(`no column ${name} in ${tab}`); return i; };
function mapRows(g, tab, fn) { for (const k of ["values", "display"]) g[tab][k] = g[tab][k].map((r, i) => (i === 0 ? r : fn(r.slice(), i))); }
function dropColumn(g, tab, name) { const j = col(g, tab, name); for (const k of ["values", "display"]) g[tab][k] = g[tab][k].map((r) => r.filter((_, i) => i !== j)); }
function blankRowsAfterHeader(g, tab, n) { for (const k of ["values", "display"]) { const w = g[tab][k][0].length; g[tab][k].splice(1, 0, ...Array.from({ length: n }, () => Array(w).fill(""))); } }
function reverseColumns(g, tab) { for (const k of ["values", "display"]) g[tab][k] = g[tab][k].map((r) => r.slice().reverse()); }
function setCell(g, tab, rowIdx, colName, v) { const j = col(g, tab, colName); g[tab].values[rowIdx][j] = v; g[tab].display[rowIdx][j] = String(v); }
function setWhere(g, tab, idCol, id, colName, v) { const j = col(g, tab, colName), i0 = col(g, tab, idCol); let n = 0; g[tab].values.forEach((r, i) => { if (i && r[i0] === id) { g[tab].values[i][j] = v; g[tab].display[i][j] = String(v); n++; } }); if (!n) throw new Error(`no ${id} in ${tab}`); }
function addRow(g, tab, obj) { const h = hdr(g, tab); const r = h.map((name) => { const key = Object.keys(obj).find((k) => name.toLowerCase().startsWith(k.toLowerCase())); return key ? obj[key] : ""; }); g[tab].values.push(r); g[tab].display.push(r.map(String)); }
const gas = (g, o = {}) => makeGas(g, Object.assign({ source: gasSrc }, o));
const feedOf = (g, draft) => JSON.parse(gas(g).ctx.doGet({ parameter: draft ? { include: "draft" } : {} }).text);

/* The live Sheet exactly as it was found in Oct 2026 (before the Nov 2026 rebuild): the old v0.2.1 layout with ten blank rows, only the five built cases,
   and the lab-space conversation's 39-item Items tab (transcribed from the real Sheet into fixtures/). */
function liveAsFound(g) {
  dropColumn(g, "Cases", "Pay"); dropColumn(g, "Cases", "Requires item"); blankRowsAfterHeader(g, "Cases", 10);
  const keep = (r, i) => i === 0 || !/^(CELL|GREEN|BRACE)/.test(String(r[0]));
  g.Cases.values = g.Cases.values.filter(keep); g.Cases.display = g.Cases.display.filter(keep);
  const tsv = fs.readFileSync(path.join(__dirname, "fixtures/lab_space_items.tsv"), "utf8").trim().split("\n").map((l) => l.split("\t"));
  g.Items.values = [hdr(g, "Items"), ...tsv.map(([id, name, slot, price, kind, unlocks, rank, sprite]) => [id, name, slot, Number(price), kind, unlocks, rank, sprite, ""])];
  g.Items.display = g.Items.values.map((r) => r.map(String));
  g["Items Legend"] = { values: [["Column", "What goes here"], ["ItemID", "..."]], display: [["Column", "What goes here"], ["ItemID", "..."]] };
  g["Start Here"].values[0][1] = g["Start Here"].display[0][1] = "Schema version 0.2.1. This Sheet is the ONLY home for game content.";
  ["ItemKind", "Rank", "Slot"].forEach((n) => { const j = hdr(g, "Lists").indexOf(n); for (const k of ["values", "display"]) g.Lists[k] = g.Lists[k].map((r) => r.filter((_, i) => i !== j)); });
  const sj = hdr(g, "Lists").indexOf("Status"); g.Lists.values = g.Lists.values.map((r) => r.map((c, i) => (i === sj && c === "Teaser" ? "" : c))); g.Lists.display = g.Lists.values.map((r) => r.map(String));
  return g;
}
module.exports = { ROOT, html, block, snapshot, ART, gasSrc, xlsx, SEED, clone, hdr, col, mapRows, dropColumn, blankRowsAfterHeader, reverseColumns, setCell, setWhere, addRow, gas, feedOf, liveAsFound, makeGas };
