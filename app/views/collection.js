// app/views/collection.js — rework complet
import { getClient, getUser } from '../../logic/supaRaw.js';
import { url } from '../../logic/paths.js';

const SETS = [
  { id: 'BZH01', label: 'Set 1 — BZH Chronicles', file: '/data/BZH01.json' },
  { id: 'BZH02', label: 'Set 2 — BZH Chronicles', file: '/data/BZH02.json' },
];

export async function renderCollection(root) {
  const el = document.createElement('div');
  el.className = 'panel';
  el.innerHTML = `
    <div class="h-section">📘 Collection</div>
    <div style="padding:8px 16px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      ${SETS.map(s => `<button class="btn-nav btn-set" data-set="${s.id}">${s.label}</button>`).join('')}
      <span id="coll-stats" style="margin-left:auto;color:var(--muted);font-size:.9em"></span>
    </div>
    <div id="coll-grid" class="grid" style="min-height:200px">Chargement...</div>
  `;
  root.appendChild(el);

  const gridEl = el.querySelector('#coll-grid');
  const statsEl = el.querySelector('#coll-stats');
  let activeSet = SETS[0].id;

  // Highlight bouton actif
  function updateBtns() {
    el.querySelectorAll('.btn-set').forEach(b => {
      b.style.borderColor = b.dataset.set === activeSet ? 'var(--accent)' : '';
      b.style.color = b.dataset.set === activeSet ? 'var(--accent)' : '';
    });
  }

  // Charger la collection du joueur (cartes possédées)
  async function loadOwned() {
    try {
      const sb = await getClient();
      const user = await getUser();
      const { data } = await sb.from('player_cards')
        .select('card_id, quantity')
        .eq('player_id', user.id);
      const map = {};
      (data || []).forEach(r => { map[r.card_id] = r.quantity || 0; });
      return map;
    } catch {
      return {};
    }
  }

  // Charger le JSON du set
  async function loadSetCards(setId) {
    const setInfo = SETS.find(s => s.id === setId);
    const res = await fetch(url(setInfo.file));
    const json = await res.json();
    // Support tableau direct ou { cards: [...] }
    return Array.isArray(json) ? json : (json.cards || []);
  }

  async function renderSet(setId) {
    gridEl.innerHTML = '<div style="padding:16px;opacity:.7">Chargement...</div>';
    statsEl.textContent = '';

    let cards, owned;
    try {
      [cards, owned] = await Promise.all([loadSetCards(setId), loadOwned()]);
    } catch (e) {
      gridEl.innerHTML = `<div style="color:#ff8a8a;padding:16px">Erreur de chargement.</div>`;
      return;
    }

    const ownedCount = cards.filter(c => (owned[c.id] || 0) > 0).length;
    statsEl.textContent = `${ownedCount} / ${cards.length} cartes`;

    gridEl.innerHTML = '';
    const frag = document.createDocumentFragment();

    cards.forEach(card => {
      const qty = owned[card.id] || 0;
      const hasCard = qty > 0;
      const rarityClass = `rarity-${(card.rarity || 'common').toLowerCase()}`;
      const imgSrc = url(`/assets/cards/${card.image || card.id + '.webp'}?v=cyber`);

      const div = document.createElement('div');
      div.className = `sleeve card ${rarityClass} ${hasCard ? 'owned' : ''}`;
      div.style.position = 'relative';
      div.style.cursor = 'pointer';
      div.title = `${card.name} — ${card.rarity}`;

      if (hasCard) {
        div.innerHTML = `
          <img src="${imgSrc}" alt="${card.name}"
            style="width:100%;height:100%;object-fit:cover;border-radius:10px"
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
          <div style="display:none;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:4px">
            <span style="font-size:.75em;font-weight:700;text-align:center;padding:4px">${card.name}</span>
            <span style="font-size:.7em;color:var(--muted)">${card.rarity}</span>
          </div>
          ${qty > 1 ? `<span class="badge-new" style="background:#42b0ff;color:#000">x${qty}</span>` : ''}
        `;
      } else {
        div.innerHTML = `
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:4px;opacity:.45">
            <span style="font-size:1.6em">?</span>
            <span style="font-size:.7em;color:var(--muted);text-align:center;padding:4px">${card.name}</span>
            <span style="font-size:.65em;color:var(--muted)">${card.rarity}</span>
          </div>
        `;
      }

      frag.appendChild(div);
    });

    gridEl.appendChild(frag);
  }

  // Clics sur les sets
  el.querySelectorAll('.btn-set').forEach(b => {
    b.addEventListener('click', () => {
      activeSet = b.dataset.set;
      updateBtns();
      renderSet(activeSet);
    });
  });

  updateBtns();
  await renderSet(activeSet);
}
