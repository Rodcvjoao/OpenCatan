from __future__ import annotations

from dataclasses import dataclass

from .enums import ResourceType


@dataclass(frozen=True)
class TradeOffer:
    from_player_id: int
    to_player_id: int
    give: dict[ResourceType, int]
    receive: dict[ResourceType, int]
