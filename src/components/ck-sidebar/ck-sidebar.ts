/**
 * <ck-sidebar> — Conversation thread sidebar with mobile drawer support.
 *
 * Displays a list of conversation threads with a "New Chat" button.
 * On mobile (<768px), acts as a slide-out drawer with backdrop overlay.
 *
 * Events:
 *   ck-new-chat      — New chat button clicked
 *   ck-thread-select — Thread clicked, detail: { threadId }
 *   ck-thread-delete — Thread delete clicked, detail: { threadId } (cancelable)
 */

import { CkBase } from "../../lib/ck-base.js";
import { resetSheet } from "../../theme/shared-styles.js";

export interface ThreadItem {
  id: string;
  title: string;
  updated_at: string;
}

const componentSheet = new CSSStyleSheet();
componentSheet.replaceSync(`
  :host {
    display: block;
    width: var(--ck-sidebar-width, 16rem);
    height: 100%;
    background: var(--ck-bg-sidebar, #050505);
    border-right: 1px solid var(--ck-border, #1e1e1e);
    overflow: hidden;
    flex-shrink: 0;
  }
  .sidebar {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .header {
    padding: 0.75rem;
    flex-shrink: 0;
  }
  .new-chat-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--ck-border, #1e1e1e);
    border-radius: 0.5rem;
    background: transparent;
    color: var(--ck-text, #F0F0F0);
    font-family: var(--ck-font, system-ui, sans-serif);
    font-size: 0.875rem;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s, box-shadow 0.2s;
  }
  .new-chat-btn:hover {
    background: var(--ck-bg-surface-hover, #1e1e1e);
    border-color: var(--ck-accent, #22c55e);
    box-shadow: 0 0 12px var(--ck-accent-glow, rgba(34, 197, 94, 0.25));
  }
  .new-chat-btn:active {
    transform: scale(0.98);
  }
  .new-chat-btn svg {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }
  .thread-list {
    flex: 1;
    overflow-y: auto;
    padding: 0.25rem 0.5rem;
  }
  .thread-list::-webkit-scrollbar {
    width: 4px;
  }
  .thread-list::-webkit-scrollbar-thumb {
    background: var(--ck-border, #1e1e1e);
    border-radius: 2px;
  }
  .thread-item {
    display: flex;
    align-items: center;
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: background 0.15s, transform 0.1s;
    position: relative;
    margin-bottom: 2px;
  }
  .thread-item:hover {
    background: var(--ck-bg-surface-hover, #1e1e1e);
  }
  .thread-item:active {
    transform: scale(0.98);
  }
  .thread-item.active {
    background: var(--ck-accent-soft, rgba(34, 197, 94, 0.10));
    border-left: 2px solid var(--ck-accent, #22c55e);
  }
  .thread-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.8125rem;
    color: var(--ck-text-secondary, #A1A1A1);
  }
  .thread-item.active .thread-title {
    color: var(--ck-text, #F0F0F0);
    font-weight: 500;
  }
  .delete-btn {
    display: none;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    border: none;
    border-radius: 0.25rem;
    background: transparent;
    color: var(--ck-text-muted, #5a5a5a);
    cursor: pointer;
    flex-shrink: 0;
    transition: color 0.15s, background 0.15s;
  }
  .thread-item:hover .delete-btn {
    display: flex;
  }
  .delete-btn:hover {
    color: var(--ck-text-error, #ff6b6b);
    background: var(--ck-bg-error, #2a0a0a);
  }
  .delete-btn svg {
    width: 0.875rem;
    height: 0.875rem;
  }
  .empty-state {
    padding: 1.5rem 0.75rem;
    text-align: center;
    color: var(--ck-text-muted, #5a5a5a);
    font-size: 0.8125rem;
  }

  /* Backdrop for mobile drawer */
  .backdrop {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    z-index: 99;
  }

  /* Mobile drawer behavior */
  @media (max-width: 767px) {
    :host {
      position: fixed;
      top: 0;
      left: 0;
      height: 100%;
      z-index: 100;
      transform: translateX(-100%);
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: none;
    }
    :host([open]) {
      transform: translateX(0);
      box-shadow: 4px 0 32px rgba(0, 0, 0, 0.5);
    }
    :host([open]) .backdrop {
      display: block;
    }
  }
`);

const PLUS_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
const TRASH_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>`;

export class CkSidebar extends CkBase {
  static override properties = {
    activeThreadId: { type: String, attribute: "active-thread-id" },
    open: { type: Boolean, reflect: true },
  };

  static override styles = [resetSheet, componentSheet];

  declare activeThreadId: string | null;
  declare open: boolean;

  #threads: ThreadItem[] = [];
  #listEl: HTMLElement | null = null;
  #backdrop: HTMLElement | null = null;
  #initialized = false;

  /** Replace the displayed thread list. */
  setThreads(threads: ThreadItem[]): void {
    this.#threads = [...threads];
    this.requestUpdate();
  }

  /** Open the sidebar drawer (mobile). */
  show(): void {
    this.open = true;
  }

  /** Close the sidebar drawer (mobile). */
  close(): void {
    this.open = false;
  }

  protected override update(): void {
    const shadow = this.shadowRoot!;

    if (!this.#initialized) {
      this.#initialized = true;
      shadow.innerHTML = "";

      // Backdrop (only visible on mobile when open)
      this.#backdrop = document.createElement("div");
      this.#backdrop.className = "backdrop";
      shadow.appendChild(this.#backdrop);

      const sidebar = document.createElement("div");
      sidebar.className = "sidebar";

      // Header with New Chat button
      const header = document.createElement("div");
      header.className = "header";

      const newChatBtn = document.createElement("button");
      newChatBtn.className = "new-chat-btn";
      newChatBtn.type = "button";
      newChatBtn.innerHTML = `${PLUS_ICON}<span>New Chat</span>`;
      header.appendChild(newChatBtn);

      // Thread list
      this.#listEl = document.createElement("div");
      this.#listEl.className = "thread-list";

      sidebar.appendChild(header);
      sidebar.appendChild(this.#listEl);
      shadow.appendChild(sidebar);

      // Event listeners
      this.listen(newChatBtn, "click", () => {
        this.dispatchEvent(
          new CustomEvent("ck-new-chat", { bubbles: true, composed: true }),
        );
        this.close();
      });

      this.listen(this.#backdrop, "click", () => {
        this.close();
      });
    }

    this.#renderThreads();
  }

  #renderThreads(): void {
    if (!this.#listEl) return;

    this.#listEl.innerHTML = "";

    if (this.#threads.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "No conversations yet";
      this.#listEl.appendChild(empty);
      return;
    }

    for (const thread of this.#threads) {
      const item = document.createElement("div");
      item.className = "thread-item";
      if (thread.id === this.activeThreadId) {
        item.classList.add("active");
      }
      item.dataset.threadId = thread.id;

      const title = document.createElement("span");
      title.className = "thread-title";
      title.textContent = thread.title;
      title.title = thread.title;

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "delete-btn";
      deleteBtn.type = "button";
      deleteBtn.innerHTML = TRASH_ICON;
      deleteBtn.title = "Delete conversation";

      item.appendChild(title);
      item.appendChild(deleteBtn);
      this.#listEl.appendChild(item);

      item.addEventListener("click", (e: Event) => {
        if ((e.target as HTMLElement).closest(".delete-btn")) return;
        this.dispatchEvent(
          new CustomEvent("ck-thread-select", {
            bubbles: true,
            composed: true,
            detail: { threadId: thread.id },
          }),
        );
        this.close();
      });

      deleteBtn.addEventListener("click", (e: Event) => {
        e.stopPropagation();
        this.dispatchEvent(
          new CustomEvent("ck-thread-delete", {
            bubbles: true,
            composed: true,
            cancelable: true,
            detail: { threadId: thread.id },
          }),
        );
      });
    }
  }
}
