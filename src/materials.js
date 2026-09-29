import * as THREE from 'three';
import * as TX from './textures.js';
import { COLORS } from './config.js';

// Colour used for the "cut" faces when walls are sliced by the section plane
const CAP_COLOR = 'vec3(0.20, 0.19, 0.19)';

/**
 * All materials used by the model. House materials are clipped by one shared
 * horizontal section plane (the "wall cut" slider) and render their inside
 * faces as a solid dark cap, so sliced walls look solid instead of hollow.
 */
export class MaterialLibrary {
  constructor(renderer) {
    this.maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    this.cutPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1000);
    // shared uniform: 1 = paint inside faces as a solid section cap (when walls are sliced)
    this.capUniform = { value: 1 };
    this.clipped = [];
    this.mats = new Map();
    this.textures = [];
  }

  /** Generates every texture/material, yielding to the browser between groups so the loader can update. */
  async init(progress = () => {}) {
    await this._build(async (msg) => {
      progress(msg);
      await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
    });
  }

  get(key) {
    const m = this.mats.get(key);
    if (!m) {
      console.warn('[materials] missing', key);
      return this.mats.get('reveal');
    }
    return m;
  }

  /** Move the section plane (world y). Infinity = no cut. */
  setCut(y, cap = true) {
    this.cutPlane.constant = Number.isFinite(y) ? y : 1e5;
    this.capUniform.value = Number.isFinite(y) && cap ? 1 : 0;
  }

  // -------------------------------------------------------------------------
  _tex(canvas, sizeFt, srgb = true) {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = this.maxAniso;
    if (sizeFt) t.repeat.set(1 / (Array.isArray(sizeFt) ? sizeFt[0] : sizeFt), 1 / (Array.isArray(sizeFt) ? sizeFt[1] : sizeFt));
    this.textures.push(t);
    return t;
  }

  _texPair(gen, sizeFt) {
    return { map: this._tex(gen.map, sizeFt), bump: gen.bump ? this._tex(gen.bump, sizeFt, false) : null };
  }

  _add(key, mat, { clip = true, cap = true } = {}) {
    mat.name = key;
    if (clip) {
      mat.clippingPlanes = [this.cutPlane];
      mat.clipShadows = true;
      if (cap && !mat.transparent) {
        mat.side = THREE.DoubleSide;
        mat.onBeforeCompile = (shader) => {
          shader.uniforms.capOn = this.capUniform;
          shader.fragmentShader = 'uniform float capOn;\n' + shader.fragmentShader.replace(
            '#include <dithering_fragment>',
            `#include <dithering_fragment>\n  if (!gl_FrontFacing && capOn > 0.5) gl_FragColor = vec4(${CAP_COLOR}, 1.0);`,
          );
        };
        mat.customProgramCacheKey = () => 'section-cap';
      }
      this.clipped.push(mat);
    }
    this.mats.set(key, mat);
    return mat;
  }

  _std(key, opts, flags) {
    return this._add(key, new THREE.MeshStandardMaterial(opts), flags);
  }

  // -------------------------------------------------------------------------
  async _build(tick) {
    await tick('Painting walls');
    // ---- shared surfaces --------------------------------------------------
    const plaster = this._texPair(TX.noiseSurface({ N: 512, base: [240, 240, 240], amp: 0.035, scale: 10, seed: 3 }), 6);
    const extPlaster = this._texPair(TX.noiseSurface({ N: 512, base: [240, 240, 240], amp: 0.07, scale: 14, oct: 5, seed: 9 }), 5);
    const paint = (key, color, rough = 0.92) => this._std(key, { color, map: plaster.map, bumpMap: plaster.bump, bumpScale: 0.4, roughness: rough, metalness: 0 });
    const extPaint = (key, color) => this._std(key, { color, map: extPlaster.map, bumpMap: extPlaster.bump, bumpScale: 0.8, roughness: 0.95, metalness: 0 });

    // Interior wall paints (one soft colour per room)
    paint('pLiving', 0xe6d6ba);
    paint('pHall', 0xede3d2);
    paint('pBed1', 0xd3ddcb);
    paint('pBed2', 0xebd3c6);
    paint('pGuest', 0xd2dde7);
    paint('pKitchen', 0xf1eee6);
    paint('pToilet', 0xf2f2ef);
    paint('pPuja', 0xf4dcaa);
    paint('pLobby', 0xebe0cd);
    paint('pStair', 0xe8dfcf);
    // one feature wall per room (behind the bed / TV)
    paint('accentBed1', 0x7f9ea8);
    paint('accentBed2', 0xc79a86);
    paint('accentGuest', 0x9fae8f);
    paint('accentLiving', 0xb59c80);
    paint('pDuct', 0xb8b4ab);
    paint('reveal', 0xece7de);
    paint('ceiling', 0xf7f6f1, 0.95);
    paint('ffInterior', 0xefebe3);

    // Exterior finishes from the elevation
    extPaint('ext', COLORS.sage);
    extPaint('pPortico', COLORS.sage);
    extPaint('extTan', COLORS.tan);
    extPaint('extTanDark', COLORS.tanDark);
    this._std('white', { color: COLORS.white, map: plaster.map, roughness: 0.55, metalness: 0 });
    this._std('slabEdge', { color: COLORS.white, map: plaster.map, roughness: 0.6 });
    this._std('soffit', { color: COLORS.soffit, roughness: 0.8 });
    const siding = this._texPair(TX.boards({ N: 512, count: 10, base: [74, 77, 82], seed: 51 }), 5);
    this._std('siding', { map: siding.map, bumpMap: siding.bump, bumpScale: 2, roughness: 0.7, metalness: 0.1 });
    const clad = this._texPair(TX.planks({ N: 512, rows: 7, minLen: 0.9, maxLen: 1.0, gap: 2, joints: false, colors: [[136, 104, 72], [118, 88, 60]], gapColor: [44, 32, 24], grain: 1.1, seed: 13 }), 6);
    this._std('woodClad', { map: clad.map, bumpMap: clad.bump, bumpScale: 2.5, roughness: 0.6 });
    const cladDark = this._texPair(TX.planks({ N: 512, rows: 6, minLen: 0.9, maxLen: 1.0, gap: 3, joints: false, colors: [[100, 78, 56], [84, 65, 46]], gapColor: [30, 22, 16], grain: 1.1, seed: 17 }), 6);
    this._std('woodCladDark', { map: cladDark.map, bumpMap: cladDark.bump, bumpScale: 2.5, roughness: 0.6 });
    const stone = this._texPair(TX.stoneBlocks({ N: 512 }), 4);
    this._std('plinth', { map: stone.map, bumpMap: stone.bump, bumpScale: 2.5, roughness: 0.9 });

    await tick('Laying floor tiles');
    // ---- floors ----------------------------------------------------------
    const marbleTile = this._texPair(TX.tiles({ N: 1024, n: 2, grout: 2, base: [236, 228, 212], vary: 0.03, noiseAmp: 0.05, veins: 0.55, veinColor: [176, 160, 138], groutColor: [205, 196, 180], seed: 2 }), 4);
    this._std('tileMarble', { map: marbleTile.map, bumpMap: marbleTile.bump, bumpScale: 1, roughness: 0.16, metalness: 0.05 });
    const warmTile = this._texPair(TX.tiles({ N: 768, n: 2, grout: 2, base: [214, 194, 166], vary: 0.05, noiseAmp: 0.08, veins: 0.35, veinColor: [160, 130, 100], groutColor: [190, 172, 148], seed: 4 }), 4);
    this._std('tileWarm', { map: warmTile.map, bumpMap: warmTile.bump, bumpScale: 1, roughness: 0.2, metalness: 0.05 });
    const oak = this._texPair(TX.planks({ N: 1024, rows: 8, minLen: 0.35, maxLen: 0.8, gap: 2, colors: [[170, 122, 78], [140, 98, 60]], gapColor: [70, 48, 30], grain: 1, seed: 6 }), 6);
    this._std('wood', { map: oak.map, bumpMap: oak.bump, bumpScale: 1.2, roughness: 0.42 });
    const oakLight = this._texPair(TX.planks({ N: 768, rows: 8, minLen: 0.35, maxLen: 0.8, gap: 2, colors: [[206, 172, 128], [186, 150, 106]], gapColor: [110, 85, 60], grain: 0.9, seed: 8 }), 6);
    this._std('woodLight', { map: oakLight.map, bumpMap: oakLight.bump, bumpScale: 1.2, roughness: 0.42 });
    const kTile = this._texPair(TX.tiles({ N: 512, n: 2, grout: 2, base: [150, 146, 140], vary: 0.06, noiseAmp: 0.1, speck: 0.03, groutColor: [110, 108, 104], seed: 12 }), 4);
    this._std('tileKitchen', { map: kTile.map, bumpMap: kTile.bump, bumpScale: 1, roughness: 0.45 });
    const bTile = this._texPair(TX.tiles({ N: 512, n: 4, grout: 2, base: [150, 168, 180], vary: 0.06, noiseAmp: 0.12, speck: 0.05, groutColor: [210, 214, 216], seed: 14 }), 4);
    this._std('tileBath', { map: bTile.map, bumpMap: bTile.bump, bumpScale: 1.2, roughness: 0.55 });
    const whiteMarble = this._texPair(TX.tiles({ N: 768, n: 2, grout: 1, base: [244, 242, 238], vary: 0.01, noiseAmp: 0.03, veins: 0.5, veinColor: [170, 170, 176], groutColor: [225, 225, 225], seed: 16 }), 4);
    this._std('marble', { map: whiteMarble.map, bumpMap: whiteMarble.bump, bumpScale: 0.6, roughness: 0.14, metalness: 0.05 });
    const grass = TX.grass({ N: 512 });
    this._std('grass', { map: this._tex(grass.map, 6), roughness: 1 });
    const gGrey = TX.granite({ N: 512, base: [118, 116, 114], specks: [[[40, 40, 42], 0.06], [[215, 212, 206], 0.04], [[160, 150, 140], 0.05]], seed: 22 });
    this._std('graniteGrey', { map: this._tex(gGrey.map, 3), roughness: 0.28, metalness: 0.05 });
    const conc = this._texPair(TX.noiseSurface({ N: 512, base: [168, 166, 160], amp: 0.12, scale: 8, speckDark: 0.02, seed: 24 }), 6);
    this._std('concrete', { map: conc.map, bumpMap: conc.bump, bumpScale: 1, roughness: 0.95 });
    const pav = this._texPair(TX.pavers({ N: 512, cols: 4, rows: 8, colors: [[150, 148, 142], [132, 130, 126], [166, 160, 150]], seed: 31 }), 8);
    this._std('pavers', { map: pav.map, bumpMap: pav.bump, bumpScale: 2, roughness: 0.85 });
    const terr = this._texPair(TX.tiles({ N: 512, n: 4, grout: 3, base: [176, 102, 74], vary: 0.08, noiseAmp: 0.12, groutColor: [190, 180, 165], seed: 33 }), 4);
    this._std('terrace', { map: terr.map, bumpMap: terr.bump, bumpScale: 1.5, roughness: 0.8 });
    this._std('slabTop', { color: 0xa9a59c, map: conc.map, roughness: 0.95 });
    // board-formed exposed concrete (soffit of the double-height space)
    const board = this._texPair(TX.planks({ N: 512, rows: 6, minLen: 1, maxLen: 1, gap: 1, joints: false, colors: [[152, 150, 145], [136, 134, 129]], gapColor: [104, 102, 98], grain: 0.5, seed: 93, bevel: false }), 5);
    this._std('concreteCeil', { map: board.map, bumpMap: board.bump, bumpScale: 0.8, roughness: 0.9 });

    await tick('Tiling kitchen & bathrooms');
    // ---- wall tiles -------------------------------------------------------
    const bathWall = this._texPair(TX.wallTiles({ N: 512, n: 4, nY: 2, base: [232, 236, 238], veins: 0.35, seed: 41 }), 4);
    this._std('bathWall', { map: bathWall.map, bumpMap: bathWall.bump, bumpScale: 0.8, roughness: 0.12, metalness: 0.05 });
    const bathAccent = this._texPair(TX.wallTiles({ N: 512, n: 4, nY: 2, base: [92, 120, 138], veins: 0.2, seed: 43 }), 4);
    this._std('bathAccent', { map: bathAccent.map, bumpMap: bathAccent.bump, bumpScale: 0.8, roughness: 0.15 });
    const subway = this._texPair(TX.wallTiles({ N: 512, n: 8, nY: 16, base: [240, 238, 230], veins: 0, groutColor: [196, 192, 184], seed: 45 }), 4);
    this._std('kitchenDado', { map: subway.map, bumpMap: subway.bump, bumpScale: 1, roughness: 0.12 });

    // ---- openings --------------------------------------------------------
    this._std('frameDark', { color: 0x3c3f44, roughness: 0.4, metalness: 0.6 });
    this._std('frameWhite', { color: 0xf1f1ef, roughness: 0.35, metalness: 0.05 });
    this._add('glass', new THREE.MeshStandardMaterial({ color: 0xc9dbe8, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false, envMapIntensity: 1.6, side: THREE.DoubleSide }), { cap: false });
    this._add('glassFacade', new THREE.MeshStandardMaterial({ color: COLORS.glassBlue, roughness: 0.06, metalness: 0.55, transparent: true, opacity: 0.9, envMapIntensity: 1.8, side: THREE.DoubleSide }), { cap: false });
    const veneer = this._texPair(TX.planks({ N: 512, rows: 3, minLen: 2, maxLen: 2.1, gap: 0, colors: [[150, 98, 58], [138, 90, 52]], grain: 1.3, seed: 27, bevel: false }), 3);
    this._std('doorWood', { map: veneer.map, roughness: 0.45 });
    const teak = this._texPair(TX.planks({ N: 512, rows: 4, minLen: 2, maxLen: 2.1, gap: 3, colors: [[112, 66, 34], [96, 56, 28]], gapColor: [50, 28, 14], grain: 1.4, seed: 29 }), 2);
    this._std('doorTeak', { map: teak.map, bumpMap: teak.bump, bumpScale: 2, roughness: 0.4 });
    // joint-free teak for window and glass-wall frames; the V copy is turned 90° so the
    // grain runs up the jambs and mullions (world UVs map v to height)
    const teakF = TX.planks({ N: 512, rows: 4, minLen: 2, maxLen: 2.1, gap: 0, joints: false, colors: [[112, 66, 34], [96, 56, 28]], grain: 1.4, seed: 29, bevel: false });
    this._std('teakFrame', { map: this._tex(teakF.map, 2), roughness: 0.42 });
    const teakV = this._tex(teakF.map, 2);
    teakV.rotation = Math.PI / 2;
    this._std('teakFrameV', { map: teakV, roughness: 0.42 });
    this._std('doorPVC', { color: 0xdad8d2, roughness: 0.35 });
    this._std('brass', { color: 0xc9a45c, roughness: 0.28, metalness: 1 });
    this._std('steel', { color: 0xc9cdd1, roughness: 0.3, metalness: 1 });
    this._std('chrome', { color: 0xe8eaec, roughness: 0.08, metalness: 1 });
    const gm = TX.brushed({ N: 256, base: [118, 124, 130] });
    this._std('gateMetal', { color: 0xffffff, map: this._tex(gm.map, 2), roughness: 0.45, metalness: 0.75 });
    this._std('gatePanel', { color: 0xc3c7cb, roughness: 0.4, metalness: 0.6 });
    this._std('railWhite', { color: 0xf6f6f4, roughness: 0.3, metalness: 0.2 });

    await tick('Upholstering furniture');
    // ---- furniture ---------------------------------------------------------
    const fab = (key, base, seed) => {
      const f = TX.fabric({ N: 256, base, seed });
      this._std(key, { map: this._tex(f.map, 1.2), bumpMap: this._tex(f.bump, 1.2, false), bumpScale: 0.5, roughness: 0.95 });
    };
    fab('sofa', [190, 178, 160], 71);
    fab('sofaAccent', [62, 104, 110], 72);
    fab('cushionMustard', [206, 150, 50], 73);
    fab('sheet', [242, 240, 234], 74);
    fab('blanketBlue', [48, 74, 110], 75);
    fab('blanketMaroon', [128, 44, 52], 76);
    fab('blanketOlive', [120, 128, 76], 77);
    fab('pillow', [250, 248, 244], 78);
    fab('chairFabric', [150, 120, 96], 79);
    const curtain = (key, base, seed) => {
      const f = TX.fabric({ N: 256, base, seed, weave: 0.05 });
      this._add(key, new THREE.MeshStandardMaterial({ map: this._tex(f.map, 1.2), roughness: 0.95, side: THREE.DoubleSide }), { cap: false });
    };
    curtain('curtainBlue', [120, 146, 176], 81);
    curtain('curtainBeige', [214, 196, 168], 82);
    const sheerF = TX.fabric({ N: 256, base: [246, 242, 234], seed: 84, weave: 0.03 });
    this._add('curtainSheer', new THREE.MeshStandardMaterial({ map: this._tex(sheerF.map, 1.2), roughness: 0.95, transparent: true, opacity: 0.86, depthWrite: false, side: THREE.DoubleSide }), { cap: false });
    const walnut = this._texPair(TX.planks({ N: 512, rows: 4, minLen: 1.5, maxLen: 1.6, gap: 0, colors: [[110, 74, 46], [96, 64, 40]], grain: 1.2, seed: 35, bevel: false }), 3);
    this._std('furnWood', { map: walnut.map, roughness: 0.5 });
    const lightWood = this._texPair(TX.planks({ N: 512, rows: 4, minLen: 1.5, maxLen: 1.6, gap: 0, colors: [[200, 166, 120], [186, 150, 104]], grain: 1, seed: 37, bevel: false }), 3);
    this._std('furnLight', { map: lightWood.map, roughness: 0.5 });
    this._std('laminate', { color: 0xf0ede6, roughness: 0.3 });
    this._std('laminateGrey', { color: 0x8c8f93, roughness: 0.35 });
    this._std('laminateSage', { color: 0x8fa08a, roughness: 0.35 });
    const blackG = TX.granite({ N: 512, base: [22, 22, 24], seed: 47 });
    this._std('graniteBlack', { map: this._tex(blackG.map, 3), roughness: 0.12, metalness: 0.1 });
    this._std('ceramic', { color: 0xf8f8f6, roughness: 0.08, metalness: 0.02 });
    this._std('basinInner', { color: 0xd3d8dc, roughness: 0.12, metalness: 0.05 });
    this._std('screen', { color: 0x0b0c0e, roughness: 0.12, metalness: 0.3 });
    this._std('tvScreen', { color: 0x0e1a2a, emissive: 0x12304f, emissiveIntensity: 0.25, roughness: 0.2 });
    this._std('blackMatte', { color: 0x1e1f21, roughness: 0.6 });
    const rugTex = TX.rug({});
    this._std('rug', { map: this._tex(rugTex.map), bumpMap: this._tex(rugTex.bump, null, false), bumpScale: 1, roughness: 1 });
    this.mats.get('rug').map.wrapS = this.mats.get('rug').map.wrapT = THREE.ClampToEdgeWrapping;
    this._std('lampShade', { color: 0xfff1d6, emissive: 0xffd9a0, emissiveIntensity: 0.6, roughness: 0.9 });
    this._std('globeGlass', { color: 0xfdf8ef, emissive: 0xffdcaa, emissiveIntensity: 0.75, roughness: 0.22, metalness: 0 });
    this._std('lightPanel', { color: 0xffffff, emissive: 0xfff4e0, emissiveIntensity: 1.2, roughness: 0.5 });
    const leaf = TX.foliage({ N: 256, base: [62, 112, 46] });
    this._std('leaf', { map: this._tex(leaf.map, 1.5), roughness: 0.8, flatShading: true });
    this._std('leafDark', { map: this._tex(TX.foliage({ N: 256, base: [44, 86, 40], seed: 5 }).map, 1.5), roughness: 0.8, flatShading: true });
    this._std('tulsi', { color: 0x5d8a3a, roughness: 0.8, flatShading: true });
    this._std('pot', { color: 0xa65a3a, roughness: 0.85 });
    this._std('potDark', { color: 0x3a3a3c, roughness: 0.5 });
    this._std('soil', { color: 0x4a3526, roughness: 1 });
    this._std('stoneStep', { color: 0xb8b2a6, roughness: 0.8 });
    this._std('mirror', { color: 0xdfe8ee, roughness: 0.02, metalness: 1 });
    this._std('art', { map: this._tex(TX.painting({}).map), roughness: 0.8 });
    this._std('art2', { map: this._tex(TX.painting({ seed: 7, palette: [[40, 90, 120], [200, 180, 150], [180, 80, 60], [30, 40, 50]] }).map), roughness: 0.8 });
    this._std('gold', { color: 0xd4a73c, roughness: 0.3, metalness: 1 });
    this._std('saffron', { color: 0xe6862e, roughness: 0.7 });
    this._std('pipe', { color: 0x9ea3a8, roughness: 0.5 });
    this._std('pipeOrange', { color: 0xc86a32, roughness: 0.5 });

    // Car
    this._add('carPaint', new THREE.MeshPhysicalMaterial({ color: 0xeef0f2, roughness: 0.3, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.08 }));
    this._std('carGlass', { color: 0x46607a, roughness: 0.03, metalness: 0.85, envMapIntensity: 2.2 });
    this._std('tyre', { color: 0x151515, roughness: 0.9 });
    this._std('rim', { color: 0xb8bcc2, roughness: 0.25, metalness: 1 });
    this._std('headlight', { color: 0xffffff, emissive: 0xe8f2ff, emissiveIntensity: 0.6, roughness: 0.1 });
    this._std('taillight', { color: 0xaa1010, emissive: 0x7a0000, emissiveIntensity: 0.6, roughness: 0.2 });

    await tick('Paving the street');
    // ---- site (not clipped) --------------------------------------------------
    const site = { clip: false };
    const asph = TX.noiseSurface({ N: 512, base: [72, 74, 78], amp: 0.14, scale: 20, speck: 0.015, speckColor: [150, 150, 150], seed: 51 });
    this._add('asphalt', new THREE.MeshStandardMaterial({ map: this._tex(asph.map, 14), roughness: 0.92 }), site);
    const fp = this._texPair(TX.pavers({ N: 512, cols: 4, rows: 4, gap: 3, colors: [[150, 152, 148], [132, 134, 130], [120, 118, 112]], seed: 55 }), 5);
    this._add('footpath', new THREE.MeshStandardMaterial({ map: fp.map, bumpMap: fp.bump, bumpScale: 2, roughness: 0.9 }), site);
    this._add('curb', new THREE.MeshStandardMaterial({ color: 0xc9c6bd, map: conc.map, roughness: 0.9 }), site);
    this._add('grassSite', new THREE.MeshStandardMaterial({ map: this._tex(TX.grass({ N: 512, seed: 29, base: [92, 132, 56] }).map, 8), roughness: 1 }), site);
    const band = this._texPair(TX.bandedWall({ N: 512 }), 6);
    this._add('bandWall', new THREE.MeshStandardMaterial({ map: band.map, bumpMap: band.bump, bumpScale: 1.5, roughness: 0.85 }), site);
    this._add('treeBark', new THREE.MeshStandardMaterial({ color: 0x5a4533, roughness: 1 }), site);
    this._add('treeLeaf', new THREE.MeshStandardMaterial({ map: this._tex(TX.foliage({ N: 256, base: [72, 120, 50], seed: 9 }).map, 3), roughness: 0.85, flatShading: true }), site);
    this._add('treeLeaf2', new THREE.MeshStandardMaterial({ map: this._tex(TX.foliage({ N: 256, base: [96, 132, 58], seed: 19 }).map, 3), roughness: 0.85, flatShading: true }), site);
    this._add('roadLine', new THREE.MeshStandardMaterial({ color: 0xf2f2ea, roughness: 0.7 }), site);
    this._add('lampPole', new THREE.MeshStandardMaterial({ color: 0x4a4e53, roughness: 0.5, metalness: 0.6 }), site);
    this._add('lampHead', new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2d6, emissiveIntensity: 0.5 }), site);
    this._add('siteWhite', new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.6 }), site);
    this._add('neighbourPaint', new THREE.MeshStandardMaterial({ color: 0xd9d2c4, map: extPlaster.map, roughness: 0.95 }), site);
  }
}
