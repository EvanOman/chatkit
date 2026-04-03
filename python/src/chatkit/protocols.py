"""Protocol definition for chat backends."""

from __future__ import annotations

from collections.abc import AsyncGenerator
from typing import Any, Protocol, runtime_checkable

from .events import ChatEvent


@runtime_checkable
class ChatBackend(Protocol):
    """Protocol that any chat backend must satisfy.

    Implementations yield ChatEvent objects as an async generator.
    The stream must start with an `init` event and end with `done` or `error`.
    """

    def chat(
        self,
        thread_id: str | None,
        message: str,
        metadata: dict[str, Any] | None = None,
    ) -> AsyncGenerator[ChatEvent, None]: ...
