/* A stand-in for the parts of Google Apps Script that LabForHire.gs uses. Faithful where it matters:
   CacheService rejects values over 100 KB, entries expire, blobs are really gzipped, dialogs are captured. */
const zlib = require("zlib"), vm = require("vm");
function makeGas(grids, opts = {}) {
  const clock = { t: 1_000_000 }, cache = new Map(), calls = { sheets: 0, cacheGets: 0, cachePuts: 0 }, dialogs = [], alerts = [];
  const gridCopy = (g) => g.values.map((r) => r.slice());
  const sheet = (g) => ({
    getDataRange: () => ({ getValues: gridCopy.bind(null, g), getDisplayValues: () => g.display.map((r) => r.slice()) }),
    getRange: (r, c) => ({ getDisplayValue: () => ((g.display[r - 1] || [])[c - 1]) ?? "" }),
  });
  const ss = { getSheetByName: (n) => { calls.sheets++; return grids[n] ? sheet(grids[n]) : null; } };
  const blob = (data) => { const b = Buffer.isBuffer(data) ? data : Array.isArray(data) ? Buffer.from(data) : Buffer.from(String(data)); return { getBytes: () => Array.from(b), getDataAsString: () => b.toString("utf8"), _b: b }; };
  const ctx = {
    console, Math, JSON, Date, Number, String, Object, Array, Set, Map, Error, isNaN, parseInt, parseFloat,
    SpreadsheetApp: { getActiveSpreadsheet: () => (opts.noSheet ? null : ss), getUi: () => ({ createMenu: (n) => { const m = { name: n, items: [], addItem(l, f) { m.items.push([l, f]); return m; }, addToUi() { ctx.__menu = m; } }; return m; },
      showModalDialog: (h, t) => dialogs.push({ html: h.html, title: t }), alert: (...a) => alerts.push(a), ButtonSet: { OK: "OK" } }) },
    CacheService: { getScriptCache: () => ({
      get: (k) => { calls.cacheGets++; const e = cache.get(k); return e && e.exp > clock.t ? e.v : null; },
      getAll: (ks) => { const o = {}; ks.forEach((k) => { const e = cache.get(k); if (e && e.exp > clock.t) o[k] = e.v; }); return o; },
      putAll: (o, ttl) => { calls.cachePuts++; Object.keys(o).forEach((k) => { if (String(o[k]).length > 100000) throw new Error("Argument too large: value"); cache.set(k, { v: String(o[k]), exp: clock.t + ttl * 1000 }); }); },
      remove: (k) => cache.delete(k) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    ContentService: { MimeType: { JSON: "JSON" }, createTextOutput: (t) => { const o = { text: t, mime: null, setMimeType(m) { o.mime = m; return o; }, getContent: () => t }; return o; } },
    HtmlService: { createHtmlOutput: (h) => { const o = { html: h, setWidth() { return o; }, setHeight() { return o; } }; return o; } },
    ScriptApp: { getService: () => ({ getUrl: () => opts.url || null }) },
    Utilities: { newBlob: (d) => blob(d), gzip: (b) => blob(zlib.gzipSync(b._b)), ungzip: (b) => blob(zlib.gunzipSync(b._b)),
      base64Encode: (bytes) => Buffer.from(bytes).toString("base64"), base64Decode: (s) => Array.from(Buffer.from(s, "base64")) },
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(opts.source, ctx, { filename: "LabForHire.gs" });
  return { ctx, calls, dialogs, alerts, cache, clock, run: (code) => vm.runInContext(code, ctx) };
}
module.exports = { makeGas };
