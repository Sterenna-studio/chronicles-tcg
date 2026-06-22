// ui/shopModal.js — v3 (uses modalShell)
import { loadPackTypes } from '../data/packsRepo.js?v=3';
import { getClient, getUser } from '../logic/supaRaw.js?v=3';
import { url } from '../logic/paths.js?v=3';
import { openModalShell } from './modalShell.js?v=3';

export function openShopModal({ onBought } = {}) {
  return openModalShell({
    id:          'shop',
    title:       '◈ BOUTIQUE',
    defaultMode: 'default',
    resizable:   true,
    draggable:   true,
    render:      (content, shell) => renderShop(content, shell, { onBought }),
  });
}

async function renderShop(content, shell, { onBought }) {
  // Layout interne
  content.innerHTML = `
    <div id="shop-msg" style="padding:6px 18px;min-height:24px;flex-shrink:0;"></div>
    <div id="shop-grid" style="
      display:grid;
      grid-template-columns:repeat(auto-fill,minmax(220px,1fr));
      gap:16px;padding:18px;
    "></div>
  `;

  const msgEl  = content.querySelector('#shop-msg');
  const gridEl = content.querySelector('#shop-grid');

  const showMsg = (txt, color = '#42b0ff') => {
    msgEl.innerHTML = `<span style="color:${color}">${txt}</span>`;
    setTimeout(() => { if (msgEl.isConnected) msgEl.innerHTML = ''; }, 2500);
  };

  let packs;
  try { packs = await loadPackTypes(); }
  catch { gridEl.innerHTML = '<div style="color:#ff8a8a;padding:16px">Erreur chargement boutique.</div>'; return; }
  if (!packs.length) { gridEl.innerHTML = '<div style="padding:16px;opacity:.7">Aucun article disponible.</div>'; return; }

  async function renderGrid() {
    const sb   = await getClient();
    const user = await getUser();
    const { data: pl } = await sb.from('profiles').select('chronicles').eq('id', user.id).single();
    const chronicles = pl?.chronicles || 0;

    // Mise à jour affichage solde dans la topbar si présent
    const ubChron = document.getElementById('ub-chronicles');
    if (ubChron) ubChron.textContent = chronicles;

    gridEl.innerHTML = '';
    packs.forEach(p => {
      const price  = p.price ?? 100;
      const canBuy = chronicles >= price;
      const imgSrc = url(`/assets/packs/${p.image_name || 'set01.jpg'}`);

      const card = document.createElement('div');
      card.style.cssText = [
        'background:#04060a;border:1px solid #0e2a1f;',
        'border-radius:12px;overflow:hidden;',
        'display:flex;flex-direction:column;',
        'transition:border-color .15s;',
      ].join('');
      card.addEventListener('mouseenter', () => card.style.borderColor = '#1a5040');
      card.addEventListener('mouseleave', () => card.style.borderColor = '#0e2a1f');

      card.innerHTML = `
        <div style="width:100%;aspect-ratio:3/4;background:#060c10;display:flex;align-items:center;justify-content:center;overflow:hidden;">
          <img src="${imgSrc}" alt="${p.name}"
            style="max-width:100%;max-height:100%;object-fit:contain;"
            onerror="this.style.display='none'">
        </div>
        <div style="padding:12px;flex:1;display:flex;flex-direction:column;gap:6px;">
          <div style="font-weight:700">${p.name}</div>
          <div style="font-size:.82em;color:#6fa694">${p.card_count || '?'} cartes · Set ${p.set_id || '?'}</div>
          <div style="font-size:.78em;color:#3a6655">${p.description || ''}</div>
          <div style="margin-top:auto;display:flex;align-items:center;justify-content:space-between;padding-top:8px;">
            <span style="font-weight:700">✦ ${price}</span>
            <button class="buy-btn"
              data-id="${p.id}" data-price="${price}"
              ${canBuy ? '' : 'disabled'}
              style="
                background:${canBuy ? 'transparent' : '#0e2a1f'};
                border:1px solid ${canBuy ? '#00f5c4' : '#3a6655'};
                color:${canBuy ? '#00f5c4' : '#3a6655'};
                padding:5px 12px;cursor:${canBuy ? 'pointer' : 'default'};
                font-family:inherit;font-size:.8em;border-radius:4px;
                transition:background .12s;
              ">
              ${canBuy ? 'Acheter' : 'Chronicles insuffisants'}
            </button>
          </div>
        </div>
      `;
      gridEl.appendChild(card);
    });

    gridEl.querySelectorAll('.buy-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const packId = btn.dataset.id;
        const price  = Number(btn.dataset.price);
        btn.disabled = true;
        try {
          const sb   = await getClient();
          const user = await getUser();
          const { data: pl } = await sb.from('profiles').select('chronicles').eq('id', user.id).single();
          const current = pl?.chronicles || 0;
          if (current < price) { showMsg('Chronicles insuffisants !', '#ff8a8a'); btn.disabled = false; return; }
          // Débit chronicles
          await sb.from('profiles')
            .update({ chronicles: current - price })
            .eq('id', user.id);
          // Ajout pack inventaire
          const { data: row } = await sb.from('tcg_player_packs')
            .select('quantity').eq('player_id', user.id).eq('pack_type_id', packId).maybeSingle();
          await sb.from('tcg_player_packs').upsert(
            { player_id: user.id, pack_type_id: packId, quantity: (row?.quantity || 0) + 1 },
            { onConflict: 'player_id,pack_type_id' }
          );
          if (typeof onBought === 'function') await onBought();
          showMsg(`✅ Pack acheté ! Solde : ✦ ${current - price}`, '#22c55e');
          await renderGrid();
        } catch (err) {
          console.error(err);
          showMsg("Erreur lors de l'achat.", '#ff8a8a');
          btn.disabled = false;
        }
      });
    });
  }

  await renderGrid();
}
