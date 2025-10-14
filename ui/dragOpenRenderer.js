// ui/dragOpenRenderer.js
import { url, bust } from '../logic/paths.js';
const SFX = {
  Common: url('/sounds/common.mp3'),
  Rare: url('/sounds/rare.mp3'),
  Epic: url('/sounds/epic.mp3'),
  Legendary: url('/sounds/legendary.mp3'),
  Mythical: url('/sounds/mythical.mp3'),
};
const setBg=(el,u)=>{ el.style.backgroundImage=`url(${u})`; };
const setBgWithFallback=(el,u,f)=>{ const img=new Image(); img.onload=()=>setBg(el,u); img.onerror=()=>setBg(el,f); img.src=bust(u); };
export function renderDragOpen(root, { packImage, picks, ownedSet, onFinish }){
  const overlay=document.createElement('div'); overlay.className='open-overlay';
  const panel=document.createElement('div'); panel.className='open-panel';
  const stand=document.createElement('div'); stand.className='booster-stand';
  const booster=document.createElement('div'); booster.className='booster-3d';
  setBg(booster, url('/assets/packs/'+packImage));
  const handle=document.createElement('div'); handle.className='tear-handle';
  const rip=document.createElement('div'); rip.className='rip-line';
  booster.append(handle,rip); stand.appendChild(booster);
  const btnStore=document.createElement('button'); btnStore.className='btn'; btnStore.textContent='Ranger mes cartes'; btnStore.style.display='none';
  panel.append(stand,btnStore); overlay.appendChild(panel); root.appendChild(overlay);
  let dragging=false, startX=0, progress=0;
  const onDown=e=>{ dragging=true; startX=(e.touches?e.touches[0].clientX:e.clientX); handle.style.cursor='grabbing'; };
  const onMove=e=>{ if(!dragging) return; const x=(e.touches?e.touches[0].clientX:e.clientX); progress=Math.max(0,Math.min(220,startX-x)); rip.style.width=progress+'px'; };
  const onUp=async()=>{ if(!dragging) return; dragging=false; handle.style.cursor='grab'; if(progress>120){ await tearTimeline(progress); await openPack(); } else rip.style.width='0px'; };
  handle.addEventListener('mousedown',onDown); handle.addEventListener('touchstart',onDown,{passive:true});
  window.addEventListener('mousemove',onMove); window.addEventListener('touchmove',onMove,{passive:true});
  window.addEventListener('mouseup',onUp); window.addEventListener('touchend',onUp,{passive:true});
  const rafp=()=>new Promise(requestAnimationFrame);
  async function smooth(node,prop,from,to,dur=220){ const t0=performance.now(); const d=to-from; while(true){ const t=(performance.now()-t0)/dur; if(t>=1) break; const v=from+d*(1-Math.pow(1-t,3)); node.style[prop]=(prop==='opacity'?String(v):v+'px'); await rafp(); } node.style[prop]=(prop==='opacity'?String(to):to+'px'); }
  async function tearTimeline(cur){ await smooth(rip,'width',cur,220,220); booster.style.transition='transform .26s ease,opacity .26s ease'; booster.style.transform='translateY(-8px)'; booster.style.opacity='0'; await new Promise(r=>setTimeout(r,260)); stand.removeChild(booster); }
  let revealed=0; const audio=new Audio();
  function play(r){ audio.src=bust(SFX[r]||SFX.Common); audio.currentTime=0; audio.play().catch(()=>{}); }
  async function openPack(){
    stand.innerHTML=''; const rowStage=document.createElement('div'); rowStage.className='row-stage'; const row=document.createElement('div'); row.className='fd-row'; rowStage.appendChild(row); stand.appendChild(rowStage);
    picks.forEach(card=>{
      const fc=document.createElement('div'); fc.className='flip-card pre';
      const inner=document.createElement('div'); inner.className='flip-inner';
      const back=document.createElement('div'); back.className='flip-face flip-back';
      const front=document.createElement('div'); front.className='flip-face flip-front';
      setBgWithFallback(back,url('/assets/card_back.png'),url('/assets/card_back.png'));
      setBgWithFallback(front,url(`/artworks/${card.id}.jpg`),url('/assets/card_back.png'));
      if(!ownedSet?.has(card.id)){ const b=document.createElement('div'); b.className='badge-new'; b.textContent='NEW!'; front.appendChild(b); }
      inner.append(back,front); fc.appendChild(inner);
      fc.addEventListener('click',()=>{ if(fc.classList.contains('flipped')) return; fc.classList.add('flipped'); play(card.rarity); revealed++; if(revealed>=picks.length) btnStore.style.display=''; });
      row.appendChild(fc); setTimeout(()=>fc.classList.remove('pre'), 60+Math.random()*260);
    });
  }
  btnStore.addEventListener('click',()=>{ overlay.remove(); onFinish(picks); });
}
