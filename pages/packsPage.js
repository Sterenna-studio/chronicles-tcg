// pages/packsPage.js — v4.0.0
// Full packs page: header + owned pack grid + opening flow
// Fixes: correct import paths, styled empty state, reload on tcg:refresh
import { getClient, getUser }  from '../logic/supaRaw.js?v=3';
import { getCachedPlayer }     from '../data/supabaseData.js?v=3';
import { runOpeningFlow }      from './openingRenderer.js?v=3';

const CSS = `
.packs-page {
  color: #dfe;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 24px 16px 64px;
}
.packs-header {
  width: 100%;
  max-width: 960px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.packs-title {
  font-size: 20px;
  font-weight: 900;
  color: #c8f0d0;
  letter-spacing: .4px;
}
.packs-count {
  font-size: 13px;
  color: #5a8a7a;
  background: #0b1810;
  border: 1px solid #1e3a22;
  border-radius: 999px;
  padding: 4px 14px;
}
.packs-hint {
  font-size: 12px;
  color: #4a7a6a;
  width: 100%;
  max-width: 960px;
  text-align: center;
}
.packs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 18px;
  width: 100%;
  max-width: 960px;
}
.pack-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.pack-img {
  width: 100%;
  aspect-ratio: 260 / 340;
  object-fit: cover;
  border-radius: 14px;
  border: 1px solid #1e3a30;
  display: block;
  animation: packFloat 3.2s ease-in-out infinite;
  transition: filter .15s, outline .1s;
  box-shadow: 0 8px 24px rgba(0,0,0,.5);
}
.pack-tile.active .pack-img,
.pack-img:hover {
  filter: brightness(1.1);
  outline: 2px solid #7ecf90;
  outline-offset: 3px;
}
@keyframes packFloat {
  0%   { transform: translateY(0); }
  50%  { transform: translateY(-6px); }
  100% { transform: translateY(0); }
}
.pack-label {
  font-size: 12px;
  font-weight: 700;
  color: #8ab;
  text-transform: uppercase;
  letter-spacing: .4px;
}
.packs-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 48px 24px;
  color: #4a7a6a;
  font-size: 14px;
  text-align: center;
}
.packs-empty-icon { font-size: 48px; opacity: .5; }
.packs-empty a {
  color: #7ecf90;
  font-weight: 700;
  text-decoration: none;
  border: 1px solid #2a5e34;
  background: #0d2218;
  padding: 8px 20px;
  border-radius: 10px;
  transition: filter .15s;
}
.packs-empty a:hover { filter: brightness(1.15); }
`;

export async function render(root) {
  if (!document.getElementById('packs-page-style')) {
    const s = document.createElement('style');
    s.id = 'packs-page-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  root.innerHTML = '';
  const page = document.createElement('div');
  page.className = 'packs-page';

  // ── Header ──────────────────────────────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'packs-header';
  header.innerHTML = `
    <div class="packs-title">🃏 Mes Boosters</div>
    <div class="packs-count" id="packs-total">Chargement…</div>
  `;
  page.appendChild(header);

  const hint = document.createElement('div');
  hint.className = 'packs-hint';
  hint.textContent = 'Maintiens clic (ou Entrée) pour ouvrir un booster. Flèches ← → pour naviguer.';
  page.appendChild(hint);

  const grid = document.createElement('div');
  grid.className = 'packs-grid';
  grid.id = 'packs-grid';
  page.appendChild(grid);

  root.appendChild(page);

  // ── Load & render ────────────────────────────────────────────────────────────
  await _loadAndRender(root, grid, header);

  // Reload after pack opening
  const onRefresh = () => render(root);
  window.addEventListener('tcg:refresh', onRefresh, { once: true });
  root.addEventListener('removed', () =>
    window.removeEventListener('tcg:refresh', onRefresh)
  );
}

async function _loadAndRender(root, grid, header) {
  const sb     = await getClient();
  const player = getCachedPlayer();
  const user   = await getUser();
  if (!player || !user) { _renderEmpty(grid, true); return; }

  const { data: owned, error } = await sb
    .from('tcg_player_packs')
    .select('pack_type_id, quantity')
    .eq('player_id', player.id)
    .gt('quantity', 0);

  if (error) {
    grid.innerHTML = `<div style="color:#f99;padding:16px">⚠️ Erreur : ${error.message}</div>`;
    return;
  }

  // Total count chip
  const totalCount = (owned || []).reduce((acc, r) => acc + (r.quantity || 0), 0);
  const chip = header.querySelector('#packs-total');
  if (chip) chip.textContent = `${totalCount} booster${totalCount > 1 ? 's' : ''}`;

  if (!owned || !owned.length) { _renderEmpty(grid, false); return; }

  // Fetch pack type metadata
  const ids = [...new Set(owned.map(r => r.pack_type_id))];
  const { data: types } = await sb
    .from('pack_types')
    .select('id, name, set_id, image_name')
    .in('id', ids);
  const typeMap = new Map((types || []).map(t => [t.id, t]));

  // Build & shuffle tiles (one per pack unit)
  const tiles = [];
  for (const row of owned) {
    const t = typeMap.get(row.pack_type_id);
    if (!t) continue;
    const imgPath = t.image_name
      ? `/TCG/assets/packs/${t.image_name}`
      : `/TCG/assets/packs/${t.set_id}-default.jpg`;
    for (let i = 0; i < Math.max(0, row.quantity | 0); i++) {
      tiles.push({ img: imgPath, setId: t.set_id, packTypeId: t.id, name: t.name || t.set_id });
    }
  }
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }

  // ── Render tiles ─────────────────────────────────────────────────────────────
  grid.innerHTML = '';
  let activeIdx = 0;

  tiles.forEach((t, idx) => {
    const tile = document.createElement('div');
    tile.className = 'pack-tile';
    tile.dataset.index = String(idx);
    tile.innerHTML = `
      <img class="pack-img"
           src="${t.img}"
           alt="${t.name}"
           style="animation-delay:${(Math.random() * 0.8).toFixed(2)}s"
           onerror="this.src='/TCG/assets/packs/default.jpg'"/>
      <div class="pack-label">${t.name}</div>
    `;

    let holdTimer = null;
    const startOpen = () => {
      if (holdTimer) return;
      tile.querySelector('.pack-img').style.filter = 'brightness(1.35) drop-shadow(0 0 12px #7ecf90)';
      holdTimer = setTimeout(() => {
        holdTimer = null;
        runOpeningFlow(document.body, { setId: t.setId, packTypeId: t.packTypeId });
      }, 900);
    };
    const cancelOpen = () => {
      if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
      tile.querySelector('.pack-img').style.filter = '';
    };
    tile.addEventListener('pointerdown',  startOpen);
    tile.addEventListener('pointerup',    cancelOpen);
    tile.addEventListener('pointercancel', cancelOpen);
    grid.appendChild(tile);
  });

  // ── Keyboard nav ─────────────────────────────────────────────────────────────
  const allTiles = () => Array.from(grid.querySelectorAll('.pack-tile'));
  const setActive = (i) => {
    const arr = allTiles();
    if (!arr.length) return;
    activeIdx = (i + arr.length) % arr.length;
    arr.forEach(el => el.classList.remove('active'));
    arr[activeIdx].classList.add('active');
    arr[activeIdx].scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  setActive(0);

  let kbHold = null;
  const onKey = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); setActive(activeIdx + 1); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); setActive(activeIdx - 1); }
    if (e.key === 'Enter' && !kbHold) {
      const tile = tiles[activeIdx];
      if (!tile) return;
      kbHold = setTimeout(() => {
        kbHold = null;
        runOpeningFlow(document.body, { setId: tile.setId, packTypeId: tile.packTypeId });
      }, 900);
    }
  };
  const onKeyUp = (e) => {
    if (e.key === 'Enter' && kbHold) { clearTimeout(kbHold); kbHold = null; }
  };
  document.addEventListener('keydown', onKey);
  document.addEventListener('keyup',   onKeyUp);
  root.addEventListener('removed', () => {
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('keyup',   onKeyUp);
  });
}

function _renderEmpty(grid, notLoggedIn) {
  grid.innerHTML = '';
  const el = document.createElement('div');
  el.className = 'packs-empty';
  el.innerHTML = notLoggedIn
    ? `<div class="packs-empty-icon">🔐</div><div>Connecte-toi pour voir tes boosters.</div>`
    : `
        <div class="packs-empty-icon">📦</div>
        <div>Tu n'as aucun booster pour l'instant.</div>
        <a href="#/shop">🛒 Aller à la boutique</a>
      `;
  grid.appendChild(el);
}
