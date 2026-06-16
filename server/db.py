"""SQLite persistence — missions, runs, chat sessions, and messages."""
from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

import aiosqlite

from .config import settings

_SCHEMA = """
CREATE TABLE IF NOT EXISTS missions (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    script      TEXT,
    summary     TEXT,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS runs (
    id              TEXT PRIMARY KEY,
    mission_id      TEXT REFERENCES missions(id) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'pending',
    script          TEXT,
    output_dir      TEXT,
    result_json     TEXT,
    error           TEXT,
    created_at      TEXT DEFAULT (datetime('now')),
    completed_at    TEXT
);

CREATE TABLE IF NOT EXISTS chat_sessions (
    id          TEXT PRIMARY KEY,
    mission_id  TEXT REFERENCES missions(id) ON DELETE CASCADE,
    name        TEXT NOT NULL DEFAULT 'New Chat',
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
    id          TEXT PRIMARY KEY,
    mission_id  TEXT REFERENCES missions(id) ON DELETE CASCADE,
    session_id  TEXT REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role        TEXT NOT NULL,
    content     TEXT NOT NULL,
    created_at  TEXT DEFAULT (datetime('now'))
);
"""


async def _migrate(db: aiosqlite.Connection) -> None:
    """Incremental migrations for existing databases (idempotent)."""
    async with db.execute("PRAGMA table_info(messages)") as cur:
        cols = {row[1] for row in await cur.fetchall()}
    if "session_id" not in cols:
        await db.execute("ALTER TABLE messages ADD COLUMN session_id TEXT")
        await db.commit()


async def init_db() -> None:
    settings.data_dir.mkdir(exist_ok=True)
    settings.workspaces_dir.mkdir(exist_ok=True)
    async with aiosqlite.connect(settings.db_path) as db:
        await db.executescript(_SCHEMA)
        await db.commit()
        await _migrate(db)


@asynccontextmanager
async def get_db() -> AsyncIterator[aiosqlite.Connection]:
    async with aiosqlite.connect(settings.db_path) as db:
        db.row_factory = aiosqlite.Row
        yield db


def new_id() -> str:
    return str(uuid.uuid4())


def row_to_dict(row: aiosqlite.Row) -> dict[str, Any]:
    return dict(row)
