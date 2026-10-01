// Lab Space scene definition, shared by the sprite bake and the reference render.
// ONE locked camera + ONE lighting rig for everything. Change these and every sprite must be re-baked.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export const SCENE_VERSION = "0.1.0";
export const FRAME = { w: 1600, h: 1200 };
export const S = 4;                 // room size
export const IN = -S / 2 + 0.06;    // inner face of both walls (-1.94)
export const TRIM_FRONT = -1.85;     // front face of the baseboard trim
export const FLUSH = TRIM_FRONT + 0.005; // furniture backs sit against the trim, never inside it
export const BENCH = { x: -0.25, w: 1.5, d: 0.8, top: 0.78 };
export const SHELF = { z: 0.45, top: 1.58 };

// ---------- renderer / camera / lights ----------
export function createRenderer() {
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1); r.setSize(FRAME.w, FRAME.h); r.setClearColor(0x000000, 0);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  return r;
}
export function createCamera() {
  const aspect = FRAME.w / FRAME.h, V = 3.1;
  const cam = new THREE.OrthographicCamera(-V * aspect, V * aspect, V, -V, 0.1, 100);
  cam.position.set(8, 7.2, 8); cam.lookAt(0, 1.4, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  return cam;
}
export function addLights(scene, { sun = true } = {}) {
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd9d0ee, 1.35));
  const s = new THREE.DirectionalLight(0xffffff, sun ? 1.6 : 0); s.position.set(5, 9, 3); s.castShadow = sun;
  s.shadow.mapSize.set(2048, 2048); Object.assign(s.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 });
  scene.add(s);
}
export function project(cam, [x, y, z]) {
  const v = new THREE.Vector3(x, y, z).project(cam);
  return [+((v.x + 1) / 2 * FRAME.w).toFixed(2), +((1 - v.y) / 2 * FRAME.h).toFixed(2)];
}

// ---------- paint math (mirrored exactly in the LabRoom module) ----------
export const s2l = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
export const l2s = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
export const hexToRgb = (h) => [0, 2, 4].map((i) => parseInt(h.replace("#", "").slice(i, i + 2), 16) / 255);
export const rgbToHex = (a) => "#" + a.map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0")).join("");
export const TILE_DARKEN = 0.84; // tile color = floor color * 0.84 in linear light
export function tileHex(floorHex) { return rgbToHex(hexToRgb(floorHex).map((c) => l2s(s2l(c) * TILE_DARKEN))); }

// Floor tile patterns, as XZ rectangles. Same list is written to the manifest as polygons.
export function tileRects(pattern) {
  const r = [];
  if (pattern === "checker") {
    for (let i = -2; i < 2; i++) for (let j = -2; j < 2; j++) if ((i + j) % 2 === 0) r.push([i + 0.01, j + 0.01, i + 0.99, j + 0.99]);
  } else if (pattern === "stripes") {
    for (let k = 0; k < 8; k += 2) r.push([-1.99, -2 + k * 0.5 + 0.01, 1.99, -2 + k * 0.5 + 0.49]);
  }
  return r.map(([x0, z0, x1, z1]) => [Math.max(x0, -1.99), Math.max(z0, -1.99), x1, z1]);
}
export const TILE_Y = 0.01;

// ---------- room shell ----------
// Faces the camera can see, in painter's order, clipped so no two faces overlap except same-shade tops.
// normal: px (+x), py (+y), pz (+z). group: which paint colors the face.
export function roomFaces() {
  const q = (a, b, c, d) => [a, b, c, d];
  const F = [];
  const add = (group, normal, pts) => F.push({ group, normal, pts });
  // floor slab x,z [-2,2], y [-0.15,0]
  add("floor", "px", q([2, -0.15, -2], [2, 0, -2], [2, 0, 2], [2, -0.15, 2]));
  add("floor", "pz", q([-2, -0.15, 2], [2, -0.15, 2], [2, 0, 2], [-2, 0, 2]));
  add("floor", "py", q([-2, 0, -2], [2, 0, -2], [2, 0, 2], [-2, 0, 2]));
  // back wall x [-2,2], y [0,3], z [-2.06,-1.94]
  add("wall", "pz", q([-1.94, 0, -1.94], [2, 0, -1.94], [2, 3, -1.94], [-1.94, 3, -1.94]));
  add("wall", "py", q([-2, 3, -2.06], [2, 3, -2.06], [2, 3, -1.94], [-2, 3, -1.94]));
  add("wall", "px", q([2, 0, -2.06], [2, 3, -2.06], [2, 3, -1.94], [2, 0, -1.94]));
  // left wall x [-2.06,-1.94], y [0,3], z [-2,2]
  add("wall", "px", q([-1.94, 0, -1.94], [-1.94, 3, -1.94], [-1.94, 3, 2], [-1.94, 0, 2]));
  add("wall", "py", q([-2.06, 3, -2], [-1.94, 3, -2], [-1.94, 3, 2], [-2.06, 3, 2]));
  add("wall", "pz", q([-2.06, 0, 2], [-1.94, 0, 2], [-1.94, 3, 2], [-2.06, 3, 2]));
  // back trim: visible part x [-1.94,2], y [0,0.12], z [-1.94,-1.85] (the rest is buried in the wall)
  add("trim", "pz", q([-1.85, 0, -1.85], [2, 0, -1.85], [2, 0.12, -1.85], [-1.85, 0.12, -1.85]));
  add("trim", "py", q([-1.94, 0.12, -1.94], [2, 0.12, -1.94], [2, 0.12, -1.85], [-1.94, 0.12, -1.85]));
  add("trim", "px", q([2, 0, -1.94], [2, 0.12, -1.94], [2, 0.12, -1.85], [2, 0, -1.85]));
  // left trim: visible part x [-1.94,-1.85], y [0,0.12], z [-1.94,2]
  add("trim", "px", q([-1.85, 0, -1.85], [-1.85, 0.12, -1.85], [-1.85, 0.12, 2], [-1.85, 0, 2]));
  add("trim", "py", q([-1.94, 0.12, -1.94], [-1.85, 0.12, -1.94], [-1.85, 0.12, 2], [-1.94, 0.12, 2]));
  add("trim", "pz", q([-1.94, 0, 2], [-1.85, 0, 2], [-1.85, 0.12, 2], [-1.94, 0.12, 2]));
  return F;
}
// Where tiles go in painter's order: right after the floor top (index 3).
export const TILES_AFTER = 3;

const flat = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
function boxAt(w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; }

// The real 3D room, used only for the reference render (the overlay check). Same boxes as render_test.html.
export function buildRoom(scene, paint) {
  const g = new THREE.Group();
  const floor = flat(paint.floor), wall = flat(paint.wall), trim = flat(paint.trim);
  g.add(boxAt(S, 0.15, S, floor, 0, -0.075, 0));
  g.add(boxAt(S, 3, 0.12, wall, 0, 1.5, -S / 2));
  g.add(boxAt(0.12, 3, S, wall, -S / 2, 1.5, 0));
  // trims: only the part that shows in front of the walls (same look as render_test, no buried overlap to z-fight)
  g.add(boxAt(3.94, 0.12, 0.09, trim, 0.03, 0.06, -1.895));
  g.add(boxAt(0.09, 0.12, 3.94, trim, -1.895, 0.06, 0.03));
  const tm = flat(tileHex(paint.floor));
  for (const [x0, z0, x1, z1] of tileRects(paint.tiles)) g.add(boxAt(x1 - x0, TILE_Y, z1 - z0, tm, (x0 + x1) / 2, TILE_Y / 2, (z0 + z1) / 2));
  g.traverse((o) => { if (o.isMesh) { o.receiveShadow = true; o.castShadow = false; } });
  scene.add(g); return g;
}

// ---------- slots ----------
// type = the value in the Items tab's Slot column. Draw order = array order (back to front).
export const SLOTS = [
  { id: "rug",         type: "rug",        label: "Rug",            at: { x: -0.15, z: 0.3, y: 0 } },
  { id: "poster-back", type: "poster",     label: "Right wall poster", wall: "back", at: { x: 0.72, y: 2.0 } },
  { id: "poster-left", type: "poster",     label: "Left wall poster",  wall: "left", at: { z: -0.8, y: 2.0 } },
  { id: "plant",       type: "plant",      label: "Corner" },
  { id: "shelf",       type: "shelf",      label: "Shelf" },
  { id: "shelf-top",   type: "shelf-top",  label: "Shelf top", parent: "shelf" },
  { id: "bench",       type: "bench",      label: "Bench" },
  { id: "bench-1",     type: "bench-item", label: "Bench, left",   parent: "bench", f: 0.18 },
  { id: "bench-2",     type: "bench-item", label: "Bench, middle", parent: "bench", f: 0.5 },
  { id: "bench-3",     type: "bench-item", label: "Bench, right",  parent: "bench", f: 0.82 },
  { id: "chair",       type: "chair",      label: "Chair" },
  { id: "machine",     type: "machine",    label: "Floor machine" },
  { id: "lantern",     type: "lantern",    label: "Front corner" },
  { id: "pet",         type: "pet",        label: "Pet" },
];
export const slotById = Object.fromEntries(SLOTS.map((s) => [s.id, s]));

// ---------- homemade low-poly lab gear (Kenney has no lab kit) ----------
const glassMat = () => new THREE.MeshPhongMaterial({ color: 0xDFF3FB, transparent: true, opacity: 0.45, flatShading: true, shininess: 80 });
function lathe(profile, mat, seg = 10) { return new THREE.Mesh(new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), seg), mat); }
function part(g, geo, mat, x, y, z, rx = 0, rz = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.x = rx; m.rotation.z = rz; g.add(m); return m; }
const C = { ink: 0x2A1F4A, body: 0xF1ECFF, pink: 0xD93A72, purple: 0x6547CF, teal: 0x1F8FBF, gold: 0xC98313, wood: 0x8A6A4A, leaf: 0x3E9C6E, leaf2: 0x2F7F5A, pot: 0xC9774F, foam: 0xF7F6FB, light: 0xFFF1A8 };

const P = {
  beaker() {
    const g = new THREE.Group();
    g.add(lathe([[0, 0], [0.16, 0], [0.16, 0.34], [0.175, 0.36]], glassMat()));
    g.add(lathe([[0, 0.01], [0.15, 0.01], [0.15, 0.2], [0, 0.2]], flat(C.pink)));
    return g;
  },
  flask() {
    const g = new THREE.Group();
    g.add(lathe([[0, 0], [0.2, 0], [0.2, 0.03], [0.06, 0.3], [0.06, 0.42], [0.075, 0.44]], glassMat()));
    g.add(lathe([[0, 0.01], [0.19, 0.01], [0.19, 0.03], [0.12, 0.13], [0, 0.13]], flat(C.teal)));
    return g;
  },
  "tube-rack"() {
    const g = new THREE.Group(); const wood = flat(C.wood);
    part(g, new THREE.BoxGeometry(0.44, 0.05, 0.2), wood, 0, 0.025, 0);
    part(g, new THREE.BoxGeometry(0.44, 0.04, 0.2), wood, 0, 0.22, 0);
    [C.pink, C.purple, C.gold].forEach((c, i) => {
      const x = -0.14 + i * 0.14;
      const t = lathe([[0, 0], [0.035, 0.02], [0.035, 0.34], [0.04, 0.35]], glassMat(), 8); t.position.set(x, 0.05, 0); g.add(t);
      const l = lathe([[0, 0], [0.032, 0.02], [0.032, 0.16], [0, 0.16]], flat(c), 8); l.position.set(x, 0.05, 0); g.add(l);
    });
    return g;
  },
  microscope() {
    const g = new THREE.Group(); const body = flat(C.body), dark = flat(C.ink);
    part(g, new THREE.BoxGeometry(0.34, 0.05, 0.28), dark, 0, 0.025, 0);
    part(g, new THREE.BoxGeometry(0.07, 0.42, 0.07), body, 0, 0.26, -0.08);
    part(g, new THREE.BoxGeometry(0.24, 0.03, 0.2), body, 0, 0.17, 0.02);
    part(g, new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8), dark, 0, 0.42, 0.02, -0.5);
    part(g, new THREE.CylinderGeometry(0.035, 0.035, 0.1, 8), body, 0, 0.6, -0.06, -0.5);
    g.scale.setScalar(1.15); g.rotation.y = 0.3;
    return g;
  },
  calorimeter() {
    // coffee-cup calorimeter: two nested foam cups, a lid, a thermometer, a stirrer
    const g = new THREE.Group(); const foam = flat(C.foam);
    g.add(lathe([[0, 0], [0.11, 0], [0.15, 0.3], [0.155, 0.31]], foam, 12));
    const cup2 = lathe([[0, 0], [0.11, 0], [0.15, 0.3], [0.158, 0.31]], foam, 12); cup2.position.y = 0.05; g.add(cup2);
    part(g, new THREE.CylinderGeometry(0.165, 0.165, 0.03, 12), flat(C.purple), 0, 0.37, 0);
    part(g, new THREE.CylinderGeometry(0.014, 0.014, 0.42, 6), glassMat(), 0.05, 0.5, 0.02, 0, -0.12);
    part(g, new THREE.CylinderGeometry(0.008, 0.008, 0.2, 6), flat(0xE0413A), 0.043, 0.44, 0.02, 0, -0.12);
    part(g, new THREE.SphereGeometry(0.022, 8, 6), flat(0xE0413A), 0.028, 0.32, 0.02);
    part(g, new THREE.CylinderGeometry(0.01, 0.01, 0.34, 6), flat(C.ink), -0.06, 0.48, -0.03, 0.12, 0.1);
    part(g, new THREE.TorusGeometry(0.03, 0.008, 4, 10), flat(C.ink), -0.075, 0.65, -0.01, Math.PI / 2);
    return g;
  },
  "lab-bench"() {
    // same footprint and top height as the normalized desk
    const g = new THREE.Group(); const body = flat(C.body), top = flat(C.ink), trim = flat(C.purple);
    const t = BENCH.top, h = t - 0.06;
    part(g, new THREE.BoxGeometry(BENCH.w, 0.06, BENCH.d), top, 0, t - 0.03, 0);
    for (const sx of [-1, 1]) {
      const cx = sx * (BENCH.w / 2 - 0.26);
      part(g, new THREE.BoxGeometry(0.5, h - 0.05, BENCH.d - 0.08), body, cx, 0.05 + (h - 0.05) / 2, -0.02);
      part(g, new THREE.BoxGeometry(0.5, 0.05, BENCH.d - 0.14), flat(0xC9C2DD), cx, 0.025, -0.02);
      part(g, new THREE.BoxGeometry(0.012, h - 0.12, 0.01), top, cx, 0.05 + (h - 0.05) / 2, BENCH.d / 2 - 0.055);
      part(g, new THREE.BoxGeometry(0.03, 0.12, 0.03), trim, cx - 0.05, 0.05 + (h - 0.05) * 0.62, BENCH.d / 2 - 0.045);
      part(g, new THREE.BoxGeometry(0.03, 0.12, 0.03), trim, cx + 0.05, 0.05 + (h - 0.05) * 0.62, BENCH.d / 2 - 0.045);
    }
    part(g, new THREE.BoxGeometry(BENCH.w - 1.04, 0.1, 0.05), body, 0, h - 0.05, -BENCH.d / 2 + 0.06);
    return g;
  },
  "grow-cabinet"() {
    // mini greenhouse: cabinet base, glass case, three plants of different heights, grow light
    const g = new THREE.Group(); const body = flat(C.body), frame = flat(C.purple);
    const W = 0.9, D = 0.58;
    part(g, new THREE.BoxGeometry(W, 0.4, D), body, 0, 0.2, 0);
    part(g, new THREE.BoxGeometry(W - 0.1, 0.012, 0.01), flat(C.ink), 0, 0.3, D / 2 + 0.005);
    part(g, new THREE.BoxGeometry(W + 0.02, 0.04, D + 0.02), frame, 0, 0.42, 0);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(W - 0.02, 0.86, D - 0.02), glassMat()); glass.material.opacity = 0.3; glass.position.set(0, 0.87, 0); g.add(glass);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) part(g, new THREE.BoxGeometry(0.03, 0.9, 0.03), frame, x * (W / 2 - 0.02), 0.87, z * (D / 2 - 0.02));
    part(g, new THREE.BoxGeometry(W + 0.02, 0.08, D + 0.02), body, 0, 1.34, 0);
    part(g, new THREE.BoxGeometry(W - 0.12, 0.035, 0.01), flat(C.light), 0, 1.34, D / 2 + 0.012);
    part(g, new THREE.BoxGeometry(W - 0.12, 0.012, D - 0.12), flat(C.light), 0, 1.296, 0);
    [0.22, 0.36, 0.52].forEach((ht, i) => {
      const x = -0.26 + i * 0.26;
      part(g, new THREE.CylinderGeometry(0.075, 0.06, 0.12, 8), flat(C.pot), x, 0.5, 0.04);
      part(g, new THREE.ConeGeometry(0.11, ht, 6), flat(i % 2 ? C.leaf2 : C.leaf), x, 0.56 + ht / 2, 0.04);
    });
    return g;
  },
  "spark-coil"() {
    // Frankenstein theme: a tall coil and a discharge ball with a spark between them
    const g = new THREE.Group(); const dark = flat(C.ink), metal = flat(0xD8DCEA), copper = flat(C.gold);
    part(g, new THREE.BoxGeometry(0.62, 0.18, 0.46), dark, 0, 0.09, 0);
    part(g, new THREE.CylinderGeometry(0.075, 0.09, 0.8, 10), copper, -0.14, 0.58, 0);
    for (let i = 0; i < 6; i++) part(g, new THREE.CylinderGeometry(0.095, 0.095, 0.025, 10), flat(0x8F5A12), -0.14, 0.26 + i * 0.12, 0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.055, 6, 14), metal); ring.rotation.x = Math.PI / 2; ring.position.set(-0.14, 1.03, 0); g.add(ring);
    part(g, new THREE.CylinderGeometry(0.018, 0.018, 0.62, 6), metal, 0.2, 0.49, 0);
    part(g, new THREE.SphereGeometry(0.075, 10, 8), metal, 0.2, 0.84, 0);
    const bolt = flat(C.light);
    [[[-0.02, 1.0], [0.06, 0.93]], [[0.06, 0.93], [0.04, 0.9]], [[0.04, 0.9], [0.13, 0.86]]].forEach(([[x0, y0], [x1, y1]]) =>
      part(g, new THREE.BoxGeometry(Math.hypot(x1 - x0, y1 - y0), 0.022, 0.022), bolt, (x0 + x1) / 2, (y0 + y1) / 2, 0, 0, Math.atan2(y1 - y0, x1 - x0)));
    return g;
  },
  "materials-tester"() {
    // universal testing machine: frame, crosshead, grips, a sample, control box
    const g = new THREE.Group(); const body = flat(C.body), dark = flat(C.ink);
    part(g, new THREE.BoxGeometry(0.72, 0.26, 0.5), dark, -0.08, 0.13, 0);
    for (const x of [-0.34, 0.18]) part(g, new THREE.BoxGeometry(0.08, 1.12, 0.08), body, x, 0.82, 0);
    part(g, new THREE.BoxGeometry(0.66, 0.14, 0.24), flat(C.gold), -0.08, 1.38, 0);
    part(g, new THREE.BoxGeometry(0.66, 0.1, 0.24), flat(C.gold), -0.08, 0.95, 0);
    part(g, new THREE.BoxGeometry(0.1, 0.1, 0.1), dark, -0.08, 0.34, 0);
    part(g, new THREE.BoxGeometry(0.1, 0.1, 0.1), dark, -0.08, 0.85, 0);
    part(g, new THREE.BoxGeometry(0.05, 0.4, 0.03), flat(C.pink), -0.08, 0.6, 0);
    part(g, new THREE.BoxGeometry(0.2, 0.42, 0.18), body, 0.4, 0.21, 0.08);
    part(g, new THREE.BoxGeometry(0.15, 0.1, 0.01), flat(C.teal), 0.4, 0.33, 0.175);
    part(g, new THREE.BoxGeometry(0.04, 0.04, 0.01), flat(C.pink), 0.36, 0.2, 0.175);
    part(g, new THREE.BoxGeometry(0.04, 0.04, 0.01), flat(C.gold), 0.44, 0.2, 0.175);
    return g;
  },
  // Posters are data: little graphs, built facing +z, centered on the origin.
  "poster-line"() { return poster((g, ink) => { plotLine(g, [[-0.28, -0.2], [-0.1, -0.06], [0.07, 0.1], [0.28, 0.18]], C.pink, true); }); },
  "poster-bars"() {
    return poster((g) => { [0.12, 0.3, 0.2, 0.4].forEach((h, i) => part(g, new THREE.BoxGeometry(0.1, h, 0.02), flat(i === 3 ? C.gold : C.purple), -0.22 + i * 0.15, -0.24 + h / 2, 0.025)); });
  },
  "poster-scatter"() {
    return poster((g) => {
      [[-0.27, -0.2], [-0.2, -0.1], [-0.12, -0.15], [-0.05, 0.0], [0.03, -0.04], [0.1, 0.08], [0.17, 0.05], [0.24, 0.17], [0.29, 0.13]].forEach(([x, y]) => part(g, new THREE.SphereGeometry(0.028, 6, 4), flat(C.teal), x, y, 0.025));
      plotLine(g, [[-0.29, -0.2], [0.3, 0.17]], 0x9FC9DD, false);
    });
  },
};
function plotLine(g, pts, color, dots) {
  const m = flat(color);
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], len = Math.hypot(x1 - x0, y1 - y0);
    part(g, new THREE.BoxGeometry(len, 0.018, 0.012), m, (x0 + x1) / 2, (y0 + y1) / 2, 0.022, 0, Math.atan2(y1 - y0, x1 - x0));
  }
  if (dots) pts.forEach(([x, y]) => part(g, new THREE.SphereGeometry(0.032, 6, 4), m, x, y, 0.025));
}
function poster(draw) {
  const g = new THREE.Group(); const ink = flat(C.ink);
  part(g, new THREE.BoxGeometry(0.9, 0.7, 0.03), flat(0xFFFFFF), 0, 0, 0);
  part(g, new THREE.BoxGeometry(0.012, 0.52, 0.01), ink, -0.34, 0.0, 0.02);   // y axis
  part(g, new THREE.BoxGeometry(0.66, 0.012, 0.01), ink, -0.01, -0.26, 0.02); // x axis
  draw(g, ink);
  return g;
}

// ---------- recipes: the Items tab's Sprite column points here ----------
// model: a Kenney .glb (downloaded to bake/models) or a primitive above. fit: normalize size per slot.
const FURN = 1.8;
export const RECIPES = {
  desk:               { model: "desk", fit: "bench" },
  "lab-bench":        { prim: "lab-bench", fit: "bench" },
  chairdesk:          { model: "chairdesk", scale: FURN, rotY: Math.PI },
  chaircushion:       { model: "chairmoderncushion", scale: FURN * 1.05, rotY: Math.PI },
  bookcaseopen:       { model: "bookcaseopen", fit: "shelf", rotY: Math.PI / 2 },
  bookcaseclosed:     { model: "bookcaseclosed", fit: "shelf", rotY: Math.PI / 2 },
  pottedplant:        { model: "pottedplant", scale: FURN },
  ruground:           { model: "ruground", scale: FURN },
  rugrectangle:       { model: "rugrectangle", scale: FURN * 0.9 },
  beaker:             { prim: "beaker" },
  flask:              { prim: "flask" },
  microscope:         { prim: "microscope" },
  calorimeter:        { prim: "calorimeter" },
  "tube-rack":        { prim: "tube-rack" },
  "grow-cabinet":     { prim: "grow-cabinet" },
  "materials-tester": { prim: "materials-tester" },
  generator:          { model: "machine-generator", width: 1.0 },
  "poster-line":      { prim: "poster-line" },
  "poster-bars":      { prim: "poster-bars" },
  "poster-scatter":   { prim: "poster-scatter" },
  "pet-cat":          { model: "animal-cat", height: 0.5, rotY: 0.5 },
  "pet-dog":          { model: "animal-dog", height: 0.5, rotY: 0.5 },
  "pet-bunny":        { model: "animal-bunny", height: 0.55, rotY: 0.5 },
  books:              { model: "books", scale: 3.2, rotY: Math.PI / 2 },
  candles:            { model: "candle-multiple", scale: 1.3 },
  lantern:            { model: "lantern-candle", height: 0.62 },
  pumpkin:            { model: "pumpkin-carved", height: 0.46, rotY: 0.6 },
  "spark-coil":       { prim: "spark-coil", width: 0.8 },
};

const loader = new GLTFLoader();
const glbCache = {};
async function loadModel(name) {
  if (!glbCache[name]) glbCache[name] = new Promise((res, rej) => loader.load(`models/${name}.glb`, (g) => res(g.scene), undefined, () => rej(new Error("missing model " + name))));
  return (await glbCache[name]).clone(true);
}
const bbox = (o) => { o.updateMatrixWorld(true); return new THREE.Box3().setFromObject(o); };

// Build the item for recipeId, placed in slotId, in world space.
export async function buildItem(recipeId, slotId) {
  const r = RECIPES[recipeId]; if (!r) throw new Error("unknown recipe " + recipeId);
  const slot = slotById[slotId]; if (!slot) throw new Error("unknown slot " + slotId);
  const inner = r.model ? await loadModel(r.model) : P[r.prim]();
  const obj = new THREE.Group(); obj.add(inner);
  if (r.scale) inner.scale.multiplyScalar(r.scale);
  if (r.rotY) inner.rotation.y += r.rotY;
  if (slot.wall === "left") obj.rotation.y = Math.PI / 2;
  let b = bbox(obj), sz = b.getSize(new THREE.Vector3());
  if (r.width) obj.scale.multiplyScalar(r.width / sz.x);
  if (r.height) obj.scale.multiplyScalar(r.height / sz.y);
  if (r.fit === "bench") { obj.scale.multiplyScalar(BENCH.w / sz.x); b = bbox(obj); obj.scale.y *= BENCH.top / b.max.y; }
  if (r.fit === "shelf") {
    // Scale so the TOP BOARD (not the post tips) lands at SHELF.top: every bookcase then gives shelf-top items
    // the same surface, so one shelf-top sprite fits all of them.
    obj.scale.multiplyScalar(SHELF.top / sz.y); obj.updateMatrixWorld(true);
    const bb = bbox(obj), mid = bb.getCenter(new THREE.Vector3());
    const hit = new THREE.Raycaster(new THREE.Vector3(mid.x, 10, mid.z), new THREE.Vector3(0, -1, 0)).intersectObject(obj, true)[0];
    if (hit && hit.point.y > 0.5) obj.scale.multiplyScalar(SHELF.top / hit.point.y);
  }
  b = bbox(obj); const c = b.getCenter(new THREE.Vector3());
  const move = (x, y, z) => { obj.position.x += x; obj.position.y += y; obj.position.z += z; };
  const benchMinZ = FLUSH;
  switch (slot.type) {
    case "bench": move(BENCH.x - c.x, -b.min.y, benchMinZ - b.min.z); break;
    case "bench-item": move(BENCH.x - BENCH.w / 2 + BENCH.w * slot.f - c.x, BENCH.top - b.min.y, benchMinZ + BENCH.d / 2 - c.z); break;
    case "shelf": move(FLUSH - b.min.x, -b.min.y, SHELF.z - c.z); break;
    case "shelf-top": move(FLUSH + 0.225 - c.x, SHELF.top - b.min.y, SHELF.z - c.z); break;
    case "plant": move(IN + 0.12 - b.min.x, -b.min.y, IN + 0.12 - b.min.z); break;
    case "machine": move(1.42 - c.x, -b.min.y, FLUSH - b.min.z); break;
    case "chair": move(BENCH.x + 0.05 - c.x, -b.min.y, benchMinZ + BENCH.d + 0.38 - c.z); break;
    case "rug": move(slot.at.x - c.x, -b.min.y, slot.at.z - c.z); break;
    case "pet": move(0.8 - c.x, -b.min.y, 0.95 - c.z); break;
    case "lantern": move(IN + 0.22 - b.min.x, -b.min.y, 1.5 - c.z); break;
    case "poster":
      if (slot.wall === "back") move(slot.at.x - c.x, slot.at.y - c.y, IN + 0.012 - b.min.z);
      else move(IN + 0.012 - b.min.x, slot.at.y - c.y, slot.at.z - c.z);
      break;
    default: throw new Error("no placement rule for slot type " + slot.type);
  }
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  obj.updateMatrixWorld(true);
  return obj;
}

// ---------- shadow catchers ----------
// When an item is baked alone, invisible planes catch its shadow where the room (or its parent) would be.
// opacity per surface is measured so an overlay darkens by the same amount the real sun-blocked surface would.
export function catchersFor(slotId, opac) {
  const slot = slotById[slotId]; const out = [];
  // Invisible planes that only show shadow. Each sits exactly on a room surface the student sees, and never
  // under anything drawn later: floor stops at the trim, walls start above the trim, child slots only
  // catch above their parent's top (below it, the parent's own sprite is painted over them).
  const T = 0.12, TF = TRIM_FRONT; // trim height, trim front
  const plane = (w, h, op) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.ShadowMaterial({ opacity: op }));
  const flatAt = (x0, x1, z0, z1, y) => { const m = plane(x1 - x0, z1 - z0, opac.py); m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); out.push(m); };
  const backAt = (x0, x1, y0, y1, z) => { const m = plane(x1 - x0, y1 - y0, opac.pz); m.position.set((x0 + x1) / 2, (y0 + y1) / 2, z); out.push(m); };
  const leftAt = (z0, z1, y0, y1, x) => { const m = plane(z1 - z0, y1 - y0, opac.px); m.rotation.y = Math.PI / 2; m.position.set(x, (y0 + y1) / 2, (z0 + z1) / 2); out.push(m); };
  const back = (y0) => backAt(IN, 2, y0, 3, IN + 0.002);
  const left = (y0) => leftAt(IN, 2, y0, 3, IN + 0.002);
  const floorAndTrim = () => {
    flatAt(TF, 2, TF, 2, 0.012);                 // floor, in front of the trims
    backAt(TF, 2, 0, T, TF + 0.002);             // back trim front
    flatAt(IN, 2, IN, TF, T + 0.002);            // back trim top
    leftAt(TF, 2, 0, T, TF + 0.002);             // left trim front
    flatAt(IN, TF, TF, 2, T + 0.002);            // left trim top
  };
  if (slot.type === "bench-item") {
    flatAt(BENCH.x - BENCH.w / 2, BENCH.x + BENCH.w / 2, FLUSH, FLUSH + BENCH.d, BENCH.top + 0.002); back(BENCH.top);
  } else if (slot.type === "shelf-top") {
    flatAt(FLUSH, FLUSH + 0.45, SHELF.z - 0.36, SHELF.z + 0.36, SHELF.top + 0.002); left(SHELF.top);
  } else if (slot.type === "poster") {
    slot.wall === "back" ? back(T) : left(T);
  } else { floorAndTrim(); back(T); left(T); }
  out.forEach((m) => { m.receiveShadow = true; m.castShadow = false; });
  return out;
}
