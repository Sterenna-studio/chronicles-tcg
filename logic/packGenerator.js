// logic/packGenerator.js
function mulberry32(seed){ let t=seed>>>0; return ()=>{ t+=0x6D2B79F5; let r=Math.imul(t^t>>>15,1|t); r^=r+Math.imul(r^r>>>7,61|r); return ((r^r>>>14)>>>0)/4294967296; }; }
function seedFromHex(hex='deadbeef'){ let s=0; for(let i=0;i<hex.length;i++) s=(s*31+hex.charCodeAt(i))>>>0; return s>>>0; }
const rarityWeights={Common:70,Rare:22,Epic:6,Legendary:1.8,Mythical:0.2};
const pickWeighted=(arr,rng)=>{ const total=arr.reduce((s,a)=>s+(rarityWeights[a.rarity]||1),0); let r=rng()*total; for(const a of arr){ r-=(rarityWeights[a.rarity]||1); if(r<=0) return a;} return arr[arr.length-1]; };
export function generatePack({cards,cardCount,flags,seedHex}){
  const rng=mulberry32(seedHex?seedFromHex(seedHex):0xC0FFEE);
  const pool=[...cards]; const byR={}, byT={};
  pool.forEach(c=>{ (byR[c.rarity]=byR[c.rarity]||[]).push(c); (byT[c.type||'']=byT[c.type||'']||[]).push(c); });
  const chosen=new Map();
  const pickFrom=(list)=>{ const avail=list.filter(c=>!chosen.has(c.id)); if(!avail.length) return null; const p=pickWeighted(avail,rng); chosen.set(p.id,p); return p; };
  if(flags?.require_champion) pickFrom(byT['Champion']||[]);
  if(flags?.require_mythical) pickFrom(byR['Mythical']||[]);
  if(flags?.require_legendary) pickFrom(byR['Legendary']||[]);
  if(flags?.require_epic) pickFrom(byR['Epic']||[]);
  while(chosen.size<cardCount){ const p=pickFrom(pool); if(!p) break; }
  if(![...chosen.values()].some(c=>['Rare','Epic','Legendary','Mythical'].includes(c.rarity))){
    const rarePool=pool.filter(c=>['Rare','Epic','Legendary','Mythical'].includes(c.rarity)&&!chosen.has(c.id));
    if(rarePool.length){
      const repl=rarePool[Math.floor(rng()*rarePool.length)];
      // Supprime une Common au hasard (pas la première carte qui pourrait être un Champion requis)
      const commons=[...chosen.values()].filter(c=>c.rarity==='Common');
      const toRemove=commons.length ? commons[Math.floor(rng()*commons.length)] : [...chosen.values()][0];
      chosen.delete(toRemove.id);
      chosen.set(repl.id,repl);
    }
  }
  return [...chosen.values()];
}