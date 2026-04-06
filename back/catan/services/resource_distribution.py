from __future__ import annotations

from collections import defaultdict
from typing import TYPE_CHECKING

from catan.domain.building import City, Settlement
from catan.domain.enums import ResourceType

if TYPE_CHECKING:
    from catan.domain.board import Board


def compute_resource_production(
    board: "Board", dice_value: int
) -> dict[int, dict[ResourceType, int]]:
    production: dict[int, dict[ResourceType, int]] = defaultdict(
        lambda: defaultdict(int)
    )
    robber_tile_id = board.robber.tile_id if board.robber is not None else None

    for tile in board.tiles.values():
        if tile.id == robber_tile_id:
            continue
        if tile.is_desert() or tile.number_token != dice_value:
            continue

        for vertex_id in tile.vertex_ids:
            building = board.vertices[vertex_id].building
            if isinstance(building, Settlement):
                production[building.owner_id][tile.resource_type] += 1
            elif isinstance(building, City):
                production[building.owner_id][tile.resource_type] += 2

    return {pid: dict(resources) for pid, resources in production.items()}
