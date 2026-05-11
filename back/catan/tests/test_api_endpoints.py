from __future__ import annotations

from fastapi.testclient import TestClient

from catan.api.server import app, store
from catan.domain.enums import ResourceType


def test_create_game_and_fetch_state() -> None:
    client = TestClient(app)

    create_response = client.post(
        "/games",
        json={
            "players": [
                {"name": "Alice", "color": "red"},
                {"name": "Bob", "color": "blue"},
            ]
        },
    )
    assert create_response.status_code == 200

    body = create_response.json()
    game_id = body["game_id"]
    players = sorted(body["players"], key=lambda item: item["player_id"])
    assert len(players) == 2

    state_response = client.get(
        f"/games/{game_id}/state",
        params={"player_token": players[0]["token"]},
    )
    assert state_response.status_code == 200
    state = state_response.json()
    assert state["game_id"] == game_id
    assert state["private_state"]["player_id"] == players[0]["player_id"]


def test_command_endpoint_and_ws_snapshot() -> None:
    client = TestClient(app)

    create_response = client.post(
        "/games",
        json={
            "players": [
                {"name": "Alice", "color": "red"},
                {"name": "Bob", "color": "blue"},
            ]
        },
    )
    game = create_response.json()
    game_id = game["game_id"]
    players = sorted(game["players"], key=lambda item: item["player_id"])

    with client.websocket_connect(f"/ws/games/{game_id}") as websocket:
        connected = websocket.receive_json()
        assert connected["type"] == "connected"

        command_response = client.post(
            f"/games/{game_id}/commands",
            json={
                "player_token": players[0]["token"],
                "command": "place_setup_settlement",
                "payload": {"vertex_id": 0},
            },
        )
        assert command_response.status_code == 200
        command_body = command_response.json()
        assert command_body["accepted"] is True

        broadcast = websocket.receive_json()
        assert broadcast["type"] == "game_state_updated"
        assert broadcast["payload"]["game_id"] == game_id

        websocket.send_json(
            {
                "type": "snapshot",
                "payload": {"player_token": players[1]["token"]},
            }
        )
        snapshot = websocket.receive_json()
        assert snapshot["type"] == "snapshot"
        assert (
            snapshot["payload"]["private_state"]["player_id"] == players[1]["player_id"]
        )


def test_two_step_trade_flow() -> None:
    client = TestClient(app)
    create_response = client.post(
        "/games",
        json={
            "players": [
                {"name": "Alice", "color": "red"},
                {"name": "Bob", "color": "blue"},
            ]
        },
    )
    game = create_response.json()
    game_id = game["game_id"]
    players = sorted(game["players"], key=lambda item: item["player_id"])
    p1 = players[0]
    p2 = players[1]

    # complete setup quickly
    setup_script = [
        (p1, "place_setup_settlement", {"vertex_id": 0}),
        (p1, "place_setup_road", {"edge_id": 0}),
        (p2, "place_setup_settlement", {"vertex_id": 10}),
        (p2, "place_setup_road", {"edge_id": 11}),
        (p2, "place_setup_settlement", {"vertex_id": 35}),
        (p2, "place_setup_road", {"edge_id": 45}),
        (p1, "place_setup_settlement", {"vertex_id": 47}),
        (p1, "place_setup_road", {"edge_id": 63}),
    ]
    for player, command, payload in setup_script:
        response = client.post(
            f"/games/{game_id}/commands",
            json={
                "player_token": player["token"],
                "command": command,
                "payload": payload,
            },
        )
        assert response.status_code == 200
        assert response.json()["accepted"] is True

    # roll to enable trading
    store.get(game_id).game.dice.roll = lambda: 8  # type: ignore[method-assign]
    roll = client.post(
        f"/games/{game_id}/commands",
        json={"player_token": p1["token"], "command": "roll_dice", "payload": {}},
    )
    assert roll.status_code == 200
    assert roll.json()["accepted"] is True

    state = client.get(
        f"/games/{game_id}/state",
        params={"player_token": p1["token"]},
    ).json()
    assert "propose_trade_offer" in state["private_state"]["legal_actions"]

    session = store.get(game_id)
    gp1 = session.game.player_by_id(p1["player_id"])
    gp2 = session.game.player_by_id(p2["player_id"])
    gp1.add_resource(ResourceType.BRICK, 1)
    gp2.add_resource(ResourceType.WOOL, 1)

    propose = client.post(
        f"/games/{game_id}/commands",
        json={
            "player_token": p1["token"],
            "command": "propose_trade_offer",
            "payload": {
                "to_player_id": p2["player_id"],
                "give": {"brick": 1},
                "receive": {"wool": 1},
            },
        },
    )
    assert propose.status_code == 200
    propose_body = propose.json()
    assert propose_body["accepted"] is True
    offer_event = propose_body["events"][0]
    offer_id = offer_event["offer_id"]

    respond = client.post(
        f"/games/{game_id}/commands",
        json={
            "player_token": p2["token"],
            "command": "respond_trade_offer",
            "payload": {"offer_id": offer_id, "accept": True},
        },
    )
    assert respond.status_code == 200
    respond_body = respond.json()
    assert respond_body["accepted"] is True

    assert gp1.resources.get(ResourceType.WOOL, 0) >= 1
    assert gp2.resources.get(ResourceType.BRICK, 0) >= 1


def test_finished_room_game_can_return_players_to_lobby() -> None:
    client = TestClient(app)
    room_response = client.post(
        "/rooms",
        json={"name": "Alice", "color": "red"},
    )
    room_body = room_response.json()
    room_id = room_body["room"]["room_id"]
    host_lobby_token = room_body["player_token"]

    join_response = client.post(
        f"/rooms/{room_id}/join",
        json={"name": "Bob", "color": "blue"},
    )
    guest_lobby_token = join_response.json()["player_token"]

    ready = client.post(
        f"/rooms/{room_id}/ready",
        json={"player_token": guest_lobby_token, "ready": True},
    )
    assert ready.status_code == 200

    started = client.post(
        f"/rooms/{room_id}/start",
        json={"player_token": host_lobby_token},
    )
    assert started.status_code == 200
    game_id = started.json()["game_id"]
    host_game_token = started.json()["game_token"]

    guest_game_token = next(
        token
        for token, player_id in store.get(game_id).player_tokens.items()
        if player_id == 2
    )

    early = client.post(
        f"/games/{game_id}/return-to-lobby",
        json={"player_token": host_game_token},
    )
    assert early.status_code == 400

    session = store.get(game_id)
    session.game.player_by_id(1).settlement_vertex_ids.update(range(10))
    assert session.game.check_winner() is not None

    host_return = client.post(
        f"/games/{game_id}/return-to-lobby",
        json={"player_token": host_game_token},
    )
    assert host_return.status_code == 200
    assert host_return.json()["room"]["room_id"] == room_id
    assert host_return.json()["player_token"] != host_lobby_token
    assert host_return.json()["room"]["game_id"] is None
    assert [p["name"] for p in host_return.json()["room"]["players"]] == ["Alice"]
    assert [p["ready"] for p in host_return.json()["room"]["players"]] == [True]

    blocked_join = client.post(
        f"/rooms/{room_id}/join",
        json={"name": "Mallory", "color": "white"},
    )
    assert blocked_join.status_code == 400
    assert "players from the finished game" in blocked_join.json()["detail"]

    guest_return = client.post(
        f"/games/{game_id}/return-to-lobby",
        json={"player_token": guest_game_token},
    )

    assert guest_return.status_code == 200
    assert guest_return.json()["room"]["room_id"] == room_id
    assert guest_return.json()["player_token"] != guest_lobby_token
    assert [p["name"] for p in guest_return.json()["room"]["players"]] == [
        "Alice",
        "Bob",
    ]
    assert [p["ready"] for p in guest_return.json()["room"]["players"]] == [
        True,
        False,
    ]


def test_finished_direct_game_creates_return_lobby() -> None:
    client = TestClient(app)
    create_response = client.post(
        "/games",
        json={
            "players": [
                {"name": "Alice", "color": "red"},
                {"name": "Bob", "color": "blue"},
            ]
        },
    )
    game = create_response.json()
    game_id = game["game_id"]
    players = sorted(game["players"], key=lambda item: item["player_id"])

    session = store.get(game_id)
    session.game.player_by_id(1).settlement_vertex_ids.update(range(10))
    assert session.game.check_winner() is not None

    alice_return = client.post(
        f"/games/{game_id}/return-to-lobby",
        json={"player_token": players[0]["token"]},
    )
    bob_return = client.post(
        f"/games/{game_id}/return-to-lobby",
        json={"player_token": players[1]["token"]},
    )

    assert alice_return.status_code == 200
    assert bob_return.status_code == 200
    assert alice_return.json()["room"]["room_id"] == bob_return.json()["room"]["room_id"]
    assert [p["name"] for p in alice_return.json()["room"]["players"]] == ["Alice"]
    assert [p["name"] for p in bob_return.json()["room"]["players"]] == [
        "Alice",
        "Bob",
    ]
