from __future__ import annotations

from catan.services.board_factory import BoardFactory


def test_longest_road_on_straight_chain() -> None:
    board = BoardFactory.create_standard_board()
    for edge_id in (0, 1, 2, 3):
        board.place_road(player_id=1, edge_id=edge_id)
    assert board.compute_longest_road(player_id=1) == 4


def test_longest_road_on_branch_uses_best_path() -> None:
    board = BoardFactory.create_standard_board()
    for edge_id in (1, 2, 16, 17, 31):
        board.place_road(player_id=1, edge_id=edge_id)
    assert board.compute_longest_road(player_id=1) == 4


def test_enemy_building_blocks_through_vertex() -> None:
    board = BoardFactory.create_standard_board()
    for edge_id in (1, 16, 17, 31):
        board.place_road(player_id=1, edge_id=edge_id)
    board.place_settlement(player_id=2, vertex_id=14)
    assert board.compute_longest_road(player_id=1) == 2
