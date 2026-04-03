"""Chat event types and the ChatEvent dataclass."""

from __future__ import annotations

import json
from dataclasses import dataclass
from enum import StrEnum
from typing import Any


class ChatEventType(StrEnum):
    """All SSE event types in the chatkit protocol."""

    INIT = "init"
    TEXT = "text"
    STATUS = "status"
    CODE = "code"
    TOOL_USE = "tool_use"
    TOOL_DONE = "tool_done"
    ARTIFACT = "artifact"
    ERROR = "error"
    DONE = "done"


@dataclass(slots=True, frozen=True)
class ChatEvent:
    """An immutable event yielded during chat streaming.

    The `data` field is always a string. For structured event types (init,
    tool_use, tool_done, artifact, done), it contains JSON-encoded data.
    For text/status/code/error, it is a plain string.
    """

    type: ChatEventType
    data: str = ""

    # --- Factory classmethods (replace per-event sse_* helper functions) ---

    @classmethod
    def init(cls, thread_id: str, protocol_version: int = 1) -> ChatEvent:
        return cls(
            type=ChatEventType.INIT,
            data=json.dumps(
                {"thread_id": thread_id, "protocol_version": protocol_version}
            ),
        )

    @classmethod
    def text(cls, content: str) -> ChatEvent:
        return cls(type=ChatEventType.TEXT, data=content)

    @classmethod
    def status(cls, message: str) -> ChatEvent:
        return cls(type=ChatEventType.STATUS, data=message)

    @classmethod
    def code(cls, source: str) -> ChatEvent:
        return cls(type=ChatEventType.CODE, data=source)

    @classmethod
    def tool_use(cls, tool: str, input_data: dict[str, Any]) -> ChatEvent:
        return cls(
            type=ChatEventType.TOOL_USE,
            data=json.dumps({"tool": tool, "input": input_data}),
        )

    @classmethod
    def tool_done(cls, tool: str, summary: str) -> ChatEvent:
        return cls(
            type=ChatEventType.TOOL_DONE,
            data=json.dumps({"tool": tool, "summary": summary}),
        )

    @classmethod
    def artifact(
        cls, artifact_id: str, artifact_type: str, data: dict[str, Any]
    ) -> ChatEvent:
        return cls(
            type=ChatEventType.ARTIFACT,
            data=json.dumps(
                {"id": artifact_id, "type": artifact_type, "data": data}
            ),
        )

    @classmethod
    def error(cls, message: str) -> ChatEvent:
        return cls(type=ChatEventType.ERROR, data=message)

    @classmethod
    def done(cls, **kwargs: Any) -> ChatEvent:
        return cls(type=ChatEventType.DONE, data=json.dumps(kwargs) if kwargs else "{}")
