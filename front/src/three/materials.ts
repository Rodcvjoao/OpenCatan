// Texture loading helpers and static materials (hex sides/top, port, boat,
// highlights). Procedural hex-side canvas texture ported verbatim from the
// pre-split board.html.

import * as THREE from "three";

import { renderer } from "./scene";

const textureLoader = new THREE.TextureLoader();

export function loadRepeatingTexture(
  path: string,
  repeatX: number,
  repeatY: number,
): THREE.Texture {
  const texture = textureLoader.load(path);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function loadClampedTexture(path: string): THREE.Texture {
  const texture = textureLoader.load(path);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Resource-keyed top textures.
export const hexTexturePaths: Record<string, string> = {
  wood:   "/assets/textures/hex-wood.png",
  sheep:  "/assets/textures/hex-sheep.png",
  wheat:  "/assets/textures/hex-wheat.png",
  brick:  "/assets/textures/hex-brick.png",
  ore:    "/assets/textures/hex-ore.png",
  desert: "/assets/textures/hex-desert.png",
};

const hexTextures: Record<string, THREE.Texture> = {};
for (const [key, path] of Object.entries(hexTexturePaths)) {
  hexTextures[key] = loadRepeatingTexture(path, 1, 1);
}

export const hexTransitionTexture = loadClampedTexture(
  "/assets/textures/hex-transition-sand-ring.png",
);
export const portPlankTexture = loadRepeatingTexture(
  "/assets/textures/port-plank-wood.png",
  2,
  1,
);
export const portPoleTexture = loadRepeatingTexture(
  "/assets/textures/port-pole-wood.png",
  1,
  2,
);
export const portCrateTexture = loadRepeatingTexture(
  "/assets/textures/crate.png",
  1,
  1,
);
export const boatHullTexture = loadRepeatingTexture(
  "/assets/textures/boat-hull-painted-wood.png",
  2,
  1,
);
export const boatDeckTexture = loadRepeatingTexture(
  "/assets/textures/boat-deck-light-wood.png",
  2,
  1,
);
export const boatSailTexture = loadRepeatingTexture(
  "/assets/textures/boat-sail-canvas.png",
  1,
  1,
);

// Fallback tints if a hex texture fails to load.
const hexColors: Record<string, string> = {
  wood:   "#3b5e2b",
  sheep:  "#8ebd3f",
  wheat:  "#f0c24f",
  brick:  "#bd5a36",
  ore:    "#82858c",
  desert: "#d6c596",
};

// Procedural hex-side texture (warm sandy gradient with brush strokes).
function createHexSideTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#d6b171");
  gradient.addColorStop(0.45, "#b9874c");
  gradient.addColorStop(1, "#7c5432");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  let seed = 42;
  function random(): number {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }

  for (let i = 0; i < 180; i++) {
    const x = random() * canvas.width;
    const y = random() * canvas.height;
    const w = 12 + random() * 48;
    const h = 1 + random() * 5;
    const alpha = 0.05 + random() * 0.16;
    ctx.fillStyle =
      random() > 0.5
        ? `rgba(255, 224, 143, ${alpha})`
        : `rgba(84, 51, 28, ${alpha})`;
    ctx.fillRect(x, y, w, h);
  }

  ctx.strokeStyle = "rgba(255, 229, 164, 0.22)";
  ctx.lineWidth = 3;
  for (let y = 18; y < canvas.height; y += 28) {
    ctx.beginPath();
    for (let x = 0; x <= canvas.width; x += 16) {
      const wave = Math.sin((x + y) * 0.035) * 3;
      if (x === 0) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(2, 1);
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const hexSideTexture = createHexSideTexture();

export const hexSideMat = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  map: hexSideTexture,
  roughness: 0.9,
  metalness: 0.0,
  flatShading: true,
});

export const hexCapMat = new THREE.MeshStandardMaterial({
  color: "#c9a66f",
  roughness: 0.9,
  metalness: 0.0,
  flatShading: true,
});

export const hexBodyMaterials = [hexSideMat, hexCapMat, hexCapMat];

export const portWoodMat = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  map: portPlankTexture,
  roughness: 0.72,
  metalness: 0.0,
});
export const portDarkWoodMat = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  map: portPoleTexture,
  roughness: 0.78,
  metalness: 0.0,
});
export const portStoneMat = new THREE.MeshStandardMaterial({
  color: "#a99678",
  roughness: 0.85,
  metalness: 0.0,
});
export const portCrateMat = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  map: portCrateTexture,
  roughness: 0.75,
  metalness: 0.0,
});
export const boatHullMat = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  map: boatHullTexture,
  roughness: 0.58,
  metalness: 0.0,
});
export const boatTrimMat = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  map: boatDeckTexture,
  roughness: 0.5,
  metalness: 0.0,
});
export const boatCabinMat = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  map: boatDeckTexture,
  roughness: 0.65,
  metalness: 0.0,
});
export const boatFlagMat = new THREE.MeshStandardMaterial({
  color: "#c45a3f",
  roughness: 0.55,
  metalness: 0.0,
  side: THREE.DoubleSide,
});
export const sailMat = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  map: boatSailTexture,
  roughness: 0.45,
  metalness: 0.0,
  side: THREE.DoubleSide,
});

export const hexTopMaterials: Record<string, THREE.MeshStandardMaterial> = {};
for (const [key, hex] of Object.entries(hexColors)) {
  const texture = hexTextures[key];
  hexTopMaterials[key] = new THREE.MeshStandardMaterial({
    color: texture ? "#ffffff" : hex,
    map: texture ?? null,
    roughness: 0.8,
    metalness: 0.0,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    side: THREE.DoubleSide,
  });
}

export const hexTransitionMat = new THREE.MeshStandardMaterial({
  color: "#ffffff",
  map: hexTransitionTexture,
  roughness: 0.85,
  metalness: 0.0,
  transparent: true,
  alphaTest: 0.08,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2,
  side: THREE.DoubleSide,
});

// Highlight materials (transparent overlays for legal-placement UI).
export const hlSettlementMat = new THREE.MeshStandardMaterial({
  color: 0x00ff00,
  transparent: true,
  opacity: 0.5,
});
export const hlRoadMat = new THREE.MeshStandardMaterial({
  color: 0x00ff00,
  transparent: true,
  opacity: 0.5,
});
export const hlCityMat = new THREE.MeshStandardMaterial({
  color: 0x00ccff,
  transparent: true,
  opacity: 0.5,
});
export const hlRobberMat = new THREE.MeshStandardMaterial({
  color: 0xff0000,
  transparent: true,
  opacity: 0.4,
});
