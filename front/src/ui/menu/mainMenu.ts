// Main menu: Open Catan title + three big nav buttons.

import { $ } from "../dom";
import { showScreen } from "./nav";

export function bindMainMenu(): void {
  $("btn-menu-singleplayer").addEventListener("click", () => {
    showScreen("sp-setup");
  });
  $("btn-menu-multiplayer").addEventListener("click", () => {
    showScreen("mp-menu");
  });
  $("btn-menu-settings").addEventListener("click", () => {
    showScreen("settings");
  });
}
