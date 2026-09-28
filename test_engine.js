// Headless tests. Usage: node test_engine.js <engine-source.js or index.html> <content.json>
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
const g3 = L.grade(O["CP-04"], ["A", "C"], T); ok(!g3.correct && g3.tags[0].startsWith("CAL"), "SATA miss+wrong -> Calibration first");
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
console.log(fails ? `${fails} FAILURES` : "ALL TESTS PASSED");
process.exit(fails ? 1 : 0);
