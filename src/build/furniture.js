import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { extrudeXZ, worldUV } from '../geometry.js';
import { LV, rearZ, REAR_T } from '../config.js';

// ---------------------------------------------------------------------------
// Furniture, placed where the furnished plan shows it (positions converted
// from the drawing). All pieces are simple procedural models.
// ---------------------------------------------------------------------------

// Finished floor and ceiling of the storey being furnished (switched for the first
// floor and the roof in buildFurniture)
let F = LV.gf;
let CEIL = LV.gfCeil;

let M; // material getter
let group;
let colliders;
let walkables;

function mesh(geo, mat, x, y, z, parent = group, { ry = 0, uv = true, shadow = true } = {}) {
  if (uv) worldUV(geo);
  const m = new THREE.Mesh(geo, typeof mat === 'string' ? M(mat) : mat);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.castShadow = shadow;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const rbox = (w, h, d, r = 0.1, s = 3) => new RoundedBoxGeometry(w, h, d, s, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001));
const cyl = (r0, r1, h, s = 16) => new THREE.CylinderGeometry(r0, r1, h, s);

/** Creates an item group at (x, floor, z) rotated by ry and registers an optional collider. */
function item(x, z, ry = 0, y = F) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  group.add(g);
  return g;
}
function collide(x0, x1, z0, z1, h = 3, y0 = F) {
  colliders.push({ x0, x1, z0, z1, y0, y1: y0 + h, id: 'furniture' });
}

// ---------------------------------------------------------------------------
// Pieces. Local frame: the piece "faces" +z (its front), centred on x/z,
// sitting on y = 0.
// ---------------------------------------------------------------------------
function bed(g, w, l, blanket) {
  mesh(rbox(w, 1.0, l, 0.08), 'furnWood', 0, 0.55, 0, g);
  mesh(rbox(w - 0.2, 0.7, l - 0.3, 0.2), 'sheet', 0, 1.35, 0.1, g);
  mesh(rbox(w + 0.1, 3.6, 0.35, 0.1), 'furnWood', 0, 1.8, -l / 2 - 0.1, g); // back face at -l/2 - 0.275
  mesh(rbox(w - 0.5, 1.9, 0.2, 0.15), 'sofa', 0, 2.6, -l / 2 + 0.12, g);
  for (const s of [-1, 1]) mesh(rbox(w * 0.42, 0.45, 1.1, 0.2), 'pillow', s * w * 0.23, 1.85, -l / 2 + 0.85, g);
  mesh(rbox(w + 0.1, 0.18, l * 0.58, 0.08), blanket, 0, 1.73, l * 0.2, g);
  mesh(rbox(w + 0.12, 0.5, 0.12, 0.05), blanket, 0, 1.5, l * 0.2 + l * 0.29, g);
}
function sideTable(g, withLamp = true) {
  mesh(rbox(1.2, 1.8, 1.1, 0.05), 'furnWood', 0, 0.9, 0, g);
  mesh(box(1.0, 0.03, 0.02), 'brass', 0, 1.3, 0.56, g);
  if (withLamp) {
    mesh(cyl(0.1, 0.18, 0.8), 'brass', 0, 2.2, 0, g);
    mesh(cyl(0.3, 0.42, 0.55, 20), 'lampShade', 0, 2.85, 0, g, { uv: false });
  }
}
function wardrobe(g, w, h = 7.2, d = 1.9, mat = 'laminate') {
  mesh(box(w, h, d), mat, 0, h / 2, 0, g);
  const doors = Math.max(2, Math.round(w / 1.6));
  for (let i = 1; i < doors; i++) mesh(box(0.03, h - 0.4, 0.02), 'laminateGrey', -w / 2 + (w * i) / doors, h / 2, d / 2 + 0.005, g, { uv: false });
  for (let i = 0; i < doors; i++) {
    const cx = -w / 2 + (w * (i + 0.5)) / doors + (i % 2 ? -1 : 1) * (w / doors) * 0.35;
    mesh(box(0.05, 1.4, 0.06), 'brass', cx, h * 0.5, d / 2 + 0.03, g, { uv: false });
  }
  mesh(box(w, 0.25, d - 0.2), 'laminateGrey', 0, 0.12, -0.1, g);
}
function tv(g, w = 3.7, h = 2.1) {
  mesh(rbox(w, h, 0.12, 0.03), 'screen', 0, 0, 0, g);
  mesh(box(w - 0.1, h - 0.1, 0.01), 'tvScreen', 0, 0, 0.065, g, { uv: false });
}
function tvConsole(g, w) {
  mesh(rbox(w, 1.4, 1.25, 0.05), 'furnWood', 0, 0.8, 0, g);
  for (let i = 0; i < 3; i++) mesh(box(w / 3 - 0.1, 1.1, 0.02), 'laminate', -w / 3 + (w / 3) * i, 0.8, 0.63, g, { uv: false });
  mesh(box(w, 0.1, 1.0), 'blackMatte', 0, 0.05, -0.05, g);
}
function sofa(g, len, depth = 2.85, seats = 3, mat = 'sofa') {
  const h = 1.3;
  mesh(rbox(len, h, depth, 0.15), mat, 0, h / 2 + 0.3, 0, g);
  mesh(rbox(len, 1.6, 0.6, 0.2), mat, 0, 2.3, -depth / 2 + 0.3, g);
  for (const s of [-1, 1]) mesh(rbox(0.55, 1.1, depth, 0.2), mat, s * (len / 2 - 0.27), 2.0, 0, g);
  const sw = (len - 1.1) / seats;
  for (let i = 0; i < seats; i++) {
    const x = -len / 2 + 0.55 + sw * (i + 0.5);
    mesh(rbox(sw - 0.05, 0.45, depth - 0.7, 0.18), mat, x, h + 0.5, 0.25, g);
    mesh(rbox(sw - 0.1, 1.3, 0.45, 0.2), mat, x, 2.25, -depth / 2 + 0.75, g);
  }
  mesh(rbox(1.1, 1.0, 0.35, 0.2), 'cushionMustard', -len / 2 + 1.1, 2.1, -depth / 2 + 1.05, g, { ry: 0.15 });
  mesh(rbox(1.1, 1.0, 0.35, 0.2), 'sofaAccent', len / 2 - 1.1, 2.1, -depth / 2 + 1.05, g, { ry: -0.15 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(cyl(0.06, 0.04, 0.3, 8), 'blackMatte', sx * (len / 2 - 0.3), 0.15, sz * (depth / 2 - 0.3), g, { uv: false });
}
function armchair(g, w = 3.0, d = 2.7) {
  sofa(g, w, d, 1, 'sofaAccent');
}
function coffeeTable(g, w, d) {
  mesh(rbox(w, 0.12, d, 0.04), 'furnWood', 0, 1.35, 0, g);
  mesh(box(w - 0.3, 0.04, d - 0.3), 'glass', 0, 1.43, 0, g, { uv: false, shadow: false });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(box(0.14, 1.3, 0.14), 'furnWood', sx * (w / 2 - 0.15), 0.65, sz * (d / 2 - 0.15), g);
  mesh(box(w - 0.3, 0.06, d - 0.3), 'furnWood', 0, 0.35, 0, g);
  mesh(cyl(0.35, 0.25, 0.3, 16), 'ceramic', 0.1, 1.56, -0.4, g, { uv: false });
}
function diningTable(g, w, l) {
  mesh(rbox(w, 0.18, l, 0.06), 'furnWood', 0, 2.45, 0, g);
  for (const sz of [-1, 1]) {
    mesh(box(0.25, 2.35, 0.25), 'furnWood', 0, 1.18, sz * (l / 2 - 0.7), g);
    mesh(box(w - 0.6, 0.2, 0.3), 'furnWood', 0, 0.12, sz * (l / 2 - 0.7), g);
  }
  mesh(box(0.2, 0.15, l - 1.4), 'furnWood', 0, 1.4, 0, g);
  mesh(cyl(0.45, 0.35, 0.35, 20), 'ceramic', 0, 2.72, 0, g, { uv: false });
  for (let i = 0; i < 3; i++) mesh(new THREE.SphereGeometry(0.16, 12, 8), i === 1 ? 'saffron' : 'leaf', -0.1 + i * 0.12, 2.95, (i - 1) * 0.1, g, { uv: false });
}
function chair(g) {
  mesh(rbox(1.5, 0.3, 1.45, 0.06), 'chairFabric', 0, 1.55, 0, g);
  mesh(rbox(1.5, 1.8, 0.22, 0.08), 'chairFabric', 0, 2.55, -0.65, g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(box(0.12, 1.45, 0.12), 'furnWood', sx * 0.62, 0.72, sz * 0.6, g);
}
function ceilingFan(x, z, blades = 'furnWood') {
  const g = item(x, z, Math.random() * 3, CEIL);
  mesh(cyl(0.05, 0.05, 1.2, 8), 'white', 0, -0.6, 0, g, { uv: false, shadow: false });
  mesh(cyl(0.38, 0.32, 0.32, 20), 'white', 0, -1.3, 0, g, { uv: false });
  for (let i = 0; i < 3; i++) {
    const b = mesh(box(1.85, 0.03, 0.38), blades, 0, -1.33, 0, g, { shadow: false });
    b.geometry.translate(1.25, 0, 0);
    b.rotation.y = (i * Math.PI * 2) / 3;
  }
  mesh(new THREE.SphereGeometry(0.22, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 'lampShade', 0, -1.47, 0, g, { uv: false }).rotation.x = Math.PI;
}
function ceilingLight(x, z, r = 0.45) {
  mesh(cyl(r, r, 0.06, 24), 'lightPanel', x, CEIL - 0.03, z, group, { uv: false, shadow: false });
}
/** Cascade of frosted glass globes hanging on long wires from the double-height ceiling. */
function globeChandelier(cx, cz) {
  const top = LV.ffCeil;
  mesh(cyl(1.1, 1.1, 0.06, 32), 'brass', cx, top - 0.03, cz, group, { uv: false, shadow: false });
  const n = 15;
  for (let i = 0; i < n; i++) {
    const a = i * 2.39996;                        // golden-angle spiral
    const r = 0.2 + 0.75 * Math.sqrt((i + 0.5) / n);
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    const y = LV.gf + 7.4 + ((i * 7) % n) / n * 4.6; // 7′-4″ … 12′ above the floor
    const len = top - y - 0.3;
    mesh(cyl(0.012, 0.012, len, 4), 'blackMatte', x, y + 0.3 + len / 2, z, group, { uv: false, shadow: false });
    mesh(cyl(0.05, 0.05, 0.12, 8), 'brass', x, y + 0.3, z, group, { uv: false, shadow: false });
    mesh(new THREE.SphereGeometry(0.27, 16, 12), 'globeGlass', x, y, z, group, { uv: false, shadow: false });
  }
}
/** Long cylindrical pendant lamp hanging from the double-height ceiling (bottom at y). */
function pendant(x, z, y) {
  const len = LV.ffCeil - y - 0.9;
  mesh(cyl(0.015, 0.015, len, 4), 'blackMatte', x, y + 0.9 + len / 2, z, group, { uv: false, shadow: false });
  mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 20, 1, true), 'blackMatte', x, y + 0.45, z, group, { uv: false });
  mesh(cyl(0.28, 0.28, 0.02, 20), 'lampShade', x, y + 0.05, z, group, { uv: false, shadow: false });
  mesh(cyl(0.3, 0.3, 0.04, 16), 'blackMatte', x, LV.ffCeil - 0.02, z, group, { uv: false, shadow: false });
}
function plant(x, z, s = 1, y = F, pot = 'pot') {
  const g = item(x, z, 0, y);
  mesh(cyl(0.55 * s, 0.4 * s, 1.1 * s, 16), pot, 0, 0.55 * s, 0, g, { uv: false });
  mesh(cyl(0.5 * s, 0.5 * s, 0.05, 16), 'soil', 0, 1.08 * s, 0, g, { uv: false });
  for (let i = 0; i < 6; i++) {
    const a = i * 1.1;
    const leaf = mesh(new THREE.IcosahedronGeometry(0.45 * s, 0), i % 2 ? 'leaf' : 'leafDark', Math.cos(a) * 0.35 * s, (1.6 + i * 0.28) * s, Math.sin(a) * 0.35 * s, g, { uv: false });
    leaf.scale.set(1, 1.5, 1);
  }
  return g;
}
function wallArt(x, y, z, ry, w = 3, h = 2, mat = 'art') {
  const g = item(x, z, ry, y);
  mesh(box(w + 0.2, h + 0.2, 0.08), 'blackMatte', 0, 0, 0, g, { uv: false });
  const a = mesh(new THREE.PlaneGeometry(w, h), mat, 0, 0, 0.045, g, { uv: false, shadow: false });
  a.castShadow = false;
}
function curtainGeo(w, h) {
  const geo = new THREE.PlaneGeometry(w, h, 24, 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) / w) * Math.PI * 9) * 0.12);
  geo.computeVertexNormals();
  return geo;
}
/** Curtains on both sides of a window. axis: 'x' wall runs along x, 'z' along z. face: plane coordinate, dir: +1/-1 into room */
function curtains(axis, face, a, b, dir, mat = 'sofa') {
  const h = 7.6, y = F + 0.1 + h / 2;
  const cw = 1.3;
  const off = face + dir * 0.35;
  for (const [c] of [[a - 0.3 + cw / 2], [b + 0.3 - cw / 2]]) {
    const m = new THREE.Mesh(curtainGeo(cw, h), M(mat));
    m.castShadow = true; m.receiveShadow = true;
    if (axis === 'x') { m.position.set(c, y, off); }
    else { m.position.set(off, y, c); m.rotation.y = Math.PI / 2; }
    group.add(m);
  }
  const rod = new THREE.Mesh(cyl(0.04, 0.04, b - a + 1.2, 8), M('brass'));
  rod.rotation.z = Math.PI / 2;
  if (axis === 'x') rod.position.set((a + b) / 2, F + 7.85, off);
  else { rod.position.set(off, F + 7.85, (a + b) / 2); rod.rotation.set(Math.PI / 2, 0, 0); }
  group.add(rod);
}

// ---------------------------------------------------------------------------
function kitchen() {
  const r = 1.2;
  const front = -44.72, inner = 32.58;
  const x0 = 22.922, x1 = 34.581, zEnd = -38.321;
  const arc = (rad, ix, fz) => {
    const pts = [];
    const cx = ix - rad, cz = fz + rad;
    for (let i = 0; i <= 8; i++) {
      const t = (i / 8) * (Math.PI / 2);
      pts.push([cx + rad * Math.cos(t), cz - rad * Math.sin(t)]);
    }
    return pts;
  };
  const outline = (inset) => {
    const fz = front + inset, ix = inner + inset;
    return [
      [x0, rearZ(x0) + REAR_T], [x1, rearZ(x1) + REAR_T], [x1, zEnd], [ix, zEnd],
      ...arc(r - inset, ix, fz), [x0, fz],
    ];
  };
  const top = extrudeXZ(outline(0), [], F + 2.75, F + 2.9);
  mesh(top, 'graniteBlack', 0, 0, 0, group, { uv: false });
  const cab = extrudeXZ(outline(0.12), [], F + 0.35, F + 2.75);
  mesh(cab, 'laminateSage', 0, 0, 0, group, { uv: false });
  const kick = extrudeXZ(outline(0.35), [], F, F + 0.35);
  mesh(kick, 'blackMatte', 0, 0, 0, group, { uv: false });
  // shutter handles
  for (let x = x0 + 0.9; x < inner - 1.2; x += 1.6) mesh(box(0.7, 0.05, 0.06), 'steel', x, F + 2.45, front + 0.12 - 0.04, group, { uv: false });
  for (let z = front + 1.8; z < zEnd - 0.4; z += 1.6) mesh(box(0.06, 0.05, 0.7), 'steel', inner + 0.12 - 0.04, F + 2.45, z, group, { uv: false });
  colliders.push({ x0, x1, z0: rearZ(x1), z1: front, y0: F, y1: F + 3, id: 'counter' });
  colliders.push({ x0: inner, x1, z0: front, z1: zEnd, y0: F, y1: F + 3, id: 'counter' });
  // hob
  const hob = item(25.6, -45.8);
  mesh(rbox(3.0, 0.08, 1.5, 0.03), 'screen', 0, 2.95, 0, hob, { uv: false });
  for (const s of [-1, 1]) {
    mesh(cyl(0.34, 0.34, 0.06, 20), 'steel', s * 0.75, 3.0, 0, hob, { uv: false });
    mesh(cyl(0.18, 0.18, 0.08, 16), 'blackMatte', s * 0.75, 3.03, 0, hob, { uv: false });
  }
  // chimney hood
  const hz = rearZ(25.6) + REAR_T;
  mesh(box(2.8, 0.9, 1.6), 'steel', 25.6, F + 5.8, hz + 0.8, group, { uv: false });
  mesh(box(1.0, 0.75, 0.9), 'steel', 25.6, F + 6.625, hz + 0.45, group, { uv: false }); // ducted out below the glass
  // upper cabinets
  const uz = rearZ(31) + REAR_T;
  // (kept below the glass that starts at door height)
  mesh(box(6.4, 1.8, 1.1), 'laminate', 31.3, F + 6.1, uz + 0.55, group);
  for (let i = 1; i < 4; i++) mesh(box(0.03, 1.7, 0.02), 'laminateGrey', 28.1 + i * 1.6, F + 6.1, uz + 1.11, group, { uv: false });
  mesh(box(1.1, 2.4, 3.6), 'laminate', 34.03, F + 6.7, -42.6, group);
  // sink + faucet
  mesh(box(1.5, 0.04, 2.3), 'steel', 33.6, F + 2.93, -40.0, group, { uv: false });
  mesh(box(1.25, 0.05, 1.0), 'blackMatte', 33.6, F + 2.955, -40.55, group, { uv: false });
  mesh(box(1.25, 0.05, 1.0), 'blackMatte', 33.6, F + 2.955, -39.45, group, { uv: false });
  mesh(cyl(0.05, 0.05, 1.1, 8), 'chrome', 34.3, F + 3.45, -40.0, group, { uv: false });
  const spout = mesh(cyl(0.04, 0.04, 0.7, 8), 'chrome', 34.0, F + 3.95, -40.0, group, { uv: false });
  spout.rotation.z = Math.PI / 2;
  // a few objects on the counter
  mesh(cyl(0.3, 0.3, 0.8, 16), 'steel', 30.2, F + 3.3, -46.1, group, { uv: false });
  mesh(cyl(0.22, 0.22, 0.5, 16), 'pot', 30.9, F + 3.15, -45.9, group, { uv: false });
  mesh(box(1.2, 0.8, 0.9), 'laminateGrey', 33.7, F + 3.3, -43.6, group, { uv: false });
}

/** WC with its cistern towards local -z (ry turns it; ry = -π/2 puts the cistern on the +x wall). */
function wcUnit(x, z, ry) {
  const wc = item(x, z, ry);
  mesh(rbox(1.3, 1.2, 0.6, 0.12), 'ceramic', 0, 1.9, -0.95, wc, { uv: false });
  mesh(rbox(1.15, 1.25, 1.7, 0.35), 'ceramic', 0, 0.62, 0.05, wc, { uv: false });
  mesh(rbox(1.2, 0.08, 1.75, 0.3), 'ceramic', 0, 1.3, 0.08, wc, { uv: false });
}
/** Wall-hung basin and mirror; the wall is on local -z. */
function basinUnit(x, z, ry) {
  const b = item(x, z, ry);
  mesh(rbox(1.6, 0.55, 1.25, 0.15), 'ceramic', 0, 2.75, 0, b, { uv: false });
  mesh(box(1.3, 0.05, 0.9), 'basinInner', 0, 3.03, 0.05, b, { uv: false });
  mesh(cyl(0.04, 0.04, 0.5, 8), 'chrome', 0, 3.25, -0.45, b, { uv: false });
  mesh(box(1.6, 2.1, 0.04), 'mirror', 0, 4.9, -0.62, b, { uv: false });
}
/** Shower head, mixer and towel rail on a wall at local z = 0, facing +z. */
function showerUnit(x, z, ry) {
  const s = item(x, z, ry);
  mesh(cyl(0.3, 0.3, 0.05, 20), 'chrome', 0, 6.5, 0.45, s, { uv: false }).rotation.x = Math.PI / 2 - 0.4;
  mesh(cyl(0.03, 0.03, 0.5, 8), 'chrome', 0, 6.6, 0.25, s, { uv: false }).rotation.x = Math.PI / 2;
  mesh(box(0.35, 0.35, 0.1), 'chrome', 0, 3.6, 0.03, s, { uv: false });
  mesh(cyl(0.03, 0.03, 1.4, 8), 'chrome', 0.9, 4.2, 0.12, s, { uv: false }).rotation.z = Math.PI / 2;
}
function toiletSet(wcX, wcZ, basin, shower) {
  // WC facing -x (cistern against the east wall)
  wcUnit(wcX, wcZ, -Math.PI / 2);
  collide(wcX - 1.2, wcX + 1.2, wcZ - 0.7, wcZ + 0.7, 2);
  basinUnit(basin[0], basin[1], basin[2]);
  showerUnit(shower[0], shower[1], shower[2]);
}
/** Frameless glass shower screen between two plan points. */
function showerScreen(x0, z0, x1, z1, h = 6.6) {
  const w = Math.hypot(x1 - x0, z1 - z0);
  const s = mesh(box(w, h, 0.03), 'glass', (x0 + x1) / 2, F + 0.1 + h / 2, (z0 + z1) / 2, group, { uv: false, shadow: false });
  s.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
  mesh(box(w, 0.06, 0.06), 'chrome', (x0 + x1) / 2, F + 0.13, (z0 + z1) / 2, group, { uv: false }).rotation.y = s.rotation.y;
  collide(Math.min(x0, x1) - 0.06, Math.max(x0, x1) + 0.06, Math.min(z0, z1) - 0.06, Math.max(z0, z1) + 0.06, h);
}
/** Floor rug (walkable, so walk mode stands on it). */
function rug(x, z, w, d, ry = 0) {
  const r = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), M('rug'));
  r.position.set(x, F + 0.02, z);
  r.rotation.y = ry;
  r.receiveShadow = true;
  group.add(r);
  walkables.push(r);
  return r;
}

function mandir() {
  const cx = 3.3, zb = rearZ(cx) + REAR_T;
  const g = item(cx, zb + 0.7);
  mesh(rbox(3.2, 2.3, 1.25, 0.05), 'furnWood', 0, 1.15, 0, g);
  mesh(box(3.4, 0.14, 1.4), 'furnLight', 0, 2.37, 0, g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(cyl(0.06, 0.06, 2.1, 10), 'gold', sx * 1.4, 3.49, sz * 0.48, g, { uv: false });
  mesh(box(3.4, 0.22, 1.4), 'furnLight', 0, 4.65, 0, g);
  mesh(new THREE.ConeGeometry(1.0, 1.1, 4), 'gold', 0, 5.3, 0, g, { uv: false }).rotation.y = Math.PI / 4;
  mesh(new THREE.SphereGeometry(0.12, 12, 8), 'gold', 0, 5.92, 0, g, { uv: false });
  // idol + diyas + flowers
  mesh(cyl(0.22, 0.32, 0.7, 12), 'gold', 0, 2.8, -0.2, g, { uv: false });
  mesh(new THREE.SphereGeometry(0.2, 12, 10), 'gold', 0, 3.33, -0.2, g, { uv: false });
  for (const s of [-1, 1]) {
    mesh(cyl(0.12, 0.08, 0.08, 12), 'pot', s * 0.9, 2.48, 0.35, g, { uv: false });
    mesh(new THREE.SphereGeometry(0.05, 8, 6), 'lampShade', s * 0.9, 2.58, 0.35, g, { uv: false });
    mesh(new THREE.TorusGeometry(0.26, 0.06, 6, 16), 'saffron', s * 0.9, 2.95, -0.15, g, { uv: false });
  }
  collide(1.5, 5.1, zb, zb + 1.4, 6);
}

/**
 * Full-size 7-seat SUV (an original, generic design with no make or badges), parked
 * nose-out in the portico. Built in a local frame with the nose towards -z and the
 * wheels on y = 0, then turned round so it faces the gate.
 */
function suv() {
  const cx = 5.5, cz = -9.6;
  const g = item(cx, cz, Math.PI, LV.portico);
  const L = 15.6, W = 6.05, R = 1.2;            // length, body width, wheel radius (ft)
  const axF = 4.9, axR = -4.3;                  // axles, measured forwards (u) from the middle
  const part = (geo, mat, x = 0, y = 0, z = 0) => mesh(geo, mat, x, y, z, g, { uv: false });
  // side profile (u forwards, v up) extruded across the car: shape +u becomes -z
  const side = (shape, width, bevel = 0.08) => {
    const geo = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 20 });
    geo.translate(0, 0, -width / 2);
    geo.rotateY(Math.PI / 2);
    return geo;
  };
  const pts = (list) => list.map(([u, v]) => new THREE.Vector2(u, v));

  // ---- body: sills, wheel arches, bumpers, bonnet and waist ----
  const Ra = R + 0.26, a0 = 0.14, ax = Ra * Math.cos(a0), ay = R - Ra * Math.sin(a0);
  const b = new THREE.Shape();
  b.moveTo(-7.62, 1.12);
  b.lineTo(axR - ax - 0.2, 1.0);
  b.lineTo(axR - ax, ay);
  b.absarc(axR, R, Ra, Math.PI + a0, -a0, true);
  b.lineTo(axR + ax + 0.1, 0.8);
  b.lineTo(axF - ax - 0.1, 0.8);
  b.lineTo(axF - ax, ay);
  b.absarc(axF, R, Ra, Math.PI + a0, -a0, true);
  b.lineTo(7.45, 1.08);
  b.lineTo(7.78, 1.55);
  b.lineTo(7.86, 2.95);
  b.quadraticCurveTo(7.84, 3.45, 7.4, 3.56);
  b.lineTo(3.1, 3.86);
  b.lineTo(-7.45, 3.8);
  b.quadraticCurveTo(-7.78, 3.76, -7.8, 3.45);
  b.lineTo(-7.78, 1.45);
  b.closePath();
  part(side(b, W - 0.16), 'carPaint');

  // ---- glasshouse, roof and window frames ----
  const gw = W - 0.62;
  const gh = new THREE.Shape(pts([[3.05, 3.84], [0.95, 5.84], [-6.95, 5.82], [-7.3, 5.55], [-7.5, 3.8]]));
  part(side(gh, gw, 0.06), 'carGlass');
  const roof = new THREE.Shape(pts([[1.05, 5.78], [-7.0, 5.76], [-7.02, 5.98], [0.8, 6.0]]));
  part(side(roof, gw - 0.1, 0.05), 'carPaint');
  // body-coloured frame on each side: A/B/C/D pillars round three windows
  const frame = new THREE.Shape(pts([[3.12, 3.8], [0.98, 5.88], [-6.98, 5.86], [-7.36, 5.56], [-7.54, 3.78]]));
  const win = (list) => frame.holes.push(new THREE.Path(pts(list)));
  win([[2.53, 4.0], [0.83, 5.62], [-1.3, 5.62], [-1.3, 4.0]]);         // front door
  win([[-1.75, 4.0], [-1.75, 5.62], [-4.45, 5.62], [-4.45, 4.0]]);     // rear door
  win([[-4.85, 4.0], [-4.85, 5.62], [-6.75, 5.62], [-7.12, 5.28], [-7.22, 4.0]]); // third row
  for (const sx of [-1, 1]) part(side(frame, 0.05, 0), 'carPaint', sx * (gw / 2 + 0.085));
  // window line trim, door shut lines, handles
  for (const sx of [-1, 1]) {
    const xs = sx * (W / 2 + 0.005);
    part(box(0.03, 0.09, 10.7), 'chrome', sx * (gw / 2 + 0.12), 3.93, 2.1);
    for (const [u, v0, v1] of [[2.95, 1.35, 3.8], [-1.52, 0.95, 3.82], [-4.62, 2.2, 3.8]]) part(box(0.02, v1 - v0, 0.035), 'blackMatte', xs, (v0 + v1) / 2, -u);
    for (const u of [0.55, -2.75]) part(rbox(0.07, 0.1, 0.5, 0.04), 'chrome', sx * (W / 2 + 0.03), 3.38, -u);
    // mirror on a short arm
    part(rbox(0.36, 0.38, 0.62, 0.12), 'carPaint', sx * (W / 2 + 0.36), 4.12, -2.45);
    part(box(0.34, 0.1, 0.18), 'blackMatte', sx * (W / 2 + 0.1), 4.0, -2.62);
  }

  // ---- black cladding: wheel-arch flares, sills and bumpers ----
  const arch = new THREE.Shape();
  const ro = Ra + 0.26, ri = Ra - 0.03;
  arch.moveTo(ro * Math.cos(-a0), ro * Math.sin(-a0));
  arch.absarc(0, 0, ro, -a0, Math.PI + a0, false);
  arch.lineTo(ri * Math.cos(Math.PI + a0), ri * Math.sin(Math.PI + a0));
  arch.absarc(0, 0, ri, Math.PI + a0, -a0, true);
  arch.closePath();
  for (const axle of [axF, axR]) for (const sx of [-1, 1]) {
    const geo = new THREE.ExtrudeGeometry(arch, { depth: 0.12, bevelEnabled: false, curveSegments: 20 });
    geo.translate(0, 0, -0.06);
    geo.rotateY(Math.PI / 2);
    part(geo, 'blackMatte', sx * (W / 2 + 0.02), R, -axle);
  }
  for (const sx of [-1, 1]) {
    part(box(0.08, 0.5, 5.9), 'blackMatte', sx * (W / 2 + 0.02), 1.08, -0.3);        // sill cladding
    part(rbox(0.5, 0.12, 6.0, 0.04), 'steel', sx * (W / 2 + 0.22), 0.9, -0.3);       // side step
    part(box(0.12, 0.25, 0.3), 'blackMatte', sx * (W / 2 + 0.05), 0.85, -2.6);
    part(box(0.12, 0.25, 0.3), 'blackMatte', sx * (W / 2 + 0.05), 0.85, 2.0);
  }
  // front: bumper, skid plate, grille, lamps, number plate
  part(rbox(W - 0.3, 0.72, 0.5, 0.12), 'blackMatte', 0, 1.42, -7.72);
  part(rbox(W - 2.0, 0.26, 0.42, 0.08), 'steel', 0, 1.2, -7.86);
  part(box(3.5, 1.12, 0.12), 'blackMatte', 0, 2.62, -7.9);
  for (const v of [2.3, 2.62, 2.94]) part(box(3.3, 0.07, 0.05), 'steel', 0, v, -7.97);
  for (const sx of [-1, 1]) {
    part(rbox(1.05, 0.52, 0.14, 0.06), 'screen', sx * 2.4, 3.02, -7.84);           // headlamp housing
    part(box(0.95, 0.06, 0.04), 'headlight', sx * 2.4, 3.22, -7.92);               // LED strip
    const lens = cyl(0.17, 0.17, 0.06, 20); lens.rotateX(Math.PI / 2);
    part(lens, 'headlight', sx * 2.55, 2.96, -7.92);
    const fog = cyl(0.14, 0.14, 0.06, 18); fog.rotateX(Math.PI / 2);
    part(fog, 'headlight', sx * 2.35, 1.5, -7.99);
  }
  part(box(1.6, 0.42, 0.04), 'siteWhite', 0, 1.62, -7.99);
  // rear: bumper, lamps, plate, wiper, high stop lamp
  part(rbox(W - 0.3, 0.72, 0.5, 0.12), 'blackMatte', 0, 1.42, 7.72);
  part(rbox(W - 2.4, 0.22, 0.4, 0.08), 'steel', 0, 1.18, 7.84);
  for (const sx of [-1, 1]) {
    part(rbox(0.62, 0.95, 0.12, 0.05), 'taillight', sx * 2.62, 3.05, 7.84);
    part(box(0.45, 0.12, 0.04), 'headlight', sx * 2.62, 2.7, 7.9);
  }
  part(box(1.6, 0.42, 0.04), 'siteWhite', 0, 2.3, 7.86);
  part(box(0.9, 0.04, 0.04), 'taillight', 0, 5.9, 7.06);
  const wiper = part(box(0.05, 0.05, 1.2), 'blackMatte', 0, 4.05, 7.62);
  wiper.rotation.x = Math.PI / 2 - 0.2;
  // roof rails
  for (const sx of [-1, 1]) {
    part(rbox(0.12, 0.1, 7.2, 0.04), 'steel', sx * (gw / 2 - 0.35), 6.14, 3.05);
    for (const z of [-0.1, 3.05, 6.2]) part(box(0.12, 0.14, 0.3), 'blackMatte', sx * (gw / 2 - 0.35), 6.03, z);
  }

  // ---- wheels: rounded tyres, six-spoke alloys ----
  const tyre = new THREE.LatheGeometry(pts([[0.8, -0.42], [1.08, -0.43], [1.17, -0.36], [1.2, -0.22], [1.2, 0.22], [1.17, 0.36], [1.08, 0.43], [0.8, 0.42]]).map((p) => new THREE.Vector2(p.x, p.y)), 32);
  tyre.rotateZ(Math.PI / 2);
  for (const axle of [axF, axR]) for (const sx of [-1, 1]) {
    const x = sx * (W / 2 - 0.38), z = -axle, xo = x + sx * 0.36;
    part(tyre.clone(), 'tyre', x, R, z);
    const barrel = cyl(0.8, 0.8, 0.7, 28); barrel.rotateZ(Math.PI / 2);
    part(barrel, 'blackMatte', x, R, z);
    const lip = new THREE.TorusGeometry(0.78, 0.04, 8, 32); lip.rotateY(Math.PI / 2);
    part(lip, 'rim', xo, R, z);
    const hub = cyl(0.17, 0.17, 0.1, 16); hub.rotateZ(Math.PI / 2);
    part(hub, 'rim', xo, R, z);
    for (let k = 0; k < 6; k++) {
      const t = (k / 6) * Math.PI * 2;
      const sp = part(box(0.07, 0.62, 0.13), 'rim', xo - sx * 0.02, R + 0.42 * Math.cos(t), z + 0.42 * Math.sin(t));
      sp.rotation.x = t;
    }
  }
  collide(cx - W / 2 - 0.45, cx + W / 2 + 0.45, cz - L / 2 - 0.2, cz + L / 2 + 0.2, 6.2, LV.portico);
}

// ---------------------------------------------------------------------------
export function buildFurniture(ctx) {
  M = (k) => ctx.mats.get(k);
  colliders = ctx.colliders;
  walkables = ctx.walkables;
  F = LV.gf;
  CEIL = LV.gfCeil;
  group = new THREE.Group();
  group.name = 'furniture';
  ctx.house.add(group);

  // ---- Bedroom 1 ----------------------------------------------------------
  bed(item(3.46, -39.5), 5.0, 6.3, 'blanketBlue');
  collide(0.9, 6.0, -42.9, -36.8, 2.2);
  sideTable(item(6.55, -42.3));
  wardrobe(item(10.85, -38.25, -Math.PI / 2), 5.9); // between the rear window and the door
  collide(9.87, 11.88, -41.2, -35.3, 7.2);
  tvConsole(item(3.3, -31.6, Math.PI), 4.6);
  collide(1.0, 5.6, -32.3, -30.93, 1.5);
  tv(item(3.3, -30.99, Math.PI, F + 4.1));
  ceilingFan(6.3, -37.0);
  curtains('z', 0.792, -40.43, -35.37, 1, 'curtainBlue');
  curtains('x', -42.941, 7.17, 11.26, 1, 'curtainBlue');
  wallArt(3.46, F + 5.9, -42.89, 0, 3.4, 1.4, 'art2');

  // ---- Living room ----------------------------------------------------------
  const rug = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.04, 9.97), M('rug'));
  rug.position.set(4.88, F + 0.02, -24.58);
  rug.receiveShadow = true;
  group.add(rug);
  ctx.walkables.push(rug);
  sofa(item(2.55, -24.68, Math.PI / 2), 6.8);
  collide(1.08, 3.93, -28.08, -21.29, 2.8);
  armchair(item(6.1, -28.82, 0));
  collide(4.5, 7.75, -30.2, -27.44, 2.8);
  armchair(item(6.1, -20.54, Math.PI));
  collide(4.5, 7.75, -21.92, -19.16, 2.8);
  coffeeTable(item(5.95, -24.6), 1.9, 3.2);
  collide(5.0, 6.9, -26.2, -23.0, 1.5);
  sideTable(item(3.2, -29.45), false);
  mesh(box(0.5, 0.25, 0.35), 'blackMatte', 3.2, F + 1.95, -29.45);
  sideTable(item(3.2, -19.9));
  collide(2.4, 3.95, -30.2, -28.7, 2); collide(2.4, 3.95, -20.65, -19.16, 2);
  tv(item(11.8, -24.6, -Math.PI / 2, F + 4.3), 3.5, 2.0);
  mesh(box(0.9, 0.12, 3.6), 'furnWood', 11.4, F + 2.6, -24.6);
  ceilingFan(6.3, -24.7);
  curtains('z', 0.792, -26.05, -20.94, 1, 'curtainBeige');
  curtains('x', -18.831, 2.0, 11.0, -1, 'curtainBeige'); // wide window onto the portico
  wallArt(6.1, F + 5.6, -30.48, 0, 3.6, 2.2, 'art');
  plant(1.55, -20.25, 1.1);

  // ---- Drawing / dining hall (open to the kitchen and the old garden) ------------
  // the dining table stands in the double-height space, under the chandelier
  const tx = 17.2, tz = -41.4;
  diningTable(item(tx, tz), 2.76, 4.75);
  collide(tx - 1.39, tx + 1.41, tz - 2.35, tz + 2.35, 2.6);
  chair(item(tx, tz - 3.2, 0));
  chair(item(tx, tz + 3.3, Math.PI));
  chair(item(tx - 2.24, tz - 0.91, Math.PI / 2));
  chair(item(tx - 2.24, tz + 0.9, Math.PI / 2));
  chair(item(tx + 2.21, tz - 0.91, -Math.PI / 2));
  chair(item(tx + 2.21, tz + 0.9, -Math.PI / 2));
  globeChandelier(tx, tz);
  // wash basin against the rear wall, beside the kitchen counter (the wall is slightly slanted)
  const wbx = 20.85, wbz = rearZ(wbx) + REAR_T + 0.8;
  const wb = item(wbx, wbz, -Math.atan(rearZ(1) - rearZ(0)));
  mesh(cyl(0.35, 0.25, 2.5, 16), 'ceramic', 0, 1.25, 0, wb, { uv: false });
  mesh(cyl(0.75, 0.55, 0.4, 24), 'ceramic', 0, 2.7, 0, wb, { uv: false });
  mesh(cyl(0.6, 0.6, 0.02, 24), 'basinInner', 0, 2.91, 0, wb, { uv: false });
  mesh(box(1.8, 2.4, 0.05), 'mirror', 0, 5.0, -0.76, wb, { uv: false });
  collide(wbx - 0.75, wbx + 0.75, wbz - 0.8, wbz + 0.75, 3);
  // a big leafy plant in the old garden bay, beside the way to the puja room
  plant(11.3, -46.6, 1.35);
  collide(10.55, 12.05, -47.35, -45.85, 3);
  // crockery unit against the partition at the front of the hall, facing the spiral stair
  // (it stood on the bedroom-2 wall, which now has to stay clear beside the stair)
  const cu = item(15.8, -23.974, Math.PI);
  mesh(box(3.6, 3.0, 1.4), 'furnWood', 0, 1.5, 0, cu);
  mesh(box(3.4, 2.8, 0.02), 'laminate', 0, 1.5, 0.71, cu, { uv: false });
  mesh(box(3.6, 2.8, 1.0), 'glass', 0, 5.2, -0.2, cu, { uv: false, shadow: false });
  mesh(box(3.6, 0.1, 1.0), 'furnWood', 0, 3.8, -0.2, cu);
  mesh(box(3.6, 0.1, 1.0), 'furnWood', 0, 6.6, -0.2, cu);
  collide(14.0, 17.6, -24.674, -23.274, 7);
  ceilingFan(16.45, -25.8); // under the first floor, between the stair's ring beam and the partition
  ceilingLight(9.4, -45.7); // the old garden bay now has a normal ceiling
  plant(13.2, -23.9, 1.2);
  wallArt(12.28, F + 5.5, -24.9, Math.PI / 2, 2.4, 3.0, 'art2');

  // ---- Bedroom 2 ------------------------------------------------------------
  bed(item(31.24, -34.3, -Math.PI / 2), 5.1, 6.1, 'blanketMaroon');
  collide(28.4, 34.5, -36.9, -31.7, 2.2);
  sideTable(item(34.0, -37.3, -Math.PI / 2));
  sideTable(item(34.0, -31.15, -Math.PI / 2));
  wardrobe(item(31.6, -27.9, Math.PI), 5.8);
  collide(28.67, 34.5, -28.95, -26.88, 7.2);
  // TV on a low console, standing just clear of the column on grid F (F5)
  mesh(box(1.2, 1.5, 3.8), 'furnWood', 23.55, F + 0.75, -30.6);
  mesh(box(0.5, 0.12, 0.9), 'blackMatte', 23.4, F + 1.56, -30.6, group, { uv: false });
  mesh(box(0.08, 0.5, 0.08), 'blackMatte', 23.4, F + 1.82, -30.6, group, { uv: false });
  tv(item(23.4, -30.6, Math.PI / 2, F + 3.1));
  collide(22.9, 24.2, -32.5, -28.7, 1.5);
  ceilingFan(28.3, -32.6);
  wallArt(34.53, F + 6.0, -34.3, -Math.PI / 2, 3.2, 1.2, 'art');

  // ---- Guest room ------------------------------------------------------------
  bed(item(28.3, -15.98, -Math.PI / 2), 5.0, 6.0, 'blanketOlive');
  collide(25.3, 31.3, -18.5, -13.45, 2.2);
  sideTable(item(30.95, -19.1, -Math.PI / 2));
  sideTable(item(30.95, -12.9, -Math.PI / 2));
  wardrobe(item(28.55, -10.6, Math.PI), 5.8, 7.2, 1.8, 'furnLight');
  collide(25.66, 31.45, -11.5, -9.63, 7.2);
  tv(item(21.12, -15.9, Math.PI / 2, F + 4.3), 3.4, 1.95);
  ceilingFan(26.3, -15.0);

  // ---- Kitchen (double height: pendants drop from the roof) ---------------------
  kitchen();
  for (const x of [26.0, 29.4]) pendant(x, -41.6, LV.gf + 8.6);

  // ---- Toilets -----------------------------------------------------------------
  toiletSet(26.8, -23.62, [22.9, -21.7, Math.PI], [25.0, -26.5, 0]);
  toiletSet(33.3, -23.72, [30.1, -25.9, 0], [32.9, -26.5, 0]);
  ceilingLight(24.5, -23.8, 0.35);
  ceilingLight(31.4, -23.8, 0.35);

  // ---- Puja ---------------------------------------------------------------------
  mandir();

  // ---- Lobby / passage / stair -----------------------------------------------------
  const cons = item(20.0, -16.2, -Math.PI / 2);
  mesh(rbox(3.4, 2.8, 1.2, 0.05), 'furnWood', 0, 1.4, 0, cons);
  mesh(box(2.4, 3.0, 0.05), 'mirror', 0, 4.8, -0.58, cons, { uv: false });
  collide(19.4, 20.68, -17.9, -14.5, 3);
  plant(16.4, -17.4, 0.9);
  ceilingLight(18.1, -14.0, 0.4);
  ceilingLight(16.4, -20.9, 0.4);
  wallArt(16.4, F + 5.4, -22.87, 0, 4.0, 2.0, 'art');
  plant(16.6, -1.6, 1.1);
  ceilingLight(19.2, -4.8, 0.4);

  // ---- Portico --------------------------------------------------------------------
  suv();
  plant(1.5, -1.2, 1.2, LV.portico);
  plant(1.5, -17.0, 1.0, LV.portico);

  // ---- First floor and roof ----------------------------------------------------------
  F = LV.ffFloor; CEIL = LV.ffCeil;
  firstFloorFurniture();
  F = LV.roof; CEIL = LV.mumtyCeil;
  roofFurniture();
  F = LV.gf; CEIL = LV.gfCeil;

  group.traverse((o) => { if (o.isMesh) o.userData.furniture = true; });
  return group;
}

// ---------------------------------------------------------------------------
// First-floor flat (positions in feet, see plan-ff.js)
// ---------------------------------------------------------------------------
function firstFloorFurniture() {
  const slant = -Math.atan(rearZ(1) - rearZ(0)); // turn that lines a piece up with the slanted rear wall
  const backAt = (x) => rearZ(x) + REAR_T;      // inside face of the rear wall

  // ---- Living room: sofa on the north wall, TV unit screening the dining area ----
  rug(5.9, -24.7, 6.2, 8.4);
  sofa(item(2.35, -24.7, Math.PI / 2), 6.8, 2.85, 3, 'sofaGrey');
  collide(0.9, 3.8, -28.1, -21.3, 2.8);
  armchair(item(6.0, -29.0, 0));
  collide(4.5, 7.5, -30.4, -27.6, 2.8);
  coffeeTable(item(6.0, -24.7), 1.9, 3.2);
  collide(5.05, 6.95, -26.3, -23.1, 1.5);
  sideTable(item(2.3, -20.4));
  collide(1.7, 2.9, -21.0, -19.8, 2);
  plant(4.3, -19.7, 0.95);
  collide(3.75, 4.85, -20.25, -19.15, 2.5);
  // TV console with a slatted teak screen behind it (the open side towards the dining table)
  tvConsole(item(11.35, -24.7, -Math.PI / 2), 5.0);
  mesh(box(0.5, 0.12, 0.9), 'blackMatte', 11.35, F + 1.56, -24.7, group, { uv: false });
  mesh(box(0.08, 0.5, 0.08), 'blackMatte', 11.35, F + 1.82, -24.7, group, { uv: false });
  tv(item(11.35, -24.7, -Math.PI / 2, F + 3.1), 3.7, 2.1);
  for (let z = -27.15; z <= -22.2; z += 0.33) mesh(box(0.12, 7.6, 0.14), 'teakFrameV', 12.08, F + 3.8, z);
  mesh(box(0.16, 0.12, 5.1), 'teakFrame', 12.08, F + 7.66, -24.68);
  collide(10.7, 12.2, -27.25, -22.15, 7.6);
  ceilingFan(6.0, -24.7);
  ceilingLight(6.0, -20.3, 0.4);
  curtains('z', 0.75, -26.0, -21.0, 1, 'curtainSage');
  curtains('x', -18.831, 2.0, 10.0, -1, 'curtainSage'); // beside the sliding door to the terrace
  wallArt(2.9, F + 5.6, -30.48, 0, 3.0, 1.9, 'art');

  // ---- Dining & entrance passage (the table stands clear of the spiral stair's well) ----
  const tx = 16.9, tz = -22.95;
  diningTable(item(tx, tz), 2.76, 4.75);
  collide(tx - 1.39, tx + 1.41, tz - 2.35, tz + 2.35, 2.6);
  chair(item(tx, tz - 3.2, 0));
  chair(item(tx, tz + 3.3, Math.PI));
  for (const dz of [-0.91, 0.9]) {
    chair(item(tx - 2.24, tz + dz, Math.PI / 2));
    chair(item(tx + 2.21, tz + dz, -Math.PI / 2));
  }
  pendant(tx, tz - 1.2, F + 5.4);
  pendant(tx, tz + 1.2, F + 5.4);
  // sideboard under the window onto the terrace
  const sb = item(14.2, -19.5, Math.PI);
  mesh(rbox(3.2, 2.6, 1.25, 0.04), 'furnWood', 0, 1.3, 0, sb);
  for (let i = 0; i < 3; i++) mesh(box(0.98, 2.2, 0.02), 'laminate', -1.05 + i * 1.05, 1.35, 0.63, sb, { uv: false });
  mesh(cyl(0.32, 0.22, 0.6, 16), 'ceramic', -0.9, 2.9, 0, sb, { uv: false });
  collide(12.6, 15.8, -20.15, -18.83, 2.7);
  curtains('x', -18.831, 11.0, 15.0, -1, 'curtainSage');
  plant(12.95, -30.3, 0.95);
  collide(12.35, 13.55, -30.9, -29.7, 2.5);
  ceilingLight(20.2, -21.0, 0.4);
  ceilingLight(20.2, -14.0, 0.4);
  // shoe cabinet and mirror inside the main door
  const sc = item(18.85, -15.0, Math.PI / 2);
  mesh(rbox(3.0, 3.0, 1.1, 0.04), 'furnLight', 0, 1.5, 0, sc);
  mesh(box(2.8, 0.02, 0.02), 'brass', 0, 2.6, 0.56, sc, { uv: false });
  mesh(box(0.04, 2.6, 2.2), 'mirror', 18.29, F + 5.1, -15.0, group, { uv: false });
  collide(18.25, 19.45, -16.5, -13.5, 3);
  wallArt(22.12, F + 5.3, -11.4, -Math.PI / 2, 1.6, 2.2, 'art2');

  // ---- Kitchen: L-shaped counter, sink under the shaft window, fridge ----
  ffKitchen();

  // ---- Bedroom 3 (master): bed against the rear wall, between its two windows ----
  const bx = 5.6;
  bed(item(bx, backAt(bx) + 3.3, slant), 5.0, 6.0, 'blanketSage');
  collide(3.0, 8.2, backAt(bx) - 0.1, backAt(bx) + 6.4, 2.2);
  for (const sx of [2.2, 9.0]) {
    sideTable(item(sx, backAt(sx) + 0.62, slant));
    collide(sx - 0.65, sx + 0.65, backAt(sx), backAt(sx) + 1.2, 2);
  }
  wardrobe(item(3.55, -38.2, Math.PI), 5.4);
  collide(0.85, 6.25, -39.2, -37.25, 7.2);
  armchair(item(10.25, -39.9, -2.55), 2.7, 2.5);
  collide(8.95, 11.55, -41.2, -38.6, 2.8);
  // dressing table in the dressing area, beside the bathroom door
  const dt = item(7.05, -36.1, Math.PI / 2);
  mesh(rbox(1.8, 2.5, 1.3, 0.04), 'furnLight', 0, 1.25, 0, dt);
  mesh(box(1.5, 2.2, 0.04), 'furnLight', 0, 4.1, -0.63, dt, { uv: false });
  mesh(box(1.25, 1.95, 0.03), 'mirror', 0, 4.1, -0.6, dt, { uv: false });
  mesh(cyl(0.5, 0.45, 1.4, 16), 'sofaAccent', 0, 0.7, 1.05, dt, { uv: false });
  collide(6.35, 7.75, -37.05, -35.15, 2.5);
  ceilingFan(bx, -43.2);
  ceilingLight(9.1, -34.0, 0.35);
  curtains('z', 0.75, -45.0, -40.0, 1, 'curtainBlue');
  wallArt(bx, F + 5.9, backAt(bx) + 0.05, slant, 3.2, 1.2, 'art2');

  // ---- Bathroom 3 ----
  wcUnit(2.0, -32.2, Math.PI / 2);
  collide(0.75, 2.95, -32.85, -31.55, 2);
  basinUnit(1.42, -34.45, Math.PI / 2);
  collide(0.75, 2.05, -35.25, -33.65, 3);
  showerUnit(4.6, -36.87, 0);
  showerScreen(3.3, -35.25, 5.98, -35.25);
  ceilingLight(3.4, -33.9, 0.32);

  // ---- Bedroom 4: bed against the party wall, desk under the window into the kitchen void ----
  bed(item(31.27, -33.3, -Math.PI / 2), 5.0, 6.1, 'blanketRust');
  collide(28.2, 34.6, -35.9, -30.7, 2.2);
  sideTable(item(34.0, -36.6, -Math.PI / 2));
  sideTable(item(34.0, -30.0, -Math.PI / 2));
  collide(33.4, 34.65, -37.2, -36.0, 2); collide(33.4, 34.65, -30.6, -29.4, 2);
  wardrobe(item(27.4, -27.8, Math.PI), 4.0, 7.2, 1.8, 'furnLight');
  collide(25.4, 29.4, -28.72, -26.88, 7.2);
  mesh(box(1.2, 1.5, 3.0), 'furnWood', 23.3, F + 0.75, -32.9);
  tv(item(22.75, -32.9, Math.PI / 2, F + 4.3), 3.2, 1.8);
  collide(22.67, 23.9, -34.4, -31.4, 1.5);
  const desk = item(26.7, -36.9);
  mesh(rbox(3.8, 0.12, 1.75, 0.03), 'furnLight', 0, 2.45, 0, desk);
  for (const sx of [-1, 1]) mesh(box(0.1, 2.4, 1.6), 'blackMatte', sx * 1.8, 1.2, 0, desk);
  mesh(box(1.2, 0.8, 0.06), 'screen', -0.6, 2.95, -0.5, desk, { uv: false });
  chair(item(26.7, -35.5, Math.PI));
  collide(24.8, 28.6, -37.82, -36.0, 2.6);
  collide(25.95, 27.45, -36.3, -34.75, 3);
  ceilingFan(28.8, -33.0);
  wallArt(34.62, F + 5.8, -33.3, -Math.PI / 2, 3.2, 1.3, 'art');

  // ---- Bathroom 4 and the common toilet ----
  wcUnit(33.4, -22.4, -Math.PI / 2);
  collide(32.2, 34.67, -23.05, -21.75, 2);
  basinUnit(29.8, -21.73, Math.PI);
  collide(29.0, 30.6, -22.4, -21.07, 3);
  showerUnit(29.3, -26.5, 0);
  showerScreen(30.0, -26.45, 30.0, -24.85);
  ceilingLight(31.5, -23.8, 0.32);
  wcUnit(26.8, -24.6, -Math.PI / 2);
  collide(25.6, 28.07, -25.25, -23.95, 2);
  basinUnit(25.0, -21.73, Math.PI);
  collide(24.2, 25.8, -22.4, -21.07, 3);
  showerUnit(23.9, -26.5, 0);
  ceilingLight(25.4, -23.8, 0.32);

  // ---- Stair landing ----
  plant(18.95, -1.55, 1.0);
  collide(18.4, 19.5, -2.1, -1.0, 2.5);
  ceilingLight(20.6, -4.8, 0.4);

  // ---- Front terrace ----
  const tb = item(6.0, -8.5);
  mesh(cyl(1.25, 1.25, 0.1, 28), 'furnLight', 0, 2.4, 0, tb, { uv: false });
  mesh(cyl(0.1, 0.1, 2.35, 10), 'blackMatte', 0, 1.2, 0, tb, { uv: false });
  mesh(cyl(0.7, 0.75, 0.08, 20), 'blackMatte', 0, 0.04, 0, tb, { uv: false });
  collide(4.75, 7.25, -9.75, -7.25, 2.5);
  chair(item(6.0, -10.65, 0));
  chair(item(6.0, -6.35, Math.PI));
  collide(5.25, 6.75, -11.4, -9.9, 3); collide(5.25, 6.75, -7.1, -5.6, 3);
  for (const [x, z, s] of [[1.8, -2.6, 1.2], [1.7, -16.8, 1.0], [16.3, -16.8, 1.05], [16.2, -2.6, 1.15]]) {
    plant(x, z, s);
    collide(x - 0.6 * s, x + 0.6 * s, z - 0.6 * s, z + 0.6 * s, 2.5);
  }
}

function ffKitchen() {
  const x0 = 22.674, x1 = 31.59, zr = -20.282, zf = -18.28; // run along the back (north) wall
  const ex = 29.59, ez = -11.45;                              // run along the shaft (east) wall
  const top = (xa, xb, za, zb) => mesh(box(xb - xa, 0.15, zb - za), 'graniteBlack', (xa + xb) / 2, F + 2.825, (za + zb) / 2);
  const cab = (xa, xb, za, zb) => mesh(box(xb - xa, 2.4, zb - za), 'laminateSage', (xa + xb) / 2, F + 1.55, (za + zb) / 2);
  const kick = (xa, xb, za, zb) => mesh(box(xb - xa, 0.35, zb - za), 'blackMatte', (xa + xb) / 2, F + 0.175, (za + zb) / 2);
  top(x0, x1, zr, zf); cab(x0, x1, zr, zf - 0.1); kick(x0, x1, zr, zf - 0.3);
  top(ex, x1, zf, ez); cab(ex + 0.1, x1, zf, ez); kick(ex + 0.3, x1, zf, ez);
  for (let x = x0 + 0.8; x < ex - 0.6; x += 1.6) mesh(box(0.7, 0.05, 0.06), 'steel', x, F + 2.45, zf - 0.08, group, { uv: false });
  for (let z = zf + 1.0; z < ez - 0.4; z += 1.6) mesh(box(0.06, 0.05, 0.7), 'steel', ex + 0.08, F + 2.45, z, group, { uv: false });
  collide(x0, x1, zr, zf, 3);
  collide(ex, x1, zf, ez, 3);
  // hob and chimney on the back run
  const hob = item(26.0, -19.3);
  mesh(rbox(3.0, 0.08, 1.5, 0.03), 'screen', 0, 2.95, 0, hob, { uv: false });
  for (const s of [-1, 1]) {
    mesh(cyl(0.34, 0.34, 0.06, 20), 'steel', s * 0.75, 3.0, 0, hob, { uv: false });
    mesh(cyl(0.18, 0.18, 0.08, 16), 'blackMatte', s * 0.75, 3.03, 0, hob, { uv: false });
  }
  mesh(cyl(0.45, 0.4, 0.5, 18), 'steel', 25.25, F + 3.28, -19.3, group, { uv: false });
  mesh(box(2.8, 0.9, 1.6), 'steel', 26.0, F + 5.8, zr + 0.83, group, { uv: false });
  const duct = CEIL - (F + 6.25);
  mesh(box(1.0, duct, 0.9), 'steel', 26.0, F + 6.25 + duct / 2, zr + 0.48, group, { uv: false });
  // wall cupboards either side of the chimney
  for (const [xa, xb] of [[22.8, 24.4], [27.6, 31.45]]) {
    mesh(box(xb - xa, 2.0, 1.1), 'laminate', (xa + xb) / 2, F + 6.0, zr + 0.58, group);
    for (let x = xa + 1.6; x < xb - 0.3; x += 1.6) mesh(box(0.03, 1.9, 0.02), 'laminateGrey', x, F + 6.0, zr + 1.14, group, { uv: false });
  }
  // sink under the window onto the shaft
  mesh(box(1.5, 0.04, 2.3), 'steel', 30.6, F + 2.93, -15.0, group, { uv: false });
  mesh(box(1.0, 0.05, 1.0), 'blackMatte', 30.55, F + 2.955, -15.55, group, { uv: false });
  mesh(box(1.0, 0.05, 1.0), 'blackMatte', 30.55, F + 2.955, -14.45, group, { uv: false });
  mesh(cyl(0.05, 0.05, 1.1, 8), 'chrome', 31.3, F + 3.45, -15.0, group, { uv: false });
  const spout = mesh(cyl(0.04, 0.04, 0.7, 8), 'chrome', 31.0, F + 3.95, -15.0, group, { uv: false });
  spout.rotation.z = Math.PI / 2;
  // fridge at the end of the counter
  const fr = item(30.55, -10.52, -Math.PI / 2);
  mesh(rbox(1.75, 5.8, 1.9, 0.06), 'steel', 0, 2.9, 0, fr);
  mesh(box(1.7, 0.03, 0.02), 'blackMatte', 0, 3.9, 0.96, fr, { uv: false });
  mesh(box(0.06, 1.4, 0.08), 'blackMatte', -0.7, 4.8, 1.0, fr, { uv: false });
  mesh(box(0.06, 1.6, 0.08), 'blackMatte', -0.7, 2.6, 1.0, fr, { uv: false });
  collide(29.6, 31.55, -11.4, -9.64, 6);
  // a few things on the counter
  mesh(cyl(0.22, 0.22, 0.5, 16), 'pot', 23.6, F + 3.15, -19.5, group, { uv: false });
  mesh(box(1.1, 0.75, 0.85), 'laminateGrey', 30.6, F + 3.27, -12.6, group, { uv: false });
  ceilingLight(26.6, -15.0, 0.4);
}

// ---------------------------------------------------------------------------
// Roof terrace: a few planters and a bench
// ---------------------------------------------------------------------------
function roofFurniture() {
  for (const [x, z, s] of [[1.6, -19.6, 1.2], [6.0, -19.6, 1.0], [10.4, -19.6, 1.1], [1.6, -30.0, 1.15], [1.6, -40.0, 1.0], [27.0, -11.0, 1.1]]) {
    plant(x, z, s, F, 'potDark');
    collide(x - 0.6 * s, x + 0.6 * s, z - 0.6 * s, z + 0.6 * s, 2.5);
  }
  const bench = item(1.45, -35.0, Math.PI / 2);
  mesh(box(5.0, 0.16, 1.5), 'furnLight', 0, 1.45, 0, bench);
  mesh(box(5.0, 1.1, 0.12), 'furnLight', 0, 2.2, -0.7, bench);
  for (const sx of [-2.2, 2.2]) mesh(box(0.14, 1.4, 1.3), 'blackMatte', sx, 0.7, 0, bench);
  collide(0.65, 2.25, -37.6, -32.4, 2.8);
  ceilingLight(20.6, -4.8, 0.4); // in the mumty
}
