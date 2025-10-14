// pages/collection/collection.js — v5
function qs(sel, root=document){ return root.querySelector(sel); }
function qsa(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

document.addEventListener('DOMContentLoaded', async () => {
  await buildSetSelector();
});

export async function buildSetSelector() {
  let bar = qs('.collection-topbar');
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'collection-topbar set-selector';
    const mount = qs('#collection') || document.body;
    mount.parentNode.insertBefore(bar, mount);
  }
  bar.innerHTML = '';

  const sets = [];
  for (let i = 1; i <= 99; i++) {
    const id = `bzh_set${String(i).padStart(2, '0')}`;
    try {
      const res = await fetch(`../../data/${id}.json`, { method: 'HEAD' });
      if (res.ok) sets.push(id);
    } catch (_) {}
  }

  if (!sets.length) return [];

  sets.forEach((setId, idx) => {
    const btn = document.createElement('button');
    btn.textContent = `Set ${idx + 1}`;
    btn.dataset.setId = setId;
    btn.addEventListener('click', () => {
      qsa('.set-selector button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderSet(setId);
    });
    bar.appendChild(btn);
  });

  const first = bar.querySelector('button');
  if (first) { first.classList.add('active'); renderSet(first.dataset.setId); }

  return sets;
}

export async function renderSet(setId) {
  const grid = qs('#collection-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const res = await fetch(`../../data/${setId}.json`);
  if (!res.ok) return;
  const cards = await res.json();

  cards.forEach(card => {
    const el = document.createElement('div');
    el.className = 'card sleeve';
    el.innerHTML = `<img loading="lazy" src='../../artworks/${card.id}.jpg' alt='${card.name}'>`;
    el.addEventListener('click', () => showPopup(card));
    grid.appendChild(el);
  });
}

export function showPopup(card) {
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position:'fixed', inset:'0', background:'rgba(0,0,0,.75)',
    zIndex:'9999', display:'grid', placeItems:'center'
  });
  const box = document.createElement('div');
  Object.assign(box.style, {
    width:'min(760px, 92vw)', maxHeight:'90vh', overflow:'auto',
    background:'#111', color:'#eee', padding:'16px', borderRadius:'12px',
    boxShadow:'0 10px 40px rgba(0,0,0,.6)'
  });
  box.innerHTML = `
    <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">
      <img src='../../artworks/${card.id}.jpg' alt='${card.name}'
           style='width:280px;max-width:100%;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.5)' />
      <div style="min-width:240px;flex:1">
        <h2 style="margin:0 0 8px">${card.name}</h2>
        <div style="opacity:.85;margin-bottom:8px">Type: <b>${card.type}</b></div>
        <div style="opacity:.85;margin-bottom:12px">Rareté: <b>${card.rarity}</b></div>
        <p style="line-height:1.5">${card.desc || ''}</p>
      </div>
    </div>
    <div style="margin-top:16px;display:flex;justify-content:flex-end">
      <button id="close" style="background:#333;color:#fff;border:0;border-radius:8px;padding:8px 12px;cursor:pointer">Fermer (Esc)</button>
    </div>
  `;
  overlay.appendChild(box);
  const close = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  box.querySelector('#close')?.addEventListener('click', close);
  window.addEventListener('keydown', function onEsc(e){
    if (e.key === 'Escape') { close(); window.removeEventListener('keydown', onEsc); }
  });
  document.body.appendChild(overlay);
}
