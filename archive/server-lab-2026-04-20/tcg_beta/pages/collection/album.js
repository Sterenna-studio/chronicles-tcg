// pages/collection/album.js
// This module renders the album view as a simulated book with double pages.
// Each page contains six slots.  Owned cards are displayed with their artwork;
// missing cards show an empty placeholder.  Clicking on an unrevealed card
// reveals it for the first time (tracking state in localStorage).  Clicking on
// a revealed card opens a modal that displays the card in 3D with a glow
// based on rarity, along with details such as name, class, rarity and
// quantity owned.

import { getCollection, loadSetData } from '../../../shared/packsRepo.js';

// Fallback helper for computing artwork URLs.  Artworks live under
// /lab/shared/assets/artworks/SETXX/{id}.jpg where XX is the numeric part of
// the prefix.  Use this local helper to avoid importing external helpers.
function cardArtworkUrl(id) {
  const prefix = String(id).split('_')[0];
  const match = prefix.match(/(\d+)/);
  const num = match ? String(parseInt(match[1], 10)).padStart(2, '0') : '';
  const dir = num ? `SET${num}` : prefix;
  return `/lab/shared/assets/artworks/${dir}/${id}.jpg`;
}

const PER_PAGE = 6;

// Utility to persist the set of revealed cards across sessions.  Cards in this
// set have been flipped by the player at least once.  Stored as a JSON array
// under the key `tcg_revealed_cards`.  If localStorage is unavailable this
// falls back to an in‑memory set.
function loadRevealed() {
  try {
    const raw = localStorage.getItem('tcg_revealed_cards');
    return new Set(JSON.parse(raw || '[]'));
  } catch {
    return new Set();
  }
}
function saveRevealed(set) {
  try {
    localStorage.setItem('tcg_revealed_cards', JSON.stringify(Array.from(set)));
  } catch {
    /* ignore */
  }
}

/**
 * Render the album interface into the provided root element.  This function
 * manages pagination, set selection, card reveal state and card detail modals.
 * @param {HTMLElement} root The container into which the album will be rendered.
 */
export async function render(root) {
  // Determine available vertical space by subtracting the header height.
  const topbar = document.querySelector('.ui-topbar, header, .topbar, #topbar');
  const h = topbar ? topbar.offsetHeight : 64;
  document.documentElement.style.setProperty('--album-available-h', `calc(100vh - ${h}px)`);

  // Clear the root and inject album layout markup and styles.
  root.innerHTML = `
    <style>
      .album-wrap { color:#dfe; height:var(--album-available-h, 100vh); overflow:hidden; display:flex; flex-direction:column; }
      .album-head { display:flex; gap:12px; align-items:center; margin-bottom:12px; }
      .album-title { font-family:monospace; color:#8df; display:flex; align-items:center; gap:8px; }
      .v-arrows { display:flex; flex-direction:column; gap:2px; }
      .btn-mini { width:24px; height:20px; border:1px solid #335; background:#0d1620; color:#def; border-radius:6px; cursor:pointer; line-height:18px; text-align:center; }
      .spread { flex:1; display:grid; grid-template-columns: 1fr 1fr; gap:18px; align-items:stretch; perspective:1200px; min-height:0; }
      .page { height:100%; aspect-ratio: calc((3 * var(--card-ar, 0.711)) / 2); border-radius:16px; border:1px solid #234; background:linear-gradient(#0a1018,#070b11); overflow:hidden; transform-style:preserve-3d; position:relative; }
      .left  { transform:rotateY(7deg);  box-shadow:inset 12px 0 24px rgba(0,0,0,.35); }
      .right { transform:rotateY(-7deg); box-shadow:inset -12px 0 24px rgba(0,0,0,.35); }
      .grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:16px; padding:16px; box-sizing:border-box; height:100%; }
      .slot { position:relative; width:100%; aspect-ratio: var(--card-ar, 0.711); border-radius:14px; border:1px solid #234; background:#0a1018; overflow:hidden; cursor:pointer; }
      /* Ensure card artworks always fit within their slot without being
         cropped.  Use object-fit: contain so that images of varying
         dimensions are fully visible.  Add a dark background to fill
         unused space. */
      .slot img.card {
        width:100%;
        height:100%;
        object-fit: contain;
        background:#0a1018;
        filter:contrast(1.05) brightness(.98);
        border-radius:14px;
      }
      .slot.empty { display:grid; place-items:center; color:#224; cursor:default; }
      .slot .glass { position:absolute; inset:0; background:linear-gradient(120deg, rgba(255,255,255,.06), rgba(255,255,255,0) 40%, rgba(255,255,255,.08)); pointer-events:none; border-radius:14px; }
      .cover { position:relative; width:100%; height:100%; }
      .cover img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
      .cover .overlay { position:absolute; inset:0; background:linear-gradient(180deg, rgba(0,0,0,.15), rgba(0,0,0,.55)); display:flex; align-items:flex-end; padding:16px; color:#dfe; }
      .controls { text-align:center; margin-top:12px; display:flex; justify-content:center; gap:12px; }
      @media (max-width: 1100px){ .spread { grid-template-columns: 1fr; } }
      /* Card info modal */
      .card-info-modal {
        position: fixed;
        inset: 0;
        display:flex;
        align-items:center;
        justify-content:center;
        background: rgba(0,0,0,0.65);
        z-index: 1001;
      }
      .card-info-content {
        background:#0b0f14;
        border:1px solid #30363d;
        border-radius:14px;
        padding:20px;
        display:flex;
        gap:24px;
        max-width:900px;
        width:90%;
        color:#e6edf3;
      }
      .card-preview {
        width:240px;
        height:340px;
        border-radius:12px;
        /* Use contain so that the entire card artwork is visible.  Fill the
           remaining space with a dark background for contrast. */
        background-size: contain;
        background-position: center;
        background-color: #0a1018;
        animation: spinY 5s linear infinite, floatY 3s ease-in-out infinite;
      }
      .glow-common { box-shadow: 0 0 20px rgba(130,200,255,0.6); }
      .glow-rare { box-shadow: 0 0 24px rgba(94,129,255,0.65); }
      .glow-epic { box-shadow: 0 0 28px rgba(192,132,252,0.7); }
      .glow-legendary { box-shadow: 0 0 32px rgba(253,224,71,0.8); }
      .glow-mythical { box-shadow: 0 0 36px rgba(16,185,129,0.85), 0 0 56px rgba(99,102,241,0.6); }
      .card-meta { flex:1; }
      .card-meta h3 { margin:0 0 8px 0; }
      @keyframes spinY { 0% { transform: rotateY(0deg); } 100% { transform: rotateY(360deg); } }
      @keyframes floatY { 0%{ transform: translateY(0); } 50% { transform: translateY(-10px); } 100%{ transform: translateY(0); } }
    </style>
    <section class="album-wrap">
      <div class="album-head">
        <div class="album-title">
          <span style="font-size:20px; letter-spacing:2px;">BZH0</span>
          <div class="v-arrows">
            <button id="set-inc" class="btn-mini">▲</button>
            <button id="set-dec" class="btn-mini">▼</button>
          </div>
          <span id="set-num" style="font-size:20px;">1</span>
        </div>
      </div>
      <div id="spread" class="spread"></div>
      <div class="controls">
        <button id="prev" class="btn-mini">◀︎</button>
        <div id="spread-label" style="opacity:.85"></div>
        <button id="next" class="btn-mini">▶︎</button>
      </div>
    </section>
  `;

  // Compute the aspect ratio of the card back image to size the slots.
  const ratio = await getBackRatio();
  document.documentElement.style.setProperty('--card-ar', String(ratio));

  // State variables
  let setNum = 1;
  let rows = [];
  let setCards = [];
  let ownedMap = new Map();
  let spreadIndex = 0;
  const revealedSet = loadRevealed();

  const spreadEl = root.querySelector('#spread');
  const setLabel = root.querySelector('#set-num');
  const spLabel = root.querySelector('#spread-label');

  async function load() {
    // Compute setId with two‑digit padding
    const setId = 'BZH' + String(setNum).padStart(2, '0');
    // Load full set card definitions and player collection
    setCards = await loadSetData(setId);
    const ownedRows = await getCollection({ setId });
    ownedMap = new Map(ownedRows.map(r => [r.card_id, r.qty]));
    // Compose rows array from setCards preserving order
    rows = setCards.map(c => {
      return { card: c, card_id: c.id, qty: ownedMap.get(c.id) || 0 };
    });
    // Reset spread index and update labels
    spreadIndex = 0;
    setLabel.textContent = String(setNum);
    renderSpread();
  }

  function totalCardPages() {
    return Math.max(1, Math.ceil(rows.length / PER_PAGE));
  }
  function totalSpreads() {
    return 1 + Math.ceil(totalCardPages() / 2);
  }

  function renderSpread() {
    spreadEl.innerHTML = '';
    const spreads = totalSpreads();
    spLabel.textContent = `Double page ${spreadIndex + 1} / ${spreads}`;

    const left = document.createElement('div'); left.className = 'page left';
    const right = document.createElement('div'); right.className = 'page right';

    if (spreadIndex === 0) {
      // First spread: show cover on right
      left.style.visibility = 'hidden';
      right.appendChild(renderCover());
    } else {
      const leftPageNum = (spreadIndex - 1) * 2 + 1;
      const rightPageNum = leftPageNum + 1;
      left.appendChild(renderCardsPage(leftPageNum));
      right.appendChild(renderCardsPage(rightPageNum));
    }

    spreadEl.appendChild(left);
    spreadEl.appendChild(right);
  }

  function renderCover() {
    const box = document.createElement('div');
    box.className = 'cover';
    // Use the built‑in album cover from this project.  The image resides in
    // /lab/tcg_beta/assets/album.jpg on the server.
    const coverUrl = '/lab/tcg_beta/assets/album.jpg';
    box.innerHTML = `
      <img src="${coverUrl}" alt="Couverture"/>
      <div class="overlay">
        <div>
          <div style="font-size:22px;font-weight:700;">Album — BZH${String(setNum).padStart(2, '0')}</div>
          <div style="opacity:.85">Chaque page contient ${PER_PAGE} cartes.</div>
        </div>
      </div>`;
    return box;
  }

  function renderCardsPage(pageNum) {
    const start = (pageNum - 1) * PER_PAGE;
    const slice = rows.slice(start, start + PER_PAGE);
    const grid = document.createElement('div');
    grid.className = 'grid';
    for (let i = 0; i < PER_PAGE; i++) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      const item = slice[i];
      if (item) {
        // Determine whether the player owns this card
        const qty = item.qty;
        const cardId = item.card_id;
        const cardDef = item.card;
        if (qty > 0 && !revealedSet.has(cardId)) {
          // Unrevealed: show back of card with a subtle overlay and id label
          slot.innerHTML = `<img class="card" src="/lab/shared/assets/card_back.png" alt="${cardId}"/><div class="glass"></div>`;
          slot.addEventListener('click', () => {
            // Reveal the card
            revealedSet.add(cardId);
            saveRevealed(revealedSet);
            // Replace with actual card image
            slot.innerHTML = `<img class="card" src="${cardArtworkUrl(cardId)}" alt="${cardId}"/><div class="glass"></div>`;
            // Attach click handler to show details
            slot.addEventListener('click', () => showCardModal(cardDef, qty));
          }, { once: true });
        } else if (qty > 0) {
          // Revealed: show artwork
          slot.innerHTML = `<img class="card" src="${cardArtworkUrl(cardId)}" alt="${cardId}"/><div class="glass"></div>`;
          slot.addEventListener('click', () => showCardModal(cardDef, qty));
        } else {
          // Not owned: show empty slot with card id as hint
          slot.classList.add('empty');
          slot.textContent = cardId;
        }
      } else {
        slot.classList.add('empty');
        slot.textContent = '—';
      }
      grid.appendChild(slot);
    }
    return grid;
  }

  function showCardModal(cardDef, quantity) {
    // Build modal elements
    const modal = document.createElement('div');
    modal.className = 'card-info-modal';
    const content = document.createElement('div');
    content.className = 'card-info-content';
    const preview = document.createElement('div');
    preview.className = 'card-preview glow-' + cardDef.rarity.toLowerCase();
    preview.style.backgroundImage = `url(${cardArtworkUrl(cardDef.id)})`;
    const meta = document.createElement('div');
    meta.className = 'card-meta';
    meta.innerHTML = `
      <h3>${cardDef.name || cardDef.id}</h3>
      <p><strong>ID&nbsp;:</strong> ${cardDef.id}</p>
      <p><strong>Classe&nbsp;:</strong> ${cardDef.class || cardDef.cls || '—'}</p>
      <p><strong>Rareté&nbsp;:</strong> ${cardDef.rarity}</p>
      ${cardDef.desc ? `<p><strong>Description&nbsp;:</strong> ${cardDef.desc}</p>` : ''}
      <p><strong>Quantité possédée&nbsp;:</strong> ${quantity}</p>
      <div style="text-align:right; margin-top:12px;"><button id="close-card-info">Fermer</button></div>
    `;
    content.append(preview, meta);
    modal.appendChild(content);
    document.body.appendChild(modal);
    // Close handler
    content.querySelector('#close-card-info').addEventListener('click', () => {
      modal.remove();
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
    // Allow the player to flip the preview card by clicking on it.  On each
    // click the spin/float animations are paused and the card rotates 180°.
    let rotated = false;
    preview.addEventListener('click', () => {
      rotated = !rotated;
      // Pause animations while rotated; restore when unrotated.
      preview.style.animationPlayState = rotated ? 'paused' : '';
      preview.style.transform = rotated ? 'rotateY(180deg)' : '';
    });
  }

  // Pagination controls
  const dec = () => { if (spreadIndex > 0) { spreadIndex--; renderSpread(); } };
  const inc = () => { if (spreadIndex + 1 < totalSpreads()) { spreadIndex++; renderSpread(); } };
  root.querySelector('#prev').addEventListener('click', dec);
  root.querySelector('#next').addEventListener('click', inc);
  root.querySelector('#set-inc').addEventListener('click', () => { setNum = Math.max(1, setNum - 1); load(); });
  root.querySelector('#set-dec').addEventListener('click', () => { setNum = setNum + 1; load(); });

  await load();
}

// Compute the aspect ratio of the card back by loading the image and comparing
// its natural dimensions.  This helper matches the one used in albumPage.js.
function getBackRatio() {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const r = img.naturalWidth && img.naturalHeight ? (img.naturalWidth / img.naturalHeight) : (512 / 720);
      resolve(r);
    };
    img.onerror = () => resolve(512 / 720);
    img.src = '/lab/shared/assets/card_back.png?v=' + Date.now();
  });
}