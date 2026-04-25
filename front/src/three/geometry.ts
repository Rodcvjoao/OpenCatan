// Shared geometries used by the core board renderers (hexes, tokens, roads,
// buildings, ports, boats). Procedural flora/fauna geometries live under
// ./flora/*.

import * as THREE from "three";

import { HEX_HEIGHT, HEX_SIZE } from "../config";

export const hexGeom = new THREE.CylinderGeometry(
  HEX_SIZE,
  HEX_SIZE,
  HEX_HEIGHT,
  6,
);

export function createHexTopGeometry(radius: number): THREE.BufferGeometry {
  const vertices: number[] = [0, 0, 0];
  const uvs: number[] = [0.5, 0.5];
  for (let i = 0; i < 6; i++) {
    const angle = -Math.PI / 6 + (i * Math.PI) / 3;
    const x = radius * Math.cos(angle);
    const z = radius * Math.sin(angle);
    vertices.push(x, 0, z);
    uvs.push(x / (radius * 2) + 0.5, z / (radius * 2) + 0.5);
  }
  const indices: number[] = [];
  for (let i = 1; i <= 6; i++) {
    const next = i === 6 ? 1 : i + 1;
    indices.push(0, next, i);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export const hexTopGeom = createHexTopGeometry(HEX_SIZE * 0.985);
export const hexTransitionGeom = createHexTopGeometry(HEX_SIZE * 1.012);
export const tokenGeom = new THREE.CylinderGeometry(2.5, 2.5, 0.4, 32);
export const roadGeo = new THREE.BoxGeometry(4.5, 0.8, 1);
export const houseBaseGeo = new THREE.BoxGeometry(2, 1.5, 2);
export const houseRoofGeo = new THREE.ConeGeometry(1.8, 1.5, 4);
houseRoofGeo.rotateY(Math.PI / 4);
export const cityBaseGeo = new THREE.BoxGeometry(2.8, 2, 2.8);
export const cityTopGeo = new THREE.BoxGeometry(1.6, 1.5, 1.6);

export const portQuayGeo = new THREE.BoxGeometry(4.4, 0.32, 1.35);
export const portPierGeo = new THREE.BoxGeometry(1.0, 0.24, 5.2);
export const PORT_POST_HEIGHT = 1.15;
export const portPostGeo = new THREE.CylinderGeometry(
  0.14,
  0.14,
  PORT_POST_HEIGHT * 2,
  8,
);
export const portCrateGeo = new THREE.BoxGeometry(0.72, 0.5, 0.72);

function createBoatHullGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const vertices = [
    -1.65, 0.22, -0.58, -1.65, 0.22, 0.58, -1.55, -0.26, -0.25, -1.55, -0.26, 0.25,
    0.45, 0.28, -0.74, 0.45, 0.28, 0.74, 0.45, -0.34, -0.28, 0.45, -0.34, 0.28,
    1.95, 0.12, 0.0, 1.56, -0.18, 0.0,
  ];
  const indices = [
    0, 4, 6, 0, 6, 2,
    1, 3, 7, 1, 7, 5,
    2, 6, 7, 2, 7, 3,
    0, 1, 5, 0, 5, 4,
    4, 8, 9, 4, 9, 6,
    5, 7, 9, 5, 9, 8,
    6, 9, 7,
    4, 5, 8,
    0, 2, 3, 0, 3, 1,
  ];
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute(
      [
        0.0, 0.12, 0.0, 0.88, 0.03, 0.32, 0.03, 0.68,
        0.58, 0.02, 0.58, 0.98, 0.58, 0.30, 0.58, 0.70,
        1.0, 0.50, 0.88, 0.50,
      ],
      2,
    ),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createTriangleGeometry(points: number[]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  geometry.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute([0, 0, 1, 0.5, 0, 1], 2),
  );
  geometry.setIndex([0, 1, 2]);
  geometry.computeVertexNormals();
  return geometry;
}

export const boatHullGeo = createBoatHullGeometry();
export const boatDeckGeo = new THREE.BoxGeometry(2.45, 0.12, 0.92);
export const boatCabinGeo = new THREE.BoxGeometry(0.62, 0.34, 0.52);
export const boatMastGeo = new THREE.CylinderGeometry(0.06, 0.08, 2.15, 10);
export const boatSailGeo = createTriangleGeometry([
  0, 0, 0, 1.05, 0.86, 0, 0, 1.68, 0,
]);
export const boatJibGeo = createTriangleGeometry([
  0, 0.05, 0, 0.78, 0.58, 0, 0, 1.26, 0,
]);

export function createFlagGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [0, 0, 0, 0.42, 0.13, 0, 0, 0.28, 0],
      3,
    ),
  );
  geometry.setAttribute(
    "uv",
    new THREE.Float32BufferAttribute([0, 0, 1, 0.5, 0, 1], 2),
  );
  geometry.setIndex([0, 1, 2]);
  geometry.computeVertexNormals();
  return geometry;
}
