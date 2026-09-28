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
  { id: 'R-stair', x: [34.581, 35.417], z: [-9.635, 0.0], s0: 'pStair', s1: 'ext' },

  // Puja / garden / kitchen (rear strip) -------------------------------------
  { id: 'puja-R', x: [5.852, 6.643], z: [-48.616, -43.689], s0: 'pPuja', s1: 'ext', open: [{ t: 'arch', a: -47.252, b: -44.173 }] },
  { id: 'G-puja', x: [0.792, 6.643], z: [-43.689, -42.941], s0: 'pPuja', s1: 'accentBed1' },
  { id: 'G-bed1', x: [6.643, 12.231], z: [-43.689, -42.941], s0: 'ext', s1: 'pBed1', open: [{ t: 'win', a: 7.171, b: 11.263 }] },
  { id: 'G-hall', x: [12.231, 22.174], z: [-43.689, -42.941], s0: 'ext', s1: 'pHall', open: [{ t: 'win', a: 12.803, b: 16.851 }, { t: 'door', a: 18.259, b: 21.338, door: 'garden' }] },
  { id: 'K-left', x: [22.174, 22.922], z: [-47.824, -42.941], s0: 'ext', s1: 'pKitchen', open: [{ t: 'kwin', a: -46.416, b: -44.349 }] },
  { id: 'K-stub', x: [22.174, 22.526], z: [-42.941, -38.321], s0: 'pHall', s1: 'pKitchen', open: [{ t: 'arch', a: -41.797, b: -38.717 }] },

  // Hall / bedroom 2 / toilets ---------------------------------------------
  { id: 'C8', x: [22.174, 22.922], z: [-38.321, -37.529], s0: 'pHall', s1: 'pBed2' },
  { id: 'B2-left', x: [22.174, 22.526], z: [-37.529, -27.322], s0: 'pHall', s1: 'pBed2', open: [{ t: 'door', a: -31.414, b: -27.85, door: 'bed2' }] },
  { id: 'C10', x: [22.174, 22.922], z: [-27.322, -26.53], s0: 'pHall', s1: 'pToilet' },
  { id: 'K-B2', x: [22.922, 34.581], z: [-38.321, -37.969], s0: 'pKitchen', s1: 'pBed2' },
  { id: 'T-top-a', x: [20.678, 22.174], z: [-26.882, -26.53], s0: 'pHall', s1: 'pToilet' },
  { id: 'T-top-b', x: [22.922, 34.581], z: [-26.882, -26.53], s0: 'pBed2', s1: 'pToilet' },
  { id: 'T1-left-a', x: [20.678, 21.03], z: [-26.53, -23.098], s0: 'pHall', s1: 'pToilet', open: [{ t: 'door', a: -26.266, b: -23.45, door: 'toilet1' }] },
  { id: 'T1-left-b', x: [20.678, 21.03], z: [-23.098, -21.074], s0: 'pLobby', s1: 'pToilet' },
  { id: 'C12', x: [20.634, 21.426], z: [-21.074, -20.282], s0: 'pLobby', s1: 'pGuest' },
  { id: 'T-part', x: [28.07, 28.422], z: [-26.53, -21.074], s0: 'pToilet', s1: 'pToilet' },
  { id: 'T-bot', x: [21.426, 31.59], z: [-21.074, -20.678], s0: 'pToilet', s1: 'pGuest', open: [{ t: 'door', a: 28.774, b: 31.59, door: 'toilet2' }] },
  { id: 'T2-duct', x: [32.382, 34.581], z: [-21.074, -20.282], s0: 'pToilet', s1: 'pDuct', open: [{ t: 'vent', a: 32.602, b: 34.185 }] },

  // Guest room / lobby ------------------------------------------------------
  { id: 'G-right', x: [31.59, 32.382], z: [-21.074, -9.635], s0: 'accentGuest', s1: 'pDuct', open: [{ t: 'win', a: -17.423, b: -12.319 }] },
  { id: 'G-left', x: [20.678, 21.03], z: [-20.282, -9.635], s0: 'pLobby', s1: 'pGuest', open: [{ t: 'door', a: -13.595, b: -10.031, door: 'guest' }] },
  { id: 'bump', x: [20.15, 20.678], z: [-18.831, -18.039], s0: 'pLobby', s1: 'pLobby' },
  { id: 'LP-lintel', x: [16.103, 20.15], z: [-18.831, -18.039], s0: 'pLobby', s1: 'pLobby', open: [{ t: 'arch', a: 16.103, b: 20.15 }] },
  { id: 'GB-lobby', x: [20.15, 21.03], z: [-9.635, -8.843], s0: 'pLobby', s1: 'pStair' },
  { id: 'GB-guest', x: [21.03, 32.382], z: [-9.635, -8.843], s0: 'pGuest', s1: 'pStair' },
  { id: 'GB-duct', x: [32.382, 34.581], z: [-9.635, -8.843], s0: 'pDuct', s1: 'pStair', open: [{ t: 'vent', a: 32.602, b: 34.185 }] },
  { id: 'LS-lintel', x: [16.103, 20.15], z: [-9.635, -8.843], s0: 'pLobby', s1: 'pStair', open: [{ t: 'arch', a: 16.103, b: 20.15 }] },

  // Front (stair room) + portico ---------------------------------------------
  { id: 'F-stair-a', x: [15.619, 25.298], z: [-0.792, 0.0], s0: 'pStair', s1: 'extTan', open: [{ t: 'swin', a: 19.798, b: 22.79 }] },
  { id: 'F-stair-b', x: [25.298, 35.417], z: [-0.792, 0.0], s0: 'pStair', s1: 'ext' },
  { id: 'P-right-a', x: [14.827, 15.619], z: [-18.831, -9.239], s0: 'pPortico', s1: 'pLobby', open: [{ t: 'main', a: -15.707, b: -11.615, door: 'main' }] },
  { id: 'P-right-b', x: [14.827, 15.619], z: [-9.239, 0.0], s0: 'pPortico', s1: 'pStair' },
  { id: 'stub-a', x: [15.619, 16.103], z: [-18.831, -18.039], s0: 'pLobby', s1: 'pLobby' },
  { id: 'stub-b', x: [15.619, 16.103], z: [-9.635, -8.843], s0: 'pLobby', s1: 'pStair' },
  { id: 'P-top-a', x: [0.792, 12.231], z: [-18.831, -18.039], s0: 'pLiving', s1: 'siding' },
  { id: 'P-top-b', x: [12.231, 14.827], z: [-18.831, -18.039], s0: 'pLobby', s1: 'siding' },

  // Living / bedroom 1 / hall ---------------------------------------------
  { id: 'LV-right-a', x: [11.879, 12.231], z: [-30.534, -23.098], s0: 'accentLiving', s1: 'pHall', open: [{ t: 'arch', a: -30.094, b: -26.574 }] },
  { id: 'LV-right-b', x: [11.879, 12.231], z: [-23.098, -18.831], s0: 'pLiving', s1: 'pLobby', open: [{ t: 'arch', a: -22.658, b: -19.139 }] },
  { id: 'C7', x: [11.439, 12.231], z: [-31.326, -30.534], s0: 'pBed1', s1: 'pHall' },
  { id: 'B1-right', x: [11.879, 12.231], z: [-42.941, -31.326], s0: 'pBed1', s1: 'pHall', open: [{ t: 'door', a: -42.545, b: -38.981, door: 'bed1' }] },
  { id: 'B1-LV', x: [0.792, 11.439], z: [-30.93, -30.534], s0: 'pBed1', s1: 'pLiving' },
  { id: 'H-part', x: [12.231, 20.678], z: [-23.274, -22.922], s0: 'pHall', s1: 'pLobby' },
];

// Door leaves: which jamb carries the hinge ('a' | 'b'), which side of the
// wall the leaf swings into (0 = s0 side, 1 = s1 side), and the leaf style.
export const DOORS = {
  main:    { double: true, side: 1, style: 'teak', flat: true }, // pushed fully open against the lobby wall
  bed1:    { hinge: 'b', side: 0, style: 'wood' },
  bed2:    { hinge: 'b', side: 1, style: 'wood' },
  guest:   { hinge: 'b', side: 1, style: 'wood' },
  toilet1: { hinge: 'a', side: 1, style: 'pvc' },
  toilet2: { hinge: 'a', side: 0, style: 'pvc' },
  garden:  { hinge: 'a', side: 0, style: 'glass' },
};

// Rooms: floor rectangles [x0, x1, z0, z1]. `rear:true` rooms run under the
// slanted rear wall. `level` → floor height key in LV.
export const ROOMS = [
  { id: 'portico', name: 'Portico / Car Parking', size: '18′-0″ × 14′-0″', rects: [[0.792, 14.827, -18.039, 0.0]], floor: 'pavers', level: 'portico',
    note: 'Covered car porch with gates, 3 steps up to the main door.' },
  { id: 'lobby', name: 'Entrance Lobby', size: '5′-0″ × 9′-0″ + passage', rects: [[15.619, 20.678, -18.831, -9.635], [12.231, 20.678, -22.922, -18.831]], floor: 'tileMarble', level: 'gf',
    note: 'Main door from the portico. Leads to the stair, guest room, living room.' },
  { id: 'living', name: 'Living Room', size: '11′-0″ × 11′-8″', rects: [[0.792, 11.879, -30.534, -18.831]], floor: 'tileWarm', level: 'gf',
    note: '3-seater sofa, 2 armchairs, window on the side wall.' },
  { id: 'hall', name: 'Drawing / Dining Hall', size: '10′-0″ × 24′-0″', rects: [[12.231, 22.174, -42.941, -26.882], [12.231, 20.678, -26.882, -23.274]], floor: 'tileMarble', level: 'gf',
    note: '6-seater dining, wash basin, door to the garden.' },
  { id: 'bed1', name: 'Bedroom 1', size: '11′-0″ × 12′-0″', rects: [[0.792, 11.879, -42.941, -30.93]], floor: 'wood', level: 'gf',
    note: 'Queen bed, wardrobe, TV wall, 2 windows.' },
  { id: 'bed2', name: 'Bedroom 2', size: '12′-0″ × 11′-0″', rects: [[22.526, 34.581, -37.969, -26.882]], floor: 'wood', level: 'gf',
    note: 'Queen bed with side tables, wardrobe, TV wall.' },
  { id: 'guest', name: 'Guest Room', size: '10′-6″ × 11′-0″', rects: [[21.03, 31.59, -20.282, -9.635]], floor: 'woodLight', level: 'gf',
    note: 'Queen bed, wardrobe, attached toilet.' },
  { id: 'kitchen', name: 'Kitchen', size: '12′-0″ × 8′-0″', rects: [[22.922, 34.581, -48.176, -38.321]], floor: 'tileKitchen', level: 'gf', rear: true,
    note: 'L-shaped granite counter, sink, hob and chimney.' },
  { id: 'toilet1', name: 'Common Toilet', size: '7′-0″ × 5′-6″', rects: [[21.03, 28.07, -26.53, -21.074]], floor: 'tileBath', level: 'gf',
    note: 'Door from the dining hall.' },
  { id: 'toilet2', name: 'Attached Toilet', size: '6′-0″ × 5′-6″', rects: [[28.422, 34.581, -26.53, -21.074]], floor: 'tileBath', level: 'gf',
    note: 'Attached to the guest room, ventilator to the duct.' },
  { id: 'puja', name: 'Puja Room', size: '5′-0″ × 4′-0″', rects: [[0.792, 5.852, -48.836, -43.689]], floor: 'marble', level: 'gf', rear: true,
    note: 'Opens onto the garden.' },
  { id: 'garden', name: 'Garden Area', size: '15′-6″ × 4′-6″', rects: [[6.643, 22.174, -48.836, -43.689]], floor: 'grass', level: 'garden', rear: true,
    note: 'Open-to-sky courtyard behind the hall.' },
  { id: 'stair', name: 'Staircase', size: '19′-0″ × 8′-0″', rects: [[15.619, 34.581, -8.843, -0.792]], floor: 'graniteGrey', level: 'gf',
    note: 'Dog-legged stair, 20 risers to the first floor.' },
  { id: 'duct', name: 'Pipe Line Area', size: '2′-2″ × 10′-8″', rects: [[32.382, 35.021, -20.282, -9.635]], floor: 'concrete', level: 'duct',
    note: 'Service shaft for plumbing.' },
];

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
  return room.rects.reduce((s, r) => s + (r[1] - r[0]) * (r[3] - r[2]), 0);
}

export function findRoomAt(x, z) {
  for (const room of ROOMS) {
    for (const [a, b, c, d] of room.rects) {
      if (x >= a && x <= b && z >= c && z <= d) return room;
    }
  }
  return null;
}
