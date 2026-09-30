// lab/tcg/app/router.js — v3.8 (central routes + navigate/next + cleanup + boot)
import { requireLogin } from '../../shared/supaRaw.js';
import { initSession } from '../../shared/supabaseData.js';
import * as Shop from '../pages/shopPage.js';
import * as Packs from '../pages/packsPage.js';
import * as Collection from '../pages/collectionPage.js';
import * as Album from '../pages/albumPage.js';

const ROUTES = {
  '#/home': Packs.render,
  '#/collection': Collection.render,
  '#/album': Album.render,
  '#/shop': Shop.render,
  '#/packs': Packs.render, // alias
};

const ORDER = ['#/home', '#/collection', '#/album', '#/shop'];
const DEFAULT_HASH = '#/home';

let booted = false;

export function getRouteOrder(){ return [...ORDER]; }
export function hasRoute(hash){ return !!ROUTES[hash]; }

export function navigate(hash, { force = false } = {}){
  if (!hasRoute(hash)) hash = DEFAULT_HASH;
  if (force || location.hash !== hash) location.hash = hash;
  else onRoute();
}

export function next(){
  const h = location.hash || DEFAULT_HASH;
  const i = ORDER.indexOf(h);
  const n = ORDER[(i >= 0 ? i : -1) + 1] || ORDER[0];
  navigate(n);
}

export function boot(){
  if (booted) return;
  booted = true;
  window.addEventListener('hashchange', onRoute);
  document.addEventListener('DOMContentLoaded', async () => {
    await requireLogin();
    await initSession();
    if (!location.hash || !hasRoute(location.hash)) location.hash = DEFAULT_HASH;
    onRoute();
  });
}

async function onRoute(){
  const root = document.getElementById('app-root');
  if (!root) return;
  const h = location.hash || DEFAULT_HASH;
  const handler = ROUTES[h] || ROUTES[DEFAULT_HASH];
  root.dispatchEvent(new Event('removed')); // allow page cleanup
  root.innerHTML = '';
  try{
    await handler(root);
  }catch(e){
    root.innerHTML = `<div style="color:#faa">Erreur route ${h}: ${e?.message||e}</div>`;
  }
}

export const __routes = Object.freeze({ ...ROUTES });
