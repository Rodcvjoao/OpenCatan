from __future__ import annotations

from catan.services.board_factory import BoardFactory


def test_setup_road_must_touch_own_settlement() -> None:
    board = BoardFactory.create_standard_board()
    board.place_settlement(player_id=1, vertex_id=0)
    assert board.can_place_road(player_id=1, edge_id=0, setup_phase=True)
    assert not board.can_place_road(player_id=1, edge_id=11, setup_phase=True)


def test_main_road_can_extend_from_existing_road() -> None:
    board = BoardFactory.create_standard_board()
    board.place_road(player_id=1, edge_id=0)
    assert board.can_place_road(player_id=1, edge_id=1)


def test_enemy_settlement_blocks_continuation_but_not_endpoint_build() -> None:
    board = BoardFactory.create_standard_board()
    board.place_road(player_id=1, edge_id=0)
    board.place_road(player_id=1, edge_id=1)
    board.place_settlement(player_id=2, vertex_id=2)
    assert not board.can_place_road(player_id=1, edge_id=16)
