// Incoming trade-offer prompt. Still window.confirm for now; HTML dialog is
// a follow-up refactor (see Decision 5 notes).

import { apiCommand } from "../../net/api";
import { GameState } from "../../state";
import type { TradeOffer } from "../../types";

export function showTradeOfferDialog(offer: TradeOffer): void {
  const from = GameState.playerMap[offer.from_player_id];
  const giveText = Object.entries(offer.give ?? {})
    .map(([k, v]) => `${v} ${k}`)
    .join(", ");
  const receiveText = Object.entries(offer.receive ?? {})
    .map(([k, v]) => `${v} ${k}`)
    .join(", ");
  const accept = window.confirm(
    `${from?.name ?? "Player"} offers ${giveText} for ${receiveText}. Accept?`,
  );
  void apiCommand("respond_trade_offer", { offer_id: offer.id, accept });
}
