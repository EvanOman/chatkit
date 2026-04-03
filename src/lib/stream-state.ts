/**
 * Stream lifecycle state machine.
 *
 * Manages the IDLE → SENDING → STREAMING → FINALIZING → IDLE lifecycle.
 * Prevents race conditions via idempotent finalize() and state guards.
 */

export const StreamState = {
  IDLE: "idle",
  SENDING: "sending",
  STREAMING: "streaming",
  FINALIZING: "finalizing",
} as const;

export type StreamStateName = (typeof StreamState)[keyof typeof StreamState];

export type FinalizeReason = "complete" | "aborted" | "error" | "deleted";

export interface StreamStateCallbacks {
  onStateChange(from: StreamStateName, to: StreamStateName): void;
  onFinalize(reason: FinalizeReason, error?: Error): void;
}

export class StreamStateMachine {
  #state: StreamStateName = StreamState.IDLE;
  #callbacks: StreamStateCallbacks;
  #abortController: AbortController | null = null;

  constructor(callbacks: StreamStateCallbacks) {
    this.#callbacks = callbacks;
  }

  get state(): StreamStateName {
    return this.#state;
  }

  get signal(): AbortSignal | null {
    return this.#abortController?.signal ?? null;
  }

  get isIdle(): boolean {
    return this.#state === StreamState.IDLE;
  }

  get isStreaming(): boolean {
    return (
      this.#state === StreamState.SENDING ||
      this.#state === StreamState.STREAMING
    );
  }

  /** Transition to SENDING state. Returns false if not idle. */
  startSending(): boolean {
    if (this.#state !== StreamState.IDLE) return false;
    this.#abortController = new AbortController();
    this.#transition(StreamState.SENDING);
    return true;
  }

  /** Transition to STREAMING state. Returns false if not in SENDING. */
  startStreaming(): boolean {
    if (this.#state !== StreamState.SENDING) return false;
    this.#transition(StreamState.STREAMING);
    return true;
  }

  /**
   * Finalize the stream. Idempotent — first caller wins, subsequent calls are no-ops.
   * Aborts the controller if not already aborted, then transitions to IDLE.
   */
  finalize(reason: FinalizeReason, error?: Error): void {
    if (
      this.#state !== StreamState.SENDING &&
      this.#state !== StreamState.STREAMING
    ) {
      return; // Already finalized or idle — no-op
    }

    this.#transition(StreamState.FINALIZING);

    // Abort if not already aborted
    if (this.#abortController && !this.#abortController.signal.aborted) {
      this.#abortController.abort();
    }

    this.#callbacks.onFinalize(reason, error);

    this.#abortController = null;
    this.#transition(StreamState.IDLE);
  }

  /** Force-reset to IDLE (for disconnectedCallback cleanup). */
  reset(): void {
    if (this.#abortController && !this.#abortController.signal.aborted) {
      this.#abortController.abort();
    }
    this.#abortController = null;
    this.#state = StreamState.IDLE;
  }

  #transition(to: StreamStateName): void {
    const from = this.#state;
    this.#state = to;
    this.#callbacks.onStateChange(from, to);
  }
}
