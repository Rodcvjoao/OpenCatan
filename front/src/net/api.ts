// HTTP client for the backend REST API. Matches back/FRONTEND_CONTRACT.md.

import { API_BASE } from "../config";
import { GameState, updateState } from "../state";
import { showToast } from "../ui/toast";
import type { RoomState } from "./lobbyApi";
import type {
  CommandName,
  CommandResponse,
  CreateGameResponse,
  PlayerColor,
  StateEnvelope,
} from "../types";

export interface CreateGamePlayerInput {
  name: string;
  color: PlayerColor;
}

export async function apiCreateGame(
  players: CreateGamePlayerInput[],
): Promise<CreateGameResponse | null> {
  const res = await fetch(`${API_BASE}/games`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ players }),
  });
  if (!res.ok) {
    showToast("Failed to create game: " + res.statusText, "error");
    return null;
  }
  return (await res.json()) as CreateGameResponse;
}

export async function apiGetState(
  gameId: string,
  playerToken: string | null,
): Promise<StateEnvelope | null> {
  const url = playerToken
    ? `${API_BASE}/games/${gameId}/state?player_token=${playerToken}`
    : `${API_BASE}/games/${gameId}/state`;
  const res = await fetch(url);
  if (!res.ok) {
    showToast("Failed to get state: " + res.statusText, "error");
    return null;
  }
  return (await res.json()) as StateEnvelope;
}

export async function apiReturnToLobby(
  gameId: string,
  playerToken: string,
): Promise<{
  room: RoomState;
  player_token: string;
} | null> {
  const res = await fetch(`${API_BASE}/games/${gameId}/return-to-lobby`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ player_token: playerToken }),
  });
  if (!res.ok) {
    showToast("Failed to return to lobby: " + res.statusText, "error");
    return null;
  }
  return (await res.json()) as { room: RoomState; player_token: string };
}

export async function apiCommand(
  command: CommandName,
  payload: Record<string, unknown> = {},
): Promise<CommandResponse | null> {
  if (!GameState.gameId || !GameState.playerToken) return null;
  GameState.requestSeq += 1;
  const body = {
    player_token: GameState.playerToken,
    command,
    payload,
    expected_version: GameState.version,
    request_id: `${Date.now()}-${GameState.requestSeq}-${command}`,
  };
  try {
    const res = await fetch(`${API_BASE}/games/${GameState.gameId}/commands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 401) {
      showToast("Invalid player token", "error");
      return null;
    }
    if (res.status === 404) {
      showToast("Game not found", "error");
      return null;
    }
    const data = (await res.json()) as CommandResponse;
    if (!data.accepted) {
      if (data.reason && data.reason.includes("Version mismatch")) {
        const freshState = await apiGetState(
          GameState.gameId,
          GameState.playerToken,
        );
        if (freshState) updateState(freshState);
        showToast("State refreshed, try again", "warning");
      } else {
        showToast(data.reason ?? "Command rejected", "error");
      }
      return data;
    }
    if (data.state) updateState(data.state);
    return data;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    showToast("Network error: " + msg, "error");
    return null;
  }
}
