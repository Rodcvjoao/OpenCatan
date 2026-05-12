from __future__ import annotations

from collections import Counter
from copy import deepcopy
from dataclasses import dataclass, field

from catan.services.board_factory import BoardFactory
from catan.services.robber_service import RobberService
from catan.services.trade_service import TradeService

from .achievements import AchievementManager
from .bank import Bank
from .board import Board
from .development import DevelopmentDeck
from .dice import Dice
from .enums import DevelopmentCardType, GamePhase, ResourceType, TurnPhase
from .player import Player
from .rules import RuleEngine
from .trade import TradeOffer
from .turn_manager import TurnManager

ROAD_COST = {ResourceType.BRICK: 1, ResourceType.LUMBER: 1}
SETTLEMENT_COST = {
    ResourceType.BRICK: 1,
    ResourceType.LUMBER: 1,
    ResourceType.WOOL: 1,
    ResourceType.GRAIN: 1,
}
CITY_COST = {ResourceType.GRAIN: 2, ResourceType.ORE: 3}
DEV_CARD_COST = {ResourceType.WOOL: 1, ResourceType.GRAIN: 1, ResourceType.ORE: 1}

MAX_ROADS = 15
MAX_SETTLEMENTS = 5
MAX_CITIES = 4


@dataclass
class CatanGame:
    board: Board
    players: list[Player]
    bank: Bank = field(default_factory=Bank.default)
    dev_deck: DevelopmentDeck = field(default_factory=DevelopmentDeck.default)
    turn_manager: TurnManager = field(default_factory=TurnManager)
    rules: RuleEngine = field(default_factory=RuleEngine)
    achievements: AchievementManager = field(default_factory=AchievementManager)
    dice: Dice = field(default_factory=Dice)
    phase: GamePhase = GamePhase.SETUP_1
    current_player_index: int = 0
    last_roll: int | None = None
    last_roll_dice: tuple[int, int] | None = None

    setup_round: int = 1
    initial_player_order: list[int] = field(default_factory=list)
    setup_order: list[int] = field(default_factory=list)
    setup_index: int = 0
    pending_setup_road_player_id: int | None = None
    first_setup_settlements: set[int] = field(default_factory=set)

    rolled_this_turn: bool = False
    robber_move_required: bool = False
    pending_discards: dict[int, int] = field(default_factory=dict)
    played_non_vp_dev_this_turn: bool = False
    new_dev_cards_this_turn: list[DevelopmentCardType] = field(default_factory=list)

    pending_trade_offer: TradeOffer | None = None
    inactive_player_ids: set[int] = field(default_factory=set)
    match_host_id: int | None = None

    @classmethod
    def create(cls, players: list[Player]) -> "CatanGame":
        game = cls(board=BoardFactory.create_standard_board(), players=players)
        game.setup()
        return game

    def setup(self) -> None:
        self.phase = GamePhase.SETUP_1
        self.setup_round = 1
        self.initial_player_order = [player.id for player in self.players]
        self.setup_order = list(self.initial_player_order)
        self.setup_index = 0
        self.pending_setup_road_player_id = None
        self.first_setup_settlements.clear()

        self.current_player_index = 0
        self.turn_manager.turn_number = 1
        self.turn_manager.turn_phase = TurnPhase.BUILD
        self.last_roll = None
        self.last_roll_dice = None

        self.rolled_this_turn = False
        self.robber_move_required = False
        self.pending_discards.clear()
        self.played_non_vp_dev_this_turn = False
        self.new_dev_cards_this_turn.clear()
        self.pending_trade_offer = None
        self.inactive_player_ids.clear()
        self.match_host_id = self.players[0].id if self.players else None

    def player_by_id(self, player_id: int) -> Player:
        for player in self.players:
            if player.id == player_id:
                return player
        raise ValueError(f"Unknown player id {player_id}")

    def is_active_player(self, player_id: int) -> bool:
        return player_id not in self.inactive_player_ids

    def active_player_ids(self) -> list[int]:
        return [player.id for player in self.players if self.is_active_player(player.id)]

    def active_player_count(self) -> int:
        return len(self.active_player_ids())

    def _ensure_current_player_active(self) -> None:
        if not self.players:
            return
        if self.phase == GamePhase.FINISHED:
            return
        if self.is_active_player(self.players[self.current_player_index].id):
            return
        self.current_player_index = self._next_active_player_index(
            self.current_player_index
        )

    def _next_active_player_index(self, start_index: int) -> int:
        if not self.players:
            raise ValueError("No players")
        if self.active_player_count() == 0:
            raise ValueError("No active players")
        idx = start_index
        for _ in range(len(self.players)):
            idx = (idx + 1) % len(self.players)
            if self.is_active_player(self.players[idx].id):
                return idx
        raise ValueError("No active players")

    def _pick_new_host_id(self) -> int | None:
        order = self.initial_player_order or [player.id for player in self.players]
        for player_id in order:
            if self.is_active_player(player_id):
                return player_id
        return None

    def _setup_required_count(self) -> int:
        return 1 if self.phase == GamePhase.SETUP_1 else 2

    def _setup_counts(self, player_id: int) -> tuple[int, int]:
        player = self.player_by_id(player_id)
        settlements = len(player.settlement_vertex_ids) + len(player.city_vertex_ids)
        return settlements, len(player.road_ids)

    def _has_completed_setup_round(self, player_id: int) -> bool:
        required = self._setup_required_count()
        settlements, roads = self._setup_counts(player_id)
        return settlements >= required and roads >= required

    def _needs_setup_road_only(self, player_id: int) -> bool:
        required = self._setup_required_count()
        settlements, roads = self._setup_counts(player_id)
        return settlements >= required and roads < required

    def _setup_round_order(self) -> list[int]:
        if self.phase == GamePhase.SETUP_2:
            return list(reversed(self.initial_player_order))
        return list(self.initial_player_order)

    def _active_players_missing_setup_round(self) -> list[int]:
        return [
            player_id
            for player_id in self._setup_round_order()
            if self.is_active_player(player_id)
            and not self._has_completed_setup_round(player_id)
        ]

    def current_player(self) -> Player:
        self._ensure_current_player_active()
        return self.players[self.current_player_index]

    def is_current_player(self, player_id: int) -> bool:
        if not self.is_active_player(player_id):
            return False
        return self.current_player().id == player_id

    def legal_actions_for_player(self, player_id: int) -> set[str]:
        actions: set[str] = set()
        if self.phase == GamePhase.FINISHED:
            return actions

        if not self.is_active_player(player_id):
            return actions

        if player_id in self.pending_discards:
            actions.add("discard_resources")
            return actions

        if self.phase in {GamePhase.SETUP_1, GamePhase.SETUP_2}:
            if not self.is_current_player(player_id):
                return actions
            if self.pending_setup_road_player_id is None:
                actions.add("place_setup_settlement")
            elif self.pending_setup_road_player_id == player_id:
                actions.add("place_setup_road")
            return actions

        if self.pending_trade_offer is not None:
            if self.pending_trade_offer.to_player_id == player_id:
                actions.update({"respond_trade_offer"})
            if self.pending_trade_offer.from_player_id == player_id:
                actions.update({"cancel_trade_offer"})

        if not self.is_current_player(player_id):
            return actions

        if self.robber_move_required:
            actions.add("move_robber")
            return actions

        if not self.rolled_this_turn:
            actions.add("roll_dice")
            return actions

        actions.update(
            {
                "build_road",
                "build_settlement",
                "build_city",
                "buy_development_card",
                "play_development_card",
                "trade_bank",
                "end_turn",
            }
        )
        if self.pending_trade_offer is None:
            actions.add("propose_trade_offer")
        return actions

    def roll_dice(self) -> int:
        if self.phase != GamePhase.MAIN:
            raise ValueError("Dice can only be rolled in main phase")
        if self.pending_discards:
            raise ValueError("Resolve pending discards before rolling")
        if self.robber_move_required:
            raise ValueError("Move robber before rolling again")
        if self.rolled_this_turn:
            raise ValueError("Dice already rolled this turn")

        roll = self.dice.roll()
        self.last_roll = roll
        self.last_roll_dice = self.dice.last_values
        self.rolled_this_turn = True
        self.turn_manager.turn_phase = TurnPhase.TRADE

        if roll == 7:
            self.pending_discards = self._compute_required_discards()
            self.robber_move_required = True
            return roll

        production = self.board.produce_resources(roll)
        self._apply_production(production)
        return roll

    def discard_resources(
        self, player_id: int, resources: dict[ResourceType, int]
    ) -> None:
        if player_id not in self.pending_discards:
            raise ValueError("Player is not required to discard")

        total = sum(resources.values())
        expected = self.pending_discards[player_id]
        if total != expected:
            raise ValueError(f"Must discard exactly {expected} resources")

        player = self.player_by_id(player_id)
        if not player.can_afford(resources):
            raise ValueError("Player lacks resources to discard")

        for resource, amount in resources.items():
            player.remove_resource(resource, amount)
            self.bank.receive(resource, amount)

        del self.pending_discards[player_id]

    def end_turn(self) -> None:
        if self.phase != GamePhase.MAIN:
            raise ValueError("Cannot end turn outside main phase")
        if not self.rolled_this_turn:
            raise ValueError("Must roll dice before ending turn")
        if self.robber_move_required:
            raise ValueError("Must move robber before ending turn")
        if self.pending_discards:
            raise ValueError("Pending discards must be resolved")
        if self.pending_trade_offer is not None:
            raise ValueError("Resolve pending trade offer before ending turn")

        self.current_player_index = self._next_active_player_index(
            self.current_player_index
        )
        self.turn_manager.turn_number += 1
        self.turn_manager.turn_phase = TurnPhase.ROLL
        self.last_roll = None
        self.last_roll_dice = None
        self.rolled_this_turn = False
        self.robber_move_required = False
        self.pending_discards.clear()
        self.played_non_vp_dev_this_turn = False
        self.new_dev_cards_this_turn.clear()

    def leave_game(self, player_id: int) -> Player | None:
        if self.phase == GamePhase.FINISHED:
            return None
        if not self.is_active_player(player_id):
            return None

        was_current = self.current_player().id == player_id
        self.inactive_player_ids.add(player_id)
        self.pending_discards.pop(player_id, None)
        if (
            self.pending_trade_offer is not None
            and (
                self.pending_trade_offer.from_player_id == player_id
                or self.pending_trade_offer.to_player_id == player_id
            )
        ):
            self.pending_trade_offer = None
        if self.pending_setup_road_player_id == player_id:
            self.pending_setup_road_player_id = None

        if self.match_host_id == player_id:
            self.match_host_id = self._pick_new_host_id()

        winner = self._finish_game_due_to_last_active()
        if winner is not None:
            return winner

        if was_current:
            self._force_end_turn_after_leave(player_id)
        return None

    def rejoin_game(self, player_id: int) -> None:
        if self.phase == GamePhase.FINISHED:
            raise ValueError("Game is finished")
        if self.is_active_player(player_id):
            return
        self.inactive_player_ids.discard(player_id)
        self._queue_rejoined_setup_player(player_id)
        if self.match_host_id is None or not self.is_active_player(self.match_host_id):
            self.match_host_id = self._pick_new_host_id()
        self._ensure_current_player_active()

    def _finish_game_due_to_last_active(self) -> Player | None:
        active_ids = self.active_player_ids()
        if len(active_ids) > 1:
            return None
        self.phase = GamePhase.FINISHED
        if not active_ids:
            return None
        return self.player_by_id(active_ids[0])

    def _force_end_turn_after_leave(self, player_id: int) -> None:
        if self.phase in {GamePhase.SETUP_1, GamePhase.SETUP_2}:
            if (
                self.setup_index < len(self.setup_order)
                and self.setup_order[self.setup_index] == player_id
            ):
                self.setup_index += 1
            self._advance_to_next_setup_player()
            return

        if self.phase != GamePhase.MAIN:
            return
        self.current_player_index = self._next_active_player_index(
            self.current_player_index
        )
        self.turn_manager.turn_number += 1
        self.turn_manager.turn_phase = TurnPhase.ROLL
        self.last_roll = None
        self.last_roll_dice = None
        self.rolled_this_turn = False
        self.robber_move_required = False
        self.pending_discards.clear()
        self.pending_trade_offer = None
        self.played_non_vp_dev_this_turn = False
        self.new_dev_cards_this_turn.clear()

    def build_road(
        self,
        player_id: int,
        edge_id: int,
        setup_phase: bool = False,
        pay_cost: bool = True,
    ) -> None:
        if not self._can_build_now(player_id, setup_phase=setup_phase):
            raise ValueError("Cannot build road right now")
        if not self.rules.validate_road_placement(
            self, player_id, edge_id, setup_phase=setup_phase
        ):
            raise ValueError("Invalid road placement")

        player = self.player_by_id(player_id)
        if len(player.road_ids) >= MAX_ROADS:
            raise ValueError("Road limit reached")

        if pay_cost:
            self._pay_cost(player, ROAD_COST)

        self.board.place_road(player_id, edge_id)
        player.road_ids.add(edge_id)
        self._update_longest_road()

        if setup_phase and self.pending_setup_road_player_id == player_id:
            self.pending_setup_road_player_id = None
            self._advance_setup_after_road(player_id)

    def build_settlement(
        self,
        player_id: int,
        vertex_id: int,
        setup_phase: bool = False,
        pay_cost: bool = True,
    ) -> None:
        if not self._can_build_now(player_id, setup_phase=setup_phase):
            raise ValueError("Cannot build settlement right now")
        if not self.rules.validate_settlement_placement(
            self, player_id, vertex_id, setup_phase=setup_phase
        ):
            raise ValueError("Invalid settlement placement")

        player = self.player_by_id(player_id)
        if len(player.settlement_vertex_ids) >= MAX_SETTLEMENTS:
            raise ValueError("Settlement limit reached")

        if pay_cost:
            self._pay_cost(player, SETTLEMENT_COST)

        self.board.place_settlement(player_id, vertex_id)
        player.settlement_vertex_ids.add(vertex_id)

        if setup_phase:
            self.pending_setup_road_player_id = player_id
            if self.setup_round == 1:
                self.first_setup_settlements.add(vertex_id)
            else:
                self._grant_second_setup_resources(player_id, vertex_id)

    def build_city(self, player_id: int, vertex_id: int) -> None:
        if not self._can_build_now(player_id, setup_phase=False):
            raise ValueError("Cannot build city right now")
        if not self.rules.validate_city_upgrade(self, player_id, vertex_id):
            raise ValueError("Invalid city upgrade")

        player = self.player_by_id(player_id)
        if len(player.city_vertex_ids) >= MAX_CITIES:
            raise ValueError("City limit reached")

        self._pay_cost(player, CITY_COST)
        self.board.place_city(player_id, vertex_id)
        player.settlement_vertex_ids.discard(vertex_id)
        player.city_vertex_ids.add(vertex_id)

    def buy_development_card(self, player_id: int) -> DevelopmentCardType:
        if not self._can_build_now(player_id, setup_phase=False):
            raise ValueError("Cannot buy development card right now")

        player = self.player_by_id(player_id)
        self._pay_cost(player, DEV_CARD_COST)
        card = self.dev_deck.draw()
        player.dev_cards_hand.append(card)
        self.bank.draw_dev_card(card)
        self.new_dev_cards_this_turn.append(card)
        return card

    def play_development_card(
        self,
        player_id: int,
        card_type: DevelopmentCardType,
        args: dict | None = None,
    ) -> None:
        if self.phase != GamePhase.MAIN:
            raise ValueError("Cannot play development cards during setup")
        if not self.rolled_this_turn:
            raise ValueError("Must roll before playing development cards")
        if self.robber_move_required or self.pending_discards:
            raise ValueError("Resolve robber flow before playing development cards")

        if card_type == DevelopmentCardType.VICTORY_POINT:
            raise ValueError("Victory point cards are not played")
        if self.played_non_vp_dev_this_turn:
            raise ValueError(
                "Only one non-victory development card can be played per turn"
            )

        if not self.rules.validate_dev_card_play(self, player_id, card_type):
            raise ValueError("Cannot play this development card")

        payload = args or {}
        self._validate_development_card_effect(player_id, card_type, payload)

        player = self.player_by_id(player_id)
        player.dev_cards_hand.remove(card_type)
        self.played_non_vp_dev_this_turn = True

        if card_type == DevelopmentCardType.KNIGHT:
            player.played_knights += 1
            self.move_robber(
                player_id=player_id,
                tile_id=int(payload["tile_id"]),
                victim_id=payload.get("victim_id"),
                from_robber_roll=False,
            )
            self.achievements.update_largest_army(self.players)
        elif card_type == DevelopmentCardType.ROAD_BUILDING:
            edges = payload.get("edge_ids", [])
            self.build_road(player_id, int(edges[0]), pay_cost=False)
            self.build_road(player_id, int(edges[1]), pay_cost=False)
        elif card_type == DevelopmentCardType.YEAR_OF_PLENTY:
            resources = payload.get("resources", [])
            for resource in resources:
                self.bank.pay(resource, 1)
                player.add_resource(resource, 1)
        elif card_type == DevelopmentCardType.MONOPOLY:
            resource = payload.get("resource")
            total = 0
            for other in self.players:
                if other.id == player_id:
                    continue
                amount = other.resources.get(resource, 0)
                if amount > 0:
                    other.remove_resource(resource, amount)
                    total += amount
            if total > 0:
                player.add_resource(resource, total)

    def _validate_development_card_effect(
        self,
        player_id: int,
        card_type: DevelopmentCardType,
        payload: dict,
    ) -> None:
        if card_type == DevelopmentCardType.KNIGHT:
            tile_id = payload.get("tile_id")
            if tile_id is None:
                raise ValueError("KNIGHT requires a tile id")
            tile_id = int(tile_id)
            if tile_id not in self.board.tiles:
                raise ValueError("Invalid tile id")
            if self.board.robber is not None and self.board.robber.tile_id == tile_id:
                raise ValueError("Robber must be moved to a different tile")
            victim_id = payload.get("victim_id")
            if victim_id is not None:
                victims = self.rules.robber_victims(
                    self,
                    tile_id,
                    acting_player_id=player_id,
                )
                if int(victim_id) not in victims:
                    raise ValueError("Invalid robber victim")
        elif card_type == DevelopmentCardType.ROAD_BUILDING:
            edges = payload.get("edge_ids", [])
            if len(edges) != 2:
                raise ValueError("ROAD_BUILDING requires two edge ids")
            if int(edges[0]) == int(edges[1]):
                raise ValueError("ROAD_BUILDING requires two different edge ids")
            if (
                int(edges[0]) not in self.board.edges
                or int(edges[1]) not in self.board.edges
            ):
                raise ValueError("Invalid edge id")
            candidate = deepcopy(self)
            candidate.build_road(player_id, int(edges[0]), pay_cost=False)
            candidate.build_road(player_id, int(edges[1]), pay_cost=False)
        elif card_type == DevelopmentCardType.YEAR_OF_PLENTY:
            resources = payload.get("resources", [])
            if len(resources) != 2:
                raise ValueError("YEAR_OF_PLENTY requires two resources")
            for resource, amount in Counter(resources).items():
                if not self.bank.can_pay(resource, amount):
                    raise ValueError("Bank cannot satisfy YEAR_OF_PLENTY")
        elif card_type == DevelopmentCardType.MONOPOLY:
            resource = payload.get("resource")
            if resource is None:
                raise ValueError("MONOPOLY requires a resource")

    def trade_with_bank(
        self,
        player_id: int,
        give: dict[ResourceType, int],
        receive: dict[ResourceType, int],
    ) -> None:
        self._require_main_turn_action(player_id)
        if not self.rules.validate_bank_trade(self, player_id, give, receive):
            raise ValueError("Invalid bank trade")
        TradeService.execute_bank_trade(self, player_id, give, receive)

    def propose_trade_offer(
        self,
        from_player_id: int,
        to_player_id: int,
        give: dict[ResourceType, int],
        receive: dict[ResourceType, int],
    ) -> TradeOffer:
        if not self.is_active_player(from_player_id):
            raise ValueError("Inactive players cannot trade")
        if not self.is_active_player(to_player_id):
            raise ValueError("Cannot trade with inactive player")
        self._require_main_turn_action(from_player_id)
        if self.pending_trade_offer is not None:
            raise ValueError("Another trade offer is already pending")
        if from_player_id == to_player_id:
            raise ValueError("Cannot trade with self")

        from_player = self.player_by_id(from_player_id)
        if not from_player.can_afford(give):
            raise ValueError("Offering player lacks resources")

        offer = TradeOffer.create(
            from_player_id=from_player_id,
            to_player_id=to_player_id,
            give=give,
            receive=receive,
        )
        self.pending_trade_offer = offer
        return offer

    def respond_trade_offer(self, player_id: int, offer_id: str, accept: bool) -> bool:
        if self.pending_trade_offer is None:
            raise ValueError("No pending trade offer")
        offer = self.pending_trade_offer
        if offer.id != offer_id:
            raise ValueError("Unknown trade offer id")
        if offer.to_player_id != player_id:
            raise ValueError("Only target player can respond to this offer")
        if not self.is_active_player(player_id):
            raise ValueError("Inactive players cannot respond to trades")

        if accept:
            self.trade_with_player(offer)
        self.pending_trade_offer = None
        return accept

    def cancel_trade_offer(self, player_id: int, offer_id: str) -> None:
        if self.pending_trade_offer is None:
            raise ValueError("No pending trade offer")
        if self.pending_trade_offer.id != offer_id:
            raise ValueError("Unknown trade offer id")
        if self.pending_trade_offer.from_player_id != player_id:
            raise ValueError("Only proposer can cancel this offer")
        self.pending_trade_offer = None

    def trade_with_player(self, offer: TradeOffer) -> None:
        if not self.is_active_player(offer.from_player_id):
            raise ValueError("Inactive players cannot trade")
        if not self.is_active_player(offer.to_player_id):
            raise ValueError("Inactive players cannot trade")
        giver = self.player_by_id(offer.from_player_id)
        receiver = self.player_by_id(offer.to_player_id)
        if not giver.can_afford(offer.give):
            raise ValueError("Offering player lacks resources")
        if not receiver.can_afford(offer.receive):
            raise ValueError("Receiving player lacks resources")

        for resource, amount in offer.give.items():
            giver.remove_resource(resource, amount)
            receiver.add_resource(resource, amount)
        for resource, amount in offer.receive.items():
            receiver.remove_resource(resource, amount)
            giver.add_resource(resource, amount)

    def move_robber(
        self,
        player_id: int,
        tile_id: int,
        victim_id: int | None = None,
        *,
        from_robber_roll: bool = True,
    ) -> ResourceType | None:
        if self.phase == GamePhase.FINISHED:
            raise ValueError("Game is finished")
        if self.board.robber is not None and self.board.robber.tile_id == tile_id:
            raise ValueError("Robber must be moved to a different tile")
        if from_robber_roll:
            if self.phase != GamePhase.MAIN:
                raise ValueError("Action only available in main phase")
            if not self.is_current_player(player_id):
                raise ValueError("Only current player can perform this action")
            if not self.rolled_this_turn:
                raise ValueError("Must roll dice first")
            if not self.robber_move_required:
                raise ValueError("Robber move not required")
            if self.pending_discards:
                raise ValueError("All required discards must be resolved first")

        stolen = RobberService.move_and_rob(
            self, player_id, tile_id, victim_id=victim_id
        )
        if from_robber_roll:
            self.robber_move_required = False
        return stolen

    def check_winner(self) -> Player | None:
        if self.phase == GamePhase.FINISHED:
            return None
        for player in self.players:
            if not self.is_active_player(player.id):
                continue
            if player.victory_points() >= 10:
                self.phase = GamePhase.FINISHED
                return player
        return None

    def _pay_cost(self, player: Player, cost: dict[ResourceType, int]) -> None:
        if not player.can_afford(cost):
            raise ValueError("Player cannot afford cost")
        for resource, amount in cost.items():
            player.remove_resource(resource, amount)
            self.bank.receive(resource, amount)

    def _update_longest_road(self) -> None:
        lengths = {
            player.id: self.board.compute_longest_road(player.id)
            for player in self.players
        }
        self.achievements.update_longest_road(lengths, self.players)

    def _can_build_now(self, player_id: int, *, setup_phase: bool) -> bool:
        if self.phase == GamePhase.FINISHED:
            return False
        if not self.is_active_player(player_id):
            return False
        if setup_phase:
            return self.phase in {
                GamePhase.SETUP_1,
                GamePhase.SETUP_2,
            } and self.is_current_player(player_id)
        if self.phase != GamePhase.MAIN:
            return False
        if not self.is_current_player(player_id):
            return False
        if not self.rolled_this_turn:
            return False
        if self.robber_move_required or self.pending_discards:
            return False
        return True

    def _require_main_turn_action(self, player_id: int) -> None:
        if self.phase != GamePhase.MAIN:
            raise ValueError("Action only available in main phase")
        if not self.is_active_player(player_id):
            raise ValueError("Inactive players cannot act")
        if not self.is_current_player(player_id):
            raise ValueError("Only current player can perform this action")
        if not self.rolled_this_turn:
            raise ValueError("Must roll dice first")
        if self.robber_move_required:
            raise ValueError("Must move robber first")
        if self.pending_discards:
            raise ValueError("Pending discards must be resolved")

    def _compute_required_discards(self) -> dict[int, int]:
        required: dict[int, int] = {}
        for player in self.players:
            if not self.is_active_player(player.id):
                continue
            if self.rules.discard_required(player):
                required[player.id] = player.resource_count() // 2
        return required

    def _apply_production(self, production: dict[int, dict[ResourceType, int]]) -> None:
        active_production = {
            player_id: bundle
            for player_id, bundle in production.items()
            if self.is_active_player(player_id)
        }
        totals: dict[ResourceType, int] = {}
        for bundle in active_production.values():
            for resource, amount in bundle.items():
                totals[resource] = totals.get(resource, 0) + amount

        payable_resources = {
            resource
            for resource, total in totals.items()
            if self.bank.can_pay(resource, total)
        }

        for player_id, bundle in active_production.items():
            player = self.player_by_id(player_id)
            for resource, amount in bundle.items():
                if resource not in payable_resources:
                    continue
                self.bank.pay(resource, amount)
                player.add_resource(resource, amount)

    def _advance_setup_after_road(self, player_id: int) -> None:
        expected_player = self.setup_order[self.setup_index]
        if player_id != expected_player:
            raise ValueError("Unexpected setup player turn")

        self.setup_index += 1
        self._advance_to_next_setup_player()

    def _queue_rejoined_setup_player(self, player_id: int) -> None:
        if self.phase not in {GamePhase.SETUP_1, GamePhase.SETUP_2}:
            return
        if self._has_completed_setup_round(player_id):
            return
        if player_id in self.setup_order[self.setup_index :]:
            return
        insert_at = min(self.setup_index + 1, len(self.setup_order))
        self.setup_order.insert(insert_at, player_id)

    def _advance_to_next_setup_player(self) -> None:
        while self.phase in {GamePhase.SETUP_1, GamePhase.SETUP_2}:
            while self.setup_index < len(self.setup_order):
                next_player_id = self.setup_order[self.setup_index]
                if self.is_active_player(
                    next_player_id
                ) and not self._has_completed_setup_round(next_player_id):
                    self.current_player_index = self._player_index(next_player_id)
                    self.pending_setup_road_player_id = (
                        next_player_id
                        if self._needs_setup_road_only(next_player_id)
                        else None
                    )
                    return
                self.setup_index += 1

            missing_players = self._active_players_missing_setup_round()
            if missing_players:
                self.setup_order.extend(missing_players)
                continue

            if self.phase == GamePhase.SETUP_1:
                self._start_second_setup_round()
                continue

            self._enter_main_phase_after_setup()
            return

    def _start_second_setup_round(self) -> None:
        self.phase = GamePhase.SETUP_2
        self.setup_round = 2
        self.setup_order = self._setup_round_order()
        self.setup_index = 0
        self.pending_setup_road_player_id = None

    def _enter_main_phase_after_setup(self) -> None:
        self.phase = GamePhase.MAIN
        self.turn_manager.turn_phase = TurnPhase.ROLL
        self.turn_manager.turn_number = 1
        self.setup_round = 2
        self.setup_index = 0
        self.pending_setup_road_player_id = None
        first_player_id = self._pick_new_host_id()
        if first_player_id is None:
            return
        self.current_player_index = self._player_index(first_player_id)
        self.last_roll = None
        self.last_roll_dice = None
        self.rolled_this_turn = False
        self.robber_move_required = False
        self.pending_discards.clear()
        self.played_non_vp_dev_this_turn = False
        self.new_dev_cards_this_turn.clear()

    def _grant_second_setup_resources(self, player_id: int, vertex_id: int) -> None:
        player = self.player_by_id(player_id)
        for tile_id in self.board.get_vertex_tiles(vertex_id):
            tile = self.board.tiles[tile_id]
            if tile.is_desert():
                continue
            if self.bank.can_pay(tile.resource_type, 1):
                self.bank.pay(tile.resource_type, 1)
                player.add_resource(tile.resource_type, 1)

    def _player_index(self, player_id: int) -> int:
        for idx, player in enumerate(self.players):
            if player.id == player_id:
                return idx
        raise ValueError(f"Unknown player id {player_id}")
