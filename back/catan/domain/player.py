from __future__ import annotations

from dataclasses import dataclass, field

from .enums import DevelopmentCardType, ResourceType


@dataclass
class Player:
    id: int
    name: str
    color: str
    resources: dict[ResourceType, int] = field(default_factory=dict)
    dev_cards_hand: list[DevelopmentCardType] = field(default_factory=list)
    played_knights: int = 0
    road_ids: set[int] = field(default_factory=set)
    settlement_vertex_ids: set[int] = field(default_factory=set)
    city_vertex_ids: set[int] = field(default_factory=set)
    has_longest_road: bool = False
    has_largest_army: bool = False

    def victory_points(self) -> int:
        points = len(self.settlement_vertex_ids) + 2 * len(self.city_vertex_ids)
        if self.has_longest_road:
            points += 2
        if self.has_largest_army:
            points += 2
        vp_cards = sum(
            1 for c in self.dev_cards_hand if c == DevelopmentCardType.VICTORY_POINT
        )
        return points + vp_cards

    def resource_count(self) -> int:
        return sum(self.resources.values())

    def add_resource(self, resource: ResourceType, amount: int = 1) -> None:
        self.resources[resource] = self.resources.get(resource, 0) + amount

    def remove_resource(self, resource: ResourceType, amount: int = 1) -> None:
        current = self.resources.get(resource, 0)
        if current < amount:
            raise ValueError(f"Player {self.id} lacks {resource.name}")
        self.resources[resource] = current - amount

    def can_afford(self, cost: dict[ResourceType, int]) -> bool:
        return all(
            self.resources.get(resource, 0) >= amount
            for resource, amount in cost.items()
        )
