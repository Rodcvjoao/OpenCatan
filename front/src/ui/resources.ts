// Bottom-center resource bar showing the private hand + my VP.

import { RESOURCE_COLORS, RESOURCE_LABELS, RESOURCE_ORDER } from "../config";
import { GameState } from "../state";
import { $ } from "./dom";

export function renderResourceBar(): void {
  const bar = $("resource-bar");
  if (!GameState.privateState) {
    bar.innerHTML = '<span class="text-white text-sm">Waiting for game state...</span>';
    return;
  }
  const res = GameState.privateState.resources;
  const vp = GameState.myPlayerId != null
    ? GameState.playerMap[GameState.myPlayerId]?.victory_points ?? 0
    : 0;

  let html = "";
  for (const key of RESOURCE_ORDER) {
    const count = res[key] ?? 0;
    const color = RESOURCE_COLORS[key];
    html +=
      '<div class="flex items-center space-x-2" title="' +
      RESOURCE_LABELS[key] +
      '">' +
      '<div class="w-6 h-6 rounded-sm border border-black shadow" style="background:' +
      color +
      '"></div>' +
      '<span class="text-white font-bold text-sm">' +
      count +
      "</span></div>";
  }
  html +=
    '<div class="flex items-center space-x-2">' +
    '<span class="text-yellow-400 text-xl leading-none">&#127942;</span>' +
    '<span class="text-white font-bold text-sm">' +
    vp +
    "</span></div>";
  bar.innerHTML = html;
}
