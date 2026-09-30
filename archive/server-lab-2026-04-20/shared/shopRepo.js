// lab/shared/shopRepo.js — v3.2 (schema sans player_packs.set_id)
import { getClient } from './supaRaw.js';
import { getCachedPlayer } from './supabaseData.js';
import { spendGold } from './economy.js';

// Achat: uniquement via pack_type_id (UUID)
export async function buyPack({ packTypeId, price }) {
  const sb = await getClient();
  const player = getCachedPlayer();
  if (!player) throw new Error('No player');

  if (price && price > 0) {
    await spendGold(price);
  }

  const { data: row } = await sb.from('player_packs')
    .select('quantity')
    .eq('player_id', player.id)
    .eq('pack_type_id', packTypeId)
    .maybeSingle();

  if (row) {
    await sb.from('player_packs')
      .update({ quantity: (row.quantity || 0) + 1 })
      .eq('player_id', player.id)
      .eq('pack_type_id', packTypeId);
  } else {
    await sb.from('player_packs')
      .insert({ player_id: player.id, pack_type_id: packTypeId, quantity: 1 });
  }
  return true;
}

// Inventaire: joint pack_types pour récupérer set_id/name/price/image_name
export async function getOwnedPacks({ setId } = {}) {
  const sb = await getClient();
  const player = getCachedPlayer();
  if (!player) throw new Error('No player');

  let q = sb.from('player_packs')
    .select(`pack_type_id, quantity, pack_types:pack_type_id ( id, set_id, name, price, image_name )`)
    .eq('player_id', player.id);

  if (setId) q = q.eq('pack_types.set_id', setId); // filtre via la table liée

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// Catalogue boutique: lit directement pack_types
export async function getPackTypes({ setId } = {}) {
  const sb = await getClient();
  let q = sb.from('pack_types').select('id, set_id, name, price, image_name, card_count');
  if (setId) q = q.eq('set_id', setId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}
