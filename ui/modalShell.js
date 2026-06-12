// ui/modalShell.js — v1
// Composant shell réutilisable pour tous les modals TCG.
// Modes : compact | default | fullscreen
// Features : drag, resize libre, persistance localStorage

const MODES = {
  compact:    { w: '480px',   h: '640px',   radius: '16px', inset: false },
  default:    { w: '1100px',  h: '90vh',    radius: '16px', inset: false },
  fullscreen: { w: '100vw',  h: '100vh',   radius: '0',    inset: true  },
};

const MODE_ICONS = { compact: '⊡', default: '▣', fullscreen: '⛶' };
const MODE_LABELS = { compact: 'Compact', default: 'Normal', fullscreen: 'Plein écran' };

function loadPrefs(key) {
  try { return JSON.parse(localStorage.getItem(`tcg_modal_${key}`)) || {}; }
  catch { return {}; }
}
function savePrefs(key, data) {
  try { localStorage.setItem(`tcg_modal_${key}`, JSON.stringify(data)); } catch {}
}

/**
 * Crée et ouvre un modal shell.
 * @param {object} opts
 * @param {string}   opts.id          - clé unique (ex: 'shop') pour la persistance
 * @param {string}   opts.title       - titre dans le header
 * @param {string}  [opts.defaultMode]- 'compact'|'default'|'fullscreen'
 * @param {boolean} [opts.resizable]  - activer resize (défaut: true)
 * @param {boolean} [opts.draggable]  - activer drag (défaut: true)
 * @param {function} opts.render      - async (contentEl, shellAPI) => void
 * @returns {{ close: function, refresh: function }}
 */
export function openModalShell(opts) {
  const { id, title, render, defaultMode = 'default', resizable = true, draggable = true } = opts;
  const prefs = loadPrefs(id);
  let currentMode = prefs.mode || defaultMode;

  // ── Overlay ──────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.style.cssText = [
    'position:fixed;inset:0;',
    'background:rgba(0,0,0,.78);',
    'backdrop-filter:blur(3px);',
    'z-index:10000;',
    'display:grid;place-items:center;',
  ].join('');

  // ── Wrapper (le modal lui-même) ───────────────────────────────
  const wrap = document.createElement('div');
  wrap.style.cssText = [
    'display:flex;flex-direction:column;',
    'background:#070d14;',
    'border:1px solid #0e2a1f;',
    'color:#c8ffe8;',
    'font-family:ui-sans-serif,system-ui,-apple-system;',
    'position:relative;',
    'transition:width .18s ease, height .18s ease, border-radius .18s ease;',
    'overflow:hidden;',
    resizable ? 'resize:both;' : '',
  ].join('');

  // ── Header ───────────────────────────────────────────────────
  const header = document.createElement('div');
  header.style.cssText = [
    'display:flex;align-items:center;justify-content:space-between;',
    'padding:11px 16px;',
    'border-bottom:1px solid #0e2a1f;',
    'flex-shrink:0;',
    'user-select:none;',
    draggable ? 'cursor:grab;' : '',
  ].join('');

  const titleEl = document.createElement('div');
  titleEl.style.cssText = 'font-weight:700;letter-spacing:.08em;font-size:.9em;';
  titleEl.textContent = title;

  const controls = document.createElement('div');
  controls.style.cssText = 'display:flex;gap:6px;align-items:center;';

  // Boutons de mode
  Object.keys(MODES).forEach(mode => {
    const btn = document.createElement('button');
    btn.dataset.mode = mode;
    btn.title = MODE_LABELS[mode];
    btn.textContent = MODE_ICONS[mode];
    btn.style.cssText = [
      'background:transparent;border:1px solid #1a4030;',
      'color:#5af0b0;padding:3px 7px;cursor:pointer;',
      'font-size:.85em;border-radius:4px;',
      'transition:background .12s,border-color .12s;',
    ].join('');
    btn.addEventListener('mouseenter', () => { btn.style.background = '#0e2a1f'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = 'transparent'; });
    btn.addEventListener('click', () => applyMode(mode));
    controls.appendChild(btn);
  });

  // Bouton fermer
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = [
    'background:transparent;border:1px solid #ff2d4e;',
    'color:#ff2d4e;padding:3px 9px;cursor:pointer;',
    'font-size:.8em;border-radius:4px;margin-left:4px;',
  ].join('');
  closeBtn.addEventListener('click', close);
  controls.appendChild(closeBtn);

  header.appendChild(titleEl);
  header.appendChild(controls);

  // ── Zone de contenu ──────────────────────────────────────────
  const content = document.createElement('div');
  content.style.cssText = 'flex:1;overflow:auto;min-height:0;';

  wrap.appendChild(header);
  wrap.appendChild(content);
  overlay.appendChild(wrap);
  document.body.appendChild(overlay);

  // ── Appliquer mode ───────────────────────────────────────────
  function applyMode(mode) {
    currentMode = mode;
    const m = MODES[mode];
    if (m.inset) {
      // Fullscreen : le wrap prend toute la place dans l'overlay
      Object.assign(overlay.style, { padding: '0' });
      Object.assign(wrap.style, {
        width: '100vw', maxWidth: '100vw',
        height: '100vh', maxHeight: '100vh',
        borderRadius: '0', resize: 'none',
      });
    } else {
      Object.assign(overlay.style, { padding: '20px' });
      Object.assign(wrap.style, {
        width: `min(${m.w}, 95vw)`,
        maxWidth: '95vw',
        height: prefs.h || m.h,
        maxHeight: '95vh',
        borderRadius: m.radius,
        resize: resizable ? 'both' : 'none',
      });
      // Restaurer taille manuelle sauvegardée
      if (prefs.w && mode === (prefs.mode || defaultMode)) {
        wrap.style.width  = prefs.w;
        wrap.style.height = prefs.h;
      }
    }
    // Highlight bouton actif
    controls.querySelectorAll('[data-mode]').forEach(b => {
      const active = b.dataset.mode === mode;
      b.style.borderColor = active ? '#00f5c4' : '#1a4030';
      b.style.color        = active ? '#00f5c4' : '#5af0b0';
    });
    savePrefs(id, { ...loadPrefs(id), mode });
  }

  applyMode(currentMode);

  // ── Persistance taille resize ────────────────────────────────
  if (resizable) {
    const ro = new ResizeObserver(() => {
      if (currentMode === 'fullscreen') return;
      savePrefs(id, { ...loadPrefs(id), w: wrap.style.width, h: wrap.style.height });
    });
    ro.observe(wrap);
  }

  // ── Drag ─────────────────────────────────────────────────────
  if (draggable) {
    let dragging = false, ox = 0, oy = 0;
    // Sortir du grid pour pouvoir positionner librement
    function startDrag(e) {
      if (e.target.closest('button')) return;
      if (currentMode === 'fullscreen') return;
      dragging = true;
      const r = wrap.getBoundingClientRect();
      ox = e.clientX - r.left;
      oy = e.clientY - r.top;
      wrap.style.transition = 'none';
      // Passage en position absolue dans l'overlay
      overlay.style.display = 'block';
      Object.assign(wrap.style, {
        position: 'absolute',
        left: r.left + 'px',
        top:  r.top  + 'px',
        margin: '0',
      });
      header.style.cursor = 'grabbing';
    }
    function onDrag(e) {
      if (!dragging) return;
      wrap.style.left = (e.clientX - ox) + 'px';
      wrap.style.top  = (e.clientY - oy) + 'px';
    }
    function stopDrag() {
      if (!dragging) return;
      dragging = false;
      header.style.cursor = 'grab';
      wrap.style.transition = 'width .18s ease, height .18s ease, border-radius .18s ease';
    }
    header.addEventListener('mousedown', startDrag);
    window.addEventListener('mousemove', onDrag);
    window.addEventListener('mouseup', stopDrag);
  }

  // ── Fermeture ────────────────────────────────────────────────
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  const onEsc = e => { if (e.key === 'Escape') close(); };
  window.addEventListener('keydown', onEsc);

  function close() {
    overlay.remove();
    window.removeEventListener('keydown', onEsc);
  }

  // ── API publique ─────────────────────────────────────────────
  const shellAPI = { close, content };

  // Lancer le render
  Promise.resolve(render(content, shellAPI)).catch(console.error);

  return shellAPI;
}
