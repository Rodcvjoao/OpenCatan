from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Building:
    owner_id: int
    victory_points: int


@dataclass
class Settlement(Building):
    def __init__(self, owner_id: int) -> None:
        super().__init__(owner_id=owner_id, victory_points=1)


@dataclass
class City(Building):
    def __init__(self, owner_id: int) -> None:
        super().__init__(owner_id=owner_id, victory_points=2)
