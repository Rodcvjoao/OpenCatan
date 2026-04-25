// Top-right status banner showing phase/turn/last-roll.

import { GameState } from "../state";
import { $ } from "./dom";

export function renderGameStatus(): void {
  const el = $("game-status");
  if (!GameState.publicState) {
    el.textContent = "";
    return;
  }
  const s = GameState.publicState;
  const phase = s.phase;
  const turnPhase = s.turn?.turn_phase ?? "";
  const roll = s.turn?.last_roll;
  const turnNum = s.turn?.number ?? 0;

  let text = "Phase: " + phase;
  if (phase === "MAIN") text = "Turn " + turnNum + " | " + turnPhase;
  if (phase === "SETUP_1") text = "Setup Round 1";
  if (phase === "SETUP_2") text = "Setup Round 2";
  if (phase === "FINISHED") text = "Game Over";
  if (roll) text += " | Last roll: " + roll;
  el.textContent = text;
}
