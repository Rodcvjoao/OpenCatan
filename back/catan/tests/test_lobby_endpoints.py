"""Integration tests for the lobby HTTP + WS endpoints."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from catan.api.server import app, lobby


@pytest.fixture(autouse=True)
def _reset_lobby() -> None:
    """Each test starts with a clean lobby manager so codes don't leak."""
    lobby._rooms.clear()  # type: ignore[attr-defined]


def _create_room(client: TestClient, name: str = "Alice", color: str = "red"):
    response = client.post("/rooms", json={"name": name, "color": color})
    assert response.status_code == 200, response.text
    return response.json()


def test_create_room_returns_code_and_token() -> None:
    client = TestClient(app)
    data = _create_room(client)
    assert "player_token" in data
    room = data["room"]
    assert "room_id" in room and len(room["room_id"]) >= 6
    assert len(room["players"]) == 1
    host = room["players"][0]
    assert host["is_host"] is True
    assert host["ready"] is True
    assert host["color"] == "red"
    assert "player_token" not in host  # tokens never leak in room state


def test_get_room_returns_state() -> None:
    client = TestClient(app)
    data = _create_room(client)
    room_id = data["room"]["room_id"]
    response = client.get(f"/rooms/{room_id}")
    assert response.status_code == 200
    assert response.json()["room"]["room_id"] == room_id


def test_get_room_404s_unknown() -> None:
    client = TestClient(app)
    response = client.get("/rooms/DOESNOT")
    assert response.status_code == 404


def test_join_rejects_duplicate_color() -> None:
    client = TestClient(app)
    data = _create_room(client)
    room_id = data["room"]["room_id"]
    response = client.post(
        f"/rooms/{room_id}/join", json={"name": "Bob", "color": "red"}
    )
    assert response.status_code == 400
    assert "Color already taken" in response.json()["detail"]


def test_join_returns_state_and_token() -> None:
    client = TestClient(app)
    data = _create_room(client)
    room_id = data["room"]["room_id"]
    response = client.post(
        f"/rooms/{room_id}/join", json={"name": "Bob", "color": "blue"}
    )
    assert response.status_code == 200
    joined = response.json()
    assert "player_token" in joined
    assert len(joined["room"]["players"]) == 2


def test_join_404s_unknown_room() -> None:
    client = TestClient(app)
    response = client.post(
        "/rooms/DOESNOT/join", json={"name": "Bob", "color": "blue"}
    )
    assert response.status_code == 404


def test_set_ready_updates_state() -> None:
    client = TestClient(app)
    data = _create_room(client)
    room_id = data["room"]["room_id"]
    joined = client.post(
        f"/rooms/{room_id}/join", json={"name": "Bob", "color": "blue"}
    ).json()

    response = client.post(
        f"/rooms/{room_id}/ready",
        json={"player_token": joined["player_token"], "ready": True},
    )
    assert response.status_code == 200
    players = response.json()["room"]["players"]
    bob = next(p for p in players if p["name"] == "Bob")
    assert bob["ready"] is True


def test_change_color_rejects_duplicate() -> None:
    client = TestClient(app)
    data = _create_room(client)
    room_id = data["room"]["room_id"]
    joined = client.post(
        f"/rooms/{room_id}/join", json={"name": "Bob", "color": "blue"}
    ).json()

    response = client.post(
        f"/rooms/{room_id}/color",
        json={"player_token": joined["player_token"], "color": "red"},
    )
    assert response.status_code == 400
    assert "Color already taken" in response.json()["detail"]


def test_leave_removes_player() -> None:
    client = TestClient(app)
    data = _create_room(client)
    room_id = data["room"]["room_id"]
    joined = client.post(
        f"/rooms/{room_id}/join", json={"name": "Bob", "color": "blue"}
    ).json()

    leave = client.post(
        f"/rooms/{room_id}/leave",
        json={"player_token": joined["player_token"]},
    )
    assert leave.status_code == 200

    state = client.get(f"/rooms/{room_id}").json()
    assert len(state["room"]["players"]) == 1


def test_start_game_requires_all_ready() -> None:
    client = TestClient(app)
    data = _create_room(client)
    host_token = data["player_token"]
    room_id = data["room"]["room_id"]
    client.post(f"/rooms/{room_id}/join", json={"name": "Bob", "color": "blue"})

    response = client.post(
        f"/rooms/{room_id}/start", json={"player_token": host_token}
    )
    assert response.status_code == 400


def test_start_game_creates_game_and_broadcasts() -> None:
    client = TestClient(app)
    data = _create_room(client)
    host_token = data["player_token"]
    room_id = data["room"]["room_id"]
    joined = client.post(
        f"/rooms/{room_id}/join", json={"name": "Bob", "color": "blue"}
    ).json()
    client.post(
        f"/rooms/{room_id}/ready",
        json={"player_token": joined["player_token"], "ready": True},
    )

    # Guest is connected to the room WS when Start fires.
    guest_token = joined["player_token"]
    with client.websocket_connect(
        f"/ws/rooms/{room_id}?player_token={guest_token}"
    ) as ws:
        snapshot = ws.receive_json()
        assert snapshot["type"] == "room_snapshot"

        response = client.post(
            f"/rooms/{room_id}/start", json={"player_token": host_token}
        )
        assert response.status_code == 200
        body = response.json()
        assert body["game_id"]
        assert body["game_token"]

        # Next broadcast should be either a room update (reflecting the
        # newly-set game_id) or the game_started message.
        seen_game_started = False
        for _ in range(3):
            try:
                msg = ws.receive_json()
            except Exception:
                break
            if msg["type"] == "game_started":
                seen_game_started = True
                assert msg["payload"]["game_id"] == body["game_id"]
                # Each socket receives only its own game_token — the
                # full lobby->game_token map must never be broadcast.
                assert "tokens" not in msg["payload"]
                assert isinstance(msg["payload"]["game_token"], str)
                # The guest's socket must receive the guest's token,
                # never the host's.
                assert msg["payload"]["game_token"] != body["game_token"]
                break
        assert seen_game_started


def test_ws_room_snapshot_then_live_update() -> None:
    client = TestClient(app)
    data = _create_room(client)
    room_id = data["room"]["room_id"]
    host_token = data["player_token"]

    with client.websocket_connect(
        f"/ws/rooms/{room_id}?player_token={host_token}"
    ) as ws:
        snapshot = ws.receive_json()
        assert snapshot["type"] == "room_snapshot"
        assert len(snapshot["payload"]["players"]) == 1

        client.post(
            f"/rooms/{room_id}/join", json={"name": "Bob", "color": "blue"}
        )
        update = ws.receive_json()
        assert update["type"] == "room_updated"
        assert len(update["payload"]["players"]) == 2


def test_ws_unknown_room_closes_4404() -> None:
    client = TestClient(app)
    from starlette.websockets import WebSocketDisconnect

    with client.websocket_connect(
        "/ws/rooms/NOPE42?player_token=whatever"
    ) as ws:
        with pytest.raises(WebSocketDisconnect) as excinfo:
            ws.receive_json()
        assert excinfo.value.code == 4404


def test_ws_without_player_token_closes_4401() -> None:
    """An anonymous socket must not receive room state or tokens."""
    client = TestClient(app)
    from starlette.websockets import WebSocketDisconnect

    data = _create_room(client)
    room_id = data["room"]["room_id"]

    with client.websocket_connect(f"/ws/rooms/{room_id}") as ws:
        with pytest.raises(WebSocketDisconnect) as excinfo:
            ws.receive_json()
        assert excinfo.value.code == 4401


def test_ws_with_foreign_player_token_closes_4401() -> None:
    """A token that doesn't belong to this room must be rejected."""
    client = TestClient(app)
    from starlette.websockets import WebSocketDisconnect

    data = _create_room(client)
    room_id = data["room"]["room_id"]
    other = _create_room(client, name="Eve", color="blue")
    other_token = other["player_token"]

    with client.websocket_connect(
        f"/ws/rooms/{room_id}?player_token={other_token}"
    ) as ws:
        with pytest.raises(WebSocketDisconnect) as excinfo:
            ws.receive_json()
        assert excinfo.value.code == 4401


def test_ws_connect_after_start_replays_game_started() -> None:
    """A socket that opens *after* the host pressed Start must still be
    told the game has started and receive *only* its own game_token — we
    must never expose other players' tokens to a reconnecting client."""
    client = TestClient(app)
    host = _create_room(client)
    room_id = host["room"]["room_id"]
    host_token = host["player_token"]

    joined = client.post(
        f"/rooms/{room_id}/join", json={"name": "Bob", "color": "blue"}
    ).json()
    client.post(
        f"/rooms/{room_id}/ready",
        json={"player_token": joined["player_token"], "ready": True},
    )
    start = client.post(
        f"/rooms/{room_id}/start", json={"player_token": host_token}
    ).json()

    # Guest reconnects (e.g. refreshed the tab) *after* Start fired.
    guest_token = joined["player_token"]
    with client.websocket_connect(
        f"/ws/rooms/{room_id}?player_token={guest_token}"
    ) as ws:
        snapshot = ws.receive_json()
        assert snapshot["type"] == "room_snapshot"
        assert snapshot["payload"]["game_id"] == start["game_id"]

        replay = ws.receive_json()
        assert replay["type"] == "game_started"
        assert replay["payload"]["game_id"] == start["game_id"]
        # Only this client's own game_token — never the full map.
        assert "tokens" not in replay["payload"]
        game_token = replay["payload"]["game_token"]
        assert isinstance(game_token, str) and game_token
        # And crucially it must not be the host's token.
        assert game_token != start["game_token"]
