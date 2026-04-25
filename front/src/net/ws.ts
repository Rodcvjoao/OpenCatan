// Thin WebSocket client. Auto-reconnects on close and triggers a full REST
// refetch on `game_state_updated` so private hand/legal_actions stay fresh
// (see AGENTS.md "Decision 4" and FRONTEND_CONTRACT.md recommended sync).

import { WS_BASE } from "../config";
import { GameState, updateState } from "../state";
import { showToast } from "../ui/toast";
import { apiGetState } from "./api";
import type { StateEnvelope } from "../types";

interface SnapshotMessage {
  type: "snapshot";
  payload: StateEnvelope;
}

interface GameStateUpdatedMessage {
  type: "game_state_updated";
  payload: unknown;
}

interface ErrorMessage {
  type: "error";
  payload: { message?: string };
}

interface OtherMessage {
  type: "connected" | "pong";
  payload: unknown;
}

type WsMessage =
  | SnapshotMessage
  | GameStateUpdatedMessage
  | ErrorMessage
  | OtherMessage;

let ws: WebSocket | null = null;

export function connectWebSocket(gameId: string): void {
  if (ws) {
    ws.onclose = null;
    ws.close();
  }
  ws = new WebSocket(`${WS_BASE}/ws/games/${gameId}`);
  ws.onopen = () => {
    if (GameState.playerToken && ws) {
      ws.send(
        JSON.stringify({
          type: "snapshot",
          payload: { player_token: GameState.playerToken },
        }),
      );
    }
  };
  ws.onmessage = (event) => {
    let msg: WsMessage;
    try {
      msg = JSON.parse(event.data) as WsMessage;
    } catch {
      return;
    }
    if (msg.type === "snapshot") {
      updateState(msg.payload);
    } else if (msg.type === "game_state_updated") {
      if (GameState.gameId) {
        void apiGetState(GameState.gameId, GameState.playerToken).then(
          (state) => {
            if (state) updateState(state);
          },
        );
      }
    } else if (msg.type === "error") {
      showToast(msg.payload.message ?? "WebSocket error", "error");
    }
  };
  ws.onclose = () => {
    setTimeout(() => connectWebSocket(gameId), 3000);
  };
}
