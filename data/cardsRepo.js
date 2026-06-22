// data/cardsRepo.js — v1
import { getClient, getUser } from '../logic/supaRaw.js?v=3';

/**
 * Charge la collection du joueur depuis tcg_player_cards.
 * Retourne un tableau de { card_id, quantity }
 */
export async function loadPlayerCollection(userId) {
  const sb = await getClient();
  const uid = userId || (await getUser()).id;
  const { data, error } = await sb
    .from('tcg_player_cards')
    .select('card_id, quantity')
    .eq('user_id', uid);
  if (error) throw error;
  return data || [];
}

/**
 * Ajoute un batch de cartes (tableau de card_id strings) pour le joueur.
 * Fait un upsert par card_id + user_id.
 */
/**
 * Ajoute des cartes au joueur. Accepte soit des objets carte
 * ({ id, rarity, set_id }), soit de simples ids (compat). Stocke rarity + set_id
 * (set_id dérivé du préfixe de l'id, ex. BZH01_RC001 → BZH01) pour alimenter
 * has_legendary et les achievements de rareté.
 */
export async function addCardsBatch(userId, cards) {
  const sb = await getClient();
  const uid = userId || (await getUser()).id;

  const norm = (cards || [])
    .map(c => (typeof c === 'string' ? { id: c } : c))
    .filter(c => c && c.id);

  const counts = {};   // card_id -> qty
  const meta   = {};   // card_id -> { rarity, set_id }
  for (const c of norm) {
    counts[c.id] = (counts[c.id] || 0) + 1;
    if (!meta[c.id]) {
      meta[c.id] = {
        // rarity en minuscules : contrainte tcg_player_cards_rarity_check
        rarity: c.rarity ? String(c.rarity).toLowerCase() : null,
        set_id: c.set_id ?? (c.id.includes('_') ? c.id.split('_')[0] : null),
      };
    }
  }

  const { data: existing } = await sb
    .from('tcg_player_cards')
    .select('card_id, quantity')
    .eq('user_id', uid)
    .in('card_id', Object.keys(counts));

  const existingMap = Object.fromEntries((existing || []).map(r => [r.card_id, r.quantity || 0]));

  // Pas de colonne `id` ici : l'upsert résout insert/update via onConflict
  // (user_id,card_id). Inclure `id` enverrait id=null sur les nouvelles cartes
  // → violation NOT NULL de la PK.
  const rows = Object.entries(counts).map(([card_id, qty]) => ({
    user_id: uid,
    card_id,
    quantity: (existingMap[card_id] || 0) + qty,
    rarity: meta[card_id].rarity,
    set_id: meta[card_id].set_id,
  }));

  const { error } = await sb
    .from('tcg_player_cards')
    .upsert(rows, { onConflict: 'user_id,card_id' });
  if (error) throw error;
}
