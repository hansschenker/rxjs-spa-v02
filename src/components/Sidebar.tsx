import { h } from '../jsx/jsx';
import { AddFeedWidget } from './AddFeedWidget';
import { FeedList } from './FeedList';
import { FilterTabs } from './FilterTabs';
import { Panel } from './Panel';

export function Sidebar(): JSX.Element {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <h1>Yarr</h1>
        <p className="sidebar-tagline">Yet Another RSS Reader</p>
      </div>
      <Panel title="Filter">
        <FilterTabs />
      </Panel>
      <Panel title="Manage feeds">
        <AddFeedWidget />
      </Panel>
      <Panel title="Subscriptions">
        <FeedList />
      </Panel>
    </aside>
  );
}
