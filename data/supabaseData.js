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

/**
 * Assure que le joueur existe dans la table `players` et retourne sa ligne.
 * Appelé comme : await initPlayer(sb, user)
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

  const { data: existing } = await sb.from('players').select('*').eq('id', user.id).maybeSingle();
  if (!existing) {
    const username = await resolveUsername();
    _displayName = username;
    await sb.from('players').insert({ id: user.id, gold: 0, username });
    const { data } = await sb.from('players').select('*').eq('id', user.id).single();
    return data;
  }

  _displayName = existing.username || (await resolveUsername());
  return existing;
}

// Re-exports localData pour les ops pack/collection (toujours en local pour l'instant)
export { loadPackTypes, loadPlayerPacks, decrementPlayerPack, buyPack, loadPlayerCollection, addCardsBatch } from './localData.js';
