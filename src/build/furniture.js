import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { extrudeXZ, worldUV } from '../geometry.js';
import { LV, rearZ, REAR_T } from '../config.js';

// ---------------------------------------------------------------------------
// Furniture, placed where the furnished plan shows it (positions converted
// from the drawing). All pieces are simple procedural models.
// ---------------------------------------------------------------------------

const F = LV.gf; // ground-floor finished level

let M; // material getter
let group;
let colliders;

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
  const g = item(x, z, Math.random() * 3, LV.gfCeil);
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
  mesh(cyl(r, r, 0.06, 24), 'lightPanel', x, LV.gfCeil - 0.03, z, group, { uv: false, shadow: false });
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
  mesh(box(1.0, 2.2, 0.9), 'steel', 25.6, F + 7.4, hz + 0.45, group, { uv: false });
  // upper cabinets
  const uz = rearZ(31) + REAR_T;
  mesh(box(6.4, 2.4, 1.1), 'laminate', 31.3, F + 6.7, uz + 0.55, group);
  for (let i = 1; i < 4; i++) mesh(box(0.03, 2.3, 0.02), 'laminateGrey', 28.1 + i * 1.6, F + 6.7, uz + 1.11, group, { uv: false });
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

function toiletSet(wcX, wcZ, basin, shower, mirrorRy) {
  // WC facing -x (cistern against the east wall)
  const wc = item(wcX, wcZ, -Math.PI / 2);
  mesh(rbox(1.3, 1.2, 0.6, 0.12), 'ceramic', 0, 1.9, -0.95, wc, { uv: false });
  mesh(rbox(1.15, 1.25, 1.7, 0.35), 'ceramic', 0, 0.62, 0.05, wc, { uv: false });
  mesh(rbox(1.2, 0.08, 1.75, 0.3), 'ceramic', 0, 1.3, 0.08, wc, { uv: false });
  collide(wcX - 1.2, wcX + 1.2, wcZ - 0.7, wcZ + 0.7, 2);
  // wall-hung basin + mirror
  const b = item(basin[0], basin[1], basin[2]);
  mesh(rbox(1.6, 0.55, 1.25, 0.15), 'ceramic', 0, 2.75, 0, b, { uv: false });
  mesh(box(1.3, 0.05, 0.9), 'basinInner', 0, 3.03, 0.05, b, { uv: false });
  mesh(cyl(0.04, 0.04, 0.5, 8), 'chrome', 0, 3.25, -0.45, b, { uv: false });
  mesh(box(1.6, 2.1, 0.04), 'mirror', 0, 4.9, -0.62, b, { uv: false });
  // shower
  const s = item(shower[0], shower[1], shower[2]);
  mesh(cyl(0.3, 0.3, 0.05, 20), 'chrome', 0, 6.5, 0.45, s, { uv: false }).rotation.x = Math.PI / 2 - 0.4;
  mesh(cyl(0.03, 0.03, 0.5, 8), 'chrome', 0, 6.6, 0.25, s, { uv: false }).rotation.x = Math.PI / 2;
  mesh(box(0.35, 0.35, 0.1), 'chrome', 0, 3.6, 0.03, s, { uv: false });
  // towel rail
  mesh(cyl(0.03, 0.03, 1.4, 8), 'chrome', 0.9, 4.2, 0.12, s, { uv: false }).rotation.z = Math.PI / 2;
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

function car() {
  const g = item(5.5, -9.42, 0, LV.portico);
  const L = 14.6, W = 5.9;
  // body
  mesh(rbox(W, 1.9, L, 0.55, 4), 'carPaint', 0, 1.55, 0, g, { uv: false });
  // cabin (side profile extruded across the width)
  // side profile: shape +x becomes the car front (-z) after the rotation below
  const p = new THREE.Shape();
  p.moveTo(-3.3, 0); p.lineTo(-2.0, 1.72); p.lineTo(1.8, 1.72); p.lineTo(4.3, 0); p.closePath();
  const cab = new THREE.ExtrudeGeometry(p, { depth: W - 0.7, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.12, bevelSegments: 2 });
  cab.translate(0, 0, -(W - 0.7) / 2);
  cab.rotateY(Math.PI / 2);
  mesh(cab, 'carGlass', 0, 2.45, 0.2, g, { uv: false });
  mesh(rbox(W - 0.7, 0.14, 4.0, 0.06), 'carPaint', 0, 4.36, 0.1, g, { uv: false });
  // A / C pillars in body colour
  for (const s of [-1, 1]) {
    const pil = mesh(box(0.14, 0.14, 2.9), 'carPaint', s * (W / 2 - 0.2), 3.3, -2.9, g, { uv: false });
    pil.rotation.x = -0.6;
    const pil2 = mesh(box(0.14, 0.14, 2.1), 'carPaint', s * (W / 2 - 0.2), 3.35, 2.75, g, { uv: false });
    pil2.rotation.x = 0.9;
  }
  // wheels
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const wgeo = cyl(1.05, 1.05, 0.72, 24);
    wgeo.rotateZ(Math.PI / 2);
    mesh(wgeo, 'tyre', sx * (W / 2 - 0.3), 1.05, sz * 4.55, g, { uv: false });
    const rim = cyl(0.62, 0.62, 0.74, 16);
    rim.rotateZ(Math.PI / 2);
    mesh(rim, 'rim', sx * (W / 2 - 0.3), 1.05, sz * 4.55, g, { uv: false });
  }
  // lights, grille, mirrors, plates
  for (const s of [-1, 1]) {
    mesh(rbox(1.3, 0.35, 0.2, 0.08), 'headlight', s * 1.9, 1.95, -L / 2 + 0.05, g, { uv: false });
    mesh(rbox(1.3, 0.35, 0.2, 0.08), 'taillight', s * 1.9, 2.0, L / 2 - 0.05, g, { uv: false });
    mesh(rbox(0.25, 0.35, 0.6, 0.08), 'carPaint', s * (W / 2 + 0.1), 3.15, -2.8, g, { uv: false });
  }
  mesh(rbox(2.2, 0.45, 0.15, 0.05), 'blackMatte', 0, 1.55, -L / 2 + 0.02, g, { uv: false });
  mesh(box(1.4, 0.4, 0.05), 'siteWhite', 0, 1.1, L / 2 + 0.01, g, { uv: false });
  mesh(box(1.4, 0.4, 0.05), 'siteWhite', 0, 1.1, -L / 2 - 0.01, g, { uv: false });
  collide(5.5 - W / 2, 5.5 + W / 2, -9.42 - L / 2, -9.42 + L / 2, 5, LV.portico);
}

// ---------------------------------------------------------------------------
export function buildFurniture(ctx) {
  M = (k) => ctx.mats.get(k);
  colliders = ctx.colliders;
  group = new THREE.Group();
  group.name = 'furniture';
  ctx.house.add(group);

  // ---- Bedroom 1 ----------------------------------------------------------
  bed(item(3.46, -39.5), 5.0, 6.3, 'blanketBlue');
  collide(0.9, 6.0, -42.9, -36.8, 2.2);
  sideTable(item(6.55, -42.3));
  wardrobe(item(10.85, -34.3, -Math.PI / 2), 5.9);
  collide(9.87, 11.88, -37.3, -31.35, 7.2);
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
  // wash basin on the bedroom-2 wall (the old garden wall is gone)
  const wb = item(21.4, -34.8, -Math.PI / 2);
  mesh(cyl(0.35, 0.25, 2.5, 16), 'ceramic', 0, 1.25, 0, wb, { uv: false });
  mesh(cyl(0.75, 0.55, 0.4, 24), 'ceramic', 0, 2.7, 0, wb, { uv: false });
  mesh(cyl(0.6, 0.6, 0.02, 24), 'basinInner', 0, 2.91, 0, wb, { uv: false });
  mesh(box(1.8, 2.4, 0.05), 'mirror', 0, 5.0, -0.76, wb, { uv: false });
  collide(20.6, 22.17, -35.6, -34.0, 3);
  // a big leafy plant in the old garden bay, beside the way to the puja room
  plant(11.3, -46.6, 1.35);
  collide(10.55, 12.05, -47.35, -45.85, 3);
  // crockery unit along the west wall
  const cu = item(12.95, -35.0, Math.PI / 2);
  mesh(box(5.0, 3.0, 1.4), 'furnWood', 0, 1.5, 0, cu);
  mesh(box(4.8, 2.8, 0.02), 'laminate', 0, 1.5, 0.71, cu, { uv: false });
  mesh(box(5.0, 2.8, 1.0), 'glass', 0, 5.2, -0.2, cu, { uv: false, shadow: false });
  mesh(box(5.0, 0.1, 1.0), 'furnWood', 0, 3.8, -0.2, cu);
  mesh(box(5.0, 0.1, 1.0), 'furnWood', 0, 6.6, -0.2, cu);
  collide(12.23, 13.65, -37.5, -32.5, 7);
  ceilingFan(17.2, -30.0);
  plant(13.2, -23.9, 1.2);
  wallArt(12.28, F + 5.5, -24.9, Math.PI / 2, 2.4, 3.0, 'art2');

  // ---- Bedroom 2 ------------------------------------------------------------
  bed(item(31.24, -34.3, -Math.PI / 2), 5.1, 6.1, 'blanketMaroon');
  collide(28.4, 34.5, -36.9, -31.7, 2.2);
  sideTable(item(34.0, -37.3, -Math.PI / 2));
  sideTable(item(34.0, -31.15, -Math.PI / 2));
  wardrobe(item(31.6, -27.9, Math.PI), 5.8);
  collide(28.67, 34.5, -28.95, -26.88, 7.2);
  tv(item(22.62, -34.97, Math.PI / 2, F + 4.3));
  mesh(box(1.2, 1.5, 3.8), 'furnWood', 23.15, F + 0.75, -34.97);
  collide(22.5, 23.8, -36.9, -33.0, 1.5);
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
  car();
  plant(1.5, -1.2, 1.2, LV.portico);
  plant(1.5, -17.0, 1.0, LV.portico);

  group.traverse((o) => { if (o.isMesh) o.userData.furniture = true; });
  return group;
}
