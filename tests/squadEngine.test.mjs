// tests/squadEngine.test.mjs — tests du moteur Escouade (fonctions pures)
// Lancement : node tests/squadEngine.test.mjs
//
// squadEngine importe skillEngine. On évalue chacun via une data: URL ESM en
// réécrivant l'import relatif vers la data: URL de skillEngine (modules séparés,
// pas de concaténation fragile).

import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
// encodeURIComponent ne touche pas aux apostrophes : on les encode pour ne pas
// casser le littéral d'import `from '<url>'` quand l'URL est injectée dans la source.
const toDataUrl = (src) => 'data:text/javascript,' + encodeURIComponent(src).replace(/'/g, '%27');
const skillUrl = toDataUrl(read('../logic/skillEngine.js'));
const squadSrc = read('../logic/squadEngine.js')
  .replace(/from '\.\/skillEngine\.js[^']*'/g, `from '${skillUrl}'`);
const E = await import(toDataUrl(squadSrc));

let pass = 0;
const test = (name, fn) => { fn(); console.log('✅', name); pass++; };

// ── Builders de cartes ────────────────────────────────────────────────────────
const champ = (o) => ({ id: o.id, name: o.name || o.id, type: 'Champion', rarity: o.rarity || 'Rare', power: o.power ?? 5, shield: o.shield ?? 2, energy: o.energy ?? 1, skill: o.skill || null });
const card = (type) => (o) => ({ id: o.id, name: o.name || o.id, type, rarity: o.rarity || 'Common', power: o.power ?? 0, shield: o.shield ?? 0, energy: o.energy ?? 1 });
const object = card('Object'), companion = card('Companion'), event = card('Event'), team = card('Team'), special = card('Special'), terrain = card('Terrain');

const slot = (champion, equipment = []) => ({ champion, equipment });
const squad = (slots, terr = null) => ({ slots, terrain: terr });

// Escouade de base : 3 champions power 5, energy 1, sans équipement
const baseSquad = () => squad([
  slot(champ({ id: 'C1', power: 5 })),
  slot(champ({ id: 'C2', power: 5 })),
  slot(champ({ id: 'C3', power: 5 })),
]);

// ── Tests ─────────────────────────────────────────────────────────────────────

test('createSquadBattle : 3 champions, pool 30, énergie 1', () => {
  const s = E.createSquadBattle(baseSquad(), baseSquad());
  assert.equal(s.player.champions.length, 3);
  assert.equal(s.enemy.champions.length, 3);
  assert.equal(s.player.hp, 30);
  assert.equal(s.enemy.hp, 30);
  assert.equal(s.player.energy, 1);
  assert.equal(s.turn, 1);
});

test('bouclier permanent = somme des shield des passifs équipés', () => {
  const sq = squad([
    slot(champ({ id: 'C1' }), [object({ id: 'O1', shield: 4 }), companion({ id: 'P1', shield: 3 })]),
    slot(champ({ id: 'C2' })),
    slot(champ({ id: 'C3' })),
  ]);
  const s = E.createSquadBattle(sq, baseSquad());
  assert.equal(E.teamShield(s.player), 7); // 4 + 3 (shieldTemp 0)
});

test('attaque de base = power + passifs power + Terrain, réduite par bouclier', () => {
  const atk = squad([
    slot(champ({ id: 'C1', power: 5, energy: 1 }), [object({ id: 'O1', power: 3, shield: 0 })]),
    slot(champ({ id: 'C2' })), slot(champ({ id: 'C3' })),
  ], terrain({ id: 'T1' }));
  const def = squad([
    slot(champ({ id: 'D1' }), [object({ id: 'OD', shield: 2 })]),
    slot(champ({ id: 'D2' })), slot(champ({ id: 'D3' })),
  ]);
  let s = E.createSquadBattle(atk, def);
  s.player.energy = 5;
  // power 5 + passif 3 + terrain 1 = 9 ; bouclier def = 2 ; reçu = 7
  assert.equal(E.championAttackPower(s.player, 0), 9);
  const r = E.championAct(s, 'player', 0, { type: 'basic' });
  assert.equal(r.ok, true);
  assert.equal(r.state.enemy.hp, 30 - 7);
  assert.equal(r.state.player.energy, 4); // coût 1
});

test('1 action / champion / tour : 2e action refusée', () => {
  let s = E.createSquadBattle(baseSquad(), baseSquad());
  s.player.energy = 5;
  const r1 = E.championAct(s, 'player', 0, { type: 'basic' });
  assert.equal(r1.ok, true);
  const r2 = E.championAct(r1.state, 'player', 0, { type: 'basic' });
  assert.equal(r2.ok, false);
  assert.match(r2.reason, /déjà agi/);
});

test('énergie insuffisante : action refusée', () => {
  let s = E.createSquadBattle(squad([
    slot(champ({ id: 'C1', energy: 6 })), slot(champ({ id: 'C2' })), slot(champ({ id: 'C3' })),
  ]), baseSquad());
  s.player.energy = 1; // coût de base ceil(6/3)=2 > 1
  const r = E.championAct(s, 'player', 0, { type: 'basic' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /insuffisante/i);
});

test('skill : coûte ceil(énergie/3)+1, pose le cooldown', () => {
  const atk = squad([
    slot(champ({ id: 'C1', power: 6, energy: 2, skill: { name: 'Frappe', effect: 'true_damage', cooldown: 2, desc: '' } })),
    slot(champ({ id: 'C2' })), slot(champ({ id: 'C3' })),
  ]);
  let s = E.createSquadBattle(atk, baseSquad());
  s.player.energy = 5;
  const r = E.championAct(s, 'player', 0, { type: 'skill' });
  assert.equal(r.ok, true);
  assert.equal(r.state.enemy.hp, 30 - 6);          // true_damage = power, ignore bouclier
  assert.equal(r.state.player.energy, 5 - 2);      // coût ceil(2/3)+1 = 2
  assert.equal(r.state.player.skillCooldowns['C1'], 2);
});

test('skill en recharge : refusée', () => {
  const atk = squad([
    slot(champ({ id: 'C1', skill: { name: 'X', effect: 'true_damage', cooldown: 2, desc: '' } })),
    slot(champ({ id: 'C2' })), slot(champ({ id: 'C3' })),
  ]);
  let s = E.createSquadBattle(atk, baseSquad());
  s.player.energy = 9;
  s.player.skillCooldowns['C1'] = 1;
  const r = E.championAct(s, 'player', 0, { type: 'skill' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /recharge/);
});

test('actif Event : ignore le bouclier, 1×/combat', () => {
  const atk = squad([
    slot(champ({ id: 'C1', energy: 1 }), [event({ id: 'EV', power: 5, energy: 1 })]),
    slot(champ({ id: 'C2' })), slot(champ({ id: 'C3' })),
  ]);
  const def = squad([
    slot(champ({ id: 'D1' }), [object({ id: 'OD', shield: 4 })]),
    slot(champ({ id: 'D2' })), slot(champ({ id: 'D3' })),
  ]);
  let s = E.createSquadBattle(atk, def);
  s.player.energy = 5;
  const r = E.championAct(s, 'player', 0, { type: 'active', equipIndex: 0 });
  assert.equal(r.ok, true);
  assert.equal(r.state.enemy.hp, 30 - 5);          // 5 dmg malgré bouclier 4
  // 2e utilisation refusée (même si on réinitialise actedThisTurn)
  let s2 = r.state;
  s2.player.champions[0].actedThisTurn = false;
  s2.player.energy = 5;
  const r2 = E.championAct(s2, 'player', 0, { type: 'active', equipIndex: 0 });
  assert.equal(r2.ok, false);
  assert.match(r2.reason, /déjà utilisé/);
});

test('actif Special : dégâts + garde (récurrent)', () => {
  const atk = squad([
    slot(champ({ id: 'C1', energy: 1 }), [special({ id: 'SP', power: 4, shield: 3, energy: 1 })]),
    slot(champ({ id: 'C2' })), slot(champ({ id: 'C3' })),
  ]);
  let s = E.createSquadBattle(atk, baseSquad());
  s.player.energy = 5;
  const r = E.championAct(s, 'player', 0, { type: 'active', equipIndex: 0 });
  assert.equal(r.ok, true);
  assert.equal(r.state.enemy.hp, 30 - 4);
  assert.equal(r.state.player.shieldTemp, 3);      // +S garde
});

test('actif Team : dégâts réduits par le bouclier', () => {
  const atk = squad([
    slot(champ({ id: 'C1', energy: 1 }), [team({ id: 'TM', power: 8, energy: 1 })]),
    slot(champ({ id: 'C2' })), slot(champ({ id: 'C3' })),
  ]);
  const def = squad([
    slot(champ({ id: 'D1' }), [object({ id: 'OD', shield: 3 })]),
    slot(champ({ id: 'D2' })), slot(champ({ id: 'D3' })),
  ]);
  let s = E.createSquadBattle(atk, def);
  s.player.energy = 5;
  const r = E.championAct(s, 'player', 0, { type: 'active', equipIndex: 0 });
  assert.equal(r.ok, true);
  assert.equal(r.state.enemy.hp, 30 - 5);          // 8 - 3 bouclier
});

test('startSquadTurn : énergie = min(turn,7), garde Terrain, actions réinitialisées', () => {
  let s = E.createSquadBattle(baseSquad(), squad([
    slot(champ({ id: 'D1' })), slot(champ({ id: 'D2' })), slot(champ({ id: 'D3' })),
  ], terrain({ id: 'T1' })));
  s.player.champions[0].actedThisTurn = true;
  // tour ennemi : énergie min(1,7)=1 au tour 1, garde terrain +1
  s = E.startSquadTurn('enemy', s);
  assert.equal(s.enemy.energy, 1);
  assert.equal(s.enemy.shieldTemp, 1);             // Terrain → +1 garde
  // tour joueur suivant : turn passe à 2, énergie 2, actedThisTurn reset
  s = E.startSquadTurn('player', s);
  assert.equal(s.turn, 2);
  assert.equal(s.player.energy, 2);
  assert.equal(s.player.champions[0].actedThisTurn, false);
});

test('étourdissement : startTurn saute le tour, championAct refusé', () => {
  let s = E.createSquadBattle(baseSquad(), baseSquad());
  s.player.stunnedTurns = 1;
  s = E.startSquadTurn('player', s);
  assert.equal(s.phase, 'player_stunned');
  s.player.energy = 5;
  const r = E.championAct(s, 'player', 0, { type: 'basic' });
  assert.equal(r.ok, false);
  assert.match(r.reason, /étourdie/);
});

test('victoire : pool ennemi à 0 → phase end + winner player', () => {
  let s = E.createSquadBattle(squad([
    slot(champ({ id: 'C1', power: 30, energy: 1 })), slot(champ({ id: 'C2' })), slot(champ({ id: 'C3' })),
  ]), baseSquad());
  s.player.energy = 5;
  const r = E.championAct(s, 'player', 0, { type: 'basic' });
  assert.equal(r.state.enemy.hp, 0);
  assert.equal(r.state.phase, 'end');
  const res = E.getSquadResult(r.state);
  assert.equal(res.winner, 'player');
});

test('autoPlaySquadTurn : l\'IA agit et inflige des dégâts', () => {
  let s = E.createSquadBattle(baseSquad(), baseSquad());
  s.enemy.energy = 7;
  const after = E.autoPlaySquadTurn(s, 'enemy');
  assert.ok(after.player.hp < 30, 'le joueur doit avoir subi des dégâts');
  assert.ok(after.enemy.champions.some(c => c.actedThisTurn), 'au moins un champion ennemi a agi');
});

test('IA easy : attaques de base uniquement (pas de skill)', () => {
  const ai = squad([
    slot(champ({ id: 'E1', power: 5, energy: 1, skill: { name: 'x', effect: 'true_damage', cooldown: 2, desc: '' } })),
    slot(champ({ id: 'E2', energy: 1 })), slot(champ({ id: 'E3', energy: 1 })),
  ]);
  let s = E.createSquadBattle(baseSquad(), ai);
  s.enemy.energy = 7;
  const after = E.autoPlaySquadTurn(s, 'enemy', 'easy');
  assert.equal(after.enemy.skillCooldowns['E1'] ?? 0, 0, 'la skill ne doit pas être utilisée en easy');
  assert.ok(after.player.hp < 30, 'des attaques de base ont touché');
});

test('IA hard : utilise l\'Event pour percer un gros bouclier', () => {
  const ai = squad([
    slot(champ({ id: 'A1', power: 3, energy: 1 }), [event({ id: 'EV', power: 6, energy: 1 })]),
    slot(champ({ id: 'A2', power: 1, energy: 1 })), slot(champ({ id: 'A3', power: 1, energy: 1 })),
  ]);
  const def = squad([
    slot(champ({ id: 'D1' }), [object({ id: 'OD', shield: 6 })]),
    slot(champ({ id: 'D2' })), slot(champ({ id: 'D3' })),
  ]);
  let s = E.createSquadBattle(def, ai);
  s.enemy.energy = 7;
  const after = E.autoPlaySquadTurn(s, 'enemy', 'hard');
  assert.equal(after.enemy.champions[0].usedActives[0], true, 'l\'Event doit être déclenché');
  assert.ok(after.player.hp <= 30 - 6, 'l\'Event ignore le bouclier 6 et inflige 6');
});

test('IA hard : achève quand c\'est létal', () => {
  let s = E.createSquadBattle(baseSquad(), baseSquad());
  s.player.hp = 4;          // un coup de base (5) suffit
  s.enemy.energy = 7;
  const after = E.autoPlaySquadTurn(s, 'enemy', 'hard');
  assert.equal(after.player.hp, 0);
  assert.equal(after.phase, 'end');
});

// ── Équipement « en main » (mode deck) ──────────────────────────────────────────
const deckSquad = (deck) => ({
  slots: [slot(champ({ id: 'C1', power: 5, energy: 1 })), slot(champ({ id: 'C2' })), slot(champ({ id: 'C3' }))],
  terrain: null,
  equipmentDeck: deck,
});

test('mode deck : champions nus + main d\'ouverture de 3', () => {
  const deck = Array.from({ length: 8 }, (_, i) => object({ id: 'O' + i, power: 2, shield: 3, energy: 3 }));
  const s = E.createSquadBattle(deckSquad(deck), baseSquad());
  assert.equal(s.player.useDeck, true);
  assert.equal(s.player.champions[0].equipment.length, 0, 'champions nus au départ');
  assert.equal(s.player.equipHand.length, 3, 'main d\'ouverture de 3');
  assert.equal(s.player.equipDeck.length, 5, 'reste 5 au deck');
  assert.equal(E.teamShield(s.player), 0, 'aucun bouclier sans équipement');
});

test('equipCard : coûte l\'énergie de la carte + recalcule attaque/bouclier', () => {
  const deck = [object({ id: 'O1', power: 3, shield: 4, energy: 3 })]; // coût ceil(3/3)=1
  let s = E.createSquadBattle(deckSquad(deck), baseSquad());
  s.player.energy = 5;
  const r = E.equipCard(s, 'player', 0, 0);
  assert.equal(r.ok, true);
  assert.equal(r.state.player.energy, 5 - 1, 'coût 1 énergie');
  assert.equal(r.state.player.champions[0].equipment.length, 1);
  assert.equal(r.state.player.champions[0].passivePower, 3, '+3 attaque passive');
  assert.equal(E.teamShield(r.state.player), 4, '+4 bouclier d\'équipe');
  assert.equal(r.state.player.equipHand.length, 0, 'carte retirée de la main');
});

test('equipCard : énergie insuffisante refusée', () => {
  const deck = [object({ id: 'O1', power: 3, shield: 4, energy: 9 })]; // coût ceil(9/3)=3
  let s = E.createSquadBattle(deckSquad(deck), baseSquad());
  s.player.energy = 2;
  const r = E.equipCard(s, 'player', 0, 0);
  assert.equal(r.ok, false);
  assert.match(r.reason, /insuffisante/i);
});

test('equipCard : emplacements pleins → remplacement (ancien à la défausse)', () => {
  const deck = Array.from({ length: 4 }, (_, i) => object({ id: 'O' + i, power: 1, shield: 1, energy: 1 }));
  let s = E.createSquadBattle(deckSquad(deck), baseSquad());
  s.player.energy = 9;
  // équipe 3 cartes (slots par défaut = 3) — la main a 3, le deck a 1
  s = E.equipCard(s, 'player', 0, 0).state;
  s = E.equipCard(s, 'player', 0, 0).state;
  s = E.equipCard(s, 'player', 0, 0).state;
  assert.equal(s.player.champions[0].equipment.length, 3, '3 emplacements remplis');
  s = E.drawEquipment(s, 'player', 1);              // pioche la 4e
  const refus = E.equipCard(s, 'player', 0, s.player.equipHand.length - 1);
  assert.equal(refus.ok, false);
  assert.equal(refus.needsReplace, true);
  const r = E.equipCard(s, 'player', 0, s.player.equipHand.length - 1, 0); // remplace l'emplacement 0
  assert.equal(r.ok, true);
  assert.equal(r.state.player.champions[0].equipment.length, 3, 'toujours 3');
  assert.equal(r.state.player.equipDiscard.length, 1, 'ancienne carte défaussée');
});

test('slots dynamiques : champion.slots par défaut = 3', () => {
  const s = E.createSquadBattle(deckSquad([]), baseSquad());
  assert.equal(s.player.champions[0].slots, 3);
});

console.log(`\n${pass} tests OK`);
