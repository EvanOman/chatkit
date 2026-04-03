"""Tests for the chatkit Python package."""

import json

from chatkit import (
    ChatEvent,
    ChatEventType,
    ChatRequest,
    SSEPayload,
)


def test_strenum_values():
    assert ChatEventType.TEXT == "text"
    assert ChatEventType.TOOL_USE == "tool_use"
    assert ChatEventType.INIT == "init"
    assert ChatEventType.DONE == "done"


def test_chat_event_text():
    e = ChatEvent.text("hello")
    assert e.type == ChatEventType.TEXT
    assert e.data == "hello"


def test_chat_event_init():
    e = ChatEvent.init("abc-123", protocol_version=1)
    assert e.type == ChatEventType.INIT
    payload = json.loads(e.data)
    assert payload["thread_id"] == "abc-123"
    assert payload["protocol_version"] == 1


def test_chat_event_tool_use():
    e = ChatEvent.tool_use("search", {"query": "test"})
    assert e.type == ChatEventType.TOOL_USE
    payload = json.loads(e.data)
    assert payload["tool"] == "search"
    assert payload["input"] == {"query": "test"}


def test_chat_event_tool_done():
    e = ChatEvent.tool_done("search", "Found 5 results")
    payload = json.loads(e.data)
    assert payload["tool"] == "search"
    assert payload["summary"] == "Found 5 results"


def test_chat_event_artifact():
    e = ChatEvent.artifact("id-1", "table", {"rows": []})
    payload = json.loads(e.data)
    assert payload["id"] == "id-1"
    assert payload["type"] == "table"


def test_chat_event_done():
    e = ChatEvent.done(timing={"total_ms": 1234})
    payload = json.loads(e.data)
    assert payload["timing"]["total_ms"] == 1234


def test_chat_event_done_empty():
    e = ChatEvent.done()
    assert e.data == "{}"


def test_chat_event_frozen():
    e = ChatEvent.text("hello")
    try:
        e.data = "changed"  # type: ignore
        assert False, "Should raise"
    except AttributeError:
        pass


def test_sse_payload_from_event():
    e = ChatEvent.text("hello")
    payload = SSEPayload.from_chat_event(e)
    assert payload.event == "text"
    assert payload.data == "hello"
    assert payload.to_dict() == {"event": "text", "data": "hello"}


def test_chat_request_defaults():
    req = ChatRequest(message="hi")
    assert req.thread_id is None
    assert req.metadata == {}
    assert req.message == "hi"


def test_chat_request_with_metadata():
    req = ChatRequest(message="hi", metadata={"mode": "standard", "book_id": 42})
    assert req.metadata["mode"] == "standard"
    assert req.metadata["book_id"] == 42
