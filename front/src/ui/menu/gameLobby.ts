import { apiCommand } from "../../net/api";
import { PLAYER_COLORS } from "../../config";
import { GameState } from "../../state";
import type { PlayerColor } from "../../types";
import { $ } from "../dom";
import { showToast } from "../toast";
import { closeMenu, currentScreen, showScreen } from "./nav";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function meStatus(): { isActive: boolean } {
  const meId = GameState.myPlayerId;
  const players = GameState.publicState?.players ?? [];
  const me = meId == null ? undefined : players.find((p) => p.id === meId);
  return {
    isActive: me?.is_active ?? false,
  };
}

export function renderGameLobby(): void {
  if (currentScreen() !== "game-lobby") return;
  const container = $("game-lobby-players");
  if (!GameState.publicState) {
    container.innerHTML =
      '<div class="text-yellow-200 text-sm text-center">Waiting for game state...</div>';
    return;
  }

  const players = GameState.publicState.players;
  const meId = GameState.myPlayerId;

  container.innerHTML = players
    .map((p) => {
      const color = p.color as PlayerColor;
      const colorHex = PLAYER_COLORS[color] ?? "#888";
      const isMe = p.id === meId;
      const statusLabel = p.is_active
        ? '<span class="text-green-400 text-xs font-bold">ACTIVE</span>'
        : '<span class="text-red-400 text-xs font-bold">LEFT</span>';
      const hostLabel = p.is_host
        ? ' <span class="text-yellow-400 text-xs">(host)</span>'
        : "";
      const youLabel = isMe
        ? ' <span class="text-yellow-400 text-xs">(you)</span>'
        : "";
      return (
        '<div class="flex items-center space-x-2 px-3 py-2 rounded bg-[#5d4037] border border-yellow-800">' +
        `<span class="w-6 h-6 rounded-sm border border-black" style="background:${colorHex}"></span>` +
        `<span class="text-white font-bold flex-1">${escapeHtml(p.name)}${hostLabel}${youLabel}</span>` +
        statusLabel +
        "</div>"
      );
    })
    .join("");

  const { isActive } = meStatus();
  const backBtn = $<HTMLButtonElement>("btn-game-lobby-back");
  const leaveBtn = $<HTMLButtonElement>("btn-game-lobby-leave");
  const rejoinBtn = $<HTMLButtonElement>("btn-game-lobby-rejoin");

  backBtn.disabled = !isActive;
  leaveBtn.disabled = !isActive;
  rejoinBtn.classList.toggle("hidden", isActive);
}

export function openGameLobby(): void {
  showScreen("game-lobby");
  renderGameLobby();
}

async function leaveMatch(): Promise<void> {
  const res = await apiCommand("leave_game");
  if (!res) return;
  if (!res.accepted) return;
  showToast("You left the match", "info");
  renderGameLobby();
}

async function rejoinMatch(): Promise<void> {
  const res = await apiCommand("rejoin_game");
  if (!res) return;
  if (!res.accepted) return;
  showToast("You rejoined the match", "success");
  closeMenu();
}

export function bindGameLobby(): void {
  $("btn-game-lobby-back").addEventListener("click", () => {
    closeMenu();
  });
  $("btn-game-lobby-leave").addEventListener("click", () => {
    void leaveMatch();
  });
  $("btn-game-lobby-rejoin").addEventListener("click", () => {
    void rejoinMatch();
  });
}
