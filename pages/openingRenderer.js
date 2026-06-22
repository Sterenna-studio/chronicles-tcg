// pages/openingRenderer.js — v4.3.0
// Fix: all import paths corrected for TCG/pages/ location
import { openOnePack }                   from '../shared/packsRepo.js?v=3';
import { decrementPlayerPack }           from '../data/packsRepo.js?v=3';
import { getSettings }                   from '../app/ui-settings.js?v=3';
import { cardArtworkUrl }                from '../shared/assetHelpers.js?v=3';
import { burstParticles, celebrateCard } from '../shared/effects/animations.js?v=3';
import { saveCards }                     from '../data/cardsRepo.js?v=3';
import { syncStatsAfterPack }            from '../data/playersRepo.js?v=3';
import { getClient, getUser }            from '../logic/supaRaw.js?v=3';

const SFX = {
  common:    'common.mp3',
  rare:      'rare.mp3',
  epic:      'epic.mp3',
  legendary: 'legendary.mp3',
  mythical:  'mythical.mp3',
};

const HALO = {
  common:    'radial-gradient(circle at 50% 50%, rgba(70,140,255,.75), rgba(20,40,90,.0) 62%)',
  rare:      'radial-gradient(circle at 50% 50%, rgba(60,220,160,.75), rgba(10,40,30,.0) 62%)',
  epic:      'radial-gradient(circle at 50% 50%, rgba(170,120,255,.78), rgba(50,20,80,.0) 62%)',
  legendary: 'conic-gradient(from 0deg, rgba(70,140,255,.85) 0 33%, rgba(60,220,160,.85) 33% 66%, rgba(170,120,255,.85) 66% 100%)',
  mythical:  'conic-gradient(from var(--spin,0deg), rgba(70,140,255,.9), rgba(60,220,160,.9), rgba(170,120,255,.9), rgba(70,140,255,.9))',
};

function playOnceFactory(volume = 1.0) {
  return (rarity) => {
    const key  = String(rarity || 'common').toLowerCase();
    const file = SFX[key] || SFX.common;
    const a    = new Audio('/TCG/sounds/' + file);
    a.volume   = volume;
    a.play().catch(() => {});
  };
}

export async function runOpeningFlow(root, { setId = 'SET', packTypeId, imageName = null }) {
  const supabase = await getClient();
  const user     = await getUser();
  const userId   = user?.id ?? null;

  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', zIndex: '9998',
    display: 'grid', placeItems: 'center',
    background: '#070b11cc',
  });
  const wrap = document.createElement('div');
  Object.assign(wrap.style, { width: 'min(1200px,96vw)', userSelect: 'none' });
  overlay.appendChild(wrap);
  document.body.appendChild(overlay);

  const s       = getSettings();
  const volume  = Math.max(0, Math.min(100, ('volume' in s ? s.volume : 80))) / 100;
  const playSfx = playOnceFactory(volume);
  const packUrl = imageName
    ? `/TCG/assets/packs/${imageName}`
    : `/TCG/assets/packs/${setId}-default.jpg`;

  let _lastResults = [];

  wrap.innerHTML = `
  <style>
    @keyframes wobble       { 0%{transform:rotate(-1.5deg)} 50%{transform:rotate(1.5deg)} 100%{transform:rotate(-1.5deg)} }
    @keyframes wobbleStrong { 0%{transform:rotate(-6deg)}   50%{transform:rotate(6deg)}   100%{transform:rotate(-6deg)}   }
    @keyframes spin         { to{ --spin:360deg; } }
    .btn  { display:inline-flex;align-items:center;gap:8px;border:1px solid #357;background:#0d1620;color:#def;padding:10px 14px;border-radius:10px;cursor:pointer;font-weight:600; }
    .stage{ position:relative;width:100%;height:clamp(520px,64vh,780px);overflow:hidden; }
    .pack { width:340px;height:460px;margin:0 auto;position:relative;user-select:none;animation:wobble 3.2s ease-in-out infinite; }
    .pack.hold { animation:wobbleStrong .4s ease-in-out infinite; }
    .dragHint  { color:#8fb;text-align:center;margin:8px 0; }
    .halfoval  { position:absolute;inset:0; }
    .flip      { position:absolute;perspective:1000px;transform-origin:center;animation:wobble 3.4s ease-in-out infinite; }
    .flip-inner{ position:relative;width:100%;height:100%;transform-style:preserve-3d;transition:transform .5s; }
    .flipped .flip-inner { transform:rotateY(180deg); }
    .face  { position:absolute;inset:0;backface-visibility:hidden;border-radius:12px;overflow:hidden;border:1px solid #223;background:#0b0f14;display:grid;place-items:center; }
    .back  { transform:rotateY(180deg); }
    .halo  { position:absolute;inset:-12px;border-radius:14px;filter:blur(12px);opacity:.9;transition:opacity .2s,transform .2s;mix-blend-mode:screen; }
    .halo.mythical { animation:spin 2.4s linear infinite; }
    .flip:hover .halo { opacity:1;transform:scale(1.10); }
    .active { outline:2px solid #8df;outline-offset:3px;border-radius:14px; }
  </style>
  <div style="text-align:center;color:#bcd;margin-bottom:8px;font-size:18px;">
    Ouvrir un booster <b>${setId}</b> — Maintiens <b>clic</b> ou <b>Entrée</b>
  </div>
  <div id="stage" class="stage">
    <div id="pack" class="pack">
      <img id="front" src="${packUrl}"
           style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:12px;border:1px solid #234;"
           onerror="this.src='/TCG/assets/packs/default.jpg'"/>
    </div>
    <div id="hint" class="dragHint">Maintiens pour ouvrir…</div>
    <div id="cards" class="halfoval" style="display:none;"></div>
  </div>`;

  const packEl  = wrap.querySelector('#pack');
  const cardsEl = wrap.querySelector('#cards');
  const hint    = wrap.querySelector('#hint');
  let holdTimer = null, holding = false;
  const HOLD_MS = 900;

  function explode(target) {
    const rect = target.getBoundingClientRect();
    burstParticles(document.body, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  }

  async function finishOpen() {
    explode(packEl);
    packEl.style.display = 'none';
    hint.style.display   = 'none';
    if (packTypeId) {
      try { await decrementPlayerPack(packTypeId); } catch (e) { console.warn('decrement pack error:', e); }
    }
    return openOnePack({ packTypeId });
  }

  function onHoldStart() {
    if (holding) return;
    holding = true;
    packEl.classList.add('hold');
    holdTimer = setTimeout(async () => {
      try {
        const payload = await finishOpen();
        _lastResults  = payload.results;
        renderCards(payload.results);
      } catch (e) {
        hint.textContent     = e?.message || 'Erreur ouverture pack';
        packEl.style.display = '';
      }
    }, HOLD_MS);
  }
  function onHoldEnd() {
    if (!holding) return;
    holding = false;
    packEl.classList.remove('hold');
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
  }

  packEl.addEventListener('pointerdown',   onHoldStart);
  packEl.addEventListener('pointerup',     onHoldEnd);
  packEl.addEventListener('pointercancel', onHoldEnd);
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter') onHoldStart(); });
  document.addEventListener('keyup',   (e) => { if (e.key === 'Enter') onHoldEnd();   });

  function renderCards(results) {
    cardsEl.style.display = 'block';
    cardsEl.innerHTML     = '';
    const rect   = wrap.querySelector('#stage').getBoundingClientRect();
    const W = rect.width, H = rect.height, N = results.length;
    const estCardW = Math.min(180, Math.max(120, Math.min(W * 0.16, W / Math.max(3, Math.min(N + 1, 8)))));
    const estCardH = estCardW * 1.4;
    const Rx       = Math.max(W * 0.34, Math.min(W * 0.46, estCardW * 4.2));
    const Ry       = Math.min(Math.max(H * 0.24, estCardH * 0.8), H * 0.4);
    const start    = Math.PI, end = 2 * Math.PI;
    let flippedCount = 0, activeIndex = 0;

    results.forEach((card, i) => {
      const t      = i / (Math.max(1, N - 1));
      const angle  = start + t * (end - start);
      const x      = W / 2 + Math.cos(angle) * Rx;
      const y      = H * 0.62 + Math.sin(angle) * Ry;
      const rarity = String(card.rarity || 'common').toLowerCase();
      const halo   = HALO[rarity] || HALO.common;

      const cell = document.createElement('div');
      cell.className = 'flip';
      Object.assign(cell.style, {
        width:    estCardW + 'px',
        height:   estCardH + 'px',
        left:     (x - estCardW / 2) + 'px',
        top:      (y - estCardH / 2) + 'px',
        position: 'absolute',
        zIndex:   String(100 + i),
      });
      cell.setAttribute('data-index', String(i));
      cell.innerHTML = `
        <div class="halo${rarity === 'mythical' ? ' mythical' : ''}" style="background:${halo};box-shadow:0 0 24px rgba(140,160,255,.28) inset;"></div>
        <div class="flip-inner">
          <div class="face front"><img src="/TCG/assets/card_back.png" alt="back" style="width:100%;height:100%;object-fit:cover"/></div>
          <div class="face back" ><img src="${cardArtworkUrl(card.id)}" alt="${card.id}" style="width:100%;height:100%;object-fit:cover"/></div>
        </div>`;

      let revealed = false;
      const flip = async () => {
        if (cell.classList.contains('flipped')) return;
        cell.style.zIndex = '9997';
        cell.classList.add('flipped');
        if (!revealed) {
          playSfx(rarity);
          revealed = true;
          flippedCount++;
          if (rarity === 'legendary' || rarity === 'mythical') {
            await celebrateCard(document.body, { img: cardArtworkUrl(card.id), rarity, duration: 900 });
          }
          if (flippedCount >= N) await _doSave();
        }
      };
      cell.addEventListener('click', flip);
      cardsEl.appendChild(cell);
    });

    const setActive = (idx) => {
      const prev = cardsEl.querySelector('.active');
      if (prev) prev.classList.remove('active');
      activeIndex = (idx + N) % N;
      const el = cardsEl.querySelector(`.flip[data-index="${activeIndex}"]`);
      if (el) { el.classList.add('active'); el.style.zIndex = '9998'; }
    };
    setActive(0);

    function onKey(e) {
      if (cardsEl.style.display === 'none') return;
      if (e.key === 'ArrowLeft')  setActive(activeIndex - 1);
      if (e.key === 'ArrowRight') setActive(activeIndex + 1);
      if (e.key === 'Enter') cardsEl.querySelector(`.flip[data-index="${activeIndex}"]`)?.click();
    }
    document.addEventListener('keydown', onKey, { capture: true });

    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn';
    Object.assign(closeBtn.style, {
      position: 'fixed', bottom: '24px', left: '50%',
      transform: 'translateX(-50%)', zIndex: '9999', display: 'none',
    });
    closeBtn.textContent = '\u2713 Fermer';
    closeBtn.addEventListener('click', () => {
      document.body.removeChild(overlay);
      document.removeEventListener('keydown', onKey, { capture: true });
      window.dispatchEvent(new Event('tcg:refresh'));
    });
    overlay.appendChild(closeBtn);

    async function _doSave() {
      if (!supabase || !userId) return;
      try {
        await saveCards(supabase, userId, _lastResults);
        await syncStatsAfterPack(supabase, userId, _lastResults);
        closeBtn.style.display = 'inline-flex';
      } catch (e) {
        console.error('save error:', e);
        closeBtn.textContent   = '\u26a0 Erreur save \u2014 Fermer quand m\u00eame';
        closeBtn.style.display = 'inline-flex';
      }
    }
  }
}
