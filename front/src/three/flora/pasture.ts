// Sheep cluster for pasture (sheep) tiles. Ported verbatim from board.html.
// Each sheep is pushed into the animatedSheep collection so animate.ts can
// drive its state machine.

import * as THREE from "three";

import { HEX_SIZE } from "../../config";
import { mulberry32 } from "../rand";
import { pushAnimatedSheep } from "../scene";

// --- Geometry ---
export const sheepBodyGeo = new THREE.BoxGeometry(2.2, 2.2, 3.0);
export const sheepHeadGeo = new THREE.BoxGeometry(0.7, 0.8, 1.2);
export const sheepEyeGeo = new THREE.SphereGeometry(0.08, 8, 8);
export const sheepEarGeo = new THREE.BoxGeometry(0.15, 0.3, 0.15);
export const sheepLegGeo = new THREE.CylinderGeometry(0.12, 0.1, 1.2, 8);
const SHEEP_SCALE = 0.28;

// --- Materials ---
export const sheepWoolMat = new THREE.MeshStandardMaterial({
  color: "#f4f4f4",
  roughness: 1.0,
  metalness: 0.0,
  flatShading: true,
});
export const sheepWoolDarkMat = new THREE.MeshStandardMaterial({
  color: "#dcdcdc",
  roughness: 1.0,
  metalness: 0.0,
  flatShading: true,
});
export const sheepFaceMat = new THREE.MeshStandardMaterial({
  color: "#222222",
  roughness: 0.5,
  metalness: 0.0,
  flatShading: true,
});
export const sheepEyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

function buildSheep(rand: () => number): THREE.Group {
  const sheep = new THREE.Group();
  const isDarkWool = rand() < 0.2;
  const woolMat = isDarkWool ? sheepWoolDarkMat : sheepWoolMat;

  const bodyGroup = new THREE.Group();
  sheep.add(bodyGroup);

  const body = new THREE.Mesh(sheepBodyGeo, woolMat);
  body.position.y = 1.8;
  body.castShadow = true;
  body.receiveShadow = true;
  bodyGroup.add(body);

  const headGroup = new THREE.Group();
  headGroup.position.set(0, 2.3, 1.6);
  bodyGroup.add(headGroup);

  const head = new THREE.Mesh(sheepHeadGeo, sheepFaceMat);
  head.castShadow = true;
  headGroup.add(head);

  const leftEye = new THREE.Mesh(sheepEyeGeo, sheepEyeMat);
  leftEye.position.set(-0.35, 0.2, 0.4);
  headGroup.add(leftEye);

  const rightEye = new THREE.Mesh(sheepEyeGeo, sheepEyeMat);
  rightEye.position.set(0.35, 0.2, 0.4);
  headGroup.add(rightEye);

  const leftEar = new THREE.Mesh(sheepEarGeo, sheepFaceMat);
  leftEar.position.set(-0.4, 0.2, -0.3);
  leftEar.rotation.z = Math.PI / 4;
  leftEar.castShadow = true;
  headGroup.add(leftEar);

  const rightEar = new THREE.Mesh(sheepEarGeo, sheepFaceMat);
  rightEar.position.set(0.4, 0.2, -0.3);
  rightEar.rotation.z = -Math.PI / 4;
  rightEar.castShadow = true;
  headGroup.add(rightEar);

  const legs: Array<{ mesh: THREE.Mesh; initialZ: number }> = [];
  const legPositions: Array<[number, number, number]> = [
    [-0.5, 0.6, 0.9],
    [0.5, 0.6, 0.9],
    [-0.5, 0.6, -0.9],
    [0.5, 0.6, -0.9],
  ];
  for (const [lx, ly, lz] of legPositions) {
    const leg = new THREE.Mesh(sheepLegGeo, sheepFaceMat);
    leg.position.set(lx, ly, lz);
    leg.castShadow = true;
    sheep.add(leg);
    legs.push({ mesh: leg, initialZ: lz });
  }

  sheep.scale.setScalar(SHEEP_SCALE);
  sheep.userData.body = bodyGroup;
  sheep.userData.head = headGroup;
  sheep.userData.legs = legs;
  sheep.userData.walkCycle = rand() * Math.PI * 2;
  return sheep;
}

interface Point2D {
  x: number;
  z: number;
}

/** Convex polygon point-inclusion test. Used both at placement time and at
 *  runtime by the sheep state machine in animate.ts. */
export function pointInConvexPoly(
  x: number,
  z: number,
  points: Point2D[],
): boolean {
  let prev = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const cross = (b.x - a.x) * (z - a.z) - (b.z - a.z) * (x - a.x);
    if (cross !== 0) {
      if (prev === 0) prev = cross;
      else if (cross > 0 !== prev > 0) return false;
    }
  }
  return true;
}

export function createPastureCluster(tileId: number | string): THREE.Group {
  const cluster = new THREE.Group();

  let seed = 31337;
  if (typeof tileId === "number") {
    seed = (tileId * 2971215073) >>> 0;
  } else if (typeof tileId === "string") {
    for (let i = 0; i < tileId.length; i++) {
      seed = (Math.imul(seed, 19) + tileId.charCodeAt(i)) >>> 0;
    }
  }
  const rand = mulberry32(seed || 1);

  const apothem = HEX_SIZE * Math.cos(Math.PI / 6);
  const edgeInset = 1.1;
  // `apothem` and `maxEdgeDist` are used only for placement bounds, not the
  // polygon-in test; we build the inset polygon directly below.
  void apothem;
  const grazingPoly: Point2D[] = [];
  for (let i = 0; i < 6; i++) {
    const ang = -Math.PI / 6 + (i * Math.PI) / 3;
    const r = HEX_SIZE - edgeInset;
    grazingPoly.push({ x: Math.cos(ang) * r, z: Math.sin(ang) * r });
  }

  const sheepCount = 4 + Math.floor(rand() * 3);
  const sampleBound = HEX_SIZE - edgeInset;
  for (let i = 0; i < sheepCount; i++) {
    let placed = false;
    let attempts = 0;
    while (!placed && attempts < 40) {
      attempts++;
      const rx = (rand() * 2 - 1) * sampleBound;
      const rz = (rand() * 2 - 1) * sampleBound;
      if (!pointInConvexPoly(rx, rz, grazingPoly)) continue;
      const sheep = buildSheep(rand);
      sheep.position.set(rx, 0, rz);
      sheep.rotation.y = rand() * Math.PI * 2;
      cluster.add(sheep);

      let tx = 0;
      let tz = 0;
      for (let t = 0; t < 20; t++) {
        const cx = (rand() * 2 - 1) * sampleBound;
        const cz = (rand() * 2 - 1) * sampleBound;
        if (pointInConvexPoly(cx, cz, grazingPoly)) {
          tx = cx;
          tz = cz;
          break;
        }
      }

      Object.assign(sheep.userData, {
        targetX: tx,
        targetZ: tz,
        speed: 0.5 + rand() * 0.3,
        state: rand() < 0.5 ? "wandering" : "grazing",
        timer: 1.5 + rand() * 3.5,
        grazingPoly,
        sampleBound,
        rand,
      });
      pushAnimatedSheep(sheep);
      placed = true;
    }
  }

  return cluster;
}
