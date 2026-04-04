/**
 * <ck-message> — A single chat message bubble (user or assistant).
 *
 * For assistant messages, supports streaming markdown via streaming-markdown (smd)
 * with DOMPurify sanitization and requestAnimationFrame batching.
 */

import DOMPurify from "dompurify";
import * as smd from "streaming-markdown";
import { CkBase } from "../../lib/ck-base.js";
import {
  resetSheet,
  animationsSheet,
  markdownSheet,
} from "../../theme/shared-styles.js";

const componentSheet = new CSSStyleSheet();
componentSheet.replaceSync(`
  :host {
    display: block;
    animation: ck-fade-in 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .bubble {
    padding: 0.75rem 1rem;
    border-radius: var(--ck-radius-lg, 1.25rem);
    max-width: var(--ck-max-message-width, 48rem);
    word-wrap: break-word;
    overflow-wrap: break-word;
    transition: box-shadow 0.2s ease;
  }
  .bubble.user {
    background: linear-gradient(135deg, var(--ck-accent, #7c5bf5) 0%, #9333ea 100%);
    color: #fff;
    margin-left: auto;
    border-bottom-right-radius: 4px;
    max-width: 80%;
    box-shadow: 0 2px 16px var(--ck-shadow-accent, rgba(124, 91, 245, 0.15));
  }
  .bubble.assistant {
    background: var(--ck-bg-surface, #141414);
    border: 1px solid var(--ck-border, #1e1e1e);
    border-bottom-left-radius: 4px;
  }
  .bubble.error {
    background: var(--ck-bg-error, #2a0a0a);
    color: var(--ck-text-error, #ff6b6b);
    border: 1px solid var(--ck-border-error, #4c1d1d);
  }
  .code-block {
    margin: 0.5rem 0;
  }
  .code-block summary {
    cursor: pointer;
    color: var(--ck-text-muted, #5a5a5a);
    font-size: var(--ck-font-size-sm, 0.8125rem);
    font-family: var(--ck-font-mono, monospace);
    padding: 0.25rem 0;
    transition: color 0.15s;
  }
  .code-block summary:hover {
    color: var(--ck-text-secondary, #A1A1A1);
  }
  .code-block pre {
    background: var(--ck-bg-code, #0d1117);
    padding: 0.75rem 1rem;
    border-radius: var(--ck-radius, 0.75rem);
    overflow-x: auto;
    font-family: var(--ck-font-mono, monospace);
    font-size: 0.85em;
    line-height: 1.5;
    border: 1px solid var(--ck-border, #1e1e1e);
  }
`);

export class CkMessage extends CkBase {
  static override properties = {
    role: { type: String, reflect: true },
  };

  static override styles = [
    resetSheet,
    animationsSheet,
    markdownSheet,
    componentSheet,
  ];

  /** The message role: "user", "assistant", or "error". */
  declare role: string;

  // Streaming state
  #parser: ReturnType<typeof smd.parser> | null = null;
  #container: HTMLDivElement | null = null;
  #pendingText = "";
  #rafScheduled = false;
  #streaming = false;
  #finalContent = "";

  /** Start streaming mode — subsequent appendText() calls render incrementally. */
  startStreaming(): void {
    this.#streaming = true;
    this.#pendingText = "";
    this.#finalContent = "";
    this.requestUpdate();
  }

  /** Append a chunk of streaming text (for assistant messages). */
  appendText(chunk: string): void {
    if (!this.#streaming) return;
    this.#pendingText += chunk;
    this.#finalContent += chunk;

    if (!this.#rafScheduled) {
      this.#rafScheduled = true;
      requestAnimationFrame(() => {
        this.#rafScheduled = false;
        if (this.#parser && this.#pendingText) {
          smd.parser_write(this.#parser, this.#pendingText);
          this.#pendingText = "";
          // Note: do NOT sanitize during streaming — it destroys smd's
          // internal DOM references. Sanitization happens in endStreaming().
        }
      });
    }
  }

  /** End streaming and finalize the message content. */
  endStreaming(): void {
    if (this.#parser) {
      // Flush any remaining pending text
      if (this.#pendingText) {
        smd.parser_write(this.#parser, this.#pendingText);
        this.#pendingText = "";
      }
      smd.parser_end(this.#parser);
      this.#parser = null;
      this.#sanitizeContainer();
    }
    this.#streaming = false;
  }

  /** Set full message content (for loading history, not streaming). */
  setContent(content: string): void {
    this.#streaming = false;
    this.#finalContent = content;
    this.requestUpdate();
  }

  /** Append a collapsible code block to the message. */
  appendCodeBlock(code: string, label = "Code"): void {
    if (!this.#container) return;
    const details = document.createElement("details");
    details.className = "code-block";
    const summary = document.createElement("summary");
    summary.textContent = `${label}`;
    const pre = document.createElement("pre");
    const codeEl = document.createElement("code");
    codeEl.textContent = code;
    pre.appendChild(codeEl);
    details.appendChild(summary);
    details.appendChild(pre);
    this.#container.appendChild(details);
  }

  #sanitizeContainer(): void {
    if (!this.#container) return;
    // Sanitize the rendered HTML in-place
    const clean = DOMPurify.sanitize(this.#container.innerHTML, {
      ALLOWED_TAGS: [
        "p", "strong", "em", "code", "pre", "ul", "ol", "li", "a",
        "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "table",
        "thead", "tbody", "tr", "th", "td", "br", "hr", "details",
        "summary", "span", "div", "del", "s",
      ],
      ALLOWED_ATTR: ["href", "class", "open"],
      ALLOW_DATA_ATTR: false,
    });
    if (clean !== this.#container.innerHTML) {
      this.#container.innerHTML = clean;
    }
  }

  protected override update(): void {
    const shadow = this.shadowRoot!;
    const role = this.role ?? "assistant";

    if (!this.#container) {
      // First render — create the DOM structure
      shadow.innerHTML = "";
      const bubble = document.createElement("div");
      bubble.className = `bubble ${role}`;

      if (role === "user") {
        this.#container = bubble;
      } else {
        const markdown = document.createElement("div");
        markdown.className = "ck-markdown";
        bubble.appendChild(markdown);
        this.#container = markdown;
      }

      shadow.appendChild(bubble);
    }

    if (role === "user" && this.#container) {
      // User messages render as plain text
      this.#container.textContent = this.#finalContent;
      return;
    }

    if (this.#streaming && !this.#parser && this.#container) {
      // Initialize the streaming parser
      this.#container.innerHTML = "";
      const renderer = smd.default_renderer(this.#container);
      this.#parser = smd.parser(renderer);
    }

    if (!this.#streaming && !this.#parser && this.#container && this.#finalContent) {
      // Render full content (history replay)
      const renderer = smd.default_renderer(this.#container);
      const parser = smd.parser(renderer);
      smd.parser_write(parser, this.#finalContent);
      smd.parser_end(parser);
      this.#sanitizeContainer();
    }
  }
}
