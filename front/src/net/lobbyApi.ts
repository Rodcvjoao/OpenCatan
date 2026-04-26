// HTTP client for the lobby / room endpoints. Mirrors the shapes defined
// in back/catan/api/schemas.py (CreateRoomRequest, JoinRoomRequest, etc.).

import { API_BASE } from "../config";
import type { PlayerColor } from "../types";

export interface LobbyPlayer {
  name: string;
  color: PlayerColor;
  ready: boolean;
  is_host: boolean;
}

export interface RoomState {
  room_id: string;
  players: LobbyPlayer[];
  game_id: string | null;
  created_at: number;
}

export interface RoomMembership {
  room: RoomState;
  player_token: string;
}

export interface StartGameResult {
  game_id: string;
  game_token: string;
}

/** Thrown when the backend returns a rule rejection (400 etc.). `message`
 *  holds the server's `detail` so the UI can surface it verbatim. */
export class LobbyApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function parseOrThrow<T>(res: Response): Promise<T> {
  if (res.ok) {
    return (await res.json()) as T;
  }
  let detail = `HTTP ${res.status}`;
  try {
    const body = (await res.json()) as { detail?: string };
    if (body.detail) detail = body.detail;
  } catch {
    // Non-JSON body; fall through.
  }
  throw new LobbyApiError(res.status, detail);
}

export async function apiCreateRoom(
  name: string,
  color: PlayerColor,
): Promise<RoomMembership> {
  const res = await fetch(`${API_BASE}/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, color }),
  });
  return parseOrThrow<RoomMembership>(res);
}

export async function apiGetRoom(roomId: string): Promise<RoomState> {
  const res = await fetch(`${API_BASE}/rooms/${encodeURIComponent(roomId)}`);
  const body = await parseOrThrow<{ room: RoomState }>(res);
  return body.room;
}

export async function apiJoinRoom(
  roomId: string,
  name: string,
  color: PlayerColor,
): Promise<RoomMembership> {
  const res = await fetch(
    `${API_BASE}/rooms/${encodeURIComponent(roomId)}/join`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    },
  );
  return parseOrThrow<RoomMembership>(res);
}

export async function apiChangeColor(
  roomId: string,
  playerToken: string,
  color: PlayerColor,
): Promise<RoomState> {
  const res = await fetch(
    `${API_BASE}/rooms/${encodeURIComponent(roomId)}/color`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player_token: playerToken, color }),
    },
  );
  const body = await parseOrThrow<{ room: RoomState }>(res);
  return body.room;
}

export async function apiSetReady(
  roomId: string,
  playerToken: string,
  ready: boolean,
): Promise<RoomState> {
  const res = await fetch(
    `${API_BASE}/rooms/${encodeURIComponent(roomId)}/ready`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player_token: playerToken, ready }),
    },
  );
  const body = await parseOrThrow<{ room: RoomState }>(res);
  return body.room;
}

export async function apiLeaveRoom(
  roomId: string,
  playerToken: string,
): Promise<void> {
  await fetch(`${API_BASE}/rooms/${encodeURIComponent(roomId)}/leave`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ player_token: playerToken }),
  });
}

export async function apiStartRoomGame(
  roomId: string,
  playerToken: string,
): Promise<StartGameResult> {
  const res = await fetch(
    `${API_BASE}/rooms/${encodeURIComponent(roomId)}/start`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ player_token: playerToken }),
    },
  );
  return parseOrThrow<StartGameResult>(res);
}
