import { supabase } from './shared/supabaseClient.js';

/** Initialise ou crée un joueur */
export async function initPlayer(user) {
  const userId = user.id;
  let { data: player, error } = await supabase
    .from('players')
    .select('username, gold, pack_count')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!player) {
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single();
    if (profErr) throw profErr;
    const initial = { id: userId, username: profile.username, gold: 100, pack_count: 10 };
    const { error: insertErr } = await supabase.from('players').insert(initial);
    if (insertErr) throw insertErr;
    player = { username: initial.username, gold: initial.gold, pack_count: initial.pack_count };
  }
  window.currentUsername = player.username;
  window.totalGold = player.gold;
  window.totalPacks = player.pack_count;
  return userId;
}

/** Sauvegarde gold et pack_count */
export async function savePlayerData(userId) {
  const { error } = await supabase
    .from('players')
    .update({ gold: window.totalGold, pack_count: window.totalPacks })
    .eq('id', userId);
  if (error) throw error;
}

/** Charge la collection du joueur */
export async function loadPlayerCollection(userId) {
  const { data, error } = await supabase
    .from('player_cards')
    .select('card_id, quantity')
    .eq('player_id', userId);
  if (error) throw error;
  window.collection = data || [];
}

/** Ajoute 1 à la quantité d'une carte */
export async function addCardToCollection(userId, cardId) {
  const { error } = await supabase.rpc('add_card_quantity', {
    p_player_id: userId,
    p_card_id: cardId
  });
  if (error) throw error;
  const idx = window.collection.findIndex(c => c.card_id === cardId);
  if (idx === -1) window.collection.push({ card_id: cardId, quantity: 1 });
  else window.collection[idx].quantity++;
}

/** Batch RPC : ajoute plusieurs cartes d'un coup */
export async function addCardsBatch(userId, cardIds) {
  const { error } = await supabase.rpc('add_cards_batch', {
    p_player_id: userId,
    p_card_ids: cardIds
  });
  if (error) throw error;
}

/** Liste des types de packs */
export async function loadPackTypes() {
  const { data, error } = await supabase
    .from('pack_types')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}
