// ui/shopModal.js
import { loadPackTypes } from '../data/packsRepo.js';
import { getClient, getUser } from '../logic/supaRaw.js';
import { url } from '../logic/paths.js';

export async function openShopModal({ onBought } = {}) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.72);z-index:10000;display:grid;place-items:center;padding:20px';
  const modal = document.createElement('div');
  modal.style.cssText = 'width:min(1100px,95vw);max-height:90vh;overflow:auto;background:#070d14;border:1px solid #0e2a1f;border-radius:16px;box-shadow:0 20px 80px rgba(0,0,0,.55);color:#c8ffe8';
  modal.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #0e2a1f">
      <div style="font-weight:700;letter-spacing:.08em">BOUTIQUE</div>
      <button id="shop-close" class="btn-nav">Fermer</button>
    </div>
    <div id="shop-msg" style="padding:10px 18px;min-height:24px"></div>
    <div id="shop-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px;padding:18px"></div>
  `;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  modal.querySelector('#shop-close').addEventListener('click', close);

  const msgEl = modal.querySelector('#shop-msg');
  const gridEl = modal.querySelector('#shop-grid');
  const showMsg = (txt, color = '#42b0ff') => {
    msgEl.innerHTML = `<span style="color:${color}">${txt}</span>`;
    setTimeout(() => { if (document.body.contains(overlay)) msgEl.innerHTML = ''; }, 2500);
  };

  let packs;
  try {
    packs = await loadPackTypes();
  } catch (e) {
    gridEl.innerHTML = '<div style="color:#ff8a8a">Erreur chargement boutique.</div>';
    return;
  }

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
      const imgSrc = url(`/assets/packs/${p.image_name}?v=cyber`);
      const card = document.createElement('div');
      card.style.cssText = 'background:#04060a;border:1px solid #0e2a1f;border-radius:12px;overflow:hidden';
      card.innerHTML = `
        <div style="height:180px;background:url('${imgSrc}') center/cover no-repeat"></div>
        <div style="padding:12px">
          <div style="font-weight:700">${p.name}</div>
          <div style="font-size:.85em;color:#6fa694;margin-top:4px">${p.card_count} cartes · Set ${p.set_id || '?'}</div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:10px">
            <span style="font-weight:700">🪙 ${price}</span>
            <button class="btn-nav buy-btn" data-id="${p.id}" data-price="${price}" ${canBuy ? '' : 'disabled'}>${canBuy ? 'Acheter' : 'Or insuffisant'}</button>
          </div>
        </div>
      `;
      gridEl.appendChild(card);
    });

    gridEl.querySelectorAll('.buy-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const sb = await getClient();
        const user = await getUser();
        const packId = btn.dataset.id;
        const price = Number(btn.dataset.price);
        btn.disabled = true;
        try {
          const { data: pl } = await sb.from('players').select('gold').eq('id', user.id).single();
          const currentGold = pl?.gold || 0;
          if (currentGold < price) {
            showMsg('Or insuffisant !', '#ff8a8a');
            btn.disabled = false;
            return;
          }
          const newGold = currentGold - price;
          const { error: goldErr } = await sb.from('players').update({ gold: newGold }).eq('id', user.id);
          if (goldErr) throw goldErr;
          const { data: row } = await sb.from('player_packs').select('quantity').eq('player_id', user.id).eq('pack_type_id', packId).maybeSingle();
          const qty = (row?.quantity || 0) + 1;
          const { error: packErr } = await sb.from('player_packs').upsert({ player_id: user.id, pack_type_id: packId, quantity: qty }, { onConflict: 'player_id,pack_type_id' });
          if (packErr) throw packErr;
          if (ubGold) ubGold.textContent = newGold;
          showMsg(`✅ Pack acheté ! Il reste 🪙 ${newGold}`, '#22c55e');
          if (typeof onBought === 'function') await onBought();
          await renderGrid();
        } catch (err) {
          console.error(err);
          showMsg('Erreur lors de l\'achat.', '#ff8a8a');
          btn.disabled = false;
        }
      });
    });
  }

  await renderGrid();
}
