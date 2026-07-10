import { catchError, EMPTY, filter, from, mergeMap, type Observable } from 'rxjs';
import { addFeed } from '../feeds/feed-service';
import { countFeeds } from './store';

const SEED_CONCURRENCY = 2;

const DEFAULT_FEEDS: readonly string[] = [
  'https://hacks.mozilla.org/feed/', // RSS 2.0 — kept from the original yarr
  'https://overreacted.io/rss.xml', // RSS 2.0
  'https://blog.rust-lang.org/feed.xml', // Atom — exercises the Atom parser path
];

/** First-run seeding. A dead feed logs a warning and never blocks the others. */
export function seedIfEmpty(): Observable<unknown> {
  return from(countFeeds()).pipe(
    filter((count) => count === 0),
    mergeMap(() => from(DEFAULT_FEEDS)),
    mergeMap(
      (url) =>
        addFeed(url).pipe(
          catchError((err: unknown) => {
            console.warn(`Seeding feed failed: ${url}`, err);
            return EMPTY;
          }),
        ),
      SEED_CONCURRENCY,
    ),
  );
}
