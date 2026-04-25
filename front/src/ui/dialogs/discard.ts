// "Discard" dialog shown when a 7 is rolled and the player holds >7 cards.

import { RESOURCE_COLORS, RESOURCE_LABELS, RESOURCE_ORDER } from "../../config";
import { apiCommand } from "../../net/api";
import { GameState } from "../../state";
import { $ } from "../dom";
import { showToast } from "../toast";

export function showDiscardDialog(requiredCount: number): void {
  const dialog = $("discard-dialog");
  $("discard-info").textContent = `You must discard ${requiredCount} resource(s).`;
  const res = GameState.privateState?.resources ?? {};
  let html = "";
  for (const key of RESOURCE_ORDER) {
    const count = res[key] ?? 0;
    if (count <= 0) continue;
    html +=
      '<div class="flex items-center justify-between">' +
      '<div class="flex items-center space-x-2">' +
      '<div class="w-5 h-5 rounded-sm border border-black" style="background:' +
      RESOURCE_COLORS[key] +
      '"></div>' +
      '<span class="text-white text-sm">' +
      RESOURCE_LABELS[key] +
      " (" +
      count +
      ")</span>" +
      "</div>" +
      '<input type="number" min="0" max="' +
      count +
      '" value="0" data-resource="' +
      key +
      '"' +
      ' class="w-16 px-2 py-1 rounded bg-[#5d4037] text-white border border-yellow-800 text-center">' +
      "</div>";
  }
  $("discard-inputs").innerHTML = html;
  dialog.dataset.required = String(requiredCount);
  dialog.classList.remove("hidden");
}

export async function submitDiscard(): Promise<void> {
  const dialog = $("discard-dialog");
  const required = parseInt(dialog.dataset.required ?? "0", 10);
  const inputs = dialog.querySelectorAll<HTMLInputElement>("input[data-resource]");
  const resources: Record<string, number> = {};
  let total = 0;
  inputs.forEach((inp) => {
    const val = parseInt(inp.value, 10) || 0;
    if (val > 0) {
      const key = inp.dataset.resource?.toLowerCase() ?? "";
      if (key) resources[key] = val;
      total += val;
    }
  });
  if (total !== required) {
    showToast(
      "Must discard exactly " + required + " (selected " + total + ")",
      "error",
    );
    return;
  }
  const result = await apiCommand("discard_resources", { resources });
  if (result && result.accepted) {
    dialog.classList.add("hidden");
    showToast("Resources discarded", "success");
  }
}

/** Wire the "Confirm Discard" button's click once on boot. */
export function bindDiscardDialog(): void {
  $("discard-submit").addEventListener("click", () => {
    void submitDiscard();
  });
}
