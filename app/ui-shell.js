// app/ui-shell.js — v4.0.0
// Navbar persistante : active state, live chronicles, #/packs, tcg_player_packs
import { navigate, boot } from './router.js';
import { set } from './state.js';
import { getClient, getUser, requireLogin } from '../logic/supaRaw.js';
import { getDisplayName, initPlayer } from '../data/supabaseData.js';
import { supabase as sb2 } from '/shared/supabase-client.js';

const NAV_LINKS = [
  { hash: '#/home',       icon: '\u{1F3E0}', label: 'Accueil'    },
  { hash: '#/packs',      icon: '\u{1F0CF}', label: 'Boosters'   },
  { hash: '#/shop',       icon: '\u{1F6D2}', label: 'Boutique'   },
  { hash: '#/collection', icon: '\u{1F4D6}', label: 'Collection' },
];

const SHELL_CSS = `
#topbar {
  position: sticky;
  top: 0;
  z-index: 1000;
  background: linear-gradient(90deg, #060c10 0%, #081210 100%);
  border-bottom: 1px solid #1a2e22;
  box-shadow: 0 2px 16px rgba(0,0,0,.45);
}
.topbar-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  height: 52px;
}
.brand {
  font-weight: 900;
  font-size: 15px;
  color: #aaedbb;
  letter-spacing: .4px;
  white-space: nowrap;
  margin-right: 8px;
}
.nav {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
}
.btn-nav {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid transparent;
  background: transparent;
  color: #8ab;
  padding: 6px 12px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: color .15s, background .15s, border-color .15s;
  white-space: nowrap;
}
.btn-nav:hover {
  color: #cef;
  background: #0e1f2a;
  border-color: #1e3a4a;
}
.btn-nav.active {
  color: #b5f0c0;
  background: #0d2218;
  border-color: #2a5e34;
}
.userbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  font-size: 13px;
  color: #7ab;
  white-space: nowrap;
}
/* Chronicles chip — remplace gold-chip */
.chr-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: linear-gradient(180deg,#1a1000,#120e00);
  border: 1px solid #a07820;
  color: #f0c060;
  padding: 3px 10px;
  border-radius: 999px;
  font-weight: 700;
  font-size: 13px;
  letter-spacing: .03em;
}
.chr-chip .chr-ico {
  filter: drop-shadow(0 0 5px rgba(255,200,60,.4));
  font-style: normal;
}
.btn-cig {
  border: 1px solid #234;
  background: #0a1018;
  color: #89b;
  padding: 5px 10px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 12px;
  transition: filter .15s;
}
.btn-cig:hover { filter: brightness(1.2); }
`;

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.getElementById('shell-style')) {
    const s = document.createElement('style');
    s.id = 'shell-style';
    s.textContent = SHELL_CSS;
    document.head.appendChild(s);
  }

  const top = document.getElementById('topbar');
  top.innerHTML = `
    <div class="topbar-inner">
      <div class="brand">Lab TCG</div>
      <nav class="nav" id="main-nav"></nav>
      <div class="userbar">
        <span id="ub-name">…</span>
        <div class="chr-chip"><i class="chr-ico">◆</i><span id="ub-chr">0</span></div>
        <button class="btn-cig" id="btn-cig" title="Carte d&apos;Identification">CIG</button>
      </div>
    </div>`;

  // Nav links
  const navEl = top.querySelector('#main-nav');
  NAV_LINKS.forEach(({ hash, icon, label }) => {
    const btn = document.createElement('button');
    btn.className = 'btn-nav';
    btn.dataset.hash = hash;
    btn.innerHTML = `<span>${icon}</span><span>${label}</span>`;
    btn.addEventListener('click', () => navigate(hash));
    navEl.appendChild(btn);
  });

  function syncActive() {
    const h = location.hash || '#/home';
    navEl.querySelectorAll('.btn-nav').forEach(b =>
      b.classList.toggle('active', b.dataset.hash === h)
    );
  }
  window.addEventListener('hashchange', syncActive);
  syncActive();

  top.querySelector('#btn-cig').addEventListener('click', openCIGModal);

  // Auth + player init
  await requireLogin();
  const sb   = await getClient();
  const user = await getUser();
  if (!user) return;

  const player = await initPlayer(sb, user);
  set({ user, player, chronicles: player?.chronicles ?? 0 });

  const nameEl = document.getElementById('ub-name');
  const chrEl  = document.getElementById('ub-chr');

  nameEl.textContent = getDisplayName();
  setChr(player?.chronicles ?? 0);

  function setChr(v) {
    if (chrEl) chrEl.textContent = Number(v || 0).toLocaleString('fr-FR');
  }

  // Mise à jour live après achat (event boutique)
  window.addEventListener('tcg:chronicles', (e) => {
    if (e.detail?.chronicles != null) setChr(e.detail.chronicles);
  });

  // Rétro-compat — ancien event tcg:gold
  window.addEventListener('tcg:gold', (e) => {
    if (e.detail?.gold != null) setChr(e.detail.gold);
  });

  // Sync auth (connexion / déconnexion)
  const { data: authListener } = sb2.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT') {
      setChr(0);
      if (nameEl) nameEl.textContent = 'Non connecté';
      return;
    }
    if (session) {
      const fresh = await getClient();
      const { data } = await fresh
        .from('tcg_players')
        .select('chronicles')
        .eq('id', session.user.id)
        .single();
      setChr(data?.chronicles ?? 0);
    }
  });

  // Boot router
  boot();
});

// ---- CIG Modal ----
async function openCIGModal() {
  const sb   = await getClient();
  const user = await getUser();
  if (!user) return;

  const [{ data: packs }, { data: cards }, { data: player }] = await Promise.all([
    sb.from('tcg_player_packs').select('quantity').eq('player_id', user.id),
    sb.from('tcg_player_cards').select('quantity').eq('user_id', user.id),
    sb.from('tcg_players').select('chronicles').eq('id', user.id).single(),
  ]);

  const boostersOwned = (packs || []).reduce((a, b) => a + (b.quantity || 0), 0);
  const cardsTotal    = (cards || []).reduce((a, b) => a + (b.quantity || 0), 0);
  const chronicles    = player?.chronicles ?? 0;
  const name          = getDisplayName();

  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', background: 'rgba(0,0,0,.7)',
    zIndex: '9999', display: 'grid', placeItems: 'center'
  });

  const card = document.createElement('div');
  Object.assign(card.style, {
    width: '340px', padding: '24px', borderRadius: '18px',
    color: '#dfe', background: 'radial-gradient(circle at top,#0b0f14,#000)',
    boxShadow: '0 0 32px rgba(100,200,120,.25)', border: '1px solid #1e3a22'
  });
  card.innerHTML = `
    <div style="text-align:center;font-weight:800;font-size:15px;color:#aaedbb;margin-bottom:14px;letter-spacing:.4px">
      Carte d&apos;Identification Galactique
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;font-size:14px">
      <div>👤 Joueur : <b>${name}</b></div>
      <div>◆ Chronicles : <b style="color:#f0c060">${chronicles.toLocaleString('fr-FR')}</b></div>
      <div>🃏 Cartes : <b>${cardsTotal}</b></div>
      <div>📦 Boosters : <b>${boostersOwned}</b></div>
    </div>
    <div style="text-align:right;margin-top:18px">
      <button id="close-cig" class="btn-nav" style="border-color:#1e3a4a">Fermer</button>
    </div>`;

  overlay.appendChild(card);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  card.querySelector('#close-cig').addEventListener('click', () => overlay.remove());
  document.body.appendChild(overlay);
}
