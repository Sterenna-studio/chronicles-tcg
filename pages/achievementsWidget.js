// pages/achievementsWidget.js — v1.0.0
// Injectable achievements grid with tier colours + locked/unlocked states
import { getAchievements, TIERS } from '../data/achievementsRepo.js?v=3';

const TIER_COLOR = {
  [TIERS.bronze]:    { bg: '#1a1008', border: '#7c4a10', badge: '#cd7f32', glow: 'rgba(180,100,30,.22)' },
  [TIERS.silver]:    { bg: '#101318', border: '#4a5a7a', badge: '#b0bec5', glow: 'rgba(140,160,200,.18)' },
  [TIERS.gold]:      { bg: '#141008', border: '#7a6200', badge: '#ffd700', glow: 'rgba(255,210,30,.22)'  },
  [TIERS.legendary]: { bg: '#110b1e', border: '#7a30c0', badge: '#bf7fff', glow: 'rgba(180,100,255,.28)' },
};

const CATEGORY_LABEL = {
  collection: '\u{1F4DA} Collection',
  'raret\u00e9':     '\u2728 Raret\u00e9',
  packs:      '\u{1F4E6} Packs',
  or:         '\u26C1 Or',
  sets:       '\u{1F5FA} Sets',
};

const CSS = `
.ach-wrap { width: 100%; }
.ach-section-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .7px;
  color: #5a8a7a;
  margin: 18px 0 8px;
}
.ach-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 10px;
}
.ach-card {
  border-radius: 12px;
  padding: 12px 14px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  transition: transform .12s, filter .12s;
  position: relative;
  overflow: hidden;
}
.ach-card.unlocked:hover { transform: translateY(-2px); filter: brightness(1.1); }
.ach-card.locked {
  opacity: .38;
  filter: grayscale(.9);
}
.ach-icon {
  font-size: 24px;
  flex-shrink: 0;
  line-height: 1;
  margin-top: 1px;
}
.ach-body { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.ach-name {
  font-size: 12px;
  font-weight: 700;
  color: #dfe;
  line-height: 1.2;
}
.ach-desc {
  font-size: 11px;
  color: #7a9a8a;
  line-height: 1.3;
}
.ach-tier-dot {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.ach-check {
  position: absolute;
  bottom: 6px;
  right: 8px;
  font-size: 11px;
  opacity: .8;
}
.ach-summary {
  font-size: 12px;
  color: #5a8a6a;
  margin-bottom: 12px;
}
.ach-progress-bar {
  height: 4px;
  border-radius: 2px;
  background: #1a2a1e;
  overflow: hidden;
  margin-top: 6px;
}
.ach-progress-fill {
  height: 100%;
  border-radius: 2px;
  background: linear-gradient(90deg, #2a7a3e, #6adf8a);
  transition: width .4s ease;
}
`;

/**
 * Mounts the achievements widget inside `container`.
 */
export async function mount(container) {
  if (!document.getElementById('ach-style')) {
    const s = document.createElement('style');
    s.id = 'ach-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  const wrap = document.createElement('div');
  wrap.className = 'ach-wrap';
  wrap.innerHTML = '<div class="ach-summary">Chargement des succes…</div>';
  container.appendChild(wrap);

  let achievements;
  try {
    achievements = await getAchievements();
  } catch (e) {
    wrap.innerHTML = `<div class="ach-summary" style="color:#f99">⚠️ Erreur : ${e?.message || e}</div>`;
    return;
  }

  const unlocked = achievements.filter(a => a.unlocked).length;
  const total    = achievements.length;
  const pct      = Math.round((unlocked / total) * 100);

  wrap.innerHTML = '';

  // Summary + progress bar
  const summary = document.createElement('div');
  summary.innerHTML = `
    <div class="ach-summary">${unlocked} / ${total} succ\u00e8s d\u00e9bloqu\u00e9s</div>
    <div class="ach-progress-bar">
      <div class="ach-progress-fill" style="width:${pct}%"></div>
    </div>
  `;
  wrap.appendChild(summary);

  // Group by category
  const byCategory = {};
  for (const a of achievements) {
    if (!byCategory[a.category]) byCategory[a.category] = [];
    byCategory[a.category].push(a);
  }

  const ORDER = ['collection', 'raret\u00e9', 'packs', 'or', 'sets'];
  for (const cat of ORDER) {
    const list = byCategory[cat];
    if (!list?.length) continue;

    const sectionTitle = document.createElement('div');
    sectionTitle.className = 'ach-section-title';
    sectionTitle.textContent = CATEGORY_LABEL[cat] ?? cat;
    wrap.appendChild(sectionTitle);

    const grid = document.createElement('div');
    grid.className = 'ach-grid';

    for (const a of list) {
      const tc = TIER_COLOR[a.tier] ?? TIER_COLOR[TIERS.bronze];
      const card = document.createElement('div');
      card.className = `ach-card ${a.unlocked ? 'unlocked' : 'locked'}`;
      card.style.background  = tc.bg;
      card.style.border      = `1px solid ${tc.border}`;
      card.style.boxShadow   = a.unlocked ? `0 0 14px ${tc.glow}` : 'none';
      card.innerHTML = `
        <div class="ach-icon">${a.icon}</div>
        <div class="ach-body">
          <div class="ach-name">${escHtml(a.name)}</div>
          <div class="ach-desc">${escHtml(a.desc)}</div>
        </div>
        <div class="ach-tier-dot" style="background:${tc.badge}"></div>
        ${a.unlocked ? '<div class="ach-check">✓</div>' : ''}
      `;
      grid.appendChild(card);
    }
    wrap.appendChild(grid);
  }
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
