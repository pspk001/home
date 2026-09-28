import * as THREE from 'three';

// ---------------------------------------------------------------------------
// First-person walk-through: WASD / arrow keys, drag to look, on-screen
// joystick on touch screens, double-click/double-tap a spot to walk there.
// Collisions: body circle vs. wall/furniture boxes; floor height (stairs!)
// comes from a downward ray against walkable surfaces.
// ---------------------------------------------------------------------------

const EYE = 5.3;      // eye height above the floor (ft)
const RADIUS = 0.8;   // body radius (ft)
const STEP = 0.95;    // max step-up (ft)
const SPEED = 6.5;    // ft / s

export class WalkController {
  constructor({ camera, dom, colliders, walkables, onChange }) {
    this.camera = camera;
    this.dom = dom;
    this.colliders = colliders;
    this.walkables = walkables;
    this.onChange = onChange || (() => {});
    this.enabled = false;
    this.yaw = 0;
    this.pitch = -0.06;
    this.feet = 2;
    this.pos = new THREE.Vector2();
    this.keys = new Set();
    this.joy = new THREE.Vector2();
    this.target = null;
    this.stuck = 0;
    this.ray = new THREE.Raycaster();
    this.ray.far = 6;
    this._down = new THREE.Vector3(0, -1, 0);
    this._n = new THREE.Vector3();
    this._bind();
  }

  _bind() {
    const d = this.dom;
    let dragging = false, lastX = 0, lastY = 0, id = null, moved = 0, lastTap = 0;
    d.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      dragging = true; id = e.pointerId; lastX = e.clientX; lastY = e.clientY; moved = 0;
      d.setPointerCapture?.(e.pointerId);
    });
    d.addEventListener('pointermove', (e) => {
      if (!this.enabled || !dragging || e.pointerId !== id) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      const k = e.pointerType === 'touch' ? 0.006 : 0.0042;
      this.yaw += dx * k;
      this.pitch = THREE.MathUtils.clamp(this.pitch - dy * k, -1.2, 1.2);
      this.target = null;
      this._apply();
    });
    const up = (e) => {
      if (!dragging || e.pointerId !== id) return;
      dragging = false;
      if (moved < 6) {
        const now = performance.now();
        if (now - lastTap < 350) this._walkToScreen(e.clientX, e.clientY);
        lastTap = now;
      }
    };
    d.addEventListener('pointerup', up);
    d.addEventListener('pointercancel', up);
    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (e.target instanceof HTMLInputElement) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'q', 'e', 'shift'].includes(k)) {
        this.keys.add(k);
        this.target = null;
        if (k.startsWith('arrow')) e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  /** Enter at a position (feet-level y is found automatically). */
  enter(x, z, yaw, pitch = -0.06) {
    this.enabled = true;
    const free = this._findFree(x, z, 3);
    this.pos.set(free[0], free[1]);
    this.feet = this._floorAt(free[0], free[1], 30) ?? 2;
    this.yaw = yaw;
    this.pitch = pitch;
    this.target = null;
    this.camera.position.set(this.pos.x, this.feet + EYE, this.pos.y);
    this._apply();
  }

  exit() {
    this.enabled = false;
    this.keys.clear();
    this.joy.set(0, 0);
    this.target = null;
  }

  lookDir(out = new THREE.Vector3()) {
    return out.set(-Math.sin(this.yaw) * Math.cos(this.pitch), -Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
  }

  _apply() {
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-this.pitch, this.yaw, 0, 'YXZ'));
    this.camera.quaternion.copy(q);
    this.onChange();
  }

  _walkToScreen(cx, cy) {
    const r = this.dom.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    const rc = new THREE.Raycaster();
    rc.setFromCamera(ndc, this.camera);
    const hit = rc.intersectObjects(this.walkables, false).find((h) => h.object.visible !== false);
    if (hit) this.target = new THREE.Vector2(hit.point.x, hit.point.z);
  }

  _floorAt(x, z, from = STEP + 0.4) {
    this.ray.set(new THREE.Vector3(x, this.feet + from, z), this._down);
    this.ray.far = from + 8;
    const hits = this.ray.intersectObjects(this.walkables, false);
    for (const h of hits) {
      if (h.face) {
        // face normals are in object space → bring to world space
        this._n.copy(h.face.normal).transformDirection(h.object.matrixWorld);
        if (this._n.y < 0.5) continue;
      }
      return h.point.y;
    }
    return null;
  }

  _blocked(px, pz, feet) {
    for (const c of this.colliders) {
      if (c.y1 <= feet + STEP || c.y0 >= feet + EYE + 0.6) continue;
      const qx = Math.max(c.x0, Math.min(px, c.x1)), qz = Math.max(c.z0, Math.min(pz, c.z1));
      const dx = px - qx, dz = pz - qz;
      if (dx * dx + dz * dz < RADIUS * RADIUS * 0.98) return true;
    }
    return false;
  }

  _resolve(px, pz, feet) {
    for (let it = 0; it < 4; it++) {
      let any = false;
      for (const c of this.colliders) {
        if (c.y1 <= feet + STEP || c.y0 >= feet + EYE + 0.6) continue;
        const qx = Math.max(c.x0, Math.min(px, c.x1)), qz = Math.max(c.z0, Math.min(pz, c.z1));
        const dx = px - qx, dz = pz - qz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= RADIUS * RADIUS) continue;
        any = true;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          px = qx + (dx / d) * RADIUS;
          pz = qz + (dz / d) * RADIUS;
        } else {
          const l = px - c.x0, r = c.x1 - px, b = pz - c.z0, t = c.z1 - pz;
          const m = Math.min(l, r, b, t);
          if (m === l) px = c.x0 - RADIUS; else if (m === r) px = c.x1 + RADIUS; else if (m === b) pz = c.z0 - RADIUS; else pz = c.z1 + RADIUS;
        }
      }
      if (!any) break;
    }
    return [px, pz];
  }

  _findFree(x, z, maxR) {
    const feet = this._floorAt(x, z, 30) ?? 2;
    if (!this._blocked(x, z, feet)) return [x, z];
    for (let r = 0.5; r <= maxR; r += 0.5) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        const f = this._floorAt(px, pz, 30) ?? feet;
        if (!this._blocked(px, pz, f)) return [px, pz];
      }
    }
    return [x, z];
  }

  update(dt) {
    if (!this.enabled) return false;
    // sub-step so walking speed and collisions stay correct at low frame rates
    dt = Math.min(dt, 0.25);
    const n = Math.max(1, Math.ceil(dt / 0.05));
    let changed = false;
    for (let i = 0; i < n; i++) changed = this._step(dt / n) || changed;
    return changed;
  }

  _step(dt) {
    const k = this.keys;
    let fwd = 0, side = 0, turn = 0;
    if (k.has('w') || k.has('arrowup')) fwd += 1;
    if (k.has('s') || k.has('arrowdown')) fwd -= 1;
    if (k.has('a')) side -= 1;
    if (k.has('d')) side += 1;
    if (k.has('arrowleft') || k.has('q')) turn += 1;
    if (k.has('arrowright') || k.has('e')) turn -= 1;
    fwd += -this.joy.y;
    side += this.joy.x;
    let changed = false;
    if (turn) {
      this.yaw += turn * dt * 1.8;
      changed = true;
    }
    const speed = SPEED * (k.has('shift') ? 1.9 : 1);
    let mx = 0, mz = 0;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    if (fwd || side) {
      mx = (-sy * fwd + cy * side) * speed * dt;
      mz = (-cy * fwd - sy * side) * speed * dt;
    } else if (this.target) {
      const dx = this.target.x - this.pos.x, dz = this.target.y - this.pos.y;
      const d = Math.hypot(dx, dz);
      if (d < 0.4) this.target = null;
      else {
        const s = Math.min(d, speed * dt);
        mx = (dx / d) * s; mz = (dz / d) * s;
        // turn gently towards the walking direction
        const want = Math.atan2(-dx, -dz);
        let diff = want - this.yaw;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        this.yaw += diff * Math.min(1, dt * 3);
      }
    }
    if (mx || mz) {
      const ox = this.pos.x, oz = this.pos.y;
      let [nx, nz] = this._resolve(ox + mx, oz + mz, this.feet);
      const floor = this._floorAt(nx, nz);
      if (floor === null || floor > this.feet + STEP || floor < this.feet - 3) {
        nx = ox; nz = oz; // ledge or wall: stay
      } else {
        this.feet = floor;
      }
      const moved = Math.hypot(nx - ox, nz - oz);
      if (this.target && moved < 0.01) {
        this.stuck += dt;
        if (this.stuck > 0.3) { this.target = null; this.stuck = 0; }
      } else this.stuck = 0;
      this.pos.set(nx, nz);
      changed = true;
    }
    const wantY = this.feet + EYE;
    const cam = this.camera.position;
    const ny = cam.y + (wantY - cam.y) * (1 - Math.exp(-dt * 10));
    if (Math.abs(ny - cam.y) > 1e-4 || changed) {
      cam.set(this.pos.x, ny, this.pos.y);
      this._apply();
      return true;
    }
    return false;
  }
}

/** On-screen joystick for touch devices. */
export function attachJoystick(el, walk) {
  const knob = el.querySelector('.joy-knob');
  let id = null, cx = 0, cy = 0;
  const R = 44;
  const set = (x, y) => {
    const d = Math.hypot(x, y);
    if (d > R) { x = (x / d) * R; y = (y / d) * R; }
    knob.style.transform = `translate(${x}px, ${y}px)`;
    walk.joy.set(x / R, y / R);
    walk.target = null;
  };
  el.addEventListener('pointerdown', (e) => {
    id = e.pointerId;
    const r = el.getBoundingClientRect();
    cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    el.setPointerCapture(e.pointerId);
    set(e.clientX - cx, e.clientY - cy);
    e.stopPropagation();
  });
  el.addEventListener('pointermove', (e) => { if (e.pointerId === id) set(e.clientX - cx, e.clientY - cy); });
  const end = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    knob.style.transform = '';
    walk.joy.set(0, 0);
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}
