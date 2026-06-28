// logic/battleEngine.js — moteur de combat v3 (Phase 2 : skills Champion)
// Voir docs/RULES.md. Fonctions quasi-pures : chaque appel renvoie un nouvel état.
//
// API publique :
//   createBattle(playerDeck, enemyDeck)
//   mulligan(sideKey, state)
//   startTurn(sideKey, state)             -> début de tour (énergie, garde, pioche, cooldowns)
//   playCard(state, sideKey, cardIndex, opts?) -> { state, ok, reason?, needsDiscard?, card? }
//   useChampionSkill(state, sideKey)      -> { state, ok, reason?, log } [NOUVEAU v3]
//   drawCards(sideKey, state, count)
//   getBattleResult(state)
//   endPlayerTurn(state, difficulty)      -> wrapper pratique

import { tickSkillCooldowns, setActiveChampion, useSkill, canUseSkill } from './skillEngine.js?v=11';

export const START_HP     = 30;
export const ENERGY_MAX   = 7;
export const FIELD_MAX     = 5;
export const FATIGUE       = 2;
export const TERRAIN_GUARD = 1;
export const START_HAND    = 3;

const other = (k) => (k === 'player' ? 'enemy' : 'player');
const label = (k) => (k === 'player' ? 'Joueur' : 'Ennemi');
const clone = (s) => JSON.parse(JSON.stringify(s));

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Bouclier & dégâts ────────────────────────────────────────────────────────

function fieldShield(side) {
  return (side.field || []).reduce((a, c) => a + (c.shield || 0), 0);
}
function totalShield(side) {
  return (side.shieldTemp || 0) + fieldShield(side);
}
function applyDamage(side, raw) {
  if (side._absorbAllThisTurn) return { ...side, _lastDmg: 0, _blocked: raw };
  if (side._fullDodgeThisTurn) return { ...side, _lastDmg: 0, _blocked: raw };
  let effective = raw;
  if (side._halfDmgThisTurn) effective = Math.ceil(raw / 2);
  const blocked = Math.min(effective, totalShield(side));
  const dealt   = effective - blocked;
  return { ...side, hp: Math.max(0, side.hp - dealt), _lastDmg: dealt, _blocked: blocked + (raw - effective) };
}
function drainBuffs(side) {
  const bonus = (side.buffs || []).reduce((a, b) => a + (b.powerBoost || 0), 0);
  return { bonus, side: { ...side, buffs: [] } };
}

// ─── Création ─────────────────────────────────────────────────────────────────

export function createBattle(playerDeck, enemyDeck) {
  const makeSide = (deck) => ({
    hp: START_HP,
    energy: 1,
    hand: [],
    deck: [...deck],
    discard: [],
    field: [],
    terrain: null,
    buffs: [],
    shieldTemp: 0,
    activeChampion: null,      // { id, name, skill, power, shield } — v3
    skillCooldowns: {},        // { [cardId]: turnsLeft } — v3
    stunnedTurns: 0,           // tours d'étourdissement restants — v3
    _halfDmgThisTurn: false,
    _absorbAllThisTurn: false,
    _fullDodgeThisTurn: false,
    _dodgeNextAttack: false,
    _nextSkillNegated: false,
    _nextCardNegated: false,
    _doubleTurnNext: false,
  });

  let s = {
    turn: 1,
    energyMax: ENERGY_MAX,
    player: makeSide(playerDeck),
    enemy:  makeSide(enemyDeck),
    log: [],
    phase: 'player_turn',
  };
  s = drawCards('player', s, START_HAND);
  s = drawCards('enemy',  s, START_HAND);
  s.log.push('⚔️  Combat démarré — Tour 1');
  return s;
}

// ─── Mulligan ─────────────────────────────────────────────────────────────────

export function mulligan(sideKey, state) {
  const s = clone(state);
  const side = s[sideKey];
  side.deck = shuffle([...side.deck, ...side.hand]);
  side.hand = [];
  for (let i = 0; i < START_HAND && side.deck.length; i++) side.hand.push(side.deck.shift());
  s.log.push(`🔄 ${label(sideKey)} : mulligan`);
  return s;
}

// ─── Pioche ───────────────────────────────────────────────────────────────────

export function drawCards(sideKey, state, count = 1) {
  const s = clone(state);
  const side = s[sideKey];
  let fatigue = 0;
  for (let i = 0; i < count; i++) {
    if (side.deck.length) side.hand.push(side.deck.shift());
    else { side.hp = Math.max(0, side.hp - FATIGUE); fatigue += FATIGUE; }
  }
  if (fatigue) s.log.push(`  💀 ${label(sideKey)} : deck vide, fatigue −${fatigue} PV`);
  return s;
}

// ─── Début de tour ────────────────────────────────────────────────────────────

export function startTurn(sideKey, state) {
  let s = clone(state);
  if (sideKey === 'player') s.turn += 1;

  // Réinitialise les flags one-shot
  s[sideKey].shieldTemp           = s[sideKey].terrain ? TERRAIN_GUARD : 0;
  s[sideKey]._halfDmgThisTurn     = false;
  s[sideKey]._absorbAllThisTurn   = false;
  s[sideKey]._fullDodgeThisTurn   = false;

  // Étourdissement : le camp ne peut pas jouer de cartes
  if (s[sideKey].stunnedTurns > 0) {
    s[sideKey].stunnedTurns--;
    s.log.push(`  😵 ${label(sideKey)} est étourdi ce tour — aucune action possible.`);
    s.phase = sideKey === 'player' ? 'player_stunned' : 'enemy_stunned';
    return s;
  }

  s[sideKey].energy = Math.min(s.turn, s.energyMax);
  s.phase = sideKey === 'player' ? 'player_turn' : 'enemy_turn';

  // Tick cooldowns skills
  s = tickSkillCooldowns(s, sideKey);

  // Retour objets hijackés
  s = returnHijackedObjects(s, sideKey);

  s = drawCards(sideKey, s, 1);
  if (s[sideKey].terrain) s.log.push(`  🌍 ${label(sideKey)} : Terrain — +${TERRAIN_GUARD} garde`);
  s.log.push(`\n⚔️  ${sideKey === 'player' ? 'Ton tour' : 'Tour ennemi'} — Tour ${s.turn} · Énergie ${s[sideKey].energy}`);
  return s;
}

function returnHijackedObjects(state, sideKey) {
  const s = clone(state);
  const field = s[sideKey].field || [];
  const expired = field.filter(c => c._hijacked && c._returnAfterTurn <= (s.turn || 1));
  if (!expired.length) return s;
  s[sideKey].field = field.filter(c => !(c._hijacked && c._returnAfterTurn <= (s.turn || 1)));
  // Remet les objets à l'ennemi
  expired.forEach(obj => {
    const def = other(sideKey);
    s[def].field = [...(s[def].field || []), { ...obj, _hijacked: false }];
    s.log.push(`  🔄 "${obj.name}" retourné à ${label(def)}`);
  });
  return s;
}

// ─── Jouer une carte ──────────────────────────────────────────────────────────

export function playCard(state, sideKey, cardIndex, opts = {}) {
  const card = state[sideKey].hand[cardIndex];
  if (!card) return { state, ok: false, reason: 'Carte introuvable.' };

  // Carte annulée par negate_next_card
  if (state[sideKey]._nextCardNegated) {
    let s = clone(state);
    s[sideKey]._nextCardNegated = false;
    s[sideKey].hand.splice(cardIndex, 1);
    s.log.push(`  🚫 Carte "${card.name}" annulée par l'adversaire.`);
    return { state: s, ok: false, reason: 'Carte annulée.', card };
  }

  if (state[sideKey].energy < card.energy) {
    return { state, ok: false, reason: `Énergie insuffisante (${state[sideKey].energy}/${card.energy}).` };
  }

  const isField = card.type === 'Object' || card.type === 'Companion';
  const fieldFull = isField && (state[sideKey].field || []).length >= FIELD_MAX;
  if (fieldFull && opts.replaceFieldIndex == null) {
    return { state, ok: false, reason: 'Champ plein', needsDiscard: true };
  }

  let s = clone(state);
  s[sideKey].energy -= card.energy;
  s[sideKey].hand.splice(cardIndex, 1);

  if (fieldFull && opts.replaceFieldIndex != null) {
    const removed = s[sideKey].field.splice(opts.replaceFieldIndex, 1)[0];
    if (removed) {
      s[sideKey].discard = [...(s[sideKey].discard || []), removed];
      s.log.push(`  🗑️ ${label(sideKey)} défausse ${removed.name} du champ`);
    }
  }

  s = applyCardEffect(s, card, sideKey, other(sideKey));
  s.log.push(`🃏 ${label(sideKey)} joue [${card.name}] (${card.type} ${card.rarity}) — énergie ${s[sideKey].energy}`);

  if (s.player.hp <= 0 || s.enemy.hp <= 0) s.phase = 'end';
  return { state: s, ok: true, card };
}

// ─── Skill Champion (nouvelle API v3) ────────────────────────────────────────

export function useChampionSkill(state, sideKey) {
  // Bloqué si étourdi
  if (state[sideKey].stunnedTurns > 0) {
    return { state, ok: false, reason: 'Champion étourdi, skill indisponible.' };
  }
  // Bloqué par negate_next_skill
  if (state[sideKey]._nextSkillNegated) {
    let s = clone(state);
    s[sideKey]._nextSkillNegated = false;
    s.log.push(`  🚫 Skill de ${label(sideKey)} annulée par l'adversaire.`);
    return { state: s, ok: false, reason: 'Skill annulée par l\'adversaire.' };
  }
  const result = useSkill(state, sideKey);
  if (result.state.player.hp <= 0 || result.state.enemy.hp <= 0) {
    result.state.phase = 'end';
  }
  return result;
}

export { canUseSkill, getSkillCooldownLeft } from './skillEngine.js?v=11';

// ─── Effets par type ──────────────────────────────────────────────────────────

function applyCardEffect(s, card, atkKey, defKey) {
  const P = card.power || 0;
  const S = card.shield || 0;

  switch (card.type) {
    case 'Champion': {
      const { bonus, side: buffed } = drainBuffs(s[atkKey]);
      s[atkKey] = { ...buffed, shieldTemp: (buffed.shieldTemp || 0) + S };
      // Enregistre le Champion actif (avec sa skill)
      if (card.skill) s = setActiveChampion(s, atkKey, card);
      const tb  = s[atkKey].terrain ? 1 : 0;
      const dmg = P + bonus + tb;
      s[defKey] = applyDamage(s[defKey], dmg);
      s.log.push(`  ⚔️ ${card.name} : ${dmg} dmg${bonus ? ` (+${bonus} Companion)` : ''}${tb ? ' (+1 Terrain)' : ''} — reçu ${s[defKey]._lastDmg}, bloqué ${s[defKey]._blocked}${card.skill ? ` | Skill: ${card.skill.name} (CD ${card.skill.cooldown})` : ''}`);
      break;
    }
    case 'Companion': {
      s[atkKey] = {
        ...s[atkKey],
        buffs: [...(s[atkKey].buffs || []), { powerBoost: P }],
        field: [...(s[atkKey].field || []), { name: card.name, shield: S, kind: 'companion' }],
      };
      s.log.push(`  🐾 ${card.name} : +${P} prochain Champion, +${S} bouclier permanent`);
      break;
    }
    case 'Event': {
      s[defKey] = { ...s[defKey], hp: Math.max(0, s[defKey].hp - P) };
      s.log.push(`  ⚡ ${card.name} : ${P} dmg directs (ignore bouclier)`);
      s = drawCards(atkKey, s, 1);
      break;
    }
    case 'Object': {
      s[atkKey] = { ...s[atkKey], field: [...(s[atkKey].field || []), { name: card.name, shield: S, kind: 'object' }] };
      s.log.push(`  🛡️ ${card.name} : +${S} bouclier permanent`);
      break;
    }
    case 'Terrain': {
      s[atkKey] = { ...s[atkKey], terrain: { name: card.name, power: P } };
      const dmg = Math.round(P / 2);
      s[defKey] = applyDamage(s[defKey], dmg);
      s.log.push(`  🌍 ${card.name} : terrain actif, ${dmg} dmg`);
      break;
    }
    case 'Special': {
      s[defKey] = applyDamage(s[defKey], P);
      s[atkKey] = { ...s[atkKey], shieldTemp: (s[atkKey].shieldTemp || 0) + S };
      s.log.push(`  ✨ ${card.name} : ${P} dmg + ${S} garde`);
      break;
    }
    case 'Team': {
      const tb  = s[atkKey].terrain ? Math.round(P / 2) : 0;
      const dmg = P + tb;
      s[defKey] = applyDamage(s[defKey], dmg);
      s.log.push(`  👥 ${card.name} : ${dmg} dmg${tb ? ' (+Terrain)' : ''}`);
      break;
    }
    default:
      s[defKey] = applyDamage(s[defKey], P);
  }
  return s;
}

// ─── Résultat ─────────────────────────────────────────────────────────────────

export function getBattleResult(state) {
  if (state.phase !== 'end' && state.player.hp > 0 && state.enemy.hp > 0) return null;
  const playerDead = state.player.hp <= 0;
  const enemyDead  = state.enemy.hp <= 0;
  let winner;
  if (playerDead && enemyDead) winner = 'draw';
  else if (playerDead)         winner = 'enemy';
  else                         winner = 'player';
  const baseGold   = winner === 'player' ? 30 : winner === 'draw' ? 15 : 10;
  const speedBonus = winner === 'player' ? Math.max(0, (10 - state.turn) * 3) : 0;
  return { winner, turns: state.turn, goldReward: baseGold + speedBonus };
}

// ─── Wrapper endPlayerTurn ────────────────────────────────────────────────────

export function endPlayerTurn(state, difficulty = 'normal') {
  let s = startTurn('enemy', state);
  let guard = 0;
  while (s.phase === 'enemy_turn') {
    const playable = s.enemy.hand
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.energy <= s.enemy.energy);
    if (!playable.length) break;
    playable.sort((a, b) => (b.c.power / b.c.energy) - (a.c.power / a.c.energy));
    const { state: ns, ok } = playCard(s, 'enemy', playable[0].i);
    if (!ok) break;
    s = ns;
    if (getBattleResult(s)) { s.phase = 'end'; break; }
    if (++guard > 30) break;
  }
  if (s.phase === 'end') return s;
  return startTurn('player', s);
}
