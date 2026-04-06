from __future__ import annotations

from dataclasses import dataclass, field

from catan.services.longest_road import compute_longest_road
from catan.services.resource_distribution import compute_resource_production
from catan.topology.layouts import port_ratio
from catan.topology.standard_board import (
    EDGE_TO_VERTICES,
    PORT_TO_VERTICES,
    TILE_TO_EDGES,
    TILE_TO_VERTICES,
)

from .building import City, Settlement
from .edge import Edge
from .enums import PortType, ResourceType
from .port import Port
from .road import Road
from .tile import Tile
from .vertex import Vertex


@dataclass
class Robber:
    tile_id: int

    def move_to(self, tile_id: int) -> None:
        self.tile_id = tile_id


@dataclass
class Board:
    tiles: dict[int, Tile] = field(default_factory=dict)
    vertices: dict[int, Vertex] = field(default_factory=dict)
    edges: dict[int, Edge] = field(default_factory=dict)
    ports: dict[int, Port] = field(default_factory=dict)
    robber: Robber | None = None

    def build_standard_topology(self) -> None:
        self.tiles.clear()
        self.vertices.clear()
        self.edges.clear()
        self.ports.clear()
        self.robber = None

        max_vertex_id = max(max(v) for v in EDGE_TO_VERTICES.values())
        for vertex_id in range(max_vertex_id + 1):
            self.vertices[vertex_id] = Vertex(id=vertex_id)

        for edge_id, (v1, v2) in EDGE_TO_VERTICES.items():
            self.edges[edge_id] = Edge(id=edge_id, v1=v1, v2=v2)
            self.vertices[v1].incident_edge_ids.add(edge_id)
            self.vertices[v2].incident_edge_ids.add(edge_id)
            self.vertices[v1].adjacent_vertex_ids.add(v2)
            self.vertices[v2].adjacent_vertex_ids.add(v1)

        for tile_id, vertex_ids in TILE_TO_VERTICES.items():
            edge_ids = TILE_TO_EDGES[tile_id]
            tile = Tile(
                id=tile_id,
                resource_type=ResourceType.DESERT,
                number_token=None,
                vertex_ids=vertex_ids,
                edge_ids=edge_ids,
                has_robber=False,
            )
            self.tiles[tile_id] = tile
            for vertex_id in vertex_ids:
                self.vertices[vertex_id].adjacent_tile_ids.add(tile_id)
            for edge_id in edge_ids:
                self.edges[edge_id].adjacent_tile_ids.add(tile_id)

    def assign_tiles(
        self, resource_layout: list[ResourceType], token_layout: list[int]
    ) -> None:
        if len(resource_layout) != len(self.tiles):
            raise ValueError("Resource layout must have 19 entries")

        desert_count = sum(
            1 for resource in resource_layout if resource == ResourceType.DESERT
        )
        if desert_count != 1:
            raise ValueError("Resource layout must contain exactly one DESERT")

        token_iter = iter(token_layout)
        robber_tile_id: int | None = None

        for tile_id in sorted(self.tiles):
            tile = self.tiles[tile_id]
            tile.resource_type = resource_layout[tile_id]
            tile.has_robber = False
            if tile.is_desert():
                tile.number_token = None
                robber_tile_id = tile_id
            else:
                try:
                    tile.number_token = next(token_iter)
                except StopIteration as exc:
                    raise ValueError("Token layout must have 18 entries") from exc

        try:
            next(token_iter)
            raise ValueError("Token layout must have exactly 18 entries")
        except StopIteration:
            pass

        if robber_tile_id is None:
            raise ValueError("Missing desert tile")
        self.robber = Robber(tile_id=robber_tile_id)
        self.tiles[robber_tile_id].has_robber = True

    def assign_ports(self, port_layout: list[PortType]) -> None:
        if len(port_layout) != len(PORT_TO_VERTICES):
            raise ValueError("Port layout must have 9 entries")

        self.ports.clear()
        for vertex in self.vertices.values():
            vertex.port_id = None

        for port_id, vertex_ids in PORT_TO_VERTICES.items():
            port_type = port_layout[port_id]
            port = Port(
                id=port_id,
                port_type=port_type,
                vertex_ids=vertex_ids,
                trade_ratio=port_ratio(port_type),
            )
            self.ports[port_id] = port
            self.vertices[vertex_ids[0]].port_id = port_id
            self.vertices[vertex_ids[1]].port_id = port_id

    def get_adjacent_vertices(self, vertex_id: int) -> set[int]:
        return set(self.vertices[vertex_id].adjacent_vertex_ids)

    def get_incident_edges(self, vertex_id: int) -> set[int]:
        return set(self.vertices[vertex_id].incident_edge_ids)

    def get_edge_vertices(self, edge_id: int) -> tuple[int, int]:
        return self.edges[edge_id].endpoints()

    def get_tile_vertices(self, tile_id: int) -> tuple[int, int, int, int, int, int]:
        return self.tiles[tile_id].vertex_ids

    def get_tile_edges(self, tile_id: int) -> tuple[int, int, int, int, int, int]:
        return self.tiles[tile_id].edge_ids

    def get_vertex_tiles(self, vertex_id: int) -> set[int]:
        return set(self.vertices[vertex_id].adjacent_tile_ids)

    def get_edge_tiles(self, edge_id: int) -> set[int]:
        return set(self.edges[edge_id].adjacent_tile_ids)

    def can_place_settlement(
        self, player_id: int, vertex_id: int, setup_phase: bool = False
    ) -> bool:
        vertex = self.vertices[vertex_id]
        if vertex.is_occupied():
            return False

        for adjacent_vertex_id in vertex.adjacent_vertex_ids:
            if self.vertices[adjacent_vertex_id].is_occupied():
                return False

        if setup_phase:
            return True

        for edge_id in vertex.incident_edge_ids:
            if self.edges[edge_id].owner_id() == player_id:
                return True
        return False

    def can_place_road(
        self, player_id: int, edge_id: int, setup_phase: bool = False
    ) -> bool:
        edge = self.edges[edge_id]
        if edge.road is not None:
            return False

        endpoints = (self.vertices[edge.v1], self.vertices[edge.v2])
        if setup_phase:
            return any(vertex.owner_id() == player_id for vertex in endpoints)

        for vertex in endpoints:
            if vertex.owner_id() == player_id:
                return True

        for vertex in endpoints:
            if vertex.owner_id() not in (None, player_id):
                continue
            for neighbor_edge_id in vertex.incident_edge_ids:
                if neighbor_edge_id == edge_id:
                    continue
                if self.edges[neighbor_edge_id].owner_id() == player_id:
                    return True
        return False

    def can_upgrade_to_city(self, player_id: int, vertex_id: int) -> bool:
        building = self.vertices[vertex_id].building
        return isinstance(building, Settlement) and building.owner_id == player_id

    def place_settlement(self, player_id: int, vertex_id: int) -> None:
        self.vertices[vertex_id].building = Settlement(owner_id=player_id)

    def place_city(self, player_id: int, vertex_id: int) -> None:
        if not self.can_upgrade_to_city(player_id, vertex_id):
            raise ValueError("Cannot upgrade to city on this vertex")
        self.vertices[vertex_id].building = City(owner_id=player_id)

    def place_road(self, player_id: int, edge_id: int) -> None:
        if self.edges[edge_id].road is not None:
            raise ValueError("Road already exists on edge")
        self.edges[edge_id].road = Road(owner_id=player_id)

    def move_robber(self, tile_id: int) -> None:
        if tile_id not in self.tiles:
            raise ValueError("Invalid tile id")
        if self.robber is not None:
            self.tiles[self.robber.tile_id].has_robber = False
            self.robber.move_to(tile_id)
        else:
            self.robber = Robber(tile_id=tile_id)
        self.tiles[tile_id].has_robber = True

    def produce_resources(self, dice_value: int) -> dict[int, dict[ResourceType, int]]:
        return compute_resource_production(self, dice_value)

    def compute_longest_road(self, player_id: int) -> int:
        return compute_longest_road(self, player_id)
