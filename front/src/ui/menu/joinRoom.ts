// Multiplayer Join Room flow: backend-backed.
//
//   1. mp-join        — enter room code + name + color, click "Join Room".
//                       Typing a valid code triggers a peek of the room's
//                       player list; taken colors are disabled in the
//                       dropdown before the user can submit.
//   2. mp-lobby-guest — live-synced room via WS. Ready toggle calls the
//                       backend. Host's Start Game transitions everyone
//                       into the actual game via WS `game_started`.

import { API_BASE, PLAYER_COLORS } from "../../config";
import type { RoomState } from "../../net/lobbyApi";
import {
  LobbyApiError,
  apiChangeColor,
  apiGetRoom,
  apiJoinRoom,
  apiSetReady,
} from "../../net/lobbyApi";
import type { RoomWsConnection } from "../../net/lobbyWs";
import type { PlayerColor } from "../../types";
import { $ } from "../dom";
import { showToast } from "../toast";
import { resumeAsHost } from "./createRoom";
import {
  ALL_COLORS,
  colorOptionsHtml,
  leaveRoomAndClear,
  startRoomWs,
} from "./lobbyCommon";
import { showScreen } from "./nav";
import { saveActiveRoom } from "./storage";

interface GuestState {
  name: string;
  color: PlayerColor;
  roomId: string;
  playerToken: string;
  room: RoomState | null;
  ws: RoomWsConnection | null;
  // Debounce timer handle for the "peek room to filter colors" call.
  peekTimer: number | null;
  peekedCode: string;
  // True once we've handed off to the host flow — guards against a late
  // room_updated from the closing guest WS re-entering promoteToHost and
  // clobbering persisted state with empty values.
  handedOff: boolean;
}

const state: GuestState = {
  name: "Player",
  color: "blue",
  roomId: "",
  playerToken: "",
  room: null,
  ws: null,
  peekTimer: null,
  peekedCode: "",
  handedOff: false,
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
  $("mp-lobby-guest-code").textContent = state.roomId;

  const slots = $("mp-lobby-guest-slots");
  slots.innerHTML = "";
  if (!room) return;

  for (const p of room.players) {
    const row = document.createElement("div");
    row.className =
      "flex items-center space-x-2 px-3 py-2 rounded bg-[#5d4037] border border-yellow-800";
    const colorHex = PLAYER_COLORS[p.color as PlayerColor] ?? "#888";
    const isMe = p.color === state.color && p.name === state.name && !p.is_host;
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

  for (let i = room.players.length; i < 4; i++) {
    const row = document.createElement("div");
    row.className =
      "flex items-center space-x-2 px-3 py-2 rounded bg-[#2e1a13] border border-dashed border-yellow-900/60";
    row.innerHTML =
      '<span class="w-6 h-6 rounded-sm border border-black/40 bg-gray-700/40"></span>' +
      '<span class="text-yellow-700 italic flex-1">Waiting for player...</span>';
    slots.appendChild(row);
  }

  renderGuestColorControl(room);

  const me = room.players.find((p) => p.color === state.color && !p.is_host);
  const readyBtn = $<HTMLButtonElement>("btn-lobby-guest-ready");
  const isReady = me?.ready === true;
  readyBtn.textContent = isReady ? "Unready" : "Ready";
  readyBtn.classList.toggle("active", isReady);
}

function renderGuestColorControl(room: RoomState): void {
  const container = $("mp-lobby-guest-controls");
  container.innerHTML = "";

  const taken = new Set<PlayerColor>();
  for (const p of room.players) {
    if (p.color !== state.color) taken.add(p.color as PlayerColor);
  }

  const label = document.createElement("label");
  label.className = "flex items-center space-x-2";
  label.innerHTML =
    '<span class="text-yellow-400 text-xs font-bold">Your color</span>' +
    `<select id="mp-lobby-guest-color" class="px-2 py-1.5 rounded bg-[#5d4037] text-white border border-yellow-800">${colorOptionsHtml(
      state.color,
      taken,
    )}</select>`;
  container.appendChild(label);

  $<HTMLSelectElement>("mp-lobby-guest-color").addEventListener(
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
      is_host: false,
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

// ---- Setup screen ----

function refreshJoinColorDropdown(takenColors: Set<PlayerColor>): void {
  const select = $<HTMLSelectElement>("mp-join-color");
  const selected = (select.value || "blue") as PlayerColor;
  // If the current pick is taken, move to the first available.
  let pick: PlayerColor = selected;
  if (takenColors.has(pick)) {
    const free = ALL_COLORS.find((c) => !takenColors.has(c));
    if (free) pick = free;
  }
  select.innerHTML = colorOptionsHtml(pick, takenColors);
  select.value = pick;
}

async function peekRoom(code: string): Promise<void> {
  if (!code || code.length < 4) return;
  try {
    const room = await apiGetRoom(code);
    // User may have changed the code while we were fetching; ignore stale.
    const current = $<HTMLInputElement>("mp-join-code").value.trim().toUpperCase();
    if (current !== code) return;
    const taken = new Set<PlayerColor>(
      room.players.map((p) => p.color as PlayerColor),
    );
    state.peekedCode = code;
    refreshJoinColorDropdown(taken);
  } catch (err) {
    if (err instanceof LobbyApiError && err.status === 404) {
      // Unknown code — clear the filter back to all colors.
      state.peekedCode = "";
      refreshJoinColorDropdown(new Set());
    }
  }
}

function handleCodeInput(): void {
  const code = $<HTMLInputElement>("mp-join-code").value.trim().toUpperCase();
  if (state.peekTimer !== null) {
    window.clearTimeout(state.peekTimer);
    state.peekTimer = null;
  }
  if (code === state.peekedCode) return;
  state.peekTimer = window.setTimeout(() => {
    void peekRoom(code);
  }, 250);
}

async function joinRoomClick(): Promise<void> {
  const code = $<HTMLInputElement>("mp-join-code").value.trim().toUpperCase();
  const name = $<HTMLInputElement>("mp-join-name").value.trim();
  const color = $<HTMLSelectElement>("mp-join-color").value as PlayerColor;
  if (!code) {
    showToast("Enter the room code", "warning");
    return;
  }
  if (!name) {
    showToast("Enter your name", "warning");
    return;
  }
  try {
    const { room, player_token } = await apiJoinRoom(code, name, color);
    state.roomId = room.room_id;
    state.name = name;
    state.color = color;
    state.playerToken = player_token;
    state.room = room;
    state.handedOff = false;
    saveActiveRoom({
      room_id: room.room_id,
      player_token,
      is_host: false,
      name,
      color,
    });
    attachWs();
    renderLobby();
    showScreen("mp-lobby-guest");
  } catch (err) {
    if (err instanceof LobbyApiError) {
      showToast(err.message, "error");
      // Refresh the peek so the dropdown reflects current state.
      void peekRoom(code);
    } else {
      showToast("Could not join room", "error");
    }
  }
}

function attachWs(): void {
  state.ws?.close();
  state.ws = startRoomWs({
    roomId: state.roomId,
    playerToken: state.playerToken,
    onRoomUpdate: (room) => {
      // Drop stale frames that arrived after we already handed off to the
      // host flow (the guest WS may dispatch one more onmessage between
      // close() and teardown).
      if (state.handedOff) return;
      state.room = room;
      // Backend auto-promotes the oldest guest when the host leaves.
      // Detect that here and hand off to the host lobby flow so the
      // promoted player actually gets the Start Game controls. Colors are
      // unique per room (backend enforced), so color alone identifies us;
      // fall back to name+color if a pending color-change race has us
      // temporarily out of sync with the authoritative room state.
      const me =
        room.players.find((p) => p.color === state.color) ??
        room.players.find((p) => p.name === state.name);
      if (me?.is_host) {
        promoteToHost(room, {
          name: me.name,
          color: me.color as PlayerColor,
        });
        return;
      }
      renderLobby();
    },
    onGameStartFailed: (err) => {
      showToast(
        err instanceof Error ? err.message : "Could not enter the game",
        "error",
      );
    },
  });
}

/** Switch this client from guest lobby to host lobby after the backend
 *  handed the host role over to us. Reuses the Create Room flow's host
 *  resume path so the two lobbies stay in sync. */
function promoteToHost(
  room: RoomState,
  identity: { name: string; color: PlayerColor },
): void {
  // Guard against double-promotion from a late WS event.
  if (state.handedOff) return;
  state.handedOff = true;

  // Snapshot what resumeAsHost needs before we tear down guest state.
  const payload = {
    roomId: state.roomId,
    playerToken: state.playerToken,
    room,
    me: identity,
  };

  // Close the guest WS; resumeAsHost opens its own for the host flow.
  state.ws?.close();
  state.ws = null;

  // Cancel any pending peek so a deferred fetch doesn't touch UI after
  // we've left the join screen.
  if (state.peekTimer !== null) {
    window.clearTimeout(state.peekTimer);
    state.peekTimer = null;
  }
  state.peekedCode = "";

  // Persist the new role so a reload restores us as host, not guest.
  saveActiveRoom({
    room_id: payload.roomId,
    player_token: payload.playerToken,
    is_host: true,
    name: identity.name,
    color: identity.color,
  });

  // Clear guest-local state so a later re-entry starts from scratch.
  // Name/color are intentionally cleared too: if another stale frame
  // somehow slipped past the handedOff guard it would then fail the
  // identity match and be ignored rather than re-promoting.
  state.roomId = "";
  state.playerToken = "";
  state.room = null;
  state.name = "";
  state.color = "blue";

  showToast("You are now the host", "info");
  resumeAsHost(payload);
}

async function toggleReady(): Promise<void> {
  if (!state.roomId || !state.playerToken) return;
  const me = state.room?.players.find((p) => !p.is_host && p.color === state.color);
  const next = !(me?.ready ?? false);
  try {
    const room = await apiSetReady(state.roomId, state.playerToken, next);
    state.room = room;
    renderLobby();
  } catch (err) {
    showToast(
      err instanceof LobbyApiError ? err.message : "Could not toggle ready",
      "error",
    );
  }
}

async function leaveLobby(): Promise<void> {
  state.ws?.close();
  state.ws = null;
  if (state.peekTimer !== null) {
    window.clearTimeout(state.peekTimer);
    state.peekTimer = null;
  }
  state.peekedCode = "";
  await leaveRoomAndClear(state.roomId, state.playerToken);
  state.roomId = "";
  state.playerToken = "";
  state.room = null;
  state.handedOff = false;
  showScreen("mp-menu");
}

export function bindJoinRoom(): void {
  $("btn-mp-join-back").addEventListener("click", () => showScreen("mp-menu"));
  $("btn-mp-join-go").addEventListener("click", () => {
    void joinRoomClick();
  });
  $<HTMLInputElement>("mp-join-code").addEventListener("input", handleCodeInput);
  $("btn-lobby-guest-ready").addEventListener("click", () => {
    void toggleReady();
  });
  $("btn-lobby-guest-leave").addEventListener("click", () => {
    void leaveLobby();
  });
  window.addEventListener("beforeunload", () => {
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

export function resumeAsGuest(payload: {
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
  state.handedOff = false;
  attachWs();
  renderLobby();
  showScreen("mp-lobby-guest");
}
