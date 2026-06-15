# Mission Agent

AI-native spacecraft mission design — powered by NASA GMAT, driven by natural language.

## Quick start

```bash
# 1. Install Python deps
pip install -e .

# 2. Copy and fill env
cp .env.example .env
# edit .env → add DEEPSEEK_API_KEY=sk-...

# 3. Install web deps and start
cd web && npm install && cd ..
python run.py
```

The app opens at http://127.0.0.1:8000.

## Dev mode (backend + frontend separately)

```bash
# Terminal 1 — Python API (backend, port 8000)
uvicorn server.main:app --reload

# Terminal 2 — Vite dev server (frontend, port 5173)
cd web && npm run dev
```

Open http://localhost:5173 in dev mode (Vite proxies `/api` and `/ws` to the backend automatically).

## GMAT

Set the correct path in `config.yaml`. If GMAT is not installed, the engine runs in
**mock mode** and returns realistic Keplerian propagation data for development.

## Architecture

```
server/engine/   ← only code that touches GMAT (never modify)
server/agent/    ← AI loop: intent → script → validate → run → explain
server/routes/   ← thin FastAPI HTTP + WebSocket wiring
server/templates/ ← validated GMAT scripts (the moat)
web/             ← React + Vite + CesiumJS workspace
```
