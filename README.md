# OpenCatan

Monorepo with backend game logic/API (`back`) and frontend client (`front`).

## Start backend

```bash
cd back
uv sync --dev
uv run uvicorn catan.api.main:app --reload --host 0.0.0.0 --port 8000
```

On startup the backend prints its reachable LAN URL, e.g.
`▶ OpenCatan backend reachable at http://192.168.1.5:8000`.

## Start frontend

```bash
cd front
npm install
npm run dev
```

Open `http://localhost:5173/`.

Production build:

```bash
cd front
npm run build
npm run preview
```

## Play from another PC (same LAN)

Both servers bind to all interfaces, so any device on the same network can
connect to the host machine.

1. Find the host's LAN IP:
   - Linux/macOS: `ip addr show` or `ifconfig`
   - Windows: `ipconfig`
2. Share `http://<host-ip>:5173/` with the other PC's browser.
3. Make sure inbound TCP ports `5173` (frontend) and `8000` (backend) are
   open in the host's firewall. Examples:
   - Linux (ufw): `sudo ufw allow 5173,8000/tcp`
   - Windows: allow the prompts that appear on first bind.

The frontend derives its API URL from the hostname in the address bar, so
no rebuild or config change is required for LAN access.

> ⚠️ No authentication layer beyond per-player tokens. Only run on trusted
> networks.
