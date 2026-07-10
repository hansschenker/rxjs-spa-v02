import { combineLatest, map } from 'rxjs';
import { h } from '../jsx/jsx';
import { posts$ } from '../db/store';
import { applyPostFilters } from '../state/filter-posts';
import { readFilter$, selectedFeedUrl$ } from '../state/selection';
import { PostCard } from './PostCard';

export function PostsList(): JSX.Element {
  return (
    <section className="posts-pane">
      {combineLatest([posts$, readFilter$, selectedFeedUrl$]).pipe(
        map(([posts, filter, feedUrl]) => {
          const visible = applyPostFilters(posts, filter, feedUrl);
          if (visible.length === 0) {
            return <p className="posts-empty">No posts here yet.</p>;
          }
          return visible.map((post) => <PostCard post={post} />);
        }),
      )}
    </section>
  );
}
