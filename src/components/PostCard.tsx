import { h } from '../jsx/jsx';
import type { PostRecord } from '../db/db';
import { formatDate } from '../state/format-date';
import { postOpened$ } from '../state/intents';

export interface PostCardProps {
  post: PostRecord;
}

export function PostCard({ post }: PostCardProps): JSX.Element {
  const meta = [post.author, formatDate(post.publishedDate), post.categories.join(', ')]
    .filter((part) => part.length > 0)
    .join(' · ');

  return (
    <article className={post.read ? 'post read' : 'post'}>
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
