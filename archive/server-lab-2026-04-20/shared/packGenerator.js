// lab/shared/packGenerator.js — v3.6.3 RNG fix (non‑deterministic by default)
const TYPE_WEIGHTS = { Champion:10, Companion:20, Event:20, Object:20, Special:10, Terrain:20 };
const RARITY_WEIGHTS = { common:50, rare:30, epic:15, legendary:4, mythical:1 };

function pickWeighted(entries, weightFn, rng) {
  const total = entries.reduce((s,e)=>s+(weightFn(e)||0),0) || 1;
  let r = rng()*total;
  for (const e of entries) { r -= weightFn(e)||0; if (r <= 0) return e; }
  return entries[entries.length-1];
}

function mulberry32(seed){let t=seed>>>0;return()=>{t+=0x6D2B79F5;let r=Math.imul(t^t>>>15,1|t);r^=r+Math.imul(r^r>>>7,61|r);return((r^r>>>14)>>>0)/4294967296;};}
function seedFromHex(hex='c0ffee'){let s=0;for(let i=0;i<hex.length;i++)s=(s*31+hex.charCodeAt(i))>>>0;return s>>>0;}
function makeRng(seedHex){
  if (seedHex && typeof seedHex === 'string') return mulberry32(seedFromHex(seedHex));
  // Prefer a crypto-seeded RNG for uniqueness
  try {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues){
      const b = new Uint32Array(1); crypto.getRandomValues(b);
      return mulberry32(b[0]>>>0);
    }
  } catch(_) {}
  // Fallback to Math.random (function)
  return Math.random;
}

const rarOrder = ['mythical','legendary','epic','rare','common'];
function nearestAvailableRarity(pool, target){
  const idx = rarOrder.indexOf(target);
  for (let d=0; d<rarOrder.length; d++){
    const i1 = Math.min(rarOrder.length-1, Math.max(0, idx + d));
    const i2 = Math.min(rarOrder.length-1, Math.max(0, idx - d));
    const r1 = rarOrder[i1], r2 = rarOrder[i2];
    const has1 = pool.some(c => (c.rarity||'common').toLowerCase() === r1);
    if (has1) return r1;
    const has2 = pool.some(c => (c.rarity||'common').toLowerCase() === r2);
    if (has2) return r2;
  }
  return 'common';
}

export function generatePack({ cards, cardCount, ptype, seedHex } = {}){
  const rng = makeRng(seedHex);
  const all = cards.map(c => ({...c, rarity: (c.rarity||'common').toLowerCase(), type: c.type || c.category || ''}));
  const picks = [];
  const chosen = new Set();

  const takeOne = (filterFn) => {
    const pool = all.filter(filterFn).filter(c => !chosen.has(c.id));
    if (!pool.length) return null;
    const typeList = [...new Set(pool.map(c => c.type))].map(t => ({ t }));
    const pickedType = pickWeighted(typeList, e => TYPE_WEIGHTS[e.t] || 1, rng).t;
    const typePool = pool.filter(c => c.type === pickedType);
    const rarityList = [...new Set(typePool.map(c => c.rarity))].map(r => ({ r }));
    const targetRarity = pickWeighted(rarityList, e => RARITY_WEIGHTS[e.r] || 1, rng).r;
    const finalRarity = nearestAvailableRarity(typePool, targetRarity);
    const finalPool = typePool.filter(c => c.rarity === finalRarity);
    const card = finalPool[(rng()*finalPool.length)|0];
    if (!card) return null;
    chosen.add(card.id); picks.push(card); return card;
  };

  // Guarantees from pack_types booleans
  if (ptype?.require_mythical) takeOne(c => c.rarity === 'mythical');
  if (ptype?.require_legendary) takeOne(c => c.rarity === 'legendary');
  if (ptype?.require_epic) takeOne(c => c.rarity === 'epic');
  if (ptype?.require_champion) takeOne(c => (c.type||'') === 'Champion');

  while (picks.length < (ptype?.card_count || cardCount || 6)){
    takeOne(() => true);
    if (chosen.size >= all.length) break;
  }
  return picks;
}
