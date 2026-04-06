from __future__ import annotations

import random
from dataclasses import dataclass, field

from .enums import DevelopmentCardType


@dataclass
class DevelopmentDeck:
    cards: list[DevelopmentCardType] = field(default_factory=list)

    @classmethod
    def default(cls, rng: random.Random | None = None) -> "DevelopmentDeck":
        cards = [DevelopmentCardType.KNIGHT] * 14
        cards += [DevelopmentCardType.VICTORY_POINT] * 5
        cards += [DevelopmentCardType.ROAD_BUILDING] * 2
        cards += [DevelopmentCardType.YEAR_OF_PLENTY] * 2
        cards += [DevelopmentCardType.MONOPOLY] * 2
        deck = cls(cards=cards)
        deck.shuffle(rng)
        return deck

    def shuffle(self, rng: random.Random | None = None) -> None:
        (rng or random).shuffle(self.cards)

    def draw(self) -> DevelopmentCardType:
        if not self.cards:
            raise ValueError("Development deck is empty")
        return self.cards.pop()

    def remaining(self) -> int:
        return len(self.cards)
