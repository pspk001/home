// ---------------------------------------------------------------------------
// Global constants. 1 world unit = 1 foot.
// Origin = front-left outer corner of the building (road side).
// +x → right (east side of the plan), +z → towards the road, +y → up.
// ---------------------------------------------------------------------------

// Vertical levels (feet above road/ground level)
export const LV = {
  road: 0.0,
  ground: -0.02,
  footpath: 0.3,
  portico: 0.4,
  duct: 1.2,
  garden: 1.5,
  gf: 2.0,          // ground-floor finished floor level (2' plinth)
  gfCeil: 13.0,     // 11' clear height
  ff: 13.5,         // first-floor level (6" slab)
  ffCeil: 24.0,
  roof: 24.5,
  parapet: 27.5,
  mumtyCeil: 32.5,
  mumtyTop: 33.0,
};

// Sill / head heights for each opening type (absolute y)
export const OPENING = {
  door: [LV.gf, LV.gf + 7.0],
  main: [LV.gf, LV.gf + 7.0],
  arch: [LV.gf, LV.gf + 7.0],
  win:  [LV.gf + 3.0, LV.gf + 7.0],
  kwin: [LV.gf + 3.5, LV.gf + 7.0],
  vent: [LV.gf + 6.0, LV.gf + 7.5],
  swin: [LV.gf + 4.9, LV.gf + 10.9],
};

// Plot: 35'-5" wide, 48'-9" deep on the left, 47'-2" on the right (slanted rear)
export const PLOT = {
  width: 35.417,
  rearLeft: -48.748,
  rearRight: -47.164,
  plotFront: 1.0,   // plot line is 1' in front of the building line
};

/** z of the (slanted) rear boundary at a given x */
export const rearZ = (x) => PLOT.rearLeft + (PLOT.rearRight - PLOT.rearLeft) * (x / PLOT.width);
export const REAR_T = 0.79; // rear wall thickness

// Double-height space over the dining area, the kitchen and the middle of the hall:
// there is no first-floor slab here, so it rises to the roof. It reaches forward to
// the first-floor edge beam on grid F, where a railing overlooks it. The old garden
// bay beside it keeps a normal ceiling (the first-floor slab runs over it).
export const VOID = {
  x0: 12.231,        // grid 2: hall side of the bedroom-1 wall, carried on to the rear wall
  x1: 34.581,        // inside face of the east wall
  zFront: -38.321,   // line of the kitchen / bedroom-2 wall
  hallX1: 22.174,    // between the bedroom walls the space reaches further forward over the hall…
  hallFront: -31.326, // …to the edge beam on grid F (its back face, flush with column F2)
  glassSill: LV.gf + 7.0, // rear wall: solid up to door height, glass above
};

// The old garden bay, now part of the hall at ground level, single height.
export const BAY = { x0: 6.643, x1: VOID.x0, zFront: -43.689 };

// Columns standing in the slanted rear wall, full height: grid 2 (added so the bay's
// slab edge and the rear beam are carried) and grid 5 (B5). [x0, x1] on plan; each is
// 10" deep, flush with the outer face of the wall.
export const REAR_COLS = [[11.439, 12.231], [22.174, 22.922]];
export const REAR_COL_D = 10 / 12;

/** Plan outline of the double-height space (inside wall faces) as [x, z] points. */
export function voidOutline() {
  return [
    [VOID.x0, rearZ(VOID.x0) + REAR_T],
    [VOID.x1, rearZ(VOID.x1) + REAR_T],
    [VOID.x1, VOID.zFront],
    [VOID.hallX1, VOID.zFront],
    [VOID.hallX1, VOID.hallFront],
    [VOID.x0, VOID.hallFront],
  ];
}

// Pipe line area beside the guest room: a plumbing shaft open to the sky, cut
// through the first-floor slab and the roof as in the original drawing.
// x0..x1 / z0..z1 = inside faces of its walls; wall = thickness of the walls round it.
export const DUCT = { x0: 32.382, x1: 35.021, z0: -20.282, z1: -9.635, wall: 0.792 };

/** Plan outline of the pipe line shaft as [x, z] points. */
export const ductOutline = () => [[DUCT.x0, DUCT.z1], [DUCT.x1, DUCT.z1], [DUCT.x1, DUCT.z0], [DUCT.x0, DUCT.z0]];

/** Is the plan point inside the pipe line shaft (or on its edge, within tol)? */
export const inDuct = (x, z, tol = 0.05) => x > DUCT.x0 - tol && x < DUCT.x1 + tol && z > DUCT.z0 - tol && z < DUCT.z1 + tol;

// Staircase (dog-legged, 2 flights of 10 risers from GF to FF)
export const STAIR = {
  x0: 15.619, x1: 34.581, z0: -8.843, z1: -0.792,
  firstRiser: 23.05, landingX: 30.67,
  flight1: [-8.843, -4.95],
  flight2: [-4.70, -0.792],
  risers: 20,
};
STAIR.tread = (STAIR.landingX - STAIR.firstRiser) / 9;
STAIR.rise = (LV.ff - LV.gf) / STAIR.risers;

export const HOUSE_CENTER = { x: 17.7, z: -24 };

// Palette sampled from the supplied elevation render (lightened to albedo)
export const COLORS = {
  sage: 0x7f8b76,
  sageDark: 0x6d7866,
  tan: 0xb9a985,
  tanDark: 0x9b8c6c,
  white: 0xf3f3ef,
  soffit: 0x3b3d40,
  siding: 0x3d4045,
  wood: 0x7a5c3e,
  woodDark: 0x5a4330,
  metal: 0x7e8489,
  glassBlue: 0x6f86d6,
};
