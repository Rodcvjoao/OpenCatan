from __future__ import annotations

from fastapi.testclient import TestClient

from catan.api.server import app


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
                "command": "roll_dice",
                "payload": {},
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
