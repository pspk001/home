import * as THREE from 'three';
import { Batcher, extrudeXZ, regroup, roundedRect, worldUV } from '../geometry.js';
import { LV, PLOT, rearZ, REAR_T, VOID, voidOutline } from '../config.js';

// ---------------------------------------------------------------------------
// Everything outside the ground-floor rooms: the first-floor shell and roof
// (as seen in the elevation), the white "C" frame, wood cladding, gates,
// terrace, the double-height space at the rear and the
// street/site around the plot.
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
  const face = vertical ? { nx: s0, px: s1, nz: end, pz: end, py: end, ny: null } : { nz: s0, pz: s1, nx: end, px: end, py: end, ny: null };
  const lintel = { ...face, ny: 'reveal' };
  const ops = [...open].sort((p, q) => p.a - q.a);
  let cur = a0;
  for (const o of ops) {
    if (o.a > cur) box(cur, o.a, y0, y1, face);
    if (o.sill > y0) box(o.a, o.b, y0, o.sill, face);
    if (o.head < y1) box(o.a, o.b, o.head, y1, lintel);
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
  if (a1 > cur) box(cur, a1, y0, y1, face);
  if (colliders) colliders.push({ x0: x[0], x1: x[1], z0: z[0], z1: z[1], y0, y1, id: 'ff' });
}

/** Softly folded sheer curtain filling an opening (hides the unmodelled first-floor rooms). */
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
  const { mats, house, site, walkables, colliders } = ctx;
  const B = new Batcher();
  GB = new Batcher();
  CTX = ctx;
  const get = (k) => mats.get(k);

  // =========================================================================
  // FIRST FLOOR SHELL (layout not supplied → exterior envelope only)
  // =========================================================================
  const win = (a, b, sill = FF0 + 3, head = FF0 + 8) => ({ a, b, sill, head });
  // left wall
  wallRun(B, { x: [0, T], z: [rearZ(0), -18.039], y0: FF0, y1: FF1, s0: 'ext', s1: 'ffInterior',
    open: [win(-40.4, -35.4), win(-26.0, -21.0)] });
  // back wall of the terrace (front of the main block)
  wallRun(B, { x: [T, 17.5], z: [-18.831, -18.039], y0: FF0, y1: FF1, s0: 'ffInterior', s1: 'ext',
    open: [win(3.0, 9.0, FF0 + 0.05, FF0 + 7.5), win(11.0, 15.0)] });
  // tower (stair block) west wall, facing the terrace
  wallRun(B, { x: [17.5, 17.5 + T], z: [-18.039, -0.75], y0: FF0, y1: FF1, s0: 'ext', s1: 'ffInterior',
    open: [{ a: -7.6, b: -4.6, sill: FF0 + 0.05, head: FF0 + 7.2, glass: 'glass' }] });
  // tower front: tan block with the tall stair window, then sage
  wallRun(B, { x: [17.5, 25.3], z: [-T, 0], y0: FF0, y1: FF1, s0: 'ffInterior', s1: 'extTan', end: 'extTan',
    open: [{ a: 19.8, b: 22.8, sill: FF0 + 2.0, head: FF1 - 0.6 }] });
  wallRun(B, { x: [25.3, PLOT.width], z: [-T, 0], y0: FF0, y1: FF1, s0: 'ffInterior', s1: 'ext' });
  // right (party) wall
  wallRun(B, { x: [PLOT.width - T, PLOT.width], z: [rearZ(PLOT.width), -T], y0: FF0, y1: FF1, s0: 'ffInterior', s1: 'ext' });
  // walls around the double-height space (over the dining end, the old garden and the kitchen)
  buildVoidWalls(B);
  // slanted rear wall. Behind the dining area, the old garden and the kitchen it is a
  // glass wall (buildGlassWall).
  // endA / endB: face at the run's start / end (null where it abuts the glass wall)
  const rearRun = (xa, xb, wins, endA = 'ext', endB = 'ext') => {
    let cur = xa;
    const seg = (p, q, y0, y1, ends = 'ext') => {
      const pts = [[p, rearZ(p) + REAR_T], [q, rearZ(q) + REAR_T], [q, rearZ(q)], [p, rearZ(p)]];
      const [e0, e1] = Array.isArray(ends) ? ends : [ends, ends];
      B.prism(pts, y0, y1, { top: 'ext', bottom: 'reveal', sides: ['ffInterior', e1, 'ext', e0] });
    };
    for (const [a, b, tall] of wins) {
      const s = tall ? FF0 + 2.2 : FF0 + 3.5, h = tall ? FF0 + 8.9 : FF0 + 7.5;
      seg(cur, a, FF0, FF1, [cur === xa ? endA : 'ext', 'ext']);
      seg(a, b, FF0, s, null); // below / above the window: ends abut the jambs
      seg(a, b, h, FF1, null);
      const zc = (rearZ(a) + rearZ(b)) / 2 + REAR_T / 2;
      if (!tall) {
        GB.box(a, b, s, h, zc - 0.02, zc + 0.02, 'glassFacade');
        B.box(a, b, s, s + 0.14, zc - 0.1, zc + 0.1, 'frameDark');
        B.box(a, b, h - 0.14, h, zc - 0.1, zc + 0.1, 'frameDark');
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
    seg(cur, xb, FF0, FF1, [cur === xa ? endA : 'ext', endB]);
  };
  rearRun(0, VOID.gardenX0, [[2.2, 4.6]], 'ext', null);
  buildGlassWall(B);

  // FF floor finish (inside) and terrace tiles
  const terrace = [[T, -18.039], [17.5, -18.039], [17.5, 0], [T, 0]];
  B.box(T, 17.5, FF0, FF0 + 0.05, -18.039, 0, { py: 'terrace', all: 'terrace', ny: null });

  // ---- roof slab + parapets ------------------------------------------------
  const roofOutline = [
    [0, -18.039], [17.5, -18.039], [17.5, -T], [PLOT.width, -T], [PLOT.width, rearZ(PLOT.width)], [0, rearZ(0)],
  ];
  const vp = voidOutline();
  const roofGeo = extrudeXZ(roofOutline, [vp], FF1, LV.roof);
  const roof = new THREE.Mesh(roofGeo, [get('terrace'), get('ceiling'), get('slabEdge')]);
  roof.castShadow = roof.receiveShadow = true;
  house.add(roof);
  // solid roof over the double-height space, its soffit left as board-formed concrete
  const vroof = new THREE.Mesh(extrudeXZ(vp, [], FF1, LV.roof), [get('terrace'), get('concreteCeil'), get('slabEdge')]);
  vroof.name = 'void-roof';
  vroof.castShadow = vroof.receiveShadow = true;
  house.add(vroof);
  // keep the tower facade continuous across the roof-slab edge
  B.box(17.5, 25.3, FF1, LV.roof, -T, 0, { all: 'extTan', ny: null, py: null });
  B.box(25.3, PLOT.width, FF1, LV.roof, -T, 0, { all: 'ext', ny: null, py: null });
  const P0 = LV.roof, P1 = LV.parapet, pt = 0.45;
  const parapet = (x0, x1, z0, z1) => {
    B.box(x0, x1, P0, P1 - 0.25, z0, z1, 'ext');
    B.box(x0 - 0.05, x1 + 0.05, P1 - 0.25, P1, z0 - 0.05, z1 + 0.05, 'white');
  };
  parapet(0, pt, rearZ(0), -18.039);
  parapet(0, 17.5, -18.039 - pt, -18.039);
  parapet(17.5, 17.5 + pt, -18.039, -9.635);
  parapet(PLOT.width - pt, PLOT.width, rearZ(PLOT.width), -9.635);
  const rearPar = (xa, xb) => B.prism([[xa, rearZ(xa) + pt], [xb, rearZ(xb) + pt], [xb, rearZ(xb)], [xa, rearZ(xa)]], P0, P1, { top: 'white', bottom: null, sides: ['ext', 'ext', 'ext', 'ext'] });
  rearPar(0, PLOT.width);

  // ---- mumty (stair head-room) ---------------------------------------------
  const M0 = LV.roof, M1 = LV.mumtyCeil;
  wallRun(B, { x: [17.5, 25.3], z: [-0.6, 0], y0: M0, y1: M1, s0: 'ffInterior', s1: 'extTan', end: 'extTan',
    open: [{ a: 19.6, b: 23.6, sill: M1 - 3.2, head: M1 - 2.2 }] });
  wallRun(B, { x: [25.3, PLOT.width], z: [-0.6, 0], y0: M0, y1: M1, s0: 'ffInterior', s1: 'ext' });
  wallRun(B, { x: [17.5, PLOT.width], z: [-9.635, -9.035], y0: M0, y1: M1, s0: 'extTan', s1: 'ffInterior',
    open: [{ a: 21.0, b: 24.0, sill: M0 + 0.05, head: M0 + 7.0, glass: false }] });
  wallRun(B, { x: [17.5, 18.1], z: [-9.035, -0.6], y0: M0, y1: M1, s0: 'extTan', s1: 'ffInterior' });
  wallRun(B, { x: [PLOT.width - 0.6, PLOT.width], z: [-9.035, -0.6], y0: M0, y1: M1, s0: 'ffInterior', s1: 'ext' });
  B.box(17.3, PLOT.width, M1, LV.mumtyTop, -9.9, 0.2, { py: 'white', ny: 'ceiling', all: 'white' });
  // mumty door leaf (closed)
  B.box(21.1, 23.9, M0 + 0.05, M0 + 6.95, -9.45, -9.2, 'doorWood');

  // sage water-tank enclosure beside the mumty (small block seen in the elevation)
  B.box(14.3, 17.5, LV.roof, LV.roof + 4.6, -22.6, -18.6, { all: 'ext', py: 'white', ny: null });
  B.box(14.2, 17.6, LV.roof + 4.6, LV.roof + 4.85, -22.7, -18.5, 'white');

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
  // House name plate "Surbhi Bhawan" beside the light slit: black granite, brass letters,
  // standing off the wall on hidden spacers
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

  buildSite(ctx);
}

// ---------------------------------------------------------------------------
// Double-height space: first-floor walls around it, and a balcony over the hall
// that looks down into it.
// ---------------------------------------------------------------------------
function buildVoidWalls(B) {
  const I = 'ffInterior';
  const zF = VOID.zFront;      // void-side face of the front wall
  const zR = zF + 0.5;         // room-side face
  const wood = 'doorTeak';
  // teak members: joint-free grain that runs along each member
  const tb = (x0, x1, y0, y1, z0, z1) => B.box(x0, x1, y0, y1, z0, z1, teak(Math.max(x1 - x0, z1 - z0), y1 - y0));

  // wall above the bedroom-1 rear wall (faces the old-garden part of the void)
  wallRun(B, { x: [VOID.gardenX0, VOID.x0], z: [VOID.gardenZ, -42.941], y0: FF0, y1: FF1, s0: I, s1: I, end: I,
    open: [{ a: 8.0, b: 11.4, sill: FF0 + 3, head: FF0 + 7.5, frame: wood, glass: 'glass', curtain: 1 }] });
  // wall beside the puja room
  wallRun(B, { x: [5.852, VOID.gardenX0], z: [rearZ(VOID.gardenX0), VOID.gardenZ], y0: FF0, y1: FF1, s0: I, s1: I, end: I });
  // walls above the bedroom-1 and bedroom-2 walls, facing each other across the hall;
  // they run forward to the back wall of the balcony
  const zB = VOID.balconyBack, zE = VOID.hallFront, hx = VOID.hallX1;
  // one big window in each (6 ft tall, sill 2 ft above the first floor)
  const win = (a, b, curtain) => ({ a, b, sill: FF0 + 2, head: FF0 + 8, frame: wood, glass: 'glass', curtain });
  wallRun(B, { x: [11.879, VOID.x0], z: [-42.941, zB], y0: FF0, y1: FF1, s0: I, s1: I, end: I,
    open: [win(-40.4, -33.2, -1)] });
  wallRun(B, { x: [hx, hx + 0.5], z: [zR, zB], y0: FF0, y1: FF1, s0: I, s1: I, end: I,
    open: [win(-36.9, -31.5, 1)] });

  // front wall over the kitchen / bedroom-2 line
  wallRun(B, { x: [hx, PLOT.width - T], z: [zF, zR], y0: FF0, y1: FF1, s0: I, s1: I, end: I });

  // -- Balcony over the hall: open to the first floor behind it; wooden deck and a
  //    glass railing with a teak handrail along its edge --
  {
    // wooden deck on the slab, and a glass railing with a teak handrail along the edge
    B.box(VOID.x0, hx, FF0, FF0 + 0.05, zE, zB, { py: 'wood', all: 'wood', ny: null });
    const zr = zE + 0.12;
    tb(VOID.x0, hx, FF0 + 3.35, FF0 + 3.55, zE - 0.02, zr + 0.13);   // handrail
    tb(VOID.x0, hx, FF0, FF0 + 0.18, zE, zr + 0.08);                  // shoe rail
    const step = (hx - VOID.x0 - 0.2) / 4;
    for (let i = 0; i <= 4; i++) {
      const x = VOID.x0 + 0.1 + i * step;
      B.box(x - 0.05, x + 0.05, FF0, FF0 + 3.35, zr - 0.05, zr + 0.05, 'steel');
    }
    GB.box(VOID.x0 + 0.05, hx - 0.05, FF0 + 0.2, FF0 + 3.33, zr - 0.012, zr + 0.012, 'glass');
  }
}

// ---------------------------------------------------------------------------
// Glass wall in the rear (east) wall behind the dining area, the old garden and the
// kitchen. Below door height the wall is solid (structure.js); from there the glass
// rises to the roof, crossed by the first-floor slab edge, so the morning sun comes
// into the double-height space. Teak frames.
// ---------------------------------------------------------------------------
function buildGlassWall(B) {
  const x0 = VOID.gardenX0, x1 = PLOT.width;     // from the puja-room wall to the corner
  const g0 = x0 + 0.6, g1 = VOID.x1 - 0.5;        // glazed width between two piers
  const sill = VOID.glassSill, head = FF1 - 0.7; // bottom / top of the glazing
  const band0 = LV.gfCeil, band1 = FF0;         // first-floor slab edge crossing the glass
  const rail = teak(1, 0), post = teak(0, 1);
  // prism that follows the slanted wall: z = rearZ(x) + off ± d/2
  const sl = (xa, xb, y0, y1, off, d, m, into = B) => into.prism(
    [[xa, rearZ(xa) + off + d / 2], [xb, rearZ(xb) + off + d / 2], [xb, rearZ(xb) + off - d / 2], [xa, rearZ(xa) + off - d / 2]], y0, y1,
    { top: m, bottom: m, sides: [m, m, m, m] });
  const full = (xa, xb) => [[xa, rearZ(xa) + REAR_T], [xb, rearZ(xb) + REAR_T], [xb, rearZ(xb)], [xa, rearZ(xa)]];
  // piers at both ends, below and above the slab edge: one end is the jamb, the other abuts the rear wall
  for (const [a, b, jA, jB] of [[x0, g0, null, 'ext'], [g1, x1, 'ext', 'ext']]) {
    B.prism(full(a, b), sill, band0, { top: null, bottom: null, sides: ['pHall', jB, 'ext', jA] });
    B.prism(full(a, b), band1, FF1, { top: null, bottom: null, sides: ['ffInterior', jB, 'ext', jA] });
  }
  // lintel under the roof
  B.prism(full(g0, g1), head, FF1, { top: null, bottom: 'reveal', sides: ['ffInterior', null, 'ext', null] });
  // teak frame: jambs, rails at the sill / slab edge / head, a transom, mullions
  const c = REAR_T / 2;
  sl(g0, g0 + 0.22, sill, head, c, 0.3, post);
  sl(g1 - 0.22, g1, sill, head, c, 0.3, post);
  for (const [y0, y1] of [[sill, sill + 0.22], [band0 - 0.2, band0], [band1, band1 + 0.2], [head - 0.2, head]]) sl(g0, g1, y0, y1, c, 0.3, rail);
  sl(g0, g1, FF0 + 5.0, FF0 + 5.14, c, 0.22, rail);
  const bays = 11;
  for (let i = 1; i < bays; i++) {
    const x = g0 + ((g1 - g0) * i) / bays;
    sl(x - 0.08, x + 0.08, sill, band0, c, 0.22, post);
    sl(x - 0.08, x + 0.08, band1, head, c, 0.22, post);
  }
  sl(g0 + 0.2, g1 - 0.2, sill + 0.22, band0 - 0.2, c, 0.03, 'glass', GB);
  sl(g0 + 0.2, g1 - 0.2, band1 + 0.2, head - 0.2, c, 0.03, 'glass', GB);
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
  nWall(-40, -0.4);
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
