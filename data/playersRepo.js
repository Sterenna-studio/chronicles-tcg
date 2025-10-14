export async function resolveDisplayName(supabase,user){
  const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).maybeSingle();
  return profile?.username || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || user?.id;
}
export async function ensurePlayer(supabase,user){
  const uid=user.id;
  const { data: p } = await supabase.from('players').select('*').eq('id',uid).maybeSingle();
  if(!p){ const name=await resolveDisplayName(supabase,user); await supabase.from('players').insert({id:uid,username:name,gold:0}); }
  else if(!p.username){ const name=await resolveDisplayName(supabase,user); await supabase.from('players').update({username:name}).eq('id',uid); }
  const { data: fresh } = await supabase.from('players').select('*').eq('id',uid).single();
  return fresh;
}
