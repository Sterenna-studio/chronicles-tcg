# Mode Escouade — Référence complète

> Document de référence du **Mode Escouade** (combat JRPG à 3 champions).
> Pour les **règles de jeu détaillées** voir [RULES_JRPG.md](RULES_JRPG.md) — ce
> document-ci couvre l'**implémentation** : fichiers, base de données, flux,
> extension, et pièges. À jour au 2026-06-27.

---

## 1. En un coup d'œil

Chaque joueur aligne une **escouade de 3 champions** qui partagent un **pool de
30 PV**. Chaque champion a **3 slots d'équipement** (cartes non-Champion) + un
**slot Terrain d'équipe** unique. À chaque tour, chaque champion fait **une**
action : attaque de base, attaque spéciale (skill à cooldown), ou déclencher un
actif équipé. On gagne en réduisant le pool adverse à 0.

**Boucle joueur :**
`Hub → carte ESCOUADE → Atelier (monter/équiper) → Combattre (difficulté) →
combat tour par tour → victoire → Chronicles (via ledger) + quêtes.`

Le mode **coexiste** avec le mode « salve » 1-champion (`logic/battleEngine.js`),
il ne le remplace pas.

---

## 2. Carte des fichiers

### Logique (testable sans UI)
| Fichier | Rôle |
|---|---|
| [logic/squadEngine.js](../logic/squadEngine.js) | **Moteur** du mode. Fonctions pures (chaque appel renvoie un nouvel état cloné). État de combat, attaque de base, skills, actifs, bouclier, pool PV, IA, résultat. |
| [logic/skillEngine.js](../logic/skillEngine.js) | **Réutilisé** : ~30 effets de skills Champion (`effect` → logique). Le moteur d'escouade pose le champion actif puis appelle `useSkill`. |
| [logic/sets.js](../logic/sets.js) | Source unique de vérité des sets jouables (`PLAYABLE_SET_IDS = ['BZH01']`). |
| [tests/squadEngine.test.mjs](../tests/squadEngine.test.mjs) | **17 tests** du moteur (data: URL ESM, charge skillEngine via une URL séparée). |

### Vues (UI)
| Fichier | Rôle |
|---|---|
| [app/views/squadBuilder.js](../app/views/squadBuilder.js) | **Atelier d'escouade** : grille collection, 3 slots champion + équipement, slot Terrain, sauvegarde (`save_squad`), boutons Tuto / Quêtes / Combattre. |
| [app/views/squadBattle.js](../app/views/squadBattle.js) | **Combat** : charge l'escouade active (`load_squad`), génère un ennemi, déroule le combat, overlay victoire, récompense + quêtes. |
| [app/views/squadTutorial.js](../app/views/squadTutorial.js) | **Tuto scénarisé** : escouade fixe, ennemi faible passif, bulles d'aide étape par étape, quête `tuto_escouade`. |
| [app/router.js](../app/router.js) | Routes `#/squad-builder`, `#/squad-battle`, `#/squad-tuto`. |
| [index.html](../index.html) | Carte module **ESCOUADE** du hub + handler `openView('#/squad-builder')`. |

### Données / docs
| Fichier | Rôle |
|---|---|
| [docs/RULES_JRPG.md](RULES_JRPG.md) | Spec de game design (règles, équilibrage, décisions). |
| [supabase/archive/cards_snapshot_20260626.json](../supabase/archive/cards_snapshot_20260626.json) | Sauvegarde des 30 champions **avec leurs skills** (qui n'existent qu'en base). |

---

## 3. Base de données

### Tables
- **`tcg_squads`** (nouvelle) — une escouade sauvegardée : `player_id`, `name`,
  `is_active`, `slot{1,2,3}_champion_id`, `slot{1,2,3}_equipment text[]`,
  `terrain_id`. RLS « own only ». Index unique partiel : **1 escouade active /
  joueur**.
- **`cards`** — +50 cartes de soutien Set 01 seedées (Companion/Event/Object/
  Special/Terrain). Les champions ont `skill` (jsonb) + `slots=3`.
- **`chronicles_ledger`** — nouveau type `battle_reward`.
- **`tcg_quests`** — `tuto_escouade` (500), `squad_first_win` (300),
  `squad_win_hard` (500).

### RPC (toutes `SECURITY DEFINER`, `authenticated` only)
| RPC | Rôle |
|---|---|
| `save_squad(p_squad jsonb)` | Valide **côté serveur** (3 champions distincts possédés, équipement non-Champion possédé, max 3/slot, Terrain bien typé, set jouable, max 1 légendaire/mythique) puis upsert + bascule l'active. |
| `load_squad(p_squad_id uuid?)` | Renvoie l'escouade (active par défaut) avec **tous les ids résolus en cartes complètes** (skills incluses) pour l'UI. |
| `award_squad_reward(p_amount int, p_meta jsonb?)` | Crédite l'or de combat **via le ledger**. Montant **clampé 0–100** (anti-triche : combat client). |
| `_resolve_cards(text[])` | Helper interne (ids → jsonb[] ordonné). Non exposé. |
| `claim_quest(p_quest_id text)` | **Réutilisé** pour les quêtes du mode (idempotent). |

### Migrations (appliquées + versionnées dans `supabase/migrations/`)
| Fichier | Contenu |
|---|---|
| `20260626130000_restrict_to_set01_deactivate_bzh02_packs.sql` | Set 01 only (désactive les packs BZH02). |
| `20260626140000_seed_set01_support_cards.sql` | Lot 1 — seed 50 cartes de soutien. |
| `20260626150000_create_tcg_squads.sql` | Lot 2 — table + RLS + `save_squad`/`load_squad`. |
| `20260627000001_squad_battle_reward.sql` | Lot 7 — type `battle_reward` + `award_squad_reward`. |
| `20260627000002_seed_tuto_escouade_quest.sql` | Lot 8 — quête du tuto. |
| `20260627000003_seed_squad_quests.sql` | Lot 9 — quêtes du mode. |

> ⚠️ Les migrations ont été **appliquées directement** sur Supabase pendant le dev,
> puis trackées via `supabase migration repair --status applied`. Base et repo sont
> alignés (`supabase migration list` : local = remote).

---

## 4. Le moteur (`squadEngine.js`)

### API publique
```js
createSquadBattle(playerSquad, enemySquad) -> state
startSquadTurn(sideKey, state) -> state          // énergie, garde, cooldowns, reset actions
championAct(state, sideKey, i, action) -> { state, ok, reason? }
                                                 // action = {type:'basic'|'skill'|'active', equipIndex?}
getSquadResult(state) -> { winner, turns, goldReward } | null
autoPlaySquadTurn(state, sideKey, difficulty) -> state   // IA
endSquadPlayerTurn(state, difficulty) -> state   // tour ennemi (IA) puis début tour joueur
// Helpers UI : championAttackPower(side,i), teamShield(side), canChampionAct(state,side,i)
```

### Forme d'une escouade (entrée) et d'un état
```js
// playerSquad / enemySquad — exactement la forme renvoyée par load_squad :
{ slots: [ { champion: <carte>, equipment: [<carte>,…] }, … ], terrain: <carte>|null }

// state[sideKey] :
{ hp, energy, champions:[{ id,name,power,shield,energy,skill,equipment,
                           passivePower, actedThisTurn, usedActives }],
  terrain, shieldTemp, field, skillCooldowns, stunnedTurns, … }
```

### Règles encodées (constantes en tête du fichier)
- `SQUAD_HP=30`, `ENERGY_MAX=7`, `SKILL_EXTRA_COST=1`, `TERRAIN_DMG=1`,
  `TERRAIN_GUARD=1`, `MAX_EQUIP=3`.
- **Attaque de base** = `power_champion + Σ(power des passifs Object/Companion) + (Terrain ? 1 : 0)`.
- **Bouclier d'équipe** = somme des `shield` des passifs équipés (stockés dans
  `state[side].field`, pour que `teamShield()` ET skillEngine partagent le même
  calcul). Le bouclier **réduit chaque coup** (plat, ne se consomme pas) — sauf
  Event qui l'ignore.
- **Spéciale** : coûte `energy_champion + 1`, applique l'effet via skillEngine,
  pose le cooldown.
- **Actifs équipés** : Special (récurrent : `P` dmg + `S` garde), Event (1×/combat :
  `P` dmg ignore bouclier), Team (1×/combat : `P` dmg). Déclencher = l'action du tour.
- **Étourdissement** : géré par la **phase** (`player_stunned`/`enemy_stunned`),
  pas par le compteur (qui est décrémenté au début du tour) — cf bug corrigé en
  lot 4.

---

## 5. Flux des données (de l'Atelier au gain)

```
Atelier (squadBuilder.js)
  └─ save_squad(jsonb)  ──► validation serveur ──► tcg_squads (is_active=true)

Combat (squadBattle.js)
  ├─ load_squad()       ──► escouade active, cartes résolues (skills)
  ├─ loadCombatCards()  ──► table `cards` (fallback JSON) ──► generateEnemySquad()
  ├─ createSquadBattle() ─► boucle : championAct / endSquadPlayerTurn (IA)
  └─ à la VICTOIRE :
       ├─ claimSquadQuests() ─► claim_quest('squad_first_win'[, 'squad_win_hard'])
       │                         └─ INSERT chronicles_ledger (type 'quest')
       └─ awardGold()         ─► award_squad_reward(or)
                                  └─ INSERT chronicles_ledger (type 'battle_reward')

chronicles_ledger INSERT
  └─ trigger sync_chronicles_balance() : profiles.chronicles = SUM(ledger)
       └─ trigger sync_chronicles_to_tcg() : tcg_players.chronicles
```

**Règle d'or (à ne jamais enfreindre)** : tout crédit/débit passe par
`chronicles_ledger`. Le trigger **SET** (pas increment) `profiles.chronicles =
SUM(ledger)`. Une écriture directe sur `profiles.chronicles` serait **effacée** à
la prochaine opération ledger. Pareil : **supprimer** des lignes du ledger ne
re-synchronise PAS (le trigger ne fire que sur INSERT) → ça laisse le solde
incohérent.

---

## 6. Comment l'étendre

- **Ajouter des cartes équipables** : seeder dans `public.cards` (type non-Champion,
  `set_code='BZH01'`). Elles apparaissent dans l'Atelier si le joueur les possède.
- **Réactiver le Set 02** : (1) ajouter `'BZH02'` à `PLAYABLE_SET_IDS` dans
  `logic/sets.js` ; (2) `UPDATE pack_types SET is_active=true WHERE set_id='BZH02'` ;
  (3) `node dev/bump-cache.mjs` puis déployer.
- **Ajouter une quête** : INSERT dans `tcg_quests`, puis appeler
  `claim_quest('<id>')` au bon moment (ex: dans `squadBattle.finish()`).
- **Équilibrer** : ajuster les constantes 🎚️ de `squadEngine.js` (PV, énergie,
  coût spécial, bonus Terrain) et relancer `node tests/squadEngine.test.mjs`.
- **Améliorer l'IA** : `pickAction()` / `actionCandidates()` dans `squadEngine.js`
  (easy = basique, normal = skill+basique, hard = max dégâts + perce-bouclier +
  létal).

---

## 7. Tests & vérification

- **Moteur** : `node tests/squadEngine.test.mjs` → **17 tests** (setup, bouclier,
  attaque, économie d'action, énergie, skill cooldown, actifs, Terrain,
  étourdissement, victoire, IA).
- **RPC `save_squad`** : validé end-to-end (1 cas valide + 6 négatifs rejetés)
  contre une vraie collection, en simulant l'auth via `request.jwt.claims`.
- **Vues** : vérifiées dans le preview navigateur (Atelier, combat, tuto, panneau
  quêtes) — rendu correct, zéro erreur console.

> Astuce test RPC : pour simuler un utilisateur en SQL, exécuter le RPC dans une
> sous-requête `FROM (SELECT set_config('request.jwt.claims', '{"sub":"<uuid>","role":"authenticated"}', true))`.
> Et **ne pas** nettoyer via `DELETE` sur le ledger (voir §5) — préférer
> `BEGIN…ROLLBACK`.

---

## 8. État & points ouverts

- ✅ Les 9 lots sont livrés, commités et poussés sur `main`. Migrations alignées.
- 🟡 `tests/battleEngine.test.mjs` (mode salve, **indépendant** de l'escouade) est
  cassé depuis l'ajout du skill engine v3 : son harness ne gère pas l'import
  relatif de `skillEngine`. Le harness de `tests/squadEngine.test.mjs` montre le
  pattern correct à reprendre.
- 💡 Pistes futures : animations de combat, plus de contenu de quêtes, équilibrage
  fin, mode « PV par champion » (le skillEngine a déjà des effets de ciblage prêts).
