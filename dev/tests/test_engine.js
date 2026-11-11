// Headless tests. Usage: node dev/tests/test_engine.js index.html [content.json]   (or just: bash dev/check.sh)
// With no content.json, the snapshot embedded in index.html is tested (that is what ships).
const fs = require("fs"), vm = require("vm");
const src = fs.readFileSync(process.argv[2], "utf8");
const code = src.includes("<script") ? src.match(/<script id="engine">([\s\S]*?)<\/script>/)[1] : src;
const ctx = { console, Math, JSON, Set, Number, String, Object, Array }; ctx.globalThis = ctx; vm.createContext(ctx);
vm.runInContext(code, ctx);
const embedded = src.includes("<script") ? JSON.parse(src.match(/<script id="lfh-content"[^>]*>([\s\S]*?)<\/script>/)[1].replace(/<\\\//g, "</")) : null;
const L = ctx.LFH, C = process.argv[3] && process.argv[3] !== "-" ? JSON.parse(fs.readFileSync(process.argv[3], "utf8")) : embedded;
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
const artBlock = src.match(/<script id="lfh-art" type="application\/json">([\s\S]*?)<\/script>/);
const ART = artBlock ? JSON.parse(artBlock[1].replace(/<\\\//g, "</")) : null, MAN = ART.manifest;
const items = C.items, item = (id) => items.find((i) => i.id === id);
const fresh = () => L.sanitizeProgress(L.freshProgress(), C, ART);
const P0 = L.migrate({ v: 1, cases: { "MOVIN-MOLECULES": { best: 20, stars: 3, done: true } }, bayCorrect: 4 });
ok(P0.v === 3 && P0.cases["MOVIN-MOLECULES"].done && P0.bayCorrect === 4 && P0.funds === 0 && P0.lab === null, "v1 save migrates");
ok(JSON.stringify(L.migrate(JSON.parse(JSON.stringify(P0)))) === JSON.stringify(P0), "a current save round-trips unchanged");
ok(L.migrate(null).v === 3 && L.migrate("junk").v === 3, "garbage save -> fresh lab");
{ // a save from the old shop (v2: owned as a map, one item per slot) keeps what still exists and gets a fresh room
  const old = { v: 2, labName: "The Old Lab", funds: 40, owned: { "paint-lavender": true, microscope: true, "pet-penguin": true, "pet-cat": true }, placed: { room: "paint-lavender", "bench-1": "microscope", pet: "pet-cat" }, cases: { "MOVIN-MOLECULES": { done: true, best: 20 } }, inbox: { read: { a: 1 }, arrived: {}, seq: 3 }, history: [{ caseId: "MOVIN-MOLECULES", pay: 60 }] };
  const Pn = L.sanitizeProgress(L.migrate(old), C, ART);
  ok(Pn.v === 3 && Pn.funds === 40 && Pn.labName === "The Old Lab" && Pn.history.length === 1 && Pn.inbox.seq === 3 && !("owned" in Pn) && !("placed" in Pn), "old-shop save: funds, name, history, and inbox survive; the old owned/placed records are gone (one record, not two)");
  ok(L.owns(Pn, "microscope") && L.owns(Pn, "pet-cat") && !L.owns(Pn, "pet-penguin") && !L.owns(Pn, "paint-lavender") && L.owns(Pn, "desk"), "old-shop save: items that still exist stay owned (in storage), retired ones are dropped, the starter lab is added");
}
// 6a. The lab: starter room, storage, buying, ranks, awards (rules in LFH.lab; src/lab.js only draws)
{
  const Pf = fresh(), lab = Pf.lab, rm = lab.rooms.main;
  const starters = items.filter((i) => i.price === 0 && i.kind !== "Award").map((i) => i.id);
  ok(starters.every((id) => lab.owned.includes(id)) && lab.owned.length === starters.length, "starter lab = every Price 0 row (no Awards), owned from the start");
  ok(rm.placed.bench === "desk" && rm.placed["bench-1"] === "beaker" && rm.placed["bench-2"] === "laptop" && rm.placed.shelf === "shelf-open" && !rm.placed["bench-3"], "starters are placed in row order: beaker, then the laptop, on the desk");
  ok(rm.paint.wall === "wall-white" && rm.paint.floor === "floor-lilac" && rm.paint.trim === "trim-purple" && rm.paint.tiles === "tiles-plain", "starter paint is the free row of each kind");
  ok(!("funds" in lab), "the lab record holds no money: funds live in progress.funds only");
  const canon = (o) => JSON.stringify(o, (k, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((x) => [x, v[x]])) : v));
  ok(canon(L.lab.normalize(lab, items, MAN)) === canon(lab), "normalize leaves a good lab untouched");
  const micro = item("microscope");
  ok(L.lab.canBuy(micro, lab, 100, 0).state === "short" && /Need \$50 more/.test(L.lab.canBuy(micro, lab, 100, 0).why), "can't buy without funds, and the button says how much more");
  const got = L.lab.buy(micro, lab, 200, 0);
  ok(got && got.funds === 50 && got.lab.owned.includes("microscope") && !lab.owned.includes("microscope"), "buying takes the price and adds the item (without changing the lab it was given)");
  ok(L.lab.buy(micro, got.lab, 500, 0) === null && L.lab.canBuy(micro, got.lab, 500, 0).state === "owned", "one of each: an owned item can't be bought twice");
  const bunny = item("pet-bunny");
  ok(L.lab.canBuy(bunny, lab, 999, 0).state === "rank" && /Lab Tech/.test(L.lab.canBuy(bunny, lab, 999, 0).why) && L.lab.canBuy(bunny, lab, 999, 1).ok, "a rank-gated item says which rank, and opens at that rank");
  const award = item("graph-frame");
  ok(award && award.kind === "Award" && L.lab.canBuy(award, lab, 999, 4).state === "award" && L.lab.buy(award, lab, 999, 4) === null, "an Award can never be bought");
  const g1 = L.lab.grant(lab, items, "graph-frame", { title: "A", type: "line", points: [[0, 1], [1, 2]] }, MAN);
  ok(g1.owned.includes("graph-frame") && g1.rooms.main.placed["poster-left"] === "graph-frame" && g1.awards["graph-frame"].title === "A", "an earned award goes up in the empty poster spot");
  const g2 = L.lab.grant(g1, items, "graph-frame", { title: "B", type: "line", points: [[0, 3], [1, 4]] }, MAN);
  ok(g2.awards["graph-frame"].title === "B" && g2.owned.filter((x) => x === "graph-frame").length === 1, "earning it again replaces the graph (the newest wins), never duplicates it");
  // repairs: whatever a stale save or an edited Items tab does, the lab stays drawable
  const messy = { owned: ["microscope", "microscope", "no-such-item"], rooms: { main: { placed: { pet: "microscope", "bench-3": "microscope", "table-1": "beaker", bench: "pet-cat" }, paint: { wall: "floor-lilac", floor: "wall-any" }, colors: { wall: "red", trim: "#abcdef" } } }, funds: 5 };
  const fixed = L.lab.normalize(messy, items, MAN), fr = fixed.rooms.main;
  ok(fixed.owned.filter((x) => x === "microscope").length === 1 && !fixed.owned.includes("no-such-item") && !("funds" in fixed), "normalize drops duplicates, unknown items, and any stray funds");
  ok(!fr.placed.pet && fr.placed["bench-3"] === "microscope" && fr.placed.bench === "desk" && !fr.placed["table-1"], "normalize: wrong-spot items go to storage, the required bench comes back, nothing floats on a table that isn't there");
  ok(fr.paint.wall === "wall-white" && fr.paint.floor === "floor-lilac" && !fr.colors.wall && fr.colors.trim === "#ABCDEF", "normalize: paint the student doesn't own (or in the wrong place) falls back to the starter; bad colors are dropped");
  ok(L.lab.normalize(null, items, MAN).rooms.main.placed.bench === "desk" && L.lab.normalize("junk", items, MAN).owned.length === starters.length, "normalize never throws on garbage");
}
const Pj = fresh();
let J = L.jobs(M, Pj, false);
ok(J.filter((j) => j.state === "open").length === 1 && J[0].c.id === "MOVIN-MOLECULES", "fresh lab: only the first job is open");
ok(J.filter((j) => j.state === "teaser").length === 3, "three teasers advertise the year");
["MOVIN-MOLECULES", "COLD-PACK", "PHASE-PROBE", "DRY-ICE"].forEach((id) => (Pj.cases[id] = { done: true }));
J = L.jobs(M, Pj, false);
const bl = J.find((j) => j.c.id === "BOUNCE-LAB");
ok(bl && bl.state === "locked" && bl.needs === "pressure-gauge", "Bounce Lab waits for a pressure gauge");
{ const got = L.lab.buy(item("pressure-gauge"), Pj.lab, 100, 0); Pj.lab = got.lab; Pj.funds = got.funds; }
ok(Pj.funds === 20 && L.jobs(M, Pj, false).find((j) => j.c.id === "BOUNCE-LAB").state === "open", "owning the gauge opens the job (even while it sits in storage)");
ok(L.jobs(M, Pj, false).find((j) => j.c.id === "CELL-CLINIC").state === "teaser", "a teaser stays a teaser until its equipment is owned");
items.forEach((it) => ok(it.price >= 0 && it.sprite, `${it.id} priced with art`));
C.cases.filter((c) => c.requires).forEach((c) => ok(item(c.requires) && item(c.requires).kind === "Equipment" && item(c.requires).unlocks, `${c.id} requires a piece of Equipment whose Unlocks note tells students what it's for`));
// 7. Items match the baked art (index.html carries the art block), and the engine's list of spots IS the art's
{ const f = L.fitToArt(C, ART); f.warnings.concat(f.errors).forEach((e) => console.log("ART", e)); ok(f.warnings.length === 0 && f.errors.length === 0 && f.held.length === 0, "every item has a picture for every spot it can go in"); }
ok([...new Set(MAN.slots.map((sl) => sl.type))].sort().join() === L.lab.SLOTS.filter((x) => !L.lab.PAINT_KEYS[x]).sort().join(), "the Slot dropdown (LFH.lab.SLOTS) is exactly the room art's spot types plus the four paints");
ok(items.every((it) => L.lab.paintKey(it) || MAN.thumbs[it.sprite]), "every store item has a thumbnail");
ok(Object.values(MAN.sprites).every((sp) => ART.sprites[sp.file]) && Object.values(MAN.thumbs).every((f) => ART.sprites[f]), "every picture the manifest names is in the page");
// 8. Save file (backup to Drive). The real-data proof is in play.py (a lab built by the full loop survives a wipe).
{
  const Ps = fresh(); Ps.labName = "The Curious Comet Lab"; Ps.funds = 215;
  ["MOVIN-MOLECULES", "COLD-PACK"].forEach((id) => (Ps.cases[id] = { done: true, best: 20, stars: 3 }));
  Ps.lab.owned.push("pet-cat"); Ps.lab.rooms.main.placed.pet = "pet-cat"; Ps.history.push({ caseId: "COLD-PACK", pay: 70 });
  Ps.activeJob = { caseId: "PHASE-PROBE", qi: 3 };
  const now = "2026-10-12T15:00:00.000Z", text = L.exportSave(Ps, now), r = L.importSave(text);
  ok(r.ok, "a fresh save file loads");
  const want = JSON.parse(JSON.stringify(Object.assign({}, Ps, { backedUpAt: now })));
  ok(r.ok && JSON.stringify(r.progress) === JSON.stringify(L.migrate(want)), "save file round-trips every field (funds, items, stars, mid-job)");
  ok(Ps.backedUpAt === "", "exporting does not change the live lab until the save succeeds");
  const f = JSON.parse(text); f.progress.funds = 99999;
  ok(!L.importSave(JSON.stringify(f)).ok, "an edited save (funds changed by hand) is refused");
  const g = JSON.parse(text); g.progress.v = 4; g.check = L.checksum(JSON.stringify(g.progress));
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
// 10. Content: vocabulary, quarantine, art fitting, the chooser, and saved progress meeting changed content
const clone = (x) => JSON.parse(JSON.stringify(x));
{ const V = L.vocab();
  ok(V.Drill.length === Object.keys(L.drills).length && V.Drill.length === 13, "vocabulary: the Drill list IS the engine's drills");
  ok(V.Rank.join() === L.RANKS.map((r) => r.name).join(), "vocabulary: the Rank list IS the engine's ranks");
  ok(L.checkLists({ Status: ["Draft", "Live"] }).some((w) => /missing 'Teaser'/.test(w)), "checkLists notices a dropdown that lacks a value the game uses");
  ok(L.checkLists(Object.assign(clone(V), { Skill: V.Skill.concat(["Vibes"]) })).some((w) => /'Vibes'/.test(w)), "checkLists notices a value the game doesn't understand");
  ok(L.checkLists(clone(V)).length === 0, "checkLists is silent when the Sheet matches"); }
{ const D = clone(C); D.questions.filter((q) => q.role === "Check" && q.forTag === "SCI-KE-TEMP").forEach((q) => (q.role = "Nope"));
  const q = L.quarantine(D);   // removing a tag's only Check questions must hold exactly the cases that use that tag
  ok(Object.keys(q.held).sort().join() === "DRY-ICE,MOVIN-MOLECULES,PHASE-PROBE" && /Archive tag has no Check question/.test(q.held["DRY-ICE"][0]), "cascade: no Check question for SCI-KE-TEMP holds exactly the three cases that use it: " + Object.keys(q.held).sort());
  ok(q.C.cases.some((c) => c.id === "COLD-PACK") && q.errors.length === 0, "...and the other cases carry on"); }
{ const D = clone(C); D.items.push({ id: "ghost", name: "Ghost", slot: "pet", price: 10, kind: "Cosmetic", unlocks: "", rank: "", sprite: "no-such-art", desc: "" });
  D.items.push({ id: "wrongspot", name: "Wrong", slot: "pet", price: 10, kind: "Cosmetic", unlocks: "", rank: "", sprite: "microscope", desc: "" });
  D.items.find((i) => i.id === "pressure-gauge").sprite = "no-such-art";
  const p = L.prepare(D, ART);
  ok(!p.C.items.some((i) => i.id === "ghost" || i.id === "wrongspot" || i.id === "pressure-gauge"), "fitToArt: items without a matching picture never reach the store");
  ok(p.held["BOUNCE-LAB"] && !p.C.cases.some((c) => c.id === "BOUNCE-LAB"), "fitToArt: a job needing a picture-less item is held back, not given away free");
  ok(p.warnings.some((w) => /ghost.*no 'no-such-art' picture/.test(w)) && p.warnings.some((w) => /wrongspot.*no 'microscope' picture for a pet spot/.test(w)), "fitToArt: says why, in plain words"); }
{ const p = L.prepare(C, ART); ok(Object.keys(p.held).length === 0 && p.errors.length === 0 && p.warnings.length === 0 && p.C.cases.length === C.cases.length, "the shipped snapshot prepares with nothing held or warned"); }
{ const bad = (mut) => { const D = clone(C); mut(D); return L.prepare(D, ART); };   // the Items tab, edited by a teacher
  let p = bad((D) => { D.items.find((i) => i.id === "pet-cat").kind = "Pet"; });
  ok(!p.C.items.some((i) => i.id === "pet-cat") && p.warnings.some((w) => /pet-cat.*Kind 'Pet'/.test(w)) && p.errors.length === 0, "an item with a Kind the game doesn't know is skipped with a warning");
  p = bad((D) => { D.items.find((i) => i.id === "pet-cat").slot = "ceiling"; });
  ok(!p.C.items.some((i) => i.id === "pet-cat") && p.warnings.some((w) => /pet-cat.*Slot 'ceiling'/.test(w)), "an item in a spot the lab doesn't have is skipped");
  p = bad((D) => { D.items.find((i) => i.id === "graph-frame").price = 20; });
  ok(!p.C.items.some((i) => i.id === "graph-frame") && p.warnings.some((w) => /graph-frame.*Award/.test(w)), "an Award with a price is skipped (awards are earned)");
  p = bad((D) => { D.items.find((i) => i.id === "wall-mint").sprite = "minty"; });
  ok(!p.C.items.some((i) => i.id === "wall-mint") && p.warnings.some((w) => /wall-mint.*color like/.test(w)), "a paint whose color isn't a color is skipped");
  p = bad((D) => { D.items.push(clone(D.items.find((i) => i.id === "pet-dog"))); });
  ok(p.C.items.filter((i) => i.id === "pet-dog").length === 0 && p.warnings.some((w) => /pet-dog.*used twice/.test(w)), "a copy-pasted ItemID is skipped rather than guessed at");
  p = bad((D) => { D.items.find((i) => i.id === "wall-white").price = 10; });
  ok(p.errors.some((e) => /no free starter row for paint-wall/.test(e)), "no free wall paint: a blocking error (the room can't be drawn), so the game falls back");
  p = bad((D) => { D.items.find((i) => i.id === "desk").price = 10; });
  ok(p.errors.some((e) => /starter lab has no bench/.test(e)), "no free bench: a blocking error");
  p = bad((D) => { D.items.find((i) => i.id === "pressure-gauge").unlocks = ""; });
  ok(p.warnings.some((w) => /pressure-gauge: BOUNCE-LAB requires this item, but its Unlocks cell is blank/.test(w)) && p.errors.length === 0, "equipment a job requires should say what it unlocks");
  p = bad((D) => { D.items.find((i) => i.id === "pet-bunny").rank = "Wizard"; });
  ok(p.warnings.some((w) => /pet-bunny: rank 'Wizard'/.test(w)), "a rank that isn't a rank name is flagged"); }
{ const M = L.load(C);
  const P = Object.assign(fresh(), { activeJob: { caseId: "REMOVED-CASE" } });
  P.lab.owned.push("pet-gone", "pet-cat"); P.lab.rooms.main.placed.pet = "pet-gone"; P.lab.rooms.main.placed["bench-3"] = "pet-cat";
  L.sanitizeProgress(P, C, ART);
  ok(!P.lab.rooms.main.placed.pet && !P.lab.rooms.main.placed["bench-3"] && !P.lab.owned.includes("pet-gone") && L.owns(P, "pet-cat") && !P.activeJob, "sanitizeProgress drops what no longer exists (missing item, wrong spot, removed case's saved job) and keeps what does");
  const P2 = L.freshProgress(); L.sanitizeProgress(P2, C, ART); ok(P2.lab.rooms.main.paint.wall === "wall-white" && P2.lab.rooms.main.placed.bench === "desk", "...and a brand-new student gets the starter lab");
  const BQ = M.main["BOUNCE-LAB"][0].id;
  const snap = { caseId: "BOUNCE-LAB", qi: 99, order: { [BQ]: ["Z", "Y"] }, rec: { [BQ]: { tries: 1 }, "OLD-Q": { tries: 3 } }, visited: ["CAL-SCALE", "TAG-GONE"], screen: "question", certified: true };
  const r = L.reconcileJob(M, snap), qs = M.main["BOUNCE-LAB"];
  ok(r && r.qi === qs.length - 1 && r.rec[BQ] && !r.rec["OLD-Q"] && r.visited.join() === "CAL-SCALE", "reconcileJob clamps the position, drops stale records, and drops unknown tags");
  ok(qs.every((q) => r.order[q.id].slice().sort().join() === M.options[q.id].map((o) => o.letter).sort().join()), "reconcileJob re-shuffles any answer order that no longer matches the question's options");
  { const inst = L.instance("COLD-PACK", { n: 2, variant: "hot", seed: 7 }), M2 = L.load(C); inst.qs.forEach((q) => (M2.options[q.id] = q.options));   // a generated job has no Sheet questions
    const rt = L.reconcileJob(M2, { caseId: "COLD-PACK", qi: 2, order: {}, rec: { "CPT-1": { tries: 1 } }, visited: ["PLAN-CONTROL"], screen: "run" }, inst.qs);
    ok(rt && rt.qi === 2 && rt.screen === "run" && rt.rec["CPT-1"] && inst.qs.every((q) => rt.order[q.id].length === q.options.length), "reconcileJob resumes a template job from its generated questions");
    ok(L.reconcileJob(M2, { caseId: "COLD-PACK", qi: 0 }) === null, "...and without them a template job can't resume as a Sheet case"); }
  { const D = clone(C); D.tags = D.tags.filter((t) => t.id !== "PLAN-CONTROL"); const q = L.quarantine(D);
    ok(q.held["COLD-PACK"] && /PLAN-CONTROL/.test(q.held["COLD-PACK"].join(" ")) && q.C.cases.some((c) => c.id === "MOVIN-MOLECULES") && q.errors.length === 0, "a template whose tag is missing from the Sheet is held back; the rest play"); }
  ok(L.reconcileJob(M, { caseId: "GONE", qi: 0 }) === null && L.reconcileJob(M, null) === null, "a saved job for a case that no longer exists can't resume"); }

const fakeStore = (init) => { const st = { v: init || null, puts: [] }; st.cacheGet = () => st.v; st.cachePut = (v) => { st.v = v; st.puts.push(v); }; return st; };
const feed = (mut) => { const f = clone(C); f.generated = "2026-10-20T12:00:00Z"; f.cases[0].title = "Live Title"; return mut ? mut(f) || f : f; };
const BASE = Object.assign(clone(C), { generated: "2026-01-01T00:00:00Z" });   // pinned, so these tests never depend on when the embedded snapshot was last refreshed
const run = async (o) => { const calls = []; const d = Object.assign({ snapshot: BASE, art: ART, feedUrl: "https://example.test/exec", preview: false, store: fakeStore(), now: 5_000_000, fetchJson: async (u) => { calls.push(u); return feed(); } }, o); const out = await L.content.choose(d); return Object.assign(out, { calls, store: d.store }); };
(async () => {
  let r = await run({ feedUrl: "" });                       ok(r.source === "snapshot" && r.calls.length === 0 && r.C.cases[0].title !== "Live Title", "chooser: no feed configured -> the built-in snapshot, no network");
  r = await run();                                          ok(r.source === "live" && r.C.cases.find((c) => c.id === "MOVIN-MOLECULES").title === "Live Title", "chooser: a good feed is used");
  ok(/\?v=0\.5$/.test(r.calls[0]) && !/draft/.test(r.calls[0]) && r.store.puts.length === 1 && r.store.puts[0].savedAt === 5_000_000, "...fetched without drafts, and cached with a timestamp");
  r = await run({ preview: true });                         ok(/include=draft&fresh=1/.test(r.calls[0]) && r.store.puts.length === 0, "chooser: preview asks for drafts, bypasses the server cache, and never caches them");
  r = await run({ fetchJson: async () => { throw new Error("timed out"); } });  ok(r.source === "snapshot" && /couldn't reach/.test(r.note), "chooser: network failure -> snapshot, with a note");
  const cached = { savedAt: 1, content: feed() };
  r = await run({ store: fakeStore(cached), fetchJson: async () => { throw new Error("offline"); } });  ok(r.source === "cache" && r.C.cases[0].title === "Live Title", "chooser: network failure -> the last good copy");
  r = await run({ store: fakeStore(cached), snapshot: Object.assign(clone(C), { generated: "2026-12-01T00:00:00Z" }), fetchJson: async () => { throw new Error("offline"); } });  ok(r.source === "snapshot", "chooser: a cached copy OLDER than a newer snapshot is ignored");
  r = await run({ store: fakeStore({ savedAt: 4_950_000, content: feed() }) });  ok(r.source === "cache" && r.calls.length === 0, "chooser: a copy under two minutes old is used without asking the Sheet again");
  r = await run({ store: fakeStore({ savedAt: 4_950_000, content: feed() }), preview: true });  ok(r.calls.length === 1, "chooser: ...but preview always asks, so teachers see edits at once");
  r = await run({ fetchJson: async () => feed((f) => { f.schema = "1.0.0"; }) });  ok(r.source === "snapshot" && /schema 1\.0\.0/.test(r.note), "chooser: a feed from a different schema is refused");
  r = await run({ fetchJson: async () => feed((f) => { f.sheetSchema = "0.2.1"; }) });  ok(r.source === "snapshot" && /needs upgrading/.test(r.note), "chooser: a Sheet on an older schema is refused (jobs would pay $0)");
  r = await run({ fetchJson: async () => feed((f) => { f.errors = ["The 'Options' tab is missing."]; }) });  ok(r.source === "snapshot" && /Options/.test(r.note), "chooser: a feed that reports blocking errors is refused");
  r = await run({ fetchJson: async () => ({}) });           ok(r.source === "snapshot" && /isn't a content feed/.test(r.note), "chooser: garbage is refused");
  r = await run({ fetchJson: async () => feed((f) => { f.options.filter((o) => o.qid === f.questions.find((q) => q.caseId === "BOUNCE-LAB").id).forEach((o) => (o.correct = false)); }) });
  ok(r.source === "live" && r.held["BOUNCE-LAB"] && r.C.cases.some((c) => c.id === "MOVIN-MOLECULES") && !r.C.cases.some((c) => c.id === "BOUNCE-LAB"), "chooser: a feed with one broken case is USED, minus that case");
  r = await run({ preview: true, fetchJson: async () => feed((f) => { f.sheetSchema = "0.2.1"; }) });  ok(r.source === "snapshot" && r.feed && r.feed.errors !== undefined, "chooser: in preview a refused feed still reports what was wrong");
  console.log(fails ? `${fails} FAILURES` : "ALL TESTS PASSED"); process.exit(fails ? 1 : 0);
})();
