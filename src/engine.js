/* Lab for Hire engine v0.6.0: pure logic, no DOM. Tested headlessly in Node. */
(function (root) {
  const LFH = {};
  LFH.version = "0.6.0";
  LFH.rng = Math.random;
  const R = () => LFH.rng();
  const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(R() * arr.length)];
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const round = (v, d = 6) => Math.round(v * 10 ** d) / 10 ** d;
  const fmt = (v) => { if (v === null || v === undefined || v === "") return ""; const r = round(v, 4); return (Math.abs(r) >= 1000 ? r.toLocaleString("en-US") : String(r)).replace("-", "−"); };
  const withUnit = (v, u) => (u ? (u.startsWith("°") ? `${fmt(v)}${u}` : `${fmt(v)} ${u}`) : fmt(v));
  const UNIT_WORD = { "°C": "degree", min: "minute", s: "second", days: "day", hours: "hour", m: "meter" };
  LFH.util = { ri, pick, shuffle, fmt, withUnit, round };

  /* ---------------- Content model ---------------- */
  LFH.load = function (C) {
    const M = { raw: C, cases: [], visuals: {}, visualsByCase: {}, main: {}, checks: {}, options: {}, tags: {}, questions: {} };
    C.tags.forEach((t) => (M.tags[t.id] = t));
    C.options.forEach((o) => (M.options[o.qid] = M.options[o.qid] || []).push(o));
    C.questions.forEach((q) => {
      M.questions[q.id] = q;
      if (q.role === "Check") (M.checks[q.forTag] = M.checks[q.forTag] || []).push(q);
      else (M.main[q.caseId] = M.main[q.caseId] || []).push(q);
    });
    Object.values(M.main).forEach((list) => list.sort((a, b) => a.order - b.order));
    C.visuals.forEach((v) => {
      M.visuals[v.id] = LFH.spec(C, v);
      (M.visualsByCase[v.caseId] = M.visualsByCase[v.caseId] || []).push(v.id);
    });
    M.cases = C.cases.slice().sort((a, b) => a.order - b.order);
    return M;
  };

  LFH.spec = function (C, v) {
    const s = { id: v.id, label: v.label, type: v.type, title: v.title, build: v.build, x: v.x, y: v.y, series: [], table: null };
    const byName = {};
    C.data.filter((d) => d.visualId === v.id).forEach((d) => {
      if (!byName[d.series]) { byName[d.series] = { name: d.series, points: [] }; s.series.push(byName[d.series]); }
      byName[d.series].points.push({ x: d.x, y: d.y, label: d.label });
    });
    const rows = C.tables.filter((t) => t.visualId === v.id).sort((a, b) => a.row - b.row);
    if (rows.length) {
      const width = Math.max(...rows.map((r) => { let n = r.cells.length; while (n && !r.cells[n - 1]) n--; return n; }));
      s.table = { headers: rows[0].cells.slice(0, width), rows: rows.slice(1).map((r) => r.cells.slice(0, width)) };
    }
    return s;
  };

  /* ---------------- Axes ---------------- */
  LFH.isLog = (ax) => (ax.scale || "").toLowerCase() === "log";
  LFH.toUnit = function (ax, v) {
    if (LFH.isLog(ax)) return (Math.log10(v) - Math.log10(ax.min)) / (Math.log10(ax.max) - Math.log10(ax.min));
    return (v - ax.min) / (ax.max - ax.min);
  };
  LFH.fromUnit = function (ax, u) {
    if (LFH.isLog(ax)) return 10 ** (Math.log10(ax.min) + u * (Math.log10(ax.max) - Math.log10(ax.min)));
    return ax.min + u * (ax.max - ax.min);
  };
  LFH.ticks = function (ax) {
    const major = [], minor = [];
    if (LFH.isLog(ax)) {
      const k0 = Math.ceil(Math.log10(ax.min) - 1e-9), k1 = Math.floor(Math.log10(ax.max) + 1e-9);
      for (let k = k0; k <= k1; k++) major.push(round(10 ** k));
      for (let k = k0 - 1; k <= k1; k++) for (let m = 2; m <= 9; m++) { const v = round(m * 10 ** k); if (v > ax.min && v < ax.max) minor.push(v); }
    } else {
      const n = Math.round((ax.max - ax.min) / ax.step);
      for (let i = 0; i <= n; i++) major.push(round(ax.min + i * ax.step));
    }
    return { major, minor };
  };

  /* ---------------- Phase model ----------------
     The SAME function draws the regions and checks answer keys. */
  LFH.phaseModel = function (spec) {
    const get = (name) => (spec.series.find((s) => s.name === name) || { points: [] }).points.map((p) => ({ x: p.x, y: p.y }));
    const log = LFH.isLog(spec.y);
    const tp = (v) => (log ? Math.log10(Math.max(v, 1e-12)) : v);
    const prep = (pts) => pts.map((p) => ({ T: p.x, u: tp(p.y) })).sort((a, b) => a.u - b.u);
    const melt = prep(get("Melting line")), boil = prep(get("Boiling line")), sub = prep(get("Sublimation line"));
    const interpT = (pts, u) => {
      if (!pts.length) return null;
      if (pts.length === 1) return pts[0].T;
      let a = pts[0], b = pts[1];
      if (u >= pts[pts.length - 1].u) { a = pts[pts.length - 2]; b = pts[pts.length - 1]; }
      else for (let i = 0; i < pts.length - 1; i++) if (u >= pts[i].u && u <= pts[i + 1].u) { a = pts[i]; b = pts[i + 1]; break; }
      if (b.u === a.u) return a.T;
      return a.T + ((u - a.u) / (b.u - a.u)) * (b.T - a.T);
    };
    const tripleU = boil.length ? boil[0].u : melt.length ? melt[0].u : -Infinity;
    const boilTop = boil.length ? boil[boil.length - 1].u : Infinity;
    function state(T, P) {
      const u = tp(P);
      if (u >= tripleU) {
        const mT = interpT(melt, u);
        if (mT !== null && T < mT) return "solid";
        if (u > boilTop) return "liquid";
        const bT = interpT(boil, u);
        return T < bT ? "liquid" : "gas";
      }
      const sT = interpT(sub, u);
      return sT !== null && T < sT ? "solid" : "gas";
    }
    return { state };
  };

  /* ---------------- Grading ---------------- */
  LFH.required = function (type) {
    if (type === "Pick two") return { exact: 2 };
    if (type === "Pick three") return { exact: 3 };
    if (type === "Select all that apply") return { min: 1 };
    return { exact: 1 };
  };
  LFH.grade = function (opts, selected, tags) {
    const sel = new Set(selected);
    const correct = opts.every((o) => o.correct === sel.has(o.letter));
    const hit = [];
    opts.forEach((o) => {
      if (!o.correct && sel.has(o.letter) && o.tag) hit.push(o.tag);
      if (o.correct && !sel.has(o.letter) && o.tag) hit.push(o.tag);
    });
    const uniq = [...new Set(hit)].filter((t) => tags[t]);
    uniq.sort((a, b) => (tags[a].kind === "Calibration" ? 0 : 1) - (tags[b].kind === "Calibration" ? 0 : 1));
    return { correct, tags: correct ? [] : uniq };
  };

  /* ---------------- Validation (mirrors the Sheet's rules) ---------------- */
  /* Every problem is tagged with the case it belongs to (caseId), so one bad case can be held back
     without freezing the rest of the game. level: "error" holds the case; "warning" is informational,
     and may carry a drop* field naming a row that is skipped (a bad item, tag, or check question). */
  LFH.validateDetailed = function (C) {
    const out = [];
    const add = (msg, caseId) => out.push({ msg, caseId: caseId || null, level: "error" });
    const warn = (msg, extra) => out.push(Object.assign({ msg, caseId: null, level: "warning" }, extra || {}));
    const V = LFH.vocab();
    const caseIds = new Set(C.cases.map((c) => c.id));
    const vis = {}; C.visuals.forEach((v) => (vis[v.id] = v));
    const tags = {}; C.tags.forEach((t) => (tags[t.id] = t));
    const items = {}; (C.items || []).forEach((it) => (items[it.id] = it));
    const qIds = new Set(C.questions.map((q) => q.id));
    const count = (arr) => arr.reduce((m, x) => ((m[x] = (m[x] || 0) + 1), m), {});
    // duplicates: copy-pasted rows are the classic spreadsheet mistake
    const dupCase = count(C.cases.map((c) => c.id)), dupVis = count(C.visuals.map((v) => v.id)), dupQ = count(C.questions.map((q) => q.id));
    Object.keys(dupCase).filter((k) => dupCase[k] > 1).forEach((k) => add(`${k}: the CaseID appears ${dupCase[k]} times (each case needs its own ID)`, k));
    // visuals
    C.visuals.forEach((v) => {
      if (!caseIds.has(v.caseId)) return warn(`${v.id}: its CaseID '${v.caseId}' isn't a case, so this visual is ignored`);
      const e = (m) => add(m, v.caseId);
      if (dupVis[v.id] > 1) e(`${v.id}: the VisualID appears ${dupVis[v.id]} times`);
      if (!V.VisualType.includes(v.type)) e(`${v.id}: unknown visual type '${v.type}'`);
      if (v.build && v.type !== "Line graph") e(`${v.id}: only line graphs can be student-built`);
      if (v.type !== "Data table") {
        ["x", "y"].forEach((k) => {
          const ax = v[k];
          if (v.type === "Bar graph" && k === "x") return;
          if (ax.min === null || ax.max === null) e(`${v.id}: ${k} min/max missing`);
          if (LFH.isLog(ax) && !(ax.min > 0)) e(`${v.id}: log ${k} axis needs min above 0`);
          if (!LFH.isLog(ax) && !(ax.step > 0)) e(`${v.id}: ${k} step missing`);
        });
      }
      const d = C.data.filter((x) => x.visualId === v.id);
      if (v.type === "Data table" && !C.tables.some((t) => t.visualId === v.id)) e(`${v.id}: table has no Tables rows`);
      if (v.type !== "Data table" && !d.length) e(`${v.id}: no Data rows`);
      if (v.type === "Phase diagram") {
        d.forEach((x) => { if (!V.PhaseSeries.includes(x.series)) e(`${v.id}: bad phase series '${x.series}'`); });
        if (!d.some((x) => x.series === "Boiling line")) e(`${v.id}: phase diagram needs a Boiling line`);
      }
      d.forEach((x) => { if (v.type !== "Bar graph" && x.x === null) e(`${v.id}: a Data row has no X value`); if (x.y === null) e(`${v.id}: a Data row has no Y value`); });
    });
    C.data.forEach((d) => { if (!vis[d.visualId]) warn(`Data: a row names VisualID '${d.visualId}', which isn't a visual, so it's ignored`); });
    C.tables.forEach((t) => { if (!vis[t.visualId]) warn(`Tables: a row names VisualID '${t.visualId}', which isn't a visual, so it's ignored`); });
    // tags: a bad tag is skipped; anything that used it then reports "unknown tag" and its case is held
    const drills = new Set(V.Drill);
    C.tags.forEach((t) => {
      if (!V.Kind.includes(t.kind)) warn(`${t.id}: tag kind '${t.kind}' should be Calibration or Archive, so the tag is skipped`, { dropTag: t.id });
      else if (t.kind === "Calibration" && !drills.has(t.drill)) warn(`${t.id}: a Calibration tag needs a Drill the game knows (got '${t.drill}'), so the tag is skipped`, { dropTag: t.id });
    });
    // questions
    const tagCases = {};   // tag -> cases whose questions use it
    C.questions.forEach((q) => {
      const main = q.role === "Main";
      if (q.role !== "Main" && q.role !== "Check") return warn(`${q.id}: Role should be Main or Check (got '${q.role}'), so the question is skipped`, { dropQuestion: q.id });
      if (main && !caseIds.has(q.caseId)) return warn(`${q.id}: its CaseID '${q.caseId}' isn't a case, so this question is ignored`);
      // Main questions hold their case back; Check questions are shared, so a bad one is skipped instead
      const bad = main ? (m) => add(m, q.caseId) : (m) => warn(m + ", so this check question is skipped", { dropQuestion: q.id });
      if (dupQ[q.id] > 1) bad(`${q.id}: the QID appears ${dupQ[q.id]} times`);
      if (!main && !tags[q.forTag]) bad(`${q.id}: a check question needs a valid 'Check for tag'`);
      (q.visuals || []).forEach((vid) => { if (!vis[vid] || vis[vid].caseId !== q.caseId) bad(`${q.id}: visual ${vid} isn't in its case`); });
      const opts = C.options.filter((o) => o.qid === q.id);
      const nc = opts.filter((o) => o.correct).length;
      const r = LFH.required(q.type);
      if (!V.QuestionType.includes(q.type)) bad(`${q.id}: unknown type '${q.type}'`);
      else if ((r.exact && nc !== r.exact) || (r.min && nc < r.min)) bad(`${q.id}: ${q.type} has ${nc} correct answer${nc === 1 ? "" : "s"}`);
      if (opts.length < 2) bad(`${q.id}: needs at least 2 options`);
      if (q.skill && !V.Skill.includes(q.skill)) warn(`${q.id}: skill '${q.skill}' isn't on the Skill list`);
      opts.forEach((o) => {
        if (!o.correct && !o.tag) bad(`${q.id}${o.letter}: a wrong option has no error tag`);
        if (o.tag && !tags[o.tag]) bad(`${q.id}${o.letter}: unknown tag '${o.tag}'`);
        if (o.tag && tags[o.tag] && main) (tagCases[o.tag] = tagCases[o.tag] || new Set()).add(q.caseId);
      });
    });
    C.options.forEach((o) => { if (!qIds.has(o.qid)) warn(`Options: a row names QID '${o.qid}', which isn't a question, so it's ignored`); });
    // Archive tags need a check question (only matters where the tag is actually used)
    C.tags.forEach((t) => {
      if (t.kind !== "Archive" || C.questions.some((q) => q.role === "Check" && q.forTag === t.id)) return;
      (tagCases[t.id] ? [...tagCases[t.id]] : []).forEach((cid) => add(`${t.id}: the Archive tag has no Check question to practice with`, cid));
    });
    // cases
    C.cases.forEach((c) => {
      const e = (m) => add(m, c.id);
      if (!V.Status.includes(c.status)) e(`${c.id}: Status should be Draft, Live, or Teaser (got '${c.status}')`);
      if (c.status !== "Teaser" && !(LFH.TEMPLATES && LFH.TEMPLATES[c.id]) && !C.questions.some((q) => q.caseId === c.id && q.role === "Main")) e(`${c.id}: has no questions (mark it Teaser if it isn't built yet)`);
      if (c.requires && !items[c.requires]) e(`${c.id}: requires '${c.requires}', which isn't in the Items tab`);
      if (c.status === "Teaser" && !c.requires) e(`${c.id}: a Teaser needs a Requires item (that's what it advertises)`);
      if (typeof c.pay !== "number" || !(c.pay >= 0)) e(`${c.id}: Pay should be a number`);
      if (LFH.TEMPLATES && LFH.TEMPLATES[c.id] && c.status !== "Teaser") LFH.templateErrors(C, c.id).forEach(e);
    });
    // items: a bad item is skipped with a warning; cases that need it are held (see above)
    const seenItem = new Set();
    (C.items || []).forEach((it) => {
      const skip = (m) => warn(`${it.id}: ${m}, so the item is skipped`, { dropItem: it.id });
      const paint = LFH.lab.paintKey(it);
      if (seenItem.has(it.id)) return skip("this ItemID is used twice");
      seenItem.add(it.id);
      if (typeof it.price !== "number" || !(it.price >= 0)) skip("Price should be a number");
      else if (!V.ItemKind.includes(it.kind)) skip(`Kind '${it.kind}' isn't one of ${V.ItemKind.join(", ")}`);
      else if (!V.Slot.includes(it.slot)) skip(`Slot '${it.slot}' isn't a spot in the lab`);
      else if (it.kind === "Award" && it.price !== 0) skip("an Award is earned, never sold, so its Price must be 0");
      else if (paint === "tiles" && !LFH.lab.PATTERNS.includes(it.sprite)) skip(`a floor pattern's Sprite must be one of ${LFH.lab.PATTERNS.join(", ")}`);
      else if (paint && paint !== "tiles" && it.sprite !== "any" && !/^#[0-9a-fA-F]{6}$/.test(it.sprite)) skip("a paint's Sprite must be a color like #F5F0E6, or the word any");
      else {
        if (it.unlocks && it.kind !== "Equipment") warn(`${it.id}: only Equipment unlocks cases, so its Unlocks note is ignored`);
        if (it.rank && LFH.rankIndex(it.rank) < 0) warn(`${it.id}: rank '${it.rank}' isn't a rank name, so anyone can buy it`);
      }
    });
    C.cases.forEach((c) => { const it = items[c.requires]; if (it && !it.unlocks) warn(`${it.id}: ${c.id} requires this item, but its Unlocks cell is blank, so the store can't tell students what it's for`); });
    // the starter lab: every kind of paint needs one free color to start from (the room can't be drawn without it)
    if ((C.items || []).length) Object.keys(LFH.lab.PAINT_KEYS).forEach((slot) => {
      if (!C.items.some((it) => it.slot === slot && it.price === 0 && it.kind !== "Award" && it.sprite !== "any")) add(`Items: there is no free starter row for ${slot} (one row with Price 0)`);
    });
    return out;
  };
  LFH.validate = (C) => LFH.validateDetailed(C).filter((e) => e.level === "error").map((e) => e.msg);

  /* ---------------- Build mode ---------------- */
  LFH.buildAxisOptions = (spec) => [
    { text: `${spec.x.label} (${spec.x.unit})`, correct: true },
    { text: `${spec.y.label} (${spec.y.unit})`, correct: false, tag: "CAL-AXIS-CHOICE" },
  ];
  /* What a student sees if they miss a build step twice: the answer, stated plainly, with the reason. */
  LFH.buildReveal = function (spec, step) {
    if (step === "axis") return `The answer is ${spec.x.label} (${spec.x.unit}). The scientists chose the ${spec.x.label.toLowerCase()} values on purpose, so ${spec.x.label.toLowerCase()} goes on the x-axis. ${spec.y.label} is what they measured, so it goes on the y-axis.`;
    const vals = spec.series.flatMap((s) => s.points.map((p) => p.y));
    return `The answer is: start at ${fmt(spec.y.min)} and count by ${fmt(spec.y.step)}s up to ${fmt(spec.y.max)} ${spec.y.unit}. The data run from ${fmt(Math.min(...vals))} to ${fmt(Math.max(...vals))}, so this scale fits every value, counts by the same amount each time, and fills the graph.`;
  };
  LFH.buildScaleOptions = function (spec) {
    const y = spec.y, u = y.unit;
    const vals = spec.series.flatMap((s) => s.points.map((p) => p.y)).sort((a, b) => a - b);
    const dataMax = vals[vals.length - 1];
    let smallMax = y.min + y.step * 2; while (smallMax >= dataMax) smallMax -= y.step;
    const bigStep = 10 ** Math.ceil(Math.log10(y.max));
    return [
      { text: `Start at ${fmt(y.min)} and count by ${fmt(y.step)}s up to ${fmt(y.max)} ${u}`, correct: true },
      { text: `Start at ${fmt(y.min)} and count by ${fmt(y.step)}s up to ${fmt(smallMax)} ${u}`, correct: false, tag: "CAL-SCALE-CHOICE", why: "That scale stops before the biggest values, so some points won't fit." },
      { text: `Use the data values as the gridlines: ${vals.map(fmt).join(", ")}`, correct: false, tag: "CAL-SCALE-CHOICE", why: "Those gridlines aren't equal intervals, so distances on the graph would lie." },
      { text: `Start at 0 and count by ${fmt(bigStep)}s up to ${fmt(bigStep * 10)} ${u}`, correct: false, tag: "CAL-SCALE-CHOICE", why: "Everything would be squashed into a thin sliver at the bottom. Too hard to read." },
    ];
  };
  LFH.snapUnits = (spec) => ({ sx: spec.x.step / 4, sy: spec.y.step / 5 });
  LFH.checkPlot = function (spec, i, x, y) {
    const pts = spec.series[0].points, t = pts[i];
    const { sx, sy } = LFH.snapUnits(spec);
    const xOk = Math.abs(x - t.x) < sx / 2, yOk = Math.abs(y - t.y) < sy / 2;
    if (xOk && yOk) return { ok: true };
    const xs = pts.map((p) => p.x);
    const gaps = xs.slice(1).map((v, k) => round(v - xs[k]));
    const uneven = new Set(gaps).size > 1;
    if (!xOk && yOk) {
      const prev = i > 0 ? pts[i - 1].x : null;
      if (uneven && prev !== null && Math.abs(x - (prev + spec.x.step)) < sx / 2) return { ok: false, tag: "CAL-SPACING" };
      return { ok: false, tag: uneven ? "CAL-SPACING" : "CAL-SCALE" };
    }
    if (xOk && !yOk) return { ok: false, tag: "CAL-SCALE" };
    return { ok: false, tag: "CAL-POINT" };
  };

  /* ---------------- Drills: fresh data every time ---------------- */
  /* Each context lists only the trends that are physically honest for it.
     (A drill must never show particle speed falling as temperature rises.) */
  const ALL = ["up", "down", "flat", "peak"];
  const CONTEXTS = [
    { x: ["Time", "min"], y: ["Temperature", "°C"], dirs: ALL, ys: [2, 5, 10], max: 120 },
    { x: ["Time", "hours"], y: ["Air temperature", "°C"], dirs: ALL, ys: [1, 2, 5], max: 45 },
    { x: ["Time", "days"], y: ["Plant height", "cm"], dirs: ["up", "flat"], ys: [1, 2, 5] },
    { x: ["Temperature", "°C"], y: ["Particle speed", "m/s"], dirs: ["up"], ys: [10, 20, 25, 50] },
    { x: ["Depth", "m"], y: ["Water pressure", "atm"], dirs: ["up"], ys: [1, 2] },
    { x: ["Time", "s"], y: ["Distance", "m"], dirs: ["up", "flat"], ys: [2, 5, 10, 20, 25] },
    { x: ["Temperature", "°C"], y: ["Gas volume", "mL"], dirs: ["up"], ys: [5, 10, 20, 25, 50] },
    { x: ["Time", "min"], y: ["Ice remaining", "g"], dirs: ["down", "flat"], ys: [5, 10, 20, 25] },
  ];
  const ctxFor = (dir) => pick(CONTEXTS.filter((c) => c.dirs.includes(dir)));
  const ax = (label, unit, min, max, step, scale = "Linear") => ({ label, unit, min, max, step, scale });
  const line = (ctx, xs, ys, yAx, name = "Data") => ({
    type: "Line graph", title: `${ctx.y[0]} vs. ${ctx.x[0]}`,
    x: ax(ctx.x[0], ctx.x[1], xs.min, xs.max, xs.step), y: yAx,
    series: [{ name, points: ys.map((p) => ({ x: p[0], y: p[1], label: "" })) }],
  });
  function mcOptions(correctText, wrongTexts) {
    const seen = new Set([correctText]); const opts = [{ text: correctText, correct: true }];
    wrongTexts.forEach((w) => { if (!seen.has(w)) { seen.add(w); opts.push({ text: w, correct: false }); } });
    return shuffle(opts);
  }
  const STEPS = [2, 5, 10, 20, 25, 50];
  const offsetsFor = (step) => { const o = [0.2, 0.4, 0.5, 0.6, 0.8].map((f) => f * step).filter((v) => Number.isInteger(v) && v > 0); return o.length ? o : [1]; };

  LFH.drills = {
    "scale-read"() {
      const ctx = pick(CONTEXTS), step = pick(ctx.ys), n = ri(5, 6);
      const k = ri(1, n - 2), off = pick(offsetsFor(step)), v = step * k + off;
      const labels = ["A", "B", "C", "D"], target = ri(0, 3);
      const bars = labels.map((l, i) => ({ x: null, y: i === target ? v : step * ri(1, n - 1), label: "" }));
      const alt = step % 2 === 0 ? step / 2 : step * 2;
      const u = ctx.y[1];
      return {
        visual: { type: "Bar graph", title: `${ctx.y[0]} of four samples`, x: ax("Sample", ""), y: ax(ctx.y[0], u, 0, step * n, step),
          series: labels.map((l, i) => ({ name: `Sample ${l}`, points: [bars[i]] })) },
        prompt: `What is the ${ctx.y[0].toLowerCase()} of Sample ${labels[target]}?`,
        options: mcOptions(withUnit(v, u), [withUnit(step * k, u), withUnit(step * (k + 1), u), withUnit(round((k + off / step) * alt), u)]),
        why: `Each gridline is worth ${fmt(step)} ${u}. Sample ${labels[target]}'s bar ends between ${fmt(step * k)} and ${fmt(step * (k + 1))}, at ${withUnit(v, u)}.`,
      };
    },
    "axis-read"() {
      const ctx = pick(CONTEXTS), xstep = pick([1, 2, 5, 10]), ystep = pick(ctx.ys);
      const xs = [1, 2, 3, 4, 5].map((i) => i * xstep);
      let acc = 0; const ys = ctx.dirs.length === 4 ? xs.map(() => ystep * ri(1, 8)) : ctx.dirs[0] === "down" ? xs.map((_, i) => ystep * (8 - i - ri(0, 1))) : xs.map(() => (acc += ystep * ri(1, 2)));
      const i = ri(1, 3), askY = R() < 0.6;
      const spec = line(ctx, { min: 0, max: xstep * 6, step: xstep }, xs.map((x, k) => [x, ys[k]]), ax(ctx.y[0], ctx.y[1], 0, ystep * 9, ystep));
      spec.series[0].points[i].label = "★";
      spec.highlight = [{ x: xs[i], y: ys[i], label: "★" }];
      const ans = askY ? withUnit(ys[i], ctx.y[1]) : withUnit(xs[i], ctx.x[1]);
      const swapped = askY ? withUnit(xs[i], ctx.y[1]) : withUnit(ys[i], ctx.x[1]);
      const other = askY ? withUnit(ys[i + 1], ctx.y[1]) : withUnit(xs[i + 1], ctx.x[1]);
      const other2 = askY ? withUnit(ys[i - 1], ctx.y[1]) : withUnit(xs[i - 1], ctx.x[1]);
      return {
        visual: spec,
        prompt: `Look at the starred point. What is its ${(askY ? ctx.y[0] : ctx.x[0]).toLowerCase()}?`,
        options: mcOptions(ans, [swapped, other, other2]),
        why: `${askY ? ctx.y[0] : ctx.x[0]} is on the ${askY ? "y-axis (up the side)" : "x-axis (along the bottom)"}. From the star, go straight ${askY ? "left" : "down"} to read ${ans}.`,
      };
    },
    "point-find"() {
      const ctx = ctxFor("up"), xstep = pick([2, 5, 10, 20]), ystep = pick(ctx.ys);
      const xs = [1, 2, 3, 4, 5, 6].map((i) => i * xstep);
      let y = ystep * ri(1, 3); const ys = xs.map(() => (y += ystep * ri(1, 2) + (R() < 0.3 && ystep % 5 === 0 ? ystep / 5 * ri(1, 4) : 0), round(y)));
      const top = Math.ceil((Math.max(...ys) + ystep) / ystep) * ystep;
      const i = ri(1, 4);
      const spec = line(ctx, { min: 0, max: xstep * 7, step: xstep }, xs.map((x, k) => [x, ys[k]]), ax(ctx.y[0], ctx.y[1], 0, top, ystep));
      const u = ctx.y[1];
      return {
        visual: spec,
        prompt: `What is the ${ctx.y[0].toLowerCase()} when the ${ctx.x[0].toLowerCase()} is ${withUnit(xs[i], ctx.x[1])}?`,
        options: mcOptions(withUnit(ys[i], u), [withUnit(ys[i - 1], u), withUnit(ys[i + 1], u), withUnit(ys[i + 2] ?? ys[0], u)]),
        why: `Find ${withUnit(xs[i], ctx.x[1])} on the x-axis first, go straight up to the line, then across: ${withUnit(ys[i], u)}.`,
      };
    },
    "uneven-spacing"() {
      for (let tries = 0; tries < 80; tries++) {
        const ctx = ctxFor("up"), xstep = pick([5, 10, 20]), ystep = pick(ctx.ys);
        const gaps = shuffle([1, 1, 3, 4]).map((g) => g * xstep);
        const xs = [0]; gaps.forEach((g) => xs.push(xs[xs.length - 1] + g));
        const rises = gaps.map((g) => (g === xstep ? ystep * ri(1, 3) : ystep * ri(1, 3)));
        const ys = [ystep]; rises.forEach((r) => ys.push(ys[ys.length - 1] + r));
        const rate = rises.map((r, k) => r / gaps[k]);
        const order = rate.map((r, k) => k).sort((a, b) => rate[b] - rate[a]);
        const best = order[0];
        if (rate[best] < rate[order[1]] * 1.4) continue;          // clear winner only
        const biggest = rises.indexOf(Math.max(...rises));
        if (biggest === best || rises[biggest] <= rises[best]) continue;   // the trap: biggest total rise is NOT steepest
        const top = Math.ceil((Math.max(...ys) + ystep) / ystep) * ystep;
        const spec = line(ctx, { min: 0, max: xs[4] + xstep, step: xstep }, xs.map((x, k) => [x, ys[k]]), ax(ctx.y[0], ctx.y[1], 0, top, ystep));
        const seg = (k) => `From ${withUnit(xs[k], ctx.x[1])} to ${withUnit(xs[k + 1], ctx.x[1])}`;
        const word = UNIT_WORD[ctx.x[1]] || ctx.x[1];
        const per = (k) => `${withUnit(round(rate[k], 2), ctx.y[1])} per ${word}`;
        return {
          visual: spec,
          prompt: `Which section of the line is steepest, where the ${ctx.y[0].toLowerCase()} rises the most for each ${word}?`,
          options: mcOptions(seg(best), [0, 1, 2, 3].filter((k) => k !== best).map(seg)),
          why: `${seg(best)}, it rose ${withUnit(rises[best], ctx.y[1])} in just ${withUnit(gaps[best], ctx.x[1])}. That's ${per(best)}, the steepest. The section ${seg(biggest).replace("From", "from")} rose more in total (${withUnit(rises[biggest], ctx.y[1])}), but it was spread over ${withUnit(gaps[biggest], ctx.x[1])}: only ${per(biggest)}.`,
        };
      }
    },
    "trend-read"() {
      const kind = pick(ALL), ctx = ctxFor(kind), ystep = pick(ctx.ys);
      const xs = [0, 1, 2, 3, 4, 5], base = ystep * 4;
      const ys = xs.map((i) => {
        const wig = (R() - 0.5) * ystep * 0.6;
        if (kind === "up") return round(ystep + i * ystep * 1.2 + wig);
        if (kind === "down") return round(ystep * 7 - i * ystep * 1.2 + wig);
        if (kind === "flat") return round(base + wig * 0.5);
        return round(ystep * 2 + (2.5 - Math.abs(i - 2.5)) * ystep * 1.6 + wig);
      }).map((v) => Math.max(ystep / 2, v));
      const X = ctx.x[0].toLowerCase(), Y = ctx.y[0].toLowerCase();
      const T = { up: `As ${X} increases, ${Y} increases.`, down: `As ${X} increases, ${Y} decreases.`, flat: `${ctx.y[0]} stays about the same.`, peak: `${ctx.y[0]} increases, then decreases.` };
      return {
        visual: line(ctx, { min: 0, max: 5, step: 1 }, xs.map((x, k) => [x, ys[k]]), ax(ctx.y[0], ctx.y[1], 0, ystep * 9, ystep)),
        prompt: "Which statement best describes the overall trend?",
        options: shuffle(Object.keys(T).map((k) => ({ text: T[k], correct: k === kind }))),
        why: `Compare the first point to the last and look at the overall shape, not the little wiggles: ${T[kind].charAt(0).toLowerCase() + T[kind].slice(1)}`,
      };
    },
    "extrapolate"() {
      const dir = R() < 0.7 ? "up" : "down", ctx = ctxFor(dir), xstep = pick([1, 2, 5, 10]), ystep = pick(ctx.ys);
      const s = ystep * pick([1, 2]) * (dir === "up" ? 1 : -1);
      const start = s > 0 ? ystep * ri(1, 2) : ystep * ri(11, 12);
      const xs = [0, 1, 2, 3, 4].map((i) => i * xstep), ys = xs.map((x, i) => start + s * i);
      const next = start + s * 5, u = ctx.y[1];
      if (next < 0) return null;
      const spec = line(ctx, { min: 0, max: xstep * 6, step: xstep }, xs.map((x, k) => [x, ys[k]]), ax(ctx.y[0], u, 0, ystep * 14, ystep));
      return {
        visual: spec,
        prompt: `If the pattern continues, what will the ${ctx.y[0].toLowerCase()} be at ${withUnit(xstep * 5, ctx.x[1])}?`,
        options: mcOptions(withUnit(next, u), [ys[4], next + s, ys[4] - s, next + 2 * s].filter((v) => v >= 0 && v !== next).slice(0, 3).map((v) => withUnit(v, u))),
        why: `The line changes by ${withUnit(Math.abs(s), u)} every ${withUnit(xstep, ctx.x[1])}. One more step from ${withUnit(ys[4], u)} gives ${withUnit(next, u)}.`,
      };
    },
    "phase-region"() {
      const spec = fictionalPhase();
      const m = LFH.phaseModel(spec);
      const p = pointWithMargin(spec, m);
      spec.highlight = [{ x: p.T, y: p.P, label: "Q" }];
      const st = m.state(p.T, p.P);
      return {
        visual: spec,
        prompt: `Point Q is at ${fmt(p.T)}°C and ${fmt(p.P)} atm. What state is Substance X at point Q?`,
        options: shuffle(["solid", "liquid", "gas"].map((s) => ({ text: cap(s), correct: s === st }))), minOptions: 3,
        why: `Find ${fmt(p.T)}°C along the bottom and ${fmt(p.P)} atm up the side. They meet in the ${st} region.`,
      };
    },
    "phase-trace"() {
      for (let tries = 0; tries < 200; tries++) {
        const spec = fictionalPhase();
        const m = LFH.phaseModel(spec);
        const a = pointWithMargin(spec, m);
        const horiz = R() < 0.6;
        const b = horiz ? { T: pick(gridVals(spec.x)), P: a.P } : { T: a.T, P: pick(gridVals(spec.y)) };
        if ((horiz && Math.abs(b.T - a.T) < spec.x.step * 3) || (!horiz && Math.abs(b.P - a.P) < spec.y.step * 2)) continue;
        if (!clear(spec, m, b)) continue;
        const seq = [];
        for (let i = 0; i <= 60; i++) { const s = m.state(a.T + (b.T - a.T) * i / 60, a.P + (b.P - a.P) * i / 60); if (seq[seq.length - 1] !== s) seq.push(s); }
        if (seq.length > 2) continue;
        const S = ["solid", "liquid", "gas"], s0 = seq[0], s1 = seq[seq.length - 1];
        const text = (x, y) => (x === y ? `It stays a ${x}.` : `It changes from a ${x} to a ${y}.`);
        const third = S.find((s) => s !== s0 && s !== s1);
        const wrong = [text(s1, s0), text(s0, s0), text(s0, third), text(s1, s1)];
        spec.highlight = [{ x: a.T, y: a.P, label: "Start" }, { x: b.T, y: b.P, label: "End" }];
        spec.arrow = { from: { x: a.T, y: a.P }, to: { x: b.T, y: b.P } };
        const how = horiz ? `The pressure stays at ${fmt(a.P)} atm while the temperature changes to ${fmt(b.T)}°C.` : `The temperature stays at ${fmt(a.T)}°C while the pressure changes to ${fmt(b.P)} atm.`;
        return {
          visual: spec,
          prompt: `Substance X starts at ${fmt(a.T)}°C and ${fmt(a.P)} atm. ${how} What happens?`,
          options: traceOptions(text, s0, s1, wrong),
          why: s0 === s1 ? `Follow the arrow from Start to End: it never crosses a line, so it stays a ${s0}.` : `Follow the arrow from Start to End: it starts in the ${s0} region and crosses a line into the ${s1} region.`,
        };
      }
    },
    "log-read"() {
      const decades = pick([[0.1, 100], [1, 1000]]);
      const ks = decades[0] === 0.1 ? [-1, 0, 1] : [0, 1, 2];
      const k = pick(ks), mant = pick([2, 3, 4, 5, 6, 8]);
      const v = round(mant * 10 ** k);
      const labels = ["A", "B", "C", "D"], target = ri(0, 3);
      const pts = labels.map((l, i) => ({ x: i + 1, y: i === target ? v : round(pick([1, 2, 3, 5, 7]) * 10 ** pick(ks)), label: l }));
      const evenRead = round((1 + 9 * Math.log10(mant)) * 10 ** k, 3);
      const nice = (z) => round(z, 2);
      const unit = pick(["atm", "kPa", "mL"]);
      return {
        visual: { type: "Line graph", noLine: true, title: "Measurements on a log scale", x: ax("Sample", "", 0, 5, 1), y: ax("Value", unit, decades[0], decades[1], null, "Log"),
          series: [{ name: "Samples", points: pts }], xLabels: { 1: "A", 2: "B", 3: "C", 4: "D" } },
        prompt: `This y-axis is a log scale. What is the value of point ${labels[target]}?`,
        options: mcOptions(withUnit(v, unit), [withUnit(nice(Math.round(evenRead)), unit), withUnit(round(v * 10), unit), withUnit(round(v / 10), unit)]),
        why: `Point ${labels[target]} is above the ${fmt(10 ** k)} line. Each unlabeled line above it adds another ${fmt(10 ** k)}: ${[2, 3, 4, 5, 6, 7, 8, 9].slice(0, mant - 1).map((m) => fmt(round(m * 10 ** k))).join(", ")}. It sits on the line for ${withUnit(v, unit)}.`,
      };
    },
    "table-read"() {
      const names = shuffle(["Balloon A", "Balloon B", "Balloon C", "Balloon D"]);
      const temps = [0, 20, 40, 60];
      const rows = names.map((n, i) => [n, String(temps[i]), String(round(2 + i * 0.2 + ri(0, 1) * 0.1, 1)), String(ri(96, 104))]);
      const headers = ["Balloon", "Temperature (°C)", "Volume (L)", "Pressure (kPa)"];
      const r = ri(0, 3), c = ri(1, 3), r2 = (r + ri(1, 3)) % 4;
      const unitOf = (ci) => ["", "°C", "L", "kPa"][ci];
      const val = (ri_, ci) => `${rows[ri_][ci]} ${unitOf(ci)}`;
      const others = [1, 2, 3].filter((x) => x !== c);
      return {
        visual: { type: "Data table", title: "Balloon measurements", table: { headers, rows } },
        prompt: `What is the ${headers[c].split(" (")[0].toLowerCase()} of ${rows[r][0]}?`,
        options: mcOptions(val(r, c), [val(r, others[0]), val(r, others[1]), val(r2, c)]),
        why: `Find the ${rows[r][0]} row, then slide across to the "${headers[c]}" column: ${val(r, c)}.`,
      };
    },
    "series-read"() {
      const ystep = pick([5, 10]), names = ["Cup A", "Cup B", "Cup C"];
      const xs = [0, 2, 4, 6, 8, 10];
      const series = names.map((n, s) => ({ name: n, points: xs.map((x, i) => ({ x, y: Math.max(ystep, round(ystep * (2 + s * 2) + (s - 1) * i * ystep * 0.6 + (i % 2 ? ystep / 5 * ri(0, 2) : 0))), label: "" })) }));
      const s = ri(0, 2), i = ri(1, 4), o = [0, 1, 2].filter((z) => z !== s);
      const Y = (si, ii) => withUnit(series[si].points[ii].y, "°C");
      const top = Math.ceil((Math.max(...series.flatMap((z) => z.points.map((p) => p.y))) + ystep) / ystep) * ystep;
      const uniq = new Set([Y(s, i), Y(o[0], i), Y(o[1], i)]);
      if (uniq.size < 3) return LFH.drills["series-read"]();
      return {
        visual: { type: "Line graph", title: "Temperature of three cups", x: ax("Time", "min", 0, 10, 2), y: ax("Temperature", "°C", 0, top, ystep), series },
        prompt: `What was the temperature of ${names[s]} at ${xs[i]} minutes?`,
        options: mcOptions(Y(s, i), [Y(o[0], i), Y(o[1], i), Y(s, i + 1)]),
        why: `Use the key: ${names[s]} has the ${["circle", "square", "triangle"][s]} markers. At ${xs[i]} minutes, that line reads ${Y(s, i)}.`,
      };
    },
    "variable-placement"() {
      const E = pick(EXPERIMENTS);
      const rows = E.x.vals.map((v, k) => [String(v), String(E.y.vals[k])]);
      const flip = R() < 0.5;   // column order must not give the answer away
      const headers = flip ? [E.y.name, E.x.name] : [E.x.name, E.y.name];
      return {
        visual: { type: "Data table", title: E.title, table: { headers, rows: rows.map((r) => (flip ? [r[1], r[0]] : r)) } },
        prompt: `${E.story} When you graph this data, which variable belongs on the x-axis?`,
        options: shuffle([{ text: E.x.name, correct: true }, { text: E.y.name, correct: false }, { text: "Either one. It doesn't matter.", correct: false }]),
        minOptions: 3,
        why: `${E.who} chose the ${E.x.short} on purpose, so ${E.x.name} goes on the x-axis. ${E.y.name} is what ${E.pronoun} measured, so it goes on the y-axis.`,
      };
    },
    "scale-choose"() {
      const lo = ri(2, 4) * 10, vals = [0, 1, 2, 3, 4].map((i) => lo + i * ri(8, 16) + ri(0, 5));
      vals.sort((a, b) => a - b);
      const max = vals[4], top = Math.ceil((max + 1) / 10) * 10;
      const short = Math.floor((max - 12) / 10) * 10;
      return {
        visual: { type: "Data table", title: "Data to graph", table: { headers: ["Trial", "Height (cm)"], rows: vals.map((v, i) => [String(i + 1), String(v)]) } },
        prompt: "You're about to graph this data. Which y-axis scale is best?",
        options: mcOptions(`0 to ${top}, counting by 10s`, [`0 to ${short}, counting by 10s`, `Use the data values as gridlines: ${vals.join(", ")}`, "0 to 1,000, counting by 100s"]),
        why: `0 to ${top} by 10s fits every value (the biggest is ${max}), counts by the same amount each time, and uses most of the graph.`,
      };
    },
  };
  function traceOptions(text, s0, s1, preferred) {
    const right = text(s0, s1), S = ["solid", "liquid", "gas"];
    const all = preferred.concat(S.flatMap((a) => S.map((b) => text(a, b))));
    const wrong = [...new Set(all)].filter((t) => t !== right).slice(0, 3);
    return mcOptions(right, wrong);
  }
  function unrealistic(v) {
    if (!v || !v.y || !v.series) return false;
    const c = CONTEXTS.find((k) => k.y[0] === v.y.label && k.max);
    return !!c && v.series.some((s) => s.points.some((p) => p.y > c.max));
  }
  /* Every drill goes through here: a bad random roll is thrown away and re-rolled. */
  LFH.makeDrill = function (id) {
    for (let i = 0; i < 40; i++) {
      const d = LFH.drills[id]();
      if (!d) continue;
      const texts = d.options.map((o) => o.text);
      const bad = texts.some((t) => /NaN|undefined|Infinity/.test(t)) || /NaN|undefined/.test(d.prompt + d.why) || unrealistic(d.visual);
      if (!bad && d.options.filter((o) => o.correct).length === 1 && new Set(texts).size === texts.length && texts.length >= (d.minOptions || 4)) { d.id = id; return d; }
    }
    throw new Error("drill failed to generate: " + id);
  };
  const EXPERIMENTS = [
    { who: "Jordan", pronoun: "they", title: "Jordan's air test", story: "Jordan sets a heater to four temperatures and measures how fast the air particles move at each one.",
      x: { name: "Temperature (°C)", short: "temperatures", vals: [20, 40, 60, 80] }, y: { name: "Particle speed (m/s)", vals: [490, 505, 520, 535] } },
    { who: "Ava", pronoun: "she", title: "Ava's salt test", story: "Ava stirs 1, 2, 3, and then 4 spoons of salt into water and measures the boiling point each time.",
      x: { name: "Spoons of salt", short: "number of spoons", vals: [1, 2, 3, 4] }, y: { name: "Boiling point (°C)", vals: [100.5, 101, 101.5, 102] } },
    { who: "Leo", pronoun: "he", title: "Leo's plant test", story: "Leo places plants 10, 20, 30, and 40 cm from a lamp and measures how tall each one grows.",
      x: { name: "Distance from lamp (cm)", short: "distances", vals: [10, 20, 30, 40] }, y: { name: "Plant height (cm)", vals: [18, 15, 11, 8] } },
    { who: "Mia", pronoun: "she", title: "Mia's bounce test", story: "Mia drops a ball from four different heights and measures how high it bounces each time.",
      x: { name: "Drop height (cm)", short: "drop heights", vals: [50, 100, 150, 200] }, y: { name: "Bounce height (cm)", vals: [35, 70, 104, 139] } },
    { who: "Sam", pronoun: "he", title: "Sam's balloon test", story: "Sam warms a sealed balloon to four temperatures and measures its volume at each one.",
      x: { name: "Temperature (°C)", short: "temperatures", vals: [0, 20, 40, 60] }, y: { name: "Balloon volume (L)", vals: [2.0, 2.1, 2.3, 2.4] } },
    { who: "Priya", pronoun: "she", title: "Priya's cocoa test", story: "Priya checks the temperature of a mug of cocoa every 2 minutes as it cools.",
      x: { name: "Time (min)", short: "times to check", vals: [0, 2, 4, 6] }, y: { name: "Temperature (°C)", vals: [80, 71, 64, 58] } },
    { who: "Noah", pronoun: "he", title: "Noah's cold pack test", story: "Noah activates a cold pack and records the water temperature every minute.",
      x: { name: "Time (min)", short: "times to check", vals: [0, 1, 2, 3] }, y: { name: "Water temperature (°C)", vals: [22, 12, 7, 5] } },
    { who: "Zoe", pronoun: "she", title: "Zoe's pump test", story: "Zoe gives a ball 1, 2, 3, and then 4 pumps of air and measures the pressure inside after each round.",
      x: { name: "Number of pumps", short: "number of pumps", vals: [1, 2, 3, 4] }, y: { name: "Air pressure (psi)", vals: [2, 4, 6, 8] } },
  ];
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const gridVals = (a) => LFH.ticks(a).major.filter((v) => v > a.min && v < a.max);
  function fictionalPhase() {
    const Tt = pick([0, 20, 40]), Pt = pick([1, 2]);
    const tilt = pick([-4, 0, 6]);
    const boil = [{ x: Tt, y: Pt, label: "" }];
    const k = pick([0.0009, 0.0012, 0.0016]);
    for (let T = Tt + 20; T <= 180; T += 20) boil.push({ x: T, y: round(Pt + k * (T - Tt) ** 2, 3), label: "" });
    return {
      type: "Phase diagram", title: "Phase diagram of Substance X",
      x: ax("Temperature", "°C", -40, 160, 20), y: ax("Pressure", "atm", 0, 12, 2),
      series: [
        { name: "Sublimation line", points: [{ x: -40, y: 0.1, label: "" }, { x: round((Tt - 40) / 2), y: round(Pt / 3, 3), label: "" }, { x: Tt, y: Pt, label: "" }] },
        { name: "Melting line", points: [{ x: Tt, y: Pt, label: "" }, { x: Tt + tilt, y: 12, label: "" }] },
        { name: "Boiling line", points: boil },
      ],
    };
  }
  function clear(spec, m, p) {
    const s = m.state(p.T, p.P), dT = spec.x.step * 0.6, dP = spec.y.step * 0.5;
    return [[dT, 0], [-dT, 0], [0, dP], [0, -dP], [dT, dP], [-dT, -dP], [dT, -dP], [-dT, dP]]
      .every(([a, b]) => { const T = p.T + a, P = p.P + b; return P < spec.y.min || P > spec.y.max || T < spec.x.min || T > spec.x.max || m.state(T, P) === s; });
  }
  function pointWithMargin(spec, m) {
    const Ts = gridVals(spec.x), Ps = gridVals(spec.y).concat(gridVals(spec.y).map((v) => v + spec.y.step / 2)).filter((v) => v < spec.y.max);
    for (let i = 0; i < 400; i++) { const p = { T: pick(Ts), P: pick(Ps) }; if (clear(spec, m, p)) return p; }
    return { T: Ts[0], P: Ps[0] };
  }

  /* ---------------- The lab business: ranks, money, jobs, shop, saves ---------------- */
  LFH.RANKS = [
    { at: 0, name: "Lab Intern" }, { at: 25, name: "Lab Tech" }, { at: 60, name: "Data Analyst" },
    { at: 110, name: "Senior Scientist" }, { at: 170, name: "Lab Director" },
  ];
  LFH.rankOf = (rep) => LFH.RANKS.filter((k) => rep >= k.at).pop();
  LFH.nextRank = (rep) => LFH.RANKS.find((k) => k.at > rep);
  LFH.rankIndex = (name) => LFH.RANKS.findIndex((k) => k.name === name);

  /* ---------------- The student's lab: what they own, where it sits, paint, awards. Pure rules; src/lab.js draws it. ----------------
     Lab state: { v: 2, owned: [itemId], rooms: { main: { placed: { spotId: itemId }, paint: { wall, floor, trim, tiles }, colors: {} } }, awards: { itemId: data } }
     One of each item. An item is out in at most one room; everything owned but not out is "in storage".
     `man` is the room manifest from the art bake (ART.manifest): it lists the spots. Funds live in progress.funds, never here. */
  LFH.lab = (function () {
    const PAINT_KEYS = { "paint-wall": "wall", "paint-floor": "floor", "paint-trim": "trim", "paint-tiles": "tiles" };
    const PATTERNS = ["none", "checker", "stripes"];
    const SLOTS = ["bench", "bench-item", "chair", "shelf", "shelf-top", "plant", "machine", "table", "rug", "poster", "pet", "lantern"].concat(Object.keys(PAINT_KEYS));
    const clone = (o) => JSON.parse(JSON.stringify(o));
    const index = (items) => { const by = {}; items.forEach((it) => (by[it.id] = it)); return by; };
    const paintKey = (it) => PAINT_KEYS[it.slot] || null;
    const isAward = (it) => it.kind === "Award";
    const isStarter = (it) => it.price === 0 && !isAward(it);
    const roomOf = (man) => man.roomId || "main";
    const slotsOfType = (man, type) => man.slots.filter((s) => s.type === type);
    const isHex = (c) => typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c);
    const rankNeeded = (it) => Math.max(0, LFH.rankIndex(it.rank));
    function defaultRoom(items, man) {
      const rm = { placed: {}, paint: { wall: null, floor: null, trim: null, tiles: null }, colors: {} };
      items.forEach((it) => {
        if (!isStarter(it)) return;
        const pk = paintKey(it);
        if (pk) { if (!rm.paint[pk] && it.sprite !== "any") rm.paint[pk] = it.id; return; }
        const free = slotsOfType(man, it.slot).filter((s) => !rm.placed[s.id] && (!s.parent || rm.placed[s.parent]))[0];
        if (free) rm.placed[free.id] = it.id;
      });
      return rm;
    }
    /* The starter lab = every Price 0 row (except Awards), owned, placed in row order. */
    function defaultState(items, man) {
      const st = { v: 2, owned: items.filter(isStarter).map((it) => it.id), rooms: {}, awards: {} };
      st.rooms[roomOf(man)] = defaultRoom(items, man);
      return st;
    }
    /* Repairs anything a stale save or an edited Items tab could break. Never throws. */
    function normalize(state, items, man) {
      const byId = index(items), rid = roomOf(man), def = defaultState(items, man), drm = def.rooms[rid];
      const st = state && typeof state === "object" ? clone(state) : {};
      if (!st.rooms || typeof st.rooms !== "object") st.rooms = {};
      delete st.funds; st.v = 2;
      const owned = Array.isArray(st.owned) ? st.owned.slice() : [];
      def.owned.forEach((id) => { if (owned.indexOf(id) < 0) owned.push(id); });
      st.owned = owned.filter((id, i) => byId[id] && owned.indexOf(id) === i);
      st.awards = st.awards && typeof st.awards === "object" ? st.awards : {};
      const used = {};   // items already out in OTHER rooms (future wings) stay there
      Object.keys(st.rooms).forEach((k) => { if (k === rid) return; const p = (st.rooms[k] || {}).placed || {}; for (const s in p) used[p[s]] = 1; });
      const src = st.rooms[rid] && typeof st.rooms[rid] === "object" ? st.rooms[rid] : null;
      let placed = {};
      if (!src || !src.placed) placed = clone(drm.placed);   // a brand-new lab
      else man.slots.forEach((s) => {
        const id = src.placed[s.id], it = byId[id];
        if (it && it.slot === s.type && st.owned.indexOf(id) >= 0 && !used[id]) { placed[s.id] = id; used[id] = 1; }
      });
      man.slots.forEach((s) => { if (s.required && !placed[s.id] && drm.placed[s.id]) placed[s.id] = drm.placed[s.id]; });
      man.slots.forEach((s) => { if (s.parent && !placed[s.parent]) delete placed[s.id]; });   // nothing floats
      const paint = (src && src.paint) || {}, colors = (src && src.colors) || {}, outColors = {};
      ["wall", "floor", "trim", "tiles"].forEach((k) => { const it = byId[paint[k]]; if (!it || paintKey(it) !== k || st.owned.indexOf(it.id) < 0) paint[k] = drm.paint[k]; });
      ["wall", "floor", "trim"].forEach((k) => { if (isHex(colors[k])) outColors[k] = colors[k].toUpperCase(); });
      st.rooms[rid] = { placed, paint: { wall: paint.wall, floor: paint.floor, trim: paint.trim, tiles: paint.tiles }, colors: outColors };
      return st;
    }
    const owns = (lab, id) => !!(lab && Array.isArray(lab.owned) && lab.owned.indexOf(id) >= 0);
    /* What a store button says, and why. rank is the student's rank index. */
    function canBuy(item, lab, funds, rank) {
      if (isAward(item)) return { ok: false, state: "award", why: "Earned, never bought" };
      if (owns(lab, item.id)) return { ok: false, state: "owned", why: "Yours" };
      if (rankNeeded(item) > rank) return { ok: false, state: "rank", why: `Reach ${LFH.RANKS[rankNeeded(item)].name} to buy` };
      if (item.price > funds) return { ok: false, state: "short", why: `Need $${item.price - funds} more` };
      return { ok: true, state: "buy", why: "" };
    }
    /* Buying takes the money and adds the item. Returns the new { lab, funds }, or null if it can't be bought. Placing is separate. */
    function buy(item, lab, funds, rank) {
      if (!canBuy(item, lab, funds, rank).ok) return null;
      const next = clone(lab); next.owned.push(item.id);
      return { lab: next, funds: funds - item.price };
    }
    /* The game grants Awards (never sold). For "Your Graph", data = { title, type: "line"|"bar"|"scatter", points: [[x, y], ...] }.
       Granting again replaces the data (the newest graph wins). A new award goes up in an empty poster spot if there is one. */
    function grant(lab, items, itemId, data, man) {
      const st = normalize(lab, items, man), it = index(items)[itemId];
      if (!it) return st;
      const isNew = st.owned.indexOf(itemId) < 0;
      if (isNew) st.owned.push(itemId);
      if (data !== undefined) st.awards[itemId] = clone(data);
      const rm = st.rooms[roomOf(man)];
      if (isNew && !Object.keys(rm.placed).some((k) => rm.placed[k] === itemId)) {
        const free = slotsOfType(man, it.slot).filter((s) => !rm.placed[s.id] && (!s.parent || rm.placed[s.parent]))[0];
        if (free) rm.placed[free.id] = itemId;
      }
      return st;
    }
    return { PAINT_KEYS, PATTERNS, SLOTS, paintKey, isAward, isStarter, roomOf, slotsOfType, rankNeeded, defaultState, normalize, owns, canBuy, buy, grant };
  })();
  LFH.owns = (P, id) => LFH.lab.owns(P.lab, id);

  /* Pay rewards evidence quality and finished side missions, never speed.
     First run: at least 40% of the job's pay even for rough work. Replays: 25% (same data). */
  LFH.payout = function ({ pay, pts, max, missions = 0, replay = false, weak = false }) {
    const r5 = (v) => Math.round(v / 5) * 5;
    if (replay) return r5(pay * 0.25);
    const base = r5(pay * (0.4 + 0.6 * (max ? pts / max : 0)));
    // a client who isn't convinced by the recommendation pays part of the fee (side missions still pay: help is never a loss)
    return (weak ? Math.min(base, r5(pay * 0.8)) : base) + 5 * missions;
  };

  /* Progress lives in ONE versioned object (Firestore-ready: only the storage adapter touches storage). */
  LFH.freshProgress = () => ({ v: 3, labName: "", funds: 0, lab: null,     // lab is filled in by sanitizeProgress (it needs the Items tab and the room art)
    cases: {}, bayCorrect: 0, bayBest: 0, inbox: { read: {}, arrived: {}, seq: 0 }, history: [], backedUpAt: "", offers: {} });
  LFH.migrate = function (raw) {
    const P = LFH.freshProgress();
    if (!raw || typeof raw !== "object") return P;
    if (raw.v === 3) return Object.assign(P, raw, { offers: Object.assign(P.offers, raw.offers || {}), inbox: Object.assign(P.inbox, raw.inbox || {}) });
    if (raw.v === 2) {   // game v0.3-v0.5: the old shop kept owned as a map and one item per slot. Keep what's owned; the room is laid out fresh.
      const keep = Object.assign({}, raw); delete keep.owned; delete keep.placed;
      return Object.assign(P, keep, { v: 3, lab: { owned: Object.keys(raw.owned || {}) }, offers: Object.assign(P.offers, raw.offers || {}), inbox: Object.assign(P.inbox, raw.inbox || {}) });
    }
    // v1 (game v0.1-v0.2): keep stars and practice, start the business fresh
    P.cases = raw.cases || {}; P.bayCorrect = raw.bayCorrect || 0; P.bayBest = raw.bayBest || 0;
    return P;
  };
  LFH.rep = (P) => Object.values(P.cases).reduce((a, c) => a + (c.best || 0), 0) + (P.bayCorrect || 0);

  /* Save file: a backup copy of the ONE progress object, for moving a lab between devices (e.g. via Google Drive).
     Loading REPLACES the device's progress; it never merges, so there is still one live record (Rule 9).
     The check value catches damaged or hand-edited files. It is a tamper speed bump, not security. */
  LFH.SAVE_MARK = "lab-for-hire-save";
  LFH.checksum = function (s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return ("0000000" + h.toString(16)).slice(-8); };
  LFH.exportSave = function (P, nowISO) {
    const progress = JSON.parse(JSON.stringify(Object.assign({}, P, { backedUpAt: nowISO })));
    const body = JSON.stringify(progress);
    return JSON.stringify({ [LFH.SAVE_MARK]: 1, game: LFH.version, savedAt: nowISO, lab: P.labName || "", check: LFH.checksum(body), progress }, null, 1);
  };
  LFH.importSave = function (text) {
    const NOT = "That file isn't a Lab for Hire save. Look for a file that ends in -lab-backup.json.";
    let f; try { f = JSON.parse(String(text || "")); } catch (e) { return { ok: false, error: NOT }; }
    if (!f || typeof f !== "object" || f[LFH.SAVE_MARK] !== 1 || !f.progress || typeof f.progress !== "object") return { ok: false, error: NOT };
    if (LFH.checksum(JSON.stringify(f.progress)) !== f.check) return { ok: false, error: "This save file was changed or damaged, so it can't be loaded. Try an older backup." };
    if (typeof f.progress.v !== "number" || f.progress.v > LFH.freshProgress().v) return { ok: false, error: "This save is from a newer version of the game. Reload the page, then try again." };
    if (!f.progress.labName) return { ok: false, error: NOT };
    return { ok: true, progress: LFH.migrate(f.progress), savedAt: f.savedAt || "" };
  };
  LFH.saveSummary = (P) => ({ lab: P.labName || "", funds: P.funds || 0, jobs: Object.values(P.cases || {}).filter((c) => c.done).length, rep: LFH.rep(P) });
  LFH.hasProgress = (P) => !!(P.labName || P.funds || Object.keys(P.cases || {}).length || P.bayCorrect || (P.history || []).length);
  LFH.backupAge = function (P, nowMs) {
    if (!P.backedUpAt) return "never";
    const d = Math.floor((nowMs - Date.parse(P.backedUpAt)) / 86400000);
    return isNaN(d) ? "never" : d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
  };

  /* Jobs in the inbox. Finishing a job releases the next; teasers always show (they advertise the year ahead). */
  LFH.jobs = function (M, P, preview) {
    const out = [];
    const real = M.cases.filter((c) => c.status === "Live" || (preview && c.status === "Draft"));
    real.forEach((c, i) => {
      const prev = real[i - 1];
      const released = preview || i === 0 || !!(P.cases[prev.id] && P.cases[prev.id].done);
      if (!released) return;
      const done = !!(P.cases[c.id] && P.cases[c.id].done);
      const needs = c.requires && !LFH.owns(P, c.requires) ? c.requires : "";
      out.push({ c, state: needs ? "locked" : done ? "done" : "open", needs });
    });
    M.cases.filter((c) => c.status === "Teaser").forEach((c) => out.push({ c, state: LFH.owns(P, c.requires) ? "soon" : "teaser", needs: LFH.owns(P, c.requires) ? "" : c.requires }));
    return out;
  };

  LFH.drillNames = {
    "scale-read": "Gridline values", "axis-read": "Which axis?", "point-find": "Find the point", "uneven-spacing": "Steepest section",
    "trend-read": "Spot the trend", "extrapolate": "Predict what's next", "phase-region": "Phase regions", "phase-trace": "Trace a phase change",
    "log-read": "Log scales", "table-read": "Read a table", "series-read": "Multi-line graphs", "scale-choose": "Choose a scale", "variable-placement": "Which variable goes where?",
  };


  /* ---------------- Content: vocabulary, quarantine, and where the game gets its content ---------------- */
  LFH.SCHEMA = "0.5.0";
  const mm = (v) => String(v || "").split(".").slice(0, 2).join(".");
  LFH.schemaOk = (v) => mm(v) === mm(LFH.SCHEMA);

  /* Every dropdown on the Sheet's Lists tab. The game is the authority; checkLists tells teachers when the Sheet disagrees. */
  LFH.vocab = () => ({
    Status: ["Draft", "Live", "Teaser"],
    VisualType: ["Line graph", "Bar graph", "Data table", "Phase diagram"],
    QuestionType: ["Multiple choice", "Pick two", "Pick three", "Select all that apply"],
    Role: ["Main", "Check"],
    Skill: ["Read a value", "Read the scale", "Identify a trend", "Compare", "Predict / extrapolate", "Evaluate a claim", "Select evidence", "Apply the science"],
    Kind: ["Calibration", "Archive"],
    Drill: Object.keys(LFH.drills),
    Correct: ["Yes"], Build: ["Yes"], AxisScale: ["Linear", "Log"],
    PhaseSeries: ["Melting line", "Boiling line", "Sublimation line"],
    ItemKind: ["Equipment", "Cosmetic", "Theme", "Award"],
    Slot: LFH.lab.SLOTS,
    Rank: LFH.RANKS.map((r) => r.name),
  });
  LFH.checkLists = function (lists) {
    if (!lists || typeof lists !== "object") return [];
    const out = [], V = LFH.vocab();
    Object.keys(V).forEach((k) => {
      if (!lists[k]) return out.push(`The Lists tab has no '${k}' column, so teachers get no dropdown for it`);
      const have = new Set(lists[k]), want = new Set(V[k]);
      const miss = V[k].filter((x) => !have.has(x)), extra = lists[k].filter((x) => !want.has(x));
      if (miss.length) out.push(`Lists tab, '${k}': missing ${miss.map((x) => `'${x}'`).join(", ")} (teachers can't pick ${miss.length > 1 ? "these" : "it"})`);
      if (extra.length) out.push(`Lists tab, '${k}': has ${extra.map((x) => `'${x}'`).join(", ")}, which this game doesn't understand`);
    });
    return out;
  };

  /* Remove whole cases (and everything that belongs to them). Items that unlocked a removed case stop advertising it. */
  LFH.dropCases = function (C, ids) {
    const gone = new Set(ids); if (!gone.size) return C;
    const keepVis = new Set(C.visuals.filter((v) => !gone.has(v.caseId)).map((v) => v.id));
    const questions = C.questions.filter((q) => q.role !== "Main" || !gone.has(q.caseId));
    const qk = new Set(questions.map((q) => q.id));
    return Object.assign({}, C, {
      cases: C.cases.filter((c) => !gone.has(c.id)),
      visuals: C.visuals.filter((v) => keepVis.has(v.id)),
      data: C.data.filter((d) => keepVis.has(d.visualId)),
      tables: C.tables.filter((t) => keepVis.has(t.visualId)),
      questions, options: C.options.filter((o) => qk.has(o.qid)),
      items: C.items || [],
    });
  };
  /* Round 0: skip rows that can never work (orphans, bad items/tags/check questions) and say so. */
  function strip(C, warnings) {
    const found = LFH.validateDetailed(C).filter((e) => e.level === "warning");
    found.forEach((e) => warnings.push(e.msg));
    const dI = new Set(found.map((e) => e.dropItem).filter(Boolean)), dT = new Set(found.map((e) => e.dropTag).filter(Boolean)), dQ = new Set(found.map((e) => e.dropQuestion).filter(Boolean));
    const caseIds = new Set(C.cases.map((c) => c.id));
    const visuals = C.visuals.filter((v) => caseIds.has(v.caseId)), vk = new Set(visuals.map((v) => v.id));
    const questions = C.questions.filter((q) => !dQ.has(q.id) && (q.role !== "Main" || caseIds.has(q.caseId))), qk = new Set(questions.map((q) => q.id));
    return Object.assign({}, C, {
      visuals, data: C.data.filter((d) => vk.has(d.visualId)), tables: C.tables.filter((t) => vk.has(t.visualId)),
      questions, options: C.options.filter((o) => qk.has(o.qid)),
      items: (C.items || []).filter((it) => !dI.has(it.id)), tags: C.tags.filter((t) => !dT.has(t.id)),
    });
  }
  /* Hold back every case with a problem; keep the rest playable. Whatever is left in `errors` blocks everything. */
  LFH.quarantine = function (C0) {
    const warnings = [], held = {};
    let C = strip(C0, warnings);
    for (let round = 0; round < 6; round++) {
      const errs = LFH.validateDetailed(C).filter((e) => e.level === "error");
      const bad = [...new Set(errs.filter((e) => e.caseId).map((e) => e.caseId))];
      if (!bad.length) return { C, held, warnings, errors: errs.map((e) => e.msg) };
      bad.forEach((id) => { held[id] = (held[id] || []).concat(errs.filter((e) => e.caseId === id).map((e) => e.msg)); });
      C = LFH.dropCases(C, bad);
    }
    return { C, held, warnings, errors: ["too many cascading problems in the content"] };
  };
  /* The room art is baked into the game. An item whose picture isn't there is skipped, and a job that needs it is held back.
     If the starter lab can't be drawn at all (no bench, say), that is a blocking error and the game falls back. */
  LFH.fitToArt = function (C, ART) {
    const man = ART.manifest, warnings = [], errors = [], drop = new Set();
    (C.items || []).forEach((it) => {
      if (LFH.lab.paintKey(it)) return;   // paint is drawn by code, not baked
      const spots = LFH.lab.slotsOfType(man, it.slot);
      if (!spots.length) { warnings.push(`${it.id}: the room has no '${it.slot}' spot, so the item isn't in the store`); drop.add(it.id); }
      else if (!spots.every((sp) => man.sprites[it.sprite + "@" + sp.id])) { warnings.push(`${it.id}: the room art has no '${it.sprite}' picture for a ${it.slot} spot yet, so the item isn't in the store (it needs a re-bake)`); drop.add(it.id); }
    });
    const items = (C.items || []).filter((it) => !drop.has(it.id));
    if (items.length) man.slots.filter((sp) => sp.required).forEach((sp) => {
      if (!items.some((it) => it.slot === sp.type && it.price === 0 && it.kind !== "Award")) errors.push(`Items: the starter lab has no ${sp.label.toLowerCase()} (one '${sp.type}' row with Price 0)`);
    });
    if (!drop.size) return { C, warnings, errors, held: [] };
    const held = C.cases.filter((c) => c.requires && drop.has(c.requires)).map((c) => c.id);
    held.forEach((id) => warnings.push(`${id}: held back, because the item it requires isn't in the store yet`));
    return { C: LFH.dropCases(Object.assign({}, C, { items }), held), warnings, errors, held };
  };
  /* Everything the game does to raw content before using it. */
  LFH.prepare = function (C, ART) {
    const q = LFH.quarantine(C);
    const f = ART ? LFH.fitToArt(q.C, ART) : { C: q.C, warnings: [], errors: [], held: [] };
    const held = Object.assign({}, q.held);
    f.held.forEach((id) => (held[id] = ["needs a store item whose art isn't in the game yet"]));
    return { C: f.C, held, warnings: (C.warnings || []).concat(q.warnings, f.warnings, LFH.checkLists(C.lists)), errors: q.errors.concat(f.errors) };
  };

  /* Where content comes from: the live Sheet feed, else the last good copy, else the snapshot built into the page.
     Pure logic: the page passes in fetch and storage, so every path is testable. */
  LFH.content = {
    TIMEOUT_MS: 5000, FRESH_MS: 2 * 60 * 1000,
    url(base, preview) { return base + (base.indexOf("?") < 0 ? "?" : "&") + (preview ? "include=draft&fresh=1" : "v=" + mm(LFH.SCHEMA)); },
    judge(C, ART) {
      try {
        if (!C || typeof C !== "object" || ["cases", "visuals", "data", "tables", "questions", "options", "tags"].some((k) => !Array.isArray(C[k]))) return { ok: false, why: "that isn't a content feed" };
        const prepared = LFH.prepare(C, ART);
        if (!LFH.schemaOk(C.schema)) return { ok: false, why: `the feed is schema ${C.schema} but this game needs ${mm(LFH.SCHEMA)}`, prepared };
        if (C.sheetSchema && !LFH.schemaOk(C.sheetSchema)) return { ok: false, why: `the Sheet says schema ${C.sheetSchema} but this game needs ${LFH.SCHEMA}, so the Sheet needs upgrading`, prepared };
        if (C.errors && C.errors.length) return { ok: false, why: C.errors[0], prepared };
        if (prepared.errors.length) return { ok: false, why: prepared.errors[0], prepared };
        return { ok: true, prepared };
      } catch (e) { return { ok: false, why: "the content couldn't be read (" + ((e && e.message) || e) + ")" }; }
    },
    async choose(d) {
      const now = d.now || Date.now(), K = LFH.content;
      const ts = (c) => Date.parse(c && c.generated) || 0;
      const use = (C, source, j, extra) => Object.assign({ C: j.prepared.C, source, generated: C.generated || "", held: j.prepared.held, warnings: j.prepared.warnings, errors: [], note: "", feed: null }, extra);
      let note = "", feed = null;
      const cache = d.store && d.store.cacheGet ? d.store.cacheGet() : null;
      if (d.feedUrl) {
        if (cache && !d.preview && now - cache.savedAt < K.FRESH_MS) {
          const j = K.judge(cache.content, d.art);
          if (j.ok) return use(cache.content, "cache", j);
        }
        try {
          const got = await d.fetchJson(K.url(d.feedUrl, d.preview), K.TIMEOUT_MS);
          const j = K.judge(got, d.art);
          feed = { why: j.ok ? "" : j.why, held: j.prepared ? j.prepared.held : {}, warnings: j.prepared ? j.prepared.warnings : [], errors: (j.prepared ? j.prepared.errors : []).concat(got && got.errors ? got.errors : []) };
          if (j.ok) {
            if (!d.preview && d.store && d.store.cachePut) d.store.cachePut({ savedAt: now, content: got });
            return use(got, "live", j, { feed });
          }
          note = "the live Sheet has a problem: " + j.why;
        } catch (e) { note = "couldn't reach the live Sheet (" + ((e && e.message) || e) + ")"; }
        if (cache && ts(cache.content) >= ts(d.snapshot)) {
          const j = K.judge(cache.content, d.art);
          if (j.ok) return use(cache.content, "cache", j, { note, feed });
        }
      }
      const sj = K.judge(d.snapshot, d.art);
      const j = sj.prepared ? sj : { prepared: LFH.prepare(d.snapshot, d.art) };
      return use(d.snapshot, "snapshot", j, { note, feed });
    },
  };

  /* Saved progress meets changed content: drop what no longer exists, never crash. */
  LFH.sanitizeProgress = function (P, C, ART) {
    if (ART) P.lab = LFH.lab.normalize(P.lab, C.items || [], ART.manifest);
    if (P.activeJob && !C.cases.some((c) => c.id === P.activeJob.caseId)) delete P.activeJob;
    return P;
  };
  /* A job saved mid-play, resumed after the Sheet changed. Returns the safe version, or null if the job can't continue. */
  LFH.reconcileJob = function (M, snap, templateQs) {   // templateQs: a generated job's questions (they aren't in the Sheet)
    const qs = snap && (templateQs || M.main[snap.caseId]);
    if (!qs || !qs.length) return null;
    const order = {}, rec = {};
    qs.forEach((q) => {
      const letters = (M.options[q.id] || []).map((o) => o.letter);
      const saved = snap.order && snap.order[q.id];
      order[q.id] = saved && saved.slice().sort().join() === letters.slice().sort().join() ? saved : LFH.util.shuffle(letters);
      if (snap.rec && snap.rec[q.id]) rec[q.id] = snap.rec[q.id];
    });
    return Object.assign({}, snap, { order, rec, qi: Math.min(Math.max(0, snap.qi | 0), qs.length - 1), visited: (snap.visited || []).filter((t) => M.tags[t]) });
  };

  /* ================= Job templates =================
     Same client and investigation, new requirements and NEW DATA each play (Hanson's job pattern).
     A template turns { n, variant, seed } into an instance shaped like ordinary case content
     (visual specs + questions + tagged options), so grading, side missions, and the report work unchanged.
     Stages: plan (fair test) -> run -> analyze -> recommend (claim, evidence, reasoning).
     The engine is the ONE home for template text and models; the Sheet holds the case row and the tags. */
  LFH.seeded = function (seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  };
  LFH.withSeed = function (seed, fn) { const keep = LFH.rng; LFH.rng = LFH.seeded(seed); try { return fn(); } finally { LFH.rng = keep; } };

  /* Dissolving model: a fast change (td) that fades back toward room temperature (tw), scaled so D is the biggest change.
     Fitted to Hanson's Cold Pack sample data (v0.3.0 Sheet): ammonium nitrate, urea, sodium chloride match every
     reading exactly after rounding; calcium chloride is within 1°C. The other substances are sample values in the same style. */
  LFH.dissolveShape = function (td, tw, t) {
    const tp = (Math.log(tw / td) * td * tw) / (tw - td), fm = Math.exp(-tp / tw) - Math.exp(-tp / td);
    return (Math.exp(-t / tw) - Math.exp(-t / td)) / fm;
  };
  const SUB = {
    "ammonium-nitrate": { name: "Ammonium nitrate", D: -18.97, td: 1.75, tw: 13.5, price: [1.0, 1.4] },
    "urea": { name: "Urea", D: -15.38, td: 1.7, tw: 17.5, price: [0.6, 1.0] },
    "ammonium-chloride": { name: "Ammonium chloride", D: -13.5, td: 1.6, tw: 15, price: [0.5, 0.9] },
    "potassium-chloride": { name: "Potassium chloride", D: -10.5, td: 1.8, tw: 14, price: [0.35, 0.75] },
    "sodium-chloride": { name: "Sodium chloride", D: -1.16, td: 2.3, tw: 4.0, price: [0.05, 0.15] },
    "calcium-chloride": { name: "Calcium chloride", D: 21.35, td: 3.9, tw: 5.0, price: [0.45, 0.75] },
    "magnesium-sulfate": { name: "Magnesium sulfate", D: 18, td: 2.4, tw: 9, price: [0.35, 0.7] },
  };
  LFH.SUBSTANCES = SUB;
  const COLD_POOL = ["ammonium-nitrate", "urea", "ammonium-chloride", "potassium-chloride"];
  const money = (p) => `$${p.toFixed(2)}`;
  const listAnd = (a) => (a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")}${a.length > 2 ? "," : ""} and ${a[a.length - 1]}`);

  const CP = {
    id: "COLD-PACK",
    times: [0, 2, 4, 6, 8, 10],
    variants: {
      classic: { kind: "cold", title: "The Cold Pack Challenge", story: null },
      hot: { kind: "hot", title: "Hot Packs for Sore Muscles",
        story: "Coach Rivera is back! The cold packs are working, and now the trainer wants instant HOT packs for sore muscles. A pack has to warm up fast, stay warm, and not blow the budget. Plan a fair test, run it, and recommend the best substance." },
      longer: { kind: "cold", title: "Packs for the Long Bus Ride",
        story: "The team's away games are far from home. Coach Rivera needs cold packs that are still cold when the bus gets back, and they still can't blow the budget. Plan a fair test, run it, and recommend the best substance." },
      colder: { kind: "cold", title: "Colder, Please",
        story: "The trainer says swelling goes down faster with a colder pack, so Coach Rivera has tighter rules this time. Plan a fair test, run it, and recommend the best substance for the money." },
      prices: { kind: "cold", title: "New Supplier, New Prices",
        story: "Coach Rivera switched to a new supplier, with new prices and a new batch of substances. Same goal: the best cold pack for the money. Plan a fair test, run it, and recommend one." },
      followup: { kind: "cold", title: "Double-Check the Cold Packs",
        story: "Coach Rivera wasn't sure about the last recommendation. A fresh batch of substances just arrived. Test them again, and this time make the evidence airtight." },
    },
    sequels: ["longer", "colder", "prices", "hot"],
  };

  /* The parameters for one play. Re-rolls until the data is readable and the job has one clear best answer. */
  function cpParams(variant, n) {
    const v = CP.variants[variant], kind = v.kind;
    if (variant === "classic") return { kind, th: 10, t1: 2, t2: 8, T0: 22, noise: 0,
      subs: ["ammonium-nitrate", "urea", "sodium-chloride", "calcium-chloride"], k: { "ammonium-nitrate": 1, "urea": 1, "sodium-chloride": 1, "calcium-chloride": 1 },
      prices: { "ammonium-nitrate": 1.2, "urea": 0.85, "sodium-chloride": 0.1, "calcium-chloride": 0.6 } };
    let subs;
    if (kind === "hot") subs = ["calcium-chloride", "magnesium-sulfate", pick(COLD_POOL), "sodium-chloride"];
    else subs = shuffle(COLD_POOL).slice(0, 3).concat(pick(["sodium-chloride", "calcium-chloride", "magnesium-sulfate"]));
    subs = shuffle(subs);
    const pairs = variant === "longer" ? [[4, 10]] : variant === "colder" ? [[4, 6], [4, 8], [2, 6]] : [[2, 8], [2, 6], [4, 8], [2, 10]];
    const [t1, t2] = pick(pairs);
    // the line the packs must beat; the final value is chosen from these after the data exists (see LFH.instance)
    const ths = kind === "hot" ? [30, 31, 32, 33, 34, 35] : variant === "colder" ? [7, 8, 9] : [10, 11, 12, 13];
    const k = {}, prices = {};
    subs.forEach((s) => { k[s] = round(0.9 + 0.2 * R(), 3); const [lo, hi] = SUB[s].price; prices[s] = round(lo + 0.05 * ri(0, Math.round((hi - lo) / 0.05)), 2); });
    return { kind, th: ths[0], ths, t1, t2, T0: variant === "colder" ? ri(20, 22) : ri(20, 24), noise: 0.8, subs, k, prices };
  }
  function cpReadings(p) {
    const read = {};
    p.subs.forEach((s) => {
      const S = SUB[s];
      read[s] = CP.times.map((t) => {
        if (t === 0) return p.T0;
        let sum = 0;
        for (let i = 0; i < 3; i++) sum += p.T0 + p.k[s] * S.D * LFH.dissolveShape(S.td, S.tw, t) + (p.noise ? (R() * 2 - 1) * p.noise : 0);
        return Math.round(sum / 3);
      });
    });
    const control = CP.times.map((t) => (t === 0 || !p.noise ? p.T0 : Math.round(p.T0 + (R() * 2 - 1) * 0.6)));
    return { read, control };
  }
  const passes = (p, vals) => { const a = vals[CP.times.indexOf(p.t1)], b = vals[CP.times.indexOf(p.t2)]; return p.kind === "hot" ? a > p.th && b > p.th : a < p.th && b < p.th; };
  function cpProblems(p, d) {
    const bad = [];
    const all = Object.values(d.read).flat();
    if (all.some((v) => v < 1 || v > 49)) bad.push("off the graph");
    const pass = p.subs.filter((s) => passes(p, d.read[s]));
    if (pass.length < 2) bad.push("needs 2+ passers");
    if (pass.length === p.subs.length) bad.push("needs a substance that fails");
    p.subs.forEach((s) => [p.t1, p.t2].forEach((t) => { if (Math.abs(d.read[s][CP.times.indexOf(t)] - p.th) < 2) bad.push("too close to the line"); }));
    const cost = pass.map((s) => p.prices[s]).sort((a, b) => a - b);
    if (cost.length > 1 && cost[1] - cost[0] < 0.095) bad.push("cheapest isn't clear");
    return bad;
  }

  const L4 = "ABCDEFGH";
  const opts = (list) => list.map((o, i) => ({ letter: L4[i], text: o[0], correct: !!o[1], tag: o[2] || "" }));
  function cpPlanQuestions(kind) {
    const feel = kind === "hot" ? "warmest" : "coldest";
    return {
      change: { planNote: "Change only the substance in each cup", skill: "Plan: what to change", type: "Multiple choice", prompt: "First, plan a fair test. What will you change on purpose from cup to cup?",
        why: "You're comparing substances, so the substance is the ONE thing you change. Change anything else too, and you can't tell which change caused the result.",
        options: opts([["Which substance goes in the cup", 1], ["The substance AND the amount of water", 0, "PLAN-ONE-CHANGE"], ["Only the amount of water", 0, "PLAN-ONE-CHANGE"], ["Nothing: use the same substance in every cup", 0, "PLAN-ONE-CHANGE"]]) },
      same: { planNote: "Keep the same: amount of water, amount of substance, starting temperature", skill: "Plan: what stays the same", type: "Select all that apply", prompt: "What will you keep the SAME in every cup? Select ALL that apply.",
        why: "Everything except the substance stays the same, so any difference in temperature comes from the substance. The temperature is what you measure, so it can't be kept the same.",
        options: opts([["The amount of water", 1, "PLAN-ONE-CHANGE"], ["The amount of substance", 1, "PLAN-ONE-CHANGE"], ["The starting water temperature", 1, "PLAN-ONE-CHANGE"], ["Which substance goes in the cup", 0, "PLAN-ONE-CHANGE"], ["The temperature after a few minutes", 0, "PLAN-MEASURE"]]) },
      control: { planNote: "Add a control: one cup of plain water", skill: "Plan: a control", type: "Multiple choice", prompt: "A teammate wants to add one more cup with just water and no substance. Is that a good idea?",
        why: "The plain-water cup is your control. It shows what happens with no substance at all, so you can see how much each substance really changed the temperature.",
        options: opts([["Yes. It shows what happens with no substance, so you can see how much each substance really changed the temperature.", 1], ["No. The client only asked about the substances, so plain water is a wasted cup.", 0, "PLAN-CONTROL"], [`Yes. Plain water will probably get the ${feel}.`, 0, "PLAN-CONTROL"], ["No. An extra cup means you're changing two things.", 0, "PLAN-ONE-CHANGE"]]) },
      trials: { planNote: "Test each substance 3 times and average", skill: "Plan: repeated trials", type: "Multiple choice", prompt: "How many times should you test each substance?",
        why: "One result could be a fluke or a mistake. Testing every substance the same number of times and averaging makes the evidence trustworthy.",
        options: opts([["Three times each, then average the results", 1], ["Once each. Careful scientists don't need to repeat.", 0, "PLAN-TRIALS"], ["Three times for the one you think will win, once for the others", 0, "PLAN-TRIALS"], ["Keep testing until you get the result you expected", 0, "PLAN-TRIALS"]]) },
      measure: { planNote: "Measure the temperature in every cup every 2 minutes", skill: "Plan: what to measure", type: "Multiple choice", prompt: "What will you measure, and when?",
        why: "The client's rules are about temperature at certain times, so you need a thermometer reading in every cup at those times.",
        options: opts([["The water temperature in every cup, every 2 minutes for 10 minutes", 1], ["The temperature once, at the very end", 0, "PLAN-MEASURE"], ["How fast each substance dissolves", 0, "PLAN-MEASURE"], [`Which cup feels ${feel} to your hand`, 0, "PLAN-MEASURE"]]) },
    };
  }

  function cpQuestions(p, d, plan, classic) {
    const name = (s) => SUB[s].name, at = (s, t) => d.read[s][CP.times.indexOf(t)];
    const hot = p.kind === "hot", word = hot ? "warmer than" : "colder than", packs = hot ? "hot packs" : "cold packs";
    const pass = p.subs.filter((s) => passes(p, d.read[s])), fail = p.subs.filter((s) => !pass.includes(s));
    const byCost = pass.slice().sort((a, b) => p.prices[a] - p.prices[b]), claim = byCost[0], runner = byCost[1];
    const extreme = (list) => list.slice().sort((a, b) => (hot ? -1 : 1) * (Math.min(...d.read[a].map((v) => (hot ? -v : v))) - Math.min(...d.read[b].map((v) => (hot ? -v : v)))))[0];
    const G = ["CPT-GRAPH"], GC = ["CPT-GRAPH", "CPT-COST"];
    const qs = [];
    const add = (stage, q, vis) => qs.push(Object.assign({ stage, visuals: vis || [] }, q));
    plan.forEach((k) => add("plan", cpPlanQuestions(p.kind)[k]));

    // ---- Analyze ----
    const readQ = () => {
      const cands = [];
      p.subs.forEach((s) => [2, 4, 6, 8].forEach((t) => {
        const v = at(s, t); if (v % 5 === 0) return;
        const series = p.subs.filter((o) => o !== s).map((o) => at(o, t)).find((x) => x !== v && x % 5 !== 0);
        const point = [at(s, t + 2), at(s, t - 2)].find((x) => x !== v && x !== series);
        const snap = Math.round(v / 5) * 5;
        if (series === undefined || point === undefined || new Set([v, series, point, snap]).size < 4) return;
        cands.push({ s, t, v, series, point, snap });
      }));
      const c = classic ? cands.find((x) => x.s === "urea" && x.t === 4) || cands[0] : pick(cands);
      if (!c) return null;
      const lo = Math.floor(c.v / 5) * 5;
      return { skill: "Read a value", type: "Multiple choice", prompt: `What was the water temperature with ${name(c.s)} at ${c.t} minutes?`,
        why: `Find the ${name(c.s)} line in the key, go up from ${c.t} minutes, and read across: ${c.v}°C, between the ${lo} and ${lo + 5} gridlines.`,
        options: opts([[`${c.v}°C`, 1], [`${c.series}°C`, 0, "CAL-SERIES"], [`${c.point}°C`, 0, "CAL-POINT"], [`${c.snap}°C`, 0, "CAL-SCALE"]]) };
    };
    const trendQ = () => {
      const s = extreme(p.subs.filter((x) => (hot ? SUB[x].D > 0 : SUB[x].D < 0))), v = d.read[s];
      const peak = hot ? Math.max(...v) : Math.min(...v), pt = CP.times[v.indexOf(peak)];
      if (Math.abs(v[v.length - 1] - peak) < 2 || pt > 6) return null;
      const right = hot ? "It rises quickly, then slowly cools down." : "It drops quickly, then slowly warms back up.";
      const flip = hot ? "It drops quickly, then slowly warms back up." : "It rises quickly, then slowly cools down.";
      return { skill: "Identify a trend", type: "Multiple choice", prompt: `Which statement describes the ${name(s)} line from 0 to 10 minutes?`,
        why: `It goes from ${v[0]}°C to ${peak}°C by ${pt} minutes, then slowly heads back toward room temperature (${v[v.length - 1]}°C at 10 minutes) as the room ${hot ? "takes thermal energy back out" : "adds thermal energy back"}.`,
        options: opts([[right, 1], [hot ? "It keeps getting warmer the whole time." : "It keeps getting colder the whole time.", 0, "CAL-TREND"], ["It stays at about the same temperature.", 0, "CAL-TREND"], [flip, 0, "CAL-SERIES"]]) };
    };
    const leastQ = () => {
      const ch = p.subs.map((s) => [s, Math.max(...d.read[s].map((v, i) => Math.abs(v - d.control[i])))]).sort((a, b) => a[1] - b[1]);
      if (ch[1][1] - ch[0][1] < 3) return null;
      return { skill: "Compare", type: "Multiple choice", prompt: "Compared with the plain-water cup, which substance changed the water temperature the LEAST?",
        why: `The ${name(ch[0][0])} line stays close to the plain-water line the whole time: it never differs by more than ${ch[0][1]}°C.`,
        options: opts(p.subs.map((s) => [name(s), s === ch[0][0], s === ch[0][0] ? "" : "CAL-SERIES"])) };
    };
    const otherPackQ = () => {
      const want = p.subs.filter((s) => (hot ? SUB[s].D < -5 : SUB[s].D > 5));
      if (want.length !== 1) return null;
      return { skill: "Apply the science", type: "Multiple choice", prompt: hot ? "The team also needs COLD packs for injuries. Which substance should go in those?" : "The team also needs HOT packs for sore muscles. Which substance should go in those?",
        why: hot ? `${name(want[0])} made the water colder: dissolving it absorbs thermal energy.` : `${name(want[0])} made the water warmer: dissolving it releases thermal energy.`,
        options: opts(p.subs.map((s) => [name(s), s === want[0], s === want[0] ? "" : Math.abs(SUB[s].D) < 3 ? "CAL-TREND" : "SCI-ENDO-EXO"])) };
    };
    const rulesQ = { skill: "Compare", type: "Select all that apply",
      prompt: `Coach's rules: ${word} ${p.th}°C at ${p.t1} minutes AND still ${word} ${p.th}°C at ${p.t2} minutes. Select ALL the substances that meet both rules.`,
      why: `${p.subs.map((s) => `${name(s)}: ${at(s, p.t1)}°C, then ${at(s, p.t2)}°C`).join(". ")}. Only ${listAnd(pass.map(name))} ${pass.length > 1 ? "stay" : "stays"} ${word} ${p.th}°C both times.`,
      options: opts(p.subs.map((s) => [name(s), pass.includes(s), "CAL-SERIES"])) };
    let analyze;
    if (classic) analyze = [readQ(), trendQ(), otherPackQ()];
    else analyze = shuffle([readQ, trendQ, leastQ, otherPackQ]).map((f) => f()).filter(Boolean).slice(0, 2);
    analyze.filter(Boolean).forEach((q) => add("analyze", q, G));
    add("analyze", rulesQ, G);

    // ---- Recommend: claim, evidence, reasoning ----
    add("recommend", { skill: "Claim", type: "Multiple choice", label: "Claim",
      prompt: `Time for your recommendation. CLAIM: which substance should go in the team's ${packs}?`,
      why: `${name(claim)} meets every rule, and at ${money(p.prices[claim])} a pack it costs the least of the substances that pass. ${name(runner)} passes too, but costs ${money(p.prices[runner])}.`,
      options: opts(p.subs.map((s) => [name(s), s === claim, s === claim ? "" : "CER-CRITERIA"])) }, GC);
    const ext = extreme(p.subs), f0 = fail[0];
    const evidence = [
      [`${name(claim)} was ${word} ${p.th}°C at ${p.t1} minutes (${at(claim, p.t1)}°C) and at ${p.t2} minutes (${at(claim, p.t2)}°C).`, 1, "SCI-EVIDENCE"],
      [`${name(claim)} costs ${money(p.prices[claim])} a pack. ${name(runner)}, which also met the rules, costs ${money(p.prices[runner])}.`, 1, "SCI-EVIDENCE"],
      ["All four substances dissolved in water.", 0, "SCI-EVIDENCE"],
      [`${name(f0)} was ${word} ${p.th}°C at both ${p.t1} and ${p.t2} minutes.`, 0, "CAL-SERIES"],
      ext !== claim ? [`${name(ext)} got the ${hot ? "warmest" : "coldest"} of all the substances.`, 0, "SCI-EVIDENCE"] : ["Every cup held the same amount of water.", 0, "SCI-EVIDENCE"],
    ];
    add("recommend", { skill: "Evidence", type: "Select all that apply", label: "Evidence",
      prompt: `EVIDENCE: which statements support your claim that ${name(claim)} is the best choice? Select ALL that apply.`,
      why: "Evidence must be true AND show why this substance beats the others: it meets the rules, and it costs less than the other one that does. True facts about something else don't count.",
      options: opts(evidence) }, GC);
    const sci = hot ? `dissolving ${name(claim)} releases thermal energy, so heat flows out of the pack and into the sore muscle` : `dissolving ${name(claim)} absorbs thermal energy, so heat flows out of the ankle and into the pack`;
    add("recommend", { skill: "Reasoning", type: "Multiple choice", label: "Reasoning",
      prompt: "REASONING: which statement best connects your evidence to your claim?",
      why: `Strong reasoning ties the evidence to the client's rules AND explains the science: ${sci}.`,
      options: opts([[`It meets every one of Coach's rules and costs the least of the substances that do. It works because ${sci}.`, 1],
        [`The ${hot ? "warmest" : "coldest"} pack is always the best pack, no matter what it costs.`, 0, "CER-CRITERIA"],
        [hot ? `It works because ${name(claim)} absorbs thermal energy from the muscle.` : `It works because ${name(claim)} gives off cold that flows into the ankle.`, 0, "SCI-ENDO-EXO"],
        ["Cost is all that matters, so the cheapest substance is always the best choice.", 0, "CER-CRITERIA"]]) }, GC);
    qs.forEach((q, i) => { q.id = `CPT-${i + 1}`; q.caseId = CP.id; q.order = i + 1; q.role = "Main"; });
    return { qs, pass, claim, runner };
  }

  LFH.TEMPLATES = { "COLD-PACK": CP };
  /* Build one play. offer = { n, variant, seed }. The same offer always rebuilds the same job (resume after reload). */
  LFH.instance = function (caseId, offer) {
    const T = LFH.TEMPLATES[caseId];
    const o = Object.assign({ n: 1, variant: "classic", seed: 1 }, offer || {});
    return LFH.withSeed(o.seed, () => {
      let p, d, tries = 0;
      let ok = o.variant === "classic";
      while (!ok && tries < 400) {
        p = cpParams(o.variant, o.n); d = cpReadings(p); tries++;
        for (const th of shuffle(p.ths)) { p.th = th; if (!cpProblems(p, d).length) { ok = true; break; } }
      }
      const fallback = !ok;                      // never expected; the engine tests prove it over thousands of seeds
      if (o.variant === "classic" || fallback) { p = cpParams("classic", o.n); d = cpReadings(p); }
      const classic = o.variant === "classic" || fallback;
      const planKeys = classic ? ["change", "same", "control", "trials"] : shuffle(["change", "same", "control", "trials", "measure"]).slice(0, 2);
      const { qs, pass, claim, runner } = cpQuestions(p, d, planKeys, classic);
      const hot = p.kind === "hot", word = hot ? "Warmer than" : "Colder than";
      const graph = { id: "CPT-GRAPH", label: "Temperature graph", type: "Line graph", title: `Water Temperature in Each Cup (average of 3 trials)`, build: false,
        x: { label: "Time", unit: "min", min: 0, max: 10, step: 2, scale: "Linear" }, y: { label: "Temperature", unit: "°C", min: 0, max: 50, step: 5, scale: "Linear" },
        series: p.subs.map((s) => ({ name: SUB[s].name, points: CP.times.map((t, i) => ({ x: t, y: d.read[s][i], label: "" })) }))
          .concat([{ name: "Plain water (control)", control: true, points: CP.times.map((t, i) => ({ x: t, y: d.control[i], label: "" })) }]), table: null };
      const cost = { id: "CPT-COST", label: "Cost table", type: "Data table", title: "Cost of Each Substance (per pack)", build: false, x: {}, y: {}, series: [],
        table: { headers: ["Substance", "Cost per pack"], rows: p.subs.map((s) => [SUB[s].name, money(p.prices[s])]) } };
      const v = T.variants[o.variant];
      return { caseId, offer: o, kind: p.kind, title: v.title, story: v.story, params: p, readings: d, pass, claim, runner,
        claimName: SUB[claim].name, rules: [`${word} ${p.th}°C at ${p.t1} minutes`, `Still ${word.toLowerCase()} ${p.th}°C at ${p.t2} minutes`, "Costs as little as possible"],
        visuals: { "CPT-GRAPH": graph, "CPT-COST": cost }, vids: ["CPT-GRAPH", "CPT-COST"], qs, plan: planKeys, tries, fallback };
    });
  };
  /* A recommendation is strong when the claim was right the first time and evidence + reasoning needed at most one retry. */
  LFH.recommendationStrong = function (qs, rec) {
    const pts = (lbl) => { const q = qs.find((x) => x.label === lbl); return q ? (rec[q.id] || {}).points || 0 : 0; };
    return pts("Claim") === 3 && pts("Evidence") + pts("Reasoning") >= 5;
  };
  /* The next email from the same client: weak work gets a follow-up with fresh data; strong work gets a sequel with new rules. */
  LFH.nextOffer = function (caseId, n, strong, seed) {
    const T = LFH.TEMPLATES[caseId];
    const variant = !strong ? "followup" : n === 1 ? "hot" : T.sequels[(n - 1) % T.sequels.length];
    return { n: n + 1, variant, seed, kind: strong ? "sequel" : "followup" };
  };
  /* Every tag a template can hand out must exist in the Sheet, and Archive tags need a Check question there. */
  LFH.templateErrors = function (C, id) {
    const err = [], tags = {}; C.tags.forEach((t) => (tags[t.id] = t));
    const used = new Set();
    ["classic", ...Object.keys(LFH.TEMPLATES[id].variants)].forEach((variant) => [1, 2, 3].forEach((seed) =>
      LFH.instance(id, { n: 2, variant, seed }).qs.forEach((q) => q.options.forEach((o) => o.tag && used.add(o.tag)))));
    used.forEach((t) => {
      if (!tags[t]) err.push(`${id}: template uses tag ${t}, which isn't in SideMissions`);
      else if (tags[t].kind === "Archive" && !C.questions.some((q) => q.role === "Check" && q.forTag === t)) err.push(`${t}: Archive tag has no Check question`);
    });
    return err;
  };
  LFH.validateTemplates = function (C) {
    const err = [];
    Object.keys(LFH.TEMPLATES).forEach((id) => {
      if (!C.cases.some((c) => c.id === id)) err.push(`${id}: template has no Cases row`);
      err.push(...LFH.templateErrors(C, id));
    });
    return err;
  };


  root.LFH = LFH;
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this);
