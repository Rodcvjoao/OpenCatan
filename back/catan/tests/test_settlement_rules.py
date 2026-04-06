from __future__ import annotations

from catan.services.board_factory import BoardFactory


def test_settlement_requires_distance_rule() -> None:
    board = BoardFactory.create_standard_board()
    board.place_settlement(player_id=1, vertex_id=0)
    assert not board.can_place_settlement(player_id=2, vertex_id=1, setup_phase=True)


def test_non_setup_settlement_must_connect_to_own_road() -> None:
    board = BoardFactory.create_standard_board()
    assert not board.can_place_settlement(player_id=1, vertex_id=0, setup_phase=False)
    board.place_road(player_id=1, edge_id=0)
    assert board.can_place_settlement(player_id=1, vertex_id=0, setup_phase=False)


def test_city_upgrade_requires_own_settlement() -> None:
    board = BoardFactory.create_standard_board()
    board.place_settlement(player_id=1, vertex_id=0)
    assert board.can_upgrade_to_city(player_id=1, vertex_id=0)
    assert not board.can_upgrade_to_city(player_id=2, vertex_id=0)
