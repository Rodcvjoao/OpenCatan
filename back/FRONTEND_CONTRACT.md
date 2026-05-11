# Frontend Integration Contract

Canonical contract for `front` <-> `back` integration.

This document reflects the current backend implementation in:

- `catan/api/server.py`
- `catan/api/schemas.py`
- `catan/api/runtime.py`
- `catan/api/serialize.py`

## Base URLs

- HTTP: `http://localhost:8000`
- WS: `ws://localhost:8000`

## Transport Model

- Backend is authoritative.
- Frontend sends intent commands only.
- Frontend renders server snapshots.
- Use HTTP for create/state/commands.
- Use WebSocket for realtime notifications.

## Endpoints

- `GET /health`
- `POST /games`
- `POST /games/{game_id}/return-to-lobby`
- `GET /games/{game_id}/state?player_token=...`
- `POST /games/{game_id}/commands`
- `WS /ws/games/{game_id}`

## Game Bootstrap

1. Call `POST /games` with 2-4 players.
2. Persist `game_id` + each `player.token`.
3. Connect to `WS /ws/games/{game_id}`.
4. Immediately request WS snapshot (include `player_token`) and/or call `GET /state`.

Create-game request example:

```json
{
  "players": [
    { "name": "Alice", "color": "red" },
    { "name": "Bob", "color": "blue" }
  ]
}
```

Create-game response includes:

- `game_id`
- `version`
- `players[]` with `player_id`, `name`, `color`, `token`
- initial `state` envelope

Default colors (if omitted):

- `red`, `blue`, `white`, `orange`

## Return To Lobby

After `public_state.phase` becomes `FINISHED`, a client may enter the return
lobby for that finished game.

Request:

```json
{
  "player_token": "..."
}
```

Response:

```json
{
  "room": { "...": "..." },
  "player_token": "<this player's lobby token>"
}
```

Rules:

- The request is only valid for games started from a room.
- The request is rejected before the game reaches `FINISHED`.
- The first valid request creates a return lobby for the finished game. If
  the game came from an existing room, that room code is reused when it is
  still available; otherwise a new room code is generated.
- The returning player receives a new lobby token.
- Later requests from other players in the finished game add only that
  returning player to the same return lobby with their own new lobby token.
- Return lobbies do not accept public `POST /rooms/{room_id}/join` requests;
  players must enter through this endpoint with a finished-game token.
- Players who do not call this endpoint are not shown in the return lobby.
- Clients should resume the returned lobby as host or guest based on their
  player entry in `room.players`.

## State Envelope

Returned by:

- `GET /games/{game_id}/state`
- successful `POST /commands` (as `response.state`)
- WS `snapshot` response payload

Shape:

```json
{
  "game_id": "...",
  "version": 1,
  "public_state": { ... },
  "private_state": { ... } | null
}
```

`private_state` is `null` unless a valid `player_token` is provided.

## Public State Fields (important)

- `phase`: `SETUP_1 | SETUP_2 | MAIN | FINISHED`
- `turn`:
  - `number`
  - `current_player_id`
  - `turn_phase`: `ROLL | TRADE | BUILD | END`
  - `last_roll`
  - `last_roll_dice`: `[die1, die2] | null`
- `board`:
  - `robber_tile_id`
  - `tiles[]`: `id`, `resource`, `number_token`, `vertex_ids[6]`, `edge_ids[6]`, `has_robber`
  - `vertices[]`: `id`, adjacency, `port_id`, `building`
  - `edges[]`: `id`, `v1`, `v2`, `adjacent_tile_ids`, `road`
  - `ports[]`: `id`, `port_type`, `trade_ratio`, `vertex_ids[2]`
- `players[]`:
  - `id`, `name`, `color`
  - `resource_count`, `dev_card_count`
  - `roads`, `settlements`, `cities`
  - `victory_points` (publicly visible points; hidden VP cards are excluded until game end)
  - `played_knights`, `has_longest_road`, `has_largest_army`
- `bank`: resource counts + dev cards remaining
- `pending`:
  - `pending_discards` (map `player_id -> required_count`)
  - `robber_move_required` (bool)
  - `pending_trade_offer` (or `null`)
  - `setup`: round/order/index/pending road player

## Private State Fields (important)

- `player_id`
- `resources` (exact hand by resource)
- `dev_cards` (exact cards)
- `new_dev_cards_this_turn` (unplayable this turn)
- `victory_points` (this player's true total, including hidden VP cards)
- `legal_actions` (authoritative UI enablement)

Frontend should gate buttons/actions from `legal_actions` first.

## Command Request/Response

Request:

```json
{
  "player_token": "...",
  "command": "roll_dice",
  "payload": {},
  "request_id": "optional-idempotency-key",
  "expected_version": 3
}
```

Response:

```json
{
  "accepted": true,
  "version": 4,
  "reason": null,
  "idempotent_replay": false,
  "events": [ ... ],
  "state": { ... }
}
```

On rejection:

- `accepted = false`
- `reason` explains why
- HTTP status is still `200` for rule-level rejections
- invalid token is `401`; missing game is `404`

## Command Enum (exact names)

- `place_setup_settlement`
- `place_setup_road`
- `discard_resources`
- `roll_dice`
- `move_robber`
- `build_road`
- `build_settlement`
- `build_city`
- `buy_development_card`
- `play_development_card`
- `trade_bank`
- `propose_trade_offer`
- `respond_trade_offer`
- `cancel_trade_offer`
- `end_turn`

## Payload Contracts

### Setup / Build / Turn

- `place_setup_settlement`: `{ "vertex_id": int }`
- `place_setup_road`: `{ "edge_id": int }`
- `build_settlement`: `{ "vertex_id": int }`
- `build_city`: `{ "vertex_id": int }`
- `build_road`: `{ "edge_id": int }`
- `roll_dice`: `{}`
- `end_turn`: `{}`

### Roll 7 Discard Flow

- `discard_resources`:

```json
{ "resources": { "brick": 2, "wool": 1 } }
```

Resource keys are case-insensitive enum names.

### Robber

- `move_robber`:

```json
{ "tile_id": 5, "victim_id": 2 }
```

`victim_id` optional.

### Development Cards

- `buy_development_card`: `{}`

- `play_development_card`:

```json
{
  "card_type": "knight",
  "args": { "tile_id": 7, "victim_id": 2 }
}
```

`card_type` values:

- `knight`
- `road_building`
- `year_of_plenty`
- `monopoly`
- `victory_point` (cannot be actively played; backend rejects)

`args` by card:

- `knight`: `{ "tile_id": int, "victim_id"?: int }`
- `road_building`: `{ "edge_ids": [int, int] }`
- `year_of_plenty`: `{ "resources": ["brick", "ore"] }`
- `monopoly`: `{ "resource": "wool" }`

### Bank Trade

- `trade_bank`:

```json
{
  "give": { "brick": 4 },
  "receive": { "ore": 1 }
}
```

### Two-step Player Trade

- `propose_trade_offer`:

```json
{
  "to_player_id": 2,
  "give": { "brick": 1 },
  "receive": { "wool": 1 }
}
```

- `respond_trade_offer`:

```json
{ "offer_id": "...", "accept": true }
```

- `cancel_trade_offer`:

```json
{ "offer_id": "..." }
```

## WebSocket Contract

Connect:

- `WS /ws/games/{game_id}`

Server -> client messages:

- `connected`
- `snapshot`
- `game_state_updated`
- `error`
- `pong`

Client -> server messages:

- `{"type":"ping","payload":{}}`
- `{"type":"snapshot","payload":{"player_token":"..."}}`

Important:

- `game_state_updated` contains public state only.
- Frontend should re-fetch `GET /state?player_token=...` after update to refresh private hand/legal actions.

## Lobby (Rooms)

A pre-game lobby where players gather, pick unique colors, mark ready, and
the host presses Start to create the real game. Rooms are identified by a
short 6-character alphanumeric code (uppercase). Room codes are
case-insensitive.

### Endpoints

- `POST /rooms` — create a room.
  - Body: `{ "name": "Alice", "color": "red" }`
  - Returns: `{ "room": RoomState, "player_token": "..." }` — persist the
    `player_token` client-side; it authenticates the player _within the
    lobby_ only.
- `GET /rooms/{room_id}` — fetch current room state (public, no tokens).
  - Returns: `{ "room": RoomState }`
  - `404` if unknown.
- `POST /rooms/{room_id}/join` — join as a guest.
  - Body: `{ "name": "Bob", "color": "blue" }`
  - Returns: `{ "room": RoomState, "player_token": "..." }`
  - `400` on duplicate color / full / already-started / return lobby;
    `404` on unknown room.
- `POST /rooms/{room_id}/color` — change your color.
  - Body: `{ "player_token": "...", "color": "white" }`
  - `400` on duplicate.
- `POST /rooms/{room_id}/ready` — toggle ready state for a guest. Host is
  always ready; the server silently enforces this.
  - Body: `{ "player_token": "...", "ready": true }`
- `POST /rooms/{room_id}/leave` — leave the room. If the host leaves, the
  oldest remaining player is auto-promoted.
  - Body: `{ "player_token": "..." }`
- `POST /rooms/{room_id}/start` — host creates the real game.
  - Body: `{ "player_token": "..." }`
  - `400` unless there are 2-4 players and every player is ready.
  - Returns: `{ "game_id": "...", "game_token": "..." }` (the caller's
    game token). Other players receive their game tokens via the
    `game_started` WebSocket broadcast.

### RoomState shape

```json
{
  "room_id": "ABCDEF",
  "players": [
    { "name": "Alice", "color": "red",  "ready": true,  "is_host": true },
    { "name": "Bob",   "color": "blue", "ready": false, "is_host": false }
  ],
  "game_id": null,
  "created_at": 1700000000.0
}
```

Player tokens are **never** included in room state payloads.

### Room WebSocket

- Connect: `WS /ws/rooms/{room_id}?player_token=...` — the lobby
  `player_token` returned by `POST /rooms` or `POST /rooms/{id}/join` is
  required. Unauthenticated sockets are closed with code `4401`, and
  unknown rooms close with code `4404`.
- Server -> client messages:
  - `room_snapshot` — full room state on connect and in response to
    client `snapshot` requests.
  - `room_updated` — broadcast on any state mutation.
  - `game_started` — sent when the host presses Start. Each connected
    client receives a payload targeted to *their* token only — the full
    lobby→game token map is never broadcast. Also re-sent to any socket
    that connects *after* Start (refresh / reconnect / late tab)
    immediately after its `room_snapshot`, so a reconnecting player can
    still discover their `game_token`.
    - Payload: `{ "game_id": "...", "game_token": "<this client's token>" }`
    - Clients use `payload.game_token` directly and transition into the
      game via the existing `/ws/games/{game_id}` flow.
  - `error`, `pong`.
- Client -> server:
  - `{"type":"ping","payload":{}}`
  - `{"type":"snapshot","payload":{}}`

### Lifecycle

- Rooms with no active WebSocket connections and no mutations for 5
  minutes are garbage-collected lazily on the next API call.
- Once `game_started` has fired the room becomes read-only (no more
  joins / color changes / ready toggles) until a finished game is reopened
  through `POST /games/{game_id}/return-to-lobby`.

## Recommended Frontend Sync Logic

1. On every command send `expected_version` = current local version.
2. Include unique `request_id` to make retries idempotent.
3. If command rejected with version mismatch, immediately refetch state.
4. After any accepted command, trust returned `state` and replace local snapshot.
5. On WS `game_state_updated`, refresh full state via REST for private updates.

## Game Flow Notes

- Setup is strict snake order and enforced server-side.
- On roll `7`, required players must discard before robber moves.
- Build/trade/dev actions require legal turn state.
- Development cards bought this turn are not playable this turn.
- One non-victory development card per turn.
- Victory point cards are passive.

## UI Guidance

- Use `private_state.legal_actions` as primary button/interaction gating.
- Use `public_state.pending` for overlays/modals:
  - discard modal
  - robber-required prompt
  - incoming trade offer modal
- Show backend `reason` in toast on rejected command.

## Limits and Current Scope

- In-memory sessions only (server restart resets matches).
- No auth beyond `player_token`.
- No persistence/replay API yet.
