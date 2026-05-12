import { disconnectWebSocket } from "../net/ws";
import { GameState } from "../state";
import type { PlayerPublic } from "../types";
import { $ } from "./dom";
import { currentScreen, showScreen } from "./menu/nav";
import { clearGameUrl, returnToLobbyFromGame } from "./returnToLobby";

let shownForGameId: string | null = null;

function winnerFrom(players: PlayerPublic[]): PlayerPublic | null {
  if (players.length === 0) return null;
  const active = players.filter((p) => p.is_active);
  const pool = active.length > 0 ? active : players;
  return pool.reduce((best, player) =>
    player.victory_points > best.victory_points ? player : best,
  );
}


export function bindGameOverDialog(): void {
  $("btn-game-over-menu").addEventListener("click", () => {
    disconnectWebSocket();
    clearGameUrl();
    showScreen("main");
  });

  const lobbyButton = $<HTMLButtonElement>("btn-game-over-lobby");
  lobbyButton.addEventListener("click", () => {
    shownForGameId = null;
    void returnToLobbyFromGame(lobbyButton);
  });
}

export function renderGameOverDialog(): void {
  const state = GameState.publicState;
  if (!state || state.phase !== "FINISHED") return;
  const screen = currentScreen();
  if (screen !== "none" && screen !== "game-over") return;
  if (shownForGameId === GameState.gameId) return;

  const winner = winnerFrom(state.players);
  $("game-over-winner").textContent = winner
    ? `${winner.name} wins!`
    : "Game Over";

  shownForGameId = GameState.gameId;
  showScreen("game-over");
}
