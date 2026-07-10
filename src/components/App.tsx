import { h } from '../jsx/jsx';
import { PostsList } from './PostsList';
import { Reader } from './Reader';
import { Sidebar } from './Sidebar';

export function App(): JSX.Element {
  return (
    <div className="app">
      <Sidebar />
      <PostsList />
      <Reader />
    </div>
  );
}
