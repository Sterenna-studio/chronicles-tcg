// logic/sets.js — source unique de vérité pour la disponibilité des sets.
//
// Pour réactiver un set plus tard (ex: BZH02) :
//   1. Ajoute son id à PLAYABLE_SET_IDS ci-dessous.
//   2. Réactive ses packs en base :
//        UPDATE pack_types SET is_active = true WHERE set_id = 'BZH02';
//   3. Bump le cache (node dev/bump-cache.mjs) puis déploie.
//
// Les cartes d'un set NON jouable restent visibles dans la collection
// (si déjà possédées) mais ne sont ni achetables ni utilisables en combat.

export const ALL_SETS = [
  { id: 'BZH01', label: 'Set 1 — BZH Chronicles', file: '/data/BZH01.json' },
  { id: 'BZH02', label: 'Set 2 — BZH Chronicles', file: '/data/BZH02.json' },
];

// Sets actuellement jouables (deck builder + combat). Set 02 viendra plus tard.
export const PLAYABLE_SET_IDS = ['BZH01'];

export const isPlayableSet = (id) => PLAYABLE_SET_IDS.includes(id);

/** Sets jouables, dans l'ordre de ALL_SETS. */
export const playableSets = () => ALL_SETS.filter((s) => isPlayableSet(s.id));
