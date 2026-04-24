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
      showVictimDialog(id, [...victimIds]);
    } else {
      await apiCommand("move_robber", { tile_id: id });
    }
  }
  // updateState (via apiCommand) re-renders everything including action
  // buttons, so we don't need an explicit renderActionButtons() here.
}
