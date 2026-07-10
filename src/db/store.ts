/**
 * Fine-grained reactive store. Memory is canonical, IndexedDB is persistence:
 * the db is hydrated into in-memory maps once at startup; afterwards every
 * write updates idb and memory together and emits at the finest useful grain:
 *
 *  - `post$(link)` emits when that single post changes (per-post streams),
 *  - `posts$` / `feeds$` emit snapshots when membership may have changed —
 *    consumed by keyed reconciliation, so a snapshot emission costs only the
 *    DOM inserts/removes/moves it implies, never a rebuild.
 */
import {
  BehaviorSubject,
  defer,
  EMPTY,
  from,
  map,
  shareReplay,
  startWith,
  Subject,
  switchMap,
  type Observable,
} from 'rxjs';
import { dbReady, type FeedRecord, type NewPost, type PostRecord } from './db';

const feedsByUrl = new Map<string, FeedRecord>();
const postSubjects = new Map<string, BehaviorSubject<PostRecord>>();

const feedsMutated$ = new Subject<void>();
const postsMutated$ = new Subject<void>();

const hydrated: Promise<void> = dbReady.then(async (db) => {
  const [feeds, posts] = await Promise.all([db.getAll('feeds'), db.getAll('posts')]);
  for (const feed of feeds) feedsByUrl.set(feed.url, feed);
  for (const post of posts) postSubjects.set(post.link, new BehaviorSubject(post));
});

const sortedFeeds = (): FeedRecord[] =>
  [...feedsByUrl.values()].sort((a, b) => a.title.localeCompare(b.title));

const sortedPosts = (): PostRecord[] =>
  [...postSubjects.values()]
    .map((subject) => subject.value)
    .sort((a, b) => b.publishedDate.getTime() - a.publishedDate.getTime());

/** All feeds, sorted by title; re-emits after every feed write. */
export const feeds$: Observable<FeedRecord[]> = from(hydrated).pipe(
  switchMap(() => feedsMutated$.pipe(startWith(undefined))),
  map(sortedFeeds),
  shareReplay({ bufferSize: 1, refCount: false }),
);

/** All posts, newest first; re-emits when post membership or a read flag changes. */
export const posts$: Observable<PostRecord[]> = from(hydrated).pipe(
  switchMap(() => postsMutated$.pipe(startWith(undefined))),
  map(sortedPosts),
  shareReplay({ bufferSize: 1, refCount: false }),
);

/**
 * Fine-grained: one post's state over time, keyed by link. Emits the current
 * value on subscribe and completes when the post is deleted. Safe to call for
 * unknown links (empty stream).
 */
export function post$(link: string): Observable<PostRecord> {
  return defer(() => postSubjects.get(link) ?? EMPTY);
}

/** Posts not yet in the store, stamped with read/feedUrl. Memory is canonical. */
function onlyNewPosts(feedUrl: string, items: NewPost[]): PostRecord[] {
  const fresh: PostRecord[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (!item.link || postSubjects.has(item.link) || seen.has(item.link)) continue;
    seen.add(item.link);
    fresh.push({ ...item, read: false, feedUrl });
  }
  return fresh;
}

/**
 * One readwrite transaction: upsert the feed, insert only posts whose link is
 * not already stored (read flags of existing posts are never touched).
 * Returns the number of posts added.
 */
export async function addFeedWithPosts(feed: FeedRecord, items: NewPost[]): Promise<number> {
  await hydrated;
  const db = await dbReady;
  const fresh = onlyNewPosts(feed.url, items);
  const tx = db.transaction(['feeds', 'posts'], 'readwrite');
  await tx.objectStore('feeds').put(feed);
  for (const post of fresh) {
    await tx.objectStore('posts').add(post);
  }
  await tx.done;
  feedsByUrl.set(feed.url, feed);
  for (const post of fresh) {
    postSubjects.set(post.link, new BehaviorSubject(post));
  }
  feedsMutated$.next();
  postsMutated$.next();
  return fresh.length;
}

/** Insert only not-yet-stored posts for an existing feed. Returns added count. */
export async function insertNewPosts(feedUrl: string, items: NewPost[]): Promise<number> {
  await hydrated;
  const fresh = onlyNewPosts(feedUrl, items);
  if (fresh.length === 0) return 0;
  const db = await dbReady;
  const tx = db.transaction('posts', 'readwrite');
  for (const post of fresh) {
    await tx.store.add(post);
  }
  await tx.done;
  for (const post of fresh) {
    postSubjects.set(post.link, new BehaviorSubject(post));
  }
  postsMutated$.next();
  return fresh.length;
}

export async function markPostRead(link: string): Promise<void> {
  await hydrated;
  const subject = postSubjects.get(link);
  if (!subject || subject.value.read) return;
  const updated: PostRecord = { ...subject.value, read: true };
  const db = await dbReady;
  await db.put('posts', updated);
  subject.next(updated); // fine-grained: only this post's subscribers
  postsMutated$.next(); // filtered views may gain/lose this post
}

export async function getPost(link: string): Promise<PostRecord | undefined> {
  await hydrated;
  return postSubjects.get(link)?.value;
}

/** Cascading delete in one transaction: the feed and all of its posts. */
export async function deleteFeed(url: string): Promise<void> {
  await hydrated;
  const db = await dbReady;
  const tx = db.transaction(['feeds', 'posts'], 'readwrite');
  const posts = tx.objectStore('posts');
  const keys = await posts.index('by-feedUrl').getAllKeys(url);
  for (const key of keys) {
    await posts.delete(key);
  }
  await tx.objectStore('feeds').delete(url);
  await tx.done;
  feedsByUrl.delete(url);
  for (const key of keys) {
    postSubjects.get(key)?.complete();
    postSubjects.delete(key);
  }
  feedsMutated$.next();
  postsMutated$.next();
}

export async function listFeeds(): Promise<FeedRecord[]> {
  await hydrated;
  return sortedFeeds();
}

export async function countFeeds(): Promise<number> {
  await hydrated;
  return feedsByUrl.size;
}
