import { renderCollection }  from './views/collection.js?v=12';
import { renderSquadBuilder } from './views/squadBuilder.js?v=12';
import { renderSquadBattle }  from './views/squadBattle.js?v=12';
import { renderSquadTutorial } from './views/squadTutorial.js?v=12';

// L'ancien mode 1-champion (deck-builder + battle) est retiré du jeu : ses routes
// `#/deck-builder` et `#/battle` ne sont plus exposées. Les vues restent sur disque
// (dormantes) — voir app/views/{battle,deckBuilder}.js, logic/{battleEngine,aiEngine}.js.
const routes = {
  '#/collection':  renderCollection,
  '#/squad-builder': renderSquadBuilder,
  '#/squad-battle':  renderSquadBattle,
  '#/squad-tuto':    renderSquadTutorial,
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
