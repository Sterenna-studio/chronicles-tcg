function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function generatePack({ cards, cardCount, flags }) {
  const byRarity = new Map();
  const champions = [];
  for (const c of cards) {
    if (c.type === 'Champion') champions.push(c);
    const r = c.rarity;
    if (!byRarity.has(r)) byRarity.set(r, []);
    byRarity.get(r).push(c);
  }

  const requiredPools = [];
  if (flags.require_champion) requiredPools.push({ name: 'Champion', pool: champions });
  if (flags.require_epic) requiredPools.push({ name: 'Epic', pool: byRarity.get('Epic') ?? [] });
  if (flags.require_legendary) requiredPools.push({ name: 'Legendary', pool: byRarity.get('Legendary') ?? [] });
  if (flags.require_mythical) requiredPools.push({ name: 'Mythical', pool: byRarity.get('Mythical') ?? [] });

  for (const req of requiredPools) {
    if (!req.pool || req.pool.length === 0) {
      throw new Error(`Pool vide pour ${req.name} (flags incohérents avec le set ${flags.set_id})`);
    }
  }
  if (cardCount < requiredPools.length) {
    throw new Error('card_count trop petit pour satisfaire les flags requis');
  }

  const pickedIds = new Set();
  const picks = [];

  for (const req of requiredPools) {
    const pool = shuffle(req.pool.slice()).filter(c => !pickedIds.has(c.id));
    if (pool.length === 0) throw new Error(`Impossible de satisfaire ${req.name}`);
    const card = pool[0];
    pickedIds.add(card.id);
    picks.push(card);
  }

  const globalPool = shuffle(cards.slice()).filter(c => !pickedIds.has(c.id));
  if (globalPool.length < (cardCount - picks.length)) {
    throw new Error('Pas assez de cartes uniques dans le set pour remplir le pack');
  }
  while (picks.length < cardCount) {
    picks.push(globalPool[picks.length - requiredPools.length]);
  }
  return picks;
}
