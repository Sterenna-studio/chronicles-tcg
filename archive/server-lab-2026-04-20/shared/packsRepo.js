// lab/shared/packsRepo.js — v3.7: expose loadSetData, desc mapping, pack_count update on open
import { getClient } from './supaRaw.js';
import { getCachedPlayer } from './supabaseData.js';
import { generatePack } from './packGenerator.js';

export async function loadSetData(setId){
  const url = `/lab/shared/assets/data/${encodeURIComponent(setId)}.json`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`[packsRepo] cannot load set JSON ${setId}: HTTP ${res.status}`);
  const json = await res.json();
  const arr = Array.isArray(json) ? json : (json.cards || json.card_pool || json.data?.cards || json.payload?.cards || []);
  // normalize keys (desc -> description)
  return arr.map(c => (c && typeof c === 'object')
    ? ({ ...c, description: c.description ?? c.desc ?? '' })
    : c
  );
}

export async function openOnePack({ packTypeId, seedHex=null }){
  const sb = await getClient();
  const player = getCachedPlayer();
  if (!player) throw new Error('No player');
  const { data: ptype, error: ept } = await sb.from('pack_types')
    .select('id, set_id, card_count, require_champion, require_epic, require_legendary, require_mythical')
    .eq('id', packTypeId).maybeSingle();
  if (ept) throw ept;
  if (!ptype) throw new Error('Unknown pack_type_id');

  // check possession
  const { data: row } = await sb.from('player_packs')
    .select('quantity').eq('player_id', player.id).eq('pack_type_id', packTypeId).maybeSingle();
  if (!row || (row.quantity||0) <= 0) throw new Error('No pack owned');

  // decrement pack quantity
  await sb.from('player_packs')
    .update({ quantity: (row.quantity||0) - 1 })
    .eq('player_id', player.id).eq('pack_type_id', packTypeId);

  // decrement players.pack_count (safety read-then-update)
  try{
    const { data: prow } = await sb.from('players').select('pack_count').eq('id', player.id).maybeSingle();
    const next = Math.max(0, (prow?.pack_count || 0) - 1);
    await sb.from('players').update({ pack_count: next }).eq('id', player.id);
  }catch(_){ /* ignore */ }

  const cards = await loadSetData(ptype.set_id);
  if (!cards.length) throw new Error('Aucune carte disponible dans ce set');
  const results = generatePack({ cards, cardCount: ptype.card_count, ptype, seedHex });
  return { results, meta: { setId: ptype.set_id, packTypeId } };
}

export async function commitOpenedCards({ results }){
  const sb = await getClient();
  const player = getCachedPlayer();
  if (!player) throw new Error('No player');
  const agg = new Map(); for (const c of (results||[])) agg.set(c.id, (agg.get(c.id)||0)+1);
  const ids = Array.from(agg.keys()); if (!ids.length) return true;
  const { data: existing } = await sb.from('player_cards').select('card_id, qty').eq('player_id', player.id).in('card_id', ids);
  const existMap = new Map((existing||[]).map(r => [r.card_id, r.qty || 0]));
  const payload = ids.map(id => ({ player_id: player.id, card_id: id, qty: (existMap.get(id)||0) + agg.get(id) }));
  await sb.from('player_cards').upsert(payload, { onConflict: 'player_id,card_id' });
  return true;
}

// getCollection enriched (rarity, type, description) from set JSON
export async function getCollection({ setId } = {}){
  const sb = await getClient();
  const player = getCachedPlayer();
  if (!player) throw new Error('No player');

  let q = sb.from('player_cards')
    .select('card_id, qty')
    .eq('player_id', player.id);
  if (setId) q = q.like('card_id', `${setId}_%`);
  const { data, error } = await q;
  if (error) throw error;
  const rows = data || [];
  if (!rows.length) return [];

  // Load meta once
  const metaArr = await loadSetData(setId || String(rows[0].card_id).split('_')[0]);
  const meta = new Map(metaArr.map(c => [c.id, c]));

  return rows.map(r => {
    const m = meta.get(r.card_id) || {};
    return {
      card_id: r.card_id,
      qty: r.qty || 0,
      rarity: (m.rarity || 'common').toLowerCase(),
      type: m.type || '',
      description: m.description || m.desc || ''
    };
  });
}
