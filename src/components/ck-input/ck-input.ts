/**
 * <ck-input> — Chat text input with send button and stop button.
 *
 * Dispatches "ck-submit" CustomEvent with the message text.
 * Shows a stop button during streaming.
 */

import { CkBase } from "../../lib/ck-base.js";
import { resetSheet } from "../../theme/shared-styles.js";

const componentSheet = new CSSStyleSheet();
componentSheet.replaceSync(`
  :host {
    display: block;
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--ck-border, #3d3d3d);
    background: var(--ck-bg, #212121);
  }
  .input-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--ck-bg-input, #303030);
    border-radius: 1.5rem;
    padding: 0.375rem 0.375rem 0.375rem 1rem;
  }
  input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    color: var(--ck-text, #ececec);
    font-family: var(--ck-font, system-ui, sans-serif);
    font-size: var(--ck-font-size, 0.9375rem);
    line-height: 1.4;
  }
  input::placeholder {
    color: var(--ck-text-muted, #777);
  }
  .btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.15s;
  }
  .send-btn {
    background: var(--ck-accent, #8b7cf6);
    color: #fff;
  }
  .send-btn:hover {
    background: var(--ck-accent-hover, #7a6be5);
  }
  .send-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .stop-btn {
    background: var(--ck-text-error, #f87171);
    color: #fff;
  }
  .stop-btn:hover {
    opacity: 0.85;
  }
  .btn svg {
    width: 1rem;
    height: 1rem;
  }
`);

export class CkInput extends CkBase {
  static override properties = {
    streaming: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    placeholder: { type: String },
  };

  static override styles = [resetSheet, componentSheet];

  declare streaming: boolean;
  declare disabled: boolean;
  declare placeholder: string;

  #input: HTMLInputElement | null = null;
  #sendBtn: HTMLButtonElement | null = null;
  #stopBtn: HTMLButtonElement | null = null;

  /** Focus the input field. */
  focusInput(): void {
    this.#input?.focus();
  }

  protected override update(): void {
    const shadow = this.shadowRoot!;

    if (!this.#input) {
      // First render
      shadow.innerHTML = "";

      const row = document.createElement("div");
      row.className = "input-row";

      this.#input = document.createElement("input");
      this.#input.type = "text";
      this.#input.placeholder = this.placeholder ?? "Send a message...";
      this.#input.autocomplete = "off";

      // Send button (arrow icon)
      this.#sendBtn = document.createElement("button");
      this.#sendBtn.className = "btn send-btn";
      this.#sendBtn.type = "button";
      this.#sendBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;

      // Stop button (square icon)
      this.#stopBtn = document.createElement("button");
      this.#stopBtn.className = "btn stop-btn";
      this.#stopBtn.type = "button";
      this.#stopBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`;
      this.#stopBtn.style.display = "none";

      row.appendChild(this.#input);
      row.appendChild(this.#sendBtn);
      row.appendChild(this.#stopBtn);
      shadow.appendChild(row);

      // Event handlers
      this.listen(this.#input, "keydown", ((e: KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          this.#submit();
        }
      }) as EventListener);

      this.listen(this.#sendBtn, "click", () => this.#submit());
      this.listen(this.#stopBtn, "click", () => {
        this.dispatchEvent(
          new CustomEvent("ck-stop", { bubbles: true, composed: true }),
        );
      });
    }

    // Update state
    const isStreaming = this.streaming ?? false;
    const isDisabled = this.disabled ?? false;

    this.#input!.disabled = isStreaming || isDisabled;
    this.#sendBtn!.disabled = isStreaming || isDisabled;
    this.#sendBtn!.style.display = isStreaming ? "none" : "";
    this.#stopBtn!.style.display = isStreaming ? "" : "none";

    if (this.placeholder) {
      this.#input!.placeholder = this.placeholder;
    }
  }

  #submit(): void {
    if (!this.#input || this.streaming || this.disabled) return;
    const text = this.#input.value.trim();
    if (!text) return;

    this.#input.value = "";
    this.dispatchEvent(
      new CustomEvent("ck-submit", {
        bubbles: true,
        composed: true,
        detail: { message: text },
      }),
    );
  }
}
