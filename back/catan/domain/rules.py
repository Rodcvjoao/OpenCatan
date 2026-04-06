from __future__ import annotations

from dataclasses import dataclass

from .enums import DevelopmentCardType, PortType, ResourceType


@dataclass
class RuleEngine:
    def validate_road_placement(
        self, game: object, player_id: int, edge_id: int, setup_phase: bool = False
    ) -> bool:
        return game.board.can_place_road(
            player_id=player_id, edge_id=edge_id, setup_phase=setup_phase
        )

    def validate_settlement_placement(
        self,
        game: object,
        player_id: int,
        vertex_id: int,
        setup_phase: bool = False,
    ) -> bool:
        return game.board.can_place_settlement(
            player_id=player_id, vertex_id=vertex_id, setup_phase=setup_phase
        )

    def validate_city_upgrade(
        self, game: object, player_id: int, vertex_id: int
    ) -> bool:
        return game.board.can_upgrade_to_city(player_id=player_id, vertex_id=vertex_id)

    def validate_bank_trade(
        self,
        game: object,
        player_id: int,
        give: dict[ResourceType, int],
        receive: dict[ResourceType, int],
    ) -> bool:
        if len(give) != 1 or len(receive) != 1:
            return False

        give_resource, give_amount = next(iter(give.items()))
        receive_resource, receive_amount = next(iter(receive.items()))

        if give_resource == receive_resource:
            return False
        if give_amount <= 0 or receive_amount <= 0:
            return False

        player = game.player_by_id(player_id)
        if player.resources.get(give_resource, 0) < give_amount:
            return False
        if not game.bank.can_pay(receive_resource, receive_amount):
            return False

        ratio = self._best_trade_ratio(game, player_id, give_resource)
        return give_amount == ratio * receive_amount

    def validate_dev_card_play(
        self,
        game: object,
        player_id: int,
        card_type: DevelopmentCardType,
    ) -> bool:
        player = game.player_by_id(player_id)
        return card_type in player.dev_cards_hand

    def discard_required(self, player: object) -> bool:
        return player.resource_count() > 7

    def robber_victims(
        self, game: object, tile_id: int, acting_player_id: int | None = None
    ) -> list[int]:
        victims: set[int] = set()
        tile = game.board.tiles[tile_id]
        for vertex_id in tile.vertex_ids:
            owner_id = game.board.vertices[vertex_id].owner_id()
            if owner_id is None:
                continue
            if acting_player_id is not None and owner_id == acting_player_id:
                continue
            victims.add(owner_id)
        return sorted(victims)

    def _best_trade_ratio(
        self, game: object, player_id: int, give_resource: ResourceType
    ) -> int:
        player = game.player_by_id(player_id)
        ratios = [4]
        owned_vertices = player.settlement_vertex_ids | player.city_vertex_ids
        for vertex_id in owned_vertices:
            port_id = game.board.vertices[vertex_id].port_id
            if port_id is None:
                continue
            port = game.board.ports[port_id]
            if port.port_type == PortType.THREE_TO_ONE:
                ratios.append(3)
            elif _resource_port_type(give_resource) == port.port_type:
                ratios.append(2)
        return min(ratios)


def _resource_port_type(resource: ResourceType) -> PortType:
    mapping = {
        ResourceType.BRICK: PortType.BRICK,
        ResourceType.LUMBER: PortType.LUMBER,
        ResourceType.WOOL: PortType.WOOL,
        ResourceType.GRAIN: PortType.GRAIN,
        ResourceType.ORE: PortType.ORE,
    }
    if resource not in mapping:
        raise ValueError("Desert cannot be traded")
    return mapping[resource]
