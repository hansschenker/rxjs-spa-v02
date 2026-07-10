/**
 * The app's entire user-event vocabulary. Components are dumb views that push
 * into these Subjects via per-element props — the modern replacement for the
 * original yarr's body-delegated, CSS-class-filtered event streams (which only
 * existed because virtual-dom kept replacing nodes).
 */
import { BehaviorSubject, Subject } from 'rxjs';
import type { ReadFilter } from './filter-posts';

export const filterSelected$ = new Subject<ReadFilter>();
export const feedSelected$ = new Subject<string | null>(); // feed url, null = all feeds
export const postOpened$ = new Subject<string>(); // post link (primary key)
export const readerClosed$ = new Subject<void>();
export const addFeedRequested$ = new Subject<string>(); // url typed into the input
export const fetchAllRequested$ = new Subject<void>();
export const feedDeleteRequested$ = new Subject<string>(); // feed url

export type AddFeedStatus = 'idle' | 'busy' | 'error';
export const addFeedStatus$ = new BehaviorSubject<AddFeedStatus>('idle');
