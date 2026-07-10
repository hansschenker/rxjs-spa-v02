# Yarr — Architecture Overview

Yarr ("Yet Another RSS Reader") is a 2015 tutorial app (10 chapters, git tags `0-setup` … `10-reader-view`) that builds a single-page, offline-first RSS reader **without any framework**. The readme states the goal plainly: *"The whole app is a long chain of operations on Observables."*

## What the app does

- **Subscribes to RSS feeds.** Three default feeds are seeded into the database on first run (`src/models/feeds.js`). New feeds are added by clicking *Add New Feed* in the sidebar (which toggles a URL input) and pressing Enter.
- **Fetches posts** via the Google Feed API's JSONP endpoint with jQuery (`fetchFeed`). *Fetch All Feeds* re-fetches every subscribed feed and inserts only posts not already stored. (The Google Feed API was shut down in 2016, so live fetching no longer works.)
- **Stores everything in IndexedDB** via Dexie (`feeds` and `posts` tables, `src/db.js`) — the app is offline-first: the UI renders from the local database, never directly from the network.
- **Lists posts** newest-first, filterable two ways at once: by read state (*All / Unread / Read* widget) and by feed (clicking a feed in the sidebar).
- **Reader pane:** clicking a post title marks it read and renders the post's HTML content in a reader panel (the HTML string is parsed to virtual-dom hyperscript with `html2hscript`). A close button hides it.
- **Cascading delete:** a standing subscription in `src/db.js` deletes a feed's posts whenever the feed is deleted. There is no delete button — feeds are deleted from the devtools console via the exposed `window.Feeds` handle, and the UI reacts automatically.

## Tech stack (2015-era)

| Concern | Library |
|---|---|
| Reactive streams | `rx` v2.5 (pre-RxJS-5 API: instance operators, no `pipe()`) |
| View | `virtual-dom` v2 + JSX compiled to `h()` calls (not React) |
| Persistence | Dexie v1 over IndexedDB |
| Network | jQuery JSONP |
| Build | webpack 1, Babel 5, node-sass |

## Architecture style

Three overlapping ways to name what yarr is:

### 1. Functional Reactive Programming (FRP-flavored dataflow)

Every dynamic thing in the app is an Rx Observable: DOM events, database change notifications, network responses, and the UI itself. Components are not classes with lifecycle and state — each is a function returning `Observable<VTree>` (a stream of virtual-dom trees). Composition is stream composition: a parent view is `Observable.combineLatest(child1_, child2_, ..., viewFn)`. The naming convention `foo_` (trailing underscore) marks Observables.

### 2. Unidirectional data flow with the database as the single source of truth

This is the app's most distinctive trait, borrowed from Meteor's reactive client database. User actions never modify the UI directly — they **write to IndexedDB**, and the UI reacts:

```
DOM events (two delegated streams: click / keyup on document.body)
     │  filtered by CSS class (clicksByClass_('post-title'), …)
     ▼
intent streams — "add feed", "select feed", "read post", "fetch all"
     │  side effect: write to Dexie (IndexedDB)
     ▼
reactive tables — Dexie creating/updating/deleting hooks wrapped
     │  into Observables (reactiveDexieTable_, src/db.js)
     ▼
model streams — feeds_, posts_ re-emit the WHOLE collection on
     │  every DB change (merge hooks → startWith('') → flatMap(re-query))
     ▼
component view streams — combineLatest(data, filters) → pure JSX view fns
     ▼
renderer (src/renderer.js) — 1st emission: createElement; after: diff + patch
     ▼
real DOM (#app)
```

Network fetching sits *outside* this loop: fetch → write to DB, done. Rendering is purely a consequence of DB state. This is why chapter 8 is called "Making Dexie.js reactive" — it hand-rolls what Dexie later shipped as `liveQuery()`.

### 3. Model–View–Intent (Cycle.js-style)

Squint and it's MVI: **intents** are the delegated, class-filtered event streams (`src/events.js`); the **model** is the reactive Dexie queries plus filter streams; **views** are pure functions from data to virtual-dom trees; the ~30-line renderer is the sink. UI = f(state-streams), with virtual-dom diffing making whole-tree re-emission affordable.

## The moving parts

- **`src/index.js`** — entry: subscribes the renderer to the main view stream.
- **`src/renderer.js`** — the entire "framework": subscribe to `Observable<VTree>`, `createElement` on first emission, `diff`/`patch` on the rest.
- **`src/events.js`** — two shared global streams (`click`, `keyup` on `body`), filtered by CSS class. No per-element listeners — necessary, because virtual-dom keeps replacing nodes, and listeners on replaced nodes would be lost.
- **`src/db.js`** — Dexie schema (`feeds: 'url, name'`, `posts: 'link, title, …, read, feedUrl'`), the hook→Observable bridge, the cascading delete, and the `window.Posts` / `window.Feeds` console handles.
- **`src/models/`** — `feeds_` / `posts_` collection streams, feed seeding, fetch-and-dedupe (`fetchAllFeeds_`), `addFeed_`, `markPostAsRead_`.
- **`src/components/`** — `main` (3-pane layout), `sidebar` (brand + widgets, merges the two filter sources into one filter object), `sidebar-feed-filter`, `sidebar-fetch-n-add-widget`, `sidebar-feed-list`, `posts-list`, `reader`.

## Quirks and rough edges (some deliberate — the readme promises "easter eggs, obvious/non-obvious mistakes made on purpose")

- **`eval` in the reader** (`src/components/reader.js`): `html2hscript` produces hyperscript *source code as a string*, which is `eval`'d with `window.h` in scope to get a VTree. Pragmatic, and an XSS-adjacent hack.
- **Imperative escape hatches:** the filter widget and feed list mutate `classList` directly in `.do()` side effects to move the `active` highlight — stepping outside the declarative render loop.
- **Initial-state mismatch:** the filter widget renders *Unread* as `active`, but the filter stream starts with `''` (no filter), so all posts show while *Unread* is highlighted.
- **Fragile dedupe:** `fetchAllFeeds_` pairs a `flatMap`'d lookup stream with the original via `zip`, relying on ordering that `flatMap` doesn't guarantee (the author admits: "I am sure there's a better way of doing this").
- **Hidden globals:** `models/feeds.js` and `components/posts-list.js` use `Posts` without importing it — they silently rely on `window.Posts` assigned in `db.js`.
- **`read` is the string `'true'`/`'false'`**, not a boolean — IndexedDB couldn't index booleans.

## Trade-offs of the style

**Wins:** no framework, ~15 small files; state lives in exactly one place (IndexedDB); offline-first falls out naturally; async complexity (fetch → parse → store → render) is uniform — everything is the same Observable vocabulary; the renderer is 30 lines.

**Costs:** whole-collection re-query and whole-tree re-render on every DB write (fine at this scale, O(n) per change); delegated-events-by-class-name are stringly-typed — rename a CSS class and behavior silently breaks; no component-local state means UI-only state (like the add-feed input toggle) must also be modeled as streams; debugging long observable chains without dev tooling requires `longStackSupport`.

## Postscript: the component pattern of the modern rewrite (rxjs-spa-v02)

The rewrite ([hansschenker/rxjs-spa-v02](https://github.com/hansschenker/rxjs-spa-v02)) keeps yarr's contracts but inverts its rendering: components are no longer functions returning `Observable<VTree>` — they are functions that run **once** and return **real DOM**, with the observables embedded *inside* them. The reusable `Panel` component (`src/components/Panel.tsx`) is the canonical template for this style — a container with a children slot, in the spirit of the React component structure the original author admired, still with zero React:

```tsx
import { BehaviorSubject, map } from 'rxjs';
import { h } from '../jsx/jsx';
import type { ElementChild, PropValue } from '../jsx/jsx';

export interface PanelProps {
  title: PropValue<string>; // plain value or live stream
  collapsed?: boolean;      // static initial config
  children?: ElementChild;  // the slot
}

export function Panel({ title, collapsed = false, children }: PanelProps): JSX.Element {
  const collapsed$ = new BehaviorSubject<boolean>(collapsed); // private local state

  return (
    <section className={collapsed$.pipe(map((c) => (c ? 'panel collapsed' : 'panel')))}>
      <button className="panel-header" onClick={() => collapsed$.next(!collapsed$.getValue())}>
        <span className="panel-title">{title}</span>
        <span className="panel-chevron">{collapsed$.pipe(map((c) => (c ? '▸' : '▾')))}</span>
      </button>
      <div className="panel-body" hidden={collapsed$}>
        {children}
      </div>
    </section>
  );
}
```

```tsx
// usage — nesting, slots and live regions compose freely:
<Panel title="Subscriptions">
  <FeedList />
</Panel>
```

Four rules make the pattern:

1. **A component is a constructor, not a render function.** It runs exactly once; nothing re-renders. Nesting (`<Panel><FeedList /></Panel>`) is plain function composition at construction time — the JSX factory calls the function with its props.
2. **`children` is a true slot.** Its type is `ElementChild`, so a slot accepts text, numbers, elements, nested components, arrays — and Observables, which become self-updating live regions inside the panel.
3. **Props that change over time are streams; props that never change are plain values.** `PropValue<T> = T | Observable<T>` accepts both — this is the architecture's replacement for prop-driven re-rendering.
4. **Local UI state is a private Subject bound declaratively.** The collapse flag lives in a `BehaviorSubject` and reaches the DOM only through observable props (`className`, `hidden`) — never through imperative mutation. This is the rewrite's answer to the original's `classList` surgery.

To reuse the pattern in another project, copy the ~250-line runtime (`src/jsx/jsx.ts`, `src/jsx/jsx-types.d.ts`) and the tsconfig JSX wiring (`"jsx": "react"`, `"jsxFactory": "h"`, `"jsxFragmentFactory": "Fragment"`); `Panel.tsx` and its test file `Panel.test.tsx` are the working reference and usage contract.
