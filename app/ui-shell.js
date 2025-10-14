// ui-shell.js — modernisé (ESM only)
import { navigate } from './router.js';
import { set } from './state.js';
import { getClient, getUser, requireLogin } from '../logic/supaRaw.js';
import { getDisplayName, initPlayer } from '../data/supabaseData.js';

document.addEventListener('DOMContentLoaded', async () => {
  const top = document.getElementById('topbar');
  top.innerHTML = `
    <div class="topbar-inner">
      <div class="brand">Lab TCG 2.1</div>
      <nav class="nav">
        <button class="btn-nav" data-nav="#/home">🏠 Accueil</button>
        <button class="btn-nav" data-nav="#/shop">🛒 Boutique</button>
        <button class="btn-nav" data-nav="#/collection">📘 Album</button>
        <button class="btn-nav" id="btn-cig">📇 CIG</button>
      </nav>
      <div class="userbar"><span id="ub-name">...</span> • <span id="ub-gold">0</span> 🪙</div>
    </div>`;

  top.querySelectorAll('[data-nav]').forEach(b =>
    b.addEventListener('click', e => navigate(e.currentTarget.dataset.nav))
  );
  top.querySelector('#btn-cig').addEventListener('click', openCIGModal);

  // Auth
  await requireLogin();
  const sb = await getClient();
  const user = await getUser();
  if (!user) return;

  const player = await initPlayer(sb, user);
  set({
    user,
    player,
    gold: (player && player.gold) ? player.gold : 0
  });

  document.getElementById('ub-name').textContent = getDisplayName();
  document.getElementById('ub-gold').textContent = (player && player.gold) ? player.gold : 0;
});

async function openCIGModal() {
  const sb = await getClient();
  const user = await getUser();

  const packsRes = await sb.from('player_packs')
    .select('quantity')
    .eq('player_id', user.id);

  const packs = (packsRes && packsRes.data) ? packsRes.data : [];
  const boostersOwned = packs.reduce((a, b) => a + (b.quantity || 0), 0);

  const name = getDisplayName();

  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.inset = 0;
  overlay.style.background = 'rgba(0,0,0,.65)';
  overlay.style.zIndex = 9999;
  overlay.style.display = 'grid';
  overlay.style.placeItems = 'center';

  const card = document.createElement('div');
  card.style.width = '360px';
  card.style.padding = '20px';
  card.style.borderRadius = '16px';
  card.style.color = '#fff';
  card.style.background = 'radial-gradient(circle at top,#0b0f14,#000)';
  card.style.boxShadow = '0 0 25px rgba(100,150,255,.4)';

  card.innerHTML = `
    <div style="text-align:center;font-weight:bold;margin-bottom:8px">
      Carte d’Identification Galactique
    </div>
    <div>👤 Joueur: <b>${name}</b></div>
    <div>📦 Boosters possédés: <b>${boostersOwned}</b></div>
    <div style="text-align:right;margin-top:12px">
      <button id="close-cig" class="btn-nav">Fermer</button>
    </div>`;

  overlay.appendChild(card);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  card.querySelector('#close-cig').addEventListener('click', () => overlay.remove());
  document.body.appendChild(overlay);
}
