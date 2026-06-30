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
| [logic/combatRecorder.js](../logic/combatRecorder.js) | **Enregistreur de combats** : capture setup (escouades+decks en ids) + actions du joueur (deploy/equip/act/endturn) + résultat → localStorage (40 derniers). Export JSON, copie, e-mail (`contact@sterenna.fr`). Pour replay/analyse. |
| [tests/squadEngine.test.mjs](../tests/squadEngine.test.mjs) | **17 tests** du moteur (data: URL ESM, charge skillEngine via une URL séparée). |

### Vues (UI)
| Fichier | Rôle |
|---|---|
| [app/views/squadBuilder.js](../app/views/squadBuilder.js) | **Atelier d'escouade** : grille collection, 3 slots champion + équipement, slot Terrain, sauvegarde (`save_squad`), boutons Tuto / Quêtes / Combattre. |
| [app/views/squadBattle.js](../app/views/squadBattle.js) | **Page de combat dédiée**, avec **séquence d'ouverture sur l'arène** : (1) **Le Sceau d'ouverture** `runOpeningSeal` — sceau goétique/glitch qui désigne un camp ; il **PREND** ou **LAISSE la main** (ouvre la Chronique = déploie + agit en 1er ; IA tranche si désignée). (2) **Déploiement chacun-son-tour** `runPlacement` — chaque camp pose 1 champion en alternance, le camp à la main commence. (3) **Combat** `startCombat` — **mulligan** d'ouverture (garder/rebattre la main), puis si l'ennemi a la main il joue le 1er tour (`openEnemyTurn`). CSS `.sqb-*` injecté. Charge `load_squad`, génère l'ennemi, overlay victoire, récompenses + quêtes + défis (ledger). |
| [app/views/squadTutorial.js](../app/views/squadTutorial.js) | **Tuto scénarisé** : escouade fixe, ennemi faible passif, bulles d'aide étape par étape, quête `tuto_escouade`. |
| [app/router.js](../app/router.js) | Routes `#/squad-builder`, `#/squad-battle`, `#/squad-tuto`. |
| [ui/onboardingFunnel.js](../ui/onboardingFunnel.js) | **Parcours d'initiation** : bandeau hub qui guide le nouveau joueur (kit → booster → ouverture → tuto Escouade). Cf §9. |
| [index.html](../index.html) | Carte module **ESCOUADE** du hub + handler `openView('#/squad-builder')` ; hôte `#onboarding-funnel` + écouteur `hub:refresh`. |
| [ui/cardPreview.js](../ui/cardPreview.js) | **Aperçu carte en grand** (partagé) : `attachCardPreview(el, card\|()=>card, {qty?})` câble un **clic droit** (desktop) / **appui long** (tactile) qui ouvre une grande carte + stats (⚡⚔🛡) + skill + desc. Branché à l'Atelier (grille, slots, terrain, deck), au déploiement, au combat (champions amis/ennemis + main équipement) et au tuto. Ferme : fond / ✕ / Échap. |

### Données / docs
| Fichier | Rôle |
|---|---|
| [docs/RULES_JRPG.md](RULES_JRPG.md) | Spec de game design (règles, équilibrage, décisions). |
| [supabase/archive/cards_snapshot_20260626.json](../supabase/archive/cards_snapshot_20260626.json) | Sauvegarde des 30 champions **avec leurs skills** (qui n'existent qu'en base). |

---

## 3. Base de données

### Tables
- **`tcg_squads`** (nouvelle) — une escouade sauvegardée : `player_id`, `name`,
  `is_active`, `slot{1,2,3}_champion_id`, `slot{1,2,3}_equipment text[]` (legacy,
  vidé en B2), **`equipment_deck text[]`** (deck ≤20, B2), `terrain_id`. RLS « own
  only ». Index unique partiel : **1 escouade active / joueur**.
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
| `award_daily_squad_win()` | Bonus quotidien **fixe (75 ✦)** pour la 1re victoire Escouade du jour (UTC). « 1×/jour » vérifié côté serveur sur le ledger (`meta->>'kind'='squad_win'`). Aucun montant client. |
| `claim_daily_login()` | Bonus de connexion journalier (paliers 50→300, streak sur `tcg_players`) **crédité via le ledger** (`daily_bonus`). Remplace l'ancienne écriture directe sur `profiles.chronicles` (bug : effacée à la prochaine op ledger). |
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
| `20260627010000_daily_retention_loop.sql` | Boucle quotidienne — `claim_daily_login` (fix ledger) + `award_daily_squad_win`. |

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
  `TERRAIN_GUARD=1`, `MAX_EQUIP=3`, `MAX_TEAM_SHIELD=8` 🎚️, `COST_DIVISOR=3` 🎚️.
- **Attaque de base** = `power_champion + Σ(power des passifs Object/Companion) + (Terrain ? 1 : 0)`.
- **Coût d'une action** = `actionCost(carte, type)` = `max(1, ceil(energy_carte / COST_DIVISOR))`
  (+`SKILL_EXTRA_COST` pour une spéciale). ⚠️ **Rééchelonné** : les cartes portent
  une `energy` pensée pour le mode 1-champion (3-7) ; brute, elle rendait le pool
  `min(tour,7)` injouable avec 3 champions. L'UI **et** l'IA appellent `actionCost`.
- **Bouclier d'équipe** = `min(MAX_TEAM_SHIELD, Σ shield des passifs équipés)` +
  garde temporaire. **Plafonné** (sinon 6-9 passifs × 4-6 = mur de ~30 ≥ toute
  attaque → combat injouable). Réduit chaque coup à plat, ne se consomme pas — sauf
  Event qui l'ignore. `teamShield()` ET skillEngine partagent ce calcul.
- **Spéciale** : coûte `actionCost(champion,'skill')`, applique l'effet via skillEngine,
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
- ✅ `tests/battleEngine.test.mjs` (mode salve) **réparé** : son harness charge
  désormais `skillEngine` via une data: URL séparée (même pattern que
  `squadEngine.test.mjs`). **9 tests** OK.
- ✅ **Parcours d'initiation** (onboarding guidé) livré — cf §9.
- ✅ **Boucle de rétention quotidienne** : bonus de connexion réparé (ledger) +
  bonus « 1re victoire Escouade du jour » (75 ✦). Tout via le ledger.
- ✅ **Combat réel rééquilibré** (le tuto le masquait via `refill()`). Les valeurs
  de cartes du mode 1-champion, cumulées sur 3 champions, rendaient le combat
  **injouable** (boucliers ~30 ≥ attaques + énergie insuffisante pour agir).
  Corrigé par `MAX_TEAM_SHIELD` + `actionCost` (cf §4). Prouvé : sim auto passait
  de ∞ (30/30 à 12 tours) à ~3 tours gagnables.
- ✅ **Ancien mode 1-champion retiré du jeu.** Le bouton/carte « COMBAT » du hub et
  les routes `#/deck-builder` / `#/battle` sont supprimés ; les fichiers restent
  **dormants** sur disque (`app/views/{battle,deckBuilder}.js`,
  `logic/{battleEngine,aiEngine}.js` + `tests/battleEngine.test.mjs`). Le hub est
  désormais 100 % Escouade.
- ✅ **Défis du jour migrés vers l'Escouade.** `logic/challengeEngine.js` a un
  `SQUAD_CHALLENGE_POOL` (11 défis : victoire rapide, gros coup, Event, etc.) +
  `getDailySquadChallenges()` / `checkAndCompleteSquadChallenges()`. Le contexte
  (dégâts, skills/actifs/events, PV final) est construit dans `squadBattle.js`,
  qui crédite chaque défi **via le ledger** (`award_squad_reward`, clampé ≤100).
  La progression reste en localStorage par jour (limite connue, comme l'ancien).
- ✅ **Page de combat dédiée + déploiement** (Phase A) : `squadBattle.js` ouvre sur
  une phase de déploiement (glisser-déposer / tap les 3 champions sur 3 positions +
  le terrain — **visuel**, l'ordre placé = ordre des `champions[0..2]`), puis le
  combat avec une UI redessinée. « Rejouer » garde la disposition (`skipDeploy`).
- ✅ **Phase B1 — équipement « en main »** (moteur + UI combat) : deck de **20**
  cartes, pioche **3/tour**, équiper un champion **coûte l'énergie de la carte**
  (`actionCost`, pool partagé avec l'attaque → anti-stomp), **échange → défausse**,
  emplacements **dynamiques** (`champion.slots`, défaut 3). Mode « deck » vs
  « legacy » dans `squadEngine.makeSide` (le tuto + l'ennemi restent pré-équipés).
  API moteur : `drawEquipment`, `equipCard`, `unequipCard`. Deck **temporaire**
  (`buildEquipmentDeck` dans `squadBattle.js`) en attendant B2.
- ✅ **Phase B2 — constructeur de deck à l'Atelier** : `squadBuilder.js` bâtit un
  **deck d'équipement (≤20)** (section « DECK ÉQUIPEMENT X/20 ») au lieu d'équiper
  par champion. Migration `20260629010000` : colonne `tcg_squads.equipment_deck`,
  `save_squad` valide le deck (≤20, types, possession ; cap rareté sur
  champions+terrain seulement), `load_squad` renvoie `equipmentDeck`. `squadBattle`
  utilise ce deck (fallback `buildEquipmentDeck` pour les vieilles escouades sans deck).
- ✅ **IA ennemie symétrique** : l'ennemi a aussi un deck (`generateEnemySquad` →
  `equipmentDeck`), pioche 3/tour et **s'équipe** via `aiEquip` dans
  `autoPlaySquadTurn` (easy/normal 1 équip/tour, hard 2 ; garde de l'énergie pour
  attaquer). Comme il joue en second, la **difficulté = PV de l'ennemi** 🎚️
  (easy 22 / normal 30 / hard 42) + taille de deck (10/16/20). Sim miroir : hard
  bascule côté ennemi (≈8/6), easy/normal joueur-favorables, ~4-5 tours, sans blocage.
- ✅ **Enregistreur de combats** (`logic/combatRecorder.js`) : chaque combat
  Escouade est journalisé (setup en ids + séquence d'actions du joueur + résultat)
  en localStorage (40 derniers). Bouton **📜 Historique** à l'Atelier → **Exporter**
  (JSON), **Copier**, **Envoyer** (mailto `contact@sterenna.fr` + téléchargement du
  fichier à joindre), **Vider**. Format pensé pour rejouer/simuler.
- ✅ **Séquence d'ouverture lore-cohérente** (sur l'arène, plus d'écran de déploiement
  séparé) : **Le Sceau d'ouverture** (initiative stylée — sceau goétique/glitch qui
  désigne un camp, qui **prend ou laisse la main** ; IA tranche si désignée) →
  **déploiement chacun-son-tour** (1 champion par camp en alternance, le camp à la
  main commence) → **mulligan d'ouverture** (garder/rebattre la main d'équipement) →
  combat (celui qui a pris la main agit en premier). Moteur : `mulliganEquipment`,
  `openEnemyTurn`. Thème : chaque combat = une *Chronique* qu'on « ouvre ».
- ✅ **Aperçu carte en grand** (`ui/cardPreview.js`) : **clic droit** (ou appui long
  tactile) sur n'importe quelle carte → overlay grande image + stats + skill + desc.
  Câblé partout (Atelier : grille/slots/terrain/deck ; déploiement ; combat :
  champions amis & ennemis + main d'équipement ; tuto). Composant autonome réutilisable.
- 🟡 **À venir** : collecte serveur auto (table `tcg_combat_logs`) pour centraliser
  sans e-mail ; replayer qui rejoue un record dans le moteur ; défausse imposée par
  l'adversaire ; slots modifiables par effets.
- 💡 Pistes futures : animations de combat, plus de contenu de quêtes, équilibrage
  fin, mode « PV par champion » (le skillEngine a déjà des effets de ciblage prêts).

---

## 9. Parcours d'initiation (onboarding guidé)

Après l'accueil **LEMEGETON** (`ui/lemegetonTuto.js`, quête `tuto_01` = kit de
1 000 ✦), le nouveau joueur était laissé seul sur le hub. Le bandeau
**`ui/onboardingFunnel.js`** comble ce trou : il s'affiche en haut du panneau
central (`#onboarding-funnel`) et enchaîne 4 étapes vers le mode Escouade.

| # | Étape | Fait quand… | CTA (action) |
|---|---|---|---|
| 1 | ✦ Kit de départ | `tuto_01` réclamée | Rouvre LEMEGETON |
| 2 | 🛒 Premier booster | possède un pack **ou** des cartes | Met en évidence la boutique ◈ |
| 3 | 📦 Ouvre le booster | possède ≥ 1 carte | Met en évidence les boosters |
| 4 | 🛡 Tuto Escouade | `tuto_escouade` réclamée | `openView('#/squad-tuto')` |

**Détection** : 100 % dérivée de la BDD, **aucune nouvelle colonne** —
`tcg_quest_completions` (kit + tuto), `tcg_player_cards` (`user_id`),
`tcg_player_packs` (`player_id`). Le bandeau **disparaît définitivement** dès que
`tuto_escouade` est faite (état terminal). Un lien « plus tard ✕ » le masque pour
la session (sessionStorage).

**Cas notable** : un joueur **existant** qui a des cartes mais n'a jamais fait le
tuto voit les étapes 1–3 cochées et l'étape 4 active → le bandeau **resurface le
mode Escouade** aux anciens joueurs.

**Rafraîchissement** : `index.html` réévalue le bandeau à chaque `refreshHub()`
(après achat/ouverture) et au retour des vues plein écran via l'événement
`hub:refresh` (émis par `squadTutorial.backToHub()`), pour que l'étape 4 se coche
dès la sortie du tuto.
