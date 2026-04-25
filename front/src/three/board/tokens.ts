// Number-token texture (used both by tiles at build time and the hovering
// preview token at runtime). Textures are cached so hovering different
// tiles does not thrash the GPU.

import * as THREE from "three";

import { dynamicTextures, renderer } from "../scene";

export function createTokenTexture(number: number): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  ctx.fillStyle = "#fdfbf7";
  ctx.beginPath();
  ctx.arc(64, 64, 60, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#222";
  ctx.stroke();
  const isRed = number === 6 || number === 8;
  ctx.fillStyle = isRed ? "#d32f2f" : "#222222";
  ctx.font = "bold 54px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(number.toString(), 64, 60);
  const dots = number <= 7 ? number - 1 : 13 - number;
  ctx.fillStyle = isRed ? "#d32f2f" : "#222222";
  const spacing = 8;
  const startX = 64 - ((dots - 1) * spacing) / 2;
  for (let i = 0; i < dots; i++) {
    ctx.beginPath();
    ctx.arc(startX + i * spacing, 95, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  dynamicTextures.add(texture);
  return texture;
}

const tokenTextureCache: Record<number, THREE.Texture> = {};

/** Returns (and lazily creates) the rotated token texture used by the
 *  hovering preview token. Rotation compensates for the cylinder's +X-face
 *  UV orientation after we rotate it 90 deg. */
export function getHoverTokenTexture(number: number): THREE.Texture {
  if (!tokenTextureCache[number]) {
    const tex = createTokenTexture(number);
    tex.center.set(0.5, 0.5);
    tex.rotation = Math.PI / 2;
    tex.needsUpdate = true;
    tokenTextureCache[number] = tex;
  }
  return tokenTextureCache[number];
}
