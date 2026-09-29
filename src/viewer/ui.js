import { ROOMS, WALLS, roomArea, roomAnchor } from '../plan.js';
import { LV } from '../config.js';
import { attachJoystick } from './walk.js';

const FINISH = {
  tileMarble: 'Marble-look vitrified tiles, 2′×2′',
  tileWarm: 'Beige vitrified tiles, 2′×2′',
  wood: 'Oak laminate flooring',
  woodLight: 'Light oak laminate flooring',
  tileKitchen: 'Matt grey ceramic tiles',
  tileBath: 'Anti-skid ceramic tiles, 1′×1′',
  marble: 'White marble',
  grass: 'Lawn',
  graniteGrey: 'Grey granite treads',
  concrete: 'Concrete',
  pavers: 'Stone pavers',
};

const $ = (s, el = document) => el.querySelector(s);

export function initUI(app) {
  const panel = $('#panel');
  const segButtons = [...document.querySelectorAll('.seg [data-view]')];
  const roomList = $('#room-list');
  const cut = $('#cut');
  const cutVal = $('#cut-val');
  const sun = $('#sun');
  const sunVal = $('#sun-val');
  const info = $('#info-card');
  const hud = $('#walk-hud');

  // ---- view buttons -------------------------------------------------------
  for (const b of segButtons) b.addEventListener('click', () => app.setView(b.dataset.view));
  app.addEventListener('view', (e) => {
    const v = e.detail;
    for (const b of segButtons) b.setAttribute('aria-pressed', String(b.dataset.view === v));
    document.body.dataset.view = v;
    hud.hidden = v !== 'walk';
    cut.disabled = v === 'walk';
  });

  // ---- rooms ---------------------------------------------------------------
  for (const room of ROOMS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'room-item';
    b.dataset.room = room.id;
    b.innerHTML = `<span class="ri-dot ri-${room.floor}"></span><span class="ri-name">${room.name}</span><span class="ri-size">${room.size.split(' +')[0]}</span>`;
    b.addEventListener('click', () => app.focusRoom(room.id));
    roomList.appendChild(b);
  }
  app.addEventListener('select', (e) => {
    const room = e.detail;
    for (const b of roomList.children) b.setAttribute('aria-current', String(room && b.dataset.room === room.id));
    if (!room) { info.hidden = true; return; }
    if (app.view === 'walk') $('#walk-room').textContent = room.name;
    $('#ic-name').textContent = room.name;
    $('#ic-size').textContent = room.size;
    $('#ic-area').textContent = `${Math.round(roomArea(room))} sq ft`;
    $('#ic-floor').textContent = FINISH[room.floor] || '';
    $('#ic-note').textContent = room.note || '';
    $('#ic-walk').hidden = room.id === 'duct';
    info.hidden = false;
    const active = roomList.querySelector(`[data-room="${room.id}"]`);
    active?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  });
  $('#ic-walk').addEventListener('click', () => app.enterWalk(app.selected));
  $('#ic-close').addEventListener('click', () => app.clearSelection());

  // ---- cut slider (feet above ground-floor level; max = no cut) --------------
  const CUT_MAX = Number(cut.max);
  const fmtFt = (f) => {
    const ft = Math.floor(f + 1e-6), inch = Math.round((f - ft) * 12);
    return inch === 12 ? `${ft + 1}′` : inch ? `${ft}′ ${inch}″` : `${ft}′`;
  };
  const showCut = (y) => {
    if (!Number.isFinite(y)) { cutVal.textContent = 'Full house'; cut.value = String(CUT_MAX); return; }
    const rel = y - LV.gf;
    cut.value = String(Math.min(CUT_MAX - 0.5, rel));
    cutVal.textContent = rel > LV.gfCeil - LV.gf + 0.4 ? `${fmtFt(rel)} (upper floor)` : `${fmtFt(rel)} above floor`;
  };
  cut.addEventListener('input', () => {
    const v = Number(cut.value);
    app.setCut(v >= CUT_MAX - 0.01 ? Infinity : LV.gf + v, false);
  });
  app.addEventListener('cut', (e) => showCut(e.detail));

  // ---- sun -------------------------------------------------------------------
  const showSun = (h) => {
    const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
    const ampm = hh >= 12 ? 'PM' : 'AM';
    sunVal.textContent = `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${ampm}`;
  };
  sun.addEventListener('input', () => { app.setSunHour(Number(sun.value)); showSun(Number(sun.value)); });
  showSun(app.sunHour);
  sun.value = String(app.sunHour);

  // ---- quick camera angles ----------------------------------------------------------
  for (const b of document.querySelectorAll('[data-angle]')) b.addEventListener('click', () => app.orbitAngle(b.dataset.angle));

  // ---- toggles -----------------------------------------------------------------
  $('#t-labels').addEventListener('change', (e) => app.setLabels(e.target.checked));
  $('#t-furniture').addEventListener('change', (e) => app.setFurniture(e.target.checked));
  $('#t-rotate').addEventListener('change', (e) => app.setAutoRotate(e.target.checked));

  // ---- walk HUD --------------------------------------------------------------------
  $('#walk-exit').addEventListener('click', () => app.setView('dollhouse'));
  attachJoystick($('#joystick'), app.walk);

  // ---- panel collapse (mobile bottom sheet) -------------------------------------------
  $('#panel-toggle').addEventListener('click', () => {
    const open = panel.classList.toggle('expanded');
    $('#panel-toggle').setAttribute('aria-expanded', String(open));
  });

  // ---- save the current view as a PNG ------------------------------------------------
  $('#shot-btn').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = app.screenshot();
    a.download = `surbhi-bhawan-${app.view}${app.selected ? '-' + app.selected : ''}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  });

  // ---- help -----------------------------------------------------------------------
  const help = $('#help');
  $('#help-btn').addEventListener('click', () => { help.hidden = !help.hidden; });
  $('#help-close').addEventListener('click', () => { help.hidden = true; });

  // ---- keyboard shortcuts -------------------------------------------------------------
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey) return;
    const k = e.key.toLowerCase();
    if (app.view === 'walk' && ['w', 'a', 's', 'd', 'q', 'e'].includes(k)) return;
    if (k === '1') app.setView('exterior');
    else if (k === '2') app.setView('dollhouse');
    else if (k === '3') app.setView('plan');
    else if (k === '4') app.setView('walk');
    else if (k === 'l') { const t = $('#t-labels'); t.checked = !t.checked; app.setLabels(t.checked); }
    else if (k === 'f') { const t = $('#t-furniture'); t.checked = !t.checked; app.setFurniture(t.checked); }
    else if (k === 'r') { const t = $('#t-rotate'); t.checked = !t.checked; app.setAutoRotate(t.checked); }
    else if (k === 'escape') {
      if (!help.hidden) help.hidden = true;
      else if (app.view === 'walk') app.setView('dollhouse');
      else app.clearSelection();
    }
  });

  buildMinimap(app);
}

// ---------------------------------------------------------------------------
// Minimap: the floor plan as SVG, with the camera marker. Click a room to go there.
// ---------------------------------------------------------------------------
function buildMinimap(app) {
  const host = $('#minimap');
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '-1.5 -50.5 38.5 53');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Floor plan minimap');
  const el = (tag, attrs, parent = svg) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    parent.appendChild(e);
    return e;
  };
  // plot outline
  el('polygon', { points: '0,-48.748 35.417,-47.164 35.417,1 0,1', class: 'mm-plot' });
  const roomEls = {};
  for (const room of ROOMS) {
    const g = el('g', { class: `mm-room mm-${room.floor}`, 'data-room': room.id, tabindex: '-1' });
    for (const [x0, x1, z0, z1] of room.rects) el('rect', { x: x0, y: z0, width: x1 - x0, height: z1 - z0 }, g);
    const title = el('title', {}, g);
    title.textContent = room.name;
    g.addEventListener('click', () => app.focusRoom(room.id));
    roomEls[room.id] = g;
  }
  for (const w of WALLS) {
    el('rect', { x: w.x[0], y: w.z[0], width: w.x[1] - w.x[0], height: w.z[1] - w.z[0], class: 'mm-wall' });
  }
  el('polygon', { points: '0,-48.748 35.417,-47.164 35.417,-46.37 0,-47.96', class: 'mm-wall' });
  for (const room of ROOMS) {
    if (room.id === 'duct') continue;
    const a = roomAnchor(room);
    const t = el('text', { x: a.x, y: a.z + 0.6, class: 'mm-label' });
    t.textContent = shortName(room);
  }
  const marker = el('g', { class: 'mm-marker' });
  el('path', { d: 'M0 0 L-3.2 -7 A7.6 7.6 0 0 1 3.2 -7 Z', class: 'mm-cone' }, marker);
  el('circle', { cx: 0, cy: 0, r: 1.1, class: 'mm-dot' }, marker);
  host.appendChild(svg);

  app.addEventListener('select', (e) => {
    for (const [id, g] of Object.entries(roomEls)) g.classList.toggle('active', e.detail?.id === id);
  });
  let last = '';
  app.addEventListener('frame', () => {
    const h = app.heading();
    const x = Math.max(-1, Math.min(36.5, h.walk ? h.x : h.target.x));
    const z = Math.max(-50, Math.min(2, h.walk ? h.z : h.target.z));
    const deg = (-h.yaw * 180) / Math.PI;
    const s = `translate(${x.toFixed(2)} ${z.toFixed(2)}) rotate(${deg.toFixed(1)})`;
    if (s !== last) { marker.setAttribute('transform', s); last = s; }
    if (h.walk && app.walk.enabled) {
      const r = app.currentRoom();
      const name = r ? r.name : 'Outside';
      const hr = document.getElementById('walk-room');
      if (hr.textContent !== name) hr.textContent = name;
    }
  });
}

function shortName(room) {
  return {
    portico: 'Portico', lobby: 'Lobby', living: 'Living', hall: 'Dining', bed1: 'Bed 1', bed2: 'Bed 2',
    guest: 'Guest', kitchen: 'Kitchen', toilet1: 'WC', toilet2: 'WC', puja: 'Puja', stair: 'Stair',
  }[room.id] || room.name;
}
