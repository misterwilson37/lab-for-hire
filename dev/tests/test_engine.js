// Headless tests. Usage: node dev/tests/test_engine.js index.html <content.json>   (or just: bash dev/check.sh)
const fs = require("fs"), vm = require("vm");
const src = fs.readFileSync(process.argv[2], "utf8");
const code = src.includes("<script") ? src.match(/<script id="engine">([\s\S]*?)<\/script>/)[1] : src;
const ctx = { console, Math, JSON, Set, Number, String, Object, Array }; ctx.globalThis = ctx; vm.createContext(ctx);
vm.runInContext(code, ctx);
const L = ctx.LFH, C = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log("FAIL", m); } };

// 1. Content validation
const errs = L.validate(C); errs.forEach((e) => console.log("VALIDATION", e)); ok(errs.length === 0, "content validates");

// 2. Phase answer keys: the drawing function must agree with every key (Rule 10 harness on the real data)
const M = L.load(C);
const keys = {
  "PH-DIAGRAM": [["PH-01", 20, 6, "liquid"], ["PH-03 below", 99, 1, "liquid"], ["PH-03 above", 101, 1, "gas"],
    ["PH-04 Bravo", 150, 3, "gas"], ["PH-05 start", 20, 4, "liquid"], ["PH-05 end", 180, 4, "gas"],
    ["PH-06 start", 160, 2, "gas"], ["PH-06 end", 160, 10, "liquid"],
    ["PH-07 A", 20, 6, "liquid"], ["PH-07 B", 50, 8, "liquid"], ["PH-07 C", 160, 4, "gas"], ["PH-07 D", -20, 6, "solid"],
    ["PH-07 E", 100, 10, "liquid"], ["PH-07 F", 180, 6, "gas"],
    ["PH-08 A lo", 140, 2, "gas"], ["PH-08 A hi", 140, 10, "liquid"], ["PH-08 B lo", 160, 4, "gas"], ["PH-08 B hi", 160, 10, "liquid"],
    ["PH-08 C", 20, 4, "liquid"], ["PH-08 C2", 20, 8, "liquid"], ["PH-08 D (false: not solid)", 60, 10, "liquid"],
    ["PH-08 E", 180, 2, "gas"], ["PH-08 E2", 180, 4, "gas"]],
  "DI-DIAGRAM": [["DI-02", -100, 1, "solid"], ["DI-03 end", 20, 1, "gas"], ["DI-05 A", -40, 20, "liquid"], ["DI-05 B", 0, 50, "liquid"],
    ["DI-05 C", -40, 2, "gas"], ["DI-05 D", -100, 10, "solid"], ["DI-05 E", 10, 20, "gas"], ["DI-06 A", 10, 2, "gas"]],
};
for (const [vid, list] of Object.entries(keys)) {
  const m = L.phaseModel(M.visuals[vid]);
  list.forEach(([n, T, P, want]) => { const got = m.state(T, P); ok(got === want, `${vid} ${n}: (${T}, ${P}) want ${want} got ${got}`); });
}
// DI-03: path at 1 atm from -100 to 20 never enters liquid
{ const m = L.phaseModel(M.visuals["DI-DIAGRAM"]); const seq = [];
  for (let T = -100; T <= 20; T += 0.5) { const s = m.state(T, 1); if (seq[seq.length - 1] !== s) seq.push(s); }
  ok(seq.join(">") === "solid>gas", "DI-03 path is solid>gas, got " + seq.join(">")); }
// PH-05 path at 4 atm 20->180 is liquid>gas; PH-06 path at 160C 2->10 is gas>liquid
{ const m = L.phaseModel(M.visuals["PH-DIAGRAM"]); const trace = (f) => { const s = []; for (let i = 0; i <= 200; i++) { const v = f(i / 200); if (s[s.length - 1] !== v) s.push(v); } return s.join(">"); };
  ok(trace((t) => m.state(20 + 160 * t, 4)) === "liquid>gas", "PH-05 path");
  ok(trace((t) => m.state(160, 2 + 8 * t)) === "gas>liquid", "PH-06 path"); }

// 3. Grading
const T = M.tags, O = M.options;
ok(M.tags["CAL-AXIS-CHOICE"] && M.tags["CAL-AXIS-CHOICE"].drill === "variable-placement", "CAL-AXIS-CHOICE wired to variable-placement");
Object.values(M.tags).filter((x) => x.kind === "Calibration").forEach((x) => ok(!/\?/.test(x.explain), `${x.id} explanation should state, not ask`));
const g1 = L.grade(O["MM-06"], ["A", "B"], T); ok(g1.correct, "pick two correct");
const g2 = L.grade(O["MM-06"], ["A", "D"], T); ok(!g2.correct && g2.tags[0] === "SCI-KE-TEMP", "pick two wrong -> tag");
const CPQ = L.instance("COLD-PACK", { n: 1, variant: "classic", seed: 1 }).qs.find((q) => q.type === "Select all that apply" && q.stage === "analyze");   // successor of CP-04
const g3 = L.grade(CPQ.options, ["A", "C"], T); ok(!g3.correct && g3.tags[0].startsWith("CAL"), "SATA miss+wrong -> Calibration first");
const g4 = L.grade(O["MM-07"], ["A", "B", "E", "D"], T); ok(g4.tags.includes("SCI-EVIDENCE"), "SATA extra wrong -> evidence tag");
const g5 = L.grade(O["BL-03"], ["B", "D"].slice(0,1), T); ok(g5.tags[0] === "SCI-PARTICLES-CHANGE", "MC wrong tag");

// 4. Build mode
const mm = M.visuals["MM-GRAPH"];
ok(L.checkPlot(mm, 2, 40, 700).ok, "plot exact ok");
// Build-mode questions must NOT be answerable by copying a plotted value (Jake, round 2)
const pts = mm.series[0].points, interp = (x) => { const s = pts.slice().sort((a, b) => a.x - b.x); for (let k = 0; k < s.length - 1; k++) if (x >= s[k].x && x <= s[k + 1].x) return s[k].y + (x - s[k].x) / (s[k + 1].x - s[k].x) * (s[k + 1].y - s[k].y); };
ok(Math.abs(interp(20) - 650) < 0.01, "MM-01: 650 m/s is at 20C on the line");
ok(Math.abs(interp(80) - 725) < 5 && Math.abs(interp(80) - 700) > 20 && Math.abs(interp(80) - 750) > 20, "MM-02: 80C reads ~725, clearly between gridlines");
ok(!pts.some((p) => p.x === 20 || p.x === 80), "MM-01/02 ask about unmeasured temperatures");
const slope = (a, b) => (b.y - a.y) / (b.x - a.x); const sp = pts.slice().sort((a, b) => a.x - b.x);
const sl = sp.slice(1).map((p, k) => slope(sp[k], p));
ok(sl[0] === sl[1] && sl[1] > sl[2] && sl[1] > sl[3], "MM-04: first two sections tie for steepest");
ok(L.buildAxisOptions(mm).find((o) => !o.correct).tag === "CAL-AXIS-CHOICE", "axis-choice error routes to its own drill");
ok(L.checkPlot(mm, 2, 20, 700).tag === "CAL-SPACING", "equal-spacing error detected");
ok(L.checkPlot(mm, 3, 100, 750).tag === "CAL-SCALE", "y scale error");
ok(L.checkPlot(mm, 3, 60, 650).tag === "CAL-POINT", "both wrong -> point");
const so = L.buildScaleOptions(mm); ok(so.filter((o) => o.correct).length === 1 && so.length === 4, "scale options");
ok(!/up to 800/.test(so[1].text), "short scale really is short: " + so[1].text);

// 5. Drills: stress each generator
for (const [id, gen] of Object.entries(L.drills)) {
  for (let i = 0; i < 300; i++) {
    let d; try { d = L.makeDrill(id); } catch (e) { ok(false, `${id} threw ${e.message}`); break; }
    if (!d) { ok(false, `${id} returned nothing`); break; }
    const nc = d.options.filter((o) => o.correct).length;
    const texts = d.options.map((o) => o.text);
    if (nc !== 1) { ok(false, `${id} has ${nc} correct: ${texts}`); break; }
    if (new Set(texts).size !== texts.length) { ok(false, `${id} duplicate options: ${texts}`); break; }
    if (d.options.length < 3) { ok(false, `${id} only ${d.options.length} options: ${texts}`); break; }
    if (texts.some((t) => /NaN|undefined|Infinity/.test(t)) || /NaN|undefined/.test(d.prompt + d.why)) { ok(false, `${id} bad text: ${d.prompt} | ${texts}`); break; }
    // science honesty: no negative values; particle speed / gas volume / pressure-with-depth never fall
    const allY = (d.visual.series || []).flatMap((z) => z.points.map((p) => p.y));
    if (allY.some((v) => v < 0) || texts.some((t) => /^−/.test(t) && !/°C/.test(t))) { ok(false, `${id} negative value: ${texts}`); break; }
    if (d.visual.type === "Line graph" && /Particle speed|Gas volume|Water pressure/.test(d.visual.y.label)) {
      const pts = d.visual.series[0].points.slice().sort((a, b) => a.x - b.x);
      if (pts.some((p, k) => k && p.y < pts[k - 1].y)) { ok(false, `${id} ${d.visual.y.label} falls as ${d.visual.x.label} rises`); break; }
    }
    // realism: temperatures a 7th grader would believe for these contexts
    if (d.visual.y && /temperature/i.test(d.visual.y.label || "") && d.visual.type !== "Phase diagram") {
      const lim = /Air/.test(d.visual.y.label) ? 45 : 120;
      if (allY.some((v) => v > lim)) { ok(false, `${id} unrealistic ${d.visual.y.label}: max ${Math.max(...allY)}`); break; }
    }
    if (id === "uneven-spacing" && /rose more in total \((.+?)\)/.test(d.why)) {
      const m = d.why.match(/rose ([\d.]+).*?rose more in total \(([\d.]+)/);
      if (m && !(+m[2] > +m[1])) { ok(false, `${id} fake trap: ${d.why}`); break; }
    }
    if (d.visual.type === "Phase diagram") {
      const m = L.phaseModel(d.visual); const want = d.options.find((o) => o.correct).text.toLowerCase();
      if (id === "phase-region") { const h = d.visual.highlight[0]; if (m.state(h.x, h.y) !== want) { ok(false, `${id} key disagrees`); break; } }
    }
  }
}
// 6. The lab business
ok(L.payout({ pay: 60, pts: 24, max: 24 }) === 60, "perfect first run pays full");
ok(L.payout({ pay: 60, pts: 0, max: 24 }) === 25, "rough work still pays ~40%");
ok(L.payout({ pay: 60, pts: 24, max: 24, missions: 2 }) === 70, "side missions add $5 each");
ok(L.payout({ pay: 60, pts: 24, max: 24, replay: true }) === 15, "replay pays 25%");
ok(L.payout({ pay: 70, pts: 23, max: 24, weak: true }) === 55 && L.payout({ pay: 70, pts: 23, max: 24 }) === 70, "a weak recommendation is capped at part of the fee");
ok(L.payout({ pay: 70, pts: 23, max: 24, weak: true, missions: 2 }) === 65, "side missions still pay on a weak recommendation");
const P0 = L.migrate({ v: 1, cases: { "MOVIN-MOLECULES": { best: 20, stars: 3, done: true } }, bayCorrect: 4 });
ok(P0.v === 2 && P0.cases["MOVIN-MOLECULES"].done && P0.bayCorrect === 4 && P0.funds === 0 && P0.placed.room === "paint-lavender", "v1 save migrates");
ok(JSON.stringify(L.migrate(JSON.parse(JSON.stringify(P0)))) === JSON.stringify(P0), "v2 save round-trips unchanged");
ok(L.migrate(null).v === 2 && L.migrate("junk").v === 2, "garbage save -> fresh lab");
const Pj = L.freshProgress();
let J = L.jobs(M, Pj, false);
ok(J.filter((j) => j.state === "open").length === 1 && J[0].c.id === "MOVIN-MOLECULES", "fresh lab: only the first job is open");
ok(J.filter((j) => j.state === "teaser").length === 3, "three teasers advertise the year");
["MOVIN-MOLECULES", "COLD-PACK", "PHASE-PROBE", "DRY-ICE"].forEach((id) => (Pj.cases[id] = { done: true }));
J = L.jobs(M, Pj, false);
const bl = J.find((j) => j.c.id === "BOUNCE-LAB");
ok(bl && bl.state === "locked" && bl.needs === "pressure-gauge", "Bounce Lab waits for a pressure gauge");
const items = C.items, gauge = items.find((i) => i.id === "pressure-gauge");
ok(L.shopState(gauge, Pj, items).state === "short", "can't buy without funds");
Pj.funds = 100; ok(L.buy(gauge, Pj, items) && Pj.funds === 20 && Pj.placed["bench-3"] === "pressure-gauge", "buying places the item");
ok(L.jobs(M, Pj, false).find((j) => j.c.id === "BOUNCE-LAB").state === "open", "owning the gauge opens the job");
const candles = items.find((i) => i.id === "candles"); Pj.funds = 100;
ok(L.shopState(candles, Pj, items).state === "needs", "candles need a bookshelf first");
const skel = items.find((i) => i.id === "skeleton"); const Pr = L.freshProgress(); Pr.funds = 999;
ok(L.shopState(skel, Pr, items).state === "rank", "rank-gated item says so");
items.forEach((it) => ok(it.price >= 0 && it.sprite, `${it.id} priced with art`));
// 7. Shop items match the baked art (index.html carries the art block)
const artBlock = src.match(/<script id="lfh-art" type="application\/json">([\s\S]*?)<\/script>/);
if (artBlock) { const AE = L.validateArt(C, JSON.parse(artBlock[1])); AE.forEach((e) => console.log("ART", e)); ok(AE.length === 0, "every item has art in the right slot"); }
const bad = L.validateArt({ items: [{ id: "x", sprite: "nope", slot: "pet" }] }, { layers: { desk: {}, laptop: {}, bench: {} } });
ok(bad.length === 1, "art validator catches a missing sprite");
// 8. Save file (backup to Drive). The real-data proof is in play.py (a lab built by the full loop survives a wipe).
{
  const Ps = L.freshProgress(); Ps.labName = "The Curious Comet Lab"; Ps.funds = 215;
  ["MOVIN-MOLECULES", "COLD-PACK"].forEach((id) => (Ps.cases[id] = { done: true, best: 20, stars: 3 }));
  Ps.owned["pet-cat"] = true; Ps.placed.pet = "pet-cat"; Ps.history.push({ caseId: "COLD-PACK", pay: 70 });
  Ps.activeJob = { caseId: "PHASE-PROBE", qi: 3 };
  const now = "2026-10-12T15:00:00.000Z", text = L.exportSave(Ps, now), r = L.importSave(text);
  ok(r.ok, "a fresh save file loads");
  const want = JSON.parse(JSON.stringify(Object.assign({}, Ps, { backedUpAt: now })));
  ok(r.ok && JSON.stringify(r.progress) === JSON.stringify(L.migrate(want)), "save file round-trips every field (funds, items, stars, mid-job)");
  ok(Ps.backedUpAt === "", "exporting does not change the live lab until the save succeeds");
  const f = JSON.parse(text); f.progress.funds = 99999;
  ok(!L.importSave(JSON.stringify(f)).ok, "an edited save (funds changed by hand) is refused");
  const g = JSON.parse(text); g.progress.v = 3; g.check = L.checksum(JSON.stringify(g.progress));
  ok(/newer version/.test(L.importSave(JSON.stringify(g)).error), "a save from a newer game version is refused with a reason");
  ok(!L.importSave("hello").ok && !L.importSave("{\"a\":1}").ok && !L.importSave("").ok, "non-save files are refused");
  ok(!L.importSave(text.slice(0, text.length - 40)).ok, "a truncated file is refused");
  ok(L.backupAge({ backedUpAt: "" }, Date.parse(now)) === "never" && L.backupAge({ backedUpAt: now }, Date.parse(now) + 3 * 86400000) === "3 days ago", "backup age reads plainly");
  ok(!L.hasProgress(L.freshProgress()) && L.hasProgress(Ps), "fresh device has nothing to overwrite");
  ok(!/"(name|email|student|id)"\s*:/i.test(text.replace(/"(caseId|id)":"[A-Z-]+"/g, "")), "save file carries no identity fields");
}
// 9. Job templates: Cold Pack. Rule 10 anchor = Hanson's sample data from the v0.3.0 Sheet (the rows this template replaced).
{
  const HANSON = { "ammonium-nitrate": [22, 6, 3, 4, 6, 8], "urea": [22, 9, 7, 7, 8, 10], "sodium-chloride": [22, 21, 21, 21, 21, 22], "calcium-chloride": [22, 38, 44, 42, 39, 36] };
  const HANSON_COST = { "ammonium-nitrate": 1.2, "urea": 0.85, "sodium-chloride": 0.1, "calcium-chloride": 0.6 };
  const c = L.instance("COLD-PACK", { n: 1, variant: "classic", seed: 1 });
  Object.entries(HANSON).forEach(([s, want]) => {
    const got = c.readings.read[s], exact = s !== "calcium-chloride";
    ok(got.every((v, i) => (exact ? v === want[i] : Math.abs(v - want[i]) <= 1)), `classic ${s}: model ${got} vs Hanson ${want} (${exact ? "exact" : "within 1°C"})`);
    ok(c.params.prices[s] === HANSON_COST[s], `classic ${s} price matches her cost table`);
  });
  ok(c.claim === "urea" && c.pass.join() === "ammonium-nitrate,urea", "classic key = her key: AN and urea pass (old CP-04); urea wins on cost (old CP-05)");
  ok(JSON.stringify(L.instance("COLD-PACK", { n: 1, variant: "classic", seed: 99 }).readings) === JSON.stringify(c.readings), "classic first play is always her example");
  const readQ = c.qs.find((q) => q.skill === "Read a value");
  ok(readQ && readQ.options.map((o) => o.text).join() === "7°C,3°C,9°C,5°C", "classic read-a-value matches her old CP-01 (urea at 4 min = 7°C)");

  // Independent answer-key checker: reads ONLY the student-facing graph points and cost-table text, never the generator's internals.
  const keyFromVisuals = (inst) => {
    const g = inst.visuals["CPT-GRAPH"], cost = {}; inst.visuals["CPT-COST"].table.rows.forEach(([n, p]) => (cost[n] = parseFloat(p.slice(1))));
    const P = inst.params, hot = inst.kind === "hot";
    const val = (s, t) => s.points.find((p) => p.x === t).y;
    const pass = g.series.filter((s) => !s.control).filter((s) => [P.t1, P.t2].every((t) => (hot ? val(s, t) > P.th : val(s, t) < P.th))).map((s) => s.name);
    return { pass, claim: pass.slice().sort((a, b) => cost[a] - cost[b])[0], cost };
  };
  const variants = ["hot", "longer", "colder", "prices", "followup"];
  const seen = { claim: new Set(), th: new Set(), t: new Set() };
  let n = 0;
  variants.forEach((variant) => { for (let seed = 1; seed <= 400; seed++) {
    const i = L.instance("COLD-PACK", { n: 2, variant, seed }), k = keyFromVisuals(i), tag = `${variant}#${seed}`; n++;
    ok(!i.fallback, `${tag}: generator had to fall back`);
    ok(k.claim === i.claimName, `${tag}: claim ${i.claimName} but the visuals say ${k.claim}`);
    ok(k.pass.length >= 2 && k.pass.length < 4, `${tag}: needs 2-3 passing substances, got ${k.pass.length}`);
    const sorted = Object.entries(k.cost).filter(([nm]) => k.pass.includes(nm)).map(([, p]) => p).sort((a, b) => a - b);
    ok(sorted[1] - sorted[0] >= 0.095, `${tag}: cheapest passer must be clear`);
    const g = i.visuals["CPT-GRAPH"];
    g.series.forEach((s) => s.points.forEach((p) => ok(p.y >= 1 && p.y <= 49 && Number.isInteger(p.y), `${tag}: ${s.name} ${p.y}°C must be a whole number on the graph`)));
    const ctl = g.series.find((s) => s.control); ok(ctl && ctl.points.every((p) => Math.abs(p.y - i.params.T0) <= 1), `${tag}: plain water stays at room temperature`);
    g.series.filter((s) => !s.control).forEach((s) => [i.params.t1, i.params.t2].forEach((t) => ok(Math.abs(s.points.find((p) => p.x === t).y - i.params.th) >= 2, `${tag}: ${s.name} too close to the ${i.params.th}° line`)));
    const sp = i.params.subs.map((s) => L.SUBSTANCES[s]);
    g.series.filter((s) => !s.control).forEach((s, j) => { const D = sp[j].D, ext = D < 0 ? Math.min(...s.points.map((p) => p.y)) : Math.max(...s.points.map((p) => p.y));
      if (Math.abs(D) > 5) ok(D < 0 ? ext < i.params.T0 - 5 : ext > i.params.T0 + 5, `${tag}: ${s.name} must clearly ${D < 0 ? "cool" : "warm"} the water`); });
    i.qs.forEach((q) => {
      const nc = q.options.filter((o) => o.correct).length, r = L.required(q.type);
      ok(r.exact ? nc === r.exact : nc >= 1, `${tag} ${q.skill}: ${q.type} has ${nc} correct`);
      ok(new Set(q.options.map((o) => o.text)).size === q.options.length, `${tag} ${q.skill}: duplicate option text`);
      q.options.forEach((o) => { ok(o.correct || o.tag, `${tag} ${q.skill}: wrong option '${o.text}' has no tag`); if (o.tag) ok(!!M.tags[o.tag], `${tag}: unknown tag ${o.tag}`); });
      ok(!/\?/.test(q.why), `${tag} ${q.skill}: explanation should state, not ask`);
    });
    // read-a-value: the keyed number must be what the graph shows
    const rq = i.qs.find((q) => q.skill === "Read a value");
    if (rq) { const m = rq.prompt.match(/with (.+) at (\d+) minutes/), s = g.series.find((x) => x.name === m[1]);
      ok(rq.options.find((o) => o.correct).text === `${s.points.find((p) => p.x === +m[2]).y}°C`, `${tag}: read-a-value key disagrees with the graph`); }
    // evidence: every number in the correct statements must match the visuals
    const ev = i.qs.find((q) => q.label === "Evidence"), s0 = g.series.find((x) => x.name === i.claimName);
    const e1 = ev.options[0].text.match(/at (\d+) minutes \((\d+)°C\) and at (\d+) minutes \((\d+)°C\)/);
    ok(e1 && s0.points.find((p) => p.x === +e1[1]).y === +e1[2] && s0.points.find((p) => p.x === +e1[3]).y === +e1[4], `${tag}: evidence statement numbers disagree with the graph`);
    ok(ev.options[1].text.includes(`$${k.cost[i.claimName].toFixed(2)}`), `${tag}: evidence statement price disagrees with the cost table`);
    const fq = ev.options[3].text.match(/^(.+) was /); ok(fq && !k.pass.includes(fq[1]), `${tag}: the 'false' evidence statement is actually true`);
    ok(i.qs.filter((q) => q.stage === "plan").length === 2 && i.qs.filter((q) => q.stage === "recommend").length === 3, `${tag}: 2 plan + 3 recommendation questions`);
    seen.claim.add(i.claimName); seen.th.add(i.params.th); seen.t.add(i.params.t1 + "-" + i.params.t2);
    ok(JSON.stringify(L.instance("COLD-PACK", { n: 2, variant, seed }).readings) === JSON.stringify(i.readings), `${tag}: same seed must rebuild the same job (resume)`);
  } });
  ok(seen.claim.size >= 4 && seen.th.size >= 8 && seen.t.size >= 4, `replays really vary: ${seen.claim.size} winners, ${seen.th.size} rule lines, ${seen.t.size} time pairs`);
  ok(L.instance("COLD-PACK", { n: 2, variant: "hot", seed: 3 }).kind === "hot" && L.instance("COLD-PACK", { n: 2, variant: "hot", seed: 3 }).qs.some((q) => /HOT|hot packs/.test(q.prompt)), "hot variant asks about hot packs");
  ok(c.qs.filter((q) => q.stage === "plan").length === 4, "first play plans the whole test (4 plan questions)");
  ["PLAN-ONE-CHANGE", "PLAN-CONTROL", "PLAN-TRIALS", "PLAN-MEASURE", "CER-CRITERIA"].forEach((t) => ok(M.tags[t] && M.tags[t].kind === "Archive" && (M.checks[t] || []).length, `${t}: Archive tag with a check question in the Sheet`));
  const VT = L.validateTemplates(C); VT.forEach((e) => console.log("TEMPLATE", e)); ok(VT.length === 0, "template tags all exist in the Sheet");
  // the economy of follow-ups
  ok(L.nextOffer("COLD-PACK", 1, true, 5).variant === "hot" && L.nextOffer("COLD-PACK", 1, false, 5).variant === "followup", "strong work -> sequel (hot packs); weak work -> follow-up with fresh data");
  const rec = (c3, e, r) => { const o = {}; c.qs.forEach((q) => (o[q.id] = { points: q.label === "Claim" ? c3 : q.label === "Evidence" ? e : q.label === "Reasoning" ? r : 3 })); return o; };
  ok(L.recommendationStrong(c.qs, rec(3, 3, 2)) && !L.recommendationStrong(c.qs, rec(2, 3, 3)) && !L.recommendationStrong(c.qs, rec(3, 2, 2)), "strong = claim first try, at most one retry on evidence + reasoning");
  console.log(`  template harness: ${n} generated jobs checked against their own visuals`);
}
console.log(fails ? `${fails} FAILURES` : "ALL TESTS PASSED");
process.exit(fails ? 1 : 0);
