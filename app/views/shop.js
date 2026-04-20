// app/views/shop.js — rework complet
import { loadPackTypes } from '../../data/packsRepo.js';
import { getClient, getUser } from '../../logic/supaRaw.js';
import { state, set } from '../state.js';
import { url } from '../../logic/paths.js';

export async function renderShop(root) {
  const el = document.createElement('div');
  el.className = 'panel';
  el.innerHTML = `
    <div class="h-section">🛒 Boutique</div>
    <div id="shop-msg" style="padding:8px 16px;min-height:28px;"></div>
    <div id="shop-grid" class="shop-grid">Chargement...</div>
  `;
  root.appendChild(el);

  const msgEl = el.querySelector('#shop-msg');
  const gridEl = el.querySelector('#shop-grid');

  function showMsg(txt, color = '#42b0ff') {
    msgEl.innerHTML = `<span style="color:${color}">${txt}</span>`;
    setTimeout(() => { msgEl.innerHTML = ''; }, 3000);
  }

  let packs;
  try {
    packs = await loadPackTypes();
  } catch (e) {
    gridEl.innerHTML = `<div style="color:#ff8a8a">Erreur chargement boutique.</div>`;
    return;
  }

  if (!packs.length) {
    gridEl.innerHTML = `<div style="opacity:.7">Aucun article disponible pour l'instant.</div>`;
    return;
  }

  function renderGrid() {
    const gold = state.gold || 0;
    gridEl.innerHTML = '';
    const frag = document.createDocumentFragment();
    packs.forEach(p => {
      const price = p.price || 100;
      const canBuy = gold >= price;
      const imgSrc = url(`/assets/packs/${p.image_name}?v=cyber`);
      const card = document.createElement('div');
      card.className = 'pack-card';
      card.innerHTML = `
        <div class="thumb" style="background-image:url('${imgSrc}')"></div>
        <div class="body">
          <div style="font-weight:700;font-size:1.05em">${p.name}</div>
          <div style="color:var(--muted);font-size:.9em">${p.card_count} cartes · Set ${p.set_id || '?'}</div>
          <div style="color:var(--muted);font-size:.85em;margin-top:2px">${p.description || ''}</div>
          <div style="margin-top:8px;display:flex;align-items:center;justify-content:space-between">
            <span style="font-weight:700;font-size:1.1em">🪙 ${price}</span>
            <button class="btn btn-buy" data-id="${p.id}" data-price="${price}" ${canBuy ? '' : 'disabled'}
              style="padding:8px 14px;border-radius:8px">
              ${canBuy ? 'Acheter' : 'Or insuffisant'}
            </button>
          </div>
        </div>
      `;
      frag.appendChild(card);
    });
    gridEl.appendChild(frag);

    gridEl.querySelectorAll('.btn-buy').forEach(btn => {
      btn.addEventListener('click', async () => {
        const packId = btn.dataset.id;
        const price = Number(btn.dataset.price);
        btn.disabled = true;
        btn.textContent = '...';
        try {
          const sb = await getClient();
          const user = await getUser();
          // Débit gold
          const { data: pl } = await sb.from('players').select('gold').eq('id', user.id).single();
          const currentGold = pl?.gold || 0;
          if (currentGold < price) { showMsg('Or insuffisant !', '#ff8a8a'); return; }
          const newGold = currentGold - price;
          await sb.from('players').update({ gold: newGold }).eq('id', user.id);
          // Incrément pack
          const { data: row } = await sb.from('player_packs').select('quantity')
            .eq('player_id', user.id).eq('pack_type_id', packId).maybeSingle();
          const qty = (row?.quantity || 0) + 1;
          await sb.from('player_packs').upsert(
            { player_id: user.id, pack_type_id: packId, quantity: qty },
            { onConflict: 'player_id,pack_type_id' }
          );
          // Update state
          set({ gold: newGold });
          // Update topbar
          const ubGold = document.getElementById('ub-gold');
          if (ubGold) ubGold.textContent = newGold;
          showMsg(`✅ Pack acheté ! Il reste 🪙 ${newGold}`, '#22c55e');
          renderGrid();
        } catch (err) {
          console.error(err);
          showMsg('Erreur lors de l\'achat.', '#ff8a8a');
          btn.disabled = false;
          btn.textContent = 'Acheter';
        }
      });
    });
  }

  renderGrid();
}
