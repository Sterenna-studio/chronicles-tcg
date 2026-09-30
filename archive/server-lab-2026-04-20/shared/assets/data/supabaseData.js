// data/supabaseData.js — moderne (ESM only)
import * as playersRepo from './playersRepo.js';
import { getClient, getUser } from '../logic/supaRaw.js';

let _displayName = null;
let _player = null;

export function getDisplayName() {
  return _displayName || 'Joueur';
}

export function getCachedPlayer() {
  return _player;
}

export async function initPlayer(supabase, user) {
  const sb = supabase || await getClient();
  const u = user || await getUser();

  if (!u || !u.id) throw new Error('No user');

  _player = await playersRepo.ensurePlayer(sb, u);

  _displayName = _player?.username
    || u?.user_metadata?.full_name
    || u?.user_metadata?.name
    || u?.email
    || u?.id
    || 'Joueur';

  return _player;
}

export function formatUserTag() {
  return getDisplayName();
}

export const ASSET_VERSION = '1.5.0';

console.info('[supabaseData.js moderne] loaded');
