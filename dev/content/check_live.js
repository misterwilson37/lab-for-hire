/* Ask the LIVE Sheet's feed what students are getting, and compare it with the copy built into the game.
   Usage: node dev/content/check_live.js        (needs network access to script.google.com and script.googleusercontent.com)
   It only reads. If the Sheet has moved on from the built-in copy (a teacher added a case), that is normal: this says what differs.
   To make the built-in copy match the Sheet again: python3 dev/content/embed_content.py <feed address> */
const assert = require("assert"), fs = require("fs"), path = require("path");
const T = require("../tests/grid_tools.js");
const url = JSON.parse(fs.readFileSync(path.join(T.ROOT, "src/config.json"), "utf8")).feedUrl;
if (!url) { console.log("No feed address is set (src/config.json)."); process.exit(1); }
(async () => {
  const get = async (q) => { const r = await fetch(url + q, { redirect: "follow" }); if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); };
  const live = await get("?fresh=1"), draft = await get("?include=draft&fresh=1");
  console.log(`feed schema ${live.schema}, Sheet says ${live.sheetSchema}, read at ${live.generated}`);
  console.log("blocking errors:", JSON.stringify(live.errors), "| notes:", JSON.stringify(live.warnings));
  let same = true;
  for (const k of T.SECTIONS) {
    let eq = true; try { assert.deepStrictEqual(JSON.parse(JSON.stringify(live[k])), JSON.parse(JSON.stringify(T.snapshot[k]))); } catch (e) { eq = false; same = false; }
    console.log(k.padEnd(10), String(live[k].length).padStart(4), eq ? "same as the built-in copy" : "DIFFERENT from the built-in copy");
  }
  const LFH = T.gas(T.clone(T.TABS)).ctx.LFH, j = LFH.content.judge(live, T.ART);
  console.log("the game accepts this feed:", j.ok, j.why || "", "| held back:", JSON.stringify(j.prepared ? j.prepared.held : {}), "| notes:", JSON.stringify(j.prepared ? j.prepared.warnings : []));
  console.log("dropdown lists vs the game's vocabulary:", JSON.stringify(LFH.checkLists(live.lists)));
  console.log("cases (including drafts):", draft.cases.map((c) => `${c.id}:${c.status}`).join(", "));
  console.log(same && j.ok ? "LIVE FEED OK, and identical to the built-in copy" : j.ok ? "LIVE FEED OK (the Sheet has changed since the built-in copy was made)" : "LIVE FEED HAS A PROBLEM");
  process.exit(j.ok ? 0 : 1);
})().catch((e) => { console.log("Couldn't read the live feed:", e.message); process.exit(1); });
