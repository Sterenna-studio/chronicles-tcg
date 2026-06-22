// logic/aiEngine.js
// IA pour le moteur de combat — 3 niveaux de difficulté
// Dépend de battleEngine.js pour la simulation (niveau hard)

import { playCard as enginePlayCard, getBattleResult } from './battleEngine.js?v=3';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Retourne les indices des cartes jouables (énergie suffisante) */
function playableIndices(hand, energy) {
  return hand
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => c.energy <= energy)
    .map(({ i }) => i);
}

/** Score d'une carte pour le niveau Normal */
function cardScore(card) {
  if (!card.energy) return 0;
  return card.power / card.energy;
}

/**
 * Simule le meilleur coup possible du joueur sur l'état donné.
 * Utilisé par le niveau Hard pour anticiper la riposte.
 * @returns {number} dégâts estimés que le joueur pourrait infliger
 */
function estimatePlayerBestDamage(state) {
  const playable = playableIndices(state.player.hand, state.player.energy);
  if (!playable.length) return 0;

  let maxDmg = 0;
  for (const idx of playable) {
    const { state: after } = enginePlayCard(state, idx);
    const dmgDealt = state.enemy.hp - after.enemy.hp;
    if (dmgDealt > maxDmg) maxDmg = dmgDealt;
  }
  return maxDmg;
}

// ─── Export principal ────────────────────────────────────────────────────────

/**
 * Choisit la carte que l'IA doit jouer.
 *
 * @param {Array}  hand        Main de l'IA (enemy.hand)
 * @param {object} state       BattleState courant (phase = enemy_turn)
 * @param {'easy'|'normal'|'hard'} difficulty
 * @returns {number}  Index de la carte à jouer, ou -1 si aucune jouable
 */
export function aiChooseCard(hand, state, difficulty = 'normal') {
  const energy   = state.enemy.energy;
  const playable = playableIndices(hand, energy);
  if (!playable.length) return -1;

  switch (difficulty) {

    // ── Facile : aléatoire parmi les jouables ──────────────────────────────
    case 'easy': {
      return playable[Math.floor(Math.random() * playable.length)];
    }

    // ── Normal : meilleur ratio power / energy_cost ────────────────────────
    case 'normal': {
      return playable.reduce((best, i) =>
        cardScore(hand[i]) > cardScore(hand[best]) ? i : best
      , playable[0]);
    }

    // ── Hard : minimax 1 niveau — maximise (dmg infligés - riposte estimée) ─
    case 'hard': {
      let bestIdx   = playable[0];
      let bestScore = -Infinity;

      for (const idx of playable) {
        // Crée un état temporaire où l'IA joue cette carte
        const card = hand[idx];

        // Simule le coup depuis le point de vue ennemi
        // On swap player/enemy pour réutiliser playCard()
        const swapped = swapSides(state);
        const { state: afterSwap, ok } = enginePlayCard(swapped, idx);
        if (!ok) continue;
        const afterReal = swapSides(afterSwap);

        const dmgDealt   = state.player.hp  - afterReal.player.hp;
        const dmgReceived = estimatePlayerBestDamage(afterReal);
        const score = dmgDealt - dmgReceived * 0.6; // léger biais offensif

        if (score > bestScore) {
          bestScore = score;
          bestIdx   = idx;
        }
      }

      return bestIdx;
    }

    default:
      return playable[0];
  }
}

/**
 * Fait jouer l'IA son tour complet (peut jouer plusieurs cartes).
 * À utiliser à la place du AI basique dans battleEngine.endPlayerTurn()
 * quand on veut un niveau spécifique.
 *
 * @param {object} state       BattleState (phase = enemy_turn)
 * @param {'easy'|'normal'|'hard'} difficulty
 * @returns {BattleState}
 */
export function runEnemyTurn(state, difficulty = 'normal') {
  let s = { ...state };

  let played = true;
  while (played) {
    played = false;
    if (s.phase === 'end') break;

    const idx = aiChooseCard(s.enemy.hand, s, difficulty);
    if (idx === -1) break;

    const card = s.enemy.hand[idx];

    // Swap pour réutiliser playCard() (qui est orientée "player")
    const swapped = swapSides(s);
    const { state: afterSwap, ok } = enginePlayCard(swapped, idx);
    if (!ok) break;

    s = swapSides(afterSwap);
    played = true;

    if (getBattleResult(s)) { s.phase = 'end'; break; }
  }

  return s;
}

// ─── Swap sides (utilitaire interne) ─────────────────────────────────────────
// Inverse player ↔ enemy pour réutiliser les fonctions orientées "player"

function swapSides(state) {
  return {
    ...state,
    player: state.enemy,
    enemy:  state.player,
    phase:  state.phase === 'player_turn' ? 'enemy_turn' : state.phase,
  };
}
