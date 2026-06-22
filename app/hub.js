// app/hub.js — logique Bridge (extrait de l'ancien inline index.html)
import { getClient, getUser } from '../logic/supaRaw.js';
import { initPlayer, getDisplayName } from '../data/supabaseData.js';
import { loadPlayerPacks, loadPackTypes } from '../data/packsRepo.js';
import { openOpeningOverlay } from '../ui/openingOverlay.js';
import { claimDailyReward } from '../logic/daily.js';
import { boot, navigate } from './router.js';

// ── CLOCK ─────────────────────────────────────────────────────
const pad = n => String(n).padStart(2, '0');
function tickClock() {
  const now = new Date();
  document.getElementById('tb-clock').textContent =
    pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
}
tickClock();
setInterval(tickClock, 1000);

// ── SHOP ──────────────────────────────────────────────────────
const shopList = document.getElementById('shop-list');
const shopMsg  = document.getElementById('shop-msg');

function showMsg(txt, color = '#42b0ff') {
  shopMsg.innerHTML = `<span style="color:${color}">${txt}</span>`;
  setTimeout(() => { if (shopMsg) shopMsg.innerHTML = ''; }, 2500);
}

export async function renderShop() {
  try {
    const sb   = await getClient();
    const user = await getUser();
    if (!user) {
      shopList.innerHTML = '<div style="padding:12px;font-size:.72em;opacity:.6">Non connecté</div>';
      return;
    }
    const [packs, { data: pl }] = await Promise.all([
      loadPackTypes(),
      sb.from('tcg_players').select('chronicles').eq('id', user.id).single()
    ]);
    const chronicles = pl?.chronicles ?? 0;
    const ubEl = document.getElementById('ub-chronicles');
    if (ubEl) ubEl.textContent = chronicles;
    if (!packs.length) {
      shopList.innerHTML = '<div style="padding:12px;font-size:.72em;opacity:.6">Aucun article</div>';
      return;
    }
    shopList.innerHTML = '';
    packs.forEach(p => {
      const price  = p.price ?? 100;
      const canBuy = chronicles >= price;
      const imgSrc = `./assets/packs/${p.image_name || 'set01.jpg'}`;
      const item   = document.createElement('div');
      item.className = 'shop-item';
      item.innerHTML = `
        <div class="shop-item-img"><img src="${imgSrc}" alt="${p.name}" onerror="this.style.display='none'"></div>
        <div class="shop-item-body">
          <div class="shop-item-name">${p.name}</div>
          <div class="shop-item-sub">${p.card_count || '?'} cartes · Set ${p.set_id || '?'}</div>
          <div class="shop-item-footer">
            <span style="font-weight:700">✦ ${price}</span>
            <button class="buy-btn" data-id="${p.id}" data-price="${price}" ${canBuy ? '' : 'disabled'}>
              ${canBuy ? 'Acheter' : 'Chronicles insuffisants'}
            </button>
          </div>
        </div>
      `;
      shopList.appendChild(item);
    });
    shopList.querySelectorAll('.buy-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const packId = btn.dataset.id;
        const price  = Number(btn.dataset.price);
        btn.disabled = true;
        try {
          const sb2   = await getClient();
          const user2 = await getUser();
          const { data: pl2 } = await sb2.from('tcg_players').select('chronicles').eq('id', user2.id).single();
          const cur = pl2?.chronicles || 0;
          if (cur < price) { showMsg('Chronicles insuffisants !', '#ff8a8a'); btn.disabled = false; return; }
          await sb2.from('tcg_players').update({ chronicles: cur - price }).eq('id', user2.id);
          const { data: row } = await sb2.from('tcg_player_packs')
            .select('quantity').eq('player_id', user2.id).eq('pack_type_id', packId).maybeSingle();
          const qty = (row?.quantity || 0) + 1;
          await sb2.from('tcg_player_packs').upsert(
            { player_id: user2.id, pack_type_id: packId, quantity: qty },
            { onConflict: 'player_id,pack_type_id' }
          );
          showMsg(`✅ Pack acheté ! ✦ ${cur - price} restants`, '#22c55e');
          await refreshHub();
          await renderShop();
        } catch (err) {
          console.error(err);
          showMsg('Erreur achat', '#ff8a8a');
          btn.disabled = false;
        }
      });
    });
  } catch (e) {
    console.warn('[shop]', e);
    shopList.innerHTML = '<div style="padding:12px;color:#ff8a8a;font-size:.72em">Erreur boutique</div>';
  }
}

// ── HUB ───────────────────────────────────────────────────────
async function fetchTotalCards(sb, user) {
  const { data, error } = await sb.from('tcg_player_cards').select('quantity').eq('user_id', user.id);
  if (error) { console.warn('[hub] tcg_player_cards', error); return 0; }
  return (data || []).reduce((s, r) => s + (r.quantity || 0), 0);
}

export async function refreshHub() {
  try {
    const sb   = await getClient();
    const user = await getUser();
    if (!user) return;
    const [totalCards, playerPacks, { data: pl }] = await Promise.all([
      fetchTotalCards(sb, user),
      loadPlayerPacks(),
      sb.from('tcg_players').select('chronicles').eq('id', user.id).single()
    ]);
    const totalPacks = playerPacks.reduce((s, p) => s + (p.quantity || 0), 0);
    const chronicles = pl?.chronicles ?? 0;
    document.getElementById('stat-chronicles').textContent = chronicles;
    document.getElementById('stat-cards').textContent      = totalCards;
    document.getElementById('stat-packs').textContent      = totalPacks;
    const ubEl = document.getElementById('ub-chronicles');
    if (ubEl) ubEl.textContent = chronicles;
    renderBoosters(playerPacks);
  } catch (e) {
    console.warn('[hub] refresh', e);
  }
}

function renderBoosters(packs) {
  const grid    = document.getElementById('boosters-grid');
  const countEl = document.getElementById('boosters-count');
  const owned   = (packs || []).filter(b => b.quantity > 0);
  countEl.textContent = owned.reduce((s, b) => s + b.quantity, 0);
  if (!owned.length) { grid.innerHTML = '<span class="no-boosters">Aucun booster en stock</span>'; return; }
  grid.innerHTML = '';
  owned.forEach(b => {
    const imgFile = b.image_name || 'set01.jpg';
    const img     = './assets/packs/' + imgFile;
    const el      = document.createElement('div');
    el.className  = 'booster-thumb';
    el.title      = (b.name || b.id) + ' x' + b.quantity;
    el.innerHTML  = `
      <div class="booster-img"><img src="${img}" alt="${b.name || b.id}"></div>
      <span class="booster-badge">x${b.quantity}</span>
      <div class="booster-name">${b.name || b.id}</div>
    `;
    el.addEventListener('click', () => openOpeningOverlay({
      packTypeId: b.pack_type_id ?? b.id,
      setId:      b.set_id || b.id,
      packImage:  img,
      onDone:     async () => { await refreshHub(); await renderShop(); }
    }));
    grid.appendChild(el);
  });
}

// ── INIT ──────────────────────────────────────────────────────
async function init() {
  try {
    const sb   = await getClient();
    const user = await getUser();
    if (!user) { document.getElementById('tb-name').textContent = '???'; return; }
    await initPlayer(sb, user);
    document.getElementById('tb-name').textContent = getDisplayName();
    // Daily reward — fire & forget, ne bloque pas le rendu
    claimDailyReward(sb, user.id)
      .then(({ rewarded }) => { if (rewarded) refreshHub(); })
      .catch(e => console.warn('[daily]', e));
    await refreshHub();
    await renderShop();
  } catch (e) {
    console.warn('[hub] init', e);
    renderBoosters([]);
  }
}

// ── EVENT LISTENERS ───────────────────────────────────────────
document.getElementById('btn-collection').addEventListener('click', () => {
  document.querySelector('.shell').style.display = 'none';
  document.getElementById('app-root').style.display = 'block';
  navigate('#/collection');
});
document.getElementById('card-collection').addEventListener('click', () => {
  document.querySelector('.shell').style.display = 'none';
  document.getElementById('app-root').style.display = 'block';
  navigate('#/collection');
});
document.getElementById('tb-nav-cig').addEventListener('click', () =>
  window.location.href = './pages/cig/index.html'
);
document.getElementById('btn-logout').addEventListener('click', async () => {
  try { const sb = await getClient(); await sb.auth.signOut(); } catch (e) {}
  location.reload();
});

boot();
init();
