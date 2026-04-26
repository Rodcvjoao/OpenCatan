// WebSocket client for a single room. Auto-reconnects with backoff and
// dispatches typed events to whichever lobby screen is active.

import { WS_BASE } from "../config";
import type { RoomState } from "./lobbyApi";

export type RoomWsEvent =
  | { type: "room_snapshot"; payload: RoomState }
  | { type: "room_updated"; payload: RoomState }
  | {
      type: "game_started";
      // Backend now sends each client only its own game_token, not the
      // full lobby->game_token map — see FRONTEND_CONTRACT.md "Lobby".
      payload: { game_id: string; game_token: string };
    }
  | { type: "error"; payload: { message?: string } }
  | { type: "pong"; payload: unknown };

export type RoomWsHandler = (event: RoomWsEvent) => void;

export interface RoomWsConnection {
  close(): void;
}

const RECONNECT_DELAY_MS = 3000;

export function connectRoomWs(
  roomId: string,
  playerToken: string,
  handler: RoomWsHandler,
): RoomWsConnection {
  let closedByUser = false;
  let ws: WebSocket | null = null;

  function open(): void {
    // Authenticate the room WS with the lobby player_token. The backend
    // closes with code 4401 if the token is missing/invalid, and 4404 if
    // the room doesn't exist.
    const url =
      `${WS_BASE}/ws/rooms/${encodeURIComponent(roomId)}` +
      `?player_token=${encodeURIComponent(playerToken)}`;
    ws = new WebSocket(url);
    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as RoomWsEvent;
        handler(parsed);
      } catch {
        /* ignore malformed */
      }
    };
    ws.onclose = () => {
      ws = null;
      if (!closedByUser) {
        setTimeout(open, RECONNECT_DELAY_MS);
      }
    };
    ws.onerror = () => {
      // Let onclose retry.
    };
  }

  open();

  return {
    close(): void {
      closedByUser = true;
      if (ws) {
        ws.onclose = null;
        ws.close();
        ws = null;
      }
    },
  };
}
