import * as THREE from 'three';
import { Batcher, extrudeXZ, regroup, roundedRect, worldUV } from '../geometry.js';
import { LV, PLOT, rearZ, REAR_T, VOID, BAY, REAR_COLS, REAR_COL_D, voidOutline, DUCT, ductOutline, inDuct, STAIR, GARDEN, gardenWalls } from '../config.js';
import { makeLeaf } from './openings.js';

// ---------------------------------------------------------------------------
// Everything outside the rooms: the stair tower front, the rear wall of the
// first floor, the roof (a walkable terrace) and its parapets, the mumty, the
// white "C" frame, wood cladding, gates, the terrace edge, the glass wall of the
// double-height space and the street/site around the plot. The first-floor walls
// themselves are in firstfloor.js.
// ---------------------------------------------------------------------------

const FF0 = LV.ff, FF1 = LV.ffCeil;
const T = 0.75; // first-floor wall thickness
let GB; // glass batch (no shadow casting, so sunlight passes through)
let CTX;

/** Teak for a frame member: a joint-free grain that runs along the member (V = upright). */
const teak = (w, h) => (h > w ? 'teakFrameV' : 'teakFrame');

/**
 * Wall with openings on the first floor.
 * o: [{ a, b, sill, head, glass?: key|false, frame?: key|false, curtain?: ±1 }]
 * curtain = side of the wall (along its thickness axis) that gets a sheer curtain.
 */
function wallRun(B, { x, z, y0, y1, s0, s1, end = 'ext', open = [] }, colliders) {
  const vertical = z[1] - z[0] > x[1] - x[0];
  const [a0, a1] = vertical ? z : x;
  const [t0, t1] = vertical ? x : z;
  const tc = (t0 + t1) / 2;
  const box = (p0, p1, ya, yb, m) => (vertical ? B.box(x[0], x[1], ya, yb, p0, p1, m) : B.box(p0, p1, ya, yb, z[0], z[1], m));
  // end faces only at the two ends of the run; inside an opening, jamb faces between
  // its sill and head (a full-height end face would show its edge as a hairline on the
  // wall face above and below the opening)
  const faces = (lo, hi, top, bottom) => (vertical
    ? { nx: s0, px: s1, nz: lo, pz: hi, py: top, ny: bottom }
    : { nz: s0, pz: s1, nx: lo, px: hi, py: top, ny: bottom });
  const jm = end || 'reveal';
  const jamb = (a, ya, yb, d) => {
    if (yb - ya < 1e-3) return;
    if (vertical) {
      if (d > 0) B.quad(jm, [t0, ya, a], [t1, ya, a], [t1, yb, a], [t0, yb, a], [0, 0, 1]);
      else B.quad(jm, [t1, ya, a], [t0, ya, a], [t0, yb, a], [t1, yb, a], [0, 0, -1]);
    } else if (d > 0) B.quad(jm, [a, ya, t1], [a, ya, t0], [a, yb, t0], [a, yb, t1], [1, 0, 0]);
    else B.quad(jm, [a, ya, t0], [a, ya, t1], [a, yb, t1], [a, yb, t0], [-1, 0, 0]);
  };
  const ops = [...open].sort((p, q) => p.a - q.a);
  // one collider per solid piece, so doorways stay open for walking
  const col = (p0, p1, ya, yb) => colliders && colliders.push(vertical
    ? { x0: x[0], x1: x[1], z0: p0, z1: p1, y0: ya, y1: yb, id: 'shell' }
    : { x0: p0, x1: p1, z0: z[0], z1: z[1], y0: ya, y1: yb, id: 'shell' });
  let cur = a0;
  for (const o of ops) {
    if (o.a > cur) { box(cur, o.a, y0, y1, faces(cur === a0 ? end : null, null, end, null)); col(cur, o.a, y0, y1); }
    // (sill and lintel overlap the solid pieces slightly: no cracks at the T-junctions)
    if (o.sill > y0) { box(o.a - 0.02, o.b + 0.02, y0, o.sill, faces(null, null, end, null)); col(o.a, o.b, y0, o.sill); }
    if (o.head < y1) { box(o.a - 0.02, o.b + 0.02, o.head, y1, faces(null, null, end, 'reveal')); col(o.a, o.b, o.head, y1); }
    jamb(o.a, o.sill, o.head, 1);
    jamb(o.b, o.sill, o.head, -1);
    cur = o.b;
    // frame + glass
    const fb = (p0, p1, ya, yb, m, d = 0.2, into = B) => (vertical
      ? into.box(tc - d / 2, tc + d / 2, ya, yb, p0, p1, m)
      : into.box(p0, p1, ya, yb, tc - d / 2, tc + d / 2, m));
    const fw = 0.14;
    const fm = o.frame ?? 'frameDark';
    if (fm) {
      const rail = fm === 'doorTeak' ? teak(1, 0) : fm, post = fm === 'doorTeak' ? teak(0, 1) : fm;
      fb(o.a, o.b, o.sill, o.sill + fw, rail);
      fb(o.a, o.b, o.head - fw, o.head, rail);
      fb(o.a, o.a + fw, o.sill, o.head, post);
      fb(o.b - fw, o.b, o.sill, o.head, post);
      const w = o.b - o.a;
      const panes = w > 4.5 ? 3 : w > 2.2 ? 2 : 1;
      for (let i = 1; i < panes; i++) fb(o.a + (w * i) / panes - fw / 2, o.a + (w * i) / panes + fw / 2, o.sill, o.head, post);
    }
    if (o.glass !== false) fb(o.a + fw, o.b - fw, o.sill + fw, o.head - fw, o.glass || 'glassFacade', 0.03, GB);
    if (o.curtain) sheer(vertical, o.curtain > 0 ? t1 + 0.12 : t0 - 0.12, o.a + 0.1, o.b - 0.1, o.sill + 0.12, o.head - 0.05);
  }
  if (a1 > cur) { box(cur, a1, y0, y1, faces(cur === a0 ? end : null, end, end, null)); col(cur, a1, y0, y1); }
}

/** Softly folded sheer curtain filling an opening. */
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

/** Sheer curtain hanging between two plan points (x0, z0) → (x1, z1). */
function sheerAt(x0, z0, x1, z1, ya, yb) {
  const w = Math.hypot(x1 - x0, z1 - z0), h = yb - ya;
  const geo = new THREE.PlaneGeometry(w, h, Math.max(8, Math.round(w * 6)), 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin((p.getX(i) + w / 2) * 5.2) * 0.08);
  geo.computeVertexNormals();
  worldUV(geo);
  const m = new THREE.Mesh(geo, CTX.mats.get('curtainSheer'));
  m.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
  m.position.set((x0 + x1) / 2, (ya + yb) / 2, (z0 + z1) / 2);
  m.castShadow = false;
  m.receiveShadow = true;
  CTX.house.add(m);
}

export function buildExterior(ctx) {
  const { mats, house, site, walkables, colliders, pickables } = ctx;
  const B = new Batcher();
  GB = new Batcher();
  CTX = ctx;
  const get = (k) => mats.get(k);
  const col = (x0, x1, z0, z1, y0, y1, id = 'shell') => colliders.push({ x0, x1, z0, z1, y0, y1, id });

  // =========================================================================
  // FIRST FLOOR: the parts that are not the flat's own walls (firstfloor.js)
  // =========================================================================
  // stair tower front: tan block with the tall stair window, then sage
  wallRun(B, { x: [17.5, 25.3], z: [-T, 0], y0: FF0, y1: FF1, s0: 'pStair', s1: 'extTan', end: 'extTan',
    open: [{ a: 19.8, b: 22.8, sill: FF0 + 2.0, head: FF1 - 0.6 }] }, colliders);
  wallRun(B, { x: [25.3, PLOT.width], z: [-T, 0], y0: FF0, y1: FF1, s0: 'pStair', s1: 'ext' }, colliders);
  // glass railing on grid F, where the dining area overlooks the double-height space
  buildVoidRailing(B, col);
  // slanted rear wall. Behind the dining area and the kitchen it is a glass wall
  // (buildGlassWall); over the puja room and the old garden bay it is bedroom 3's wall.
  // endA / endB: face at the run's start / end (null where it abuts the glass wall)
  const rearRun = (xa, xb, wins, endA = 'ext', endB = 'ext') => {
    let cur = xa;
    const seg = (p, q, y0, y1, ends = 'ext') => {
      const pts = [[p, rearZ(p) + REAR_T], [q, rearZ(q) + REAR_T], [q, rearZ(q)], [p, rearZ(p)]];
      const [e0, e1] = Array.isArray(ends) ? ends : [ends, ends];
      B.prism(pts, y0, y1, { top: 'ext', bottom: 'reveal', sides: ['pFFBed3', e1, 'ext', e0] });
    };
    for (let x = xa; x < xb - 1e-3; x += 1) {
      const xe = Math.min(xb, x + 1);
      col(x, xe, rearZ(x) - 0.05, rearZ(xe) + REAR_T, FF0, FF1, 'rear');
    }
    // jamb face between sill and head (d = +1 faces +x, -1 faces -x)
    const jamb = (x, ya, yb, d) => {
      const za = rearZ(x), zb = rearZ(x) + REAR_T;
      if (d > 0) B.quad('ext', [x, ya, zb], [x, ya, za], [x, yb, za], [x, yb, zb], [1, 0, 0]);
      else B.quad('ext', [x, ya, za], [x, ya, zb], [x, yb, zb], [x, yb, za], [-1, 0, 0]);
    };
    for (const [a, b, tall] of wins) {
      const s = tall ? FF0 + 2.2 : FF0 + 3.5, h = tall ? FF0 + 8.9 : FF0 + 7.5;
      seg(cur, a, FF0, FF1, [cur === xa ? endA : null, null]);
      seg(a - 0.02, b + 0.02, FF0, s, null); // below / above the window (overlapping the solid pieces a little: no cracks)
      seg(a - 0.02, b + 0.02, h, FF1, null);
      jamb(a, s, h, 1);
      jamb(b, s, h, -1);
      const zc = (rearZ(a) + rearZ(b)) / 2 + REAR_T / 2;
      if (!tall) {
        GB.box(a + 0.12, b - 0.12, s + 0.12, h - 0.12, zc - 0.015, zc + 0.015, 'glass');
        B.box(a, b, s, s + 0.14, zc - 0.1, zc + 0.1, 'frameDark');
        B.box(a, b, h - 0.14, h, zc - 0.1, zc + 0.1, 'frameDark');
        B.box(a, a + 0.14, s + 0.14, h - 0.14, zc - 0.1, zc + 0.1, 'frameDark');
        B.box(b - 0.14, b, s + 0.14, h - 0.14, zc - 0.1, zc + 0.1, 'frameDark');
        const zi = (x, d) => rearZ(x) + REAR_T + d;
        B.prism([[a - 0.1, zi(a - 0.1, 0.18)], [b + 0.1, zi(b + 0.1, 0.18)], [b + 0.1, zi(b + 0.1, -0.05)], [a - 0.1, zi(a - 0.1, -0.05)]],
          s - 0.06, s + 0.02, { top: 'graniteBlack', bottom: 'graniteBlack', sides: ['graniteBlack', 'graniteBlack', 'graniteBlack', 'graniteBlack'] });
      } else {
        // boxes that follow the slanted wall: z centre = rearZ(x) + off
        const sl = (x0, x1, y0, y1, off, d, m, into = B) => into.prism(
          [[x0, rearZ(x0) + off + d / 2], [x1, rearZ(x1) + off + d / 2], [x1, rearZ(x1) + off - d / 2], [x0, rearZ(x0) + off - d / 2]], y0, y1,
          { top: m, bottom: m, sides: [m, m, m, m] });
        const c = REAR_T / 2, rail = teak(1, 0), post = teak(0, 1);
        sl(a, b, s, s + 0.2, c, 0.26, rail); sl(a, b, h - 0.2, h, c, 0.26, rail);
        sl(a, a + 0.2, s, h, c, 0.26, post); sl(b - 0.2, b, s, h, c, 0.26, post);
        for (let i = 1; i < 3; i++) { const x = a + ((b - a) * i) / 3; sl(x - 0.07, x + 0.07, s, h, c, 0.18, post); }
        sl(a, b, h - 1.9, h - 1.78, c, 0.18, rail); // transom
        sl(a + 0.2, b - 0.2, s + 0.2, h - 0.2, c, 0.03, 'glass', GB);
        // sheer curtains just inside, half drawn, on a brass rod
        const zi = (x) => rearZ(x) + REAR_T + 0.16;
        for (const [c0, c1] of [[a - 0.35, a + 1.3], [b - 1.3, b + 0.35]]) sheerAt(c0, zi(c0), c1, zi(c1), s + 0.05, h + 0.25);
        sl(a - 0.5, b + 0.5, h + 0.27, h + 0.33, REAR_T + 0.16, 0.06, 'brass');
      }
      cur = b;
    }
    seg(cur, xb, FF0, FF1, [cur === xa ? endA : null, endB]);
  };
  rearRun(0, REAR_COLS[0][0], [[1.3, 3.0], [8.2, 9.9]], 'ext', null);
  buildGlassWall(B);
  for (const [a, b] of REAR_COLS) col(a, b, rearZ(a) - 0.05, rearZ(b) + REAR_COL_D, FF0, FF1, 'rear');

  // ---- roof slab: a walkable terrace, open over the stair and the pipe line shaft ----
  const roofOutline = [
    [0, -18.039], [17.5, -18.039], [17.5, -T], [PLOT.width, -T], [PLOT.width, rearZ(PLOT.width)], [0, rearZ(0)],
  ];
  const vp = voidOutline();
  const inStair = (x, z) => x > STAIR.firstRiser - 0.05 && x < PLOT.width - T + 0.05 && z > STAIR.z0 - 0.05 && z < STAIR.z1 + 0.02;
  // slab edges are plastered like the pipe line shaft / the stair well they face
  const roofWell = [[STAIR.firstRiser, STAIR.z0], [PLOT.width - T, STAIR.z0], [PLOT.width - T, STAIR.z1], [STAIR.firstRiser, STAIR.z1]];
  const roofGeo = regroup(extrudeXZ(roofOutline, [vp, ductOutline(), roofWell], FF1, LV.roof),
    (gi, c) => (gi !== 2 ? gi : inDuct(c.x, c.z) ? 3 : inStair(c.x, c.z) ? 4 : 2));
  const roof = new THREE.Mesh(roofGeo, [get('terrace'), get('ceiling'), get('slabEdge'), get('pDuct'), get('pStair')]);
  roof.name = 'roof';
  roof.castShadow = roof.receiveShadow = true;
  house.add(roof);
  // solid roof over the double-height space, its soffit left as board-formed concrete
  const vroof = new THREE.Mesh(extrudeXZ(vp, [], FF1, LV.roof), [get('terrace'), get('concreteCeil'), get('slabEdge')]);
  vroof.name = 'void-roof';
  vroof.castShadow = vroof.receiveShadow = true;
  house.add(vroof);
  for (const m of [roof, vroof]) { m.userData.room = 'roof'; walkables.push(m); pickables.push(m); }
  // keep the tower facade continuous across the roof-slab edge
  B.box(17.5, 25.3, FF1, LV.roof, -T, 0, { all: 'extTan', ny: null, py: null });
  B.box(25.3, PLOT.width, FF1, LV.roof, -T, 0, { all: 'ext', ny: null, py: null });
  const P0 = LV.roof, P1 = LV.parapet, pt = 0.45;
  const parapet = (x0, x1, z0, z1) => {
    B.box(x0, x1, P0, P1 - 0.25, z0, z1, 'ext');
    B.box(x0 - 0.05, x1 + 0.05, P1 - 0.25, P1, z0 - 0.05, z1 + 0.05, 'white');
    col(x0, x1, z0, z1, P0, P1, 'parapet');
  };
  parapet(0, pt, rearZ(0), -18.039);
  parapet(0, 17.5, -18.039 - pt, -18.039);
  parapet(17.5, 17.5 + pt, -18.039, -9.635);
  parapet(PLOT.width - pt, PLOT.width, rearZ(PLOT.width), DUCT.z0 - pt); // then round the pipe line shaft (buildDuctShaft)
  const rearPar = (xa, xb) => {
    B.prism([[xa, rearZ(xa) + pt], [xb, rearZ(xb) + pt], [xb, rearZ(xb)], [xa, rearZ(xa)]], P0, P1, { top: 'white', bottom: null, sides: ['ext', 'ext', 'ext', 'ext'] });
    for (let x = xa; x < xb - 1e-3; x += 1) {
      const xe = Math.min(xb, x + 1);
      col(x, xe, rearZ(x) - 0.05, rearZ(xe) + pt, P0, P1, 'parapet');
    }
  };
  rearPar(0, PLOT.width);
  buildDuctShaft(B, pt, col);

  // ---- mumty (stair head room), with a door out onto the roof terrace ------------
  const M0 = LV.roof, M1 = LV.mumtyCeil, md = [19.2, 22.2];
  // (its walls stand flush with the stair-tower walls below, so the stair well runs straight up)
  const mf = -0.792, mr = -8.843;
  wallRun(B, { x: [17.5, 25.3], z: [mf, 0], y0: M0, y1: M1, s0: 'pStair', s1: 'extTan', end: 'extTan',
    open: [{ a: 19.6, b: 23.6, sill: M1 - 3.2, head: M1 - 2.2 }] }, colliders);
  wallRun(B, { x: [25.3, PLOT.width], z: [mf, 0], y0: M0, y1: M1, s0: 'pStair', s1: 'ext' }, colliders);
  wallRun(B, { x: [17.5, PLOT.width], z: [-9.635, mr], y0: M0, y1: M1, s0: 'extTan', s1: 'pStair',
    open: [{ a: md[0], b: md[1], sill: M0, head: M0 + 7.0, glass: false, frame: false }] }, colliders);
  wallRun(B, { x: [17.5, 18.25], z: [mr, mf], y0: M0, y1: M1, s0: 'extTan', s1: 'pStair' }, colliders);
  wallRun(B, { x: [PLOT.width - T, PLOT.width], z: [mr, mf], y0: M0, y1: M1, s0: 'pStair', s1: 'ext' }, colliders);
  B.box(17.3, PLOT.width, M1, LV.mumtyTop, -9.9, 0.2, { py: 'white', ny: 'ceiling', all: 'white' });
  mumtyDoor(B, md, M0, -9.635, mr);

  // sage water-tank enclosure beside the mumty (small block seen in the elevation)
  B.box(14.3, 17.5, LV.roof, LV.roof + 4.6, -22.6, -18.6, { all: 'ext', py: 'white', ny: null });
  B.box(14.2, 17.6, LV.roof + 4.6, LV.roof + 4.85, -22.7, -18.5, 'white');
  col(14.2, 17.6, -22.7, -18.5, LV.roof, LV.roof + 4.85, 'tank');

  // =========================================================================
  // FRONT ELEVATION FEATURES
  // =========================================================================
  // White "C" frame around the first-floor terrace + tan tower
  {
    const shape = new THREE.Shape();
    roundedRect(shape, 0, 13.0, 25.3, LV.parapet, [0, 1.4, 1.4, 1.4]);
    const hole = new THREE.Path();
    roundedRect(hole, 0.9, 14.2, 24.3, LV.parapet - 1.0, [0.45, 0.45, 0.45, 0.45]);
    // Path must be clockwise relative to shape → reverse via getPoints
    const hp = new THREE.Path(hole.getPoints(8).reverse());
    shape.holes.push(hp);
    let geo = new THREE.ExtrudeGeometry(shape, { depth: 2.2, bevelEnabled: false, curveSegments: 10 });
    geo.translate(0, 0, -1.2);
    geo = regroup(geo, (gi, c) => {
      if (gi === 0) return 0;
      const inner = c.x > 0.85 && c.x < 24.35 && c.y > 14.15 && c.y < LV.parapet - 0.95;
      return inner ? 2 : 1;
    });
    worldUV(geo);
    const frame = new THREE.Mesh(geo, [get('white'), get('white'), get('soffit')]);
    frame.castShadow = frame.receiveShadow = true;
    frame.name = 'c-frame';
    house.add(frame);
    // vertical fins inside the left leg (as in the render)
    for (let i = 0; i < 3; i++) B.box(0.9, 1.05 + i * 0.14, 17.4, LV.parapet - 1.2, -0.9 + i * 0.35, -0.75 + i * 0.35, 'soffit');
  }
  // Terrace parapet (sage, white cap) on the left, white railing on the right
  B.box(-0.02, 8.4, 14.2, 16.8, 0.3, 1.1, 'ext');
  B.box(-0.06, 8.46, 16.8, 17.25, 0.25, 1.15, 'white');
  B.box(1.5, 2.1, 15.2, 15.8, 1.08, 1.12, 'soffit');
  B.box(2.6, 3.2, 15.2, 15.8, 1.08, 1.12, 'soffit');
  {
    const x0 = 8.4, x1 = 17.5, zc = 0.7;
    B.box(x0, x0 + 0.3, 14.2, 18.0, zc - 0.15, zc + 0.15, 'railWhite');
    for (let x = x0 + 1.8; x < x1 - 0.2; x += 1.8) B.box(x - 0.08, x + 0.08, 14.2, 17.9, zc - 0.08, zc + 0.08, 'railWhite');
    for (const y of [14.9, 15.8, 16.8, 17.8]) B.box(x0, x1, y - 0.12, y + 0.12, zc - 0.12, zc + 0.12, 'railWhite');
  }
  // side parapet of the terrace (left edge)
  B.box(0, T, FF0, FF0 + 3.3, -18.039, -1.2, 'ext');
  B.box(-0.04, T + 0.04, FF0 + 3.3, FF0 + 3.55, -18.1, -1.2, 'white');
  // the terrace edge for walking: the frame's bottom band, the parapet and railing in front, the side parapet
  col(0, 17.5, -1.2, 1.15, LV.gfCeil, FF0 + 4.5, 'terrace-edge');
  col(0, T, -18.039, -1.2, FF0, FF0 + 3.55, 'terrace-edge');

  // Tall wood cladding panel with white frame (right side)
  {
    const r = 1.4, ri = 0.5;
    const s = new THREE.Shape();
    s.moveTo(17.2, LV.mumtyTop);
    s.lineTo(17.2, LV.mumtyTop + 0.8);
    s.lineTo(PLOT.width - r, LV.mumtyTop + 0.8);
    s.quadraticCurveTo(PLOT.width, LV.mumtyTop + 0.8, PLOT.width, LV.mumtyTop + 0.8 - r);
    s.lineTo(PLOT.width, 8.5 + r);
    s.quadraticCurveTo(PLOT.width, 8.5, PLOT.width - r, 8.5);
    s.lineTo(27.3, 8.5);
    s.lineTo(27.3, 9.5);
    s.lineTo(34.4 - ri, 9.5);
    s.quadraticCurveTo(34.4, 9.5, 34.4, 9.5 + ri);
    s.lineTo(34.4, LV.mumtyTop - ri);
    s.quadraticCurveTo(34.4, LV.mumtyTop, 34.4 - ri, LV.mumtyTop);
    s.lineTo(17.2, LV.mumtyTop);
    let geo = new THREE.ExtrudeGeometry(s, { depth: 1.5, bevelEnabled: false, curveSegments: 10 });
    geo.translate(0, 0, -0.4);
    worldUV(geo);
    const m = new THREE.Mesh(geo, get('white'));
    m.castShadow = m.receiveShadow = true;
    house.add(m);
    B.box(27.6, 34.4, 9.5, LV.mumtyTop, 0, 0.35, { pz: 'woodClad', all: 'woodClad' });
  }

  // Ground-level feature boxes in front of the stair room
  B.box(15.62, 23.0, 0, 6.3, 0, 0.6, { all: 'ext', py: 'white' });
  B.box(16.9, 17.2, 2.2, 5.4, 0.6, 0.65, 'lightPanel'); // vertical light slit
  // House name plate beside the light slit (its text is set in materials.js): black
  // granite, brass letters, standing off the wall on hidden spacers
  {
    const x0 = 17.75, x1 = 22.55, y0 = 2.85, y1 = 4.85, zf = 0.6; // 4′-10″ × 2′-0″
    B.box(x0 + 0.5, x1 - 0.5, y0 + 0.5, y1 - 0.5, zf, zf + 0.08, 'steel');
    B.box(x0, x1, y0, y1, zf + 0.08, zf + 0.2, { all: 'graniteBlack', pz: null });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), get('namePlate'));
    face.position.set((x0 + x1) / 2, (y0 + y1) / 2, zf + 0.2);
    face.receiveShadow = true;
    house.add(face);
  }
  {
    const s = new THREE.Shape();
    const r = 0.9;
    s.moveTo(23.0, 0); s.lineTo(23.45, 0); s.lineTo(23.45, 5.85 - 0.4);
    s.quadraticCurveTo(23.45, 5.85, 23.85, 5.85);
    s.lineTo(33.55, 5.85); s.lineTo(33.55, 0); s.lineTo(34.0, 0); s.lineTo(34.0, 6.3);
    s.lineTo(23.0 + r, 6.3); s.quadraticCurveTo(23.0, 6.3, 23.0, 6.3 - r); s.lineTo(23.0, 0);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 1.0, bevelEnabled: false, curveSegments: 8 });
    worldUV(geo);
    const m = new THREE.Mesh(geo, get('white'));
    m.castShadow = m.receiveShadow = true;
    house.add(m);
    B.box(23.45, 33.55, 0, 5.85, 0, 0.7, { pz: 'woodCladDark', all: 'woodCladDark' });
  }

  // Portico: tan front-left column (as in the elevation)
  B.box(-0.03, 0.82, 0.3, LV.gfCeil, -0.9, 0.03, { all: 'extTanDark', py: null, ny: null });
  // Portico: front beam under the slab, canopy over the gate, pillar, lights
  B.box(0.792, 14.827, 11.9, LV.gfCeil, -0.792, 0, 'white');
  B.box(-0.1, 11.1, 9.0, 9.35, -0.6, 1.5, 'white');
  B.box(9.8, 10.6, 0.3, 6.0, 0.0, 0.8, { all: 'extTanDark', py: 'white' });
  {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.0, 8), get('steel'));
    pole.position.set(10.2, 7.5, 0.4);
    house.add(pole);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.5), get('lampShade'));
    lamp.position.set(10.2, 6.4, 0.4);
    house.add(lamp);
  }
  for (const [x, z] of [[4, -4], [10.5, -4], [4, -13], [10.5, -13]]) {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.05, 20), get('lightPanel'));
    d.position.set(x, LV.gfCeil - 0.03, z);
    house.add(d);
  }

  // Gates
  const gate1 = makeGate(mats, 9.0, 4.6);
  gate1.position.set(0.8, 0.3, 0.45);
  house.add(gate1);
  const gate2 = makeGate(mats, 4.2, 4.6);
  gate2.position.set(14.75, 0.3, 0.45);
  gate2.rotation.y = Math.PI / 2 + 0.35; // pedestrian gate left open, swung into the portico
  house.add(gate2);
  colliders.push({ x0: 0.8, x1: 9.8, z0: 0.3, z1: 0.6, y0: 0, y1: 6, id: 'gate1' });
  colliders.push({ x0: 9.8, x1: 10.6, z0: 0.0, z1: 0.8, y0: 0, y1: 6, id: 'pillar' });

  // Plot strip in front of the building line
  B.box(0, PLOT.width, 0, 0.3, 0, PLOT.plotFront, { py: 'pavers', all: 'concrete', ny: null });

  house.add(B.build(get, { name: 'exterior' }));
  house.add(GB.build(get, { name: 'exterior-glass', castShadow: false }));

  // walkable: plot strip is part of the batch; add a simple plane for raycasts
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(PLOT.width, PLOT.plotFront), get('pavers'));
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(PLOT.width / 2, 0.3, PLOT.plotFront / 2);
  strip.visible = false;
  house.add(strip);
  walkables.push(strip);

  buildGarden(ctx);
  buildSite(ctx);
}

// ---------------------------------------------------------------------------
// Side garden on the strip of land beside the house on the north side (GARDEN in
// config.js: 1 decimal, 49'-9" × 8'-9.1"). Compound walls round it, with its own
// gate on the street; the lawn is the garden's room floor (structure.js). Stepping
// stones run from the gate to a tulsi chaura by the puja room, between a flower bed
// along the boundary wall (two small trees and a bench in it) and a narrow bed along
// the house, with low garden lights beside the path.
// ---------------------------------------------------------------------------
function buildGarden(ctx) {
  const { mats, house, colliders } = ctx;
  const get = (k) => mats.get(k);
  const B = new Batcher();
  const G = GARDEN, T = G.wall, Y = LV.garden;
  const [f0, f1] = G.front, [g0, g1] = G.gate;
  const xIn = G.x0 + T, zBack = G.z0 + T;  // inside faces of the boundary wall and the back wall
  const col = (x0, x1, z0, z1, y1, id = 'garden') => colliders.push({ x0, x1, z0, z1, y0: 0, y1, id });
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const blob = (r, key, x, y, z, sy = 0.85, detail = 1) => {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, detail), get(key));
    m.position.set(x, y, z);
    m.scale.y = sy;
    m.castShadow = true;
    m.receiveShadow = true;
    house.add(m);
    return m;
  };

  // ---- compound walls: sage with a white coping, like the house; taller pillars at the gate ----
  const H = 5.2, CAP = 0.3, PH = 5.9;
  const [wN, wBack, wA, wB] = gardenWalls();
  const pillars = [[g0 - 0.6, g0], [g1, g1 + 0.6]];
  // [footprint, coping overhang at the -x end, at the +x end]: no overhang on the neighbour's
  // side or where a wall runs into a gate pillar
  const bodies = [[wN, 0, 0.05], [wBack, 0.05, 0.05], [[wA[0], g0 - 0.6, f0, f1], 0.05, 0], [[g1 + 0.6, wB[1], f0, f1], 0, 0.05]];
  bodies.forEach(([[x0, x1, z0, z1], oa, ob], i) => {
    B.box(x0, x1, 0, H, z0, z1, { all: 'ext', ny: null });
    // copings overlap at the corners: each sits a hair lower than the one before, so no two tops share a plane
    B.box(x0 - oa, x1 + ob, H, H + CAP - i * 0.01, z0 - 0.05, z1 + 0.05, 'white');
  });
  for (const [x0, x1] of pillars) {
    B.box(x0, x1, 0, PH, f0 - 0.03, f1 + 0.03, { all: 'ext', ny: null });
    B.box(x0 - 0.06, x1 + 0.06, PH, PH + 0.25, f0 - 0.09, f1 + 0.09, 'white');
  }
  for (const [x0, x1, z0, z1] of [wN, wBack, wA, wB]) col(x0, x1, z0, z1, PH + 0.25, 'garden-wall');

  // ---- gate: same style as the house gates, standing open into the garden ----
  const gate = makeGate(mats, g1 - g0, 4.6);
  gate.position.set(g1 - 0.1, Y, f0);
  gate.rotation.y = Math.PI / 2;
  house.add(gate);
  col(g1 - 0.2, g1, f0 - 3.05, f0, 5, 'gate-garden');
  // paving under the gate and a landing inside it; a paved strip in front of the wall, like the house's
  B.box(g0, g1, Y, Y + 0.03, f0, f1, 'pavers');
  B.box(G.x0, G.x1, Y, Y + 0.03, f1, G.z1, 'pavers');
  B.box(g0, g1, Y, Y + 0.03, -1.6, f0, 'pavers');

  // ---- beds: soil behind a whitewashed kerb ----
  const bed = (x0, x1, z0, z1, kerbAt) => {
    const kx0 = kerbAt === 'px' ? x1 - 0.25 : x0, kx1 = kerbAt === 'px' ? x1 : x0 + 0.25;
    B.box(kx0, kx1, 0, Y + 0.32, z0, z1, { all: 'white', ny: null });
    const sx0 = kerbAt === 'px' ? x0 : kx1, sx1 = kerbAt === 'px' ? kx0 : x1;
    B.box(sx0, sx1, 0, Y + 0.27, z0, z1, { py: 'soil', all: 'white', ny: null });
    col(x0, x1, z0, z1, 3, 'garden-bed');
  };
  const bedX1 = xIn + G.bed;         // the bed along the boundary wall, kerb on the lawn side
  const bench = [-25.7, -20.9];      // gap in that bed for the bench
  bed(xIn, bedX1, zBack, bench[0], 'px');
  bed(xIn, bedX1, bench[1], f0, 'px');
  for (const z of bench) B.box(xIn, bedX1, 0, Y + 0.32, z - (z === bench[0] ? 0.25 : 0), z + (z === bench[0] ? 0 : 0.25), { all: 'white', ny: null });
  bed(G.x1 - G.houseBed, G.x1, zBack, f0, 'nx');  // the bed along the house, kerb on the lawn side

  // ---- stepping stones from the gate to the tulsi chaura ----
  const PX = G.path;                 // the path's centre line, through the gate
  const CZ = zBack + 2.65;            // the tulsi chaura, at the far end beside the puja room
  for (let z = -2.3; z > CZ + 1.85; z -= 1.95) {
    const dx = (rnd() - 0.5) * 0.3, w = 1.45 + rnd() * 0.15, d = 1.15 + rnd() * 0.15;
    B.box(PX + dx - w / 2, PX + dx + w / 2, Y, Y + 0.05, z - d / 2, z + d / 2, 'stoneStep');
  }

  // ---- bench against the boundary wall, facing the house, on a paved pad ----
  B.box(xIn, bedX1 + 0.3, Y, Y + 0.03, bench[0], bench[1], 'pavers');
  for (const z of [bench[0] + 0.7, bench[1] - 0.7]) B.box(xIn + 0.15, xIn + 1.35, Y, Y + 1.42, z - 0.15, z + 0.15, 'stoneStep');
  B.box(xIn + 0.05, xIn + 1.45, Y + 1.42, Y + 1.6, bench[0] + 0.3, bench[1] - 0.3, 'furnWood');
  for (const y of [Y + 2.05, Y + 2.6]) B.box(xIn, xIn + 0.12, y, y + 0.36, bench[0] + 0.3, bench[1] - 0.3, 'furnWood');
  col(xIn, xIn + 1.5, bench[0] + 0.2, bench[1] - 0.2, 3, 'garden-bench');

  // ---- tulsi chaura by the puja room: whitewashed, with terracotta bands and a lamp niche ----
  {
    const cx = PX, cz = CZ;
    B.box(cx - 1.1, cx + 1.1, Y, Y + 0.35, cz - 1.1, cz + 1.1, 'white');
    B.box(cx - 0.8, cx + 0.8, Y + 0.35, Y + 2.2, cz - 0.8, cz + 0.8, 'white');
    B.box(cx - 0.84, cx + 0.84, Y + 0.35, Y + 0.5, cz - 0.84, cz + 0.84, 'pot');
    B.box(cx - 0.95, cx + 0.95, Y + 2.2, Y + 2.5, cz - 0.95, cz + 0.95, 'pot');
    B.box(cx - 0.8, cx + 0.8, Y + 2.5, Y + 2.52, cz - 0.8, cz + 0.8, 'soil');
    B.box(cx - 0.28, cx + 0.28, Y + 0.85, Y + 1.55, cz + 0.8, cz + 0.82, 'blackMatte');  // lamp niche
    B.box(cx - 0.3, cx + 0.3, Y + 0.8, Y + 0.85, cz + 0.8, cz + 1.0, 'white');            // its ledge
    const diya = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.06, 0.06, 12), get('brass'));
    diya.position.set(cx, Y + 0.88, cz + 0.9);
    house.add(diya);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 8), get('lampShade'));
    flame.position.set(cx, Y + 0.96, cz + 0.9);
    house.add(flame);
    // the tulsi plant: a small bushy dome on a woody stem
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.45, 6), get('treeBark'));
    stem.position.set(cx, Y + 2.72, cz);
    house.add(stem);
    for (let i = 0; i < 11; i++) {
      const a = i * 2.4 + rnd() * 0.5, r = i === 0 ? 0 : 0.18 + rnd() * 0.3;
      blob(0.2 + rnd() * 0.08, 'tulsi', cx + Math.cos(a) * r, Y + 2.78 + (i === 0 ? 0.42 : rnd() * 0.45), cz + Math.sin(a) * r, 1.1, 0);
    }
    col(cx - 1.1, cx + 1.1, cz - 1.1, cz + 1.1, 3.5, 'tulsi');
  }

  // ---- plants: leafy mounds dotted with flowers, squeezed to the width of their bed (wx = half width) ----
  const bush = (x, z, h, wx, leafKey, flowerKey, nFlowers) => {
    const soil = Y + 0.27;
    for (const [dz, yy, rr] of [[0, 0.62, 0.36], [-0.27, 0.32, 0.32], [0.27, 0.32, 0.32], [0, 0.3, 0.3]]) {
      const r = rr * h * (0.9 + rnd() * 0.2);
      const m = blob(r, leafKey, x + (rnd() - 0.5) * 0.08 * h, soil + yy * h, z + (dz + (rnd() - 0.5) * 0.08) * h);
      m.scale.x = Math.min(1, wx / r);
    }
    for (let i = 0; i < nFlowers; i++) {
      const a = rnd() * Math.PI * 2, p = 0.2 + rnd() * 1.05;
      blob(0.075 + rnd() * 0.05, flowerKey, x + Math.cos(a) * Math.sin(p) * wx * 0.92,
        soil + h * (0.45 + Math.cos(p) * 0.45), z + Math.sin(a) * Math.sin(p) * h * 0.52, 1, 0);
    }
  };
  const KINDS = [
    ['leafDark', 'flowerRed', 2.6, 10],    // hibiscus
    ['leaf', 'flowerOrange', 1.25, 14],    // marigold
    ['leaf', 'flowerPink', 1.8, 8],        // rose
    ['leafDark', 'flowerWhite', 2.1, 12],  // jasmine
    ['leaf', 'flowerYellow', 1.25, 14],    // marigold
  ];
  const trees = [-8.0, -38.5];
  let k = 0;
  for (let z = f0 - 1.8; z > zBack + 0.8; z -= 2.3) {
    if (z < bench[1] + 0.5 && z > bench[0] - 0.5) continue;
    if (trees.some((t) => Math.abs(z - t) < 1.1)) continue;
    const [lf, fl, h, n] = KINDS[k++ % KINDS.length];
    bush(xIn + 0.66 + (rnd() - 0.5) * 0.1, z + (rnd() - 0.5) * 0.4, h * (0.9 + rnd() * 0.2), 0.72, lf, fl, n);
  }
  k = 1;
  for (let z = f0 - 1.0; z > zBack + 0.7; z -= 2.2) {
    const [lf, fl, , n] = KINDS[[1, 4, 2][k++ % 3]];
    bush(-0.53 + (rnd() - 0.5) * 0.06, z + (rnd() - 0.5) * 0.3, 1.2 + rnd() * 0.35, 0.56, lf, fl, n);
  }

  // ---- two small trees in the boundary bed: a frangipani near the gate, a guava at the back ----
  // (the canopy is kept above head height and narrower across the garden than along it)
  const smallTree = (x, z, h, spread, flowers) => {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.22, h * 0.7, 8), get('treeBark'));
    trunk.position.set(x, Y + h * 0.35, z);
    trunk.castShadow = true;
    house.add(trunk);
    const top = Y + h * 0.76;
    for (let i = 0; i < 6; i++) {
      const a = i * 1.15 + rnd(), r = i === 0 ? 0 : spread * (0.4 + rnd() * 0.25);
      const m = blob(spread * (0.46 + rnd() * 0.14), i % 2 ? 'treeLeaf2' : 'treeLeaf', x + Math.cos(a) * r * 0.7, top + (i === 0 ? h * 0.08 : rnd() * h * 0.1), z + Math.sin(a) * r);
      m.scale.x = 0.8;
    }
    for (let i = 0; i < flowers; i++) {
      const a = rnd() * Math.PI * 2, p = 0.3 + rnd() * 0.85, R = spread * 1.0;
      blob(0.12 + rnd() * 0.05, 'blossom', x + Math.cos(a) * Math.sin(p) * R * 0.75, top + h * 0.05 + Math.cos(p) * R * 0.8, z + Math.sin(a) * Math.sin(p) * R, 1, 0);
    }
  };
  smallTree(xIn + 0.75, trees[0], 10.5, 2.3, 24);
  smallTree(xIn + 0.75, trees[1], 11.5, 2.6, 0);

  // ---- low garden lights beside the path ----
  for (const [x, z] of [[PX - 1.55, -9.0], [PX + 1.55, -17.5], [PX - 1.55, -29.0], [PX + 1.55, -37.0]]) {
    B.box(x - 0.13, x + 0.13, Y, Y + 1.7, z - 0.13, z + 0.13, 'blackMatte');
    B.box(x - 0.1, x + 0.1, Y + 1.7, Y + 1.95, z - 0.1, z + 0.1, 'lampShade');
    B.box(x - 0.17, x + 0.17, Y + 1.95, Y + 2.05, z - 0.17, z + 0.17, 'blackMatte');
    col(x - 0.2, x + 0.2, z - 0.2, z + 0.2, 2.4, 'garden-light');
  }

  house.add(B.build(get, { name: 'garden' }));
}

// ---------------------------------------------------------------------------
// Double-height space: the glass railing along the first-floor edge on grid F, where
// the dining area looks down into it. (The walls round it are in plan-ff.js.)
// ---------------------------------------------------------------------------
function buildVoidRailing(B, col) {
  // teak members: joint-free grain that runs along each member
  const tb = (x0, x1, y0, y1, z0, z1) => B.box(x0, x1, y0, y1, z0, z1, teak(Math.max(x1 - x0, z1 - z0), y1 - y0));
  const zE = VOID.hallFront, hx = VOID.hallX1;
  const zr = zE + 0.12;
  tb(VOID.x0, hx, FF0 + 3.35, FF0 + 3.55, zE - 0.02, zr + 0.13);   // handrail
  tb(VOID.x0, hx, FF0, FF0 + 0.18, zE, zr + 0.08);                  // shoe rail
  const step = (hx - VOID.x0 - 0.2) / 4;
  for (let i = 0; i <= 4; i++) {
    const x = VOID.x0 + 0.1 + i * step;
    B.box(x - 0.05, x + 0.05, FF0, FF0 + 3.35, zr - 0.05, zr + 0.05, 'steel');
  }
  GB.box(VOID.x0 + 0.05, hx - 0.05, FF0 + 0.2, FF0 + 3.33, zr - 0.012, zr + 0.012, 'glass');
  col(VOID.x0, hx, zE - 0.02, zr + 0.13, FF0, FF0 + 3.55, 'void-rail');
}

// ---------------------------------------------------------------------------
// Pipe line area: the plumbing shaft beside the guest room is open to the sky, as in
// the original drawing. The slabs are cut round it (structure.js and the roof above);
// its first-floor walls are in plan-ff.js, and here is the parapet round the opening on the roof.
// ---------------------------------------------------------------------------
function buildDuctShaft(B, pt, col) {
  const { x0, x1, z0, z1 } = DUCT;
  const D = 'pDuct', W = PLOT.width;
  // parapet on three sides (the mumty wall closes the front), sage outside,
  // plastered inside like the shaft, with a white coping
  const P0 = LV.roof, P1 = LV.parapet - 0.25;
  const cap = (xa, xb, za, zb) => B.box(xa - 0.05, xb + 0.05, P1, LV.parapet, za - 0.05, zb + 0.05, 'white');
  B.box(x0 - pt, x0, P0, P1, z0 - pt, z1, { all: 'ext', px: D, pz: null, py: null, ny: null });
  B.box(x0, x1, P0, P1, z0 - pt, z0, { all: 'ext', pz: D, nx: null, px: null, py: null, ny: null });
  B.box(x1, W, P0, P1, z0 - pt, z1, { all: 'ext', nx: D, nz: null, pz: null, py: null, ny: null });
  cap(x0 - pt, x0, z0 - pt, z1);
  cap(x0, x1, z0 - pt, z0);
  cap(x1, W, z0 - pt, z1);
  col(x0 - pt, x0, z0 - pt, z1, P0, LV.parapet, 'parapet');
  col(x0, x1, z0 - pt, z0, P0, LV.parapet, 'parapet');
  col(x1, W, z0 - pt, z1, P0, LV.parapet, 'parapet');
}

/** The mumty's door out onto the roof: teak-look frame, threshold and a leaf swung open outwards. */
function mumtyDoor(B, [a, b], y0, z0, z1) {
  const { mats, house, colliders, walkables } = CTX;
  const fw = 0.25, head = y0 + 7.0;
  B.box(a, a + fw, y0, head, z0 - 0.05, z1 + 0.05, 'doorWood');
  B.box(b - fw, b, y0, head, z0 - 0.05, z1 + 0.05, 'doorWood');
  B.box(a, b, head - fw, head, z0 - 0.05, z1 + 0.05, 'doorWood');
  const TB = new Batcher();
  TB.box(a + fw, b - fw, y0 - 0.02, y0 + 0.04, z0, z1, 'marble');
  const th = TB.build((k) => mats.get(k), { name: 'mumty-threshold', castShadow: false });
  th.traverse((o) => o.isMesh && walkables.push(o));
  house.add(th);
  const clear = b - a - 2 * fw, leafT = 0.13;
  const leaf = makeLeaf(mats, 'wood', clear, head - fw - y0 - 0.04, leafT, 1);
  const along = a + fw + leafT / 2;
  leaf.rotation.y = Math.PI / 2;
  leaf.position.set(along, y0 + 0.02, z0 - (clear / 2 + 0.02));
  house.add(leaf);
  colliders.push({ x0: along - leafT, x1: along + leafT, z0: z0 - clear, z1: z0, y0, y1: head, id: 'leaf' });
}

// ---------------------------------------------------------------------------
// Glass wall in the rear (east) wall behind the dining area and the kitchen. Below
// door height the wall is solid (structure.js); from there the glass rises to the
// roof, crossed by the first-floor slab edge, so the morning sun comes into the
// double-height space. Two full-height columns stand in it (grid 2 at its left end and
// B5 on grid 5, between the dining and kitchen bays). The old garden bay, under the
// first-floor slab, has its own lower window from door height to the ceiling. Teak frames.
// ---------------------------------------------------------------------------
function buildGlassWall(B) {
  const x1 = PLOT.width;
  const g1 = VOID.x1 - 0.5;                       // right-hand end of the glazing (corner pier beyond)
  const sill = VOID.glassSill, head = FF1 - 0.7; // bottom / top of the glazing
  const band0 = LV.gfCeil, band1 = FF0;         // first-floor slab edge crossing the glass
  const rail = teak(1, 0), post = teak(0, 1);
  // prism that follows the slanted wall: z = rearZ(x) + off ± d/2
  const sl = (xa, xb, y0, y1, off, d, m, into = B) => into.prism(
    [[xa, rearZ(xa) + off + d / 2], [xb, rearZ(xb) + off + d / 2], [xb, rearZ(xb) + off - d / 2], [xa, rearZ(xa) + off - d / 2]], y0, y1,
    { top: m, bottom: m, sides: [m, m, m, m] });
  const full = (xa, xb, t = REAR_T) => [[xa, rearZ(xa) + t], [xb, rearZ(xb) + t], [xb, rearZ(xb)], [xa, rearZ(xa)]];
  const c = REAR_T / 2;

  // columns in the rear wall, from the plinth to the roof slab (the stone plinth runs past them)
  for (const [a, b] of REAR_COLS) B.prism(full(a, b, REAR_COL_D), LV.gf, FF1, { top: null, bottom: null, sides: ['pHall', 'ext', 'ext', 'ext'] });
  // pier at the right-hand corner, below and above the slab edge
  B.prism(full(g1, x1), sill, band0, { top: null, bottom: null, sides: ['pHall', 'ext', 'ext', 'ext'] });
  B.prism(full(g1, x1), band1, FF1, { top: null, bottom: null, sides: ['ffInterior', 'ext', 'ext', 'ext'] });

  // two double-height glazed bays: dining (between the columns on grids 2 and 5) and kitchen
  for (const [g0, ge] of [[REAR_COLS[0][1], REAR_COLS[1][0]], [REAR_COLS[1][1], g1]]) {
    B.prism(full(g0, ge), head, FF1, { top: null, bottom: 'reveal', sides: ['ffInterior', null, 'ext', null] }); // lintel
    sl(g0, g0 + 0.22, sill, head, c, 0.3, post);
    sl(ge - 0.22, ge, sill, head, c, 0.3, post);
    for (const [y0, y1] of [[sill, sill + 0.22], [band0 - 0.2, band0], [band1, band1 + 0.2], [head - 0.2, head]]) sl(g0, ge, y0, y1, c, 0.3, rail);
    sl(g0, ge, FF0 + 5.0, FF0 + 5.14, c, 0.22, rail);
    const bays = Math.max(2, Math.round((ge - g0) / 2.45));
    for (let i = 1; i < bays; i++) {
      const x = g0 + ((ge - g0) * i) / bays;
      sl(x - 0.08, x + 0.08, sill, band0, c, 0.22, post);
      sl(x - 0.08, x + 0.08, band1, head, c, 0.22, post);
    }
    sl(g0 + 0.2, ge - 0.2, sill + 0.22, band0 - 0.2, c, 0.03, 'glass', GB);
    sl(g0 + 0.2, ge - 0.2, band1 + 0.2, head - 0.2, c, 0.03, 'glass', GB);
  }

  // old garden bay: window from door height up to the ceiling, between the puja-room
  // wall and the column on grid 2
  {
    const a = BAY.x0, b = REAR_COLS[0][0], top = band0;
    sl(a, a + 0.22, sill, top, c, 0.3, post);
    sl(b - 0.22, b, sill, top, c, 0.3, post);
    for (const [y0, y1] of [[sill, sill + 0.22], [top - 0.22, top]]) sl(a, b, y0, y1, c, 0.3, rail);
    const m = (a + b) / 2;
    sl(m - 0.08, m + 0.08, sill, top, c, 0.22, post);
    sl(a + 0.2, b - 0.2, sill + 0.22, top - 0.22, c, 0.03, 'glass', GB);
  }
}

// ---------------------------------------------------------------------------
function makeGate(mats, w, h) {
  const B = new Batcher();
  const t = 0.12;
  B.box(0, w, 0, t, -t / 2, t / 2, 'gateMetal');
  B.box(0, w, h - t, h, -t / 2, t / 2, 'gateMetal');
  B.box(0, t, 0, h, -t / 2, t / 2, 'gateMetal');
  B.box(w - t, w, 0, h, -t / 2, t / 2, 'gateMetal');
  B.box(0, w, 1.35, 1.35 + t, -t / 2, t / 2, 'gateMetal');
  B.box(t, w - t, t, 1.35, -0.02, 0.02, 'gatePanel');
  const n = Math.round(w / 0.36);
  for (let i = 1; i < n; i++) {
    const x = (w * i) / n;
    B.box(x - 0.035, x + 0.035, 1.35, h - t, -0.035, 0.035, 'gateMetal');
  }
  const g = B.build((k) => mats.get(k), { name: 'gate' });
  // V motif on the lower panel
  const panels = Math.max(1, Math.round(w / 2.2));
  for (let p = 0; p < panels; p++) {
    const cx = (w * (p + 0.5)) / panels;
    for (const s of [-1, 1]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.25, 0.07), mats.get('gateMetal'));
      bar.position.set(cx + s * 0.4, 0.72, 0.03);
      bar.rotation.z = s * 0.62;
      g.add(bar);
    }
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ---------------------------------------------------------------------------
function makeTree(mats, h = 18, spread = 7, seed = 1, leafKey = 'treeLeaf') {
  const g = new THREE.Group();
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, h * 0.55, 8), mats.get('treeBark'));
  trunk.position.y = h * 0.275;
  trunk.castShadow = true;
  g.add(trunk);
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd();
    const r = i === 0 ? 0 : spread * (0.35 + rnd() * 0.3);
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(spread * (0.45 + rnd() * 0.2), 1), mats.get(i % 2 ? 'treeLeaf2' : leafKey));
    blob.position.set(Math.cos(a) * r, h * (0.62 + rnd() * 0.22) + (i === 0 ? h * 0.12 : 0), Math.sin(a) * r);
    blob.scale.y = 0.8;
    blob.castShadow = true;
    blob.receiveShadow = true;
    g.add(blob);
  }
  return g;
}

function buildSite(ctx) {
  const { mats, site, walkables } = ctx;
  const get = (k) => mats.get(k);
  const B = new Batcher();
  const X0 = -90, X1 = 125;
  // ground
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), get('grassSite'));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(17.7, LV.ground, -30);
  ground.receiveShadow = true;
  worldUV(ground.geometry);
  site.add(ground);
  walkables.push(ground);
  // footpath (our side), road, far footpath
  B.box(X0, X1, 0, LV.footpath, PLOT.plotFront, 6.0, { py: 'footpath', all: 'curb', ny: null });
  B.box(X0, X1, 0, LV.footpath + 0.05, 5.7, 6.0, { all: 'curb', ny: null });
  B.box(X0, X1, -0.4, LV.road, 6.0, 30.0, { py: 'asphalt', all: 'curb', ny: null });
  for (let x = X0 + 2; x < X1 - 6; x += 12) B.box(x, x + 6, LV.road, LV.road + 0.015, 17.8, 18.2, 'roadLine');
  B.box(X0, X1, 0, LV.footpath, 30.0, 35.0, { py: 'footpath', all: 'curb', ny: null });
  B.box(X0, X1, 0, LV.footpath + 0.05, 30.0, 30.3, { all: 'curb', ny: null });
  // neighbours' front compound walls (banded stone, as in the elevation)
  const nWall = (x0, x1) => {
    B.box(x0, x1, 0, 5.2, 0.25, 0.85, { all: 'bandWall' });
    B.box(x0 - 0.05, x1 + 0.05, 5.2, 5.5, 0.2, 0.9, 'siteWhite');
  };
  nWall(-40, GARDEN.x0 - 0.05); // up to the side garden's boundary wall
  nWall(35.8, 76);
  const siteMeshes = B.build(get, { name: 'site', castShadow: false });
  siteMeshes.traverse((o) => o.isMesh && walkables.push(o));
  site.add(siteMeshes);

  // trees
  const trees = [
    [-24, 3.8, 18, 7, 3], [49, 3.8, 16, 6.5, 5], [74, 3.8, 19, 7.5, 9], [-50, 3.8, 17, 7, 13],
    [-42, 40, 20, 8, 17], [44, 41, 18, 7.5, 21], [78, 40, 21, 8, 25], [-50, -42, 22, 9, 29], [82, -46, 20, 8.5, 33],
  ];
  for (const [x, z, h, s, seed] of trees) {
    const t = makeTree(mats, h, s, seed);
    t.position.set(x, 0, z);
    site.add(t);
    if (z < 6) {
      const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.2, 10, 1, true), get('lampPole'));
      guard.position.set(x, LV.footpath + 0.6, z);
      site.add(guard);
    }
  }
  // street lamp
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 16, 10), get('lampPole'));
  pole.position.set(40, 8, 5.2);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 3.2), get('lampPole'));
  arm.position.set(40, 15.8, 6.6);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 1.4), get('lampHead'));
  head.position.set(40, 15.6, 8.0);
  for (const m of [pole, arm, head]) { m.castShadow = true; site.add(m); }
}
