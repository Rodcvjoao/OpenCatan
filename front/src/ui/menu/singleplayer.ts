// Singleplayer setup screen. Lets the user name themself and define 1-3 AI
// opponents. The [Start Game] button is intentionally disabled and shows
// a "Coming soon" tooltip until real AI opponents are implemented
// backend-side.

import { PLAYER_COLORS } from "../../config";
import type { PlayerColor } from "../../types";
import { $ } from "../dom";
import { showScreen } from "./nav";

const ALL_COLORS: PlayerColor[] = ["red", "blue", "white", "orange"];
const BOT_NAMES = ["Bot Alpha", "Bot Beta", "Bot Gamma"];

interface SinglePlayerState {
  humanName: string;
  humanColor: PlayerColor;
  botCount: number;
  botNames: string[];
  botColors: PlayerColor[];
}

const state: SinglePlayerState = {
  humanName: "Player",
  humanColor: "red",
  botCount: 2,
  botNames: [...BOT_NAMES],
  botColors: ["blue", "white"],
};

function colorOptionsHtml(selected: PlayerColor, disabled: Set<PlayerColor>): string {
  return ALL_COLORS
    .map((c) => {
      const sel = c === selected ? " selected" : "";
      const dis = disabled.has(c) && c !== selected ? " disabled" : "";
      return `<option value="${c}"${sel}${dis}>${c.charAt(0).toUpperCase() + c.slice(1)}</option>`;
    })
    .join("");
}

function usedColors(excludeSlot: number): Set<PlayerColor> {
  const used = new Set<PlayerColor>();
  if (excludeSlot !== -1) used.add(state.humanColor);
  for (let i = 0; i < state.botCount; i++) {
    if (i !== excludeSlot) used.add(state.botColors[i]);
  }
  return used;
}

function ensureDistinctColors(): void {
  // Re-assign any duplicates in increasing-priority order (human first).
  const taken = new Set<PlayerColor>();
  taken.add(state.humanColor);
  for (let i = 0; i < state.botColors.length; i++) {
    if (i >= state.botCount) break;
    if (taken.has(state.botColors[i])) {
      const free = ALL_COLORS.find((c) => !taken.has(c));
      if (free) state.botColors[i] = free;
    }
    taken.add(state.botColors[i]);
  }
}

function render(): void {
  const humanName = $<HTMLInputElement>("sp-human-name");
  humanName.value = state.humanName;

  const humanColor = $<HTMLSelectElement>("sp-human-color");
  humanColor.innerHTML = colorOptionsHtml(state.humanColor, usedColors(-2));

  const counter = $("sp-bot-count");
  counter.textContent = String(state.botCount);

  const botsContainer = $("sp-bot-list");
  botsContainer.innerHTML = "";
  for (let i = 0; i < state.botCount; i++) {
    const row = document.createElement("div");
    row.className = "flex items-center space-x-2";
    const colorHex = PLAYER_COLORS[state.botColors[i]] ?? "#888";
    row.innerHTML =
      `<span class="text-white font-bold w-6">${i + 2}.</span>` +
      `<span class="w-4 h-4 rounded-sm border border-black" style="background:${colorHex}"></span>` +
      `<input type="text" data-bot-index="${i}" class="sp-bot-name flex-1 px-3 py-1.5 rounded bg-[#5d4037] text-white border border-yellow-800 focus:border-yellow-400 outline-none" value="${state.botNames[i] ?? ""}" />` +
      `<select data-bot-index="${i}" class="sp-bot-color px-2 py-1.5 rounded bg-[#5d4037] text-white border border-yellow-800">${colorOptionsHtml(state.botColors[i], usedColors(i))}</select>`;
    botsContainer.appendChild(row);
  }

  // Rebind the per-bot inputs now that they exist.
  botsContainer.querySelectorAll<HTMLInputElement>(".sp-bot-name").forEach((inp) => {
    inp.addEventListener("input", () => {
      const idx = Number(inp.dataset.botIndex);
      state.botNames[idx] = inp.value;
    });
  });
  botsContainer.querySelectorAll<HTMLSelectElement>(".sp-bot-color").forEach((sel) => {
    sel.addEventListener("change", () => {
      const idx = Number(sel.dataset.botIndex);
      state.botColors[idx] = sel.value as PlayerColor;
      ensureDistinctColors();
      render();
    });
  });
}

function setBotCount(n: number): void {
  state.botCount = Math.max(1, Math.min(3, n));
  while (state.botNames.length < state.botCount) state.botNames.push(`Bot ${state.botNames.length + 1}`);
  while (state.botColors.length < state.botCount) {
    const taken = new Set<PlayerColor>([state.humanColor, ...state.botColors]);
    const free = ALL_COLORS.find((c) => !taken.has(c)) ?? "red";
    state.botColors.push(free);
  }
  ensureDistinctColors();
  render();
}

export function bindSinglePlayer(): void {
  $("btn-sp-back").addEventListener("click", () => showScreen("main"));

  $<HTMLInputElement>("sp-human-name").addEventListener("input", (e) => {
    state.humanName = (e.target as HTMLInputElement).value;
  });
  $<HTMLSelectElement>("sp-human-color").addEventListener("change", (e) => {
    state.humanColor = (e.target as HTMLSelectElement).value as PlayerColor;
    ensureDistinctColors();
    render();
  });

  $("sp-bot-inc").addEventListener("click", () => setBotCount(state.botCount + 1));
  $("sp-bot-dec").addEventListener("click", () => setBotCount(state.botCount - 1));

  // Start is disabled — AI opponents aren't implemented yet. The button
  // still carries a clear tooltip so the intent is obvious.
  const startBtn = $<HTMLButtonElement>("btn-sp-start");
  startBtn.disabled = true;
  startBtn.title = "AI opponents coming soon";

  render();
}
