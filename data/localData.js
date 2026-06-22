// Local mocked data layer (programs only).
// No auto seeding; expects pack types via localStorage or /data/pack_types.local.json.
// Enforces set_id format 'bzh_setNN' when loading pack types.

const LS_KEYS = {
  players: 'tcg_players',
  playerPacks: 'tcg_player_packs',
  playerCards: 'tcg_player_cards',
  packTypes: 'tcg_pack_types'
};

function readLS(key, def) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return def;
    return JSON.parse(raw);
  } catch {
    return def;
  }
}
function writeLS(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}
function bust(url){ return `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`; }

// Inline helper: force 'bzh_setNN'
function toBzhSetId(s) {
  const t = String(s ?? '').toLowerCase();
  const m = t.match(/(\d+)/);
  if (!m) return 'bzh_set01';
  const n = String(parseInt(m[1],10)).padStart(2,'0');
  return `bzh_set${n}`;
}

function initPlayerIfMissing() {
  const players = readLS(LS_KEYS.players, {});
  if (!players['local-player']) {
    players['local-player'] = { id:'local-player', username: 'Local Player', gold: 300, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    writeLS(LS_KEYS.players, players);
  }
}
initPlayerIfMissing();

// Players
export async function ensurePlayer() {
  const players = readLS(LS_KEYS.players, {});
  return players['local-player'];
}
export async function saveGold(playerId, gold) {
  const players = readLS(LS_KEYS.players, {});
  if (!players[playerId]) throw new Error('player not found');
  players[playerId].gold = gold;
  players[playerId].updated_at = new Date().toISOString();
  writeLS(LS_KEYS.players, players);
  return players[playerId];
}
export async function getPlayer(playerId) {
  const players = readLS(LS_KEYS.players, {});
  return players[playerId];
}

// Pack types
async function fetchLocalPackTypesManifest() {
  try {
    const resp = await fetch(bust('/data/pack_types.local.json'), { cache: 'no-store' });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

export async function loadPackTypes() {
  const ls = readLS(LS_KEYS.packTypes, null);
  let arr = Array.isArray(ls) ? ls : await fetchLocalPackTypesManifest() || [];
  // Normalize/force set_id to 'bzh_setNN'
  arr = arr.map(pt => ({
    ...pt,
    set_id: toBzhSetId(pt.set_id)
  }));
  return arr;
}

// Player packs (quantities)
export async function loadPlayerPacks(playerId) {
  const packTypes = await loadPackTypes();
  const map = readLS(LS_KEYS.playerPacks, {});
  const rows = map[playerId] || {};
  return Object.keys(rows).map(ptId => {
    const pt = packTypes.find(p => p.id === ptId);
    if (!pt) return null;
    return { pack_type_id: ptId, quantity: rows[ptId], pack_types: pt };
  }).filter(Boolean);
}

export async function decrementPlayerPack(playerId, packTypeId) {
  const map = readLS(LS_KEYS.playerPacks, {});
  const row = (map[playerId] ||= {});
  const q = row[packTypeId] || 0;
  if (q <= 0) return false;
  row[packTypeId] = q - 1;
  writeLS(LS_KEYS.playerPacks, map);
  return true;
}

export async function buyPack(playerId, packTypeId) {
  const players = readLS(LS_KEYS.players, {});
  const packTypes = await loadPackTypes();
  const pt = packTypes.find(p => p.id === packTypeId);
  if (!pt) return false;
  if (players[playerId].gold < pt.price) return false;
  players[playerId].gold -= pt.price;
  writeLS(LS_KEYS.players, players);

  const map = readLS(LS_KEYS.playerPacks, {});
  const row = (map[playerId] ||= {});
  row[packTypeId] = (row[packTypeId] || 0) + 1;
  writeLS(LS_KEYS.playerPacks, map);
  return true;
}

// Cards
export async function loadPlayerCollection(playerId) {
  const pc = readLS(LS_KEYS.playerCards, {});
  const map = pc[playerId] || {};
  return Object.keys(map).map(cid => ({
    player_id: playerId,
    card_id: cid,
    quantity: map[cid]
  }));
}

export async function addCardsBatch(playerId, cardIds) {
  const counts = {};
  for (const id of cardIds) counts[id] = (counts[id] || 0) + 1;

  const pc = readLS(LS_KEYS.playerCards, {});
  const row = (pc[playerId] ||= {});
  for (const [cid, qty] of Object.entries(counts)) {
    row[cid] = (row[cid] || 0) + qty;
  }
  writeLS(LS_KEYS.playerCards, pc);
}

// Facade alias
export { ensurePlayer as initPlayer } from './localData.js?v=3';
