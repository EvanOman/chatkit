import { describe, it, expect, vi } from "vitest";
import {
  StreamStateMachine,
  StreamState,
  type StreamStateCallbacks,
  type FinalizeReason,
} from "../src/lib/stream-state.js";

function makeCallbacks() {
  return {
    onStateChange: vi.fn(),
    onFinalize: vi.fn(),
  } satisfies StreamStateCallbacks;
}

describe("StreamStateMachine", () => {
  it("starts in IDLE state", () => {
    const sm = new StreamStateMachine(makeCallbacks());
    expect(sm.state).toBe(StreamState.IDLE);
    expect(sm.isIdle).toBe(true);
    expect(sm.isStreaming).toBe(false);
  });

  it("transitions IDLE → SENDING → STREAMING", () => {
    const callbacks = makeCallbacks();
    const sm = new StreamStateMachine(callbacks);

    expect(sm.startSending()).toBe(true);
    expect(sm.state).toBe(StreamState.SENDING);
    expect(sm.isStreaming).toBe(true);
    expect(sm.signal).not.toBeNull();

    expect(sm.startStreaming()).toBe(true);
    expect(sm.state).toBe(StreamState.STREAMING);
  });

  it("finalize transitions STREAMING → FINALIZING → IDLE", () => {
    const callbacks = makeCallbacks();
    const sm = new StreamStateMachine(callbacks);

    sm.startSending();
    sm.startStreaming();
    sm.finalize("complete");

    expect(sm.state).toBe(StreamState.IDLE);
    expect(callbacks.onFinalize).toHaveBeenCalledWith("complete", undefined);
  });

  it("finalize is idempotent — second call is a no-op", () => {
    const callbacks = makeCallbacks();
    const sm = new StreamStateMachine(callbacks);

    sm.startSending();
    sm.startStreaming();
    sm.finalize("complete");
    sm.finalize("aborted"); // Should be ignored

    expect(callbacks.onFinalize).toHaveBeenCalledTimes(1);
    expect(callbacks.onFinalize).toHaveBeenCalledWith("complete", undefined);
  });

  it("finalize works from SENDING state (fetch failure)", () => {
    const callbacks = makeCallbacks();
    const sm = new StreamStateMachine(callbacks);

    sm.startSending();
    const error = new Error("Network error");
    sm.finalize("error", error);

    expect(sm.state).toBe(StreamState.IDLE);
    expect(callbacks.onFinalize).toHaveBeenCalledWith("error", error);
  });

  it("startSending returns false if not idle", () => {
    const sm = new StreamStateMachine(makeCallbacks());
    sm.startSending();
    expect(sm.startSending()).toBe(false); // Already sending
  });

  it("startStreaming returns false if not sending", () => {
    const sm = new StreamStateMachine(makeCallbacks());
    expect(sm.startStreaming()).toBe(false); // Still idle
  });

  it("finalize aborts the signal", () => {
    const sm = new StreamStateMachine(makeCallbacks());
    sm.startSending();
    const signal = sm.signal!;

    expect(signal.aborted).toBe(false);
    sm.finalize("aborted");
    expect(signal.aborted).toBe(true);
  });

  it("reset force-returns to IDLE", () => {
    const sm = new StreamStateMachine(makeCallbacks());
    sm.startSending();
    sm.startStreaming();

    sm.reset();
    expect(sm.state).toBe(StreamState.IDLE);
    expect(sm.signal).toBeNull();
  });

  it("tracks state transitions via onStateChange", () => {
    const callbacks = makeCallbacks();
    const sm = new StreamStateMachine(callbacks);

    sm.startSending();
    sm.startStreaming();
    sm.finalize("complete");

    const calls = callbacks.onStateChange.mock.calls;
    expect(calls).toEqual([
      [StreamState.IDLE, StreamState.SENDING],
      [StreamState.SENDING, StreamState.STREAMING],
      [StreamState.STREAMING, StreamState.FINALIZING],
      [StreamState.FINALIZING, StreamState.IDLE],
    ]);
  });
});
