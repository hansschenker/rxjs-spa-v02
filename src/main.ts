import './styles/tokens.css';
import './styles/main.scss';
import { App } from './components/App';
import { seedIfEmpty } from './db/seed';
import { registerEffects } from './state/effects';

registerEffects();

const root = document.getElementById('app');
if (!root) throw new Error('#app root element not found');
root.appendChild(App());

seedIfEmpty().subscribe({
  error: (err: unknown) => console.warn('Seeding failed', err),
});
