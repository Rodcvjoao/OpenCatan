"""WebSocket hub for room events — separate from the game hub to keep the
two concerns cleanly decoupled."""

from __future__ import annotations

from typing import Any, Iterator

from fastapi import WebSocket


class RoomConnectionHub:
    """Tracks the live room WebSockets and the lobby `player_token` that
    authenticated each one. The token is required so we can target
    per-player payloads (e.g. `game_started`) without leaking other
    players' tokens to every connected client."""

    def __init__(self) -> None:
        # room_id -> { websocket: player_token }
        self._connections: dict[str, dict[WebSocket, str]] = {}

    async def connect(
        self, room_id: str, websocket: WebSocket, player_token: str
    ) -> None:
        await websocket.accept()
        self._connections.setdefault(room_id, {})[websocket] = player_token

    def disconnect(self, room_id: str, websocket: WebSocket) -> None:
        bucket = self._connections.get(room_id)
        if bucket is None:
            return
        bucket.pop(websocket, None)
        if not bucket:
            del self._connections[room_id]

    def count(self, room_id: str) -> int:
        return len(self._connections.get(room_id, {}))

    def members(self, room_id: str) -> list[tuple[WebSocket, str]]:
        """Snapshot of `(websocket, player_token)` pairs currently in a
        room. Returns a list so callers can iterate safely while the hub
        may be mutated by disconnects."""
        return list(self._connections.get(room_id, {}).items())

    async def broadcast(self, room_id: str, message: dict[str, Any]) -> None:
        """Send the same payload to every socket in the room. Use this
        only for payloads that are safe for all members (e.g.
        `room_updated`). Token-bearing payloads must use `send_to` with a
        per-recipient payload instead."""
        for socket, _ in self.members(room_id):
            try:
                await socket.send_json(message)
            except Exception:
                self.disconnect(room_id, socket)

    async def send_to(self, websocket: WebSocket, message: dict[str, Any]) -> None:
        try:
            await websocket.send_json(message)
        except Exception:
            # Caller will normally already follow up with disconnect().
            return

    def __iter__(self) -> Iterator[str]:
        return iter(self._connections.keys())
