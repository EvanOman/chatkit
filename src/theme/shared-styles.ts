/**
 * Shared CSSStyleSheet instances for chatkit components.
 * Created once, adopted by all component instances via adoptedStyleSheets.
 */

/** Reset styles applied inside every component's shadow root. */
export const resetSheet = new CSSStyleSheet();
resetSheet.replaceSync(`
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  :host {
    display: block;
    font-family: var(--ck-font, system-ui, sans-serif);
    font-size: var(--ck-font-size, 0.9375rem);
    line-height: var(--ck-line-height, 1.6);
    color: var(--ck-text, #ececec);
  }
  :host([hidden]) {
    display: none;
  }
`);

/** Animation keyframes shared across components. */
export const animationsSheet = new CSSStyleSheet();
animationsSheet.replaceSync(`
  @keyframes ck-fade-in {
    from { opacity: 0; transform: translateY(8px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes ck-pulse-dot {
    0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
    40% { opacity: 1; transform: scale(1); }
  }
  @keyframes ck-spin {
    to { transform: rotate(360deg); }
  }
  @keyframes ck-glow-pulse {
    0%, 100% { box-shadow: 0 0 0 0 var(--ck-accent-glow, rgba(34, 197, 94, 0.25)); }
    50% { box-shadow: 0 0 16px 2px var(--ck-accent-glow, rgba(34, 197, 94, 0.25)); }
  }
`);

/** Markdown body styles for rendered assistant messages. */
export const markdownSheet = new CSSStyleSheet();
markdownSheet.replaceSync(`
  .ck-markdown {
    line-height: var(--ck-line-height, 1.6);
    word-wrap: break-word;
    overflow-wrap: break-word;
  }
  .ck-markdown p { margin-bottom: 0.75em; }
  .ck-markdown p:last-child { margin-bottom: 0; }
  .ck-markdown h1, .ck-markdown h2, .ck-markdown h3,
  .ck-markdown h4, .ck-markdown h5, .ck-markdown h6 {
    margin-top: 1em;
    margin-bottom: 0.5em;
    font-weight: 600;
    line-height: 1.3;
  }
  .ck-markdown h1 { font-size: 1.4em; }
  .ck-markdown h2 { font-size: 1.25em; }
  .ck-markdown h3 { font-size: 1.1em; }
  .ck-markdown ul, .ck-markdown ol {
    padding-left: 1.5em;
    margin-bottom: 0.75em;
  }
  .ck-markdown li { margin-bottom: 0.25em; }
  .ck-markdown code {
    background: var(--ck-bg-code, #0d1117);
    padding: 0.15em 0.4em;
    border-radius: 4px;
    font-family: var(--ck-font-mono, monospace);
    font-size: 0.85em;
    border: 1px solid var(--ck-border, #1e1e1e);
  }
  .ck-markdown pre {
    background: var(--ck-bg-code, #0d1117);
    padding: 1em;
    border-radius: var(--ck-radius, 0.75rem);
    overflow-x: auto;
    margin-bottom: 0.75em;
    border: 1px solid var(--ck-border, #1e1e1e);
  }
  .ck-markdown pre code {
    background: none;
    padding: 0;
    font-size: 0.85em;
    border: none;
  }
  .ck-markdown blockquote {
    border-left: 3px solid var(--ck-accent, #22c55e);
    padding-left: 1em;
    margin-bottom: 0.75em;
    color: var(--ck-text-secondary, #A1A1A1);
  }
  .ck-markdown table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 0.75em;
    font-size: 0.875em;
  }
  .ck-markdown th, .ck-markdown td {
    padding: 0.5em 0.75em;
    border: 1px solid var(--ck-border, #3d3d3d);
    text-align: left;
  }
  .ck-markdown th {
    background: var(--ck-table-header, #2a2a2a);
    font-weight: 600;
  }
  .ck-markdown a {
    color: var(--ck-accent, #22c55e);
    text-decoration: none;
  }
  .ck-markdown a:hover {
    text-decoration: underline;
  }
  .ck-markdown hr {
    border: none;
    border-top: 1px solid var(--ck-border, #3d3d3d);
    margin: 1em 0;
  }
  .ck-markdown strong { font-weight: 600; }
`);
