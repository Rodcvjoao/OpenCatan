// Farm cluster for wheat (GRAIN) tiles. A coherent farmstead compound
// (barn + silo + trough + hay bales), a landmark windmill, a tractor
// looping on tire-track dirt paths through the wheat field, and a scatter
// of wheat stalks filling the open area. Adapted from a Gemini-generated
// "Little 3D Farm" prototype and scaled to fit a single hex tile
// (HEX_SIZE = 7, so ~14 world units across).

import * as THREE from "three";

import { HEX_SIZE } from "../../config";
import { mulberry32 } from "../rand";
import { pushAnimatedTractor, pushAnimatedWindmill } from "../scene";

// ======== Barn geometries ========
const barnShape = new THREE.Shape();
barnShape.moveTo(-5, 0);
barnShape.lineTo(5, 0);
barnShape.lineTo(5, 5);
barnShape.lineTo(3, 8);
barnShape.lineTo(0, 9.5);
barnShape.lineTo(-3, 8);
barnShape.lineTo(-5, 5);
barnShape.lineTo(-5, 0);
export const barnBodyGeo = new THREE.ExtrudeGeometry(barnShape, {
  depth: 12,
  bevelEnabled: true,
  bevelSegments: 2,
  steps: 1,
  bevelSize: 0.1,
  bevelThickness: 0.1,
});
barnBodyGeo.translate(0, 0, -6);

const barnRoofShape = new THREE.Shape();
barnRoofShape.moveTo(-5.4, 4.8);
barnRoofShape.lineTo(-3.2, 8.2);
barnRoofShape.lineTo(0, 9.9);
barnRoofShape.lineTo(3.2, 8.2);
barnRoofShape.lineTo(5.4, 4.8);
barnRoofShape.lineTo(4.8, 4.5);
barnRoofShape.lineTo(2.8, 7.7);
barnRoofShape.lineTo(0, 9.2);
barnRoofShape.lineTo(-2.8, 7.7);
barnRoofShape.lineTo(-4.8, 4.5);
barnRoofShape.lineTo(-5.4, 4.8);
export const barnRoofGeo = new THREE.ExtrudeGeometry(barnRoofShape, {
  depth: 13,
  bevelEnabled: false,
});
barnRoofGeo.translate(0, 0, -6.5);

export const barnDoorGeo = new THREE.BoxGeometry(2.4, 4, 0.1);
export const barnDoorBraceGeo = new THREE.BoxGeometry(0.2, 4.4, 0.15);
export const barnDoorFrameTopGeo = new THREE.BoxGeometry(5.2, 0.3, 0.15);
export const barnDoorFrameSideGeo = new THREE.BoxGeometry(0.3, 4.3, 0.15);
export const barnLoftFrameGeo = new THREE.BoxGeometry(1.6, 1.6, 0.15);
export const barnLoftWindowGeo = new THREE.BoxGeometry(1.2, 1.2, 0.1);

// ======== Silo geometries ========
export const siloBodyGeo = new THREE.CylinderGeometry(3, 3, 14, 32);
export const siloRibGeo = new THREE.TorusGeometry(3.02, 0.08, 8, 32);
export const siloDomeGeo = new THREE.SphereGeometry(
  3.1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2,
);
export const siloCapGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.5);
export const siloTubeGeo = new THREE.CylinderGeometry(0.3, 0.3, 13);
export const siloTubeTopGeo = new THREE.CylinderGeometry(0.3, 0.3, 2.5);

// ======== Windmill geometries ========
export const windmillBaseGeo = new THREE.CylinderGeometry(0.5, 2, 12, 4);
export const windmillHeadGeo = new THREE.BoxGeometry(1.5, 1.5, 2);
export const windmillBladeGeo = new THREE.BoxGeometry(0.2, 9, 0.8);

// ======== Hay bale geometries ========
export const hayBaleGeo = new THREE.BoxGeometry(1.6, 1.0, 1.2);
export const hayStringGeo = new THREE.BoxGeometry(0.05, 1.05, 1.25);

// ======== Water trough geometries ========
export const troughBaseGeo = new THREE.BoxGeometry(4, 0.1, 2);
export const troughLongSideGeo = new THREE.BoxGeometry(4, 1, 0.2);
export const troughShortSideGeo = new THREE.BoxGeometry(0.2, 1, 1.6);
export const troughWaterGeo = new THREE.PlaneGeometry(3.6, 1.6);

// ======== Wheat stalk geometry (shared across InstancedMeshes) ========
export const wheatStalkGeo = new THREE.BoxGeometry(0.1, 2, 0.1);

// ======== Tractor geometries ========
export const tractorBaseGeo = new THREE.BoxGeometry(2.5, 1, 5);
export const tractorEngineGeo = new THREE.BoxGeometry(2, 1.2, 2.5);
export const tractorPipeGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.5);
export const tractorCabinGeo = new THREE.BoxGeometry(2.4, 2, 2.4);
export const tractorPillarGeo = new THREE.BoxGeometry(0.2, 2, 0.2);
export const tractorRoofGeo = new THREE.BoxGeometry(2.6, 0.2, 2.6);
export const tractorRearTireGeo = new THREE.CylinderGeometry(1.4, 1.4, 0.8, 16);
export const tractorRearRimGeo = new THREE.CylinderGeometry(0.84, 0.84, 0.85, 12);
export const tractorFrontTireGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.6, 16);
export const tractorFrontRimGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.65, 12);

// ======== Materials ========
export const barnRedMat = new THREE.MeshStandardMaterial({
  color: 0xa52a2a, roughness: 0.9,
});
export const barnRoofMat = new THREE.MeshStandardMaterial({
  color: 0x2f4f4f, roughness: 0.7,
});
export const barnDoorMat = new THREE.MeshStandardMaterial({ color: 0x8b2323 });
export const whiteTrimMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
export const darkWindowMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
export const siloBodyMat = new THREE.MeshStandardMaterial({
  color: 0xcccccc, metalness: 0.6, roughness: 0.4,
});
export const siloDarkMat = new THREE.MeshStandardMaterial({
  color: 0x888888, metalness: 0.7, roughness: 0.5,
});
export const siloTubeMat = new THREE.MeshStandardMaterial({
  color: 0x999999, metalness: 0.8, roughness: 0.2,
});
export const farmWoodMat = new THREE.MeshStandardMaterial({
  color: 0x8b4513, roughness: 0.9,
});
export const farmDarkWoodMat = new THREE.MeshStandardMaterial({
  color: 0x3d2314, roughness: 0.9,
});
export const hayMat = new THREE.MeshStandardMaterial({
  color: 0xdaa520, roughness: 1,
});
export const hayStringMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
export const wheatStalkMat = new THREE.MeshStandardMaterial({
  color: 0xffd700, roughness: 0.8,
});
export const troughWaterMat = new THREE.MeshStandardMaterial({
  color: 0x1ca3ec, transparent: true, opacity: 0.8, roughness: 0.1,
});
export const tractorBodyMat = new THREE.MeshStandardMaterial({
  color: 0x228b22,
});
export const tractorTrimMat = new THREE.MeshStandardMaterial({
  color: 0xffd700,
});
export const tractorTireMat = new THREE.MeshStandardMaterial({
  color: 0x222222,
});
export const tractorGlassMat = new THREE.MeshStandardMaterial({
  color: 0x87cefa, transparent: true, opacity: 0.6,
});
export const tractorDarkGreyMat = new THREE.MeshStandardMaterial({
  color: 0x555555,
});

// ======== Builders ========

function buildBarn(): THREE.Group {
  const g = new THREE.Group();

  const body = new THREE.Mesh(barnBodyGeo, barnRedMat);
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  const roof = new THREE.Mesh(barnRoofGeo, barnRoofMat);
  roof.castShadow = true;
  g.add(roof);

  const door = new THREE.Group();
  door.position.set(0, 0, 6.1);

  const leftDoor = new THREE.Mesh(barnDoorGeo, barnDoorMat);
  leftDoor.position.set(-1.25, 2, 0);
  door.add(leftDoor);

  const rightDoor = new THREE.Mesh(barnDoorGeo, barnDoorMat);
  rightDoor.position.set(1.25, 2, 0);
  door.add(rightDoor);

  const addBrace = (xPos: number, rot: number): void => {
    const brace = new THREE.Mesh(barnDoorBraceGeo, whiteTrimMat);
    brace.position.set(xPos, 2, 0.05);
    brace.rotation.z = rot;
    door.add(brace);
  };
  addBrace(-1.25, Math.PI / 6);
  addBrace(-1.25, -Math.PI / 6);
  addBrace(1.25, Math.PI / 6);
  addBrace(1.25, -Math.PI / 6);

  const frameTop = new THREE.Mesh(barnDoorFrameTopGeo, whiteTrimMat);
  frameTop.position.set(0, 4.15, 0.05);
  door.add(frameTop);

  const frameLeft = new THREE.Mesh(barnDoorFrameSideGeo, whiteTrimMat);
  frameLeft.position.set(-2.45, 2.15, 0.05);
  door.add(frameLeft);

  const frameRight = new THREE.Mesh(barnDoorFrameSideGeo, whiteTrimMat);
  frameRight.position.set(2.45, 2.15, 0.05);
  door.add(frameRight);

  const loftFrame = new THREE.Mesh(barnLoftFrameGeo, whiteTrimMat);
  loftFrame.position.set(0, 6.5, 0.05);
  door.add(loftFrame);

  const loftWin = new THREE.Mesh(barnLoftWindowGeo, darkWindowMat);
  loftWin.position.set(0, 6.5, 0.06);
  door.add(loftWin);

  g.add(door);
  return g;
}

function buildSilo(): THREE.Group {
  const g = new THREE.Group();

  const body = new THREE.Mesh(siloBodyGeo, siloBodyMat);
  body.position.y = 7;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  for (let i = 1; i <= 13; i += 1.5) {
    const rib = new THREE.Mesh(siloRibGeo, siloBodyMat);
    rib.position.y = i;
    rib.rotation.x = Math.PI / 2;
    rib.castShadow = true;
    g.add(rib);
  }

  const dome = new THREE.Mesh(siloDomeGeo, siloDarkMat);
  dome.position.y = 14;
  dome.castShadow = true;
  g.add(dome);

  const cap = new THREE.Mesh(siloCapGeo, siloDarkMat);
  cap.position.y = 17.1;
  g.add(cap);

  // Feed tube pointing back toward the barn (negative X is where the barn
  // sits in our layout).
  const tube = new THREE.Mesh(siloTubeGeo, siloTubeMat);
  tube.position.set(-3.2, 6.5, 0);
  tube.castShadow = true;
  g.add(tube);

  const tubeTop = new THREE.Mesh(siloTubeTopGeo, siloTubeMat);
  tubeTop.position.set(-2.5, 13.5, 0);
  tubeTop.rotation.z = -Math.PI / 4;
  tubeTop.castShadow = true;
  g.add(tubeTop);

  return g;
}

function buildWindmill(): THREE.Group {
  const g = new THREE.Group();

  const base = new THREE.Mesh(windmillBaseGeo, farmWoodMat);
  base.position.y = 6;
  base.rotation.y = Math.PI / 4;
  base.castShadow = true;
  g.add(base);

  const head = new THREE.Mesh(windmillHeadGeo, farmDarkWoodMat);
  head.position.set(0, 12, 0);
  head.castShadow = true;
  g.add(head);

  const blades = new THREE.Group();
  blades.position.set(0, 12, 1.2);

  const blade1 = new THREE.Mesh(windmillBladeGeo, whiteTrimMat);
  blade1.castShadow = true;
  blades.add(blade1);

  const blade2 = new THREE.Mesh(windmillBladeGeo, whiteTrimMat);
  blade2.rotation.z = Math.PI / 2;
  blade2.castShadow = true;
  blades.add(blade2);

  g.add(blades);
  pushAnimatedWindmill(blades);
  return g;
}

function buildWaterTrough(): THREE.Group {
  const g = new THREE.Group();

  const base = new THREE.Mesh(troughBaseGeo, farmDarkWoodMat);
  base.position.y = 0.05;
  base.castShadow = true;
  g.add(base);

  const side1 = new THREE.Mesh(troughLongSideGeo, farmDarkWoodMat);
  side1.position.set(0, 0.5, 0.9);
  side1.castShadow = true;
  g.add(side1);

  const side2 = new THREE.Mesh(troughLongSideGeo, farmDarkWoodMat);
  side2.position.set(0, 0.5, -0.9);
  side2.castShadow = true;
  g.add(side2);

  const side3 = new THREE.Mesh(troughShortSideGeo, farmDarkWoodMat);
  side3.position.set(1.9, 0.5, 0);
  side3.castShadow = true;
  g.add(side3);

  const side4 = new THREE.Mesh(troughShortSideGeo, farmDarkWoodMat);
  side4.position.set(-1.9, 0.5, 0);
  side4.castShadow = true;
  g.add(side4);

  const water = new THREE.Mesh(troughWaterGeo, troughWaterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.8;
  g.add(water);

  return g;
}

function buildHayBale(rotY: number): THREE.Group {
  const g = new THREE.Group();

  const bale = new THREE.Mesh(hayBaleGeo, hayMat);
  bale.castShadow = true;
  bale.receiveShadow = true;
  g.add(bale);

  const s1 = new THREE.Mesh(hayStringGeo, hayStringMat);
  s1.position.x = -0.4;
  g.add(s1);

  const s2 = new THREE.Mesh(hayStringGeo, hayStringMat);
  s2.position.x = 0.4;
  g.add(s2);

  g.rotation.y = rotY;
  return g;
}

export interface TractorWheel {
  mesh: THREE.Object3D;
  radius: number;
}

function buildTractor(): { group: THREE.Group; wheels: TractorWheel[] } {
  const group = new THREE.Group();
  const wheels: TractorWheel[] = [];

  const base = new THREE.Mesh(tractorBaseGeo, tractorBodyMat);
  base.position.set(0, 1.5, 0);
  base.castShadow = true;
  group.add(base);

  const engine = new THREE.Mesh(tractorEngineGeo, tractorBodyMat);
  engine.position.set(0, 2.6, 1.25);
  engine.castShadow = true;
  group.add(engine);

  const pipe = new THREE.Mesh(tractorPipeGeo, tractorDarkGreyMat);
  pipe.position.set(0.7, 3.8, 2);
  pipe.castShadow = true;
  group.add(pipe);

  const cabin = new THREE.Mesh(tractorCabinGeo, tractorGlassMat);
  cabin.position.set(0, 3.1, -1.2);
  cabin.castShadow = true;
  group.add(cabin);

  const pillarPositions: Array<[number, number, number]> = [
    [-1.1, 3.1, -0.1],
    [1.1, 3.1, -0.1],
    [-1.1, 3.1, -2.3],
    [1.1, 3.1, -2.3],
  ];
  for (const [px, py, pz] of pillarPositions) {
    const pillar = new THREE.Mesh(tractorPillarGeo, tractorBodyMat);
    pillar.position.set(px, py, pz);
    pillar.castShadow = true;
    group.add(pillar);
  }

  const roof = new THREE.Mesh(tractorRoofGeo, tractorTrimMat);
  roof.position.set(0, 4.2, -1.2);
  roof.castShadow = true;
  group.add(roof);

  const addWheel = (
    tireGeo: THREE.BufferGeometry,
    rimGeo: THREE.BufferGeometry,
    radius: number,
    x: number,
    z: number,
  ): void => {
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(x, radius, z);

    const tire = new THREE.Mesh(tireGeo, tractorTireMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    wheelGroup.add(tire);

    const rim = new THREE.Mesh(rimGeo, tractorTrimMat);
    rim.rotation.z = Math.PI / 2;
    wheelGroup.add(rim);

    group.add(wheelGroup);
    wheels.push({ mesh: wheelGroup, radius });
  };

  // Rear (big) wheels
  addWheel(tractorRearTireGeo, tractorRearRimGeo, 1.4, 1.5, -1.5);
  addWheel(tractorRearTireGeo, tractorRearRimGeo, 1.4, -1.5, -1.5);
  // Front (small) wheels
  addWheel(tractorFrontTireGeo, tractorFrontRimGeo, 0.8, 1.4, 1.8);
  addWheel(tractorFrontTireGeo, tractorFrontRimGeo, 0.8, -1.4, 1.8);

  return { group, wheels };
}

function insideHexInset(
  x: number,
  z: number,
  maxEdgeDist: number,
): boolean {
  for (let i = 0; i < 6; i++) {
    const theta = (i * Math.PI) / 3;
    const d = x * Math.cos(theta) + z * Math.sin(theta);
    if (d > maxEdgeDist || d < -maxEdgeDist) return false;
  }
  return true;
}

/** Uniform scale applied to the whole farm group so Gemini-scale buildings
 *  fit inside a single ~14-unit hex. */
const FARM_SCALE = 0.22;

// ============================================================================
// Coherent farmstead layout (farm-local coords, before FARM_SCALE + rotation).
// Everything in the "compound" clusters to the north (negative Z); the open
// wheat field sits to the south (positive Z) where the tractor loops.
// ============================================================================
const BARN_POS = { x: -3, z: -4 };     // anchor. doors face +Z (south).
const SILO_POS = { x: 5,  z: -4 };     // attached to east side of barn
const TROUGH_POS = { x: -10, z: -4 };  // tucked against barn's west wall
const HAY_BALES_POS = { x: 10, z: -2 };// east, next to silo
const WINDMILL_POS = { x: -12, z: -9 };// far northwest corner (landmark)

interface Obstacle {
  /** Farm-local x (before rotation / FARM_SCALE). */
  lx: number;
  /** Farm-local z. */
  lz: number;
  /** Farm-local keep-out radius. Includes a small margin. */
  r: number;
}

/** Farm-local obstacle positions. Wheat stalks are rejected inside these
 *  rotated+scaled circles so they don't grow through buildings. */
const OBSTACLES: Obstacle[] = [
  { lx: BARN_POS.x,      lz: BARN_POS.z,      r: 7.5 }, // barn (body 10x12)
  { lx: SILO_POS.x,      lz: SILO_POS.z,      r: 4 },   // silo
  { lx: TROUGH_POS.x,    lz: TROUGH_POS.z,    r: 2.5 }, // trough
  { lx: HAY_BALES_POS.x, lz: HAY_BALES_POS.z, r: 3 },   // hay pile
  { lx: WINDMILL_POS.x,  lz: WINDMILL_POS.z,  r: 3 },   // windmill
];

/** Waypoints for the tractor's closed path through the wheat field. Pushed
 *  well to the south of the compound so the tractor doesn't buzz around
 *  the barn's doorstep. No visible tracks are drawn; wheat stalks avoid
 *  the driving area so the tractor doesn't clip through stalks. */
const TRACTOR_PATH_POINTS: Array<[number, number]> = [
  [6,  14],
  [10, 17],
  [6,  20],
  [-2, 20],
  [-9, 17],
  [-9, 13],
  [-5, 11],
  [2,  11],
];

export function createFarmCluster(tileId: number | string): THREE.Group {
  const cluster = new THREE.Group();

  // Seeded RNG so the same tile always looks the same across rebuilds.
  let seed = 5501;
  if (typeof tileId === "number") {
    seed = (tileId * 2246822519) >>> 0;
  } else if (typeof tileId === "string") {
    for (let i = 0; i < tileId.length; i++) {
      seed = (Math.imul(seed, 37) + tileId.charCodeAt(i)) >>> 0;
    }
  }
  const rand = mulberry32(seed || 1);

  // Random rotation so farms on different hexes look different.
  const farmRotation = rand() * Math.PI * 2;
  const farm = new THREE.Group();
  farm.rotation.y = farmRotation;
  farm.scale.setScalar(FARM_SCALE);
  cluster.add(farm);

  // --- Compound (north half of farm) ---
  const barn = buildBarn();
  barn.position.set(BARN_POS.x, 0, BARN_POS.z);
  farm.add(barn);

  const silo = buildSilo();
  silo.position.set(SILO_POS.x, 0, SILO_POS.z);
  farm.add(silo);

  const trough = buildWaterTrough();
  trough.position.set(TROUGH_POS.x, 0, TROUGH_POS.z);
  trough.rotation.y = Math.PI / 2; // long side runs along the barn's west wall
  farm.add(trough);

  // Hay bale pyramid stack (classic look: 3 on bottom, 2 above, centered)
  const baleSpots: Array<[number, number, number, number]> = [
    [HAY_BALES_POS.x - 1, 0.5, HAY_BALES_POS.z, 0],
    [HAY_BALES_POS.x,     0.5, HAY_BALES_POS.z + 0.2, 0.15],
    [HAY_BALES_POS.x + 1, 0.5, HAY_BALES_POS.z - 0.1, -0.12],
    [HAY_BALES_POS.x - 0.4, 1.5, HAY_BALES_POS.z + 0.1, 0.08],
    [HAY_BALES_POS.x + 0.6, 1.5, HAY_BALES_POS.z - 0.15, -0.05],
  ];
  for (const [bx, by, bz, br] of baleSpots) {
    const b = buildHayBale(br);
    b.position.set(bx, by, bz);
    farm.add(b);
  }

  // Windmill (landmark, far from the compound)
  const windmill = buildWindmill();
  windmill.position.set(WINDMILL_POS.x, 0, WINDMILL_POS.z);
  farm.add(windmill);

  // --- Tractor path (invisible; wheat stalks avoid it so the tractor
  //     doesn't clip through them while driving) ---
  const pathPoints = TRACTOR_PATH_POINTS.map(
    ([x, z]) => new THREE.Vector3(x, 0, z),
  );
  const path = new THREE.CatmullRomCurve3(pathPoints, true);
  path.curveType = "catmullrom";
  path.tension = 0.4;
  const pathLength = path.getLength();

  const { group: tractor, wheels } = buildTractor();
  // Start the tractor somewhere along its loop so neighbors aren't synced.
  const tractorPhase = rand();
  tractor.userData = {
    path,
    pathLength,
    wheels,
    loopTime: 18 + rand() * 8, // 18-26 seconds per loop
    offset: tractorPhase * 20,
  };
  farm.add(tractor);
  pushAnimatedTractor(tractor);

  // --- Wheat stalks in hex-local space ---
  // Rotate the farm-local obstacles (plus the tractor path midpoints) into
  // hex-local space so stalks can avoid both buildings and the tractor's
  // tire tracks.
  const cosR = Math.cos(farmRotation);
  const sinR = Math.sin(farmRotation);
  const staticObstacles = OBSTACLES.map((o) => ({
    x: (cosR * o.lx - sinR * o.lz) * FARM_SCALE,
    z: (sinR * o.lx + cosR * o.lz) * FARM_SCALE,
    r: o.r * FARM_SCALE,
  }));
  // Sample the path densely and treat each sample as a small obstacle so
  // stalks don't grow on the dirt tracks. 60 samples over the loop covers
  // it for a 0.4-radius tube.
  const pathObstacles: Array<{ x: number; z: number; r: number }> = [];
  const PATH_SAMPLES = 60;
  const tempSample = new THREE.Vector3();
  for (let i = 0; i < PATH_SAMPLES; i++) {
    path.getPointAt(i / PATH_SAMPLES, tempSample);
    pathObstacles.push({
      x: (cosR * tempSample.x - sinR * tempSample.z) * FARM_SCALE,
      z: (sinR * tempSample.x + cosR * tempSample.z) * FARM_SCALE,
      r: 0.7 * FARM_SCALE,
    });
  }
  const obstacles = [...staticObstacles, ...pathObstacles];

  const apothem = HEX_SIZE * Math.cos(Math.PI / 6);
  const stalkInset = 0.5;
  const maxEdgeDist = apothem - stalkInset;

  // Small, dense wheat carpet: lots of short, thin stalks. The field
  // should feel like a crop, not a patch of bamboo.
  const maxStalks = 450;
  const stalksMesh = new THREE.InstancedMesh(
    wheatStalkGeo,
    wheatStalkMat,
    maxStalks,
  );
  stalksMesh.castShadow = true;
  stalksMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);

  const dummy = new THREE.Object3D();
  let placed = 0;
  let attempts = 0;
  while (placed < maxStalks && attempts < 6000) {
    attempts++;
    const x = (rand() * 2 - 1) * HEX_SIZE;
    const z = (rand() * 2 - 1) * HEX_SIZE;
    if (!insideHexInset(x, z, maxEdgeDist)) continue;

    let blocked = false;
    for (const o of obstacles) {
      const dx = x - o.x;
      const dz = z - o.z;
      if (dx * dx + dz * dz < o.r * o.r) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    // Stalk geo is 0.1 x 2 x 0.1. With yScale ~0.18 the total height is
    // ~0.36 world units (quarter the barn's doorway height); width
    // multiplier 0.3 keeps the stalks nice and slender.
    const yScale = 0.14 + rand() * 0.12;
    dummy.position.set(x, yScale, z);
    dummy.rotation.y = rand() * Math.PI;
    dummy.rotation.z = (rand() - 0.5) * 0.2;
    dummy.scale.set(0.3, yScale, 0.3);
    dummy.updateMatrix();
    stalksMesh.setMatrixAt(placed, dummy.matrix);
    placed++;
  }
  stalksMesh.count = placed;
  cluster.add(stalksMesh);

  return cluster;
}
