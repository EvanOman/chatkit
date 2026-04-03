/**
 * O(n) SSE parser for ReadableStream<string>.
 *
 * Buffers only the incomplete tail of the stream, not the full history.
 * Splits on double-newline event boundaries and parses event/data/id fields.
 */

import type { SSEEvent } from "./event-types.js";

/**
 * Parse an SSE text stream into individual events.
 * Yields SSEEvent objects as complete events are received.
 *
 * @param stream - A ReadableStream of decoded text chunks.
 */
export async function* parseSSEStream(
  stream: ReadableStream<string>,
): AsyncGenerator<SSEEvent> {
  const reader = stream.getReader();
  let tail = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Normalize \r\n and \r to \n (SSE spec allows all three line endings)
      const text = tail + value.replace(/\r\n|\r/g, "\n");

      // Find the last double-newline boundary
      const lastBoundary = text.lastIndexOf("\n\n");

      if (lastBoundary === -1) {
        // No complete event yet — buffer everything
        tail = text;
        continue;
      }

      // Split: complete events before boundary, incomplete tail after
      const complete = text.substring(0, lastBoundary);
      tail = text.substring(lastBoundary + 2);

      // Process all complete events
      const rawEvents = complete.split("\n\n");
      for (const raw of rawEvents) {
        if (!raw.trim()) continue;
        const event = parseRawEvent(raw);
        if (event) yield event;
      }
    }

    // Flush any remaining data in the tail buffer
    if (tail.trim()) {
      const event = parseRawEvent(tail);
      if (event) yield event;
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Parse a single raw SSE event block into an SSEEvent.
 * Returns null for comment-only blocks.
 */
function parseRawEvent(raw: string): SSEEvent | null {
  const lines = raw.split("\n");
  let event = "message";
  let data = "";
  let id: string | null = null;
  let hasData = false;

  for (const line of lines) {
    if (line.startsWith(":")) {
      // Comment line (used for pings) — skip
      continue;
    }
    if (line.startsWith("event:")) {
      event = line.substring(6).trim();
    } else if (line.startsWith("data:")) {
      if (hasData) data += "\n";
      // SSE spec: strip at most one leading space after "data:"
      const raw = line.substring(5);
      data += raw.startsWith(" ") ? raw.substring(1) : raw;
      hasData = true;
    } else if (line.startsWith("id:")) {
      id = line.substring(3).trim();
    }
    // Ignore "retry:" and unknown fields
  }

  if (!hasData) return null;

  return { event, data, id };
}
