// ui/openingOverlay.js
import { generatePack } from '../logic/packGenerator.js';
import { decrementPlayerPack } from '../data/packsRepo.js';
import { getClient, getUser } from '../logic/supaRaw.js';
import { url } from '../logic/paths.js';

const SET_FILES = {
  BZH01: '/data/BZH01.json',
  BZH02: '/data/BZH02.json',
  bzh01: '/data/bzh_set01.json',
  bzh02: '/data/bzh_set02.json',
  set01: '/data/bzh_set01.json',
  set02: '/data/bzh_set02.json'
};

function rarityColor(rarity) {
  return {
    Common: '#9da7b3',
    Rare: '#42b0ff',
    Epic: '#bb55d3',
    Legendary: '#ffbe46',
    Mythical: '#ff5080',
  }[rarity] || '#9da7b3';
}

async function loadCards(setId) {
  const res = await fetch(url(SET_FILES[setId] || SET_FILES.BZH01));
  const json = await res.json();
  return Array.isArray(json) ? json : (json.cards || []);
}

async function saveOpenedCards(cards) {
  const sb = await getClient();
  const user = await getUser();
  for (const card of cards) {
    const cardId = card.id;
    const { data: row, error: readErr } = await sb
      .from('player_cards')
      .select('quantity')
      .eq('player_id', user.id)
      .eq('card_id', cardId)
      .maybeSingle();
    if (readErr) throw readErr;
    const quantity = (row?.quantity || 0) + 1;
    const { error: writeErr } = await sb.from('player_cards').upsert(
      { player_id: user.id, card_id: cardId, quantity },
      { onConflict: 'player_id,card_id' }
    );
    if (writeErr) throw writeErr;
  }
}

export async function openOpeningOverlay({ packTypeId, setId, packImage, onDone } = {}) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:radial-gradient(circle at center,rgba(8,14,20,.86),rgba(0,0,0,.94));z-index:10001;display:grid;place-items:center;padding:20px';
  const modal = document.createElement('div');
  modal.style.cssText = 'width:min(1200px,96vw);min-height:72vh;background:#05080d;border:1px solid #0e2a1f;border-radius:18px;box-shadow:0 24px 80px rgba(0,0,0,.65);color:#c8ffe8;position:relative;overflow:hidden';
  modal.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #0e2a1f">
      <div style="font-weight:700;letter-spacing:.08em">OUVERTURE DE BOOSTER</div>
      <button id="open-close" class="btn-nav">Fermer</button>
    </div>
    <div id="opening-stage" style="min-height:62vh;display:grid;place-items:center;padding:20px"></div>
  `;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  modal.querySelector('#open-close').addEventListener('click', close);
  const stage = modal.querySelector('#opening-stage');

  let cards;
  try {
    const allCards = await loadCards(setId || 'BZH01');
    cards = generatePack({ cards: allCards, cardCount: 5, seedHex: String(packTypeId) + Date.now().toString(16) });
  } catch (e) {
    stage.innerHTML = '<div style="color:#ff8a8a">Erreur lors de la génération du pack.</div>';
    return;
  }

  let clicks = 0;
  const boosterImg = packImage || url('/assets/packs/set01.jpg');
  stage.innerHTML = `
    <div style="display:grid;place-items:center;gap:18px;text-align:center;width:100%">
      <div style="color:#6fa694">Clique plusieurs fois pour faire exploser le booster</div>
      <div id="booster-wrap" style="position:relative;width:260px;height:360px;perspective:1000px;cursor:pointer">
        <div id="booster-card" style="position:absolute;inset:0;border-radius:16px;border:1px solid #173628;background:url('${boosterImg}') center/cover no-repeat;box-shadow:0 0 30px rgba(0,245,196,.18);transition:transform .15s ease, filter .15s ease"></div>
        <div id="booster-pixels" style="position:absolute;inset:0;pointer-events:none"></div>
      </div>
      <div id="booster-status" style="font-weight:700;color:#42b0ff">0 / 4 impacts</div>
    </div>
  `;

  const wrap = stage.querySelector('#booster-wrap');
  const card = stage.querySelector('#booster-card');
  const pixels = stage.querySelector('#booster-pixels');
  const status = stage.querySelector('#booster-status');

  function burst() {
    for (let i = 0; i < 22; i++) {
      const px = document.createElement('span');
      const size = 6 + Math.random() * 12;
      const left = 120 + (Math.random() * 80 - 40);
      const top = 160 + (Math.random() * 80 - 40);
      const dx = (Math.random() * 220 - 110);
      const dy = (Math.random() * 220 - 110);
      px.style.cssText = `position:absolute;left:${left}px;top:${top}px;width:${size}px;height:${size}px;background:${Math.random()>.5?'#00f5c4':'#42b0ff'};opacity:.9;border-radius:2px;transform:translate(0,0);transition:transform .45s ease-out, opacity .45s ease-out;`;
      pixels.appendChild(px);
      requestAnimationFrame(() => {
        px.style.transform = `translate(${dx}px,${dy}px)`;
        px.style.opacity = '0';
      });
      setTimeout(() => px.remove(), 480);
    }
  }

  wrap.addEventListener('click', async () => {
    clicks += 1;
    card.style.transform = `rotateY(${clicks % 2 ? 11 : -11}deg) scale(${1 + clicks * 0.02})`;
    card.style.filter = `brightness(${1 + clicks * 0.08})`;
    burst();
    status.textContent = `${clicks} / 4 impacts`;
    if (clicks < 4) return;

    try {
      await decrementPlayerPack(packTypeId, 1);
    } catch (e) {
      console.warn('Decrement pack failed', e);
    }

    stage.innerHTML = `
      <div style="width:100%;display:grid;place-items:center;gap:18px">
        <div style="font-weight:700;color:#42b0ff">Le booster explose et révèle ses cartes</div>
        <div id="circle" style="position:relative;width:min(760px,88vw);height:460px"></div>
        <div style="display:flex;gap:12px;justify-content:center">
          <button id="reveal-all" class="btn-nav">Tout révéler</button>
          <button id="save-cards" class="btn-nav">Sauvegarder</button>
        </div>
      </div>
    `;

    const circle = stage.querySelector('#circle');
    const centerX = circle.clientWidth / 2;
    const centerY = circle.clientHeight / 2;
    const radius = Math.min(circle.clientWidth, circle.clientHeight) * 0.32;

    cards.forEach((item, i) => {
      const angle = (Math.PI * 2 * i) / cards.length - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radius - 70;
      const y = centerY + Math.sin(angle) * radius - 100;
      const imgSrc = url(`/assets/cards/${item.image || item.id + '.webp'}?v=cyber`);
      const backSrc = url('/assets/card_back.png');
      const color = rarityColor(item.rarity);
      const fc = document.createElement('div');
      fc.className = 'flip-card';
      fc.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:140px;height:200px;perspective:1000px;cursor:pointer;`;
      fc.innerHTML = `
        <div class="flip-inner" style="position:relative;width:100%;height:100%;transform-style:preserve-3d;transition:transform .6s ease">
          <div class="flip-face flip-back" style="position:absolute;inset:0;backface-visibility:hidden;border-radius:12px;background:url('${backSrc}') center/cover no-repeat;border:1px solid #173628"></div>
          <div class="flip-face flip-front" style="position:absolute;inset:0;backface-visibility:hidden;transform:rotateY(180deg);border-radius:12px;background:url('${imgSrc}') center/cover no-repeat;border:1px solid ${color};box-shadow:0 0 20px ${color}55">
            <div style="position:absolute;left:0;right:0;bottom:0;background:rgba(0,0,0,.72);padding:6px 8px;border-bottom-left-radius:12px;border-bottom-right-radius:12px">
              <div style="font-size:.72em;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.name}</div>
              <div style="font-size:.65em;color:${color}">${item.rarity}</div>
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
        stage.innerHTML = '<div style="text-align:center"><div style="font-size:1.2em;font-weight:700;color:#22c55e">Cartes ajoutées à la collection</div><div style="margin-top:10px;color:#6fa694">Le hub va se rafraîchir.</div></div>';
        setTimeout(() => close(), 900);
      } catch (e) {
        console.error(e);
        alert('Erreur lors de la sauvegarde des cartes');
      }
    });
  }, { once: false });
}
