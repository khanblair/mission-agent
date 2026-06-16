"""CRUD routes for chat sessions within a mission."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..db import get_db, new_id, row_to_dict

router = APIRouter()


class SessionCreate(BaseModel):
    name: str = "New Chat"


class SessionUpdate(BaseModel):
    name: str


@router.get("")
async def list_sessions(mission_id: str) -> list[dict[str, Any]]:
    async with get_db() as db:
        async with db.execute(
            "SELECT id, mission_id, name, created_at, updated_at "
            "FROM chat_sessions WHERE mission_id = ? ORDER BY created_at ASC",
            (mission_id,),
        ) as cur:
            rows = await cur.fetchall()
    return [row_to_dict(r) for r in rows]


@router.post("", status_code=201)
async def create_session(mission_id: str, body: SessionCreate) -> dict[str, Any]:
    sid = new_id()
    async with get_db() as db:
        await db.execute(
            "INSERT INTO chat_sessions (id, mission_id, name) VALUES (?, ?, ?)",
            (sid, mission_id, body.name),
        )
        await db.commit()
        async with db.execute(
            "SELECT id, mission_id, name, created_at, updated_at FROM chat_sessions WHERE id = ?",
            (sid,),
        ) as cur:
            row = await cur.fetchone()
    return row_to_dict(row)


@router.get("/{session_id}")
async def get_session(mission_id: str, session_id: str) -> dict[str, Any]:
    async with get_db() as db:
        async with db.execute(
            "SELECT id, mission_id, name, created_at, updated_at FROM chat_sessions WHERE id = ? AND mission_id = ?",
            (session_id, mission_id),
        ) as cur:
            row = await cur.fetchone()
        if not row:
            raise HTTPException(404, "Session not found")
        session = row_to_dict(row)

        async with db.execute(
            "SELECT id, role, content, created_at FROM messages "
            "WHERE session_id = ? ORDER BY created_at ASC",
            (session_id,),
        ) as cur:
            msgs = await cur.fetchall()
    session["messages"] = [row_to_dict(m) for m in msgs]
    return session


@router.patch("/{session_id}")
async def update_session(mission_id: str, session_id: str, body: SessionUpdate) -> dict[str, Any]:
    async with get_db() as db:
        await db.execute(
            "UPDATE chat_sessions SET name = ?, updated_at = datetime('now') WHERE id = ? AND mission_id = ?",
            (body.name, session_id, mission_id),
        )
        await db.commit()
        async with db.execute(
            "SELECT id, mission_id, name, created_at, updated_at FROM chat_sessions WHERE id = ?",
            (session_id,),
        ) as cur:
            row = await cur.fetchone()
    if not row:
        raise HTTPException(404, "Session not found")
    return row_to_dict(row)


@router.delete("/{session_id}", status_code=204)
async def delete_session(mission_id: str, session_id: str) -> None:
    async with get_db() as db:
        await db.execute(
            "DELETE FROM chat_sessions WHERE id = ? AND mission_id = ?",
            (session_id, mission_id),
        )
        await db.commit()
