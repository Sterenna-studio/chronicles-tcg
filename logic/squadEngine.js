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
//   autoPlaySquadTurn(state, sideKey)        // IA basique (lot 5 l'enrichira)
//   endSquadPlayerTurn(state, difficulty)
//   Helpers UI : championAttackPower, teamShield, canChampionAct

import { tickSkillCooldowns, setActiveChampion, useSkill } from './skillEngine.js?v=12';

export const SQUAD_HP        = 30;
export const ENERGY_MAX      = 7;
export const SKILL_EXTRA_COST = 1;   // surcoût du spécial (§4)
export const TERRAIN_DMG     = 1;    // +1 dégât aux attaques si Terrain (§5)
export const TERRAIN_GUARD   = 1;    // +1 garde/tour si Terrain (§5)
export const MAX_EQUIP       = 3;
export const SQUAD_SIZE      = 3;
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

function makeSide(squad) {
  const slots = squad.slots || [];
  const champions = slots.map((slot) => {
    const c = slot.champion || {};
    const equipment = (slot.equipment || []).map((e) => ({ ...e }));
    const passivePower = equipment
      .filter((e) => PASSIVE_TYPES.includes(e.type))
      .reduce((a, e) => a + (e.power || 0), 0);
    return {
      id: c.id, name: c.name, power: c.power || 0, shield: c.shield || 0,
      energy: c.energy || 1, rarity: c.rarity, skill: c.skill || null,
      equipment, passivePower,
      actedThisTurn: false,
      usedActives: {},          // equipId -> true (Event/Team consommés)
    };
  });

  // Bouclier permanent d'équipe = shield des Object/Companion équipés (-> field,
  // pour que teamShield() et skillEngine partagent le même calcul).
  const field = [];
  champions.forEach((ch) => {
    ch.equipment.forEach((e) => {
      if (PASSIVE_TYPES.includes(e.type) && (e.shield || 0) > 0) {
        field.push({ name: e.name, shield: e.shield, kind: e.type.toLowerCase(), championId: ch.id });
      }
    });
  });

  return {
    hp: SQUAD_HP,
    energy: 1,
    champions,
    terrain: squad.terrain || null,
    shieldTemp: 0,
    field,                        // bouclier permanent
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
}

export function createSquadBattle(playerSquad, enemySquad) {
  const s = {
    turn: 1,
    energyMax: ENERGY_MAX,
    player: makeSide(playerSquad),
    enemy: makeSide(enemySquad),
    log: [],
    phase: 'player_turn',
  };
  s.log.push('⚔️  Combat d\'escouade démarré — Tour 1');
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

export function autoPlaySquadTurn(state, sideKey, difficulty = 'normal') {
  let s = clone(state);
  if (s.phase === `${sideKey}_stunned`) return s;

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
      if (res.ok) { s = res.state; progressed = true; if (s.phase === 'end') break; }
    }
  }
  return s;
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
