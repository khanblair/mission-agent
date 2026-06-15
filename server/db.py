"""SQLite persistence — missions, runs, and chat messages."""
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

CREATE TABLE IF NOT EXISTS messages (
    id          TEXT PRIMARY KEY,
    mission_id  TEXT REFERENCES missions(id) ON DELETE CASCADE,
    role        TEXT NOT NULL,
    content     TEXT NOT NULL,
    created_at  TEXT DEFAULT (datetime('now'))
);
"""


async def init_db() -> None:
    settings.data_dir.mkdir(exist_ok=True)
    settings.workspaces_dir.mkdir(exist_ok=True)
    async with aiosqlite.connect(settings.db_path) as db:
        await db.executescript(_SCHEMA)
        await db.commit()


@asynccontextmanager
async def get_db() -> AsyncIterator[aiosqlite.Connection]:
    async with aiosqlite.connect(settings.db_path) as db:
        db.row_factory = aiosqlite.Row
        yield db


def new_id() -> str:
    return str(uuid.uuid4())


def row_to_dict(row: aiosqlite.Row) -> dict[str, Any]:
    return dict(row)
