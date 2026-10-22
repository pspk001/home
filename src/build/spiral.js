import * as THREE from 'three';
import { Batcher } from '../geometry.js';
import { LV, SPIRAL, spiralAngle } from '../config.js';

// ---------------------------------------------------------------------------
// Spiral stair from the drawing/dining hall up to the first-floor dining area (see
// SPIRAL in config.js): a black steel column, grey stone steps with closed risers on a
// white concrete helix, a curved glass balustrade on steel standoffs with a black
// handrail, and a top landing flush with the first floor. It can be walked: the treads
// and the landing are floor surfaces, every step is also a solid block for collisions,
// so you go in at the bottom from the dining side and come out at the top.
// ---------------------------------------------------------------------------

const S = SPIRAL;
const N = S.risers - 1;              // treads (the last riser lands on the first floor)
const FL = LV.ffFloor;
const SEG = 6;                       // segments per tread (5° each)
const LAND_T = S.T;                  // landing slab: the helix runs up to meet its underside
const rLand = S.well - 0.02;         // the landing reaches the edge of the slab opening
const BODY = 0.4;                    // walker's body radius against the stair (see walk.js)

const corner = (s) => LV.gf + s * S.rise;          // line through the back corners of the treads
const tread = (k) => LV.gf + (k + 1) * S.rise;     // top of tread k
const soffit = (s) => Math.max(LV.gf, corner(s) - S.T);
const yRail = (s) => corner(s) + S.rise + 2.95;    // handrail: 3 ft above the nosing line
const P = (r, s, y) => {
  const a = spiralAngle(s);
  return [S.cx + r * Math.cos(a), y, S.cz + r * Math.sin(a)];
};
const outward = (s) => { const a = spiralAngle(s); return [Math.cos(a), 0, Math.sin(a)]; };
const downStair = (s) => { const a = spiralAngle(s); return [-Math.sin(a), 0, Math.cos(a)]; };
const upStair = (s) => { const a = spiralAngle(s); return [Math.sin(a), 0, -Math.cos(a)]; };

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

/** Quad p0..p3 (in order round its edge), turned so that it faces roughly along `towards`. */
export function faceTo(B, key, p0, p1, p2, p3, towards) {
  let n = unit(cross(sub(p1, p0), sub(p2, p0)));
  if (n[0] * towards[0] + n[1] * towards[1] + n[2] * towards[2] < 0) {
    [p1, p3] = [p3, p1];
    n = [-n[0], -n[1], -n[2]];
  }
  B.quad(key, p0, p1, p2, p3, n);
}

/** Helix at radius r between helix parameters s0..s1, at height y(s). */
class Helix extends THREE.Curve {
  constructor(r, s0, s1, y) {
    super();
    Object.assign(this, { r, s0, s1, y });
  }
  getPoint(t, target = new THREE.Vector3()) {
    const s = this.s0 + (this.s1 - this.s0) * t;
    const [x, y, z] = P(this.r, s, this.y(s));
    return target.set(x, y, z);
  }
}

export function buildSpiralStair(ctx) {
  const { mats, house, colliders, walkables } = ctx;
  const get = (k) => mats.get(k);
  const top = new Batcher();   // walkable: treads and the landing
  const B = new Batcher();     // risers, step edges, helix, landing underside
  const G = new Batcher();     // glass (kept out of the shadow map)
  const up = [0, 1, 0], down = [0, -1, 0];
  const [L0, L1] = S.landS;    // the landing spans the helix from the last riser for 60°

  // ---- stone steps: tread, and its outer edge above the white helix ----------------
  for (let k = 0; k < N; k++) {
    const y = tread(k);
    for (let j = 0; j < SEG; j++) {
      const s0 = k + j / SEG, s1 = k + (j + 1) / SEG;
      faceTo(top, 'stairStone', P(S.rCol, s0, y), P(S.rStep, s0, y), P(S.rStep, s1, y), P(S.rCol, s1, y), up);
      faceTo(B, 'stairStone', P(S.rStep, s0, corner(s0)), P(S.rStep, s1, corner(s1)), P(S.rStep, s1, y), P(S.rStep, s0, y), outward((s0 + s1) / 2));
    }
  }
  // closed risers; the last one rises to the landing
  for (let k = 0; k < N; k++) {
    faceTo(B, 'stairStone', P(S.rCol, k, corner(k)), P(S.rStep, k, corner(k)), P(S.rStep, k, tread(k)), P(S.rCol, k, tread(k)), downStair(k));
  }
  faceTo(B, 'stairStone', P(S.rCol, L0, corner(L0)), P(S.rStep, L0, corner(L0)), P(S.rStep, L0, FL), P(S.rCol, L0, FL), downStair(L0));
  faceTo(B, 'stairStone', P(S.rStep, L0, FL - LAND_T), P(rLand, L0, FL - LAND_T), P(rLand, L0, FL), P(S.rStep, L0, FL), downStair(L0));

  // ---- white concrete helix: outer band and soffit ----------------------------------
  // It runs on under the landing for one more tread, until it meets the landing's underside.
  const yCap = FL - LAND_T, sEnd = L0 + 1, sFloor = S.T / S.rise; // below sFloor it sits on the floor
  const rMid = (S.rCol + S.rStep) / 2;
  for (let i = 0; i < sEnd * SEG; i++) {
    const a = i / SEG, b = (i + 1) / SEG;
    const a0 = soffit(a), a1 = Math.min(corner(a), yCap), b0 = soffit(b), b1 = Math.min(corner(b), yCap);
    if (a1 - a0 > 1e-3 || b1 - b0 > 1e-3) faceTo(B, 'white', P(S.rStep, a, a0), P(S.rStep, b, b0), P(S.rStep, b, b1), P(S.rStep, a, a1), outward((a + b) / 2));
    if (b <= sFloor) continue;
    const aa = Math.max(a, sFloor);
    for (const [r0, r1] of [[S.rCol, rMid], [rMid, S.rStep]]) {
      faceTo(B, 'white', P(r0, aa, soffit(aa)), P(r1, aa, soffit(aa)), P(r1, b, soffit(b)), P(r0, b, soffit(b)), down);
    }
  }

  // ---- top landing, flush with the first floor ---------------------------------------
  const LS = (L1 - L0) * SEG;
  for (let j = 0; j < LS; j++) {
    const a = L0 + j / SEG, b = L0 + (j + 1) / SEG;
    faceTo(top, 'stairStone', P(S.rCol, a, FL), P(rLand, a, FL), P(rLand, b, FL), P(S.rCol, b, FL), up);
    // underside: beside the helix only outside it, beyond the helix all the way in
    const rIn = b <= sEnd + 1e-6 ? S.rStep : S.rCol;
    faceTo(B, 'white', P(rIn, a, yCap), P(rLand, a, yCap), P(rLand, b, yCap), P(rIn, b, yCap), down);
  }
  faceTo(B, 'white', P(S.rCol, L1, yCap), P(rLand, L1, yCap), P(rLand, L1, FL), P(S.rCol, L1, FL), upStair(L1));

  // ---- glass balustrade: curved panels two treads long, on the outside of the helix ----
  const g0 = (s) => Math.max(LV.gf + 0.04, corner(s) - 0.25);
  const g1 = (s) => yRail(s) - 0.1;
  for (let k = 0; k < N; k += 2) {
    const a0 = k + 0.03, a1 = Math.min(N, k + 2) - 0.03;
    const n = Math.max(2, Math.round((a1 - a0) * SEG));
    for (let i = 0; i < n; i++) {
      const a = a0 + ((a1 - a0) * i) / n, b = a0 + ((a1 - a0) * (i + 1)) / n;
      faceTo(G, 'glass', P(S.rGlass, a, g0(a)), P(S.rGlass, b, g0(b)), P(S.rGlass, b, g1(b)), P(S.rGlass, a, g1(a)), outward((a + b) / 2));
    }
  }
  // guard across the open end of the landing
  const gS = L1 - 0.04, gA = S.rCol + 0.1, gB = rLand - 0.08;
  faceTo(G, 'glass', P(gA, gS, FL + 0.08), P(gB, gS, FL + 0.08), P(gB, gS, FL + 3.0), P(gA, gS, FL + 3.0), upStair(gS));

  const stairs = top.build(get, { name: 'spiral-treads' });
  stairs.traverse((o) => o.isMesh && walkables.push(o));
  house.add(stairs, B.build(get, { name: 'spiral-stair' }), G.build(get, { name: 'spiral-glass', castShadow: false }));

  // ---- steel: column, handrail, newels, standoffs -------------------------------------
  const steel = get('steelBlack'), bright = get('steel');
  const g = new THREE.Group();
  g.name = 'spiral-steel';
  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    return m;
  };
  const colTop = FL + 3.45;
  add(new THREE.CylinderGeometry(S.rCol, S.rCol, colTop - LV.gf, 28), steel, S.cx, (LV.gf + colTop) / 2, S.cz);
  add(new THREE.SphereGeometry(S.rCol * 1.12, 20, 12), steel, S.cx, colTop, S.cz);
  add(new THREE.CylinderGeometry(0.34, 0.36, 0.05, 28), steel, S.cx, LV.gf + 0.025, S.cz);
  // handrail along the top edge of the glass, from just before the first riser to the landing
  const hs0 = -0.12, hs1 = N;
  add(new THREE.TubeGeometry(new Helix(S.rGlass, hs0, hs1, yRail), 300, 0.075, 10, false), steel, 0, 0, 0);
  // newel posts at the foot and the head of the handrail
  for (const [s, y0] of [[hs0, LV.gf], [hs1, FL]]) {
    const [x, y1, z] = P(S.rGlass, s, yRail(s));
    add(new THREE.CylinderGeometry(0.06, 0.06, y1 - y0, 12), steel, x, (y0 + y1) / 2, z);
    add(new THREE.SphereGeometry(0.085, 14, 10), steel, x, y1, z);
  }
  // standoffs holding the glass off the helix
  const so = new THREE.CylinderGeometry(0.032, 0.032, S.rGlass - S.rStep + 0.05, 10).rotateZ(Math.PI / 2);
  const cap = new THREE.CylinderGeometry(0.06, 0.06, 0.025, 14).rotateZ(Math.PI / 2);
  for (let k = 0; k < N; k++) {
    for (const f of [0.3, 0.75]) {
      const s = k + f, a = spiralAngle(s), y = corner(s) - 0.13;
      if (y < LV.gf + 0.1) continue;
      const [x, , z] = P((S.rStep + S.rGlass) / 2 + 0.01, s, y);
      add(so, bright, x, y, z).rotation.y = -a;
      const [cx, , cz] = P(S.rGlass + 0.02, s, y);
      add(cap, bright, cx, y, cz).rotation.y = -a;
    }
  }
  // handrail and post on the landing's guard
  {
    const a = spiralAngle(gS);
    const [x0, , z0] = P(S.rCol, gS, 0), [x1, , z1] = P(gB + 0.04, gS, 0);
    const len = Math.hypot(x1 - x0, z1 - z0);
    add(new THREE.CylinderGeometry(0.075, 0.075, len, 10).rotateZ(Math.PI / 2), steel, (x0 + x1) / 2, FL + 3.08, (z0 + z1) / 2).rotation.y = -a;
    add(new THREE.CylinderGeometry(0.06, 0.06, 3.08, 12), steel, x1, FL + 1.54, z1);
  }
  house.add(g);

  // ---- collisions ------------------------------------------------------------------------
  const C = (x0, x1, z0, z1, y0, y1, id) => colliders.push({ x0, x1, z0, z1, y0, y1, id, r: BODY });
  C(S.cx - S.rCol, S.cx + S.rCol, S.cz - S.rCol, S.cz + S.rCol, 0, colTop, 'spiral-column');
  // each step (and the landing) as a solid block, from the soffit under it up to its tread:
  // plan cells inside its sector, merged along rows
  const cell = 0.2, span = S.rStep + 0.2;
  const blocks = [];
  for (let k = 0; k < N; k++) blocks.push({ s0: k, s1: k + 1, r1: S.rStep, y0: soffit(k), y1: tread(k) });
  // the landing: over the end of the helix its underside rises with the soffit, so it is
  // split there (a single block would stand too low over the steps beneath it)
  for (let j = 0; j < SEG; j++) blocks.push({ s0: L0 + j / SEG, s1: L0 + (j + 1) / SEG, r1: rLand, y0: Math.min(yCap, soffit(L0 + j / SEG)), y1: FL });
  blocks.push({ s0: L0 + 1, s1: L1, r1: rLand, y0: yCap, y1: FL });
  const turn = 360 / S.step;  // treads per turn
  for (const b of blocks) {
    for (let iz = 0; iz * cell <= 2 * span; iz++) {
      const z = S.cz - span + (iz + 0.5) * cell;
      let run = null;
      const flush = () => { if (run) C(run[0], run[1], z - cell / 2, z + cell / 2, b.y0, b.y1, 'spiral-step'); run = null; };
      for (let ix = 0; ix * cell <= 2 * span; ix++) {
        const x = S.cx - span + (ix + 0.5) * cell;
        const r = Math.hypot(x - S.cx, z - S.cz);
        let inside = r >= S.rCol && r <= b.r1;
        if (inside) {
          const deg = (Math.atan2(z - S.cz, x - S.cx) * 180) / Math.PI;
          let s = (S.start - deg) / S.step;
          s -= Math.floor((s - b.s0) / turn) * turn;  // the turn of the helix this block is on
          inside = s >= b.s0 && s < b.s1;
        }
        if (inside) {
          if (run && Math.abs(run[1] - (x - cell / 2)) < 1e-6) run[1] = x + cell / 2;
          else { flush(); run = [x - cell / 2, x + cell / 2]; }
        } else flush();
      }
      flush();
    }
  }
  // the glass balustrade, as a ring of posts along the helix
  for (let i = 0; i <= N * SEG; i++) {
    const s = i / SEG;
    const [x, , z] = P(S.rGlass, s, 0);
    C(x - 0.07, x + 0.07, z - 0.07, z + 0.07, Math.max(0, soffit(s) - 0.05), yRail(s) + 0.1, 'spiral-rail');
  }
  // the guard across the end of the landing
  for (let r = gA; r <= gB + 0.01; r += 0.18) {
    const [x, , z] = P(r, gS, 0);
    C(x - 0.07, x + 0.07, z - 0.07, z + 0.07, FL, FL + 3.1, 'spiral-rail');
  }
}
