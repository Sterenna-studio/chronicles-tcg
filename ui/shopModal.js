// ui/shopModal.js
import { loadPackTypes } from '../data/packsRepo.js';
import { getClient, getUser } from '../logic/supaRaw.js';
import { url } from '../logic/paths.js';

export async function openShopModal({ onBought } = {}) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:10000;display:grid;place-items:center;padding:20px';
  const modal = document.createElement('div');
  modal.style.cssText = 'width:min(1100px,95vw);max-height:90vh;overflow:auto;background:#070d14;border:1px solid #0e2a1f;border-radius:16px;color:#c8ffe8;display:flex;flex-direction:column;';
  modal.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #0e2a1f;flex-shrink:0">
      <div style="font-weight:700;letter-spacing:.08em">◈ BOUTIQUE</div>
      <button id="shop-close" style="background:transparent;border:1px solid #ff2d4e;color:#ff2d4e;padding:3px 10px;cursor:pointer;font-family:inherit;font-size:.8em">Fermer</button>
    </div>
    <div id="shop-msg" style="padding:8px 18px;min-height:24px;flex-shrink:0"></div>
    <div id="shop-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;padding:18px;overflow-y:auto"></div>
  `;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  modal.querySelector('#shop-close').addEventListener('click', close);

  const msgEl = modal.querySelector('#shop-msg');
  const gridEl = modal.querySelector('#shop-grid');
  const showMsg = (txt, color='#42b0ff') => {
    msgEl.innerHTML = `<span style="color:${color}">${txt}</span>`;
    setTimeout(() => { if (document.body.contains(overlay)) msgEl.innerHTML=''; }, 2500);
  };

  let packs;
  try { packs = await loadPackTypes(); }
  catch(e) { gridEl.innerHTML='<div style="color:#ff8a8a;padding:16px">Erreur chargement boutique.</div>'; return; }
  if (!packs.length) { gridEl.innerHTML='<div style="padding:16px;opacity:.7">Aucun article disponible.</div>'; return; }

  async function renderGrid() {
    const sb = await getClient();
    const user = await getUser();
    const { data: pl } = await sb.from('players').select('gold').eq('id', user.id).single();
    const gold = pl?.gold || 0;
    const ubGold = document.getElementById('ub-gold');
    if (ubGold) ubGold.textContent = gold;
    gridEl.innerHTML = '';
    packs.forEach(p => {
      const price = p.price ?? 100;
      const canBuy = gold >= price;
      const imgSrc = url(`/assets/packs/${p.image_name || 'set01.jpg'}`);
      const card = document.createElement('div');
      card.style.cssText = 'background:#04060a;border:1px solid #0e2a1f;border-radius:12px;overflow:hidden;display:flex;flex-direction:column;';
      card.innerHTML = `
        <div style="width:100%;aspect-ratio:3/4;background:#060c10;display:flex;align-items:center;justify-content:center;overflow:hidden;">
          <img src="${imgSrc}" alt="${p.name}" style="max-width:100%;max-height:100%;object-fit:contain;" onerror="this.style.display='none'">
        </div>
        <div style="padding:12px;flex:1;display:flex;flex-direction:column;gap:6px">
          <div style="font-weight:700">${p.name}</div>
          <div style="font-size:.82em;color:#6fa694">${p.card_count||'?'} cartes · Set ${p.set_id||'?'}</div>
          <div style="font-size:.78em;color:#3a6655">${p.description||''}</div>
          <div style="margin-top:auto;display:flex;align-items:center;justify-content:space-between;padding-top:8px">
            <span style="font-weight:700">🪙 ${price}</span>
            <button class="buy-btn" data-id="${p.id}" data-price="${price}" ${canBuy?'':'disabled'}
              style="background:${canBuy?'transparent':'#0e2a1f'};border:1px solid ${canBuy?'#00f5c4':'#3a6655'};color:${canBuy?'#00f5c4':'#3a6655'};padding:5px 12px;cursor:${canBuy?'pointer':'default'};font-family:inherit;font-size:.8em">
              ${canBuy?'Acheter':'Or insuffisant'}
            </button>
          </div>
        </div>
      `;
      gridEl.appendChild(card);
    });
    gridEl.querySelectorAll('.buy-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const packId = btn.dataset.id;
        const price = Number(btn.dataset.price);
        btn.disabled = true;
        try {
          const sb = await getClient();
          const user = await getUser();
          const { data: pl } = await sb.from('players').select('gold').eq('id', user.id).single();
          const currentGold = pl?.gold || 0;
          if (currentGold < price) { showMsg('Or insuffisant !', '#ff8a8a'); btn.disabled=false; return; }
          const newGold = currentGold - price;
          await sb.from('players').update({ gold: newGold }).eq('id', user.id);
          const { data: row } = await sb.from('player_packs').select('quantity').eq('player_id', user.id).eq('pack_type_id', packId).maybeSingle();
          const qty = (row?.quantity||0)+1;
          await sb.from('player_packs').upsert({ player_id: user.id, pack_type_id: packId, quantity: qty }, { onConflict:'player_id,pack_type_id' });
          if (typeof onBought === 'function') await onBought();
          showMsg(`✅ Pack acheté ! Il reste 🪙 ${newGold}`, '#22c55e');
          await renderGrid();
        } catch(err) {
          console.error(err);
          showMsg("Erreur lors de l'achat.", '#ff8a8a');
          btn.disabled = false;
        }
      });
    });
  }
  await renderGrid();
}
