function bust(url){ return `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`; }
function setBg(el, url){ el.style.backgroundImage = `url(${bust(url)})`; }
function setBgWithFallback(el, url, fallback){
  const u = bust(url), f = bust(fallback);
  const img = new Image();
  img.onload = () => setBg(el, url);
  img.onerror = () => setBg(el, fallback);
  img.src = u;
}
function raf(){ return new Promise(requestAnimationFrame); }

const SFX = {
  Common: '/sounds/common.mp3',
  Rare: '/sounds/rare.mp3',
  Epic: '/sounds/epic.mp3',
  Legendary: '/sounds/legendary.mp3',
  Mythical: '/sounds/mythical.mp3',
};

function rarityClass(r){ return `rarity-${(r||'').toLowerCase()}`; }

import { getFxSettings } from '../state/settings.js';

export function renderDragOpen(root, { packImage, picks, ownedSet, onFinish }){
  const overlay = document.createElement('div');
  overlay.className = 'open-overlay';

  const panel = document.createElement('div');
  panel.className = 'open-panel';

  const topbar = document.createElement('div');
  topbar.className = 'open-topbar';
  const title = document.createElement('div'); title.textContent = 'Ouverture de booster';
  topbar.append(title);

  const stand = document.createElement('div'); stand.className = 'booster-stand';
  const booster = document.createElement('div'); booster.className = 'booster-3d';
  setBg(booster, '/assets/packs/' + packImage);
  const handle = document.createElement('div'); handle.className = 'tear-handle';
  const rip = document.createElement('div'); rip.className = 'rip-line';

  booster.append(handle, rip);
  stand.appendChild(booster);

  const btnStore = document.createElement('button');
  btnStore.textContent = 'Ranger mes cartes';
  btnStore.style.display = 'none';

  panel.append(topbar, stand, btnStore);
  overlay.appendChild(panel);
  root.appendChild(overlay);

  // LEFT drag to tear across the top
  let dragging=false, startX=0, progress=0;
  function onDown(e){ dragging=true; startX = (e.touches?e.touches[0].clientX:e.clientX); handle.style.cursor='grabbing'; }
  function onMove(e){
    if(!dragging) return;
    const x = (e.touches?e.touches[0].clientX:e.clientX);
    progress = Math.max(0, Math.min(220, startX - x)); // move left to increase
    rip.style.width = progress + 'px';
  }
  async function onUp(){
    if(!dragging) return;
    dragging=false; handle.style.cursor='grab';
    if (progress > 120) {
      await tearTimeline(progress);
      await openPack();
    } else {
      await smooth(rip, 'width', progress, 0, 160);
    }
  }
  handle.addEventListener('mousedown', onDown); handle.addEventListener('touchstart', onDown, { passive:true });
  window.addEventListener('mousemove', onMove); window.addEventListener('touchmove', onMove, { passive:true });
  window.addEventListener('mouseup', onUp); window.addEventListener('touchend', onUp, { passive:true });

  // Tiny GSAP-like helpers
  function easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }
  function now(){ return performance.now(); }
  async function smooth(node, cssProp, from, to, dur=240){
    const t0 = now();
    const diff = to - from;
    while (true) {
      const t = (now() - t0) / dur;
      if (t >= 1) break;
      const v = from + diff * easeOutCubic(t);
      node.style[cssProp] = (cssProp === 'opacity') ? String(v) : v + 'px';
      await raf();
    }
    node.style[cssProp] = (cssProp === 'opacity') ? String(to) : to + 'px';
  }

  async function tearTimeline(current){
    // 1) finish tear to full
    await smooth(rip, 'width', current, 220, 220);
    // 2) brief paper shake on the booster body
    booster.classList.add('booster-shake');
    await new Promise(res => setTimeout(res, 380));
    booster.classList.remove('booster-shake');
    // 3) snap away: fade + slight up
    booster.style.transition = 'transform 260ms ease, opacity 260ms ease';
    booster.style.transform = 'translateY(-8px)';
    booster.style.opacity = '0';
    await new Promise(res => setTimeout(res, 260));
    stand.removeChild(booster);
  }

  // After opening: row of flip cards with stagger + tilt on face-down
  let revealed = 0;
  const fx = getFxSettings();
  const audio = new Audio();
  audio.muted = !fx.audio_enabled;
  audio.volume = Math.max(0, Math.min(1, fx.audio_volume));

  async function openPack(){
    // Ensure booster gone
    stand.innerHTML = '';

    const rowStage = document.createElement('div'); rowStage.className = 'row-stage';
    const row = document.createElement('div'); row.className = 'fd-row';
    rowStage.appendChild(row);
    stand.appendChild(rowStage);

    picks.forEach((cardData, i) => {
      const fc = document.createElement('div');
      fc.className = 'flip-card pre';
      const inner = document.createElement('div');
      inner.className = 'flip-inner';
      const back = document.createElement('div');
      back.className = 'flip-face flip-back';
      const front = document.createElement('div');
      front.className = 'flip-face flip-front card ' + rarityClass(cardData.rarity);

      setBgWithFallback(back, '/assets/card_back.png', '/assets/card_back.png');
      setBgWithFallback(front, `/artworks/${cardData.id}.jpg`, '/assets/card_back.png');

      if (fx.visual_rays_enabled && ['Epic','Legendary','Mythical'].includes(cardData.rarity)) {
        const rays = document.createElement('div'); rays.className = 'fx-rays'; if (!fx.visual_rays_spin) { rays.style.animation = 'none'; rays.style.transform = 'none'; } rays.style.opacity = fx.visual_rays_opacity;
        if (fx.visual_burst_enabled) { const burst = document.createElement('div'); burst.className = 'fx-burst'; front.appendChild(burst); }
        front.appendChild(rays);
      } else if (cardData.rarity === 'Rare') {
        if (fx.visual_burst_enabled) { const burst = document.createElement('div'); burst.className = 'fx-burst'; front.appendChild(burst); }
        
      }
      if (fx.new_badge_enabled && !ownedSet?.has(cardData.id)) {
        const badge = document.createElement('div'); badge.className = 'badge-new'; badge.textContent = 'NEW!';
        front.appendChild(badge);
      }

      inner.append(back, front);
      fc.appendChild(inner);

      // Tilt 3D while face-down (only before first flip)
      fc.addEventListener('mousemove', (e) => {
        if (fc.classList.contains('flipped')) return;
        const rect = fc.getBoundingClientRect();
        const cx = rect.left + rect.width/2;
        const cy = rect.top + rect.height/2;
        const dx = (e.clientX - cx) / rect.width;  // [-0.5, 0.5]
        const dy = (e.clientY - cy) / rect.height;
        const tiltX = Math.max(-6, Math.min(6, -dy * 12));
        const tiltY = Math.max(-6, Math.min(6, dx * 12));
        fc.style.setProperty('--tiltX', tiltX + 'deg');
        fc.style.setProperty('--tiltY', tiltY + 'deg');
      });
      fc.addEventListener('mouseleave', () => {
        fc.style.setProperty('--tiltX', '0deg');
        fc.style.setProperty('--tiltY', '0deg');
      });

      // Flip on click
      fc.addEventListener('click', () => {
        if (fc.classList.contains('flipped')) return;
        fc.classList.add('flipped');
        const src = SFX[cardData.rarity] ?? SFX.Common;
        audio.src = bust(src); audio.currentTime = 0; audio.play().catch(()=>{});
        revealed++;
        if (revealed >= picks.length) btnStore.style.display = '';
      });

      row.appendChild(fc);

      // Staggered entrance
      const delay = 60 + Math.random() * 260; // 60–320ms
      setTimeout(() => fc.classList.remove('pre'), delay);
    });
  }

  btnStore.addEventListener('click', ()=> {
    overlay.remove();
    onFinish(picks);
  });
}
