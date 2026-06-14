// ui-shell.js — modernisé (ESM only)
import { navigate } from './router.js';
import { set } from './state.js';
import { getClient, getUser, requireLogin } from '../logic/supaRaw.js';
import { getDisplayName, initPlayer } from '../data/supabaseData.js';
import { openCIG } from '../ui/cigModal.js';

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
      <div class="userbar"><span id="ub-name">...</span> • <span id="ub-chronicles">0</span> ✦</div>
    </div>`;

  top.querySelectorAll('[data-nav]').forEach(b =>
    b.addEventListener('click', e => navigate(e.currentTarget.dataset.nav))
  );
  top.querySelector('#btn-cig').addEventListener('click', () => openCIG());

  // Auth
  await requireLogin();
  const sb = await getClient();
  const user = await getUser();
  if (!user) return;

  const player = await initPlayer(sb, user);
  set({
    user,
    player,
    chronicles: (player && player.chronicles != null) ? player.chronicles : 0
  });

  document.getElementById('ub-name').textContent = getDisplayName();
  document.getElementById('ub-chronicles').textContent = (player && player.chronicles != null) ? player.chronicles : 0;
});
