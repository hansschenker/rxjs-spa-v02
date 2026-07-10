import DOMPurify from 'dompurify';
import { map } from 'rxjs';
import { h } from '../jsx/jsx';
import type { PostRecord } from '../db/db';
import { formatDate } from '../state/format-date';
import { readerClosed$ } from '../state/intents';
import { openPost$ } from '../state/selection';

/**
 * Feed HTML is untrusted third-party content. DOMPurify strips scripts, event
 * handler attributes and javascript: URLs; the link pass keeps feed content
 * from navigating the SPA. (The original yarr eval'd parser output here.)
 */
function sanitizedBody(content: string): HTMLDivElement {
  const body = (<div className="post-body" />) as HTMLDivElement;
  body.innerHTML = DOMPurify.sanitize(content, { USE_PROFILES: { html: true } });
  body.querySelectorAll('a').forEach((a) => {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  });
  return body;
}

function readerView(post: PostRecord | null): JSX.Element {
  if (!post) {
    return <p className="reader-empty">Select a post to read</p>;
  }

  const meta = [formatDate(post.publishedDate), post.categories.join(', ')]
    .filter((part) => part.length > 0)
    .join(' · ');

  return (
    <article className="reader-post">
      <button className="reader-close" title="Close" onClick={() => readerClosed$.next()}>
        ‹ Close
      </button>
      <header className="reader-header">
        <p className="reader-meta">{meta}</p>
        <h1 className="reader-title">
          <a href={post.link} target="_blank" rel="noopener noreferrer">
            {post.title}
          </a>
        </h1>
      </header>
      {sanitizedBody(post.content)}
    </article>
  );
}

export function Reader(): JSX.Element {
  return <aside className="reader-pane">{openPost$.pipe(map(readerView))}</aside>;
}
