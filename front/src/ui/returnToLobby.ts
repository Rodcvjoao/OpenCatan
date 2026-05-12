import { apiReturnToLobby } from "../net/api";
import { disconnectWebSocket } from "../net/ws";
import { GameState } from "../state";
import type { PlayerColor } from "../types";
import { resumeAsHost } from "./menu/createRoom";
import { resumeAsGuest } from "./menu/joinRoom";
import { saveActiveRoom } from "./menu/storage";
import { showToast } from "./toast";

export function clearGameUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("game_id");
  url.searchParams.delete("player_token");
  history.replaceState(null, "", url);
}

export async function returnToLobbyFromGame(
  button?: HTMLButtonElement,
): Promise<void> {
  if (!GameState.gameId || !GameState.playerToken) {
    showToast("Could not return to lobby from this state", "error");
    return;
  }

  const originalText = button?.textContent ?? "Return To Lobby";
  if (button) {
    button.disabled = true;
    button.textContent = "Returning...";
  }

  try {
    const result = await apiReturnToLobby(
      GameState.gameId,
      GameState.playerToken,
    );
    if (!result) return;

    const myPlayerId = GameState.myPlayerId;
    const player =
      myPlayerId == null
        ? undefined
        : GameState.publicState?.players.find((p) => p.id === myPlayerId);
    const byColor = player
      ? result.room.players.find((p) => p.color === player.color)
      : undefined;
    const byName = player
      ? result.room.players.find((p) => p.name === player.name)
      : undefined;
    const byHost = result.room.players.find((p) => p.is_host);
    const roomPlayer = byColor ?? byName ?? byHost;
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
    if (button) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}
