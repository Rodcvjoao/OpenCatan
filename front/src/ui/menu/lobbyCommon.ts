// Shared helpers for the two lobby screens (host / guest). Centralizes the
// "transition from lobby to actual gameplay" dance so both can reuse it.

import { apiGetState } from "../../net/api";
import { apiLeaveRoom } from "../../net/lobbyApi";
import type { RoomState } from "../../net/lobbyApi";
import { connectRoomWs } from "../../net/lobbyWs";
import type { RoomWsConnection } from "../../net/lobbyWs";
import { connectWebSocket } from "../../net/ws";
import { GameState, updateState } from "../../state";
import type { PlayerColor } from "../../types";
import { closeMenu } from "./nav";
import { clearActiveRoom } from "./storage";

export type RoomWsUpdate = (room: RoomState) => void;

/** Opens a WS connection to a room and dispatches room_updated /
 *  game_started callbacks. Game start transitions into actual gameplay
 *  by replacing GameState and opening the game WS. */
export function startRoomWs(options: {
  roomId: string;
  playerToken: string;
  onRoomUpdate: RoomWsUpdate;
  onGameStartFailed?: (err: unknown) => void;
}): RoomWsConnection {
  return connectRoomWs(options.roomId, options.playerToken, (event) => {
    if (event.type === "room_snapshot" || event.type === "room_updated") {
      options.onRoomUpdate(event.payload);
      return;
    }
    if (event.type === "game_started") {
      const gameToken = event.payload.game_token;
      if (!gameToken) {
        options.onGameStartFailed?.(
          new Error("Did not receive game token from server"),
        );
        return;
      }
      void enterGame(event.payload.game_id, gameToken).catch((err) =>
        options.onGameStartFailed?.(err),
      );
    }
  });
}

/** Fetch the game's state, seed GameState, open the game WS, close the
 *  menu. Shared by host/guest start flows and by boot-time auto-rejoin. */
export async function enterGame(
  gameId: string,
  gameToken: string,
): Promise<void> {
  GameState.gameId = gameId;
  GameState.playerToken = gameToken;

  const url = new URL(window.location.href);
  url.searchParams.set("game_id", gameId);
  url.searchParams.set("player_token", gameToken);
  history.replaceState(null, "", url);

  const state = await apiGetState(gameId, gameToken);
  if (!state) {
    throw new Error("Unable to load game state");
  }
  updateState(state);
  connectWebSocket(gameId);
  clearActiveRoom();
  closeMenu();
}

/** Best-effort leave that also clears local storage. Used by the Leave
 *  buttons and by beforeunload. */
export async function leaveRoomAndClear(
  roomId: string,
  playerToken: string,
): Promise<void> {
  try {
    await apiLeaveRoom(roomId, playerToken);
  } catch {
    // Ignore network errors; client state is still cleared below.
  }
  clearActiveRoom();
}

export const ALL_COLORS: PlayerColor[] = ["red", "blue", "white", "orange"];

export function colorOptionsHtml(
  selected: PlayerColor,
  taken: Set<PlayerColor>,
): string {
  return ALL_COLORS.map((c) => {
    const isSelected = c === selected;
    const isDisabled = taken.has(c) && !isSelected;
    const sel = isSelected ? " selected" : "";
    const dis = isDisabled ? " disabled" : "";
    const label = c.charAt(0).toUpperCase() + c.slice(1);
    return `<option value="${c}"${sel}${dis}>${label}${isDisabled ? " (taken)" : ""}</option>`;
  }).join("");
}
