/**
 * The reactive backbone of the app — the modern retelling of the original
 * yarr's "make the database reactive" chapter, without Dexie hooks/liveQuery:
 * every write persists via idb inside one transaction, then pings the
 * affected change Subject, and the collection streams re-query the whole
 * table (exactly the original's whole-collection model, made explicit).
 */
import {
  from,
  map,
  shareReplay,
  startWith,
  Subject,
  switchMap,
  type Observable,
} from 'rxjs';
import { dbReady, type FeedRecord, type NewPost, type PostRecord } from './db';

const feedsChanged$ = new Subject<void>();
const postsChanged$ = new Subject<void>();

/** All feeds, sorted by title; re-emits after every feed write. */
export const feeds$: Observable<FeedRecord[]> = feedsChanged$.pipe(
  startWith(undefined),
  switchMap(() => from(dbReady.then((db) => db.getAll('feeds')))),
  map((feeds) => [...feeds].sort((a, b) => a.title.localeCompare(b.title))),
  shareReplay({ bufferSize: 1, refCount: false }),
);

/** All posts, newest first; re-emits after every post write. */
export const posts$: Observable<PostRecord[]> = postsChanged$.pipe(
  startWith(undefined),
  switchMap(() => from(dbReady.then((db) => db.getAll('posts')))),
  map((posts) =>
    [...posts].sort((a, b) => b.publishedDate.getTime() - a.publishedDate.getTime()),
  ),
  shareReplay({ bufferSize: 1, refCount: false }),
);

/**
 * One readwrite transaction: upsert the feed, insert only posts whose link is
 * not already stored (read flags of existing posts are never touched).
 * Returns the number of posts added.
 */
export async function addFeedWithPosts(feed: FeedRecord, items: NewPost[]): Promise<number> {
  const db = await dbReady;
  const tx = db.transaction(['feeds', 'posts'], 'readwrite');
  await tx.objectStore('feeds').put(feed);
  const added = await addMissingPosts(tx.objectStore('posts'), feed.url, items);
  await tx.done;
  feedsChanged$.next();
  postsChanged$.next();
  return added;
}

/** Insert only not-yet-stored posts for an existing feed. Returns added count. */
export async function insertNewPosts(feedUrl: string, items: NewPost[]): Promise<number> {
  const db = await dbReady;
  const tx = db.transaction('posts', 'readwrite');
  const added = await addMissingPosts(tx.objectStore('posts'), feedUrl, items);
  await tx.done;
  if (added > 0) postsChanged$.next();
  return added;
}

type PostsWriteStore = {
  getAllKeys(): Promise<string[]>;
  add(value: PostRecord): Promise<string>;
};

async function addMissingPosts(
  posts: PostsWriteStore,
  feedUrl: string,
  items: NewPost[],
): Promise<number> {
  const existing = new Set(await posts.getAllKeys());
  let added = 0;
  for (const item of items) {
    if (!item.link || existing.has(item.link)) continue;
    existing.add(item.link);
    await posts.add({ ...item, read: false, feedUrl });
    added += 1;
  }
  return added;
}

export async function markPostRead(link: string): Promise<void> {
  const db = await dbReady;
  const post = await db.get('posts', link);
  if (!post || post.read) return;
  await db.put('posts', { ...post, read: true });
  postsChanged$.next();
}

export async function getPost(link: string): Promise<PostRecord | undefined> {
  const db = await dbReady;
  return db.get('posts', link);
}

/** Cascading delete in one transaction: the feed and all of its posts. */
export async function deleteFeed(url: string): Promise<void> {
  const db = await dbReady;
  const tx = db.transaction(['feeds', 'posts'], 'readwrite');
  const posts = tx.objectStore('posts');
  const keys = await posts.index('by-feedUrl').getAllKeys(url);
  for (const key of keys) {
    await posts.delete(key);
  }
  await tx.objectStore('feeds').delete(url);
  await tx.done;
  feedsChanged$.next();
  postsChanged$.next();
}

export async function listFeeds(): Promise<FeedRecord[]> {
  const db = await dbReady;
  return db.getAll('feeds');
}

export async function countFeeds(): Promise<number> {
  const db = await dbReady;
  return db.count('feeds');
}
