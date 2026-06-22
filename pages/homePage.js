// pages/homePage.js — v3.0.0
// Home: greeting + stats + daily + leaderboard/nav row + achievements
import { mount as mountDaily }        from './dailyWidget.js?v=3';
import { mount as mountLeaderboard }  from './leaderboardWidget.js?v=3';
import { mount as mountAchievements } from './achievementsWidget.js?v=3';
import { getCachedPlayer }            from '../data/supabaseData.js?v=3';
import { getUser }                    from '../logic/supaRaw.js?v=3';

const NAV_ITEMS = [
  { hash: '#/packs',      icon: '\u{1F0CF}', label: 'Boosters'   },
  { hash: '#/shop',       icon: '\u{1F6D2}', label: 'Boutique'   },
  { hash: '#/collection', icon: '\u{1F4D6}', label: 'Collection' },
];

const CSS = `
.home-wrap {
  color: #dfe;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
  padding: 24px 12px 64px;
}
.home-greeting { font-size: 22px; font-weight: 800; color: #c8f0d0; letter-spacing: .4px; }
.home-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 20px;
  width: 100%;
  max-width: 960px;
}
.stat-card {
  background: #0b1218;
  border: 1px solid #1a2e40;
  border-radius: 16px;
  padding: 18px 24px;
  min-width: 140px;
  text-align: center;
  flex: 1;
}
.stat-val   { font-size: 28px; font-weight: 900; color: #ffd36b; }
.stat-label { font-size: 12px; color: #5a8a7a; margin-top: 4px; text-transform: uppercase; letter-spacing: .5px; }
.home-mid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 28px;
  width: 100%;
  max-width: 960px;
  align-items: flex-start;
}
.home-nav {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 160px;
  flex-shrink: 0;
}
.nav-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid #1e3a4a;
  background: #0b1624;
  color: #cde;
  padding: 14px 20px;
  border-radius: 14px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 700;
  text-decoration: none;
  transition: filter .15s, transform .1s;
}
.nav-btn:hover { filter: brightness(1.15); transform: translateX(3px); }
.nav-icon { font-size: 22px; }
.home-section-title {
  font-size: 13px;
  font-weight: 800;
  color: #aaedbb;
  text-transform: uppercase;
  letter-spacing: .6px;
  width: 100%;
  max-width: 960px;
  padding-bottom: 4px;
  border-bottom: 1px solid #1a2e22;
}
`;

export async function render(root) {
  if (!document.getElementById('home-page-style')) {
    const s = document.createElement('style');
    s.id = 'home-page-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'home-wrap';

  // ── Greeting ──────────────────────────────────────────────────────────────
  const player  = getCachedPlayer();
  const name    = player?.username || 'Joueur';
  const greeting = document.createElement('div');
  greeting.className   = 'home-greeting';
  greeting.textContent = `Bienvenue, ${name} ⚔️`;
  wrap.appendChild(greeting);

  // ── Stat cards ────────────────────────────────────────────────────────────
  const statsRow = document.createElement('div');
  statsRow.className = 'home-row';
  [
    { id: 'stat-gold',  val: player?.chronicles  ?? 0, label: '⛁ Or'           },
    { id: 'stat-cards', val: player?.cards_count ?? 0, label: '🃏 Cartes'       },
    { id: 'stat-packs', val: player?.pack_count  ?? 0, label: '📦 Packs ouverts' },
  ].forEach(({ id, val, label }) => {
    const c = document.createElement('div');
    c.className = 'stat-card';
    c.innerHTML = `<div class="stat-val" id="${id}">${val}</div><div class="stat-label">${label}</div>`;
    statsRow.appendChild(c);
  });
  wrap.appendChild(statsRow);

  // ── Daily widget ──────────────────────────────────────────────────────────
  const dailySlot = document.createElement('div');
  await mountDaily(dailySlot);
  wrap.appendChild(dailySlot);

  // ── Mid row: leaderboard (flex:2) + quick nav ─────────────────────────────
  const mid = document.createElement('div');
  mid.className = 'home-mid';

  const lbSlot = document.createElement('div');
  lbSlot.style.flex = '2';
  const user = await getUser();
  mountLeaderboard(lbSlot, user?.id ?? null); // non-blocking
  mid.appendChild(lbSlot);

  const nav = document.createElement('div');
  nav.className = 'home-nav';
  NAV_ITEMS.forEach(({ hash, icon, label }) => {
    const a = document.createElement('a');
    a.className = 'nav-btn';
    a.href      = hash;
    a.innerHTML = `<span class="nav-icon">${icon}</span>${label}`;
    nav.appendChild(a);
  });
  mid.appendChild(nav);
  wrap.appendChild(mid);

  // ── Achievements section ───────────────────────────────────────────────────
  const achTitle = document.createElement('div');
  achTitle.className   = 'home-section-title';
  achTitle.textContent = '🏅 Succès';
  wrap.appendChild(achTitle);

  const achSlot = document.createElement('div');
  achSlot.style.width    = '100%';
  achSlot.style.maxWidth = '960px';
  mountAchievements(achSlot); // non-blocking
  wrap.appendChild(achSlot);

  root.appendChild(wrap);

  // ── Live gold ──────────────────────────────────────────────────────────────
  const onGold = (e) => {
    const el = root.querySelector('#stat-gold');
    if (el && e.detail?.gold != null) el.textContent = String(e.detail.gold);
  };
  window.addEventListener('tcg:gold', onGold);
  root.addEventListener('removed', () => window.removeEventListener('tcg:gold', onGold));
}
