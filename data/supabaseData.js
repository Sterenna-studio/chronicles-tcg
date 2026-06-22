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

  const { data: existing } = await sb.from('tcg_players').select('*').eq('id', user.id).maybeSingle();
  if (!existing) {
    const username = await resolveUsername();
    _displayName = username;
    await sb.from('tcg_players').insert({ id: user.id, username });
    const { data } = await sb.from('tcg_players').select('*').eq('id', user.id).single();
    return data;
  }

  _displayName = existing.username || (await resolveUsername());
  return existing;
}

// Re-exports depuis les repos Supabase
export { loadPackTypes, loadPlayerPacks, decrementPlayerPack, buyPack } from './packsRepo.js?v=3';
export { loadPlayerCollection, addCardsBatch } from './cardsRepo.js?v=3';
