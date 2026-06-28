// logic/challengeEngine.js
// Défis quotidiens — pool, sélection seedée sur la date, suivi completion

const STORAGE_KEY = () => `tcg_challenges_${todayStr()}`;

function todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// ── Pool de défis ─────────────────────────────────────────────────────────────
// check(result, ctx) → boolean
//   result : { winner, turns }
//   ctx    : { difficulty, champsPlayed, companionsPlayed, eventsPlayed,
//              terrainsPlayed, objectsPlayed, specialsPlayed, teamsPlayed,
//              totalDamageDealt, highestDamageOneTurn, noRarePlayed, finalHp }

export const CHALLENGE_POOL = [
  {
    id: 'win_any',
    label: 'Première Victoire',
    desc: 'Gagne un combat (toute difficulté)',
    icon: '🏆',
    gold: 30,
    check: (r) => r.winner === 'player',
  },
  {
    id: 'win_fast',
    label: 'Victoire Éclair',
    desc: 'Gagne en 5 tours ou moins',
    icon: '⚡',
    gold: 55,
    check: (r) => r.winner === 'player' && r.turns <= 5,
  },
  {
    id: 'win_hard',
    label: 'Épreuve du Guerrier',
    desc: 'Gagne en difficulté Difficile',
    icon: '💀',
    gold: 80,
    check: (r, ctx) => r.winner === 'player' && ctx.difficulty === 'hard',
  },
  {
    id: 'win_normal_plus',
    label: 'Vrai Combattant',
    desc: 'Gagne en Normal ou Difficile',
    icon: '⚔️',
    gold: 45,
    check: (r, ctx) => r.winner === 'player' && ['normal','hard'].includes(ctx.difficulty),
  },
  {
    id: 'use_2_champions',
    label: 'L\'Appel des Champions',
    desc: 'Joue 2 Champions dans un même combat',
    icon: '⚔️',
    gold: 35,
    check: (_, ctx) => ctx.champsPlayed >= 2,
  },
  {
    id: 'use_3_companions',
    label: 'Meilleur Ami',
    desc: 'Joue 3 Companions dans un même combat',
    icon: '🐾',
    gold: 35,
    check: (_, ctx) => ctx.companionsPlayed >= 3,
  },
  {
    id: 'use_3_events',
    label: 'Perturbateur',
    desc: 'Joue 3 Events dans un même combat',
    icon: '⚡',
    gold: 40,
    check: (_, ctx) => ctx.eventsPlayed >= 3,
  },
  {
    id: 'use_2_terrains',
    label: 'Maître du Terrain',
    desc: 'Joue 2 Terrains dans un même combat',
    icon: '🌍',
    gold: 35,
    check: (_, ctx) => ctx.terrainsPlayed >= 2,
  },
  {
    id: 'use_2_objects',
    label: 'L\'Équipé',
    desc: 'Joue 2 Objets dans un même combat',
    icon: '🔧',
    gold: 35,
    check: (_, ctx) => ctx.objectsPlayed >= 2,
  },
  {
    id: 'use_special',
    label: 'Carte Sauvage',
    desc: 'Joue 2 Spéciales dans un même combat',
    icon: '✨',
    gold: 35,
    check: (_, ctx) => ctx.specialsPlayed >= 2,
  },
  {
    id: 'use_team',
    label: 'En Équipe !',
    desc: 'Joue une carte Team dans un combat',
    icon: '👥',
    gold: 30,
    check: (_, ctx) => ctx.teamsPlayed >= 1,
  },
  {
    id: 'survive_high_hp',
    label: 'Bouclier Parfait',
    desc: 'Termine un combat victorieux avec 15+ PV',
    icon: '🛡️',
    gold: 60,
    check: (r, ctx) => r.winner === 'player' && ctx.finalHp >= 15,
  },
  {
    id: 'win_commons_only',
    label: 'Force Brute',
    desc: 'Gagne sans jouer de carte Rare ou supérieure',
    icon: '💪',
    gold: 60,
    check: (r, ctx) => r.winner === 'player' && ctx.noRarePlayed,
  },
  {
    id: 'win_no_champion',
    label: 'La Voie des Sans-Titre',
    desc: 'Gagne sans jouer aucun Champion',
    icon: '🎭',
    gold: 70,
    check: (r, ctx) => r.winner === 'player' && ctx.champsPlayed === 0,
  },
  {
    id: 'deal_30_damage',
    label: 'Destruction Totale',
    desc: 'Inflige 30 dégâts ou plus en un combat',
    icon: '💥',
    gold: 45,
    check: (_, ctx) => ctx.totalDamageDealt >= 30,
  },
  {
    id: 'deal_8_one_turn',
    label: 'Salve Dévastatrice',
    desc: 'Inflige 8+ dégâts en un seul tour',
    icon: '🔥',
    gold: 50,
    check: (_, ctx) => ctx.highestDamageOneTurn >= 8,
  },
  {
    id: 'win_long',
    label: 'Longue Marche',
    desc: 'Gagne un combat qui dure 8 tours ou plus',
    icon: '⏳',
    gold: 40,
    check: (r) => r.winner === 'player' && r.turns >= 8,
  },
];

// ── Seed / sélection quotidienne ──────────────────────────────────────────────

function dateHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Retourne les 3 défis du jour (déterministes, mêmes pour tous).
 * @returns {Array<Challenge>}
 */
export function getDailyChallenges() {
  const today = todayStr();
  const seed  = dateHash(today);
  const pool  = [...CHALLENGE_POOL];

  // Fisher-Yates seedé sur la date
  let s = seed;
  for (let i = pool.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, 3);
}

// ── Progression (localStorage) ────────────────────────────────────────────────

/**
 * Retourne la progression du jour : { [challengeId]: { completed, goldEarned } }
 */
export function getChallengeProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY()) || '{}');
  } catch { return {}; }
}

/**
 * Marque un défi comme complété et retourne le gold gagné (0 si déjà complété).
 */
export function markChallengeCompleted(challengeId, gold) {
  const progress = getChallengeProgress();
  if (progress[challengeId]?.completed) return 0; // déjà eu
  progress[challengeId] = { completed: true, goldEarned: gold };
  localStorage.setItem(STORAGE_KEY(), JSON.stringify(progress));
  // Notifie le hub (même onglet)
  window.dispatchEvent(new CustomEvent('tcg:challenge-completed', { detail: { challengeId, gold } }));
  return gold;
}

/**
 * Vérifie les défis du jour à la fin d'un combat et retourne ceux complétés.
 * @param {object} result  { winner, turns }
 * @param {object} ctx     contexte de combat (voir battle.js)
 * @returns {Array<{ challenge, goldEarned }>}
 */
export function checkAndCompleteChallenges(result, ctx) {
  const daily    = getDailyChallenges();
  const progress = getChallengeProgress();
  const completed = [];

  for (const ch of daily) {
    if (progress[ch.id]?.completed) continue; // déjà fait
    try {
      if (ch.check(result, ctx)) {
        const gold = markChallengeCompleted(ch.id, ch.gold);
        if (gold > 0) completed.push({ challenge: ch, goldEarned: gold });
      }
    } catch(e) { console.warn('[challenges]', ch.id, e); }
  }

  return completed;
}

// ── Défis Escouade (mode 3 champions) ───────────────────────────────────────────
// L'ancien pool ci-dessus visait le combat 1-champion (cartes jouées depuis la main).
// Le mode Escouade a d'autres leviers, d'où ce pool dédié.
// check(result, ctx) :
//   result : { winner, turns }                         (de getSquadResult)
//   ctx    : { difficulty, finalHp, damageDealt, highestHit,
//              skillsUsed, activesUsed, eventsUsed }    (construit dans squadBattle.js)
export const SQUAD_CHALLENGE_POOL = [
  { id:'sq_win',            label:'Première Escouade', desc:"Gagne un combat d'escouade",            icon:'🏆', gold:30, check:(r)   => r.winner === 'player' },
  { id:'sq_win_fast',       label:'Assaut Éclair',     desc:'Gagne en 5 tours ou moins',             icon:'⚡', gold:55, check:(r)   => r.winner === 'player' && r.turns <= 5 },
  { id:'sq_win_hard',       label:'Épreuve du Chef',   desc:'Gagne en difficulté Difficile',         icon:'💀', gold:80, check:(r,c) => r.winner === 'player' && c.difficulty === 'hard' },
  { id:'sq_win_normalplus', label:'Vrai Stratège',     desc:'Gagne en Normal ou Difficile',          icon:'⚔️', gold:45, check:(r,c) => r.winner === 'player' && ['normal','hard'].includes(c.difficulty) },
  { id:'sq_flawless',       label:'Mur Imprenable',    desc:'Gagne avec 20 PV ou plus',              icon:'🛡️', gold:60, check:(r,c) => r.winner === 'player' && c.finalHp >= 20 },
  { id:'sq_skills2',        label:'Déchaînement',      desc:'Lance 2 attaques spéciales en un combat',icon:'✨', gold:40, check:(_,c) => c.skillsUsed >= 2 },
  { id:'sq_active',         label:'Arsenal',           desc:'Déclenche un actif équipé',             icon:'🔧', gold:35, check:(_,c) => c.activesUsed >= 1 },
  { id:'sq_event',          label:'Frappe Perçante',   desc:'Déclenche un Event (ignore le bouclier)',icon:'⚡', gold:45, check:(_,c) => c.eventsUsed >= 1 },
  { id:'sq_bighit',         label:'Coup Dévastateur',  desc:'Inflige 8+ dégâts en une action',       icon:'🔥', gold:50, check:(_,c) => c.highestHit >= 8 },
  { id:'sq_deal25',         label:'Pilonnage',         desc:'Inflige 25 dégâts ou plus en un combat',icon:'💥', gold:45, check:(_,c) => c.damageDealt >= 25 },
  { id:'sq_long',           label:"Guerre d'Usure",    desc:'Gagne un combat de 8 tours ou plus',    icon:'⏳', gold:40, check:(r)   => r.winner === 'player' && r.turns >= 8 },
];

// Sélection déterministe de 3 défis du jour depuis un pool (même seed que ci-dessus).
function pickDaily(pool) {
  const a = [...pool];
  let s = dateHash(todayStr());
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    [a[i], a[s % (i + 1)]] = [a[s % (i + 1)], a[i]];
  }
  return a.slice(0, 3);
}

/** Les 3 défis Escouade du jour. */
export function getDailySquadChallenges() {
  return pickDaily(SQUAD_CHALLENGE_POOL);
}

/**
 * Valide les défis Escouade du jour à la fin d'un combat.
 * @returns {Array<{ challenge, goldEarned }>} (le crédit en chronicles est fait
 * par l'appelant via le ledger — voir squadBattle.js).
 */
export function checkAndCompleteSquadChallenges(result, ctx) {
  const daily = getDailySquadChallenges();
  const progress = getChallengeProgress();
  const completed = [];
  for (const ch of daily) {
    if (progress[ch.id]?.completed) continue;
    try {
      if (ch.check(result, ctx)) {
        const gold = markChallengeCompleted(ch.id, ch.gold);
        if (gold > 0) completed.push({ challenge: ch, goldEarned: gold });
      }
    } catch (e) { console.warn('[squad-challenges]', ch.id, e); }
  }
  return completed;
}
