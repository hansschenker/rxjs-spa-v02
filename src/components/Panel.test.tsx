import { describe, expect, it } from 'vitest';
import { BehaviorSubject } from 'rxjs';
import { h } from '../jsx/jsx';
import { Panel } from './Panel';

describe('Panel — reusable container with children slot', () => {
  it('renders the title and projects children into the slot', () => {
    const el = (
      <Panel title="Filters">
        <button className="inner">child</button>
      </Panel>
    ) as HTMLElement;

    expect(el.querySelector('.panel-title')?.textContent).toBe('Filters');
    expect(el.querySelector('.panel-body .inner')?.textContent).toBe('child');
  });

  it('toggles collapse on header click, hiding the body declaratively', () => {
    const el = (
      <Panel title="T">
        <span>x</span>
      </Panel>
    ) as HTMLElement;
    const header = el.querySelector('.panel-header') as HTMLButtonElement;
    const body = el.querySelector('.panel-body') as HTMLDivElement;

    expect(body.hasAttribute('hidden')).toBe(false);
    expect(el.className).toBe('panel');

    header.click();
    expect(body.hasAttribute('hidden')).toBe(true);
    expect(el.className).toBe('panel collapsed');

    header.click();
    expect(body.hasAttribute('hidden')).toBe(false);
  });

  it('starts collapsed when configured and accepts a live observable title', () => {
    const title$ = new BehaviorSubject('Before');
    const el = (
      <Panel title={title$} collapsed>
        <span>x</span>
      </Panel>
    ) as HTMLElement;

    expect((el.querySelector('.panel-body') as HTMLDivElement).hasAttribute('hidden')).toBe(true);

    title$.next('After');
    expect(el.querySelector('.panel-title')?.textContent).toBe('After');
  });

  it('accepts observable children in the slot (nested live region)', () => {
    const content$ = new BehaviorSubject<string>('first');
    const el = (<Panel title="Live">{content$}</Panel>) as HTMLElement;
    const body = el.querySelector('.panel-body') as HTMLDivElement;

    expect(body.textContent).toBe('first');
    content$.next('second');
    expect(body.textContent).toBe('second');
  });
});
