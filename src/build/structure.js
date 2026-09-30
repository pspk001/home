import * as THREE from 'three';
import { Batcher, extrudeXZ, regroup } from '../geometry.js';
import { LV, OPENING, PLOT, rearZ, REAR_T, STAIR, VOID, voidOutline, ductOutline, inDuct } from '../config.js';
import { WALLS, ROOMS } from '../plan.js';

const EXTERIOR = new Set(['ext', 'extTan', 'pPortico', 'siding']);
const TOP = LV.gfCeil;

/** Splits one wall into solid pieces around its openings. */
export function wallPieces(w) {
  const vertical = w.z[1] - w.z[0] > w.x[1] - w.x[0];
  const [a0, a1] = vertical ? w.z : w.x;
  const ops = (w.open || [])
    .map((o) => ({ ...o, lo: Math.min(o.a, o.b), hi: Math.max(o.a, o.b) }))
    .sort((p, q) => p.lo - q.lo);
  const pieces = [];
  let cur = a0;
  for (const o of ops) {
    if (o.lo > cur + 1e-3) pieces.push({ a0: cur, a1: o.lo, y0: 0, y1: TOP });
    const [sill, head] = OPENING[o.t];
    if (sill > 0) pieces.push({ a0: o.lo, a1: o.hi, y0: 0, y1: sill, sill: true });
    if (head < TOP) pieces.push({ a0: o.lo, a1: o.hi, y0: head, y1: TOP, lintel: true });
    cur = o.hi;
  }
  if (a1 > cur + 1e-3) pieces.push({ a0: cur, a1, y0: 0, y1: TOP });
  return { vertical, pieces };
}

// Only faces that can actually be seen are emitted: faces sandwiched between
// two touching boxes would z-fight (and flash the dark section colour).
function faceMats(w, vertical, lower, { endLo, endHi, top, bottom, ductLo, ductHi }) {
  let s0 = w.s0, s1 = w.s1;
  if (lower) {
    if (EXTERIOR.has(s0)) s0 = 'plinth';
    if (EXTERIOR.has(s1)) s1 = 'plinth';
  }
  const extSide = EXTERIOR.has(w.s0) ? w.s0 : EXTERIOR.has(w.s1) ? w.s1 : null;
  const end = extSide ? (lower ? 'plinth' : extSide) : 'reveal';
  // an end that looks into the pipe line shaft takes the shaft's plaster
  const lo = endLo ? (ductLo ? 'pDuct' : end) : null, hi = endHi ? (ductHi ? 'pDuct' : end) : null;
  const py = top ? 'reveal' : null, ny = bottom ? 'reveal' : null;
  return vertical
    ? { nx: s0, px: s1, nz: lo, pz: hi, py, ny }
    : { nz: s0, pz: s1, nx: lo, px: hi, py, ny };
}

/** Is the point inside any other wall (or the slanted rear wall)? */
function solidAt(px, pz, self) {
  if (pz < rearZ(px) + REAR_T - 0.02) return true; // rear wall
  for (const w of WALLS) {
    if (w === self) continue;
    if (px >= w.x[0] - 0.01 && px <= w.x[1] + 0.01 && pz >= w.z[0] - 0.01 && pz <= w.z[1] + 0.01) return true;
  }
  return false;
}

export function buildStructure(ctx) {
  const { mats, colliders, walkables, pickables, house } = ctx;
  const B = new Batcher();

  // ---- walls -------------------------------------------------------------
  for (const w0 of WALLS) {
    const w = { ...w0, z: [...w0.z] };
    const rz = rearZ(w.x[1]);
    if (w.z[0] < rz) w.z[0] = rz; // never poke through the slanted rear face
    const { vertical, pieces } = wallPieces(w);
    const [A0, A1] = vertical ? w.z : w.x;
    const tc = vertical ? (w.x[0] + w.x[1]) / 2 : (w.z[0] + w.z[1]) / 2;
    const freeEnd = (a, dir) => {
      const q = a + dir * 0.06;
      return !(vertical ? solidAt(tc, q, w0) : solidAt(q, tc, w0));
    };
    const freeLo = freeEnd(A0, -1), freeHi = freeEnd(A1, 1);
    const ductEnd = (a, dir) => (vertical ? inDuct(tc, a + dir * 0.06, 0) : inDuct(a + dir * 0.06, tc, 0));
    const ductLo = ductEnd(A0, -1), ductHi = ductEnd(A1, 1);
    for (const p of pieces) {
      const spans = [];
      if (p.y0 < LV.gf && p.y1 > LV.gf) spans.push([p.y0, LV.gf, true], [LV.gf, p.y1, false]);
      else spans.push([p.y0, p.y1, p.y1 <= LV.gf + 1e-3]);
      const solid = !p.sill && !p.lintel;
      // full-height end faces only where the wall ends in free space;
      // jambs beside openings are added below, limited to the opening height
      const endLo = solid && Math.abs(p.a0 - A0) < 1e-3 && freeLo;
      const endHi = solid && Math.abs(p.a1 - A1) < 1e-3 && freeHi;
      for (const [y0, y1, lower] of spans) {
        const m = faceMats(w, vertical, lower, {
          endLo, endHi, ductLo, ductHi,
          top: p.sill ? y1 === p.y1 : false,
          bottom: p.lintel ? y0 === p.y0 : false,
        });
        if (vertical) B.box(w.x[0], w.x[1], y0, y1, p.a0, p.a1, m);
        else B.box(p.a0, p.a1, y0, y1, w.z[0], w.z[1], m);
      }
      const c = vertical
        ? { x0: w.x[0], x1: w.x[1], z0: p.a0, z1: p.a1 }
        : { x0: p.a0, x1: p.a1, z0: w.z[0], z1: w.z[1] };
      colliders.push({ ...c, y0: p.y0, y1: p.y1, id: w.id });
    }
    // jamb (reveal) faces inside each opening
    const extSide = EXTERIOR.has(w.s0) ? w.s0 : EXTERIOR.has(w.s1) ? w.s1 : null;
    const jm = extSide || 'reveal';
    const [t0, t1] = vertical ? w.x : w.z;
    for (const o of w.open || []) {
      const lo = Math.min(o.a, o.b), hi = Math.max(o.a, o.b);
      const [sill, head] = OPENING[o.t];
      const y0 = Math.max(sill, LV.gf - 0.05), y1 = head;
      const jambs = [];
      if (lo > A0 + 1e-3 || freeLo) jambs.push([lo, +1]);
      if (hi < A1 - 1e-3 || freeHi) jambs.push([hi, -1]);
      for (const [a, d] of jambs) {
        if (vertical) {
          if (d > 0) B.quad(jm, [t0, y0, a], [t1, y0, a], [t1, y1, a], [t0, y1, a], [0, 0, 1]);
          else B.quad(jm, [t1, y0, a], [t0, y0, a], [t0, y1, a], [t1, y1, a], [0, 0, -1]);
        } else if (d > 0) B.quad(jm, [a, y0, t1], [a, y0, t0], [a, y1, t0], [a, y1, t1], [1, 0, 0]);
        else B.quad(jm, [a, y0, t0], [a, y0, t1], [a, y1, t1], [a, y1, t0], [-1, 0, 0]);
      }
    }
  }

  // ---- slanted rear walls ---------------------------------------------------
  // ends: material for both end faces, or [xa end, xb end] (null = the end abuts
  // another piece of rear wall, so no face: coincident faces would flicker)
  const rearWall = (xa, xb, t, y0, y1, inner, ends = 'ext', top = 'reveal') => {
    const [eA, eB] = Array.isArray(ends) ? ends : [ends, ends];
    const A = [xa, rearZ(xa)], Bp = [xb, rearZ(xb)];
    const pts = [[xa, A[1] + t], [xb, Bp[1] + t], [xb, Bp[1]], [xa, A[1]]];
    if (y0 < LV.gf && y1 > LV.gf) {
      B.prism(pts, y0, LV.gf, { top: null, bottom: null, sides: [inner, eB && 'plinth', 'plinth', eA && 'plinth'] });
      B.prism(pts, LV.gf, y1, { top, bottom: null, sides: [inner, eB, 'ext', eA] });
    } else {
      B.prism(pts, y0, y1, { top, bottom: null, sides: [inner, eB, 'ext', eA] });
    }
    // colliders: chop into 1 ft chunks along x (the wall is slightly slanted)
    for (let x = xa; x < xb; x += 1) {
      const xe = Math.min(xb, x + 1);
      colliders.push({ x0: x, x1: xe, z0: Math.min(rearZ(x), rearZ(xe)) - 0.05, z1: Math.max(rearZ(x), rearZ(xe)) + t, y0, y1, id: 'rear' });
    }
  };
  // (from x 6.643 across the dining area, the old garden and the kitchen, the wall
  //  is solid up to door height with a granite sill; the glass wall above it is
  //  built with the first floor in exterior.js)
  rearWall(0, 6.643, REAR_T, 0, TOP, 'pPuja', ['ext', null]);
  rearWall(6.643, 22.174, REAR_T, 0, VOID.glassSill, 'pHall', [null, null], 'graniteBlack');
  rearWall(22.174, PLOT.width, REAR_T, 0, VOID.glassSill, 'pKitchen', [null, 'ext'], 'graniteBlack');

  // exposed-concrete downstand beam under the edge of the first-floor balcony over the hall
  B.box(VOID.x0, VOID.hallX1, TOP - 1.0, TOP, VOID.hallFront, VOID.hallFront + 0.6, { all: 'concreteCeil', nx: null, px: null, py: null });

  // ---- bathroom wall tiles & kitchen dado ------------------------------------
  cladding(B, ctx);

  house.add(B.build((k) => mats.get(k), { name: 'walls' }));

  // ---- room floors (separate meshes so rooms can be picked) -----------------
  for (const room of ROOMS) {
    const y = LV[room.level];
    const RB = new Batcher();
    for (const [x0, x1, z0, z1] of room.rects) {
      if (room.rear && z0 < rearZ(x0) + 1) {
        const za = rearZ(x0) + 0.05, zb = rearZ(x1) + 0.05;
        RB.prism([[x0, z1], [x1, z1], [x1, zb], [x0, za]], 0, y, { top: room.floor, bottom: null, sides: [null, null, null, null] });
      } else {
        RB.box(x0, x1, 0, y, z0, z1, { py: room.floor, ny: null, all: null, pz: room.id === 'portico' ? 'concrete' : null });
      }
    }
    const g = RB.build((k) => mats.get(k), { name: `floor-${room.id}`, castShadow: false });
    g.traverse((o) => {
      if (o.isMesh) { o.userData.room = room.id; walkables.push(o); pickables.push(o); }
    });
    house.add(g);
  }

  // ---- ground-floor ceiling / first-floor slab --------------------------------
  // (open over the stair, over the double-height space at the rear and over the
  //  pipe line shaft, which rises to the sky)
  const outline = [[0, 0], [PLOT.width, 0], [PLOT.width, rearZ(PLOT.width)], [0, rearZ(0)]];
  const stairHole = [[STAIR.firstRiser, -8.843], [STAIR.x1, -8.843], [STAIR.x1, -0.792], [STAIR.firstRiser, -0.792]];
  // the slab edge round the double-height space is left as exposed concrete;
  // inside the shaft it is plastered like the shaft walls
  const vo = voidOutline();
  const onVoidEdge = (c) => vo.some((p, i) => {
    const q = vo[(i + 1) % vo.length];
    const dx = q[0] - p[0], dz = q[1] - p[1];
    const t = Math.max(0, Math.min(1, ((c.x - p[0]) * dx + (c.z - p[1]) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(c.x - (p[0] + t * dx), c.z - (p[1] + t * dz)) < 0.05;
  });
  const slabGeo = regroup(extrudeXZ(outline, [stairHole, vo, ductOutline()], LV.gfCeil, LV.ff),
    (gi, c) => (gi !== 2 ? gi : onVoidEdge(c) ? 3 : inDuct(c.x, c.z) ? 4 : 2));
  const slab = new THREE.Mesh(slabGeo, [mats.get('slabTop'), mats.get('ceiling'), mats.get('slabEdge'), mats.get('concreteCeil'), mats.get('pDuct')]);
  slab.name = 'gf-ceiling-slab';
  slab.castShadow = slab.receiveShadow = true;
  slab.userData.ceiling = true;
  house.add(slab);

  // ---- staircase ------------------------------------------------------------
  buildStair(ctx);

  // ---- steps from portico up to the main door --------------------------------
  const SB = new Batcher();
  const stepZ = [-16.25, -11.07];
  SB.box(13.93, 14.827, 0, LV.gf - STAIR.rise * 0.92, stepZ[0], stepZ[1], { py: 'graniteGrey', all: 'graniteGrey', ny: null });
  SB.box(13.03, 13.93, 0, LV.gf - STAIR.rise * 1.84, stepZ[0], stepZ[1], { py: 'graniteGrey', all: 'graniteGrey', ny: null });
  const steps = SB.build((k) => mats.get(k), { name: 'portico-steps' });
  steps.traverse((o) => o.isMesh && walkables.push(o));
  house.add(steps);
}

// ---------------------------------------------------------------------------
function cladding(B, ctx) {
  const y0 = LV.gf, y1 = LV.gf + 7;
  const t = 0.03;
  // face(axis 'x'|'z', plane coordinate, normal sign, u0, u1, material, holes[[ua,ub,ya,yb]])
  const face = (axis, c, s, u0, u1, mat, holes = [], ya = y0, yb = y1) => {
    // split the [u0,u1]x[ya,yb] rectangle around holes (simple vertical strips)
    const cuts = holes.filter((h) => h[1] > u0 && h[0] < u1).sort((a, b) => a[0] - b[0]);
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
  // Common toilet (x 21.03..28.07, z -26.53..-21.074) — door on the left wall
  face('z', -26.53, +1, 21.03, 28.07, 'bathWall');
  face('z', -21.074, -1, 21.03, 28.07, 'bathWall');
  face('x', 21.03, +1, -26.53, -21.074, 'bathWall', [[-26.266, -23.45, LV.gf, LV.gf + 7]]);
  face('x', 28.07, -1, -26.53, -21.074, 'bathAccent');
  // Attached toilet (x 28.422..34.581) — door + ventilator on the front wall
  face('z', -26.53, +1, 28.422, 34.581, 'bathWall');
  face('z', -21.074, -1, 28.422, 34.581, 'bathWall', [[28.774, 31.59, LV.gf, LV.gf + 7], [32.602, 34.185, LV.gf + 6, LV.gf + 7.5]]);
  face('x', 28.422, +1, -26.53, -21.074, 'bathWall');
  face('x', 34.581, -1, -26.53, -21.074, 'bathAccent');

  // Kitchen dado: 2' band above the counter on the rear (slanted) and right walls
  const k0 = LV.gf + 2.9, k1 = LV.gf + 5.2;
  const xa = 22.922, xb = 34.581;
  const za = rearZ(xa) + REAR_T, zb = rearZ(xb) + REAR_T;
  B.prism([[xa, za + t], [xb, zb + t], [xb, zb], [xa, za]], k0, k1, { top: 'kitchenDado', bottom: 'kitchenDado', sides: ['kitchenDado', 'kitchenDado', null, 'kitchenDado'] });
  face('x', 34.581, -1, zb, -38.321, 'kitchenDado', [], k0, k1);
}

// ---------------------------------------------------------------------------
function buildStair(ctx) {
  const { mats, colliders, walkables, house } = ctx;
  const S = STAIR;
  const B = new Batcher();
  const f1 = S.flight1, f2 = S.flight2;
  const treadMat = { py: 'graniteGrey', nx: 'marble', px: null, pz: 'pStair', nz: null, ny: null };

  // Flight 1: rises eastwards on solid masonry
  for (let i = 0; i < 9; i++) {
    const xa = S.firstRiser + i * S.tread, xb = xa + S.tread;
    const top = LV.gf + (i + 1) * S.rise;
    B.box(xa, xb, LV.gf - 0.1, top, f1[0], f1[1], treadMat);
    colliders.push({ x0: xa, x1: xb, z0: f1[0], z1: f1[1], y0: LV.gf, y1: top, id: 'stair' });
  }
  // Mid landing
  const landTop = LV.gf + 10 * S.rise;
  B.box(S.landingX, S.x1, LV.gf - 0.1, landTop, S.z0, S.z1, { py: 'graniteGrey', nx: 'marble', all: null });
  colliders.push({ x0: S.landingX, x1: S.x1, z0: S.z0, z1: S.z1, y0: LV.gf, y1: landTop, id: 'landing' });

  // Flight 2: rises westwards on a sloping waist slab (open space beneath)
  const waist = 0.75;
  const under = (x) => {
    const t = (S.landingX - x) / (S.landingX - S.firstRiser);
    return landTop - waist + t * (LV.ff - landTop);
  };
  for (let j = 1; j <= 9; j++) {
    const xb = S.landingX - (j - 1) * S.tread, xa = xb - S.tread;
    const top = landTop + j * S.rise;
    const bottom = under(xa);
    B.box(xa, xb, bottom, top, f2[0], f2[1], { py: 'graniteGrey', px: 'marble', nx: j === 9 ? 'marble' : null, pz: null, nz: null, ny: null });
    colliders.push({ x0: xa, x1: xb, z0: f2[0], z1: f2[1], y0: under(xb), y1: top, id: 'stair2' });
  }
  // sloping soffit under flight 2
  const xL = S.firstRiser, xR = S.landingX;
  const yL = under(xL), yR = under(xR);
  const len = Math.hypot(xR - xL, yR - yL);
  const nrm = [-(yL - yR) / len, -(xR - xL) / len, 0]; // underside normal: points down-west
  B.quad('reveal', [xR, yR, f2[0]], [xR, yR, f2[1]], [xL, yL, f2[1]], [xL, yL, f2[0]], nrm);
  // stringer on the open (north) side of flight 2
  const prof = new THREE.Shape();
  prof.moveTo(xR, yR);
  for (let j = 1; j <= 9; j++) {
    const xb = S.landingX - (j - 1) * S.tread, xa = xb - S.tread;
    const top = landTop + j * S.rise;
    prof.lineTo(xb, top); prof.lineTo(xa, top);
  }
  prof.lineTo(xL, yL);
  prof.closePath();
  const sg = new THREE.ExtrudeGeometry(prof, { depth: 0.06, bevelEnabled: false });
  sg.translate(0, 0, f2[0] - 0.06);
  const stringer = new THREE.Mesh(sg, mats.get('pStair'));
  stringer.castShadow = stringer.receiveShadow = true;
  house.add(stringer);

  const stairGroup = B.build((k) => mats.get(k), { name: 'stair' });
  stairGroup.traverse((o) => o.isMesh && walkables.push(o));
  house.add(stairGroup);

  // Railings (steel posts + teak handrail) along the inner edges of both flights
  const rail = new THREE.Group();
  rail.name = 'stair-railing';
  const postGeo = new THREE.CylinderGeometry(0.05, 0.05, 1, 8);
  const steel = mats.get('steel');
  const wood = mats.get('doorTeak');
  const addRail = (z, xStart, xEnd, yStart, yEnd) => {
    const n = 6;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = xStart + (xEnd - xStart) * t;
      const yb = yStart + (yEnd - yStart) * t;
      const post = new THREE.Mesh(postGeo, steel);
      post.scale.y = 3;
      post.position.set(x, yb + 1.5, z);
      post.castShadow = true;
      rail.add(post);
    }
    const dx = xEnd - xStart, dy = yEnd - yStart;
    const L = Math.hypot(dx, dy);
    const hr = new THREE.Mesh(new THREE.BoxGeometry(L + 0.3, 0.16, 0.22), wood);
    hr.position.set((xStart + xEnd) / 2, (yStart + yEnd) / 2 + 3.05, z);
    hr.rotation.z = Math.atan2(dy, dx);
    hr.castShadow = true;
    rail.add(hr);
    const mid = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, L, 8), steel);
    mid.position.set((xStart + xEnd) / 2, (yStart + yEnd) / 2 + 1.6, z);
    mid.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
    rail.add(mid);
  };
  addRail(-4.9, S.firstRiser + S.tread * 0.5, S.landingX - S.tread * 0.5, LV.gf + S.rise, landTop - S.rise * 0.5);
  addRail(-4.75, S.landingX - S.tread * 0.5, S.firstRiser + S.tread * 0.5, landTop + S.rise, LV.ff - S.rise * 0.5);
  house.add(rail);

  // central collider between the flights + barrier at the top (first floor not modelled)
  colliders.push({ x0: S.firstRiser, x1: S.landingX, z0: -4.97, z1: -4.68, y0: 0, y1: 40, id: 'stair-mid' });
  colliders.push({ x0: S.firstRiser - 0.2, x1: S.firstRiser + S.tread * 2, z0: f2[0], z1: f2[1], y0: 0, y1: 40, id: 'stair-top' });
}
