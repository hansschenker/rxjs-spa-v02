import { BehaviorSubject, map } from 'rxjs';
import { h } from '../jsx/jsx';
import type { ElementChild, PropValue } from '../jsx/jsx';

export interface PanelProps {
  /** Section heading — a plain string or a live Observable<string>. */
  title: PropValue<string>;
  /** Render collapsed initially. */
  collapsed?: boolean;
  /** The slot: anything a JSX child can be — elements, components, observables. */
  children?: ElementChild;
}

/**
 * Reusable container with a children slot — the template pattern for
 * framework-less RxJS components:
 *
 *  - runs exactly once and returns real DOM (a constructor, not a render fn);
 *  - `children` is a true slot: nested components, text, arrays and
 *    observables (live regions) all work, because it is just ElementChild;
 *  - local UI state is a private BehaviorSubject, bound declaratively to
 *    props (className/hidden) — no imperative DOM mutation;
 *  - props that change over time are streams; props that never change are
 *    plain values. `PropValue<T>` accepts both.
 */
export function Panel({ title, collapsed = false, children }: PanelProps): JSX.Element {
  const collapsed$ = new BehaviorSubject<boolean>(collapsed);

  return (
    <section className={collapsed$.pipe(map((c) => (c ? 'panel collapsed' : 'panel')))}>
      <button
        className="panel-header"
        title="Toggle section"
        onClick={() => collapsed$.next(!collapsed$.getValue())}
      >
        <span className="panel-title">{title}</span>
        <span className="panel-chevron">{collapsed$.pipe(map((c) => (c ? '▸' : '▾')))}</span>
      </button>
      <div className="panel-body" hidden={collapsed$}>
        {children}
      </div>
    </section>
  );
}
