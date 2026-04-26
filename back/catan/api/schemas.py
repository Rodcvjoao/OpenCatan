from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class CommandType(str, Enum):
    PLACE_SETUP_SETTLEMENT = "place_setup_settlement"
    PLACE_SETUP_ROAD = "place_setup_road"
    DISCARD_RESOURCES = "discard_resources"
    ROLL_DICE = "roll_dice"
    MOVE_ROBBER = "move_robber"
    BUILD_ROAD = "build_road"
    BUILD_SETTLEMENT = "build_settlement"
    BUILD_CITY = "build_city"
    BUY_DEV_CARD = "buy_development_card"
    PLAY_DEV_CARD = "play_development_card"
    TRADE_BANK = "trade_bank"
    PROPOSE_TRADE_OFFER = "propose_trade_offer"
    RESPOND_TRADE_OFFER = "respond_trade_offer"
    CANCEL_TRADE_OFFER = "cancel_trade_offer"
    END_TURN = "end_turn"


class CreatePlayerRequest(BaseModel):
    name: str = Field(min_length=1, max_length=32)
    color: str | None = Field(default=None, min_length=1, max_length=32)


class CreateGameRequest(BaseModel):
    players: list[CreatePlayerRequest] = Field(min_length=2, max_length=4)


class PlayerSessionInfo(BaseModel):
    player_id: int
    name: str
    color: str
    token: str


class StateEnvelope(BaseModel):
    game_id: str
    version: int
    public_state: dict[str, Any]
    private_state: dict[str, Any] | None = None


class CreateGameResponse(BaseModel):
    game_id: str
    version: int
    players: list[PlayerSessionInfo]
    state: StateEnvelope


class CommandRequest(BaseModel):
    player_token: str = Field(min_length=1)
    command: CommandType
    payload: dict[str, Any] = Field(default_factory=dict)
    request_id: str | None = None
    expected_version: int | None = None


class CommandResponse(BaseModel):
    accepted: bool
    version: int
    reason: str | None = None
    idempotent_replay: bool = False
    events: list[dict[str, Any]] = Field(default_factory=list)
    state: StateEnvelope | None = None


class WebSocketMessage(BaseModel):
    type: str
    payload: dict[str, Any] = Field(default_factory=dict)


# ======== Lobby / room schemas ========


class RoomPlayer(BaseModel):
    name: str
    color: str
    ready: bool
    is_host: bool


class RoomState(BaseModel):
    room_id: str
    players: list[RoomPlayer]
    game_id: str | None = None
    created_at: float


class CreateRoomRequest(BaseModel):
    name: str = Field(min_length=1, max_length=32)
    color: str = Field(min_length=1, max_length=32)


class JoinRoomRequest(BaseModel):
    name: str = Field(min_length=1, max_length=32)
    color: str = Field(min_length=1, max_length=32)


class ChangeColorRequest(BaseModel):
    player_token: str = Field(min_length=1)
    color: str = Field(min_length=1, max_length=32)


class SetReadyRequest(BaseModel):
    player_token: str = Field(min_length=1)
    ready: bool


class LeaveRoomRequest(BaseModel):
    player_token: str = Field(min_length=1)


class StartGameRequest(BaseModel):
    player_token: str = Field(min_length=1)


class RoomMembershipResponse(BaseModel):
    """Returned to the owner of a newly-created or just-joined player slot."""

    room: RoomState
    player_token: str


class RoomStateResponse(BaseModel):
    room: RoomState


class StartGameResponse(BaseModel):
    game_id: str
    # The game token for the player who called Start. Other players learn
    # their own tokens via the `game_started` WebSocket broadcast.
    game_token: str
