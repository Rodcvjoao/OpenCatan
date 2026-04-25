// Right-side action buttons + inline help banners.
//
// Handlers use addEventListener (no inline onclick strings) so the module
// system stays clean.

import {
  GameState,
  hasLegalAction,
  isMyTurn,
  isSetupPhase,
} from "../state";
import type { InteractionMode } from "../types";
import {
  doBankTrade,
  doBuyDevCard,
  doEndTurn,
  doProposeTradeOffer,
  doRollDice,
  toggleMode,
} from "./commands";
import { $ } from "./dom";

type VoidFn = () => void;
let rebuildSceneFn: VoidFn = () => {};

export function registerActionButtonsCallbacks(callbacks: {
  rebuildScene: VoidFn;
}): void {
  rebuildSceneFn = callbacks.rebuildScene;
}

function button(
  label: string,
  icon: string,
  active: boolean,
): HTMLButtonElement {
  const btn = document.createElement("button");
  btn.className =
    "btn-action px-4 py-2 rounded flex items-center space-x-2 font-bold text-[#3e2723] text-sm" +
    (active ? " active" : "");
  btn.innerHTML = `<span>${icon}</span><span>${label}</span>`;
  return btn;
}

function banner(text: string, tone: "green" | "red"): HTMLDivElement {
  const div = document.createElement("div");
  const classes =
    tone === "green"
      ? "bg-green-800/80 text-white text-xs px-3 py-1 rounded border border-green-600"
      : "bg-red-800/80 text-white text-xs px-3 py-1 rounded border border-red-600";
  div.className = classes;
  div.textContent = text;
  return div;
}

export function renderActionButtons(): void {
  const el = $("action-buttons");
  el.innerHTML = "";
  if (!GameState.publicState) return;

  const mode = GameState.interactionMode;
  const phase = GameState.publicState.phase;

  // Auto-enter setup placement when it's our turn in setup phase.
  if (isMyTurn() && isSetupPhase() && mode === "none") {
    if (hasLegalAction("place_setup_settlement")) {
      GameState.interactionMode = "place_setup_settlement";
      rebuildSceneFn();
    } else if (hasLegalAction("place_setup_road")) {
      GameState.interactionMode = "place_setup_road";
      rebuildSceneFn();
    }
  }

  // Info banners
  if (isSetupPhase() && isMyTurn()) {
    if (GameState.interactionMode === "place_setup_settlement") {
      el.appendChild(banner("Click a vertex to place settlement", "green"));
    } else if (GameState.interactionMode === "place_setup_road") {
      el.appendChild(banner("Click an edge to place road", "green"));
    }
  }
  if (GameState.interactionMode === "move_robber") {
    el.appendChild(banner("Click a tile to move the robber", "red"));
  }

  // Command buttons gated by legal_actions.
  if (hasLegalAction("roll_dice")) {
    const b = button("Roll Dice", "&#127922;", false);
    b.addEventListener("click", doRollDice);
    el.appendChild(b);
  }
  if (hasLegalAction("build_road")) {
    const b = button("Road", "&#128739;&#65039;", mode === "place_road");
    b.addEventListener("click", () => toggleMode("place_road" as InteractionMode));
    el.appendChild(b);
  }
  if (hasLegalAction("build_settlement")) {
    const b = button("Settlement", "&#127968;", mode === "place_settlement");
    b.addEventListener("click", () =>
      toggleMode("place_settlement" as InteractionMode),
    );
    el.appendChild(b);
  }
  if (hasLegalAction("build_city")) {
    const b = button("City", "&#127983;", mode === "place_city");
    b.addEventListener("click", () => toggleMode("place_city" as InteractionMode));
    el.appendChild(b);
  }
  if (hasLegalAction("buy_development_card")) {
    const b = button("Dev Card", "&#128220;", false);
    b.addEventListener("click", doBuyDevCard);
    el.appendChild(b);
  }
  if (hasLegalAction("trade_bank")) {
    const b = button("Bank Trade", "&#128176;", false);
    b.addEventListener("click", doBankTrade);
    el.appendChild(b);
  }
  if (hasLegalAction("propose_trade_offer")) {
    const b = button("Offer Trade", "&#x1F91D;", false);
    b.addEventListener("click", doProposeTradeOffer);
    el.appendChild(b);
  }
  if (hasLegalAction("end_turn")) {
    const b = button("End Turn", "&#8635;", false);
    b.addEventListener("click", doEndTurn);
    el.appendChild(b);
  }

  // Waiting for other player.
  if (
    !isMyTurn() &&
    phase !== "FINISHED" &&
    !hasLegalAction("discard_resources")
  ) {
    const cp =
      GameState.publicState.turn?.current_player_id != null
        ? GameState.playerMap[GameState.publicState.turn.current_player_id]
        : null;
    const waiting = document.createElement("div");
    waiting.className =
      "bg-black/60 text-yellow-300 text-xs px-3 py-1.5 rounded border border-yellow-800";
    waiting.textContent = "Waiting for " + (cp?.name ?? "...") + "...";
    el.appendChild(waiting);
  }

  // Finished
  if (phase === "FINISHED") {
    const winner = GameState.publicState.players.reduce((a, b) =>
      a.victory_points > b.victory_points ? a : b,
    );
    const win = document.createElement("div");
    win.className =
      "bg-yellow-700 text-white text-sm px-4 py-2 rounded-lg font-game border-2 border-yellow-400";
    win.innerHTML = "&#127942; " + winner.name + " wins!";
    el.appendChild(win);
  }
}
