from __future__ import annotations

from dataclasses import dataclass, field

from .enums import DevelopmentCardType, ResourceType


@dataclass
class Bank:
    resource_cards: dict[ResourceType, int] = field(default_factory=dict)
    dev_card_counts: dict[DevelopmentCardType, int] = field(default_factory=dict)

    @classmethod
    def default(cls) -> "Bank":
        return cls(
            resource_cards={
                ResourceType.BRICK: 19,
                ResourceType.LUMBER: 19,
                ResourceType.WOOL: 19,
                ResourceType.GRAIN: 19,
                ResourceType.ORE: 19,
            },
            dev_card_counts={
                DevelopmentCardType.KNIGHT: 14,
                DevelopmentCardType.VICTORY_POINT: 5,
                DevelopmentCardType.ROAD_BUILDING: 2,
                DevelopmentCardType.YEAR_OF_PLENTY: 2,
                DevelopmentCardType.MONOPOLY: 2,
            },
        )

    def can_pay(self, resource: ResourceType, amount: int) -> bool:
        return self.resource_cards.get(resource, 0) >= amount

    def pay(self, resource: ResourceType, amount: int) -> None:
        if not self.can_pay(resource, amount):
            raise ValueError(f"Bank lacks {resource.name}")
        self.resource_cards[resource] -= amount

    def receive(self, resource: ResourceType, amount: int) -> None:
        self.resource_cards[resource] = self.resource_cards.get(resource, 0) + amount

    def draw_dev_card(self, card_type: DevelopmentCardType) -> None:
        if self.dev_card_counts.get(card_type, 0) <= 0:
            raise ValueError(f"No {card_type.name} cards left")
        self.dev_card_counts[card_type] -= 1
