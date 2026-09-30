// lab/tcg/pages/shopPage.js — v3.9.3 (compact, gold badge, guarded purchase, server-first fetch)
import { getClient } from '../../shared/supaRaw.js';
import { getCachedPlayer, refreshPlayer, updateCachedPlayer } from '../../shared/supabaseData.js';

export async function render(root){
  root.innerHTML = `
    <style>
      .shop-wrap { color:#dfe; display:flex; flex-direction:column; align-items:center; }
      .shop-header { width:100%; max-width:1120px; display:flex; justify-content:space-between; align-items:center; padding:8px 4px 12px; }
      .shop-title { font-weight:800; letter-spacing:.4px; color:#cfe; }
      .gold-chip { display:inline-flex; align-items:center; gap:8px; border:1px solid #3b2; background:linear-gradient(180deg,#0f1a10,#0b140c); color:#eaffbd; padding:6px 10px; border-radius:999px; font-weight:700; }
      .gold-chip .ico { font-size:14px; filter:drop-shadow(0 0 6px rgba(255,220,90,.35)); }
      .shop-container { width:100%; max-width:1120px; margin-inline:auto; }
      .shop-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(210px, 1fr)); gap:16px; align-items:start; }
      .shop-card { border:1px solid #223; background:#0b0f14; border-radius:14px; overflow:hidden; transition:transform .15s ease, filter .15s ease; }
      .shop-img  { width:100%; aspect-ratio: 260 / 340; object-fit:cover; display:block; }
      .shop-card:hover { transform:translateY(-2px); filter:brightness(1.05); }
      .shop-body { padding:10px; display:flex; justify-content:space-between; align-items:center; gap:8px; }
      .title { font-weight:700; font-size:14px; color:#cfe; }
      .price { font-family:monospace; color:#ffd36b; }
      .btn-buy { border:1px solid #354a73; background:#0e1624; color:#e9f3ff; padding:6px 10px; border-radius:8px; cursor:pointer; }
      .btn-buy[disabled] { opacity:.55; cursor:not-allowed; }
      .warn { color:#faa; font-size:12px; margin:6px 10px 10px; display:none; }
    </style>
    <section class="shop-wrap">
      <div class="shop-header">
        <div class="shop-title">Boutique</div>
        <div class="gold-chip" id="gold-chip"><span class="ico">⛁</span><span id="gold-val">0</span></div>
      </div>
      <div class="shop-container">
        <div id="grid" class="shop-grid"></div>
      </div>
    </section>
  `;

  const sb = await getClient();
  // server-first to avoid stale cache
  let player = await refreshPlayer();
  if (!player) player = getCachedPlayer();
  const goldVal = root.querySelector('#gold-val');
  const setGold = (v)=>{ goldVal.textContent = String(v|0); };
  setGold(player?.gold ?? 0);

  const { data: types, error } = await sb
    .from('pack_types')
    .select('id, name, set_id, price, image_name')
    .order('price', { ascending: true });
  if (error){
    root.querySelector('#grid').innerHTML = `<div class="warn" style="display:block">Erreur chargement boutique: ${error.message}</div>`;
    return;
  }

  const grid = root.querySelector('#grid');
  grid.innerHTML = '';

  types.forEach(t => {
    const card = document.createElement('div');
    card.className = 'shop-card';
    const imgUrl = t.image_name ? `/lab/shared/assets/packs/${t.image_name}` : `/lab/shared/assets/packs/${t.set_id}-default.jpg`;
    card.innerHTML = `
      <img class="shop-img" src="${imgUrl}" alt="${t.name}">
      <div class="shop-body">
        <div>
          <div class="title">${t.name}</div>
          <div class="price">${t.price} ⛁</div>
        </div>
        <div>
          <button class="btn-buy" data-id="${t.id}" data-price="${t.price}">Acheter</button>
        </div>
      </div>
      <div class="warn"></div>
    `;
    const btn = card.querySelector('.btn-buy');
    const warn = card.querySelector('.warn');
    btn.addEventListener('click', async () => {
      btn.disabled = true; warn.style.display='none'; warn.textContent='';
      try{
        player = await refreshPlayer();
        const price = Number(btn.dataset.price||0);
        if ((player?.gold||0) < price){
          warn.textContent = "Pas assez d'or.";
          warn.style.display = 'block';
          return;
        }
        await buyPack({ packTypeId: btn.dataset.id, price });
        const newGold = (player.gold - price);
        updateCachedPlayer({ gold: newGold, pack_count: (player.pack_count||0)+1 });
        setGold(newGold);
        if (window.tcgForceRefresh){ await window.tcgForceRefresh(); }
      }catch(e){
        warn.textContent = 'Achat impossible: ' + (e?.message || e);
        warn.style.display = 'block';
      }finally{
        btn.disabled = false;
      }
    });
    grid.appendChild(card);
  });

  const onGold = async ()=>{
    const p = await refreshPlayer();
    setGold(p?.gold ?? 0);
  };
  window.addEventListener('tcg:gold', onGold);
  root.addEventListener('removed', ()=>{
    window.removeEventListener('tcg:gold', onGold);
  });
}

async function buyPack({ packTypeId, price }){
  const sb = await getClient();
  const player = getCachedPlayer();

  const { data: afterDebit, error: debitErr } = await sb
    .from('players')
    .update({ gold: (player.gold - price), pack_count: (player.pack_count||0) + 1 })
    .eq('id', player.id)
    .gte('gold', price)
    .select('id, gold, pack_count')
    .single();

  if (debitErr || !afterDebit){
    throw new Error('Solde insuffisant ou erreur débit.');
  }

  const { data: existing } = await sb
    .from('player_packs')
    .select('quantity')
    .eq('player_id', player.id)
    .eq('pack_type_id', packTypeId)
    .maybeSingle();

  if (!existing){
    const { error: insErr } = await sb
      .from('player_packs')
      .insert({ player_id: player.id, pack_type_id: packTypeId, quantity: 1 });
    if (insErr) throw insErr;
  } else {
    const { error: upErr } = await sb
      .from('player_packs')
      .update({ quantity: existing.quantity + 1 })
      .eq('player_id', player.id)
      .eq('pack_type_id', packTypeId);
    if (upErr) throw upErr;
  }

  return true;
}
