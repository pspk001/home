import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------------------------------------------------------------------------
// Batcher: collects quads (with world-space UVs, 1 UV unit = 1 ft) into one
// buffer per material key, so the whole building renders in a few draw calls.
// ---------------------------------------------------------------------------
export class Batcher {
  constructor() {
    this.buckets = new Map();
  }

  _bucket(key) {
    let b = this.buckets.get(key);
    if (!b) {
      b = { p: [], n: [], uv: [], i: [] };
      this.buckets.set(key, b);
    }
    return b;
  }

  /** Quad from 4 points given counter-clockwise as seen from the normal side. */
  quad(key, p0, p1, p2, p3, n) {
    if (!key) return;
    const b = this._bucket(key);
    const base = b.p.length / 3;
    const ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
    for (const q of [p0, p1, p2, p3]) {
      b.p.push(q[0], q[1], q[2]);
      b.n.push(n[0], n[1], n[2]);
      if (ay >= ax && ay >= az) b.uv.push(q[0], -q[2]);
      else if (ax >= az) b.uv.push(n[0] > 0 ? -q[2] : q[2], q[1]);
      else b.uv.push(n[2] > 0 ? q[0] : -q[0], q[1]);
    }
    b.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  /**
   * Prism from a 4-point footprint [[x,z]...] (counter-clockwise seen from above)
   * mats: { top, bottom, sides: [e0, e1, e2, e3] } (edge i = pts[i] → pts[i+1])
   */
  prism(pts, y0, y1, mats) {
    if (y1 - y0 < 1e-4) return;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const A = pts[i], B = pts[(i + 1) % n];
      const dx = B[0] - A[0], dz = B[1] - A[1];
      const len = Math.hypot(dx, dz) || 1;
      const nx = -dz / len, nz = dx / len;
      this.quad(mats.sides[i], [A[0], y0, A[1]], [B[0], y0, B[1]], [B[0], y1, B[1]], [A[0], y1, A[1]], [nx, 0, nz]);
    }
    if (n === 4) {
      const [P0, P1, P2, P3] = pts;
      this.quad(mats.top, [P0[0], y1, P0[1]], [P1[0], y1, P1[1]], [P2[0], y1, P2[1]], [P3[0], y1, P3[1]], [0, 1, 0]);
      this.quad(mats.bottom, [P3[0], y0, P3[1]], [P2[0], y0, P2[1]], [P1[0], y0, P1[1]], [P0[0], y0, P0[1]], [0, -1, 0]);
    }
  }

  /**
   * Axis-aligned box. m = material key for every face, or
   * { px, nx, py, ny, pz, nz, all } (missing faces fall back to `all`; null = skip face)
   */
  box(x0, x1, y0, y1, z0, z1, m) {
    if (x1 < x0) [x0, x1] = [x1, x0];
    if (y1 < y0) [y0, y1] = [y1, y0];
    if (z1 < z0) [z0, z1] = [z1, z0];
    const f = typeof m === 'string' ? { all: m } : m;
    const g = (k) => (k in f ? f[k] : f.all);
    this.prism([[x0, z1], [x1, z1], [x1, z0], [x0, z0]], y0, y1, {
      top: g('py'), bottom: g('ny'), sides: [g('pz'), g('px'), g('nz'), g('nx')],
    });
  }

  /** Build one mesh per material key. */
  build(getMaterial, { castShadow = true, receiveShadow = true, name = 'batch' } = {}) {
    const group = new THREE.Group();
    group.name = name;
    for (const [key, b] of this.buckets) {
      if (!b.i.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
      geo.setIndex(b.i);
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, getMaterial(key));
      mesh.name = `${name}:${key}`;
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      group.add(mesh);
    }
    return group;
  }
}

// ---------------------------------------------------------------------------
// Re-computes UVs from local positions (1 UV unit = 1 ft) using the dominant
// normal axis, so tiling textures keep a real-world scale on any geometry.
// ---------------------------------------------------------------------------
export function worldUV(geometry, scale = 1) {
  const pos = geometry.attributes.position;
  const nrm = geometry.attributes.normal;
  if (!nrm) geometry.computeVertexNormals();
  const n = geometry.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = x; v = -z; }
    else if (ax >= az) { u = z; v = y; }
    else { u = x; v = y; }
    uv[i * 2] = u * scale;
    uv[i * 2 + 1] = v * scale;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geometry;
}

/**
 * Re-assigns triangles of a (grouped) geometry to new material groups.
 * fn(oldGroupIndex, centroid: Vector3, normal: Vector3) → new material index.
 */
export function regroup(geometry, fn) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = g.attributes.position;
  const nrm = g.attributes.normal;
  const groups = g.groups.length ? g.groups : [{ start: 0, count: pos.count, materialIndex: 0 }];
  const buckets = new Map();
  const c = new THREE.Vector3(), nn = new THREE.Vector3();
  for (const grp of groups) {
    for (let t = grp.start; t < grp.start + grp.count; t += 3) {
      c.set(0, 0, 0); nn.set(0, 0, 0);
      for (let k = 0; k < 3; k++) {
        c.x += pos.getX(t + k) / 3; c.y += pos.getY(t + k) / 3; c.z += pos.getZ(t + k) / 3;
        nn.x += nrm.getX(t + k); nn.y += nrm.getY(t + k); nn.z += nrm.getZ(t + k);
      }
      nn.normalize();
      const idx = fn(grp.materialIndex, c, nn);
      if (!buckets.has(idx)) buckets.set(idx, []);
      buckets.get(idx).push(t);
    }
  }
  const attrs = {};
  for (const name of Object.keys(g.attributes)) {
    const a = g.attributes[name];
    attrs[name] = { src: a, out: new Float32Array(a.count * a.itemSize), size: a.itemSize };
  }
  const out = new THREE.BufferGeometry();
  let cursor = 0;
  for (const idx of [...buckets.keys()].sort((a, b) => a - b)) {
    const start = cursor;
    for (const t of buckets.get(idx)) {
      for (let k = 0; k < 3; k++) {
        for (const name in attrs) {
          const { src, out: arr, size } = attrs[name];
          for (let s = 0; s < size; s++) arr[(cursor + k) * size + s] = src.array[(t + k) * size + s];
        }
      }
      cursor += 3;
    }
    out.addGroup(start, cursor - start, idx);
  }
  for (const name in attrs) out.setAttribute(name, new THREE.BufferAttribute(attrs[name].out, attrs[name].size));
  out.computeBoundingSphere();
  return out;
}

/**
 * Extrudes a 2D outline lying in the world XZ plane (points given as [x, z])
 * between y0 and y1. Returns a geometry with groups: 0 = top, 1 = bottom, 2 = sides.
 */
export function extrudeXZ(outline, holes, y0, y1, curveSegments = 12) {
  const shape = new THREE.Shape();
  outline.forEach(([x, z], i) => (i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)));
  for (const h of holes || []) {
    const p = new THREE.Path();
    h.forEach(([x, z], i) => (i ? p.lineTo(x, -z) : p.moveTo(x, -z)));
    shape.holes.push(p);
  }
  return extrudeShapeXZ(shape, y0, y1, curveSegments);
}

/** Same as extrudeXZ but for a ready THREE.Shape whose (x, y) = world (x, -z). */
export function extrudeShapeXZ(shape, y0, y1, curveSegments = 12) {
  let geo = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0, bevelEnabled: false, curveSegments });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, y0, 0);
  geo = regroup(geo, (gi, c, n) => (gi === 1 ? 2 : n.y > 0 ? 0 : 1));
  worldUV(geo);
  return geo;
}

/** Rounded-rectangle path helper for THREE.Shape / Path. Corner radii: [bl, br, tr, tl]. */
export function roundedRect(path, x0, y0, x1, y1, r) {
  const [bl, br, tr, tl] = Array.isArray(r) ? r : [r, r, r, r];
  path.moveTo(x0 + bl, y0);
  path.lineTo(x1 - br, y0);
  if (br) path.quadraticCurveTo(x1, y0, x1, y0 + br);
  path.lineTo(x1, y1 - tr);
  if (tr) path.quadraticCurveTo(x1, y1, x1 - tr, y1);
  path.lineTo(x0 + tl, y1);
  if (tl) path.quadraticCurveTo(x0, y1, x0, y1 - tl);
  path.lineTo(x0, y0 + bl);
  if (bl) path.quadraticCurveTo(x0, y0, x0 + bl, y0);
  return path;
}

/**
 * Merges every single-material mesh under `root` (static geometry) into one
 * mesh per material, in place. Cuts hundreds of furniture draw calls to a few
 * dozen. `keep(mesh)` → true leaves a mesh untouched (e.g. walkable/pickable).
 */
export function mergeInPlace(root, keep = () => false) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const remove = [];
  root.traverse((o) => {
    if (!o.isMesh || o === root || keep(o) || Array.isArray(o.material) || !o.visible) return;
    let g = o.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    if (g.index) g = g.toNonIndexed();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.clearGroups();
    g.morphAttributes = {};
    const key = o.material.uuid + (o.castShadow ? ':s' : '');
    if (!buckets.has(key)) buckets.set(key, { mat: o.material, geos: [], cast: o.castShadow });
    buckets.get(key).geos.push(g);
    remove.push(o);
  });
  for (const o of remove) o.parent.remove(o);
  // drop now-empty groups
  const empties = [];
  root.traverse((o) => { if (o !== root && !o.isMesh && o.children.length === 0 && o.type === 'Group') empties.push(o); });
  for (const e of empties) e.parent?.remove(e);
  for (const b of buckets.values()) {
    const merged = mergeGeometries(b.geos, false);
    if (!merged) continue;
    merged.computeBoundingSphere();
    const m = new THREE.Mesh(merged, b.mat);
    m.castShadow = b.cast;
    m.receiveShadow = true;
    m.userData.merged = true;
    root.add(m);
  }
  return root;
}
