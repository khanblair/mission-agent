"""DeepSeek API client — OpenAI-compatible interface."""
from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from typing import Any

from openai import AsyncOpenAI

from ..config import settings

logger = logging.getLogger(__name__)

_DEEPSEEK_BASE_URL = "https://api.deepseek.com"
_client: AsyncOpenAI | None = None


def get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        if not settings.deepseek_api_key:
            raise RuntimeError(
                "DEEPSEEK_API_KEY is not set. Add it to your .env file."
            )
        _client = AsyncOpenAI(
            api_key=settings.deepseek_api_key,
            base_url=_DEEPSEEK_BASE_URL,
        )
    return _client


async def stream_response(
    messages: list[dict[str, Any]],
    system: str,
    tools: list[dict[str, Any]] | None = None,
) -> AsyncIterator[tuple[str, Any]]:
    """Yield (event_type, data) tuples from a DeepSeek streaming response.

    event_type values:
      'text'     — data is a str chunk
      'tool_use' — data is {'id', 'name', 'input'}
      'stop'     — data is finish_reason str
    """
    client = get_client()

    all_messages = [{"role": "system", "content": system}] + messages

    kwargs: dict[str, Any] = {
        "model": settings.llm_model,
        "messages": all_messages,
        "max_tokens": settings.llm_max_tokens,
        "temperature": settings.llm_temperature,
        "stream": True,
    }
    if tools:
        kwargs["tools"] = tools

    stream = await client.chat.completions.create(**kwargs)

    tool_calls_buf: dict[int, dict[str, Any]] = {}

    async for chunk in stream:
        if not chunk.choices:
            continue
        choice = chunk.choices[0]
        delta = choice.delta
        finish_reason = choice.finish_reason

        if delta.content:
            yield "text", delta.content

        if delta.tool_calls:
            for tc_delta in delta.tool_calls:
                idx = tc_delta.index
                if idx not in tool_calls_buf:
                    tool_calls_buf[idx] = {"id": "", "name": "", "arguments": ""}
                if tc_delta.id:
                    tool_calls_buf[idx]["id"] = tc_delta.id
                if tc_delta.function:
                    if tc_delta.function.name:
                        tool_calls_buf[idx]["name"] = tc_delta.function.name
                    if tc_delta.function.arguments:
                        tool_calls_buf[idx]["arguments"] += tc_delta.function.arguments

        if finish_reason:
            for idx in sorted(tool_calls_buf.keys()):
                tc = tool_calls_buf[idx]
                try:
                    input_data = json.loads(tc["arguments"]) if tc["arguments"] else {}
                except json.JSONDecodeError:
                    input_data = {}
                yield "tool_use", {"id": tc["id"], "name": tc["name"], "input": input_data}
            yield "stop", finish_reason
            tool_calls_buf.clear()


async def simple_complete(prompt: str, system: str = "") -> str:
    """Non-streaming single completion for short tasks."""
    client = get_client()
    resp = await client.chat.completions.create(
        model=settings.llm_model,
        max_tokens=1024,
        messages=[
            {"role": "system", "content": system or "You are a helpful assistant."},
            {"role": "user", "content": prompt},
        ],
    )
    return resp.choices[0].message.content or ""
