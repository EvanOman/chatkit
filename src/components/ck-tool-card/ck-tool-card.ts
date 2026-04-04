/**
 * <ck-tool-card> — Tool use/done indicator with spinner animation.
 */

import { CkBase } from "../../lib/ck-base.js";
import { resetSheet, animationsSheet } from "../../theme/shared-styles.js";

const componentSheet = new CSSStyleSheet();
componentSheet.replaceSync(`
  :host {
    display: block;
    animation: ck-fade-in 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .card {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.5rem 0.875rem;
    background: var(--ck-bg-surface, #141414);
    border: 1px solid var(--ck-border, #1e1e1e);
    border-radius: var(--ck-radius, 0.75rem);
    font-size: var(--ck-font-size-sm, 0.8125rem);
    transition: border-color 0.2s;
  }
  .card.running {
    border-color: var(--ck-accent, #7c5bf5);
    box-shadow: 0 0 8px var(--ck-accent-glow, rgba(124, 91, 245, 0.25));
  }
  .card.done {
    border-color: var(--ck-border, #1e1e1e);
  }
  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid var(--ck-border, #1e1e1e);
    border-top-color: var(--ck-accent, #7c5bf5);
    border-radius: 50%;
    animation: ck-spin 0.7s linear infinite;
    flex-shrink: 0;
  }
  .check {
    color: var(--ck-text-success, #34d399);
    flex-shrink: 0;
    font-size: 1rem;
    line-height: 1;
  }
  .tool-name {
    font-weight: 500;
    color: var(--ck-text, #F0F0F0);
    font-family: var(--ck-font-mono, monospace);
    font-size: 0.8em;
  }
  .summary {
    color: var(--ck-text-secondary, #A1A1A1);
  }
`);

export class CkToolCard extends CkBase {
  static override properties = {
    toolName: { type: String, attribute: "tool-name" },
    status: { type: String, reflect: true },
    summary: { type: String },
  };

  static override styles = [resetSheet, animationsSheet, componentSheet];

  declare toolName: string;
  declare status: string; // "running" | "done"
  declare summary: string;

  protected override update(): void {
    const shadow = this.shadowRoot!;
    const isRunning = (this.status ?? "running") === "running";

    shadow.innerHTML = "";
    const card = document.createElement("div");
    card.className = `card ${isRunning ? "running" : "done"}`;

    if (isRunning) {
      card.innerHTML = `
        <div class="spinner"></div>
        <span class="tool-name">${this.#escape(this.toolName ?? "Tool")}</span>
      `;
    } else {
      card.innerHTML = `
        <span class="check">\u2713</span>
        <span class="tool-name">${this.#escape(this.toolName ?? "Tool")}</span>
        ${this.summary ? `<span class="summary">\u2014 ${this.#escape(this.summary)}</span>` : ""}
      `;
    }

    shadow.appendChild(card);
  }

  #escape(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}
