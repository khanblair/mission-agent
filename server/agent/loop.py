"""ReAct agent loop — plan → act → observe → respond."""
from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from typing import Any

from ..config import settings
from .llm import stream_response
from .tools import TOOL_SCHEMAS, execute_tool

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT: str | None = None
_SCRIPT_GEN_GUIDE: str | None = None


def _load_prompts() -> tuple[str, str]:
    global _SYSTEM_PROMPT, _SCRIPT_GEN_GUIDE
    if _SYSTEM_PROMPT is None:
        _SYSTEM_PROMPT = (settings.prompts_dir / "system.md").read_text()
    if _SCRIPT_GEN_GUIDE is None:
        _SCRIPT_GEN_GUIDE = (settings.prompts_dir / "script_gen.md").read_text()
    return _SYSTEM_PROMPT, _SCRIPT_GEN_GUIDE


class AgentLoop:
    def __init__(self, mission_id: str):
        self.mission_id = mission_id
        self.history: list[dict[str, Any]] = []
        self.last_run_data: dict[str, Any] | None = None

    async def run(self, user_message: str) -> AsyncIterator[str]:
        """Run one turn of the ReAct loop, streaming text back."""
        system, guide = _load_prompts()
        full_system = f"{system}\n\n---\n\n## Script Generation Reference\n\n{guide}"

        self.history.append({"role": "user", "content": user_message})
        messages = list(self.history)

        max_iterations = 8
        iteration = 0
        last_text: list[str] = []

        while iteration < max_iterations:
            iteration += 1
            text_chunks: list[str] = []
            tool_calls: list[dict[str, Any]] = []
            stop_reason: str = "stop"

            async for event_type, data in stream_response(
                messages=messages, system=full_system, tools=TOOL_SCHEMAS
            ):
                if event_type == "text":
                    text_chunks.append(data)
                    yield data
                elif event_type == "tool_use":
                    tool_calls.append(data)
                elif event_type == "stop":
                    stop_reason = data

            last_text = text_chunks

            # Build OpenAI-format assistant message
            assistant_msg: dict[str, Any] = {"role": "assistant"}
            if text_chunks:
                assistant_msg["content"] = "".join(text_chunks)
            if tool_calls:
                assistant_msg["tool_calls"] = [
                    {
                        "id": tc["id"],
                        "type": "function",
                        "function": {
                            "name": tc["name"],
                            "arguments": json.dumps(tc["input"]),
                        },
                    }
                    for tc in tool_calls
                ]

            messages.append(assistant_msg)

            if not tool_calls or stop_reason in ("stop", "end_turn"):
                break

            # Execute tools and append results as individual tool messages
            for tc in tool_calls:
                logger.info("Executing tool: %s(%s)", tc["name"], list(tc["input"].keys()))
                try:
                    result = await execute_tool(tc["name"], tc["input"])
                    if tc["name"] == "run_script" and "run_id" in result:
                        self.last_run_data = result
                except Exception as exc:
                    result = {"error": str(exc)}

                messages.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": json.dumps(result),
                })

                if tc["name"] == "run_script":
                    yield "\n\n*Running orbital simulation…*\n\n"
                elif tc["name"] == "validate_script":
                    if result.get("ok"):
                        yield "\n\n*Script validated — no issues.*\n\n"
                    else:
                        errs = "; ".join(result.get("errors", []))
                        yield f"\n\n*Validation issues: {errs}*\n\n"

        self.history.append({"role": "assistant", "content": "".join(last_text)})
