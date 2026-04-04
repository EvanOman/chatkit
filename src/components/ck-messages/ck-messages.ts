/**
 * <ck-messages> — Scrollable message container with turn grouping,
 * auto-scroll, and status indicator.
 */

import { CkBase } from "../../lib/ck-base.js";
import { resetSheet, animationsSheet } from "../../theme/shared-styles.js";

const componentSheet = new CSSStyleSheet();
componentSheet.replaceSync(`
  :host {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 1rem;
    scroll-behavior: auto;
  }
  :host::-webkit-scrollbar {
    width: 6px;
  }
  :host::-webkit-scrollbar-track {
    background: transparent;
  }
  :host::-webkit-scrollbar-thumb {
    background: var(--ck-scrollbar, #2a2a2a);
    border-radius: 3px;
  }
  :host::-webkit-scrollbar-thumb:hover {
    background: var(--ck-text-muted, #5a5a5a);
  }
  .messages-inner {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: var(--ck-max-message-width, 48rem);
    width: 100%;
    margin: 0 auto;
    padding-bottom: 1rem;
  }
  .ck-turn {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .ck-turn + .ck-turn {
    margin-top: 0.25rem;
  }
  .turn-phase + .turn-phase {
    padding-top: 0.5rem;
  }
  .status-bubble {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--ck-bg-status, #0f0d2e);
    color: var(--ck-text-status, #818cf8);
    border-radius: var(--ck-radius, 0.75rem);
    border: 1px solid var(--ck-border-status, #312e81);
    font-size: var(--ck-font-size-sm, 0.8125rem);
    animation: ck-fade-in 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .pulse-dots {
    display: flex;
    gap: 3px;
  }
  .pulse-dots span {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--ck-text-status, #818cf8);
    animation: ck-pulse-dot 1.4s ease-in-out infinite;
  }
  .pulse-dots span:nth-child(2) { animation-delay: 0.2s; }
  .pulse-dots span:nth-child(3) { animation-delay: 0.4s; }
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    color: var(--ck-text-muted, #5a5a5a);
    gap: 0.75rem;
    padding: 2rem;
  }
  .empty-state-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--ck-text-secondary, #A1A1A1);
    letter-spacing: -0.01em;
  }
  .empty-state-subtitle {
    font-size: 0.875rem;
  }
  .scroll-sentinel {
    height: 0;
    width: 0;
    flex-shrink: 0;
  }
`);

export class CkMessages extends CkBase {
  static override styles = [resetSheet, animationsSheet, componentSheet];

  #inner: HTMLDivElement | null = null;
  #sentinel: HTMLDivElement | null = null;
  #statusEl: HTMLDivElement | null = null;
  #emptyState: HTMLDivElement | null = null;
  #currentTurn: HTMLDivElement | null = null;
  #scrollScheduled = false;
  #userScrolledAway = false;

  /** Get or create the current assistant turn container. */
  getOrCreateTurn(): HTMLDivElement {
    if (this.#currentTurn) return this.#currentTurn;
    this.#hideEmptyShowMessages();

    const turn = document.createElement("div");
    turn.className = "ck-turn";
    this.#inner!.insertBefore(turn, this.#sentinel);
    this.#currentTurn = turn;
    return turn;
  }

  /** Reset the current turn (call after "done" event). */
  resetTurn(): void {
    this.#currentTurn = null;
  }

  /** Add a child element to the current turn as a new phase. */
  addTurnPhase(element: HTMLElement): void {
    const turn = this.getOrCreateTurn();
    element.classList.add("turn-phase");
    turn.appendChild(element);
    this.scheduleScroll();
  }

  /** Add a standalone element outside of turns (e.g., user messages). */
  addMessage(element: HTMLElement): void {
    this.#hideEmptyShowMessages();
    this.#inner!.insertBefore(element, this.#sentinel);
    this.scheduleScroll();
  }

  /** Show a status message with pulsing dots. */
  showStatus(message: string): void {
    if (!this.#statusEl) {
      this.#statusEl = document.createElement("div");
      this.#statusEl.className = "status-bubble";
      this.#statusEl.innerHTML = `
        <div class="pulse-dots"><span></span><span></span><span></span></div>
        <span class="status-text"></span>
      `;
    }
    const textEl = this.#statusEl.querySelector(".status-text");
    if (textEl) textEl.textContent = message;

    // Ensure it's in the DOM at the end of current turn or messages
    const parent = this.#currentTurn ?? this.#inner;
    if (this.#statusEl.parentElement !== parent) {
      if (parent === this.#inner) {
        parent!.insertBefore(this.#statusEl, this.#sentinel);
      } else {
        parent!.appendChild(this.#statusEl);
      }
    }
    this.scheduleScroll();
  }

  /** Remove the status indicator. */
  hideStatus(): void {
    this.#statusEl?.remove();
  }

  /** Clear all messages and show empty state. */
  clear(): void {
    if (this.#inner) {
      // Remove everything except the sentinel
      const children = Array.from(this.#inner.children);
      for (const child of children) {
        if (child !== this.#sentinel) child.remove();
      }
    }
    this.#currentTurn = null;
    this.#statusEl = null;
    if (this.#emptyState) this.#emptyState.style.display = "";
    if (this.#inner) this.#inner.style.display = "none";
  }

  /** Schedule a scroll-to-bottom on next animation frame. */
  scheduleScroll(): void {
    if (this.#userScrolledAway || this.#scrollScheduled) return;
    this.#scrollScheduled = true;
    requestAnimationFrame(() => {
      this.#scrollScheduled = false;
      this.#sentinel?.scrollIntoView({ block: "end", behavior: "instant" });
    });
  }

  #hideEmptyShowMessages(): void {
    if (this.#emptyState) this.#emptyState.style.display = "none";
    if (this.#inner) this.#inner.style.display = "";
  }

  protected override update(): void {
    const shadow = this.shadowRoot!;
    if (this.#inner) return; // Already initialized

    shadow.innerHTML = "";

    // Empty state
    this.#emptyState = document.createElement("div");
    this.#emptyState.className = "empty-state";
    this.#emptyState.innerHTML = `
      <div class="empty-state-title">Start a conversation</div>
      <div class="empty-state-subtitle">Send a message to begin</div>
    `;
    shadow.appendChild(this.#emptyState);

    // Messages container
    this.#inner = document.createElement("div");
    this.#inner.className = "messages-inner";
    this.#inner.style.display = "none";

    // Scroll sentinel
    this.#sentinel = document.createElement("div");
    this.#sentinel.className = "scroll-sentinel";
    this.#inner.appendChild(this.#sentinel);

    shadow.appendChild(this.#inner);

    // Track user scroll position
    this.listen(this, "scroll", () => {
      const distanceFromBottom =
        this.scrollHeight - this.scrollTop - this.clientHeight;
      this.#userScrolledAway = distanceFromBottom > 50;
    }, { passive: true });
  }
}
