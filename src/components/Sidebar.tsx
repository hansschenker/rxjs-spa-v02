import { h } from '../jsx/jsx';
import { AddFeedWidget } from './AddFeedWidget';
import { FeedList } from './FeedList';
import { FilterTabs } from './FilterTabs';

export function Sidebar(): JSX.Element {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h1>Yarr</h1>
        <p className="sidebar-tagline">Yet Another RSS Reader</p>
      </div>
      <FilterTabs />
      <AddFeedWidget />
      <FeedList />
    </aside>
  );
}
