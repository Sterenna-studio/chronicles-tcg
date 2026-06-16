// shared/packsRepo.js — v1.0
// Wrapper autour de data/packsRepo.js + logique d'ouverture d'un pack
import { loadPackTypes, decrementPlayerPack } from '../data/packsRepo.js';
import { saveCards }            from '../data/cardsRepo.js';
import { syncStatsAfterPack }  from '../data/playersRepo.js';
import { getClient, getUser }  from '../logic/supaRaw.js';
import { generatePack }        from '../logic/packGenerator.js';

export { loadPackTypes, decrementPlayerPack };

/**
 * Ouvre un pack : génère les cartes, décrémente l'inventaire, sauvegarde en base.
 * @param {{ packTypeId: string, setId?: string, cardCount?: number }} opts
 * @returns {{ results: Array<{ id, name, rarity, set_id }> }}
 */
export async function openOnePack({ packTypeId, setId = 'BZH01', cardCount = 5 } = {}) {
  const supabase = await getClient();
  const user     = await getUser();
  const userId   = user?.id ?? null;

  // Charger le set JSON
  const res = await fetch(`/TCG/data/${setId}.json`);
  if (!res.ok) throw new Error(`Set ${setId} introuvable`);
  const json  = await res.json();
  const pool  = Array.isArray(json) ? json : (json.cards || []);

  // Générer les cartes via le générateur de packs
  const results = generatePack({ cards: pool, cardCount, seedHex: packTypeId + Date.now().toString(16) });

  // Sauvegarder en base
  if (supabase && userId) {
    await saveCards(supabase, userId, results);
    await syncStatsAfterPack(supabase, userId, results);
  }

  return { results };
}
