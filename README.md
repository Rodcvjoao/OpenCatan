# OpenCatan

Monorepo with backend game logic/API (`back`) and frontend client (`front`).

## Start backend

```bash
cd back
uv sync --dev
uv run uvicorn catan.api.main:app --reload --port 8000
```

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
