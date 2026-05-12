from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from threading import RLock
from typing import Any

from catan.api.schemas import CommandType
from catan.domain.enums import DevelopmentCardType, ResourceType
from catan.domain.game import CatanGame
from catan.domain.player import Player


def _default_colors() -> list[str]:
    return ["red", "blue", "white", "orange"]


def _resource_type(name: str) -> ResourceType:
    try:
        return ResourceType[name.upper()]
    except KeyError as exc:
        raise ValueError(f"Unknown resource {name}") from exc


def _development_card_type(name: str) -> DevelopmentCardType:
    try:
        return DevelopmentCardType[name.upper()]
    except KeyError as exc:
        raise ValueError(f"Unknown development card type {name}") from exc


def _resource_bundle(data: dict[str, Any]) -> dict[ResourceType, int]:
    bundle: dict[ResourceType, int] = {}
    for resource_name, amount in data.items():
        bundle[_resource_type(resource_name)] = int(amount)
    return bundle


@dataclass
class GameSession:
    game_id: str
    game: CatanGame
    player_tokens: dict[str, int]
    version: int = 1
    lock: RLock = field(default_factory=RLock)
    request_results: dict[tuple[int, str], dict[str, Any]] = field(default_factory=dict)

    def player_id_from_token(self, token: str) -> int:
        if token not in self.player_tokens:
            raise ValueError("Invalid player token")
        return self.player_tokens[token]

    def execute(
        self,
        player_token: str,
        command: CommandType,
        payload: dict[str, Any],
        request_id: str | None = None,
        expected_version: int | None = None,
    ) -> dict[str, Any]:
        with self.lock:
            player_id = self.player_id_from_token(player_token)

            if expected_version is not None and expected_version != self.version:
                return {
                    "accepted": False,
                    "version": self.version,
                    "reason": f"Version mismatch. Expected {expected_version}, current {self.version}",
                    "events": [],
                }

            if request_id:
                replay_key = (player_id, request_id)
                if replay_key in self.request_results:
                    replay = dict(self.request_results[replay_key])
                    replay["idempotent_replay"] = True
                    return replay

            events = self._apply_command(player_id, command, payload)
            self.version += 1
            result = {
                "accepted": True,
                "version": self.version,
                "events": events,
            }
            if request_id:
                self.request_results[(player_id, request_id)] = dict(result)
            return result

    def _apply_command(
        self,
        player_id: int,
        command: CommandType,
        payload: dict[str, Any],
    ) -> list[dict[str, Any]]:
        events: list[dict[str, Any]] = []

        if command == CommandType.PLACE_SETUP_SETTLEMENT:
            if not self.game.is_current_player(player_id):
                raise ValueError("Only current player can place setup settlement")
            vertex_id = int(payload["vertex_id"])
            self.game.build_settlement(
                player_id, vertex_id, setup_phase=True, pay_cost=False
            )
            events.append(
                {
                    "type": "setup_settlement_placed",
                    "player_id": player_id,
                    "vertex_id": vertex_id,
                }
            )

        elif command == CommandType.PLACE_SETUP_ROAD:
            if not self.game.is_current_player(player_id):
                raise ValueError("Only current player can place setup road")
            edge_id = int(payload["edge_id"])
            self.game.build_road(player_id, edge_id, setup_phase=True, pay_cost=False)
            events.append(
                {
                    "type": "setup_road_placed",
                    "player_id": player_id,
                    "edge_id": edge_id,
                }
            )

        elif command == CommandType.DISCARD_RESOURCES:
            resources = _resource_bundle(payload.get("resources", {}))
            self.game.discard_resources(player_id, resources)
            events.append(
                {
                    "type": "resources_discarded",
                    "player_id": player_id,
                    "total": sum(resources.values()),
                }
            )

        elif command == CommandType.ROLL_DICE:
            if not self.game.is_current_player(player_id):
                raise ValueError("Only current player can roll dice")
            roll = self.game.roll_dice()
            events.append(
                {
                    "type": "dice_rolled",
                    "player_id": player_id,
                    "value": roll,
                    "dice": (
                        None
                        if self.game.last_roll_dice is None
                        else list(self.game.last_roll_dice)
                    ),
                }
            )
            if roll == 7 and self.game.pending_discards:
                events.append(
                    {
                        "type": "discard_required",
                        "pending_discards": dict(self.game.pending_discards),
                    }
                )

        elif command == CommandType.MOVE_ROBBER:
            if not self.game.is_current_player(player_id):
                raise ValueError("Only current player can move robber")
            tile_id = int(payload["tile_id"])
            victim_id = payload.get("victim_id")
            stolen = self.game.move_robber(
                player_id=player_id,
                tile_id=tile_id,
                victim_id=int(victim_id) if victim_id is not None else None,
                from_robber_roll=True,
            )
            events.append(
                {
                    "type": "robber_moved",
                    "player_id": player_id,
                    "tile_id": tile_id,
                    "victim_id": victim_id,
                    "stolen_resource": None if stolen is None else stolen.name,
                }
            )

        elif command == CommandType.BUILD_ROAD:
            if not self.game.is_current_player(player_id):
                raise ValueError("Only current player can build road")
            edge_id = int(payload["edge_id"])
            self.game.build_road(player_id, edge_id)
            events.append(
                {"type": "road_built", "player_id": player_id, "edge_id": edge_id}
            )

        elif command == CommandType.BUILD_SETTLEMENT:
            if not self.game.is_current_player(player_id):
                raise ValueError("Only current player can build settlement")
            vertex_id = int(payload["vertex_id"])
            self.game.build_settlement(player_id, vertex_id)
            events.append(
                {
                    "type": "settlement_built",
                    "player_id": player_id,
                    "vertex_id": vertex_id,
                }
            )

        elif command == CommandType.BUILD_CITY:
            if not self.game.is_current_player(player_id):
                raise ValueError("Only current player can build city")
            vertex_id = int(payload["vertex_id"])
            self.game.build_city(player_id, vertex_id)
            events.append(
                {"type": "city_built", "player_id": player_id, "vertex_id": vertex_id}
            )

        elif command == CommandType.BUY_DEV_CARD:
            if not self.game.is_current_player(player_id):
                raise ValueError("Only current player can buy development card")
            card = self.game.buy_development_card(player_id)
            events.append(
                {
                    "type": "development_card_bought",
                    "player_id": player_id,
                    "card_type": card.name,
                }
            )

        elif command == CommandType.PLAY_DEV_CARD:
            if not self.game.is_current_player(player_id):
                raise ValueError("Only current player can play development card")
            card_type = _development_card_type(str(payload["card_type"]))
            args = payload.get("args", {})
            if "resource" in args and isinstance(args["resource"], str):
                args["resource"] = _resource_type(args["resource"])
            if "resources" in args:
                args["resources"] = [_resource_type(name) for name in args["resources"]]
            self.game.play_development_card(player_id, card_type, args=args)
            events.append(
                {
                    "type": "development_card_played",
                    "player_id": player_id,
                    "card_type": card_type.name,
                }
            )

        elif command == CommandType.TRADE_BANK:
            if not self.game.is_current_player(player_id):
                raise ValueError("Only current player can trade with bank")
            give = _resource_bundle(payload["give"])
            receive = _resource_bundle(payload["receive"])
            self.game.trade_with_bank(player_id, give, receive)
            events.append({"type": "bank_trade", "player_id": player_id})

        elif command == CommandType.PROPOSE_TRADE_OFFER:
            if not self.game.is_current_player(player_id):
                raise ValueError("Only current player can propose trade")
            give = _resource_bundle(payload["give"])
            receive = _resource_bundle(payload["receive"])
            offer = self.game.propose_trade_offer(
                from_player_id=player_id,
                to_player_id=int(payload["to_player_id"]),
                give=give,
                receive=receive,
            )
            events.append(
                {
                    "type": "trade_offer_proposed",
                    "offer_id": offer.id,
                    "from_player_id": offer.from_player_id,
                    "to_player_id": offer.to_player_id,
                }
            )

        elif command == CommandType.RESPOND_TRADE_OFFER:
            offer_id = str(payload["offer_id"])
            accept = bool(payload["accept"])
            accepted = self.game.respond_trade_offer(player_id, offer_id, accept)
            events.append(
                {
                    "type": "trade_offer_responded",
                    "offer_id": offer_id,
                    "player_id": player_id,
                    "accepted": accepted,
                }
            )

        elif command == CommandType.CANCEL_TRADE_OFFER:
            offer_id = str(payload["offer_id"])
            self.game.cancel_trade_offer(player_id, offer_id)
            events.append(
                {
                    "type": "trade_offer_cancelled",
                    "offer_id": offer_id,
                    "player_id": player_id,
                }
            )

        elif command == CommandType.END_TURN:
            if not self.game.is_current_player(player_id):
                raise ValueError("Only current player can end turn")
            self.game.end_turn()
            events.append({"type": "turn_ended", "player_id": player_id})

        elif command == CommandType.LEAVE_GAME:
            winner = self.game.leave_game(player_id)
            events.append({"type": "player_left", "player_id": player_id})
            if winner is not None:
                events.append(
                    {"type": "game_finished", "winner_player_id": winner.id}
                )

        elif command == CommandType.REJOIN_GAME:
            self.game.rejoin_game(player_id)
            events.append({"type": "player_rejoined", "player_id": player_id})

        else:
            raise ValueError(f"Unsupported command: {command}")

        winner = self.game.check_winner()
        if winner is not None:
            events.append({"type": "game_finished", "winner_player_id": winner.id})

        return events


class InMemoryGameStore:
    def __init__(self) -> None:
        self._sessions: dict[str, GameSession] = {}
        self._lock = RLock()

    def create_game(self, players_input: list[dict[str, str]]) -> GameSession:
        with self._lock:
            return self._create_game_locked(players_input)

    def get(self, game_id: str) -> GameSession:
        if game_id not in self._sessions:
            raise KeyError(game_id)
        return self._sessions[game_id]

    def _create_game_locked(self, players_input: list[dict[str, str]]) -> GameSession:
        game_id = uuid.uuid4().hex
        colors = _default_colors()
        players: list[Player] = []
        player_tokens: dict[str, int] = {}

        for idx, item in enumerate(players_input, start=1):
            name = item["name"]
            color = item.get("color") or colors[(idx - 1) % len(colors)]
            player = Player(id=idx, name=name, color=color)
            players.append(player)
            token = uuid.uuid4().hex
            player_tokens[token] = idx

        game = CatanGame.create(players)
        session = GameSession(
            game_id=game_id,
            game=game,
            player_tokens=player_tokens,
            version=1,
        )
        self._sessions[game_id] = session
        return session
