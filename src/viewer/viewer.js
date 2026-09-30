import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { MaterialLibrary } from '../materials.js';
import { mergeInPlace } from '../geometry.js';
import { buildStructure } from '../build/structure.js';
import { buildOpenings } from '../build/openings.js';
import { buildExterior } from '../build/exterior.js';
import { buildFurniture } from '../build/furniture.js';
import { WalkController } from './walk.js';
import { Tweens } from './tween.js';
import { ROOMS, roomAnchor, roomBounds, findRoomAt } from '../plan.js';
import { LV, HOUSE_CENTER } from '../config.js';

// Where to stand when "walking into" each room: [x, z, lookAtX, lookAtZ, pitch]
export const WALK_SPOTS = {
  portico: [12.4, -1.6, 6.0, -12, -0.1],
  lobby: [18.6, -19.8, 17.2, -9.0, -0.12],
  living: [10.4, -20.2, 2.5, -27, -0.12],
  hall: [17.2, -29.3, 17.2, -46.5, 0.2],
  bed1: [8.8, -33.4, 2.5, -41, -0.14],
  bed2: [25.2, -29.6, 32, -35.5, -0.14],
  guest: [22.6, -11.2, 30, -17, -0.14],
  kitchen: [22.3, -39.3, 32.0, -44.2, 0.26],
  toilet1: [22.1, -24.9, 28, -23.4, -0.5],
  toilet2: [30.5, -22.0, 34, -24.4, -0.5],
  puja: [10.2, -44.9, 3.3, -46.0, -0.05],
  stair: [17.6, -6.9, 30, -6.9, 0.05],
};

// dir: camera direction from the target; rh / rv: half width / height (ft) that must fit on screen
const VIEWS = {
  exterior: { dir: [-0.6, 0.27, 0.75], target: [17.7, 14.5, -18], rh: 36, rv: 29, cut: Infinity, labels: false },
  dollhouse: { dir: [-0.42, 0.78, 0.47], target: [17.7, 1, -24.5], rh: 28, rv: 28, cut: 9.6, labels: true },
  plan: { dir: [0, 1, 0.0008], target: [17.7, 2, -24.1], rh: 20.5, rv: 27.5, cut: 6.4, labels: true },
};

export class App extends EventTarget {
  constructor(container) {
    super();
    this.container = container;
    this.mobile = matchMedia('(pointer: coarse)').matches || window.innerWidth < 760;
    this.view = 'exterior';
    this.selected = null;
    this.cut = Infinity;
    this.labelsOn = true;
    this.frames = 3;

    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false }));
    r.setPixelRatio(Math.min(window.devicePixelRatio, this.mobile ? 1.6 : 2));
    r.setSize(container.clientWidth, container.clientHeight);
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    r.shadowMap.autoUpdate = false; // static scene: re-render shadows only when the sun / cut changes
    r.localClippingEnabled = true;
    container.appendChild(r.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(container.clientWidth, container.clientHeight);
    const ld = this.labelRenderer.domElement;
    ld.className = 'label-layer';
    container.appendChild(ld);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, container.clientWidth / container.clientHeight, 0.15, 12000);
    this.camera.position.set(-30, 24, 46);

    this.controls = new OrbitControls(this.camera, r.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 260;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.autoRotateSpeed = 0.7;
    this.controls.target.set(17.7, 10, -20);
    this.controls.addEventListener('change', () => this.invalidate());
    this.controls.addEventListener('start', () => this.tweens.cancel('cam'));

    this.tweens = new Tweens();
    this.timer = new THREE.Timer();
    this.viewOffset = { x: 0, y: 0 };
    this.mats = new MaterialLibrary(r);

    this.house = new THREE.Group();
    this.house.name = 'house';
    this.site = new THREE.Group();
    this.site.name = 'site';
    this.scene.add(this.house, this.site);
    this.colliders = [];
    this.walkables = [];
    this.pickables = [];

    this._lights();
    window.addEventListener('resize', () => this.resize());
  }

  // -------------------------------------------------------------------------
  _lights() {
    const s = this.scene;
    this.sky = new Sky();
    this.sky.scale.setScalar(5000);
    const u = this.sky.material.uniforms;
    // the analytic sky is very bright; scale it to sit well with the tone-mapped scene
    this.sky.material.fragmentShader = this.sky.material.fragmentShader.replace('gl_FragColor = vec4( texColor, 1.0 );', 'gl_FragColor = vec4( texColor * 0.42, 1.0 );');
    u.turbidity.value = 1.6;
    u.rayleigh.value = 2.2;
    u.mieCoefficient.value = 0.0028;
    u.mieDirectionalG.value = 0.82;
    if (u.cloudCoverage) { u.cloudCoverage.value = 0.3; u.cloudDensity.value = 0.4; }
    s.add(this.sky);
    // distant haze hides the edge of the ground and blends it into the horizon
    s.fog = new THREE.Fog(0xcfdbe6, 260, 1500);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    s.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    s.environmentIntensity = 0.45;

    this.hemi = new THREE.HemisphereLight(0xdbe8ff, 0xb3a28a, 0.95);
    s.add(this.hemi);
    // warm "room light" that follows the visitor in walk mode (kept in the scene
    // at zero intensity otherwise, so toggling never recompiles shaders)
    this.roomLight = new THREE.PointLight(0xffe4c2, 0, 34, 1.1);
    s.add(this.roomLight);

    const sun = (this.sun = new THREE.DirectionalLight(0xfff0dc, 3.0));
    sun.castShadow = true;
    const S = this.mobile ? 2048 : 4096;
    sun.shadow.mapSize.set(S, S);
    const c = sun.shadow.camera;
    c.left = -48; c.right = 48; c.top = 48; c.bottom = -48; c.near = 1; c.far = 320;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.035;
    sun.shadow.radius = 2.5;
    sun.target.position.set(HOUSE_CENTER.x, 0, HOUSE_CENTER.z + 4);
    s.add(sun, sun.target);
    this.setSunHour(15.5);
  }

  /**
   * hour 6..19. As on site, the sun rises behind the house (the back / old-garden
   * side, −z, is east) and sets over the road (+z is west), so +x is south.
   */
  setSunHour(h) {
    this.sunHour = h;
    const t = THREE.MathUtils.clamp((h - 6) / 12, 0, 1);
    const az = THREE.MathUtils.degToRad(90 + t * 180); // compass bearing: 90 = east, 180 = south, 270 = west
    const alt = THREE.MathUtils.degToRad(8 + Math.sin(t * Math.PI) * 56);
    // north = −x, east = −z, south = +x, west = +z
    const dir = new THREE.Vector3(-Math.cos(alt) * Math.cos(az), Math.sin(alt), -Math.cos(alt) * Math.sin(az));
    this.sun.position.copy(this.sun.target.position).addScaledVector(dir, 150);
    this.sky.material.uniforms.sunPosition.value.copy(dir);
    const warm = 1 - Math.sin(t * Math.PI);
    this.sun.color.setHSL(0.09, 0.35 + warm * 0.5, 0.92 - warm * 0.15);
    this.sun.intensity = (1.6 + Math.sin(t * Math.PI) * 1.6) * (this.sunBoost || 1);
    this.renderer.shadowMap.needsUpdate = true;
    this.invalidate();
  }

  // -------------------------------------------------------------------------
  async build(progress = () => {}) {
    const ctx = { mats: this.mats, house: this.house, site: this.site, colliders: this.colliders, walkables: this.walkables, pickables: this.pickables };
    const step = async (label, fn) => {
      progress(label);
      await new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0)));
      fn();
    };
    const tm = performance.now();
    await this.mats.init(progress);
    console.info(`[home3d] textures ${Math.round(performance.now() - tm)} ms`);
    await step('Building walls & floors', () => buildStructure(ctx));
    await step('Fitting doors & windows', () => buildOpenings(ctx));
    await step('Adding facade, roof & street', () => buildExterior(ctx));
    await step('Placing furniture', () => { this.furniture = buildFurniture(ctx); });
    await step('Optimising', () => {
      const keep = (o) => this.walkables.includes(o) || this.pickables.includes(o) || o.userData.merged;
      mergeInPlace(this.furniture, keep);
      mergeInPlace(this.house, (o) => keep(o) || this.furniture.children.includes(o));
      mergeInPlace(this.site, keep);
    });
    await step('Lighting the scene', () => {
      this._labels();
      this._highlight = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0x2f9bff, transparent: true, opacity: 0.13, depthWrite: false }));
      this._highlight.renderOrder = 2;
      this._highlight.visible = false;
      this._outline = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x2f9bff, transparent: true, opacity: 0.95 }));
      this._highlight.add(this._outline);
      this._hover = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false }));
      this._hover.renderOrder = 2;
      this._hover.visible = false;
      this.scene.add(this._highlight, this._hover);
      this.walk = new WalkController({
        camera: this.camera, dom: this.renderer.domElement, colliders: this.colliders, walkables: this.walkables,
        onChange: () => this.invalidate(),
      });
      this._picking();
      this.renderer.compile(this.scene, this.camera);
    });
    this.setView('exterior', { instant: true });
    this.resize();
    this.renderer.setAnimationLoop(() => this._loop());
  }

  _labels() {
    this.labels = [];
    for (const room of ROOMS) {
      if (room.id === 'duct') continue; // too small to label; still in the list & minimap
      const a = roomAnchor(room);
      const div = document.createElement('button');
      div.className = 'room-label';
      div.type = 'button';
      div.innerHTML = `<span class="rl-name">${room.name}</span><span class="rl-size">${room.size}</span>`;
      div.addEventListener('click', (e) => { e.stopPropagation(); this.focusRoom(room.id); });
      div.addEventListener('pointerdown', (e) => e.stopPropagation());
      const obj = new CSS2DObject(div);
      obj.position.set(a.x, LV[room.level] + 1.5, a.z);
      obj.userData.room = room.id;
      this.scene.add(obj);
      this.labels.push(obj);
    }
  }

  _picking() {
    const dom = this.renderer.domElement;
    let sx = 0, sy = 0, down = false, last = 0, hoverId = null;
    dom.addEventListener('pointerdown', (e) => { down = true; sx = e.clientX; sy = e.clientY; });
    // hover feedback (mouse only): pointer cursor + faint fill over the room under the cursor
    dom.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || down || this.view === 'walk' || this.view === 'exterior') {
        if (hoverId !== null) { hoverId = null; this._hover.visible = false; dom.style.cursor = ''; this.invalidate(); }
        return;
      }
      const now = performance.now();
      if (now - last < 70) return;
      last = now;
      const room = this.pickRoom(e.clientX, e.clientY, true);
      const id = room ? room.id : null;
      if (id === hoverId) return;
      hoverId = id;
      dom.style.cursor = id ? 'pointer' : '';
      if (room && id !== this.selected) {
        this._hover.geometry.dispose();
        this._hover.geometry = this._roomFill(room, 0.05);
        this._hover.visible = true;
      } else this._hover.visible = false;
      this.invalidate();
    });
    dom.addEventListener('pointerup', (e) => {
      if (!down) return;
      down = false;
      if (this.view === 'walk' || Math.hypot(e.clientX - sx, e.clientY - sy) > 6) return;
      const room = this.pickRoom(e.clientX, e.clientY);
      if (room) this.focusRoom(room.id);
    });
  }

  /** Room under a screen point. fast=true only tests floors (used for hover). */
  pickRoom(cx, cy, fast = false) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    const rc = new THREE.Raycaster();
    rc.setFromCamera(ndc, this.camera);
    if (fast) {
      const h = rc.intersectObjects(this.pickables, false)[0];
      return h ? ROOMS.find((r) => r.id === h.object.userData.room) || null : null;
    }
    const hits = rc.intersectObject(this.house, true);
    for (const h of hits) {
      if (h.point.y > this.cut + 0.01) continue; // clipped away
      if (!h.object.visible || h.object.material?.transparent) continue;
      let o = h.object, hidden = false;
      while (o) { if (o.visible === false) hidden = true; o = o.parent; }
      if (hidden) continue;
      return findRoomAt(h.point.x, h.point.z);
    }
    return null;
  }

  // -------------------------------------------------------------------------
  invalidate(n = 2) {
    this.frames = Math.max(this.frames, n);
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.camera.aspect = w / h;
    // keep the model centred in the area not covered by the side panel / bottom sheet
    const panel = document.getElementById('panel');
    const narrow = w <= 760;
    this.viewOffset.x = !narrow && panel ? Math.round((panel.getBoundingClientRect().right + 8) / 2) : 0;
    this.viewOffset.y = narrow && panel ? Math.round(Math.min(panel.getBoundingClientRect().height, h * 0.4) / 2) : 0;
    if (this.viewOffset.x || this.viewOffset.y) this.camera.setViewOffset(w, h, -this.viewOffset.x, this.viewOffset.y, w, h);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
    this.invalidate();
  }

  _loop() {
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.1);
    let active = this.tweens.update(performance.now() / 1000);
    if (this.view === 'walk') {
      active = this.walk.update(dt) || active;
      this.roomLight.position.set(this.camera.position.x, Math.min(this.camera.position.y + 1.2, LV.gfCeil - 0.6), this.camera.position.z);
    } else if (this.controls.enabled) {
      active = this.controls.update(dt) || active;
    }
    if (active) this.invalidate();
    if (this.frames > 0) {
      this.frames--;
      this.renderer.render(this.scene, this.camera);
      this.labelRenderer.render(this.scene, this.camera);
      this.dispatchEvent(new Event('frame'));
    }
  }

  // -------------------------------------------------------------------------
  /** Camera distance so that a box of half-size rh × rv fits the visible (unobstructed) area. */
  _fitDistance(rh, rv = rh) {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    const vis = Math.max(1, h - 2 * this.viewOffset.y);
    const aspect = Math.max(0.3, (w - 2 * this.viewOffset.x) / vis);
    const tv = Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2) * (vis / h);
    const th = tv * aspect;
    return Math.max(rv / tv, rh / th) * 1.04;
  }

  flyTo(pos, target, duration = 1.1) {
    const c = this.camera, t = this.controls.target;
    if (duration <= 0) {
      c.position.set(...pos);
      t.set(...target);
      this.controls.update();
      this.invalidate();
      return;
    }
    this.tweens.add({
      key: 'cam',
      from: [c.position.x, c.position.y, c.position.z, t.x, t.y, t.z],
      to: [...pos, ...target],
      duration,
      onUpdate: (v) => {
        c.position.set(v[0], v[1], v[2]);
        t.set(v[3], v[4], v[5]);
        c.lookAt(t);
      },
    });
  }

  setCut(y, animate = true) {
    const from = Number.isFinite(this.cut) ? this.cut : LV.mumtyTop + 8;
    const to = Number.isFinite(y) ? y : LV.mumtyTop + 8;
    this.cut = y;
    const apply = (v) => {
      this.mats.setCut(v >= LV.mumtyTop + 7.9 ? Infinity : v, this.view !== 'walk');
      this.renderer.shadowMap.needsUpdate = true;
      this.invalidate();
    };
    if (!animate) { this.tweens.cancel('cut'); apply(to); }
    else this.tweens.add({ key: 'cut', from: [from], to: [to], duration: 0.8, onUpdate: ([v]) => apply(v), onComplete: () => apply(to) });
    this.dispatchEvent(new CustomEvent('cut', { detail: y }));
  }

  setLabels(on) {
    this.labelsOn = on;
    this._syncLabels();
  }

  _syncLabels() {
    const show = this.labelsOn && VIEWS[this.view]?.labels !== false && this.view !== 'walk' && this.view !== 'exterior';
    for (const l of this.labels) l.visible = show;
    this.invalidate();
  }

  setFurniture(on) {
    this.furniture.visible = on;
    for (const c of this.colliders) if (c.id === 'furniture' || c.id === 'counter') c.disabled = !on;
    this.walk.colliders = on ? this.colliders : this.colliders.filter((c) => !c.disabled);
    this.renderer.shadowMap.needsUpdate = true;
    this.invalidate();
  }

  setAutoRotate(on) {
    this.controls.autoRotate = on;
    this.invalidate();
  }

  setView(view, { instant = false, keepCut = false } = {}) {
    if (view === 'walk') return this.enterWalk(this.selected || 'lobby');
    if (this.view === 'walk') this._exitWalk();
    const v = VIEWS[view];
    this.view = view;
    const dir = new THREE.Vector3(...v.dir).normalize();
    const d = this._fitDistance(v.rh, v.rv);
    const target = new THREE.Vector3(...v.target);
    const pos = target.clone().addScaledVector(dir, d);
    this.controls.maxPolarAngle = view === 'exterior' ? Math.PI * 0.495 : Math.PI * 0.46;
    this.flyTo(pos.toArray(), target.toArray(), instant ? 0 : 1.2);
    if (!keepCut) this.setCut(v.cut, !instant);
    this._syncLabels();
    this.dispatchEvent(new CustomEvent('view', { detail: view }));
  }

  focusRoom(id, { fly = true } = {}) {
    const room = ROOMS.find((r) => r.id === id);
    if (!room) return;
    this.select(id);
    if (this.view === 'walk') {
      return this.enterWalk(id);
    }
    if (this.view === 'exterior') {
      this.view = 'dollhouse';
      this.setCut(VIEWS.dollhouse.cut);
      this._syncLabels();
      this.dispatchEvent(new CustomEvent('view', { detail: 'dollhouse' }));
    }
    if (!fly) return;
    const b = roomBounds(room);
    const a = roomAnchor(room);
    const floor = LV[room.level];
    const target = new THREE.Vector3(a.x, floor + 1.5, a.z);
    // keep the current compass direction, look down steeply into the room
    const cur = this.camera.position.clone().sub(this.controls.target);
    let az = Math.atan2(cur.x, cur.z);
    if (this.view === 'plan') az = 0;
    const polar = this.view === 'plan' ? 0.02 : 0.62;
    const size = Math.max(b.w, b.d);
    const dist = THREE.MathUtils.clamp(this._fitDistance(size * 0.62 + 5), 18, 75);
    const pos = new THREE.Vector3(
      target.x + dist * Math.sin(polar) * Math.sin(az),
      target.y + dist * Math.cos(polar),
      target.z + dist * Math.sin(polar) * Math.cos(az),
    );
    this.flyTo(pos.toArray(), target.toArray(), 1.1);
  }

  /** Orbit to a compass angle around the current target: front | back | left | right | top. */
  orbitAngle(name) {
    if (this.view === 'walk') this.setView('dollhouse', { instant: true });
    if (this.view === 'plan' && name !== 'top') {
      this.view = 'dollhouse';
      this.controls.maxPolarAngle = Math.PI * 0.46;
      this._syncLabels();
      this.dispatchEvent(new CustomEvent('view', { detail: 'dollhouse' }));
    }
    const ext = this.view === 'exterior';
    const az = { front: 0, right: Math.PI / 2, back: Math.PI, left: -Math.PI / 2 }[name];
    const polar = name === 'top' ? 0.001 : ext ? 1.3 : 0.9;
    const side = name === 'left' || name === 'right';
    let t, d;
    if (this.selected && !ext) {
      // keep circling the room that is in focus
      t = this.controls.target.clone();
      d = this.camera.position.distanceTo(t);
    } else {
      t = new THREE.Vector3(HOUSE_CENTER.x, ext ? 13 : 2, HOUSE_CENTER.z);
      const rh = name === 'top' ? 21 : side ? 27 : 20;
      const rv = name === 'top' ? 27.5 : ext ? 19 : 18;
      // add half the house depth along the view so the near facade also fits
      d = this._fitDistance(rh, rv) + (name === 'top' ? 0 : side ? 18 : 25) * Math.sin(polar);
    }
    const a = az ?? 0;
    const pos = [t.x + d * Math.sin(polar) * Math.sin(a), t.y + d * Math.cos(polar), t.z + d * Math.sin(polar) * Math.cos(a)];
    this.flyTo(pos, t.toArray(), 1.0);
  }

  select(id) {
    this.selected = id;
    const room = ROOMS.find((r) => r.id === id);
    if (!room) {
      this._highlight.visible = false;
      this.dispatchEvent(new CustomEvent('select', { detail: null }));
      this.invalidate();
      return;
    }
    this._highlight.geometry.dispose();
    this._highlight.geometry = this._roomFill(room, 0.06);
    const y = LV[room.level] + 0.09;
    const seg = [];
    for (const [x0, x1, z0, z1] of room.rects) {
      seg.push(x0, y, z0, x1, y, z0, x1, y, z0, x1, y, z1, x1, y, z1, x0, y, z1, x0, y, z1, x0, y, z0);
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
    this._outline.geometry.dispose();
    this._outline.geometry = lg;
    this._highlight.visible = true;
    this._hover.visible = false;
    for (const l of this.labels) l.element.classList.toggle('active', l.userData.room === id);
    this.dispatchEvent(new CustomEvent('select', { detail: room }));
    this.invalidate();
  }

  _roomFill(room, lift) {
    const y = LV[room.level] + lift;
    const pos = [];
    for (const [x0, x1, z0, z1] of room.rects) {
      pos.push(x0, y, z0, x0, y, z1, x1, y, z1, x0, y, z0, x1, y, z1, x1, y, z0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return g;
  }

  clearSelection() {
    this.selected = null;
    this._highlight.visible = false;
    for (const l of this.labels) l.element.classList.remove('active');
    this.dispatchEvent(new CustomEvent('select', { detail: null }));
    this.invalidate();
  }

  enterWalk(id = 'lobby') {
    const spot = WALK_SPOTS[id] || WALK_SPOTS.lobby;
    const prev = this.view;
    this.view = 'walk';
    this.controls.enabled = false;
    this.controls.autoRotate = false;
    this.tweens.cancel('cam');
    this.setCut(Infinity, false); // nothing sliced: the double-height space rises to the roof
    this._setFov(66);
    // indoors: less fill light and a stronger sun, so the patches of sunlight coming
    // through the windows (and the rear glass wall in the morning) read clearly
    this.hemi.intensity = 0.55;
    this.scene.environmentIntensity = 0.32;
    this.roomLight.intensity = 3.8;
    this.sunBoost = 2.3;
    this.setSunHour(this.sunHour);
    this._highlight.visible = false;
    this._syncLabels();
    const yaw = Math.atan2(-(spot[2] - spot[0]), -(spot[3] - spot[1]));
    const pitch = -(spot[4] ?? -0.1);
    // fly down smoothly from the current camera, then hand over to the walk controller
    const startPos = this.camera.position.clone();
    const startQ = this.camera.quaternion.clone();
    this.walk.enter(spot[0], spot[1], yaw, pitch);
    const endPos = this.camera.position.clone();
    const endQ = this.camera.quaternion.clone();
    this.walk.enabled = false;
    if (prev === 'walk') {
      this.walk.enabled = true;
    } else {
      this.camera.position.copy(startPos);
      this.camera.quaternion.copy(startQ);
      this.tweens.add({
        key: 'cam', from: [0], to: [1], duration: 1.2,
        onUpdate: ([k]) => {
          this.camera.position.lerpVectors(startPos, endPos, k);
          this.camera.quaternion.slerpQuaternions(startQ, endQ, k);
        },
        onComplete: () => { this.walk.enabled = true; this.invalidate(); },
      });
    }
    this.selected = id;
    this.dispatchEvent(new CustomEvent('view', { detail: 'walk' }));
    this.dispatchEvent(new CustomEvent('select', { detail: ROOMS.find((r) => r.id === id) }));
  }

  _setFov(f) {
    if (this.camera.fov === f) return;
    this.camera.fov = f;
    this.camera.updateProjectionMatrix();
  }

  _exitWalk() {
    this.walk.exit();
    this._setFov(42);
    this.controls.enabled = true;
    this.hemi.intensity = 0.95;
    this.scene.environmentIntensity = 0.45;
    this.roomLight.intensity = 0;
    this.sunBoost = 1;
    this.setSunHour(this.sunHour);
    // continue orbiting around a point in front of where we stood
    const dir = this.walk.lookDir();
    this.controls.target.copy(this.camera.position).addScaledVector(dir, 8);
  }

  /** Camera ground position + heading for the minimap. */
  heading() {
    const p = this.camera.position;
    let yaw;
    if (this.view === 'walk') yaw = this.walk.yaw;
    else {
      const d = this.controls.target.clone().sub(p);
      yaw = Math.atan2(-d.x, -d.z);
    }
    return { x: p.x, z: p.z, yaw, walk: this.view === 'walk', target: this.controls.target };
  }

  currentRoom() {
    const p = this.view === 'walk' ? this.camera.position : this.controls.target;
    return findRoomAt(p.x, p.z);
  }

  screenshot() {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }
}
