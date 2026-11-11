/* Lab for Hire lab room v0.4.0: draws the student's lab and its store. UI only.
   The rules (starter lab, what fits where, buying, awards) live in the engine: LFH.lab.
   LabRoom.mount(el, { state, funds, items, manifest, sprites, rank, readOnly, onTap, onChange })
     state    the lab part of progress (see LFH.lab); funds is passed separately and handed back in onChange(lab, funds, event)
     readOnly just the room (the home screen); onTap(itemId, spotId) says what was tapped */
(function () {
  "use strict";
  var VERSION = "0.4.0";
  var SVGNS = "http://www.w3.org/2000/svg";
  var LAB = LFH.lab;
  var PAINT_LABELS = { wall: "Walls", floor: "Floor", trim: "Trim", tiles: "Floor pattern" };

  // ---------- paint math: identical to dev/art/scene.js ----------
  function s2l(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
  function l2s(c) { return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; }
  function hexToRgb(h) { h = h.replace("#", ""); return [0, 2, 4].map(function (i) { return parseInt(h.slice(i, i + 2), 16) / 255; }); }
  function rgbToHex(a) { return "#" + a.map(function (v) { var n = Math.round(Math.min(1, Math.max(0, v)) * 255); return (n < 16 ? "0" : "") + n.toString(16); }).join(""); }
  function shadeHex(hex, f) { return rgbToHex(hexToRgb(hex).map(function (c, i) { return l2s(s2l(c) * f[i]); })); }
  function darkHex(hex, k) { return rgbToHex(hexToRgb(hex).map(function (c) { return l2s(s2l(c) * k); })); }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function sv(tag, attrs) { var e = document.createElementNS(SVGNS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }
  function money(n) { return "$" + n; }
  function indexItems(items) { var byId = {}; items.forEach(function (it) { byId[it.id] = it; }); return byId; }
  var paintKey = LAB.paintKey, isAward = LAB.isAward, roomOf = LAB.roomOf, slotsOfType = LAB.slotsOfType;
  var ANY_DEFAULT = { wall: "#FFE7A8", floor: "#CFE8D5", trim: "#E0413A" };
  function isRequired(man, slotId) { var s = man.slots.filter(function (x) { return x.id === slotId; })[0]; return !!(s && s.required); }
  // ---------- styles (scoped to .lr) ----------
  var CSS = [
    ".lr{--lr-ink:var(--ink);--lr-accent:var(--violet);--lr-room:var(--bg);--lr-line:var(--line);--lr-muted:var(--ink-soft);--lr-card:var(--paper);--lr-good:var(--mint);--lr-warn:var(--pink);--lr-soft:var(--violet-soft);color:var(--lr-ink);font:inherit;display:grid;grid-template-columns:1fr;grid-gap:16px}",
    ".lr.lr-wide{grid-template-columns:minmax(0,1fr) 360px;align-items:start}",
    ".lr button{font:inherit;color:inherit;touch-action:manipulation;cursor:pointer}",
    ".lr button:focus-visible{outline:3px solid var(--lr-accent);outline-offset:2px}",
    ".lr-stage{position:-webkit-sticky;position:sticky;top:0;z-index:2;background:var(--lr-room);border-radius:0 0 20px 20px;overflow:hidden}",
    ".lr-wide .lr-stage{top:12px;border-radius:20px}",
    ".lr-sizer{position:relative;width:100%;margin:0 auto}",
    ".lr-svg{position:absolute;left:0;top:0;width:100%;height:100%;display:block;-webkit-tap-highlight-color:transparent;touch-action:manipulation;user-select:none;-webkit-user-select:none}",
    ".lr-hint{position:absolute;left:12px;bottom:10px;margin:0;padding:4px 10px;border-radius:999px;background:var(--stamp-bg);font-size:14px;color:var(--lr-muted);pointer-events:none}",
    ".lr-panel{background:var(--lr-card);border:1px solid var(--lr-line);border-radius:18px;padding:16px;min-width:0}",
    ".lr-wallet{display:grid;grid-template-columns:auto 1fr;grid-gap:2px 10px;align-items:baseline}",
    ".lr-funds{font-size:32px;font-weight:600;line-height:1.1;letter-spacing:-0.02em}",
    ".lr-funds-label{font-size:14px;color:var(--lr-muted)}",
    ".lr-status{grid-column:1/-1;min-height:1.45em;margin:6px 0 0;font-size:14px;color:var(--lr-good);font-weight:500}",
    ".lr-unlocks{margin:10px 0 0;padding:10px 12px;border-radius:12px;background:var(--lr-soft);font-size:14px}",
    ".lr-unlocks b{font-weight:600}",
    ".lr-chips{display:flex;flex-wrap:wrap;margin:6px -3px 0}",
    ".lr-chip{display:inline-block;margin:3px;padding:3px 10px;border-radius:999px;background:var(--lr-card);border:1px solid var(--lr-line);font-size:13px;font-weight:500}",
    ".lr-tabs{display:grid;grid-template-columns:repeat(3,1fr);margin:14px 0 10px;background:var(--lr-soft);border-radius:12px;padding:4px}",
    ".lr-tabs button{border:0;background:transparent;border-radius:9px;padding:9px 2px;white-space:nowrap;font-weight:600;font-size:15px;color:var(--lr-muted)}",
    ".lr-tabs button[aria-selected=true]{background:var(--lr-card);color:var(--lr-ink);box-shadow:0 1px 3px rgba(42,31,74,.14)}",
    ".lr-spothead{display:grid;grid-template-columns:auto 1fr;grid-gap:0 10px;align-items:center;margin:14px 0 10px}",
    ".lr-back{border:1px solid var(--lr-line);background:var(--lr-card);border-radius:10px;padding:8px 12px;font-weight:600;font-size:15px}",
    ".lr-spothead h3{margin:0;font-size:18px;font-weight:600}",
    ".lr-spothead p{grid-column:2;margin:0;font-size:13px;color:var(--lr-muted)}",
    ".lr-group{margin:14px 0 6px;font-size:15px;font-weight:600}",
    ".lr-group small{display:block;font-weight:400;font-size:13px;color:var(--lr-muted)}",
    ".lr-list{display:grid;grid-template-columns:1fr;grid-gap:8px}",
    ".lr-card{border:1px solid var(--lr-line);border-radius:12px;background:var(--lr-card);overflow:hidden}",
    ".lr-card.on{border-color:var(--lr-accent);box-shadow:0 0 0 2px var(--lr-accent) inset}",
    ".lr-row{display:grid;grid-template-columns:56px minmax(0,1fr) auto;grid-gap:12px;align-items:center;width:100%;text-align:left;border:0;background:transparent;padding:8px 12px 8px 8px}",
    ".lr-thumb{width:56px;height:56px;border-radius:10px;background:var(--lr-room);display:flex;align-items:center;justify-content:center;overflow:hidden}",
    ".lr-thumb img{max-width:48px;max-height:48px;display:block}",
    ".lr-swatch{width:40px;height:40px;border-radius:50%;border:1px solid rgba(42,31,74,.18)}",
    ".lr-name{display:block;font-weight:600;font-size:15px;line-height:1.25}",
    ".lr-meta{display:block;font-size:13px;color:var(--lr-muted)}",
    ".lr-tag{font-size:13px;font-weight:600;white-space:nowrap}",
    ".lr-tag.price{color:var(--lr-ink)}",
    ".lr-tag.have{color:var(--lr-good)}",
    ".lr-tag.lock{color:var(--lr-muted)}",
    ".lr-tag.earn{color:var(--lr-accent)}",
    ".lr-colors{display:grid;grid-template-columns:repeat(8,1fr);grid-gap:8px;margin:4px 0 12px;max-width:340px}",
    ".lr-color{width:100%;padding:0;padding-bottom:100%;border-radius:50%;border:2px solid rgba(42,31,74,.18);cursor:pointer;touch-action:manipulation}",
    ".lr-color[aria-pressed=true]{border-color:var(--lr-ink);box-shadow:0 0 0 2px var(--lr-card) inset}",
    ".lr-color:focus-visible{outline:3px solid var(--lr-ink);outline-offset:2px}",
    ".lr-more{display:inline-grid;grid-template-columns:auto auto;grid-gap:8px;align-items:center;font-size:15px;font-weight:600;color:var(--lr-accent)}",
    ".lr-more input{width:44px;height:36px;border:1px solid var(--lr-line);border-radius:8px;padding:2px;background:var(--lr-card)}",
    ".lr-unlockline{display:block;font-size:13px;color:var(--sky);font-weight:500}",
    ".lr-detail{padding:0 12px 12px 76px}",
    ".lr-detail p{margin:0 0 10px;font-size:14px}",
    ".lr-act{border:2px solid var(--lr-accent);background:var(--lr-accent);color:var(--paper) !important;border-radius:10px;padding:9px 16px;font-weight:600;font-size:15px}",
    ".lr-act.alt{background:var(--lr-card);color:var(--lr-accent) !important}",
    ".lr-act[disabled]{background:var(--lr-soft);border-color:var(--lr-soft);color:var(--lr-muted) !important;cursor:default}",
    ".lr-empty{font-size:14px;color:var(--lr-muted);margin:8px 0}",
    ".lr-slot-focus{fill:transparent;stroke:none;outline:none}",
    ".lr-slot-focus:focus{stroke:var(--lr-accent);stroke-width:4;stroke-dasharray:10 8}",
    "@media (max-width:420px){.lr-detail{padding-left:12px}.lr-funds{font-size:28px}}"
  ].join("\n");
  function injectCSS() {
    if (document.getElementById("labroom-css")) return;
    var s = document.createElement("style"); s.id = "labroom-css"; s.textContent = CSS; document.head.appendChild(s);
  }

  // ---------- mount ----------
  function mount(root, opts) {
    injectCSS();
    var items = opts.items, man = opts.manifest, spriteData = opts.sprites || {};
    var onChange = opts.onChange || function () {};
    var rank = opts.rank || 0;
    var readOnly = !!opts.readOnly, onTap = opts.onTap || null;
    var byId = indexItems(items);
    var slotById = {}; man.slots.forEach(function (s) { slotById[s.id] = s; });
    var state = LAB.normalize(opts.state, items, man);
    var funds = Math.max(0, Math.floor(Number(opts.funds) || 0));
    var roomId = roomOf(man);
    function R() { return state.rooms[roomId]; }

    var ui = { tab: "store", spot: null, preview: null, status: "" };   // preview: { itemId, slotId | paintKey }
    function spriteUrl(file) { return spriteData[file] || ""; }
    function spriteFor(it, slotId) { return man.sprites[it.sprite + "@" + slotId] || null; }
    function owns(id) { return state.owned.indexOf(id) >= 0; }
    function placedAt(id) { for (var k in R().placed) if (R().placed[k] === id) return k; return null; }

    // What the room shows right now (placed + preview)
    function effective() {
      var placed = clone(R().placed), paint = clone(R().paint), colors = clone(R().colors), p = ui.preview;
      if (p && p.slotId) {
        var was = placedAt(p.itemId); if (was) delete placed[was];
        placed[p.slotId] = p.itemId;
      }
      if (p && p.paintKey) paint[p.paintKey] = p.itemId;
      return { placed: placed, paint: paint, colors: colors };
    }
    function slotVisible(s, placed) { return !s.parent || !!placed[s.parent]; }

    // ----- DOM skeleton -----
    root.innerHTML = "";
    var wrap = el("div", "lr"); root.appendChild(wrap);
    var stage = el("div", "lr-stage"); wrap.appendChild(stage);
    var sizer = el("div", "lr-sizer"); sizer.style.paddingBottom = (man.view[3] / man.view[2] * 100).toFixed(3) + "%"; stage.appendChild(sizer);
    var svg = sv("svg", { "class": "lr-svg", viewBox: man.view.join(" "), role: "group", "aria-label": "Your lab. Tap a spot to change what's there." });
    sizer.appendChild(svg);
    var gRoom = sv("g", {}), gItems = sv("g", {}), gUI = sv("g", {}), gFocus = sv("g", {});
    svg.appendChild(gRoom); svg.appendChild(gItems); svg.appendChild(gUI); svg.appendChild(gFocus);
    var hint = null;
    var panel = null;
    if (!readOnly) {
      hint = el("p", "lr-hint", "Tap any spot in your lab to change it."); stage.appendChild(hint);
      panel = el("section", "lr-panel"); panel.setAttribute("aria-label", "Lab store"); wrap.appendChild(panel);
    }

    // wide layout by container width (no container queries on older iPads)
    // Stacked (portrait iPad, phone): the room sticks to the top at up to 45% of the screen so previews stay in view.
    var aspect = man.view[2] / man.view[3];
    function layout() {
      var w = root.getBoundingClientRect().width, wide = w >= 900;
      wrap.className = "lr" + (wide ? " lr-wide" : "");
      sizer.style.maxWidth = "calc((" + (wide ? "100vh - 24px" : "45vh") + ") * " + aspect.toFixed(4) + ")";
    }
    var ro = null;
    if (!readOnly) { if (window.ResizeObserver) { ro = new ResizeObserver(layout); ro.observe(root); } else window.addEventListener("resize", layout); layout(); }

    // ----- room shell: polygons, recolored by code -----
    function colorOf(paint, colors, k) { var sp = byId[paint[k]].sprite; return sp === "any" ? (colors[k] || ANY_DEFAULT[k]) : sp; }
    function drawRoom(paint, colors) {
      var col = { wall: colorOf(paint, colors, "wall"), floor: colorOf(paint, colors, "floor"), trim: colorOf(paint, colors, "trim") };
      col.tiles = darkHex(col.floor, man.room.tileDarken);
      var pattern = byId[paint.tiles].sprite, sh = man.room.shade;
      gRoom.innerHTML = "";
      function poly(points, fill) {
        var d = points.map(function (p) { return p[0] + "," + p[1]; }).join(" ");
        gRoom.appendChild(sv("polygon", { points: d, fill: fill, stroke: fill, "stroke-width": 1, "stroke-linejoin": "round" }));
      }
      man.room.faces.forEach(function (f, i) {
        poly(f.points, shadeHex(col[f.group], sh[f.normal]));
        if (i === man.room.tilesAfter - 1) {
          (man.room.tiles[pattern] || []).forEach(function (t) { poly(t, shadeHex(col.tiles, sh.py)); });
        }
      });
    }

    // ----- items: stacked sprites in slot order -----
    var imgCache = {};
    function drawItems(placed) {
      gItems.innerHTML = "";
      man.slots.forEach(function (s) {
        var id = placed[s.id]; if (!id || !slotVisible(s, placed)) return;
        var sp = spriteFor(byId[id], s.id); if (!sp) return;
        var im = sv("image", { x: sp.x, y: sp.y, width: sp.w, height: sp.h, preserveAspectRatio: "none" });
        im.setAttributeNS("http://www.w3.org/1999/xlink", "href", spriteUrl(sp.file)); im.setAttribute("href", spriteUrl(sp.file));
        gItems.appendChild(im);
        if (s.canvas && isAward(byId[id]) && state.awards[id]) drawGraph(s, state.awards[id]);
      });
    }
    // A student's own graph, drawn live onto a framed poster's canvas. The canvas corners come from the bake,
    // so the graph lands exactly on the 3D canvas; its colors get the same wall shading as the room.
    function drawGraph(slot, data) {
      var pts = (data && Array.isArray(data.points) ? data.points : []).filter(function (p) { return Array.isArray(p) && isFinite(p[0]) && isFinite(p[1]); });
      if (pts.length < 2) return;
      var c = slot.canvas, W = 100, H = 72.5, sh = man.room.shade[slot.normal] || [1, 1, 1];
      var m = [(c[1][0] - c[0][0]) / W, (c[1][1] - c[0][1]) / W, (c[2][0] - c[0][0]) / H, (c[2][1] - c[0][1]) / H, c[0][0], c[0][1]];
      var g = sv("g", { transform: "matrix(" + m.map(function (n) { return n.toFixed(4); }).join(" ") + ")", "pointer-events": "none" });
      var ink = shadeHex("#2A1F4A", sh), x0 = 15, x1 = 91, y0 = 61, y1 = 10, type = data.type || "line";
      var xs = pts.map(function (p) { return +p[0]; }), ys = pts.map(function (p) { return +p[1]; });
      var xa = Math.min.apply(null, xs), xb = Math.max.apply(null, xs), ya = Math.min.apply(null, ys), yb = Math.max.apply(null, ys);
      if (type === "bar") ya = Math.min(0, ya);
      if (xb === xa) xb = xa + 1; if (yb === ya) yb = ya + 1;
      function X(v) { return x0 + 4 + (v - xa) / (xb - xa) * (x1 - x0 - 8); }
      function Y(v) { return y0 - 3 - (v - ya) / (yb - ya) * (y0 - y1 - 6); }
      g.appendChild(sv("path", { d: "M" + x0 + " " + y1 + "V" + y0 + "H" + x1, fill: "none", stroke: ink, "stroke-width": 1.6, "stroke-linecap": "square" }));
      if (type === "bar") {
        var bw = (x1 - x0 - 8) / pts.length * 0.62, fill = shadeHex("#6547CF", sh);
        pts.forEach(function (p, i) {
          var cx = x0 + 4 + (i + 0.5) * (x1 - x0 - 8) / pts.length, top = Y(+p[1]), base = Y(Math.max(ya, 0));
          g.appendChild(sv("rect", { x: cx - bw / 2, y: Math.min(top, base), width: bw, height: Math.max(0.8, Math.abs(base - top)), fill: fill }));
        });
      } else if (type === "scatter") {
        var dot = shadeHex("#1F8FBF", sh);
        pts.forEach(function (p) { g.appendChild(sv("circle", { cx: X(+p[0]), cy: Y(+p[1]), r: 2.2, fill: dot })); });
      } else {
        var line = shadeHex("#D93A72", sh), sorted = pts.slice().sort(function (a, b) { return a[0] - b[0]; });
        g.appendChild(sv("polyline", { points: sorted.map(function (p) { return X(+p[0]).toFixed(2) + "," + Y(+p[1]).toFixed(2); }).join(" "), fill: "none", stroke: line, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }));
        sorted.forEach(function (p) { g.appendChild(sv("circle", { cx: X(+p[0]), cy: Y(+p[1]), r: 2.3, fill: line })); });
      }
      gItems.appendChild(g);
    }

    // ----- selection outline + empty-spot markers -----
    function boxFor(slotId, placed) {
      var id = placed[slotId], sp = id && spriteFor(byId[id], slotId);
      return sp ? [sp.x, sp.y, sp.w, sp.h] : slotById[slotId].hit;
    }
    function drawUI(placed) {
      gUI.innerHTML = ""; gFocus.innerHTML = "";
      if (readOnly) return;
      man.slots.forEach(function (s) {
        if (!slotVisible(s, placed)) return;
        var b = s.hit;
        if (!placed[s.id] && ui.spot !== s.id) {
          var cx = b[0] + b[2] / 2, cy = b[1] + b[3] / 2;
          var g = sv("g", { opacity: 0.9 });
          g.appendChild(sv("circle", { cx: cx, cy: cy, r: 24, fill: "#fff", stroke: "#6547CF", "stroke-width": 4, "stroke-dasharray": "7 5" }));
          g.appendChild(sv("path", { d: "M" + (cx - 10) + " " + cy + "h20M" + cx + " " + (cy - 10) + "v20", stroke: "#6547CF", "stroke-width": 5, "stroke-linecap": "round" }));
          gUI.appendChild(g);
        }
        var f = sv("rect", { x: b[0], y: b[1], width: b[2], height: b[3], rx: 14, "class": "lr-slot-focus", tabindex: 0, role: "button", "aria-label": s.label + (placed[s.id] ? ": " + byId[placed[s.id]].name : ": empty") });
        f.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectSpot(s.id); } });
        gFocus.appendChild(f);
      });
      if (ui.spot) {
        var bb = boxFor(ui.spot, placed), pad = 10;
        gUI.appendChild(sv("rect", { x: bb[0] - pad, y: bb[1] - pad, width: bb[2] + pad * 2, height: bb[3] + pad * 2, rx: 16, fill: "rgba(101,71,207,0.08)", stroke: "#6547CF", "stroke-width": 4, "stroke-dasharray": "12 8" }));
        var label = slotById[ui.spot].label, tw = label.length * 12.5 + 28, lx = bb[0] + bb[2] / 2 - tw / 2, ly = Math.max(man.view[1] + 4, bb[1] - pad - 44);
        gUI.appendChild(sv("rect", { x: lx, y: ly, width: tw, height: 36, rx: 18, fill: "#6547CF" }));
        var t = sv("text", { x: lx + tw / 2, y: ly + 24, "text-anchor": "middle", fill: "#fff", "font-size": 21, "font-weight": 600 }); t.textContent = label; gUI.appendChild(t);
      }
    }

    function render() {
      var e = effective();
      drawRoom(e.paint, e.colors); drawItems(e.placed); drawUI(e.placed);
      if (panel) {
        var a = document.activeElement, fk = a && a.getAttribute && panel.contains(a) ? a.getAttribute("data-k") : null;
        drawPanel();
        if (fk) { var again = panel.querySelector('[data-k="' + fk + '"]'); if (again) again.focus(); }
      }
    }

    // ----- tap to pick a spot: front-most visible sprite pixel wins, then empty-spot areas -----
    var hitMaps = {};
    function hitMap(file, cb) {
      if (hitMaps[file]) return cb(hitMaps[file]);
      var im = new Image();
      im.onload = function () {
        var k = 2, c = document.createElement("canvas"); c.width = Math.ceil(im.width / k); c.height = Math.ceil(im.height / k);
        var x = c.getContext("2d"); x.drawImage(im, 0, 0, c.width, c.height);
        try { hitMaps[file] = { k: k, w: c.width, d: x.getImageData(0, 0, c.width, c.height).data }; } catch (err) { hitMaps[file] = { none: true }; }
        cb(hitMaps[file]);
      };
      im.src = spriteUrl(file);
    }
    function preloadHits() { var p = effective().placed; man.slots.forEach(function (s) { var id = p[s.id]; var sp = id && spriteFor(byId[id], s.id); if (sp) hitMap(sp.file, function () {}); }); }
    function pickAt(x, y) {
      var placed = effective().placed, order = man.slots.slice().reverse();
      for (var i = 0; i < order.length; i++) {
        var s = order[i]; if (!slotVisible(s, placed)) continue;
        var id = placed[s.id], sp = id && spriteFor(byId[id], s.id);
        if (sp && x >= sp.x && y >= sp.y && x < sp.x + sp.w && y < sp.y + sp.h) {
          var hm = hitMaps[sp.file];
          if (!hm || hm.none) return s.id;
          var px = Math.floor((x - sp.x) / hm.k), py = Math.floor((y - sp.y) / hm.k);
          if (hm.d[(py * hm.w + px) * 4 + 3] > 90) return s.id;
        }
      }
      for (var j = 0; j < order.length; j++) {
        var t = order[j]; if (!slotVisible(t, placed) || placed[t.id]) continue;
        var h = t.hit; if (x >= h[0] && y >= h[1] && x < h[0] + h[2] && y < h[1] + h[3]) return t.id;
      }
      return null;
    }
    svg.addEventListener("click", function (e) {
      var pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
      var p = pt.matrixTransform(svg.getScreenCTM().inverse());
      var id = pickAt(p.x, p.y);
      if (readOnly) { if (id && onTap && R().placed[id]) onTap(R().placed[id], id); return; }
      if (id) selectSpot(id); else if (ui.spot) { ui.spot = null; ui.preview = null; render(); }
    });

    // ----- actions -----
    function say(msg) { ui.status = msg; if (panel) { var s = panel.querySelector(".lr-status"); if (s) s.textContent = msg; } }
    function emit(ev) { preloadHits(); onChange(clone(state), funds, ev); }
    function selectSpot(id) { ui.spot = id; ui.preview = null; ui.status = ""; render(); var b = panel && panel.querySelector(".lr-back"); if (b) b.focus(); }
    function targetSlot(it) {
      if (ui.spot && slotById[ui.spot].type === it.slot) return ui.spot;   // a tapped spot wins, even for things already out
      var here = placedAt(it.id); if (here) return here;
      var slots = slotsOfType(man, it.slot).filter(function (s) { return slotVisible(s, R().placed); });
      var empty = slots.filter(function (s) { return !R().placed[s.id]; })[0];
      return (empty || slots[slots.length - 1]).id;
    }
    function preview(it) {
      var pk = paintKey(it);
      if (ui.preview && ui.preview.itemId === it.id) { ui.preview = null; render(); return; }
      ui.preview = pk ? { itemId: it.id, paintKey: pk } : { itemId: it.id, slotId: targetSlot(it) };
      ui.status = "";
      render();
    }
    function buy(it) {
      var got = LAB.buy(it, state, funds, rank); if (!got) return;
      var p = ui.preview; state = got.lab; funds = got.funds;
      var pk = paintKey(it), slotId = null;
      if (pk) R().paint[pk] = it.id;
      else { slotId = p && p.itemId === it.id ? p.slotId : targetSlot(it); placeIn(it, slotId); }
      ui.preview = null;
      var msg = "Bought the " + it.name + ".";
      if (it.unlocks) msg += " Unlocked: " + it.unlocks + "!";
      else if (pk) msg = "Bought " + it.name + " for your " + PAINT_LABELS[pk].toLowerCase() + ".";
      ui.status = msg; render(); emit({ type: "buy", itemId: it.id, slotId: slotId, price: it.price });
    }
    function cap(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
    function setColor(it, hex, quiet) {
      var k = paintKey(it); R().colors[k] = hex.toUpperCase(); R().paint[k] = it.id;
      if (quiet) { var e = effective(); drawRoom(e.paint, e.colors); return; }   // while dragging the picker: room only
      ui.status = PAINT_LABELS[k] + ": your own color."; render(); emit({ type: "paint", itemId: it.id, color: R().colors[k] });
    }
    function placeIn(it, slotId) { var was = placedAt(it.id); if (was) delete R().placed[was]; R().placed[slotId] = it.id; }
    function put(it, slotId) {
      var pk = paintKey(it);
      if (pk) { R().paint[pk] = it.id; ui.status = PAINT_LABELS[pk] + ": " + it.name + "."; }
      else { placeIn(it, slotId); ui.status = "Moved the " + it.name + " to " + slotById[slotId].label.toLowerCase() + "."; }
      ui.preview = null; render(); emit({ type: pk ? "paint" : "place", itemId: it.id, slotId: slotId || null });
    }
    function takeOut(slotId) {
      var id = R().placed[slotId]; if (!id || isRequired(man, slotId)) return;
      delete R().placed[slotId]; ui.preview = null;
      var riders = man.slots.filter(function (s) { return s.parent === slotId && R().placed[s.id]; }).map(function (s) { var n = byId[R().placed[s.id]].name; delete R().placed[s.id]; return "the " + n; });
      ui.status = "Took out the " + byId[id].name + ". It's in storage." + (riders.length ? " " + cap(riders.join(" and ")) + " went to storage too." : "");
      render(); emit({ type: "remove", itemId: id, slotId: slotId });
    }

    // ----- panel -----
    function card(it, context) {
      var pk = paintKey(it), mine = owns(it.id), where = placedAt(it.id);
      var inUse = pk ? R().paint[pk] === it.id : !!where;
      var on = ui.preview && ui.preview.itemId === it.id;
      var c = el("div", "lr-card" + (on ? " on" : ""));
      var row = el("button", "lr-row"); row.type = "button"; row.setAttribute("data-item", it.id); row.setAttribute("aria-expanded", on ? "true" : "false"); row.setAttribute("data-k", it.id);
      var th = el("span", "lr-thumb");
      if (pk === "tiles") th.appendChild(patternSwatch(it.sprite));
      else if (pk) {
        var sw = el("span", "lr-swatch");
        if (it.sprite === "any") { sw.style.background = "#E8D5FF"; sw.style.background = "conic-gradient(#E0413A, #F2A541, #FFE7A8, #3E9C6E, #1F8FBF, #6547CF, #D93A72, #E0413A)"; }
        else sw.style.background = it.sprite;
        th.appendChild(sw);
      }
      else {
        var tf = man.thumbs && man.thumbs[it.sprite];
        if (tf) { var img = el("img"); img.alt = ""; img.src = spriteUrl(tf); th.appendChild(img); }
      }
      row.appendChild(th);
      var txt = el("span"); txt.appendChild(el("span", "lr-name", it.name));
      var meta = pk ? PAINT_LABELS[pk] : slotById[targetSlot(it)].label;
      if (where && slotsOfType(man, it.slot).length > 1) meta = "In your lab: " + slotById[where].label.toLowerCase();
      txt.appendChild(el("span", "lr-meta", meta));
      var can = LAB.canBuy(it, state, funds, rank);
      if (it.unlocks && it.kind === "Equipment") txt.appendChild(el("span", "lr-unlockline", "Unlocks " + it.unlocks));
      if (can.state === "rank") txt.appendChild(el("span", "lr-meta", can.why));
      row.appendChild(txt);
      var tag;
      if (inUse) tag = el("span", "lr-tag have", "In your lab");
      else if (mine) tag = el("span", "lr-tag have", isAward(it) ? "Earned" : "Yours");
      else if (isAward(it)) tag = el("span", "lr-tag earn", "Earn it");
      else if (can.state === "rank") tag = el("span", "lr-tag lock", "Locked");
      else tag = el("span", "lr-tag price", money(it.price));
      row.appendChild(tag);
      row.addEventListener("click", function () {
        if (pk && mine && !inUse && it.sprite !== "any") { put(it); return; }       // owned paint: just use it
        preview(it);
      });
      c.appendChild(row);
      if (on) {
        var d = el("div", "lr-detail"); d.appendChild(el("p", null, it.desc || ""));
        var slotId = ui.preview.slotId;
        var btn = el("button", "lr-act"); btn.type = "button";
        if (pk && it.sprite === "any" && mine) {
          d.appendChild(colorPicker(it)); c.appendChild(d); return c;
        }
        if (pk && it.sprite === "any") d.appendChild(el("p", "lr-meta", "After you buy it, pick any color right here, as often as you like."));
        if (!mine) {
          if (!can.ok) { btn.disabled = true; btn.textContent = can.why; }
          else { btn.textContent = "Buy for " + money(it.price); btn.setAttribute("data-buy", it.id); btn.addEventListener("click", function () { buy(it); }); }
        } else if (placedAt(it.id) === slotId) {
          if (isRequired(man, slotId)) { btn.disabled = true; btn.textContent = "In your lab"; }
          else { btn.className = "lr-act alt"; btn.textContent = "Take it out"; btn.addEventListener("click", function () { takeOut(slotId); }); }
        } else { btn.textContent = context === "spot" ? "Put it here" : "Put it in my lab"; btn.addEventListener("click", function () { put(it, slotId); }); }
        d.appendChild(btn); c.appendChild(d);
      }
      return c;
    }
    var PRESETS = ["#FFE7A8", "#FFD6C2", "#FFC4D6", "#E8D5FF", "#CDE7FF", "#CFE8D5", "#F5F0E6", "#D9D9D9",
                   "#F2A541", "#E0413A", "#D93A72", "#6547CF", "#1F8FBF", "#3E9C6E", "#2A1F4A", "#4A4A4A"];
    function colorPicker(it) {
      var k = paintKey(it), cur = (R().paint[k] === it.id && R().colors[k]) || null, f = document.createDocumentFragment();
      var grid = el("div", "lr-colors"); grid.setAttribute("role", "group"); grid.setAttribute("aria-label", "Pick a color");
      PRESETS.forEach(function (hex) {
        var b = el("button", "lr-color"); b.type = "button"; b.style.background = hex; b.setAttribute("aria-label", hex);
        b.setAttribute("aria-pressed", cur === hex ? "true" : "false"); b.setAttribute("data-k", it.id + hex);
        b.addEventListener("click", function () { setColor(it, hex); }); grid.appendChild(b);
      });
      f.appendChild(grid);
      var more = el("label", "lr-more"); more.appendChild(el("span", null, "Or any color at all:"));
      var inp = el("input"); inp.type = "color"; inp.value = (cur || R().colors[k] || ANY_DEFAULT[k]).toLowerCase();
      inp.setAttribute("aria-label", "Any color for your " + PAINT_LABELS[k].toLowerCase());
      inp.addEventListener("input", function () { setColor(it, inp.value, true); });
      inp.addEventListener("change", function () { setColor(it, inp.value); });
      more.appendChild(inp); f.appendChild(more);
      return f;
    }
    function patternSwatch(pat) {
      var s = sv("svg", { width: 40, height: 40, viewBox: "0 0 40 40" });
      s.appendChild(sv("rect", { width: 40, height: 40, rx: 20, fill: "#DCD6EA" }));
      if (pat === "checker") [[0, 0], [20, 20]].forEach(function (p) { s.appendChild(sv("rect", { x: p[0], y: p[1], width: 20, height: 20, fill: "#B9B1CF" })); });
      if (pat === "stripes") [0, 16, 32].forEach(function (y) { s.appendChild(sv("rect", { x: 0, y: y, width: 40, height: 8, fill: "#B9B1CF" })); });
      var clip = sv("clipPath", { id: "lrc" + pat }); clip.appendChild(sv("circle", { cx: 20, cy: 20, r: 20 })); s.insertBefore(clip, s.firstChild);
      Array.prototype.forEach.call(s.querySelectorAll("rect"), function (r) { r.setAttribute("clip-path", "url(#lrc" + pat + ")"); });
      return s;
    }
    function group(title, sub, list) {
      if (!list.length) return null;
      var f = document.createDocumentFragment(), h = el("h3", "lr-group", title);
      if (sub) h.appendChild(el("small", null, sub));
      f.appendChild(h); var l = el("div", "lr-list"); list.forEach(function (c) { l.appendChild(c); }); f.appendChild(l); return f;
    }
    function drawPanel() {
      var keepScroll = panel.scrollTop;
      panel.innerHTML = "";
      var wallet = el("div", "lr-wallet");
      wallet.appendChild(el("span", "lr-funds", money(funds)));
      wallet.appendChild(el("span", "lr-funds-label", "lab funds to spend"));
      var st = el("p", "lr-status", ui.status); st.setAttribute("role", "status"); st.setAttribute("aria-live", "polite"); wallet.appendChild(st);
      panel.appendChild(wallet);
      var un = items.filter(function (it) { return it.kind === "Equipment" && it.unlocks && owns(it.id); }).map(function (it) { return it.unlocks; }), ub = el("div", "lr-unlocks");
      if (un.length) {
        ub.appendChild(el("b", null, "Unlocked by your equipment"));
        var chips = el("div", "lr-chips"); un.forEach(function (t) { chips.appendChild(el("span", "lr-chip", t)); }); ub.appendChild(chips);
      } else ub.textContent = "Buy equipment to unlock new kinds of jobs.";
      panel.appendChild(ub);

      if (ui.spot) {
        var s = slotById[ui.spot], head = el("div", "lr-spothead");
        var back = el("button", "lr-back", "Back"); back.type = "button"; back.setAttribute("data-k", "back"); back.setAttribute("aria-label", "Back to the store");
        back.addEventListener("click", function () { ui.spot = null; ui.preview = null; render(); });
        head.appendChild(back); head.appendChild(el("h3", null, s.label));
        head.appendChild(el("p", null, "Tap something to try it here."));
        panel.appendChild(head);
        var here = items.filter(function (it) { return it.slot === s.type && (!isAward(it) || owns(it.id)); });
        here.sort(function (a, b) { return (owns(b.id) - owns(a.id)) || (a.price - b.price); });
        var list = el("div", "lr-list"); here.forEach(function (it) { list.appendChild(card(it, "spot")); }); panel.appendChild(list);
        if (R().placed[s.id] && !isRequired(man, s.id)) {
          var out = el("button", "lr-act alt", "Leave this spot empty"); out.type = "button"; out.style.marginTop = "10px";
          out.addEventListener("click", function () { takeOut(s.id); }); panel.appendChild(out);
        }
        if (!here.length) panel.appendChild(el("p", "lr-empty", "Nothing fits here yet."));
        return;
      }
      var tabs = el("div", "lr-tabs"); tabs.setAttribute("role", "tablist");
      var stored = items.filter(function (it) { return owns(it.id) && !paintKey(it) && !placedAt(it.id); });
      [["store", "Store"], ["paint", "Paint"], ["storage", "Storage" + (stored.length ? " (" + stored.length + ")" : "")]].forEach(function (t) {
        var b = el("button", null, t[1]); b.type = "button"; b.setAttribute("role", "tab"); b.setAttribute("aria-selected", ui.tab === t[0] ? "true" : "false");
        b.addEventListener("click", function () { ui.tab = t[0]; ui.preview = null; ui.status = ""; render(); });
        tabs.appendChild(b);
      });
      panel.appendChild(tabs);
      var body = document.createDocumentFragment();
      if (ui.tab === "store") {
        var forSale = items.filter(function (it) { return it.price > 0; });
        var eq = forSale.filter(function (it) { return it.kind === "Equipment"; });
        var dec = forSale.filter(function (it) { return it.kind === "Cosmetic" && !paintKey(it) && it.slot !== "poster"; });
        var posters = forSale.filter(function (it) { return it.kind === "Cosmetic" && it.slot === "poster"; });
        var th = forSale.filter(function (it) { return it.kind === "Theme"; });
        [group("Equipment", "Owning these unlocks new kinds of cases.", eq.map(function (it) { return card(it, "store"); })),
         group("Furniture and decor", null, dec.map(function (it) { return card(it, "store"); })),
         group("Posters", "Graphs and famous scientists", posters.map(function (it) { return card(it, "store"); })),
         group("Theme packs", "Frankenstein pack", th.map(function (it) { return card(it, "store"); }))].forEach(function (g) { if (g) body.appendChild(g); });
      } else if (ui.tab === "storage") {
        var inLab = items.filter(function (it) { return owns(it.id) && !paintKey(it) && placedAt(it.id); });
        var toEarn = items.filter(function (it) { return isAward(it) && !owns(it.id); });
        var gs = group("In storage", "Things you own that aren't out. Tap one to put it back.", stored.map(function (it) { return card(it, "storage"); }));
        if (gs) body.appendChild(gs);
        else body.appendChild(el("p", "lr-empty", "Nothing in storage. Anything you take out of your lab waits here, and it's still yours."));
        [group("In your lab", null, inLab.map(function (it) { return card(it, "storage"); })),
         group("Awards to earn", "These can't be bought.", toEarn.map(function (it) { return card(it, "storage"); }))].forEach(function (g) { if (g) body.appendChild(g); });
      } else {
        ["wall", "floor", "trim", "tiles"].forEach(function (k) {
          var g = group(PAINT_LABELS[k], null, items.filter(function (it) { return paintKey(it) === k; }).map(function (it) { return card(it, "paint"); }));
          if (g) body.appendChild(g);
        });
      }
      panel.appendChild(body);
      panel.scrollTop = keepScroll;
    }

    render(); preloadHits();
    return {
      version: VERSION,
      getState: function () { return clone(state); },
      getFunds: function () { return funds; },
      destroy: function () { if (ro) ro.disconnect(); root.innerHTML = ""; }
    };
  }

  window.LabRoom = { version: VERSION, mount: mount };
})();
