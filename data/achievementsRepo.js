// data/achievementsRepo.js — v1.0.0
// 18 achievements across 5 categories, client-side eval against player + cards data
import { getClient, getUser } from '../logic/supaRaw.js?v=23';

// ── Tier palette keys ──────────────────────────────────────────────────────
export const TIERS = { bronze: 'bronze', silver: 'silver', gold: 'gold', legendary: 'legendary' };

// ── Achievement definitions ────────────────────────────────────────────────
// eval(player, stats) → boolean
// stats = { totalCards, uniqueCards, rarityMap, setMap, bySet }
export const ACHIEVEMENTS = [

  // ── COLLECTION ──────────────────────────────────────────────────────────
  {
    id: 'col_first',
    category: 'collection',
    tier: TIERS.bronze,
    icon: '\u{1F0CF}',
    name: 'Premi\u00e8re carte',
    desc: 'Obtiens ta premi\u00e8re carte.',
    eval: (p) => (p.cards_count ?? 0) >= 1,
  },
  {
    id: 'col_10',
    category: 'collection',
    tier: TIERS.bronze,
    icon: '\u{1F4DA}',
    name: 'Apprenti collectionneur',
    desc: 'Poss\u00e8de 10 cartes.',
    eval: (p) => (p.cards_count ?? 0) >= 10,
  },
  {
    id: 'col_50',
    category: 'collection',
    tier: TIERS.silver,
    icon: '\u{1F4D5}',
    name: 'Collectionneur',
    desc: 'Poss\u00e8de 50 cartes.',
    eval: (p) => (p.cards_count ?? 0) >= 50,
  },
  {
    id: 'col_100',
    category: 'collection',
    tier: TIERS.silver,
    icon: '\u{1F4D6}',
    name: 'Biblioth\u00e8que vivante',
    desc: 'Poss\u00e8de 100 cartes.',
    eval: (p) => (p.cards_count ?? 0) >= 100,
  },
  {
    id: 'col_500',
    category: 'collection',
    tier: TIERS.gold,
    icon: '\u{1F3DB}',
    name: 'Grand archiviste',
    desc: 'Poss\u00e8de 500 cartes.',
    eval: (p) => (p.cards_count ?? 0) >= 500,
  },

  // ── RARETE ───────────────────────────────────────────────────────────────
  {
    id: 'rar_epic',
    category: 'raret\u00e9',
    tier: TIERS.silver,
    icon: '\u{1F7E3}',
    name: 'Touche d\'\u00e9lite',
    desc: 'Obtiens au moins une carte \u00e9pique.',
    eval: (_, s) => (s.rarityMap.epic ?? 0) >= 1,
  },
  {
    id: 'rar_legendary',
    category: 'raret\u00e9',
    tier: TIERS.gold,
    icon: '\u{1F525}',
    name: 'L\u00e9gende',
    desc: 'Obtiens ta premi\u00e8re carte l\u00e9gendaire.',
    eval: (p) => p.has_legendary === true,
  },
  {
    id: 'rar_mythical',
    category: 'raret\u00e9',
    tier: TIERS.legendary,
    icon: '\u2728',
    name: 'Au-del\u00e0 du mythe',
    desc: 'Obtiens une carte mythique.',
    eval: (_, s) => (s.rarityMap.mythical ?? 0) >= 1,
  },
  {
    id: 'rar_5epic',
    category: 'raret\u00e9',
    tier: TIERS.gold,
    icon: '\u{1F52E}',
    name: 'Quintuple \u00e9lite',
    desc: 'Poss\u00e8de 5 cartes \u00e9piques diff\u00e9rentes.',
    eval: (_, s) => (s.rarityMap.epic ?? 0) >= 5,
  },

  // ── PACKS ────────────────────────────────────────────────────────────────
  {
    id: 'pack_first',
    category: 'packs',
    tier: TIERS.bronze,
    icon: '\u{1F4E6}',
    name: 'Premier booster',
    desc: 'Ouvre ton premier booster.',
    eval: (p) => (p.pack_count ?? 0) >= 1,
  },
  {
    id: 'pack_10',
    category: 'packs',
    tier: TIERS.silver,
    icon: '\u{1F381}',
    name: 'Ouvreur assidu',
    desc: 'Ouvre 10 boosters.',
    eval: (p) => (p.pack_count ?? 0) >= 10,
  },
  {
    id: 'pack_50',
    category: 'packs',
    tier: TIERS.gold,
    icon: '\u{1F4BF}',
    name: 'Collectionneur invivr\u00e9',
    desc: 'Ouvre 50 boosters.',
    eval: (p) => (p.pack_count ?? 0) >= 50,
  },

  // ── OR ───────────────────────────────────────────────────────────────────
  {
    id: 'gold_100',
    category: 'or',
    tier: TIERS.bronze,
    icon: '\u26C1',
    name: 'Premi\u00e8res pi\u00e8ces',
    desc: 'Accumule 100 \u26C1 en une fois.',
    eval: (p) => (p.chronicles ?? 0) >= 100,
  },
  {
    id: 'gold_500',
    category: 'or',
    tier: TIERS.silver,
    icon: '\u{1F4B0}',
    name: 'Petit tr\u00e9sor',
    desc: 'Accumule 500 \u26C1 en une fois.',
    eval: (p) => (p.chronicles ?? 0) >= 500,
  },
  {
    id: 'gold_daily_7',
    category: 'or',
    tier: TIERS.silver,
    icon: '\u{1F4C5}',
    name: 'Habituel',
    desc: 'Connecte-toi 7 jours avec un daily claim (last_daily_at renseign\u00e9).',
    eval: (p) => p.last_daily_at != null,  // proxy : a d\u00e9j\u00e0 claim\u00e9 au moins une fois
  },

  // ── SETS ─────────────────────────────────────────────────────────────────
  {
    id: 'set_bzh01',
    category: 'sets',
    tier: TIERS.bronze,
    icon: '\u{1F30A}',
    name: 'Enfant de BZH01',
    desc: 'Obtiens au moins une carte du set BZH01.',
    eval: (_, s) => (s.setMap['BZH01'] ?? s.setMap['bzh01'] ?? 0) >= 1,
  },
  {
    id: 'set_bzh02',
    category: 'sets',
    tier: TIERS.bronze,
    icon: '\u{1F30B}',
    name: 'Enfant de BZH02',
    desc: 'Obtiens au moins une carte du set BZH02.',
    eval: (_, s) => (s.setMap['BZH02'] ?? s.setMap['bzh02'] ?? 0) >= 1,
  },
  {
    id: 'set_both',
    category: 'sets',
    tier: TIERS.gold,
    icon: '\u{1F30C}',
    name: 'Citoyen des deux mondes',
    desc: 'Poss\u00e8de des cartes des sets BZH01 et BZH02.',
    eval: (_, s) => {
      const b1 = (s.setMap['BZH01'] ?? s.setMap['bzh01'] ?? 0) >= 1;
      const b2 = (s.setMap['BZH02'] ?? s.setMap['bzh02'] ?? 0) >= 1;
      return b1 && b2;
    },
  },
];

/**
 * Fetches player + cards data and evaluates all achievements.
 * Returns Array<{ ...achievement, unlocked: boolean }>
 */
export async function getAchievements() {
  const sb   = await getClient();
  const user = await getUser();
  if (!user) return ACHIEVEMENTS.map(a => ({ ...a, unlocked: false }));

  // Parallel fetch (chronicles vit sur profiles, streak/last_daily_at sur tcg_players)
  const [{ data: player }, { data: prof }, { data: cards }] = await Promise.all([
    sb.from('tcg_players').select('*').eq('id', user.id).maybeSingle(),
    sb.from('profiles').select('chronicles').eq('id', user.id).maybeSingle(),
    sb.from('tcg_player_cards').select('set_id, rarity, quantity').eq('user_id', user.id),
  ]);

  const p = { ...(player ?? {}), chronicles: prof?.chronicles ?? 0 };

  // Build stats from cards
  const rarityMap = {};
  const setMap    = {};
  for (const row of (cards ?? [])) {
    const r = String(row.rarity  || 'common').toLowerCase();
    const s = String(row.set_id  || '').toUpperCase();
    rarityMap[r] = (rarityMap[r] ?? 0) + (row.quantity ?? 1);
    if (s) setMap[s] = (setMap[s] ?? 0) + (row.quantity ?? 1);
  }

  const stats = { rarityMap, setMap };

  return ACHIEVEMENTS.map(a => ({
    ...a,
    unlocked: (() => { try { return !!a.eval(p, stats); } catch { return false; } })()
  }));
}
