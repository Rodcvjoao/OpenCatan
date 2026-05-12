// Top-of-screen player cards (one per player).

import { PLAYER_COLORS, PLAYER_COLORS_DARK, PLAYER_COLORS_MID } from "../config";
import { GameState } from "../state";
import type { PlayerColor } from "../types";
import { $ } from "./dom";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderPlayerCards(): void {
  const bar = $("players-bar");
  if (!GameState.publicState) {
    bar.innerHTML = "";
    return;
  }
  const players = GameState.publicState.players;
  const currentId = GameState.publicState.turn?.current_player_id;

  bar.innerHTML = players
    .map((p) => {
      const color = p.color as PlayerColor;
      const bg = PLAYER_COLORS[color] ?? color;
      const bgDark = PLAYER_COLORS_DARK[color] ?? "#333";
      const bgMid = PLAYER_COLORS_MID[color] ?? "#555";
      const isCurrent = p.id === currentId && p.is_active;
      const isMe = p.id === GameState.myPlayerId;
      const isActive = p.is_active;
      const glowClass = isCurrent ? "glow-current" : "";
      const widthClass = isMe ? "w-64" : "w-56";
      const name = escapeHtml(p.name);
      const status = isActive
        ? ""
        : ' <span class="text-red-300 text-[10px]">(left)</span>';

      return (
        '<div class="relative bg-[#3e2723] p-1 rounded-lg border-2 ' +
        glowClass +
        " " +
        widthClass +
        '  shadow-lg shadow-black/50" style="border-color:' +
        bgDark +
        '">' +
        '<div class="absolute -top-3 -left-3 text-white font-game rounded-full w-8 h-8 flex items-center justify-center border-2 border-black z-10 text-lg" style="background:' +
        bgDark +
        '">' +
        p.victory_points +
        "</div>" +
        '<div class="flex h-full rounded" style="background:' +
        bg +
        '">' +
        '<div class="flex-1 flex flex-col justify-between p-1">' +
        '<div class="flex justify-between items-center px-1">' +
        '<span class="text-white font-bold text-sm">' +
        name +
        (isMe ? " (you)" : "") +
        status +
        "</span>" +
        (isCurrent
          ? '<span class="text-yellow-300 text-xs font-bold">&#9733;</span>'
          : "") +
        "</div>" +
        '<div class="flex items-center p-1 rounded text-white text-xs font-bold space-x-3" style="background:' +
        bgDark +
        '">' +
        '<div class="flex items-center"><span class="mr-1">&#127942;</span>' +
        p.victory_points +
        "</div>" +
        '<div class="flex items-center"><span class="mr-1">&#9876;&#65039;</span>' +
        p.played_knights +
        "</div>" +
        (p.has_longest_road
          ? '<div class="text-yellow-300 text-[10px]">Road</div>'
          : "") +
        (p.has_largest_army
          ? '<div class="text-yellow-300 text-[10px]">Army</div>'
          : "") +
        "</div></div>" +
        '<div class="w-14 rounded-r flex items-center justify-center overflow-hidden border-l-2" style="background:' +
        bgMid +
        ";border-color:" +
        bgDark +
        '">' +
        '<div class="text-white text-center text-[10px] font-bold leading-tight">' +
        "<div>&#127183; " +
        p.resource_count +
        "</div>" +
        "<div>&#128220; " +
        p.dev_card_count +
        "</div>" +
        "</div></div></div></div>"
      );
    })
    .join("");
}
