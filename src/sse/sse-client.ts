/**
 * SSE-over-POST client with async iterator API.
 *
 * Uses fetch() + ReadableStream for POST-based SSE (EventSource only supports GET).
 * Returns an SSEConnection with [Symbol.asyncIterator], abort(), and done promise.
 */

import type { SSEEvent } from "./event-types.js";
import { parseSSEStream } from "./sse-parser.js";

export type { SSEEvent };
export { EventType } from "./event-types.js";
export type { EventTypeName } from "./event-types.js";

export interface SSEOptions {
  /** POST body — JSON-serialized and sent as application/json. */
  body?: unknown;
  /** Custom headers to include in the request. */
  headers?: Record<string, string>;
  /** AbortSignal for external cancellation (e.g., from an AbortController). */
  signal?: AbortSignal;
}

export interface SSEConnection {
  /** Async iterable of parsed SSE events. */
  [Symbol.asyncIterator](): AsyncIterableIterator<SSEEvent>;
  /** Abort the connection immediately. */
  abort(): void;
  /** Promise that resolves when the stream ends or rejects on fatal error. */
  readonly done: Promise<void>;
}

/**
 * Connect to an SSE endpoint via POST and return an async iterable of events.
 *
 * @example
 * ```ts
 * const sse = connectSSE('/api/chat', {
 *   body: { thread_id: null, message: 'Hello', metadata: {} },
 *   signal: controller.signal,
 * });
 *
 * try {
 *   for await (const event of sse) {
 *     if (event.event === 'text') appendText(event.data);
 *     if (event.event === 'done') break;
 *   }
 * } catch (err) {
 *   if (err.name !== 'AbortError') showError(err);
 * }
 * ```
 */
export function connectSSE(url: string, options?: SSEOptions): SSEConnection {
  const abortController = new AbortController();
  const externalSignal = options?.signal;

  // Link external signal to our internal controller
  if (externalSignal) {
    if (externalSignal.aborted) {
      abortController.abort(externalSignal.reason);
    } else {
      const onExternalAbort = () =>
        abortController.abort(externalSignal.reason);
      externalSignal.addEventListener("abort", onExternalAbort, { once: true });
    }
  }

  let iterator: AsyncIterableIterator<SSEEvent> | null = null;

  const done = (async () => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...options?.headers,
    };

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: options?.body != null ? JSON.stringify(options.body) : undefined,
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new Error(
        `SSE request failed: ${response.status} ${response.statusText}`,
      );
    }

    if (!response.body) {
      throw new Error("SSE response has no body");
    }

    // Pipe through TextDecoderStream for proper UTF-8 handling
    const textStream = response.body.pipeThrough(new TextDecoderStream());

    // Store the iterator so [Symbol.asyncIterator] can return it
    iterator = parseSSEStream(textStream);

    // Consume the iterator to completion (the consumer drives this via for-await)
    // This is a no-op if the consumer already consumed via for-await
  })();

  const connection: SSEConnection = {
    [Symbol.asyncIterator](): AsyncIterableIterator<SSEEvent> {
      // Return a wrapper that waits for the fetch to complete before yielding
      return {
        async next(): Promise<IteratorResult<SSEEvent>> {
          // Wait for the connection to be established
          if (!iterator) {
            await done;
          }
          if (!iterator) {
            return { done: true, value: undefined };
          }
          return iterator.next();
        },
        async return(): Promise<IteratorResult<SSEEvent>> {
          abortController.abort();
          return { done: true, value: undefined };
        },
        [Symbol.asyncIterator]() {
          return this;
        },
      };
    },

    abort(): void {
      abortController.abort();
    },

    done,
  };

  return connection;
}
