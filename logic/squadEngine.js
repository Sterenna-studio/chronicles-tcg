// logic/squadEngine.js — moteur du Mode Escouade (3 Champions).
// Voir docs/RULES_JRPG.md. Fonctions quasi-pures : chaque appel renvoie un
// nouvel état (clone). Réutilise logic/skillEngine.js pour les attaques spéciales.
//
// Modèle (spec §3-§8) :
//   - Pool de PV partagé (30) par camp, pas de KO individuel.
//   - Escouade = 3 Champions posés au départ, chacun avec jusqu'à 3 cartes
//     équipées (Object/Companion passifs, Special/Event/Team actifs) + 1 Terrain
//     d'équipe.
//   - 1 action / champion / tour : attaque de base, OU skill (énergie +1, cooldown),
//     OU déclencher un actif équipé (consomme l'action ; Event/Team 1×/combat).
//   - Bouclier = garde temporaire (shieldTemp) + bouclier permanent d'équipe
//     (somme des shield des Object/Companion équipés, stockés dans `field`).
//
// API publique :
//   createSquadBattle(playerSquad, enemySquad)
//   startSquadTurn(sideKey, state)
//   championAct(state, sideKey, championIndex, action)   action = {type:'basic'|'skill'|'active', equipIndex?}
//   getSquadResult(state)
//   autoPlaySquadTurn(state, sideKey, difficulty, onStep?)   // IA ; onStep = animation
//   planAutoTurn(state, sideKey, difficulty) -> { frames, final }   // tour IA en frames
//   endSquadPlayerTurn(state, difficulty)
//   mulliganEquipment(state, sideKey)        // rebat la main d'ouverture (mode deck)
//   openEnemyTurn(state, difficulty)         // l'ennemi prend la main et ouvre le combat
//   Helpers UI : championAttackPower, teamShield, canChampionAct

import { tickSkillCooldowns, setActiveChampion, useSkill } from './skillEngine.js?v=24';

export const SQUAD_HP        = 30;
export const ENERGY_MAX      = 7;
export const SKILL_EXTRA_COST = 1;   // surcoût du spécial (§4)
export const TERRAIN_DMG     = 1;    // +1 dégât aux attaques si Terrain (§5)
export const TERRAIN_GUARD   = 1;    // +1 garde/tour si Terrain (§5)
export const MAX_EQUIP       = 3;
export const SQUAD_SIZE      = 3;
export const DEFAULT_SLOTS   = 3;    // emplacements d'équipement / champion (dynamique : cf champion.slots)
export const DRAW_PER_TURN   = 3;    // cartes d'équipement piochées par tour (mode deck)
export const DECK_SIZE       = 20;   // taille du deck d'équipement (validée à l'Atelier)
// 🎚️ Rééquilibrage Escouade : les cartes portent des valeurs pensées pour le mode
// 1-champion (energy 3-7 = coût de pose, shield 4-6). En escouade on CUMULE 3
// champions × plusieurs équipements, donc on réinterprète ces valeurs :
export const MAX_TEAM_SHIELD = 8;   // plafond du bouclier permanent d'équipe (anti-mur)
export const COST_DIVISOR    = 3;   // coût d'action = max(1, ceil(energy_carte / diviseur))

const PASSIVE_TYPES = ['Object', 'Companion'];
const ONESHOT_TYPES = ['Event', 'Team'];

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

// ─── Bouclier & dégâts (mêmes règles que skillEngine pour cohérence) ───────────

function fieldShield(side) {
  const sum = (side.field || []).reduce((a, c) => a + (c.shield || 0), 0);
  return Math.min(MAX_TEAM_SHIELD, sum);   // 🎚️ plafonné (anti-mur)
}
export function teamShield(side) {
  return (side.shieldTemp || 0) + fieldShield(side);
}

/**
 * Coût en énergie d'une action en Escouade, rééchelonné depuis l'`energy` de la
 * carte (`max(1, ceil(energy / COST_DIVISOR))`). Les valeurs brutes 3-7 rendraient
 * le pool `min(tour, 7)` injouable avec 3 champions. 🎚️
 */
export function actionCost(card, type = 'basic') {
  const base = Math.max(1, Math.ceil((card?.energy || 1) / COST_DIVISOR));
  return type === 'skill' ? base + SKILL_EXTRA_COST : base;
}
function applyDamage(state, defKey, raw, ignoreShield = false) {
  const def = state[defKey];
  if (def._absorbAllThisTurn || def._fullDodgeThisTurn) {
    def._lastDmg = 0; def._blocked = raw; return;
  }
  let eff = raw;
  if (def._halfDmgThisTurn) eff = Math.ceil(eff / 2);
  const blocked = ignoreShield ? 0 : Math.min(eff, teamShield(def));
  const dealt = eff - blocked;
  def.hp = Math.max(0, def.hp - dealt);
  def._lastDmg = dealt;
  def._blocked = blocked;
}

// ─── Construction ──────────────────────────────────────────────────────────────

// Recalcule la puissance passive de chaque champion + le bouclier permanent
// d'équipe (`field`), à appeler après toute modification d'équipement.
function recomputeSide(side) {
  side.champions.forEach((ch) => {
    ch.passivePower = (ch.equipment || [])
      .filter((e) => PASSIVE_TYPES.includes(e.type))
      .reduce((a, e) => a + (e.power || 0), 0);
  });
  side.field = [];
  side.champions.forEach((ch) => (ch.equipment || []).forEach((e) => {
    if (PASSIVE_TYPES.includes(e.type) && (e.shield || 0) > 0) {
      side.field.push({ name: e.name, shield: e.shield, kind: e.type.toLowerCase(), championId: ch.id });
    }
  }));
}

function makeSide(squad) {
  const slots = squad.slots || [];
  // Mode "deck" : l'escouade fournit `equipmentDeck` → les champions démarrent SANS
  // équipement, on pioche/équipe en combat. Sinon mode "legacy" : l'équipement est
  // figé sur chaque champion (tutoriel, ennemi pré-équipé, anciennes escouades).
  const useDeck = Array.isArray(squad.equipmentDeck);

  const champions = slots.map((slot) => {
    const c = slot.champion || {};
    const equipment = useDeck ? [] : (slot.equipment || []).map((e) => ({ ...e }));
    return {
      id: c.id, name: c.name, power: c.power || 0, shield: c.shield || 0,
      energy: c.energy || 1, rarity: c.rarity, skill: c.skill || null,
      equipment,
      slots: c.slots || DEFAULT_SLOTS,   // emplacements (dynamique : un effet peut le faire varier)
      passivePower: 0,                   // (re)calculé par recomputeSide
      actedThisTurn: false,
      usedActives: {},                   // equipIndex -> true (Event/Team consommés)
    };
  });

  const side = {
    hp: SQUAD_HP,
    energy: 1,
    champions,
    terrain: squad.terrain || null,
    shieldTemp: 0,
    field: [],                          // bouclier permanent (rempli par recomputeSide)
    useDeck,
    equipDeck:    useDeck ? shuffle((squad.equipmentDeck || []).map((e) => ({ ...e }))) : [],
    equipHand:    [],                   // main d'équipement (mode deck)
    equipDiscard: [],
    deck: [], discard: [], buffs: [],   // compat skillEngine (effets bord)
    skillCooldowns: {},
    stunnedTurns: 0,
    activeChampion: null,
    _halfDmgThisTurn: false,
    _absorbAllThisTurn: false,
    _fullDodgeThisTurn: false,
    _dodgeNextAttack: false,
    _nextSkillNegated: false,
    _nextCardNegated: false,
    _doubleTurnNext: false,
  };
  recomputeSide(side);
  return side;
}

// ─── Équipement « en main » (mode deck) ─────────────────────────────────────────

/** Pioche n cartes d'équipement du deck vers la main (mode deck uniquement). */
export function drawEquipment(state, sideKey, n = DRAW_PER_TURN) {
  const s = clone(state);
  const side = s[sideKey];
  if (!side.useDeck) return s;
  for (let i = 0; i < n && side.equipDeck.length; i++) side.equipHand.push(side.equipDeck.shift());
  return s;
}

/**
 * Équipe une carte de la main (handIndex) sur un champion. Coûte de l'énergie
 * (= actionCost de la carte). Si le champion est plein, `replaceEquipIndex` indique
 * la carte à remplacer (l'ancienne part à la défausse).
 */
export function equipCard(state, sideKey, championIndex, handIndex, replaceEquipIndex = null) {
  const side0 = state[sideKey];
  const card = side0.equipHand?.[handIndex];
  const ch0 = side0.champions[championIndex];
  if (!card) return { state, ok: false, reason: 'Carte introuvable.' };
  if (!ch0)  return { state, ok: false, reason: 'Champion introuvable.' };
  const cost = actionCost(card);
  if (side0.energy < cost) return { state, ok: false, reason: `Énergie insuffisante (${side0.energy}/${cost}).` };
  const cap = ch0.slots || DEFAULT_SLOTS;
  const full = ch0.equipment.length >= cap;
  if (full && replaceEquipIndex == null) {
    return { state, ok: false, reason: 'Emplacements pleins.', needsReplace: true };
  }

  const s = clone(state);
  const side = s[sideKey];
  const ch = side.champions[championIndex];
  const [played] = side.equipHand.splice(handIndex, 1);
  if (full) {
    const [old] = ch.equipment.splice(replaceEquipIndex, 1);
    if (old) { side.equipDiscard.push(old); delete ch.usedActives[replaceEquipIndex]; }
  }
  ch.equipment.push(played);
  side.energy -= cost;
  recomputeSide(side);
  s.log.push(`  🔧 ${ch.name} équipe ${played.name} (${cost}⚡)`);
  return { state: s, ok: true };
}

/** Retire un équipement d'un champion (part à la défausse). Libère un emplacement. */
export function unequipCard(state, sideKey, championIndex, equipIndex) {
  const s = clone(state);
  const ch = s[sideKey].champions[championIndex];
  const [old] = ch.equipment.splice(equipIndex, 1);
  if (!old) return { state, ok: false, reason: 'Équipement introuvable.' };
  s[sideKey].equipDiscard.push(old);
  delete ch.usedActives[equipIndex];
  recomputeSide(s[sideKey]);
  s.log.push(`  🗑️ ${ch.name} retire ${old.name}`);
  return { state: s, ok: true };
}

export function createSquadBattle(playerSquad, enemySquad) {
  let s = {
    turn: 1,
    energyMax: ENERGY_MAX,
    player: makeSide(playerSquad),
    enemy: makeSide(enemySquad),
    log: [],
    phase: 'player_turn',
  };
  s.log.push('⚔️  Combat d\'escouade démarré — Tour 1');
  // Main d'ouverture (mode deck)
  if (s.player.useDeck) s = drawEquipment(s, 'player');
  if (s.enemy.useDeck)  s = drawEquipment(s, 'enemy');
  return s;
}

/**
 * Mulligan : rend la main d'ouverture au deck, rebat, et repioche autant de
 * cartes. Un seul mulligan d'ouverture (la décision est prise côté UI). Mode deck
 * uniquement ; no-op sinon.
 */
export function mulliganEquipment(state, sideKey) {
  const s = clone(state);
  const side = s[sideKey];
  if (!side.useDeck) return s;
  const n = side.equipHand.length;
  side.equipDeck = shuffle([...side.equipDeck, ...side.equipHand]);
  side.equipHand = [];
  for (let i = 0; i < n && side.equipDeck.length; i++) side.equipHand.push(side.equipDeck.shift());
  s.log.push(`  🔀 ${label(sideKey)} rebat sa main d'ouverture.`);
  return s;
}

/**
 * Initiative ennemie : l'ennemi « prend la main » et joue le tout premier tour
 * (énergie du tour 1), puis rend la main au joueur. Utilisé quand le Sceau
 * d'ouverture désigne l'ennemi et qu'il choisit d'ouvrir la Chronique. La main
 * d'ouverture (3 cartes) a déjà été piochée par createSquadBattle.
 */
export function openEnemyTurn(state, difficulty = 'normal') {
  let s = clone(state);
  s.enemy.energy = Math.min(s.turn, s.energyMax);
  s.phase = 'enemy_turn';
  s.log.push(`\n⚔️  L'adversaire ouvre la Chronique — Tour ${s.turn} · Énergie ${s.enemy.energy}`);
  s = autoPlaySquadTurn(s, 'enemy', difficulty);
  if (getSquadResult(s)) { s.phase = 'end'; return s; }
  s.phase = 'player_turn';
  return s;
}

// ─── Début de tour ──────────────────────────────────────────────────────────────

function returnHijackedObjects(state, sideKey) {
  const field = state[sideKey].field || [];
  const expired = field.filter((c) => c._hijacked && c._returnAfterTurn <= (state.turn || 1));
  if (!expired.length) return;
  state[sideKey].field = field.filter((c) => !(c._hijacked && c._returnAfterTurn <= (state.turn || 1)));
  expired.forEach((obj) => {
    const def = other(sideKey);
    state[def].field = [...(state[def].field || []), { ...obj, _hijacked: false }];
    state.log.push(`  🔄 "${obj.name}" retourné à ${label(def)}`);
  });
}

export function startSquadTurn(sideKey, state) {
  let s = clone(state);
  if (sideKey === 'player') s.turn += 1;

  // Garde remise à la valeur Terrain (sinon 0) ; flags one-shot réinitialisés
  s[sideKey].shieldTemp         = s[sideKey].terrain ? TERRAIN_GUARD : 0;
  s[sideKey]._halfDmgThisTurn   = false;
  s[sideKey]._absorbAllThisTurn = false;
  s[sideKey]._fullDodgeThisTurn = false;
  s[sideKey].champions.forEach((ch) => { ch.actedThisTurn = false; });

  if (s[sideKey].stunnedTurns > 0) {
    s[sideKey].stunnedTurns--;
    s.log.push(`  😵 ${label(sideKey)} est étourdi ce tour — aucune action.`);
    s.phase = sideKey === 'player' ? 'player_stunned' : 'enemy_stunned';
    return s;
  }

  s[sideKey].energy = Math.min(s.turn, s.energyMax);
  s.phase = sideKey === 'player' ? 'player_turn' : 'enemy_turn';
  if (s[sideKey].useDeck) s = drawEquipment(s, sideKey);   // pioche d'équipement du tour
  s = tickSkillCooldowns(s, sideKey);
  returnHijackedObjects(s, sideKey);

  if (s[sideKey].terrain) s.log.push(`  🌍 ${label(sideKey)} : Terrain — +${TERRAIN_GUARD} garde`);
  s.log.push(`\n⚔️  ${sideKey === 'player' ? 'Ton tour' : 'Tour ennemi'} — Tour ${s.turn} · Énergie ${s[sideKey].energy}`);
  return s;
}

// ─── Helpers d'action ────────────────────────────────────────────────────────────

/** Dégâts d'attaque de base d'un champion (power + passifs + Terrain). */
export function championAttackPower(side, i) {
  const ch = side.champions[i];
  if (!ch) return 0;
  return (ch.power || 0) + (ch.passivePower || 0) + (side.terrain ? TERRAIN_DMG : 0);
}

/** Le champion peut-il agir ce tour ? (existe, pas déjà agi, camp non étourdi) */
export function canChampionAct(state, sideKey, i) {
  if (state.phase === `${sideKey}_stunned`) return false;
  const ch = state[sideKey].champions[i];
  return !!ch && !ch.actedThisTurn;
}

function finishAction(s) {
  if (s.player.hp <= 0 || s.enemy.hp <= 0) s.phase = 'end';
  return s;
}

// ─── Jouer une action d'un champion ──────────────────────────────────────────────

export function championAct(state, sideKey, championIndex, action = {}) {
  const side0 = state[sideKey];
  const ch0 = side0.champions[championIndex];
  if (!ch0) return { state, ok: false, reason: 'Champion introuvable.' };
  if (state.phase === `${sideKey}_stunned`) return { state, ok: false, reason: 'Escouade étourdie ce tour.' };
  if (ch0.actedThisTurn) return { state, ok: false, reason: `${ch0.name} a déjà agi ce tour.` };

  const defKey = other(sideKey);
  const tb = side0.terrain ? TERRAIN_DMG : 0;

  // ── Attaque spéciale (skill) ─────────────────────────────────────────────
  if (action.type === 'skill') {
    if (!ch0.skill) return { state, ok: false, reason: `${ch0.name} n'a pas de skill.` };
    const cd = side0.skillCooldowns?.[ch0.id] || 0;
    if (cd > 0) return { state, ok: false, reason: `Skill en recharge (${cd}).` };
    const cost = actionCost(ch0, 'skill');
    if (side0.energy < cost) return { state, ok: false, reason: `Énergie insuffisante (${side0.energy}/${cost}).` };

    let s = setActiveChampion(state, sideKey, {
      id: ch0.id, name: ch0.name, skill: ch0.skill, power: ch0.power, shield: ch0.shield,
    });
    const res = useSkill(s, sideKey);
    s = res.state;
    if (!res.ok) return { state, ok: false, reason: res.reason };
    s[sideKey].energy -= cost;
    s[sideKey].champions[championIndex].actedThisTurn = true;
    return { state: finishAction(s), ok: true, log: res.log };
  }

  // ── Déclencher un actif équipé (Special / Event / Team) ──────────────────
  if (action.type === 'active') {
    const equip = ch0.equipment[action.equipIndex];
    if (!equip) return { state, ok: false, reason: 'Équipement introuvable.' };
    if (!['Special', ...ONESHOT_TYPES].includes(equip.type)) {
      return { state, ok: false, reason: `${equip.name} n'est pas un actif.` };
    }
    const isOneShot = ONESHOT_TYPES.includes(equip.type);
    if (isOneShot && ch0.usedActives[action.equipIndex]) {
      return { state, ok: false, reason: `${equip.name} déjà utilisé ce combat.` };
    }
    const cost = actionCost(equip, 'active');
    if (side0.energy < cost) return { state, ok: false, reason: `Énergie insuffisante (${side0.energy}/${cost}).` };

    let s = clone(state);
    const P = (equip.power || 0) + tb;
    if (equip.type === 'Special') {
      applyDamage(s, defKey, P, false);
      s[sideKey].shieldTemp = (s[sideKey].shieldTemp || 0) + (equip.shield || 0);
      s.log.push(`  ✨ ${ch0.name} · ${equip.name} : ${s[defKey]._lastDmg} dmg + ${equip.shield || 0} garde`);
    } else if (equip.type === 'Event') {
      applyDamage(s, defKey, P, true); // ignore bouclier
      s.log.push(`  ⚡ ${ch0.name} · ${equip.name} : ${P} dmg directs (ignore bouclier)`);
    } else { // Team
      applyDamage(s, defKey, P, false);
      s.log.push(`  👥 ${ch0.name} · ${equip.name} : ${s[defKey]._lastDmg} dmg (frappe lourde)`);
    }
    if (isOneShot) s[sideKey].champions[championIndex].usedActives[action.equipIndex] = true;
    s[sideKey].energy -= cost;
    s[sideKey].champions[championIndex].actedThisTurn = true;
    return { state: finishAction(s), ok: true };
  }

  // ── Attaque de base (défaut) ─────────────────────────────────────────────
  const cost = actionCost(ch0, 'basic');
  if (side0.energy < cost) return { state, ok: false, reason: `Énergie insuffisante (${side0.energy}/${cost}).` };

  let s = clone(state);
  const raw = championAttackPower(s[sideKey], championIndex);
  applyDamage(s, defKey, raw, false);
  s[sideKey].energy -= cost;
  s[sideKey].champions[championIndex].actedThisTurn = true;
  s.log.push(`  ⚔️ ${ch0.name} attaque : ${raw} dmg — reçu ${s[defKey]._lastDmg}, bloqué ${s[defKey]._blocked}`);
  return { state: finishAction(s), ok: true };
}

// ─── Résultat ──────────────────────────────────────────────────────────────────

export function getSquadResult(state) {
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

// ─── IA d'escouade (difficulté : easy / normal / hard) ───────────────────────────

/**
 * Estime les dégâts effectifs au pool adverse pour chaque action légale et
 * abordable d'un champion. Le bouclier réduit chaque coup (sauf Event qui
 * l'ignore) — d'où la valeur de l'Event quand le bouclier est haut.
 */
function actionCandidates(state, sideKey, i) {
  const side = state[sideKey];
  const ch = side.champions[i];
  const S = teamShield(state[other(sideKey)]);
  const out = [];

  const basicCost = actionCost(ch, 'basic');
  if (side.energy >= basicCost) {
    const raw = championAttackPower(side, i);
    out.push({ action: { type: 'basic' }, cost: basicCost, est: Math.max(0, raw - S), kind: 'basic' });
  }

  if (ch.skill) {
    const cd = side.skillCooldowns?.[ch.id] || 0;
    const cost = actionCost(ch, 'skill');
    if (cd === 0 && side.energy >= cost) {
      // estimation grossière : la plupart des skills offensives ~ power du champion
      out.push({ action: { type: 'skill' }, cost, est: ch.power || 0, kind: 'skill' });
    }
  }

  ch.equipment.forEach((e, idx) => {
    const tb = side.terrain ? TERRAIN_DMG : 0;
    const eCost = actionCost(e, 'active');
    if (e.type === 'Special' && side.energy >= eCost) {
      out.push({ action: { type: 'active', equipIndex: idx }, cost: eCost, est: Math.max(0, (e.power || 0) + tb - S), kind: 'special' });
    } else if (ONESHOT_TYPES.includes(e.type) && !ch.usedActives[idx] && side.energy >= eCost) {
      const est = e.type === 'Event' ? (e.power || 0) + tb : Math.max(0, (e.power || 0) + tb - S);
      out.push({ action: { type: 'active', equipIndex: idx }, cost: eCost, est, kind: 'oneshot' });
    }
  });

  return out;
}

function pickAction(cands, difficulty, enemyHp) {
  if (!cands.length) return null;
  if (difficulty === 'easy') {
    return cands.find((c) => c.kind === 'basic') || null;   // attaques de base seulement
  }
  if (difficulty === 'normal') {
    return cands.find((c) => c.kind === 'skill') || cands.find((c) => c.kind === 'basic') || null;
  }
  // hard : maximise les dégâts, sécurise le létal, garde les one-shot pour quand ça vaut le coup
  const lethal = cands.filter((c) => c.est >= enemyHp).sort((a, b) => a.cost - b.cost)[0];
  if (lethal) return lethal;
  const bestRep = cands.filter((c) => c.kind !== 'oneshot').sort((a, b) => b.est - a.est)[0];
  const bestOne = cands.filter((c) => c.kind === 'oneshot').sort((a, b) => b.est - a.est)[0];
  if (bestOne && (!bestRep || bestOne.est > bestRep.est)) return bestOne;
  return bestRep || bestOne || null;
}

// Phase d'équipement de l'IA (mode deck) : équipe quelques cartes en gardant de
// l'énergie pour attaquer. easy = ramp lent, hard = plus agressif. 🎚️
function aiEquip(state, sideKey, difficulty, onStep) {
  let s = state;
  const maxEquips = difficulty === 'hard' ? 2 : difficulty === 'easy' ? 1 : 1;
  const reserve = 1;   // énergie gardée pour au moins une attaque
  // Valeur d'une carte à équiper : passifs (power+shield) priorisés, actifs ~ power.
  const value = (c) => (PASSIVE_TYPES.includes(c.type) ? (c.power || 0) + (c.shield || 0) : (c.power || 0));
  for (let done = 0; done < maxEquips; done++) {
    const side = s[sideKey];
    if (!side.useDeck || !side.equipHand.length) break;
    const champIdx = side.champions.findIndex((ch) => ch.equipment.length < (ch.slots || DEFAULT_SLOTS));
    if (champIdx < 0) break;
    const cand = side.equipHand
      .map((c, i) => ({ c, i, cost: actionCost(c) }))
      .filter((x) => x.cost <= side.energy - reserve)
      .sort((a, b) => value(b.c) - value(a.c))[0];
    if (!cand) break;
    const r = equipCard(s, sideKey, champIdx, cand.i);
    if (!r.ok) break;
    s = r.state;
    if (onStep) onStep(s, { kind: 'equip', actor: champIdx });
  }
  return s;
}

/**
 * Joue automatiquement le tour d'un camp (IA). `onStep(state, meta)` est appelé
 * après CHAQUE action atomique (équipement puis actions de champions), ce qui
 * permet à l'UI d'animer le tour étape par étape (cf planAutoTurn / squadBattle).
 * meta = { kind:'equip'|'basic'|'skill'|'special'|'oneshot', actor:championIndex, action? }.
 */
export function autoPlaySquadTurn(state, sideKey, difficulty = 'normal', onStep = null) {
  let s = clone(state);
  if (s.phase === `${sideKey}_stunned`) return s;

  s = aiEquip(s, sideKey, difficulty, onStep);   // l'IA s'équipe (mode deck) avant d'attaquer

  let guard = 0;
  let progressed = true;
  while (progressed && s.phase !== 'end' && ++guard < 40) {
    progressed = false;
    // (Re)trie les champions actifs par puissance d'attaque décroissante à chaque passe
    const order = s[sideKey].champions
      .map((_, i) => i)
      .filter((i) => canChampionAct(s, sideKey, i))
      .sort((a, b) => championAttackPower(s[sideKey], b) - championAttackPower(s[sideKey], a));

    for (const i of order) {
      if (!canChampionAct(s, sideKey, i)) continue;
      const pick = pickAction(actionCandidates(s, sideKey, i), difficulty, s[other(sideKey)].hp);
      if (!pick) continue;
      const res = championAct(s, sideKey, i, pick.action);
      if (res.ok) { s = res.state; progressed = true; if (onStep) onStep(s, { kind: pick.kind, actor: i, action: pick.action }); if (s.phase === 'end') break; }
    }
  }
  return s;
}

/**
 * Découpe le tour d'un camp en « frames » jouables un par un par l'UI (animation).
 * Renvoie { frames, final } où chaque frame = { kind, actor, action?, state } est
 * un instantané de l'état APRÈS l'action correspondante. `final` = état final.
 */
export function planAutoTurn(state, sideKey, difficulty = 'normal') {
  const frames = [];
  const final = autoPlaySquadTurn(state, sideKey, difficulty, (s, meta) => {
    frames.push({ ...meta, state: clone(s) });
  });
  return { frames, final };
}

// ─── Wrapper : fin de tour joueur → IA ennemie → début tour joueur ───────────────

export function endSquadPlayerTurn(state, difficulty = 'normal') {
  let s = startSquadTurn('enemy', state);
  if (s.phase === 'enemy_turn') {
    s = autoPlaySquadTurn(s, 'enemy', difficulty);
  }
  if (getSquadResult(s)) { s.phase = 'end'; return s; }
  return startSquadTurn('player', s);
}
