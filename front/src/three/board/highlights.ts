// Transparent overlays for legal-placement interaction modes.

import * as THREE from "three";

import { HEX_HEIGHT } from "../../config";
import { GameState } from "../../state";
import type { BoardMeshUserData } from "../../types";
import {
  cityBaseGeo,
  cityTopGeo,
  houseBaseGeo,
  houseRoofGeo,
  roadGeo,
} from "../geometry";
import {
  hlCityMat,
  hlRoadMat,
  hlRobberMat,
  hlRobberMatDim,
  hlSettlementMat,
} from "../materials";
import { boardGroup } from "../scene";

function setUserData(mesh: THREE.Object3D, data: BoardMeshUserData): void {
  mesh.userData = data;
}

// Reused across all move_robber highlight markers.
export const robberHighlightGeo = new THREE.CylinderGeometry(3, 3, 0.3, 6);

export function renderInteractionHighlights(): void {
  const mode = GameState.interactionMode;
  const publicState = GameState.publicState;
  if (!publicState) return;
  const board = publicState.board;

  if (mode === "place_settlement" || mode === "place_setup_settlement") {
    for (const vertex of board.vertices) {
      if (vertex.building) continue;
      let blocked = false;
      for (const adjId of vertex.adjacent_vertex_ids) {
        const adj = board.vertices.find((v) => v.id === adjId);
        if (adj && adj.building) {
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      const pos = GameState.vertexPositions[vertex.id];
      if (!pos) continue;
      const group = new THREE.Group();
      const base = new THREE.Mesh(houseBaseGeo, hlSettlementMat);
      base.position.y = 0.75;
      const roof = new THREE.Mesh(houseRoofGeo, hlSettlementMat);
      roof.position.y = 2.25;
      group.add(base, roof);
      group.position.set(pos.x, HEX_HEIGHT / 2, pos.z);
      setUserData(group, { type: "vertex", id: vertex.id });
      boardGroup.add(group);
    }
  } else if (
    mode === "place_road" ||
    mode === "place_setup_road" ||
    mode === "play_road_building"
  ) {
    const selectedRoadBuildingEdges =
      mode === "play_road_building"
        ? new Set(GameState.pendingRoadBuildingEdgeIds)
        : null;
    for (const edge of board.edges) {
      if (edge.road) continue;
      if (selectedRoadBuildingEdges?.has(edge.id)) continue;
      const pos = GameState.edgePositions[edge.id];
      if (!pos) continue;
      const road = new THREE.Mesh(roadGeo, hlRoadMat);
      road.position.set(pos.x, HEX_HEIGHT / 2 + 0.4, pos.z);
      road.rotation.y = -pos.angle;
      setUserData(road, { type: "edge", id: edge.id });
      boardGroup.add(road);
    }
  } else if (mode === "place_city") {
    for (const vertex of board.vertices) {
      if (!vertex.building || vertex.building.type !== "settlement") continue;
      if (vertex.building.owner_id !== GameState.myPlayerId) continue;
      const pos = GameState.vertexPositions[vertex.id];
      if (!pos) continue;
      const group = new THREE.Group();
      const base = new THREE.Mesh(cityBaseGeo, hlCityMat);
      base.position.y = 1;
      const top = new THREE.Mesh(cityTopGeo, hlCityMat);
      top.position.y = 2.75;
      group.add(base, top);
      group.position.set(pos.x, HEX_HEIGHT / 2, pos.z);
      setUserData(group, { type: "vertex", id: vertex.id });
      boardGroup.add(group);
    }
  } else if (mode === "move_robber" || mode === "play_knight") {
    const robberTileId = board.robber_tile_id;
    for (const tile of board.tiles) {
      const pos = GameState.tilePositions[tile.id];
      if (!pos) continue;
      if (tile.id === robberTileId) {
        // Tile atual do ladrão: overlay cinza estático, sem userData → não clicável.
        const dim = new THREE.Mesh(robberHighlightGeo, hlRobberMatDim);
        dim.position.set(pos.x, HEX_HEIGHT / 2 + 0.5, pos.z);
        boardGroup.add(dim);
      } else {
        // Tiles válidos: overlay laranja pulsante + userData para o click handler.
        const marker = new THREE.Mesh(robberHighlightGeo, hlRobberMat);
        marker.position.set(pos.x, HEX_HEIGHT / 2 + 0.5, pos.z);
        setUserData(marker, { type: "tile", id: tile.id });
        boardGroup.add(marker);
      }
    }
  }
}
