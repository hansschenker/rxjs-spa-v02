import type { ElementChild, HtmlProps, JsxElement } from './jsx';

declare global {
  namespace JSX {
    type Element = JsxElement;
    type IntrinsicElements = {
      [K in keyof HTMLElementTagNameMap]: HtmlProps<HTMLElementTagNameMap[K]>;
    };
    interface ElementChildrenAttribute {
      children: ElementChild;
    }
  }
}

export {};
