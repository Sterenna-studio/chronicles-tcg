// lab/tcg/pages/collectionPage.js — v3.7.1
import { getCollection, loadSetData } from '../../shared/packsRepo.js';
import { cardArtworkUrl } from '../../shared/assetHelpers.js';

function modal(content){
  const o=document.createElement('div');Object.assign(o.style,{position:'fixed',inset:'0',background:'rgba(0,0,0,.65)',display:'grid',placeItems:'center',zIndex:9999}); 
  const c=document.createElement('div');Object.assign(c.style,{maxWidth:'980px',width:'92vw',background:'#0b0f14',border:'1px solid #234',borderRadius:'14px',padding:'16px',color:'#dfe'}); 
  c.innerHTML=content; o.appendChild(c); o.addEventListener('click',e=>{if(e.target===o)o.remove()}); document.body.appendChild(o);
}

export async function render(root){
  root.innerHTML = `
    <style>
      .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:12px; }
      .card { border:1px solid #233; border-radius:12px; background:#0b0f14; padding:0; color:#dfe; cursor:pointer; overflow:hidden; }
      .thumb { width:100%; aspect-ratio: var(--card-ar, 0.711); object-fit:cover; display:block; }
      .meta { display:flex; justify-content:space-between; padding:8px 10px; font-size:13px; color:#bcd; background:#0a1118; border-top:1px solid #223; }
      .badge { border:1px solid #2a415d; background:#132030; padding:1px 6px; border-radius:8px; }
      .toolbar { display:flex; gap:10px; align-items:end; flex-wrap:wrap; margin-bottom:10px; }
    </style>
    <section>
      <h2>Collection</h2>
      <div class="toolbar">
        <label>Set: <input id="set-id" value="BZH01" style="width:120px;"/></label>
        <label>Filtre type: 
          <select id="f-type">
            <option value="">(tous)</option>
            <option>Champion</option><option>Companion</option><option>Event</option>
            <option>Object</option><option>Special</option><option>Terrain</option>
          </select>
        </label>
        <label>Tri: 
          <select id="sort">
            <option value="qty">Quantité</option>
            <option value="rarity">Rareté</option>
            <option value="type">Type</option>
          </select>
        </label>
        <button class="btn-nav" id="btn-load">Charger</button>
      </div>
      <div id="grid" class="grid"></div>
    </section>`;

  document.getElementById('btn-load').addEventListener('click',()=>load());
  await load();

  async function load(){
    const setId = document.getElementById('set-id').value.trim()||'BZH01';
    const fType = document.getElementById('f-type').value;
    const sort  = document.getElementById('sort').value;

    let rows = await getCollection({ setId });
    rows = rows.map(r => ({
      id: r.card_id, qty: r.qty||0,
      rarity: (r.rarity||'common'), type: (r.type||''), description: r.description||''
    }));

    if (fType) rows = rows.filter(r => r.type === fType);

    const R = { mythical:5, legendary:4, epic:3, rare:2, common:1 };
    if (sort === 'qty') rows.sort((a,b)=>b.qty-a.qty);
    if (sort === 'rarity') rows.sort((a,b)=>(R[b.rarity]||0)-(R[a.rarity]||0));
    if (sort === 'type') rows.sort((a,b)=>String(a.type).localeCompare(String(b.type)));

    const grid = document.getElementById('grid'); grid.innerHTML='';
    for (const r of rows){
      const el = document.createElement('div'); el.className='card';
      el.innerHTML = `
        <img class="thumb" src="${cardArtworkUrl(r.id)}" alt="${r.id}" />
        <div class="meta">
          <span class="badge">ID: ${r.id}</span>
          <span class="badge">Qty: ${r.qty}</span>
        </div>`;
      el.addEventListener('click', async ()=>{
        const sid = String(r.id).split('_')[0];
        try{
          const data = await loadSetData(sid);
          const meta = (data||[]).find(c => c.id === r.id) || {};
          const desc = meta.description || meta.desc || r.description || '—';
          const typ  = meta.type || r.type || '—';
          const rar  = (meta.rarity || r.rarity || 'common');
          modal(`<div style="display:flex;gap:14px;align-items:flex-start;">
            <img src="${cardArtworkUrl(r.id)}" width="260" height="368" style="object-fit:cover;border-radius:10px;border:1px solid #234;" />
            <div style="max-width:520px;">
              <h3 style="margin:0 0 6px 0;">${r.id}</h3>
              <div style="margin-bottom:4px;">Rareté: <b>${rar}</b> — Type: <b>${typ}</b></div>
              <p style="opacity:.95;margin-top:8px;line-height:1.4;">${desc}</p>
            </div>
          </div>`);
        }catch(e){
          modal(`<div>Impossible de charger la description (${e?.message||e}).</div>`);
        }
      });
      grid.appendChild(el);
    }
  }

  root.addEventListener('removed', ()=>{});
}
