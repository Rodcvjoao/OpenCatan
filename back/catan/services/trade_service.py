from __future__ import annotations

from catan.domain.enums import ResourceType


class TradeService:
    @staticmethod
    def execute_bank_trade(
        game: object,
        player_id: int,
        give: dict[ResourceType, int],
        receive: dict[ResourceType, int],
    ) -> None:
        give_resource, give_amount = next(iter(give.items()))
        receive_resource, receive_amount = next(iter(receive.items()))

        player = game.player_by_id(player_id)
        player.remove_resource(give_resource, give_amount)
        game.bank.receive(give_resource, give_amount)

        game.bank.pay(receive_resource, receive_amount)
        player.add_resource(receive_resource, receive_amount)
