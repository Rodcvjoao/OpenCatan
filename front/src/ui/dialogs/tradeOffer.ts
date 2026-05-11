import { RESOURCE_COLORS, RESOURCE_LABELS, RESOURCE_ORDER } from "../../config";
import { apiCommand } from "../../net/api";
import { GameState, hasLegalAction, playersList } from "../../state";
import type { PortType, TradeOffer } from "../../types";
import { $, $opt } from "../dom";
import { showToast } from "../toast";

type DraftState = {
  toPlayerId: string;
  giveResource: string;
  giveAmount: number;
  receiveResource: string;
  receiveAmount: number;
};

type BankDraftState = {
  giveResource: string;
  receiveResource: string;
  receiveAmount: number;
};

type TradeDialogMode = "player" | "bank";

type TradeOutcome = "accepted" | "refused";

type OutgoingTradeTracker = {
  offerId: string;
  targetName: string;
  give: Record<string, number>;
  receive: Record<string, number>;
  resourcesBeforeOffer: Record<string, number>;
  status: "waiting" | "resolved";
  outcome?: TradeOutcome;
};

const draft: DraftState = {
  toPlayerId: "",
  giveResource: "BRICK",
  giveAmount: 1,
  receiveResource: "WOOL",
  receiveAmount: 1,
};

const bankDraft: BankDraftState = {
  giveResource: "BRICK",
  receiveResource: "ORE",
  receiveAmount: 1,
};

let outgoingTradeTracker: OutgoingTradeTracker | null = null;
let currentTradeMode: TradeDialogMode = "player";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function currentOffer(): TradeOffer | null {
  return GameState.publicState?.pending?.pending_trade_offer ?? null;
}

function normalizeResourceKey(resource: string): string {
  return resource.toUpperCase();
}

function lowerResourceKey(resource: string): string {
  return normalizeResourceKey(resource).toLowerCase();
}

function resourceCount(resource: string): number {
  const key = normalizeResourceKey(resource);
  return GameState.privateState?.resources?.[key] ?? 0;
}

function resourceChip(resource: string, amount: number): string {
  const key = normalizeResourceKey(resource);
  const label = RESOURCE_LABELS[key] ?? key;
  const color = RESOURCE_COLORS[key] ?? "#d4a373";
  return `<span class="trade-resource-chip" style="background:${color}">${amount} ${label}</span>`;
}

function cloneResources(): Record<string, number> {
  return { ...(GameState.privateState?.resources ?? {}) };
}

function summarizeTradeBundle(bundle: Record<string, number>): string {
  const entries = Object.entries(bundle ?? {}).filter(([, amount]) => amount > 0);
  if (entries.length === 0) return '<span class="text-[#fbe4b4]/80">Nothing selected</span>';
  return entries
    .map(([resource, amount]) => resourceChip(resource, amount))
    .join("");
}

function renderBundleChips(bundle: Record<string, number>): string {
  return summarizeTradeBundle(bundle);
}

function clampDraft(): void {
  if (draft.giveAmount < 1) draft.giveAmount = 1;
  if (draft.receiveAmount < 1) draft.receiveAmount = 1;
  const maxGive = Math.max(1, resourceCount(draft.giveResource));
  if (draft.giveAmount > maxGive) draft.giveAmount = maxGive;
}

function availableTargets(): ReturnType<typeof playersList> {
  return playersList().filter((player) => player.id !== GameState.myPlayerId);
}

function pendingOfferRole(offer: TradeOffer | null): "incoming" | "outgoing" | "other" | null {
  if (!offer || GameState.myPlayerId == null) return null;
  if (offer.to_player_id === GameState.myPlayerId) return "incoming";
  if (offer.from_player_id === GameState.myPlayerId) return "outgoing";
  return "other";
}

function renderTargetOptions(): string {
  const targets = availableTargets();
  if (!draft.toPlayerId && targets[0]) {
    draft.toPlayerId = String(targets[0].id);
  }
  return targets
    .map((player) => {
      const selected = String(player.id) === draft.toPlayerId ? "selected" : "";
      return `<option value="${player.id}" ${selected}>${escapeHtml(player.name)}</option>`;
    })
    .join("");
}

function renderResourceOptions(selected: string): string {
  return RESOURCE_ORDER.map((resource) => {
    const chosen = resource === selected ? "selected" : "";
    const label = RESOURCE_LABELS[resource];
    const count = resourceCount(resource);
    return `<option value="${resource}" ${chosen}>${label} (${count})</option>`;
  }).join("");
}

function resourceToPortType(resource: string): PortType | null {
  const key = normalizeResourceKey(resource);
  const mapping: Record<string, PortType> = {
    BRICK: "BRICK",
    LUMBER: "LUMBER",
    WOOL: "WOOL",
    GRAIN: "GRAIN",
    ORE: "ORE",
  };
  return mapping[key] ?? null;
}

function bestBankTradeRatio(resource: string): number {
  const playerId = GameState.myPlayerId;
  const board = GameState.publicState?.board;
  if (playerId == null || !board) {
    return 4;
  }
  const targetPortType = resourceToPortType(resource);
  let ratio = 4;
  for (const vertex of board.vertices) {
    if (vertex.port_id == null || !vertex.building) {
      continue;
    }
    if (vertex.building.owner_id !== playerId) {
      continue;
    }
    const port = board.ports.find((entry) => entry.id === vertex.port_id);
    if (!port) {
      continue;
    }
    if (port.port_type === "THREE_TO_ONE") {
      ratio = Math.min(ratio, 3);
    }
    if (targetPortType && port.port_type === targetPortType) {
      ratio = Math.min(ratio, 2);
    }
  }
  return ratio;
}

function bankGiveAmount(): number {
  return bestBankTradeRatio(bankDraft.giveResource) * bankDraft.receiveAmount;
}

function bankTradeHint(resource: string): string {
  const ratio = bestBankTradeRatio(resource);
  if (ratio === 2) {
    return "Your matching 2:1 port is active for this resource.";
  }
  if (ratio === 3) {
    return "Your generic 3:1 port is active for this resource.";
  }
  return "Default bank rate 4:1.";
}

function renderModeTabs(): string {
  const modes: Array<{ mode: TradeDialogMode; label: string; enabled: boolean }> = [
    { mode: "player", label: "Player", enabled: hasLegalAction("propose_trade_offer") || !!currentOffer() || !!outgoingTradeTracker },
    { mode: "bank", label: "Bank", enabled: hasLegalAction("trade_bank") },
  ];
  const visibleModes = modes.filter((entry) => entry.enabled);
  if (visibleModes.length <= 1) {
    return "";
  }
  return `
    <div class="trade-mode-tabs mb-4">
      ${visibleModes
        .map((entry) => `
          <button
            type="button"
            class="trade-mode-tab ${entry.mode === currentTradeMode ? "active" : ""}"
            data-trade-mode="${entry.mode}"
          >${entry.label}</button>
        `)
        .join("")}
    </div>
  `;
}

function proposalFormHtml(): string {
  clampDraft();
  return `
    <div class="trade-card p-5">
      <div class="flex items-center justify-between gap-3 mb-4">
        <div>
          <h3 class="text-[#fff3db] font-bold text-lg">Create Offer</h3>
          <p class="text-[#fbe4b4]/80 text-sm">Choose what you give, what you want back, and who should receive the proposal.</p>
        </div>
        <div class="trade-summary-pill text-sm">
          You have ${resourceCount(draft.giveResource)} ${RESOURCE_LABELS[draft.giveResource] ?? draft.giveResource}
        </div>
      </div>
      <div class="grid md:grid-cols-2 gap-4">
        <label class="block">
          <span class="trade-field-label">Target Player</span>
          <select id="trade-target" class="trade-select mt-2">${renderTargetOptions()}</select>
        </label>
        <div class="trade-card p-4">
          <span class="trade-field-label">Preview</span>
          <div class="mt-3 flex flex-wrap gap-2 items-center text-[#fff3db]">
            ${resourceChip(draft.giveResource, draft.giveAmount)}
            <span class="text-[#ffd166] font-bold text-lg">for</span>
            ${resourceChip(draft.receiveResource, draft.receiveAmount)}
          </div>
        </div>
      </div>
      <div class="grid md:grid-cols-2 gap-4 mt-4">
        <div class="trade-card p-4">
          <h4 class="text-[#fff3db] font-bold mb-3">You Give</h4>
          <div class="grid grid-cols-[1fr_110px] gap-3">
            <label class="block">
              <span class="trade-field-label">Resource</span>
              <select id="trade-give-resource" class="trade-select mt-2">${renderResourceOptions(draft.giveResource)}</select>
            </label>
            <label class="block">
              <span class="trade-field-label">Quantity</span>
              <input id="trade-give-amount" class="trade-input mt-2" type="number" min="1" max="${Math.max(1, resourceCount(draft.giveResource))}" value="${draft.giveAmount}" />
            </label>
          </div>
        </div>
        <div class="trade-card p-4">
          <h4 class="text-[#fff3db] font-bold mb-3">You Receive</h4>
          <div class="grid grid-cols-[1fr_110px] gap-3">
            <label class="block">
              <span class="trade-field-label">Resource</span>
              <select id="trade-receive-resource" class="trade-select mt-2">${renderResourceOptions(draft.receiveResource)}</select>
            </label>
            <label class="block">
              <span class="trade-field-label">Quantity</span>
              <input id="trade-receive-amount" class="trade-input mt-2" type="number" min="1" value="${draft.receiveAmount}" />
            </label>
          </div>
        </div>
      </div>
      <div class="mt-5 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <p class="text-[#fbe4b4]/75 text-sm">Only one player trade can stay pending at a time.</p>
        <div class="flex gap-3">
          <button id="trade-dismiss" type="button" class="btn-action trade-btn-secondary px-4 py-2 rounded font-bold">Close</button>
          <button id="trade-submit" type="button" class="btn-action px-5 py-2 rounded font-bold text-[#3e2723]">Send Offer</button>
        </div>
      </div>
    </div>
  `;
}

function bankTradeHtml(): string {
  const ratio = bestBankTradeRatio(bankDraft.giveResource);
  const requiredGive = bankGiveAmount();
  return `
    <div class="trade-card p-5">
      <div class="flex items-center justify-between gap-3 mb-4">
        <div>
          <h3 class="text-[#fff3db] font-bold text-lg">Trade With Bank</h3>
          <p class="text-[#fbe4b4]/80 text-sm">Choose what to spend and what to receive from the bank. The required amount updates with your ports.</p>
        </div>
        <div class="trade-summary-pill text-sm">
          Rate ${ratio}:1
        </div>
      </div>
      <div class="grid md:grid-cols-2 gap-4">
        <div class="trade-card p-4">
          <h4 class="text-[#fff3db] font-bold mb-3">You Give</h4>
          <div class="grid grid-cols-[1fr_120px] gap-3">
            <label class="block">
              <span class="trade-field-label">Resource</span>
              <select id="bank-give-resource" class="trade-select mt-2">${renderResourceOptions(bankDraft.giveResource)}</select>
            </label>
            <label class="block">
              <span class="trade-field-label">Required</span>
              <input class="trade-input mt-2" type="number" value="${requiredGive}" disabled />
            </label>
          </div>
          <p class="text-[#fbe4b4]/75 text-sm mt-3">${bankTradeHint(bankDraft.giveResource)}</p>
          <p class="text-[#fbe4b4]/75 text-sm mt-1">You currently have ${resourceCount(bankDraft.giveResource)} ${RESOURCE_LABELS[bankDraft.giveResource] ?? bankDraft.giveResource}.</p>
        </div>
        <div class="trade-card p-4">
          <h4 class="text-[#fff3db] font-bold mb-3">You Receive</h4>
          <div class="grid grid-cols-[1fr_120px] gap-3">
            <label class="block">
              <span class="trade-field-label">Resource</span>
              <select id="bank-receive-resource" class="trade-select mt-2">${renderResourceOptions(bankDraft.receiveResource)}</select>
            </label>
            <label class="block">
              <span class="trade-field-label">Quantity</span>
              <input id="bank-receive-amount" class="trade-input mt-2" type="number" min="1" value="${bankDraft.receiveAmount}" />
            </label>
          </div>
        </div>
      </div>
      <div class="trade-card p-4 mt-4">
        <span class="trade-field-label">Preview</span>
        <div class="mt-3 flex flex-wrap gap-2 items-center text-[#fff3db]">
          ${resourceChip(bankDraft.giveResource, requiredGive)}
          <span class="text-[#ffd166] font-bold text-lg">for</span>
          ${resourceChip(bankDraft.receiveResource, bankDraft.receiveAmount)}
        </div>
      </div>
      <div class="mt-5 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <p class="text-[#fbe4b4]/75 text-sm">The backend still validates the final bank trade.</p>
        <div class="flex gap-3">
          <button id="trade-dismiss" type="button" class="btn-action trade-btn-secondary px-4 py-2 rounded font-bold">Close</button>
          <button id="bank-trade-submit" type="button" class="btn-action px-5 py-2 rounded font-bold text-[#3e2723]">Trade With Bank</button>
        </div>
      </div>
    </div>
  `;
}

function pendingOfferHtml(offer: TradeOffer, role: "incoming" | "outgoing" | "other"): string {
  const from = GameState.playerMap[offer.from_player_id];
  const to = GameState.playerMap[offer.to_player_id];
  const fromName = escapeHtml(from?.name ?? "Player");
  const toName = escapeHtml(to?.name ?? "Player");
  const statusLabel =
    role === "incoming"
      ? "Incoming offer"
      : role === "outgoing"
        ? "Offer awaiting response"
        : "Trade in progress";
  const helperText =
    role === "incoming"
      ? "Review the exchange below and decide whether to accept or refuse."
      : role === "outgoing"
        ? "Your offer is pending. You can cancel it before the other player answers."
        : "Another player trade is pending right now.";
  const actionButtons =
    role === "incoming" && hasLegalAction("respond_trade_offer")
      ? `
        <button id="trade-reject" type="button" class="btn-action trade-btn-secondary px-4 py-2 rounded font-bold">Refuse</button>
        <button id="trade-accept" type="button" class="btn-action px-5 py-2 rounded font-bold text-[#3e2723]">Accept</button>
      `
      : role === "outgoing" && hasLegalAction("cancel_trade_offer")
        ? `
          <button id="trade-cancel-offer" type="button" class="btn-action trade-btn-danger px-5 py-2 rounded font-bold">Cancel Offer</button>
        `
        : `
          <button id="trade-dismiss" type="button" class="btn-action trade-btn-secondary px-4 py-2 rounded font-bold">Close</button>
        `;
  return `
    <div class="trade-card p-5">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <p class="trade-kicker">${statusLabel}</p>
          <h3 class="text-[#fff3db] font-bold text-xl">${fromName} to ${toName}</h3>
          <p class="text-[#fbe4b4]/80 text-sm mt-1">${helperText}</p>
        </div>
        <div class="trade-summary-pill text-sm">Offer ID: ${offer.id.slice(0, 8)}</div>
      </div>
      <div class="grid md:grid-cols-2 gap-4">
        <div class="trade-card p-4">
          <span class="trade-field-label">Proposer gives</span>
          <div class="mt-3 flex flex-wrap gap-2">${summarizeTradeBundle(offer.give)}</div>
        </div>
        <div class="trade-card p-4">
          <span class="trade-field-label">Proposer receives</span>
          <div class="mt-3 flex flex-wrap gap-2">${summarizeTradeBundle(offer.receive)}</div>
        </div>
      </div>
      <div class="mt-5 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <p class="text-[#fbe4b4]/75 text-sm">New trade proposals stay locked until this one is resolved.</p>
        <div class="flex gap-3">${actionButtons}</div>
      </div>
    </div>
  `;
}

function waitingOfferHtml(tracker: OutgoingTradeTracker): string {
  const targetName = escapeHtml(tracker.targetName);
  return `
    <div class="trade-card p-5">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <p class="trade-kicker">Waiting for answer</p>
          <h3 class="text-[#fff3db] font-bold text-xl">Offer sent to ${targetName}</h3>
          <p class="text-[#fbe4b4]/80 text-sm mt-1">The other player is deciding whether to accept or refuse your trade.</p>
        </div>
        <div class="trade-summary-pill text-sm">Pending response</div>
      </div>
      <div class="grid md:grid-cols-2 gap-4">
        <div class="trade-card p-4">
          <span class="trade-field-label">You offer</span>
          <div class="mt-3 flex flex-wrap gap-2">${renderBundleChips(tracker.give)}</div>
        </div>
        <div class="trade-card p-4">
          <span class="trade-field-label">You want</span>
          <div class="mt-3 flex flex-wrap gap-2">${renderBundleChips(tracker.receive)}</div>
        </div>
      </div>
      <div class="mt-5 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <p class="text-[#fbe4b4]/75 text-sm">This window updates automatically when ${targetName} answers.</p>
        <div class="flex gap-3">
          <button id="trade-dismiss" type="button" class="btn-action trade-btn-secondary px-4 py-2 rounded font-bold">Minimize</button>
          <button id="trade-cancel-offer" type="button" class="btn-action trade-btn-danger px-5 py-2 rounded font-bold">Cancel Offer</button>
        </div>
      </div>
    </div>
  `;
}

function resolvedOfferHtml(tracker: OutgoingTradeTracker): string {
  const accepted = tracker.outcome === "accepted";
  const targetName = escapeHtml(tracker.targetName);
  const title = accepted ? "Trade accepted" : "Trade refused";
  const helper = accepted
    ? `${targetName} accepted your offer and the resources were exchanged.`
    : `${targetName} refused your offer. No resources changed hands.`;
  const pill = accepted ? "Accepted" : "Refused";
  return `
    <div class="trade-card p-5">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <p class="trade-kicker">Trade result</p>
          <h3 class="text-[#fff3db] font-bold text-xl">${title}</h3>
          <p class="text-[#fbe4b4]/80 text-sm mt-1">${helper}</p>
        </div>
        <div class="trade-summary-pill text-sm">${pill}</div>
      </div>
      <div class="grid md:grid-cols-2 gap-4">
        <div class="trade-card p-4">
          <span class="trade-field-label">You offered</span>
          <div class="mt-3 flex flex-wrap gap-2">${renderBundleChips(tracker.give)}</div>
        </div>
        <div class="trade-card p-4">
          <span class="trade-field-label">You requested</span>
          <div class="mt-3 flex flex-wrap gap-2">${renderBundleChips(tracker.receive)}</div>
        </div>
      </div>
      <div class="mt-5 flex justify-end">
        <button id="trade-dismiss" type="button" class="btn-action px-5 py-2 rounded font-bold text-[#3e2723]">OK</button>
      </div>
    </div>
  `;
}

function unavailableHtml(): string {
  return `
    <div class="trade-card p-5">
      <h3 class="text-[#fff3db] font-bold text-lg">Trade unavailable</h3>
      <p class="text-[#fbe4b4]/80 text-sm mt-2">You can open this panel anytime, but player trading is only available when the server says it is legal.</p>
      <div class="mt-5">
        <button id="trade-dismiss" type="button" class="btn-action trade-btn-secondary px-4 py-2 rounded font-bold">Close</button>
      </div>
    </div>
  `;
}

function bindProposalForm(): void {
  const target = $opt<HTMLSelectElement>("trade-target");
  const giveResource = $opt<HTMLSelectElement>("trade-give-resource");
  const giveAmount = $opt<HTMLInputElement>("trade-give-amount");
  const receiveResource = $opt<HTMLSelectElement>("trade-receive-resource");
  const receiveAmount = $opt<HTMLInputElement>("trade-receive-amount");
  const dismiss = $opt<HTMLButtonElement>("trade-dismiss");
  const submit = $opt<HTMLButtonElement>("trade-submit");

  target?.addEventListener("change", () => {
    draft.toPlayerId = target.value;
  });
  giveResource?.addEventListener("change", () => {
    draft.giveResource = giveResource.value;
    renderTradeDialog();
  });
  giveAmount?.addEventListener("input", () => {
    draft.giveAmount = Number(giveAmount.value) || 1;
  });
  receiveResource?.addEventListener("change", () => {
    draft.receiveResource = receiveResource.value;
    renderTradeDialog();
  });
  receiveAmount?.addEventListener("input", () => {
    draft.receiveAmount = Number(receiveAmount.value) || 1;
  });
  dismiss?.addEventListener("click", closeTradeDialog);
  submit?.addEventListener("click", () => {
    void submitTradeOffer();
  });
}

function bindModeTabs(): void {
  document
    .querySelectorAll<HTMLButtonElement>("[data-trade-mode]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const mode = button.dataset.tradeMode;
        if (mode === "player" || mode === "bank") {
          currentTradeMode = mode;
          renderTradeDialog();
        }
      });
    });
}

function bindBankTradeForm(): void {
  const giveResource = $opt<HTMLSelectElement>("bank-give-resource");
  const receiveResource = $opt<HTMLSelectElement>("bank-receive-resource");
  const receiveAmount = $opt<HTMLInputElement>("bank-receive-amount");
  $opt<HTMLButtonElement>("trade-dismiss")?.addEventListener("click", closeTradeDialog);
  giveResource?.addEventListener("change", () => {
    bankDraft.giveResource = giveResource.value;
    renderTradeDialog();
  });
  receiveResource?.addEventListener("change", () => {
    bankDraft.receiveResource = receiveResource.value;
    renderTradeDialog();
  });
  receiveAmount?.addEventListener("input", () => {
    bankDraft.receiveAmount = Math.max(1, Number(receiveAmount.value) || 1);
  });
  $opt<HTMLButtonElement>("bank-trade-submit")?.addEventListener("click", () => {
    void submitBankTrade();
  });
}

function bindPendingActions(offer: TradeOffer, role: "incoming" | "outgoing" | "other"): void {
  $opt<HTMLButtonElement>("trade-dismiss")?.addEventListener("click", closeTradeDialog);
  if (role === "incoming") {
    $opt<HTMLButtonElement>("trade-accept")?.addEventListener("click", () => {
      void respondToOffer(offer, true);
    });
    $opt<HTMLButtonElement>("trade-reject")?.addEventListener("click", () => {
      void respondToOffer(offer, false);
    });
  }
  if (role === "outgoing") {
    $opt<HTMLButtonElement>("trade-cancel-offer")?.addEventListener("click", () => {
      void cancelOffer(offer);
    });
  }
}

function bindCommon(): void {
  $("trade-close").onclick = closeTradeDialog;
  $("trade-dialog").onclick = (event) => {
    if (event.target === $("trade-dialog")) {
      closeTradeDialog();
    }
  };
}

export function closeTradeDialog(): void {
  if (outgoingTradeTracker?.status === "resolved") {
    outgoingTradeTracker = null;
  }
  $opt("trade-dialog")?.classList.add("hidden");
}

export function renderTradeDialog(): void {
  const subtitle = $("trade-subtitle");
  const content = $("trade-content");
  const offer = currentOffer();
  const role = pendingOfferRole(offer);

  bindCommon();

  if (outgoingTradeTracker?.status === "resolved") {
    subtitle.textContent = "The player answered your proposal.";
    content.innerHTML = renderModeTabs() + resolvedOfferHtml(outgoingTradeTracker);
    bindModeTabs();
    $opt<HTMLButtonElement>("trade-dismiss")?.addEventListener("click", closeTradeDialog);
    return;
  }

  if (currentTradeMode === "player" && outgoingTradeTracker?.status === "waiting") {
    subtitle.textContent = "Your proposal is waiting for the other player's decision.";
    content.innerHTML = renderModeTabs() + waitingOfferHtml(outgoingTradeTracker);
    bindModeTabs();
    bindPendingActions(
      {
        id: outgoingTradeTracker.offerId,
        from_player_id: GameState.myPlayerId ?? -1,
        to_player_id: Number(draft.toPlayerId || 0),
        give: outgoingTradeTracker.give,
        receive: outgoingTradeTracker.receive,
      },
      "outgoing",
    );
    $opt<HTMLButtonElement>("trade-dismiss")?.addEventListener("click", closeTradeDialog);
    return;
  }

  if (offer && role && role !== "other") {
    subtitle.textContent =
      role === "incoming"
        ? "A player sent you a proposal."
        : "Your current proposal is waiting for an answer.";
    content.innerHTML = renderModeTabs() + pendingOfferHtml(offer, role);
    bindModeTabs();
    bindPendingActions(offer, role);
    return;
  }

  if (currentTradeMode === "bank" && hasLegalAction("trade_bank")) {
    subtitle.textContent = "Exchange resources directly with the bank.";
    content.innerHTML = renderModeTabs() + bankTradeHtml();
    bindModeTabs();
    bindBankTradeForm();
    return;
  }

  if (hasLegalAction("propose_trade_offer")) {
    currentTradeMode = "player";
    subtitle.textContent = "Set up a direct resource exchange with another player.";
    content.innerHTML = renderModeTabs() + proposalFormHtml();
    bindModeTabs();
    bindProposalForm();
    return;
  }

  if (hasLegalAction("trade_bank")) {
    currentTradeMode = "bank";
    subtitle.textContent = "Exchange resources directly with the bank.";
    content.innerHTML = renderModeTabs() + bankTradeHtml();
    bindModeTabs();
    bindBankTradeForm();
    return;
  }

  subtitle.textContent = "No direct trade can be created right now.";
  content.innerHTML = renderModeTabs() + unavailableHtml();
  bindModeTabs();
  $opt<HTMLButtonElement>("trade-dismiss")?.addEventListener("click", closeTradeDialog);
}

export function openTradeDialog(mode: TradeDialogMode = "player"): void {
  currentTradeMode = mode;
  $("trade-dialog").classList.remove("hidden");
  renderTradeDialog();
}

export function showTradeOfferDialog(_offer: TradeOffer): void {
  openTradeDialog();
}

function wasTradeAccepted(tracker: OutgoingTradeTracker): boolean {
  const currentResources = GameState.privateState?.resources ?? {};
  const resourceKeys = new Set([
    ...Object.keys(tracker.give),
    ...Object.keys(tracker.receive),
  ]);
  for (const resource of resourceKeys) {
    const upper = normalizeResourceKey(resource);
    const before = tracker.resourcesBeforeOffer[upper] ?? 0;
    const expected =
      before -
      (tracker.give[lowerResourceKey(upper)] ?? tracker.give[upper] ?? 0) +
      (tracker.receive[lowerResourceKey(upper)] ?? tracker.receive[upper] ?? 0);
    if ((currentResources[upper] ?? 0) !== expected) {
      return false;
    }
  }
  return true;
}

export function syncTradeOfferDialog(): void {
  if (!outgoingTradeTracker) {
    return;
  }
  const offer = currentOffer();
  if (
    outgoingTradeTracker.status === "waiting" &&
    (!offer || offer.id !== outgoingTradeTracker.offerId)
  ) {
    outgoingTradeTracker = {
      ...outgoingTradeTracker,
      status: "resolved",
      outcome: wasTradeAccepted(outgoingTradeTracker) ? "accepted" : "refused",
    };
    $("trade-dialog").classList.remove("hidden");
    renderTradeDialog();
    return;
  }

  if (isDialogVisible()) {
    renderTradeDialog();
  }
}

function isDialogVisible(): boolean {
  const dialog = $opt("trade-dialog");
  return !!dialog && !dialog.classList.contains("hidden");
}

async function submitTradeOffer(): Promise<void> {
  clampDraft();
  const targetId = Number(draft.toPlayerId);
  if (!targetId) {
    showToast("Choose a target player", "warning");
    return;
  }
  if (draft.giveAmount < 1 || draft.receiveAmount < 1) {
    showToast("Quantities must be at least 1", "warning");
    return;
  }
  if (draft.giveResource === draft.receiveResource) {
    showToast("Choose different resources to give and receive", "warning");
    return;
  }
  if (resourceCount(draft.giveResource) < draft.giveAmount) {
    showToast("You do not have enough resources for this offer", "warning");
    return;
  }
  const target = GameState.playerMap[targetId];
  const give = { [lowerResourceKey(draft.giveResource)]: draft.giveAmount };
  const receive = {
    [lowerResourceKey(draft.receiveResource)]: draft.receiveAmount,
  };
  const resourcesBeforeOffer = cloneResources();
  const result = await apiCommand("propose_trade_offer", {
    to_player_id: targetId,
    give,
    receive,
  });
  if (result?.accepted) {
    const offerId =
      result.events?.find((event) => event.type === "trade_offer_proposed")
        ?.offer_id;
    if (typeof offerId === "string") {
      outgoingTradeTracker = {
        offerId,
        targetName: target?.name ?? "player",
        give,
        receive,
        resourcesBeforeOffer,
        status: "waiting",
      };
      $("trade-dialog").classList.remove("hidden");
      renderTradeDialog();
    }
    showToast("Trade offer sent to " + (target?.name ?? "player"), "success");
  }
}

async function submitBankTrade(): Promise<void> {
  bankDraft.receiveAmount = Math.max(1, bankDraft.receiveAmount);
  const giveAmount = bankGiveAmount();
  if (bankDraft.giveResource === bankDraft.receiveResource) {
    showToast("Choose different resources to give and receive", "warning");
    return;
  }
  if (resourceCount(bankDraft.giveResource) < giveAmount) {
    showToast("You do not have enough resources for this bank trade", "warning");
    return;
  }
  const result = await apiCommand("trade_bank", {
    give: { [lowerResourceKey(bankDraft.giveResource)]: giveAmount },
    receive: {
      [lowerResourceKey(bankDraft.receiveResource)]: bankDraft.receiveAmount,
    },
  });
  if (result?.accepted) {
    closeTradeDialog();
    showToast("Bank trade executed", "success");
  }
}

async function respondToOffer(offer: TradeOffer, accept: boolean): Promise<void> {
  const result = await apiCommand("respond_trade_offer", {
    offer_id: offer.id,
    accept,
  });
  if (result?.accepted) {
    closeTradeDialog();
    showToast(accept ? "Trade accepted" : "Trade refused", accept ? "success" : "info");
  }
}

async function cancelOffer(offer: TradeOffer): Promise<void> {
  const result = await apiCommand("cancel_trade_offer", {
    offer_id: offer.id,
  });
  if (result?.accepted) {
    if (outgoingTradeTracker?.offerId === offer.id) {
      outgoingTradeTracker = null;
    }
    closeTradeDialog();
    showToast("Trade offer cancelled", "info");
  }
}
