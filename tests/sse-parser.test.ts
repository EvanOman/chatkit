import { describe, it, expect } from "vitest";
import { parseSSEStream } from "../src/sse/sse-parser.js";

/** Helper to create a ReadableStream from string chunks. */
function chunkedStream(chunks: string[]): ReadableStream<string> {
  let i = 0;
  return new ReadableStream<string>({
    pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(chunks[i]!);
        i++;
      } else {
        controller.close();
      }
    },
  });
}

/** Collect all events from the async generator. */
async function collectEvents(stream: ReadableStream<string>) {
  const events = [];
  for await (const event of parseSSEStream(stream)) {
    events.push(event);
  }
  return events;
}

describe("parseSSEStream", () => {
  it("parses a single complete event", async () => {
    const stream = chunkedStream(["event: text\ndata: hello\n\n"]);
    const events = await collectEvents(stream);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ event: "text", data: "hello", id: null });
  });

  it("parses multiple events in one chunk", async () => {
    const stream = chunkedStream([
      "event: init\ndata: {\"thread_id\":\"abc\"}\n\nevent: text\ndata: hi\n\n",
    ]);
    const events = await collectEvents(stream);
    expect(events).toHaveLength(2);
    expect(events[0]!.event).toBe("init");
    expect(events[1]!.event).toBe("text");
  });

  it("handles events split across chunks", async () => {
    const stream = chunkedStream([
      "event: text\nda",
      "ta: hello world\n\n",
    ]);
    const events = await collectEvents(stream);
    expect(events).toHaveLength(1);
    expect(events[0]!.data).toBe("hello world");
  });

  it("handles chunk boundary inside event type", async () => {
    const stream = chunkedStream([
      "eve",
      "nt: done\ndata: {}\n\n",
    ]);
    const events = await collectEvents(stream);
    expect(events).toHaveLength(1);
    expect(events[0]!.event).toBe("done");
  });

  it("defaults event type to 'message' when not specified", async () => {
    const stream = chunkedStream(["data: plain message\n\n"]);
    const events = await collectEvents(stream);
    expect(events).toHaveLength(1);
    expect(events[0]!.event).toBe("message");
    expect(events[0]!.data).toBe("plain message");
  });

  it("skips comment-only blocks", async () => {
    const stream = chunkedStream([
      ": this is a ping\n\nevent: text\ndata: real\n\n",
    ]);
    const events = await collectEvents(stream);
    expect(events).toHaveLength(1);
    expect(events[0]!.event).toBe("text");
  });

  it("parses event ID", async () => {
    const stream = chunkedStream([
      "id: 42\nevent: text\ndata: hello\n\n",
    ]);
    const events = await collectEvents(stream);
    expect(events[0]!.id).toBe("42");
  });

  it("handles empty stream", async () => {
    const stream = chunkedStream([]);
    const events = await collectEvents(stream);
    expect(events).toHaveLength(0);
  });

  it("handles multi-line data fields", async () => {
    const stream = chunkedStream([
      "event: text\ndata: line1\ndata: line2\n\n",
    ]);
    const events = await collectEvents(stream);
    expect(events[0]!.data).toBe("line1\nline2");
  });

  it("flushes remaining buffer on stream end", async () => {
    // Event without trailing \n\n — should still be emitted on flush
    const stream = chunkedStream(["event: done\ndata: {}"]);
    const events = await collectEvents(stream);
    expect(events).toHaveLength(1);
    expect(events[0]!.event).toBe("done");
  });

  it("handles many small chunks", async () => {
    const full = "event: text\ndata: hello world\n\n";
    const chunks = full.split("").map((c) => c); // one char per chunk
    const stream = chunkedStream(chunks);
    const events = await collectEvents(stream);
    expect(events).toHaveLength(1);
    expect(events[0]!.data).toBe("hello world");
  });
});
