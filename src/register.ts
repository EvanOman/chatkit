/**
 * Auto-registration module for chatkit Web Components.
 *
 * Import this module for side-effect registration of all components:
 *   import 'chatkit/register';
 *
 * Each component is guarded against double-registration.
 */

import { CkMessage } from "./components/ck-message/ck-message.js";
import { CkMessages } from "./components/ck-messages/ck-messages.js";
import { CkInput } from "./components/ck-input/ck-input.js";
import { CkToolCard } from "./components/ck-tool-card/ck-tool-card.js";
import { CkArtifact } from "./components/ck-artifact/ck-artifact.js";

const components = [
  { tag: "ck-message", cls: CkMessage },
  { tag: "ck-messages", cls: CkMessages },
  { tag: "ck-input", cls: CkInput },
  { tag: "ck-tool-card", cls: CkToolCard },
  { tag: "ck-artifact", cls: CkArtifact },
] as const;

for (const { tag, cls } of components) {
  if (!customElements.get(tag)) {
    customElements.define(tag, cls);
  }
}
