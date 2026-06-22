function bust(url){ return `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`; }
function setBgWithFallback(el, url, fallback) {
  const u = bust(url);
  const f = bust(fallback);
  const img = new Image();
  img.onload = () => { el.style.backgroundImage = `url(${u})`; };
  img.onerror = () => { el.style.backgroundImage = `url(${f})`; };
  img.src = u;
}

const SFX = {
  Common: '/sounds/common.mp3',
  Rare: '/sounds/rare.mp3',
  Epic: '/sounds/epic.mp3',
  Legendary: '/sounds/legendary.mp3',
  Mythical: '/sounds/mythical.mp3',
};

function rarityClass(r){ return `rarity-${(r||'').toLowerCase()}`; }

import { getFxSettings } from '../state/settings.js?v=3';

export function renderOpening(root, cards, { onFinish, packImage, ownedSet }) {
  root.innerHTML = '';

  const stage = document.createElement('div');
  stage.className = 'booster-stage';

  const booster = document.createElement('div');
  booster.className = 'booster-pack';
  booster.style.backgroundImage = `url(${bust('/assets/packs/' + (packImage||'set.jpg'))})`;

  const tear = document.createElement('div'); tear.className = 'booster-tear';

  stage.append(booster, tear);
  root.append(stage);

  const stack = document.createElement('div');
  stack.className = 'stack';

  const btn = document.createElement('button');
  btn.textContent = 'Ranger mes cartes';
  btn.style.display = 'none';

  setTimeout(() => {
    booster.classList.add('opened');
    for (let i=0;i<cards.length;i++) {
      const fd = document.createElement('div');
      fd.className = 'face-down';
      setBgWithFallback(fd, '/assets/card_back.png', '/assets/card_back.png');
      stack.appendChild(fd);
    }
    root.append(stack);
  }, 650);

  let idx = 0;
  const fx = getFxSettings();
  const audio = new Audio();
  audio.muted = !fx.audio_enabled;
  audio.volume = Math.max(0, Math.min(1, fx.audio_volume));

  function revealOne() {
    if (idx >= cards.length) {
      btn.style.display = '';
      return;
    }
    const c = cards[idx++];
    const placeholder = stack.children[ idx - 1 ];
    const cardEl = document.createElement('div');
    cardEl.className = `card reveal ${rarityClass(c.rarity)}`;
    cardEl.style.position = 'relative';

    setBgWithFallback(cardEl, `/artworks/${c.id}.jpg`, '/assets/card_back.png');

    if (fx.visual_rays_enabled && ['Epic','Legendary','Mythical'].includes(c.rarity)) {
      const rays = document.createElement('div'); rays.className = 'fx-rays'; if (!fx.visual_rays_spin) { rays.style.animation = 'none'; rays.style.transform = 'none'; } rays.style.opacity = fx.visual_rays_opacity;
      if (fx.visual_burst_enabled) { const burst = document.createElement('div'); burst.className = 'fx-burst'; cardEl.appendChild(burst); }
      cardEl.appendChild(rays);
    } else if (c.rarity === 'Rare') {
      if (fx.visual_burst_enabled) { const burst = document.createElement('div'); burst.className = 'fx-burst'; cardEl.appendChild(burst); }
      
    }

    if (fx.new_badge_enabled && !ownedSet?.has(c.id)) {
      const badge = document.createElement('div');
      badge.className = 'badge-new';
      badge.textContent = 'NEW!';
      cardEl.appendChild(badge);
    }

    const src = SFX[c.rarity] ?? SFX.Common;
    audio.src = bust(src);
    audio.currentTime = 0;
    audio.play().catch(()=>{});

    placeholder.replaceWith(cardEl);
  }

  stack.addEventListener('click', revealOne);

  btn.addEventListener('click', () => {
    const cardsEls = root.querySelectorAll('.card');
    if (cardsEls.length) {
      const last = cardsEls[cardsEls.length - 1];
      const r1 = last.getBoundingClientRect();
      const fab = document.querySelector('.album-fab');
      if (fab) {
        const r2 = fab.getBoundingClientRect();
        const dx = (r2.left + r2.width/2) - (r1.left + r1.width/2);
        const dy = (r2.top + r2.height/2) - (r1.top + r1.height/2);
        const clone = last.cloneNode(true);
        clone.classList.add('fly-clone');
        clone.style.left = `${r1.left}px`; clone.style.top = `${r1.top}px`;
        clone.style.setProperty('--dx', `${dx}px`);
        clone.style.setProperty('--dy', `${dy}px`);
        document.body.appendChild(clone);
        setTimeout(()=> clone.remove(), 1100);
      }
    }
    onFinish(cards);
  });

  root.append(btn);
}
