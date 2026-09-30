// lab/tcg/app/ui-shell.js — v3.9.4 (no gold in topbar, server-first player fetch)
import { navigate, next, boot as bootRouter } from './router.js';
import { initSession, initPlayer, refreshPlayer, getDisplayName } from '../../shared/supabaseData.js';

document.addEventListener('DOMContentLoaded', async () => {
  bootRouter();

  const top = document.getElementById('topbar');
  if (!top) return;

  const VERSION = window.TCG_VERSION || 'BZH TCG v3.x';

  top.innerHTML = `
    <style>
      .topbar-inner{display:flex;align-items:center;justify-content:space-between;gap:16px;
        padding:10px 14px;border-bottom:1px solid #1f2a3a;background:linear-gradient(180deg,#0c1420,#0a1018);}
      .brand{color:#89a3ff;opacity:.75;font-family:ui-monospace, monospace;font-size:12px;letter-spacing:.6px}
      .nav{display:flex;gap:8px}
      .btn-nav{border:1px solid #2a3a55;background:#0f1a28;color:#cfe;padding:6px 10px;border-radius:8px;cursor:pointer}
      .btn-nav:hover{filter:brightness(1.1)}
      .userbar{display:flex;align-items:center;gap:10px}
      .glitch{position:relative;display:inline-block;font-weight:800;font-size:14px;
        color:#d7e7ff;text-shadow:0 0 6px rgba(100,160,255,.8), 0 0 18px rgba(120,60,255,.4);letter-spacing:1.2px}
      .glitch::before,.glitch::after{content:attr(data-text);position:absolute;left:0;top:0;opacity:.85;mix-blend-mode:screen;filter:blur(.3px)}
      .glitch::before{color:#6ff;transform:translate(1px,0);animation:gl1 2.2s infinite linear}
      .glitch::after{color:#f6f;transform:translate(-1px,0);animation:gl2 2.1s infinite linear}
      @keyframes gl1{0%,100%{clip-path:inset(0 0 0 0)} 10%{clip-path:inset(0 0 40% 0)} 20%{clip-path:inset(60% 0 0 0)} 35%{clip-path:inset(10% 0 30% 0)} 55%{clip-path:inset(30% 0 10% 0)} 70%{clip-path:inset(0 0 50% 0)} 85%{clip-path:inset(50% 0 0 0)}}
      @keyframes gl2{0%,100%{clip-path:inset(0 0 0 0)} 15%{clip-path:inset(50% 0 0 0)} 25%{clip-path:inset(0 0 60% 0)} 40%{clip-path:inset(20% 0 25% 0)} 60%{clip-path:inset(35% 0 15% 0)} 80%{clip-path:inset(0 0 45% 0)}}
    </style>
    <div class="topbar-inner">
      <div class="brand">${VERSION}</div>
      <nav class="nav">
        <button class="btn-nav" data-nav="#/home">🏠 Accueil</button>
        <button class="btn-nav" data-nav="#/shop">🛒 Boutique</button>
        <button class="btn-nav" data-nav="#/collection">📚 Collection</button>
        <button class="btn-nav" data-nav="#/album">📖 Album</button>
      </nav>
      <div class="userbar"><span id="ub-name" class="glitch" data-text="…">…</span></div>
    </div>`;

  top.querySelectorAll('[data-nav]').forEach(b=>{
    b.addEventListener('click', e => navigate(e.currentTarget.dataset.nav));
  });

  document.addEventListener('keydown', (e)=>{
    const el = e.target;
    const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    if (e.key === ' ' && !typing){ e.preventDefault(); next(); }
  }, true);

  // Server-first to avoid stale name
  await initSession();
  await initPlayer();
  await refreshPlayer();

  refreshTopbarName();

  // Global helper unchanged
  window.tcgForceRefresh = async function(){
    try{ await refreshPlayer(); }catch(_){}
    window.dispatchEvent(new Event('tcg:refresh'));
    refreshTopbarName();
  };

  window.addEventListener('tcg:refresh', refreshTopbarName);
});

function refreshTopbarName(){
  const nameEl = document.getElementById('ub-name');
  if (!nameEl) return;
  const pseudo = getDisplayName();
  nameEl.textContent = pseudo; nameEl.setAttribute('data-text', pseudo);
}
