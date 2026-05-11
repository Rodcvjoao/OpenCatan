// Command-button shims used by the action bar and the dialogs.

import { apiCommand } from "../net/api";
import {
  GameState,
  hasLegalAction,
} from "../state";
import type { InteractionMode } from "../types";
import { showDevelopmentResourceDialog } from "./dialogs/development";
import { openTradeDialog } from "./dialogs/tradeOffer";
import { showToast } from "./toast";

// `toggleMode` is exported so the action bar can flip interactionMode and
// re-render highlights. It needs the rebuild+re-render callbacks that only
// the Three.js and UI layers provide; main.ts wires them in.

type VoidFn = () => void;
let rebuildSceneFn: VoidFn = () => {};
let renderActionButtonsFn: VoidFn = () => {};

export function registerActionCallbacks(callbacks: {
  rebuildScene: VoidFn;
  renderActionButtons: VoidFn;
}): void {
  rebuildSceneFn = callbacks.rebuildScene;
  renderActionButtonsFn = callbacks.renderActionButtons;
}

export function toggleMode(newMode: InteractionMode): void {
  GameState.interactionMode =
    GameState.interactionMode === newMode ? "none" : newMode;
  if (GameState.interactionMode !== "play_road_building") {
    GameState.pendingRoadBuildingEdgeIds = [];
  }
  rebuildSceneFn();
  renderActionButtonsFn();
}

export function startKnightCard(): void {
  if (!hasLegalAction("play_development_card")) {
    showToast("Development cards are not playable right now", "warning");
    return;
  }
  GameState.interactionMode =
    GameState.interactionMode === "play_knight" ? "none" : "play_knight";
  GameState.pendingRoadBuildingEdgeIds = [];
  rebuildSceneFn();
  renderActionButtonsFn();
  if (GameState.interactionMode === "play_knight") {
    showToast("Choose a tile for the knight", "info");
  }
}

export function startRoadBuildingCard(): void {
  if (!hasLegalAction("play_development_card")) {
    showToast("Development cards are not playable right now", "warning");
    return;
  }
  GameState.interactionMode =
    GameState.interactionMode === "play_road_building"
      ? "none"
      : "play_road_building";
  GameState.pendingRoadBuildingEdgeIds = [];
  rebuildSceneFn();
  renderActionButtonsFn();
  if (GameState.interactionMode === "play_road_building") {
    showToast("Choose two road edges", "info");
  }
}

export function startYearOfPlentyCard(): void {
  showDevelopmentResourceDialog("year_of_plenty");
}

export function startMonopolyCard(): void {
  showDevelopmentResourceDialog("monopoly");
}

export async function doRollDice(): Promise<void> {
  const r = await apiCommand("roll_dice");
  if (r && r.accepted) {
    // Dice roll success is handled by the game state update and dice UI.
  }
}

export async function doBuyDevCard(): Promise<void> {
  const r = await apiCommand("buy_development_card");
  if (r && r.accepted) {
    const ev = r.events?.find((e) => e.type === "development_card_bought");
    const cardType =
      ev && "card_type" in ev && typeof ev.card_type === "string"
        ? ev.card_type
        : "card";
    showToast("Bought: " + cardType, "success");
  }
}

export function doProposeTradeOffer(): void {
  openTradeDialog("player");
}

export function doBankTrade(): void {
  if (!hasLegalAction("trade_bank")) {
    showToast("Bank trade not available right now", "warning");
    return;
  }
  openTradeDialog("bank");
}

export async function doEndTurn(): Promise<void> {
  GameState.interactionMode = "none";
  await apiCommand("end_turn");
}
