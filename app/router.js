import { renderCollection }  from './views/collection.js?v=23';
import { renderSquadBuilder } from './views/squadBuilder.js?v=23';
import { renderSquadBattle }  from './views/squadBattle.js?v=23';
import { renderSquadTutorial } from './views/squadTutorial.js?v=23';

// `#/hub` (ou hash vide / inconnu) = le HUB (la `.shell` statique). Toute autre
// route rend une vue plein écran dans `#app-root`. onRoute() pilote SEUL l'affichage
// hub ↔ vue, pour que l'URL reste cohérente (plus de bascule manuelle dans les vues).
// L'ancien mode 1-champion (deck-builder/battle) est retiré : ses fichiers restent
// dormants sur disque mais ne sont plus routés.
export const HUB_HASH = '#/hub';
const routes = {
  '#/collection':    renderCollection,
  '#/squad-builder': renderSquadBuilder,
  '#/squad-battle':  renderSquadBattle,
  '#/squad-tuto':    renderSquadTutorial,
};

export function navigate(h) {
  if (location.hash !== h) location.hash = h;   // déclenche hashchange → onRoute
  else onRoute();
}
/** Retour au hub (URL propre #/hub). */
export function goHub() { navigate(HUB_HASH); }

export function boot() {
  addEventListener('hashchange', onRoute);
  if (!location.hash) location.hash = HUB_HASH;   // atterrissage = hub
  onRoute();
}

function showHub() {
  const shell = document.querySelector('.shell');
  const root  = document.getElementById('app-root');
  if (root)  { root.style.display = 'none'; root.innerHTML = ''; }
  if (shell) shell.style.display = 'grid';
}

async function onRoute() {
  const root = document.getElementById('app-root');
  if (!root) return;
  const fn = routes[location.hash];
  if (!fn) { showHub(); return; }                 // #/hub, vide ou inconnu → hub
  const shell = document.querySelector('.shell');
  if (shell) shell.style.display = 'none';
  root.style.display = 'block';
  root.innerHTML = '';
  await fn(root);
}
