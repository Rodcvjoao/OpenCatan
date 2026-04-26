# AGENTS.md

Guidelines for human/AI contributors in this repository.

## Goal

Keep OpenCatan easy to evolve: strong game rules in `back`, simple UI iteration in `front`, and docs that stay useful without bloat.

## Documentation Standard (no bloat)

We use a lightweight mix of two industry-standard approaches:

- Diataxis (practical split by user need)
  - Tutorial/How-to: root `README.md` (how to run)
  - Reference: `back/FRONTEND_CONTRACT.md` (API and protocol shape)
  - Explanation: short rationale sections in this file
- ADR-lite (decision records)
  - For major architecture changes, add a short "Decision" entry in this file
  - Keep each decision concise: context, decision, consequence

Rule: if a code change modifies behavior/contract, update docs in the same change.

## Monorepo Layout

- `back/`: Python game engine + FastAPI + WS API
- `front/`: browser client (Vite + TypeScript; entry `front/index.html`)

## Architecture Decisions (must follow)

### Decision 1: Backend-authoritative game

- Context: multiplayer rules and hidden information must remain consistent.
- Decision: frontend sends intents; backend validates and applies all rules.
- Consequence: frontend never assumes legality, and always handles rejected commands.

### Decision 2: Graph-first board model

- Context: Catan rules are graph problems (roads, adjacency, distance rule, production).
- Decision: board is vertices/edges/tiles with fixed topology constants.
- Consequence: do not replace with matrix/geometry generation for base board.

### Decision 3: Fixed topology, randomized layout

- Context: base Catan topology is static.
- Decision: hardcode topology; randomize only resources/tokens/ports.
- Consequence: keep topology constants authoritative in `back/catan/topology/standard_board.py`.

### Decision 4: HTTP + WebSocket hybrid

- Context: frontend needs both command execution and realtime updates.
- Decision: HTTP for create/state/commands; WS for game update notifications.
- Consequence: after WS `game_state_updated`, frontend should refresh state with token to get private data.

### Decision 5: Vite + TypeScript for frontend

- Context: the frontend was a single 3000-line `board.html` godfile, hard to evolve.
- Decision: the frontend is a Vite + TypeScript project under `front/`. Source lives in `front/src/` (state / net / ui / three layers). Static assets live in `front/public/`. Three.js is installed from npm; Tailwind is still loaded via CDN.
- Consequence: frontend development requires Node + npm. Run with `npm run dev` (port 5173). `AGENTS.md` "Development Workflow" below is authoritative.

## Contract and Integration Rules

Before touching frontend-backend integration, read:

- `back/FRONTEND_CONTRACT.md`

Hard rules:

- Keep command names and payloads in sync with `back/catan/api/schemas.py`.
- If response/state shape changes, update `back/FRONTEND_CONTRACT.md` immediately.
- Frontend command requests should send both:
  - `expected_version`
  - `request_id`
- Frontend should gate actions with server-provided legality when available.

## Frontend Geometry Rules (important)

To stay aligned with backend topology:

- Vertex angle for tile corner `i`: `-30deg + 60deg * i`
- Edge orientation from endpoint vector (`atan2(dz, dx)`)
- Road mesh rotation uses edge angle directly (no extra 90deg offset)

If these are changed, visually verify road/vertex alignment.

## Development Workflow

### Backend

- Use `uv` and `pyproject.toml` only.
- Run tests before finishing:
  - `cd back && uv run pytest catan/tests`
- Backend binds to all interfaces via `--host 0.0.0.0` so other PCs on the
  LAN can connect. It prints its reachable LAN URL on startup.

### Frontend

- Install and serve with Vite:
  - `cd front && npm install`
  - `cd front && npm run dev` (http://localhost:5173/)
- Typecheck: `cd front && npm run typecheck`
- Production build: `cd front && npm run build` (outputs to `front/dist/`)
- Static assets go in `front/public/` and are served at `/assets/...`.
- `vite.config.ts` sets `host: true` so both `npm run dev` and
  `npm run preview` bind to `0.0.0.0` — other LAN devices can connect via
  the host's IP.
- API URL is derived from `window.location.hostname` at runtime
  (`src/config.ts`); no rebuild is needed to switch between localhost and
  LAN access.
- Menu / lobby UI lives in `front/src/ui/menu/`. The Multiplayer Create /
  Join flow is backed by the `/rooms` endpoints and `/ws/rooms/{id}` — see
  `back/FRONTEND_CONTRACT.md` "Lobby (Rooms)" for the protocol.

## Quality Checklist for Agents

When submitting changes:

1. Keep scope tight and avoid unrelated edits.
2. Preserve existing architecture decisions unless explicitly changing them.
3. Add/update tests for behavior changes in `back`.
4. Update docs for contract or workflow changes.
5. Confirm manual run path still works from root README.

## Anti-bloat Rules

- Prefer one canonical doc per concern.
- Avoid duplicate docs with overlapping content.
- Keep examples small and executable.
- Remove stale instructions when behavior changes.
