from __future__ import annotations

from catan.services.board_factory import BoardFactory


def test_standard_topology_sizes() -> None:
    board = BoardFactory.create_standard_board()
    assert len(board.tiles) == 19
    assert len(board.vertices) == 54
    assert len(board.edges) == 72
    assert len(board.ports) == 9


def test_vertex_invariants() -> None:
    board = BoardFactory.create_standard_board()
    for vertex in board.vertices.values():
        assert len(vertex.adjacent_vertex_ids) in {2, 3}
        assert len(vertex.incident_edge_ids) in {2, 3}
        assert len(vertex.adjacent_tile_ids) in {1, 2, 3}


def test_edge_invariants() -> None:
    board = BoardFactory.create_standard_board()
    for edge in board.edges.values():
        assert edge.v1 != edge.v2
        assert len(edge.adjacent_tile_ids) in {1, 2}


def test_tile_invariants() -> None:
    board = BoardFactory.create_standard_board()
    for tile in board.tiles.values():
        assert len(tile.vertex_ids) == 6
        assert len(tile.edge_ids) == 6


def test_standard_topology_matches_expected_counts() -> None:
    board = BoardFactory.create_standard_board()
    assert (
        sum(1 for edge in board.edges.values() if len(edge.adjacent_tile_ids) == 1)
        == 30
    )
    assert (
        sum(
            1 for vertex in board.vertices.values() if len(vertex.adjacent_tile_ids) < 3
        )
        == 30
    )
