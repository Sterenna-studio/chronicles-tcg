// lab/shared/playersRepo.js — safe returns + defaults + CAS addGold

// Crée/récupère le player en respectant les defaults SQL (gold=100, pack_count=10)
export async function ensurePlayer(sb, user) {
  const uid = user.id;
  const sel = 'id, username, gold, pack_count, created_at, updated_at';

  // 1) tente de lire
  const { data: row } = await sb.from('players').select(sel).eq('id', uid).maybeSingle();
  if (row) return row;

  // 2) insert sans forcer gold/pack_count (laisser les DEFAULT jouer)
  const username =
    user.user_metadata?.username ||
    user.user_metadata?.full_name ||
    (user.email ? user.email.split('@')[0] : uid);

  const { data: created, error } = await sb
    .from('players')
    .insert({ id: uid, username })
    .select(sel)
    .single();

  if (error) throw error;
  return created; // gold=100, pack_count=10 d’après tes defaults
}

// Met la valeur d’or explicitement et renvoie la VAL serveur
export async function setGold(sb, playerId, gold) {
  const sel = 'id, username, gold, pack_count, updated_at';
  const target = Math.max(0, Number(gold) || 0);

  const { data, error } = await sb
    .from('players')
    .update({ gold: target })
    .eq('id', playerId)
    .select(sel)
    .single();

  if (error) throw error;
  return data; // { id, username, gold, pack_count, updated_at }
}

// Ajoute delta avec un CAS simple pour éviter la plupart des races sans RPC
export async function addGold(sb, playerId, delta) {
  const sel = 'id, username, gold, pack_count, updated_at';
  const { data: cur, error: selErr } = await sb
    .from('players')
    .select('gold')
    .eq('id', playerId)
    .single();
  if (selErr) throw selErr;

  const next = Math.max(0, (cur?.gold ?? 0) + (Number(delta) || 0));

  // CAS naïf : on tente l’update en vérifiant l’ancien solde
  const { data: upd } = await sb
    .from('players')
    .update({ gold: next })
    .eq('id', playerId)
    .eq('gold', cur.gold)     // compare-and-swap
    .select(sel)
    .maybeSingle();

  if (upd) return upd; // succès du CAS

  // Si quelqu’un a modifié en même temps, on refetch puis on applique une fois
  const { data: again } = await sb
    .from('players')
    .select('gold')
    .eq('id', playerId)
    .single();

  const next2 = Math.max(0, (again?.gold ?? 0) + (Number(delta) || 0));
  const { data: upd2, error: err2 } = await sb
    .from('players')
    .update({ gold: next2 })
    .eq('id', playerId)
    .select(sel)
    .single();

  if (err2) throw err2;
  return upd2;
}

// Lecture exacte serveur (utile pour forcer une synchro UI)
export async function getGold(sb, playerId) {
  const { data, error } = await sb
    .from('players')
    .select('gold')
    .eq('id', playerId)
    .single();
  if (error) throw error;
  return data.gold ?? 0;
}
