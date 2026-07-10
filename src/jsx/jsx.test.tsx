import { describe, expect, it } from 'vitest';
import { BehaviorSubject, Subject } from 'rxjs';
import { bindChild, Fragment, h, type ElementChild } from './jsx';

describe('h — static elements', () => {
  it('creates elements with tag, className and attributes', () => {
    const el = (
      <a className="link" href="https://example.com/" data-kind="external">
        hi
      </a>
    ) as HTMLAnchorElement;

    expect(el.tagName).toBe('A');
    expect(el.className).toBe('link');
    expect(el.getAttribute('href')).toBe('https://example.com/');
    expect(el.getAttribute('data-kind')).toBe('external');
    expect(el.textContent).toBe('hi');
  });

  it('sets boolean attributes only when true', () => {
    const required = (<input required />) as HTMLInputElement;
    const optional = (<input required={false} />) as HTMLInputElement;
    expect(required.hasAttribute('required')).toBe(true);
    expect(optional.hasAttribute('required')).toBe(false);
  });

  it('applies style objects and style strings', () => {
    const byObject = (<div style={{ display: 'none' }} />) as HTMLDivElement;
    const byString = (<div style="color: red" />) as HTMLDivElement;
    expect(byObject.style.display).toBe('none');
    expect(byString.getAttribute('style')).toBe('color: red');
  });

  it('sets the value property (not attribute) on inputs', () => {
    const el = (<input value="hello" />) as HTMLInputElement;
    expect(el.value).toBe('hello');
  });

  it('wires event handler props via addEventListener', () => {
    let clicks = 0;
    const el = (<button onClick={() => (clicks += 1)}>go</button>) as HTMLButtonElement;
    el.click();
    el.click();
    expect(clicks).toBe(2);
  });

  it('calls ref with the created element', () => {
    let captured: HTMLInputElement | null = null;
    const el = (<input ref={(node) => (captured = node)} />) as HTMLInputElement;
    expect(captured).toBe(el);
  });

  it('normalizes children: strings, numbers, nodes, nested arrays; skips null/false', () => {
    const span = (<span>x</span>) as HTMLSpanElement;
    const el = (
      <div>
        {'a'}
        {1}
        {null}
        {false}
        {undefined}
        {[span, ['y']]}
      </div>
    ) as HTMLDivElement;

    expect(el.textContent).toBe('a1xy');
    expect(el.querySelector('span')).toBe(span);
  });

  it('supports function components receiving props and children', () => {
    interface GreetProps {
      name: string;
      children?: ElementChild;
    }
    const Greet = ({ name, children }: GreetProps): JSX.Element => (
      <p className="greet">
        Hello {name}! {children}
      </p>
    );

    const el = (
      <Greet name="Rx">
        <em>welcome</em>
      </Greet>
    ) as HTMLParagraphElement;

    expect(el.className).toBe('greet');
    expect(el.textContent).toBe('Hello Rx! welcome');
    expect(el.querySelector('em')).not.toBeNull();
  });

  it('supports fragments', () => {
    const frag = (
      <>
        <i>a</i>
        <b>b</b>
      </>
    ) as DocumentFragment;

    expect(frag).toBeInstanceOf(DocumentFragment);
    expect(frag.childNodes.length).toBe(2);
    expect(frag.textContent).toBe('ab');
  });
});

describe('h — reactive props', () => {
  it('re-applies an observable className on each emission', () => {
    const cls$ = new BehaviorSubject('tab');
    const el = (<button className={cls$} />) as HTMLButtonElement;
    expect(el.className).toBe('tab');
    cls$.next('tab active');
    expect(el.className).toBe('tab active');
  });

  it('re-applies an observable style on each emission', () => {
    const style$ = new BehaviorSubject<Partial<CSSStyleDeclaration>>({ display: 'none' });
    const el = (<input style={style$} />) as HTMLInputElement;
    expect(el.style.display).toBe('none');
    style$.next({ display: 'block' });
    expect(el.style.display).toBe('block');
  });
});

describe('bindChild — live regions', () => {
  it('renders observable children into an anchored region', () => {
    const content$ = new Subject<ElementChild>();
    const el = (<div>{content$}</div>) as HTMLDivElement;

    content$.next(<span>one</span>);
    expect(el.querySelectorAll('span').length).toBe(1);
    expect(el.textContent).toBe('one');

    content$.next([<span>two</span>, <span>three</span>]);
    expect(el.querySelectorAll('span').length).toBe(2);
    expect(el.textContent).toBe('twothree');
  });

  it('leaves static siblings untouched (identity and focus survive emissions)', () => {
    const content$ = new Subject<ElementChild>();
    const input = (<input type="text" />) as HTMLInputElement;
    const el = (
      <div>
        {input}
        {content$}
      </div>
    ) as HTMLDivElement;

    document.body.appendChild(el);
    input.focus();
    input.value = 'typing…';

    content$.next(<p>first</p>);
    content$.next(<p>second</p>);

    expect(el.querySelector('input')).toBe(input);
    expect(input.value).toBe('typing…');
    expect(document.activeElement).toBe(input);
    expect(el.querySelectorAll('p').length).toBe(1);
    expect(el.textContent).toContain('second');

    el.remove();
  });

  it('returns a subscription that stops updates when unsubscribed', () => {
    const source$ = new Subject<ElementChild>();
    const parent = document.createElement('div');
    const sub = bindChild(parent, source$);

    source$.next('x');
    expect(parent.textContent).toBe('x');

    sub.unsubscribe();
    source$.next('y');
    expect(parent.textContent).toBe('x');
  });
});
