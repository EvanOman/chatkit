"""FastAPI SSE utilities for streaming ChatEvents."""

from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Any

from .events import ChatEvent
from .models import SSEPayload


async def stream_chat_events(
    events: AsyncGenerator[ChatEvent, None],
) -> AsyncGenerator[dict[str, str], None]:
    """Convert a ChatEvent async generator into SSE payload dicts.

    Use with sse-starlette's EventSourceResponse:

        from sse_starlette import EventSourceResponse

        @app.post("/chat")
        async def chat(request: ChatRequest):
            events = backend.chat(request.thread_id, request.message, request.metadata)
            return EventSourceResponse(stream_chat_events(events), ping=15)
    """
    async for event in events:
        yield SSEPayload.from_chat_event(event).to_dict()
