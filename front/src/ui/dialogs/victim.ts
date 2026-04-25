// "Steal from" dialog shown after the robber lands on a tile with multiple
// candidate victims.

import { PLAYER_COLORS } from "../../config";
import { apiCommand } from "../../net/api";
import { GameState } from "../../state";
import type { PlayerColor } from "../../types";
import { $ } from "../dom";
import { showToast } from "../toast";

export function showVictimDialog(tileId: number, victimIds: number[]): void {
  const dialog = $("victim-dialog");
  const container = $("victim-buttons");
  container.innerHTML = "";
  for (const vid of victimIds) {
    const p = GameState.playerMap[vid];
    const color = p ? PLAYER_COLORS[p.color as PlayerColor] ?? "#888" : "#888";
    const btn = document.createElement("button");
    btn.className = "w-full py-2 rounded font-bold text-white";
    btn.style.background = color;
    btn.textContent = p?.name ?? "Player " + vid;
    btn.addEventListener("click", () => {
      void selectVictim(tileId, vid);
    });
    container.appendChild(btn);
  }
  dialog.classList.remove("hidden");
}

export async function selectVictim(
  tileId: number,
  victimId: number,
): Promise<void> {
  $("victim-dialog").classList.add("hidden");
  const result = await apiCommand("move_robber", {
    tile_id: tileId,
    victim_id: victimId,
  });
  if (result && result.accepted) {
    const ev = result.events?.find((e) => e.type === "robber_moved");
    if (ev && "stolen_resource" in ev && ev.stolen_resource) {
      showToast("Stole " + String(ev.stolen_resource) + "!", "success");
    }
  }
}

export function hideVictimDialog(): void {
  $("victim-dialog").classList.add("hidden");
  if (GameState.pendingRobberTileId !== null) {
    void apiCommand("move_robber", {
      tile_id: GameState.pendingRobberTileId,
    });
    GameState.pendingRobberTileId = null;
  }
}

/** Wire the "Skip (no steal)" button once on boot. */
export function bindVictimDialog(): void {
  $("victim-skip").addEventListener("click", hideVictimDialog);
}
