// Left-side icon rail. Mostly non-implemented stubs that show toasts; keeping
// them wired here so the HTML can stay free of inline onclick.

import { doProposeTradeOffer } from "./commands";
import { $ } from "./dom";
import { toggleFps } from "./fpsCounter";
import { showToast } from "./toast";

export function bindSidebar(): void {
  $("sb-chat").addEventListener("click", () =>
    showToast("Chat not implemented yet"),
  );
  $("sb-emotes").addEventListener("click", () =>
    showToast("Emotes not implemented yet"),
  );
  $("sb-trade").addEventListener("click", () => {
    void doProposeTradeOffer();
  });
  $("sb-stats").addEventListener("click", () =>
    showToast("Stats not implemented yet"),
  );
  $("sb-info").addEventListener("click", () =>
    showToast("Info not implemented yet"),
  );
  $("sb-rules").addEventListener("click", () =>
    showToast("Rules not implemented yet"),
  );
  $("sb-settings").addEventListener("click", () =>
    showToast("Settings not implemented yet"),
  );
  $("sb-fps").addEventListener("click", toggleFps);
}
