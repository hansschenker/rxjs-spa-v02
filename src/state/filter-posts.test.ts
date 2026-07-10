import { describe, expect, it } from 'vitest';
import type { PostRecord } from '../db/db';
import { applyPostFilters } from './filter-posts';

const post = (link: string, read: boolean, feedUrl: string): PostRecord => ({
  link,
  title: link,
  author: '',
  publishedDate: new Date('2026-01-01'),
  categories: [],
  read,
  feedUrl,
  contentSnippet: '',
  content: '',
});

const posts: PostRecord[] = [
  post('a1', false, 'feed-a'),
  post('a2', true, 'feed-a'),
  post('b1', false, 'feed-b'),
  post('b2', true, 'feed-b'),
];

const links = (result: PostRecord[]): string[] => result.map((p) => p.link);

describe('applyPostFilters', () => {
  it('returns everything for all + no feed', () => {
    expect(links(applyPostFilters(posts, 'all', null))).toEqual(['a1', 'a2', 'b1', 'b2']);
  });

  it('filters unread across all feeds', () => {
    expect(links(applyPostFilters(posts, 'unread', null))).toEqual(['a1', 'b1']);
  });

  it('filters read across all feeds', () => {
    expect(links(applyPostFilters(posts, 'read', null))).toEqual(['a2', 'b2']);
  });

  it('filters by feed only', () => {
    expect(links(applyPostFilters(posts, 'all', 'feed-a'))).toEqual(['a1', 'a2']);
  });

  it('combines read state and feed', () => {
    expect(links(applyPostFilters(posts, 'unread', 'feed-b'))).toEqual(['b1']);
    expect(links(applyPostFilters(posts, 'read', 'feed-b'))).toEqual(['b2']);
  });

  it('handles empty input', () => {
    expect(applyPostFilters([], 'all', null)).toEqual([]);
    expect(applyPostFilters([], 'unread', 'feed-a')).toEqual([]);
  });
});
