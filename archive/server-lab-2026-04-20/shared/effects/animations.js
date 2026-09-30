// lab/shared/effects/animations.js — v4.0.0
export function burstParticles(container, { x=0, y=0, colors=['#7fd','#9ef','#c9f'], n=120, spread=160, life=900 }={}){
  const box = document.createElement('div');
  Object.assign(box.style, { position:'absolute', left:0, top:0, inset:'0', pointerEvents:'none', overflow:'hidden', zIndex: 9998 });
  container.appendChild(box);
  for (let i=0;i<n;i++){
    const p = document.createElement('div');
    const angle = Math.random()*2*Math.PI;
    const dist = Math.random()*spread;
    const dx = Math.cos(angle)*dist;
    const dy = Math.sin(angle)*dist;
    Object.assign(p.style, {
      position:'absolute', width:'4px', height:'4px', background: colors[i%colors.length],
      left: x+'px', top: y+'px', opacity:'1', transition:`transform ${life}ms ease, opacity ${life}ms ease`,
    });
    box.appendChild(p);
    requestAnimationFrame(()=>{
      p.style.transform = `translate(${dx}px, ${dy}px) rotate(${(Math.random()*360)|0}deg)`;
      p.style.opacity = '0';
    });
  }
  setTimeout(()=> box.remove(), life+100);
}

export function shatterScreen(root, { shards=24, strength=1.0 }={}){
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position:'fixed', inset:'0', pointerEvents:'none', zIndex: 9999, overflow:'hidden'
  });
  root.appendChild(overlay);
  const W = overlay.clientWidth, H = overlay.clientHeight;
  for (let i=0;i<shards;i++){
    const shard = document.createElement('div');
    const w = 20 + Math.random()*80;
    const h = 12 + Math.random()*60;
    const x = Math.random()*W;
    const y = Math.random()*H*0.6 + H*0.2;
    Object.assign(shard.style,{
      position:'absolute', left:`${x}px`, top:`${y}px`, width:`${w}px`, height:`${h}px`,
      background: `linear-gradient(${(Math.random()*360)|0}deg, rgba(160,180,255,.35), rgba(200,160,255,.15))`,
      transform: 'translate(0,0) rotate(0deg)', opacity:'1', filter:'blur(0.3px)',
      borderRadius:'2px',
      boxShadow:'0 0 8px rgba(150, 120, 255, .35)',
      transition:`transform 800ms cubic-bezier(.2,.68,.36,1), opacity 800ms ease`
    });
    overlay.appendChild(shard);
    requestAnimationFrame(()=>{
      const dx = (Math.random()*2-1) * 400 * strength;
      const dy = (-Math.random()) * 300 * strength - 100;
      const r  = (Math.random()*360)|0;
      shard.style.transform = `translate(${dx}px, ${dy}px) rotate(${r}deg)`;
      shard.style.opacity = '0';
    });
  }
  setTimeout(()=> overlay.remove(), 900);
}

export function celebrateCard(root, { img, rarity='legendary', duration=1200 }={}){
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    Object.assign(overlay.style, { position:'fixed', inset:'0', zIndex: 10000, background:'rgba(8,10,16,.5)', display:'grid', placeItems:'center' });
    const box = document.createElement('div');
    Object.assign(box.style, { position:'relative', width:'min(70vw, 520px)', aspectRatio:'0.711', transform:'scale(.6)', filter:'drop-shadow(0 10px 40px rgba(100,80,255,.35))' });
    const imgEl = document.createElement('img');
    imgEl.src = img; imgEl.alt = rarity;
    Object.assign(imgEl.style, { width:'100%', height:'100%', objectFit:'cover', border:'1px solid #345', borderRadius:'14px' });
    const spin = document.createElement('div');
    Object.assign(spin.style, { position:'absolute', inset:'-12px', borderRadius:'16px',
      background: rarity==='mythical'
        ? 'conic-gradient(from 0deg, rgba(70,140,255,.6), rgba(60,220,160,.6), rgba(170,120,255,.6), rgba(70,140,255,.6))'
        : 'conic-gradient(from 0deg, rgba(70,140,255,.55) 0 33%, rgba(60,220,160,.55) 33% 66%, rgba(170,120,255,.55) 66% 100%)',
      animation: 'cele-spin 1.2s linear infinite', filter:'blur(12px)' });
    const style = document.createElement('style');
    style.textContent = `@keyframes cele-in{from{transform:translateY(-40vh) scale(.4) rotate(0deg)} to{transform:translateY(0) scale(1) rotate(720deg)}} 
                          @keyframes cele-land{to{transform:translateY(0) scale(1)}} 
                          @keyframes cele-spin{to{transform:rotate(360deg)}}`;
    overlay.appendChild(style);
    box.appendChild(spin);
    box.appendChild(imgEl);
    overlay.appendChild(box);
    root.appendChild(overlay);

    box.animate([
      { transform:'translateY(-40vh) scale(.4) rotate(0deg)' },
      { transform:'translateY(0) scale(1) rotate(720deg)' }
    ], { duration: duration, easing: 'cubic-bezier(.2,.9,.2,1)' });

    setTimeout(()=>{
      shatterScreen(root, { shards: 36, strength: 1.2 });
    }, duration - 150);

    const close = () => {
      overlay.remove();
      resolve();
    };
    overlay.addEventListener('click', close, { once: true });
    setTimeout(close, duration + 1200);
  });
}
