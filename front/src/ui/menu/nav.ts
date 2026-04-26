// Screen navigation state machine. Every menu panel lives inside #menu-root
// and is toggled by adding/removing `hidden`. Exactly one panel is visible
// at a time; `showScreen("none")` hides the whole menu so the game HUD
// becomes usable.

import { $ } from "../dom";

export type Screen =
  | "main"
  | "sp-setup"
  | "mp-menu"
  | "mp-create"
  | "mp-lobby-host"
  | "mp-join"
  | "mp-lobby-guest"
  | "settings"
  | "none";

const PANEL_IDS: Record<Exclude<Screen, "none">, string> = {
  main:            "screen-main",
  "sp-setup":      "screen-sp-setup",
  "mp-menu":       "screen-mp-menu",
  "mp-create":     "screen-mp-create",
  "mp-lobby-host": "screen-mp-lobby-host",
  "mp-join":       "screen-mp-join",
  "mp-lobby-guest":"screen-mp-lobby-guest",
  settings:        "screen-settings",
};

let current: Screen = "main";

export function currentScreen(): Screen {
  return current;
}

export function showScreen(next: Screen): void {
  current = next;
  const root = $("menu-root");
  if (next === "none") {
    root.classList.add("hidden");
    return;
  }
  root.classList.remove("hidden");
  for (const [name, id] of Object.entries(PANEL_IDS)) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (name === next) el.classList.remove("hidden");
    else el.classList.add("hidden");
  }
}

/** Called by the game-start flows (singleplayer / multiplayer) once the
 *  game is actually created. Hides the entire menu tree. */
export function closeMenu(): void {
  showScreen("none");
}

/** Opens the main menu, e.g. after a user leaves a lobby. */
export function openMainMenu(): void {
  showScreen("main");
}
