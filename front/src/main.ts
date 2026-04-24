// Bootstrap: wire runtime-registered callbacks, bind static DOM handlers,
// install Three.js input listeners, kick off animate(), and auto-join if the
// URL carries `?game_id=...&player_token=...`.

import "./css/board.css";

import { apiGetState } from "./net/api";
import { connectWebSocket } from "./net/ws";
import { GameState, registerStateCallbacks, updateState } from "./state";
import {
  registerActionButtonsCallbacks,
  renderActionButtons,
} from "./ui/actions";
import { registerActionCallbacks } from "./ui/commands";
import { bindCreateGameDialog } from "./ui/dialogs/createGame";
import { bindDiscardDialog } from "./ui/dialogs/discard";
import { bindVictimDialog } from "./ui/dialogs/victim";
import { bindFpsCounter } from "./ui/fpsCounter";
import {
  checkPendingModals,
  registerPendingCallbacks,
} from "./ui/pendingModals";
import { bindSidebar } from "./ui/sidebar";
import { showToast } from "./ui/toast";
import { updateUI } from "./ui/updateUI";
import { $ } from "./ui/dom";
import { animate, installResizeHandler } from "./three/animate";
import { rebuildScene } from "./three/board/rebuild";
import { installInputListeners } from "./three/input/raycaster";

// ---- Wire cross-layer callbacks so state.ts / ui/* don't statically import
//      the 3D layer (and vice versa).
registerStateCallbacks({
  rebuildScene,
  updateUI,
  checkPendingModals,
});
registerActionCallbacks({
  rebuildScene,
  renderActionButtons,
});
registerActionButtonsCallbacks({ rebuildScene });
registerPendingCallbacks({
  rebuildScene,
  renderActionButtons,
});

// ---- Static DOM bindings (sidebar, dialog buttons, canvas listeners).
bindSidebar();
bindCreateGameDialog();
bindDiscardDialog();
bindVictimDialog();
bindFpsCounter();
installInputListeners();
installResizeHandler();

// ---- URL-driven auto-join ----
async function init(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const gameId = params.get("game_id");
  const playerToken = params.get("player_token");
  if (gameId && playerToken) {
    GameState.gameId = gameId;
    GameState.playerToken = playerToken;
    $("create-game-dialog").classList.add("hidden");
    const state = await apiGetState(gameId, playerToken);
    if (state) {
      updateState(state);
      connectWebSocket(gameId);
    } else {
      $("create-game-dialog").classList.remove("hidden");
      showToast("Could not load game, create a new one", "error");
    }
  }
}

animate();
void init();
