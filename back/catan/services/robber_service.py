from __future__ import annotations

import random

from catan.domain.enums import ResourceType


class RobberService:
    @staticmethod
    def move_and_rob(
        game: object,
        player_id: int,
        tile_id: int,
        victim_id: int | None = None,
        rng: random.Random | None = None,
    ) -> ResourceType | None:
        game.board.move_robber(tile_id)
        victims = game.rules.robber_victims(game, tile_id, acting_player_id=player_id)
        if not victims:
            return None

        target_id = victim_id if victim_id in victims else victims[0]
        victim = game.player_by_id(target_id)
        stealable = [
            resource for resource, amount in victim.resources.items() if amount > 0
        ]
        if not stealable:
            return None

        stolen_resource = (rng or random).choice(stealable)
        victim.remove_resource(stolen_resource, 1)
        game.player_by_id(player_id).add_resource(stolen_resource, 1)
        return stolen_resource
