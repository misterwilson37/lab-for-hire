/* Builds the feeds a real class would meet, by running the REAL Apps Script code against the REAL seed data with specific edits.
   Usage: node make_feeds.js <outdir>     (play_feed.py serves these files to a real browser) */
const fs = require("fs"), path = require("path");
const T = require("./grid_tools.js");
const { SEED, clone, setWhere, addRow, mapRows, col, feedOf, liveAsFound } = T;
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const save = (name, grid, draft) => fs.writeFileSync(path.join(out, name + ".json"), JSON.stringify(feedOf(grid, draft)));
save("seed", clone(SEED));
{ const g = clone(SEED);   // Hanson edits a title, a price, and a pay rate
  setWhere(g, "Cases", "CaseID", "MOVIN-MOLECULES", "Title", "Edited By Hanson"); setWhere(g, "Cases", "CaseID", "MOVIN-MOLECULES", "Pay", 75);
  setWhere(g, "Items", "ItemID", "pet-cat", "Price", 90); save("edited", g); }
{ const g = clone(SEED); mapRows(g, "Options", (r) => { if (r[0] === "MM-01") r[col(g, "Options", "Correct")] = ""; return r; }); save("broken", g); }
save("asfound", liveAsFound(clone(SEED)));
{ const g = clone(SEED);   // while a student is part-way through PHASE-PROBE, Hanson adds a question and an extra answer choice
  addRow(g, "Questions", { qid: "PH-09", caseid: "PHASE-PROBE", order: 9, role: "Main", skill: "Read a value", type: "Multiple choice", prompt: "Added mid-class: at what temperature does water boil at 1 atm?", why: "At 1 atm the boiling line sits at 100°C." });
  [["A", "100°C", "Yes", ""], ["B", "0°C", "", "CAL-POINT"], ["C", "50°C", "", "CAL-POINT"], ["D", "10°C", "", "CAL-SCALE"]].forEach(([l, t, c, tag]) => addRow(g, "Options", { qid: "PH-09", letter: l, "option text": t, correct: c, "error tag": tag }));
  addRow(g, "Options", { qid: "PH-01", letter: "Z", "option text": "Plasma", "error tag": "CAL-POINT" }); save("midjob_after", g); }
{ const g = clone(SEED); setWhere(g, "Cases", "CaseID", "PHASE-PROBE", "Status", "Draft"); save("removed", g); }
console.log("feeds written to", out);
