import { rearZ, REAR_T, DUCT, GARDEN, GUEST_WR, STAIR_BATH } from './config.js';
import { FF_ROOMS, ROOF_ROOMS } from './plan-ff.js';

// ---------------------------------------------------------------------------
// Ground-floor plan data.
// Every value was measured off the supplied floor-plan drawing
// (22.73 px = 1 ft) and converted to feet. See config.js for the axes.
//
// WALLS: axis-aligned wall pieces. x/z = footprint extents.
//   s0 / s1 = finish on the "low" and "high" side of the wall
//   (vertical wall: s0 = -x face, s1 = +x face; horizontal wall: s0 = -z (rear) face, s1 = +z (front) face)
//   open[] = openings measured along the wall's long axis (a → b)
//     t: 'door' | 'main' | 'arch' | 'win' | 'kwin' | 'vent' | 'swin'
//     door: key into DOORS (leaf style / hinge / swing side)
// ---------------------------------------------------------------------------

export const WALLS = [
  // Outer walls ------------------------------------------------------------
  { id: 'L-puja', x: [0.0, 0.792], z: [-48.748, -43.689], s0: 'ext', s1: 'pPuja' },
  { id: 'L-bed1', x: [0.0, 0.792], z: [-43.689, -30.93], s0: 'ext', s1: 'pBed1', open: [{ t: 'win', a: -40.433, b: -35.373 }] },
  { id: 'L-living', x: [0.0, 0.792], z: [-30.93, -18.831], s0: 'ext', s1: 'pLiving', open: [{ t: 'win', a: -26.046, b: -20.942 }] },
  { id: 'L-portico', x: [0.0, 0.792], z: [-18.831, 0.0], s0: 'ext', s1: 'pPortico' },
  { id: 'R-kitchen', x: [34.581, 35.417], z: [-47.164, -38.321], s0: 'pKitchen', s1: 'ext' },
  { id: 'R-bed2', x: [34.581, 35.417], z: [-38.321, -26.882], s0: 'accentBed2', s1: 'ext' },
  { id: 'R-toilet2', x: [34.581, 35.417], z: [-26.882, -20.282], s0: 'pToilet', s1: 'ext' },
  { id: 'R-duct', x: [35.021, 35.417], z: [-20.282, -9.635], s0: 'pDuct', s1: 'ext' },
  { id: 'R-stair', x: [34.581, 35.417], z: [-9.635, 0.0], s0: 'pToilet', s1: 'ext' },

  // Puja / old garden / kitchen (rear strip) --------------------------------
  // (the old garden is now part of the hall: the walls between hall, garden and
  //  kitchen are gone, so the puja room and bedroom 1 face the hall directly)
  { id: 'puja-R', x: [5.852, 6.643], z: [-48.616, -43.689], s0: 'pPuja', s1: 'pHall', open: [{ t: 'arch', a: -47.252, b: -44.173 }] },
  { id: 'G-puja', x: [0.792, 6.643], z: [-43.689, -42.941], s0: 'pPuja', s1: 'accentBed1' },
  { id: 'G-bed1', x: [6.643, 12.231], z: [-43.689, -42.941], s0: 'pHall', s1: 'pBed1', open: [{ t: 'win', a: 7.171, b: 11.263 }] },

  // Hall / bedroom 2 / toilets ---------------------------------------------
  { id: 'C8', x: [22.174, 22.922], z: [-38.321, -37.529], s0: 'pHall', s1: 'pBed2' },
  { id: 'C-F5', x: [22.174, 22.922], z: [-31.326, -30.534], s0: 'pHall', s1: 'pBed2' }, // column added on grid F: carries the first-floor edge beam
  { id: 'B2-left', x: [22.174, 22.526], z: [-37.529, -27.322], s0: 'pHall', s1: 'pBed2', open: [{ t: 'door', a: -37.45, b: -33.89, door: 'bed2' }] }, // door at the kitchen end
  { id: 'C10', x: [22.174, 22.922], z: [-27.322, -26.53], s0: 'pHall', s1: 'pToilet' },
  { id: 'K-B2', x: [22.922, 34.581], z: [-38.321, -37.969], s0: 'pKitchen', s1: 'pBed2' },
  { id: 'T-top-a', x: [20.678, 22.174], z: [-26.882, -26.53], s0: 'pHall', s1: 'pToilet' },
  { id: 'T-top-b', x: [22.922, 34.581], z: [-26.882, -26.53], s0: 'pBed2', s1: 'pToilet' },
  { id: 'T1-left-a', x: [20.678, 21.03], z: [-26.53, -23.098], s0: 'pHall', s1: 'pToilet', open: [{ t: 'door', a: -26.266, b: -23.45, door: 'toilet1' }] }, // the bathroom's door, from the dining hall
  { id: 'T1-left-b', x: [20.678, 21.03], z: [-23.098, -21.074], s0: 'pLobby', s1: 'pToilet' },
  { id: 'C12', x: [20.634, 21.426], z: [-21.074, -20.282], s0: 'pLobby', s1: 'pGuest' },
  { id: 'T-bot', x: [21.426, 31.59], z: [-21.074, -20.678], s0: 'pToilet', s1: 'pGuest' }, // (old door from the guest room closed)
  { id: 'T2-duct', x: [32.382, 34.581], z: [-21.074, -20.282], s0: 'pToilet', s1: 'pDuct', open: [{ t: 'vent', a: 32.602, b: 34.185 }] },
  // wall between the shaft and the guest room's wardrobe in its front end
  { id: 'D-wr', x: [DUCT.x0, DUCT.x1], z: [DUCT.z1, GUEST_WR.z0], s0: 'pDuct', s1: 'wardrobeIn' },

  // Guest room / lobby ------------------------------------------------------
  { id: 'G-right', x: [31.59, 32.382], z: [-21.074, GUEST_WR.z0 - 0.375], s0: 'accentGuest', s1: 'pDuct', open: [{ t: 'win', a: -19.4, b: -15.8 }] },
  { id: 'G-right-wr', x: [31.59, 32.382], z: [GUEST_WR.z0 - 0.375, -9.635], s0: 'accentGuest', s1: 'wardrobeIn', open: [{ t: 'wr', a: GUEST_WR.z0, b: GUEST_WR.z1 }] },
  { id: 'G-left', x: [20.678, 21.03], z: [-20.282, -9.635], s0: 'pLobby', s1: 'pGuest', open: [{ t: 'door', a: -13.595, b: -10.031, door: 'guest' }] },
  { id: 'bump', x: [20.15, 20.678], z: [-18.831, -18.039], s0: 'pLobby', s1: 'pLobby' },
  { id: 'LP-lintel', x: [16.103, 20.15], z: [-18.831, -18.039], s0: 'pLobby', s1: 'pLobby', open: [{ t: 'arch', a: 16.103, b: 20.15 }] },
  { id: 'GB-lobby', x: [20.15, 21.03], z: [-9.635, -8.843], s0: 'pLobby', s1: 'pStair' },
  { id: 'GB-guest-a', x: [21.03, STAIR_BATH.well.x0], z: [-9.635, -8.843], s0: 'pGuest', s1: 'pStair' },
  { id: 'GB-guest-b', x: [STAIR_BATH.well.x0, 32.382], z: [-9.635, -8.843], s0: 'pGuest', s1: 'pToilet' },
  { id: 'GB-duct', x: [32.382, 34.581], z: [-9.635, -8.843], s0: 'wardrobeIn', s1: 'pToilet' },
  { id: 'LS-lintel', x: [16.103, 20.15], z: [-9.635, -8.843], s0: 'pLobby', s1: 'pStair', open: [{ t: 'arch', a: 16.103, b: 20.15 }] },

  // Front (stair room) + portico ---------------------------------------------
  { id: 'F-stair-a', x: [15.619, 25.298], z: [-0.792, 0.0], s0: 'pToilet', s1: 'extTan', open: [{ t: 'swin', a: 19.798, b: 22.79 }] },
  { id: 'F-stair-b', x: [25.298, 35.417], z: [-0.792, 0.0], s0: 'pToilet', s1: 'ext' },
  // bathroom under the stair: its wall to the stair passage, up to the first-floor slab
  // (under flight 2 it carries on with a sloping top, and under the landing a cross
  //  wall closes it off from flight 1: both in structure.js)
  { id: 'SB-wall', x: [STAIR_BATH.x0, 23.05], z: STAIR_BATH.wall, s0: 'pStair', s1: 'pToilet', open: [{ t: 'door', a: STAIR_BATH.door[0], b: STAIR_BATH.door[1], door: 'stairBath' }] },
  { id: 'P-right-a', x: [14.827, 15.619], z: [-18.831, -9.239], s0: 'pPortico', s1: 'pLobby', open: [{ t: 'main', a: -15.707, b: -11.615, door: 'main' }] },
  { id: 'P-right-b', x: [14.827, 15.619], z: [-9.239, STAIR_BATH.wall[0]], s0: 'pPortico', s1: 'pStair' },
  { id: 'P-right-c', x: [14.827, 15.619], z: [STAIR_BATH.wall[0], 0.0], s0: 'pPortico', s1: 'pToilet' },
  { id: 'stub-a', x: [15.619, 16.103], z: [-18.831, -18.039], s0: 'pLobby', s1: 'pLobby' },
  { id: 'stub-b', x: [15.619, 16.103], z: [-9.635, -8.843], s0: 'pLobby', s1: 'pStair' },
  // living-room window onto the portico (portico is roofed, so no sunshade)
  { id: 'P-top-a', x: [0.792, 12.231], z: [-18.831, -18.039], s0: 'pLiving', s1: 'siding', open: [{ t: 'win', a: 2.0, b: 11.0, noChajja: true }] },
  { id: 'P-top-b', x: [12.231, 14.827], z: [-18.831, -18.039], s0: 'pLobby', s1: 'siding' },

  // Living / bedroom 1 / hall ---------------------------------------------
  { id: 'LV-right-a', x: [11.879, 12.231], z: [-30.534, -23.098], s0: 'accentLiving', s1: 'pHall', open: [{ t: 'arch', a: -30.094, b: -26.574 }] },
  { id: 'LV-right-b', x: [11.879, 12.231], z: [-23.098, -18.831], s0: 'pLiving', s1: 'pLobby', open: [{ t: 'arch', a: -22.658, b: -19.139 }] },
  { id: 'C7', x: [11.439, 12.231], z: [-31.326, -30.534], s0: 'pBed1', s1: 'pHall' },
  { id: 'B1-right', x: [11.879, 12.231], z: [-42.941, -31.326], s0: 'pBed1', s1: 'pHall', open: [{ t: 'door', a: -35.2, b: -31.64, door: 'bed1' }] }, // door at the living-room end
  { id: 'B1-LV', x: [0.792, 11.439], z: [-30.93, -30.534], s0: 'pBed1', s1: 'pLiving' },
  { id: 'H-part', x: [12.231, 20.678], z: [-23.274, -22.922], s0: 'pHall', s1: 'pLobby' },
];

// Door leaves: which jamb carries the hinge ('a' | 'b'), which side of the
// wall the leaf swings into (0 = s0 side, 1 = s1 side), and the leaf style.
export const DOORS = {
  main:    { double: true, side: 1, style: 'teak', flat: true }, // pushed fully open against the lobby wall
  bed1:    { hinge: 'b', side: 0, style: 'wood' },
  bed2:    { hinge: 'a', side: 1, style: 'wood' },
  guest:   { hinge: 'b', side: 1, style: 'wood' },
  toilet1: { hinge: 'a', side: 1, style: 'pvc' },
  stairBath: { hinge: 'a', side: 1, style: 'pvc' },
};

// Rooms: floor rectangles [x0, x1, z0, z1]. `rear:true` rooms run under the
// slanted rear wall. `level` → floor height key in LV.
export const ROOMS = [
  { id: 'portico', name: 'Portico / Car Parking', size: '18′-0″ × 14′-0″', rects: [[0.792, 14.827, -18.039, 0.0]], floor: 'pavers', level: 'portico',
    note: 'Covered car porch with gates, 3 steps up to the main door.' },
  { id: 'lobby', name: 'Entrance Lobby', size: '5′-0″ × 9′-0″ + passage', rects: [[15.619, 20.678, -18.831, -9.635], [12.231, 20.678, -22.922, -18.831]], floor: 'tileMarble', level: 'gf',
    note: 'Main door from the portico. Leads to the stair, guest room, living room.' },
  { id: 'living', name: 'Living Room', size: '11′-0″ × 11′-8″', rects: [[0.792, 11.879, -30.534, -18.831]], floor: 'tileWarm', level: 'gf',
    note: '3-seater sofa, 2 armchairs, a window on the side wall and a wide window onto the portico.' },
  { id: 'hall', name: 'Drawing / Dining Hall', size: '10′-0″ × 24′-0″ + old garden bay', floor: 'tileMarble', level: 'gf', rear: true,
    rects: [[12.231, 22.174, -43.689, -26.882], [12.231, 20.678, -26.882, -23.274], [6.643, 22.174, -48.836, -43.689]],
    note: 'One open space with the kitchen and the old garden. The dining end and the middle of the hall rise double height up to the first-floor railing on grid F, lit by a tall glass wall above door height, facing the sunrise; the old garden bay keeps a normal ceiling. A glass-globe chandelier hangs over the table; wash basin by the kitchen.' },
  { id: 'bed1', name: 'Bedroom 1', size: '11′-0″ × 12′-0″', rects: [[0.792, 11.879, -42.941, -30.93]], floor: 'wood', level: 'gf',
    note: 'Queen bed, wardrobe, TV wall, 2 windows.' },
  { id: 'bed2', name: 'Bedroom 2', size: '12′-0″ × 11′-0″', rects: [[22.526, 34.581, -37.969, -26.882]], floor: 'wood', level: 'gf',
    note: 'Queen bed with side tables, wardrobe, TV wall.' },
  { id: 'guest', name: 'Guest Room', size: '10′-6″ × 11′-0″', rects: [[21.03, 31.59, -20.282, -9.635]], floor: 'woodLight', level: 'gf',
    note: 'Queen bed, TV, an armchair and a built-in wardrobe in the old shaft space, beside the window.' },
  { id: 'kitchen', name: 'Kitchen', size: '12′-0″ × 8′-0″', rects: [[22.174, 34.581, -48.176, -38.321]], floor: 'tileKitchen', level: 'gf', rear: true,
    note: 'Open to the dining hall, with a normal ceiling (the first-floor walk-in wardrobe is above it) and a solid rear wall. L-shaped granite counter, sink, hob and chimney.' },
  { id: 'toilet2', name: 'Bathroom', size: '13′-6″ × 5′-6″', rects: [[21.03, 34.581, -26.53, -21.074]], floor: 'tileBath', level: 'gf',
    note: 'The two old toilets made into one bathroom for the family, entered from the dining hall (no door from the guest room): a double vanity, WC, and a shower with a glass screen beside the ventilator to the pipe line shaft.' },
  { id: 'stairBath', name: 'Common Bathroom', size: '19′-0″ × 4′-2″ + 3′-11″ × 3′-11″', floor: 'tileBath', level: 'gf',
    rects: [
      [STAIR_BATH.x0, STAIR_BATH.steps[0], STAIR_BATH.wall[1], STAIR_BATH.z1],
      [STAIR_BATH.steps[0], STAIR_BATH.steps[1], STAIR_BATH.wall[1], STAIR_BATH.z1, 1.5],
      [STAIR_BATH.steps[1], STAIR_BATH.steps[2], STAIR_BATH.wall[1], STAIR_BATH.z1, 1.0],
      [STAIR_BATH.steps[2], STAIR_BATH.x1, STAIR_BATH.wall[1], STAIR_BATH.z1, 0.5],
      [STAIR_BATH.well.x0 + 0.25, STAIR_BATH.x1, STAIR_BATH.well.z0, STAIR_BATH.wall[1], 0.5],
    ],
    note: 'Under the stair, off the passage from the lobby. Shower and wash basin at floor level under the tall front window; three steps lead down to a floor 1′-6″ lower, so there is 6′-9″ clear under the mid landing, where the WC is.' },
  { id: 'puja', name: 'Puja Room', size: '5′-0″ × 4′-0″', rects: [[0.792, 5.852, -48.836, -43.689]], floor: 'marble', level: 'gf', rear: true,
    note: 'Opens onto the back of the hall (the old garden).' },
  { id: 'stair', name: 'Staircase', size: '19′-0″ × 8′-0″', rects: [[15.619, STAIR_BATH.well.x0, -8.843, STAIR_BATH.wall[0]]], floor: 'graniteGrey', level: 'gf',
    note: 'Dog-legged stair, 20 risers to the first floor. The space under the second flight and the landing is the common bathroom.' },
  { id: 'duct', name: 'Pipe Line Area', size: '2′-7″ × 5′-5″', rects: [[DUCT.x0, DUCT.x1, DUCT.z0, DUCT.z1]], floor: 'concrete', level: 'duct',
    note: 'Service shaft for plumbing, open to the sky: it runs up through the first floor and the roof. The guest room window and the bathroom ventilator open onto it; its front end is now the guest room wardrobe.' },
  { id: 'garden', name: 'Garden', size: '49′-9″ × 8′-9.1″', areaText: '435.6 sq ft (1 decimal)',
    rects: [[GARDEN.x0, GARDEN.x1, GARDEN.z0, GARDEN.z1]], floor: 'grass', level: 'garden',
    note: 'The strip of land beside the house on the north side, 1 decimal: it runs the full length of the house, 49′-9″ from the street to the back of the puja room, and is 8′-9.1″ wide. A lawn with stepping stones from its own gate on the street to a tulsi chaura by the puja room, flower beds along the boundary wall and the house, a bench, two small trees and garden lights.' },
];

for (const r of ROOMS) r.floorId = 'gf';

/** The three levels you can visit, and every room on them (first floor and roof in plan-ff.js). */
export const FLOORS = [
  { id: 'gf', name: 'Ground floor', short: 'Ground' },
  { id: 'ff', name: 'First floor', short: 'First' },
  { id: 'roof', name: 'Roof', short: 'Roof' },
];
export const ALL_ROOMS = [...ROOMS, ...FF_ROOMS, ...ROOF_ROOMS];
export const roomById = (id) => ALL_ROOMS.find((r) => r.id === id) || null;

// Helpers -------------------------------------------------------------------
export function roomBounds(room) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [a, b, c, d] of room.rects) {
    x0 = Math.min(x0, a); x1 = Math.max(x1, b); z0 = Math.min(z0, c); z1 = Math.max(z1, d);
  }
  return { x0, x1, z0, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0 };
}

/** Point used for the room's label / camera target (centre of its largest rectangle). */
export function roomAnchor(room) {
  let best = room.rects[0], area = 0;
  for (const r of room.rects) {
    const a = (r[1] - r[0]) * (r[3] - r[2]);
    if (a > area) { area = a; best = r; }
  }
  return { x: (best[0] + best[1]) / 2, z: (best[2] + best[3]) / 2 };
}

export function roomArea(room) {
  // rectangles that run under the slanted rear wall are measured to its inside face
  return room.rects.reduce((s, [x0, x1, z0, z1]) => {
    const back = room.rear && z0 < rearZ(x0) + 1 ? (rearZ(x0) + rearZ(x1)) / 2 + REAR_T : z0;
    return s + (x1 - x0) * (z1 - back);
  }, 0);
}

/** Room containing the plan point on the given floor ('gf' | 'ff' | 'roof'). */
export function findRoomAt(x, z, floor = 'gf') {
  for (const room of ALL_ROOMS) {
    if (room.floorId !== floor) continue;
    for (const [a, b, c, d] of room.rects) {
      if (x >= a && x <= b && z >= c && z <= d) return room;
    }
  }
  return null;
}
