/* The one-tab-per-case layout (what teachers use), read by the REAL Apps Script through the stand-in for Google.
   Usage: node dev/tests/test_tabs.js
   Proven here: the case-tab workbook reads to exactly the same game content as the row workbook it was made from;
   the game's built-in copy IS that content; tabs are found without being registered; problems are reported by tab and row;
   "New case" only ever adds a tab. */
const assert = require("assert");
const T = require("./grid_tools.js");
const { snapshot, ART, SEED, TABS, clone, gas, feedOf, sameContent, sect } = T;
let fails = 0, passed = 0;
const ok = (c, m) => { if (c) passed++; else { fails++; console.log("FAIL", m); } };
const eq = (a, b, m) => { try { assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b))); passed++; } catch (e) { fails++; console.log("FAIL", m, "\n", String(e.message).split("\n").slice(0, 14).join("\n")); } };
const LFH = gas(clone(TABS)).ctx.LFH;
const report = (g) => { const G = gas(g); return G.ctx.checkReport_(G.ctx.SpreadsheetApp.getActiveSpreadsheet()); };

// ---- helpers that edit a case tab the way a teacher would: by its labels ----
const rowsOf = (g, tab) => g[tab].values;
const find = (g, tab, label, nth = 1, from = 0) => { let n = 0; const r = rowsOf(g, tab); for (let i = from; i < r.length; i++) if (String(r[i][0]).trim().toLowerCase() === label.toLowerCase() && ++n === nth) return i; throw new Error(`no ${label} #${nth} in ${tab}`); };
const set = (g, tab, i, j, v) => { for (const k of ["values", "display"]) { while (g[tab][k][i].length <= j) g[tab][k][i].push(""); g[tab][k][i][j] = k === "display" ? String(v) : v; } };
const insert = (g, tab, i, rows) => { for (const k of ["values", "display"]) g[tab][k].splice(i, 0, ...rows.map((r) => r.map((c) => (k === "display" ? String(c) : c)))); };
const MM = "Movin' Molecules", BL = "The Winter Bounce Test";

/* 1. PARITY: the same content, whichever layout it is written in */
console.log("case-tab workbook:", T.tabsXlsx, "| row workbook:", T.xlsx);
{ const tabs = feedOf(clone(TABS)), rows = feedOf(clone(SEED));
  ok(tabs.errors.length === 0 && tabs.warnings.length === 0, "the case-tab workbook reads with no errors or warnings: " + JSON.stringify(tabs.errors.concat(tabs.warnings).slice(0, 3)));
  ["cases", "items", "visuals", "data", "tables", "tags"].forEach((k) => eq(tabs[k], rows[k], `${k}: identical in both layouts`));
  eq(tabs.questions.filter((q) => q.role === "Main"), rows.questions.filter((q) => q.role === "Main"), "every case question is identical in both layouts (same IDs, order, wording, visuals)");
  const mainIds = new Set(rows.questions.filter((q) => q.role === "Main").map((q) => q.id));
  eq(tabs.options.filter((o) => mainIds.has(o.qid)), rows.options.filter((o) => mainIds.has(o.qid)), "every answer choice of every case question is identical (letters, right answers, mistake tags)");
  eq(sameContent(tabs), sameContent(rows), "practice questions carry the same content too (only their made-up IDs differ)");
  eq(sect(tabs), sect(snapshot), "THE GAME'S BUILT-IN COPY is exactly what the Sheet script reads from the case-tab workbook");
  eq(sect(feedOf(clone(TABS), true)), sect(snapshot), "...and the preview feed is the same (the workbook has no drafts)");
  const pr = LFH.prepare(tabs, ART); ok(pr.errors.length === 0 && Object.keys(pr.held).length === 0 && pr.warnings.length === 0, "the game accepts it whole: nothing held back, nothing warned");
  ok(tabs.where === undefined && !/"where"/.test(gas(clone(TABS)).ctx.doGet({ parameter: {} }).text), "the tab-and-row notes never travel to students");
  ok(tabs.cases.find((c) => c.id === "COLD-PACK") && !tabs.questions.some((q) => q.caseId === "COLD-PACK"), "the job-template case has a tab but no questions of its own");
  const rep = report(clone(TABS)); ok(rep.ok && rep.live === 5 && rep.teasers === 3 && rep.warnings.length === 0, "'Check my content' on the workbook: all clear, 5 live jobs and 3 teasers"); }

/* 2. TABS ARE FOUND, NOT REGISTERED */
{ const g = clone(TABS); g["My notes"] = { values: [["Remember to ask about the codon chart", ""], ["QUESTION", "this is not a case tab"]], display: [["Remember to ask about the codon chart", ""], ["QUESTION", "this is not a case tab"]] };
  eq(sect(feedOf(g)), sect(snapshot), "a tab that doesn't start with CASE is ignored, whatever is in it"); }
{ const g = clone(TABS), f = feedOf(g, true); ok(!f.cases.some((c) => /TEMPLATE/i.test(c.id)) && f.cases.length === 8, "the template tab is never a case, even in preview"); }
{ const g = clone(TABS); g["Yeast and Sugar"] = clone(g[MM]); set(g, "Yeast and Sugar", find(g, "Yeast and Sugar", "Case ID"), 1, ""); set(g, "Yeast and Sugar", find(g, "Yeast and Sugar", "Short code"), 1, "");
  set(g, "Yeast and Sugar", find(g, "Yeast and Sugar", "Title"), 1, "Yeast and Sugar"); set(g, "Yeast and Sugar", find(g, "Yeast and Sugar", "Order"), 1, 9);
  const f = feedOf(g), c = f.cases.find((x) => x.title === "Yeast and Sugar");
  ok(c && c.id === "YEAST-AND-SUGAR" && c.order === 9, "a copied tab is a new case at once; with no Case ID typed, the ID comes from the tab's name");
  ok(f.questions.filter((q) => q.caseId === "YEAST-AND-SUGAR").map((q) => q.id).join() === "YEAST-AND-SUGAR-01,YEAST-AND-SUGAR-02,YEAST-AND-SUGAR-03,YEAST-AND-SUGAR-04,YEAST-AND-SUGAR-05,YEAST-AND-SUGAR-06,YEAST-AND-SUGAR-07,YEAST-AND-SUGAR-08", "...its questions are numbered from the tab, with no IDs typed anywhere");
  ok(f.visuals.some((v) => v.id === "YEAST-AND-SUGAR-GRAPH" && v.caseId === "YEAST-AND-SUGAR") && f.data.filter((d) => d.visualId === "YEAST-AND-SUGAR-GRAPH").length === 5, "...and its graph and data belong to it");
  const pr = LFH.prepare(f, ART); ok(Object.keys(pr.held).length === 0 && pr.C.cases.length === 9, "...and the game takes all nine cases"); }
{ const g = clone(TABS); set(g, MM, find(g, MM, "Status"), 1, "Draft");
  const stu = feedOf(g), drf = feedOf(g, true);
  ok(!stu.cases.some((c) => c.id === "MOVIN-MOLECULES") && !stu.questions.some((q) => q.caseId === "MOVIN-MOLECULES") && !stu.visuals.some((v) => v.caseId === "MOVIN-MOLECULES"), "a Draft tab never reaches students: not the case, not its questions, not its graph");
  ok(drf.cases.some((c) => c.id === "MOVIN-MOLECULES"), "...but teacher preview shows it"); }
{ const g = clone(TABS); set(g, MM, 0, 0, "  case "); eq(sect(feedOf(g)), sect(snapshot), "the CASE marker is forgiving about spaces and capitals"); }

/* 3. THE WAYS A TEACHER'S TAB GOES WRONG: say where, hold back only that case */
{ const g = clone(TABS), q3 = find(g, MM, "QUESTION", 3), ch = find(g, MM, "Choice", 2, q3);     // a wrong answer with no mistake picked
  set(g, MM, ch, 3, "");
  const f = feedOf(g), pr = LFH.prepare(f, ART), rep = report(g);
  ok(pr.held["MOVIN-MOLECULES"] && pr.C.cases.filter((c) => c.status === "Live").length === 4, "a wrong answer with no mistake picked holds back that one case; the other four still play");
  const h = rep.held.find((x) => x.id === "MOVIN-MOLECULES");
  ok(h && h.where === `'${MM}' tab` && h.reasons.some((r) => r.indexOf(`'${MM}' tab, question 3 (row ${q3 + 1}), choice B (row ${ch + 1}):`) === 0 && /no error tag/.test(r)), "'Check my content' says which tab, which question, which choice, and which row: " + (h ? h.reasons[0] : "(nothing held)"));
  ok(!rep.ok && rep.blocking.length === 0, "...as a held case, not as something blocking everyone"); }
{ const g = clone(TABS), q1 = find(g, MM, "QUESTION", 1); for (let k = 1; k <= 4; k++) set(g, MM, find(g, MM, "Choice", k, q1), 2, "");     // nobody marked the right answer
  const rep = report(g), h = rep.held.find((x) => x.id === "MOVIN-MOLECULES");
  ok(h && h.reasons.some((r) => r.indexOf(`'${MM}' tab, question 1 (row ${q1 + 1}):`) === 0 && /0 correct/.test(r)), "no right answer marked: reported at the question, by row"); }
{ const g = clone(TABS), i = find(g, MM, "Prompt", 2); set(g, MM, i, 0, "Promt");     // a typo in a shaded label
  const f = feedOf(g); ok(f.warnings.some((w) => w.indexOf(`'${MM}' tab, row ${i + 1}: I don't know the label 'Promt'`) === 0), "a mistyped label is named, with its row, instead of being silently skipped"); }
{ const g = clone(TABS); set(g, MM, find(g, MM, "Status"), 1, "Finished");
  const f = feedOf(g, true); ok(f.warnings.some((w) => /MOVIN-MOLECULES: Status 'Finished'/.test(w)) && !feedOf(g).cases.some((c) => c.id === "MOVIN-MOLECULES"), "a Status that isn't Draft, Live, or Teaser: students don't get the case, and the check says so"); }
{ const g = clone(TABS); g["Copy of Movin"] = clone(g[MM]);     // duplicated a tab and forgot to change anything
  const pr = LFH.prepare(feedOf(g), ART); ok(pr.held["MOVIN-MOLECULES"] && /appears 2 times/.test(pr.held["MOVIN-MOLECULES"].join(" ")) && pr.C.cases.filter((c) => c.status === "Live").length === 4, "two tabs with the same Case ID: that case is held back, the rest play"); }
{ const g = clone(TABS), q = find(g, MM, "QUESTION", 2);     // blank rows and a stray note in the middle of a block change nothing
  insert(g, MM, q + 2, [["", "", "", ""], ["", "(a note to myself, with nothing in column A)", "", ""], ["", "", "", ""]]);
  eq(sect(feedOf(g)), sect(snapshot), "blank rows and notes that leave column A empty change nothing"); }
{ const g = clone(TABS), q = find(g, BL, "QUESTION", 1), s = find(g, BL, "Show only", 1, q);     // Show only: by label, by number, or wrong
  const ids = (f) => f.questions.find((x) => x.id === "BL-01").visuals.join();
  ok(ids(feedOf(g)) === "BL-TABLE", "Show only names a graph or table by its tab label");
  set(g, BL, s, 1, "2, 1"); ok(ids(feedOf(g)) === "BL-BARS,BL-TABLE", "...or by number, in the order written");
  set(g, BL, s, 1, "the big chart"); const f = feedOf(g);
  ok(ids(f) === "" && f.warnings.some((w) => /question 1 .*'Show only' says 'the big chart'/.test(w)), "...and a name that matches nothing shows everything, with a note saying so"); }
{ const g = clone(TABS), P = "Practice questions", q = find(g, P, "QUESTION", 1), t = find(g, P, "For mistake", 1, q);     // a practice question with no mistake named
  set(g, P, t, 1, ""); const f = feedOf(g), pr = LFH.prepare(f, ART);
  ok(f.warnings.some((w) => w.indexOf(`'${P}' tab, row ${q + 1}: this practice question has no 'For mistake'`) === 0), "a practice question that names no mistake is skipped, with its row");
  ok(pr.errors.length === 0, "...and never blocks the feed"); }
{ const g = clone(TABS), P = "Practice questions"; const f0 = feedOf(g);     // the dropdown shows "TAG | title": only the tag is kept
  ok(f0.options.every((o) => !/\|/.test(o.tag)) && f0.questions.every((q) => !/\|/.test(q.forTag)), "the Mistake dropdown shows 'plain words | TAG'; only the tag is used");
  const tagOf = gas(clone(TABS)).ctx.tagOf_;
  ok(tagOf("Graph: read the wrong axis (x instead of y, or y instead of x) | CAL-AXIS") === "CAL-AXIS" && tagOf("CAL-AXIS | Crossed Wires") === "CAL-AXIS" && tagOf("CAL-AXIS") === "CAL-AXIS" && tagOf("") === "" && tagOf("Science: a | b | SCI-KE-TEMP") === "SCI-KE-TEMP", "the tag is found whichever side of the bar it is on, or typed by itself");
  delete g[P]; const pr = LFH.prepare(feedOf(g), ART);
  ok(pr.errors.length === 0 && Object.keys(pr.held).length > 0 && pr.C.cases.some((c) => c.status === "Teaser"), "losing the practice questions holds back the cases that need them (never a crash, never a blocked feed)"); }

/* 4. BOTH LAYOUTS AT ONCE (while cases move over) */
{ const g = clone(SEED); g[MM + " copy"] = clone(TABS[MM]); const t = MM + " copy";
  set(g, t, find(g, t, "Case ID"), 1, "NEW-ONE"); set(g, t, find(g, t, "Short code"), 1, "N1"); set(g, t, find(g, t, "Order"), 1, 12);
  const f = feedOf(g), pr = LFH.prepare(f, ART);
  ok(f.errors.length === 0 && f.cases.length === 9 && f.cases.some((c) => c.id === "NEW-ONE") && f.questions.some((q) => q.id === "N1-01"), "a row-layout Sheet plus one case tab: both are read");
  ok(Object.keys(pr.held).length === 0, "...and the game takes all of it"); }
{ const g = clone(SEED); delete g.Options; ok(feedOf(g).errors.some((e) => /'Options' tab is missing/.test(e)), "with no case tabs, a missing row tab is still a blocking error");
  const g2 = clone(TABS); ok(!g2.Options && feedOf(g2).errors.length === 0, "with case tabs, the old row tabs are simply not needed"); }

/* 5. NEW CASE: the only thing the script writes */
{ const G = gas(clone(TABS), { answers: ["Yeast & Sugar: the big test!"] }); G.run("onOpen()");
  ok(G.ctx.__menu.items[0].join() === "New case,newCase", "the menu starts with New case");
  const before = Object.keys(G.grids).length; G.run("newCase()");
  const name = "Yeast & Sugar: the big test!", made = G.grids[name];
  ok(Object.keys(G.grids).length === before + 1 && made && G.calls.active === name, "New case adds exactly one tab, named after the title, and opens it");
  const val = (label) => made.values[made.values.findIndex((r) => String(r[0]).trim() === label)][1];
  ok(made.values[0][0] === "CASE" && val("Case ID") === "YEAST-SUGAR-THE-BIG-TEST" && val("Title") === name && val("Status") === "Draft" && val("Order") === 9, "...filled in: a Case ID from the title, the title, Draft, and the next Order number");
  ok(G.calls.writes.every((w) => w[0] === "copy" || w[0] === name), "...and it wrote to nothing but the new tab");
  ok(G.grids["New case template"].values[0][0] === "CASE TEMPLATE", "the template itself is untouched");
  const stu = JSON.parse(G.ctx.doGet({ parameter: { fresh: "1" } }).text), drf = JSON.parse(G.ctx.doGet({ parameter: { include: "draft", fresh: "1" } }).text);
  ok(!stu.cases.some((c) => c.id === "YEAST-SUGAR-THE-BIG-TEST") && drf.cases.some((c) => c.id === "YEAST-SUGAR-THE-BIG-TEST"), "a brand-new case is a Draft: students don't see it, teacher preview does");
  eq(sect(stu), sect(snapshot), "...and students' content is exactly what it was");
  const rep = G.ctx.checkReport_(G.ctx.SpreadsheetApp.getActiveSpreadsheet());
  ok(rep.ok && /Drafts with problems/.test(rep.html) && /YEAST-SUGAR-THE-BIG-TEST/.test(rep.html), "'Check my content' lists the empty new case under drafts and still says students are fine"); }
{ const G = gas(clone(TABS), { answers: ["Movin' Molecules", "Movin' Molecules"] }); G.run("newCase()"); G.run("newCase()");
  const names = Object.keys(G.grids).filter((n) => /^Movin' Molecules/.test(n)), idOf = (n) => G.grids[n].values.find((r) => r[0] === "Case ID")[1];
  ok(names.length === 3 && new Set(names.map(idOf)).size === 3, "a title that's already used still gets its own tab name and its own Case ID: " + names.map(idOf).join(", ")); }
{ const G = gas(clone(TABS), { answers: [null, "   "] }), n = Object.keys(G.grids).length; G.run("newCase()"); G.run("newCase()");
  ok(Object.keys(G.grids).length === n && G.calls.writes.length === 0, "Cancel, or an empty title, changes nothing"); }
{ const g = clone(TABS); delete g["New case template"]; const G = gas(g, { answers: ["X"] }), n = Object.keys(G.grids).length; G.run("newCase()");
  ok(Object.keys(G.grids).length === n && /can't find the template/.test(G.alerts[0][1]), "with the template tab missing, New case says so and does nothing"); }

console.log(`${passed} checks passed`);
console.log(fails ? `${fails} FAILURES` : "ALL CASE-TAB TESTS PASSED");
process.exit(fails ? 1 : 0);
