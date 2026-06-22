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
export async function addCardsBatch(userId, cardIds) {
  const sb = await getClient();
  const uid = userId || (await getUser()).id;

  const counts = {};
  for (const id of cardIds) counts[id] = (counts[id] || 0) + 1;

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
  }));

  const { error } = await sb
    .from('tcg_player_cards')
    .upsert(rows, { onConflict: 'user_id,card_id' });
  if (error) throw error;
}
