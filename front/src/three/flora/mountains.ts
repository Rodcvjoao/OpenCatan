// Mountain clusters for ore tiles. Low-poly faceted cones + snow caps + boulders.
// Ported verbatim from board.html to keep ore tiles identical.

import * as THREE from "three";

import { HEX_SIZE } from "../../config";
import { mulberry32 } from "../rand";
import { renderer } from "../scene";

// Procedural rock texture.
function createRockTexture(baseColor: string, seed: number): THREE.Texture {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");

  let s = (seed >>> 0) || 1;
  function rand(): number {
    s = (s + 0x9e3779b9) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, size, size);

  const blobCount = 140;
  for (let i = 0; i < blobCount; i++) {
    const cx = rand() * size;
    const cy = rand() * size;
    const r = 10 + rand() * 38;
    const dark = rand() > 0.5;
    const alpha = 0.06 + rand() * 0.12;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, dark ? `rgba(0,0,0,${alpha})` : `rgba(255,255,255,${alpha})`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }

  ctx.lineCap = "round";
  for (let i = 0; i < 18; i++) {
    const y = rand() * size;
    const amp = 6 + rand() * 14;
    const phase = rand() * Math.PI * 2;
    const alpha = 0.08 + rand() * 0.12;
    ctx.strokeStyle = `rgba(0,0,0,${alpha})`;
    ctx.lineWidth = 1 + rand() * 1.8;
    ctx.beginPath();
    for (let x = 0; x <= size; x += 8) {
      const yy = y + Math.sin(x * 0.04 + phase) * amp;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }

  for (let i = 0; i < 320; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const bright = rand() > 0.65;
    const a = 0.15 + rand() * 0.35;
    ctx.fillStyle = bright ? `rgba(255,246,220,${a})` : `rgba(0,0,0,${a * 0.8})`;
    ctx.fillRect(x, y, 1 + Math.floor(rand() * 2), 1 + Math.floor(rand() * 2));
  }

  for (let i = 0; i < 28; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const len = 8 + rand() * 22;
    const ang = rand() * Math.PI * 2;
    ctx.strokeStyle = `rgba(0,0,0,${0.18 + rand() * 0.2})`;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.repeat.set(1.5, 2.2);
  return texture;
}

const rockTextureDark = createRockTexture("#4b4e55", 101);
const rockTextureMid = createRockTexture("#6a6d74", 202);
const rockTextureLight = createRockTexture("#8a8c92", 303);
const rockTextureWarm = createRockTexture("#746459", 404);

export const rockDarkMat = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  map: rockTextureDark,
  roughness: 0.95,
  metalness: 0.0,
  flatShading: true,
});
export const rockMidMat = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  map: rockTextureMid,
  roughness: 0.92,
  metalness: 0.0,
  flatShading: true,
});
export const rockLightMat = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  map: rockTextureLight,
  roughness: 0.9,
  metalness: 0.0,
  flatShading: true,
});
export const rockWarmMat = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  map: rockTextureWarm,
  roughness: 0.95,
  metalness: 0.0,
  flatShading: true,
});
export const snowMat = new THREE.MeshStandardMaterial({
  color: "#f3f4f7",
  roughness: 0.7,
  metalness: 0.0,
  flatShading: true,
});
const rockMaterials = [rockDarkMat, rockMidMat, rockLightMat, rockWarmMat];

interface MountainSpec {
  radius: number;
  height: number;
  shoulderFrac: number;
  shoulderScale: number;
}

const mountainLargeSpec: MountainSpec = { radius: 2.7, height: 4.05, shoulderFrac: 0.44, shoulderScale: 0.5 };
const mountainMedSpec: MountainSpec = { radius: 2.15, height: 3.18, shoulderFrac: 0.44, shoulderScale: 0.5 };
const mountainSmallSpec: MountainSpec = { radius: 1.55, height: 2.25, shoulderFrac: 0.44, shoulderScale: 0.5 };
const mountainTallSpec: MountainSpec = { radius: 2.1, height: 4.7, shoulderFrac: 0.48, shoulderScale: 0.48 };

export const boulderGeo = new THREE.DodecahedronGeometry(0.5, 0);
export const boulderSmallGeo = new THREE.IcosahedronGeometry(0.34, 0);

function createClosedMountainGeometry(
  spec: MountainSpec,
  rand: () => number,
): { geometry: THREE.BufferGeometry; apexOffsetX: number; apexOffsetZ: number } {
  const sides = 6;
  const base: number[] = [];
  const shoulder: number[] = [];
  const vertices: number[] = [0, 0, 0];
  const uvs: number[] = [0.5, 0.5];

  const meanShoulderY = spec.height * spec.shoulderFrac;
  const meanShoulderR = spec.radius * spec.shoulderScale;

  for (let i = 0; i < sides; i++) {
    const angle = -Math.PI / 6 + (i * Math.PI * 2) / sides;
    const baseRadius = spec.radius * (0.94 + rand() * 0.12);
    const shoulderRadius = meanShoulderR * (0.92 + rand() * 0.12);
    const shoulderY = meanShoulderY * (0.96 + rand() * 0.08);
    const bx = Math.cos(angle) * baseRadius;
    const bz = Math.sin(angle) * baseRadius;
    const sx = Math.cos(angle + (rand() - 0.5) * 0.035) * shoulderRadius;
    const sz = Math.sin(angle + (rand() - 0.5) * 0.035) * shoulderRadius;
    const u = i / sides;
    const baseIndex = vertices.length / 3;
    vertices.push(bx, 0, bz);
    uvs.push(u, 0);
    const shoulderIndex = vertices.length / 3;
    vertices.push(sx, shoulderY, sz);
    uvs.push(u, spec.shoulderFrac);
    base.push(baseIndex);
    shoulder.push(shoulderIndex);
  }

  const apexOffsetX = (rand() - 0.5) * spec.radius * 0.08;
  const apexOffsetZ = (rand() - 0.5) * spec.radius * 0.08;
  const apexIndex = vertices.length / 3;
  vertices.push(apexOffsetX, spec.height, apexOffsetZ);
  uvs.push(0.5, 1);

  const indices: number[] = [];
  for (let i = 0; i < sides; i++) {
    const next = (i + 1) % sides;
    indices.push(0, base[i], base[next]);
    indices.push(base[i], shoulder[next], base[next]);
    indices.push(base[i], shoulder[i], shoulder[next]);
    indices.push(shoulder[i], apexIndex, shoulder[next]);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return { geometry, apexOffsetX, apexOffsetZ };
}

function createSnowCapGeometry(
  spec: MountainSpec,
  apexOffsetX: number,
  apexOffsetZ: number,
): THREE.BufferGeometry {
  const sides = 6;
  const capBaseRadius = spec.radius * spec.shoulderScale + 0.08;
  const capHeight = spec.height * (1 - spec.shoulderFrac);
  const vertices: number[] = [0, 0, 0];
  const uvs: number[] = [0.5, 0.5];
  for (let i = 0; i < sides; i++) {
    const angle = -Math.PI / 6 + (i * Math.PI * 2) / sides;
    vertices.push(
      Math.cos(angle) * capBaseRadius,
      0,
      Math.sin(angle) * capBaseRadius,
    );
    uvs.push((Math.cos(angle) + 1) / 2, (Math.sin(angle) + 1) / 2);
  }
  const apexIndex = sides + 1;
  vertices.push(apexOffsetX, capHeight, apexOffsetZ);
  uvs.push(0.5, 1);

  const indices: number[] = [];
  for (let i = 1; i <= sides; i++) {
    const next = i === sides ? 1 : i + 1;
    indices.push(0, i, next);
    indices.push(i, apexIndex, next);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

type MountainVariant = "large" | "tall" | "small" | "med";

function buildMountainPeak(
  rand: () => number,
  sizeVariant: MountainVariant,
): { group: THREE.Group } {
  const group = new THREE.Group();

  let spec: MountainSpec;
  const baseScale = 1.0;
  if (sizeVariant === "large") spec = mountainLargeSpec;
  else if (sizeVariant === "tall") spec = mountainTallSpec;
  else if (sizeVariant === "small") spec = mountainSmallSpec;
  else spec = mountainMedSpec;

  const { geometry: peakGeo, apexOffsetX, apexOffsetZ } = createClosedMountainGeometry(
    spec,
    rand,
  );
  const rockMat = rockMaterials[Math.floor(rand() * rockMaterials.length)];
  const peak = new THREE.Mesh(peakGeo, rockMat);
  const peakRotY = rand() * Math.PI * 2;
  peak.rotation.y = peakRotY;
  peak.castShadow = true;
  peak.receiveShadow = true;
  group.add(peak);

  const snowChance = sizeVariant === "small" ? 0.3 : 0.75;
  if (rand() < snowChance) {
    const capGeo = createSnowCapGeometry(spec, apexOffsetX, apexOffsetZ);
    const cap = new THREE.Mesh(capGeo, snowMat);
    cap.position.y = spec.height * spec.shoulderFrac;
    cap.rotation.y = peakRotY;
    cap.castShadow = true;
    cap.receiveShadow = true;
    group.add(cap);
  }

  const sx = baseScale * (0.92 + rand() * 0.18);
  const sy = baseScale * (0.94 + rand() * 0.2);
  const sz = baseScale * (0.92 + rand() * 0.18);
  group.scale.set(sx, sy, sz);
  group.userData.apexY = spec.height * sy;

  return { group };
}

function buildBoulder(rand: () => number, small: boolean): THREE.Mesh {
  const geo = small ? boulderSmallGeo : boulderGeo;
  const mat = rockMaterials[Math.floor(rand() * rockMaterials.length)];
  const m = new THREE.Mesh(geo, mat);
  const s = (small ? 0.45 : 0.62) + rand() * 0.35;
  m.scale.set(
    s * (0.8 + rand() * 0.5),
    s * (0.7 + rand() * 0.5),
    s * (0.8 + rand() * 0.5),
  );
  m.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
  m.position.y = s * 0.25;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function createMountainCluster(tileId: number | string): THREE.Group {
  const cluster = new THREE.Group();
  let seed = 7919;
  if (typeof tileId === "number") {
    seed = (tileId * 2246822519) >>> 0;
  } else if (typeof tileId === "string") {
    for (let i = 0; i < tileId.length; i++) {
      seed = (Math.imul(seed, 17) + tileId.charCodeAt(i)) >>> 0;
    }
  }
  const rand = mulberry32(seed || 1);

  const apothem = HEX_SIZE * Math.cos(Math.PI / 6);
  const edgeInset = 1.6;
  const maxEdgeDist = apothem - edgeInset;
  const maxRadius = HEX_SIZE - edgeInset;

  function insideHexInset(x: number, z: number): boolean {
    for (let i = 0; i < 6; i++) {
      const theta = (i * Math.PI) / 3;
      const d = x * Math.cos(theta) + z * Math.sin(theta);
      if (d > maxEdgeDist || d < -maxEdgeDist) return false;
    }
    return true;
  }

  const ridgeAngle = rand() * Math.PI * 2;
  const ridgeX = Math.cos(ridgeAngle);
  const ridgeZ = Math.sin(ridgeAngle);
  const sideX = -ridgeZ;
  const sideZ = ridgeX;
  const ridgeSlots: Array<{ t: number; side: number; variant: MountainVariant }> = [
    { t: -2.65, side: -0.25, variant: "small" },
    { t: -1.5,  side:  0.25, variant: "med"   },
    { t: -0.2,  side: -0.05, variant: "tall"  },
    { t:  1.15, side: -0.2,  variant: "large" },
    { t:  2.35, side:  0.22, variant: "small" },
    { t:  0.85, side:  1.0,  variant: "small" },
  ];
  const variantRadius: Record<MountainVariant, number> = {
    small: mountainSmallSpec.radius,
    med: mountainMedSpec.radius,
    tall: mountainTallSpec.radius,
    large: mountainLargeSpec.radius,
  };
  const overlapFactor = 0.72;

  const peakPositions: Array<{ x: number; z: number; radius: number }> = [];
  for (const slot of ridgeSlots) {
    const jitterT = (rand() - 0.5) * 0.35;
    const jitterSide = (rand() - 0.5) * 0.35;
    const x = ridgeX * (slot.t + jitterT) + sideX * (slot.side + jitterSide);
    const z = ridgeZ * (slot.t + jitterT) + sideZ * (slot.side + jitterSide);
    if (!insideHexInset(x, z)) continue;

    const slotRadius = variantRadius[slot.variant];
    let overlapsExisting = false;
    for (const p of peakPositions) {
      const dx = p.x - x;
      const dz = p.z - z;
      const minDist = (p.radius + slotRadius) * overlapFactor;
      if (dx * dx + dz * dz < minDist * minDist) {
        overlapsExisting = true;
        break;
      }
    }
    if (overlapsExisting) continue;

    const { group: peak } = buildMountainPeak(rand, slot.variant);
    peak.position.set(x, 0, z);
    peak.rotation.y += ridgeAngle + (rand() - 0.5) * 0.5;
    cluster.add(peak);
    peakPositions.push({ x, z, radius: slotRadius });
  }

  const boulderCount = 7 + Math.floor(rand() * 4);
  const placedBoulders: Array<{ x: number; z: number }> = [];
  const boulderMinSep = 1.0;
  let bAttempts = 0;
  while (placedBoulders.length < boulderCount && bAttempts < 160) {
    bAttempts++;
    const angle = rand() * Math.PI * 2;
    const radius = rand() * maxRadius * 0.82;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    if (!insideHexInset(x, z)) continue;

    let onPeak = false;
    for (const p of peakPositions) {
      const dx = p.x - x;
      const dz = p.z - z;
      const keepOut = (p.radius || 2.0) * 0.9;
      if (dx * dx + dz * dz < keepOut * keepOut) {
        onPeak = true;
        break;
      }
    }
    if (onPeak) continue;

    let tooClose = false;
    for (const p of placedBoulders) {
      const dx = p.x - x;
      const dz = p.z - z;
      if (dx * dx + dz * dz < boulderMinSep * boulderMinSep) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    const boulder = buildBoulder(rand, rand() < 0.5);
    boulder.position.x = x;
    boulder.position.z = z;
    cluster.add(boulder);
    placedBoulders.push({ x, z });
  }

  return cluster;
}
