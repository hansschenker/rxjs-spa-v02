import { map } from 'rxjs';
import { h } from '../jsx/jsx';
import type { PostRecord } from '../db/db';
import { post$ } from '../db/store';
import { formatDate } from '../state/format-date';
import { postOpened$ } from '../state/intents';

export interface PostCardProps {
  post: PostRecord;
}

/**
 * Created once per post (keyed by link in PostsList). Everything except the
 * read flag is immutable, so only className is stream-bound — marking the
 * post read reassigns one property on this same element, nothing re-renders.
 */
export function PostCard({ post }: PostCardProps): JSX.Element {
  const meta = [post.author, formatDate(post.publishedDate), post.categories.join(', ')]
    .filter((part) => part.length > 0)
    .join(' · ');

  return (
    <article className={post$(post.link).pipe(map((p) => (p.read ? 'post read' : 'post')))}>
      <h2 className="post-heading">
        <button className="post-title" onClick={() => postOpened$.next(post.link)}>
          {post.title}
        </button>
      </h2>
      <p className="post-snippet">{post.contentSnippet}</p>
      <footer className="post-meta">{meta}</footer>
    </article>
  );
}
