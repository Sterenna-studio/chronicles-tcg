// tests/battleEngine.test.mjs — tests du moteur (fonctions pures)
// Lancement : node tests/battleEngine.test.mjs
// (charge logic/battleEngine.js via data: URL pour l'évaluer en ESM)

import fs from 'node:fs';
import assert from 'node:assert/strict';

const src = fs.readFileSync(new URL('../logic/battleEngine.js', import.meta.url), 'utf8')
  .replace(/from '\.\/[^']+'/g, ''); // (pas d'imports relatifs de toute façon)
const E = await import('data:text/javascript,' + encodeURIComponent(src));

let pass = 0;
const test = (name, fn) => { fn(); console.log('✅', name); pass++; };

const card = (o) => ({ id: o.id || o.name, name: o.name || 'C', type: o.type, rarity: o.rarity || 'common', power: o.power || 0, shield: o.shield || 0, energy: o.energy || 1 });
const champ = (p, s = 0, e = 1) => card({ name: 'Champ', type: 'Champion', power: p, shield: s, energy: e });
const filler = (n) => Array.from({ length: n }, (_, i) => card({ id: 'f' + i, name: 'F' + i, type: 'Object', shield: 0, energy: 1 }));
// Complète à 6 cartes pour éviter la fatigue à la création (pioche de 3).
const deck = (cs) => [...cs, ...filler(Math.max(0, 6 - cs.length))];

test('createBattle: 30 PV, main de 3', () => {
  const s = E.createBattle(filler(6), filler(6));
  assert.equal(s.player.hp, 30);
  assert.equal(s.enemy.hp, 30);
  assert.equal(s.player.hand.length, 3);
  assert.equal(s.energyMax, 7);
});

test('Champion inflige des dégâts (réduits par bouclier)', () => {
  let s = E.createBattle(deck([champ(5)]), filler(6));
  s.player.energy = 5;
  const r = E.playCard(s, 'player', s.player.hand.findIndex(c => c.type === 'Champion'));
  assert.ok(r.ok);
  assert.equal(r.state.enemy.hp, 25); // pas de bouclier ennemi
});

test('La garde persiste pendant le tour adverse', () => {
  // joueur joue un Champion shield 4 -> guard 4 ; l'ennemi frappe 5 -> 1 passe
  let s = E.createBattle(deck([champ(1, 4, 1)]), deck([champ(5, 0, 1)]));
  s.player.energy = 1; s.enemy.energy = 1;
  s = E.playCard(s, 'player', s.player.hand.findIndex(c => c.type === 'Champion')).state;
  assert.equal(s.player.shieldTemp, 4);
  // tour ennemi : on NE réinitialise PAS la garde du joueur
  s = E.startTurn('enemy', s); // reset garde ENNEMI seulement
  assert.equal(s.player.shieldTemp, 4, 'garde joueur intacte au tour ennemi');
  const ei = s.enemy.hand.findIndex(c => c.type === 'Champion');
  s = E.playCard(s, 'enemy', ei).state;
  assert.equal(s.player.hp, 29, '5 dmg - 4 garde = 1'); // 30 - 1
});

test('startTurn joueur : turn+1, énergie, reset garde', () => {
  let s = E.createBattle(filler(6), filler(6));
  s.player.shieldTemp = 9;
  s = E.startTurn('player', s);
  assert.equal(s.turn, 2);
  assert.equal(s.player.energy, 2);
  assert.equal(s.player.shieldTemp, 0);
});

test('Companion : buff consommé par le Champion + bouclier permanent', () => {
  const comp = card({ name: 'Comp', type: 'Companion', power: 3, shield: 2, energy: 1 });
  let s = E.createBattle(deck([comp, champ(5)]), filler(6));
  s.player.energy = 5;
  s = E.playCard(s, 'player', s.player.hand.findIndex(c => c.type === 'Companion')).state;
  assert.equal(s.player.field.length, 1);
  assert.equal(s.player.buffs[0].powerBoost, 3);
  s = E.playCard(s, 'player', s.player.hand.findIndex(c => c.type === 'Champion')).state;
  assert.equal(s.enemy.hp, 22, '5 + 3 buff = 8 dmg'); // 30 - 8
  assert.equal(s.player.buffs.length, 0, 'buffs vidés');
});

test('Event ignore le bouclier', () => {
  const ev = card({ name: 'Ev', type: 'Event', power: 4, energy: 1 });
  let s = E.createBattle(deck([ev]), filler(6));
  s.player.energy = 1;
  s.enemy.field = [{ name: 'O', shield: 99, kind: 'object' }]; // gros bouclier
  s = E.playCard(s, 'player', 0).state;
  assert.equal(s.enemy.hp, 26, '4 dmg directs malgré bouclier');
});

test('Champ plein → needsDiscard puis remplacement', () => {
  const obj = card({ name: 'NewObj', type: 'Object', shield: 1, energy: 1 });
  let s = E.createBattle(deck([obj]), filler(6));
  s.player.energy = 1;
  s.player.field = Array.from({ length: 5 }, (_, i) => ({ name: 'O' + i, shield: i, kind: 'object' }));
  const r1 = E.playCard(s, 'player', 0);
  assert.equal(r1.ok, false);
  assert.equal(r1.needsDiscard, true);
  const r2 = E.playCard(s, 'player', 0, { replaceFieldIndex: 0 });
  assert.ok(r2.ok);
  assert.equal(r2.state.player.field.length, 5, 'toujours 5 (1 retirée, 1 ajoutée)');
  assert.ok(r2.state.player.field.some(c => c.name === 'NewObj'));
});

test('Fatigue quand le deck est vide', () => {
  let s = E.createBattle([], filler(6)); // deck joueur vide (main aussi vide)
  const before = s.player.hp;
  s = E.drawCards('player', s, 1);
  assert.equal(s.player.hp, before - 2);
});

test('Double KO = match nul', () => {
  let s = E.createBattle(filler(6), filler(6));
  s.player.hp = 0; s.enemy.hp = 0; s.phase = 'end';
  assert.equal(E.getBattleResult(s).winner, 'draw');
});

console.log(`\n${pass} tests OK`);
