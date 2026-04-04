/**
 * <ck-app> — Top-level orchestrator component.
 *
 * Wires together sidebar, messages, and input components.
 * Manages SSE streaming lifecycle, conversation CRUD, and theming.
 */

import { CkBase } from "../../lib/ck-base.js";
import { StreamStateMachine } from "../../lib/stream-state.js";
import type { FinalizeReason, StreamStateName } from "../../lib/stream-state.js";
import { connectSSE, EventType } from "../../sse/sse-client.js";
import type { SSEConnection } from "../../sse/sse-client.js";
import { resetSheet } from "../../theme/shared-styles.js";
import type { CkMessage } from "../ck-message/ck-message.js";
import type { CkMessages } from "../ck-messages/ck-messages.js";
import type { CkInput } from "../ck-input/ck-input.js";
import type { CkToolCard } from "../ck-tool-card/ck-tool-card.js";
import type { CkArtifact, ArtifactData } from "../ck-artifact/ck-artifact.js";

const componentSheet = new CSSStyleSheet();
componentSheet.replaceSync(`
  :host {
    display: flex;
    flex-direction: row;
    height: 100%;
    width: 100%;
    overflow: hidden;
    background:
      radial-gradient(ellipse at 70% 20%, var(--ck-accent-glow, rgba(124, 91, 245, 0.25)) 0%, transparent 50%),
      radial-gradient(ellipse at 20% 80%, rgba(99, 102, 241, 0.08) 0%, transparent 40%),
      var(--ck-bg, #0A0A0A);
    color: var(--ck-text, #F0F0F0);
  }
  .sidebar-area {
    flex-shrink: 0;
  }
  .main-area {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    height: 100%;
    overflow: hidden;
  }
  ::slotted(ck-messages) {
    flex: 1;
    min-height: 0;
  }
`);

export type OnBeforeFetchCallback =
  | ((info: {
      url: string;
      origin: string;
    }) => Record<string, string> | Promise<Record<string, string>>)
  | null;

export class CkApp extends CkBase {
  static override properties = {
    apiBase: { type: String, attribute: "api-base" },
    theme: { type: String, attribute: "theme", reflect: true },
  };

  static override styles = [resetSheet, componentSheet];

  declare apiBase: string;
  declare theme: string;

  /** Optional callback to inject custom headers before each fetch. */
  onBeforeFetch: OnBeforeFetchCallback = null;

  #stream: StreamStateMachine;
  #threadId: string | null = null;
  #currentConnection: SSEConnection | null = null;
  #currentAssistantMsg: CkMessage | null = null;

  constructor() {
    super();
    this.#stream = new StreamStateMachine({
      onStateChange: (from: StreamStateName, to: StreamStateName) => {
        this.#onStreamStateChange(from, to);
      },
      onFinalize: (reason: FinalizeReason, error?: Error) => {
        this.#onStreamFinalize(reason, error);
      },
    });
  }

  /** The current thread ID, if any. */
  get threadId(): string | null {
    return this.#threadId;
  }

  override connectedCallback(): void {
    super.connectedCallback();

    // Theme: read from localStorage, then prefers-color-scheme
    const stored = localStorage.getItem("ck-theme");
    if (stored === "light" || stored === "dark") {
      this.setTheme(stored);
    } else {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      this.setTheme(prefersDark ? "dark" : "light");
    }

    // Event listeners (composed events bubble through shadow DOM)
    this.listen(this, "ck-submit", ((e: CustomEvent<{ message: string }>) => {
      this.#handleSubmit(e.detail.message);
    }) as EventListener);

    this.listen(this, "ck-stop", (() => {
      this.#stream.finalize("aborted");
    }) as EventListener);

    this.listen(this, "ck-thread-select", ((e: CustomEvent<{ threadId: string }>) => {
      this.loadThread(e.detail.threadId);
    }) as EventListener);

    this.listen(this, "ck-thread-delete", ((e: CustomEvent<{ threadId: string }>) => {
      this.deleteThread(e.detail.threadId);
    }) as EventListener);

    this.listen(this, "ck-new-chat", (() => {
      this.newChat();
    }) as EventListener);

    // Initial sidebar load
    this.loadThreads();
  }

  override disconnectedCallback(): void {
    this.#stream.reset();
    super.disconnectedCallback();
  }

  // ── Theme ─────────────────────────────────────────────────────────

  /** Toggle between light and dark themes. */
  toggleTheme(): void {
    this.setTheme(this.theme === "light" ? "dark" : "light");
  }

  /** Set the theme explicitly. */
  setTheme(theme: "dark" | "light"): void {
    this.theme = theme;
    if (theme === "light") {
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
    }
    localStorage.setItem("ck-theme", theme);
  }

  // ── DOM Queries ───────────────────────────────────────────────────

  #getMessages(): CkMessages | null {
    return this.querySelector("ck-messages") as CkMessages | null;
  }

  #getInput(): CkInput | null {
    return this.querySelector("ck-input") as CkInput | null;
  }

  #getSidebar(): HTMLElement | null {
    return this.querySelector("ck-sidebar") as HTMLElement | null;
  }

  // ── Conversation CRUD ─────────────────────────────────────────────

  /** Load the thread list into the sidebar. */
  async loadThreads(): Promise<void> {
    if (!this.apiBase) return;
    try {
      const headers = await this.#getHeaders(this.apiBase + "/conversations");
      const res = await fetch(this.apiBase + "/conversations", { headers });
      if (!res.ok) return;
      const data = (await res.json()) as unknown[];
      const sidebar = this.#getSidebar();
      if (sidebar && "setThreads" in sidebar && typeof sidebar.setThreads === "function") {
        (sidebar as unknown as { setThreads(threads: unknown[]): void }).setThreads(data);
      }
    } catch {
      // Silently ignore — sidebar just stays empty
    }
  }

  /** Load a specific thread's messages. */
  async loadThread(id: string): Promise<void> {
    if (!this.apiBase) return;
    const messages = this.#getMessages();
    if (!messages) return;

    // Abort any active stream first
    if (this.#stream.isStreaming) {
      this.#stream.finalize("aborted");
    }

    try {
      const headers = await this.#getHeaders(this.apiBase + "/conversations/" + id);
      const res = await fetch(this.apiBase + "/conversations/" + id, { headers });
      if (!res.ok) return;
      const data = (await res.json()) as { messages?: Array<{ role: string; content: string }> };
      this.#threadId = id;
      messages.clear();

      if (data.messages) {
        for (const msg of data.messages) {
          const el = document.createElement("ck-message") as CkMessage;
          el.role = msg.role;
          el.setContent(msg.content);
          if (msg.role === "user") {
            messages.addMessage(el);
          } else {
            messages.addTurnPhase(el);
            messages.resetTurn();
          }
        }
      }
    } catch {
      // Ignore load errors
    }
  }

  /** Delete a thread. */
  async deleteThread(id: string): Promise<void> {
    if (!this.apiBase) return;

    // Abort stream if active for this thread
    if (this.#threadId === id && this.#stream.isStreaming) {
      this.#stream.finalize("deleted");
    }

    try {
      const headers = await this.#getHeaders(this.apiBase + "/conversations/" + id);
      await fetch(this.apiBase + "/conversations/" + id, {
        method: "DELETE",
        headers,
      });
      await this.loadThreads();

      // Clear view if we just deleted the active thread
      if (this.#threadId === id) {
        this.newChat();
      }
    } catch {
      // Ignore delete errors
    }
  }

  /** Start a new chat — clear messages and thread ID. */
  newChat(): void {
    if (this.#stream.isStreaming) {
      this.#stream.finalize("aborted");
    }
    this.#threadId = null;
    this.#currentAssistantMsg = null;
    const messages = this.#getMessages();
    messages?.clear();
    const input = this.#getInput();
    input?.focusInput();
  }

  // ── Message Sending ───────────────────────────────────────────────

  async #handleSubmit(message: string): Promise<void> {
    // Dispatch cancelable before-send event
    const beforeSend = new CustomEvent("ck-before-send", {
      bubbles: true,
      composed: true,
      cancelable: true,
      detail: { message, metadata: {} },
    });
    this.dispatchEvent(beforeSend);
    if (beforeSend.defaultPrevented) return;

    const metadata = (beforeSend.detail as { metadata: Record<string, unknown> }).metadata;
    const messages = this.#getMessages();
    if (!messages) return;

    // Create user message bubble
    const userMsg = document.createElement("ck-message") as CkMessage;
    userMsg.role = "user";
    userMsg.setContent(message);
    messages.addMessage(userMsg);

    // Start state machine
    if (!this.#stream.startSending()) return;

    const signal = this.#stream.signal;
    if (!signal) return;

    try {
      // Check abort before connecting
      if (signal.aborted) return;

      const url = this.apiBase + "/chat";
      const customHeaders = await this.#getHeaders(url);

      this.#currentConnection = connectSSE(url, {
        body: {
          thread_id: this.#threadId,
          message,
          metadata,
        },
        signal,
        headers: customHeaders,
      });

      // Check abort again after connect setup
      if (signal.aborted) return;

      for await (const event of this.#currentConnection) {
        if (signal.aborted) break;
        this.#handleSSEEvent(event.event, event.data, messages);
      }

      // Only finalize as complete if we weren't aborted
      if (!signal.aborted) {
        this.#stream.finalize("complete");
        this.dispatchEvent(
          new CustomEvent("ck-stream-end", { bubbles: true, composed: true }),
        );
        this.loadThreads();
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        // Already handled via finalize('aborted')
        return;
      }
      this.#stream.finalize("error", err instanceof Error ? err : new Error(String(err)));
    } finally {
      this.#currentConnection = null;
    }
  }

  #handleSSEEvent(type: string, data: string, messages: CkMessages): void {
    switch (type) {
      case EventType.INIT: {
        const parsed = this.#parseJSON<{ thread_id?: string }>(data);
        if (parsed?.thread_id) {
          this.#threadId = parsed.thread_id;
        }
        this.#stream.startStreaming();
        this.dispatchEvent(
          new CustomEvent("ck-stream-start", { bubbles: true, composed: true }),
        );
        break;
      }

      case EventType.TEXT: {
        if (!this.#currentAssistantMsg) {
          this.#currentAssistantMsg = document.createElement("ck-message") as CkMessage;
          this.#currentAssistantMsg.role = "assistant";
          this.#currentAssistantMsg.startStreaming();
          messages.addTurnPhase(this.#currentAssistantMsg);
        }
        this.#currentAssistantMsg.appendText(data);
        break;
      }

      case EventType.STATUS: {
        messages.showStatus(data);
        break;
      }

      case EventType.CODE: {
        if (!this.#currentAssistantMsg) {
          this.#currentAssistantMsg = document.createElement("ck-message") as CkMessage;
          this.#currentAssistantMsg.role = "assistant";
          this.#currentAssistantMsg.startStreaming();
          messages.addTurnPhase(this.#currentAssistantMsg);
        }
        this.#currentAssistantMsg.appendCodeBlock(data);
        break;
      }

      case EventType.TOOL_USE: {
        const parsed = this.#parseJSON<{ tool_name?: string; tool_id?: string }>(data);
        const card = document.createElement("ck-tool-card") as CkToolCard;
        card.toolName = parsed?.tool_name ?? "Tool";
        card.status = "running";
        if (parsed?.tool_id) {
          card.dataset.toolId = parsed.tool_id;
        }
        messages.addTurnPhase(card);
        break;
      }

      case EventType.TOOL_DONE: {
        const parsed = this.#parseJSON<{ tool_id?: string; summary?: string }>(data);
        if (parsed?.tool_id) {
          const card = messages.querySelector(
            `ck-tool-card[data-tool-id="${CSS.escape(parsed.tool_id)}"]`,
          ) as CkToolCard | null;
          if (card) {
            card.status = "done";
            if (parsed.summary) card.summary = parsed.summary;
          }
        }
        break;
      }

      case EventType.ARTIFACT: {
        const parsed = this.#parseJSON<ArtifactData>(data);
        if (parsed) {
          const artifact = document.createElement("ck-artifact") as CkArtifact;
          artifact.setData(parsed);
          messages.addTurnPhase(artifact);
        }
        break;
      }

      case EventType.ERROR: {
        const errorMsg = document.createElement("ck-message") as CkMessage;
        errorMsg.role = "error";
        errorMsg.setContent(data);
        messages.addTurnPhase(errorMsg);
        break;
      }

      case EventType.DONE: {
        // End the current assistant message streaming
        this.#currentAssistantMsg?.endStreaming();
        this.#currentAssistantMsg = null;
        messages.hideStatus();
        messages.resetTurn();
        break;
      }
    }
  }

  // ── Stream State Callbacks ────────────────────────────────────────

  #onStreamStateChange(_from: StreamStateName, to: StreamStateName): void {
    const input = this.#getInput();
    if (input) {
      input.streaming = to !== "idle";
    }
  }

  #onStreamFinalize(reason: FinalizeReason, error?: Error): void {
    const messages = this.#getMessages();

    // End any in-progress assistant message
    this.#currentAssistantMsg?.endStreaming();
    this.#currentAssistantMsg = null;

    messages?.hideStatus();
    messages?.resetTurn();

    if (reason === "error" && error && messages) {
      const errorMsg = document.createElement("ck-message") as CkMessage;
      errorMsg.role = "error";
      errorMsg.setContent(error.message);
      messages.addMessage(errorMsg);
    }

    const input = this.#getInput();
    input?.focusInput();
  }

  // ── Helpers ───────────────────────────────────────────────────────

  async #getHeaders(url: string): Promise<Record<string, string>> {
    if (!this.onBeforeFetch) return {};
    try {
      const origin = window.location.origin;
      return await this.onBeforeFetch({ url, origin });
    } catch {
      return {};
    }
  }

  #parseJSON<T>(data: string): T | null {
    try {
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }

  // ── Render ────────────────────────────────────────────────────────

  protected override update(): void {
    const shadow = this.shadowRoot!;
    if (shadow.querySelector(".main-area")) return; // Already initialized

    shadow.innerHTML = "";

    // Sidebar slot
    const sidebarArea = document.createElement("div");
    sidebarArea.className = "sidebar-area";
    const sidebarSlot = document.createElement("slot");
    sidebarSlot.name = "sidebar";
    sidebarArea.appendChild(sidebarSlot);

    // Main area
    const mainArea = document.createElement("div");
    mainArea.className = "main-area";

    const messagesSlot = document.createElement("slot");
    messagesSlot.name = "messages";
    mainArea.appendChild(messagesSlot);

    const inputSlot = document.createElement("slot");
    inputSlot.name = "input";
    mainArea.appendChild(inputSlot);

    shadow.appendChild(sidebarArea);
    shadow.appendChild(mainArea);
  }
}
