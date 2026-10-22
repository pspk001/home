import * as THREE from 'three';
import { Batcher, regroup, worldUV, extrudeXZ, groupOnly } from '../geometry.js';
import { LV, STAIR, rearZ, PLOT } from '../config.js';
import { FF_WALLS, FF_DOORS, FF_OPENING, FF_ROOMS } from '../plan-ff.js';
import { makeLeaf } from './openings.js';
import { stairRail } from './structure.js';

// ---------------------------------------------------------------------------
// First floor: the 2BHK flat's walls (outer shell and partitions), doors and
// windows, floor finishes, bathroom tiles, kitchen dado, and the stair from the
// first-floor landing up to the roof.
// ---------------------------------------------------------------------------

const FF0 = LV.ff, FF1 = LV.ffCeil, FL = LV.ffFloor;
const EXT = new Set(['ext', 'extTan']);

let CTX;

const isVertical = (w) => w.z[1] - w.z[0] > w.x[1] - w.x[0];
const heights = (o) => {
  const [s, h] = FF_OPENING[o.t];
  return { sill: FF0 + (o.sill ?? s), head: FF0 + (o.head ?? h) };
};

export function buildFirstFloor(ctx) {
  CTX = ctx;
  const { mats, house, colliders, walkables, pickables } = ctx;
  const get = (k) => mats.get(k);
  const B = new Batcher();   // walls, frames, sills
  const G = new Batcher();   // glass: kept out of the shadow map so sunlight comes through
  const WB = new Batcher();  // walkable bits (door thresholds)
  const leaves = new THREE.Group();
  leaves.name = 'ff-door-leaves';

  for (const w of FF_WALLS) {
    buildWall(B, w, colliders);
    for (const o of w.open || []) buildOpening(B, G, WB, leaves, w, o, colliders);
  }
  cladding(B);

  house.add(B.build(get, { name: 'ff-walls' }));
  house.add(G.build(get, { name: 'ff-glazing', castShadow: false }));
  const wb = WB.build(get, { name: 'ff-thresholds', castShadow: false });
  wb.traverse((o) => o.isMesh && walkables.push(o));
  house.add(wb);
  house.add(leaves);

  // ---- floor finishes (one mesh per room so rooms can be picked) ----------------
  for (const room of FF_ROOMS) {
    const y = LV[room.level];
    const RB = new Batcher();
    for (const [x0, x1, z0, z1] of room.floorRects || room.rects) {
      if (room.rear && z0 < rearZ(x0) + 1) {
        const za = rearZ(x0) + 0.05, zb = rearZ(x1) + 0.05;
        RB.prism([[x0, z1], [x1, z1], [x1, zb], [x0, za]], FF0, y, { top: room.floor, bottom: null, sides: [null, null, null, null] });
      } else {
        RB.box(x0, x1, FF0, y, z0, z1, { py: room.floor, all: null });
      }
    }
    const g = RB.build(get, { name: `floor-${room.id}`, castShadow: false });
    // floors with a curved edge (cut round the spiral stair's well): top face only
    for (const poly of room.floorPolys || []) {
      const m = new THREE.Mesh(groupOnly(extrudeXZ(poly, [], FF0, y, 24), 0), get(room.floor));
      m.receiveShadow = true;
      g.add(m);
    }
    g.traverse((o) => {
      if (o.isMesh) { o.userData.room = room.id; walkables.push(o); pickables.push(o); }
    });
    house.add(g);
  }

  buildUpperStair(ctx);
}

// ---------------------------------------------------------------------------
// Walls: solid pieces round the openings, with only the faces that can be seen
// (faces sandwiched between touching boxes would flicker), and a collider per piece.
// ---------------------------------------------------------------------------
function buildWall(B, w, colliders) {
  const vertical = isVertical(w);
  const [A0, A1] = vertical ? w.z : w.x;   // along the wall
  const [t0, t1] = vertical ? w.x : w.z;   // across its thickness
  const [eLo, eHi] = w.ends || [null, null];
  const extSide = EXT.has(w.s0) ? w.s0 : EXT.has(w.s1) ? w.s1 : null;
  const jm = extSide || 'reveal';
  const ops = (w.open || [])
    .map((o) => ({ ...o, lo: Math.min(o.a, o.b), hi: Math.max(o.a, o.b), ...heights(o) }))
    .sort((p, q) => p.lo - q.lo);

  const pieces = [];
  let cur = A0;
  for (const o of ops) {
    if (o.lo > cur + 1e-3) pieces.push([cur, o.lo, FF0, FF1, 'solid']);
    if (o.sill > FF0 + 0.02) pieces.push([o.lo, o.hi, FF0, o.sill, 'sill']);
    if (o.head < FF1 - 0.02) pieces.push([o.lo, o.hi, o.head, FF1, 'lintel']);
    cur = o.hi;
  }
  if (A1 > cur + 1e-3) pieces.push([cur, A1, FF0, FF1, 'solid']);

  for (const [a0, a1, y0, y1, kind] of pieces) {
    const lo = kind === 'solid' && Math.abs(a0 - A0) < 1e-3 ? eLo : null;
    const hi = kind === 'solid' && Math.abs(a1 - A1) < 1e-3 ? eHi : null;
    const top = kind === 'sill' ? 'reveal' : null, bottom = kind === 'lintel' ? 'reveal' : null;
    const f = vertical
      ? { nx: w.s0, px: w.s1, nz: lo, pz: hi, py: top, ny: bottom }
      : { nz: w.s0, pz: w.s1, nx: lo, px: hi, py: top, ny: bottom };
    if (w.faces) Object.assign(f, w.faces);
    // sills and lintels reach 0.02 ft into the neighbouring pieces, so no hairline
    // cracks open along the T-junctions at the corners of the opening
    const ov = kind === 'solid' ? 0 : 0.02;
    if (vertical) B.box(t0, t1, y0, y1, a0 - ov, a1 + ov, f);
    else B.box(a0 - ov, a1 + ov, y0, y1, t0, t1, f);
    colliders.push(vertical
      ? { x0: t0, x1: t1, z0: a0, z1: a1, y0, y1, id: w.id }
      : { x0: a0, x1: a1, z0: t0, z1: t1, y0, y1, id: w.id });
  }

  // jamb faces inside each opening
  for (const o of ops) {
    const ya = o.sill, yb = o.head;
    for (const [a, d] of [[o.lo, 1], [o.hi, -1]]) {
      if (vertical) {
        if (d > 0) B.quad(jm, [t0, ya, a], [t1, ya, a], [t1, yb, a], [t0, yb, a], [0, 0, 1]);
        else B.quad(jm, [t1, ya, a], [t0, ya, a], [t0, yb, a], [t1, yb, a], [0, 0, -1]);
      } else if (d > 0) B.quad(jm, [a, ya, t1], [a, ya, t0], [a, yb, t0], [a, yb, t1], [1, 0, 0]);
      else B.quad(jm, [a, ya, t0], [a, ya, t1], [a, yb, t1], [a, yb, t0], [-1, 0, 0]);
    }
  }
}

// ---------------------------------------------------------------------------
// Doors and windows
// ---------------------------------------------------------------------------
function buildOpening(B, G, WB, leaves, w, o, colliders) {
  const { mats } = CTX;
  const vertical = isVertical(w);
  const [t0, t1] = vertical ? w.x : w.z;
  const tc = (t0 + t1) / 2;
  const lo = Math.min(o.a, o.b), hi = Math.max(o.a, o.b), width = hi - lo;
  const { sill, head } = heights(o);
  const outer0 = EXT.has(w.s0), outer1 = EXT.has(w.s1);
  // box in (along, thickness) space
  const bx = (a0, a1, y0, y1, c0, c1, m, into = B) => (vertical ? into.box(c0, c1, y0, y1, a0, a1, m) : into.box(a0, a1, y0, y1, c0, c1, m));
  const block = (a0, a1, c0, c1, y0, y1, id) => colliders.push(vertical
    ? { x0: c0, x1: c1, z0: a0, z1: a1, y0, y1, id }
    : { x0: a0, x1: a1, z0: c0, z1: c1, y0, y1, id });

  // ---- windows and ventilators ----
  if (o.t === 'win' || o.t === 'vent') {
    const teakF = o.frame === 'teak';
    const fw = teakF ? 0.2 : 0.14, fd = teakF ? 0.26 : 0.22;
    const f0 = tc - fd / 2, f1 = tc + fd / 2;
    const rail = teakF ? 'teakFrame' : 'frameDark', post = teakF ? 'teakFrameV' : 'frameDark';
    bx(lo, hi, sill, sill + fw, f0, f1, rail);
    bx(lo, hi, head - fw, head, f0, f1, rail);
    bx(lo, lo + fw, sill, head, f0, f1, post);
    bx(hi - fw, hi, sill, head, f0, f1, post);
    if (o.t === 'vent') {
      for (let y = sill + 0.3; y < head - 0.2; y += 0.28) bx(lo + fw, hi - fw, y, y + 0.03, tc - 0.08, tc + 0.08, 'glass', G);
      return;
    }
    const panes = width > 4.5 ? 3 : width > 2.6 ? 2 : 1;
    for (let i = 1; i < panes; i++) {
      const m = lo + (width * i) / panes;
      bx(m - fw * 0.4, m + fw * 0.4, sill, head, f0, f1, post);
    }
    if (teakF) {
      bx(lo + fw, hi - fw, sill + fw, head - fw, tc - 0.015, tc + 0.015, 'glass', G);
    } else {
      // two sliding tracks, slightly offset
      for (let i = 0; i < panes; i++) {
        const a = lo + (width * i) / panes + fw * 0.5, b = lo + (width * (i + 1)) / panes - fw * 0.5;
        const off = i % 2 ? 0.04 : -0.04;
        bx(a, b, sill + fw, head - fw, tc + off - 0.012, tc + off + 0.012, 'glass', G);
      }
    }
    // granite sill inside, white drip outside
    const inner = outer0 ? [t1 - 0.05, t1 + 0.18] : outer1 ? [t0 - 0.18, t0 + 0.05] : [t0 - 0.12, t1 + 0.12];
    bx(lo - 0.1, hi + 0.1, sill - 0.06, sill + 0.02, inner[0], inner[1], 'graniteBlack');
    if (outer0) bx(lo - 0.15, hi + 0.15, sill - 0.12, sill, t0 - 0.25, t0 + 0.05, 'white');
    if (outer1) bx(lo - 0.15, hi + 0.15, sill - 0.12, sill, t1 - 0.05, t1 + 0.25, 'white');
    if (o.curtain) sheer(vertical, o.curtain > 0 ? t1 + 0.12 : t0 - 0.12, lo + 0.1, hi - 0.1, sill + 0.12, head - 0.05);
    return;
  }

  // ---- open archway: a granite strip across the wall, flush with the floors ----
  if (o.t === 'arch') {
    bx(lo, hi, FF0, FL, t0, t1, { py: 'graniteBlack', all: null }, WB);
    return;
  }

  // ---- sliding glass door: one fixed panel, the other slid open behind it ----
  if (o.t === 'slide') {
    const fw = 0.14, fd = 0.3;
    bx(lo, hi, head - fw, head, tc - fd / 2, tc + fd / 2, 'frameDark');
    bx(lo, lo + fw, FF0, head - fw, tc - fd / 2, tc + fd / 2, 'frameDark');
    bx(hi - fw, hi, FF0, head - fw, tc - fd / 2, tc + fd / 2, 'frameDark');
    bx(lo + fw, hi - fw, FF0, FL + 0.03, t0, t1, 'graniteBlack', WB); // track stone
    const mid = (lo + hi) / 2;
    const panel = (a, b, c) => {
      const pw = 0.12, pd = 0.07;
      bx(a, b, FL + 0.03, FL + 0.03 + pw, c - pd / 2, c + pd / 2, 'frameDark');
      bx(a, b, head - fw - pw, head - fw, c - pd / 2, c + pd / 2, 'frameDark');
      bx(a, a + pw, FL + 0.03, head - fw, c - pd / 2, c + pd / 2, 'frameDark');
      bx(b - pw, b, FL + 0.03, head - fw, c - pd / 2, c + pd / 2, 'frameDark');
      bx(a + pw, b - pw, FL + 0.03 + pw, head - fw - pw, c - 0.012, c + 0.012, 'glass', G);
    };
    const outward = outer1 ? 1 : -1; // the fixed panel runs in the outer track
    panel(lo + fw, mid + 0.08, tc + outward * 0.07);
    panel(lo + fw + 0.06, mid + 0.14, tc - outward * 0.07);
    block(lo, mid + 0.14, t0, t1, FF0, head, 'slide');
    return;
  }

  // ---- hinged doors (flush wood, panelled teak, PVC or glazed), shown open ----
  const cfg = FF_DOORS[o.door] || { hinge: 'a', side: 1, style: 'wood' };
  const fw = 0.25;
  const fm = cfg.style === 'teak' ? 'doorTeak' : 'doorWood';
  const d0 = t0 - 0.05, d1 = t1 + 0.05;
  bx(lo, lo + fw, FF0, head, d0, d1, fm);
  bx(hi - fw, hi, FF0, head, d0, d1, fm);
  bx(lo, hi, head - fw, head, d0, d1, fm);
  bx(lo + fw, hi - fw, FF0, FL + 0.03, t0, t1, cfg.style === 'teak' ? 'marble' : 'graniteBlack', WB);

  const leafH = head - fw - FL - 0.04;
  const leafT = cfg.style === 'teak' ? 0.18 : 0.13;
  const clear = width - 2 * fw;
  const faceAt = cfg.side === 1 ? t1 : t0;
  const dir = cfg.side === 1 ? 1 : -1;
  const hinge = cfg.hinge === 'a' ? lo + fw : hi - fw, sgn = cfg.hinge === 'a' ? 1 : -1;
  const leaf = makeLeaf(mats, cfg.style, clear, leafH, leafT, vertical ? dir : -dir);
  // the leaf stands open, square to the wall, against its hinge jamb
  const along = hinge + sgn * leafT / 2;
  const across = faceAt + dir * (clear / 2 + 0.02);
  if (vertical) leaf.position.set(across, FL + 0.02, along);
  else { leaf.rotation.y = Math.PI / 2; leaf.position.set(along, FL + 0.02, across); }
  leaves.add(leaf);
  const c0 = Math.min(faceAt, faceAt + dir * clear), c1 = Math.max(faceAt, faceAt + dir * clear);
  block(along - leafT, along + leafT, c0, c1, FL, head, 'leaf');
}

/** Softly folded sheer curtain filling a window (vertical: wall runs along z; c = plane coordinate). */
function sheer(vertical, c, a, b, ya, yb) {
  const w = b - a, h = yb - ya;
  const geo = new THREE.PlaneGeometry(w, h, Math.max(8, Math.round(w * 6)), 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) + w / 2) * 5.2) * 0.07);
  geo.computeVertexNormals();
  worldUV(geo);
  const m = new THREE.Mesh(geo, CTX.mats.get('curtainSheer'));
  if (vertical) { m.rotation.y = Math.PI / 2; m.position.set(c, (ya + yb) / 2, (a + b) / 2); }
  else m.position.set((a + b) / 2, (ya + yb) / 2, c);
  m.castShadow = false;
  m.receiveShadow = true;
  CTX.house.add(m);
}

// ---------------------------------------------------------------------------
// Bathroom wall tiles (7 ft high) and the kitchen dado
// ---------------------------------------------------------------------------
function cladding(B) {
  const y0 = FL, y1 = FL + 7, t = 0.03;
  const door = (a, b) => [a, b, FF0, FF0 + 7];
  const vent = (a, b) => [a, b, FF0 + 6, FF0 + 7.5];
  // face(axis 'x' | 'z', plane coordinate, normal sign, u0, u1, material, holes [[ua, ub, ya, yb]], ya, yb)
  const face = (axis, c, s, u0, u1, mat, holes = [], ya = y0, yb = y1) => {
    const cuts = holes.filter((h) => h[1] > u0 && h[0] < u1).sort((p, q) => p[0] - q[0]);
    const rects = [];
    let cur = u0;
    for (const h of cuts) {
      if (h[0] > cur) rects.push([cur, h[0], ya, yb]);
      if (h[2] > ya) rects.push([Math.max(h[0], u0), Math.min(h[1], u1), ya, Math.min(h[2], yb)]);
      if (h[3] < yb) rects.push([Math.max(h[0], u0), Math.min(h[1], u1), Math.max(h[3], ya), yb]);
      cur = Math.max(cur, h[1]);
    }
    if (cur < u1) rects.push([cur, u1, ya, yb]);
    for (const [a, b, c0, c1] of rects) {
      if (c1 - c0 < 0.01 || b - a < 0.01) continue;
      if (axis === 'z') B.box(a, b, c0, c1, s > 0 ? c : c - t, s > 0 ? c + t : c, mat);
      else B.box(s > 0 ? c : c - t, s > 0 ? c + t : c, c0, c1, a, b, mat);
    }
  };
  // Bathroom 3 (x 0.75..6.0, z -36.9..-30.934): shower at the back, WC and basin on the outer wall
  face('x', 0.75, 1, -36.9, -30.934, 'bathWall', [vent(-35.4, -33.4)]);
  face('x', 6.0, -1, -36.9, -30.934, 'bathWall', [door(-34.95, -32.2)]);
  face('z', -36.9, 1, 0.75, 6.0, 'bathAccent');
  face('z', -30.934, -1, 0.75, 6.0, 'bathWall');
  // Bathroom 4 (x 28.422..34.667, z -26.53..-21.074): WC on the party wall
  face('x', 28.422, 1, -26.53, -21.074, 'bathWall');
  face('x', PLOT.width - 0.75, -1, -26.53, -21.074, 'bathAccent');
  face('z', -26.53, 1, 28.422, PLOT.width - 0.75, 'bathWall', [door(30.1, 32.85)]);
  face('z', -21.074, -1, 28.422, PLOT.width - 0.75, 'bathWall', [vent(32.6, 34.2)]);
  // Common toilet (x 22.674..28.07, z -26.53..-21.074)
  face('x', 22.674, 1, -26.53, -21.074, 'bathWall', [door(-25.35, -22.6)]);
  face('x', 28.07, -1, -26.53, -21.074, 'bathAccent');
  face('z', -26.53, 1, 22.674, 28.07, 'bathWall');
  face('z', -21.074, -1, 22.674, 28.07, 'bathWall');
  // Kitchen dado: band above the L-shaped counter
  const k0 = FL + 2.9, k1 = FL + 5.2;
  face('z', -20.282, 1, 22.674, 31.59, 'kitchenDado', [], k0, k1);
  face('x', 31.59, -1, -20.282, -10.6, 'kitchenDado', [[-17.0, -13.0, FF0 + 3.5, FF0 + 7]], k0, k1);
}

// ---------------------------------------------------------------------------
// Stair from the first-floor landing to the roof: the same dog-leg as below, two
// flights of 10 risers on sloping waist slabs, directly over the lower flights.
// ---------------------------------------------------------------------------
/** One flight as a solid: 9 treads with a soffit parallel to the pitch (h below the nosings' roots). */
function flightGeometry(xs, dir, ys, z0, z1, r, t, h) {
  const s = new THREE.Shape();
  const X = (u) => xs + dir * u;
  s.moveTo(X(0), ys - h);
  s.lineTo(X(0), ys + r);
  for (let i = 1; i <= 9; i++) {
    s.lineTo(X(i * t), ys + i * r);
    if (i < 9) s.lineTo(X(i * t), ys + (i + 1) * r);
  }
  s.lineTo(X(9 * t), ys + 9 * r - h);
  s.closePath();
  let geo = new THREE.ExtrudeGeometry(s, { depth: z1 - z0, bevelEnabled: false });
  geo.translate(0, 0, z0);
  // 0 treads, 1 soffit, 2 sides, 3 risers
  geo = regroup(geo, (gi, c, n) => (n.y > 0.7 ? 0 : n.y < -0.3 ? 1 : Math.abs(n.z) > 0.7 ? 2 : 3));
  worldUV(geo);
  return geo;
}

function buildUpperStair(ctx) {
  const { mats, house, colliders, walkables } = ctx;
  const S = STAIR, r = S.rise2, t = S.tread, h = 0.5;
  const x0 = S.firstRiser, xL = S.landingX;
  const land = FF0 + 10 * r;                 // upper mid landing
  const f1 = [S.flight1[0] + 0.02, S.flight1[1]], f2 = S.flight2;
  const mset = [mats.get('graniteGrey'), mats.get('reveal'), mats.get('pStair'), mats.get('marble')];
  const g = new THREE.Group();
  g.name = 'upper-stair';
  for (const geo of [
    flightGeometry(x0, 1, FF0, f1[0], f1[1], r, t, h),   // first flight rises eastwards from the landing
    flightGeometry(xL, -1, land, f2[0], f2[1], r, t, h), // second flight rises westwards to the roof
  ]) {
    const m = new THREE.Mesh(geo, mset);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    walkables.push(m);
  }
  // mid landing (a deep edge so it meets the soffit of the first flight)
  const LB = new Batcher();
  const landBottom = FF0 + 9 * r - h;
  LB.box(xL, PLOT.width - 0.75, landBottom, land, S.z0, S.z1, { py: 'graniteGrey', ny: 'reveal', nx: 'marble', pz: 'pStair', nz: null, px: null });
  const lg = LB.build((k) => mats.get(k), { name: 'upper-landing' });
  lg.traverse((o) => o.isMesh && walkables.push(o));
  g.add(lg);
  house.add(g);
  // granite floor of the landing at the top, inside the mumty
  const MB = new Batcher();
  MB.box(18.25, x0, LV.roof, LV.roof + 0.04, S.z0, S.z1, { py: 'graniteGrey', px: 'marble', all: null });
  const mg = MB.build((k) => mats.get(k), { name: 'floor-mumty', castShadow: false });
  mg.traverse((o) => { if (o.isMesh) { o.userData.room = 'mumty'; walkables.push(o); ctx.pickables.push(o); } });
  house.add(mg);

  // colliders: each step from its soffit up to its tread, and the landing
  const soff1 = (x) => FF0 - h + (x - x0) * (r / t);
  const soff2 = (x) => land - h + (xL - x) * (r / t);
  for (let i = 0; i < 9; i++) {
    const xa = x0 + i * t, xb = xa + t;
    colliders.push({ x0: xa, x1: xb, z0: S.flight1[0], z1: f1[1], y0: soff1(xa), y1: FF0 + (i + 1) * r, id: 'stair3' });
  }
  for (let j = 1; j <= 9; j++) {
    const xb = xL - (j - 1) * t, xa = xb - t;
    colliders.push({ x0: xa, x1: xb, z0: f2[0], z1: f2[1], y0: soff2(xb), y1: land + j * r, id: 'stair4' });
  }
  colliders.push({ x0: xL, x1: PLOT.width - 0.75, z0: S.z0, z1: S.z1, y0: landBottom, y1: land, id: 'landing2' });

  // railings on the inner edges of both flights
  const rail = new THREE.Group();
  rail.name = 'upper-stair-railing';
  stairRail(mats, rail, f1[1] - 0.08, x0 + t * 0.5, xL - t * 0.5, FF0 + r, land - r * 0.5);
  stairRail(mats, rail, f2[0] + 0.08, xL - t * 0.5, x0 + t * 0.5, land + r, LV.roof - r * 0.5);
  // balustrade round the stair well at roof level (where the first flight starts below)
  {
    const steel = mats.get('steel'), wood = mats.get('doorTeak');
    const xr = x0 - 0.12, za = S.z0 + 0.15, zb = S.flight1[1];
    const postGeo = new THREE.CylinderGeometry(0.05, 0.05, 3, 8);
    for (let i = 0; i <= 4; i++) {
      const p = new THREE.Mesh(postGeo, steel);
      p.position.set(xr, LV.roof + 1.5, za + ((zb - za) * i) / 4);
      p.castShadow = true;
      rail.add(p);
    }
    const hr = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.16, zb - S.z0), wood);
    hr.position.set(xr, LV.roof + 3.05, (zb + S.z0) / 2);
    hr.castShadow = true;
    rail.add(hr);
    for (const y of [1.0, 2.0]) {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, zb - za, 8), steel);
      bar.rotation.x = Math.PI / 2;
      bar.position.set(xr, LV.roof + y, (za + zb) / 2);
      rail.add(bar);
    }
    colliders.push({ x0: xr - 0.15, x1: x0 + 0.05, z0: S.z0, z1: zb, y0: LV.roof, y1: LV.roof + 3.2, id: 'roof-rail' });
  }
  house.add(rail);
}
