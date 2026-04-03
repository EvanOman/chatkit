"""Chatkit Echo Demo Server.

A self-contained FastAPI server that demonstrates every chatkit SSE event type.
No AI API keys needed -- it echoes user messages back with rich formatting.

    python server.py

Then open http://127.0.0.1:19800
"""

from __future__ import annotations

import asyncio
import json
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import uvicorn
from fastapi import FastAPI
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from sse_starlette import EventSourceResponse

from chatkit import ChatEvent, ChatEventType, ChatRequest, SSEPayload, stream_chat_events

# ── Paths ────────────────────────────────────────────────────────────────

DEMO_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = DEMO_DIR.parent

# ── In-memory conversation store ─────────────────────────────────────────

threads: dict[str, dict[str, Any]] = {}
# threads[id] = {
#   "id": str,
#   "title": str,
#   "created_at": str (ISO),
#   "updated_at": str (ISO),
#   "messages": [{"id": str, "role": str, "content": str, "created_at": str}, ...]
# }

# ── App ──────────────────────────────────────────────────────────────────

app = FastAPI(title="Chatkit Echo Demo")

# Mount chatkit dist and theme for the frontend
app.mount("/chatkit/dist", StaticFiles(directory=str(PROJECT_ROOT / "dist")), name="chatkit-dist")
app.mount(
    "/chatkit/src/theme",
    StaticFiles(directory=str(PROJECT_ROOT / "src" / "theme")),
    name="chatkit-theme",
)


@app.get("/", response_class=HTMLResponse)
async def index():
    return FileResponse(DEMO_DIR / "index.html")


# ── Conversations REST ───────────────────────────────────────────────────


@app.get("/api/conversations")
async def list_conversations():
    """Return all threads sorted by most recently updated."""
    result = sorted(threads.values(), key=lambda t: t["updated_at"], reverse=True)
    return [
        {
            "id": t["id"],
            "title": t["title"],
            "created_at": t["created_at"],
            "updated_at": t["updated_at"],
        }
        for t in result
    ]


@app.get("/api/conversations/{thread_id}")
async def get_conversation(thread_id: str):
    thread = threads.get(thread_id)
    if not thread:
        return {"messages": []}
    return {"messages": thread["messages"]}


@app.delete("/api/conversations/{thread_id}")
async def delete_conversation(thread_id: str):
    threads.pop(thread_id, None)
    return {"ok": True}


# ── Chat SSE endpoint ───────────────────────────────────────────────────


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_or_create_thread(thread_id: str | None, first_message: str) -> str:
    """Return existing thread_id or create a new one."""
    if thread_id and thread_id in threads:
        return thread_id
    new_id = str(uuid.uuid4())
    title = first_message[:50] + ("..." if len(first_message) > 50 else "")
    now = _now_iso()
    threads[new_id] = {
        "id": new_id,
        "title": title,
        "created_at": now,
        "updated_at": now,
        "messages": [],
    }
    return new_id


def _store_message(thread_id: str, role: str, content: str) -> None:
    thread = threads.get(thread_id)
    if not thread:
        return
    thread["messages"].append(
        {
            "id": str(uuid.uuid4()),
            "role": role,
            "content": content,
            "created_at": _now_iso(),
        }
    )
    thread["updated_at"] = _now_iso()


async def _echo_chat(thread_id: str | None, message: str) -> Any:
    """Async generator that yields ChatEvent objects demonstrating all event types."""
    t0 = time.monotonic()

    # Resolve thread
    tid = _get_or_create_thread(thread_id, message)
    _store_message(tid, "user", message)

    # 1. init
    yield ChatEvent.init(thread_id=tid)

    # 2. status: Thinking
    yield ChatEvent.status("Thinking...")
    await asyncio.sleep(0.3)

    # 3. Stream echoed text with markdown formatting, character by character
    words = message.split()
    echo_text = (
        f"**Echo:** {message}\n\n"
        f"Your message had **{len(words)}** word{'s' if len(words) != 1 else ''}. "
        f"Here it is as a list:\n\n"
    )
    for w in words:
        echo_text += f"- `{w}`\n"
    echo_text += "\n"

    for ch in echo_text:
        yield ChatEvent.text(ch)
        await asyncio.sleep(0.02)

    # 4. status: Running a tool
    yield ChatEvent.status("Running a tool...")

    # 5. tool_use — frontend expects {"tool_name": ..., "tool_id": ...}
    tool_id = str(uuid.uuid4())
    yield ChatEvent(
        type=ChatEventType.TOOL_USE,
        data=json.dumps({"tool_name": "echo_transform", "tool_id": tool_id}),
    )
    await asyncio.sleep(0.5)

    # 6. tool_done — frontend expects {"tool_id": ..., "summary": ...}
    yield ChatEvent(
        type=ChatEventType.TOOL_DONE,
        data=json.dumps({
            "tool_id": tool_id,
            "summary": f"Transformed {len(words)} words",
        }),
    )

    # 7. code event
    code_snippet = f'# Echo transform\nfor word in {words!r}:\n    print(f"Echo: {{word}}")'
    yield ChatEvent.code(code_snippet)

    # 8. artifact — a table of word analysis
    # Frontend expects {result_json, result_type, code, ...} via ArtifactData
    table_rows = [
        {"word": w, "length": len(w), "reversed": w[::-1]}
        for w in words[:10]  # cap at 10 rows
    ]
    yield ChatEvent(
        type=ChatEventType.ARTIFACT,
        data=json.dumps({
            "id": str(uuid.uuid4()),
            "result_type": "table",
            "result_json": json.dumps(table_rows),
        }),
    )

    # 9. Stream a closing line
    closing = "All done! Try sending another message to see the echo again."
    for ch in closing:
        yield ChatEvent.text(ch)
        await asyncio.sleep(0.02)

    # 10. Store assistant response
    full_response = echo_text + closing
    _store_message(tid, "assistant", full_response)

    # 11. done with timing
    elapsed = round(time.monotonic() - t0, 2)
    yield ChatEvent.done(elapsed_seconds=elapsed)


@app.post("/api/chat")
async def chat(request: ChatRequest):
    events = _echo_chat(request.thread_id, request.message)
    return EventSourceResponse(stream_chat_events(events), ping=15)


# ── Main ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=19800)
