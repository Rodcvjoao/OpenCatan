// Brickyard cluster for brick (BRICK) tiles. A Catan Hills tile imagined
// as a working clay quarry: terraced clay slabs with a mine tunnel into
// the cliff, a wooden crane on the peak, a stone kiln with a glowing
// fire, stacks of fired bricks on pallets, and a minecart that circles
// the pit on iron rails. Adapted from a Gemini-generated "Catan Brick
// Hex" prototype and scaled to fit inside a single hex tile.

import * as THREE from "three";

import { mulberry32 } from "../rand";
import { pushAnimatedMinecart } from "../scene";

// ======== Shared cluster scale ========

/** Uniform scale applied to the whole cluster group. The Gemini mock uses
 *  a hex of radius ~22 units; we shrink to fit inside a game hex (world
 *  radius 7). 0.22 matches the farms cluster so the two visually rhyme. */
const CLUSTER_SCALE = 0.22;

// ======== Track radius (cluster-local units) ========
/** Radius of the minecart's circular rail, in cluster-local coordinates
 *  (i.e. before CLUSTER_SCALE is applied). */
const TRACK_RADIUS = 11;

// ======== Geometries (shared across all clusters) ========

// Unit slab: CylinderGeometry with a slightly narrower top to read as a
// quarried rock platform. Scaled per-instance by (radius, height, radius).
export const claySlabGeo = new THREE.CylinderGeometry(0.9, 1, 1, 7);

// Mine tunnel
export const mineHoleGeo = new THREE.PlaneGeometry(3.5, 4);
export const minePostGeo = new THREE.BoxGeometry(0.4, 4, 0.4);
export const mineBeamGeo = new THREE.BoxGeometry(4.2, 0.4, 0.4);

// Rubble instance shape
export const rubbleGeo = new THREE.DodecahedronGeometry(0.3, 0);

// Pickaxe
export const pickaxeHandleGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.8);
export const pickaxeHeadGeo = new THREE.BoxGeometry(1.4, 0.15, 0.15);

// Crane
export const craneMastGeo = new THREE.CylinderGeometry(0.25, 0.25, 6);
export const craneArmGeo = new THREE.CylinderGeometry(0.18, 0.18, 9);
export const craneRopeGeo = new THREE.CylinderGeometry(0.03, 0.03, 8);
export const craneBucketGeo = new THREE.CylinderGeometry(0.6, 0.4, 0.8);
export const craneSupportGeo = new THREE.BoxGeometry(2.5, 0.4, 2.5);

// Kiln
export const kilnBaseGeo = new THREE.CylinderGeometry(4, 4.5, 4, 8);
export const kilnDomeGeo = new THREE.CylinderGeometry(2, 4, 3, 8);
export const kilnChimneyGeo = new THREE.CylinderGeometry(0.8, 1.2, 4, 8);
export const kilnArchGeo = new THREE.BoxGeometry(2.5, 2.5, 0.5);
export const kilnFireGeo = new THREE.BoxGeometry(1.8, 1.8, 0.6);

// Brick (single brick, drawn as an InstancedMesh at the cluster level)
export const brickGeo = new THREE.BoxGeometry(0.6, 0.2, 0.3);

// Rails and ties
export const trackRailGeo = new THREE.TorusGeometry(TRACK_RADIUS, 0.1, 4, 32);
export const trackTieGeo = new THREE.BoxGeometry(2.4, 0.15, 0.4);

// Minecart
export const minecartBoxGeo = new THREE.BoxGeometry(2.2, 1.2, 3);
export const minecartRimGeo = new THREE.BoxGeometry(2.3, 0.2, 3.1);
export const minecartLoadGeo = new THREE.BoxGeometry(1.8, 0.8, 2.6);
export const minecartLumpGeo = new THREE.DodecahedronGeometry(0.8);
export const minecartWheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.2, 16);

// ======== Materials ========

export const claySurfaceMat = new THREE.MeshStandardMaterial({
  color: 0xa0522d, roughness: 0.9,
});
export const clayHill1Mat = new THREE.MeshStandardMaterial({
  color: 0x8b4513, roughness: 1,
});
export const clayHill2Mat = new THREE.MeshStandardMaterial({
  color: 0xcd5c5c, roughness: 0.9,
});
export const brickMat = new THREE.MeshStandardMaterial({
  color: 0xb22222, roughness: 0.8,
});
export const quarryWoodMat = new THREE.MeshStandardMaterial({
  color: 0x5c4033, roughness: 0.9,
});
export const quarryStoneMat = new THREE.MeshStandardMaterial({
  color: 0x778899, roughness: 0.7,
});
export const quarryDarkStoneMat = new THREE.MeshStandardMaterial({
  color: 0x2f4f4f, roughness: 0.8,
});
export const quarryIronMat = new THREE.MeshStandardMaterial({
  color: 0x434b4d, metalness: 0.6, roughness: 0.4,
});
export const quarryRopeMat = new THREE.MeshStandardMaterial({
  color: 0xdeb887, roughness: 1,
});
/** MeshBasic so the fire glows regardless of scene lighting. */
export const glowingFireMat = new THREE.MeshBasicMaterial({ color: 0xff4500 });
/** MeshBasic so the mine mouth stays pitch black. */
export const mineDarkMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

// ======== Builders (cluster-local coords) ========

function addSlab(
  group: THREE.Group,
  x: number,
  y: number,
  z: number,
  radius: number,
  height: number,
  scaleZ: number,
  rotY: number,
  mat: THREE.Material,
): void {
  const mesh = new THREE.Mesh(claySlabGeo, mat);
  mesh.scale.set(radius, height, radius * scaleZ);
  mesh.position.set(x, y + height / 2, z);
  mesh.rotation.y = rotY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
}

function buildClayHills(): THREE.Group {
  const g = new THREE.Group();
  // Tier 1 (base)
  addSlab(g, -11, 0,   11, 8.5, 2.5, 0.9,  Math.PI / 4, clayHill1Mat);
  addSlab(g, -15, 0,   4,  7.5, 2.2, 1.1,  Math.PI / 6, clayHill2Mat);
  addSlab(g, -4,  0,   15, 7.5, 2.0, 0.8, -Math.PI / 8, clayHill2Mat);
  // Tier 2
  addSlab(g, -12, 2.2, 12, 7.0, 2.5, 0.9,  Math.PI / 3, clayHill1Mat);
  addSlab(g, -16, 2.0, 6,  6.0, 2.5, 1.0,  Math.PI / 7, claySurfaceMat);
  addSlab(g, -6,  1.8, 16, 5.5, 2.2, 0.85, -Math.PI / 6, clayHill1Mat);
  // Tier 3
  addSlab(g, -13, 4.5, 13, 5.5, 2.5, 0.95, Math.PI / 5, clayHill2Mat);
  addSlab(g, -17, 4.2, 9,  4.5, 2.5, 1.05, 0,           clayHill1Mat);
  // Tier 4 (peak) — lands the crane's support
  addSlab(g, -15, 6.8, 15, 4.0, 2.8, 1.0,  Math.PI / 7, clayHill1Mat);
  return g;
}

function buildMineTunnel(): THREE.Group {
  const tunnel = new THREE.Group();
  tunnel.position.set(-5.5, 0.5, 5.5);
  tunnel.rotation.y = Math.PI / 4;

  const hole = new THREE.Mesh(mineHoleGeo, mineDarkMat);
  hole.position.set(0, 1.5, 0.1);
  tunnel.add(hole);

  const leftPost = new THREE.Mesh(minePostGeo, quarryWoodMat);
  leftPost.position.set(-1.9, 1.5, 0.2);
  leftPost.castShadow = true;
  tunnel.add(leftPost);

  const rightPost = new THREE.Mesh(minePostGeo, quarryWoodMat);
  rightPost.position.set(1.9, 1.5, 0.2);
  rightPost.castShadow = true;
  tunnel.add(rightPost);

  const topBeam = new THREE.Mesh(mineBeamGeo, quarryWoodMat);
  topBeam.position.set(0, 3.5, 0.3);
  topBeam.castShadow = true;
  tunnel.add(topBeam);

  return tunnel;
}

function buildCrane(): THREE.Group {
  const crane = new THREE.Group();
  crane.position.set(-14, 9.6, 14);
  crane.rotation.y = -Math.PI / 6;

  const support = new THREE.Mesh(craneSupportGeo, quarryWoodMat);
  support.position.y = 0.2;
  support.castShadow = true;
  crane.add(support);

  const mast = new THREE.Mesh(craneMastGeo, quarryWoodMat);
  mast.position.y = 3;
  mast.castShadow = true;
  crane.add(mast);

  const arm = new THREE.Mesh(craneArmGeo, quarryWoodMat);
  arm.position.set(4, 5.5, 0);
  arm.rotation.z = Math.PI / 2.5;
  arm.castShadow = true;
  crane.add(arm);

  const rope = new THREE.Mesh(craneRopeGeo, quarryRopeMat);
  rope.position.set(7.5, 2.0, 0);
  crane.add(rope);

  const bucket = new THREE.Mesh(craneBucketGeo, quarryWoodMat);
  bucket.position.set(7.5, -2, 0);
  bucket.castShadow = true;
  crane.add(bucket);

  return crane;
}

function buildKiln(): THREE.Group {
  const kiln = new THREE.Group();
  kiln.position.set(2, 0, -3);

  const base = new THREE.Mesh(kilnBaseGeo, quarryStoneMat);
  base.position.y = 2;
  base.castShadow = true;
  base.receiveShadow = true;
  kiln.add(base);

  const dome = new THREE.Mesh(kilnDomeGeo, quarryStoneMat);
  dome.position.y = 5.5;
  dome.castShadow = true;
  kiln.add(dome);

  const chimney = new THREE.Mesh(kilnChimneyGeo, quarryDarkStoneMat);
  chimney.position.y = 9;
  chimney.castShadow = true;
  kiln.add(chimney);

  const opening = new THREE.Group();
  opening.position.set(0, 1.5, 4.1);

  const arch = new THREE.Mesh(kilnArchGeo, quarryDarkStoneMat);
  opening.add(arch);

  const fire = new THREE.Mesh(kilnFireGeo, glowingFireMat);
  fire.position.set(0, -0.2, 0.1);
  opening.add(fire);

  kiln.add(opening);
  return kiln;
}

function addPickaxe(
  group: THREE.Group,
  x: number,
  y: number,
  z: number,
  rx: number,
  ry: number,
  rz: number,
): void {
  const p = new THREE.Group();
  p.position.set(x, y, z);
  p.rotation.set(rx, ry, rz);

  const handle = new THREE.Mesh(pickaxeHandleGeo, quarryWoodMat);
  handle.position.y = 0.9;
  handle.castShadow = true;
  p.add(handle);

  const head = new THREE.Mesh(pickaxeHeadGeo, quarryIronMat);
  head.position.y = 1.6;
  head.castShadow = true;
  p.add(head);

  group.add(p);
}

function buildRubble(rand: () => number): THREE.InstancedMesh {
  const rubbleCount = 60;
  const rubble = new THREE.InstancedMesh(
    rubbleGeo,
    clayHill2Mat,
    rubbleCount,
  );
  rubble.castShadow = true;
  rubble.instanceMatrix.setUsage(THREE.StaticDrawUsage);

  const dummy = new THREE.Object3D();
  for (let i = 0; i < rubbleCount; i++) {
    // Wrap rubble around the base of the cliff.
    const angle = -0.2 + rand() * (Math.PI / 1.5);
    const r = 8 + rand() * 4;
    const rx = -12 + Math.cos(angle) * r;
    const rz = 12 - Math.sin(angle) * r;

    dummy.position.set(rx, 0.2 + rand() * 0.3, rz);
    dummy.rotation.set(rand(), rand(), rand());
    const s = 0.5 + rand() * 1.5;
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    rubble.setMatrixAt(i, dummy.matrix);
  }
  return rubble;
}

function buildBricksInstanced(rand: () => number): THREE.InstancedMesh {
  // 8 pallets, each a 2x4 interlocking stack 5 levels high => 320 bricks.
  // All drawn by a single InstancedMesh.
  const palletPositions: Array<{ x: number; z: number; ry: number }> = [
    { x: 12,  z: 2,   ry: 0.2 },
    { x: 14,  z: 5,   ry: -0.1 },
    { x: 10,  z: 8,   ry: 0.5 },
    { x: 15,  z: -5,  ry: 0.1 },
    { x: 12,  z: -8,  ry: -0.3 },
    { x: 5,   z: -12, ry: 0.2 },
    { x: 0,   z: -14, ry: -0.1 },
    { x: -12, z: -8,  ry: 0.6 },
  ];

  const brickLength = 0.6;
  const brickHeight = 0.2;
  const brickWidth = 0.3;
  const gap = 0.02;
  const bricksPerLayer = 8;
  const levels = 5;
  const bricksPerPallet = bricksPerLayer * levels;
  const totalBricks = palletPositions.length * bricksPerPallet;

  const mesh = new THREE.InstancedMesh(brickGeo, brickMat, totalBricks);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);

  const dummy = new THREE.Object3D();
  const yAxis = new THREE.Vector3(0, 1, 0);
  let idx = 0;

  for (const pallet of palletPositions) {
    for (let level = 0; level < levels; level++) {
      const isRotated = level % 2 === 1;
      const by = brickHeight / 2 + level * (brickHeight + gap);

      for (let i = 0; i < bricksPerLayer; i++) {
        let bx: number;
        let bz: number;
        if (!isRotated) {
          const col = i % 2;
          const row = Math.floor(i / 2);
          bx = (col - 0.5) * (brickLength + gap);
          bz = (row - 1.5) * (brickWidth + gap);
          dummy.rotation.set(0, 0, 0);
        } else {
          const col = i % 4;
          const row = Math.floor(i / 4);
          bx = (col - 1.5) * (brickWidth + gap);
          bz = (row - 0.5) * (brickLength + gap);
          dummy.rotation.set(0, Math.PI / 2, 0);
        }

        dummy.position.set(bx, by, bz);
        dummy.position.applyAxisAngle(yAxis, pallet.ry);
        dummy.position.x += pallet.x;
        dummy.position.z += pallet.z;
        dummy.rotation.y += pallet.ry;

        // Tiny jitter for a hand-stacked look.
        dummy.position.x += (rand() - 0.5) * 0.03;
        dummy.position.z += (rand() - 0.5) * 0.03;
        dummy.rotation.y += (rand() - 0.5) * 0.05;

        dummy.updateMatrix();
        mesh.setMatrixAt(idx++, dummy.matrix);
      }
    }
  }
  return mesh;
}

function buildTrack(): THREE.Group {
  const trackGroup = new THREE.Group();

  const innerRail = new THREE.Mesh(trackRailGeo, quarryIronMat);
  innerRail.rotation.x = Math.PI / 2;
  innerRail.position.y = 0.3;
  innerRail.scale.set(0.92, 0.92, 1);
  innerRail.receiveShadow = true;
  trackGroup.add(innerRail);

  const outerRail = new THREE.Mesh(trackRailGeo, quarryIronMat);
  outerRail.rotation.x = Math.PI / 2;
  outerRail.position.y = 0.3;
  outerRail.scale.set(1.08, 1.08, 1);
  outerRail.receiveShadow = true;
  trackGroup.add(outerRail);

  // Ties as a single InstancedMesh around the ring.
  const SEGMENTS = 32;
  const ties = new THREE.InstancedMesh(trackTieGeo, quarryWoodMat, SEGMENTS);
  ties.receiveShadow = true;
  ties.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < SEGMENTS; i++) {
    const angle = (i / SEGMENTS) * Math.PI * 2;
    dummy.position.set(
      Math.cos(angle) * TRACK_RADIUS,
      0.2,
      Math.sin(angle) * TRACK_RADIUS,
    );
    dummy.rotation.y = -angle;
    dummy.updateMatrix();
    ties.setMatrixAt(i, dummy.matrix);
  }
  trackGroup.add(ties);

  return trackGroup;
}

export interface MinecartWheel {
  mesh: THREE.Object3D;
  radius: number;
}

function buildMinecart(): { group: THREE.Group; wheels: MinecartWheel[] } {
  const group = new THREE.Group();
  const wheels: MinecartWheel[] = [];

  const box = new THREE.Mesh(minecartBoxGeo, quarryWoodMat);
  box.position.y = 1.2;
  box.castShadow = true;
  group.add(box);

  const rimTop = new THREE.Mesh(minecartRimGeo, quarryIronMat);
  rimTop.position.y = 1.7;
  rimTop.castShadow = true;
  group.add(rimTop);

  const rimBot = new THREE.Mesh(minecartRimGeo, quarryIronMat);
  rimBot.position.y = 0.7;
  rimBot.castShadow = true;
  group.add(rimBot);

  const clayLoad = new THREE.Mesh(minecartLoadGeo, clayHill2Mat);
  clayLoad.position.y = 1.6;
  group.add(clayLoad);

  const lump = new THREE.Mesh(minecartLumpGeo, clayHill2Mat);
  lump.position.set(0, 1.8, 0);
  lump.scale.set(1, 0.5, 1.2);
  group.add(lump);

  const addWheel = (x: number, z: number): void => {
    const wGroup = new THREE.Group();
    wGroup.position.set(x, 0.4, z);

    const wheel = new THREE.Mesh(minecartWheelGeo, quarryIronMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.castShadow = true;
    wGroup.add(wheel);

    group.add(wGroup);
    wheels.push({ mesh: wGroup, radius: 0.4 });
  };

  addWheel(1.1, 1);
  addWheel(-1.1, 1);
  addWheel(1.1, -1);
  addWheel(-1.1, -1);

  return { group, wheels };
}

// ======== Main cluster builder ========

export function createBrickyardCluster(tileId: number | string): THREE.Group {
  const cluster = new THREE.Group();

  // Seeded RNG so the same tile always looks the same across rebuilds.
  let seed = 9151;
  if (typeof tileId === "number") {
    seed = (tileId * 2246822519) >>> 0;
  } else if (typeof tileId === "string") {
    for (let i = 0; i < tileId.length; i++) {
      seed = (Math.imul(seed, 41) + tileId.charCodeAt(i)) >>> 0;
    }
  }
  const rand = mulberry32(seed || 1);

  const inner = new THREE.Group();
  inner.rotation.y = rand() * Math.PI * 2;
  inner.scale.setScalar(CLUSTER_SCALE);
  cluster.add(inner);

  // --- Static decor ---
  inner.add(buildClayHills());
  inner.add(buildMineTunnel());
  inner.add(buildCrane());
  inner.add(buildKiln());

  // Two stray pickaxes: one stuck in the ground, one leaning near the mine.
  addPickaxe(inner, -3,   0.1, 2,   Math.PI / 5, Math.PI / 3, 0);
  addPickaxe(inner, -3.5, 0.1, 7.5, 0.2,        -Math.PI / 6, 0.3);

  // Instanced rubble and brick stacks (one draw call each).
  inner.add(buildRubble(rand));
  inner.add(buildBricksInstanced(rand));

  // --- Track + minecart ---
  inner.add(buildTrack());

  const { group: cart, wheels } = buildMinecart();
  cart.userData = {
    radius: TRACK_RADIUS,
    speed: 0.35 + rand() * 0.15, // radians per second
    offset: rand() * Math.PI * 2,
    wheels,
  };
  inner.add(cart);
  pushAnimatedMinecart(cart);

  return cluster;
}
