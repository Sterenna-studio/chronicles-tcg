// app/views/collection.js
import { getClient, getUser } from '../../logic/supaRaw.js?v=8';
import { url } from '../../logic/paths.js?v=8';
import { ALL_SETS, isPlayableSet } from '../../logic/sets.js?v=8';

// La collection montre TOUS les sets (cartes Set 02 possédées restent visibles).
const SETS = ALL_SETS;

const RARITY_COLORS = {
  Common: '#9da7b3', Rare: '#42b0ff', Epic: '#bb55d3',
  Legendary: '#ffbe46', Mythical: '#ff5080'
};

async function fetchOwned() {
  try {
    const sb = await getClient();
    const user = await getUser();
    const { data, error } = await sb.from('tcg_player_cards').select('card_id, quantity').eq('user_id', user.id);
    if (error) { console.warn('[collection] tcg_player_cards error', error); return {}; }
    const map = {};
    (data || []).forEach(r => { map[r.card_id] = r.quantity || 0; });
    return map;
  } catch { return {}; }
}

async function loadSetCards(setId) {
  const setInfo = SETS.find(s => s.id === setId);
  const res = await fetch(url(setInfo.file));
  const json = await res.json();
  return Array.isArray(json) ? json : (json.cards || []);
}

function openCardModal(card, qty) {
  const rc = RARITY_COLORS[card.rarity] || '#9da7b3';
  const imgSrc = url(`/assets/cards/${card.id}.jpg`);
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.80);z-index:10100;display:grid;place-items:center;padding:20px';

  const modal = document.createElement('div');
  modal.style.cssText = `
    width:min(480px,95vw);
    background:#05080d;
    border:1px solid ${rc};
    border-radius:16px;
    color:#c8ffe8;
    overflow:hidden;
    box-shadow:0 0 40px ${rc}44;
    display:flex;
    flex-direction:column;
  `;

  const TYPE_ICONS = { Champion:'⚔️', Companion:'🐾', Event:'⚡', Object:'🔧', Special:'✨', Terrain:'🌍' };
  const typeIcon = TYPE_ICONS[card.type] || '📄';

  modal.innerHTML = `
    <div style="position:relative">
      <img src="${imgSrc}" alt="${card.name}"
        style="width:100%;max-height:320px;object-fit:contain;background:#060c10;"
        onerror="this.style.display='none'">
      <button id="modal-close" style="position:absolute;top:10px;right:10px;background:rgba(0,0,0,.7);border:1px solid #ff2d4e;color:#ff2d4e;padding:3px 10px;cursor:pointer;font-family:inherit;font-size:.8em;border-radius:6px">✕</button>
      ${qty > 0 ? `<span style="position:absolute;top:10px;left:10px;background:${rc};color:#000;font-weight:700;font-size:.8em;padding:3px 8px;border-radius:6px">x${qty} possédée${qty > 1 ? 's' : ''}</span>` : '<span style="position:absolute;top:10px;left:10px;background:#1a1a1a;color:#666;font-size:.8em;padding:3px 8px;border-radius:6px">Non possédée</span>'}
    </div>
    <div style="padding:16px;display:flex;flex-direction:column;gap:10px">
      <div style="font-weight:700;font-size:1.1em">${card.name}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <span style="background:#0e2a1f;border:1px solid ${rc};color:${rc};padding:3px 10px;border-radius:20px;font-size:.78em;font-weight:700">${card.rarity}</span>
        <span style="background:#0e2a1f;border:1px solid #2a3a4a;color:#8ab;padding:3px 10px;border-radius:20px;font-size:.78em">${typeIcon} ${card.type}</span>
        <span style="background:#0e2a1f;border:1px solid #2a3a4a;color:#5a7a6a;padding:3px 10px;border-radius:20px;font-size:.78em">${card.id}</span>
      </div>
      ${card.desc ? `<div style="font-size:.85em;color:#8ab4a0;line-height:1.5;border-left:2px solid ${rc}44;padding-left:10px;font-style:italic">${card.desc}</div>` : ''}
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  modal.querySelector('#modal-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

export async function renderCollection(root) {
  const el = document.createElement('div');
  el.className = 'panel';
  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--border)">
      <div style="font-weight:700;letter-spacing:.08em">📘 COLLECTION</div>
      <button id="coll-back" class="btn-nav">← Retour</button>
    </div>
    <div style="padding:8px 16px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      ${SETS.map(s => `<button class="btn-nav btn-set" data-set="${s.id}">${s.label}${isPlayableSet(s.id) ? '' : ' · à venir'}</button>`).join('')}
      <span id="coll-stats" style="margin-left:auto;color:var(--muted);font-size:.9em"></span>
    </div>
    <div id="coll-grid" style="
      display:grid;
      grid-template-columns:repeat(auto-fill,minmax(120px,1fr));
      gap:10px;
      padding:16px;
      overflow-y:auto;
      max-height:calc(100vh - 120px);
    ">Chargement...</div>
  `;
  root.appendChild(el);

  el.querySelector('#coll-back').addEventListener('click', () => {
    root.innerHTML = '';
    document.getElementById('app-root').style.display = 'none';
    document.querySelector('.shell').style.display = 'grid';
  });

  const gridEl = el.querySelector('#coll-grid');
  const statsEl = el.querySelector('#coll-stats');
  let activeSet = SETS[0].id;

  function updateBtns() {
    el.querySelectorAll('.btn-set').forEach(b => {
      b.style.borderColor = b.dataset.set === activeSet ? 'var(--cyan)' : '';
      b.style.color = b.dataset.set === activeSet ? 'var(--cyan)' : '';
    });
  }

  async function renderSet(setId) {
    gridEl.innerHTML = '<div style="padding:16px;opacity:.7">Chargement...</div>';
    statsEl.textContent = '';
    let cards, owned;
    try {
      [cards, owned] = await Promise.all([loadSetCards(setId), fetchOwned()]);
    } catch (e) {
      gridEl.innerHTML = `<div style="color:#ff8a8a;padding:16px">Erreur de chargement.</div>`;
      return;
    }
    const ownedCount = cards.filter(c => (owned[c.id] || 0) > 0).length;
    statsEl.textContent = `${ownedCount} / ${cards.length} cartes`;
    gridEl.innerHTML = '';
    const frag = document.createDocumentFragment();
    // Set non jouable : bandeau d'info (cartes visibles mais hors combat)
    if (!isPlayableSet(setId)) {
      const note = document.createElement('div');
      note.style.cssText = 'grid-column:1/-1;padding:10px 12px;margin-bottom:4px;border:1px solid #2a3a4a;border-radius:8px;background:#0a1420;color:#7a96a8;font-size:.78em;line-height:1.5';
      note.innerHTML = '⏳ <strong style="color:#9ab">Set à venir</strong> — ces cartes sont visibles dans ta collection mais ne sont pas encore achetables ni utilisables en combat.';
      frag.appendChild(note);
    }
    cards.forEach(card => {
      const qty = owned[card.id] || 0;
      const hasCard = qty > 0;
      const imgSrc = url(`/assets/cards/${card.id}.jpg`);
      const rc = RARITY_COLORS[card.rarity] || '#9da7b3';
      const div = document.createElement('div');
      div.title = `${card.name} — ${card.rarity}`;
      div.style.cssText = `
        border-radius:10px;
        border:1px solid ${hasCard ? rc : '#0e2a1f'};
        background:#04060a;
        overflow:hidden;
        display:flex;
        flex-direction:column;
        align-items:center;
        cursor:pointer;
        transition:transform .18s,box-shadow .18s;
        position:relative;
        ${hasCard ? `box-shadow:0 0 12px ${rc}44;` : 'opacity:.45;filter:grayscale(1);'}
      `;
      div.addEventListener('mouseenter', () => { div.style.transform='translateY(-3px)'; div.style.boxShadow=hasCard?`0 6px 20px ${rc}66`:''; });
      div.addEventListener('mouseleave', () => { div.style.transform=''; div.style.boxShadow=hasCard?`0 0 12px ${rc}44`:''; });
      div.addEventListener('click', () => openCardModal(card, qty));
      if (hasCard) {
        div.innerHTML = `
          <img src="${imgSrc}" alt="${card.name}"
            style="width:100%;aspect-ratio:2/3;object-fit:contain;background:#060c10;"
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
          <div style="display:none;flex-direction:column;align-items:center;justify-content:center;aspect-ratio:2/3;width:100%;gap:4px;padding:8px;text-align:center">
            <span style="font-size:.75em;font-weight:700">${card.name}</span>
            <span style="font-size:.68em;color:${rc}">${card.rarity}</span>
          </div>
          <div style="padding:4px 6px;width:100%;font-size:.62em;text-align:center;color:${rc};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${card.name}</div>
          ${qty > 1 ? `<span style="position:absolute;top:4px;right:4px;background:#42b0ff;color:#000;font-size:.6em;font-weight:700;padding:1px 5px;border-radius:4px">x${qty}</span>` : ''}
        `;
      } else {
        div.innerHTML = `
          <div style="width:100%;aspect-ratio:2/3;background:#060c10;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px">
            <span style="font-size:2em">?</span>
          </div>
          <div style="padding:4px 6px;width:100%;font-size:.62em;text-align:center;color:#3a6655;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${card.name}</div>
        `;
      }
      frag.appendChild(div);
    });
    gridEl.appendChild(frag);
  }

  el.querySelectorAll('.btn-set').forEach(b => {
    b.addEventListener('click', () => { activeSet = b.dataset.set; updateBtns(); renderSet(activeSet); });
  });
  updateBtns();
  await renderSet(activeSet);
}
