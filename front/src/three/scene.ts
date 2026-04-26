// Scene, camera, renderer, controls, lights, and the animated ocean plane.
// Uses three@0.160 APIs: SRGBColorSpace / outputColorSpace replace the
// deprecated sRGBEncoding / outputEncoding from three@r128.

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const container = document.getElementById("canvas-container");
if (!container) {
  throw new Error("#canvas-container not found");
}

export const scene = new THREE.Scene();
scene.background = new THREE.Color("#87ceeb");
scene.fog = new THREE.FogExp2("#87ceeb", 0.0025);

export const camera = new THREE.PerspectiveCamera(
  40,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
camera.position.set(0, 55, 65);

export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
container.appendChild(renderer.domElement);

export const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.maxPolarAngle = Math.PI / 2.2;
controls.minDistance = 30;
controls.maxDistance = 150;
controls.target.set(0, 0, 0);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffeedd, 0.9);
dirLight.position.set(30, 50, 20);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.left = -40;
dirLight.shadow.camera.right = 40;
dirLight.shadow.camera.top = 40;
dirLight.shadow.camera.bottom = -40;
scene.add(dirLight);
const fillLight = new THREE.DirectionalLight(0xddeeff, 0.3);
fillLight.position.set(-30, 20, -20);
scene.add(fillLight);

/** Live-applied shadow quality control (driven by the Settings screen).
 *  "off" disables shadow rendering entirely; the other levels swap the
 *  shadow map resolution. */
export type ShadowQualityLevel = "high" | "medium" | "low" | "off";
export function applyShadowQuality(level: ShadowQualityLevel): void {
  if (level === "off") {
    renderer.shadowMap.enabled = false;
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) m.needsUpdate = true;
      }
    });
    return;
  }
  renderer.shadowMap.enabled = true;
  const size = level === "high" ? 2048 : level === "medium" ? 1024 : 512;
  dirLight.shadow.mapSize.set(size, size);
  if (dirLight.shadow.map) {
    dirLight.shadow.map.dispose();
    dirLight.shadow.map = null;
  }
  scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.material) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) m.needsUpdate = true;
    }
  });
}

// Single ocean plane with fade-based animation: waves in the center around
// the board, flat at the edges. Keeps the perf win of only animating a
// small region while avoiding the two-plane seam and the shadow / fog /
// opacity mismatch that came with the LOD approach.
const oceanTextureLoader = new THREE.TextureLoader();

const OCEAN_BASE_Y = -0.58;
const OCEAN_SIZE = 500; // world units per side
const OCEAN_SEGMENTS = 60; // 61x61 = 3721 verts
/** Radius (infinity-norm) inside which waves are at full amplitude. */
export const OCEAN_FADE_START = 60;
/** Radius at which waves are fully gone (plane is flat beyond this). */
export const OCEAN_FADE_END = 75;
export const OCEAN_FADE_RANGE = OCEAN_FADE_END - OCEAN_FADE_START;

const oceanTexture = oceanTextureLoader.load(
  "/assets/textures/ocean-water.png",
);
oceanTexture.wrapS = THREE.RepeatWrapping;
oceanTexture.wrapT = THREE.RepeatWrapping;
// Preserve the original tile density (~66 world units per tile).
oceanTexture.repeat.set(OCEAN_SIZE / 66, OCEAN_SIZE / 66);
oceanTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
oceanTexture.colorSpace = THREE.SRGBColorSpace;

const oceanMat = new THREE.MeshStandardMaterial({
  color: "#8ed9eb",
  map: oceanTexture,
  roughness: 0.35,
  metalness: 0.02,
  // Smooth shading: vertex normals from computeVertexNormals() drive
  // lighting instead of derivative face normals.
  transparent: true,
  opacity: 0.9,
});

const oceanGeo = new THREE.PlaneGeometry(
  OCEAN_SIZE,
  OCEAN_SIZE,
  OCEAN_SEGMENTS,
  OCEAN_SEGMENTS,
);
oceanGeo.rotateX(-Math.PI / 2);
export const oceanPlane = new THREE.Mesh(oceanGeo, oceanMat);
oceanPlane.position.y = OCEAN_BASE_Y;
oceanPlane.receiveShadow = true;
scene.add(oceanPlane);

export interface OceanVertex {
  x: number;
  y: number;
  z: number;
  /** Wave-amplitude multiplier. 1.0 in the center, 0.0 outside the fade. */
  fade: number;
}

export const basePositions: OceanVertex[] = [];
const oceanPositions = oceanPlane.geometry.attributes.position;
for (let i = 0; i < oceanPositions.count; i++) {
  const x = oceanPositions.getX(i);
  const y = oceanPositions.getY(i);
  const z = oceanPositions.getZ(i);
  // Infinity norm so the fade follows the square plane's edges.
  const d = Math.max(Math.abs(x), Math.abs(z));
  let fade: number;
  if (d <= OCEAN_FADE_START) fade = 1;
  else if (d >= OCEAN_FADE_END) fade = 0;
  else fade = 1 - (d - OCEAN_FADE_START) / OCEAN_FADE_RANGE;
  basePositions.push({ x, y, z, fade });
}

// Board group: cleared and rebuilt on every state update.
export const boardGroup = new THREE.Group();
scene.add(boardGroup);

// Mutable sets the board rendering / animation layers read.
export const dynamicTextures = new Set<THREE.Texture>();
export let floatingBoats: THREE.Group[] = [];
export let animatedSheep: THREE.Group[] = [];
export let animatedWindmills: THREE.Object3D[] = [];
export let animatedTractors: THREE.Object3D[] = [];
export let animatedMinecarts: THREE.Object3D[] = [];

export function clearFloatingBoats(): void {
  floatingBoats = [];
}
export function clearAnimatedSheep(): void {
  animatedSheep = [];
}
export function clearAnimatedWindmills(): void {
  animatedWindmills = [];
}
export function clearAnimatedTractors(): void {
  animatedTractors = [];
}
export function clearAnimatedMinecarts(): void {
  animatedMinecarts = [];
}
export function pushFloatingBoat(boat: THREE.Group): void {
  floatingBoats.push(boat);
}
export function pushAnimatedSheep(sheep: THREE.Group): void {
  animatedSheep.push(sheep);
}
export function pushAnimatedWindmill(blades: THREE.Object3D): void {
  animatedWindmills.push(blades);
}
export function pushAnimatedTractor(tractor: THREE.Object3D): void {
  animatedTractors.push(tractor);
}
export function pushAnimatedMinecart(cart: THREE.Object3D): void {
  animatedMinecarts.push(cart);
}
