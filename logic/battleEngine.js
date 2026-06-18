// logic/battleEngine.js
// Moteur de combat tour par tour — fonctions pures (pas de mutation d'état)

// ─── Helpers ────────────────────────────────────────────────────────────────

function clone(state) {
  return JSON.parse(JSON.stringify(state));
}

function log(state, msg) {
  return { ...state, log: [...state.log, msg] };
}

/** Calcule les dégâts reçus après shields */
function applyDamage(side, rawDmg, state) {
  const shieldTemp    = side.shieldTemp || 0;
  const objectShield  = (side.field || []).reduce((s, c) => s + (c.shield || 0), 0);
  const totalShield   = shieldTemp + objectShield;
  const actualDmg     = Math.max(0, rawDmg - totalShield);
  return { ...side, hp: Math.max(0, side.hp - actualDmg), _lastDmg: actualDmg, _blocked: rawDmg - actualDmg };
}

/** Collecte les bonus Companion accumulés puis les efface */
function drainCompanionBuffs(side) {
  const total = (side.buffs || []).reduce((s, b) => s + (b.powerBoost || 0), 0);
  return { bonus: total, side: { ...side, buffs: [] } };
}

// ─── Création ───────────────────────────────────────────────────────────────

/**
 * Crée l'état initial d'un combat.
 * @param {Array} playerDeck  6 cartes du joueur
 * @param {Array} enemyDeck   6 cartes de l'IA
 * @returns {BattleState}
 */
export function createBattle(playerDeck, enemyDeck) {
  const makeSide = (deck) => ({
    hp: 20,
    energy: 1,
    hand: [],
    deck: [...deck],
    field: [],      // Objects posés (shields permanents)
    buffs: [],      // Companion buffs en attente
    shieldTemp: 0,  // Shield actif seulement ce tour
  });

  let state = {
    turn: 1,
    energyMax: 6,
    player: makeSide(playerDeck),
    enemy:  makeSide(enemyDeck),
    log: [],
    phase: 'player_turn',
  };

  // Pioche initiale : 3 cartes chaque côté
  state = drawCards('player', state, 3);
  state = drawCards('enemy',  state, 3);
  state = log(state, `⚔️  Combat démarré — Tour 1`);
  return state;
}

// ─── Pioche ─────────────────────────────────────────────────────────────────

/**
 * Tire `count` cartes du deck vers la main d'un côté.
 * @param {'player'|'enemy'} sideKey
 */
export function drawCards(sideKey, state, count = 1) {
  let s = clone(state);
  const side = s[sideKey];
  for (let i = 0; i < count; i++) {
    if (!side.deck.length) break;
    side.hand.push(side.deck.shift());
  }
  return s;
}

// ─── Jouer une carte ─────────────────────────────────────────────────────────

/**
 * Le joueur joue la carte à l'index `cardIndex` de sa main.
 * @returns {{ state: BattleState, ok: boolean, reason?: string }}
 */
export function playCard(state, cardIndex) {
  if (state.phase !== 'player_turn') {
    return { state, ok: false, reason: "Ce n'est pas ton tour." };
  }
  const card = state.player.hand[cardIndex];
  if (!card) {
    return { state, ok: false, reason: 'Carte introuvable.' };
  }
  if (state.player.energy < card.energy) {
    return { state, ok: false, reason: `Énergie insuffisante (${state.player.energy}/${card.energy}).` };
  }

  let s = clone(state);

  // Dépense l'énergie et retire la carte de la main
  s.player.energy -= card.energy;
  s.player.hand.splice(cardIndex, 1);

  s = applyCardEffect(s, card, 'player', 'enemy');
  s = log(s, `🃏 Tu joues [${card.name}] (${card.type} ${card.rarity}) — énergie restante: ${s.player.energy}`);

  // Vérif fin de combat
  if (s.player.hp <= 0 || s.enemy.hp <= 0) {
    s.phase = 'end';
  }

  return { state: s, ok: true };
}

// ─── Effets des cartes ────────────────────────────────────────────────────────

/**
 * Applique l'effet d'une carte.
 * @param {'player'|'enemy'} attackerKey
 * @param {'player'|'enemy'} defenderKey
 */
function applyCardEffect(state, card, attackerKey, defenderKey) {
  let s = clone(state);
  const atk = s[attackerKey];
  const def = s[defenderKey];

  switch (card.type) {

    case 'Champion': {
      // Consomme les buffs Companion accumulés
      const { bonus, side: atkBuffed } = drainCompanionBuffs(atk);
      s[attackerKey] = { ...atkBuffed, shieldTemp: (atkBuffed.shieldTemp || 0) + card.shield };
      const dmg = card.power + bonus;
      const newDef = applyDamage(def, dmg, s);
      s[defenderKey] = newDef;
      s = log(s, `  ⚔️  ${card.name} frappe pour ${dmg}${bonus ? ` (+${bonus} Companion)` : ''} dmg, bloqué ${newDef._blocked}, reçu ${newDef._lastDmg}`);
      break;
    }

    case 'Companion': {
      s[attackerKey] = { ...atk, buffs: [...(atk.buffs || []), { powerBoost: card.power, from: card.name }] };
      s = log(s, `  🐾 ${card.name} prépare +${card.power} power pour le prochain Champion`);
      break;
    }

    case 'Event': {
      // Dégâts directs (ignore shield) + pioche
      const newDef = { ...def, hp: Math.max(0, def.hp - card.power) };
      s[defenderKey] = newDef;
      s = log(s, `  ⚡ ${card.name} inflige ${card.power} dmg directs (ignore shield)`);
      s = drawCards(attackerKey, s, 1);
      s = log(s, `  📤 Tu pioches une carte`);
      break;
    }

    case 'Object': {
      const maxObjects = 5;
      if ((atk.field || []).length < maxObjects) {
        s[attackerKey] = { ...atk, field: [...(atk.field || []), { name: card.name, shield: card.shield }] };
        s = log(s, `  🔧 ${card.name} posé — +${card.shield} shield permanent`);
      } else {
        s = log(s, `  🔧 ${card.name} : champ plein (max ${maxObjects} objets), ignoré`);
      }
      break;
    }

    case 'Terrain': {
      // Boost tous les shields du joueur ce tour + dégâts faibles
      s[attackerKey] = { ...atk, shieldTemp: (atk.shieldTemp || 0) + 1 };
      const terrainDmg = Math.round(card.power / 2);
      const newDefT = applyDamage(def, terrainDmg, s);
      s[defenderKey] = newDefT;
      s = log(s, `  🌍 ${card.name} : shields +1, inflige ${terrainDmg} dmg`);
      break;
    }

    case 'Special': {
      const newDefS = applyDamage(def, card.power, s);
      s[defenderKey] = newDefS;
      s[attackerKey] = { ...atk, shieldTemp: (atk.shieldTemp || 0) + card.shield };
      s = log(s, `  ✨ ${card.name} : ${card.power} dmg + ${card.shield} shield`);
      break;
    }

    case 'Team': {
      // Ignore les buffs Companion, dégâts x1.5
      const teamDmg = Math.round(card.power * 1.5);
      const newDefTe = applyDamage(def, teamDmg, s);
      s[defenderKey] = newDefTe;
      s = log(s, `  👥 ${card.name} frappe en équipe pour ${teamDmg} dmg`);
      break;
    }

    default: {
      // Fallback : dégâts simples
      const newDefD = applyDamage(def, card.power, s);
      s[defenderKey] = newDefD;
      s = log(s, `  📄 ${card.name} : ${card.power} dmg`);
    }
  }

  return s;
}

// ─── Fin de tour joueur → tour ennemi → nouveau tour joueur ──────────────────

/**
 * Termine le tour du joueur, fait jouer l'IA (facile par défaut), démarre le tour suivant.
 * Pour une IA plus avancée, importer aiEngine.js et appeler runEnemyTurn() manuellement.
 * @returns {BattleState}
 */
export function endPlayerTurn(state) {
  if (state.phase !== 'player_turn') return state;

  let s = clone(state);
  s.phase = 'enemy_turn';

  // Réinitialise le shield temporaire du joueur
  s.player = { ...s.player, shieldTemp: 0 };

  s = log(s, `--- Tour ennemi ---`);

  // IA basique : joue toutes les cartes jouables du meilleur ratio power/energy
  let played = true;
  while (played) {
    played = false;
    const playable = s.enemy.hand
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.energy <= s.enemy.energy);
    if (!playable.length) break;

    // Choisit la carte avec le meilleur ratio power/energy
    playable.sort((a, b) => (b.c.power / b.c.energy) - (a.c.power / a.c.energy));
    const { i } = playable[0];
    const card = s.enemy.hand[i];

    s.enemy.energy -= card.energy;
    s.enemy.hand.splice(i, 1);
    s = applyCardEffect(s, card, 'enemy', 'player');
    s = log(s, `  🤖 IA joue [${card.name}]`);
    played = true;

    if (s.player.hp <= 0 || s.enemy.hp <= 0) {
      s.phase = 'end';
      return s;
    }
  }

  // Démarre le tour suivant
  s.turn += 1;
  const newEnergy = Math.min(s.turn, s.energyMax);
  s.phase = 'player_turn';
  s.player = { ...s.player, energy: newEnergy, shieldTemp: 0 };
  s.enemy  = { ...s.enemy,  energy: newEnergy, shieldTemp: 0 };

  // Pioche 1 carte chaque côté si possible
  s = drawCards('player', s, 1);
  s = drawCards('enemy',  s, 1);

  s = log(s, `\n⚔️  Tour ${s.turn} — Énergie: ${newEnergy}`);
  return s;
}

// ─── Résultat ────────────────────────────────────────────────────────────────

/**
 * Retourne le résultat du combat ou null si toujours en cours.
 * @returns {null | { winner: 'player'|'enemy'|'draw', turns: number, goldReward: number }}
 */
export function getBattleResult(state) {
  if (state.phase !== 'end') {
    if (state.player.hp > 0 && state.enemy.hp > 0) return null;
  }
  const playerDead = state.player.hp <= 0;
  const enemyDead  = state.enemy.hp <= 0;
  let winner;
  if (playerDead && enemyDead) winner = 'draw';
  else if (playerDead) winner = 'enemy';
  else winner = 'player';

  // Récompense or : victoire rapide = plus de gold
  const baseGold = winner === 'player' ? 30 : 10;
  const speedBonus = winner === 'player' ? Math.max(0, (10 - state.turn) * 3) : 0;
  const goldReward = baseGold + speedBonus;

  return { winner, turns: state.turn, goldReward };
}
