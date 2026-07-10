import { catchError, from, map, mergeMap, of, switchMap, type Observable } from 'rxjs';
import { type FeedRecord } from '../db/db';
import { addFeedWithPosts, insertNewPosts, listFeeds } from '../db/store';
import { fetchFeedXml } from './fetch-feed';
import { parseFeed } from './parse-feed';

const REFRESH_CONCURRENCY = 4;

/** Fetch, parse and persist a feed with its posts. Errors propagate to the caller. */
export function addFeed(url: string): Observable<FeedRecord> {
  return fetchFeedXml(url).pipe(
    map(parseFeed),
    switchMap((parsed) => {
      const feed: FeedRecord = {
        url,
        title: parsed.title || url,
        siteUrl: parsed.siteUrl,
        description: parsed.description,
      };
      return from(addFeedWithPosts(feed, parsed.items)).pipe(map(() => feed));
    }),
  );
}

export interface RefreshResult {
  feedUrl: string;
  added: number;
  error?: Error;
}

/**
 * Re-fetch every stored feed and insert only new posts. Per-feed catchError:
 * one dead feed yields an error result and never kills the stream.
 */
export function refreshAllFeeds(): Observable<RefreshResult> {
  return from(listFeeds()).pipe(
    mergeMap((feeds) => from(feeds)),
    mergeMap(
      (feed) =>
        fetchFeedXml(feed.url).pipe(
          map(parseFeed),
          switchMap((parsed) => from(insertNewPosts(feed.url, parsed.items))),
          map((added) => ({ feedUrl: feed.url, added })),
          catchError((err: unknown) =>
            of({
              feedUrl: feed.url,
              added: 0,
              error: err instanceof Error ? err : new Error(String(err)),
            }),
          ),
        ),
      REFRESH_CONCURRENCY,
    ),
  );
}
