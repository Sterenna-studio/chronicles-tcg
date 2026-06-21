// data/packsRepo.js — v7
import { getClient, getUser } from '../logic/supaRaw.js';

const PACK_IMAGE_MAP = {
  'BZH01-default': 'set01.jpg',
  'BZH01':         'set01.jpg',
  'bzh01':         'set01.jpg',
  'set01':         'set01.jpg',
  'BZH01_CHAMP':   'set01_champ.jpg',
  'set01_champ':   'set01_champ.jpg',
  'BZH02-default': 'set02.jpg',
  'BZH02':         'set02.jpg',
  'bzh02':         'set02.jpg',
  'set02':         'set02.jpg',
  'BZH02_CHAMP':   'Set02_champ.jpg',
  'Set02_champ':   'Set02_champ.jpg',
};

function normalizePack(pack) {
  const mappedImage = PACK_IMAGE_MAP[pack.image_name]
    || PACK_IMAGE_MAP[pack.set_id]
    || pack.image_name
    || 'set01.jpg';
  return { ...pack, image_name: mappedImage, pack_type_id: pack.pack_type_id ?? pack.id };
}

export async function loadPackTypes() {
  const sb = await getClient();
  const { data, error } = await sb
    .from('pack_types')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(normalizePack);
}

export async function loadPlayerPacks() {
  const sb   = await getClient();
  const user = await getUser();
  const [
    { data: types, error: typesErr },
    { data: inv,   error: invErr   }
  ] = await Promise.all([
    sb.from('pack_types').select('*'),
    sb.from('tcg_player_packs').select('pack_type_id, quantity').eq('player_id', user.id)
  ]);
  if (typesErr) throw typesErr;
  if (invErr)   throw invErr;
  const qty = Object.fromEntries((inv || []).map(r => [r.pack_type_id, r.quantity || 0]));
  return (types || []).map(t => normalizePack({ ...t, quantity: qty[t.id] || 0 }));
}

export async function decrementPlayerPack(pack_type_id, count = 1) {
  const sb   = await getClient();
  const user = await getUser();
  const { data: row, error: rowErr } = await sb
    .from('tcg_player_packs')
    .select('quantity')
    .eq('player_id', user.id)
    .eq('pack_type_id', pack_type_id)
    .maybeSingle();
  if (rowErr) throw rowErr;
  const next = Math.max(0, (row?.quantity || 0) - count);
  const { error: upsertErr } = await sb
    .from('tcg_player_packs')
    .upsert(
      { player_id: user.id, pack_type_id, quantity: next },
      { onConflict: 'player_id,pack_type_id' }
    );
  if (upsertErr) throw upsertErr;
  return next;
}

export async function buyPack(pack_type_id) {
  const sb   = await getClient();
  const user = await getUser();
  const { data: pt } = await sb.from('pack_types').select('price').eq('id', pack_type_id).single();
  if (!pt) return false;
  const { data: player } = await sb.from('tcg_players').select('chronicles').eq('id', user.id).single();
  if (!player || player.chronicles < pt.price) return false;
  await sb.from('tcg_players').update({ chronicles: player.chronicles - pt.price }).eq('id', user.id);
  const { data: existing } = await sb.from('tcg_player_packs').select('quantity').eq('player_id', user.id).eq('pack_type_id', pack_type_id).maybeSingle();
  await sb.from('tcg_player_packs').upsert(
    { player_id: user.id, pack_type_id, quantity: (existing?.quantity || 0) + 1 },
    { onConflict: 'player_id,pack_type_id' }
  );
  return true;
}
