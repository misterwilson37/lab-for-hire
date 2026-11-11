/* Lab for Hire app v0.6.0: UI layer. All game logic lives in LFH (engine). */
(function () {
  "use strict";
  const U = LFH.util;
  const params = new URLSearchParams(location.search);
  const PREVIEW = params.get("preview") === "1";
  const app = document.getElementById("app");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------------- Storage adapter: the ONLY code that touches storage ----------------
     Today: localStorage. Later: swap these functions for Firestore; nothing else changes. */
  LFH.store = {
    KEY: "lfh.progress", CACHE_KEY: "lfh.content.cache",
    load() {
      let raw = null;
      try { raw = JSON.parse(localStorage.getItem(this.KEY) || "null") || JSON.parse(localStorage.getItem("lfh.progress.v1") || "null"); } catch (e) { raw = null; }
      return LFH.migrate(raw);
    },
    save(P) { try { localStorage.setItem(this.KEY, JSON.stringify(P)); } catch (e) { /* storage unavailable: play continues unsaved */ } },
    cacheGet() { try { return JSON.parse(localStorage.getItem(this.CACHE_KEY) || "null"); } catch (e) { return null; } },
    cachePut(v) { try { localStorage.setItem(this.CACHE_KEY, JSON.stringify(v)); } catch (e) { /* no room: the next load just asks the Sheet again */ } },
  };

  /* ---------------- Boot: choose the content, then start ---------------- */
  const SNAPSHOT = JSON.parse(document.getElementById("lfh-content").textContent);
  const ART = JSON.parse(document.getElementById("lfh-art").textContent);
  let CONFIG = {}; try { CONFIG = JSON.parse(document.getElementById("lfh-config").textContent || "{}"); } catch (e) { CONFIG = {}; }
  function fetchFeed(url, ms) {      // a plain GET with no custom headers, so it works across origins without a preflight
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), ms) : null;
    return fetch(url, { credentials: "omit", cache: "no-store", signal: ctl ? ctl.signal : undefined })
      .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .finally(() => { if (timer) clearTimeout(timer); });
  }
  app.innerHTML = `<main class="intro"><div class="ticket"><p class="ticket-kicker">Lab for Hire</p><h1>Opening your lab…</h1><p class="small">Getting the latest jobs.</p></div></main>`;
  LFH.content.choose({ snapshot: SNAPSHOT, art: ART, feedUrl: CONFIG.feedUrl || "", preview: PREVIEW, store: LFH.store, fetchJson: fetchFeed })
    .catch((e) => ({ C: LFH.prepare(SNAPSHOT, ART).C, source: "snapshot", generated: "", held: {}, warnings: [], errors: [], note: "choosing content failed: " + ((e && e.message) || e), feed: null }))
    .then(start);

  function start(CONTENT) {
  const C = CONTENT.C;
  const M = LFH.load(C);
  let P = LFH.sanitizeProgress(LFH.store.load(), C, ART);
  const save = () => LFH.store.save(P);
  const rep = () => LFH.rep(P);
  const ITEMS = C.items || [], ITEM = {}; ITEMS.forEach((it) => (ITEM[it.id] = it));
  const caseById = (id) => M.cases.find((c) => c.id === id);
  const MENTOR = "Dr. Imani Brooks, your lab mentor";

  /* ---------------- State ---------------- */
  let S = { screen: P.labName ? "room" : "name" };
  const JOB_SCREENS = ["intro", "build", "question", "run"];
  /* Job templates: the same offer always rebuilds the same job, so keep one copy of each. */
  const INST = new Map();
  const CLASSIC = { n: 1, variant: "classic", seed: 1 };
  const instFor = (cid, off) => { const k = `${cid}|${off.n}|${off.variant}|${off.seed}`; if (!INST.has(k)) INST.set(k, LFH.instance(cid, off)); return INST.get(k); };
  const isTemplate = (cid) => !!LFH.TEMPLATES[cid];
  const listAnd = (a) => (a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")}${a.length > 2 ? "," : ""} and ${a[a.length - 1]}`);
  const go = (patch) => { S = Object.assign(S, patch); render(); window.scrollTo({ top: 0 }); };

  /* ---------------- Visual rendering ---------------- */
  const W = 640, H = 440, MG = { l: 80, r: 24, t: 52, b: 64 };
  const PW = W - MG.l - MG.r, PH = H - MG.t - MG.b;
  const COLORS = ["var(--pink)", "var(--sky)", "var(--violet)", "var(--amber)"];
  const DASH = ["", "7 4", "2 4", "10 3 2 3"];
  const SHAPES = ["circle", "square", "triangle", "diamond"];
  /* Line style per series: a control line is the only plain grey line with NO markers, so it never looks like a test result. */
  const lineStyles = (series) => { let k = 0; return series.map((s) => (s.control ? { c: "var(--ink-soft)", d: "", sh: null, r: 0 } : (k++, { c: COLORS[(k - 1) % 4], d: DASH[(k - 1) % 4], sh: SHAPES[(k - 1) % 4], r: 6 }))); };
  function marker(shape, x, y, color, r = 6) {
    const f = `fill="${color}" stroke="var(--paper)" stroke-width="1.5"`;
    if (shape === "square") return `<rect x="${x - r}" y="${y - r}" width="${2 * r}" height="${2 * r}" ${f}/>`;
    if (shape === "triangle") return `<polygon points="${x},${y - r - 1} ${x - r - 1},${y + r} ${x + r + 1},${y + r}" ${f}/>`;
    if (shape === "diamond") return `<polygon points="${x},${y - r - 2} ${x + r + 2},${y} ${x},${y + r + 2} ${x - r - 2},${y}" ${f}/>`;
    return `<circle cx="${x}" cy="${y}" r="${r}" ${f}/>`;
  }
  const axTitle = (a) => (a.unit ? `${a.label} (${a.unit})` : a.label);

  function svgVisual(spec, o = {}) {
    if (spec.type === "Data table") return tableHTML(spec, o);
    const bar = spec.type === "Bar graph";
    const X = spec.x, Y = spec.y;
    const px = (v) => MG.l + LFH.toUnit(X, v) * PW;
    const py = (v) => MG.t + (1 - LFH.toUnit(Y, v)) * PH;
    const parts = [];
    const clipId = "clip" + Math.random().toString(36).slice(2, 8);
    parts.push(`<defs><clipPath id="${clipId}"><rect x="${MG.l}" y="${MG.t}" width="${PW}" height="${PH}"/></clipPath>
      <marker id="${clipId}a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--ink)"/></marker></defs>`);
    parts.push(`<rect x="${MG.l}" y="${MG.t}" width="${PW}" height="${PH}" fill="var(--plot)"/>`);
    const phase = spec.type === "Phase diagram" ? phaseRegions(spec) : null;
    if (phase) parts.push(phase.fill);
    // grid
    const yt = LFH.ticks(Y);
    yt.minor.forEach((v) => parts.push(`<line x1="${MG.l}" x2="${MG.l + PW}" y1="${py(v)}" y2="${py(v)}" class="g-minor"/>`));
    yt.major.forEach((v) => {
      parts.push(`<line x1="${MG.l}" x2="${MG.l + PW}" y1="${py(v)}" y2="${py(v)}" class="g-major${LFH.isLog(Y) ? " g-decade" : ""}"/>`);
      parts.push(`<text x="${MG.l - 10}" y="${py(v) + 5}" text-anchor="end" class="tick">${U.fmt(v)}</text>`);
    });
    let cats = [];
    if (bar) {
      cats = spec.series.map((s) => s.name);
      const bw = PW / cats.length;
      cats.forEach((c, i) => parts.push(`<text x="${MG.l + bw * (i + 0.5)}" y="${MG.t + PH + 22}" text-anchor="middle" class="tick">${esc(c)}</text>`));
    } else {
      const xt = LFH.ticks(X);
      const every = xt.major.length > 14 ? 2 : 1;
      xt.major.forEach((v, i) => {
        parts.push(`<line y1="${MG.t}" y2="${MG.t + PH}" x1="${px(v)}" x2="${px(v)}" class="g-major"/>`);
        const lab = spec.xLabels ? spec.xLabels[v] : U.fmt(v);
        if (lab !== undefined && i % every === 0) parts.push(`<text x="${px(v)}" y="${MG.t + PH + 22}" text-anchor="middle" class="tick">${esc(lab)}</text>`);
      });
    }
    if (phase) parts.push(phase.labels);
    parts.push(`<rect x="${MG.l}" y="${MG.t}" width="${PW}" height="${PH}" class="frame"/>`);
    // titles
    parts.push(`<text x="${MG.l}" y="30" class="v-title">${esc(spec.title)}</text>`);
    parts.push(`<text x="${MG.l + PW / 2}" y="${H - 14}" text-anchor="middle" class="ax-title">${esc(axTitle(X))}</text>`);
    parts.push(`<text transform="translate(20 ${MG.t + PH / 2}) rotate(-90)" text-anchor="middle" class="ax-title">${esc(axTitle(Y))}</text>`);
    // data: g = clipped (lines), mk = unclipped (markers, labels) so edge points aren't cut in half
    const g = [], mk = [];
    if (bar) {
      const bw = PW / cats.length;
      spec.series.forEach((s, i) => { const v = s.points[0].y; g.push(`<rect x="${MG.l + bw * i + bw * 0.22}" y="${py(v)}" width="${bw * 0.56}" height="${MG.t + PH - py(v)}" class="bar"/>`); });
    } else if (spec.type === "Line graph") {
      const showLine = o.showLine !== false && !spec.noLine;
      const showPts = o.showPoints !== false;
      const st = lineStyles(spec.series);
      spec.series.forEach((s, si) => {
        const pts = s.points.slice().sort((a, b) => a.x - b.x), y = st[si];
        if (showLine) g.push(`<polyline points="${pts.map((p) => `${px(p.x)},${py(p.y)}`).join(" ")}" fill="none" stroke="${y.c}" stroke-width="${s.control ? 2.5 : 3}" stroke-dasharray="${y.d}" stroke-linejoin="round" class="${o.drawIn ? "draw-in" : ""}"/>`);
        if (showPts && y.sh) pts.forEach((p) => mk.push(marker(y.sh, px(p.x), py(p.y), y.c, y.r)));
        if (showPts) pts.filter((p) => p.label && p.label !== "★").forEach((p) => mk.push(`<text x="${px(p.x) + 9}" y="${py(p.y) - 9}" class="pt-label">${esc(p.label)}</text>`));
      });
    } else if (spec.type === "Phase diagram") {
      spec.series.forEach((s) => {
        const pts = s.points.slice().sort((a, b) => a.y - b.y);
        g.push(`<polyline points="${pts.map((p) => `${px(p.x)},${py(p.y)}`).join(" ")}" fill="none" class="boundary"/>`);
      });
      const seen = new Set();
      spec.series.flatMap((s) => s.points).filter((p) => p.label).forEach((p) => {
        const k = p.label + p.x + p.y; if (seen.has(k)) return; seen.add(k);
        mk.push(`<circle cx="${px(p.x)}" cy="${py(p.y)}" r="5" class="pt-dot"/><text x="${px(p.x) + 9}" y="${py(p.y) - 9}" class="pt-label">${esc(p.label)}</text>`);
      });
    }
    // build-mode placements
    (o.placed || []).forEach((p) => mk.push(marker("circle", px(p.x), py(p.y), "var(--pink)", 7)));
    if (o.ghost) mk.push(`<circle cx="${px(o.ghost.x)}" cy="${py(o.ghost.y)}" r="11" class="ghost"/>`);
    if (o.pending) g.push(`<g class="pending"><line x1="${px(o.pending.x)}" x2="${px(o.pending.x)}" y1="${MG.t}" y2="${MG.t + PH}"/><line y1="${py(o.pending.y)}" y2="${py(o.pending.y)}" x1="${MG.l}" x2="${MG.l + PW}"/><circle cx="${px(o.pending.x)}" cy="${py(o.pending.y)}" r="8"/></g>`);
    if (spec.arrow) g.push(`<line x1="${px(spec.arrow.from.x)}" y1="${py(spec.arrow.from.y)}" x2="${px(spec.arrow.to.x)}" y2="${py(spec.arrow.to.y)}" class="arrow" marker-end="url(#${clipId}a)"/>`);
    (spec.highlight || []).forEach((h) => mk.push(`<circle cx="${px(h.x)}" cy="${py(h.y)}" r="11" class="hl-ring"/><circle cx="${px(h.x)}" cy="${py(h.y)}" r="4" class="hl-dot"/>`));
    parts.push(`<g clip-path="url(#${clipId})">${g.join("")}</g>${mk.join("")}`);
    if (spec.highlight) parts.push(spec.highlight.map((h) => `<text x="${px(h.x) + 14}" y="${py(h.y) - 12}" class="hl-label">${esc(h.label)}</text>`).join(""));
    // legend (shapes + dashes, never color alone) on its own row above the plot
    const hasLegend = spec.type === "Line graph" && spec.series.length > 1;
    // legend wraps onto extra rows when the names don't fit on one line
    const legPos = []; let legRows = 0;
    if (hasLegend) { let lx = MG.l; legRows = 1; spec.series.forEach((s) => { const w = 34 + s.name.length * 7.4; if (lx + w > W - MG.r && lx > MG.l) { lx = MG.l; legRows++; } legPos.push({ x: lx, row: legRows - 1 }); lx += w; }); }
    const LEG = 28 * legRows;
    const title = parts.splice(parts.findIndex((x) => x.includes('class="v-title"')), 1)[0];
    const body = `<g transform="translate(0 ${LEG})">${parts.join("")}</g>`;
    parts.length = 0; parts.push(title, body);
    if (hasLegend) {
      const st = lineStyles(spec.series);
      const items = spec.series.map((s, si) => {
        const y = st[si], pos = legPos[si];
        return `<g transform="translate(${pos.x} ${58 + 28 * pos.row})"><line x1="0" x2="22" y1="-4" y2="-4" stroke="${y.c}" stroke-width="3" stroke-dasharray="${y.d}"/>${y.sh ? marker(y.sh, 11, -4, y.c, Math.min(5, y.r)) : ""}<text x="28" y="0" class="legend">${esc(s.name)}</text></g>`;
      });
      parts.push(`<g class="legend-row">${items.join("")}</g>`);
    }
    const cls = o.interactive ? "viz plot-target" : "viz";
    return `<svg class="${cls}" viewBox="0 0 ${W} ${H + LEG}" role="img" aria-label="${esc(spec.title)}">${parts.join("")}</svg>`;
  }

  const phaseCache = new Map();
  function phaseRegions(spec) {
    const key = spec.id ? spec.id : null;
    if (key && phaseCache.has(key)) return phaseCache.get(key);
    const m = LFH.phaseModel(spec), NX = 160, NY = 110;
    const cw = PW / NX, ch = PH / NY, grid = [];
    const rects = [];
    for (let j = 0; j < NY; j++) {
      const row = []; const P = LFH.fromUnit(spec.y, 1 - (j + 0.5) / NY);
      let runStart = 0, cur = null;
      for (let i = 0; i <= NX; i++) {
        const st = i < NX ? m.state(LFH.fromUnit(spec.x, (i + 0.5) / NX), P) : null;
        if (i < NX) row.push(st);
        if (st !== cur) {
          if (cur) rects.push(`<rect x="${(MG.l + runStart * cw).toFixed(2)}" y="${(MG.t + j * ch).toFixed(2)}" width="${((i - runStart) * cw + 0.6).toFixed(2)}" height="${(ch + 0.6).toFixed(2)}" class="r-${cur}"/>`);
          cur = st; runStart = i;
        }
      }
      grid.push(row);
    }
    // label each region at its most "inside" cell (coarse distance search)
    const labels = [];
    ["solid", "liquid", "gas"].forEach((st) => {
      let best = null, bestD = -1;
      for (let j = 4; j < NY - 4; j += 3) for (let i = 4; i < NX - 4; i += 3) {
        if (grid[j][i] !== st) continue;
        let d = 99;
        for (let r = 1; r < 40 && d === 99; r++) {
          for (const [di, dj] of [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r], [r, -r], [-r, r]]) {
            const a = i + di, b = j + dj;
            if (a < 0 || b < 0 || a >= NX || b >= NY || grid[b][a] !== st) { d = r; break; }
          }
        }
        if (d > bestD) { bestD = d; best = [i, j]; }
      }
      if (best && bestD >= 3) labels.push(`<text x="${MG.l + (best[0] + 0.5) * cw}" y="${MG.t + (best[1] + 0.5) * ch + 7}" text-anchor="middle" class="region-label">${st[0].toUpperCase() + st.slice(1)}</text>`);
    });
    const out = { fill: `<g>${rects.join("")}</g>`, labels: `<g>${labels.join("")}</g>` };
    if (key) phaseCache.set(key, out);
    return out;
  }

  function tableHTML(spec, o = {}) {
    const t = spec.table;
    return `<div class="table-wrap"><table class="datatable"><caption>${esc(spec.title)}</caption>
      <thead><tr>${t.headers.map((h) => `<th scope="col">${esc(h)}</th>`).join("")}</tr></thead>
      <tbody>${t.rows.map((r, i) => `<tr class="${o.rowHighlight === i ? "row-now" : ""}${o.rowDone && o.rowDone(i) ? " row-done" : ""}">${r.map((c, k) => (k === 0 ? `<th scope="row">${esc(c)}</th>` : `<td>${esc(c)}</td>`)).join("")}</tr>`).join("")}</tbody></table></div>`;
  }

  function visualPanel(vids, activeIdx, extra = "") {
    const tabs = vids.length > 1 ? `<div class="tabs" role="tablist">${vids.map((v, i) => `<button role="tab" aria-selected="${i === activeIdx}" class="tab" data-tab="${i}">${esc(M.visuals[v].label)}</button>`).join("")}<span class="tab-note">This question uses ${vids.length} visuals</span></div>` : "";
    return `${tabs}<div class="paper">${svgVisual(M.visuals[vids[activeIdx]])}${extra}</div>`;
  }

  /* ---------------- Shared pieces ---------------- */
  function topbar() {
    const r = rep(), k = LFH.rankOf(r), n = LFH.nextRank(r);
    const pct = n ? Math.round(((r - k.at) / (n.at - k.at)) * 100) : 100;
    const unread = inbox().filter((m) => !P.inbox.read[m.id]).length;
    return `<header class="topbar"><button class="wordmark" data-act="room" aria-label="Back to my lab">${esc(P.labName || "Lab for Hire")}</button>
      <div class="hud"><span class="funds" aria-label="Funds">$${P.funds}</span>
      <span class="rank"><span class="rank-name">${esc(k.name)}</span><span class="meter" role="img" aria-label="${r} reputation${n ? `, ${n.at - r} to ${n.name}` : ""}"><span style="width:${pct}%"></span></span></span>
      <button class="inbox-btn" data-act="inbox" aria-label="Inbox${unread ? `, ${unread} new` : ""}">✉️${unread ? `<span class="badge-n">${unread}</span>` : ""}</button></div></header>`;
  }
  function optionButtons(opts, order, sel, lock, reveal) {
    return `<div class="options" role="group">${order.map((L) => {
      const o = opts.find((x) => x.letter === L);
      const picked = sel.includes(L);
      let st = "";
      if (reveal) st = o.correct ? " is-right" : picked ? " is-wrong" : "";
      return `<button class="opt${picked ? " picked" : ""}${st}" data-opt="${L}" aria-pressed="${picked}" ${lock ? "disabled" : ""}><span class="box" aria-hidden="true"></span><span>${esc(o.text)}</span></button>`;
    }).join("")}</div>`;
  }
  function instruction(type, n) {
    const r = LFH.required(type);
    if (r.exact === 1) return "Choose one answer.";
    if (r.exact) return `Pick exactly ${r.exact === 2 ? "two" : "three"}. <span class="count">${n} of ${r.exact} picked</span>`;
    return "Select all that apply.";
  }
  const canSubmit = (type, n) => { const r = LFH.required(type); return r.exact ? n === r.exact : n >= 1; };
  function toggle(type, sel, L) {
    const r = LFH.required(type);
    if (r.exact === 1) return [L];
    if (sel.includes(L)) return sel.filter((x) => x !== L);
    if (r.exact && sel.length >= r.exact) return sel;
    return sel.concat(L);
  }

  /* ---------------- Naming the lab (word builder: no free text, no PII) ---------------- */
  const ADJ = ["Curious", "Fearless", "Glowing", "Mighty", "Clever", "Bubbling", "Electric", "Midnight"];
  const NOUN = ["Comet", "Beaker", "Atom", "Falcon", "Fossil", "Nebula", "Spark", "Tesla"];
  function nameScreen() {
    S.nameAdj = S.nameAdj || U.pick(ADJ); S.nameNoun = S.nameNoun || U.pick(NOUN);
    const chips = (list, cur, kind) => list.map((w) => `<button class="chip-btn${w === cur ? " strong" : ""}" data-name-${kind}="${w}">${w}</button>`).join("");
    return `<main class="intro"><div class="ticket"><p class="ticket-kicker">${P.labName ? "Rename your lab" : "Welcome, scientist"}</p>
      <h1>Name your lab</h1><p class="pitch">Clients will email your lab with jobs. Pick a name they'll remember.</p>
      <p class="small">Pick a word:</p><div class="chips">${chips(ADJ, S.nameAdj, "adj")}</div>
      <p class="small" style="margin-top:12px">Pick another:</p><div class="chips">${chips(NOUN, S.nameNoun, "noun")}</div>
      <p class="lab-name-preview">The ${esc(S.nameAdj)} ${esc(S.nameNoun)} Lab</p>
      <div class="row"><button class="btn primary" data-act="nameDone">${P.labName ? "Save the name" : "Open my lab"}</button>${P.labName ? '<button class="btn ghost" data-act="ledger">Cancel</button>' : ""}</div>
      ${P.labName ? "" : `<p class="small load-line">Already have a lab from another iPad? <button class="linkish" data-act="loadFile">Load my lab from a backup file</button></p>${S.toast ? `<div class="toast inline" role="status">${esc(S.toast)}</div>` : ""}${loadInput()}`}</div></main>`;
  }

  /* ---------------- The room (home screen) and the store: drawn by LabRoom (src/lab.js); the rules are LFH.lab ---------------- */
  const rankIdx = () => LFH.RANKS.indexOf(LFH.rankOf(rep()));
  let labRoom = null;
  function mountLab() {            // called after every render: the room lives in a placeholder the screen leaves for it
    if (labRoom) { labRoom.destroy(); labRoom = null; }
    const host = document.getElementById("labroom");
    if (!host) return;
    const store = S.screen === "shop";
    labRoom = LabRoom.mount(host, { state: P.lab, funds: P.funds, items: ITEMS, manifest: ART.manifest, sprites: ART.sprites, rank: rankIdx(), readOnly: !store,
      onTap: (itemId) => { const it = ITEM[itemId]; if (itemId === "laptop") go({ screen: "laptop", app: S.app || "inbox", toast: null }); else if (it && ["bench", "bench-item", "chair"].includes(it.slot)) goBench(); },   // the desk, the chair at it, or anything on it
      onChange: (lab, funds) => {  // the ONE place a purchase or a move is recorded
        P.lab = lab; P.funds = funds; save();
        const f = document.querySelector(".topbar .funds"); if (f) f.textContent = "$" + P.funds;
      } });
  }
  const PET_SAYS = { "pet-cat": "Purr-fect work!", "pet-dog": "Woof! Great job!", "pet-bunny": "Hop hop hooray!" };
  function roomScreen() {
    const unread = inbox().filter((m) => !P.inbox.read[m.id]).length;
    const job = P.activeJob && caseById(P.activeJob.caseId);
    const placed = (P.lab.rooms.main || {}).placed || {}, pet = ITEM[placed.pet];
    const toast = S.celebrate ? `<div class="toast" role="status">Job complete! +$${S.celebrate} for the lab.${pet ? ` ${esc(pet.name)} says: ${PET_SAYS[pet.sprite] || "Nice work!"}` : ""}</div>` : S.toast ? `<div class="toast" role="status">${esc(S.toast)}</div>` : "";
    S.celebrate = null;
    return `${topbar()}<main class="roomwrap">${toast}
      <div class="room-stage"><div id="labroom" class="room"></div></div>
      <div class="room-actions">
        <button class="btn big" data-act="laptop">💻 Laptop${unread ? ` <span class="badge-n inline">${unread}</span>` : ""}</button>
        <button class="btn big" data-act="bench">🧪 Workbench${job ? `: resume ${esc(job.title)}` : ""}</button>
        <button class="btn big ghost" data-act="decorate">🛒 Store and decorate</button></div>
      <p class="small center">${unread ? `You have ${unread} new email${unread > 1 ? "s" : ""} on the laptop.` : job ? "A job is waiting on your workbench." : "Check the laptop for new jobs."} Tip: tap the laptop or the bench in your lab.</p></main>`;
  }
  function shopScreen() {
    return `${topbar()}<main class="shopwrap"><div class="shop-bar"><h1>Store and decorate</h1><button class="btn primary" data-act="room">Done</button></div>
      <p class="small">Tap a spot in your lab to see what fits there, or browse the store. Try things before you buy. Anything you take out waits in Storage.</p>
      <div id="labroom"></div></main>`;
  }

  /* ---------------- Inbox: built from the Sheet's cases + this student's history ---------------- */
  function inbox() {
    const out = [{ id: "welcome", from: MENTOR, subject: `Welcome to ${P.labName || "your lab"}!`, kind: "welcome" }];
    LFH.jobs(M, P, PREVIEW).forEach((j) => out.push({ id: "job-" + j.c.id, from: j.c.client, subject: (j.state === "teaser" || j.state === "soon" ? "🔒 " : "") + "Job: " + j.c.title, kind: "job", job: j }));
    P.history.forEach((h, n) => { const c = caseById(h.caseId); if (c) out.push({ id: `reply-${h.caseId}-${n}`, from: c.client, subject: `Re: ${h.tmpl ? h.tmpl.title : c.title}, payment enclosed`, kind: "reply", h, c }); });
    Object.entries(P.offers || {}).forEach(([cid, off]) => { const c = caseById(cid); if (c && isTemplate(cid)) out.push({ id: `offer-${cid}-${off.n}`, from: c.client, subject: `Job: ${instFor(cid, off).title}`, kind: "offer", c, off }); });
    let changed = false;
    out.forEach((m) => { if (!P.inbox.arrived[m.id]) { P.inbox.arrived[m.id] = ++P.inbox.seq; changed = true; } });
    if (changed) save();
    const ad = (m) => m.kind === "job" && (m.job.state === "teaser" || m.job.state === "soon");   // teasers are ads: always below real mail
    return out.sort((a, b) => (ad(a) - ad(b)) || (P.inbox.arrived[b.id] - P.inbox.arrived[a.id]));
  }
  function mailBody(m) {
    if (m.kind === "welcome") return `<p>Welcome to ${esc(P.labName)}! I'm Dr. Brooks, and I'll be checking in on your work.</p>
      <p>Here's how a lab for hire works. Clients email you jobs. Accept one, then do the science at your <strong>workbench</strong>: build graphs, read the data, and make a recommendation the client can trust.</p>
      <p>Good evidence earns more money. Spend it in the <strong>Supply shop</strong>. Some equipment unlocks brand-new kinds of jobs, and some just makes the lab yours.</p>
      <p>Stuck on a graph or a science idea? I'll send you on a quick side mission to Calibration Bay or the Archive. Getting help never costs you anything.</p><p>Your first job is already in the inbox. Good luck!</p>`;
    if (m.kind === "offer") {
      const i = instFor(m.c.id, m.off), who = m.c.client.split(",")[0];
      const busy = P.activeJob && P.activeJob.caseId === m.c.id && P.activeJob.offer && P.activeJob.offer.n === m.off.n;
      return `<p>${esc(i.story)}</p>${rulesCard(i, m.c.client)}<p class="pay-line">Pays up to <strong>$${m.c.pay}</strong>. New data pays full price.</p>
        <div class="row">${busy ? `<button class="btn primary" data-act="bench">Back to the bench</button>` : `<button class="btn primary" data-offer="${m.c.id}">Accept the job</button>`}</div>${m.off.kind === "followup" ? `<p class="small">${esc(who)} is sending a fresh batch of substances, so this is brand-new data.</p>` : ""}`;
    }
    if (m.kind === "reply" && m.h.tmpl) {
      const t = m.h.tmpl, who = m.c.client.split(",")[0];
      const msg = t.strong ? (t.n === 1 ? m.c.win : `Thank you! We went with ${t.claim}: it meets every rule and saves us money. Your evidence made the decision easy.`)
        : `Thanks for the report. We weren't convinced by the recommendation, so we're paying part of the fee. A fresh batch of substances is on its way: look for my follow-up job in your inbox.`;
      return `<p>${esc(msg)}</p><p class="small">— ${esc(who)}</p><p class="pay-line">Payment: <strong>$${m.h.pay}</strong>${m.h.missions ? ` · includes $${5 * m.h.missions} for finishing ${m.h.missions} side mission${m.h.missions > 1 ? "s" : ""}` : ""}</p><p class="small">${"★".repeat(m.h.stars)}${"☆".repeat(3 - m.h.stars)} for this job</p>`;
    }
    if (m.kind === "reply") {
      const st = m.h.stars;
      const msg = st === 3 ? m.c.win : st === 2 ? `${m.c.win} A couple of parts of your report needed a second look, but we're happy overall.` : `Thanks for the report. We had to double-check a lot of it ourselves, so we're paying part of the fee. Take another look sometime: we'd hire you again.`;
      return `<p>${esc(msg)}</p><p class="pay-line">Payment: <strong>$${m.h.pay}</strong>${m.h.replay ? " (repeat job)" : ""}${m.h.missions ? ` · includes $${5 * m.h.missions} for finishing ${m.h.missions} side mission${m.h.missions > 1 ? "s" : ""}` : ""}</p><p class="small">${"★".repeat(st)}${"☆".repeat(3 - st)} for this job</p>`;
    }
    const j = m.job, c = j.c, need = j.needs && ITEM[j.needs];
    let act = "";
    if (j.state === "open") act = `<button class="btn primary" data-accept="${c.id}">Accept the job</button>`;
    if (j.state === "done") act = isTemplate(c.id) ? `<p class="small">Done! ${esc(c.client.split(",")[0])} will keep emailing new jobs.</p>` : `<button class="btn" data-accept="${c.id}">Take it again (repeat jobs pay 25%)</button>`;
    if (j.state === "locked") act = `<p class="needs">🔒 You'll need a <strong>${esc(need.name)}</strong> ($${need.price}) to take this job.</p><button class="btn" data-act="decorate">Go to the store</button>`;
    if (j.state === "teaser") act = `<p class="needs">🔒 This job needs a <strong>${esc(need ? need.name : c.requires)}</strong>${need ? ` ($${need.price} in the store)` : ""}.</p><p class="small">Coming later this year (${esc(c.standard)}).</p>`;
    if (j.state === "soon") act = `<p class="needs">You have the equipment! Your teacher is still preparing this job. Check back soon.</p>`;
    const pay = c.pay ? `<p class="pay-line">Pays up to <strong>$${c.pay}</strong></p>` : "";
    const rules = isTemplate(c.id) && j.state === "open" ? rulesCard(instFor(c.id, CLASSIC), c.client) : "";
    return `<p>${esc(c.pitch)}</p>${rules}${pay}<div class="row">${act}</div>`;
  }
  function inboxApp() {
    const list = inbox();
    if (!S.mail && !P.inbox.read.welcome) S.mail = "welcome";          // first visit: the mentor's welcome opens itself
    const open = list.find((m) => m.id === S.mail) || null;
    if (open && !P.inbox.read[open.id]) { P.inbox.read[open.id] = true; save(); }
    const items = list.map((m) => {
      const unread = !P.inbox.read[m.id];
      const tag = m.kind === "job" ? { open: "New job", done: "Done", locked: "Needs gear", teaser: "Locked", soon: "Coming soon" }[m.job.state] : m.kind === "offer" ? "New job" : m.kind === "reply" ? `+$${m.h.pay}` : "";
      return `<li><button class="mail${unread ? " unread" : ""}${open && open.id === m.id ? " current" : ""}" data-mail="${m.id}"><span class="mail-from">${esc(m.from)}</span><span class="mail-subj">${esc(m.subject)}</span>${tag ? `<span class="mail-tag t-${m.kind === "job" ? m.job.state : m.kind === "offer" ? "open" : m.kind}">${esc(tag)}</span>` : ""}</button></li>`;
    }).join("");
    const view = open ? `<article class="mail-view"><button class="linkish mail-back" data-act="mailBack">← All mail</button><p class="small">From: ${esc(open.from)}</p><h3>${esc(open.subject)}</h3>${mailBody(open)}</article>` : `<div class="mail-empty"><p>Pick an email to read it.</p></div>`;
    return `<div class="inbox${open ? " has-open" : ""}"><ul class="mail-list">${items}</ul>${view}</div>`;
  }

  /* ---------------- Supply shop ---------------- */
  /* ---------------- Training sim (free practice) and ledger ---------------- */
  function simApp() {
    const drills = Object.entries(LFH.drillNames).map(([id, name]) => `<button class="chip-btn" data-bay="${id}">${esc(name)}</button>`).join("");
    return `<div class="sim"><h3>Training sim</h3><p>Practice any graph skill on brand-new data, as many times as you like. Practice is always free, and every correct answer adds to your reputation.</p>
      <div class="chips"><button class="chip-btn strong" data-bay="mixed">Mixed practice</button>${drills}</div>${P.bayBest ? `<p class="small">Best streak: ${P.bayBest}</p>` : ""}</div>`;
  }
  function previewBanner() {
    const SRC = { live: "the live Sheet", cache: "the last good copy saved on this device", snapshot: "the content built into this page" };
    const list = (arr, n) => `<ul>${arr.slice(0, n).map((x) => `<li>${esc(x)}</li>`).join("")}${arr.length > n ? `<li>…and ${arr.length - n} more</li>` : ""}</ul>`;
    const held = (h) => Object.keys(h).map((id) => `<li><strong>${esc(id)}</strong>: ${esc(h[id][0])}${h[id].length > 1 ? ` (+${h[id].length - 1} more)` : ""}</li>`).join("");
    const when = CONTENT.generated && CONTENT.source !== "snapshot" ? ` (read ${new Date(CONTENT.generated).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })})` : "";
    const f = CONTENT.source !== "live" && CONTENT.feed ? CONTENT.feed : null;
    let html = `<strong>Teacher preview.</strong> Every job is released, and drafts are visible.<p>Content: <strong>${SRC[CONTENT.source]}</strong>${when}.${CONFIG.feedUrl ? "" : " No live Sheet is connected to this page yet."}${CONTENT.note && !f ? ` Using this because ${esc(CONTENT.note)}.` : ""}</p>`;
    if (f) html += `<details open><summary>The live Sheet was NOT used${f.why ? `: ${esc(f.why)}` : ""}</summary>${f.errors.length ? list(f.errors, 8) : ""}${Object.keys(f.held).length ? `<p>Held back:</p><ul>${held(f.held)}</ul>` : ""}${f.warnings.length ? `<p>Notes:</p>${list(f.warnings, 8)}` : ""}</details>`;
    if (Object.keys(CONTENT.held).length) html += `<details open><summary>${Object.keys(CONTENT.held).length} job(s) held back from students</summary><ul>${held(CONTENT.held)}</ul></details>`;
    if (CONTENT.warnings.length) html += `<details><summary>${CONTENT.warnings.length} note(s) about the content</summary>${list(CONTENT.warnings, 12)}</details>`;
    if (!f && !Object.keys(CONTENT.held).length && !CONTENT.warnings.length) html += "<p>Content check: no problems found.</p>";
    return `<div class="preview-banner">${html}</div>`;
  }
  /* ---------------- Save file (backup to Google Drive, restore on any device) ---------------- */
  const loadInput = () => `<input type="file" id="load-input" class="visually-hidden" accept=".json,application/json,text/plain" tabindex="-1" aria-hidden="true">`;
  function saveFileName() {
    const slug = (P.labName || "my-lab").replace(/^The /, "").replace(/ Lab$/, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return `${slug || "My"}-lab-backup-${new Date().toISOString().slice(0, 10)}.json`;
  }
  function saveToFile() {
    const now = new Date().toISOString();
    const text = LFH.exportSave(P, now), name = saveFileName();
    const done = () => { P.backedUpAt = now; save(); go({ toast: "Backup saved. Keep it in your Google Drive." }); };
    const blob = new Blob([text], { type: "application/json" });
    let file = null; try { file = new File([blob], name, { type: "application/json" }); } catch (e) { file = null; }
    // iPad: the share sheet offers "Save to Files" (pick Google Drive) or the Drive app directly. Must run inside the tap.
    if (file && navigator.canShare && navigator.share && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: P.labName }).then(done).catch((e) => { if (!e || e.name !== "AbortError") download(blob, name, done); });
      return;
    }
    download(blob, name, done);
  }
  function download(blob, name, done) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 10000); done();
  }
  function loadFromText(text) {
    const r = LFH.importSave(text);
    if (!r.ok) return go({ toast: r.error });
    const s = LFH.saveSummary(r.progress), when = r.savedAt ? new Date(r.savedAt).toLocaleDateString() : "an unknown date";
    const msg = `Load ${s.lab}? It has $${s.funds} and ${s.jobs} job${s.jobs === 1 ? "" : "s"} done (backed up ${when}).` +
      (LFH.hasProgress(P) ? `\n\nThis REPLACES the lab on this iPad (${P.labName || "unnamed"}, $${P.funds}).` : "");
    if (!confirm(msg)) return;
    P = LFH.sanitizeProgress(r.progress, C, ART); save(); S = { screen: "room", toast: null }; render();
  }
  function ledgerApp() {
    const r = rep(), k = LFH.rankOf(r), n = LFH.nextRank(r);
    const rows = M.cases.filter((c) => P.cases[c.id] && P.cases[c.id].done).map((c) => {
      const pc = P.cases[c.id], paid = P.history.filter((h) => h.caseId === c.id).reduce((a, h) => a + h.pay, 0);
      return `<tr><th scope="row">${esc(c.title)}</th><td>${"★".repeat(pc.stars || 0)}${"☆".repeat(3 - (pc.stars || 0))}</td><td>$${paid}</td></tr>`;
    }).join("");
    return `<div class="ledger"><div class="ledger-stats"><div><p class="small">Funds</p><p class="big-num">$${P.funds}</p></div><div><p class="small">Reputation</p><p class="big-num">${r}</p></div><div><p class="small">Rank</p><p class="big-num">${esc(k.name)}</p>${n ? `<p class="small">${n.at - r} more to ${esc(n.name)}</p>` : ""}</div></div>
      <h3>Jobs completed</h3>${rows ? `<div class="table-wrap"><table class="datatable"><thead><tr><th>Job</th><th>Best</th><th>Earned</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<p class="small">No jobs yet. Check your inbox!</p>`}
      <div class="backup"><h3>Back up your lab</h3><p>Save a backup file to your Google Drive. If this iPad gets wiped or swapped, load the file to get your lab back, exactly as you left it.</p>
      <p class="small">Last backup: <strong>${LFH.backupAge(P, Date.now())}</strong></p>${S.toast ? `<div class="toast inline" role="status">${esc(S.toast)}</div>` : ""}
      <div class="row"><button class="btn primary" data-act="saveFile">💾 Save my lab</button><button class="btn ghost" data-act="loadFile">📂 Load my lab</button></div>${loadInput()}</div>
      <div class="row"><button class="btn ghost" data-act="rename">Rename my lab</button><button class="linkish" data-act="reset">Reset my lab</button>${PREVIEW ? `<button class="btn" data-act="addFunds">Teacher preview: +$100</button>` : ""}</div>
      ${PREVIEW ? previewBanner() : ""}</div>`;
  }
  function laptopScreen() {
    const app = S.app || "inbox";
    const unread = inbox().filter((m) => !P.inbox.read[m.id]).length;
    const tab = (id, label) => `<button class="lt-app${app === id ? " on" : ""}" data-app="${id}">${label}${id === "inbox" && unread ? ` <span class="badge-n inline">${unread}</span>` : ""}</button>`;
    const body = app === "inbox" ? inboxApp() : app === "sim" ? simApp() : ledgerApp();
    return `${topbar()}<main class="laptopwrap"><div class="laptop"><div class="lt-bar"><span>${esc(P.labName)} · Lab OS</span><button class="btn small-btn ghost" data-act="room">Close the laptop</button></div>
      <div class="lt-body"><nav class="lt-apps" aria-label="Laptop apps">${tab("inbox", "✉️ Inbox")}<button class="lt-app" data-act="decorate">🛒 Supply store</button>${tab("sim", "🎯 Training sim")}${tab("ledger", "📒 Ledger")}</nav><section class="lt-main">${body}</section></div></div></main>`;
  }
  function benchEmpty() {
    return `${topbar()}<main class="intro"><div class="ticket"><p class="ticket-kicker">Workbench</p><h1>Your bench is clear</h1>
      <p class="pitch">Jobs start in your inbox. Accept one, and the client's data will be waiting here.</p>
      <div class="row"><button class="btn primary" data-act="inbox">Open the inbox</button><button class="btn ghost" data-act="room">Back to the lab</button></div></div></main>`;
  }

  /* ---------------- Case flow ---------------- */
  function startCase(id, snap, offer) {
    let c = M.cases.find((x) => x.id === id);
    let vids = M.visualsByCase[id] || [];
    let buildV = vids.find((v) => M.visuals[v].build);
    let qs = M.main[id] || [], inst = null, off = null;
    if (isTemplate(id)) {   // generated job: register its visuals and options like ordinary content
      off = (snap && snap.offer) || offer || CLASSIC;
      inst = instFor(id, off);
      Object.assign(M.visuals, inst.visuals); inst.qs.forEach((q) => (M.options[q.id] = q.options));
      vids = inst.vids; buildV = null; qs = inst.qs;
      c = Object.assign({}, c, { title: inst.story ? inst.title : c.title, pitch: inst.story || c.pitch });
    }
    const order = {}; qs.forEach((q) => (order[q.id] = U.shuffle((M.options[q.id] || []).map((o) => o.letter))));
    const replay = !inst && !!(P.cases[id] && P.cases[id].done);   // template jobs bring new data: never a replay
    const base = { screen: "intro", caseId: id, caseObj: c, vids, qs, inst, offer: off, qi: 0, order, rec: {}, sel: [], fb: null, tab: 0, visited: [], usedChecks: new Set(), replay,
      build: buildV ? { vid: buildV, step: "axis", i: 0, placed: [], pending: null, tries: 0, fb: null, missioned: {}, scaleOrder: U.shuffle(LFH.buildScaleOptions(M.visuals[buildV])), axisOrder: U.shuffle(LFH.buildAxisOptions(M.visuals[buildV])) } : null, certified: !buildV };
    if (snap) {   // resume where the student left off, if the job still makes sense after any content edits
      const safe = LFH.reconcileJob(M, snap, inst ? qs : null);
      if (safe) {
        const certified = base.build ? !!safe.certified : true;
        Object.assign(base, { screen: ["intro", "run"].includes(safe.screen) ? safe.screen : certified ? "question" : "build", qi: safe.qi, order: safe.order, rec: safe.rec, visited: safe.visited, certified, replay: safe.replay });
        if (base.build && safe.build) {
          const b = safe.build, spec = M.visuals[buildV], n = spec.series[0].points.length;
          const opts = { scaleOrder: LFH.buildScaleOptions(spec), axisOrder: LFH.buildAxisOptions(spec) };
          const pick = (texts, list) => { const got = (texts || []).map((t) => list.find((o) => o.text === t)); return got.length === list.length && got.every(Boolean) ? got : null; };
          const i = Math.min(b.i | 0, n);
          Object.assign(base.build, { step: b.step === "done" ? "talk" : b.step, i, placed: (b.placed || []).slice(0, i), missioned: b.missioned || {},
            scaleOrder: pick(b.scaleTexts, opts.scaleOrder) || base.build.scaleOrder, axisOrder: pick(b.axisTexts, opts.axisOrder) || base.build.axisOrder });
          if (base.build.step === "plot" && i >= n) base.build.step = "talk";
        }
      }
    }
    go(base);
  }
  function autosaveJob() {
    const b = S.build;
    P.activeJob = { caseId: S.caseId, offer: S.offer || null, screen: S.screen, qi: S.qi, order: S.order, rec: S.rec, visited: S.visited, certified: S.certified, replay: S.replay,
      build: b ? { step: b.step, i: b.i, placed: b.placed, missioned: b.missioned, scaleTexts: b.scaleOrder.map((o) => o.text), axisTexts: b.axisOrder.map((o) => o.text) } : null };
    save();
  }
  function goBench() {
    if (S.caseId && JOB_SCREENS.includes(S.screen)) return;
    const j = P.activeJob;
    if (j && caseById(j.caseId)) return startCase(j.caseId, j, j.offer || null);
    go({ screen: "bench" });
  }
  function rulesCard(inst, client) {
    return `<div class="rules-card"><p class="brief-label">${esc((client || "The client").split(",")[0])}'s rules</p><ul>${inst.rules.map((r) => `<li>${esc(r)}</li>`).join("")}</ul></div>`;
  }
  function intro() {
    const c = S.caseObj;
    if (S.inst) return `${topbar()}<main class="intro"><div class="ticket"><p class="ticket-kicker">Workbench · job brief${S.offer && S.offer.n > 1 ? ` · ${esc(c.client.split(",")[0])} is back` : ""}</p><h1>${esc(c.title)}</h1><p class="client big">${esc(c.client)}</p><p class="pitch">${esc(c.pitch)}</p>
      ${rulesCard(S.inst, c.client)}<p class="small">Four steps: <strong>plan</strong> a fair test, <strong>run</strong> it, <strong>analyze</strong> the data, then make your <strong>recommendation</strong>. There's no timer, and your progress saves as you go.</p>
      <p class="pay-line">Pays up to <strong>$${c.pay}</strong></p>
      <div class="row"><button class="btn primary" data-act="begin">Start the job</button><button class="btn ghost" data-act="room">Back to the lab</button></div></div></main>`;
    const steps = S.build ? "First you'll build the graph from the data table. Then you'll use it to answer the client's questions." : `You'll answer ${S.qs.length} questions using the client's data.`;
    return `${topbar()}<main class="intro"><div class="ticket"><p class="ticket-kicker">Workbench · job brief</p><h1>${esc(c.title)}</h1><p class="client big">${esc(c.client)}</p><p class="pitch">${esc(c.pitch)}</p><p class="small">${esc(steps)} Take your time. There's no timer, and your progress saves as you go.</p>
      ${S.replay ? `<p class="small">You've done this job before. Repeat jobs pay 25%.</p>` : `<p class="pay-line">Pays up to <strong>$${c.pay}</strong></p>`}
      <div class="row"><button class="btn primary" data-act="begin">Start the job</button><button class="btn ghost" data-act="room">Back to the lab</button></div></div></main>`;
  }
  function caseHeader() {
    const n = S.qs.length;
    const dots = S.qs.map((q, i) => { const r = S.rec[q.id]; return `<span class="dot${i === S.qi && S.screen === "question" ? " now" : ""}${r && r.points ? " did" : ""}"></span>`; }).join("");
    return `<div class="casebar"><div><h2>${esc(S.caseObj.title)}</h2><p class="client">${esc(S.caseObj.client)}</p>
      ${S.screen === "build" && ["axis", "scale"].includes(S.build.step) ? "" : `<details class="brief-toggle"><summary>Case brief</summary><p>${esc(S.caseObj.pitch)}</p>${S.inst ? `<ul>${S.inst.rules.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}</details>`}</div>
      <div class="progress" aria-label="Question ${Math.min(S.qi + 1, n)} of ${n}">${S.certified ? dots : '<span class="build-tag">Building the graph</span>'}</div>
      <button class="btn ghost small-btn" data-act="room">Pause and go to the lab</button></div>`;
  }

  /* ---------------- Build mode ---------------- */
  function buildScreen() {
    const b = S.build, spec = M.visuals[b.vid];
    const pts = spec.series[0].points;
    const tableSpec = { type: "Data table", title: "The client's data", table: { headers: [axTitle(spec.x), axTitle(spec.y)], rows: pts.map((p) => [U.fmt(p.x), U.fmt(p.y)]) } };
    let left, right;
    const blankSpec = Object.assign({}, spec, { series: [{ name: spec.series[0].name, points: [] }] });
    if (b.step === "axis" || b.step === "scale") {
      left = `<div class="paper">${tableHTML(tableSpec)}<div class="blank-grid" aria-hidden="true"></div></div>`;
      const opts = b.step === "axis" ? b.axisOrder : b.scaleOrder;
      const title = b.step === "axis" ? "Step 1: Label the axes" : "Step 2: Choose a scale";
      const q = b.step === "axis" ? `Which variable belongs on the x-axis (along the bottom)?` : `The x-axis is set: ${U.fmt(spec.x.min)} to ${U.fmt(spec.x.max)} ${spec.x.unit}, counting by ${U.fmt(spec.x.step)}s. Now choose the y-axis scale for ${spec.y.label.toLowerCase()}.`;
      const revealed = b.fb && b.fb.kind === "reveal";
      right = `<div class="brief"><p class="brief-label">Case brief</p><p>${esc(S.caseObj.pitch)}</p></div>
        <p class="step-name">${title}</p><h3 class="prompt">${esc(q)}</h3>${remember(b.hint)}
        <div class="options">${opts.map((o, i) => `<button class="opt${revealed && o.correct ? " is-right" : ""}" data-bopt="${i}" ${missionWaiting() || revealed ? "disabled" : ""}><span class="box" aria-hidden="true"></span><span>${esc(o.text)}</span></button>`).join("")}</div>${buildFeedback()}`;
    } else if (b.step === "plot") {
      const t = pts[b.i];
      left = `<div class="paper">${svgVisual(blankSpec, { placed: b.placed, pending: b.pending, ghost: b.ghost, interactive: true, showLine: false })}</div><p class="hint">Tap the graph to place the point. Fine-tune with the arrow keys, then press Place point.</p>`;
      right = `<p class="step-name">Step 3: Plot each data point</p><h3 class="prompt">Point ${b.i + 1} of ${pts.length}: ${esc(U.withUnit(t.x, spec.x.unit))}, ${esc(U.withUnit(t.y, spec.y.unit))}</h3>
        <p class="small">${esc(spec.x.label)} tells you where to move across. ${esc(spec.y.label)} tells you where to move up.</p>${remember(b.hint)}
        ${tableHTML(tableSpec, { rowHighlight: b.i, rowDone: (i) => i < b.i })}
        <div class="row"><button class="btn primary" data-act="place" ${b.pending && !missionWaiting() ? "" : "disabled"}>Place point</button></div>${buildFeedback()}`;
    } else if (b.step === "talk") {
      left = `<div class="paper">${svgVisual(spec, { showLine: false })}</div>`;
      const titles = b.titleOrder || (b.titleOrder = U.shuffle([spec.title, spec.series[0].name, "My Graph"]));
      const got = b.titleOk;
      right = `<p class="step-name">Step 4: TALK check</p><h3 class="prompt">Every good graph passes TALK before it's certified.</h3>
        <ul class="talk"><li class="${got ? "ok" : ""}"><strong>T</strong>itle: ${got ? esc(spec.title) : "pick one below"}</li>
        <li class="ok"><strong>A</strong>ll the data: ${pts.length} of ${pts.length} points plotted</li>
        <li class="ok"><strong>L</strong>abels: ${esc(axTitle(spec.x))} and ${esc(axTitle(spec.y))}</li>
        <li class="ok"><strong>K</strong>ey: not needed, because there's only one line</li></ul>
        ${got ? `<div class="row"><button class="btn primary" data-act="certify">Certify my graph</button></div>` :
          `<p class="small">Which title fits this graph best?</p><div class="options">${titles.map((t, i) => `<button class="opt" data-title="${i}"><span class="box" aria-hidden="true"></span><span>${esc(t)}</span></button>`).join("")}</div>${b.titleNudge ? `<div class="fb fb-retry" role="status">A title should tell what the graph shows: both of the things being compared.</div>` : ""}`}`;
    } else {
      left = `<div class="paper stamped">${svgVisual(spec, { drawIn: true })}<div class="stamp" style="${stampSpot(spec)}" aria-hidden="true">Certified</div></div>`;
      right = `<p class="step-name">Graph certified</p><h3 class="prompt">Nice building. Your graph is certified and will stay on screen for every question.</h3>
        <p class="small">Connecting the points makes the pattern of change easier to see.</p><div class="row"><button class="btn primary" data-act="toQuestions">Start the questions</button></div>`;
    }
    return `${topbar()}<main class="casewrap">${caseHeader()}<div class="bench"><section class="visual-panel">${left}</section><section class="work-panel">${right}</section></div></main>`;
  }
  const missionWaiting = () => !!(S.build && S.build.fb && S.build.fb.kind === "mission");
  /* Put the stamp in the plot quadrant with the fewest data points, so it never hides data. */
  function stampSpot(spec) {
    const q = [0, 0, 0, 0];
    spec.series.forEach((s) => s.points.forEach((p) => { const u = LFH.toUnit(spec.x, p.x), v = LFH.toUnit(spec.y, p.y); q[(u >= 0.5 ? 1 : 0) + (v >= 0.5 ? 0 : 2)]++; }));
    const k = q.indexOf(Math.min(...q));
    const pos = [["top:20%", "left:18%"], ["top:20%", "right:7%"], ["bottom:28%", "left:18%"], ["bottom:28%", "right:7%"]][k];
    return pos.join(";");
  }
  function buildFeedback() {
    const f = S.build.fb; if (!f) return "";
    if (f.kind === "mission") return missionCall(f.tag, f.note);
    if (f.kind === "reveal") return `<div class="fb fb-reveal" role="status"><p class="fb-head">Here's the answer.</p><p>${esc(f.text)}</p><button class="btn primary" data-act="bnext">Next step</button></div>`;
    return `<div class="fb fb-${f.kind}" role="status">${esc(f.text)}</div>`;
  }
  function buildChoice(i) {
    const b = S.build, spec = M.visuals[b.vid], opts = b.step === "axis" ? b.axisOrder : b.scaleOrder, o = opts[i];
    if (o.correct) { advanceBuild(); return; }
    b.tries++;
    if (!b.missioned[b.step]) { b.missioned[b.step] = true; b.fb = { kind: "mission", tag: o.tag, note: o.why || "That variable goes on the other axis." }; }
    else b.fb = { kind: "reveal", text: LFH.buildReveal(spec, b.step) };
    render();
  }
  function advanceBuild() {
    const b = S.build;
    b.fb = null; b.tries = 0; b.hint = null;
    b.step = b.step === "axis" ? "scale" : "plot";
    if (b.step === "plot") b.pending = null;
    render();
  }
  function snap(spec, x, y) {
    const { sx, sy } = LFH.snapUnits(spec);
    const cl = (v, a) => Math.min(a.max, Math.max(a.min, v));
    return { x: U.round(cl(Math.round(x / sx) * sx, spec.x)), y: U.round(cl(Math.round(y / sy) * sy, spec.y)) };
  }
  function placePoint() {
    const b = S.build, spec = M.visuals[b.vid], t = spec.series[0].points[b.i];
    if (!b.pending) return;
    const res = LFH.checkPlot(spec, b.i, b.pending.x, b.pending.y);
    if (res.ok) {
      b.placed.push({ x: t.x, y: t.y }); b.i++; b.tries = 0; b.pending = null; b.ghost = null; b.fb = null;
      if (b.i >= spec.series[0].points.length) b.step = "talk";
      return render();
    }
    b.tries++;
    if (b.tries === 1) b.fb = { kind: "mission", tag: res.tag, note: "That point isn't where the data says it should be." };
    else { b.ghost = { x: t.x, y: t.y }; b.fb = { kind: "retry", text: `The point belongs at the ring: ${U.withUnit(t.x, spec.x.unit)} across, ${U.withUnit(t.y, spec.y.unit)} up. Tap there and place it.` }; }
    render();
  }

  /* ---------------- Questions ---------------- */
  function qVisuals(q) { return q.visuals && q.visuals.length ? q.visuals : S.vids; }
  const STAGE = { plan: "Step 1 · Plan the test", analyze: "Step 3 · Analyze the data", recommend: "Step 4 · Recommendation" };
  function beakers(names) {
    const w = 640 / names.length;
    const cup = (x, nm) => `<g transform="translate(${x} 0)"><path d="M${w / 2 - 34},30 L${w / 2 - 28},132 Q${w / 2 - 27},140 ${w / 2 - 19},140 L${w / 2 + 19},140 Q${w / 2 + 27},140 ${w / 2 + 28},132 L${w / 2 + 34},30" fill="none" stroke="var(--ink)" stroke-width="3"/>
      <path d="M${w / 2 - 31},70 L${w / 2 - 28},132 Q${w / 2 - 27},138 ${w / 2 - 19},138 L${w / 2 + 19},138 Q${w / 2 + 27},138 ${w / 2 + 28},132 L${w / 2 + 31},70 Z" fill="var(--sky)" opacity="0.35"/>
      <line x1="${w / 2 + 12}" y1="14" x2="${w / 2 + 12}" y2="126" stroke="var(--pink)" stroke-width="4" stroke-linecap="round"/><circle cx="${w / 2 + 12}" cy="128" r="6" fill="var(--pink)"/>
      <text x="${w / 2}" y="166" text-anchor="middle" class="legend">${esc(nm.split(" ")[0])}</text>${nm.includes(" ") ? `<text x="${w / 2}" y="184" text-anchor="middle" class="legend">${esc(nm.split(" ").slice(1).join(" "))}</text>` : ""}</g>`;
    return `<svg class="viz" viewBox="0 0 640 196" role="img" aria-label="Lab setup: one cup of water for each substance">${names.map((n, i) => cup(i * w, n)).join("")}</svg>`;
  }
  function planPanel() {
    const names = S.inst.params.subs.map((s) => LFH.SUBSTANCES[s].name);
    const done = S.qs.filter((q) => q.stage === "plan" && (S.rec[q.id] || {}).points).map((q) => q.planNote);
    return `<div class="paper plan-card"><p class="brief-label">Lab setup</p>${beakers(names)}
      <p class="small">On the bench: ${esc(listAnd(names))}, cups, water, a thermometer, a scale, and a timer.</p>
      <h4>Your plan so far</h4>${done.length ? `<ul class="plan-list">${done.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>` : `<p class="small">Answer the planning questions to build your plan.</p>`}</div>`;
  }
  function nextLabel() {
    const q = S.qs[S.qi], nx = S.qs[S.qi + 1];
    if (!nx) return S.inst ? "Send my recommendation" : "Close the case";
    if (q.stage === "plan" && nx.stage !== "plan") return "Run the test";
    return "Next question";
  }
  function questionScreen() {
    const q = S.qs[S.qi], opts = M.options[q.id], vids = qVisuals(q);
    if (q.stage) return templateQuestion(q, opts, vids);
    const tab = Math.min(S.tab, vids.length - 1);
    const f = S.fb, rec = S.rec[q.id] || {};
    const lock = f && (f.kind === "correct" || f.kind === "reveal" || f.kind === "mission");
    let fbHTML = "";
    if (f && f.kind === "correct") fbHTML = `<div class="fb fb-correct" role="status"><p class="fb-head">${rec.points === 3 ? "Correct on the first try!" : "Correct. That side mission paid off!"} <span class="earned">+${rec.points} rep</span></p><p>${esc(q.why)}</p><button class="btn primary" data-act="next">${S.qi + 1 < S.qs.length ? "Next question" : "Close the case"}</button></div>`;
    if (f && f.kind === "reveal") fbHTML = `<div class="fb fb-reveal" role="status"><p class="fb-head">Here's the answer. <span class="earned">+1 rep</span></p><p>${esc(q.why)}</p><button class="btn primary" data-act="next">${S.qi + 1 < S.qs.length ? "Next question" : "Close the case"}</button></div>`;
    if (f && f.kind === "retry") fbHTML = `<div class="fb fb-retry" role="status">Not quite. Take another careful look at the ${vids.length > 1 ? "visuals" : "graph"} and try again.</div>`;
    if (f && f.kind === "mission") fbHTML = missionCall(f.tag);
    const badge = S.build ? `<div class="built-badge">Built by you</div>` : "";
    return `${topbar()}<main class="casewrap">${caseHeader()}<div class="bench"><section class="visual-panel">${visualPanel(vids, tab, badge)}</section>
      <section class="work-panel"><p class="skill">${esc(q.skill)}</p><h3 class="prompt">${esc(q.prompt)}</h3>${f && f.kind === "correct" ? "" : remember(rec.hint)}<p class="instr">${instruction(q.type, S.sel.length)}</p>
      ${optionButtons(opts, S.order[q.id], S.sel, lock, f && f.kind === "reveal")}
      ${lock ? "" : `<div class="row"><button class="btn primary" data-act="submit" ${canSubmit(q.type, S.sel.length) ? "" : "disabled"}>Check answer</button></div>`}
      ${fbHTML}</section></div></main>`;
  }
  function templateQuestion(q, opts, vids) {
    const f = S.fb, rec = S.rec[q.id] || {}, tab = Math.min(S.tab, Math.max(0, vids.length - 1));
    const lock = f && (f.kind === "correct" || f.kind === "reveal" || f.kind === "mission");
    let fbHTML = "";
    if (f && f.kind === "correct") fbHTML = `<div class="fb fb-correct" role="status"><p class="fb-head">${rec.points === 3 ? "Correct on the first try!" : "Correct. That side mission paid off!"} <span class="earned">+${rec.points} rep</span></p><p>${esc(q.why)}</p><button class="btn primary" data-act="next">${nextLabel()}</button></div>`;
    if (f && f.kind === "reveal") fbHTML = `<div class="fb fb-reveal" role="status"><p class="fb-head">Here's the answer. <span class="earned">+1 rep</span></p><p>${esc(q.why)}</p><button class="btn primary" data-act="next">${nextLabel()}</button></div>`;
    if (f && f.kind === "retry") fbHTML = `<div class="fb fb-retry" role="status">Not quite. Take another careful look and try again.</div>`;
    if (f && f.kind === "mission") fbHTML = missionCall(f.tag);
    const cer = q.stage === "recommend" ? `<p class="cer-steps">${["Claim", "Evidence", "Reasoning"].map((l) => `<span class="${l === q.label ? "on" : ""}">${l}</span>`).join("")}</p>` : "";
    const left = q.stage === "plan" ? planPanel() : visualPanel(vids, tab);
    return `${topbar()}<main class="casewrap">${caseHeader()}<div class="bench"><section class="visual-panel">${left}</section>
      <section class="work-panel"><p class="stage-chip">${STAGE[q.stage]}</p>${cer}${q.stage === "plan" ? "" : rulesCard(S.inst, S.caseObj.client)}${q.stage === "recommend" ? "" : `<p class="skill">${esc(q.skill)}</p>`}<h3 class="prompt">${esc(q.prompt)}</h3>${f && f.kind === "correct" ? "" : remember(rec.hint)}<p class="instr">${instruction(q.type, S.sel.length)}</p>
      ${optionButtons(opts, S.order[q.id], S.sel, lock, f && f.kind === "reveal")}
      ${lock ? "" : `<div class="row"><button class="btn primary" data-act="submit" ${canSubmit(q.type, S.sel.length) ? "" : "disabled"}>Check answer</button></div>`}
      ${fbHTML}</section></div></main>`;
  }
  function runScreen() {
    const i = S.inst, names = i.params.subs.map((s) => LFH.SUBSTANCES[s].name);
    return `${topbar()}<main class="casewrap">${caseHeader()}<div class="bench"><section class="visual-panel"><div class="paper">${svgVisual(M.visuals["CPT-GRAPH"], { drawIn: true })}</div></section>
      <section class="work-panel"><p class="stage-chip">Step 2 · Run the test</p><h3 class="prompt">Your data is in!</h3>
      <p>Your lab tested ${esc(listAnd(names))}, plus one cup of plain water as the control. Every cup had the same amount of water, the same amount of substance, and the same starting temperature: ${i.params.T0}°C.</p>
      <p>Each substance was tested 3 times, measuring the temperature every 2 minutes. <strong>Each point on the graph is the average of the 3 trials.</strong></p>
      ${rulesCard(i, S.caseObj.client)}<div class="row"><button class="btn primary" data-act="analyze">Analyze the data</button></div></section></div></main>`;
  }
  function remember(tagId) {
    if (!tagId || !M.tags[tagId]) return "";
    const t = M.tags[tagId];
    return `<div class="remember ${t.kind === "Calibration" ? "z-cal" : "z-arc"}"><p class="brief-label">Remember: ${esc(t.title)}</p><p>${esc(t.explain)}</p></div>`;
  }
  function missionCall(tagId, note) {
    const t = M.tags[tagId], cal = t.kind === "Calibration";
    return `<div class="fb fb-mission ${cal ? "z-cal" : "z-arc"}" role="status"><p class="fb-where">${cal ? "Calibration Bay" : "The Archive"}</p>
      <p class="fb-head">Side mission: ${esc(t.title)}</p><p>${esc(note || (cal ? "Your reading needs a quick calibration before you try again." : "Time for a quick trip to the Archive before you try again."))}</p>
      <button class="btn primary" data-act="mission" data-tag="${t.id}">Start side mission</button></div>`;
  }
  function submit() {
    const q = S.qs[S.qi], opts = M.options[q.id];
    const rec = S.rec[q.id] = S.rec[q.id] || { tries: 0, helped: false, points: 0 };
    const g = LFH.grade(opts, S.sel, M.tags);
    if (g.correct) { rec.points = rec.tries === 0 ? 3 : 2; return go({ fb: { kind: "correct" } }); }
    rec.tries++;
    if (rec.tries >= 2) { rec.points = 1; return go({ fb: { kind: "reveal" } }); }
    if (g.tags.length) return go({ fb: { kind: "mission", tag: g.tags[0] } });
    go({ fb: { kind: "retry" }, sel: [] });
  }
  function nextQ() {
    const cur = S.qs[S.qi], nx = S.qs[S.qi + 1];
    if (nx && cur.stage === "plan" && nx.stage !== "plan") return go({ screen: "run", qi: S.qi + 1, sel: [], fb: null, tab: 0 });
    if (S.qi + 1 < S.qs.length) return go({ qi: S.qi + 1, sel: [], fb: null, tab: 0 });
    finishCase();
  }

  /* ---------------- Side missions ---------------- */
  function startMission(tagId, from) {
    const t = M.tags[tagId];
    if (!S.visited.includes(tagId)) S.visited.push(tagId);
    const cal = t.kind === "Calibration";
    go({ screen: "mission", mission: { tag: t, from, stage: cal ? "example" : "try", example: cal ? makePractice(t) : null, practice: makePractice(t), sel: [], result: null } });
  }
  function makePractice(t) {
    if (t.kind === "Calibration") {
      const d = LFH.makeDrill(t.drill);
      const letters = "ABCDEF";
      return { visual: d.visual, prompt: d.prompt, type: "Multiple choice", why: d.why, options: d.options.map((o, i) => ({ letter: letters[i], text: o.text, correct: o.correct })) };
    }
    const pool = (M.checks[t.id] || []);
    const fresh = pool.filter((q) => !S.usedChecks.has(q.id));
    const q = U.pick(fresh.length ? fresh : pool);
    S.usedChecks.add(q.id);
    return { visual: null, prompt: q.prompt, type: q.type, why: q.why, options: U.shuffle(M.options[q.id]) };
  }
  function missionScreen() {
    const m = S.mission, t = m.tag, cal = t.kind === "Calibration";
    const head = `${topbar()}<main class="casewrap zone ${cal ? "z-cal" : "z-arc"}"><div class="zonebar"><div><p class="fb-where">${cal ? "Calibration Bay" : "The Archive"}</p><h2>Side mission: ${esc(t.title)}</h2></div>
      <p class="stage">${cal ? `<span class="${m.stage === "example" ? "on" : ""}">1. Watch one</span><span class="${m.stage === "try" ? "on" : ""}">2. Your turn</span>` : ""}</p></div>`;
    if (m.stage === "example") {
      const ex = m.example, right = ex.options.find((o) => o.correct);
      return `${head}<div class="bench"><section class="visual-panel"><div class="paper">${svgVisual(ex.visual)}</div></section><section class="work-panel">
        <div class="explain"><p class="brief-label">How it works</p><p>${esc(t.explain)}</p></div>
        <p class="step-name">Watch one</p><h3 class="prompt">${esc(ex.prompt)}</h3>
        ${optionButtons(ex.options, ex.options.map((o) => o.letter), [], true, true)}
        <div class="fb fb-correct" role="status"><p class="fb-head">The answer: ${esc(right.text)}</p><p>${esc(ex.why)}</p>
        <button class="btn primary" data-act="myturn">Got it. My turn</button></div></section></div></main>`;
    }
    const pr = m.practice;
    const left = cal ? `<div class="paper">${svgVisual(pr.visual)}</div>` :
      `<div class="archive-card"><p class="fb-where">From the Archive</p><p>${esc(t.explain)}</p></div>`;
    const done = m.result !== null;
    const right = pr.options.filter((o) => o.correct).map((o) => o.text).join(" and ");
    const res = !done ? "" : m.result ? `<div class="fb fb-correct" role="status"><p class="fb-head">${cal ? "Calibrated!" : "Got it!"}</p><p>${esc(pr.why)}</p><div class="row"><button class="btn primary" data-act="return">Back to the case</button>${cal ? '<button class="btn ghost" data-act="again">One more practice graph</button>' : ""}</div></div>`
      : `<div class="fb fb-reveal" role="status"><p class="fb-head">Not quite. The answer: ${esc(right)}</p><p>${esc(pr.why)}</p><div class="row"><button class="btn primary" data-act="again">Try another</button><button class="btn ghost" data-act="return">Back to the case</button></div></div>`;
    const order = pr.options.map((o) => o.letter);
    return `${head}<div class="bench"><section class="visual-panel">${left}</section><section class="work-panel">
      ${cal ? `<div class="explain"><p class="brief-label">How it works</p><p>${esc(t.explain)}</p></div><p class="step-name">Your turn: a brand-new graph</p>` : `<p class="step-name">Your turn: a new question</p>`}
      <h3 class="prompt">${esc(pr.prompt)}</h3><p class="instr">${instruction(pr.type, m.sel.length)}</p>
      ${optionButtons(pr.options, order, m.sel, done, done)}
      ${done ? "" : `<div class="row"><button class="btn primary" data-act="mcheck" ${canSubmit(pr.type, m.sel.length) ? "" : "disabled"}>Check answer</button></div>`}${res}</section></div></main>`;
  }
  function returnFromMission() {
    const from = S.mission.from, tag = S.mission.tag.id;
    if (from === "build") { S.build.fb = null; S.build.hint = tag; return go({ screen: "build", mission: null }); }
    const q = S.qs[S.qi]; const rec = (S.rec[q.id] = S.rec[q.id] || { tries: 1 }); rec.helped = true; rec.hint = tag;
    go({ screen: "question", mission: null, fb: null, sel: [] });
  }

  /* ---------------- Report ---------------- */
  function finishCase() {
    const pts = S.qs.reduce((a, q) => a + ((S.rec[q.id] || {}).points || 0), 0), max = S.qs.length * 3;
    const pctv = pts / max, stars = pctv >= 0.85 ? 3 : pctv >= 0.6 ? 2 : 1;
    const before = rep();
    const missions = S.visited.length;
    const weak = S.inst ? !LFH.recommendationStrong(S.qs, S.rec) : false;
    const pay = LFH.payout({ pay: S.caseObj.pay || 0, pts, max, missions, replay: S.replay, weak });
    const pr = P.cases[S.caseId] || { best: 0, stars: 0, plays: 0 };
    pr.best = Math.max(pr.best || 0, pts); pr.stars = Math.max(pr.stars || 0, stars); pr.done = true; pr.plays = (pr.plays || 0) + 1;
    P.cases[S.caseId] = pr; P.funds += pay;
    const entry = { caseId: S.caseId, stars, pay, missions, replay: S.replay };
    let strong = null;
    if (S.inst) {   // the client answers the recommendation: strong work earns a sequel, weak work a follow-up with fresh data
      strong = LFH.recommendationStrong(S.qs, S.rec);
      entry.tmpl = { n: S.offer.n, variant: S.offer.variant, title: S.caseObj.title, claim: S.inst.claimName, strong };
      P.offers = P.offers || {};
      P.offers[S.caseId] = LFH.nextOffer(S.caseId, S.offer.n, strong, Math.floor(Math.random() * 1e9));
    }
    if (S.build && S.certified && ITEM["graph-frame"]) {   // the graph the student built goes up on the wall (an Award: earned, never sold)
      const spec = M.visuals[S.build.vid];
      P.lab = LFH.lab.grant(P.lab, ITEMS, "graph-frame", { title: S.caseObj.title, type: "line", points: spec.series[0].points.map((pt) => [pt.x, pt.y]) }, ART.manifest);
      entry.award = "graph-frame";
    }
    P.history.push(entry);
    delete P.activeJob; save();
    go({ screen: "report", report: { strong, pts, max, stars, pay, gained: rep() - before, rankBefore: LFH.rankOf(before), rankAfter: LFH.rankOf(rep()) } });
  }
  function reportScreen() {
    const r = S.report, c = S.caseObj;
    const rows = S.qs.map((q) => { const x = S.rec[q.id] || {}; const k = x.points === 3 ? ["first", "First try"] : x.points === 2 ? ["helped", "After a side mission"] : ["shown", "Answer shown"];
      return `<li class="res-${k[0]}"><span class="res-mark" aria-hidden="true"></span><span class="res-skill">${esc(q.skill)}</span><span class="res-how">${k[1]}</span></li>`; }).join("");
    const vis = S.visited.map((t) => `<li class="${M.tags[t].kind === "Calibration" ? "z-cal" : "z-arc"}">${esc(M.tags[t].title)}</li>`).join("");
    const promo = r.rankAfter.name !== r.rankBefore.name ? `<div class="promo">Promotion! You're now a ${esc(r.rankAfter.name)}.</div>` : "";
    return `${topbar()}<main class="report"><div class="ticket"><p class="ticket-kicker">Job complete</p><h1>${esc(c.title)}</h1>
      <p class="bigstars" aria-label="${r.stars} of 3 stars">${[1, 2, 3].map((s) => `<span class="${r.stars >= s ? "on" : ""}">★</span>`).join("")}</p>
      <p class="pay-line big">${esc(c.client.split(",")[0])} paid your lab <strong>$${r.pay}</strong>.</p><p class="small">Their reply is in your inbox. ${r.pts} of ${r.max} points${r.gained > 0 ? `, +${r.gained} reputation` : " (your best score is saved)"}.</p>${promo}
      ${r.strong === null || r.strong === undefined ? "" : r.strong ? `<div class="rec-verdict good"><strong>${esc(c.client.split(",")[0])} trusts your recommendation: ${esc(S.inst.claimName)}.</strong> A new job from ${esc(c.client.split(",")[0])} is already in your inbox.</div>` : `<div class="rec-verdict weak"><strong>${esc(c.client.split(",")[0])} wasn't fully convinced by the recommendation.</strong> A follow-up job with a fresh batch of data is in your inbox, and new data pays full price.</div>`}
      <h2>Your evidence report</h2><ul class="results">${rows}</ul>
      ${vis ? `<h2>Side missions you completed</h2><ul class="visited">${vis}</ul>` : `<p class="small">No side missions needed this time.</p>`}
      <div class="row"><button class="btn primary" data-act="celebrate">Back to my lab</button><button class="btn ghost" data-act="inbox">Read the reply</button></div></div></main>`;
  }

  /* ---------------- Calibration Bay (free practice) ---------------- */
  function startBay(id) { S = Object.assign(S, { screen: "bay", bay: { id, streak: 0, done: 0, right: 0 } }); newBayItem(); window.scrollTo({ top: 0 }); }
  function newBayItem() {
    const b = S.bay, id = b.id === "mixed" ? U.pick(Object.keys(LFH.drills)) : b.id;
    const d = LFH.makeDrill(id), letters = "ABCDEF";
    b.item = { id, visual: d.visual, prompt: d.prompt, why: d.why, options: d.options.map((o, i) => ({ letter: letters[i], text: o.text, correct: o.correct })) };
    b.sel = []; b.result = null; render();
  }
  function bayScreen() {
    const b = S.bay, it = b.item, done = b.result !== null;
    const res = !done ? "" : `<div class="fb ${b.result ? "fb-correct" : "fb-reveal"}" role="status"><p class="fb-head">${b.result ? `Correct! Streak: ${b.streak}` : "Not quite."}</p><p>${esc(it.why)}</p><div class="row"><button class="btn primary" data-act="bayNext">Next graph</button><button class="btn ghost" data-act="simBack">Back to the laptop</button></div></div>`;
    return `${topbar()}<main class="casewrap zone z-cal"><div class="zonebar"><div><p class="fb-where">Training sim</p><h2>${esc(b.id === "mixed" ? "Mixed practice" : LFH.drillNames[b.id])}${b.id === "mixed" ? `: ${esc(LFH.drillNames[it.id])}` : ""}</h2></div><p class="streak">Streak ${b.streak} · ${b.right} of ${b.done} correct</p></div>
      <div class="bench"><section class="visual-panel"><div class="paper">${svgVisual(it.visual)}</div></section><section class="work-panel">
      <h3 class="prompt">${esc(it.prompt)}</h3><p class="instr">Choose one answer.</p>${optionButtons(it.options, it.options.map((o) => o.letter), b.sel, done, done)}
      ${done ? "" : `<div class="row"><button class="btn primary" data-act="bayCheck" ${b.sel.length ? "" : "disabled"}>Check answer</button><button class="btn ghost" data-act="simBack">Back to the laptop</button></div>`}${res}</section></div></main>`;
  }

  /* ---------------- Render + events ---------------- */
  function render() {
    const s = S.screen;
    if (S.caseId && JOB_SCREENS.includes(S.screen)) autosaveJob();     // every step of a job is saved
    const screens = { name: nameScreen, room: roomScreen, shop: shopScreen, laptop: laptopScreen, bench: benchEmpty, intro, build: buildScreen, question: questionScreen, run: runScreen, mission: missionScreen, report: reportScreen, bay: bayScreen };
    app.innerHTML = (screens[s] || roomScreen)();
    mountLab();
    const target = app.querySelector(".plot-target");
    if (target) target.addEventListener("pointerdown", onPlotTap);
  }
  function onPlotTap(e) {
    if (missionWaiting()) return;
    const svg = e.currentTarget, pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
    const spec = M.visuals[S.build.vid];
    const u = (loc.x - MG.l) / PW, v = 1 - (loc.y - MG.t) / PH;
    if (u < -0.03 || u > 1.03 || v < -0.03 || v > 1.03) return;
    S.build.pending = snap(spec, LFH.fromUnit(spec.x, u), LFH.fromUnit(spec.y, v));
    S.build.fb = S.build.fb && S.build.fb.kind === "mission" ? S.build.fb : null;
    render();
  }
  app.addEventListener("change", (e) => {
    if (e.target.id !== "load-input" || !e.target.files || !e.target.files[0]) return;
    const fr = new FileReader();
    fr.onload = () => loadFromText(fr.result);
    fr.onerror = () => go({ toast: "That file couldn't be read. Try picking it again." });
    fr.readAsText(e.target.files[0]);
  });
  document.addEventListener("keydown", (e) => {
    if (S.screen !== "build" || !S.build || S.build.step !== "plot") return;
    const spec = M.visuals[S.build.vid], { sx, sy } = LFH.snapUnits(spec);
    if (missionWaiting()) return;
    const p = S.build.pending || snap(spec, (spec.x.min + spec.x.max) / 2, (spec.y.min + spec.y.max) / 2);
    const moves = { ArrowLeft: [-sx, 0], ArrowRight: [sx, 0], ArrowUp: [0, sy], ArrowDown: [0, -sy] };
    if (moves[e.key]) { e.preventDefault(); S.build.pending = snap(spec, p.x + moves[e.key][0], p.y + moves[e.key][1]); render(); }
    else if (e.key === "Enter" && S.build.pending && !(document.activeElement && document.activeElement.tagName === "BUTTON")) { e.preventDefault(); placePoint(); }
  });
  app.addEventListener("click", (e) => {
    const el = e.target.closest("button"); if (!el) return;
    const d = el.dataset;
    if (d.accept) { const j = P.activeJob; if (j && j.caseId === d.accept && (!j.offer || j.offer.n === 1)) return goBench(); if (j && !confirm("You have another job in progress. Start this one instead? (The other job's progress will be lost.)")) return; delete P.activeJob; return startCase(d.accept); }
    if (d.offer) { const off = P.offers[d.offer], j = P.activeJob; if (!off) return; if (j && !(j.caseId === d.offer && j.offer && j.offer.n === off.n) && !confirm("You have another job in progress. Start this one instead? (The other job's progress will be lost.)")) return;
      if (j && j.caseId === d.offer && j.offer && j.offer.n === off.n) return goBench(); delete P.activeJob; return startCase(d.offer, null, off); }
    if (d.mail) return go({ mail: d.mail });
    if (d.app) return go({ screen: "laptop", app: d.app, toast: null });
    if (d.nameAdj) { S.nameAdj = d.nameAdj; return render(); }
    if (d.nameNoun) { S.nameNoun = d.nameNoun; return render(); }
    if (d.bay) return startBay(d.bay);
    if (d.tab !== undefined) return go({ tab: +d.tab });
    if (d.bopt !== undefined) return buildChoice(+d.bopt);
    if (d.title !== undefined) { const spec = M.visuals[S.build.vid]; const ok = S.build.titleOrder[+d.title] === spec.title; S.build.titleOk = ok; S.build.titleNudge = !ok; return render(); }
    if (d.opt) {
      if (S.screen === "question") { const q = S.qs[S.qi]; S.sel = toggle(q.type, S.sel, d.opt); if (S.fb && S.fb.kind === "retry") S.fb = null; return render(); }
      if (S.screen === "mission") { S.mission.sel = toggle(S.mission.practice.type, S.mission.sel, d.opt); return render(); }
      if (S.screen === "bay") { S.bay.sel = [d.opt]; return render(); }
    }
    switch (d.act) {
      case "room": return go({ screen: "room", caseId: S.caseId && JOB_SCREENS.includes(S.screen) ? null : S.caseId, mission: null, toast: null });
      case "laptop": return go({ screen: "laptop", app: S.app || "inbox", toast: null });
      case "inbox": return go({ screen: "laptop", app: "inbox", toast: null });
      case "ledger": return go({ screen: "laptop", app: "ledger" });
      case "bench": return goBench();
      case "decorate": return go({ screen: "shop", toast: null });
      case "shopAll": return go({ shopSlot: null });
      case "mailBack": return go({ mail: "none" });
      case "simBack": return go({ screen: "laptop", app: "sim" });
      case "celebrate": return go({ screen: "room", caseId: null, celebrate: S.report ? Math.max(1, S.report.pay) : null });
      case "rename": return go({ screen: "name", nameAdj: null, nameNoun: null });
      case "nameDone": P.labName = `The ${S.nameAdj} ${S.nameNoun} Lab`; save(); return go({ screen: "room" });
      case "addFunds": P.funds += 100; save(); return render();
      case "saveFile": return saveToFile();
      case "loadFile": { const inp = document.getElementById("load-input"); if (inp) { inp.value = ""; inp.click(); } return; }
      case "reset": if (confirm("Reset your whole lab? Funds, items, stars, and emails will all start over.")) { P = LFH.freshProgress(); save(); S = { screen: "name" }; render(); } return;
      case "begin": return go({ screen: S.build ? "build" : "question" });
      case "analyze": return go({ screen: "question", fb: null, sel: [] });
      case "place": return placePoint();
      case "certify": S.build.step = "done"; return render();
      case "toQuestions": return go({ screen: "question", certified: true });
      case "submit": return submit();
      case "next": return nextQ();
      case "mission": return startMission(d.tag, S.screen === "build" ? "build" : "question");
      case "mcheck": { const m = S.mission; m.result = LFH.grade(m.practice.options, m.sel, M.tags).correct; return render(); }
      case "myturn": S.mission.stage = "try"; return go({});
      case "bnext": return advanceBuild();
      case "again": S.mission.practice = makePractice(S.mission.tag); S.mission.sel = []; S.mission.result = null; return render();
      case "return": return returnFromMission();
      case "bayCheck": { const b = S.bay; const ok = b.item.options.find((o) => o.letter === b.sel[0]).correct; b.result = ok; b.done++; if (ok) { b.right++; b.streak++; P.bayCorrect++; P.bayBest = Math.max(P.bayBest, b.streak); } else b.streak = 0; save(); return render(); }
      case "bayNext": return newBayItem();
    }
  });
  render();
  }
})();
