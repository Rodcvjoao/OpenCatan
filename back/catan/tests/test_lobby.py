"""Unit tests for `catan.api.lobby.LobbyManager`."""

from __future__ import annotations

import pytest

from catan.api.lobby import (
    ALLOWED_COLORS,
    LobbyError,
    LobbyManager,
    MAX_PLAYERS,
)
from catan.api.runtime import InMemoryGameStore


def make_manager() -> LobbyManager:
    return LobbyManager(InMemoryGameStore())


# ---- Creation ----


def test_create_room_returns_code_and_host() -> None:
    manager = make_manager()
    room, host = manager.create_room("Alice", "red")
    assert len(room.room_id) >= 6
    assert room.room_id.isupper()
    assert room.players == [host]
    assert host.is_host is True
    assert host.ready is True  # host auto-ready
    assert host.color == "red"
    assert host.name == "Alice"


def test_room_codes_are_unique_across_creations() -> None:
    manager = make_manager()
    codes = {manager.create_room(f"P{i}", "red")[0].room_id for i in range(10)}
    assert len(codes) == 10


def test_create_rejects_unknown_color() -> None:
    manager = make_manager()
    with pytest.raises(LobbyError):
        manager.create_room("Alice", "purple")


def test_create_rejects_empty_name() -> None:
    manager = make_manager()
    with pytest.raises(LobbyError):
        manager.create_room("   ", "red")


# ---- Joining ----


def test_join_adds_player_and_defaults_to_not_ready() -> None:
    manager = make_manager()
    room, _host = manager.create_room("Alice", "red")
    _, guest = manager.join_room(room.room_id, "Bob", "blue")
    assert guest.ready is False
    assert guest.is_host is False
    assert len(room.players) == 2


def test_join_is_case_insensitive_on_code() -> None:
    manager = make_manager()
    room, _ = manager.create_room("Alice", "red")
    manager.join_room(room.room_id.lower(), "Bob", "blue")
    assert len(room.players) == 2


def test_join_rejects_duplicate_color() -> None:
    manager = make_manager()
    room, _ = manager.create_room("Alice", "red")
    with pytest.raises(LobbyError, match="Color already taken"):
        manager.join_room(room.room_id, "Bob", "red")


def test_join_rejects_full_room() -> None:
    manager = make_manager()
    room, _ = manager.create_room("Alice", "red")
    manager.join_room(room.room_id, "Bob", "blue")
    manager.join_room(room.room_id, "Carol", "white")
    manager.join_room(room.room_id, "Dave", "orange")
    assert len(room.players) == MAX_PLAYERS
    with pytest.raises(LobbyError, match="Room is full"):
        manager.join_room(room.room_id, "Eve", "red")


def test_join_rejects_unknown_room() -> None:
    manager = make_manager()
    with pytest.raises(LobbyError, match="Room not found"):
        manager.join_room("NOPE42", "Bob", "blue")


def test_join_rejects_after_game_started() -> None:
    manager = make_manager()
    room, host = manager.create_room("Alice", "red")
    _, bob = manager.join_room(room.room_id, "Bob", "blue")
    manager.set_ready(room.room_id, bob.player_token, True)
    manager.start_game(room.room_id, host.player_token)
    with pytest.raises(LobbyError, match="Game already started"):
        manager.join_room(room.room_id, "Carol", "white")


# ---- Ready toggle ----


def test_set_ready_toggles_for_guest() -> None:
    manager = make_manager()
    room, _ = manager.create_room("Alice", "red")
    _, bob = manager.join_room(room.room_id, "Bob", "blue")
    manager.set_ready(room.room_id, bob.player_token, True)
    assert bob.ready is True
    manager.set_ready(room.room_id, bob.player_token, False)
    assert bob.ready is False


def test_host_cannot_be_unreadied() -> None:
    manager = make_manager()
    room, host = manager.create_room("Alice", "red")
    assert host.ready is True
    # Even if we pass ready=False, the host stays ready.
    manager.set_ready(room.room_id, host.player_token, False)
    assert host.ready is True


# ---- Color change ----


def test_change_color_rejects_duplicate() -> None:
    manager = make_manager()
    room, _ = manager.create_room("Alice", "red")
    _, bob = manager.join_room(room.room_id, "Bob", "blue")
    with pytest.raises(LobbyError, match="Color already taken"):
        manager.change_color(room.room_id, bob.player_token, "red")


def test_change_color_allows_self_no_op() -> None:
    manager = make_manager()
    room, _ = manager.create_room("Alice", "red")
    _, bob = manager.join_room(room.room_id, "Bob", "blue")
    # Re-selecting your own color is fine (no collision against yourself).
    manager.change_color(room.room_id, bob.player_token, "blue")
    assert bob.color == "blue"


def test_change_color_rejects_unknown_color() -> None:
    manager = make_manager()
    room, _ = manager.create_room("Alice", "red")
    _, bob = manager.join_room(room.room_id, "Bob", "blue")
    with pytest.raises(LobbyError):
        manager.change_color(room.room_id, bob.player_token, "pink")


# ---- Leave ----


def test_leave_removes_guest() -> None:
    manager = make_manager()
    room, _ = manager.create_room("Alice", "red")
    _, bob = manager.join_room(room.room_id, "Bob", "blue")
    manager.leave_room(room.room_id, bob.player_token)
    assert all(p.name != "Bob" for p in room.players)


def test_leave_host_promotes_next_player() -> None:
    manager = make_manager()
    room, host = manager.create_room("Alice", "red")
    _, bob = manager.join_room(room.room_id, "Bob", "blue")
    _, carol = manager.join_room(room.room_id, "Carol", "white")
    updated = manager.leave_room(room.room_id, host.player_token)
    assert updated is not None
    # Oldest remaining player gets promoted.
    assert updated.find_player(bob.player_token) is not None
    assert updated.find_player(bob.player_token).is_host is True  # type: ignore[union-attr]
    assert updated.find_player(carol.player_token).is_host is False  # type: ignore[union-attr]


def test_leave_last_player_destroys_room() -> None:
    manager = make_manager()
    room, host = manager.create_room("Alice", "red")
    result = manager.leave_room(room.room_id, host.player_token)
    assert result is None
    assert manager.get_room(room.room_id) is None


# ---- Start game ----


def test_cannot_start_with_one_player() -> None:
    manager = make_manager()
    room, host = manager.create_room("Alice", "red")
    with pytest.raises(LobbyError):
        manager.start_game(room.room_id, host.player_token)


def test_cannot_start_unless_all_ready() -> None:
    manager = make_manager()
    room, host = manager.create_room("Alice", "red")
    manager.join_room(room.room_id, "Bob", "blue")
    with pytest.raises(LobbyError):
        manager.start_game(room.room_id, host.player_token)


def test_start_requires_host() -> None:
    manager = make_manager()
    room, _ = manager.create_room("Alice", "red")
    _, bob = manager.join_room(room.room_id, "Bob", "blue")
    manager.set_ready(room.room_id, bob.player_token, True)
    with pytest.raises(LobbyError):
        manager.start_game(room.room_id, bob.player_token)


def test_start_creates_game_and_maps_tokens() -> None:
    manager = make_manager()
    room, host = manager.create_room("Alice", "red")
    _, bob = manager.join_room(room.room_id, "Bob", "blue")
    manager.set_ready(room.room_id, bob.player_token, True)
    started = manager.start_game(room.room_id, host.player_token)
    assert started.game_id is not None
    # Each lobby player got a matching game token.
    assert set(started.lobby_to_game_token.keys()) == {
        host.player_token,
        bob.player_token,
    }
    # And all game tokens are unique.
    assert len(set(started.lobby_to_game_token.values())) == 2


# ---- Allowed colors sanity check ----


def test_allowed_colors_matches_game_defaults() -> None:
    assert ALLOWED_COLORS == {"red", "blue", "white", "orange"}
