from __future__ import annotations

from dataclasses import dataclass, field

from catan.services.board_factory import BoardFactory
from catan.services.robber_service import RobberService
from catan.services.trade_service import TradeService

from .achievements import AchievementManager
from .bank import Bank
from .board import Board
from .development import DevelopmentDeck
from .dice import Dice
from .enums import DevelopmentCardType, GamePhase, ResourceType
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

    @classmethod
    def create(cls, players: list[Player]) -> "CatanGame":
        return cls(board=BoardFactory.create_standard_board(), players=players)

    def setup(self) -> None:
        self.phase = GamePhase.SETUP_1
        self.current_player_index = 0
        self.turn_manager.turn_number = 1
        self.turn_manager.reset_turn()

    def player_by_id(self, player_id: int) -> Player:
        for player in self.players:
            if player.id == player_id:
                return player
        raise ValueError(f"Unknown player id {player_id}")

    def current_player(self) -> Player:
        return self.players[self.current_player_index]

    def roll_dice(self) -> int:
        if self.phase == GamePhase.FINISHED:
            raise ValueError("Game is finished")
        roll = self.dice.roll()
        self.last_roll = roll
        if roll != 7:
            production = self.board.produce_resources(roll)
            for player_id, bundle in production.items():
                player = self.player_by_id(player_id)
                for resource, amount in bundle.items():
                    if self.bank.can_pay(resource, amount):
                        self.bank.pay(resource, amount)
                        player.add_resource(resource, amount)
        return roll

    def end_turn(self) -> None:
        self.current_player_index = self.turn_manager.next_player(
            self.current_player_index, len(self.players)
        )
        self.turn_manager.reset_turn()

    def build_road(
        self,
        player_id: int,
        edge_id: int,
        setup_phase: bool = False,
        pay_cost: bool = True,
    ) -> None:
        if not self.rules.validate_road_placement(
            self, player_id, edge_id, setup_phase=setup_phase
        ):
            raise ValueError("Invalid road placement")
        player = self.player_by_id(player_id)
        if pay_cost:
            self._pay_cost(player, ROAD_COST)
        self.board.place_road(player_id, edge_id)
        player.road_ids.add(edge_id)
        self._update_longest_road()

    def build_settlement(
        self,
        player_id: int,
        vertex_id: int,
        setup_phase: bool = False,
        pay_cost: bool = True,
    ) -> None:
        if not self.rules.validate_settlement_placement(
            self, player_id, vertex_id, setup_phase=setup_phase
        ):
            raise ValueError("Invalid settlement placement")
        player = self.player_by_id(player_id)
        if pay_cost:
            self._pay_cost(player, SETTLEMENT_COST)
        self.board.place_settlement(player_id, vertex_id)
        player.settlement_vertex_ids.add(vertex_id)

    def build_city(self, player_id: int, vertex_id: int) -> None:
        if not self.rules.validate_city_upgrade(self, player_id, vertex_id):
            raise ValueError("Invalid city upgrade")
        player = self.player_by_id(player_id)
        self._pay_cost(player, CITY_COST)
        self.board.place_city(player_id, vertex_id)
        player.settlement_vertex_ids.discard(vertex_id)
        player.city_vertex_ids.add(vertex_id)

    def buy_development_card(self, player_id: int) -> DevelopmentCardType:
        player = self.player_by_id(player_id)
        self._pay_cost(player, DEV_CARD_COST)
        card = self.dev_deck.draw()
        player.dev_cards_hand.append(card)
        self.bank.draw_dev_card(card)
        return card

    def play_development_card(
        self,
        player_id: int,
        card_type: DevelopmentCardType,
        args: dict | None = None,
    ) -> None:
        if not self.rules.validate_dev_card_play(self, player_id, card_type):
            raise ValueError("Cannot play this development card")
        player = self.player_by_id(player_id)
        player.dev_cards_hand.remove(card_type)

        payload = args or {}
        if card_type == DevelopmentCardType.KNIGHT:
            player.played_knights += 1
            self.move_robber(
                player_id=player_id,
                tile_id=payload["tile_id"],
                victim_id=payload.get("victim_id"),
            )
            self.achievements.update_largest_army(self.players)
        elif card_type == DevelopmentCardType.ROAD_BUILDING:
            edges = payload.get("edge_ids", [])
            if len(edges) != 2:
                raise ValueError("ROAD_BUILDING requires two edge ids")
            self.build_road(player_id, edges[0], pay_cost=False)
            self.build_road(player_id, edges[1], pay_cost=False)
        elif card_type == DevelopmentCardType.YEAR_OF_PLENTY:
            resources = payload.get("resources", [])
            if len(resources) != 2:
                raise ValueError("YEAR_OF_PLENTY requires two resources")
            for resource in resources:
                if not self.bank.can_pay(resource, 1):
                    raise ValueError("Bank cannot satisfy YEAR_OF_PLENTY")
            for resource in resources:
                self.bank.pay(resource, 1)
                player.add_resource(resource, 1)
        elif card_type == DevelopmentCardType.MONOPOLY:
            resource = payload.get("resource")
            if resource is None:
                raise ValueError("MONOPOLY requires a resource")
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
        elif card_type == DevelopmentCardType.VICTORY_POINT:
            pass

    def trade_with_bank(
        self,
        player_id: int,
        give: dict[ResourceType, int],
        receive: dict[ResourceType, int],
    ) -> None:
        if not self.rules.validate_bank_trade(self, player_id, give, receive):
            raise ValueError("Invalid bank trade")
        TradeService.execute_bank_trade(self, player_id, give, receive)

    def trade_with_player(self, offer: TradeOffer) -> None:
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
        self, player_id: int, tile_id: int, victim_id: int | None = None
    ) -> ResourceType | None:
        return RobberService.move_and_rob(self, player_id, tile_id, victim_id=victim_id)

    def check_winner(self) -> Player | None:
        for player in self.players:
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
