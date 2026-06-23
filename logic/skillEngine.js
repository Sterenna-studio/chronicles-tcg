// logic/skillEngine.js — Moteur de skills Champion (Phase 2)
// Chaque skill est identifiée par son `effect` (string) stocké dans card.skill.effect.
// API publique :
//   canUseSkill(state, sideKey)          -> { ok, reason? }
//   useSkill(state, sideKey)             -> { state, ok, reason?, log }
//   getSkillCooldownLeft(state, sideKey) -> number (tours restants)

const other = (k) => (k === 'player' ? 'enemy' : 'player');
const clone = (s) => JSON.parse(JSON.stringify(s));

// ─── Garde ────────────────────────────────────────────────────────────────────

/**
 * Vérifie si le Champion actif du côté `sideKey` peut utiliser sa skill.
 * Le Champion actif est le premier Champion posé sur le champ (field[0] de type champion).
 * Un Champion doit avoir été joué ce tour ou être en champ.
 */
export function canUseSkill(state, sideKey) {
  const side = state[sideKey];
  if (!side.activeChampion) return { ok: false, reason: 'Aucun Champion actif.' };
  const cd = side.skillCooldowns?.[side.activeChampion.id] ?? 0;
  if (cd > 0) return { ok: false, reason: `Skill en recharge (${cd} tour${cd > 1 ? 's' : ''} restant${cd > 1 ? 's' : ''}).` };
  return { ok: true };
}

export function getSkillCooldownLeft(state, sideKey) {
  const side = state[sideKey];
  if (!side.activeChampion) return 0;
  return side.skillCooldowns?.[side.activeChampion.id] ?? 0;
}

// ─── Déclenchement ────────────────────────────────────────────────────────────

export function useSkill(state, sideKey) {
  const guard = canUseSkill(state, sideKey);
  if (!guard.ok) return { state, ok: false, reason: guard.reason, log: [] };

  let s = clone(state);
  const defKey = other(sideKey);
  const champion = s[sideKey].activeChampion;
  const skill = champion.skill;
  const logs = [];

  s = applySkillEffect(s, skill, sideKey, defKey, champion, logs);

  // Appliquer le cooldown
  if (!s[sideKey].skillCooldowns) s[sideKey].skillCooldowns = {};
  s[sideKey].skillCooldowns[champion.id] = skill.cooldown;

  const logLine = `✨ [SKILL] ${champion.name} → "${skill.name}" : ${logs.join(' | ')}`;
  s.log.push(logLine);

  return { state: s, ok: true, log: logs };
}

// ─── Tick cooldowns (à appeler dans startTurn) ─────────────────────────────────

export function tickSkillCooldowns(state, sideKey) {
  const s = clone(state);
  const cds = s[sideKey].skillCooldowns;
  if (!cds) return s;
  for (const id in cds) {
    if (cds[id] > 0) cds[id]--;
  }
  return s;
}

// ─── Définir le Champion actif (appelé dans applyCardEffect Champion) ──────────

export function setActiveChampion(state, sideKey, card) {
  const s = clone(state);
  s[sideKey].activeChampion = {
    id: card.id,
    name: card.name,
    skill: card.skill,
    power: card.power,
    shield: card.shield,
  };
  return s;
}

// ─── Import drawCards (même logique que battleEngine, dupliquée pour isolation) ─

const FATIGUE = 2;
function drawOne(s, sideKey) {
  const side = s[sideKey];
  if (side.deck.length) {
    side.hand.push(side.deck.shift());
  } else {
    side.hp = Math.max(0, side.hp - FATIGUE);
    s.log.push(`  💀 Fatigue −${FATIGUE} PV (skill draw)`);
  }
  return s;
}

// ─── Effets des skills ────────────────────────────────────────────────────────

function applyShield(s, sideKey, amount) {
  s[sideKey].shieldTemp = (s[sideKey].shieldTemp || 0) + amount;
}

function totalShield(side) {
  const fieldS = (side.field || []).reduce((a, c) => a + (c.shield || 0), 0);
  return (side.shieldTemp || 0) + fieldS;
}

function applyDmg(s, defKey, raw, ignoreShield = false) {
  const def = s[defKey];
  const blocked = ignoreShield ? 0 : Math.min(raw, totalShield(def));
  const dealt = raw - blocked;
  s[defKey].hp = Math.max(0, def.hp - dealt);
  return { dealt, blocked };
}

function applySkillEffect(s, skill, atkKey, defKey, champion, logs) {
  const P = champion.power || 0;
  const S = champion.shield || 0;

  switch (skill.effect) {

    // ── DÉGÂTS / ATTAQUE ────────────────────────────────────────────────────

    case 'half_damage_riposte': {
      // Réduit de moitié les dégâts reçus CE tour + riposte power/2
      s[atkKey]._halfDmgThisTurn = true;
      const dmg = Math.ceil(P / 2);
      const { dealt } = applyDmg(s, defKey, dmg);
      logs.push(`Riposte ${dealt} dmg + demi-dégâts ce tour`);
      break;
    }

    case 'ignore_shield': {
      const { dealt } = applyDmg(s, defKey, P, true);
      logs.push(`${dealt} vrais dmg (bouclier ignoré)`);
      break;
    }

    case 'aoe_damage': {
      // Inflige power dmg à TOUS les champions adverses en champ
      const { dealt } = applyDmg(s, defKey, P);
      logs.push(`${dealt} dmg AoE adversaire`);
      // Note : en mode JRPG multi-champion futur, itérer sur defKey.field champions
      break;
    }

    case 'double_base_attack': {
      const dmg = P * 2;
      const { dealt } = applyDmg(s, defKey, dmg);
      logs.push(`${dealt} dmg (attaque doublée)`);
      break;
    }

    case 'true_damage': {
      const { dealt } = applyDmg(s, defKey, P, true);
      logs.push(`${dealt} vrais dmg`);
      break;
    }

    case 'true_dmg_stun': {
      const { dealt } = applyDmg(s, defKey, P, true);
      s[defKey].stunnedTurns = (s[defKey].stunnedTurns || 0) + 1;
      logs.push(`${dealt} vrais dmg + ${s[defKey].name ?? 'ennemi'} étourdi 1 tour`);
      break;
    }

    case 'trio_bonus_damage': {
      // Si 3+ Champions en jeu (atkKey), power × 1.5
      const champCount = (s[atkKey].field || []).filter(c => c.kind === 'champion').length + 1;
      const dmg = champCount >= 3 ? Math.round(P * 1.5) : P;
      const { dealt } = applyDmg(s, defKey, dmg);
      logs.push(`${dealt} dmg${champCount >= 3 ? ' (trio bonus ×1.5)' : ' (pas de trio)'}`);
      break;
    }

    case 'predict_shot': {
      const { dealt } = applyDmg(s, defKey, P);
      s[atkKey]._halfDmgThisTurn = true;
      logs.push(`${dealt} dmg + dégâts reçus réduits de 50% ce tour`);
      break;
    }

    case 'target_highest_hp': {
      // Cible le HP max adverse — en 1v1 = direct, en multi = logique future
      const { dealt } = applyDmg(s, defKey, P);
      logs.push(`${dealt} dmg sur cible HP max`);
      break;
    }

    case 'charge_shield': {
      const { dealt } = applyDmg(s, defKey, P);
      s[atkKey].field = [
        ...(s[atkKey].field || []),
        { name: `${champion.name} Armor`, shield: S, kind: 'object', _fromSkill: true },
      ];
      logs.push(`${dealt} dmg + +${S} bouclier permanent`);
      break;
    }

    case 'damage_draw_1': {
      const { dealt } = applyDmg(s, defKey, P);
      s = drawOne(s, atkKey);
      logs.push(`${dealt} dmg + pioche 1 carte`);
      break;
    }

    case 'stack_power_on_ko': {
      const { dealt } = applyDmg(s, defKey, P);
      // Le bonus +2 power est géré côté activeChampion pour la prochaine attaque
      if (s[defKey].hp <= 0) {
        s[atkKey].activeChampion.power = (s[atkKey].activeChampion.power || 0) + 2;
        logs.push(`${dealt} dmg — KO ! +2 power permanent`);
      } else {
        logs.push(`${dealt} dmg (pas de KO, pas de bonus)`);
      }
      break;
    }

    case 'lifedrain': {
      const { dealt } = applyDmg(s, defKey, P, true);
      const heal = Math.ceil(P / 2);
      s[atkKey].hp = Math.min(30, s[atkKey].hp + heal);
      logs.push(`${dealt} vrais dmg + +${heal} PV soignés`);
      break;
    }

    case 'full_dodge_strike': {
      s[atkKey]._fullDodgeThisTurn = true;
      const { dealt } = applyDmg(s, defKey, P, true);
      logs.push(`Esquive totale ce tour + ${dealt} vrais dmg en sortie`);
      break;
    }

    // ── SOINS / BUFF ─────────────────────────────────────────────────────────

    case 'heal_ally_3': {
      s[atkKey].hp = Math.min(30, s[atkKey].hp + 3);
      logs.push(`+3 PV soignés`);
      break;
    }

    case 'heal_team_4_dmg_4': {
      s[atkKey].hp = Math.min(30, s[atkKey].hp + 4);
      const { dealt } = applyDmg(s, defKey, 4);
      logs.push(`+4 PV équipe + ${dealt} dmg adversaire`);
      break;
    }

    case 'full_team_shield_turn': {
      s[atkKey]._absorbAllThisTurn = true;
      logs.push(`Absorption totale des dégâts équipe ce tour`);
      break;
    }

    case 'gain_energy_2': {
      s[atkKey].energy = Math.min(s.energyMax || 7, s[atkKey].energy + 2);
      logs.push(`+2 énergie`);
      break;
    }

    case 'draw_2_energy_1': {
      s = drawOne(s, atkKey);
      s = drawOne(s, atkKey);
      s[atkKey].energy = Math.min(s.energyMax || 7, s[atkKey].energy + 1);
      logs.push(`+2 cartes piochées + +1 énergie`);
      break;
    }

    case 'ally_double_turn': {
      s[atkKey]._doubleTurnNext = true;
      logs.push(`Prochain Champion allié agit deux fois`);
      break;
    }

    // ── CONTRÔLE / DISRUPTION ────────────────────────────────────────────────

    case 'negate_next_skill': {
      s[defKey]._nextSkillNegated = true;
      logs.push(`Prochaine skill adverse annulée`);
      break;
    }

    case 'negate_next_card': {
      s[defKey]._nextCardNegated = true;
      logs.push(`Prochaine carte adverse annulée`);
      break;
    }

    case 'stun_target_1turn': {
      s[defKey].stunnedTurns = (s[defKey].stunnedTurns || 0) + 1;
      const { dealt } = applyDmg(s, defKey, P);
      logs.push(`${dealt} dmg + ennemi étourdi 1 tour`);
      break;
    }

    case 'drain_enemy_energy_2': {
      s[defKey].energy = Math.max(0, (s[defKey].energy || 0) - 2);
      logs.push(`-2 énergie adverse (restant : ${s[defKey].energy})`);
      break;
    }

    case 'dodge_counter': {
      s[atkKey]._dodgeNextAttack = true;
      const { dealt } = applyDmg(s, defKey, P, true);
      logs.push(`Esquive prochaine attaque + ${dealt} vrais dmg riposte`);
      break;
    }

    // ── SPÉCIAUX ─────────────────────────────────────────────────────────────

    case 'copy_enemy_skill': {
      const enemyChamp = s[defKey].activeChampion;
      if (enemyChamp?.skill) {
        const copied = { ...enemyChamp.skill, _copied: true };
        s[atkKey].activeChampion.skill = copied;
        logs.push(`Skill copiée : "${copied.name}" (utilisable ce tour)`);
      } else {
        logs.push(`Aucune skill adverse à copier`);
      }
      break;
    }

    case 'revive_card_from_discard': {
      // Cherche la dernière Object/Companion défaussée
      const discard = s[atkKey].discard || [];
      const idx = [...discard].reverse().findIndex(c => c.type === 'Object' || c.type === 'Companion');
      if (idx !== -1) {
        const realIdx = discard.length - 1 - idx;
        const [revived] = discard.splice(realIdx, 1);
        s[atkKey].hand.push(revived);
        logs.push(`"${revived.name}" ressuscité dans la main`);
      } else {
        logs.push(`Aucune carte Object/Companion en défausse`);
      }
      break;
    }

    case 'summon_random_companion': {
      const companions = s[atkKey].deck.filter(c => c.type === 'Companion');
      if (companions.length) {
        const picked = companions[Math.floor(Math.random() * companions.length)];
        s[atkKey].deck = s[atkKey].deck.filter(c => c !== picked);
        // Invoque immédiatement : ajoute au field + bonus buff
        s[atkKey].field = [
          ...(s[atkKey].field || []),
          { name: picked.name, shield: picked.shield || 0, kind: 'companion', _fromSkill: true },
        ];
        s[atkKey].buffs = [
          ...(s[atkKey].buffs || []),
          { powerBoost: picked.power || 0 },
        ];
        logs.push(`"${picked.name}" invoqué depuis le deck (agit immédiatement)`);
      } else {
        logs.push(`Aucun Companion dans le deck`);
      }
      break;
    }

    case 'hijack_enemy_object': {
      const enemyObjects = (s[defKey].field || []).filter(c => c.kind === 'object');
      if (enemyObjects.length) {
        const hijacked = enemyObjects[0];
        s[defKey].field = s[defKey].field.filter(c => c !== hijacked);
        s[atkKey].field = [
          ...(s[atkKey].field || []),
          { ...hijacked, _hijacked: true, _returnAfterTurn: (s.turn || 1) + 1 },
        ];
        logs.push(`"${hijacked.name}" pris pour 1 tour (+${hijacked.shield} bouclier temporaire)`);
      } else {
        logs.push(`Aucun Object adverse à prendre`);
      }
      break;
    }

    default:
      logs.push(`Effet inconnu : ${skill.effect}`);
  }

  return s;
}
