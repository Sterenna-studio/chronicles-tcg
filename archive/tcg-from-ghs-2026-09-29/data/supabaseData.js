// data/supabaseData.js — v7 (chronicles + RPC onboarding + pseudo home)
import * as playersRepo from './playersRepo.js';

let _displayName = null;
let _player = null;

export function getDisplayName() {
  return _displayName || 'Agent';
}

export function getCachedPlayer() {
  return _player;
}

/**
 * Appelle le RPC sécurisé ensure_tcg_player (SECURITY DEFINER).
 * Crée le joueur avec 150 Chronicles de départ si nouveau.
 * Fallback sur playersRepo.ensurePlayer si le RPC n'existe pas encore.
 */
export async function initPlayer(supabase, user) {
  try {
    const { data: rpc, error: rpcErr } = await supabase.rpc('ensure_tcg_player');
    if (!rpcErr && rpc?.ok) {
      _player = await playersRepo.getPlayer(supabase, user.id);
    } else {
      _player = await playersRepo.ensurePlayer(supabase, user);
    }
  } catch {
    _player = await playersRepo.ensurePlayer(supabase, user);
  }
  _displayName = _player?.username
    || user?.user_metadata?.full_name
    || user?.user_metadata?.name
    || user?.email
    || user?.id
    || 'Agent';
  return _player;
}

export function formatUserTag() {
  return getDisplayName();
}

export const ASSET_VERSION = '1.7.0';
