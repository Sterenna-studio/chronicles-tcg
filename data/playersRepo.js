// data/playersRepo.js — v8 (chronicles)
export async function resolveDisplayName(supabase, user) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle();
  return (
    profile?.username ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    user?.id
  );
}

export async function ensurePlayer(supabase, user) {
  const userId = user.id;
  const { data: player } = await supabase
    .from('tcg_players')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (!player) {
    const displayName = await resolveDisplayName(supabase, user);
    await supabase.from('tcg_players').insert({ id: userId, username: displayName, chronicles: 0 });
  } else if (!player.username) {
    const displayName = await resolveDisplayName(supabase, user);
    await supabase.from('tcg_players').update({ username: displayName }).eq('id', userId);
  }
  return getPlayer(supabase, userId);
}

export async function getPlayer(supabase, userId) {
  const { data } = await supabase.from('tcg_players').select('*').eq('id', userId).single();
  return data;
}

// chronicles = ex-gold
export async function saveChronicles(supabase, userId, delta) {
  const { data: pl } = await supabase.from('tcg_players').select('chronicles').eq('id', userId).single();
  const chronicles = Math.max(0, (pl?.chronicles || 0) + (delta || 0));
  await supabase.from('tcg_players').update({ chronicles }).eq('id', userId);
  return chronicles;
}

/** @deprecated use saveChronicles */
export async function saveGold(supabase, userId, delta) {
  return saveChronicles(supabase, userId, delta);
}

export async function syncStatsAfterPack(supabase, userId, cards) {
  if (!cards?.length) return;
  const hasLegendary = cards.some(c => {
    const r = String(c.rarity || '').toLowerCase();
    return r === 'legendary' || r === 'mythical';
  });
  const { data: pl } = await supabase
    .from('tcg_players')
    .select('cards_count')
    .eq('id', userId)
    .single();
  const updates = {
    cards_count: (pl?.cards_count ?? 0) + cards.length,
    ...(hasLegendary && { has_legendary: true }),
  };
  const { error } = await supabase.from('tcg_players').update(updates).eq('id', userId);
  if (error) console.error('syncStatsAfterPack error:', error);
}
