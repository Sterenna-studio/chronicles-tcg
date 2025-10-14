// supabaseData.js
import { supabase } from './shared/supabaseClient.js';

/**
 * Initialise ou créée la ligne `players` pour l’utilisateur.
 * Expose ensuite `window.currentUsername` et `window.totalGold`.
 */
export async function initPlayer(user) {
  const userId = user.id;
  let { data: player, error } = await supabase
    .from('players')
    .select('username, gold')
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

    const initial = {
      id:       userId,
      username: profile.username,
      gold:     100
    };
    const { error: insertErr } = await supabase
      .from('players')
      .insert(initial);
    if (insertErr) throw insertErr;

    player = { username: initial.username, gold: initial.gold };
  }

  window.currentUsername = player.username;
  window.totalGold       = player.gold;
  return userId;
}

/**
 * Met à jour le champ `gold` pour l’utilisateur.
 */
export async function savePlayerData(userId) {
  const { error } = await supabase
    .from('players')
    .update({ gold: window.totalGold })
    .eq('id', userId);
  if (error) throw error;
}

/**
 * Charge la collection du joueur (quantités par carte).
 * Expose `window.collection = [{card_id, quantity}, …]`.
 */
export async function loadPlayerCollection(userId) {
  const { data, error } = await supabase
    .from('player_cards')
    .select('card_id, quantity')
    .eq('player_id', userId);
  if (error) throw error;
  window.collection = data || [];
}

/**
 * Ajoute une carte (quantity += 1) via RPC.
 */
export async function addCardToCollection(userId, cardId) {
  const { error } = await supabase.rpc('add_card_quantity', {
    p_player_id: userId,
    p_card_id:   cardId
  });
  if (error) throw error;

  // Mise à jour locale
  const idx = window.collection.findIndex(c => c.card_id === cardId);
  if (idx === -1) {
    window.collection.push({ card_id: cardId, quantity: 1 });
  } else {
    window.collection[idx].quantity++;
  }
}

/**
 * Batch RPC : ajoute plusieurs cartes en une seule requête.
 */
export async function addCardsBatch(userId, cardIds) {
  const { error } = await supabase.rpc('add_cards_batch', {
    p_player_id: userId,
    p_card_ids:  cardIds
  });
  if (error) throw error;
}

/**
 * Récupère la définition des types de packs.
 */
export async function loadPackTypes() {
  const { data, error } = await supabase
    .from('pack_types')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

/**
 * Charge les quantités de packs du joueur, joint aux infos de pack_types.
 * Renvoie un tableau de :
 *  { pack_type_id, name, set_id, image_name, card_count, require_* , quantity }
 */
export async function loadPlayerPacks(userId) {
  const { data, error } = await supabase
    .from('player_packs')
    .select(
      'quantity,' +
      'pack_types(id,name,set_id,image_name,card_count,require_champion,require_epic,require_legendary,require_mythical)'
    )
    .eq('player_id', userId);
  if (error) throw error;

  return data.map(row => ({
    pack_type_id:      row.pack_types.id,
    name:              row.pack_types.name,
    set_id:            row.pack_types.set_id,
    image_name:        row.pack_types.image_name,
    card_count:        row.pack_types.card_count,
    require_champion:  row.pack_types.require_champion,
    require_epic:      row.pack_types.require_epic,
    require_legendary: row.pack_types.require_legendary,
    require_mythical:  row.pack_types.require_mythical,
    quantity:          row.quantity
  }));
}

/**
 * Décrémente la quantité d’un pack spécifique pour l’utilisateur.
 */
export async function decrementPlayerPack(userId, packTypeId) {
  // Lit l’actuelle quantité
  const { data, error } = await supabase
    .from('player_packs')
    .select('quantity')
    .match({ player_id: userId, pack_type_id: packTypeId })
    .single();
  if (error) throw error;

  const newQty = Math.max(0, (data.quantity || 0) - 1);
  const { error: updErr } = await supabase
    .from('player_packs')
    .update({ quantity: newQty })
    .match({ player_id: userId, pack_type_id: packTypeId });
  if (updErr) throw updErr;
}
