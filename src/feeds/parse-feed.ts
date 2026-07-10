/** Pure RSS 2.0 / Atom parser over the browser's DOMParser. No side effects. */

export interface ParsedItem {
  link: string;
  title: string;
  author: string;
  publishedDate: Date;
  categories: string[];
  content: string;
  contentSnippet: string;
}

export interface ParsedFeed {
  title: string;
  siteUrl: string;
  description: string;
  items: ParsedItem[];
}

export class FeedParseError extends Error {}

const SNIPPET_LENGTH = 200;

export function parseFeed(xml: string): ParsedFeed {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new FeedParseError('Document is not valid XML');
  }
  const root = doc.documentElement;
  if (root.localName === 'rss') return parseRss(root);
  if (root.localName === 'feed') return parseAtom(root);
  throw new FeedParseError(`Unsupported feed root element <${root.localName}>`);
}

/**
 * Text of the first direct child matching `localName` that has non-empty text.
 * Matching by localName makes namespaced children (dc:creator → 'creator',
 * content:encoded → 'encoded') work without namespace bookkeeping, and
 * "first non-empty" skips e.g. a self-referencing <atom:link> before <link>.
 */
function childText(parent: Element, localName: string): string {
  for (const child of Array.from(parent.children)) {
    if (child.localName !== localName) continue;
    const text = child.textContent?.trim();
    if (text) return text;
  }
  return '';
}

function childElements(parent: Element, localName: string): Element[] {
  return Array.from(parent.children).filter((child) => child.localName === localName);
}

function parseDate(value: string): Date {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

function makeSnippet(html: string): string {
  // Parsing into a detached document executes nothing — safe for untrusted HTML.
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const text = doc.body.textContent ?? '';
  return text.replace(/\s+/g, ' ').trim().slice(0, SNIPPET_LENGTH);
}

function parseRss(root: Element): ParsedFeed {
  const channel = root.getElementsByTagName('channel')[0];
  if (!channel) throw new FeedParseError('RSS feed is missing <channel>');

  const items = Array.from(channel.getElementsByTagName('item')).map((item): ParsedItem => {
    const content = childText(item, 'encoded') || childText(item, 'description');
    return {
      link: childText(item, 'link'),
      title: childText(item, 'title'),
      author: childText(item, 'author') || childText(item, 'creator'),
      publishedDate: parseDate(childText(item, 'pubDate')),
      categories: childElements(item, 'category')
        .map((c) => c.textContent?.trim() ?? '')
        .filter((c) => c.length > 0),
      content,
      contentSnippet: makeSnippet(content),
    };
  });

  return {
    title: childText(channel, 'title'),
    siteUrl: childText(channel, 'link'),
    description: childText(channel, 'description'),
    items,
  };
}

function atomLinkHref(parent: Element): string {
  const links = childElements(parent, 'link');
  const alternate =
    links.find((l) => l.getAttribute('rel') === 'alternate') ??
    links.find((l) => !l.getAttribute('rel')) ??
    links[0];
  return alternate?.getAttribute('href') ?? '';
}

function parseAtom(root: Element): ParsedFeed {
  const items = childElements(root, 'entry').map((entry): ParsedItem => {
    const content = childText(entry, 'content') || childText(entry, 'summary');
    const authorEl = childElements(entry, 'author')[0];
    return {
      link: atomLinkHref(entry),
      title: childText(entry, 'title'),
      author: authorEl ? childText(authorEl, 'name') : '',
      publishedDate: parseDate(childText(entry, 'published') || childText(entry, 'updated')),
      categories: childElements(entry, 'category')
        .map((c) => c.getAttribute('term') ?? '')
        .filter((c) => c.length > 0),
      content,
      contentSnippet: makeSnippet(content),
    };
  });

  return {
    title: childText(root, 'title'),
    siteUrl: atomLinkHref(root),
    description: childText(root, 'subtitle'),
    items,
  };
}
