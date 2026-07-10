/**
 * Intent → service wiring. Besides the JSX-bound regions, this is the only
 * place in the app that calls .subscribe(); invoked once from main.ts.
 * Every inner stream catches its own errors so these subscriptions live for
 * the page lifetime.
 */
import { catchError, exhaustMap, from, map, mergeMap, of, startWith } from 'rxjs';
import { deleteFeed, markPostRead } from '../db/store';
import { addFeed, refreshAllFeeds } from '../feeds/feed-service';
import {
  addFeedRequested$,
  addFeedStatus$,
  feedDeleteRequested$,
  fetchAllRequested$,
  postOpened$,
  type AddFeedStatus,
} from './intents';

export function registerEffects(): void {
  // exhaustMap: mashing Enter cannot stack concurrent add-feed requests.
  addFeedRequested$
    .pipe(
      exhaustMap((url) =>
        addFeed(url).pipe(
          map((): AddFeedStatus => 'idle'),
          catchError((err: unknown) => {
            console.warn(`Adding feed failed: ${url}`, err);
            return of<AddFeedStatus>('error');
          }),
          startWith<AddFeedStatus>('busy'),
        ),
      ),
    )
    .subscribe((status) => addFeedStatus$.next(status));

  fetchAllRequested$.pipe(exhaustMap(() => refreshAllFeeds())).subscribe((result) => {
    if (result.error) {
      console.warn(`Refreshing ${result.feedUrl} failed`, result.error);
    }
  });

  feedDeleteRequested$.pipe(mergeMap((url) => from(deleteFeed(url)))).subscribe();

  postOpened$.pipe(mergeMap((link) => from(markPostRead(link)))).subscribe();
}
