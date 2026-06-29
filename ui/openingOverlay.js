// ui/openingOverlay.js
import { generatePack } from '../logic/packGenerator.js?v=17';
import { decrementPlayerPack } from '../data/packsRepo.js?v=17';
import { addCardsBatch } from '../data/cardsRepo.js?v=17';
import { getUser } from '../logic/supaRaw.js?v=17';
import { url } from '../logic/paths.js?v=17';

const SET_FILES = {
  BZH01: '/data/BZH01.json', BZH02: '/data/BZH02.json',
  bzh01: '/data/BZH01.json', bzh02: '/data/BZH02.json',
  set01: '/data/BZH01.json', set02: '/data/BZH02.json',
};

const RARITY_COLOR = { Common:'#9da7b3', Rare:'#42b0ff', Epic:'#bb55d3', Legendary:'#ffbe46', Mythical:'#ff5080' };
const RARITY_SOUND = { Common:'common', Rare:'rare', Epic:'epic', Legendary:'legendary', Mythical:'mythical' };

function playRaritySound(rarity) {
  try {
    const name = RARITY_SOUND[rarity] || 'common';
    const audio = new Audio(url(`/sounds/${name}.mp3`));
    audio.volume = 0.6;
    audio.play().catch(() => {});
  } catch {}
}

async function loadCards(setId) {
  const file = SET_FILES[setId] || SET_FILES.BZH01;
  const res = await fetch(url(file));
  const json = await res.json();
  return Array.isArray(json) ? json : (json.cards || []);
}

async function saveOpenedCards(cards) {
  // Écrit dans tcg_player_cards (user_id / quantity) via le repo dédié
  const user = await getUser();
  await addCardsBatch(user.id, cards);
}

// ─── Pixel build-in : construit l'overlay tuile par tuile ────────────────────
function pixelBuildIn(overlay, onDone) {
  const W = window.innerWidth, H = window.innerHeight;
  const SZ = 18; // taille d'un pixel-tile
  const cols = Math.ceil(W / SZ), rows = Math.ceil(H / SZ);
  const total = cols * rows;
  const tiles = [];

  // Canvas temporaire en position absolute par-dessus tout
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  canvas.style.cssText = 'position:fixed;inset:0;z-index:19999;pointer-events:none;';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  // Génère l'ordre aléatoire des tiles
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      tiles.push({ c, r });
  tiles.sort(() => Math.random() - 0.5);

  overlay.style.opacity = '0';
  overlay.style.transition = 'none';

  let i = 0;
  const batchSize = Math.max(1, Math.round(total / 40)); // 40 frames pour tout couvrir
  const color = '#05080d';

  function step() {
    for (let b = 0; b < batchSize && i < total; b++, i++) {
      const { c, r } = tiles[i];
      ctx.fillStyle = color;
      ctx.fillRect(c * SZ, r * SZ, SZ, SZ);
    }
    if (i < total) {
      requestAnimationFrame(step);
    } else {
      // Tous les tiles couverts → affiche l'overlay, retire le canvas
      overlay.style.opacity = '1';
      canvas.remove();
      onDone();
    }
  }
  requestAnimationFrame(step);
}

// ─── Désintégration pixels vers le bouton Collection ─────────────────────────
function disintegrateToCollection(sourceEl, onDone) {
  // Cherche le bouton de nav Collection dans le hub
  // Cherche le bouton collection — en priorité les IDs du hub, puis fallbacks legacy
  const collectionBtn =
    document.querySelector('#btn-collection') ||
    document.querySelector('#card-collection') ||
    document.querySelector('[data-nav="collection"]') ||
    document.querySelector('a[href="#/collection"]') ||
    [...document.querySelectorAll('button,a')].find(el =>
      el.textContent.trim().toLowerCase().includes('collection')
    );

  const targetRect = collectionBtn
    ? collectionBtn.getBoundingClientRect()
    : { left: window.innerWidth / 2, top: window.innerHeight - 40, width: 60, height: 24 };
  const tx = targetRect.left + targetRect.width / 2;
  const ty = targetRect.top + targetRect.height / 2;

  const srcRect = sourceEl.getBoundingClientRect();
  const PIXEL_COUNT = 180;
  const fragment = document.createDocumentFragment();
  const pxEls = [];

  for (let i = 0; i < PIXEL_COUNT; i++) {
    const px = document.createElement('div');
    const size = 4 + Math.random() * 8;
    const startX = srcRect.left + Math.random() * srcRect.width;
    const startY = srcRect.top + Math.random() * srcRect.height;
    const colors = ['#00f5c4','#42b0ff','#bb55d3','#ffbe46','#c8ffe8'];
    px.style.cssText = `
      position:fixed;
      left:${startX}px;top:${startY}px;
      width:${size}px;height:${size}px;
      background:${colors[Math.floor(Math.random()*colors.length)]};
      border-radius:2px;
      z-index:20000;
      pointer-events:none;
      transition:left ${0.5+Math.random()*0.5}s cubic-bezier(.4,0,.2,1),
                 top ${0.5+Math.random()*0.5}s cubic-bezier(.4,0,.2,1),
                 opacity 0.4s ease ${0.3+Math.random()*0.3}s;
    `;
    fragment.appendChild(px);
    pxEls.push({ el: px, startX, startY });
  }
  document.body.appendChild(fragment);

  // Lance l'animation au prochain frame
  requestAnimationFrame(() => {
    pxEls.forEach(({ el }) => {
      el.style.left = tx + 'px';
      el.style.top = ty + 'px';
      el.style.opacity = '0';
    });
  });

  setTimeout(() => {
    pxEls.forEach(({ el }) => el.remove());
    if (collectionBtn) {
      collectionBtn.style.transition = 'box-shadow .3s';
      collectionBtn.style.boxShadow = '0 0 18px #00f5c4';
      setTimeout(() => { collectionBtn.style.boxShadow = ''; }, 600);
    }
    onDone();
  }, 1100);
}

// ─── Export principal ─────────────────────────────────────────────────────────
export async function openOpeningOverlay({ packTypeId, setId, packImage, onDone, count = 1 } = {}) {
  count = Math.max(1, Math.min(10, Number(count) || 1));

  // Overlay full-screen, z-index maximal, PAS de modal chrome
  const overlay = document.createElement('div');
  overlay.style.cssText = [
    'position:fixed;inset:0;z-index:18000;',
    'background:radial-gradient(ellipse at center,#060f18 0%,#000 100%);',
    'display:flex;flex-direction:column;align-items:center;justify-content:center;',
    'color:#c8ffe8;font-family:inherit;',
    'opacity:0;'
  ].join('');
  document.body.appendChild(overlay);

  // Zone centrale (clics en dehors = avancer)
  const zone = document.createElement('div');
  zone.style.cssText = [
    'position:relative;',
    'width:min(720px,94vw);',
    'display:flex;flex-direction:column;align-items:center;gap:20px;',
    'padding:32px 24px;'
  ].join('');
  overlay.appendChild(zone);

  // Bouton fermer discret (coin haut droit)
  const btnClose = document.createElement('button');
  btnClose.textContent = '✕';
  btnClose.style.cssText = 'position:fixed;top:14px;right:18px;background:transparent;border:none;color:#3a6655;font-size:1.2em;cursor:pointer;z-index:18001;transition:color .2s;';
  btnClose.addEventListener('mouseenter', () => { btnClose.style.color = '#ff2d4e'; });
  btnClose.addEventListener('mouseleave', () => { btnClose.style.color = '#3a6655'; });
  overlay.appendChild(btnClose);

  let phase = 'booster'; // 'booster' | 'cards' | 'done'
  let savedAlready = false;

  // Clic HORS zone centrale = avancer
  overlay.addEventListener('click', e => {
    if (e.target === overlay || e.target === btnClose) {
      if (e.target === btnClose) { closeOverlay(); return; }
      advancePhase();
    }
  });

  function advancePhase() {
    if (phase === 'booster') {
      // Clic hors zone = déchire le booster d'un coup
      if (tearOpen) tearOpen();
    } else if (phase === 'cards') {
      // Révèle tout + sauvegarde
      revealAll();
    }
  }

  function closeOverlay() {
    if (boosterCleanup) boosterCleanup();
    overlay.style.transition = 'opacity .3s';
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 320);
  }

  // ── Phase 1 : build-in pixel puis affiche le booster ──────────────────────
  let cards, grouped;
  try {
    const allCards = await loadCards(setId || 'BZH01');
    const base = Date.now().toString(16);
    cards = [];
    for (let i = 0; i < count; i++) {
      cards.push(...generatePack({ cards: allCards, cardCount: 5, seedHex: String(packTypeId) + '-' + i + '-' + base }));
    }
  } catch {
    overlay.innerHTML = '<div style="color:#ff8a8a;padding:40px">Erreur génération pack.</div>';
    overlay.style.opacity = '1';
    return;
  }

  grouped = [];
  const seen = {};
  for (const card of cards) {
    if (seen[card.id] !== undefined) grouped[seen[card.id]].count++;
    else { seen[card.id] = grouped.length; grouped.push({ card, count: 1 }); }
  }

  // Pixel build-in → révèle l'overlay (booster animé en solo, grille agrégée en multi)
  pixelBuildIn(overlay, count > 1 ? showMultiPhase : showBoosterPhase);

  // ── Phase booster (déchirure au drag) ───────────────────────────────────────
  let tearOpen = null;       // assignée dans showBoosterPhase, appelable via advancePhase
  let torn = false;
  let boosterCleanup = null; // détache les écouteurs window de la phase booster

  function showBoosterPhase() {
    phase = 'booster';
    const boosterImg = packImage || url('/assets/packs/set01.jpg');
    zone.innerHTML = `
      <div style="color:#6fa694;font-size:.82em;opacity:.8">Tire la languette ↗ pour déchirer le booster — ou clique autour</div>
      <div id="booster-wrap" style="position:relative;width:240px;height:320px;perspective:900px;">
        <div id="booster-card" style="position:absolute;inset:0;border-radius:14px;overflow:hidden;border:1px solid #173628;box-shadow:0 0 30px rgba(0,245,196,.2);transition:transform .26s ease,filter .12s ease,opacity .26s ease">
          <img src="${boosterImg}" style="width:100%;height:100%;object-fit:contain;background:#060c10" alt="booster" draggable="false">
        </div>
        <div id="rip-line" style="position:absolute;top:0;right:0;height:10px;width:0px;background:linear-gradient(90deg,rgba(0,245,196,0),rgba(0,245,196,.7));border-bottom-left-radius:6px;pointer-events:none;box-shadow:0 0 10px #00f5c4"></div>
        <div id="tear-handle" style="position:absolute;top:-8px;right:-8px;width:44px;height:44px;border-radius:11px;background:radial-gradient(circle at 30% 30%,#c8ffe8,#00b594);border:1px solid #0e2a1f;box-shadow:0 6px 14px rgba(0,0,0,.5);cursor:grab;touch-action:none;user-select:none;display:flex;align-items:center;justify-content:center;font-size:.62em;color:#04130d;font-weight:700">PULL</div>
        <div id="booster-pixels" style="position:absolute;inset:0;pointer-events:none"></div>
      </div>
      <div id="booster-status" style="font-weight:700;color:#42b0ff;font-size:.9em">Déchirure : 0%</div>
    `;
    const cardEl = zone.querySelector('#booster-card');
    const ripEl = zone.querySelector('#rip-line');
    const handle = zone.querySelector('#tear-handle');
    const pixelsEl = zone.querySelector('#booster-pixels');
    const statusEl = zone.querySelector('#booster-status');

    const MAX = 200;        // distance de drag (px) pour déchirure complète
    const THRESHOLD = 120;  // au lâcher, ouvre si dépassé
    let dragging = false, startX = 0, progress = 0;

    function burst(intensity = 1) {
      for (let i = 0; i < Math.round(22 * intensity); i++) {
        const px = document.createElement('span');
        const size = 5 + Math.random() * 10;
        const left = 120 + (Math.random() * 90 - 45);
        const top = 20 + (Math.random() * 90);
        const dx = (Math.random() * 280 - 140) * intensity;
        const dy = (Math.random() * 280 - 140) * intensity;
        px.style.cssText = `position:absolute;left:${left}px;top:${top}px;width:${size}px;height:${size}px;background:${Math.random()>.5?'#00f5c4':'#42b0ff'};opacity:.9;border-radius:2px;pointer-events:none;transition:transform .5s ease-out,opacity .5s ease-out;`;
        pixelsEl.appendChild(px);
        requestAnimationFrame(() => { px.style.transform = `translate(${dx}px,${dy}px)`; px.style.opacity = '0'; });
        setTimeout(() => px.remove(), 520);
      }
    }

    function setProgress(p) {
      progress = Math.max(0, Math.min(MAX, p));
      ripEl.style.width = progress + 'px';
      statusEl.textContent = `Déchirure : ${Math.round((progress / MAX) * 100)}%`;
      const k = progress / MAX;
      cardEl.style.transform = `rotate(${k * 3}deg)`;
      cardEl.style.filter = `brightness(${1 + k * 0.3})`;
    }

    function detach() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    }
    boosterCleanup = detach;

    tearOpen = async () => {
      if (torn) return;
      torn = true;
      detach();
      setProgress(MAX);
      burst(1.4);
      cardEl.style.transform = 'translateY(-14px) rotate(4deg)';
      cardEl.style.opacity = '0';
      statusEl.textContent = 'Ouvert !';
      try { await decrementPlayerPack(packTypeId, 1); } catch (e) { console.warn(e); }
      setTimeout(showCardsPhase, 320);
    };

    const getX = e => (e.touches ? e.touches[0].clientX : e.clientX);
    const onDown = e => { if (torn) return; dragging = true; startX = getX(e); handle.style.cursor = 'grabbing'; e.preventDefault && e.preventDefault(); };
    const onMove = e => { if (!dragging) return; setProgress(startX - getX(e)); };
    const onUp = () => {
      if (!dragging) return;
      dragging = false; handle.style.cursor = 'grab';
      if (progress >= THRESHOLD) tearOpen();
      else { burst(progress / MAX); setProgress(0); }
    };

    handle.addEventListener('mousedown', onDown);
    handle.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
  }

  // ── Phase cartes ───────────────────────────────────────────────────────────
  let allRevealed = false;

  function revealAll() {
    if (allRevealed) return;
    allRevealed = true;
    zone.querySelectorAll('.flip-inner').forEach(el => el.style.transform = 'rotateY(180deg)');
    const rarityOrder = ['Mythical','Legendary','Epic','Rare','Common'];
    const best = rarityOrder.find(r => grouped.some(g => g.card.rarity === r));
    if (best) playRaritySound(best);
    // Pas d'auto-rangement : on affiche le bouton, l'utilisateur range quand il veut
    const revealBtn = zone.querySelector('#reveal-all');
    const finishBtn = zone.querySelector('#finish-btn');
    if (revealBtn) revealBtn.style.display = 'none';
    if (finishBtn) finishBtn.style.display = '';
  }

  // Sauvegarde + transition finale, déclenchée manuellement (bouton « Ranger »)
  async function saveAndFinish() {
    if (savedAlready) return;
    savedAlready = true;
    const btn = zone.querySelector('#finish-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Rangement…'; }
    try {
      await saveOpenedCards(cards);
      if (typeof onDone === 'function') await onDone(cards);
    } catch(e) { console.error('save', e); }
    showDonePhase();
  }

  function showCardsPhase() {
    phase = 'cards';
    const backSrc = url('/assets/card_back.png');
    zone.innerHTML = `
      <div style="font-weight:700;color:#42b0ff;font-size:.95em">✦ Clique sur chaque carte — ou autour pour tout révéler</div>
      <div id="cards-grid" style="display:flex;flex-wrap:wrap;justify-content:center;gap:16px;padding:8px;width:100%;"></div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;">
        <button id="reveal-all" style="background:transparent;border:1px solid #00f5c4;color:#00f5c4;padding:6px 18px;cursor:pointer;font-family:inherit;font-size:.85em;">Tout révéler</button>
        <button id="finish-btn" style="display:none;background:#22c55e;border:1px solid #22c55e;color:#04130d;font-weight:700;padding:6px 22px;cursor:pointer;font-family:inherit;font-size:.85em;border-radius:6px;">📥 Ranger dans la collection</button>
      </div>
    `;
    const grid = zone.querySelector('#cards-grid');

    grouped.forEach(({ card, count }) => {
      const rc = RARITY_COLOR[card.rarity] || '#9da7b3';
      const imgSrc = url(`/assets/cards/${card.id}.jpg`);
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:6px;';
      const fc = document.createElement('div');
      fc.style.cssText = 'width:130px;height:185px;perspective:900px;cursor:pointer;flex-shrink:0;';
      fc.innerHTML = `
        <div class="flip-inner" style="position:relative;width:100%;height:100%;transform-style:preserve-3d;transition:transform .55s ease">
          <div style="position:absolute;inset:0;backface-visibility:hidden;border-radius:11px;overflow:hidden;border:1px solid #173628">
            <img src="${backSrc}" style="width:100%;height:100%;object-fit:contain;background:#060c10" alt="dos">
          </div>
          <div style="position:absolute;inset:0;backface-visibility:hidden;transform:rotateY(180deg);border-radius:11px;overflow:hidden;border:1px solid ${rc};box-shadow:0 0 18px ${rc}55">
            <img src="${imgSrc}" style="width:100%;height:100%;object-fit:contain;background:#060c10" alt="${card.name}" onerror="this.src='${backSrc}'">
            <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.75);padding:5px 7px;border-bottom-left-radius:11px;border-bottom-right-radius:11px;">
              <div style="font-size:.62em;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${card.name}</div>
              <div style="font-size:.58em;color:${rc}">${card.rarity}</div>
            </div>
          </div>
        </div>
      `;
      let revealed = false;
      fc.addEventListener('click', () => {
        if (revealed) return;
        revealed = true;
        fc.querySelector('.flip-inner').style.transform = 'rotateY(180deg)';
        playRaritySound(card.rarity);
        // Vérifie si toutes révélées
        const all = [...zone.querySelectorAll('.flip-inner')];
        if (all.every(el => el.style.transform === 'rotateY(180deg)')) revealAll();
      });
      wrapper.appendChild(fc);
      if (count > 1) {
        const badge = document.createElement('div');
        badge.style.cssText = `background:${rc};color:#000;font-weight:700;font-size:.72em;padding:2px 8px;border-radius:10px;`;
        badge.textContent = `x${count}`;
        wrapper.appendChild(badge);
      }
      grid.appendChild(wrapper);
    });

    zone.querySelector('#reveal-all').addEventListener('click', revealAll);
    zone.querySelector('#finish-btn').addEventListener('click', saveAndFinish);
  }

  // ── Phase multi (ouverture rapide de plusieurs boosters) ────────────────────
  async function showMultiPhase() {
    phase = 'cards';
    // Consomme les boosters ouverts
    try { await decrementPlayerPack(packTypeId, count); } catch (e) { console.warn(e); }
    const rarityOrder = ['Mythical','Legendary','Epic','Rare','Common'];
    const best = rarityOrder.find(r => grouped.some(g => g.card.rarity === r));
    if (best) playRaritySound(best);

    const backSrc = url('/assets/card_back.png');
    zone.innerHTML = `
      <div style="font-weight:700;color:#42b0ff;font-size:.95em">✦ ${count} boosters ouverts — ${cards.length} cartes</div>
      <div id="cards-grid" style="display:flex;flex-wrap:wrap;justify-content:center;gap:12px;padding:8px;width:100%;max-height:58vh;overflow-y:auto;"></div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;">
        <button id="finish-btn" style="background:#22c55e;border:1px solid #22c55e;color:#04130d;font-weight:700;padding:6px 22px;cursor:pointer;font-family:inherit;font-size:.85em;border-radius:6px;">📥 Ranger dans la collection</button>
      </div>
    `;
    const grid = zone.querySelector('#cards-grid');
    const order = { Mythical:0, Legendary:1, Epic:2, Rare:3, Common:4 };
    [...grouped]
      .sort((a, b) => (order[a.card.rarity] ?? 9) - (order[b.card.rarity] ?? 9))
      .forEach(({ card, count: cnt }) => {
        const rc = RARITY_COLOR[card.rarity] || '#9da7b3';
        const imgSrc = url(`/assets/cards/${card.id}.jpg`);
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'position:relative;width:96px;height:135px;border-radius:9px;overflow:hidden;border:1px solid ' + rc + ';box-shadow:0 0 12px ' + rc + '55;';
        wrapper.innerHTML = `
          <img src="${imgSrc}" style="width:100%;height:100%;object-fit:contain;background:#060c10" alt="${card.name}" onerror="this.src='${backSrc}'">
          <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.78);padding:3px 5px">
            <div style="font-size:.55em;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${card.name}</div>
            <div style="font-size:.5em;color:${rc}">${card.rarity}</div>
          </div>
          ${cnt > 1 ? `<span style="position:absolute;top:3px;right:3px;background:${rc};color:#000;font-weight:700;font-size:.55em;padding:1px 5px;border-radius:8px">x${cnt}</span>` : ''}
        `;
        grid.appendChild(wrapper);
      });
    zone.querySelector('#finish-btn').addEventListener('click', saveAndFinish);
  }

  // ── Phase terminée : message + désintégration ──────────────────────────────
  function showDonePhase() {
    phase = 'done';
    zone.innerHTML = `
      <div id="done-msg" style="text-align:center;padding:24px">
        <div style="font-size:1.15em;font-weight:700;color:#22c55e">✅ Cartes ajoutées à la collection !</div>
        <div style="margin-top:8px;color:#6fa694;font-size:.85em">Envoi vers la collection…</div>
      </div>
    `;
    const msg = zone.querySelector('#done-msg');
    setTimeout(() => {
      disintegrateToCollection(msg, () => {
        closeOverlay();
      });
    }, 400);
  }
}
