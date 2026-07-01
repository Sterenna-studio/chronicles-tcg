// ui/cardPreview.js — Aperçu d'une carte en grand (clic droit / appui long).
//
// Composant PARTAGÉ et autonome : importé par l'Atelier, le combat, le
// déploiement et le tuto pour offrir partout le même geste « voir la carte en
// grand ». N'a aucune dépendance applicative hormis le résolveur de chemin.
//
//   import { attachCardPreview } from '../../ui/cardPreview.js?v=24';
//   attachCardPreview(el, card);              // carte fixe
//   attachCardPreview(el, () => slot.champion); // carte calculée à l'ouverture
//
// Geste : clic droit (contextmenu, menu natif supprimé) sur desktop, appui long
// (~450 ms) sur tactile. Fermeture : fond, ✕, ou Échap.
import { url } from '../logic/paths.js?v=24';

const RC = { Common:'#9da7b3', Rare:'#42b0ff', Epic:'#bb55d3', Legendary:'#ffbe46', Mythical:'#ff5080' };
const TI = { Champion:'⚔️', Companion:'🐾', Event:'⚡', Object:'🔧', Special:'✨', Terrain:'🌍', Team:'👥' };
const ROLE = { Object:'passif', Companion:'passif', Special:'actif récurrent', Event:'1×/combat', Team:'1×/combat', Terrain:'terrain d\'équipe' };

const cardImg = (id) => url(`/assets/cards/${id}.jpg`);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

let openOverlay = null;   // un seul aperçu à la fois

/** Ferme l'aperçu ouvert (s'il y en a un). */
export function closeCardPreview() {
  if (!openOverlay) return;
  openOverlay.remove();
  document.removeEventListener('keydown', onKey, true);
  openOverlay = null;
}
function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); closeCardPreview(); } }

/**
 * Affiche une carte en grand au centre de l'écran.
 * @param {object} card  carte {id,name,type,rarity,energy,power,shield,desc|description,skill?,slots?}
 * @param {object} [opts] { qty?:number } — quantité possédée à afficher (optionnel)
 */
export function showCardPreview(card, opts = {}) {
  if (!card) return;
  closeCardPreview();

  const rc = RC[card.rarity] || '#9da7b3';
  const role = ROLE[card.type];
  const desc = card.desc || card.description || '';
  const skill = card.skill;            // champions seulement (présent en combat)
  const isTerrain = card.type === 'Terrain';
  const qty = opts.qty;

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:10200;display:grid;place-items:center;padding:20px;font-family:"Share Tech Mono","Courier New",monospace;animation:cardprev-in .14s ease-out';

  const stat = (icon, label, val) => `
    <div style="flex:1;min-width:70px;background:#060c10;border:1px solid ${rc}33;border-radius:8px;padding:8px 6px;text-align:center">
      <div style="font-size:1.25em">${icon}</div>
      <div style="font-size:1.15em;color:${rc};font-weight:700;line-height:1.1">${val}</div>
      <div style="font-size:.58em;color:#5a7a6a;letter-spacing:.05em">${label}</div>
    </div>`;

  const modal = document.createElement('div');
  modal.style.cssText = `width:min(640px,96vw);max-height:92vh;overflow:auto;background:#05080d;border:1px solid ${rc};border-radius:16px;color:#c8ffe8;box-shadow:0 0 48px ${rc}44;display:flex;flex-direction:column`;
  modal.innerHTML = `
    <div style="position:relative;display:flex;flex-wrap:wrap;gap:14px;padding:16px">
      <button id="cp-close" style="position:absolute;top:10px;right:10px;z-index:2;background:rgba(0,0,0,.7);border:1px solid #ff2d4e;color:#ff2d4e;padding:3px 11px;cursor:pointer;font-family:inherit;font-size:.85em;border-radius:6px">✕</button>
      <div style="flex:1 1 230px;min-width:200px;max-width:300px;margin:0 auto">
        <img src="${cardImg(card.id)}" alt="${esc(card.name)}"
          style="width:100%;aspect-ratio:2/3;object-fit:contain;background:#060c10;border-radius:10px;border:1px solid ${rc}44"
          onerror="this.style.display='none';this.parentNode.style.minHeight='240px'">
      </div>
      <div style="flex:2 1 280px;min-width:240px;display:flex;flex-direction:column;gap:12px">
        <div>
          <div style="font-size:1.15em;font-weight:700;color:${rc};line-height:1.25">${esc(card.name)}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
            <span style="background:${rc}1a;border:1px solid ${rc};color:${rc};padding:3px 10px;border-radius:20px;font-size:.72em;font-weight:700">${esc(card.rarity || '')}</span>
            <span style="background:#0e2a1f;border:1px solid #2a3a4a;color:#8ab;padding:3px 10px;border-radius:20px;font-size:.72em">${TI[card.type] || '📄'} ${esc(card.type || '')}${role ? ` · ${role}` : ''}</span>
            <span style="background:#0e2a1f;border:1px solid #2a3a4a;color:#5a7a6a;padding:3px 10px;border-radius:20px;font-size:.72em">${esc(card.id)}</span>
            ${qty != null ? `<span style="background:${qty > 0 ? rc : '#1a1a1a'};color:${qty > 0 ? '#000' : '#666'};padding:3px 10px;border-radius:20px;font-size:.72em;font-weight:700">${qty > 0 ? `×${qty}` : 'non possédée'}</span>` : ''}
          </div>
        </div>
        <div style="display:flex;gap:8px">
          ${stat('⚡', 'ÉNERGIE', card.energy ?? 0)}
          ${stat('⚔️', 'PUISSANCE', card.power ?? 0)}
          ${stat('🛡️', 'BOUCLIER', card.shield ?? 0)}
        </div>
        ${skill ? `
        <div style="background:#04140f;border:1px solid ${rc}55;border-radius:10px;padding:10px 12px">
          <div style="font-size:.72em;color:${rc};letter-spacing:.08em;margin-bottom:4px">✨ SKILL — ${esc(skill.name || '')}${skill.cooldown ? ` · ⏳ ${skill.cooldown} tours` : ''}</div>
          <div style="font-size:.82em;color:#bfe;line-height:1.45">${esc(skill.desc || skill.description || '')}</div>
        </div>` : ''}
        ${isTerrain ? `<div style="font-size:.74em;color:#9be15d;background:#0a140a;border:1px solid #2a4a1a;border-radius:8px;padding:8px 10px">🌍 Terrain d'équipe — +1 dégât / +1 garde pour toute l'escouade.</div>` : ''}
        ${desc ? `<div style="font-size:.85em;color:#8ab4a0;line-height:1.5;border-left:2px solid ${rc}44;padding-left:10px;font-style:italic">${esc(desc)}</div>` : ''}
      </div>
    </div>`;

  overlay.appendChild(modal);
  if (!document.getElementById('cardprev-style')) {
    const st = document.createElement('style');
    st.id = 'cardprev-style';
    st.textContent = '@keyframes cardprev-in{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}';
    document.head.appendChild(st);
  }
  document.body.appendChild(overlay);
  openOverlay = overlay;

  modal.querySelector('#cp-close').addEventListener('click', closeCardPreview);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeCardPreview(); });
  document.addEventListener('keydown', onKey, true);
}

/**
 * Câble le geste « voir en grand » sur un élément.
 * @param {HTMLElement} el
 * @param {object|function} card  carte, ou fonction renvoyant la carte à l'ouverture
 * @param {object} [opts] passé tel quel à showCardPreview (ex: {qty})
 * @returns {HTMLElement} el (chaînable)
 */
export function attachCardPreview(el, card, opts = {}) {
  if (!el) return el;
  const resolve = () => (typeof card === 'function' ? card() : card);
  el.style.cursor = el.style.cursor || 'pointer';

  el.addEventListener('contextmenu', (e) => {
    const c = resolve();
    if (!c) return;
    e.preventDefault();
    e.stopPropagation();
    showCardPreview(c, typeof opts === 'function' ? opts() : opts);
  });

  // Appui long (tactile) — sans casser le tap/scroll normal.
  let timer = null, sx = 0, sy = 0;
  const clear = () => { if (timer) { clearTimeout(timer); timer = null; } };
  el.addEventListener('touchstart', (e) => {
    const t = e.touches[0]; sx = t.clientX; sy = t.clientY;
    clear();
    timer = setTimeout(() => {
      timer = null;
      const c = resolve();
      if (c) showCardPreview(c, typeof opts === 'function' ? opts() : opts);
    }, 450);
  }, { passive: true });
  el.addEventListener('touchmove', (e) => {
    const t = e.touches[0];
    if (Math.abs(t.clientX - sx) > 10 || Math.abs(t.clientY - sy) > 10) clear();
  }, { passive: true });
  el.addEventListener('touchend', clear, { passive: true });
  el.addEventListener('touchcancel', clear, { passive: true });

  return el;
}
