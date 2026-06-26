// logic/aiEngine.js — IA du combat (3 niveaux)
// S'appuie sur l'API explicite-côté de battleEngine.js (plus de swap player/enemy).

import { playCard, getBattleResult, FIELD_MAX } from './battleEngine.js?v=6';

function playableIndices(hand, energy) {
  return hand.map((c, i) => ({ c, i })).filter(({ c }) => c.energy <= energy).map(({ i }) => i);
}
function score(card) {
  return card.energy ? card.power / card.energy : 0;
}
/** Index de la carte de champ la plus faible (à défausser si champ plein). */
function weakestFieldIndex(side) {
  if (!side.field || !side.field.length) return null;
  let idx = 0;
  for (let i = 1; i < side.field.length; i++) {
    if ((side.field[i].shield || 0) < (side.field[idx].shield || 0)) idx = i;
  }
  return idx;
}
/** Options de pose tenant compte d'un champ plein. */
function playOpts(card, side) {
  if ((card.type === 'Object' || card.type === 'Companion') && (side.field || []).length >= FIELD_MAX) {
    return { replaceFieldIndex: weakestFieldIndex(side) };
  }
  return {};
}

/** Meilleurs dégâts que le joueur pourrait infliger sur l'état donné (niveau Hard). */
function estimatePlayerBestDamage(state) {
  let max = 0;
  for (const i of playableIndices(state.player.hand, state.player.energy)) {
    const { state: after, ok } = playCard(state, 'player', i);
    if (!ok) continue;
    const d = state.enemy.hp - after.enemy.hp;
    if (d > max) max = d;
  }
  return max;
}

/**
 * Choisit l'index de la carte que l'IA doit jouer (ou -1).
 * @param {Array} hand   enemy.hand
 * @param {object} state BattleState
 */
export function aiChooseCard(hand, state, difficulty = 'normal') {
  const playable = playableIndices(hand, state.enemy.energy);
  if (!playable.length) return -1;

  switch (difficulty) {
    case 'easy':
      return playable[Math.floor(Math.random() * playable.length)];

    case 'normal':
      return playable.reduce((best, i) => (score(hand[i]) > score(hand[best]) ? i : best), playable[0]);

    case 'hard': {
      let bestIdx = playable[0], bestScore = -Infinity;
      for (const idx of playable) {
        const card = hand[idx];
        const { state: after, ok } = playCard(state, 'enemy', idx, playOpts(card, state.enemy));
        if (!ok) continue;
        const dmgDealt    = state.player.hp - after.player.hp;
        const dmgReceived = estimatePlayerBestDamage(after);
        const sc = dmgDealt - dmgReceived * 0.6; // léger biais offensif
        if (sc > bestScore) { bestScore = sc; bestIdx = idx; }
      }
      return bestIdx;
    }

    default:
      return playable[0];
  }
}

/**
 * Joue tout le tour de l'IA (peut enchaîner plusieurs cartes).
 * @param {object} state phase = 'enemy_turn', énergie déjà attribuée par startTurn().
 */
export function runEnemyTurn(state, difficulty = 'normal') {
  let s = state;
  let guard = 0;
  while (s.phase !== 'end') {
    const idx = aiChooseCard(s.enemy.hand, s, difficulty);
    if (idx === -1) break;
    const card = s.enemy.hand[idx];
    const { state: ns, ok } = playCard(s, 'enemy', idx, playOpts(card, s.enemy));
    if (!ok) break;
    s = ns;
    if (getBattleResult(s)) { s = { ...s, phase: 'end' }; break; }
    if (++guard > 30) break; // garde-fou anti-boucle
  }
  return s;
}
