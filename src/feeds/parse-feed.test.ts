import { describe, expect, it } from 'vitest';
import { FeedParseError, parseFeed } from './parse-feed';

const RSS_FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:dc="http://purl.org/dc/elements/1.1/"
     xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Mozilla Hacks</title>
    <atom:link href="https://hacks.mozilla.org/feed/" rel="self" type="application/rss+xml" />
    <link>https://hacks.mozilla.org</link>
    <description>Hacks on the web</description>
    <item>
      <title>ES6 In Depth</title>
      <link>https://hacks.mozilla.org/es6-in-depth/</link>
      <pubDate>Tue, 07 Jul 2026 10:00:00 +0000</pubDate>
      <dc:creator>Jason Orendorff</dc:creator>
      <category>JavaScript</category>
      <category>ES6</category>
      <description>Short teaser</description>
      <content:encoded><![CDATA[<p>Full <strong>article</strong> body</p>]]></content:encoded>
    </item>
    <item>
      <title>Bare Minimum</title>
      <link>https://hacks.mozilla.org/bare/</link>
      <description><![CDATA[<em>Only a description</em>]]></description>
    </item>
  </channel>
</rss>`;

const ATOM_FIXTURE = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Rust Blog</title>
  <subtitle>Empowering everyone</subtitle>
  <link href="https://blog.rust-lang.org/feed.xml" rel="self"/>
  <link href="https://blog.rust-lang.org/" rel="alternate"/>
  <entry>
    <title>Announcing Rust</title>
    <link href="https://blog.rust-lang.org/announcing/" rel="alternate"/>
    <published>2026-06-30T12:00:00Z</published>
    <updated>2026-07-01T12:00:00Z</updated>
    <author><name>The Rust Team</name></author>
    <category term="release"/>
    <content type="html">&lt;p&gt;Rust content&lt;/p&gt;</content>
  </entry>
  <entry>
    <title>Updated Only</title>
    <link href="https://blog.rust-lang.org/updated-only/"/>
    <updated>2026-07-02T08:00:00Z</updated>
    <summary>Just a summary</summary>
  </entry>
</feed>`;

describe('parseFeed — RSS 2.0', () => {
  const feed = parseFeed(RSS_FIXTURE);

  it('parses channel metadata, skipping the self-referencing atom:link', () => {
    expect(feed.title).toBe('Mozilla Hacks');
    expect(feed.siteUrl).toBe('https://hacks.mozilla.org');
    expect(feed.description).toBe('Hacks on the web');
  });

  it('parses items with content:encoded, dc:creator and categories', () => {
    const item = feed.items[0];
    expect(item).toBeDefined();
    expect(item?.title).toBe('ES6 In Depth');
    expect(item?.link).toBe('https://hacks.mozilla.org/es6-in-depth/');
    expect(item?.author).toBe('Jason Orendorff');
    expect(item?.categories).toEqual(['JavaScript', 'ES6']);
    expect(item?.content).toBe('<p>Full <strong>article</strong> body</p>');
    expect(item?.publishedDate.getUTCFullYear()).toBe(2026);
  });

  it('falls back to description content and epoch date on missing fields', () => {
    const item = feed.items[1];
    expect(item?.content).toBe('<em>Only a description</em>');
    expect(item?.author).toBe('');
    expect(item?.categories).toEqual([]);
    expect(item?.publishedDate.getTime()).toBe(0);
  });

  it('produces a plain-text snippet with tags stripped', () => {
    expect(feed.items[0]?.contentSnippet).toBe('Full article body');
    expect(feed.items[1]?.contentSnippet).toBe('Only a description');
  });

  it('truncates snippets to 200 characters', () => {
    const longBody = `<p>${'word '.repeat(100)}</p>`;
    const xml = RSS_FIXTURE.replace(
      '<![CDATA[<p>Full <strong>article</strong> body</p>]]>',
      `<![CDATA[${longBody}]]>`,
    );
    const snippet = parseFeed(xml).items[0]?.contentSnippet ?? '';
    expect(snippet.length).toBe(200);
  });
});

describe('parseFeed — Atom', () => {
  const feed = parseFeed(ATOM_FIXTURE);

  it('parses feed metadata using the alternate link', () => {
    expect(feed.title).toBe('Rust Blog');
    expect(feed.siteUrl).toBe('https://blog.rust-lang.org/');
    expect(feed.description).toBe('Empowering everyone');
  });

  it('parses entries with author name, category terms and html content', () => {
    const entry = feed.items[0];
    expect(entry?.title).toBe('Announcing Rust');
    expect(entry?.link).toBe('https://blog.rust-lang.org/announcing/');
    expect(entry?.author).toBe('The Rust Team');
    expect(entry?.categories).toEqual(['release']);
    expect(entry?.content).toBe('<p>Rust content</p>');
    expect(entry?.publishedDate.toISOString()).toBe('2026-06-30T12:00:00.000Z');
  });

  it('falls back to updated date and summary content', () => {
    const entry = feed.items[1];
    expect(entry?.link).toBe('https://blog.rust-lang.org/updated-only/');
    expect(entry?.content).toBe('Just a summary');
    expect(entry?.publishedDate.toISOString()).toBe('2026-07-02T08:00:00.000Z');
  });
});

describe('parseFeed — errors', () => {
  it('throws FeedParseError on malformed XML', () => {
    expect(() => parseFeed('<rss><channel></rss>')).toThrow(FeedParseError);
  });

  it('throws FeedParseError on unknown root elements', () => {
    expect(() => parseFeed('<html><body>nope</body></html>')).toThrow(FeedParseError);
  });
});
