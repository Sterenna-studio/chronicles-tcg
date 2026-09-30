// lab/shared/supabaseData.js — v3.8.3
// Adds updateCachedPlayer() to stay compatible with economy.js
import { getClient } from './supaRaw.js';

const LS_KEY = 'tcg.player.cache.v1';

let _player = null;
let _user   = null;

export function getCachedPlayer(){ return _player; }
export function getAuthUser(){ return _user; }
export function getDisplayName(){
  if (_player?.username) return _player.username;
  if (_user?.email) return String(_user.email).split('@')[0];
  return 'Player';
}

export async function initSession(){
  const sb = await getClient();
  const { data: { user } } = await sb.auth.getUser();
  _user = user || null;
  return _user;
}

export async function initPlayer(sbOpt=null, userOpt=null){
  const sb = sbOpt || await getClient();
  const user = userOpt || _user || (await initSession());
  if (!user) return null;

  const cached = loadCache();
  if (cached && cached.id === user.id){ _player = cached; return _player; }

  const { data: row } = await sb
    .from('players')
    .select('id, username, gold, pack_count, created_at, updated_at')
    .eq('id', user.id)
    .maybeSingle();

  if (!row){
    const username = user.user_metadata?.username || (user.email ? String(user.email).split('@')[0] : 'Player');
    const { data: created, error: insErr } = await sb
      .from('players')
      .insert({ id:user.id, username })
      .select('id, username, gold, pack_count, created_at, updated_at')
      .single();
    if (insErr) throw insErr;
    _player = created;
  } else {
    _player = row;
  }
  saveCache(_player);
  return _player;
}

export async function refreshPlayer(){
  const sb = await getClient();
  if (!_user) await initSession();
  if (!_user) return null;
  const { data: row } = await sb
    .from('players')
    .select('id, username, gold, pack_count, created_at, updated_at')
    .eq('id', _user.id)
    .maybeSingle();
  if (row){ _player = row; saveCache(_player); }
  return _player;
}

export async function updateGold(delta){
  const sb = await getClient();
  if (!_player) await initPlayer();
  if (!_player) return;
  const newGold = Math.max(0, (_player.gold||0) + (delta||0));
  const { data: row, error } = await sb
    .from('players')
    .update({ gold: newGold })
    .eq('id', _player.id)
    .select('id, username, gold, pack_count, updated_at')
    .single();
  if (!error && row){ _player = row; saveCache(_player); window.dispatchEvent(new CustomEvent('tcg:gold')); }
  return _player;
}

export async function updatePackCount(delta){
  const sb = await getClient();
  if (!_player) await initPlayer();
  if (!_player) return;
  const newCount = Math.max(0, (_player.pack_count||0) + (delta||0));
  const { data: row, error } = await sb
    .from('players')
    .update({ pack_count: newCount })
    .eq('id', _player.id)
    .select('id, username, gold, pack_count, updated_at')
    .single();
  if (!error && row){ _player = row; saveCache(_player); window.dispatchEvent(new Event('tcg:refresh')); }
  return _player;
}

// === Compatibility helper for economy.js ===
export function updateCachedPlayer(partial){
  if (!_player) return;
  _player = { ..._player, ...(partial||{}) };
  saveCache(_player);
  if ('gold' in (partial||{})) window.dispatchEvent(new CustomEvent('tcg:gold'));
  // generic refresh event for any other field change
  window.dispatchEvent(new Event('tcg:refresh'));
}

// ---------- cache helpers ----------
function loadCache(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  }catch{ return null; }
}
function saveCache(p){
  try{ localStorage.setItem(LS_KEY, JSON.stringify(p)); }catch{ /* ignore */ }
}
