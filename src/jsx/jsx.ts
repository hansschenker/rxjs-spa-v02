/**
 * Framework-less JSX runtime: `h` creates real DOM elements (no virtual-dom,
 * no React). Observables can appear as children (rendered via comment-anchored
 * live regions, see `bindChild`) and as select prop values.
 *
 * Subscription lifecycle: this app's shell mounts once and never unmounts, so
 * subscriptions created for observable children/props intentionally live for
 * the page lifetime. `bindChild` returns its Subscription for tests. If the
 * app ever grows unmountable regions, add MutationObserver-based auto-dispose.
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
    value.subscribe((v) => applyProp(el, key, v));
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
 * (same rules as static JSX children). Sibling nodes outside the anchors are
 * never touched — that is what keeps focus/state alive in static siblings.
 * Streams bound to the DOM must never error; pipe catchError upstream.
 */
export function bindChild(parent: Node, source$: Observable<ElementChild>): Subscription {
  const start = document.createComment('rx:start');
  const end = document.createComment('rx:end');
  parent.appendChild(start);
  parent.appendChild(end);

  return source$.subscribe({
    next: (value) => {
      while (start.nextSibling && start.nextSibling !== end) {
        start.nextSibling.remove();
      }
      const frag = document.createDocumentFragment();
      appendChild(frag, value);
      end.before(frag);
    },
    error: (err: unknown) => {
      console.error('Observable bound to the DOM errored — region is now frozen', err);
    },
  });
}
