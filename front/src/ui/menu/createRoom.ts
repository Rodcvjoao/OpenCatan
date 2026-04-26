// Multiplayer Create Room flow: backend-backed lobby.
//
//   1. mp-create        — enter name + color, click "Create Room".
//   2. mp-lobby-host    — live-synced room via WS: host slot + filled
//                         guest slots + "waiting" placeholders. Host can
//                         change their own color and press Start when all
//                         players are ready.

import { API_BASE, PLAYER_COLORS } from "../../config";
import type { RoomState } from "../../net/lobbyApi";
import {
  LobbyApiError,
  apiChangeColor,
  apiCreateRoom,
  apiStartRoomGame,
} from "../../net/lobbyApi";
import type { RoomWsConnection } from "../../net/lobbyWs";
import type { PlayerColor } from "../../types";
import { $ } from "../dom";
import { showToast } from "../toast";
import {
  ALL_COLORS,
  colorOptionsHtml,
  enterGame,
  leaveRoomAndClear,
  startRoomWs,
} from "./lobbyCommon";
import { showScreen } from "./nav";
import { saveActiveRoom } from "./storage";

interface HostState {
  name: string;
  color: PlayerColor;
  roomId: string;
  playerToken: string;
  room: RoomState | null;
  ws: RoomWsConnection | null;
}

const state: HostState = {
  name: "Host",
  color: "red",
  roomId: "",
  playerToken: "",
  room: null,
  ws: null,
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderLobby(): void {
  const room = state.room;
  $("mp-lobby-host-code").textContent = state.roomId;

  const slots = $("mp-lobby-host-slots");
  slots.innerHTML = "";
  if (!room) return;

  for (const p of room.players) {
    const row = document.createElement("div");
    row.className =
      "flex items-center space-x-2 px-3 py-2 rounded bg-[#5d4037] border border-yellow-800";
    const colorHex = PLAYER_COLORS[p.color as PlayerColor] ?? "#888";
    const isMe = p.color === state.color && p.name === state.name && p.is_host;
    const youMarker = isMe ? ' <span class="text-yellow-400 text-xs">(you)</span>' : "";
    const hostMarker = p.is_host ? ' <span class="text-yellow-400 text-xs">(host)</span>' : "";
    const readyLabel = p.ready
      ? '<span class="text-green-400 text-xs font-bold">READY</span>'
      : '<span class="text-yellow-500 text-xs">not ready</span>';
    row.innerHTML =
      `<span class="w-6 h-6 rounded-sm border border-black" style="background:${colorHex}"></span>` +
      `<span class="text-white font-bold flex-1">${escapeHtml(p.name)}${hostMarker}${youMarker}</span>` +
      readyLabel;
    slots.appendChild(row);
  }

  // Waiting slots to fill the visual up to 4 total.
  for (let i = room.players.length; i < 4; i++) {
    const row = document.createElement("div");
    row.className =
      "flex items-center space-x-2 px-3 py-2 rounded bg-[#2e1a13] border border-dashed border-yellow-900/60";
    row.innerHTML =
      '<span class="w-6 h-6 rounded-sm border border-black/40 bg-gray-700/40"></span>' +
      '<span class="text-yellow-700 italic flex-1">Waiting for player...</span>';
    slots.appendChild(row);
  }

  // Color dropdown above the slot list lets the host change their color.
  renderHostColorControl(room);

  const startBtn = $<HTMLButtonElement>("btn-lobby-host-start");
  const allReady = room.players.length >= 2 && room.players.every((p) => p.ready);
  startBtn.disabled = !allReady;
  startBtn.title = allReady
    ? ""
    : "Waiting for at least one more player (and everyone ready)";
}

function renderHostColorControl(room: RoomState): void {
  const container = $("mp-lobby-host-controls");
  container.innerHTML = "";

  const taken = new Set<PlayerColor>();
  for (const p of room.players) {
    if (p.color !== state.color) taken.add(p.color as PlayerColor);
  }

  const label = document.createElement("label");
  label.className = "flex items-center space-x-2";
  label.innerHTML =
    '<span class="text-yellow-400 text-xs font-bold">Your color</span>' +
    `<select id="mp-lobby-host-color" class="px-2 py-1.5 rounded bg-[#5d4037] text-white border border-yellow-800">${colorOptionsHtml(
      state.color,
      taken,
    )}</select>`;
  container.appendChild(label);

  $<HTMLSelectElement>("mp-lobby-host-color").addEventListener(
    "change",
    (e) => {
      const picked = (e.target as HTMLSelectElement).value as PlayerColor;
      void changeMyColor(picked);
    },
  );
}

async function changeMyColor(color: PlayerColor): Promise<void> {
  if (color === state.color) return;
  try {
    const room = await apiChangeColor(state.roomId, state.playerToken, color);
    state.color = color;
    state.room = room;
    // Keep the persisted identity in sync so a reload can still match
    // our slot by color after the change.
    saveActiveRoom({
      room_id: state.roomId,
      player_token: state.playerToken,
      is_host: true,
      name: state.name,
      color: state.color,
    });
    renderLobby();
  } catch (err) {
    if (err instanceof LobbyApiError) {
      showToast(err.message, "error");
    } else {
      showToast("Could not change color", "error");
    }
    renderLobby();
  }
}

async function createRoomClick(): Promise<void> {
  const name = $<HTMLInputElement>("mp-create-name").value.trim();
  const color = $<HTMLSelectElement>("mp-create-color").value as PlayerColor;
  if (!name) {
    showToast("Enter your name", "warning");
    return;
  }
  if (!ALL_COLORS.includes(color)) {
    showToast("Pick a valid color", "warning");
    return;
  }
  try {
    const { room, player_token } = await apiCreateRoom(name, color);
    state.name = name;
    state.color = color;
    state.roomId = room.room_id;
    state.playerToken = player_token;
    state.room = room;
    saveActiveRoom({
      room_id: room.room_id,
      player_token,
      is_host: true,
      name,
      color,
    });
    attachWs();
    renderLobby();
    showScreen("mp-lobby-host");
  } catch (err) {
    showToast(
      err instanceof LobbyApiError ? err.message : "Could not create room",
      "error",
    );
  }
}

function attachWs(): void {
  state.ws?.close();
  state.ws = startRoomWs({
    roomId: state.roomId,
    playerToken: state.playerToken,
    onRoomUpdate: (room) => {
      state.room = room;
      renderLobby();
    },
    onGameStartFailed: (err) => {
      showToast(
        err instanceof Error ? err.message : "Could not start game",
        "error",
      );
    },
  });
}

function copyRoomCode(): void {
  if (!state.roomId) return;
  void navigator.clipboard
    .writeText(state.roomId)
    .then(() => showToast("Room code copied!", "success"))
    .catch(() => showToast("Couldn't copy to clipboard", "error"));
}

async function startGameClick(): Promise<void> {
  try {
    const { game_id, game_token } = await apiStartRoomGame(
      state.roomId,
      state.playerToken,
    );
    state.ws?.close();
    state.ws = null;
    await enterGame(game_id, game_token);
  } catch (err) {
    showToast(
      err instanceof LobbyApiError ? err.message : "Could not start game",
      "error",
    );
  }
}

async function leaveLobby(): Promise<void> {
  state.ws?.close();
  state.ws = null;
  await leaveRoomAndClear(state.roomId, state.playerToken);
  state.roomId = "";
  state.playerToken = "";
  state.room = null;
  showScreen("mp-menu");
}

export function bindCreateRoom(): void {
  $("btn-mp-create-back").addEventListener("click", () => showScreen("mp-menu"));
  $("btn-mp-create-go").addEventListener("click", () => {
    void createRoomClick();
  });
  $("btn-lobby-host-copy").addEventListener("click", copyRoomCode);
  $("btn-lobby-host-leave").addEventListener("click", () => {
    void leaveLobby();
  });
  $("btn-lobby-host-start").addEventListener("click", () => {
    void startGameClick();
  });
  window.addEventListener("beforeunload", () => {
    // Best-effort leave; browser may or may not actually send it.
    if (state.roomId && state.playerToken) {
      navigator.sendBeacon?.(
        `${API_BASE}/rooms/${encodeURIComponent(state.roomId)}/leave`,
        new Blob(
          [JSON.stringify({ player_token: state.playerToken })],
          { type: "application/json" },
        ),
      );
    }
  });
}

/** Exposed so the boot-time rejoin path can skip the Create Room setup
 *  and drop straight into the host lobby using a restored room/token. */
export function resumeAsHost(payload: {
  roomId: string;
  playerToken: string;
  room: RoomState;
  me: { name: string; color: PlayerColor };
}): void {
  state.roomId = payload.roomId;
  state.playerToken = payload.playerToken;
  state.room = payload.room;
  state.name = payload.me.name;
  state.color = payload.me.color;
  attachWs();
  renderLobby();
  showScreen("mp-lobby-host");
}
