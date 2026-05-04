// Per-primitive renderers: tiles, ports, robber, settlement, city, road.
// Each pushes into boardGroup so rebuildScene can clear it between snapshots.

import * as THREE from "three";

import { HEX_HEIGHT } from "../../config";
import { GameState } from "../../state";
import type { BoardMeshUserData, Port } from "../../types";
import { createForestCluster } from "../flora/trees";
import { createMountainCluster } from "../flora/mountains";
import { createPastureCluster } from "../flora/pasture";
import { createFarmCluster } from "../flora/farms";
import { createBrickFarmCluster } from "../flora/brickFarm";
import {
  PORT_POST_HEIGHT,
  boatCabinGeo,
  boatDeckGeo,
  boatHullGeo,
  boatJibGeo,
  boatMastGeo,
  boatSailGeo,
  cityBaseGeo,
  cityTopGeo,
  createFlagGeometry,
  hexGeom,
  hexTopGeom,
  hexTransitionGeom,
  houseBaseGeo,
  houseRoofGeo,
  portCrateGeo,
  portPierGeo,
  portPostGeo,
  portQuayGeo,
  roadGeo,
} from "../geometry";
import {
  boatCabinMat,
  boatFlagMat,
  boatHullMat,
  boatTrimMat,
  hexBodyMaterials,
  hexTopMaterials,
  hexTransitionMat,
  portCrateMat,
  portDarkWoodMat,
  portStoneMat,
  portWoodMat,
  sailMat,
} from "../materials";
import {
  boardGroup,
  dynamicTextures,
  pushFloatingBoat,
  renderer,
} from "../scene";

function setUserData(mesh: THREE.Object3D, data: BoardMeshUserData): void {
  mesh.userData = data;
}

// Geometries used every rebuild. Hoisted so rebuildScene doesn't allocate
// (and `reusable.ts` keeps them out of the disposal path).
export const robberBaseGeo = new THREE.CylinderGeometry(1.2, 1.5, 1, 16);
export const robberBodyGeo = new THREE.CylinderGeometry(0.8, 1.2, 2, 16);
export const robberHeadGeo = new THREE.SphereGeometry(0.9, 16, 16);
export const portBowTrimGeo = new THREE.BoxGeometry(0.64, 0.08, 0.5);

export function renderTile(
  x: number,
  z: number,
  resource: string,
  number: number | null | undefined,
  tileId: number,
): void {
  const hasNumber =
    number !== null && number !== undefined && resource !== "desert";
  if (hasNumber) {
    GameState.tileNumbers[tileId] = number;
  }

  const mesh = new THREE.Mesh(hexGeom, hexBodyMaterials);
  mesh.position.set(x, 0, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  setUserData(mesh, { type: "tile", id: tileId });
  boardGroup.add(mesh);

  const topMat = hexTopMaterials[resource] ?? hexTopMaterials.desert;
  const resourceTop = new THREE.Mesh(hexTopGeom, topMat);
  resourceTop.position.set(x, HEX_HEIGHT / 2 + 0.012, z);
  resourceTop.receiveShadow = true;
  setUserData(resourceTop, { type: "tile", id: tileId });
  boardGroup.add(resourceTop);

  const transition = new THREE.Mesh(hexTransitionGeom, hexTransitionMat);
  transition.position.set(x, HEX_HEIGHT / 2 + 0.025, z);
  transition.receiveShadow = true;
  setUserData(transition, { type: "tile", id: tileId });
  boardGroup.add(transition);

  if (resource === "wood") {
    const forest = createForestCluster(tileId);
    forest.position.set(x, HEX_HEIGHT / 2 + 0.02, z);
    setUserData(forest, { type: "tile", id: tileId });
    boardGroup.add(forest);
  } else if (resource === "ore") {
    const mountains = createMountainCluster(tileId);
    mountains.position.set(x, HEX_HEIGHT / 2 + 0.02, z);
    setUserData(mountains, { type: "tile", id: tileId });
    boardGroup.add(mountains);
  } else if (resource === "sheep") {
    const pasture = createPastureCluster(tileId);
    pasture.position.set(x, HEX_HEIGHT / 2 + 0.02, z);
    setUserData(pasture, { type: "tile", id: tileId });
    boardGroup.add(pasture);
  } else if (resource === "wheat") {
    const farm = createFarmCluster(tileId);
    farm.position.set(x, HEX_HEIGHT / 2 + 0.02, z);
    setUserData(farm, { type: "tile", id: tileId });
    boardGroup.add(farm);
  } else if (resource === "brick") {
    const brickyard = createBrickFarmCluster(tileId);
    brickyard.position.set(x, HEX_HEIGHT / 2 + 0.02, z);
    setUserData(brickyard, { type: "tile", id: tileId });
    boardGroup.add(brickyard);
  }
}

export function renderPort(portData: Port): void {
  const v1 = GameState.vertexPositions[portData.vertex_ids[0]];
  const v2 = GameState.vertexPositions[portData.vertex_ids[1]];
  if (!v1 || !v2) return;
  const mx = (v1.x + v2.x) / 2;
  const mz = (v1.z + v2.z) / 2;
  const angle = Math.atan2(v2.z - v1.z, v2.x - v1.x);
  let rotation = -angle;
  let outwardX = -Math.sin(angle);
  let outwardZ = Math.cos(angle);
  if (outwardX * mx + outwardZ * mz < 0) {
    outwardX *= -1;
    outwardZ *= -1;
    rotation += Math.PI;
  }

  const portGroup = new THREE.Group();
  portGroup.position.set(mx, 0, mz);
  portGroup.rotation.y = rotation;

  const landTopY = HEX_HEIGHT / 2 + 0.18;
  const landPortZ = -0.82;
  const quay = new THREE.Mesh(portQuayGeo, portStoneMat);
  quay.position.set(0, landTopY, landPortZ);
  quay.castShadow = true;
  quay.receiveShadow = true;
  portGroup.add(quay);

  const pier = new THREE.Mesh(portPierGeo, portWoodMat);
  pier.position.set(0, landTopY + 0.12, 2.15);
  pier.castShadow = true;
  pier.receiveShadow = true;
  portGroup.add(pier);

  const postPositions: Array<[number, number]> = [
    [-0.42, -0.35],
    [0.42, -0.35],
    [-0.42, 1.75],
    [0.42, 1.75],
    [-0.42, 3.85],
    [0.42, 3.85],
  ];
  for (const [px, pz] of postPositions) {
    const post = new THREE.Mesh(portPostGeo, portDarkWoodMat);
    post.position.set(px, landTopY + 0.42 - PORT_POST_HEIGHT, pz);
    post.castShadow = true;
    post.receiveShadow = true;
    portGroup.add(post);
  }

  const crateA = new THREE.Mesh(portCrateGeo, portCrateMat);
  crateA.position.set(-1.45, landTopY + 0.24, landPortZ);
  crateA.rotation.y = 0.25;
  crateA.castShadow = true;
  crateA.receiveShadow = true;
  portGroup.add(crateA);

  const crateB = new THREE.Mesh(portCrateGeo, portCrateMat);
  crateB.scale.set(0.8, 0.8, 0.8);
  crateB.position.set(1.45, landTopY + 0.2, landPortZ + 0.1);
  crateB.rotation.y = -0.35;
  crateB.castShadow = true;
  crateB.receiveShadow = true;
  portGroup.add(crateB);

  const boatGroup = new THREE.Group();
  boatGroup.position.set(0, -0.72, 6.75);

  const hull = new THREE.Mesh(boatHullGeo, boatHullMat);
  hull.castShadow = true;
  hull.receiveShadow = true;
  boatGroup.add(hull);

  const deck = new THREE.Mesh(boatDeckGeo, boatTrimMat);
  deck.position.set(-0.22, 0.33, 0);
  deck.castShadow = true;
  deck.receiveShadow = true;
  boatGroup.add(deck);

  const cabin = new THREE.Mesh(boatCabinGeo, boatCabinMat);
  cabin.position.set(-0.9, 0.55, 0);
  cabin.castShadow = true;
  cabin.receiveShadow = true;
  boatGroup.add(cabin);

  const bowTrim = new THREE.Mesh(portBowTrimGeo, boatTrimMat);
  bowTrim.position.set(0.82, 0.26, 0);
  bowTrim.rotation.y = Math.PI / 4;
  bowTrim.castShadow = true;
  boatGroup.add(bowTrim);

  const mast = new THREE.Mesh(boatMastGeo, portDarkWoodMat);
  mast.position.set(0.12, 1.2, 0);
  mast.castShadow = true;
  boatGroup.add(mast);

  const sail = new THREE.Mesh(boatSailGeo, sailMat);
  sail.position.set(0.14, 0.38, 0.12);
  sail.castShadow = true;
  boatGroup.add(sail);

  const jib = new THREE.Mesh(boatJibGeo, sailMat);
  jib.position.set(0.2, 0.5, -0.1);
  jib.rotation.y = Math.PI;
  jib.castShadow = true;
  boatGroup.add(jib);

  const flag = new THREE.Mesh(createFlagGeometry(), boatFlagMat);
  flag.position.set(0.12, 2.18, 0.02);
  flag.castShadow = true;
  boatGroup.add(flag);
  boatGroup.userData.flag = flag;
  boatGroup.userData.flagBase = Array.from(
    (flag.geometry.attributes.position.array as ArrayLike<number>),
  );
  boatGroup.userData.floatBaseY = boatGroup.position.y;
  boatGroup.userData.floatPhase = Math.abs(mx) * 0.21 + Math.abs(mz) * 0.17;
  boatGroup.userData.floatWorldX = mx + outwardX * boatGroup.position.z;
  boatGroup.userData.floatWorldZ = mz + outwardZ * boatGroup.position.z;
  pushFloatingBoat(boatGroup);
  portGroup.add(boatGroup);

  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 64;
  labelCanvas.height = 32;
  const ctx = labelCanvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#f3dfb0";
    ctx.fillRect(0, 0, 64, 32);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#5c4033";
    ctx.strokeRect(2, 2, 60, 28);
    ctx.fillStyle = "#2b1b12";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const label =
      portData.port_type === "THREE_TO_ONE"
        ? "3:1"
        : "2:1 " + portData.port_type.charAt(0);
    ctx.fillText(label, 32, 16);
  }
  const tex = new THREE.CanvasTexture(labelCanvas);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  dynamicTextures.add(tex);
  const labelMat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.5,
    side: THREE.DoubleSide,
  });
  const labelGeo = new THREE.PlaneGeometry(1.8, 0.9);
  const labelMesh = new THREE.Mesh(labelGeo, labelMat);
  labelMesh.position.set(0, landTopY + 0.18, landPortZ - 0.14);
  labelMesh.rotation.x = -Math.PI / 2;
  labelMesh.receiveShadow = true;
  portGroup.add(labelMesh);

  boardGroup.add(portGroup);
}

export function createRobber(x: number, z: number): void {
  const robberGroup = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.4 });
  const base = new THREE.Mesh(robberBaseGeo, mat);
  base.position.y = 0.5;
  const body = new THREE.Mesh(robberBodyGeo, mat);
  body.position.y = 2;
  const head = new THREE.Mesh(robberHeadGeo, mat);
  head.position.y = 3.5;
  [base, body, head].forEach((m) => {
    m.castShadow = true;
    m.receiveShadow = true;
    robberGroup.add(m);
  });
  robberGroup.position.set(x, HEX_HEIGHT / 2, z);
  boardGroup.add(robberGroup);
}

export function renderSettlement(x: number, z: number, colorHex: string): void {
  const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.5 });
  const group = new THREE.Group();
  const base = new THREE.Mesh(houseBaseGeo, mat);
  base.position.y = 0.75;
  const roof = new THREE.Mesh(houseRoofGeo, mat);
  roof.position.y = 2.25;
  [base, roof].forEach((m) => {
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  });
  group.position.set(x, HEX_HEIGHT / 2, z);
  boardGroup.add(group);
}

export function renderCity(x: number, z: number, colorHex: string): void {
  const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.5 });
  const group = new THREE.Group();
  const base = new THREE.Mesh(cityBaseGeo, mat);
  base.position.y = 1;
  const top = new THREE.Mesh(cityTopGeo, mat);
  top.position.y = 2.75;
  [base, top].forEach((m) => {
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  });
  group.position.set(x, HEX_HEIGHT / 2, z);
  boardGroup.add(group);
}

export function renderRoad(
  x: number,
  z: number,
  angle: number,
  colorHex: string,
): void {
  const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.5 });
  const road = new THREE.Mesh(roadGeo, mat);
  road.position.set(x, HEX_HEIGHT / 2 + 0.4, z);
  road.rotation.y = -angle;
  road.castShadow = true;
  road.receiveShadow = true;
  boardGroup.add(road);
}
