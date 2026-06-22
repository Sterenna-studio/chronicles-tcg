// data/playersRepo.js — v6
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
    await supabase.from('tcg_players').insert({ id: userId, username: displayName });
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

/** @deprecated Use saveChronicles */
export async function saveGold(supabase, userId, delta) {
  return saveChronicles(supabase, userId, delta);
}

export async function saveChronicles(supabase, userId, delta) {
  const { data: pl } = await supabase.from('profiles').select('chronicles').eq('id', userId).single();
  const chronicles = Math.max(0, (pl?.chronicles || 0) + (delta || 0));
  await supabase.from('profiles').update({ chronicles }).eq('id', userId);
  return chronicles;
}
