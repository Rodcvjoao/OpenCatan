from __future__ import annotations

import json
from collections import defaultdict

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from catan.api.runtime import InMemoryGameStore
from catan.api.schemas import (
    CommandRequest,
    CommandResponse,
    CreateGameRequest,
    CreateGameResponse,
    PlayerSessionInfo,
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

    player_id = session.player_id_from_token(request.player_token)
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
