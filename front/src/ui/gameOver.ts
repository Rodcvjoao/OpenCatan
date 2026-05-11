import { apiReturnToLobby } from "../net/api";
import { disconnectWebSocket } from "../net/ws";
import { GameState } from "../state";
import type { PlayerColor, PlayerPublic } from "../types";
import { $ } from "./dom";
import { resumeAsHost } from "./menu/createRoom";
import { resumeAsGuest } from "./menu/joinRoom";
import { currentScreen, showScreen } from "./menu/nav";
import { saveActiveRoom } from "./menu/storage";
import { showToast } from "./toast";

let shownForGameId: string | null = null;

function winnerFrom(players: PlayerPublic[]): PlayerPublic | null {
  if (players.length === 0) return null;
  return players.reduce((best, player) =>
    player.victory_points > best.victory_points ? player : best,
  );
}

function clearGameUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("game_id");
  url.searchParams.delete("player_token");
  history.replaceState(null, "", url);
}

async function returnToLobby(button: HTMLButtonElement): Promise<void> {
  if (!GameState.gameId || !GameState.playerToken) {
    showToast("Could not return to lobby from this state", "error");
    return;
  }

  const originalText = button.textContent ?? "Return To Lobby";
  button.disabled = true;
  button.textContent = "Returning...";

  try {
    const result = await apiReturnToLobby(GameState.gameId, GameState.playerToken);
    if (!result) return;
    const myPlayerId = GameState.myPlayerId;
    const player =
      myPlayerId == null
        ? undefined
        : GameState.publicState?.players.find((p) => p.id === myPlayerId);
    const roomPlayer = result.room.players.find((p) =>
      player
        ? p.name === player.name && p.color === player.color
        : false,
    );
    const me = {
      name: roomPlayer?.name ?? player?.name ?? "Player",
      color: (roomPlayer?.color ?? player?.color ?? "red") as PlayerColor,
    };

    saveActiveRoom({
      room_id: result.room.room_id,
      player_token: result.player_token,
      is_host: roomPlayer?.is_host === true,
      name: me.name,
      color: me.color,
    });

    shownForGameId = null;
    disconnectWebSocket();
    clearGameUrl();
    if (roomPlayer?.is_host) {
      resumeAsHost({
        roomId: result.room.room_id,
        playerToken: result.player_token,
        room: result.room,
        me,
      });
    } else {
      resumeAsGuest({
        roomId: result.room.room_id,
        playerToken: result.player_token,
        room: result.room,
        me,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    showToast(`Could not return to lobby: ${message}`, "error");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

export function bindGameOverDialog(): void {
  $("btn-game-over-menu").addEventListener("click", () => {
    disconnectWebSocket();
    clearGameUrl();
    showScreen("main");
  });

  const lobbyButton = $<HTMLButtonElement>("btn-game-over-lobby");
  lobbyButton.addEventListener("click", () => {
    void returnToLobby(lobbyButton);
  });
}

export function renderGameOverDialog(): void {
  const state = GameState.publicState;
  if (!state || state.phase !== "FINISHED") return;
  if (currentScreen() !== "none") return;
  if (shownForGameId === GameState.gameId) return;

  const winner = winnerFrom(state.players);
  $("game-over-winner").textContent = winner
    ? `${winner.name} wins!`
    : "Game Over";

  shownForGameId = GameState.gameId;
  showScreen("game-over");
}
