// data/supabaseData.js — bridge Supabase pour le TCG

// ── Cache display name après initPlayer ───────────────────────────────────
let _displayName = '';

// Lecture synchrone de la session Supabase dans localStorage (même domaine)
function _sbUserSync() {
  try {
    const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    if (!key) return null;
    return JSON.parse(localStorage.getItem(key))?.user || null;
  } catch { return null; }
}

/** Retourne le nom d'affichage (sync, appelé sans await dans index.html) */
export function getDisplayName() {
  if (_displayName) return _displayName;
  const user = _sbUserSync();
  if (!user) return 'Joueur';
  return user.user_metadata?.username
    || user.user_metadata?.full_name
    || user.email?.split('@')[0]
    || 'Joueur';
}

export function getCachedPlayer() { return null; }
export const ASSET_VERSION = '1';
export function formatUserTag(user) {
  return user?.user_metadata?.username || user?.email?.split('@')[0] || 'Joueur';
}

/**
 * Assure que le joueur existe dans la table `tcg_players` et retourne sa ligne.
 */
export async function initPlayer(sb, user) {
  if (!sb || !user) return null;

  async function resolveUsername() {
    try {
      const { data } = await sb.from('profiles').select('username').eq('id', user.id).maybeSingle();
      if (data?.username) return data.username;
    } catch {}
    return user.user_metadata?.username
      || user.user_metadata?.full_name
      || user.email?.split('@')[0]
      || 'Joueur';
  }

  const { data: rpc, error } = await sb.rpc('ensure_tcg_player');
  if (error) console.error('[initPlayer] ensure_tcg_player error:', error.message);

  const { data: player } = await sb.from('tcg_players').select('*').eq('id', user.id).maybeSingle();
  if (player) {
    _displayName = player.username || (await resolveUsername());
    return player;
  }

  _displayName = await resolveUsername();
  return null;
}

// Re-exports depuis les repos Supabase
export { loadPackTypes, loadPlayerPacks, decrementPlayerPack, buyPack } from './packsRepo.js?v=13';
export { loadPlayerCollection, addCardsBatch } from './cardsRepo.js?v=13';
