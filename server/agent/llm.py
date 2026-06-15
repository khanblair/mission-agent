"""Claude API client — the single module that requires an internet connection."""
from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from typing import Any

import anthropic

from ..config import settings

logger = logging.getLogger(__name__)

_client: anthropic.AsyncAnthropic | None = None


def get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        if not settings.anthropic_api_key:
            raise RuntimeError(
                "ANTHROPIC_API_KEY is not set. Add it to your .env file."
            )
        _client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _client


async def stream_response(
    messages: list[dict[str, Any]],
    system: str,
    tools: list[dict[str, Any]] | None = None,
) -> AsyncIterator[tuple[str, Any]]:
    """Yield (event_type, data) pairs from a Claude streaming response.

    event_type values:
      'text'     — data is a str chunk
      'tool_use' — data is {'id', 'name', 'input'}
      'stop'     — data is stop_reason str
    """
    client = get_client()
    kwargs: dict[str, Any] = {
        "model": settings.llm_model,
        "max_tokens": settings.llm_max_tokens,
        "temperature": settings.llm_temperature,
        "system": system,
        "messages": messages,
    }
    if tools:
        kwargs["tools"] = tools

    async with client.messages.stream(**kwargs) as stream:
        current_tool: dict[str, Any] | None = None
        tool_input_buf: str = ""

        async for event in stream:
            etype = event.type

            if etype == "content_block_start":
                block = event.content_block
                if block.type == "tool_use":
                    current_tool = {"id": block.id, "name": block.name, "input": {}}
                    tool_input_buf = ""

            elif etype == "content_block_delta":
                delta = event.delta
                if delta.type == "text_delta":
                    yield "text", delta.text
                elif delta.type == "input_json_delta" and current_tool is not None:
                    tool_input_buf += delta.partial_json

            elif etype == "content_block_stop":
                if current_tool is not None:
                    import json

                    try:
                        current_tool["input"] = json.loads(tool_input_buf) if tool_input_buf else {}
                    except json.JSONDecodeError:
                        current_tool["input"] = {}
                    yield "tool_use", current_tool
                    current_tool = None
                    tool_input_buf = ""

            elif etype == "message_delta":
                if hasattr(event, "delta") and hasattr(event.delta, "stop_reason"):
                    yield "stop", event.delta.stop_reason


async def simple_complete(prompt: str, system: str = "") -> str:
    """Non-streaming single completion for short tasks."""
    client = get_client()
    msg = await client.messages.create(
        model=settings.llm_model,
        max_tokens=1024,
        system=system or "You are a helpful assistant.",
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text if msg.content else ""
