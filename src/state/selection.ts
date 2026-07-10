/** Derived UI state — shareReplay(1) singletons consumed by the components. */
import {
  from,
  map,
  merge,
  shareReplay,
  startWith,
  switchMap,
  type Observable,
} from 'rxjs';
import type { PostRecord } from '../db/db';
import { getPost } from '../db/store';
import { feedSelected$, filterSelected$, postOpened$, readerClosed$ } from './intents';
import type { ReadFilter } from './filter-posts';

/** Original yarr's default: the Unread tab starts active. */
export const readFilter$: Observable<ReadFilter> = filterSelected$.pipe(
  startWith('unread' as ReadFilter),
  shareReplay(1),
);

export const selectedFeedUrl$: Observable<string | null> = feedSelected$.pipe(
  startWith(null),
  shareReplay(1),
);

export const openPost$: Observable<PostRecord | null> = merge(
  postOpened$.pipe(
    switchMap((link) => from(getPost(link))),
    map((post) => post ?? null),
  ),
  readerClosed$.pipe(map(() => null)),
).pipe(startWith(null), shareReplay(1));
