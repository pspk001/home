// ---------------------------------------------------------------------------
// Procedural, seamlessly-tiling textures drawn on <canvas>.
// No image files are needed, so the viewer works fully offline.
// Every generator returns { map, bump? } canvases; `size` (feet) tells the
// material how much real-world area one texture repeat covers.
// ---------------------------------------------------------------------------

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Periodic value noise: n(x, y, periodX, periodY) → 0..1 */
function makeNoise(seed) {
  const r = rng(seed);
  const p = new Uint16Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  const perm = new Uint16Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const val = new Float32Array(256);
  for (let i = 0; i < 256; i++) val[i] = r();
  const h = (a, b) => val[perm[perm[a & 255] + (b & 255)]];
  return (x, y, px, py) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const x0 = ((xi % px) + px) % px, x1 = (x0 + 1) % px;
    const y0 = ((yi % py) + py) % py, y1 = (y0 + 1) % py;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = h(x0, y0), b = h(x1, y0), c = h(x0, y1), d = h(x1, y1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

function fbm(n, x, y, px, py, oct = 4) {
  let s = 0, amp = 0.5, f = 1, norm = 0;
  for (let o = 0; o < oct; o++) {
    s += amp * n(x * f, y * f, px * f, py * f);
    norm += amp; amp *= 0.5; f *= 2;
  }
  return s / norm;
}

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

/** Runs a per-pixel shader. fn(x, y) → [r,g,b] or [r,g,b,bump] */
function paint(N, M, fn, withBump = false) {
  const c = canvas(N, M), ctx = c.getContext('2d');
  const img = ctx.createImageData(N, M);
  let bctx, bimg;
  const b = withBump ? canvas(N, M) : null;
  if (b) { bctx = b.getContext('2d'); bimg = bctx.createImageData(N, M); }
  const d = img.data;
  for (let y = 0; y < M; y++) {
    for (let x = 0; x < N; x++) {
      const o = (y * N + x) * 4;
      const col = fn(x, y);
      d[o] = clamp(col[0]); d[o + 1] = clamp(col[1]); d[o + 2] = clamp(col[2]); d[o + 3] = 255;
      if (b) {
        const v = clamp((col[3] ?? 1) * 255);
        bimg.data[o] = bimg.data[o + 1] = bimg.data[o + 2] = v; bimg.data[o + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  if (b) bctx.putImageData(bimg, 0, 0);
  return { map: c, bump: b };
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** Square floor/wall tiles with grout; optional marble veining. */
export function tiles({ N = 1024, n = 2, nY = n, grout = 3, base = [230, 222, 205], vary = 0.05,
  noiseAmp = 0.06, veins = 0, veinColor = [150, 140, 125], groutColor = [175, 168, 155], speck = 0, seed = 1 } = {}) {
  const noise = makeNoise(seed);
  const r = rng(seed + 7);
  const tv = [];
  for (let i = 0; i < n * nY; i++) tv.push([(r() - 0.5) * 2 * vary, r() * 10, r() * 6.28]);
  const tw = N / n, th = N / nY;
  const M = N;
  return paint(N, M, (x, y) => {
    const tx = Math.floor(x / tw), ty = Math.floor(y / th);
    const lx = x - tx * tw, ly = y - ty * th;
    const edge = Math.min(lx, ly, tw - 1 - lx, th - 1 - ly);
    const [dv, off, ang] = tv[(ty % nY) * n + (tx % n)];
    if (edge < grout) {
      const gn = fbm(noise, x / N * 64, y / N * 64, 64, 64, 2);
      return [groutColor[0] * (0.92 + gn * 0.16), groutColor[1] * (0.92 + gn * 0.16), groutColor[2] * (0.92 + gn * 0.16), 0.15];
    }
    const nx = x / N, ny = y / M;
    let k = 1 + dv + (fbm(noise, nx * 8 + off, ny * 8, 8, 8, 4) - 0.5) * noiseAmp * 2;
    let col = [base[0] * k, base[1] * k, base[2] * k];
    if (veins > 0) {
      const w = fbm(noise, nx * 4 + off * 0.3, ny * 4, 4, 4, 5);
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const t = (lx * ca + ly * sa) / tw;
      const v = Math.abs(Math.sin((t * 2.2 + w * 3.5 + off) * Math.PI));
      const vein = Math.pow(1 - v, 18) * veins + Math.pow(1 - v, 5) * veins * 0.25;
      col = col.map((c, i) => c * (1 - vein) + veinColor[i] * vein);
    }
    if (speck > 0) {
      const s = noise(x * 0.9 + off * 50, y * 0.9, 1e6, 1e6);
      if (s > 1 - speck) col = col.map((c) => c * 0.75);
    }
    const bevel = edge < grout + 2 ? 0.8 : 1;
    return [col[0], col[1], col[2], bevel];
  }, true);
}

/** Wooden planks (floors, cladding, furniture). Planks run along x. */
export function planks({ N = 1024, rows = 8, minLen = 0.35, maxLen = 0.9, gap = 2, colors = [[150, 104, 64], [120, 82, 50]],
  gapColor = [60, 40, 25], grain = 1, seed = 3, bevel = true, joints = true } = {}) {
  const noise = makeNoise(seed);
  const r = rng(seed + 11);
  const rowH = N / rows;
  // plank layout per row: list of [start, end, colorMix, seedOffset]
  const layout = [];
  for (let i = 0; i < rows; i++) {
    const row = [];
    const start = -r() * maxLen * N;
    let x = start;
    while (x < start + N) {
      const len = (minLen + r() * (maxLen - minLen)) * N;
      row.push([x, x + len, r(), r() * 100]);
      x += len;
    }
    // wrap seamlessly: the last plank ends exactly one texture-width after the first starts
    row[row.length - 1][1] = start + N;
    // avoid tiny offcuts: fold a short last plank into its neighbour
    if (row.length > 1 && row[row.length - 1][1] - row[row.length - 1][0] < minLen * N * 0.45) {
      row.pop();
      row[row.length - 1][1] = start + N;
    }
    layout.push({ start, row });
  }
  return paint(N, N, (x, y) => {
    const ri = Math.min(rows - 1, Math.floor(y / rowH));
    const ly = y - ri * rowH;
    const { start, row } = layout[ri];
    const xx = x < start + N ? x : x - N;
    let pl = row[0];
    for (const p of row) {
      if (xx >= p[0] && xx < p[1]) { pl = p; break; }
    }
    const lx = xx - pl[0];
    const plen = pl[1] - pl[0];
    const edge = joints ? Math.min(ly, rowH - 1 - ly, lx, plen - 1 - lx) : Math.min(ly, rowH - 1 - ly);
    if (edge < gap) return [gapColor[0], gapColor[1], gapColor[2], 0.05];
    const c0 = colors[0], c1 = colors[1];
    const m = pl[2];
    let base = [c0[0] * (1 - m) + c1[0] * m, c0[1] * (1 - m) + c1[1] * m, c0[2] * (1 - m) + c1[2] * m];
    const nx = x / N, ny = y / N;
    // long streaky grain + ring figure
    const streak = fbm(noise, nx * 3 + pl[3], ny * rows * 6, 3, rows * 6, 4);
    const ring = Math.sin((ny * rows * 14 + fbm(noise, nx * 6 + pl[3], ny * rows * 2, 6, rows * 2, 3) * 9) * Math.PI);
    let k = 0.86 + streak * 0.28 * grain + ring * 0.05 * grain;
    const bev = bevel && edge < gap + 2 ? 0.85 : 1;
    if (bevel && edge < gap + 2) k *= 0.92;
    return [base[0] * k, base[1] * k, base[2] * k, bev];
  }, true);
}

/** Generic noisy surface (plaster, concrete, asphalt) — grey scale when tint is omitted. */
export function noiseSurface({ N = 512, base = [235, 235, 235], amp = 0.08, scale = 6, oct = 5, speck = 0, speckColor = [255, 255, 255], speckDark = 0, seed = 5 } = {}) {
  const noise = makeNoise(seed);
  const n2 = makeNoise(seed + 99);
  return paint(N, N, (x, y) => {
    const v = fbm(noise, x / N * scale, y / N * scale, scale, scale, oct);
    let k = 1 + (v - 0.5) * amp * 2;
    let col = [base[0] * k, base[1] * k, base[2] * k];
    if (speck > 0 || speckDark > 0) {
      const s = n2(x * 0.7, y * 0.7, N * 0.7, N * 0.7);
      if (s > 1 - speck) col = speckColor.slice();
      else if (s < speckDark) col = col.map((c) => c * 0.55);
    }
    return [col[0], col[1], col[2], 0.5 + (v - 0.5) * 0.8];
  }, true);
}

/** Lawn grass. */
export function grass({ N = 512, seed = 21, base = [88, 128, 52] } = {}) {
  const { map } = noiseSurface({ N, base, amp: 0.16, scale: 8, oct: 5, seed });
  const ctx = map.getContext('2d');
  const r = rng(seed);
  for (let i = 0; i < 9000; i++) {
    const x = r() * N, y = r() * N;
    const l = 3 + r() * 7, a = -Math.PI / 2 + (r() - 0.5) * 1.2;
    const g = 90 + r() * 90;
    ctx.strokeStyle = `rgba(${40 + r() * 50},${g},${25 + r() * 30},${0.35 + r() * 0.4})`;
    ctx.lineWidth = 0.8 + r() * 1.2;
    for (const dx of [0, -N, N]) for (const dy of [0, -N, N]) {
      if (x + dx < -12 || x + dx > N + 12 || y + dy < -12 || y + dy > N + 12) continue;
      ctx.beginPath();
      ctx.moveTo(x + dx, y + dy);
      ctx.lineTo(x + dx + Math.cos(a) * l, y + dy + Math.sin(a) * l);
      ctx.stroke();
    }
  }
  return { map };
}

/** Rectangular pavers / stone blocks in running bond. */
export function pavers({ N = 512, cols = 4, rows = 8, gap = 3, colors = [[150, 150, 145], [128, 128, 124], [165, 160, 150]],
  gapColor = [70, 70, 68], seed = 31, rough = 0.12 } = {}) {
  const noise = makeNoise(seed);
  const r = rng(seed);
  const cw = N / cols, rh = N / rows;
  const tints = [];
  for (let i = 0; i < cols * rows * 2; i++) tints.push([Math.floor(r() * colors.length), (r() - 0.5) * 0.12]);
  return paint(N, N, (x, y) => {
    const ry = Math.floor(y / rh);
    const off = (ry % 2) * cw * 0.5;
    const xx = (x + off) % N;
    const cx = Math.floor(xx / cw);
    const lx = xx - cx * cw, ly = y - ry * rh;
    const edge = Math.min(lx, ly, cw - 1 - lx, rh - 1 - ly);
    if (edge < gap) return [gapColor[0], gapColor[1], gapColor[2], 0.1];
    const [ci, dv] = tints[ry * cols + cx];
    const c = colors[ci];
    const v = fbm(noise, x / N * 16, y / N * 16, 16, 16, 4);
    const k = 1 + dv + (v - 0.5) * rough * 2;
    return [c[0] * k, c[1] * k, c[2] * k, edge < gap + 2 ? 0.7 : 0.9 + v * 0.1];
  }, true);
}

/** Speckled granite. */
export function granite({ N = 512, base = [30, 30, 32], specks = [[[200, 170, 110], 0.02], [[235, 235, 235], 0.012], [[90, 90, 95], 0.08]], seed = 41 } = {}) {
  const noise = makeNoise(seed);
  const r = rng(seed);
  const pts = [];
  for (const [col, dens] of specks) {
    const count = Math.floor(N * N * dens / 6);
    for (let i = 0; i < count; i++) pts.push([r() * N, r() * N, 0.6 + r() * 1.8, col]);
  }
  const { map } = paint(N, N, (x, y) => {
    const v = fbm(noise, x / N * 10, y / N * 10, 10, 10, 4);
    const k = 0.85 + v * 0.3;
    return [base[0] * k, base[1] * k, base[2] * k];
  });
  const ctx = map.getContext('2d');
  for (const [x, y, s, c] of pts) {
    ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
    for (const dx of [0, -N, N]) for (const dy of [0, -N, N]) {
      const px = x + dx, py = y + dy;
      if (px < -4 || px > N + 4 || py < -4 || py > N + 4) continue;
      ctx.beginPath(); ctx.arc(px, py, s, 0, Math.PI * 2); ctx.fill();
    }
  }
  return { map };
}

/** Horizontal boards with shadow lines (siding / cladding). */
export function boards({ N = 512, count = 16, base = [60, 62, 66], shade = 0.55, seed = 51, grain = 0.12 } = {}) {
  const noise = makeNoise(seed);
  const r = rng(seed);
  const tints = Array.from({ length: count }, () => (r() - 0.5) * 0.1);
  const bh = N / count;
  return paint(N, N, (x, y) => {
    const bi = Math.floor(y / bh);
    const ly = y - bi * bh;
    const v = fbm(noise, x / N * 4, y / N * count * 3, 4, count * 3, 4);
    let k = 1 + tints[bi] + (v - 0.5) * grain * 2;
    let bump = 1;
    if (ly < bh * 0.09) { k *= shade; bump = 0.05; }
    else if (ly < bh * 0.18) { k *= 0.85; bump = 0.6; }
    return [base[0] * k, base[1] * k, base[2] * k, bump];
  }, true);
}

/** Stone wall with horizontal dark bands (neighbour compound walls in the elevation). */
export function bandedWall({ N = 512, base = [176, 176, 178], band = [96, 60, 58], bands = 8, seed = 61 } = {}) {
  const noise = makeNoise(seed);
  const bh = N / bands;
  return paint(N, N, (x, y) => {
    const ly = y % bh;
    const v = fbm(noise, x / N * 12, y / N * 12, 12, 12, 4);
    const k = 0.9 + v * 0.2;
    if (ly < bh * 0.28) return [band[0] * k, band[1] * k, band[2] * k, 0.4];
    return [base[0] * k, base[1] * k, base[2] * k, 0.9];
  }, true);
}

/** Woven fabric. */
export function fabric({ N = 256, base = [150, 150, 150], seed = 71, weave = 0.08 } = {}) {
  const noise = makeNoise(seed);
  return paint(N, N, (x, y) => {
    const v = fbm(noise, x / N * 8, y / N * 8, 8, 8, 3);
    const w = (Math.sin(x * Math.PI / 2) * Math.sin(y * Math.PI / 2)) * weave;
    const k = 0.92 + (v - 0.5) * 0.18 + w;
    return [base[0] * k, base[1] * k, base[2] * k, 0.5 + w * 2];
  }, true);
}

/** Random-bond sandstone blocks for the plinth band. */
export function stoneBlocks({ N = 512, seed = 81 } = {}) {
  const noise = makeNoise(seed);
  const r = rng(seed);
  const rows = 4, rh = N / rows;
  const layout = [];
  for (let i = 0; i < rows; i++) {
    const row = []; let x = 0;
    while (x < N) { const w = N * (0.12 + r() * 0.2); row.push([x, Math.min(N, x + w), r()]); x += w; }
    row[row.length - 1][1] = N;
    layout.push(row);
  }
  return paint(N, N, (x, y) => {
    const ri = Math.floor(y / rh);
    const ly = y - ri * rh;
    const row = layout[ri];
    let b = row[0];
    for (const p of row) if (x >= p[0] && x < p[1]) { b = p; break; }
    const edge = Math.min(ly, rh - 1 - ly, x - b[0], b[1] - 1 - x);
    if (edge < 3) return [95, 88, 78, 0.05];
    const v = fbm(noise, x / N * 14, y / N * 14, 14, 14, 5);
    const t = b[2];
    const base = [150 + t * 40, 132 + t * 30, 108 + t * 20];
    const k = 0.82 + v * 0.36;
    return [base[0] * k, base[1] * k, base[2] * k, 0.35 + v * 0.65];
  }, true);
}

/** Patterned area rug (not tiling). */
export function rug({ W = 512, H = 768, field = [120, 44, 42], border = [214, 184, 120], accent = [36, 52, 84], seed = 91 } = {}) {
  const noise = makeNoise(seed);
  return paint(W, H, (x, y) => {
    const u = x / W, v = y / H;
    const e = Math.min(u, v * H / W, 1 - u, (1 - v) * H / W);
    const n = fbm(noise, u * 40, v * 60, 40, 60, 2);
    let c;
    if (e < 0.035) c = accent;
    else if (e < 0.09) c = ((Math.floor(u * 40) + Math.floor(v * 60)) % 2) ? border : [border[0] * 0.8, border[1] * 0.75, border[2] * 0.7];
    else if (e < 0.105) c = accent;
    else {
      const cx = (u - 0.5) * 2, cy = (v - 0.5) * 2 * H / W;
      const d = Math.abs(cx) + Math.abs(cy) * 0.75;
      const ring = Math.sin(d * 18);
      if (d < 0.22) c = border;
      else if (ring > 0.82) c = border;
      else if (ring < -0.9) c = accent;
      else c = field;
    }
    const k = 0.88 + n * 0.24;
    return [c[0] * k, c[1] * k, c[2] * k, 0.6 + n * 0.4];
  }, true);
}

/** Small glossy ceramic wall tiles (kitchen dado / bathroom). */
export function wallTiles({ N = 512, n = 4, nY = 8, base = [236, 238, 240], groutColor = [200, 200, 204], veins = 0.25, seed = 101 } = {}) {
  return tiles({ N, n, nY, grout: 2, base, vary: 0.02, noiseAmp: 0.03, veins, veinColor: [180, 186, 192], groutColor, seed });
}

/** Dark gate / grille metal with brushed streaks. */
export function brushed({ N = 256, base = [120, 124, 128], seed = 111 } = {}) {
  const noise = makeNoise(seed);
  return paint(N, N, (x, y) => {
    const v = fbm(noise, x / N * 2, y / N * 64, 2, 64, 3);
    const k = 0.9 + v * 0.2;
    return [base[0] * k, base[1] * k, base[2] * k];
  });
}

/** Leaf clusters for trees (alpha-less, used as colour variation). */
export function foliage({ N = 256, base = [70, 118, 48], seed = 121 } = {}) {
  const noise = makeNoise(seed);
  return paint(N, N, (x, y) => {
    const v = fbm(noise, x / N * 12, y / N * 12, 12, 12, 4);
    const k = 0.7 + v * 0.6;
    return [base[0] * k, base[1] * k * 1.02, base[2] * k];
  });
}

/** Canvas with a text label (e.g. the house name plate). */
export function textPlate({ W = 512, H = 128, text = '', bg = '#1c1c1c', fg = '#d9b77c', font = 'bold 64px Georgia, serif' } = {}) {
  const c = canvas(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = fg; ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, W / 2, H / 2 + 4);
  return { map: c };
}

/** Decorative wall art (abstract painting). */
export function painting({ W = 384, H = 256, seed = 131, palette = [[222, 120, 70], [40, 70, 110], [230, 200, 140], [120, 150, 120]] } = {}) {
  const c = canvas(W, H), ctx = c.getContext('2d');
  const r = rng(seed);
  ctx.fillStyle = '#f2ece2'; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 14; i++) {
    const p = palette[Math.floor(r() * palette.length)];
    ctx.fillStyle = `rgba(${p[0]},${p[1]},${p[2]},${0.55 + r() * 0.4})`;
    ctx.beginPath();
    ctx.arc(r() * W, r() * H, 18 + r() * 70, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(30,30,30,0.5)'; ctx.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath(); ctx.moveTo(r() * W, r() * H);
    ctx.bezierCurveTo(r() * W, r() * H, r() * W, r() * H, r() * W, r() * H); ctx.stroke();
  }
  return { map: c };
}
