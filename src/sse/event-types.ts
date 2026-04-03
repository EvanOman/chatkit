/**
 * SSE event types for the chatkit protocol.
 * Mirrors the Python ChatEventType StrEnum.
 */

export const EventType = {
  INIT: "init",
  TEXT: "text",
  STATUS: "status",
  CODE: "code",
  TOOL_USE: "tool_use",
  TOOL_DONE: "tool_done",
  ARTIFACT: "artifact",
  ERROR: "error",
  DONE: "done",
} as const;

export type EventTypeName = (typeof EventType)[keyof typeof EventType];

/** A parsed SSE event from the stream. */
export interface SSEEvent {
  /** The event type (e.g., "text", "init", "done"). Defaults to "message". */
  readonly event: string;
  /** The event data payload. */
  readonly data: string;
  /** The event ID, if provided by the server. */
  readonly id: string | null;
}
