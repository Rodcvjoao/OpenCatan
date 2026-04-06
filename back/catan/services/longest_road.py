from __future__ import annotations

from functools import lru_cache
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from catan.domain.board import Board


def compute_longest_road(board: "Board", player_id: int) -> int:
    player_edge_ids = {
        edge_id
        for edge_id, edge in board.edges.items()
        if edge.road is not None and edge.road.owner_id == player_id
    }
    if not player_edge_ids:
        return 0

    blocked_vertices = {
        vertex_id
        for vertex_id, vertex in board.vertices.items()
        if vertex.building is not None and vertex.building.owner_id != player_id
    }

    vertex_to_edges: dict[int, tuple[int, ...]] = {}
    for vertex_id, vertex in board.vertices.items():
        edges = tuple(
            edge_id
            for edge_id in vertex.incident_edge_ids
            if edge_id in player_edge_ids
        )
        if edges:
            vertex_to_edges[vertex_id] = edges

    @lru_cache(maxsize=None)
    def dfs(
        vertex_id: int, used_edges: frozenset[int], incoming_edge_id: int | None
    ) -> int:
        if incoming_edge_id is not None and vertex_id in blocked_vertices:
            return 0

        best = 0
        for edge_id in vertex_to_edges.get(vertex_id, ()):  # no roads incident here
            if edge_id in used_edges:
                continue
            edge = board.edges[edge_id]
            next_vertex_id = edge.v2 if edge.v1 == vertex_id else edge.v1
            candidate = 1 + dfs(next_vertex_id, used_edges | {edge_id}, edge_id)
            if candidate > best:
                best = candidate
        return best

    longest = 0
    start_vertices = {board.edges[edge_id].v1 for edge_id in player_edge_ids} | {
        board.edges[edge_id].v2 for edge_id in player_edge_ids
    }
    for vertex_id in start_vertices:
        longest = max(longest, dfs(vertex_id, frozenset(), None))
    return longest
