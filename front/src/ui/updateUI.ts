// Top-level UI aggregator called by state.updateState after each snapshot.

import { renderActionButtons } from "./actions";
import { renderDiceDisplay } from "./dice";
import { syncInfoDialog } from "./dialogs/info";
import { handleFinishedGame } from "./gameEnd";
import { renderGameOverDialog } from "./gameOver";
import { renderGameLobby } from "./menu/gameLobby";
import { renderPlayerCards } from "./players";
import { renderResourceBar } from "./resources";
import { renderGameStatus } from "./status";

export function updateUI(): void {
  handleFinishedGame();
  renderPlayerCards();
  renderResourceBar();
  renderActionButtons();
  renderGameStatus();
  renderDiceDisplay();
  syncInfoDialog();
  renderGameOverDialog();
  renderGameLobby();
}
