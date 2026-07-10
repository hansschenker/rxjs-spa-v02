import { combineLatest, map, shareReplay } from 'rxjs';
import { bindKeyedList, h } from '../jsx/jsx';
import type { PostRecord } from '../db/db';
import { posts$ } from '../db/store';
import { applyPostFilters } from '../state/filter-posts';
import { readFilter$, selectedFeedUrl$ } from '../state/selection';
import { PostCard } from './PostCard';

export function PostsList(): JSX.Element {
  const visiblePosts$ = combineLatest([posts$, readFilter$, selectedFeedUrl$]).pipe(
    map(([posts, filter, feedUrl]) => applyPostFilters(posts, filter, feedUrl)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  const pane = (
    <section className="posts-pane">
      <p className="posts-empty" hidden={visiblePosts$.pipe(map((visible) => visible.length > 0))}>
        No posts here yet.
      </p>
    </section>
  ) as HTMLElement;

  // Keyed by primary key: cards are created once and keep DOM identity across
  // emissions; membership changes cost only the implied inserts/removes/moves.
  bindKeyedList(pane, visiblePosts$, {
    key: (post: PostRecord) => post.link,
    create: (post: PostRecord) => PostCard({ post }) as HTMLElement,
  });

  return pane;
}
