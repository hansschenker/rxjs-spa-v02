import { BehaviorSubject, map } from 'rxjs';
import { h } from '../jsx/jsx';
import { addFeedRequested$, addFeedStatus$, fetchAllRequested$ } from '../state/intents';

export function AddFeedWidget(): JSX.Element {
  const inputVisible$ = new BehaviorSubject<boolean>(false);

  return (
    <div className="sidebar-controls">
      <button className="control" onClick={() => fetchAllRequested$.next()}>
        Refresh all feeds
      </button>
      <button className="control" onClick={() => inputVisible$.next(!inputVisible$.getValue())}>
        Add new feed
      </button>
      <input
        type="url"
        placeholder="https://example.com/feed.xml"
        className={addFeedStatus$.pipe(
          map((status) => `new-feed-input ${status === 'idle' ? '' : status}`.trim()),
        )}
        style={inputVisible$.pipe(map((visible) => ({ display: visible ? 'block' : 'none' })))}
        onKeyUp={(ev) => {
          const input = ev.target as HTMLInputElement;
          const url = input.value.trim();
          if (ev.key === 'Enter' && url) {
            addFeedRequested$.next(url);
            input.value = '';
          }
        }}
      />
    </div>
  );
}
