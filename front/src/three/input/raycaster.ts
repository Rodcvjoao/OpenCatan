// Mouse listeners: mousemove updates the hover token, click dispatches to
// the board click router.

import * as THREE from "three";

import { GameState } from "../../state";
import type { BoardMeshUserData } from "../../types";
import { boardGroup, camera, renderer } from "../scene";
import { handleBoardClick } from "./clickRouter";
import { hideHoverToken, showHoverToken } from "./hoverToken";

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const hoverMouse = new THREE.Vector2();

// Throttle hover raycasts to ~60Hz. Mousemove can fire at 1000Hz on high-
// polling-rate mice, and each raycast traverses the entire scene graph
// (forest/mountain/sheep meshes included), which is the biggest per-move
// cost during rotation.
const HOVER_RAYCAST_MIN_INTERVAL_MS = 16;
let lastHoverRaycastMs = 0;

function walkUpToTyped(obj: THREE.Object3D): THREE.Object3D | null {
  let o: THREE.Object3D | null = obj;
  while (o && !(o.userData as BoardMeshUserData | undefined)?.type) {
    o = o.parent;
  }
  return o && (o.userData as BoardMeshUserData).type ? o : null;
}

export function installInputListeners(): void {
  renderer.domElement.addEventListener("mousemove", (event) => {
    const now = performance.now();
    if (now - lastHoverRaycastMs < HOVER_RAYCAST_MIN_INTERVAL_MS) return;
    lastHoverRaycastMs = now;
    hoverMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    hoverMouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(hoverMouse, camera);
    const intersects = raycaster.intersectObjects(boardGroup.children, true);
    for (const hit of intersects) {
      const obj = walkUpToTyped(hit.object);
      if (!obj) continue;
      const data = obj.userData as BoardMeshUserData;
      if (data.type === "tile") {
        showHoverToken(data.id);
        return;
      }
      break;
    }
    hideHoverToken();
  });

  renderer.domElement.addEventListener("mouseleave", hideHoverToken);

  renderer.domElement.addEventListener("click", (event) => {
    if (GameState.interactionMode === "none") return;
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(boardGroup.children, true);
    for (const hit of intersects) {
      const obj = walkUpToTyped(hit.object);
      if (!obj) continue;
      const data = obj.userData as BoardMeshUserData;
      void handleBoardClick(data.type, data.id);
      break;
    }
  });
}
