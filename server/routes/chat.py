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
async def chat_ws(websocket: WebSocket, mission_id: str):
    await websocket.accept()
    loop = AgentLoop(mission_id=mission_id)

    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)
            user_text = msg.get("content", "")

            if not user_text.strip():
                continue

            # Persist user message
            async with get_db() as db:
                await db.execute(
                    "INSERT INTO messages (id, mission_id, role, content) VALUES (?, ?, 'user', ?)",
                    (new_id(), mission_id, user_text),
                )
                await db.commit()

            # Stream agent response
            full_response = []
            async for chunk in loop.run(user_text):
                full_response.append(chunk)
                await websocket.send_text(json.dumps({"type": "chunk", "content": chunk}))

            assistant_text = "".join(full_response)

            # Persist assistant message
            async with get_db() as db:
                await db.execute(
                    "INSERT INTO messages (id, mission_id, role, content) VALUES (?, ?, 'assistant', ?)",
                    (new_id(), mission_id, assistant_text),
                )
                await db.commit()

            # Send completion signal with any attached data (script, run results)
            await websocket.send_text(
                json.dumps({"type": "done", "run_data": loop.last_run_data})
            )
            loop.last_run_data = None

    except WebSocketDisconnect:
        logger.info("Chat WS disconnected for mission %s", mission_id)
    except Exception as exc:
        logger.exception("Chat WS error: %s", exc)
        try:
            await websocket.send_text(json.dumps({"type": "error", "content": str(exc)}))
        except Exception:
            pass
