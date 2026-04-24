// Orchestrates modals driven by `public_state.pending`. Called after every
// state update via registerStateCallbacks (see state.ts).

import { GameState, hasLegalAction, isMyTurn } from "../state";
import { showDiscardDialog } from "./dialogs/discard";
import { showTradeOfferDialog } from "./dialogs/tradeOffer";

type VoidFn = () => void;
let rebuildSceneFn: VoidFn = () => {};
let renderActionButtonsFn: VoidFn = () => {};

export function registerPendingCallbacks(callbacks: {
  rebuildScene: VoidFn;
  renderActionButtons: VoidFn;
}): void {
  rebuildSceneFn = callbacks.rebuildScene;
  renderActionButtonsFn = callbacks.renderActionButtons;
}

export function checkPendingModals(): void {
  if (!GameState.publicState) return;
  const pending = GameState.publicState.pending;
  if (!pending) return;

  if (pending.pending_trade_offer) {
    const offer = pending.pending_trade_offer;
    if (
      offer.to_player_id === GameState.myPlayerId &&
      hasLegalAction("respond_trade_offer")
    ) {
      showTradeOfferDialog(offer);
      return;
    }
  }

  // Discard required
  if (pending.pending_discards && GameState.myPlayerId != null) {
    const required = pending.pending_discards[String(GameState.myPlayerId)];
    if (required && required > 0) {
      showDiscardDialog(required);
      return;
    }
  }

  // Robber move required
  if (pending.robber_move_required && isMyTurn()) {
    GameState.interactionMode = "move_robber";
    rebuildSceneFn();
    renderActionButtonsFn();
  }

  // Setup pending road
  if (
    pending.setup &&
    pending.setup.pending_setup_road_player_id === GameState.myPlayerId
  ) {
    GameState.interactionMode = "place_setup_road";
    rebuildSceneFn();
    renderActionButtonsFn();
  }
}
