// pages/shopPage.js — v5.0.0 (chronicles)
import { getClient, getUser } from '../logic/supaRaw.js';
import { getCachedPlayer, initPlayer } from '../data/supabaseData.js';

const CHR = '◆'; // symbole Chronicles

export async function render(root) {
  root.innerHTML = `
    <style>
      .shop-wrap { color:#dfe; display:flex; flex-direction:column; align-items:center; }
      .shop-header { width:100%; max-width:1120px; display:flex; justify-content:space-between; align-items:center; padding:8px 4px 12px; }
      .shop-title { font-weight:800; letter-spacing:.4px; color:#cfe; }
      .chr-chip { display:inline-flex; align-items:center; gap:8px; border:1px solid #a07820; background:linear-gradient(180deg,#1a1000,#120e00); color:#f0c060; padding:6px 14px; border-radius:999px; font-weight:700; letter-spacing:.05em; }
      .chr-chip .ico { font-size:14px; filter:drop-shadow(0 0 6px rgba(255,200,60,.4)); }
      .shop-container { width:100%; max-width:1120px; margin-inline:auto; }
      .shop-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(210px, 1fr)); gap:16px; align-items:start; }
      .shop-card { border:1px solid #223; background:#0b0f14; border-radius:14px; overflow:hidden; transition:transform .15s ease, filter .15s ease; }
      .shop-img  { width:100%; aspect-ratio: 260 / 340; object-fit:cover; display:block; }
      .shop-card:hover { transform:translateY(-2px); filter:brightness(1.05); }
      .shop-body { padding:10px; display:flex; justify-content:space-between; align-items:center; gap:8px; }
      .shop-name { font-weight:700; font-size:14px; color:#cfe; }
      .shop-price { font-family:monospace; color:#f0c060; font-size:13px; }
      .btn-buy { border:1px solid #a07820; background:#1a1200; color:#f0c060; padding:6px 12px; border-radius:8px; cursor:pointer; font-size:12px; transition:.15s; }
      .btn-buy:hover:not([disabled]) { background:#2a1e00; }
      .btn-buy[disabled] { opacity:.45; cursor:not-allowed; }
      .shop-warn { color:#faa; font-size:11px; margin:0 10px 8px; display:none; }
    </style>
    <section class="shop-wrap">
      <div class="shop-header">
        <div class="shop-title">Boutique</div>
        <div class="chr-chip"><span class="ico">${CHR}</span><span id="chr-val">0</span> Chronicles</div>
      </div>
      <div class="shop-container">
        <div id="shop-grid" class="shop-grid"></div>
      </div>
    </section>
  `;

  const sb   = await getClient();
  const user = await getUser();
  let player = getCachedPlayer();
  if (!player && user) player = await initPlayer(sb, user);

  const chrVal  = root.querySelector('#chr-val');
  const setChr  = v => { chrVal.textContent = Number(v | 0).toLocaleString('fr-FR'); };
  setChr(player?.chronicles ?? 0);

  // Chargement des types de packs
  const { data: types, error } = await sb
    .from('pack_types')
    .select('id, name, set_id, price, image_name')
    .order('price', { ascending: true });

  const grid = root.querySelector('#shop-grid');
  if (error) {
    grid.innerHTML = `<div style="color:#faa;padding:12px">Erreur boutique : ${error.message}</div>`;
    return;
  }

  grid.innerHTML = '';
  types.forEach(t => {
    const card = document.createElement('div');
    card.className = 'shop-card';
    const imgUrl = t.image_name
      ? `/TCG/assets/packs/${t.image_name}`
      : `/TCG/assets/packs/${t.set_id}-default.jpg`;
    card.innerHTML = `
      <img class="shop-img" src="${imgUrl}" alt="${t.name}" loading="lazy">
      <div class="shop-body">
        <div>
          <div class="shop-name">${t.name}</div>
          <div class="shop-price">${CHR} ${t.price.toLocaleString('fr-FR')}</div>
        </div>
        <button class="btn-buy" data-id="${t.id}" data-price="${t.price}">
          Acheter
        </button>
      </div>
      <div class="shop-warn"></div>
    `;

    const btn  = card.querySelector('.btn-buy');
    const warn = card.querySelector('.shop-warn');

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      warn.style.display = 'none';
      try {
        const { data: res, error: rpcErr } = await sb
          .rpc('buy_pack_with_chronicles', { p_pack_type_id: t.id });

        if (rpcErr) throw new Error(rpcErr.message);
        if (!res?.ok) {
          const msg = res?.error === 'Chronicles insuffisants'
            ? `${CHR} insuffisants (tu as ${res.balance}, prix : ${res.price})`
            : (res?.error || 'Achat impossible');
          warn.textContent = msg;
          warn.style.display = 'block';
          return;
        }

        const newChr = res.chronicles_remaining;
        player = { ...player, chronicles: newChr };
        setChr(newChr);
        window.dispatchEvent(new CustomEvent('tcg:chronicles', { detail: { chronicles: newChr } }));
        if (window.tcgForceRefresh) await window.tcgForceRefresh();

      } catch (e) {
        warn.textContent = 'Erreur : ' + (e?.message || e);
        warn.style.display = 'block';
      } finally {
        btn.disabled = false;
      }
    });

    grid.appendChild(card);
  });

  // Sync solde en temps réel
  const syncChr = async () => {
    const { data } = await sb.from('tcg_players').select('chronicles').eq('id', player?.id).single();
    setChr(data?.chronicles ?? 0);
  };
  window.addEventListener('tcg:chronicles', syncChr);
  root.addEventListener('removed', () => window.removeEventListener('tcg:chronicles', syncChr));
}
