// logic/battleEngine.js — moteur de combat v2 (modèle « salve »)
// Voir docs/RULES.md. Fonctions quasi-pures : chaque appel renvoie un nouvel état.
//
// API publique :
//   createBattle(playerDeck, enemyDeck)
//   mulligan(sideKey, state)
//   startTurn(sideKey, state)             -> début de tour (énergie, garde, pioche)
//   playCard(state, sideKey, cardIndex, opts?) -> { state, ok, reason?, needsDiscard?, card? }
//   drawCards(sideKey, state, count)
//   getBattleResult(state)
//   endPlayerTurn(state, difficulty)      -> wrapper pratique (non utilisé par l'UI)

export const START_HP     = 30;
export const ENERGY_MAX   = 7;
export const FIELD_MAX     = 5;   // Objects + Companions
export const FATIGUE       = 2;   // PV perdus par pioche sur deck vide
export const TERRAIN_GUARD = 1;   // garde gagnée en début de tour si Terrain actif
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
/** Réduction totale : garde temporaire + boucliers permanents (champ). */
function totalShield(side) {
  return (side.shieldTemp || 0) + fieldShield(side);
}
/** Applique des dégâts réduits par le bouclier (réduction à plat, non consommée). */
function applyDamage(side, raw) {
  const blocked = Math.min(raw, totalShield(side));
  const dealt   = raw - blocked;
  return { ...side, hp: Math.max(0, side.hp - dealt), _lastDmg: dealt, _blocked: blocked };
}
/** Vide la file de buffs Companion et renvoie le bonus total. */
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
    field: [],       // { name, shield, kind:'object'|'companion' }
    terrain: null,   // { name, power }
    buffs: [],       // { powerBoost }
    shieldTemp: 0,   // garde (persiste jusqu'au début du tour suivant du même camp)
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

// ─── Mulligan (avant le tour 1) ────────────────────────────────────────────────

export function mulligan(sideKey, state) {
  const s = clone(state);
  const side = s[sideKey];
  side.deck = shuffle([...side.deck, ...side.hand]);
  side.hand = [];
  for (let i = 0; i < START_HAND && side.deck.length; i++) side.hand.push(side.deck.shift());
  s.log.push(`🔄 ${label(sideKey)} : mulligan`);
  return s;
}

// ─── Pioche (avec fatigue) ──────────────────────────────────────────────────────

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

// ─── Début de tour d'un camp ────────────────────────────────────────────────────

export function startTurn(sideKey, state) {
  let s = clone(state);
  if (sideKey === 'player') s.turn += 1;          // un round = un tour joueur
  const side = s[sideKey];
  side.energy = Math.min(s.turn, s.energyMax);
  side.shieldTemp = side.terrain ? TERRAIN_GUARD : 0; // reset garde + bonus Terrain
  s.phase = sideKey === 'player' ? 'player_turn' : 'enemy_turn';
  s = drawCards(sideKey, s, 1);
  if (s[sideKey].terrain) s.log.push(`  🌍 ${label(sideKey)} : Terrain — +${TERRAIN_GUARD} garde`);
  s.log.push(`\n⚔️  ${sideKey === 'player' ? 'Ton tour' : 'Tour ennemi'} — Tour ${s.turn} · Énergie ${s[sideKey].energy}`);
  return s;
}

// ─── Jouer une carte ────────────────────────────────────────────────────────────

export function playCard(state, sideKey, cardIndex, opts = {}) {
  const atkKey = sideKey;
  const card = state[atkKey].hand[cardIndex];
  if (!card) return { state, ok: false, reason: 'Carte introuvable.' };
  if (state[atkKey].energy < card.energy) {
    return { state, ok: false, reason: `Énergie insuffisante (${state[atkKey].energy}/${card.energy}).` };
  }

  const isField = card.type === 'Object' || card.type === 'Companion';
  const fieldFull = isField && (state[atkKey].field || []).length >= FIELD_MAX;
  if (fieldFull && opts.replaceFieldIndex == null) {
    return { state, ok: false, reason: 'Champ plein', needsDiscard: true };
  }

  let s = clone(state);
  s[atkKey].energy -= card.energy;
  s[atkKey].hand.splice(cardIndex, 1);

  if (fieldFull && opts.replaceFieldIndex != null) {
    const removed = s[atkKey].field.splice(opts.replaceFieldIndex, 1)[0];
    if (removed) s.log.push(`  🗑️ ${label(atkKey)} défausse ${removed.name} du champ`);
  }

  s = applyCardEffect(s, card, atkKey, other(atkKey));
  s.log.push(`🃏 ${label(atkKey)} joue [${card.name}] (${card.type} ${card.rarity}) — énergie ${s[atkKey].energy}`);

  if (s.player.hp <= 0 || s.enemy.hp <= 0) s.phase = 'end';
  return { state: s, ok: true, card };
}

// ─── Effets par type (voir RULES §7) ────────────────────────────────────────────

function applyCardEffect(s, card, atkKey, defKey) {
  const P = card.power || 0;
  const S = card.shield || 0;

  switch (card.type) {
    case 'Champion': {
      const { bonus, side: buffed } = drainBuffs(s[atkKey]);
      s[atkKey] = { ...buffed, shieldTemp: (buffed.shieldTemp || 0) + S };
      const tb  = s[atkKey].terrain ? 1 : 0;
      const dmg = P + bonus + tb;
      s[defKey] = applyDamage(s[defKey], dmg);
      s.log.push(`  ⚔️ ${card.name} : ${dmg} dmg${bonus ? ` (+${bonus} Companion)` : ''}${tb ? ' (+1 Terrain)' : ''} — reçu ${s[defKey]._lastDmg}, bloqué ${s[defKey]._blocked}`);
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

// ─── Résultat ────────────────────────────────────────────────────────────────

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

// ─── Wrapper pratique (non utilisé par l'UI, garde l'API historique) ─────────────

export function endPlayerTurn(state, difficulty = 'normal') {
  // Optionnel : enchaîne tour ennemi (IA basique) + début tour joueur.
  let s = startTurn('enemy', state);
  let guard = 0;
  while (s.phase !== 'end') {
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
