function bust(url){ return `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`; }

// Set the background image of an element.  The URL is cache‑busted each call.
function setBg(el, url){ el.style.backgroundImage = `url(${bust(url)})`; }

// Set a background image on el, falling back to a default if the first image fails.
function setBgWithFallback(el, url, fallback){
  const u = bust(url), f = bust(fallback);
  const img = new Image();
  img.onload = () => setBg(el, url);
  img.onerror = () => setBg(el, fallback);
  img.src = u;
}

// RequestAnimationFrame wrapper returning a promise for easy async/await usage.
function raf(){ return new Promise(requestAnimationFrame); }

// Success sounds live in /www/lab/tcg_beta/sounds.  Prefix the path so that it
// resolves correctly on all pages.
const SFX = {
  Common: '/www/lab/tcg_beta/sounds/common.mp3',
  Rare: '/www/lab/tcg_beta/sounds/rare.mp3',
  Epic: '/www/lab/tcg_beta/sounds/epic.mp3',
  Legendary: '/www/lab/tcg_beta/sounds/legendary.mp3',
  Mythical: '/www/lab/tcg_beta/sounds/mythical.mp3',
};

// Convert rarity into a CSS class name.
function rarityClass(r){ return `rarity-${(r||'').toLowerCase()}`; }

// Compute the correct artwork URL for a given card ID.  Artworks live under
// /lab/shared/assets/artworks/SETXX/ where XX is the numeric part extracted from the prefix.
function cardArtworkUrl(id) {
  const prefix = String(id).split('_')[0];
  const match = prefix.match(/(\d+)/);
  const num = match ? String(parseInt(match[1], 10)).padStart(2, '0') : '';
  const dir = num ? `SET${num}` : prefix;
  return `/lab/shared/assets/artworks/${dir}/${id}.jpg`;
}

import { getFxSettings } from '../state/settings.js';

/**
 * Render the drag‑to‑open booster overlay.  This version restores the original
 * drag gesture: a handle appears on the booster, the player drags it to tear
 * open the pack from right to left, and upon completion a row of flip cards is
 * displayed.  Several improvements have been applied: sound paths are
 * absolute, artwork paths point into the shared assets folder, and the booster
 * shake uses a gentler motion.  The tear direction has been corrected so that
 * the tear follows the cursor movement.
 *
 * @param {HTMLElement} root The element to append the overlay into.
 * @param {Object} opts Options including packImage, picks, ownedSet, onFinish.
 */
export function renderDragOpen(root, { packImage, picks, ownedSet, onFinish }){
  const overlay = document.createElement('div');
  overlay.className = 'open-overlay neon-bg';

  const panel = document.createElement('div');
  panel.className = 'open-panel';

  const topbar = document.createElement('div');
  topbar.className = 'open-topbar';
  const title = document.createElement('div');
  title.textContent = 'Ouverture de booster';
  topbar.append(title);

  const stand = document.createElement('div'); stand.className = 'booster-stand';
  const booster = document.createElement('div'); booster.className = 'booster-3d';
  // Use the shared pack artwork from /lab/shared/assets/packs
  setBg(booster, '/lab/shared/assets/packs/' + packImage);
  const handle = document.createElement('div'); handle.className = 'tear-handle';
  const rip = document.createElement('div'); rip.className = 'rip-line';
  // Remove any horizontal inversion on the tear line.  The rip should grow
  // naturally to the left as the user drags the handle leftwards.  Scaling
  // the line negatively on the X axis caused the tear to move opposite the
  // cursor direction on some browsers, so we avoid applying any transform.

  booster.append(handle, rip);
  stand.appendChild(booster);

  const btnStore = document.createElement('button');
  btnStore.textContent = 'Ranger mes cartes';
  btnStore.style.display = 'none';

  panel.append(topbar, stand, btnStore);
  overlay.appendChild(panel);
  root.appendChild(overlay);

  // Drag logic: player clicks and drags the handle leftwards across the top to tear.
  let dragging = false, startX = 0, progress = 0;
  function onDown(e){ dragging = true; startX = (e.touches ? e.touches[0].clientX : e.clientX); handle.style.cursor='grabbing'; }
  function onMove(e){
    if (!dragging) return;
    const x = (e.touches ? e.touches[0].clientX : e.clientX);
    // Progress increases as the mouse moves to the left.  Clamp to [0,220].
    // Increase progress as the cursor moves to the right.  This matches the
    // tear line anchored on the left edge.  Clamp progress to the max width.
    progress = Math.max(0, Math.min(220, x - startX));
    rip.style.width = progress + 'px';
  }
  async function onUp(){
    if (!dragging) return;
    dragging = false;
    handle.style.cursor = 'grab';
    if (progress > 120) {
      await tearTimeline(progress);
      await openPack();
    } else {
      await smooth(rip, 'width', progress, 0, 160);
    }
  }
  handle.addEventListener('mousedown', onDown);
  handle.addEventListener('touchstart', onDown, { passive:true });
  window.addEventListener('mousemove', onMove);
  window.addEventListener('touchmove', onMove, { passive:true });
  window.addEventListener('mouseup', onUp);
  window.addEventListener('touchend', onUp, { passive:true });

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

  // The timeline executed once the tear threshold is exceeded: finish the tear,
  // shake the booster and then slide/fade it away.
  async function tearTimeline(current) {
    // Finish tear to the maximum width.
    await smooth(rip, 'width', current, 220, 220);
    // Brief paper shake on the booster body.  The CSS animation .booster-shake
    // uses a subtle amplitude defined in style.css.
    booster.classList.add('booster-shake');
    await new Promise(res => setTimeout(res, 380));
    booster.classList.remove('booster-shake');
    // Snap away: fade + slight up translation.
    booster.style.transition = 'transform 260ms ease, opacity 260ms ease';
    booster.style.transform = 'translateY(-8px)';
    booster.style.opacity = '0';
    await new Promise(res => setTimeout(res, 260));
    stand.removeChild(booster);
  }

  // After opening: create a row of flip cards with staggered entrance and tilt on hover.
  let revealed = 0;
  const fx = getFxSettings();
  const audio = new Audio();
  audio.muted = !fx.audio_enabled;
  audio.volume = Math.max(0, Math.min(1, fx.audio_volume));

  async function openPack(){
    // Remove remaining elements in the stand (booster and rip line).
    stand.innerHTML = '';

    const rowStage = document.createElement('div');
    rowStage.className = 'row-stage';
    const row = document.createElement('div');
    row.className = 'fd-row';
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

      // Use the shared card_back image.  Both normal and fallback are the same.
      setBgWithFallback(back, '/lab/shared/assets/card_back.png', '/lab/shared/assets/card_back.png');
      setBgWithFallback(front, cardArtworkUrl(cardData.id), '/lab/shared/assets/card_back.png');

      // Apply visual rays and burst based on rarity and FX settings.  These
      // effects are only attached to the front of the card.  New badges are
      // added if the player does not yet own the card.
      if (fx.visual_rays_enabled && ['Epic','Legendary','Mythical'].includes(cardData.rarity)) {
        const rays = document.createElement('div');
        rays.className = 'fx-rays';
        if (!fx.visual_rays_spin) {
          rays.style.animation = 'none';
          rays.style.transform = 'none';
        }
        rays.style.opacity = fx.visual_rays_opacity;
        front.appendChild(rays);
        if (fx.visual_burst_enabled) {
          const burst = document.createElement('div');
          burst.className = 'fx-burst';
          front.appendChild(burst);
        }
      } else if (cardData.rarity === 'Rare') {
        if (fx.visual_burst_enabled) {
          const burst = document.createElement('div');
          burst.className = 'fx-burst';
          front.appendChild(burst);
        }
      }
      // Show NEW badge if the player does not yet own this card.
      if (fx.new_badge_enabled && !ownedSet?.has(cardData.id)) {
        const badge = document.createElement('div');
        badge.className = 'badge-new';
        badge.textContent = 'NEW!';
        front.appendChild(badge);
      }

      // Create a rarity hint on the back of the card.  When the player hovers
      // over a face‑down card, this hint fades in to 50% opacity to give a
      // subtle indication of the card’s rarity.  It disappears when the
      // pointer leaves or the card is flipped.  Only attach this element
      // when visual rays are enabled and the rarity is at least Rare.
      let backRays;
      if (fx.visual_rays_enabled && ['Rare','Epic','Legendary','Mythical'].includes(cardData.rarity)) {
        backRays = document.createElement('div');
        backRays.className = 'fx-rays';
        if (!fx.visual_rays_spin) {
          backRays.style.animation = 'none';
          backRays.style.transform = 'none';
        }
        backRays.style.opacity = '0';
        backRays.style.transition = 'opacity 0.6s ease';
        back.appendChild(backRays);
      }

      inner.append(back, front);
      fc.appendChild(inner);

      // When hovering a face‑down card, gradually reveal the backRays hint.
      if (backRays) {
        fc.addEventListener('mouseenter', () => {
          if (!fc.classList.contains('flipped')) {
            backRays.style.opacity = '0.5';
          }
        });
        fc.addEventListener('mouseleave', () => {
          if (!fc.classList.contains('flipped')) {
            backRays.style.opacity = '0';
          }
        });
        fc.addEventListener('click', () => {
          backRays.style.opacity = '0';
        });
      }

      // Tilt 3D while face-down (only before first flip)
      fc.addEventListener('mousemove', (e) => {
        if (fc.classList.contains('flipped')) return;
        const rect = fc.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
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
        audio.src = bust(src);
        audio.currentTime = 0;
        audio.play().catch(() => {});
        revealed++;
        if (revealed >= picks.length) btnStore.style.display = '';
      });

      row.appendChild(fc);

      // Staggered entrance
      const delay = 60 + Math.random() * 260; // 60–320ms
      setTimeout(() => fc.classList.remove('pre'), delay);
    });
  }

  btnStore.addEventListener('click', () => {
    overlay.remove();
    onFinish(picks);
  });
}