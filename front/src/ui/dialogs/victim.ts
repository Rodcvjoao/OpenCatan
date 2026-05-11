// "Steal from" dialog shown after the robber lands on a tile with multiple
// candidate victims.

import { PLAYER_COLORS } from "../../config";
import { apiCommand } from "../../net/api";
import { GameState } from "../../state";
import type { PlayerColor } from "../../types";
import { $ } from "../dom";
import { showToast } from "../toast";

type VictimAction = "move_robber" | "play_knight";

let pendingVictimAction: VictimAction = "move_robber";
let pendingVictimTileId: number | null = null;

export function showVictimDialog(
  tileId: number,
  victimIds: number[],
  action: VictimAction = "move_robber",
  cardCounts?: Record<number, number>
): void {
  pendingVictimAction = action;
  pendingVictimTileId = tileId;
  const dialog = $("victim-dialog");
  const container = $("victim-buttons");
  container.innerHTML = "";

  const hint = document.getElementById("victim-step-hint");
  if (hint) {
    hint.textContent = "Selecione uma vítima para roubar uma carta:";
  }

  for (const vid of victimIds) {
    const p = GameState.playerMap[vid];
    const color = p ? PLAYER_COLORS[p.color as PlayerColor] ?? "#888" : "#888";
    const btn = document.createElement("button");
    
    const count = cardCounts ? cardCounts[vid] : undefined;
    
    if (count !== undefined && count === 0) {
      btn.className = "w-full py-2 rounded font-bold text-white opacity-50 cursor-not-allowed";
      btn.style.background = color;
      btn.textContent = `${p?.name ?? "Player " + vid} (Sem cartas para roubar)`;
      btn.disabled = true;
    } else {
      btn.className = "w-full py-2 rounded font-bold text-white";
      btn.style.background = color;
      const countText = count !== undefined ? ` 🃏 ${count} cartas` : "";
      btn.textContent = `${p?.name ?? "Player " + vid}${countText}`;
      btn.addEventListener("click", () => {
        void selectVictim(tileId, vid);
      });
    }
    
    container.appendChild(btn);
  }
  dialog.classList.remove("hidden");
}

export async function selectVictim(
  tileId: number,
  victimId: number,
): Promise<void> {
  $("victim-dialog").classList.add("hidden");
  const result =
    pendingVictimAction === "play_knight"
      ? await apiCommand("play_development_card", {
          card_type: "knight",
          args: { tile_id: tileId, victim_id: victimId },
        })
      : await apiCommand("move_robber", {
          tile_id: tileId,
          victim_id: victimId,
        });
  if (result && result.accepted) {
    const ev = result.events?.find((e) => e.type === "robber_moved");
    if (ev && "stolen_resource" in ev && ev.stolen_resource) {
      showToast("Stole " + String(ev.stolen_resource) + "!", "success");
    } else if (pendingVictimAction === "play_knight") {
      showToast("Knight played", "success");
    }
  }
  pendingVictimAction = "move_robber";
  pendingVictimTileId = null;
}

export function hideVictimDialog(): void {
  $("victim-dialog").classList.add("hidden");
  const tileId = pendingVictimTileId ?? GameState.pendingRobberTileId;
  if (tileId !== null) {
    if (pendingVictimAction === "play_knight") {
      void apiCommand("play_development_card", {
        card_type: "knight",
        args: { tile_id: tileId },
      });
    } else {
      void apiCommand("move_robber", {
        tile_id: tileId,
      });
    }
    GameState.pendingRobberTileId = null;
  }
  pendingVictimAction = "move_robber";
  pendingVictimTileId = null;
}

/** Wire the "Skip (no steal)" button once on boot. */
export function bindVictimDialog(): void {
  $("victim-skip").addEventListener("click", hideVictimDialog);
}
