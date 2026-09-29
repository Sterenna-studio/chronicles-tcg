// app/router.js — v2.0.0
import { renderCollection }  from './views/collection.js';
import { render as renderHome  } from '../pages/homePage.js';
import { render as renderShop  } from '../pages/shopPage.js';
import { render as renderPacks } from '../pages/packsPage.js';

const routes = {
  '#/home':       renderHome,
  '#/shop':       renderShop,
  '#/packs':      renderPacks,
  '#/collection': renderCollection,
};

export function navigate(h) {
  if (location.hash !== h) location.hash = h;
  else onRoute();
}

export function boot() {
  addEventListener('hashchange', onRoute);
  if (!location.hash || location.hash === '#') location.hash = '#/home';
  onRoute();
}

async function onRoute() {
  const root = document.getElementById('app-root');
  if (!root) return;
  // Notify previous page to clean up its listeners
  root.dispatchEvent(new Event('removed', { bubbles: false }));
  root.innerHTML = '';
  const fn = routes[location.hash] || renderHome;
  await fn(root);
}
