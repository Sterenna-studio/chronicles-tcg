// ui/openingOverlay.js
import { generatePack } from '../logic/packGenerator.js';
import { decrementPlayerPack } from '../data/packsRepo.js';
import { getClient, getUser } from '../logic/supaRaw.js';
import { url } from '../logic/paths.js';

const SET_FILES = {
  BZH01: '/data/BZH01.json', BZH02: '/data/BZH02.json',
  bzh01: '/data/BZH01.json', bzh02: '/data/BZH02.json',
  set01: '/data/BZH01.json', set02: '/data/BZH02.json',
};

const RARITY_COLOR = { Common:'#9da7b3', Rare:'#42b0ff', Epic:'#bb55d3', Legendary:'#ffbe46', Mythical:'#ff5080' };

async function loadCards(setId) {
  const file = SET_FILES[setId] || SET_FILES.BZH01;
  const res = await fetch(url(file));
  const json = await res.json();
  return Array.isArray(json) ? json : (json.cards || []);
}

async function saveOpenedCards(cards) {
  const sb = await getClient();
  const user = await getUser();
  // Détecte la bonne colonne (player_id ou user_id)
  const testQ = await sb.from('player_cards').select('quantity').eq('player_id', user.id).limit(1);
  const col = testQ.error ? 'user_id' : 'player_id';
  for (const card of cards) {
    const { data: row } = await sb.from('player_cards').select('quantity').eq(col, user.id).eq('card_id', card.id).maybeSingle();
    const quantity = (row?.quantity || 0) + 1;
    await sb.from('player_cards').upsert({ [col]: user.id, card_id: card.id, quantity }, { onConflict: `${col},card_id` });
  }
}

export async function openOpeningOverlay({ packTypeId, setId, packImage, onDone } = {}) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:radial-gradient(circle at center,rgba(8,14,20,.9),rgba(0,0,0,.96));z-index:10001;display:grid;place-items:center;padding:20px';
  const modal = document.createElement('div');
  modal.style.cssText = 'width:min(1100px,96vw);min-height:72vh;background:#05080d;border:1px solid #0e2a1f;border-radius:18px;color:#c8ffe8;position:relative;overflow:hidden;display:flex;flex-direction:column;';
  modal.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #0e2a1f;flex-shrink:0">
      <div style="font-weight:700;letter-spacing:.08em">✦ OUVERTURE DE BOOSTER</div>
      <button id="open-close" style="background:transparent;border:1px solid #ff2d4e;color:#ff2d4e;padding:3px 10px;cursor:pointer;font-family:inherit;font-size:.8em">Fermer</button>
    </div>
    <div id="opening-stage" style="flex:1;display:grid;place-items:center;padding:20px"></div>
  `;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  modal.querySelector('#open-close').addEventListener('click', close);
  const stage = modal.querySelector('#opening-stage');

  let cards;
  try {
    const allCards = await loadCards(setId || 'BZH01');
    cards = generatePack({ cards: allCards, cardCount: 5, seedHex: String(packTypeId) + Date.now().toString(16) });
  } catch (e) {
    stage.innerHTML = '<div style="color:#ff8a8a">Erreur génération pack.</div>';
    return;
  }

  // --- PHASE 1 : booster à cliquer ---
  let clicks = 0;
  const MAX_CLICKS = 4;
  const boosterImg = packImage || url('/assets/packs/set01.jpg');
  stage.innerHTML = `
    <div style="display:grid;place-items:center;gap:18px;text-align:center">
      <div style="color:#6fa694;font-size:.85em">Clique ${MAX_CLICKS} fois pour faire exploser le booster !</div>
      <div id="booster-wrap" style="position:relative;width:220px;height:310px;perspective:900px;cursor:pointer">
        <div id="booster-card" style="position:absolute;inset:0;border-radius:14px;overflow:hidden;border:1px solid #173628;box-shadow:0 0 30px rgba(0,245,196,.2);transition:transform .12s ease,filter .12s ease">
          <img src="${boosterImg}" style="width:100%;height:100%;object-fit:contain;background:#060c10" alt="booster">
        </div>
        <div id="booster-pixels" style="position:absolute;inset:0;pointer-events:none"></div>
      </div>
      <div id="booster-status" style="font-weight:700;color:#42b0ff">0 / ${MAX_CLICKS} impacts</div>
    </div>
  `;
  const wrap = stage.querySelector('#booster-wrap');
  const cardEl = stage.querySelector('#booster-card');
  const pixelsEl = stage.querySelector('#booster-pixels');
  const statusEl = stage.querySelector('#booster-status');

  function burst(intensity = 1) {
    for (let i = 0; i < Math.round(18 * intensity); i++) {
      const px = document.createElement('span');
      const size = 5 + Math.random() * 10;
      const left = 90 + (Math.random() * 80 - 40);
      const top = 140 + (Math.random() * 80 - 40);
      const dx = (Math.random() * 260 - 130) * intensity;
      const dy = (Math.random() * 260 - 130) * intensity;
      px.style.cssText = `position:absolute;left:${left}px;top:${top}px;width:${size}px;height:${size}px;background:${Math.random()>.5?'#00f5c4':'#42b0ff'};opacity:.9;border-radius:2px;pointer-events:none;transition:transform .5s ease-out,opacity .5s ease-out;`;
      pixelsEl.appendChild(px);
      requestAnimationFrame(() => { px.style.transform=`translate(${dx}px,${dy}px)`; px.style.opacity='0'; });
      setTimeout(() => px.remove(), 520);
    }
  }

  wrap.addEventListener('click', async () => {
    clicks++;
    const prog = clicks / MAX_CLICKS;
    cardEl.style.transform = `rotateY(${clicks%2?14:-14}deg) scale(${1+prog*0.06})`;
    cardEl.style.filter = `brightness(${1+prog*0.4})`;
    burst(prog);
    statusEl.textContent = `${clicks} / ${MAX_CLICKS} impacts`;
    if (clicks < MAX_CLICKS) return;

    // Décrémenter le pack
    try { await decrementPlayerPack(packTypeId, 1); } catch(e) { console.warn('decrement pack', e); }

    // --- PHASE 2 : cartes en cercle ---
    stage.innerHTML = `
      <div style="width:100%;display:flex;flex-direction:column;align-items:center;gap:20px">
        <div style="font-weight:700;color:#42b0ff">✦ Le booster révèle ses cartes !</div>
        <div id="circle" style="position:relative;width:min(700px,88vw);height:420px"></div>
        <div style="display:flex;gap:12px">
          <button id="reveal-all" style="background:transparent;border:1px solid #00f5c4;color:#00f5c4;padding:6px 16px;cursor:pointer;font-family:inherit;font-size:.85em">Tout révéler</button>
          <button id="save-cards" style="background:#00f5c4;border:none;color:#000;padding:6px 16px;cursor:pointer;font-family:inherit;font-size:.85em;font-weight:700">Sauvegarder la collection</button>
        </div>
      </div>
    `;
    const circle = stage.querySelector('#circle');
    const W = circle.clientWidth, H = circle.clientHeight;
    const cx = W/2, cy = H/2, R = Math.min(W,H)*0.33;

    cards.forEach((item, i) => {
      const angle = (Math.PI*2*i/cards.length) - Math.PI/2;
      const x = cx + Math.cos(angle)*R - 70;
      const y = cy + Math.sin(angle)*R - 100;
      const rc = RARITY_COLOR[item.rarity] || '#9da7b3';
      const imgSrc = url(`/assets/cards/${item.id}.jpg`);
      const backSrc = url('/assets/card_back.png');
      const fc = document.createElement('div');
      fc.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:140px;height:200px;perspective:900px;cursor:pointer;`;
      fc.innerHTML = `
        <div class="flip-inner" style="position:relative;width:100%;height:100%;transform-style:preserve-3d;transition:transform .55s ease">
          <div style="position:absolute;inset:0;backface-visibility:hidden;border-radius:11px;overflow:hidden;border:1px solid #173628">
            <img src="${backSrc}" style="width:100%;height:100%;object-fit:contain;background:#060c10" alt="dos">
          </div>
          <div style="position:absolute;inset:0;backface-visibility:hidden;transform:rotateY(180deg);border-radius:11px;overflow:hidden;border:1px solid ${rc};box-shadow:0 0 18px ${rc}55">
            <img src="${imgSrc}" style="width:100%;height:100%;object-fit:contain;background:#060c10" alt="${item.name}"
              onerror="this.src='${backSrc}'">
            <div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,.75);padding:5px 7px;border-bottom-left-radius:11px;border-bottom-right-radius:11px">
              <div style="font-size:.68em;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.name}</div>
              <div style="font-size:.62em;color:${rc}">${item.rarity}</div>
            </div>
          </div>
        </div>
      `;
      fc.addEventListener('click', () => fc.querySelector('.flip-inner').style.transform = 'rotateY(180deg)');
      circle.appendChild(fc);
    });

    stage.querySelector('#reveal-all').addEventListener('click', () => {
      circle.querySelectorAll('.flip-inner').forEach(el => el.style.transform = 'rotateY(180deg)');
    });
    stage.querySelector('#save-cards').addEventListener('click', async () => {
      try {
        await saveOpenedCards(cards);
        if (typeof onDone === 'function') await onDone(cards);
        stage.innerHTML = '<div style="text-align:center"><div style="font-size:1.1em;font-weight:700;color:#22c55e">✅ Cartes ajoutées à la collection !</div><div style="margin-top:8px;color:#6fa694">Retour au hub...</div></div>';
        setTimeout(() => close(), 900);
      } catch(e) { console.error(e); alert('Erreur sauvegarde cartes'); }
    });
  });
}
