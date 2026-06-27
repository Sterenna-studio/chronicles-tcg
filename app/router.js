import { renderCollection }  from './views/collection.js?v=8';
import { renderDeckBuilder }  from './views/deckBuilder.js?v=8';
import { renderBattle }       from './views/battle.js?v=8';
import { renderSquadBuilder } from './views/squadBuilder.js?v=8';
import { renderSquadBattle }  from './views/squadBattle.js?v=8';
import { renderSquadTutorial } from './views/squadTutorial.js?v=8';

const routes = {
  '#/collection':  renderCollection,
  '#/deck-builder': renderDeckBuilder,
  '#/battle':       renderBattle,
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
