// Maps interactionMode + clicked userData into API commands.

import { apiCommand } from "../../net/api";
import { GameState, isSetupPhase } from "../../state";
import { showVictimDialog } from "../../ui/dialogs/victim";
import { updateUI } from "../../ui/updateUI";
import { rebuildScene } from "../board/rebuild";

type BoardTargetType = "tile" | "vertex" | "edge";

export async function handleBoardClick(
  type: BoardTargetType,
  id: number,
): Promise<void> {
  const mode = GameState.interactionMode;

  if (
    (mode === "place_settlement" || mode === "place_setup_settlement") &&
    type === "vertex"
  ) {
    const cmd = isSetupPhase() ? "place_setup_settlement" : "build_settlement";
    const result = await apiCommand(cmd, { vertex_id: id });
    if (result && result.accepted && isSetupPhase()) {
      GameState.interactionMode = "place_setup_road";
      rebuildScene();
      updateUI();
    }
  } else if (
    (mode === "place_road" || mode === "place_setup_road") &&
    type === "edge"
  ) {
    const cmd = isSetupPhase() ? "place_setup_road" : "build_road";
    await apiCommand(cmd, { edge_id: id });
  } else if (mode === "place_city" && type === "vertex") {
    await apiCommand("build_city", { vertex_id: id });
  } else if (mode === "move_robber" && type === "tile") {
    GameState.pendingRobberTileId = id;
    const board = GameState.publicState?.board;
    if (!board) return;
    if (id === board.robber_tile_id) return;
    const tile = board.tiles.find((t) => t.id === id);
    if (!tile) return;
    const victimIds = new Set<number>();
    for (const vid of tile.vertex_ids) {
      const vertex = board.vertices.find((v) => v.id === vid);
      if (
        vertex &&
        vertex.building &&
        vertex.building.owner_id !== GameState.myPlayerId
      ) {
        victimIds.add(vertex.building.owner_id);
      }
    }
    if (victimIds.size > 0) {
      const cardCounts: Record<number, number> = {};
      for (const vid of victimIds) {
        const p = GameState.publicState?.players.find((player) => player.id === vid);
        if (p) cardCounts[vid] = p.resource_count;
      }
      showVictimDialog(id, [...victimIds], "move_robber", cardCounts);
    } else {
      await apiCommand("move_robber", { tile_id: id });
    }
  } else if (mode === "play_knight" && type === "tile") {
    const board = GameState.publicState?.board;
    if (!board) return;
    if (id === board.robber_tile_id) return;
    const tile = board.tiles.find((t) => t.id === id);
    if (!tile) return;
    const victimIds = new Set<number>();
    for (const vid of tile.vertex_ids) {
      const vertex = board.vertices.find((v) => v.id === vid);
      if (
        vertex &&
        vertex.building &&
        vertex.building.owner_id !== GameState.myPlayerId
      ) {
        victimIds.add(vertex.building.owner_id);
      }
    }
    if (victimIds.size > 0) {
      const cardCounts: Record<number, number> = {};
      for (const vid of victimIds) {
        const p = GameState.publicState?.players.find((player) => player.id === vid);
        if (p) cardCounts[vid] = p.resource_count;
      }
      showVictimDialog(id, [...victimIds], "play_knight", cardCounts);
    } else {
      const result = await apiCommand("play_development_card", {
        card_type: "knight",
        args: { tile_id: id },
      });
      if (result?.accepted) {
        GameState.interactionMode = "none";
      }
    }
  } else if (mode === "play_road_building" && type === "edge") {
    if (!GameState.pendingRoadBuildingEdgeIds.includes(id)) {
      GameState.pendingRoadBuildingEdgeIds.push(id);
    }
    if (GameState.pendingRoadBuildingEdgeIds.length < 2) {
      rebuildScene();
      updateUI();
      return;
    }
    const edgeIds = [...GameState.pendingRoadBuildingEdgeIds.slice(0, 2)];
    const result = await apiCommand("play_development_card", {
      card_type: "road_building",
      args: { edge_ids: edgeIds },
    });
    GameState.interactionMode = "none";
    GameState.pendingRoadBuildingEdgeIds = [];
    if (!result?.accepted) {
      rebuildScene();
      updateUI();
    }
  }
  // updateState (via apiCommand) re-renders everything including action
  // buttons, so we don't need an explicit renderActionButtons() here.
}
