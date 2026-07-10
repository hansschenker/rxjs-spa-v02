import { map } from 'rxjs';
import { h } from '../jsx/jsx';
import { filterSelected$ } from '../state/intents';
import { readFilter$ } from '../state/selection';
import type { ReadFilter } from '../state/filter-posts';

const TABS: readonly ReadFilter[] = ['all', 'unread', 'read'];
const LABELS: Record<ReadFilter, string> = { all: 'All', unread: 'Unread', read: 'Read' };

export function FilterTabs(): JSX.Element {
  return (
    <ul className="filter-tabs">
      {TABS.map((tab) => (
        <li className="filter-tab-item">
          <button
            className={readFilter$.pipe(map((f) => (f === tab ? 'tab active' : 'tab')))}
            onClick={() => filterSelected$.next(tab)}
          >
            {LABELS[tab]}
          </button>
        </li>
      ))}
    </ul>
  );
}
