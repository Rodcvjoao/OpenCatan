from __future__ import annotations

import pytest

from catan.domain.enums import DevelopmentCardType, ResourceType
from catan.domain.game import CatanGame
from catan.domain.player import Player


def _game() -> CatanGame:
    players = [
        Player(id=1, name="Alice", color="red"),
        Player(id=2, name="Bob", color="blue"),
    ]
    return CatanGame.create(players)


def _game_three() -> CatanGame:
    players = [
        Player(id=1, name="Alice", color="red"),
        Player(id=2, name="Bob", color="blue"),
        Player(id=3, name="Carol", color="white"),
    ]
    return CatanGame.create(players)


def _finish_setup(game: CatanGame) -> None:
    script = [
        (1, "settlement", 0),
        (1, "road", 0),
        (2, "settlement", 10),
        (2, "road", 11),
        (2, "settlement", 35),
        (2, "road", 45),
        (1, "settlement", 47),
        (1, "road", 63),
    ]
    for pid, action, value in script:
        if action == "settlement":
            game.build_settlement(pid, value, setup_phase=True, pay_cost=False)
        else:
            game.build_road(pid, value, setup_phase=True, pay_cost=False)


def test_setup_transitions_to_main_with_first_player() -> None:
    game = _game()
    _finish_setup(game)
    assert game.phase.name == "MAIN"
    assert game.current_player().id == 1


def test_roll_7_requires_discard_and_robber_move() -> None:
    game = _game()
    _finish_setup(game)

    p2 = game.player_by_id(2)
    p2.add_resource(ResourceType.BRICK, 8)

    game.dice.roll = lambda: 7  # type: ignore[method-assign]
    rolled = game.roll_dice()
    assert rolled == 7
    assert game.pending_discards[2] == 4
    assert game.robber_move_required is True

    try:
        game.end_turn()
        assert False
    except ValueError:
        assert True

    game.discard_resources(2, {ResourceType.BRICK: 4})
    game.move_robber(player_id=1, tile_id=1)
    assert game.robber_move_required is False


def test_roll_records_individual_dice_values() -> None:
    game = _game()
    _finish_setup(game)

    rolled = game.roll_dice()

    assert game.last_roll_dice is not None
    assert len(game.last_roll_dice) == 2
    assert all(1 <= value <= 6 for value in game.last_roll_dice)
    assert sum(game.last_roll_dice) == rolled


def test_dev_card_cannot_be_played_if_bought_this_turn() -> None:
    game = _game()
    _finish_setup(game)
    p1 = game.player_by_id(1)
    game.dice.roll = lambda: 8  # type: ignore[method-assign]
    game.roll_dice()

    p1.dev_cards_hand.append(DevelopmentCardType.KNIGHT)
    game.new_dev_cards_this_turn.append(DevelopmentCardType.KNIGHT)

    try:
        game.play_development_card(1, DevelopmentCardType.KNIGHT, args={"tile_id": 1})
        assert False
    except ValueError:
        assert True


def test_achievement_tie_keeps_current_holder() -> None:
    game = _game()
    _finish_setup(game)

    game.achievements.longest_road_owner_id = 1
    game.player_by_id(1).has_longest_road = True
    game.player_by_id(2).has_longest_road = False

    game.achievements.update_longest_road({1: 5, 2: 5}, game.players)
    assert game.achievements.longest_road_owner_id == 1
    assert game.player_by_id(1).has_longest_road is True


def test_pending_trade_offer_flow() -> None:
    game = _game()
    _finish_setup(game)

    game.dice.roll = lambda: 8  # type: ignore[method-assign]
    game.roll_dice()

    p1 = game.player_by_id(1)
    p2 = game.player_by_id(2)
    p1.add_resource(ResourceType.BRICK, 1)
    p2.add_resource(ResourceType.WOOL, 1)

    offer = game.propose_trade_offer(
        from_player_id=1,
        to_player_id=2,
        give={ResourceType.BRICK: 1},
        receive={ResourceType.WOOL: 1},
    )
    assert game.pending_trade_offer is not None

    accepted = game.respond_trade_offer(player_id=2, offer_id=offer.id, accept=True)
    assert accepted is True
    assert game.pending_trade_offer is None
    assert p1.resources.get(ResourceType.WOOL, 0) >= 1
    assert p2.resources.get(ResourceType.BRICK, 0) >= 1


def test_leave_game_marks_inactive_and_transfers_host() -> None:
    game = _game_three()
    assert game.match_host_id == 1

    winner = game.leave_game(1)
    assert winner is None
    assert not game.is_active_player(1)
    assert game.match_host_id in {2, 3}


def test_leave_game_last_active_wins() -> None:
    game = _game_three()
    game.leave_game(1)
    winner = game.leave_game(2)
    assert winner is not None
    assert winner.id == 3
    assert game.phase.name == "FINISHED"


def test_rejoin_game_restores_activity() -> None:
    game = _game_three()
    game.leave_game(1)
    assert not game.is_active_player(1)
    game.rejoin_game(1)
    assert game.is_active_player(1)


def test_rejoin_game_after_finish_rejected() -> None:
    game = _game_three()
    game.leave_game(1)
    game.leave_game(2)
    with pytest.raises(ValueError):
        game.rejoin_game(1)
