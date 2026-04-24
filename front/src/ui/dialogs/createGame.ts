// Create / join game modal. On start it persists the current player's token
// into the URL so reload keeps them signed in.

import { apiCreateGame, apiGetState } from "../../net/api";
import { connectWebSocket } from "../../net/ws";
import { GameState, updateState } from "../../state";
import type { PlayerColor } from "../../types";
import { $ } from "../dom";
import { showToast } from "../toast";

const ALL_COLORS: PlayerColor[] = ["red", "blue", "white", "orange"];

export function addPlayerInput(): void {
  const container = $("player-inputs");
  const count = container.children.length;
  if (count >= 4) {
    showToast("Maximum 4 players", "warning");
    return;
  }
  const div = document.createElement("div");
  div.className = "flex items-center space-x-2";
  let opts = "";
  for (const c of ALL_COLORS) {
    opts +=
      '<option value="' +
      c +
      '"' +
      (c === ALL_COLORS[count] ? " selected" : "") +
      ">" +
      c.charAt(0).toUpperCase() +
      c.slice(1) +
      "</option>";
  }
  div.innerHTML =
    '<span class="text-white font-bold w-6">' +
    (count + 1) +
    ".</span>" +
    '<input type="text" class="flex-1 px-3 py-1.5 rounded bg-[#5d4037] text-white border border-yellow-800 focus:border-yellow-400 outline-none" placeholder="Player name">' +
    '<select class="px-2 py-1.5 rounded bg-[#5d4037] text-white border border-yellow-800">' +
    opts +
    "</select>";
  container.appendChild(div);
}

export async function startGame(): Promise<void> {
  const rows = document.querySelectorAll<HTMLDivElement>("#player-inputs > div");
  const players: { name: string; color: PlayerColor }[] = [];
  for (const row of Array.from(rows)) {
    const nameInput = row.querySelector<HTMLInputElement>("input");
    const colorSelect = row.querySelector<HTMLSelectElement>("select");
    const name = nameInput?.value.trim() ?? "";
    const color = (colorSelect?.value ?? "red") as PlayerColor;
    if (!name) {
      showToast("All players need names", "warning");
      return;
    }
    players.push({ name, color });
  }
  if (players.length < 2) {
    showToast("Need at least 2 players", "warning");
    return;
  }

  const data = await apiCreateGame(players);
  if (!data) return;

  GameState.gameId = data.game_id;
  const myPlayer = data.players[0];
  GameState.playerToken = myPlayer.token;
  GameState.myPlayerId = myPlayer.player_id;

  const url = new URL(window.location.href);
  url.searchParams.set("game_id", data.game_id);
  url.searchParams.set("player_token", myPlayer.token);
  history.replaceState(null, "", url);

  $("create-game-dialog").classList.add("hidden");

  // Initial state from create doesn't include private_state; fetch for full.
  const fullState = await apiGetState(data.game_id, myPlayer.token);
  if (fullState) updateState(fullState);
  else updateState(data.state);

  connectWebSocket(data.game_id);

  console.log("=== Game Created ===");
  console.log("Game ID:", data.game_id);
  for (const p of data.players) {
    const joinUrl = new URL(
      window.location.origin + window.location.pathname,
    );
    joinUrl.searchParams.set("game_id", data.game_id);
    joinUrl.searchParams.set("player_token", p.token);
    console.log(p.name + " (" + p.color + "): " + joinUrl.toString());
  }
}

export async function joinGame(): Promise<void> {
  const gameIdInput = $<HTMLInputElement>("join-game-id");
  const tokenInput = $<HTMLInputElement>("join-token");
  const gameId = gameIdInput.value.trim();
  const token = tokenInput.value.trim();
  if (!gameId || !token) {
    showToast("Enter game ID and token", "warning");
    return;
  }
  GameState.gameId = gameId;
  GameState.playerToken = token;

  const state = await apiGetState(gameId, token);
  if (!state) return;

  const url = new URL(window.location.href);
  url.searchParams.set("game_id", gameId);
  url.searchParams.set("player_token", token);
  history.replaceState(null, "", url);

  $("create-game-dialog").classList.add("hidden");
  updateState(state);
  connectWebSocket(gameId);
}

/** Bind the modal's static buttons once on boot. */
export function bindCreateGameDialog(): void {
  $("add-player-btn").addEventListener("click", addPlayerInput);
  $("start-game-btn").addEventListener("click", () => {
    void startGame();
  });
  $("join-game-btn").addEventListener("click", () => {
    void joinGame();
  });
}
