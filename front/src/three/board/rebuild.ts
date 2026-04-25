// Clear and rebuild the board group from the current snapshot in GameState.

import * as THREE from "three";

import { PLAYER_COLORS, RESOURCE_MAP } from "../../config";
import { GameState } from "../../state";
import type { PlayerColor, Resource } from "../../types";
import {
  boardGroup,
  camera,
  clearAnimatedMinecarts,
  clearAnimatedSheep,
  clearAnimatedTractors,
  clearAnimatedWindmills,
  clearFloatingBoats,
  dynamicTextures,
  renderer,
  scene,
} from "../scene";
import { hideHoverToken } from "../input/hoverToken";
import {
  computeEdgePositions,
  computeTilePositions,
  computeVertexPositions,
} from "./positions";
import { renderInteractionHighlights } from "./highlights";
import {
  createRobber,
  renderCity,
  renderPort,
  renderRoad,
  renderSettlement,
  renderTile,
} from "./renderers";
import { reusableGeometries, reusableMaterials } from "./reusable";

function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  if (!material) return;
  const materials = Array.isArray(material) ? material : [material];
  for (const mat of materials) {
    if (!mat) continue;
    if (reusableMaterials.has(mat)) continue;
    // `map` is present on MeshStandard/Basic materials etc.; widen via any
    // so we can inspect without depending on each material subtype.
    const maybeMap = (mat as unknown as { map?: THREE.Texture | null }).map;
    if (maybeMap && dynamicTextures.has(maybeMap)) {
      maybeMap.dispose();
      dynamicTextures.delete(maybeMap);
    }
    mat.dispose();
  }
}

export function clearBoardGroup(): void {
  clearFloatingBoats();
  clearAnimatedSheep();
  clearAnimatedWindmills();
  clearAnimatedTractors();
  clearAnimatedMinecarts();
  for (let i = boardGroup.children.length - 1; i >= 0; i--) {
    const obj = boardGroup.children[i];
    boardGroup.remove(obj);
    obj.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (mesh.geometry && !reusableGeometries.has(mesh.geometry)) {
        mesh.geometry.dispose();
      }
      if (mesh.material) {
        disposeMaterial(mesh.material as THREE.Material | THREE.Material[]);
      }
    });
  }
}

export function rebuildScene(): void {
  clearBoardGroup();
  hideHoverToken();
  GameState.tileNumbers = {};
  const state = GameState.publicState;
  if (!state) return;
  const board = state.board;

  // Compute positions.
  GameState.tilePositions = computeTilePositions(board.tiles);
  GameState.vertexPositions = computeVertexPositions(
    board.tiles,
    GameState.tilePositions,
  );
  GameState.edgePositions = computeEdgePositions(
    board.edges,
    GameState.vertexPositions,
  );

  // Land tiles.
  for (const tile of board.tiles) {
    const pos = GameState.tilePositions[tile.id];
    if (!pos) continue;
    const resource = RESOURCE_MAP[tile.resource as Resource] ?? "desert";
    renderTile(pos.x, pos.z, resource, tile.number_token, tile.id);
  }

  // Ports.
  if (board.ports) {
    for (const port of board.ports) renderPort(port);
  }

  // Robber.
  if (board.robber_tile_id !== null && board.robber_tile_id !== undefined) {
    const rpos = GameState.tilePositions[board.robber_tile_id];
    if (rpos) createRobber(rpos.x, rpos.z);
  }

  // Buildings.
  for (const vertex of board.vertices) {
    if (!vertex.building) continue;
    const pos = GameState.vertexPositions[vertex.id];
    if (!pos) continue;
    const player = GameState.playerMap[vertex.building.owner_id];
    const colorHex = player
      ? PLAYER_COLORS[player.color as PlayerColor] ?? player.color
      : "#888";
    if (vertex.building.type === "settlement")
      renderSettlement(pos.x, pos.z, colorHex);
    else if (vertex.building.type === "city")
      renderCity(pos.x, pos.z, colorHex);
  }

  // Roads.
  for (const edge of board.edges) {
    if (!edge.road) continue;
    const pos = GameState.edgePositions[edge.id];
    if (!pos) continue;
    const player = GameState.playerMap[edge.road.owner_id];
    const colorHex = player
      ? PLAYER_COLORS[player.color as PlayerColor] ?? player.color
      : "#888";
    renderRoad(pos.x, pos.z, pos.angle, colorHex);
  }

  // Interaction highlights.
  if (GameState.interactionMode !== "none") renderInteractionHighlights();

  // Warm up shader compilation for every material now visible, so the very
  // next frame doesn't stall the first time the renderer sees each program.
  renderer.compile(scene, camera);
}
