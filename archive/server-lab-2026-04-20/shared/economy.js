// lab/shared/economy.js

import { getClient, getUser } from './supaRaw.js';
import { getCachedPlayer, updateCachedPlayer } from './supabaseData.js';
import { addGold as repoAddGold, setGold as repoSetGold } from './playersRepo.js';

let _cacheTs = 0; // timestamp du cache 'gold' (ms)

function _now() { return Date.now(); }
function _fresh(ts, ttlMs = 15000) { return ts && (_now() - ts) < ttlMs; }
function _toInt(n, def = 0) {
  const v = Math.trunc(Number(n));
  return Number.isFinite(v) ? v : def;
}

// S'assure d'avoir un playerId et sème le cache (id + gold) si vide
async function ensurePlayerIdAndSeed() {
  let p = getCachedPlayer();
  if (p && p.id) return p.id;

  const sb = await getClient();
  const user = await getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await sb
    .from('players')
    .select('gold')
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw error;

  const gold = _toInt(data?.gold, 0);
  updateCachedPlayer({ id: user.id, gold });
  _cacheTs = _now();
  return user.id;
}

export async function getGold() {
  const p = getCachedPlayer();
  if (p && _fresh(_cacheTs)) return _toInt(p.gold, 0);

  const sb = await getClient();
  const playerId = await ensurePlayerIdAndSeed();

  const { data, error } = await sb
    .from('players')
    .select('gold')
    .eq('id', playerId)
    .maybeSingle();

  if (error) throw error;

  const val = _toInt(data?.gold, 0);
  updateCachedPlayer({ gold: val }); // id déjà présent
  _cacheTs = _now();
  return val;
}

export async function setGold(value) {
  const sb = await getClient();
  const playerId = await ensurePlayerIdAndSeed();

  const gold = Math.max(0, _toInt(value, 0));
  await repoSetGold(sb, playerId, gold);

  updateCachedPlayer({ gold });
  _cacheTs = _now();
  return gold;
}

export async function addGold(delta) {
  const sb = await getClient();
  const playerId = await ensurePlayerIdAndSeed();

  const amt = _toInt(delta, 0);
  const gold = await repoAddGold(sb, playerId, amt);

  const sanitized = Math.max(0, _toInt(gold, 0));
  updateCachedPlayer({ gold: sanitized });
  _cacheTs = _now();
  return sanitized;
}

export async function spendGold(amount) {
  // Atomicité via addGold(-amount) plutôt que get+set
  const spend = Math.max(0, _toInt(amount, 0));
  return await addGold(-spend);
}

export async function refreshGold() {
  _cacheTs = 0;
  return await getGold();
}

// /shared/economy.js  (ajouts) pour runner

export async function convertResourceToGold({ resourceSpent, rate = 0.2, ref = null, meta = {} }){
  if (!Number.isFinite(resourceSpent) || resourceSpent <= 0) throw new Error('resourceSpent > 0');
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('rate > 0');
  const sb = await getClient();
  const user = await getUser();
  if (!user) throw new Error('Not authenticated');

  const _ref = ref || makeRef('convert');
  const { data, error } = await sb.rpc('convert_resource_to_gold', {
    p_player_id: user.id,
    p_resource_spent: Math.floor(resourceSpent),
    p_rate: rate,
    p_ref: _ref,
    p_source: 'minigame',   // cohérent avec guide v2
    p_meta: meta
  });
  if (error) throw error;
  // data => [{ new_gold, daily_used, daily_cap }]
  return Array.isArray(data) ? data[0] : data;
}
