import { rearZ, REAR_T, REAR_COL_D, PLOT, DUCT, VOID, REAR_COLS, voidOutline, ductOutline, stairWell } from './config.js';

// ---------------------------------------------------------------------------
// First floor: a 2BHK flat over the ground floor (design proposal, not from the
// supplied drawings). Partitions sit over the ground-floor walls wherever they can,
// so loads come straight down: bedroom 3 is over bedroom 1 and the puja room,
// bedroom 4 over bedroom 2, the kitchen over the guest room and the bathrooms over
// the ground-floor toilets. The flat is entered from the stair landing; the living
// room opens onto the front terrace over the portico, and the dining area looks
// down into the double-height hall across the glass railing on grid F.
//
// FF_WALLS uses the same conventions as WALLS in plan.js (s0 = -x / -z face,
// s1 = +x / +z face, openings measured along the wall) plus:
//   ends: [lo, hi] material of the end faces (null where the end abuts another wall)
//   faces: per-face override for short pieces such as columns
//   opening heights are given relative to the first-floor slab (LV.ff):
//     t: 'door' | 'main' | 'arch' | 'gdoor' (glazed door) | 'slide' (sliding glass door)
//        | 'win' | 'vent'; sill / head override the defaults in FF_OPENING
// ---------------------------------------------------------------------------

const W = PLOT.width;
const L = 'pFFLiving', K = 'pFFKitchen', B3 = 'pFFBed3', B4 = 'pFFBed4', T = 'pToilet', S = 'pStair';
const E = 'ext', H = 'pHall', KV = 'pKitchen', D = 'pDuct';

/** Default sill / head of each opening type, in feet above the first-floor slab. */
export const FF_OPENING = {
  door: [0, 7], main: [0, 7], arch: [0, 7], gdoor: [0, 7], slide: [0, 7.5],
  win: [3, 7.5], vent: [6, 7.5],
};

export const FF_WALLS = [
  // ---- outer shell ----------------------------------------------------------
  // north (left) wall: bedroom 3, its study corner (window over the desk), living room
  { id: 'ffL-bed3', x: [0, 0.75], z: [rearZ(0), -38.8], s0: E, s1: B3, ends: [E, null], open: [{ t: 'win', a: -45.0, b: -40.0 }] },
  { id: 'ffL-study', x: [0, 0.75], z: [-38.8, -30.934], s0: E, s1: B3, open: [{ t: 'win', a: -37.6, b: -33.6 }] },
  { id: 'ffL-liv', x: [0, 0.75], z: [-30.934, -18.039], s0: E, s1: L, ends: [null, E], open: [{ t: 'win', a: -26.0, b: -21.0 }] },
  // front of the main block, facing the terrace: sliding door from the living room, dining window
  { id: 'ffT-back', x: [0.75, 18.25], z: [-18.831, -18.039], s0: L, s1: E, ends: [null, L],
    open: [{ t: 'slide', a: 3.0, b: 9.0 }, { t: 'win', a: 11.0, b: 15.0 }] },
  // stair tower, west wall facing the terrace: glazed door from the landing
  { id: 'ffTW-a', x: [17.5, 18.25], z: [-18.039, -9.239], s0: E, s1: L },
  { id: 'ffTW-b', x: [17.5, 18.25], z: [-9.239, -0.75], s0: E, s1: S, open: [{ t: 'gdoor', a: -7.6, b: -4.6, door: 'ffTerr' }] },
  // south (right) party wall; beside the pipe line shaft it is only as thick as the shaft wall below
  { id: 'ffR-void', x: [W - 0.75, W], z: [rearZ(W), -37.821], s0: KV, s1: E },
  { id: 'ffR-bed4', x: [W - 0.75, W], z: [-37.821, -26.706], s0: 'accentBed4', s1: E },
  { id: 'ffR-bath4', x: [W - 0.75, W], z: [-26.706, -21.074], s0: T, s1: E },
  { id: 'ffR-duct', x: [DUCT.x1, W], z: [-21.074, -8.843], s0: D, s1: E },
  { id: 'ffR-stair', x: [W - 0.75, W], z: [-8.843, -0.75], s0: S, s1: E },
  // pipe line shaft (open to the sky): kitchen side, rear (bathroom 4) and front (stair) walls
  { id: 'ffD-w', x: [DUCT.x0 - DUCT.wall, DUCT.x0], z: [-21.074, -8.843], s0: K, s1: D, ends: [T, S],
    open: [{ t: 'win', a: -17.0, b: -13.0, sill: 3.5, head: 7.0 }] },
  { id: 'ffD-r', x: [DUCT.x0, DUCT.x1], z: [-21.074, DUCT.z0], s0: T, s1: D, open: [{ t: 'vent', a: 32.6, b: 34.2 }] },
  { id: 'ffD-f', x: [DUCT.x0, DUCT.x1], z: [DUCT.z1, -8.843], s0: D, s1: S },

  // ---- round the double-height space ---------------------------------------------
  // (teak-framed windows look into it from bedroom 3 and bedroom 4, with sheer curtains)
  { id: 'ffV-bed3', x: [11.879, VOID.x0], z: [rearZ(VOID.x0) + REAR_COL_D, VOID.hallFront], s0: B3, s1: H, ends: [H, null],
    open: [{ t: 'win', a: -40.4, b: -33.2, sill: 2, head: 8, frame: 'teak', curtain: -1 }] },
  { id: 'ffV-bed4', x: [VOID.hallX1, 22.674], z: [-37.821, VOID.hallFront], s0: H, s1: B4,
    open: [{ t: 'win', a: -37.0, b: -34.4, frame: 'teak', curtain: 1 }] },
  { id: 'ffV-front', x: [VOID.hallX1, W - 0.75], z: [VOID.zFront, -37.821], s0: KV, s1: B4, ends: [H, null],
    open: [{ t: 'win', a: 25.5, b: 30.5, frame: 'teak', curtain: 1 }] },

  // ---- partitions ----------------------------------------------------------------
  // living room / bedroom 3 (over the bedroom-1 wall)
  { id: 'ff-liv-study', x: [0.75, 6.175], z: [-30.934, -30.534], s0: B3, s1: L },
  { id: 'ff-liv-bed3', x: [6.175, 11.439], z: [-30.934, -30.534], s0: B3, s1: L, open: [{ t: 'door', a: 8.0, b: 11.0, door: 'ffBed3' }] },
  { id: 'ff-col-f2', x: [11.439, VOID.x0], z: [VOID.hallFront, -30.534], faces: { nx: B3, px: L, nz: B3, pz: L } },
  // dining side: bedroom 4, common toilet, kitchen (over the bedroom-2 / toilet / guest-room walls)
  { id: 'ff-col-n2', x: [VOID.hallX1, 22.922], z: [VOID.hallFront, -30.534], faces: { nx: L, px: B4, nz: B4, pz: B4 } },
  { id: 'ff-bed4-w', x: [VOID.hallX1, 22.674], z: [-30.534, -26.882], s0: L, s1: B4, open: [{ t: 'door', a: -30.2, b: -27.2, door: 'ffBed4' }] },
  { id: 'ff-wc-w', x: [VOID.hallX1, 22.674], z: [-26.882, -20.282], s0: L, s1: T, open: [{ t: 'door', a: -25.35, b: -22.6, door: 'ffWC' }] },
  { id: 'ff-kit-w', x: [VOID.hallX1, 22.674], z: [-20.282, -9.635], s0: L, s1: K, open: [{ t: 'arch', a: -16.4, b: -13.4 }] },
  { id: 'ff-bed4-s', x: [22.674, W - 0.75], z: [-26.882, -26.53], s0: B4, s1: T, open: [{ t: 'door', a: 30.1, b: 32.85, door: 'ffBath4' }] },
  { id: 'ff-wc-part', x: [28.07, 28.422], z: [-26.53, -21.074], s0: T, s1: T },
  { id: 'ff-wc-kit', x: [22.674, DUCT.x0 - DUCT.wall], z: [-21.074, DUCT.z0], s0: T, s1: K },
  // flat entrance from the stair landing, and the kitchen's front wall
  { id: 'ff-stair-a', x: [18.25, 22.674], z: [-9.635, -8.843], s0: L, s1: S, open: [{ t: 'main', a: 18.75, b: 21.85, door: 'ffMain' }] },
  { id: 'ff-stair-b', x: [22.674, DUCT.x0 - DUCT.wall], z: [-9.635, -8.843], s0: K, s1: S },
];

// Door leaves (same conventions as DOORS in plan.js)
export const FF_DOORS = {
  ffMain:  { hinge: 'a', side: 0, style: 'teak' },
  ffBed3:  { hinge: 'b', side: 0, style: 'wood' },
  ffBed4:  { hinge: 'b', side: 1, style: 'wood' },
  ffWC:    { hinge: 'b', side: 1, style: 'pvc' },
  ffBath4: { hinge: 'b', side: 1, style: 'pvc' },
  ffTerr:  { hinge: 'b', side: 1, style: 'glass' },
};

const RZ0 = rearZ(0) + 0.05; // rectangles that start here run under the slanted rear wall (rear: true)

// Rooms: as ROOMS in plan.js; floorRects (optional) = where the floor finish is laid
// when it differs from the room's outline (the stair well is open).
export const FF_ROOMS = [
  { id: 'ffLiving', name: 'Living Room', size: '11′-6″ × 11′-8″', rects: [[0.75, VOID.x0, -30.534, -18.831]], floor: 'tileWarm',
    note: 'Opens onto the front terrace through a sliding glass door. Sofa, armchair and a TV unit that screens the dining area; window to the north.' },
  { id: 'ffDining', name: 'Dining & Entrance', size: '9′-11″ × 12′-6″ + passage', rects: [[VOID.x0, VOID.hallX1, VOID.hallFront, -18.831], [18.25, VOID.hallX1, -18.831, -9.635]], floor: 'tileMarble',
    note: 'Entered from the stair landing through the main door. The 6-seater table looks down into the double-height dining hall across the glass railing. The kitchen, the common toilet and bedroom 4 open off it.' },
  { id: 'ffKitchen', name: 'Kitchen', size: '8′-11″ × 10′-8″', rects: [[22.674, DUCT.x0 - DUCT.wall, DUCT.z0, -9.635]], floor: 'tileKitchen',
    note: 'L-shaped granite counter, sink under a window onto the pipe line shaft, hob with chimney, fridge. Opens off the entrance passage through an arch.' },
  { id: 'ffBed3', name: 'Bedroom 3', size: '11′-2″ × 16′-9″', rects: [[0.75, 11.879, RZ0, -30.934]], floor: 'wood', rear: true,
    note: 'Master bedroom over bedroom 1 and the puja room, with a study corner open to the room. Queen bed, a wardrobe on the south wall, a dressing table by the door, a work desk under a window looking out to the north, and a bookshelf on the west wall. A large window looks into the double-height hall.' },
  { id: 'ffBed4', name: 'Bedroom 4', size: '12′-0″ × 10′-11″', rects: [[22.674, W - 0.75, -37.821, -26.882]], floor: 'woodLight',
    note: 'Over bedroom 2. Queen bed, wardrobe, TV and an attached bathroom. Two windows look into the double-height dining hall and kitchen, lit by the rear glass wall.' },
  { id: 'ffBath4', name: 'Bathroom 4', size: '6′-3″ × 5′-6″', rects: [[28.422, W - 0.75, -26.53, -21.074]], floor: 'tileBath',
    note: 'Attached to bedroom 4: WC, wash basin and shower, ventilator to the pipe line shaft.' },
  { id: 'ffWC', name: 'Common Toilet', size: '5′-5″ × 5′-6″', rects: [[22.674, 28.07, -26.53, -21.074]], floor: 'tileBath',
    note: 'Off the dining area, with WC, wash basin and shower.' },
  { id: 'ffStair', name: 'Staircase', size: '16′-5″ × 8′-1″', rects: [[18.25, W - 0.75, -8.843, -0.75]], floorRects: [[18.25, 23.05, -8.843, -0.75]], floor: 'graniteGrey',
    note: 'First-floor landing with the main door of the flat. The dog-legged stair carries on up to the roof, and a glass door opens onto the front terrace.' },
  { id: 'ffTerrace', name: 'Front Terrace', size: '16′-9″ × 18′-0″', rects: [[0.75, 17.5, -18.039, 0.0]], floor: 'terrace', level: 'terrace',
    note: 'Open terrace over the portico, inside the white frame of the front elevation. Reached from the living room and from the stair landing.' },
];

export const ROOF_ROOMS = [
  { id: 'roof', name: 'Roof Terrace', size: '34′-6″ × 29′-6″ + 17′-0″ × 8′-10″', floor: 'terrace', rear: true,
    rects: [[0.45, DUCT.x0 - 0.45, rearZ(0) + 0.45, -18.489], [DUCT.x0 - 0.45, W - 0.45, rearZ(W) + 0.45, DUCT.z0 - 0.45], [17.95, DUCT.x0 - 0.45, -18.489, -9.635]],
    note: 'Open roof over the whole house, including the double-height space, behind a 3 ft parapet. The water tank stands near the front and the pipe line shaft opens here behind its own parapet.' },
  { id: 'mumty', name: 'Mumty (Stair Cabin)', size: '16′-5″ × 8′-1″', rects: [[18.25, W - 0.75, -8.843, -0.792]], floor: 'graniteGrey',
    note: 'Stair head room on the roof, with a door out to the roof terrace.' },
];

for (const r of FF_ROOMS) { r.floorId = 'ff'; r.level = r.level || 'ffFloor'; }
for (const r of ROOF_ROOMS) { r.floorId = 'roof'; r.level = 'roof'; }

// ---------------------------------------------------------------------------
// Minimap outlines for the upper floors (plan rectangles / polygons in feet)
// ---------------------------------------------------------------------------
const rearBand = (x0, x1, t) => [[x0, rearZ(x0)], [x1, rearZ(x1)], [x1, rearZ(x1) + t], [x0, rearZ(x0) + t]];

export const FF_MAP = {
  walls: [
    ...FF_WALLS.map((w) => [w.x[0], w.x[1], w.z[0], w.z[1]]),
    [17.5, W, -0.75, 0], // tower front
  ],
  polys: [rearBand(0, REAR_COLS[0][1], REAR_T), rearBand(REAR_COLS[0][1], W, 0.3), rearBand(REAR_COLS[1][0], REAR_COLS[1][1], REAR_COL_D)],
  // open to below: the double-height space, the stair well and the pipe line shaft
  voids: [voidOutline(), stairWell(), ductOutline()],
  rails: [[VOID.x0, VOID.hallX1, VOID.hallFront, VOID.hallFront + 0.25]],
};

export const ROOF_MAP = {
  walls: [
    [0, 0.45, rearZ(0), -18.039], [0, 17.5, -18.489, -18.039], [17.5, 17.95, -18.039, -9.635],
    [W - 0.45, W, rearZ(W), DUCT.z0 - 0.45],
    [DUCT.x0 - 0.45, DUCT.x0, DUCT.z0 - 0.45, DUCT.z1], [DUCT.x0, DUCT.x1, DUCT.z0 - 0.45, DUCT.z0], [DUCT.x1, W, DUCT.z0 - 0.45, DUCT.z1],
    // mumty (with its door at x 19.2 to 22.2)
    [17.5, 19.2, -9.635, -8.843], [22.2, W, -9.635, -8.843], [17.5, 18.25, -8.843, -0.792], [W - 0.75, W, -8.843, -0.792], [17.5, W, -0.792, 0],
    [14.3, 17.5, -22.6, -18.6], // water tank
  ],
  polys: [rearBand(0, W, 0.45)],
  voids: [[[23.05, -8.843], [W - 0.75, -8.843], [W - 0.75, -0.792], [23.05, -0.792]], ductOutline()],
  rails: [[22.8, 23.1, -8.843, -4.95]],
};
