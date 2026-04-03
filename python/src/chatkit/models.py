"""Pydantic models for the chatkit protocol."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from .events import ChatEvent, ChatEventType


class ChatRequest(BaseModel):
    """Request body for POST /chat."""

    thread_id: str | None = None
    message: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class SSEPayload(BaseModel):
    """Wire format for a single SSE event sent to sse-starlette."""

    event: str
    data: str

    @classmethod
    def from_chat_event(cls, chat_event: ChatEvent) -> SSEPayload:
        return cls(event=str(chat_event.type), data=chat_event.data)

    def to_dict(self) -> dict[str, str]:
        """Return dict compatible with sse-starlette's EventSourceResponse."""
        return {"event": self.event, "data": self.data}


class ThreadOut(BaseModel):
    """Response model for conversation/thread list items."""

    id: str
    title: str
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class MessageOut(BaseModel):
    """Response model for a single message."""

    id: str
    thread_id: str
    role: str
    content: str
    created_at: str

    model_config = {"from_attributes": True}
