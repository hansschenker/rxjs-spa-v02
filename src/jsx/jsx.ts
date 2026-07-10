/**
 * Framework-less JSX runtime: `h` creates real DOM elements (no virtual-dom,
 * no React). Observables can appear as children (rendered via comment-anchored
 * live regions, see `bindChild`), as select prop values, and lists can be
 * reconciled by key so surviving nodes keep their DOM identity (`bindKeyedList`).
 *
 * Subscription lifecycle: every stream bound to a node (observable props,
 * nested regions) is registered against that node in a WeakMap. When a region
 * or keyed list removes a node, `disposeBindings` walks the removed subtree
 * and unsubscribes everything — regions are leak-free. Bindings on the app's
 * permanent shell intentionally live for the page lifetime.
 */
import { isObservable, type Observable, type Subscription } from 'rxjs';

export type ElementChild =
  | Node
  | string
  | number
  | boolean
  | null
  | undefined
  | Observable<ElementChild>
  | ElementChild[];

export type PropValue<T> = T | Observable<T>;

export interface HtmlProps<E extends HTMLElement = HTMLElement> {
  className?: PropValue<string>;
  id?: string;
  title?: string;
  href?: string;
  target?: string;
  rel?: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  value?: PropValue<string>;
  disabled?: PropValue<boolean>;
  hidden?: PropValue<boolean>;
  style?: PropValue<string | Partial<CSSStyleDeclaration>>;
  ref?: (el: E) => void;
  onClick?: (ev: MouseEvent) => void;
  onInput?: (ev: Event) => void;
  onKeyUp?: (ev: KeyboardEvent) => void;
  onKeyDown?: (ev: KeyboardEvent) => void;
  children?: ElementChild;
  [dataAttr: `data-${string}`]: string | number | boolean | undefined;
}

export type JsxElement = HTMLElement | DocumentFragment;
export type FunctionComponent<P = object> = (props: P) => JsxElement;

const bindingRegistry = new WeakMap<Node, Subscription[]>();

function registerBinding(node: Node, sub: Subscription): void {
  const existing = bindingRegistry.get(node);
  if (existing) existing.push(sub);
  else bindingRegistry.set(node, [sub]);
}

/** Unsubscribe every stream bound to `root` or any of its descendants. */
export function disposeBindings(root: Node): void {
  disposeNode(root);
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT,
  );
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    disposeNode(node);
  }
}

function disposeNode(node: Node): void {
  const subs = bindingRegistry.get(node);
  if (!subs) return;
  bindingRegistry.delete(node);
  for (const sub of subs) sub.unsubscribe();
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: HtmlProps<HTMLElementTagNameMap[K]> | null,
  ...children: ElementChild[]
): HTMLElementTagNameMap[K];
export function h<P extends object>(
  tag: FunctionComponent<P>,
  props: P | null,
  ...children: ElementChild[]
): JsxElement;
export function h(
  tag: string | FunctionComponent<never>,
  props: object | null,
  ...children: ElementChild[]
): JsxElement {
  if (typeof tag === 'function') {
    const componentChildren: ElementChild =
      children.length === 0 ? undefined : children.length === 1 ? children[0] : children;
    const component = tag as FunctionComponent<Record<string, unknown>>;
    return component({ ...(props ?? {}), children: componentChildren });
  }

  const el = document.createElement(tag);
  let refFn: ((element: HTMLElement) => void) | undefined;

  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (key === 'children') continue;
      if (key === 'ref' && typeof value === 'function') {
        refFn = value as (element: HTMLElement) => void;
        continue;
      }
      setProp(el, key, value);
    }
  }

  appendChild(el, children);
  refFn?.(el);
  return el;
}

export function Fragment(
  props: { children?: ElementChild } | null,
  ...children: ElementChild[]
): DocumentFragment {
  const frag = document.createDocumentFragment();
  appendChild(frag, props?.children);
  appendChild(frag, children);
  return frag;
}

function setProp(el: HTMLElement, key: string, value: unknown): void {
  if (isObservable(value)) {
    registerBinding(
      el,
      value.subscribe((v) => applyProp(el, key, v)),
    );
    return;
  }
  applyProp(el, key, value);
}

function applyProp(el: HTMLElement, key: string, value: unknown): void {
  if (/^on[A-Z]/.test(key) && typeof value === 'function') {
    el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    return;
  }
  if (key === 'className') {
    el.className = typeof value === 'string' ? value : '';
    return;
  }
  if (key === 'style') {
    if (typeof value === 'string') {
      el.setAttribute('style', value);
    } else if (value && typeof value === 'object') {
      Object.assign(el.style, value);
    }
    return;
  }
  if (
    key === 'value' &&
    (el instanceof HTMLInputElement ||
      el instanceof HTMLTextAreaElement ||
      el instanceof HTMLSelectElement)
  ) {
    el.value = value == null ? '' : String(value);
    return;
  }
  if (typeof value === 'boolean') {
    if (value) el.setAttribute(key, '');
    else el.removeAttribute(key);
    return;
  }
  if (value == null) {
    el.removeAttribute(key);
    return;
  }
  el.setAttribute(key, String(value));
}

function appendChild(parent: Node, child: ElementChild): void {
  if (child == null || typeof child === 'boolean') return;
  if (Array.isArray(child)) {
    for (const item of child) appendChild(parent, item);
    return;
  }
  if (isObservable(child)) {
    bindChild(parent, child);
    return;
  }
  if (child instanceof Node) {
    parent.appendChild(child);
    return;
  }
  parent.appendChild(document.createTextNode(String(child)));
}

/**
 * Reserves a live region in `parent` between two comment anchors. On each
 * emission the nodes between the anchors are replaced by the normalized value
 * (same rules as static JSX children); the removed nodes' stream bindings are
 * disposed. Sibling nodes outside the anchors are never touched — that is
 * what keeps focus/state alive in static siblings. Streams bound to the DOM
 * must never error; pipe catchError upstream.
 */
export function bindChild(parent: Node, source$: Observable<ElementChild>): Subscription {
  const start = document.createComment('rx:start');
  const end = document.createComment('rx:end');
  parent.appendChild(start);
  parent.appendChild(end);

  const sub = source$.subscribe({
    next: (value) => {
      clearRegion(start, end);
      const frag = document.createDocumentFragment();
      appendChild(frag, value);
      end.before(frag);
    },
    error: (err: unknown) => {
      console.error('Observable bound to the DOM errored — region is now frozen', err);
    },
  });
  registerBinding(start, sub);
  return sub;
}

function clearRegion(start: Comment, end: Comment): void {
  while (start.nextSibling && start.nextSibling !== end) {
    const node = start.nextSibling;
    disposeBindings(node);
    node.remove();
  }
}

export interface KeyedListBinding<T> {
  /** Stable unique key per item (e.g. a primary key). */
  key(item: T): string;
  /** Called once per key while the key stays in the list; the node is reused across emissions. */
  create(item: T): HTMLElement;
}

/**
 * Fine-grained list rendering: keyed sibling reconciliation in an anchored
 * region. On each emission, nodes for new keys are created, nodes for
 * vanished keys are removed (their stream bindings disposed), and surviving
 * nodes keep their DOM identity — they are only moved when their relative
 * order changed. Item-local state updates belong on per-item streams bound
 * inside `create`, not on the list stream.
 */
export function bindKeyedList<T>(
  parent: Node,
  source$: Observable<readonly T[]>,
  binding: KeyedListBinding<T>,
): Subscription {
  const start = document.createComment('rx:keyed:start');
  const end = document.createComment('rx:keyed:end');
  parent.appendChild(start);
  parent.appendChild(end);

  let nodesByKey = new Map<string, HTMLElement>();

  const sub = source$.subscribe({
    next: (items) => {
      const nextNodes = new Map<string, HTMLElement>();
      const orderedNodes: HTMLElement[] = [];
      for (const item of items) {
        const key = binding.key(item);
        if (nextNodes.has(key)) continue; // duplicate keys: keep the first, ignore the rest
        const node = nodesByKey.get(key) ?? binding.create(item);
        nodesByKey.delete(key);
        nextNodes.set(key, node);
        orderedNodes.push(node);
      }
      for (const node of nodesByKey.values()) {
        disposeBindings(node);
        node.remove();
      }
      // Single pass: move a node only when it is not already in position.
      let anchor: ChildNode = start;
      for (const node of orderedNodes) {
        if (anchor.nextSibling !== node) anchor.after(node);
        anchor = node;
      }
      nodesByKey = nextNodes;
    },
    error: (err: unknown) => {
      console.error('Keyed list stream errored — list is now frozen', err);
    },
  });
  registerBinding(start, sub);
  return sub;
}
