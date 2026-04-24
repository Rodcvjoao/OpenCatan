// Top-level UI aggregator called by state.updateState after each snapshot.

import { renderActionButtons } from "./actions";
import { renderPlayerCards } from "./players";
import { renderResourceBar } from "./resources";
import { renderGameStatus } from "./status";

export function updateUI(): void {
  renderPlayerCards();
  renderResourceBar();
  renderActionButtons();
  renderGameStatus();
}
