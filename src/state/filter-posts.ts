import type { PostRecord } from '../db/db';

export type ReadFilter = 'all' | 'read' | 'unread';

export function applyPostFilters(
  posts: PostRecord[],
  filter: ReadFilter,
  feedUrl: string | null,
): PostRecord[] {
  return posts.filter((post) => {
    const matchesRead = filter === 'all' || (filter === 'read' ? post.read : !post.read);
    const matchesFeed = feedUrl === null || post.feedUrl === feedUrl;
    return matchesRead && matchesFeed;
  });
}
