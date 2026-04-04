/**
 * <ck-artifact> — Tabbed rich card for structured data display.
 *
 * Generalized from sandbox-agent's artifact card. Accepts arbitrary
 * JSON data and renders configurable tabs.
 */

import DOMPurify from "dompurify";
import { CkBase } from "../../lib/ck-base.js";
import { resetSheet, animationsSheet } from "../../theme/shared-styles.js";

const componentSheet = new CSSStyleSheet();
componentSheet.replaceSync(`
  :host {
    display: block;
    animation: ck-fade-in 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .card {
    border: 1px solid var(--ck-border, #1e1e1e);
    border-radius: var(--ck-radius, 0.75rem);
    overflow: hidden;
    background: var(--ck-bg-surface, #141414);
  }
  .tab-bar {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--ck-border, #1e1e1e);
    background: var(--ck-table-header, #111111);
    overflow-x: auto;
  }
  .tab-btn {
    padding: 0.5rem 1rem;
    border: none;
    background: transparent;
    color: var(--ck-text-muted, #5a5a5a);
    font-size: var(--ck-font-size-sm, 0.8125rem);
    font-family: var(--ck-font, system-ui, sans-serif);
    cursor: pointer;
    white-space: nowrap;
    border-bottom: 2px solid transparent;
    transition: color 0.15s, border-color 0.15s;
  }
  .tab-btn:hover {
    color: var(--ck-text, #F0F0F0);
  }
  .tab-btn.active {
    color: var(--ck-accent, #7c5bf5);
    border-bottom-color: var(--ck-accent, #7c5bf5);
  }
  .tab-content {
    padding: 0.75rem 1rem;
    max-height: 24rem;
    overflow: auto;
  }
  .tab-content::-webkit-scrollbar {
    width: 4px;
    height: 4px;
  }
  .tab-content::-webkit-scrollbar-thumb {
    background: var(--ck-scrollbar, #2a2a2a);
    border-radius: 2px;
  }
  .tab-content pre {
    margin: 0;
    font-family: var(--ck-font-mono, monospace);
    font-size: 0.85em;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85em;
  }
  .data-table th, .data-table td {
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--ck-border, #1e1e1e);
    text-align: left;
  }
  .data-table th {
    background: var(--ck-table-header, #111111);
    font-weight: 600;
    position: sticky;
    top: 0;
    color: var(--ck-text-secondary, #A1A1A1);
    text-transform: uppercase;
    font-size: 0.75em;
    letter-spacing: 0.05em;
  }
  .data-table tr:nth-child(even) td {
    background: var(--ck-table-stripe, #0e0e0e);
  }
  .data-table tr:hover td {
    background: var(--ck-table-hover, #1a1540);
  }
  .error-text {
    color: var(--ck-text-error, #ff6b6b);
  }
`);

export interface ArtifactTab {
  label: string;
  content: string; // HTML string (will be sanitized) or "table" for auto-table
  type?: "html" | "code" | "table" | "text";
}

export interface ArtifactData {
  id?: string;
  type?: string;
  data?: unknown;
  code?: string;
  error?: string;
  result_json?: string;
  result_type?: string;
}

export class CkArtifact extends CkBase {
  static override styles = [resetSheet, animationsSheet, componentSheet];

  #tabs: ArtifactTab[] = [];
  #activeTab = 0;

  /** Set the artifact data and auto-generate tabs. */
  setData(data: ArtifactData): void {
    this.#tabs = this.#generateTabs(data);
    this.#activeTab = 0;
    this.requestUpdate();
  }

  #generateTabs(data: ArtifactData): ArtifactTab[] {
    const tabs: ArtifactTab[] = [];

    // Try to parse result_json
    let parsed: unknown = null;
    if (data.result_json) {
      try {
        parsed = JSON.parse(data.result_json);
      } catch {
        // Leave as null
      }
    }

    // Result tab (based on type)
    if (parsed != null) {
      if (data.result_type === "table" && Array.isArray(parsed) && parsed.length > 0) {
        tabs.push({ label: "Table", content: this.#renderTable(parsed), type: "html" });
      } else if (data.result_type === "scalar") {
        tabs.push({ label: "Value", content: String(parsed), type: "text" });
      } else {
        tabs.push({ label: "Result", content: JSON.stringify(parsed, null, 2), type: "code" });
      }
    }

    // Error tab
    if (data.error) {
      tabs.push({ label: "Error", content: data.error, type: "text" });
    }

    // Code tab
    if (data.code) {
      tabs.push({ label: "Code", content: data.code, type: "code" });
    }

    // Raw JSON tab
    if (data.result_json) {
      tabs.push({ label: "Raw JSON", content: data.result_json, type: "code" });
    }

    return tabs;
  }

  #renderTable(rows: Record<string, unknown>[]): string {
    if (rows.length === 0) return "<p>No data</p>";
    const keys = Object.keys(rows[0]!);
    const header = keys.map((k) => `<th>${this.#escape(k)}</th>`).join("");
    const body = rows
      .slice(0, 100)
      .map(
        (row) =>
          `<tr>${keys.map((k) => `<td>${this.#escape(String(row[k] ?? ""))}</td>`).join("")}</tr>`,
      )
      .join("");
    let html = `<table class="data-table"><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
    if (rows.length > 100) {
      html += `<p style="color:var(--ck-text-muted);font-size:0.8em;margin-top:0.5em;">Showing 100 of ${rows.length} rows</p>`;
    }
    return html;
  }

  #escape(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  protected override update(): void {
    const shadow = this.shadowRoot!;
    shadow.innerHTML = "";

    if (this.#tabs.length === 0) return;

    const card = document.createElement("div");
    card.className = "card";

    // Tab bar
    const tabBar = document.createElement("div");
    tabBar.className = "tab-bar";

    this.#tabs.forEach((tab, i) => {
      const btn = document.createElement("button");
      btn.className = `tab-btn${i === this.#activeTab ? " active" : ""}`;
      btn.textContent = tab.label;
      btn.addEventListener("click", () => {
        this.#activeTab = i;
        this.requestUpdate();
      });
      tabBar.appendChild(btn);
    });

    card.appendChild(tabBar);

    // Active tab content
    const activeTab = this.#tabs[this.#activeTab];
    if (activeTab) {
      const content = document.createElement("div");
      content.className = "tab-content";

      if (activeTab.type === "code") {
        const pre = document.createElement("pre");
        const code = document.createElement("code");
        code.textContent = activeTab.content;
        pre.appendChild(code);
        content.appendChild(pre);
      } else if (activeTab.type === "html") {
        content.innerHTML = DOMPurify.sanitize(activeTab.content, {
          ALLOWED_TAGS: ["table", "thead", "tbody", "tr", "th", "td", "p"],
          ALLOWED_ATTR: ["class", "style"],
        });
      } else if (activeTab.type === "text") {
        const isError = activeTab.label === "Error";
        const p = document.createElement("pre");
        if (isError) p.className = "error-text";
        p.textContent = activeTab.content;
        content.appendChild(p);
      } else {
        content.textContent = activeTab.content;
      }

      card.appendChild(content);
    }

    shadow.appendChild(card);
  }
}
