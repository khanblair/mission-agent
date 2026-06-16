"""WebSocket chat route — streams agent responses to the frontend."""
from __future__ import annotations

import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ..agent.loop import AgentLoop
from ..db import get_db, new_id

router = APIRouter()
logger = logging.getLogger(__name__)


@router.websocket("/ws/chat/{mission_id}")
async def chat_ws(websocket: WebSocket, mission_id: str, session_id: str | None = None):
    await websocket.accept()

    # session_id must be provided and valid — never auto-create here.
    # The frontend always creates sessions explicitly via REST before connecting.
    if not session_id:
        await websocket.send_text(json.dumps({"type": "error", "content": "session_id required"}))
        await websocket.close(code=4000)
        return

    async with get_db() as db:
        async with db.execute(
            "SELECT id FROM chat_sessions WHERE id = ? AND mission_id = ?",
            (session_id, mission_id),
        ) as cur:
            row = await cur.fetchone()

    if not row:
        await websocket.send_text(json.dumps({"type": "error", "content": "Invalid session"}))
        await websocket.close(code=4001)
        return

    loop = AgentLoop(mission_id=mission_id)

    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)
            user_text = msg.get("content", "")

            if not user_text.strip():
                continue

            # Auto-name session from first user message if still "New Chat"
            async with get_db() as db:
                async with db.execute(
                    "SELECT name FROM chat_sessions WHERE id = ?", (session_id,)
                ) as cur:
                    srow = await cur.fetchone()
                if srow and srow["name"] == "New Chat":
                    auto_name = user_text[:40].strip()
                    await db.execute(
                        "UPDATE chat_sessions SET name = ?, updated_at = datetime('now') WHERE id = ?",
                        (auto_name, session_id),
                    )
                await db.execute(
                    "INSERT INTO messages (id, mission_id, session_id, role, content) "
                    "VALUES (?, ?, ?, 'user', ?)",
                    (new_id(), mission_id, session_id, user_text),
                )
                await db.commit()

            # Stream agent response
            full_response = []
            async for chunk in loop.run(user_text):
                full_response.append(chunk)
                await websocket.send_text(json.dumps({"type": "chunk", "content": chunk}))

            assistant_text = "".join(full_response)

            async with get_db() as db:
                await db.execute(
                    "INSERT INTO messages (id, mission_id, session_id, role, content) "
                    "VALUES (?, ?, ?, 'assistant', ?)",
                    (new_id(), mission_id, session_id, assistant_text),
                )
                await db.commit()

            # Persist generated script back to the mission row
            run_data = loop.last_run_data
            if run_data and run_data.get("script"):
                async with get_db() as db:
                    await db.execute(
                        "UPDATE missions SET script = ?, updated_at = datetime('now') WHERE id = ?",
                        (run_data["script"], mission_id),
                    )
                    await db.commit()

            await websocket.send_text(json.dumps({"type": "done", "run_data": run_data}))
            loop.last_run_data = None

    except WebSocketDisconnect:
        logger.info("Chat WS disconnected for mission %s / session %s", mission_id, session_id)
    except Exception as exc:
        logger.exception("Chat WS error: %s", exc)
        try:
            await websocket.send_text(json.dumps({"type": "error", "content": str(exc)}))
        except Exception:
            pass
