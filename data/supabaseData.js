// data/supabaseData.js — v5 facade
import * as playersRepo from './playersRepo.js';

let _displayName = null;
let _player = null;

export function getDisplayName() {
  return _displayName || 'Joueur';
}

export function getCachedPlayer() {
  return _player;
}

export async function initPlayer(supabase, user) {
  _player = await playersRepo.ensurePlayer(supabase, user);
  _displayName = _player?.username
    || user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || user?.email
    || user?.id
    || 'Joueur';
  return _player;
}

export function formatUserTag() {
  return getDisplayName();
}

export const ASSET_VERSION = '1.5.0';
