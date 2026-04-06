from __future__ import annotations

from dataclasses import dataclass, field

from .road import Road


@dataclass
class Edge:
    id: int
    v1: int
    v2: int
    adjacent_tile_ids: set[int] = field(default_factory=set)
    road: Road | None = None

    def owner_id(self) -> int | None:
        return self.road.owner_id if self.road is not None else None

    def endpoints(self) -> tuple[int, int]:
        return (self.v1, self.v2)
