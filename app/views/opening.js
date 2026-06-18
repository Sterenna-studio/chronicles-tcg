// app/views/opening.js — rework complet
import { generatePack } from '../../logic/packGenerator.js';
import { decrementPlayerPack } from '../../data/packsRepo.js';
import { url } from '../../logic/paths.js';

const SET_FILES = {
  BZH01: '/data/BZH01.json',
  BZH02: '/data/BZH02.json',
};

async function loadCards(setId) {
  const res = await fetch(url(SET_FILES[setId] || SET_FILES.BZH01));
  const json = await res.json();
  return Array.isArray(json) ? json : (json.cards || []);
}

function rarityColor(rarity) {
  return {
    Common: '#9da7b3',
    Rare: '#42b0ff',
    Epic: '#bb55d3',
    Legendary: '#ffbe46',
    Mythical: '#ff5080',
  }[rarity] || '#9da7b3';
}

export async function renderOpening(root) {
  const el = document.createElement('div');
  el.className = 'panel';
  el.innerHTML = `
    <div class="h-section">✨ Ouverture de Pack</div>
    <div id="opening-content" style="padding:16px">
      <div style="opacity:.7;text-align:center;padding:40px">
        Clique sur un booster depuis l'accueil pour l'ouvrir ici.
      </div>
    </div>
  `;
  root.appendChild(el);

  // Écoute l'événement envoyé par home.js
  const handler = async (e) => {
    const { pack_type_id, set_id } = e.detail || {};
    if (!pack_type_id) return;
    await startOpening(el.querySelector('#opening-content'), pack_type_id, set_id);
  };
  document.addEventListener('tcg:open-pack', handler);

  // Nettoyage quand la vue est retirée du DOM
  // Utilise un AbortController + ResizeObserver sur el (bien moins coûteux qu'un MutationObserver subtree sur body)
  const ctrl = new AbortController();
  const cleanup = () => { document.removeEventListener('tcg:open-pack', handler); ctrl.abort(); };
  window.addEventListener('hashchange', cleanup, { signal: ctrl.signal });
}

async function startOpening(container, packTypeId, setId) {
  container.innerHTML = `<div style="text-align:center;padding:32px;opacity:.7">Préparation du pack...</div>`;

  let cards;
  try {
    const allCards = await loadCards(setId || 'BZH01');
    cards = generatePack({ cards: allCards, cardCount: 5, seedHex: packTypeId + Date.now().toString(16) });
  } catch (e) {
    container.innerHTML = `<div style="color:#ff8a8a;padding:16px">Erreur lors de la génération du pack.</div>`;
    return;
  }

  // Decrement pack en base
  try {
    await decrementPlayerPack(packTypeId, 1);
  } catch (e) {
    console.warn('Decrement pack failed', e);
  }

  // Affichage flip
  container.innerHTML = `
    <div style="text-align:center;margin-bottom:16px;color:var(--muted);font-size:.9em">
      Clique sur chaque carte pour la révéler
    </div>
    <div class="fd-row row-stage" id="flip-row"></div>
    <div style="text-align:center;margin-top:20px">
      <button id="reveal-all" class="btn" style="margin-right:8px">Tout révéler</button>
      <button id="open-another" class="btn btn-outline">Retour accueil</button>
    </div>
  `;

  const row = container.querySelector('#flip-row');

  cards.forEach((card, i) => {
    const imgSrc = url(`/assets/cards/${card.image || card.id + '.jpg'}`);
    const backSrc = url('/assets/card_back.png');
    const color = rarityColor(card.rarity);

    const fc = document.createElement('div');
    fc.className = 'flip-card pre';
    fc.innerHTML = `
      <div class="flip-inner">
        <div class="flip-face flip-back" style="background-image:url('${backSrc}');background-size:cover;background-color:#0e141b"></div>
        <div class="flip-face flip-front" style="background-image:url('${imgSrc}');background-size:cover;background-color:#0e141b">
          <div style="position:absolute;bottom:0;left:0;right:0;padding:6px 8px;background:rgba(0,0,0,.7);border-bottom-left-radius:10px;border-bottom-right-radius:10px">
            <div style="font-size:.75em;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${card.name}</div>
            <div style="font-size:.65em;color:${color}">${card.rarity}</div>
          </div>
        </div>
      </div>
    `;

    fc.addEventListener('click', () => fc.classList.add('flipped'));
    row.appendChild(fc);

    // Apparition progressive
    setTimeout(() => fc.classList.remove('pre'), 80 + i * 120);
  });

  container.querySelector('#reveal-all').addEventListener('click', () => {
    row.querySelectorAll('.flip-card').forEach(fc => fc.classList.add('flipped'));
  });

  container.querySelector('#open-another').addEventListener('click', () => {
    location.hash = '#/home';
  });
}
