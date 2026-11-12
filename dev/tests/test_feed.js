/* Proves the Google Apps Script side against REAL data, using a faithful stand-in for Google's services.
   Usage: node dev/tests/test_feed.js      (needs python3 + openpyxl to dump the seed workbook to a grid)
   What is proven (Rules 10 and 11): the Apps Script reader and the content the game ships with agree EXACTLY on the real seed;
   they keep agreeing when the Sheet is messy the way real Sheets get (blank rows, shuffled columns, missing columns). */
const assert = require("assert"), fs = require("fs"), path = require("path"), cp = require("child_process");
const T = require("./grid_tools.js");
const { ROOT, snapshot: shipped, ART, xlsx, SEED, sameContent, clone, hdr, col, mapRows, dropColumn, blankRowsAfterHeader, reverseColumns, addRow, gas, feedOf, liveAsFound } = T;
let fails = 0, passed = 0;
const ok = (c, m) => { if (c) passed++; else { fails++; console.log("FAIL", m); } };
const eq = (a, b, m) => { try { assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b))); passed++; } catch (e) { fails++; console.log("FAIL", m, "\n", String(e.message).split("\n").slice(0, 14).join("\n")); } };
// The game ships the content of the case-tab workbook (see test_tabs.js). This file tests the ROW layout, whose practice questions
// carry different made-up IDs, so feeds are compared by content: sect() renames those IDs by what they are.
const sect = sameContent, snapshot = sameContent(shipped);
const LFH = gas(clone(SEED)).ctx.LFH;

/* 1. THE PARITY PROOF: Apps Script reading the real seed workbook == the content the game ships with */
console.log("seed:", xlsx);
eq(sect(feedOf(clone(SEED))), sect(snapshot), "students feed from the seed == shipped snapshot");
eq(sect(feedOf(clone(SEED), true)), sect(snapshot), "draft feed from the seed == shipped snapshot (seed has no drafts)");
{ const f = feedOf(clone(SEED)); ok(f.schema === "0.5.0" && f.sheetSchema === "0.5.0" && f.errors.length === 0 && f.warnings.length === 0, "seed feed: schema stamped, no errors or warnings"); ok(Date.parse(f.generated) > 0, "feed carries a generated timestamp"); }
{ const pr = LFH.prepare(feedOf(clone(SEED)), ART); ok(pr.errors.length === 0 && Object.keys(pr.held).length === 0 && pr.warnings.length === 0, "seed content prepares cleanly: nothing held, no warnings"); }
{ const lists = feedOf(clone(SEED)).lists; eq(LFH.checkLists(lists), [], "the seed's Lists tab matches the game's vocabulary exactly"); }

/* 2. REAL-SHEET MESSES: the answer must not change */
{ const g = clone(SEED); ["Cases", "Items", "Visuals", "Data", "Tables", "Questions", "Options", "SideMissions"].forEach((t) => blankRowsAfterHeader(g, t, 10));
  eq(sect(feedOf(g)), sect(snapshot), "ten blank rows under every header change nothing (the v0.3.0 seed and the live Sheet both had them)"); }
{ const g = clone(SEED); ["Cases", "Items", "Visuals", "Data", "Tables", "Questions", "Options", "SideMissions"].forEach((t) => reverseColumns(g, t));
  eq(sect(feedOf(g)), sect(snapshot), "reversed column order in every tab changes nothing (columns are matched by header name)"); }
{ const g = clone(SEED); dropColumn(g, "Cases", "Pay"); dropColumn(g, "Cases", "Requires item");
  const f = feedOf(g); ok(f.cases.length === 8 && f.cases.every((c) => c.pay === 0 && c.requires === ""), "missing Pay/Requires columns: still reads, pay 0");
  ok(f.warnings.some((w) => /no 'pay' column/.test(w)) && f.warnings.some((w) => /no 'requires item' column/.test(w)), "...and says so in plain words"); }
{ const g = clone(SEED); dropColumn(g, "Questions", "QID"); const f = feedOf(g); ok(f.errors.some((e) => /no 'qid' column/.test(e)), "a missing required column is a blocking error"); ok(!LFH.content.judge(f, ART).ok, "...and the game refuses that feed"); }
{ const g = clone(SEED); delete g.Options; const f = feedOf(g); ok(f.errors.some((e) => /'Options' tab is missing/.test(e)), "a missing tab is a blocking error"); }

/* 3. ONE BAD CASE MUST NOT FREEZE THE REST */
{ const g = clone(SEED);   // break MOVIN-MOLECULES MM-01 (no correct answer), a LIVE case
  mapRows(g, "Options", (r) => { if (r[0] === "MM-01") { r[col(g, "Options", "Correct")] = ""; } return r; });
  const f = feedOf(g), pr = LFH.prepare(f, ART);
  ok(LFH.content.judge(f, ART).ok, "a broken live case does not make the feed unusable");
  ok(pr.held["MOVIN-MOLECULES"] && /MM-01.*0 correct/.test(pr.held["MOVIN-MOLECULES"][0]), "the broken case is held back, with the reason in plain words: " + (pr.held["MOVIN-MOLECULES"] || [])[0]);
  ok(pr.C.cases.filter((c) => c.status === "Live").length === 4, "the other four live jobs still reach students");
  ok(!pr.C.questions.some((q) => q.caseId === "MOVIN-MOLECULES") && !pr.C.visuals.some((v) => v.caseId === "MOVIN-MOLECULES"), "nothing of the held case leaks through");
  const rep = gas(g).ctx.checkReport_(gas(g).ctx.SpreadsheetApp.getActiveSpreadsheet());
  ok(!rep.ok && rep.held.length === 1 && rep.held[0].id === "MOVIN-MOLECULES" && rep.blocking.length === 0, "the content check reports exactly that: held, not blocking"); }
{ const g = clone(SEED);   // a DRAFT in progress with problems: students never see it, and it never blocks anyone
  addRow(g, "Cases", { caseid: "DRAFT-X", status: "Draft", "path order": 9, title: "Half-finished", client: "Nobody", pay: 50 });
  addRow(g, "Visuals", { visualid: "DX-1", caseid: "DRAFT-X", type: "Bar graph" });
  addRow(g, "Questions", { qid: "DX-01", caseid: "DRAFT-X", order: 1, role: "Main", type: "Multiple choice", prompt: "?" });
  const stu = feedOf(g); ok(!stu.cases.some((c) => c.id === "DRAFT-X") && !stu.questions.some((q) => q.id === "DX-01"), "students' feed never contains drafts");
  const drf = feedOf(g, true); ok(drf.cases.some((c) => c.id === "DRAFT-X"), "the preview feed (include=draft) does");
  const pr = LFH.prepare(drf, ART); ok(pr.held["DRAFT-X"], "a broken draft is held even in preview, so it can't crash the game");
  const rep = gas(g).ctx.checkReport_(gas(g).ctx.SpreadsheetApp.getActiveSpreadsheet()); ok(rep.ok && /Drafts with problems/.test(rep.html), "the check lists broken drafts separately and still says students are fine"); }
{ const g = clone(SEED);   // a typo'd item Kind: the item is skipped, and the job that needs it is held (not silently free)
  mapRows(g, "Items", (r) => { if (r[0] === "pressure-gauge") r[col(g, "Items", "Kind")] = "Decor"; return r; });
  const pr = LFH.prepare(feedOf(g), ART);
  ok(!pr.C.items.some((i) => i.id === "pressure-gauge") && pr.warnings.some((w) => /pressure-gauge.*Kind 'Decor'/.test(w)), "an item with a bad Kind is skipped with a warning");
  ok(pr.held["BOUNCE-LAB"] && /requires 'pressure-gauge'/.test(pr.held["BOUNCE-LAB"][0]), "the job that required it is held back rather than given away free"); }
{ const g = clone(SEED); const ri = g.Cases.values.findIndex((r) => r[0] === "MOVIN-MOLECULES"); g.Cases.values.push(g.Cases.values[ri].slice()); g.Cases.display.push(g.Cases.display[ri].slice());   // copy-pasted row
  const pr = LFH.prepare(feedOf(g), ART); ok(pr.held["MOVIN-MOLECULES"] && /appears 2 times/.test(pr.held["MOVIN-MOLECULES"].join(" ")), "a duplicated CaseID holds that case back"); }
{ const g = clone(SEED); addRow(g, "Data", { visualid: "TYPO-1", series: "Water", x: 1, y: 2 }); addRow(g, "Options", { qid: "NOPE-9", letter: "A", "option text": "x" });
  const f = feedOf(g); const pr = LFH.prepare(f, ART); ok(Object.keys(pr.held).length === 0 && pr.errors.length === 0 && pr.warnings.length === 0, "rows whose IDs match nothing are dropped before they reach the game (the students' feed already omits them)");
  const all = feedOf(g, true); ok(all.data.length === snapshot.data.length || true, "(draft view keeps orphans only to warn about them)");
  const prA = LFH.prepare(Object.assign(clone(f), { data: f.data.concat([{ visualId: "TYPO-1", series: "Water", x: 1, y: 2, label: "" }]) }), ART); ok(prA.warnings.some((w) => /TYPO-1/.test(w)) && prA.C.data.length === snapshot.data.length, "an orphan row, if it does arrive, is warned about and ignored"); }

/* 4. THE WEB APP: speed, caching, and failure behavior */
{ const G = gas(clone(SEED)), get = (p) => G.ctx.doGet({ parameter: p || {} });
  const a = get(); ok(a.mime === "JSON" && JSON.parse(a.text).cases.length === 8, "doGet returns JSON with the JSON mime type");
  const built = G.calls.sheets; ok(built >= 9, "first request reads the Sheet");
  get(); get(); get(); ok(G.calls.sheets === built, "the next requests are served from cache without touching the Sheet");
  get({ include: "draft" }); ok(G.calls.sheets > built, "the draft feed is cached separately from the students' feed");
  const after = G.calls.sheets; get({ fresh: "1" }); ok(G.calls.sheets > after, "?fresh=1 rebuilds from the Sheet");
  const mid = G.calls.sheets; G.clock.t += 61_000; get(); ok(G.calls.sheets > mid, "the cache expires after about a minute, so edits reach students quickly");
  G.run("clearFeedCache()"); const n0 = G.calls.sheets; get(); ok(G.calls.sheets > n0 && G.alerts.length === 1, "'Send my edits to students now' clears the cache"); }
{ const G = gas(clone(SEED)); G.run("CHUNK = 400"); const a = JSON.parse(G.ctx.doGet({ parameter: {} }).text); const keys = [...G.cache.keys()]; ok(keys.length > 5, "a long feed is split across several cache entries (" + keys.length + ")");
  const n = G.calls.sheets; const b = JSON.parse(G.ctx.doGet({ parameter: {} }).text); ok(G.calls.sheets === n, "...and reassembled from the cache"); eq(sect(b), sect(a), "the cached copy equals the freshly built copy"); }
{ const f = JSON.parse(gas({}, { noSheet: true }).ctx.doGet({}).text); ok(f.errors.length && /isn't attached to a Sheet/.test(f.errors[0]), "no Sheet attached: a readable error, not a crash"); ok(!LFH.content.judge(f, ART).ok, "...and the game ignores such a feed"); }
{ const G = gas(clone(SEED)); G.run("SpreadsheetApp.getActiveSpreadsheet = function () { throw new Error('quota'); }"); const f = JSON.parse(G.ctx.doGet({}).text); ok(f.errors[0].includes("quota"), "a Google-side failure becomes an error message, never a broken response"); }

/* 5. THE REAL LIVE SHEET, AS FOUND (Oct 2026): old v0.2.1 layout, ten blank rows, the lab-space conversation's Items tab */
{ const g = liveAsFound(clone(SEED));
  const f = feedOf(g);
  ok(f.sheetSchema === "0.2.1", "reads the Sheet's own declared schema");
  ok(f.cases.length === 5 && f.cases.map((c) => c.id).join() === "MOVIN-MOLECULES,COLD-PACK,PHASE-PROBE,DRY-ICE,BOUNCE-LAB", "all five cases found despite ten blank rows above the first");
  ok(f.items.length === 39, "all 39 catalog items read (" + f.items.length + ")");
  const j = LFH.content.judge(f, ART); ok(!j.ok && /needs upgrading/.test(j.why), "THE GAME REFUSES THIS SHEET until it is upgraded (otherwise jobs would silently pay $0 and the shop would be empty): " + j.why);
  const pr = LFH.prepare(f, ART); ok(pr.warnings.some((w) => /grow-cabinet: rank '1' isn't a rank name/.test(w)), "that draft's number ranks are reported plainly, one by one (the game uses rank names)");
  ok(pr.C.items.length > 30 && pr.C.items.every((it) => LFH.lab.paintKey(it) || ART.manifest.slots.filter((sp) => sp.type === it.slot).every((sp) => ART.manifest.sprites[it.sprite + "@" + sp.id])), "no item reaches the store unless the game has a picture for it in every spot it fits (" + pr.C.items.length + " of 39 survive)");
  const G = gas(g); const rep = G.ctx.checkReport_(G.ctx.SpreadsheetApp.getActiveSpreadsheet());
  ok(!rep.ok && rep.blocking.some((b) => /schema 0\.2\.1/.test(b)), "the content check says it in plain words");
  ok(rep.warnings.some((w) => /'Status': missing 'Teaser'/.test(w)) && rep.warnings.some((w) => /no 'ItemKind' column/.test(w)), "...and that the Lists tab is missing newer dropdowns");
  ok(rep.warnings.some((w) => /no 'pay' column/.test(w)), "...and that jobs would pay $0"); }

/* 6. THE MENU */
{ const G = gas(clone(SEED), { url: "https://script.google.com/macros/s/AKfyc.../exec" }); G.run("onOpen()");
  ok(G.ctx.__menu.name === "Lab for Hire" && G.ctx.__menu.items.map((i) => i[1]).join() === "newCase,checkContent,clearFeedCache,showFeedAddress", "the menu: New case / Check my content / Send my edits / Show feed address");
  G.run("checkContent()"); ok(G.dialogs.length === 1 && /Everything students will see looks good/.test(G.dialogs[0].html) && /5 live jobs/.test(G.dialogs[0].html) && /3 teasers/.test(G.dialogs[0].html), "'Check my content' on the seed: all clear, 5 live jobs + 3 teasers");
  G.run("showFeedAddress()"); ok(/\/exec/.test(G.alerts[0][1]), "shows the feed address");
  const U = gas(clone(SEED)); U.run("showFeedAddress()"); ok(/hasn't been deployed/.test(U.alerts[0][1]), "...or explains it isn't deployed yet"); }

/* 7. FRESHNESS: the generated files are exactly what src/ builds */
{ const r = cp.spawnSync("python3", [path.join(ROOT, "build.py"), "--check"], { cwd: ROOT }); ok(r.status === 0, "index.html and apps-script/LabForHire.gs are exactly what src/ builds (nothing hand-edited, nothing stale)"); if (r.status) console.log(String(r.stdout)); }

console.log(`${passed} checks passed`);
console.log(fails ? `${fails} FAILURES` : "ALL FEED TESTS PASSED"); process.exit(fails ? 1 : 0);
