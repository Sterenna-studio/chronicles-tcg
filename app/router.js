import { renderCollection }  from './views/collection.js';
import { renderDeckBuilder }  from './views/deckBuilder.js';
import { renderBattle }       from './views/battle.js';

const routes = {
  '#/collection':  renderCollection,
  '#/deck-builder': renderDeckBuilder,
  '#/battle':       renderBattle,
};

export function navigate(h) {
  if (location.hash !== h) location.hash = h;
  else onRoute();
}

export function boot() {
  addEventListener('hashchange', onRoute);
  if (!location.hash) location.hash = '#/collection';
  onRoute();
}

async function onRoute() {
  const root = document.getElementById('app-root');
  if (!root) return;
  root.innerHTML = '';
  const fn = routes[location.hash] || renderCollection;
  await fn(root);
}
