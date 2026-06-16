// data/cardsRepo.js — v2 (tcg_player_cards)
import { getClient, getUser } from '../logic/supaRaw.js';

export async function saveCards(supabase, userId, cards) {
  if (!cards?.length) return;
  const rows = cards.map(card => ({
    user_id:  userId,
    card_id:  card.id ?? card.card_id,
    set_id:   card.set_id ?? String(card.id ?? '').split('_')[0] ?? 'BZH01',
    rarity:   String(card.rarity || 'common').toLowerCase(),
    quantity: 1,
  })).filter(r => r.card_id);

  for (const row of rows) {
    const { data: existing } = await supabase
      .from('tcg_player_cards')
      .select('id, quantity')
      .eq('user_id', userId)
      .eq('card_id', row.card_id)
      .maybeSingle();
    if (existing) {
      await supabase
        .from('tcg_player_cards')
        .update({ quantity: existing.quantity + 1 })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('tcg_player_cards')
        .insert(row);
    }
  }
}

export async function loadMyCards(supabase, userId) {
  const { data, error } = await supabase
    .from('tcg_player_cards')
    .select('*')
    .eq('user_id', userId);
  if (error) console.error('loadMyCards error:', error);
  return data ?? [];
}
