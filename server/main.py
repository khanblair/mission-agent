"""FastAPI application — mounts routes, serves React build."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import settings
from .db import init_db
from .routes import chat, engine, missions, sessions


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="Mission Agent API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(missions.router, prefix="/api/missions", tags=["missions"])
app.include_router(sessions.router, prefix="/api/missions/{mission_id}/sessions", tags=["sessions"])
app.include_router(engine.router, prefix="/api/engine", tags=["engine"])
app.include_router(chat.router, tags=["chat"])

# Serve built React app (production mode)
if settings.web_dist_dir.exists():
    _assets = settings.web_dist_dir / "assets"
    if _assets.exists():
        app.mount("/assets", StaticFiles(directory=_assets), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        return FileResponse(settings.web_dist_dir / "index.html")
