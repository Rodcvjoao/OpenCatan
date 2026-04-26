from __future__ import annotations

import json
import socket
from collections import defaultdict

from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from catan.api.lobby import LobbyError, LobbyManager
from catan.api.room_events import RoomConnectionHub
from catan.api.runtime import InMemoryGameStore
from catan.api.schemas import (
    ChangeColorRequest,
    CommandRequest,
    CommandResponse,
    CreateGameRequest,
    CreateGameResponse,
    CreateRoomRequest,
    JoinRoomRequest,
    LeaveRoomRequest,
    PlayerSessionInfo,
    RoomMembershipResponse,
    RoomState,
    RoomStateResponse,
    SetReadyRequest,
    StartGameRequest,
    StartGameResponse,
    WebSocketMessage,
)
from catan.api.serialize import build_state_envelope


class ConnectionHub:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, game_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[game_id].add(websocket)

    def disconnect(self, game_id: str, websocket: WebSocket) -> None:
        if game_id in self._connections:
            self._connections[game_id].discard(websocket)
            if not self._connections[game_id]:
                del self._connections[game_id]

    async def broadcast(self, game_id: str, message: dict) -> None:
        sockets = list(self._connections.get(game_id, set()))
        for socket in sockets:
            try:
                await socket.send_json(message)
            except Exception:
                self.disconnect(game_id, socket)


store = InMemoryGameStore()
hub = ConnectionHub()
lobby = LobbyManager(store)
room_hub = RoomConnectionHub()

app = FastAPI(title="OpenCatan API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def _detect_lan_ip() -> str | None:
    """Best-effort discovery of this host's primary outbound LAN IP.

    Opens a UDP socket and "connects" it to a non-routable address — this
    doesn't actually send any packets, it just forces the OS to pick the
    interface that would be used for the default route. Falls back to
    None on any socket error so we never break startup.
    """
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))
        return s.getsockname()[0]
    except Exception:
        return None
    finally:
        s.close()


@app.on_event("startup")
def _announce_lan_url() -> None:
    """Print a shareable LAN URL once on boot so friends can connect."""
    ip = _detect_lan_ip()
    if ip and ip != "127.0.0.1":
        print(f"\u25B6 OpenCatan backend reachable at http://{ip}:8000", flush=True)
        print(f"  Pair it with the frontend at http://{ip}:5173/", flush=True)


@app.post("/games", response_model=CreateGameResponse)
def create_game(request: CreateGameRequest) -> CreateGameResponse:
    session = store.create_game([player.model_dump() for player in request.players])
    players = [
        PlayerSessionInfo(
            player_id=player_id,
            name=session.game.player_by_id(player_id).name,
            color=session.game.player_by_id(player_id).color,
            token=token,
        )
        for token, player_id in session.player_tokens.items()
    ]
    state = build_state_envelope(
        game_id=session.game_id,
        version=session.version,
        game=session.game,
    )
    return CreateGameResponse(
        game_id=session.game_id,
        version=session.version,
        players=players,
        state=state,
    )


@app.get("/games/{game_id}/state")
def get_game_state(game_id: str, player_token: str | None = None) -> dict:
    try:
        session = store.get(game_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Game not found") from exc

    player_id = None
    if player_token is not None:
        try:
            player_id = session.player_id_from_token(player_token)
        except ValueError as exc:
            raise HTTPException(status_code=401, detail="Invalid player token") from exc

    state = build_state_envelope(
        game_id=game_id,
        version=session.version,
        game=session.game,
        player_id=player_id,
    )
    return state.model_dump()


@app.post("/games/{game_id}/commands", response_model=CommandResponse)
async def execute_command(game_id: str, request: CommandRequest) -> CommandResponse:
    try:
        session = store.get(game_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Game not found") from exc

    try:
        player_id = session.player_id_from_token(request.player_token)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid player token") from exc

    try:
        result = session.execute(
            player_token=request.player_token,
            command=request.command,
            payload=request.payload,
            request_id=request.request_id,
            expected_version=request.expected_version,
        )
    except ValueError as exc:
        return CommandResponse(
            accepted=False,
            version=session.version,
            reason=str(exc),
            events=[],
        )

    if not result["accepted"]:
        return CommandResponse(
            accepted=False,
            version=result["version"],
            reason=result.get("reason"),
            events=result.get("events", []),
        )

    state = build_state_envelope(
        game_id=game_id,
        version=session.version,
        game=session.game,
        player_id=player_id,
    )
    public_state = build_state_envelope(
        game_id=game_id,
        version=session.version,
        game=session.game,
        player_id=None,
    )
    await hub.broadcast(
        game_id,
        {
            "type": "game_state_updated",
            "payload": {
                "game_id": game_id,
                "version": session.version,
                "events": result.get("events", []),
                "public_state": public_state.public_state,
            },
        },
    )

    return CommandResponse(
        accepted=True,
        version=result["version"],
        idempotent_replay=bool(result.get("idempotent_replay", False)),
        events=result.get("events", []),
        state=state,
    )


@app.websocket("/ws/games/{game_id}")
async def game_ws(game_id: str, websocket: WebSocket) -> None:
    try:
        session = store.get(game_id)
    except KeyError:
        await websocket.accept()
        await websocket.close(code=4404)
        return

    await hub.connect(game_id, websocket)
    try:
        await websocket.send_json(
            {
                "type": "connected",
                "payload": {"game_id": game_id, "version": session.version},
            }
        )
        while True:
            raw = await websocket.receive_text()
            try:
                message = WebSocketMessage.model_validate(json.loads(raw))
            except Exception:
                await websocket.send_json(
                    {
                        "type": "error",
                        "payload": {"message": "Invalid websocket message"},
                    }
                )
                continue

            if message.type == "ping":
                await websocket.send_json({"type": "pong", "payload": {}})
                continue

            if message.type == "snapshot":
                token = message.payload.get("player_token")
                player_id = None
                if token:
                    try:
                        player_id = session.player_id_from_token(token)
                    except ValueError:
                        await websocket.send_json(
                            {
                                "type": "error",
                                "payload": {"message": "Invalid player token"},
                            }
                        )
                        continue

                state = build_state_envelope(
                    game_id=game_id,
                    version=session.version,
                    game=session.game,
                    player_id=player_id,
                )
                await websocket.send_json(
                    {"type": "snapshot", "payload": state.model_dump()}
                )
                continue

            await websocket.send_json(
                {
                    "type": "error",
                    "payload": {"message": f"Unsupported message type: {message.type}"},
                }
            )

    except WebSocketDisconnect:
        hub.disconnect(game_id, websocket)


# ============================================================================
# Lobby / Room endpoints
# ============================================================================


def _room_state(room) -> RoomState:
    return RoomState.model_validate(room.to_public_dict())


async def _broadcast_room(room_id: str) -> None:
    room = lobby.get_room(room_id)
    if room is None:
        return
    await room_hub.broadcast(
        room.room_id,
        {"type": "room_updated", "payload": _room_state(room).model_dump()},
    )


@app.post("/rooms", response_model=RoomMembershipResponse)
def create_room(request: CreateRoomRequest) -> RoomMembershipResponse:
    try:
        room, host = lobby.create_room(request.name, request.color)
    except LobbyError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return RoomMembershipResponse(
        room=_room_state(room), player_token=host.player_token
    )


@app.get("/rooms/{room_id}", response_model=RoomStateResponse)
def get_room(room_id: str) -> RoomStateResponse:
    room = lobby.get_room(room_id)
    if room is None:
        raise HTTPException(status_code=404, detail="Room not found")
    return RoomStateResponse(room=_room_state(room))


@app.post("/rooms/{room_id}/join", response_model=RoomMembershipResponse)
async def join_room(
    room_id: str, request: JoinRoomRequest
) -> RoomMembershipResponse:
    try:
        room, player = lobby.join_room(room_id, request.name, request.color)
    except LobbyError as exc:
        # 404 for not-found, 400 for all other rule failures so the client
        # can distinguish "try a different code" from "try a different color".
        if "Room not found" in str(exc):
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    await _broadcast_room(room.room_id)
    return RoomMembershipResponse(
        room=_room_state(room), player_token=player.player_token
    )


@app.post("/rooms/{room_id}/color", response_model=RoomStateResponse)
async def change_room_color(
    room_id: str, request: ChangeColorRequest
) -> RoomStateResponse:
    try:
        room = lobby.change_color(room_id, request.player_token, request.color)
    except LobbyError as exc:
        status = 404 if "not found" in str(exc).lower() else 400
        raise HTTPException(status_code=status, detail=str(exc)) from exc
    await _broadcast_room(room.room_id)
    return RoomStateResponse(room=_room_state(room))


@app.post("/rooms/{room_id}/ready", response_model=RoomStateResponse)
async def set_ready(room_id: str, request: SetReadyRequest) -> RoomStateResponse:
    try:
        room = lobby.set_ready(room_id, request.player_token, request.ready)
    except LobbyError as exc:
        status = 404 if "not found" in str(exc).lower() else 400
        raise HTTPException(status_code=status, detail=str(exc)) from exc
    await _broadcast_room(room.room_id)
    return RoomStateResponse(room=_room_state(room))


@app.post("/rooms/{room_id}/leave")
async def leave_room(room_id: str, request: LeaveRoomRequest) -> dict:
    room = lobby.leave_room(room_id, request.player_token)
    if room is not None:
        await _broadcast_room(room.room_id)
    return {"ok": True}


@app.post("/rooms/{room_id}/start", response_model=StartGameResponse)
async def start_room_game(
    room_id: str, request: StartGameRequest
) -> StartGameResponse:
    try:
        room = lobby.start_game(room_id, request.player_token)
    except LobbyError as exc:
        status = 404 if "not found" in str(exc).lower() else 400
        raise HTTPException(status_code=status, detail=str(exc)) from exc

    assert room.game_id is not None
    host_game_token = room.lobby_to_game_token.get(request.player_token)
    if host_game_token is None:
        raise HTTPException(status_code=500, detail="Host token not mapped")

    # Notify every connected client: room is done, here is *your* game
    # token. We explicitly do NOT broadcast a shared payload here — doing
    # so would hand every other player's game token to anyone connected
    # to the room WS. Instead, iterate authenticated sockets and send
    # each one only the token it is entitled to.
    for socket, lobby_token in room_hub.members(room.room_id):
        game_token = room.lobby_to_game_token.get(lobby_token)
        if game_token is None:
            # Socket authenticated with a token that didn't end up in the
            # started game (shouldn't happen in practice). Skip silently
            # rather than leak anyone else's token.
            continue
        await room_hub.send_to(
            socket,
            {
                "type": "game_started",
                "payload": {
                    "game_id": room.game_id,
                    "game_token": game_token,
                },
            },
        )
    return StartGameResponse(game_id=room.game_id, game_token=host_game_token)


@app.websocket("/ws/rooms/{room_id}")
async def room_ws(
    room_id: str,
    websocket: WebSocket,
    player_token: str | None = Query(default=None),
) -> None:
    room = lobby.get_room(room_id)
    if room is None:
        await websocket.accept()
        await websocket.close(code=4404)
        return

    # Authenticate the socket against a known lobby token for this room.
    # Without this gate, anyone who learns a room code could subscribe to
    # room state updates and (post-Start) receive every player's game
    # token.
    if not player_token or not room.has_member(player_token):
        await websocket.accept()
        await websocket.close(code=4401)
        return

    await room_hub.connect(room.room_id, websocket, player_token)
    lobby.on_connect(room.room_id)
    try:
        await websocket.send_json(
            {"type": "room_snapshot", "payload": _room_state(room).model_dump()}
        )
        # If the game has already started by the time this socket connected
        # (refresh / reconnect / late-opened tab), replay the game_started
        # payload so the client can look up its own game_token and move on
        # to /ws/games/{game_id}. Without this, reconnecting players stay
        # stuck in the lobby forever. Send only this socket's own token.
        if room.game_id is not None:
            game_token = room.lobby_to_game_token.get(player_token)
            if game_token is not None:
                await websocket.send_json(
                    {
                        "type": "game_started",
                        "payload": {
                            "game_id": room.game_id,
                            "game_token": game_token,
                        },
                    }
                )
        while True:
            raw = await websocket.receive_text()
            try:
                message = WebSocketMessage.model_validate(json.loads(raw))
            except Exception:
                await websocket.send_json(
                    {
                        "type": "error",
                        "payload": {"message": "Invalid websocket message"},
                    }
                )
                continue

            if message.type == "ping":
                await websocket.send_json({"type": "pong", "payload": {}})
                continue

            if message.type == "snapshot":
                fresh = lobby.get_room(room.room_id)
                if fresh is None:
                    await websocket.send_json(
                        {
                            "type": "error",
                            "payload": {"message": "Room no longer exists"},
                        }
                    )
                    continue
                await websocket.send_json(
                    {
                        "type": "room_snapshot",
                        "payload": _room_state(fresh).model_dump(),
                    }
                )
                continue

            await websocket.send_json(
                {
                    "type": "error",
                    "payload": {"message": f"Unsupported message type: {message.type}"},
                }
            )
    except WebSocketDisconnect:
        pass
    finally:
        room_hub.disconnect(room.room_id, websocket)
        lobby.on_disconnect(room.room_id)
