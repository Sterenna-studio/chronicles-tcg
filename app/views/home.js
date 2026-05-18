// app/views/home.js
import { loadPlayerPacks } from '../../data/packsRepo.js';
import { getClient, getUser } from '../../logic/supaRaw.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import { url } from '../../logic/paths.js';

// Probabilités par rareté selon le type de pack (card_count sert d'indicateur)
const RARITY_PROBA = [
  { label: 'Common',    color: '#9da7b3', prob: '60%' },
  { label: 'Rare',      color: '#42b0ff', prob: '25%' },
  { label: 'Epic',      color: '#bb55d3', prob: '10%' },
  { label: 'Legendary', color: '#ffbe46', prob: '4%'  },
  { label: 'Mythical',  color: '#ff5080', prob: '1%'  },
];

function dispatchOpen(p) {
  document.dispatchEvent(new CustomEvent('tcg:open-pack', {
    detail: { pack_type_id: p.pack_type_id ?? p.id, set_id: p.set_id }
  }));
  navigate('#/opening');
}

function showPackTooltip(p, anchorEl) {
  document.querySelectorAll('.pack-tooltip').forEach(t => t.remove());
  const tooltip = document.createElement('div');
  tooltip.className = 'pack-tooltip';
  const imgSrc = url('/assets/packs/' + p.image_name + '?v=cyber');
  tooltip.style.cssText = `
    position:fixed;
    z-index:20000;
    background:#05080d;
    border:1px solid #00f5c4;
    border-radius:14px;
    padding:14px;
    width:220px;
    box-shadow:0 8px 40px rgba(0,245,196,.18);
    color:#c8ffe8;
    font-family:inherit;
    font-size:.85em;
    pointer-events:none;
  `;
  tooltip.innerHTML = `
    <div style="display:flex;gap:10px;align-items:center;margin-bottom:10px">
      <img src="${imgSrc}" style="width:48px;height:68px;object-fit:contain;border-radius:6px;background:#060c10;border:1px solid #0e2a1f">
      <div>
        <div style="font-weight:700;font-size:1em">${p.name}</div>
        <div style="color:#6fa694;font-size:.8em;margin-top:2px">${p.card_count || '?'} cartes · Set ${p.set_id || '?'}</div>
        <div style="color:#42b0ff;font-size:.8em;margin-top:2px">Quantité : ${p.quantity}</div>
      </div>
    </div>
    <div style="font-size:.78em;color:#6fa694;margin-bottom:6px;font-weight:700;letter-spacing:.06em">PROBABILITÉS</div>
    ${RARITY_PROBA.map(r => `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
        <span style="color:${r.color};font-size:.78em">${r.label}</span>
        <div style="flex:1;margin:0 8px;height:4px;background:#0e2a1f;border-radius:2px;overflow:hidden">
          <div style="height:100%;width:${r.prob};background:${r.color};border-radius:2px;"></div>
        </div>
        <span style="color:#8ab;font-size:.75em">${r.prob}</span>
      </div>
    `).join('')}
    <div style="margin-top:8px;font-size:.72em;color:#3a6655;text-align:center">Clic gauche pour ouvrir</div>
  `;

  document.body.appendChild(tooltip);

  // Positionnement intelligent
  const rect = anchorEl.getBoundingClientRect();
  const tw = 220, th = 260;
  let left = rect.left + rect.width / 2 - tw / 2;
  let top = rect.top - th - 12;
  if (top < 8) top = rect.bottom + 12;
  if (left < 8) left = 8;
  if (left + tw > window.innerWidth - 8) left = window.innerWidth - tw - 8;
  tooltip.style.left = left + 'px';
  tooltip.style.top = top + 'px';

  // Défocalisation du fond
  const shell = document.querySelector('.shell');
  if (shell) shell.style.filter = 'blur(3px)';

  const cleanup = () => {
    tooltip.remove();
    if (shell) shell.style.filter = '';
    document.removeEventListener('click', cleanup);
    document.removeEventListener('keydown', cleanup);
  };
  setTimeout(() => {
    document.addEventListener('click', cleanup, { once: true });
    document.addEventListener('keydown', cleanup, { once: true });
  }, 50);
}

function buildGroupedCard(p) {
  const imgSrc = url('/assets/packs/' + p.image_name + '?v=cyber');
  const card = document.createElement('div');
  card.className = 'booster-card';
  card.style.cssText = 'background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;cursor:pointer;transition:transform .18s ease,box-shadow .18s ease;';
  card.innerHTML = `
    <div style="height:160px;background-image:url('${imgSrc}');background-size:cover;background-position:center;position:relative">
      <span style="position:absolute;top:8px;right:8px;background:#1f6feb;color:#fff;font-weight:700;font-size:.8em;padding:3px 8px;border-radius:6px">x${p.quantity}</span>
    </div>
    <div style="padding:10px 12px">
      <div style="font-weight:700;font-size:.95em">${p.name}</div>
      <div style="color:var(--muted);font-size:.8em;margin-top:2px">${p.card_count} cartes · Set ${p.set_id || '?'}</div>
      <button class="btn open-btn" style="width:100%;margin-top:8px;font-size:.85em">Ouvrir</button>
    </div>
  `;
  card.querySelector('.open-btn').addEventListener('click', () => dispatchOpen(p));
  card.addEventListener('mouseenter', () => {
    card.style.transform = 'translateY(-4px)';
    card.style.boxShadow = '0 8px 24px rgba(0,0,0,.5)';
  });
  card.addEventListener('mouseleave', () => {
    card.style.transform = '';
    card.style.boxShadow = '';
  });
  card.addEventListener('contextmenu', e => {
    e.preventDefault();
    showPackTooltip(p, card);
  });
  return card;
}

function buildSingleCard(p) {
  const imgSrc = url('/assets/packs/' + p.image_name + '?v=cyber');
  // Épaisseur simulée selon card_count (3-12px)
  const cardCount = p.card_count || 5;
  const depth = Math.min(12, Math.max(3, Math.round(cardCount * 0.9)));

  const wrapper = document.createElement('div');
  wrapper.style.cssText = `
    position:relative;
    width:130px;
    cursor:pointer;
    flex-shrink:0;
    transition:transform .22s ease, filter .22s ease;
  `;

  // Couches d'épaisseur
  for (let i = depth; i > 0; i--) {
    const layer = document.createElement('div');
    const offset = i * 2;
    layer.style.cssText = `
      position:absolute;
      left:${offset}px;
      top:${offset}px;
      width:130px;
      height:185px;
      border-radius:10px;
      background:#0a1520;
      border:1px solid #0e2a1f;
      z-index:${10 - i};
    `;
    wrapper.appendChild(layer);
  }

  // Carte principale
  const front = document.createElement('div');
  front.style.cssText = `
    position:relative;
    z-index:10;
    width:130px;
    height:185px;
    border-radius:10px;
    overflow:hidden;
    border:1px solid #1f6feb;
    box-shadow:0 4px 16px rgba(0,0,0,.5);
    background:#060c10;
  `;
  front.innerHTML = `
    <img src="${imgSrc}" style="width:100%;height:100%;object-fit:contain;" alt="${p.name}"
      onerror="this.style.display='none'">
  `;
  wrapper.appendChild(front);

  // Nom sous la carte
  const label = document.createElement('div');
  label.style.cssText = 'margin-top:6px;font-size:.72em;text-align:center;color:#8ab;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:130px;';
  label.textContent = p.name;
  wrapper.appendChild(label);

  // Hover levitation
  wrapper.addEventListener('mouseenter', () => {
    wrapper.style.transform = 'translateY(-8px) scale(1.04)';
    wrapper.style.filter = 'drop-shadow(0 12px 24px rgba(0,245,196,.25))';
  });
  wrapper.addEventListener('mouseleave', () => {
    wrapper.style.transform = '';
    wrapper.style.filter = '';
  });

  // Clic gauche → ouvrir
  wrapper.addEventListener('click', () => dispatchOpen(p));

  // Clic droit → tooltip info
  wrapper.addEventListener('contextmenu', e => {
    e.preventDefault();
    showPackTooltip(p, wrapper);
  });

  return wrapper;
}

export async function renderHome(root) {
  const el = document.createElement('div');
  el.className = 'panel';
  el.innerHTML = `
    <div class="h-section">Accueil</div>
    <div id="home-stats" style="display:flex;gap:16px;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid var(--border)">
      <span style="color:var(--muted);font-size:.9em">Chargement...</span>
    </div>
    <div style="padding:12px 16px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
        <div style="font-weight:700">Inventaire — Boosters possédés</div>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:.85em;color:var(--muted);user-select:none;margin-left:auto">
          <input type="checkbox" id="toggle-group" checked style="accent-color:#00f5c4;width:15px;height:15px;cursor:pointer">
          Grouper
        </label>
      </div>
      <div id="owned-packs" style="display:flex;flex-wrap:wrap;gap:16px;padding:4px 0;"></div>
    </div>
  `;
  root.appendChild(el);

  const statsEl = el.querySelector('#home-stats');
  const shelf = el.querySelector('#owned-packs');
  const toggleGroup = el.querySelector('#toggle-group');

  let cachedPacks = [];
  let grouped = true;

  async function loadStats() {
    try {
      const sb = await getClient();
      const user = await getUser();
      const [{ data: pl }, { data: cards }, { data: packs }] = await Promise.all([
        sb.from('players').select('gold').eq('id', user.id).single(),
        sb.from('player_cards').select('qty').eq('player_id', user.id),
        sb.from('player_packs').select('quantity').eq('player_id', user.id),
      ]);
      const gold = pl?.gold ?? (state.gold || 0);
      const totalCards = (cards || []).reduce((s, r) => s + (r.qty || 0), 0);
      const totalPacks = (packs || []).reduce((s, r) => s + (r.quantity || 0), 0);
      statsEl.innerHTML = `
        <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px 16px">
          <div style="font-size:.75em;color:var(--muted)">Or</div>
          <div style="font-weight:700;font-size:1.1em">${gold} monnaies</div>
        </div>
        <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px 16px">
          <div style="font-size:.75em;color:var(--muted)">Cartes possédées</div>
          <div style="font-weight:700;font-size:1.1em">${totalCards}</div>
        </div>
        <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px 16px">
          <div style="font-size:.75em;color:var(--muted)">Boosters</div>
          <div style="font-weight:700;font-size:1.1em">${totalPacks}</div>
        </div>
      `;
    } catch {
      statsEl.innerHTML = '';
    }
  }

  function renderShelf() {
    shelf.innerHTML = '';
    const owned = cachedPacks.filter(p => (p.quantity || 0) > 0);
    if (!owned.length) {
      shelf.innerHTML = `
        <div style="opacity:.7;padding:8px">
          Aucun booster pour le moment.
          <button class="btn" style="margin-left:12px" id="goto-shop">Aller à la boutique</button>
        </div>`;
      shelf.querySelector('#goto-shop')?.addEventListener('click', () => navigate('#/shop'));
      return;
    }

    if (grouped) {
      // Mode groupé : une carte par type avec badge quantité
      owned.forEach(p => shelf.appendChild(buildGroupedCard(p)));
    } else {
      // Mode non groupé : une carte par booster individuel avec épaisseur + lévitation
      owned.forEach(p => {
        for (let i = 0; i < p.quantity; i++) {
          shelf.appendChild(buildSingleCard(p));
        }
      });
    }
  }

  async function loadPacks() {
    try {
      cachedPacks = await loadPlayerPacks();
      renderShelf();
    } catch (err) {
      console.error('Failed to load owned packs', err);
      shelf.innerHTML = '<div style="color:#ff8a8a">Erreur de chargement des boosters.</div>';
    }
  }

  toggleGroup.addEventListener('change', () => {
    grouped = toggleGroup.checked;
    renderShelf();
  });

  await Promise.all([loadStats(), loadPacks()]);
}
