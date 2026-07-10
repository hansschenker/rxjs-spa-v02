import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface FeedRecord {
  url: string; // primary key — the URL the feed was added with
  title: string;
  siteUrl: string;
  description: string;
}

export interface PostRecord {
  link: string; // primary key
  title: string;
  author: string;
  publishedDate: Date;
  categories: string[];
  read: boolean; // real boolean — filtering is in-memory, never indexed
  feedUrl: string;
  contentSnippet: string; // plain text, ~200 chars
  content: string; // raw feed HTML — sanitized at render time, not at store time
}

/** A post as produced by the feed parser: everything except the fields the store stamps. */
export type NewPost = Omit<PostRecord, 'read' | 'feedUrl'>;

interface YarrDbSchema extends DBSchema {
  feeds: { key: string; value: FeedRecord };
  posts: { key: string; value: PostRecord; indexes: { 'by-feedUrl': string } };
}

export type YarrDb = IDBPDatabase<YarrDbSchema>;

export const dbReady: Promise<YarrDb> = openDB<YarrDbSchema>('yarr', 1, {
  upgrade(db) {
    db.createObjectStore('feeds', { keyPath: 'url' });
    const posts = db.createObjectStore('posts', { keyPath: 'link' });
    posts.createIndex('by-feedUrl', 'feedUrl');
  },
});
