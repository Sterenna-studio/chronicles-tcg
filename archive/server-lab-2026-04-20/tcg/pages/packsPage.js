// lab/tcg/pages/packsPage.js — v3.7.1 (quantitative list, keyboard, no Tab hijack)
import { getClient } from '../../shared/supaRaw.js';
import { getCachedPlayer } from '../../shared/supabaseData.js';
import { runOpeningFlow } from './openingRenderer.js';

export async function render(root){
  root.innerHTML = `
    <style>
      .packs-wrap { color:#dfe; }
      .packs-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:16px; }
      .pack-img { width:100%; aspect-ratio: 260 / 340; object-fit:cover; border-radius:12px; border:1px solid #223; display:block;
                  animation: oscillate 3.2s ease-in-out infinite; cursor:pointer; }
      @keyframes oscillate { 0%{ transform:translateY(0) } 50%{ transform:translateY(-6px) } 100%{ transform:translateY(0) } }
      .pack-img:hover, .pack-img.active { filter:brightness(1.08) contrast(1.04); outline:2px solid #8df; outline-offset:3px; }
    </style>
    <section class="packs-wrap">
      <h2>Boosters</h2>
      <div id="grid" class="packs-grid"></div>
    </section>
  `;

  const sb = await getClient();
  const player = getCachedPlayer();
  const { data: owned } = await sb.from('player_packs')
    .select('pack_type_id, quantity')
    .eq('player_id', player.id);

  const grid = root.querySelector('#grid');

  if (!owned || !owned.length){
    grid.innerHTML = `<div style="opacity:.75">Aucun booster.</div>`;
    return;
  }

  const ids = owned.map(r => r.pack_type_id);
  const { data: types } = await sb.from('pack_types')
    .select('id, name, set_id, image_name')
    .in('id', ids);

  const map = new Map((types||[]).map(t => [t.id, t]));
  const tiles = [];
  for (const row of owned){
    const t = map.get(row.pack_type_id);
    if (!t) continue;
    const img = t.image_name ? `/lab/shared/assets/packs/${t.image_name}` : `/lab/shared/assets/packs/${t.set_id}-default.jpg`;
    const count = Math.max(0, row.quantity|0);
    for (let i=0;i<count;i++){
      tiles.push({ img, set: t.set_id, packTypeId: t.id });
    }
  }
  for (let i=tiles.length-1;i>0;i--){ const j=(Math.random()*(i+1))|0; [tiles[i], tiles[j]]=[tiles[j], tiles[i]]; }

  tiles.forEach((t, idx)=>{
    const img = document.createElement('img');
    img.className = 'pack-img';
    img.src = t.img;
    img.dataset.index = String(idx);
    img.style.animationDelay = (Math.random()*0.8).toFixed(2)+'s';
    img.addEventListener('click', () => {
      runOpeningFlow(document.body, { setId: t.set, packTypeId: t.packTypeId, imageName: null });
    });
    grid.appendChild(img);
  });

  let active = 0, hold=null;
  const items = ()=>Array.from(grid.querySelectorAll('.pack-img'));
  const setActive = (i)=>{
    const arr = items();
    if (!arr.length) return;
    active = (i + arr.length) % arr.length;
    arr.forEach(el=>el.classList.remove('active'));
    arr[active].classList.add('active');
    arr[active].scrollIntoView({ block:'nearest', inline:'nearest' });
  };
  setActive(0);

  function openAtActive(){
    const arr = items(); if (!arr.length) return;
    const i = active; const t = tiles[i];
    if (t) runOpeningFlow(document.body, { setId: t.set, packTypeId: t.packTypeId, imageName: null });
  }

  function onKey(e){
    if (e.key==='ArrowRight') setActive(active+1);
    if (e.key==='ArrowLeft')  setActive(active-1);
    if (e.key==='Enter'){
      if (!hold){ hold=setTimeout(()=>{ openAtActive(); hold=null; }, 800); }
    }
  }
  function onKeyUp(e){
    if (e.key==='Enter' && hold){ clearTimeout(hold); hold=null; }
  }
  document.addEventListener('keydown', onKey);
  document.addEventListener('keyup', onKeyUp);
  root.addEventListener('removed', ()=>{
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('keyup', onKeyUp);
  });

  function onRefresh(){ render(root); }
  window.addEventListener('tcg:refresh', onRefresh, { once:true });
}
