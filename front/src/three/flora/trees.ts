// Forest clusters for wood tiles. Per-species tree builders, procedural leaf
// textures and seeded placement ported verbatim from the pre-split board.html
// so wood tiles render identically.

import * as THREE from "three";

import { HEX_SIZE } from "../../config";
import { mulberry32 } from "../rand";
import { renderer } from "../scene";

// --- Trunks ---
export const trunkSlimGeo = new THREE.CylinderGeometry(0.14, 0.2, 0.9, 6);
export const trunkStandardGeo = new THREE.CylinderGeometry(0.18, 0.24, 0.9, 6);
export const trunkThickGeo = new THREE.CylinderGeometry(0.24, 0.32, 1.1, 7);
export const trunkTallGeo = new THREE.CylinderGeometry(0.15, 0.22, 1.4, 6);
export const trunkStumpyGeo = new THREE.CylinderGeometry(0.22, 0.28, 0.55, 6);

// --- Foliage shapes ---
export const foliageConeLargeGeo = new THREE.ConeGeometry(1.1, 1.4, 7);
export const foliageConeMedGeo = new THREE.ConeGeometry(0.95, 1.25, 7);
export const foliageConeSmallGeo = new THREE.ConeGeometry(0.72, 1.1, 7);
export const foliageConeTinyGeo = new THREE.ConeGeometry(0.55, 0.95, 7);
export const foliageCypressGeo = new THREE.ConeGeometry(0.55, 2.4, 7);
export const foliageRoundLargeGeo = new THREE.IcosahedronGeometry(0.95, 0);
export const foliageRoundMedGeo = new THREE.IcosahedronGeometry(0.72, 0);
export const foliageRoundSmallGeo = new THREE.IcosahedronGeometry(0.55, 0);
export const foliageBlobGeo = new THREE.DodecahedronGeometry(0.7, 0);

// --- Trunk materials ---
export const trunkBarkDarkMat = new THREE.MeshStandardMaterial({
  color: "#4a2f1c",
  roughness: 0.95,
  metalness: 0.0,
  flatShading: true,
});
export const trunkBarkMidMat = new THREE.MeshStandardMaterial({
  color: "#5a3a21",
  roughness: 0.95,
  metalness: 0.0,
  flatShading: true,
});
export const trunkBarkLightMat = new THREE.MeshStandardMaterial({
  color: "#6e4a2a",
  roughness: 0.95,
  metalness: 0.0,
  flatShading: true,
});
export const trunkBirchMat = new THREE.MeshStandardMaterial({
  color: "#d8d1c0",
  roughness: 0.85,
  metalness: 0.0,
  flatShading: true,
});
const trunkMaterials = [trunkBarkDarkMat, trunkBarkMidMat, trunkBarkLightMat];

// Helper: mix two hex colors as an rgba() string.
function mixRGBA(
  colorA: string,
  colorB: string,
  tA: number,
  alpha: number,
): string {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);
  const r = Math.round(a.r * tA + b.r * (1 - tA));
  const g = Math.round(a.g * tA + b.g * (1 - tA));
  const bb = Math.round(a.b * tA + b.b * (1 - tA));
  return `rgba(${r},${g},${bb},${alpha})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

// Procedural leaf texture: seeded clusters of lighter leaf blobs over a
// darker base, plus speckles and shadow pockets.
function createLeafTexture(
  baseColor: string,
  highlightColor: string,
  shadowColor: string,
  seed: number,
): THREE.Texture {
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

  for (let i = 0; i < 45; i++) {
    const cx = rand() * size;
    const cy = rand() * size;
    const r = 8 + rand() * 22;
    const alpha = 0.12 + rand() * 0.18;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, `rgba(0,0,0,${alpha})`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }

  const clumpCount = 260;
  for (let i = 0; i < clumpCount; i++) {
    const cx = rand() * size;
    const cy = rand() * size;
    const r = 3 + rand() * 7;
    const t = 0.4 + rand() * 0.6;
    const alpha = 0.55 + rand() * 0.35;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, mixRGBA(highlightColor, baseColor, 1 - t, alpha));
    grad.addColorStop(0.6, mixRGBA(highlightColor, baseColor, (1 - t) * 0.5, alpha * 0.5));
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  }

  for (let i = 0; i < 180; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = 1 + rand() * 1.8;
    ctx.fillStyle = mixRGBA(shadowColor, "#000000", 0.3, 0.35 + rand() * 0.3);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.repeat.set(1, 1);
  return texture;
}

// Generate one leaf texture per foliage variant (base/highlight/shadow).
const leafTextureDeep = createLeafTexture("#1f4520", "#4a7a30", "#0f2a13", 111);
const leafTexturePine = createLeafTexture("#2f5a26", "#5d8a3a", "#173318", 222);
const leafTextureMid = createLeafTexture("#3c7a33", "#78b04c", "#1f4420", 333);
const leafTextureLight = createLeafTexture("#5a9a3e", "#9ec860", "#2f5a22", 444);
const leafTextureOlive = createLeafTexture("#6e7f2a", "#a5b046", "#3f4715", 555);
const leafTextureAutumn = createLeafTexture("#b8651f", "#e89548", "#5c2a10", 666);
const leafTextureYellow = createLeafTexture("#c69a2a", "#f0c85a", "#6a4e12", 777);

// --- Foliage materials ---
export const foliageDeepMat = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  map: leafTextureDeep,
  roughness: 0.85,
  metalness: 0.0,
  flatShading: true,
});
export const foliagePineMat = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  map: leafTexturePine,
  roughness: 0.85,
  metalness: 0.0,
  flatShading: true,
});
export const foliageMidMat = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  map: leafTextureMid,
  roughness: 0.85,
  metalness: 0.0,
  flatShading: true,
});
export const foliageLightMat = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  map: leafTextureLight,
  roughness: 0.85,
  metalness: 0.0,
  flatShading: true,
});
export const foliageOliveMat = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  map: leafTextureOlive,
  roughness: 0.9,
  metalness: 0.0,
  flatShading: true,
});
export const foliageAutumnMat = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  map: leafTextureAutumn,
  roughness: 0.9,
  metalness: 0.0,
  flatShading: true,
});
export const foliageYellowMat = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  map: leafTextureYellow,
  roughness: 0.9,
  metalness: 0.0,
  flatShading: true,
});

const foliageGreenMats = [
  foliageDeepMat,
  foliageDeepMat,
  foliagePineMat,
  foliagePineMat,
  foliagePineMat,
  foliageMidMat,
  foliageMidMat,
  foliageLightMat,
  foliageOliveMat,
];
const foliageAccentMats = [foliageAutumnMat, foliageYellowMat];

function pickFoliageMat(rand: () => number): THREE.MeshStandardMaterial {
  if (rand() < 0.08) {
    return foliageAccentMats[Math.floor(rand() * foliageAccentMats.length)];
  }
  return foliageGreenMats[Math.floor(rand() * foliageGreenMats.length)];
}

// ---- Tree species builders ----

function buildPineTree(rand: () => number): THREE.Group {
  const group = new THREE.Group();
  const trunkMat = trunkMaterials[Math.floor(rand() * trunkMaterials.length)];
  const trunk = new THREE.Mesh(trunkStandardGeo, trunkMat);
  trunk.position.y = 0.45;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);

  const foliageMat = pickFoliageMat(rand);
  const bottom = new THREE.Mesh(foliageConeMedGeo, foliageMat);
  bottom.position.y = 1.35;
  bottom.castShadow = true;
  bottom.receiveShadow = true;
  group.add(bottom);

  const top = new THREE.Mesh(foliageConeSmallGeo, foliageMat);
  top.position.y = 2.15;
  top.castShadow = true;
  top.receiveShadow = true;
  group.add(top);
  return group;
}

function buildTallPineTree(rand: () => number): THREE.Group {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    trunkTallGeo,
    trunkMaterials[Math.floor(rand() * trunkMaterials.length)],
  );
  trunk.position.y = 0.7;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);

  const foliageMat = pickFoliageMat(rand);
  const l1 = new THREE.Mesh(foliageConeLargeGeo, foliageMat);
  l1.position.y = 1.65;
  l1.castShadow = true;
  l1.receiveShadow = true;
  group.add(l1);
  const l2 = new THREE.Mesh(foliageConeMedGeo, foliageMat);
  l2.position.y = 2.45;
  l2.castShadow = true;
  l2.receiveShadow = true;
  group.add(l2);
  const l3 = new THREE.Mesh(foliageConeTinyGeo, foliageMat);
  l3.position.y = 3.15;
  l3.castShadow = true;
  l3.receiveShadow = true;
  group.add(l3);
  return group;
}

function buildCypressTree(rand: () => number): THREE.Group {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    trunkSlimGeo,
    trunkMaterials[Math.floor(rand() * trunkMaterials.length)],
  );
  trunk.position.y = 0.45;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);

  const crown = new THREE.Mesh(foliageCypressGeo, pickFoliageMat(rand));
  crown.position.y = 2.05;
  crown.castShadow = true;
  crown.receiveShadow = true;
  group.add(crown);
  return group;
}

function buildBroadleafTree(rand: () => number): THREE.Group {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    trunkThickGeo,
    trunkMaterials[Math.floor(rand() * trunkMaterials.length)],
  );
  trunk.position.y = 0.55;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);

  const foliageMat = pickFoliageMat(rand);
  const crown = new THREE.Mesh(foliageRoundLargeGeo, foliageMat);
  crown.position.y = 1.7;
  crown.rotation.y = rand() * Math.PI;
  crown.castShadow = true;
  crown.receiveShadow = true;
  group.add(crown);

  if (rand() < 0.55) {
    const extra = new THREE.Mesh(foliageRoundSmallGeo, foliageMat);
    extra.position.set(
      (rand() - 0.5) * 0.7,
      1.95 + rand() * 0.25,
      (rand() - 0.5) * 0.7,
    );
    extra.castShadow = true;
    extra.receiveShadow = true;
    group.add(extra);
  }
  return group;
}

function buildBirchTree(rand: () => number): THREE.Group {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(trunkTallGeo, trunkBirchMat);
  trunk.position.y = 0.7;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);

  const foliageMat = rand() < 0.25 ? foliageYellowMat : foliageLightMat;
  const crown = new THREE.Mesh(foliageRoundMedGeo, foliageMat);
  crown.position.y = 1.85;
  crown.castShadow = true;
  crown.receiveShadow = true;
  group.add(crown);

  if (rand() < 0.5) {
    const extra = new THREE.Mesh(foliageRoundSmallGeo, foliageMat);
    extra.position.set((rand() - 0.5) * 0.55, 2.1, (rand() - 0.5) * 0.55);
    extra.castShadow = true;
    extra.receiveShadow = true;
    group.add(extra);
  }
  return group;
}

function buildBushyTree(rand: () => number): THREE.Group {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    trunkStumpyGeo,
    trunkMaterials[Math.floor(rand() * trunkMaterials.length)],
  );
  trunk.position.y = 0.28;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);

  const foliageMat = pickFoliageMat(rand);
  const blobCount = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < blobCount; i++) {
    const blob = new THREE.Mesh(foliageBlobGeo, foliageMat);
    const angle = rand() * Math.PI * 2;
    const r = rand() * 0.45;
    blob.position.set(
      Math.cos(angle) * r,
      0.85 + rand() * 0.5,
      Math.sin(angle) * r,
    );
    const s = 0.75 + rand() * 0.45;
    blob.scale.setScalar(s);
    blob.rotation.y = rand() * Math.PI * 2;
    blob.castShadow = true;
    blob.receiveShadow = true;
    group.add(blob);
  }
  return group;
}

function buildSaplingTree(rand: () => number): THREE.Group {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    trunkSlimGeo,
    trunkMaterials[Math.floor(rand() * trunkMaterials.length)],
  );
  trunk.scale.y = 0.6;
  trunk.position.y = 0.27;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);

  const crown = new THREE.Mesh(foliageConeTinyGeo, pickFoliageMat(rand));
  crown.position.y = 0.95;
  crown.castShadow = true;
  crown.receiveShadow = true;
  group.add(crown);
  return group;
}

interface TreeBuilder {
  build: (rand: () => number) => THREE.Group;
  weight: number;
}

const treeBuilders: TreeBuilder[] = [
  { build: buildPineTree, weight: 3 },
  { build: buildTallPineTree, weight: 2 },
  { build: buildCypressTree, weight: 1 },
  { build: buildBroadleafTree, weight: 2 },
  { build: buildBirchTree, weight: 1 },
  { build: buildBushyTree, weight: 2 },
  { build: buildSaplingTree, weight: 1 },
];
const treeBuilderTotalWeight = treeBuilders.reduce((s, b) => s + b.weight, 0);

function pickTreeBuilder(
  rand: () => number,
): (rand: () => number) => THREE.Group {
  let r = rand() * treeBuilderTotalWeight;
  for (const b of treeBuilders) {
    r -= b.weight;
    if (r <= 0) return b.build;
  }
  return treeBuilders[0].build;
}

function createTreeMesh(scale: number, rand: () => number): THREE.Group {
  const group = pickTreeBuilder(rand)(rand);
  const sx = scale * (0.92 + rand() * 0.16);
  const sy = scale * (0.92 + rand() * 0.22);
  const sz = scale * (0.92 + rand() * 0.16);
  group.scale.set(sx, sy, sz);
  const tiltAmt = 0.06;
  group.rotation.x = (rand() - 0.5) * tiltAmt;
  group.rotation.z = (rand() - 0.5) * tiltAmt;
  return group;
}

/** Builds a cluster of trees on top of a forest (wood) tile. */
export function createForestCluster(tileId: number | string): THREE.Group {
  const cluster = new THREE.Group();
  let seed = 1;
  if (typeof tileId === "number") {
    seed = (tileId * 2654435761) >>> 0;
  } else if (typeof tileId === "string") {
    for (let i = 0; i < tileId.length; i++) {
      seed = (Math.imul(seed, 31) + tileId.charCodeAt(i)) >>> 0;
    }
  }
  const rand = mulberry32(seed || 1);

  const treeCount = 22;
  const placed: { x: number; z: number }[] = [];
  const apothem = HEX_SIZE * Math.cos(Math.PI / 6);
  const edgeInset = 1.2;
  const maxEdgeDist = apothem - edgeInset;
  const maxRadius = HEX_SIZE - edgeInset;
  const minRadius = 0.0;
  const minSeparation = 0.95;

  function insideHexInset(x: number, z: number): boolean {
    for (let i = 0; i < 6; i++) {
      const theta = (i * Math.PI) / 3;
      const d = x * Math.cos(theta) + z * Math.sin(theta);
      if (d > maxEdgeDist || d < -maxEdgeDist) return false;
    }
    return true;
  }

  let attempts = 0;
  while (placed.length < treeCount && attempts < 600) {
    attempts++;
    const angle = rand() * Math.PI * 2;
    const radius = minRadius + rand() * (maxRadius - minRadius);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;

    if (!insideHexInset(x, z)) continue;

    let tooClose = false;
    for (const p of placed) {
      const dx = p.x - x;
      const dz = p.z - z;
      if (dx * dx + dz * dz < minSeparation * minSeparation) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    const scale = 0.7 + rand() * 0.55;
    const tree = createTreeMesh(scale, rand);
    tree.position.set(x, 0, z);
    tree.rotation.y = rand() * Math.PI * 2;
    cluster.add(tree);
    placed.push({ x, z });
  }
  return cluster;
}
