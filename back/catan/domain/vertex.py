from __future__ import annotations

from dataclasses import dataclass, field

from .building import Building


@dataclass
class Vertex:
    id: int
    adjacent_vertex_ids: set[int] = field(default_factory=set)
    incident_edge_ids: set[int] = field(default_factory=set)
    adjacent_tile_ids: set[int] = field(default_factory=set)
    port_id: int | None = None
    building: Building | None = None

    def is_occupied(self) -> bool:
        return self.building is not None

    def owner_id(self) -> int | None:
        return self.building.owner_id if self.building is not None else None
