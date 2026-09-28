import * as THREE from 'three';
import { Batcher } from '../geometry.js';
import { LV, OPENING } from '../config.js';
import { WALLS, DOORS } from '../plan.js';

const OUTER = new Set(['ext', 'extTan', 'pPortico', 'siding']);

/** Windows (frames, glass, sills, grilles) and doors (frames, thresholds, open leaves). */
export function buildOpenings(ctx) {
  const { mats, house, colliders, walkables } = ctx;
  const thresholdMat = new THREE.MeshBasicMaterial({ visible: false });
  const B = new Batcher();
  const leaves = new THREE.Group();
  leaves.name = 'door-leaves';

  for (const w of WALLS) {
    if (!w.open) continue;
    const vertical = w.z[1] - w.z[0] > w.x[1] - w.x[0];
    const [t0, t1] = vertical ? w.x : w.z; // thickness range
    const tc = (t0 + t1) / 2;
    const outer0 = OUTER.has(w.s0), outer1 = OUTER.has(w.s1);
    // box helper in (along, thickness) space
    const bx = (a0, a1, y0, y1, c0, c1, m) => (vertical ? B.box(c0, c1, y0, y1, a0, a1, m) : B.box(a0, a1, y0, y1, c0, c1, m));

    for (const o of w.open) {
      const lo = Math.min(o.a, o.b), hi = Math.max(o.a, o.b);
      const [sill, head] = OPENING[o.t];
      const width = hi - lo;

      if (o.t === 'win' || o.t === 'kwin' || o.t === 'swin' || o.t === 'vent') {
        const fw = 0.14, fd = 0.22;
        const f0 = tc - fd / 2, f1 = tc + fd / 2;
        const frame = 'frameDark';
        const glass = o.t === 'swin' ? 'glassFacade' : 'glass';
        bx(lo, hi, sill, sill + fw, f0, f1, frame);
        bx(lo, hi, head - fw, head, f0, f1, frame);
        bx(lo, lo + fw, sill, head, f0, f1, frame);
        bx(hi - fw, hi, sill, head, f0, f1, frame);
        if (o.t === 'vent') {
          for (let y = sill + 0.3; y < head - 0.2; y += 0.28) bx(lo + fw, hi - fw, y, y + 0.03, tc - 0.08, tc + 0.08, 'glass');
        } else {
          const panes = width > 4.5 ? 3 : width > 2.6 ? 2 : 1;
          for (let i = 1; i < panes; i++) {
            const m = lo + (width * i) / panes;
            bx(m - fw / 2, m + fw / 2, sill, head, f0, f1, frame);
          }
          if (o.t === 'swin') {
            for (let y = sill + 1.4; y < head - 0.5; y += 1.4) bx(lo, hi, y, y + 0.08, f0, f1, frame);
          }
          // glass (two sliding tracks, slightly offset)
          for (let i = 0; i < panes; i++) {
            const a = lo + (width * i) / panes + fw * 0.5, b = lo + (width * (i + 1)) / panes - fw * 0.5;
            const off = i % 2 ? 0.04 : -0.04;
            bx(a, b, sill + fw, head - fw, tc + off - 0.012, tc + off + 0.012, glass);
          }
          // grille on the exterior side of outer ground-floor windows
          if ((outer0 || outer1) && o.t === 'win') {
            const gz = outer0 ? t0 + 0.12 : t1 - 0.12;
            const bars = Math.round(width / 0.42);
            for (let i = 1; i < bars; i++) {
              const m = lo + (width * i) / bars;
              bx(m - 0.025, m + 0.025, sill, head, gz - 0.025, gz + 0.025, 'frameDark');
            }
            for (const y of [sill + 1.3, head - 1.3]) bx(lo, hi, y - 0.03, y + 0.03, gz - 0.03, gz + 0.03, 'frameDark');
          }
          // granite sill inside, projecting drip outside
          if (o.t !== 'swin') {
            const inner = outer0 ? [t1 - 0.05, t1 + 0.18] : outer1 ? [t0 - 0.18, t0 + 0.05] : [t0 - 0.12, t1 + 0.12];
            bx(lo - 0.1, hi + 0.1, sill - 0.06, sill + 0.02, inner[0], inner[1], 'graniteBlack');
            if (outer0) bx(lo - 0.15, hi + 0.15, sill - 0.12, sill, t0 - 0.25, t0 + 0.05, 'white');
            if (outer1) bx(lo - 0.15, hi + 0.15, sill - 0.12, sill, t1 - 0.05, t1 + 0.25, 'white');
            if (outer0) bx(lo - 0.25, hi + 0.25, head, head + 0.18, t0 - 0.9, t0 + 0.02, 'white'); // chajja
            if (outer1) bx(lo - 0.25, hi + 0.25, head, head + 0.18, t1 - 0.02, t1 + 0.9, 'white');
          }
        }
        continue;
      }

      // invisible walkable threshold so walk-mode can pass through doorways
      if (o.t === 'door' || o.t === 'main' || o.t === 'arch') {
        const th = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), thresholdMat);
        th.rotation.x = -Math.PI / 2;
        const cx = (lo + hi) / 2;
        if (vertical) { th.scale.set(t1 - t0 + 0.1, width, 1); th.position.set(tc, sill + 0.03, cx); }
        else { th.scale.set(width, t1 - t0 + 0.1, 1); th.position.set(cx, sill + 0.03, tc); }
        th.visible = false;
        th.updateMatrixWorld();
        house.add(th);
        walkables.push(th);
      }

      if (o.t === 'door' || o.t === 'main') {
        const cfg = DOORS[o.door] || { hinge: 'a', side: 1, style: 'wood' };
        const fw = 0.25; // frame face width
        const fm = cfg.style === 'teak' ? 'doorTeak' : 'doorWood';
        const d0 = t0 - 0.05, d1 = t1 + 0.05;
        bx(lo, lo + fw, LV.gf, head, d0, d1, fm);
        bx(hi - fw, hi, LV.gf, head, d0, d1, fm);
        bx(lo, hi, head - fw, head, d0, d1, fm);
        bx(lo + fw, hi - fw, LV.gf - 0.03, LV.gf + 0.03, t0, t1, cfg.style === 'teak' ? 'marble' : 'graniteBlack');

        const leafH = head - fw - LV.gf - 0.04;
        const leafT = cfg.style === 'teak' ? 0.18 : 0.13;
        const clear = width - 2 * fw;
        const faceAt = cfg.side === 1 ? t1 : t0;
        const dir = cfg.side === 1 ? 1 : -1;
        const leafList = cfg.double
          ? [{ hinge: lo + fw, w: clear / 2, sgn: 1 }, { hinge: hi - fw, w: clear / 2, sgn: -1 }]
          : [{ hinge: cfg.hinge === 'a' ? lo + fw : hi - fw, w: clear, sgn: cfg.hinge === 'a' ? 1 : -1 }];
        for (const L of leafList) {
          if (cfg.flat) {
            // swung right round (~180°) so the leaf rests flat against the wall face
            const leaf = makeLeaf(mats, cfg.style, L.w, leafH, leafT, vertical ? L.sgn : -L.sgn);
            const along = L.hinge - L.sgn * (L.w / 2 + 0.03);
            const across = faceAt + dir * (leafT / 2 + 0.04);
            if (vertical) { leaf.rotation.y = Math.PI / 2; leaf.position.set(across, LV.gf + 0.02, along); }
            else { leaf.rotation.y = 0; leaf.position.set(along, LV.gf + 0.02, across); }
            leaves.add(leaf);
            continue;
          }
          const leaf = makeLeaf(mats, cfg.style, L.w, leafH, leafT, vertical ? dir : -dir);
          // leaf lies perpendicular to the wall, against its hinge jamb (door fully open)
          const along = L.hinge + L.sgn * leafT / 2;
          const across = faceAt + dir * (L.w / 2 + 0.02);
          if (vertical) {
            leaf.rotation.y = 0; // leaf width runs along x
            leaf.position.set(across, LV.gf + 0.02, along);
          } else {
            leaf.rotation.y = Math.PI / 2; // leaf width runs along z
            leaf.position.set(along, LV.gf + 0.02, across);
          }
          leaves.add(leaf);
          const c = vertical
            ? { x0: Math.min(faceAt, faceAt + dir * L.w), x1: Math.max(faceAt, faceAt + dir * L.w), z0: along - leafT, z1: along + leafT }
            : { x0: along - leafT, x1: along + leafT, z0: Math.min(faceAt, faceAt + dir * L.w), z1: Math.max(faceAt, faceAt + dir * L.w) };
          colliders.push({ ...c, y0: LV.gf, y1: head, id: 'leaf' });
        }
      }
    }
  }
  house.add(B.build((k) => mats.get(k), { name: 'openings' }));
  house.add(leaves);
}

/** A door leaf centred on its width (x) with its bottom at y=0; thickness along z. */
function makeLeaf(mats, style, w, h, t, handleSide = 1) {
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    return m;
  };
  if (style === 'glass') {
    const fr = mats.get('doorWood');
    const s = 0.28;
    add(new THREE.BoxGeometry(w, s, t), fr, 0, s / 2, 0);
    add(new THREE.BoxGeometry(w, s, t), fr, 0, h - s / 2, 0);
    add(new THREE.BoxGeometry(s, h, t), fr, -w / 2 + s / 2, h / 2, 0);
    add(new THREE.BoxGeometry(s, h, t), fr, w / 2 - s / 2, h / 2, 0);
    add(new THREE.BoxGeometry(w - 2 * s, s * 0.6, t), fr, 0, h * 0.45, 0);
    add(new THREE.BoxGeometry(w - 2 * s, h - 2 * s, 0.03), mats.get('glass'), 0, h / 2, 0);
  } else {
    const mat = mats.get(style === 'teak' ? 'doorTeak' : style === 'pvc' ? 'doorPVC' : 'doorWood');
    add(new THREE.BoxGeometry(w, h, t), mat, 0, h / 2, 0);
    if (style === 'teak') {
      // raised panels
      const pm = mats.get('doorWood');
      for (const [py, ph] of [[h * 0.2, h * 0.28], [h * 0.58, h * 0.36]]) {
        add(new THREE.BoxGeometry(w * 0.66, ph, t + 0.06), pm, 0, py + ph / 2, 0);
      }
    } else if (style === 'wood') {
      const pm = mats.get('furnWood');
      add(new THREE.BoxGeometry(w * 0.08, h * 0.9, t + 0.02), pm, -w * 0.28, h / 2, 0);
    }
  }
  // handles on both faces, near the free edge
  const hm = mats.get(style === 'pvc' ? 'steel' : 'brass');
  const hx = handleSide * (w / 2 - 0.3);
  for (const s of [1, -1]) {
    add(new THREE.BoxGeometry(0.06, style === 'teak' ? 1.4 : 0.5, 0.06), hm, hx, 3.3, s * (t / 2 + 0.12));
    add(new THREE.BoxGeometry(0.05, 0.05, 0.12), hm, hx, 3.3 + (style === 'teak' ? 0.55 : 0.18), s * (t / 2 + 0.06));
    add(new THREE.BoxGeometry(0.05, 0.05, 0.12), hm, hx, 3.3 - (style === 'teak' ? 0.55 : 0.18), s * (t / 2 + 0.06));
  }
  // leaf geometry is built with width along x; shift so the hinge edge is at x = -w/2 → keep centred
  return g;
}
