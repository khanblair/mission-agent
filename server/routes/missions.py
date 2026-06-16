"""CRUD routes for missions."""
from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..db import get_db, new_id, row_to_dict

router = APIRouter()


class MissionCreate(BaseModel):
    name: str
    script: str | None = None


class MissionUpdate(BaseModel):
    name: str | None = None
    script: str | None = None
    summary: str | None = None


@router.get("")
async def list_missions() -> list[dict[str, Any]]:
    async with get_db() as db:
        async with db.execute(
            "SELECT id, name, summary, created_at, updated_at FROM missions ORDER BY created_at DESC"
        ) as cur:
            rows = await cur.fetchall()
    return [row_to_dict(r) for r in rows]


@router.post("", status_code=201)
async def create_mission(body: MissionCreate) -> dict[str, Any]:
    mid = new_id()
    async with get_db() as db:
        await db.execute(
            "INSERT INTO missions (id, name, script) VALUES (?, ?, ?)",
            (mid, body.name, body.script),
        )
        await db.commit()
        async with db.execute("SELECT * FROM missions WHERE id = ?", (mid,)) as cur:
            row = await cur.fetchone()
    return row_to_dict(row)


@router.get("/{mission_id}")
async def get_mission(mission_id: str) -> dict[str, Any]:
    async with get_db() as db:
        async with db.execute("SELECT * FROM missions WHERE id = ?", (mission_id,)) as cur:
            row = await cur.fetchone()
    if not row:
        raise HTTPException(404, "Mission not found")
    mission = row_to_dict(row)

    # Attach messages
    async with get_db() as db:
        async with db.execute(
            "SELECT role, content, created_at FROM messages WHERE mission_id = ? ORDER BY created_at",
            (mission_id,),
        ) as cur:
            msgs = await cur.fetchall()
    mission["messages"] = [row_to_dict(m) for m in msgs]
    return mission


@router.patch("/{mission_id}")
async def update_mission(mission_id: str, body: MissionUpdate) -> dict[str, Any]:
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(400, "No fields to update")
    set_clause = ", ".join(f"{k} = ?" for k in updates)
    values = list(updates.values()) + [mission_id]
    async with get_db() as db:
        await db.execute(
            f"UPDATE missions SET {set_clause}, updated_at = datetime('now') WHERE id = ?",
            values,
        )
        await db.commit()
        async with db.execute("SELECT * FROM missions WHERE id = ?", (mission_id,)) as cur:
            row = await cur.fetchone()
    if not row:
        raise HTTPException(404, "Mission not found")
    return row_to_dict(row)


@router.delete("/{mission_id}", status_code=204)
async def delete_mission(mission_id: str) -> None:
    async with get_db() as db:
        await db.execute("DELETE FROM missions WHERE id = ?", (mission_id,))
        await db.commit()


@router.get("/{mission_id}/runs")
async def list_runs(mission_id: str) -> list[dict[str, Any]]:
    async with get_db() as db:
        async with db.execute(
            "SELECT * FROM runs WHERE mission_id = ? ORDER BY created_at DESC",
            (mission_id,),
        ) as cur:
            rows = await cur.fetchall()

    result = []
    for row in rows:
        d = row_to_dict(row)
        raw = d.pop("result_json", None)
        d["result"] = json.loads(raw) if raw else None
        result.append(d)
    return result
