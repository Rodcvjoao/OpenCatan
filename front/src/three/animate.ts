// Per-frame animation: ocean waves, floating boats (including flag flutter),
// and the sheep wander/graze state machine. Ported verbatim from board.html.

import * as THREE from "three";

import { HEX_SIZE } from "../config";
import { fpsFrame } from "../ui/fpsCounter";
import { pointInConvexPoly } from "./flora/pasture";
import {
  OCEAN_FADE_RANGE,
  OCEAN_FADE_START,
  animatedMinecarts,
  animatedSheep,
  animatedTractors,
  animatedWindmills,
  basePositions,
  camera,
  controls,
  floatingBoats,
  oceanPlane,
  renderer,
  scene,
} from "./scene";
import { hoverTokenMat, hoverTokenPivot } from "./input/hoverToken";

type SheepUserData = {
  body?: THREE.Object3D;
  head?: THREE.Object3D;
  legs?: Array<{ mesh: THREE.Mesh; initialZ: number }>;
  walkCycle?: number;
  targetX: number;
  targetZ: number;
  speed: number;
  state: "wandering" | "grazing";
  timer: number;
  grazingPoly: Array<{ x: number; z: number }>;
  sampleBound: number;
  rand: () => number;
};

type TractorUserData = {
  path: THREE.CatmullRomCurve3;
  pathLength: number;
  wheels: Array<{ mesh: THREE.Object3D; radius: number }>;
  loopTime: number;
  offset: number;
};

type MinecartUserData = {
  radius: number;
  speed: number;
  offset: number;
  wheels: Array<{ mesh: THREE.Object3D; radius: number }>;
};

const tractorTempPos = new THREE.Vector3();
const tractorTempNext = new THREE.Vector3();

// Settings flags exposed to the Settings screen. The render loop reads
// these every frame so toggles apply immediately.
export const animateSettings = {
  ocean: true,
  flora: true,
};

export function setAnimateOcean(on: boolean): void {
  animateSettings.ocean = on;
}

export function setAnimateFlora(on: boolean): void {
  animateSettings.flora = on;
}

function oceanFadeAt(x: number, z: number): number {
  const d = Math.max(Math.abs(x), Math.abs(z));
  if (d <= OCEAN_FADE_START) return 1;
  return Math.max(0, 1 - (d - OCEAN_FADE_START) / OCEAN_FADE_RANGE);
}

function getOceanWaveHeightAt(x: number, z: number, time: number): number {
  const fade = oceanFadeAt(x, z);
  if (fade <= 0) return oceanPlane.position.y;
  const wave1 = Math.sin(x * 0.05 + time) * 0.34 * fade;
  const wave2 = Math.sin(z * 0.06 + time * 0.8) * 0.34 * fade;
  const wave3 = Math.sin((x + z) * 0.1 - time * 1.5) * 0.14 * fade;
  return oceanPlane.position.y + wave1 + wave2 + wave3;
}

const animateState = { last: 0, frame: 0 };

export function animate(): void {
  requestAnimationFrame(animate);
  const time = Date.now() * 0.0012;
  const nowMs = Date.now();
  const dt = Math.min(0.1, (nowMs - (animateState.last || nowMs)) / 1000);
  animateState.last = nowMs;
  animateState.frame += 1;

  if (animateSettings.ocean) {
    const positions = oceanPlane.geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const bp = basePositions[i];
      const fade = bp.fade;
      if (fade === 0) {
        // Outer ring: keep the base y to form a flat, seamless apron onto
        // the far static plane. Skip the sin() work entirely.
        positions.setY(i, bp.y);
        continue;
      }
      const wave1 = Math.sin(bp.x * 0.05 + time) * 0.34 * fade;
      const wave2 = Math.sin(bp.z * 0.06 + time * 0.8) * 0.34 * fade;
      const wave3 = Math.sin((bp.x + bp.z) * 0.1 - time * 1.5) * 0.14 * fade;
      positions.setY(i, bp.y + wave1 + wave2 + wave3);
    }
    positions.needsUpdate = true;
    // computeVertexNormals is the fattest leaf on bad frames. Alternating it
    // at 30Hz is visually imperceptible for gentle waves and halves the cost.
    if ((animateState.frame & 1) === 0) {
      oceanPlane.geometry.computeVertexNormals();
    }
  }

  if (animateSettings.flora) {
    for (const boat of floatingBoats) {
      const phase = (boat.userData.floatPhase as number | undefined) ?? 0;
      const worldX = (boat.userData.floatWorldX as number | undefined) ?? 0;
      const worldZ = (boat.userData.floatWorldZ as number | undefined) ?? 0;
      const waveY = getOceanWaveHeightAt(worldX, worldZ, time);
      boat.position.y = waveY + 0.3 + Math.sin(time * 2.2 + phase) * 0.08;
      boat.rotation.x = Math.sin(time * 1.6 + phase) * 0.045;
      boat.rotation.z = Math.cos(time * 1.9 + phase) * 0.035;
      const flag = boat.userData.flag as THREE.Mesh | undefined;
      const flagBase = boat.userData.flagBase as number[] | undefined;
      if (flag && flagBase) {
        const pos = flag.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const baseX = flagBase[i * 3];
          const baseY = flagBase[i * 3 + 1];
          const baseZ = flagBase[i * 3 + 2];
          const freeEdge = baseX / 0.42;
          const flutter =
            Math.sin(time * 9 + phase + baseY * 18) * 0.055 * freeEdge;
          pos.setXYZ(i, baseX, baseY + flutter * 0.35, baseZ + flutter);
        }
        pos.needsUpdate = true;
        flag.geometry.computeVertexNormals();
      }
    }

    // Spin the windmill blade groups. dt-scaled so the speed is framerate-
    // independent.
    const windmillSpin = dt * 1.2;
    for (const blades of animatedWindmills) {
      blades.rotation.z -= windmillSpin;
    }

    // Drive each tractor around its closed path.
    const tractorTimeSec = nowMs / 1000;
    for (const tractor of animatedTractors) {
      const d = tractor.userData as TractorUserData;
      if (!d || !d.path) continue;
      const t = (((tractorTimeSec + d.offset) % d.loopTime) / d.loopTime + 1) % 1;
      d.path.getPointAt(t, tractorTempPos);
      d.path.getPointAt((t + 0.005) % 1, tractorTempNext);

      tractor.position.copy(tractorTempPos);
      tractor.position.y += 0.06 * Math.sin(nowMs * 0.018 + d.offset);

      const dx = tractorTempNext.x - tractorTempPos.x;
      const dz = tractorTempNext.z - tractorTempPos.z;
      tractor.rotation.y = Math.atan2(dx, dz);

      const distanceTraveled = d.pathLength * t;
      for (const w of d.wheels) {
        w.mesh.rotation.x = -distanceTraveled / w.radius;
      }
    }

    // Minecarts looping around circular rails in brickyard tiles.
    for (const cart of animatedMinecarts) {
      const d = cart.userData as MinecartUserData;
      if (!d || d.radius === undefined) continue;
      const angle = tractorTimeSec * d.speed + d.offset;
      cart.position.x = Math.cos(angle) * d.radius;
      cart.position.z = Math.sin(angle) * d.radius;
      cart.position.y = 0.25 * Math.sin(nowMs * 0.018 + d.offset);
      cart.rotation.y = -angle;
      const distance = angle * d.radius;
      for (const w of d.wheels) {
        w.mesh.rotation.x = -distance / w.radius;
      }
    }

    // Sheep state machine + walking gait.
    for (const sheep of animatedSheep) {
      const d = sheep.userData as SheepUserData;
      if (!d) continue;

      d.timer -= dt;
      if (d.timer <= 0) {
        if (d.state === "wandering") {
          d.state = "grazing";
          d.timer = 1.5 + d.rand() * 3.5;
        } else {
          d.state = "wandering";
          d.timer = 2.5 + d.rand() * 4.5;
          let tx = sheep.position.x;
          let tz = sheep.position.z;
          const bound = d.sampleBound || HEX_SIZE * 0.8;
          for (let t = 0; t < 20; t++) {
            const cx = (d.rand() * 2 - 1) * bound;
            const cz = (d.rand() * 2 - 1) * bound;
            if (pointInConvexPoly(cx, cz, d.grazingPoly)) {
              tx = cx;
              tz = cz;
              break;
            }
          }
          d.targetX = tx;
          d.targetZ = tz;
        }
      }

      if (d.state === "wandering") {
        const dx = d.targetX - sheep.position.x;
        const dz = d.targetZ - sheep.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);

        if (distance > 0.12) {
          const nx = dx / distance;
          const nz = dz / distance;
          const step = d.speed * dt;
          const nextX = sheep.position.x + nx * step;
          const nextZ = sheep.position.z + nz * step;
          if (pointInConvexPoly(nextX, nextZ, d.grazingPoly)) {
            sheep.position.x = nextX;
            sheep.position.z = nextZ;
          } else {
            d.state = "grazing";
            d.timer = 0.5 + d.rand() * 1.5;
          }

          const targetRotation = Math.atan2(nx, nz);
          let diff = targetRotation - sheep.rotation.y;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          sheep.rotation.y += diff * Math.min(1, dt * 5);

          d.walkCycle = (d.walkCycle ?? 0) + dt * 8;
          if (d.legs) {
            const swing = 0.3;
            d.legs[0].mesh.position.z =
              d.legs[0].initialZ + Math.sin(d.walkCycle) * swing;
            d.legs[1].mesh.position.z =
              d.legs[1].initialZ + Math.sin(d.walkCycle + Math.PI) * swing;
            d.legs[2].mesh.position.z =
              d.legs[2].initialZ + Math.sin(d.walkCycle + Math.PI) * swing;
            d.legs[3].mesh.position.z =
              d.legs[3].initialZ + Math.sin(d.walkCycle) * swing;
          }
          if (d.body) {
            d.body.position.y = Math.abs(Math.sin(d.walkCycle * 2)) * 0.1;
          }
          if (d.head) {
            d.head.rotation.x = THREE.MathUtils.lerp(d.head.rotation.x, 0, dt * 5);
            d.head.position.y = THREE.MathUtils.lerp(
              d.head.position.y,
              2.3,
              dt * 5,
            );
          }
        } else {
          d.state = "grazing";
          d.timer = 1.5 + d.rand() * 3.5;
        }
      } else {
        if (d.head) {
          d.head.rotation.x = THREE.MathUtils.lerp(
            d.head.rotation.x,
            Math.PI / 3.5,
            dt * 3,
          );
          d.head.position.y = THREE.MathUtils.lerp(
            d.head.position.y,
            1.0,
            dt * 3,
          );
        }
        if (d.legs) {
          for (const leg of d.legs) {
            leg.mesh.position.z = THREE.MathUtils.lerp(
              leg.mesh.position.z,
              leg.initialZ,
              dt * 5,
            );
          }
        }
        if (d.body) {
          d.body.position.y = THREE.MathUtils.lerp(d.body.position.y, 0, dt * 5);
        }
      }
    }
  }

  controls.update();

  // Fade hover token toward target opacity and spin it around Y.
  const target = (hoverTokenPivot.userData.targetOpacity as number) ?? 0;
  const current = hoverTokenMat.opacity;
  if (current !== target) {
    const step = 0.12;
    const next =
      current +
      Math.sign(target - current) * Math.min(step, Math.abs(target - current));
    hoverTokenMat.opacity = next;
    hoverTokenPivot.visible = next > 0.001;
  }
  if (hoverTokenPivot.visible) {
    hoverTokenPivot.rotation.y += 0.025;
  }
  renderer.render(scene, camera);
  fpsFrame(nowMs);
}

export function installResizeHandler(): void {
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}
