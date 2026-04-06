# OpenCatan Backend API

Backend-authoritative game engine and realtime API for OpenCatan.

## Run

```bash
uv sync --dev
uv run uvicorn catan.api.main:app --reload --host 0.0.0.0 --port 8000
```

## Endpoints

- `GET /health`
- `POST /games`
- `GET /games/{game_id}/state?player_token=...`
- `POST /games/{game_id}/commands`
- `WS /ws/games/{game_id}`

## Quick flow

1. `POST /games` with 2-4 players
2. Save returned `game_id` and each player's `token`
3. Connect to `WS /ws/games/{game_id}`
4. Front sends commands via `POST /games/{game_id}/commands`
5. Backend broadcasts `game_state_updated` over WebSocket

## Command examples

```json
{
  "player_token": "...",
  "command": "roll_dice",
  "payload": {},
  "request_id": "client-optional-id",
  "expected_version": 1
}
```

```json
{
  "player_token": "...",
  "command": "build_road",
  "payload": { "edge_id": 10 }
}
```

## Tests

```bash
uv run pytest catan/tests
```
