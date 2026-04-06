from __future__ import annotations

from dataclasses import dataclass

from .enums import ResourceType


@dataclass
class Tile:
    id: int
    resource_type: ResourceType
    number_token: int | None
    vertex_ids: tuple[int, int, int, int, int, int]
    edge_ids: tuple[int, int, int, int, int, int]
    has_robber: bool = False

    def is_desert(self) -> bool:
        return self.resource_type == ResourceType.DESERT
