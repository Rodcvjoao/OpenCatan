import { GameState } from "../../state";
import { $, $opt } from "../dom";

export function showWaitingDiscardDialog(waitingPlayerNames: string[]): void {
  const dialog = $("waiting-discard-dialog");
  const info = $("waiting-discard-info");
  const names =
    waitingPlayerNames.length === 1
      ? waitingPlayerNames[0]
      : waitingPlayerNames.join(", ");
  info.textContent =
    waitingPlayerNames.length === 1
      ? `Waiting for ${names} to discard resources before play can continue.`
      : `Waiting for these players to discard resources before play can continue: ${names}.`;
  dialog.classList.remove("hidden");
}

export function hideWaitingDiscardDialog(): void {
  $opt("waiting-discard-dialog")?.classList.add("hidden");
}

export function syncWaitingDiscardDialog(): void {
  const pendingDiscards = GameState.publicState?.pending?.pending_discards;
  if (!pendingDiscards || GameState.myPlayerId == null) {
    hideWaitingDiscardDialog();
    return;
  }

  const myRequired = pendingDiscards[String(GameState.myPlayerId)] ?? 0;
  if (myRequired > 0) {
    hideWaitingDiscardDialog();
    return;
  }

  const waitingPlayerNames = Object.entries(pendingDiscards)
    .filter(([, required]) => required > 0)
    .map(([playerId]) => GameState.playerMap[Number(playerId)]?.name ?? "Player");

  if (waitingPlayerNames.length === 0) {
    hideWaitingDiscardDialog();
    return;
  }

  showWaitingDiscardDialog(waitingPlayerNames);
}
