// Multiplayer sub-menu: Create Room / Join Room.

import { $ } from "../dom";
import { showScreen } from "./nav";

export function bindMultiplayer(): void {
  $("btn-mp-create").addEventListener("click", () => showScreen("mp-create"));
  $("btn-mp-join").addEventListener("click", () => showScreen("mp-join"));
  $("btn-mp-back").addEventListener("click", () => showScreen("main"));
}
