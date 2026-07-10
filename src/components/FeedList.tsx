import { combineLatest, map } from 'rxjs';
import { h } from '../jsx/jsx';
import type { FeedRecord } from '../db/db';
import { feeds$ } from '../db/store';
import { feedDeleteRequested$, feedSelected$ } from '../state/intents';
import { selectedFeedUrl$ } from '../state/selection';

function feedRow(feed: FeedRecord, selected: string | null): JSX.Element {
  return (
    <li className="feed-item">
      <button
        className={selected === feed.url ? 'feed-select active' : 'feed-select'}
        title={feed.description || feed.title}
        onClick={() => feedSelected$.next(feed.url)}
      >
        {feed.title}
      </button>
      <button
        className="feed-delete"
        title={`Delete ${feed.title}`}
        onClick={() => feedDeleteRequested$.next(feed.url)}
      >
        ×
      </button>
    </li>
  );
}

export function FeedList(): JSX.Element {
  return (
    <nav className="feed-list">
      {combineLatest([feeds$, selectedFeedUrl$]).pipe(
        map(([feeds, selected]) => (
          <ul className="feed-items">
            <li className="feed-item">
              <button
                className={selected === null ? 'feed-select active' : 'feed-select'}
                onClick={() => feedSelected$.next(null)}
              >
                All feeds
              </button>
            </li>
            {feeds.map((feed) => feedRow(feed, selected))}
          </ul>
        )),
      )}
    </nav>
  );
}
