/* =====================================================================
   Lab for Hire: the Sheet side (Google Apps Script).
   Script v0.2.0. It does four things:
     1. serves the Sheet as JSON (the web app), so the game always has the latest content;
     2. adds a "Lab for Hire" menu with "Check my content";
     3. keeps a short-lived cache so a whole class loading at once is fast;
     4. "New case" copies the template tab. That is the ONLY thing this script ever writes: it never changes existing content.

   Two layouts are read, and they can be mixed:
     - CASE TABS (the layout teachers use): every tab whose top-left cell says CASE is one case, filled top to bottom.
       A tab whose top-left cell says CHECKS holds the practice questions for Archive side missions.
       No IDs to type: they are worked out from the tab. Nobody registers a tab anywhere; the script finds them.
     - ROW TABS (the older layout): Cases, Visuals, Data, Tables, Questions, Options, one row per thing, linked by IDs.
       Still read if present, so nothing breaks while cases move over. Optional once any case tab exists.
   The rules that decide what is valid (the engine above) are the SAME code the game runs.
   ===================================================================== */

var FEED_TTL_SECONDS = 60;      // how long a built feed is reused (edits reach students within about a minute)
var CHUNK = 90000;              // CacheService values are limited to 100 KB, so long feeds are split

/* ---------- what to read: one entry per column, matched by HEADER NAME (so inserted/reordered columns are fine) ---------- */
// k: s = text as shown, n = number (or null), i = whole number (with default d), b = "Yes" -> true
var TABS = {
  Cases: [
    { f: "id", h: "caseid", k: "s", req: 1 }, { f: "status", h: "status", k: "s", req: 1 }, { f: "order", h: "path order", k: "i", d: 99 },
    { f: "title", h: "title", k: "s", req: 1 }, { f: "client", h: "client", k: "s" }, { f: "pitch", h: "client pitch", k: "s" },
    { f: "win", h: "win message", k: "s" }, { f: "requires", h: "requires item", k: "s", note: "jobs can't require equipment" },
    { f: "pay", h: "pay", k: "i", d: 0, note: "every job will pay $0" }, { f: "standard", h: "standard", k: "s" },
  ],
  Items: [
    { f: "id", h: "itemid", k: "s", req: 1 }, { f: "name", h: "name", k: "s", req: 1 }, { f: "slot", h: "slot", k: "s", req: 1 },
    { f: "price", h: "price", k: "i", d: -1 }, { f: "kind", h: "kind", k: "s", req: 1 }, { f: "unlocks", h: "unlocks", k: "s" },
    { f: "rank", h: "rank required", k: "s" }, { f: "sprite", h: "sprite", k: "s", req: 1 }, { f: "desc", h: "description", k: "s" },
  ],
  Visuals: [
    { f: "id", h: "visualid", k: "s", req: 1 }, { f: "caseId", h: "caseid", k: "s", req: 1 }, { f: "label", h: "tab label", k: "s" },
    { f: "type", h: "type", k: "s", req: 1 }, { f: "title", h: "title", k: "s" }, { f: "build", h: "student builds it", k: "b" },
    { f: "xLabel", h: "x label", k: "s" }, { f: "xUnit", h: "x unit", k: "s" }, { f: "xMin", h: "x min", k: "n" }, { f: "xMax", h: "x max", k: "n" },
    { f: "xStep", h: "x step", k: "n" }, { f: "xScale", h: "x scale", k: "s" },
    { f: "yLabel", h: "y label", k: "s" }, { f: "yUnit", h: "y unit", k: "s" }, { f: "yMin", h: "y min", k: "n" }, { f: "yMax", h: "y max", k: "n" },
    { f: "yStep", h: "y step", k: "n" }, { f: "yScale", h: "y scale", k: "s" },
  ],
  Data: [
    { f: "visualId", h: "visualid", k: "s", req: 1 }, { f: "series", h: "series", k: "s" }, { f: "x", h: "x", k: "n" }, { f: "y", h: "y", k: "n" },
    { f: "label", h: "point label", k: "s" },
  ],
  Tables: [
    { f: "visualId", h: "visualid", k: "s", req: 1 }, { f: "row", h: "row", k: "i", d: 0 },
    { f: "c1", h: "col 1", k: "s" }, { f: "c2", h: "col 2", k: "s" }, { f: "c3", h: "col 3", k: "s" },
    { f: "c4", h: "col 4", k: "s" }, { f: "c5", h: "col 5", k: "s" }, { f: "c6", h: "col 6", k: "s" },
  ],
  Questions: [
    { f: "id", h: "qid", k: "s", req: 1 }, { f: "caseId", h: "caseid", k: "s" }, { f: "order", h: "order", k: "i", d: 0 }, { f: "role", h: "role", k: "s", req: 1 },
    { f: "forTag", h: "check for tag", k: "s" }, { f: "skill", h: "skill", k: "s" }, { f: "type", h: "type", k: "s", req: 1 },
    { f: "visuals", h: "shows visual", k: "s" }, { f: "prompt", h: "prompt", k: "s", req: 1 }, { f: "why", h: "why its right", k: "s" },
  ],
  Options: [
    { f: "qid", h: "qid", k: "s", req: 1 }, { f: "letter", h: "letter", k: "s", req: 1 }, { f: "text", h: "option text", k: "s", req: 1 },
    { f: "correct", h: "correct", k: "b" }, { f: "tag", h: "error tag", k: "s" },
  ],
  SideMissions: [
    { f: "id", h: "tagid", k: "s", req: 1 }, { f: "kind", h: "kind", k: "s", req: 1 }, { f: "title", h: "mission title", k: "s" },
    { f: "explain", h: "explanation", k: "s" }, { f: "teacherNote", h: "teacher note", k: "s" }, { f: "drill", h: "drill", k: "s" },
  ],
};

/* ---------- reading ---------- */
function norm_(h) {   // "Why it's right (shown after a correct answer)" -> "why its right"
  return String(h == null ? "" : h).toLowerCase().replace(/\([^)]*\)/g, " ").replace(/['\u2019]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
function num_(raw, disp) {
  if (typeof raw === "number") return raw;
  var t = String(disp == null || disp === "" ? raw : disp).replace(/,/g, "").trim();
  if (t === "") return null;
  var v = Number(t);
  return isNaN(v) ? null : v;
}
function cell_(c, raw, disp) {
  if (c.k === "n") return num_(raw, disp);
  if (c.k === "i") { var v = num_(raw, disp); return v === null ? c.d : Math.trunc(v); }
  if (c.k === "b") return String(disp == null ? "" : disp).trim().toLowerCase() === "yes";
  return String(disp == null ? "" : disp).trim();
}
/* One tab -> array of {field: value}. Skips blank rows (they happen: a real Sheet had ten above its first case). */
function readTab_(ss, name, cols, rep, optional) {
  var sh = ss.getSheetByName(name);
  if (!sh) { if (!optional) rep.errors.push("The '" + name + "' tab is missing."); return []; }
  var range = sh.getDataRange(), raw = range.getValues(), disp = range.getDisplayValues();
  if (!raw.length) return [];
  var heads = raw[0].map(norm_), idx = {};
  cols.forEach(function (c) {
    var j = heads.indexOf(c.h); idx[c.f] = j;
    if (j < 0 && c.req) rep.errors.push("The '" + name + "' tab has no '" + c.h + "' column.");
    else if (j < 0 && c.note) rep.warnings.push("The '" + name + "' tab has no '" + c.h + "' column, so " + c.note + ".");
  });
  var first = idx[cols[0].f];
  if (first < 0) return [];
  var rows = [];
  for (var i = 1; i < raw.length; i++) {
    if (String(disp[i][first] == null ? "" : disp[i][first]).trim() === "") continue;
    var row = {};
    cols.forEach(function (c) { var j = idx[c.f]; row[c.f] = j < 0 ? cell_(c, "", "") : cell_(c, raw[i][j], disp[i][j]); });
    if (name === "Items" && row.price === -1) row.price = null;
    rows.push(row);
  }
  return rows;
}
function readLists_(ss) {
  var sh = ss.getSheetByName("Lists");
  if (!sh) return null;
  var disp = sh.getDataRange().getDisplayValues(), lists = {};
  if (!disp.length) return lists;
  disp[0].forEach(function (h, j) {
    var name = String(h).trim(); if (!name) return;
    lists[name] = [];
    for (var i = 1; i < disp.length; i++) { var v = String(disp[i][j] == null ? "" : disp[i][j]).trim(); if (v) lists[name].push(v); }
  });
  return lists;
}
function readSheetSchema_(ss) {
  var sh = ss.getSheetByName("Start Here");
  if (!sh) return "";
  var m = /schema version\s+([0-9]+(?:\.[0-9]+)*)/i.exec(String(sh.getRange(1, 2).getDisplayValue() || ""));
  return m ? m[1] : "";
}

/* ---------- case tabs: one tab per case, filled top to bottom. Column A holds the labels; this reads by label. ---------- */
var VISUAL_KIND_ = { "Line graph": "GRAPH", "Bar graph": "BARS", "Phase diagram": "DIAGRAM", "Data table": "TABLE" };
var LETTERS_ = "ABCDEFGHIJ";
function marker_(disp) { return disp.length && disp[0].length ? String(disp[0][0] == null ? "" : disp[0][0]).trim().toUpperCase() : ""; }
function slug_(t) { return String(t).toUpperCase().replace(/['\u2019]/g, "").replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
function tagOf_(t) {      // the Mistake dropdown shows "Graph: read the wrong axis | CAL-AXIS"; the tag is the piece that looks like one
  var parts = String(t).split("|").map(function (x) { return x.trim(); }), tag = parts.filter(function (x) { return /^[A-Z][A-Z0-9]*(-[A-Z0-9]+)+$/.test(x); });
  return tag.length ? tag[tag.length - 1] : parts[0];
}
function pad2_(n) { return (n < 10 ? "0" : "") + n; }

function readCaseTabs_(ss, rep) {
  var out = { cases: [], visuals: [], data: [], tables: [], questions: [], options: [], where: {}, found: 0, checkCount: {} };
  ss.getSheets().forEach(function (sh) {
    var range = sh.getDataRange(), raw = range.getValues(), disp = range.getDisplayValues(), mark = marker_(disp);
    if (mark === "CASE" || mark === "CHECKS") { out.found++; parseCaseTab_(sh.getName(), mark === "CHECKS", raw, disp, out, rep); }
  });
  return out;
}
function parseCaseTab_(tab, checks, raw, disp, out, rep) {
  var txt = function (i, j) { var v = (disp[i] || [])[j]; return String(v == null ? "" : v).trim(); };
  var numAt = function (i, j) { return num_((raw[i] || [])[j], (disp[i] || [])[j]); };
  var yes = function (i, j) { return txt(i, j).toLowerCase() === "yes"; };
  var here = function (i) { return "'" + tab + "' tab, row " + (i + 1); };
  var c = { id: "", status: "", order: 99, title: "", client: "", pitch: "", win: "", requires: "", pay: 0, standard: "", row: 0 }, code = "";
  var CASE_TEXT = { "case id": "id", "status": "status", "title": "title", "client": "client", "client pitch": "pitch", "win message": "win", "requires equipment": "requires", "requires item": "requires", "standard": "standard" };
  var visuals = [], questions = [], cur = null, mode = "case";
  for (var i = 1; i < disp.length; i++) {
    var label = norm_(disp[i][0]);
    if (!label) continue;                                         // caption rows and blank rows have nothing in column A
    if (label === "graph or table") { cur = { row: i, label: "", type: "", title: "", build: false, xLabel: "", xUnit: "", xMin: null, xMax: null, xStep: null, xScale: "", yLabel: "", yUnit: "", yMin: null, yMax: null, yStep: null, yScale: "", points: [], rows: [] }; visuals.push(cur); mode = "visual"; continue; }
    if (label === "question") { cur = { row: i, prompt: "", type: "", skill: "", show: "", why: "", forTag: "", choices: [] }; questions.push(cur); mode = "question"; continue; }
    if (mode === "case") {
      if (CASE_TEXT[label]) c[CASE_TEXT[label]] = txt(i, 1);
      else if (label === "order" || label === "path order") { var o = numAt(i, 1); c.order = o === null ? 99 : Math.trunc(o); }
      else if (label === "pay") { var pay = numAt(i, 1); c.pay = pay === null ? 0 : Math.trunc(pay); }
      else if (label === "short code") code = slug_(txt(i, 1));
      else if (label !== "teacher notes") rep.warnings.push(here(i) + ": I don't know the label '" + txt(i, 0) + "', so that row is ignored.");
    } else if (mode === "visual") {
      if (label === "type") cur.type = txt(i, 1);
      else if (label === "title") cur.title = txt(i, 1);
      else if (label === "tab label") cur.label = txt(i, 1);
      else if (label === "student builds it") cur.build = yes(i, 1);
      else if (label === "x axis" || label === "y axis") {
        var a = label.charAt(0);
        cur[a + "Label"] = txt(i, 1); cur[a + "Unit"] = txt(i, 2); cur[a + "Min"] = numAt(i, 3); cur[a + "Max"] = numAt(i, 4); cur[a + "Step"] = numAt(i, 5); cur[a + "Scale"] = txt(i, 6);
      }
      else if (label === "point") { if (txt(i, 1) || txt(i, 2) || txt(i, 3)) cur.points.push({ series: txt(i, 1), x: numAt(i, 2), y: numAt(i, 3), label: txt(i, 4) }); }
      else if (label === "table row") { var cells = [1, 2, 3, 4, 5, 6].map(function (j) { return txt(i, j); }); if (cells.join("")) cur.rows.push(cells); }
      else rep.warnings.push(here(i) + ": I don't know the label '" + txt(i, 0) + "' in a graph or table, so that row is ignored.");
    } else {
      if (label === "prompt") cur.prompt = txt(i, 1);
      else if (label === "type") cur.type = txt(i, 1);
      else if (label === "skill") cur.skill = txt(i, 1);
      else if (label === "show only") cur.show = txt(i, 1);
      else if (label === "why its right") cur.why = txt(i, 1);
      else if (label === "for mistake") cur.forTag = tagOf_(txt(i, 1));
      else if (label === "choice") { if (txt(i, 1)) cur.choices.push({ text: txt(i, 1), correct: yes(i, 2), tag: tagOf_(txt(i, 3)), row: i }); }
      else rep.warnings.push(here(i) + ": I don't know the label '" + txt(i, 0) + "' in a question, so that row is ignored.");
    }
  }
  visuals = visuals.filter(function (v) { return v.type || v.title || v.points.length || v.rows.length; });      // an untouched block from the template isn't a visual
  questions = questions.filter(function (q) { return q.prompt || q.choices.length; });
  var addOptions = function (qid, q, what) {
    out.where[qid] = what;
    q.choices.forEach(function (ch, k) { out.options.push({ qid: qid, letter: LETTERS_.charAt(k), text: ch.text, correct: ch.correct, tag: ch.tag }); out.where[qid + LETTERS_.charAt(k)] = what + ", choice " + LETTERS_.charAt(k) + " (row " + (ch.row + 1) + ")"; });
  };
  if (checks) {      // practice questions for Archive side missions: each says which mistake it is for
    questions.forEach(function (q, n) {
      if (!q.forTag) { rep.warnings.push(here(q.row) + ": this practice question has no 'For mistake', so it is ignored."); return; }
      var k = out.checkCount[q.forTag] = (out.checkCount[q.forTag] || 0) + 1, qid = "CK-" + q.forTag + "-" + k;
      out.questions.push({ id: qid, caseId: "", order: k, role: "Check", forTag: q.forTag, skill: q.skill, type: q.type, visuals: "", prompt: q.prompt, why: q.why });
      addOptions(qid, q, "'" + tab + "' tab, practice question " + (n + 1) + " (row " + (q.row + 1) + ")");
    });
    return;
  }
  c.id = slug_(c.id) || slug_(tab); code = code || c.id;
  if (!c.title) c.title = tab;
  if (!c.status) c.status = "Draft";
  out.where[c.id] = "'" + tab + "' tab";
  out.cases.push(c);
  var used = {}, ids = [];
  visuals.forEach(function (v, n) {
    var base = code + "-" + (VISUAL_KIND_[v.type] || "VISUAL"), vid = base, k = 1;
    while (used[vid]) vid = base + "-" + (++k);
    used[vid] = true; ids.push(vid);
    out.where[vid] = "'" + tab + "' tab, graph or table " + (n + 1) + " (row " + (v.row + 1) + ")";
    out.visuals.push({ id: vid, caseId: c.id, label: v.label || v.type, type: v.type, title: v.title, build: v.build, xLabel: v.xLabel, xUnit: v.xUnit, xMin: v.xMin, xMax: v.xMax, xStep: v.xStep, xScale: v.xScale, yLabel: v.yLabel, yUnit: v.yUnit, yMin: v.yMin, yMax: v.yMax, yStep: v.yStep, yScale: v.yScale });
    v.points.forEach(function (pt) { out.data.push({ visualId: vid, series: pt.series, x: pt.x, y: pt.y, label: pt.label }); });
    v.rows.forEach(function (cells, r) { out.tables.push({ visualId: vid, row: r, c1: cells[0], c2: cells[1], c3: cells[2], c4: cells[3], c5: cells[4], c6: cells[5] }); });
  });
  questions.forEach(function (q, n) {
    var qid = code + "-" + pad2_(n + 1), what = "'" + tab + "' tab, question " + (n + 1) + " (row " + (q.row + 1) + ")", show = [];
    q.show.split(",").map(function (t) { return t.trim(); }).filter(Boolean).forEach(function (t) {      // "Show only": a number (1 = the first graph or table) or its tab label or title
      var j = /^[0-9]+$/.test(t) ? Number(t) - 1 : -1;
      if (j < 0) visuals.forEach(function (v, k) { if (j < 0 && ((v.label || v.type).toLowerCase() === t.toLowerCase() || v.title.toLowerCase() === t.toLowerCase())) j = k; });
      if (ids[j]) show.push(ids[j]); else rep.warnings.push(what + ": 'Show only' says '" + t + "', which isn't one of this case's graphs or tables, so every one is shown.");
    });
    out.questions.push({ id: qid, caseId: c.id, order: n + 1, role: "Main", forTag: "", skill: q.skill, type: q.type, visuals: show.join(","), prompt: q.prompt, why: q.why });
    addOptions(qid, q, what);
  });
}
/* "MM-01B: a wrong option has no error tag" -> "'Movin Molecules' tab, question 1 (row 30), choice B (row 36): a wrong option has no error tag" */
function place_(msg, where) {
  var m = /^([^\s:]+):\s*/.exec(String(msg));
  if (!m || !where || !where[m[1]]) return String(msg);
  return where[m[1]] + ": " + String(msg).slice(m[0].length);
}

/* The whole Sheet as the game's content object. includeDraft=false is what students get (Live + Teaser only). */
function buildContent_(ss, includeDraft) {
  var rep = { errors: [], warnings: [] };
  var tabs = readCaseTabs_(ss, rep), opt = tabs.found > 0;      // once there are case tabs, the six row tabs are optional
  var cases = readTab_(ss, "Cases", TABS.Cases, rep, opt).concat(tabs.cases), items = readTab_(ss, "Items", TABS.Items, rep);
  var visuals = readTab_(ss, "Visuals", TABS.Visuals, rep, opt).concat(tabs.visuals), data = readTab_(ss, "Data", TABS.Data, rep, opt).concat(tabs.data), tables = readTab_(ss, "Tables", TABS.Tables, rep, opt).concat(tabs.tables);
  var questions = readTab_(ss, "Questions", TABS.Questions, rep, opt).concat(tabs.questions), options = readTab_(ss, "Options", TABS.Options, rep, opt).concat(tabs.options), tags = readTab_(ss, "SideMissions", TABS.SideMissions, rep);
  var want = function (st) { return st === "Live" || st === "Teaser" || (includeDraft && st === "Draft"); };
  cases.forEach(function (c) { if (["Draft", "Live", "Teaser"].indexOf(c.status) < 0) rep.warnings.push(c.id + ": Status '" + c.status + "' isn't Draft, Live, or Teaser, so students won't see it."); });
  var kept = cases.filter(function (c) { return want(c.status); }), caseIds = {};
  kept.forEach(function (c) { caseIds[c.id] = true; });
  var vis = visuals.filter(function (v) { return caseIds[v.caseId]; }), visIds = {};
  vis.forEach(function (v) { visIds[v.id] = true; });
  var qs = questions.filter(function (q) { return q.role === "Check" || caseIds[q.caseId]; }), qIds = {};
  qs.forEach(function (q) { qIds[q.id] = true; });
  var axis = function (v, p) { return { label: v[p + "Label"], unit: v[p + "Unit"], min: v[p + "Min"], max: v[p + "Max"], step: v[p + "Step"], scale: v[p + "Scale"] || "Linear" }; };
  return {
    schema: LFH.SCHEMA, sheetSchema: readSheetSchema_(ss), generated: new Date().toISOString(), source: "sheet", draft: !!includeDraft,
    cases: kept.map(function (c) { return { id: c.id, status: c.status, order: c.order, title: c.title, client: c.client, pitch: c.pitch, win: c.win, requires: c.requires, pay: c.pay, standard: c.standard }; }),
    items: items.map(function (r) { return { id: r.id, name: r.name, slot: r.slot, price: r.price, kind: r.kind, unlocks: r.unlocks, rank: r.rank, sprite: r.sprite, desc: r.desc }; }),
    visuals: vis.map(function (v) { return { id: v.id, caseId: v.caseId, label: v.label, type: v.type, title: v.title, build: v.build, x: axis(v, "x"), y: axis(v, "y") }; }),
    data: data.filter(function (d) { return visIds[d.visualId]; }).map(function (d) { return { visualId: d.visualId, series: d.series, x: d.x, y: d.y, label: d.label }; }),
    tables: tables.filter(function (t) { return visIds[t.visualId]; }).map(function (t) { return { visualId: t.visualId, row: t.row, cells: [t.c1, t.c2, t.c3, t.c4, t.c5, t.c6] }; }),
    questions: qs.map(function (q) { return { id: q.id, caseId: q.caseId, order: q.order, role: q.role, forTag: q.forTag, skill: q.skill, type: q.type, visuals: q.visuals.split(",").map(function (x) { return x.trim(); }).filter(Boolean), prompt: q.prompt, why: q.why }; }),
    options: options.filter(function (o) { return qIds[o.qid]; }).map(function (o) { return { qid: o.qid, letter: o.letter, text: o.text, correct: o.correct, tag: o.tag }; }),
    tags: tags.map(function (t) { return { id: t.id, kind: t.kind, title: t.title, explain: t.explain, teacherNote: t.teacherNote, drill: t.drill }; }),
    lists: readLists_(ss), errors: rep.errors, warnings: rep.warnings,
    where: tabs.where,        // which tab and row each thing came from: for "Check my content" only, never sent to the game
  };
}

/* ---------- the feed (web app) with a short-lived cache ---------- */
function cachePut_(variant, json) {
  try {
    var packed = Utilities.base64Encode(Utilities.gzip(Utilities.newBlob(json, "application/json", "feed.json")).getBytes());
    var parts = {}, n = 0;
    for (var i = 0; i < packed.length; i += CHUNK) parts["lfh:" + variant + ":" + n++] = packed.substr(i, CHUNK);
    parts["lfh:" + variant + ":n"] = String(n);
    CacheService.getScriptCache().putAll(parts, FEED_TTL_SECONDS);
  } catch (e) { /* the cache is only a speed-up */ }
}
function cacheGet_(variant) {
  try {
    var cache = CacheService.getScriptCache(), n = Number(cache.get("lfh:" + variant + ":n"));
    if (!n) return null;
    var keys = []; for (var i = 0; i < n; i++) keys.push("lfh:" + variant + ":" + i);
    var got = cache.getAll(keys), packed = "";
    for (var k = 0; k < keys.length; k++) { if (!got[keys[k]]) return null; packed += got[keys[k]]; }
    return Utilities.ungzip(Utilities.newBlob(Utilities.base64Decode(packed), "application/x-gzip", "feed.json.gz")).getDataAsString();
  } catch (e) { return null; }
}
function feedJson_(includeDraft, fresh) {
  var variant = includeDraft ? "draft" : "students";
  if (!fresh) { var hit = cacheGet_(variant); if (hit) return hit; }
  var lock = LockService.getScriptLock(), locked = false;
  try { locked = lock.tryLock(10000); } catch (e) { locked = false; }
  try {
    if (!fresh && locked) { var again = cacheGet_(variant); if (again) return again; }   // someone else built it while we waited
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) throw new Error("This script isn't attached to a Sheet. Open the Sheet, then Extensions > Apps Script, and put the script there.");
    var json = JSON.stringify(buildContent_(ss, includeDraft), function (k, v) { return k === "where" ? undefined : v; });
    cachePut_(variant, json);
    return json;
  } finally { if (locked) lock.releaseLock(); }
}
function doGet(e) {
  var p = (e && e.parameter) || {}, json;
  try { json = feedJson_(p.include === "draft", p.fresh === "1"); }
  catch (err) { json = JSON.stringify({ schema: LFH.SCHEMA, errors: ["The feed couldn't be built: " + err.message], cases: [], items: [], visuals: [], data: [], tables: [], questions: [], options: [], tags: [] }); }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- the menu ---------- */
function onOpen() {
  SpreadsheetApp.getUi().createMenu("Lab for Hire")
    .addItem("New case", "newCase")
    .addItem("Check my content", "checkContent")
    .addItem("Send my edits to students now", "clearFeedCache")
    .addItem("Show the game's feed address", "showFeedAddress")
    .addToUi();
}
function esc_(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

/* What a teacher needs to know: what students get, what is held back and why, and what is only a warning. */
function checkReport_(ss) {
  var all = buildContent_(ss, true), stu = buildContent_(ss, false);
  var status = {}; all.cases.forEach(function (c) { status[c.id] = c.status; });
  var qa = LFH.quarantine(all), qs = LFH.quarantine(stu);
  var blocking = [].concat(all.errors, qa.errors);
  if (all.sheetSchema && !LFH.schemaOk(all.sheetSchema)) blocking.unshift("This Sheet says schema " + all.sheetSchema + ", but the game expects " + LFH.SCHEMA + ". Until the Sheet is upgraded, students keep getting the game's built-in content.");
  var at = function (m) { return place_(m, all.where); };
  var held = Object.keys(qa.held).map(function (id) { return { id: id, status: status[id] || "?", where: all.where[id] || "", reasons: qa.held[id].map(at) }; });
  var heldLive = held.filter(function (h) { return h.status !== "Draft"; });
  var live = qs.C.cases.filter(function (c) { return c.status === "Live"; }), teasers = qs.C.cases.filter(function (c) { return c.status === "Teaser"; });
  var warnings = [].concat(all.warnings, qa.warnings.map(at), LFH.checkLists(all.lists));
  var ok = !blocking.length && !heldLive.length;
  var html = "<div style='font:14px/1.5 Arial,sans-serif;color:#2a1f4a'>" +
    "<p style='font-size:16px'><b>" + (ok ? "Everything students will see looks good." : "Students are missing some content.") + "</b></p>" +
    "<p>Students get <b>" + live.length + " live job" + (live.length === 1 ? "" : "s") + "</b> and <b>" + teasers.length + " teaser" + (teasers.length === 1 ? "" : "s") + "</b>: " +
    (live.map(function (c) { return esc_(c.title); }).join(", ") || "none") + ".</p>";
  if (blocking.length) html += "<h3 style='color:#b00020'>Blocking: students won't see ANY updates until this is fixed</h3><ul>" + blocking.map(function (m) { return "<li>" + esc_(m) + "</li>"; }).join("") + "</ul>";
  if (heldLive.length) html += "<h3 style='color:#b36b00'>Held back: students can't see these jobs yet</h3><ul>" + heldLive.map(function (h) { return "<li><b>" + esc_(h.id) + "</b> (" + esc_(h.status) + (h.where ? ", " + esc_(h.where) : "") + ")<ul>" + h.reasons.map(function (r) { return "<li>" + esc_(r) + "</li>"; }).join("") + "</ul></li>"; }).join("") + "</ul>";
  var drafts = held.filter(function (h) { return h.status === "Draft"; });
  if (drafts.length) html += "<h3>Drafts with problems (students never see drafts)</h3><ul>" + drafts.map(function (h) { return "<li><b>" + esc_(h.id) + "</b>" + (h.where ? " (" + esc_(h.where) + ")" : "") + "<ul>" + h.reasons.map(function (r) { return "<li>" + esc_(r) + "</li>"; }).join("") + "</ul></li>"; }).join("") + "</ul>";
  if (warnings.length) html += "<h3>Good to know</h3><ul>" + warnings.map(function (m) { return "<li>" + esc_(m) + "</li>"; }).join("") + "</ul>";
  html += "<p style='color:#5d5480'>Shop items are matched to the room art inside the game, not here. A new item with new art needs a developer re-bake.</p></div>";
  return { ok: ok, blocking: blocking, held: held, warnings: warnings, live: live.length, teasers: teasers.length, html: html };
}
function checkContent() {
  var rep = checkReport_(SpreadsheetApp.getActiveSpreadsheet());
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(rep.html).setWidth(640).setHeight(520), "Lab for Hire: content check");
}
/* The one thing this script writes: a new case tab, copied from the template. Existing tabs are never touched. */
function newCase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), ui = SpreadsheetApp.getUi();
  var template = null, ids = {}, top = 0;
  ss.getSheets().forEach(function (sh) {
    var disp = sh.getDataRange().getDisplayValues(), mark = marker_(disp);
    if (mark === "CASE TEMPLATE") template = sh;
    if (mark !== "CASE") return;
    var id = "";
    for (var i = 1; i < disp.length; i++) {
      var label = norm_(disp[i][0]);
      if (label === "case id") id = slug_(disp[i][1]);
      if (label === "order") top = Math.max(top, Number(disp[i][1]) || 0);
      if (label === "graph or table" || label === "question") break;
    }
    ids[id || slug_(sh.getName())] = true;
  });
  if (!template) { ui.alert("New case", "I can't find the template tab (its top-left cell should say CASE TEMPLATE).", ui.ButtonSet.OK); return; }
  var ans = ui.prompt("New case", "What should the new case be called? (You can change it later.)", ui.ButtonSet.OK_CANCEL);
  if (ans.getSelectedButton() !== ui.Button.OK) return;
  var title = String(ans.getResponseText() || "").trim();
  if (!title) return;
  var base = slug_(title).slice(0, 30) || "CASE", id = base, n = 1;
  while (ids[id]) id = base + "-" + (++n);
  var name = title.slice(0, 60), k = 1;
  while (ss.getSheetByName(name)) name = title.slice(0, 55) + " (" + (++k) + ")";
  var sh = template.copyTo(ss);
  sh.setName(name);
  var disp = sh.getDataRange().getDisplayValues();
  sh.getRange(1, 1).setValue("CASE");
  for (var i = 1; i < disp.length; i++) {
    var label = norm_(disp[i][0]);
    if (label === "graph or table" || label === "question") break;
    if (label === "case id") sh.getRange(i + 1, 2).setValue(id);
    if (label === "title") sh.getRange(i + 1, 2).setValue(title);
    if (label === "status") sh.getRange(i + 1, 2).setValue("Draft");
    if (label === "order") sh.getRange(i + 1, 2).setValue(top + 1);
  }
  if (sh.showSheet) sh.showSheet();
  ss.setActiveSheet(sh);
  ui.alert("New case", "'" + name + "' is ready. Fill in the white cells from top to bottom. It stays a Draft (students can't see it) until you change Status to Live.", ui.ButtonSet.OK);
}
function clearFeedCache() {
  var cache = CacheService.getScriptCache();
  cache.remove("lfh:students:n"); cache.remove("lfh:draft:n");
  SpreadsheetApp.getUi().alert("Done", "Students will get your latest edits the next time they open the game.", SpreadsheetApp.getUi().ButtonSet.OK);
}
function showFeedAddress() {
  var url = ScriptApp.getService().getUrl();
  SpreadsheetApp.getUi().alert("The game's feed address",
    url ? url + "\n\nThis is what goes in the game's settings. It should end in /exec." : "This script hasn't been deployed as a web app yet. Choose Deploy > New deployment > Web app.",
    SpreadsheetApp.getUi().ButtonSet.OK);
}
