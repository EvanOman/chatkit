/**
 * CkBase — Thin reactive base class for all chatkit Web Components.
 *
 * Provides:
 * - Reactive properties with attribute reflection
 * - Batched updates via queueMicrotask
 * - Automatic cleanup registration for event listeners, observers, etc.
 * - Shadow DOM setup with adoptedStyleSheets
 */

export type AttributeType = typeof String | typeof Number | typeof Boolean;

export interface PropertyDeclaration {
  /** The attribute type for conversion. Defaults to String. */
  readonly type?: AttributeType;
  /** Whether property changes reflect back to the attribute. */
  readonly reflect?: boolean;
  /** Custom attribute name. Defaults to kebab-case of the property name. */
  readonly attribute?: string;
}

export type PropertyDeclarationMap = Record<string, PropertyDeclaration>;

function toKebabCase(str: string): string {
  return str.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function fromAttribute(
  value: string | null,
  type?: AttributeType,
): string | number | boolean | null {
  switch (type) {
    case Boolean:
      return value !== null;
    case Number:
      return value === null ? null : Number(value);
    default:
      return value;
  }
}

function toAttribute(
  value: unknown,
  type?: AttributeType,
): string | null {
  switch (type) {
    case Boolean:
      return value ? "" : null;
    case Number:
      return value == null ? null : String(value);
    default:
      return value == null ? null : String(value);
  }
}

export abstract class CkBase extends HTMLElement {
  static properties: PropertyDeclarationMap = {};

  /** Shared stylesheets adopted by all instances of this component. */
  static styles: CSSStyleSheet[] = [];

  #cleanups: (() => void)[] = [];
  #updateRequested = false;
  #connected = false;

  // Property values stored here (keyed by property name)
  #values = new Map<string, unknown>();

  static get observedAttributes(): string[] {
    return Object.entries(this.properties).map(
      ([name, decl]) => decl.attribute ?? toKebabCase(name),
    );
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.#defineReactiveProperties();

    // Adopt shared styles
    const ctor = this.constructor as typeof CkBase;
    if (ctor.styles.length > 0) {
      this.shadowRoot!.adoptedStyleSheets = [...ctor.styles];
    }
  }

  #defineReactiveProperties(): void {
    const ctor = this.constructor as typeof CkBase;
    for (const [name, decl] of Object.entries(ctor.properties)) {
      // Capture initial value if set before upgrade
      let initialValue = (this as Record<string, unknown>)[name];
      this.#values.set(name, initialValue);

      Object.defineProperty(this, name, {
        get: () => this.#values.get(name),
        set: (newValue: unknown) => {
          const oldValue = this.#values.get(name);
          if (Object.is(oldValue, newValue)) return;
          this.#values.set(name, newValue);
          if (decl.reflect) {
            this.#reflectToAttribute(name, newValue, decl);
          }
          if (this.#connected) {
            this.requestUpdate();
          }
        },
        configurable: true,
        enumerable: true,
      });
    }
  }

  #reflectToAttribute(
    name: string,
    value: unknown,
    decl: PropertyDeclaration,
  ): void {
    const attrName = decl.attribute ?? toKebabCase(name);
    const attrValue = toAttribute(value, decl.type);
    if (attrValue === null) {
      this.removeAttribute(attrName);
    } else {
      this.setAttribute(attrName, attrValue);
    }
  }

  attributeChangedCallback(
    name: string,
    _old: string | null,
    value: string | null,
  ): void {
    const ctor = this.constructor as typeof CkBase;
    for (const [prop, decl] of Object.entries(ctor.properties)) {
      const attrName = decl.attribute ?? toKebabCase(prop);
      if (attrName === name) {
        // Set via the property setter to trigger update
        (this as Record<string, unknown>)[prop] = fromAttribute(value, decl.type);
        break;
      }
    }
  }

  connectedCallback(): void {
    this.#connected = true;
    this.requestUpdate();
  }

  disconnectedCallback(): void {
    this.#connected = false;
    for (const fn of this.#cleanups) {
      try {
        fn();
      } catch {
        // Cleanup should never throw to the caller
      }
    }
    this.#cleanups.length = 0;
  }

  /** Register a cleanup function that runs on disconnectedCallback. */
  protected addCleanup(fn: () => void): void {
    this.#cleanups.push(fn);
  }

  /** Add an event listener with automatic cleanup on disconnect. */
  protected listen(
    target: EventTarget,
    event: string,
    handler: EventListener,
    options?: AddEventListenerOptions,
  ): void {
    target.addEventListener(event, handler, options);
    this.#cleanups.push(() =>
      target.removeEventListener(event, handler, options),
    );
  }

  /** Request a batched update via queueMicrotask. */
  protected requestUpdate(): void {
    if (this.#updateRequested) return;
    this.#updateRequested = true;
    queueMicrotask(() => {
      this.#updateRequested = false;
      if (this.#connected) {
        this.update();
      }
    });
  }

  /** Override in subclasses to render/update the component. */
  protected abstract update(): void;
}
