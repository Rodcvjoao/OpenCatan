// Spinning, floating preview token that appears over the hovered tile.

import * as THREE from "three";

import { HEX_HEIGHT } from "../../config";
import { GameState } from "../../state";
import { tokenGeom } from "../geometry";
import { scene } from "../scene";
import { getHoverTokenTexture } from "../board/tokens";

export const hoverTokenMat = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  roughness: 0.5,
  transparent: true,
  opacity: 0.0,
  side: THREE.DoubleSide,
});

export const hoverTokenPivot = new THREE.Group();
const hoverTokenMesh = new THREE.Mesh(tokenGeom, hoverTokenMat);
hoverTokenMesh.rotation.x = Math.PI / 2;
hoverTokenMesh.castShadow = true;
hoverTokenMesh.receiveShadow = true;
hoverTokenPivot.add(hoverTokenMesh);
hoverTokenPivot.visible = false;
hoverTokenPivot.userData = { currentTileId: null, targetOpacity: 0 };
scene.add(hoverTokenPivot);

export const HOVER_TOKEN_FLOAT_Y = HEX_HEIGHT / 2 + 4.2;

export function showHoverToken(tileId: number): void {
  const pos = GameState.tilePositions[tileId];
  const number = GameState.tileNumbers[tileId];
  if (!pos || number === undefined) {
    hideHoverToken();
    return;
  }
  if (hoverTokenPivot.userData.currentTileId !== tileId) {
    hoverTokenMat.map = getHoverTokenTexture(number);
    hoverTokenMat.needsUpdate = true;
    hoverTokenPivot.position.set(pos.x, HOVER_TOKEN_FLOAT_Y, pos.z);
    hoverTokenPivot.userData.currentTileId = tileId;
  }
  hoverTokenPivot.visible = true;
  hoverTokenPivot.userData.targetOpacity = 1.0;
}

export function hideHoverToken(): void {
  hoverTokenPivot.userData.targetOpacity = 0.0;
  hoverTokenPivot.userData.currentTileId = null;
}
