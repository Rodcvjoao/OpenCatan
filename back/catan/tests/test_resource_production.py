from __future__ import annotations

from catan.domain.building import City
from catan.domain.enums import ResourceType
from catan.services.board_factory import BoardFactory


def test_settlement_produces_one_resource() -> None:
    resource_layout = [
        ResourceType.DESERT,
        ResourceType.BRICK,
        ResourceType.BRICK,
        ResourceType.BRICK,
        ResourceType.LUMBER,
        ResourceType.LUMBER,
        ResourceType.LUMBER,
        ResourceType.LUMBER,
        ResourceType.WOOL,
        ResourceType.WOOL,
        ResourceType.WOOL,
        ResourceType.WOOL,
        ResourceType.GRAIN,
        ResourceType.GRAIN,
        ResourceType.GRAIN,
        ResourceType.GRAIN,
        ResourceType.ORE,
        ResourceType.ORE,
        ResourceType.ORE,
    ]
    token_layout = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12]
    board = BoardFactory.create_standard_board(
        resource_layout=resource_layout, token_layout=token_layout
    )

    board.place_settlement(player_id=1, vertex_id=6)
    production = board.produce_resources(3)
    assert production == {1: {ResourceType.BRICK: 1}}


def test_city_produces_two_resources() -> None:
    resource_layout = [
        ResourceType.DESERT,
        ResourceType.BRICK,
        ResourceType.BRICK,
        ResourceType.BRICK,
        ResourceType.LUMBER,
        ResourceType.LUMBER,
        ResourceType.LUMBER,
        ResourceType.LUMBER,
        ResourceType.WOOL,
        ResourceType.WOOL,
        ResourceType.WOOL,
        ResourceType.WOOL,
        ResourceType.GRAIN,
        ResourceType.GRAIN,
        ResourceType.GRAIN,
        ResourceType.GRAIN,
        ResourceType.ORE,
        ResourceType.ORE,
        ResourceType.ORE,
    ]
    token_layout = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12]
    board = BoardFactory.create_standard_board(
        resource_layout=resource_layout, token_layout=token_layout
    )

    board.place_settlement(player_id=2, vertex_id=6)
    board.vertices[6].building = City(owner_id=2)
    production = board.produce_resources(3)
    assert production == {2: {ResourceType.BRICK: 2}}


def test_robber_blocks_production_on_tile() -> None:
    resource_layout = [
        ResourceType.DESERT,
        ResourceType.BRICK,
        ResourceType.BRICK,
        ResourceType.BRICK,
        ResourceType.LUMBER,
        ResourceType.LUMBER,
        ResourceType.LUMBER,
        ResourceType.LUMBER,
        ResourceType.WOOL,
        ResourceType.WOOL,
        ResourceType.WOOL,
        ResourceType.WOOL,
        ResourceType.GRAIN,
        ResourceType.GRAIN,
        ResourceType.GRAIN,
        ResourceType.GRAIN,
        ResourceType.ORE,
        ResourceType.ORE,
        ResourceType.ORE,
    ]
    token_layout = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12]
    board = BoardFactory.create_standard_board(
        resource_layout=resource_layout, token_layout=token_layout
    )

    board.place_settlement(player_id=1, vertex_id=6)
    board.move_robber(tile_id=2)
    production = board.produce_resources(3)
    assert production == {}
