"""In-memory lobby / room manager that sits in front of the game engine.

A Room is a pre-game waiting area where players collect before a CatanGame
is actually created. The host opens a room, shares its short human-readable
code, guests join, everyone picks a unique color and marks ready, and
finally the host presses Start which creates the real game via the existing
`InMemoryGameStore.create_game` call.

The lobby is deliberately kept separate from the game engine so the Catan
rules code stays focused on playing a match, not organizing one.
"""

from __future__ import annotations

import secrets
import time
import uuid
from dataclasses import dataclass, field
from threading import RLock
from typing import Any, Iterable

from catan.api.runtime import GameSession, InMemoryGameStore

# Short human-friendly alphabet for room codes — no 0/O/1/I to keep codes
# legible when spoken.
_ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
_ROOM_CODE_LEN = 6

# Colors are fixed by the game engine. We allow all four.
ALLOWED_COLORS: frozenset[str] = frozenset({"red", "blue", "white", "orange"})

MIN_PLAYERS = 2
MAX_PLAYERS = 4

# Rooms with no WebSocket connections and no mutations for this many seconds
# are garbage-collected on next access.
ROOM_IDLE_TIMEOUT_SECONDS = 5 * 60


@dataclass
class LobbyPlayer:
    """A single participant inside a Room."""

    player_token: str  # authenticates the player *within the lobby*
    name: str
    color: str
    ready: bool = False
    is_host: bool = False
    joined_at: float = field(default_factory=time.time)


@dataclass
class Room:
    """A pre-game waiting room.

    Once `game_id` is set the room is frozen — no more joins / leaves — and
    exists purely to map lobby tokens to the per-player game tokens.
    """

    room_id: str
    players: list[LobbyPlayer] = field(default_factory=list)
    game_id: str | None = None
    returning_game_id: str | None = None
    lobby_to_game_token: dict[str, str] = field(default_factory=dict)
    return_game_to_lobby_token: dict[str, str] = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)
    last_activity: float = field(default_factory=time.time)
    active_connections: int = 0

    # ---- Helpers ----

    def find_player(self, token: str) -> LobbyPlayer | None:
        return next((p for p in self.players if p.player_token == token), None)

    def has_member(self, token: str) -> bool:
        """True if `token` is an accepted lobby token for this room.

        Before Start, that means the token belongs to a current player.
        After Start the room is frozen and `players` may or may not
        still hold the same entries, but `lobby_to_game_token` is the
        authoritative record of who was part of the session — accept
        those tokens too so reconnecting clients can still authenticate.
        """
        if not token:
            return False
        if self.find_player(token) is not None:
            return True
        return self.game_id is not None and token in self.lobby_to_game_token

    def is_color_taken(
        self, color: str, *, exclude_token: str | None = None
    ) -> bool:
        return any(
            p.color == color and p.player_token != exclude_token
            for p in self.players
        )

    def touch(self) -> None:
        self.last_activity = time.time()

    # Default "everyone ready" gate: host can start when all players are
    # ready AND there are enough of them.
    def can_start(self, host_token: str) -> bool:
        if self.game_id is not None:
            return False
        if len(self.players) < MIN_PLAYERS:
            return False
        host = self.find_player(host_token)
        if host is None or not host.is_host:
            return False
        return all(p.ready for p in self.players)

    # ---- Serialization (public) ----

    def to_public_dict(self) -> dict[str, Any]:
        """What WS / HTTP responses carry. Does not include individual
        player tokens — those are returned only to the owning player on
        create/join, stored client-side, and sent back to authenticate."""
        return {
            "room_id": self.room_id,
            "players": [
                {
                    "name": p.name,
                    "color": p.color,
                    "ready": p.ready,
                    "is_host": p.is_host,
                }
                for p in self.players
            ],
            "game_id": self.game_id,
            "created_at": self.created_at,
        }


class LobbyManager:
    """Thread-safe registry of Rooms.

    The manager is deliberately tiny — it owns the lifecycle of Room
    dataclasses and nothing else. Cross-Room broadcasting / WS state is
    kept outside in a separate hub (see room_events.RoomConnectionHub)."""

    def __init__(self, game_store: InMemoryGameStore) -> None:
        self._rooms: dict[str, Room] = {}
        self._return_rooms_by_game: dict[str, str] = {}
        self._lock = RLock()
        self._game_store = game_store

    # ---- Room lookup ----

    def get_room(self, room_id: str) -> Room | None:
        if not room_id:
            return None
        code = room_id.strip().upper()
        with self._lock:
            self._prune_stale_locked()
            return self._rooms.get(code)

    def list_rooms(self) -> list[Room]:
        """Mostly useful for tests / debugging."""
        with self._lock:
            return list(self._rooms.values())

    # ---- Mutations ----

    def create_room(self, host_name: str, host_color: str) -> tuple[Room, LobbyPlayer]:
        self._validate_name(host_name)
        self._validate_color(host_color)
        with self._lock:
            self._prune_stale_locked()
            code = self._generate_unique_code()
            host = LobbyPlayer(
                player_token=_new_token(),
                name=host_name,
                color=host_color,
                ready=True,  # host auto-ready; they'll be the one hitting Start
                is_host=True,
            )
            room = Room(room_id=code, players=[host])
            self._rooms[code] = room
            return room, host

    def join_room(
        self, room_id: str, name: str, color: str
    ) -> tuple[Room, LobbyPlayer]:
        self._validate_name(name)
        self._validate_color(color)
        code = room_id.strip().upper()
        with self._lock:
            self._prune_stale_locked()
            room = self._rooms.get(code)
            if room is None:
                raise LobbyError("Room not found")
            if room.game_id is not None:
                raise LobbyError("Game already started")
            if room.returning_game_id is not None:
                raise LobbyError(
                    "Return lobby only accepts players from the finished game"
                )
            if len(room.players) >= MAX_PLAYERS:
                raise LobbyError("Room is full")
            if room.is_color_taken(color):
                raise LobbyError("Color already taken")
            guest = LobbyPlayer(
                player_token=_new_token(),
                name=name,
                color=color,
                ready=False,
            )
            room.players.append(guest)
            room.touch()
            return room, guest

    def change_color(self, room_id: str, token: str, color: str) -> Room:
        self._validate_color(color)
        code = room_id.strip().upper()
        with self._lock:
            room = self._require_room(code)
            if room.game_id is not None:
                raise LobbyError("Game already started")
            player = self._require_player(room, token)
            if room.is_color_taken(color, exclude_token=token):
                raise LobbyError("Color already taken")
            player.color = color
            room.touch()
            return room

    def set_ready(self, room_id: str, token: str, ready: bool) -> Room:
        code = room_id.strip().upper()
        with self._lock:
            room = self._require_room(code)
            if room.game_id is not None:
                raise LobbyError("Game already started")
            player = self._require_player(room, token)
            # Host is always ready. Ignore unready attempts but don't error.
            if player.is_host:
                player.ready = True
            else:
                player.ready = ready
            room.touch()
            return room

    def leave_room(self, room_id: str, token: str) -> Room | None:
        """Remove a player. If the host leaves, the oldest remaining player
        is auto-promoted. Returns None if the room is now empty and has been
        deleted."""
        code = room_id.strip().upper()
        with self._lock:
            room = self._rooms.get(code)
            if room is None:
                return None
            before = len(room.players)
            room.players = [p for p in room.players if p.player_token != token]
            if len(room.players) == before:
                # Token wasn't in the room; nothing to do.
                return room
            if not room.players:
                del self._rooms[code]
                self._return_rooms_by_game = {
                    game_id: room_id
                    for game_id, room_id in self._return_rooms_by_game.items()
                    if room_id != code
                }
                return None
            # If the host was the one leaving, promote the next oldest
            # player (and mark them ready so they remain the Start gate).
            if not any(p.is_host for p in room.players):
                room.players.sort(key=lambda p: p.joined_at)
                room.players[0].is_host = True
                room.players[0].ready = True
            room.touch()
            return room

    def start_game(self, room_id: str, host_token: str) -> Room:
        code = room_id.strip().upper()
        with self._lock:
            room = self._require_room(code)
            if room.game_id is not None:
                raise LobbyError("Game already started")
            if not room.can_start(host_token):
                raise LobbyError(
                    "Cannot start — need at least 2 players, all ready, and the host must press Start"
                )
            # Keep per-room player order stable (host first, then join order).
            ordered = sorted(
                room.players,
                key=lambda p: (0 if p.is_host else 1, p.joined_at),
            )
            players_input = [{"name": p.name, "color": p.color} for p in ordered]
            session = self._game_store.create_game(players_input)
            if room.returning_game_id is not None:
                self._return_rooms_by_game.pop(room.returning_game_id, None)
            room.game_id = session.game_id
            room.returning_game_id = None
            room.return_game_to_lobby_token.clear()
            # Map each lobby token -> that player's game_token.
            lobby_to_game: dict[str, str] = {}
            lobby_players_by_index = {
                i + 1: ordered[i].player_token for i in range(len(ordered))
            }
            for game_token, player_id in session.player_tokens.items():
                lobby_token = lobby_players_by_index[player_id]
                lobby_to_game[lobby_token] = game_token
            room.lobby_to_game_token = lobby_to_game
            room.touch()
            return room

    def return_to_lobby(self, game_id: str, game_token: str) -> tuple[Room, str]:
        with self._lock:
            self._prune_stale_locked()
            try:
                session = self._game_store.get(game_id)
            except KeyError as exc:
                raise LobbyError("Game not found") from exc
            try:
                player_id = session.player_id_from_token(game_token)
            except ValueError as exc:
                raise LobbyError("Player not in game") from exc
            if session.game.phase.name != "FINISHED":
                raise LobbyError("Can only return to lobby after the game ends")

            room = self._get_or_create_return_room_locked(game_id)
            lobby_token = room.return_game_to_lobby_token.get(game_token)
            if lobby_token is None:
                if len(room.players) >= MAX_PLAYERS:
                    raise LobbyError("Room is full")
                game_player = session.game.player_by_id(player_id)
                lobby_token = _new_token()
                returning_player = LobbyPlayer(
                    player_token=lobby_token,
                    name=game_player.name,
                    color=game_player.color,
                    ready=not any(p.is_host for p in room.players),
                    is_host=not any(p.is_host for p in room.players),
                )
                returning_player.is_host = not any(p.is_host for p in room.players)
                returning_player.ready = returning_player.is_host
                if room.is_color_taken(returning_player.color):
                    free_color = next(
                        (
                            color
                            for color in ["red", "blue", "white", "orange"]
                            if not room.is_color_taken(color)
                        ),
                        None,
                    )
                    if free_color is None:
                        raise LobbyError("Room is full")
                    returning_player.color = free_color
                room.players.append(returning_player)
                room.return_game_to_lobby_token[game_token] = lobby_token

            room.touch()
            return room, lobby_token

    def _get_or_create_return_room_locked(self, game_id: str) -> Room:
        room_id = self._return_rooms_by_game.get(game_id)
        if room_id is not None:
            room = self._rooms.get(room_id)
            if room is not None:
                return room

        existing = next(
            (
                candidate
                for candidate in self._rooms.values()
                if candidate.game_id == game_id
                or candidate.returning_game_id == game_id
            ),
            None,
        )
        if existing is not None:
            existing.game_id = None
            existing.returning_game_id = game_id
            existing.players = []
            existing.lobby_to_game_token.clear()
            existing.return_game_to_lobby_token.clear()
            self._return_rooms_by_game[game_id] = existing.room_id
            return existing

        code = self._generate_unique_code()
        room = Room(room_id=code, returning_game_id=game_id)
        self._rooms[code] = room
        self._return_rooms_by_game[game_id] = code
        return room

    # ---- Connection tracking (called by the WS hub) ----

    def on_connect(self, room_id: str) -> None:
        code = room_id.strip().upper()
        with self._lock:
            room = self._rooms.get(code)
            if room is None:
                return
            room.active_connections += 1
            room.touch()

    def on_disconnect(self, room_id: str) -> None:
        code = room_id.strip().upper()
        with self._lock:
            room = self._rooms.get(code)
            if room is None:
                return
            room.active_connections = max(0, room.active_connections - 1)
            room.touch()

    # ---- Internal helpers ----

    def _generate_unique_code(self) -> str:
        for _ in range(50):
            code = "".join(
                secrets.choice(_ROOM_CODE_ALPHABET) for _ in range(_ROOM_CODE_LEN)
            )
            if code not in self._rooms:
                return code
        # Extremely unlikely; fall back to a longer code to guarantee uniqueness.
        return uuid.uuid4().hex[:8].upper()

    def _require_room(self, code: str) -> Room:
        room = self._rooms.get(code)
        if room is None:
            raise LobbyError("Room not found")
        return room

    @staticmethod
    def _require_player(room: Room, token: str) -> LobbyPlayer:
        player = room.find_player(token)
        if player is None:
            raise LobbyError("Player not in room")
        return player

    @staticmethod
    def _validate_name(name: str) -> None:
        if not name or not name.strip():
            raise LobbyError("Name is required")
        if len(name) > 32:
            raise LobbyError("Name too long")

    @staticmethod
    def _validate_color(color: str) -> None:
        if color not in ALLOWED_COLORS:
            raise LobbyError(f"Unknown color: {color}")

    def _prune_stale_locked(self) -> None:
        """Remove rooms with no active connections idle for longer than
        ROOM_IDLE_TIMEOUT_SECONDS. Caller must already hold the lock."""
        if not self._rooms:
            return
        now = time.time()
        stale = [
            code
            for code, room in self._rooms.items()
            if room.active_connections == 0
            and (now - room.last_activity) > ROOM_IDLE_TIMEOUT_SECONDS
        ]
        for code in stale:
            del self._rooms[code]
        if stale:
            stale_set = set(stale)
            self._return_rooms_by_game = {
                game_id: room_id
                for game_id, room_id in self._return_rooms_by_game.items()
                if room_id not in stale_set
            }


class LobbyError(Exception):
    """Raised for any user-facing failure inside the lobby layer. Messages
    are safe to surface directly to clients."""


def _new_token() -> str:
    return secrets.token_urlsafe(16)


def session_for_room(
    game_store: InMemoryGameStore, room: Room
) -> GameSession | None:
    """Utility used by server endpoints once a room has been started —
    look up the GameSession that corresponds to `room.game_id`."""
    if room.game_id is None:
        return None
    try:
        return game_store.get(room.game_id)
    except KeyError:
        return None


def build_room_response(room: Room) -> dict[str, Any]:
    """Shape returned by GET / snapshot. Matches `to_public_dict` but kept
    as a top-level helper so server-side callers don't reach into the
    dataclass directly."""
    return room.to_public_dict()


def tokens_payload(room: Room) -> dict[str, str]:
    """The map { lobby_token -> game_token } to include in a
    `game_started` broadcast once the host has pressed Start."""
    return dict(room.lobby_to_game_token)


def iter_active_rooms(manager: LobbyManager) -> Iterable[Room]:
    """Convenience for tests."""
    return iter(manager.list_rooms())
