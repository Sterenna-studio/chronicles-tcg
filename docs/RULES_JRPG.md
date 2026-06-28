# Chronicles TCG — Mode Escouade (3 Champions) — Règles v1

> Statut : **IMPLÉMENTÉ** (2026-06-27). Les 9 lots sont livrés (§11). Ce document est
> la spec de **game design** (le « comment ça se joue ») ; pour l'**implémentation**
> (fichiers, base de données, flux, extension) voir [MODE_ESCOUADE.md](MODE_ESCOUADE.md).
> Le moteur est `logic/squadEngine.js`, le tuto `app/views/squadTutorial.js`. Les
> valeurs marquées 🎚️ sont des **paramètres d'équilibrage** ajustables.
>
> Ce mode **coexiste** avec le mode « salve » 1-Champion existant ([RULES.md](RULES.md)),
> qui reste la référence du moteur `logic/battleEngine.js`. Le mode Escouade est un
> **nouveau moteur** séparé, il ne remplace rien.

---

## 1. Vue d'ensemble

- **Format** : duel 1 contre 1 (joueur vs IA pour l'instant).
- **Concept** : chaque camp aligne une **escouade de 3 Champions**. On ne pioche pas
  de Champions : ils sont posés dès le départ. Le combat tourne autour de **qui
  attaque, avec quel équipement, et quand lâcher l'attaque spéciale**.
- **Objectif** : réduire le **pool de PV partagé** adverse à **0**.

Différence fondamentale avec le mode salve : pas de deck de 6 cartes piochées au
hasard. On joue une **escouade montée à l'avance** (loadout), façon JRPG.

---

## 2. L'escouade (loadout monté avant le combat)

Avant de lancer un combat, le joueur compose son escouade dans un écran dédié
(« Atelier d'escouade ») :

| Élément | Règle | 🎚️ |
|---|---|---|
| Champions | exactement **3**, tous différents | oui |
| Légendaires dans l'escouade | **max 1** | oui |
| Mythiques dans l'escouade | **max 1** | oui |
| Slots d'équipement par Champion | **3** (colonne `cards.slots`, déjà en base) | oui |
| Cartes équipables | **toute carte non-Champion** de la collection (Object, Companion, Special, Event, Team) — cf §5 | — |
| Slot Terrain d'équipe | **1** slot dédié pour toute l'escouade (hors des 3×3 slots champion) | oui |
| Même carte sur 2 slots | autorisé **seulement si** tu en possèdes 2 exemplaires | — |

L'escouade est **persistée** (table `tcg_squads`, cf §9) pour être rejouée sans la
remonter à chaque fois. Un joueur peut sauvegarder plusieurs escouades et choisir
l'active.

---

## 3. Mise en place d'un combat

| Élément | Valeur | 🎚️ |
|---|---|---|
| Pool de PV partagé (par camp) | **30** | oui |
| Énergie au tour 1 | **1** | oui |
| Plafond d'énergie | **7** (`min(numéro_du_tour, 7)`) | oui |
| Champions posés au départ | les **3** de l'escouade, face à face | — |

Pas de main, pas de pioche, pas de mulligan : tout est sur la table dès le tour 1.
La tension vient de la **gestion de l'énergie** et des **cooldowns de skills**.

---

## 4. Structure d'un tour

Le joueur actif enchaîne :

1. **Début de tour**
   - Énergie = `min(numéro_du_tour, 7)` 🎚️.
   - Réinitialise la **garde** (bouclier temporaire) à 0 (le bouclier d'équipement
     permanent, lui, persiste — cf §6).
   - Décrémente les **cooldowns** de skills de ce camp.
   - Applique les effets de début de tour (étourdissement, objets « retournés »…).
2. **Phase d'actions** : tant qu'il reste de l'énergie, le joueur fait **agir ses
   champions**. Chaque Champion **agit une seule fois par tour** 🎚️ et choisit
   **une** des actions suivantes :
   - **Attaque de base** : coûte `actionCost = max(1, ceil(energy_carte / 3))` 🎚️
     (l'`energy` brute des cartes, pensée pour le mode 1-champion, est rééchelonnée
     pour rester jouable à 3 champions). Inflige `power_champion + bonus_équipement passif` (cf §5).
   - **Attaque spéciale (skill)** : coûte `actionCost(champion) **+1**` 🎚️, et n'est
     dispo que si le cooldown est à 0. Applique l'effet de `card.skill.effect`
     (moteur `skillEngine.js`, déjà écrit), puis pose le cooldown.
   - **Déclencher un actif équipé** (Special / Event / Team posé sur ce Champion,
     cf §5) : coûte `actionCost` de la carte équipée. **Consomme l'action du tour**
     de ce Champion (il n'attaque pas en plus). Event/Team sont **à usage unique**
     dans le combat.
   - Un Champion **étourdi** ne peut pas agir ce tour. (Pas de KO individuel :
     pool partagé, cf §7.)
3. **Fin de tour** : passe la main. La **garde n'est PAS réinitialisée ici**
   (seulement au début du tour suivant — même correction que le mode salve).

L'énergie non dépensée est **perdue** (pas de report) 🎚️.

---

## 5. Équipement & cartes de soutien (règle centrale du mode)

Chaque Champion a **3 slots**. On y attache **n'importe quelle carte non-Champion**
de la collection. Tout l'équipement est figé au loadout (§13.4). Selon son type, une
carte équipée est soit un **passif** (toujours actif), soit un **actif** (déclenché
en combat, consomme l'action du Champion, cf §4).

> `P` = `power`, `S` = `shield` de la carte équipée. « ce Champion » = celui qui
> porte la carte.

| Type | Slot | Nature | Effet |
|---|---|---|---|
| 🔧 **Object** | champion | passif | +`P` à l'attaque de base de ce Champion ; +`S` au bouclier d'équipe |
| 🐾 **Companion** | champion | passif | +`P` en **aura** sur ce Champion (boost permanent d'attaque) ; +`S` au bouclier d'équipe |
| ✨ **Special** | champion | actif récurrent | action : `P` dégâts + `S` garde d'équipe (pas de cooldown, recoûte son énergie à chaque usage) |
| ⚡ **Event** | champion | actif **1×/combat** | action : `P` dégâts directs qui **ignorent le bouclier** |
| 👥 **Team** | champion | actif **1×/combat** | action : `P` dégâts (frappe lourde, non réductible par les buffs) |
| 🌍 **Terrain** | **équipe** | passif d'équipe | aura tant qu'en jeu : **+1 dégât** à toutes les attaques de l'escouade **et** +1 garde/tour 🎚️ |

**Attaque de base d'un Champion** = `power_champion + Σ(P des passifs Object/Companion équipés sur lui)` (+1 si Terrain).

**Bouclier d'équipe** = somme des `S` de tous les passifs équipés (Object/Companion)
sur les 3 Champions, **plafonnée à `MAX_TEAM_SHIELD` (8 🎚️)** — protège le **pool**
partagé, pas un champion précis (cf §6). Le plafond évite qu'un cumul de 6-9 passifs
ne dépasse toute attaque et fige le combat.

Exemple : Champion `power 7`, équipé de *Rose Blade* (Object P3/S4) et d'un
Companion (P2/S3) → attaque de base = **7 + 3 + 2 = 12**, et le camp gagne **+7** de
bouclier permanent. Le 3ᵉ slot porte un *Event* (P6) gardé pour une frappe perçante
unique au bon moment (consomme le tour du Champion).

**Mots-clés avancés (v1.1, 🎚️ optionnel)** : `pierce`, `lifesteal`, etc. sur des
cartes rares — documentés mais non implémentés en v1 pour garder le moteur simple.

---

## 6. Bouclier & dégâts

Deux sources de réduction, identiques en esprit au mode salve :

- **Garde** (`shieldTemp`) : bouclier temporaire gagné via skills/Specials. Persiste
  pendant le tour adverse, remis à 0 au début de ton tour suivant.
- **Bouclier permanent** : somme des `shield` de **tout l'équipement en jeu** des
  3 champions du camp, **plafonnée à `MAX_TEAM_SHIELD` (8 🎚️)**.

**Dégâts reçus par le pool** = `max(0, dégâts_bruts − (garde + bouclier_permanent))`,
sauf mention « ignore le bouclier ».

---

## 7. Pool de PV partagé & élimination

- Les 3 champions **partagent un total de 30 PV** 🎚️. Il n'y a **pas de KO
  individuel** : les champions restent actifs tant que le pool > 0.
- C'est le choix « pool partagé » validé : plus simple, plus proche du moteur salve
  étendu à 3 attaquants, et ça évite la gestion de cibles individuelles.
- **Conséquence sur les skills** : les effets de zone/ciblage du `skillEngine`
  (`aoe_damage`, `target_highest_hp`…) s'appliquent simplement au pool adverse. Ils
  restent valides, juste sans notion de cible multiple. (Réservé pour un éventuel
  mode « PV par champion » futur.)

---

## 8. Fin de partie & récompenses

- Victoire dès que le pool adverse ≤ 0. Double 0 le même tour → **match nul**.
- Barème calculé par `getSquadResult()` : `base (victoire 30 / nul 15 / défaite 10) +
  bonus de rapidité ((10 − tour) × 3 si victoire)` 🎚️.
- Crédit **via le ledger** : le combat appelle le RPC `award_squad_reward(montant)`
  (type ledger `battle_reward`, montant **clampé 0–100** côté serveur car le combat
  est client). Jamais d'écriture directe sur `profiles.chronicles` (le trigger de
  sync l'effacerait — cf [MODE_ESCOUADE.md](MODE_ESCOUADE.md) §5).

---

## 9. Données / persistance

> ✅ **Réalisé** (migrations appliquées) — détails et noms de migrations dans
> [MODE_ESCOUADE.md](MODE_ESCOUADE.md) §3.

**Le catalogue de cartes** est dans `data/BZH01.json` (+ `BZH02.json`, mais le jeu est
restreint au **Set 01** — cf `logic/sets.js`). Deux besoins, tous deux réalisés :

1. **Seed des cartes non-Champion du Set 01** (Object, Companion, Event, Special,
   Terrain) dans `public.cards` depuis `data/BZH01.json` — fait (50 cartes). Les
   30 Champions y étaient déjà (avec `skill` + `slots=3`).
2. **Table `tcg_squads`** (escouade sauvegardée), créée telle que :

```
tcg_squads (
  id          uuid pk default gen_random_uuid(),
  player_id   uuid not null references profiles(id) on delete cascade,
  name        text not null default 'Escouade 1',
  is_active   boolean not null default false,
  -- 3 champions + leurs cartes équipées (n'importe quel type non-Champion, max 3)
  slot1_champion_id text references cards(id),
  slot1_equipment   text[] default '{}',
  slot2_champion_id text references cards(id),
  slot2_equipment   text[] default '{}',
  slot3_champion_id text references cards(id),
  slot3_equipment   text[] default '{}',
  terrain_id        text references cards(id),  -- slot Terrain d'équipe (1, optionnel)
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
)
```
   - RLS : un joueur ne lit/écrit que **ses** escouades (`player_id = auth.uid()`).
   - Validation côté RPC `save_squad(...)` SECURITY DEFINER (ne pas faire confiance
     au client) : possession réelle des cartes, max 3 par slot, `terrain_id` de type
     Terrain, équipement non-Champion, respect des limites légendaire/mythique.

---

## 10. Le tuto scénarisé (combat guidé)

Complète l'accueil `ui/lemegetonTuto.js` (qui ne fait que créditer 1000 ✦pour
`tuto_01`). Fichier `app/views/squadTutorial.js` : un **vrai premier combat dirigé**,
IA passive, escouade pré-montée imposée, bulles d'aide étape par étape.

Déroulé (5 beats, tel qu'implémenté) :

1. **« Voici ton escouade »** — surligne les 3 champions + leurs slots d'équipement.
2. **« Attaque de base »** — force le joueur à faire attaquer le champion 1
   (montre `power + équipement`). L'IA ne riposte pas.
3. **« L'équipement compte »** — montre qu'un champion équipé frappe plus fort +
   donne du bouclier d'équipe.
4. **« Attaque spéciale »** — débloque et fait lancer la skill d'un champion
   (cooldown visible).
5. **« Achève l'adversaire »** — le joueur réduit le pool ennemi à 0 et gagne. Récompense
   via la quête **`tuto_escouade`** (500 ✦, `claim_quest`).

Le tuto est marqué fait via `tcg_quest_completions` (claim_quest idempotent) — la
récompense n'est versée qu'une fois, même si on rejoue le tuto. Accessible via le
bouton « 📖 Tuto » de l'Atelier.

---

## 11. Plan d'implémentation — **tous les lots livrés ✅**

| # | Lot | Fichiers (réels) | Statut |
|---|---|---|---|
| 1 | Seed des cartes non-Champion du Set 01 dans `cards` | `…140000_seed_set01_support_cards.sql` | ✅ |
| 2 | Table `tcg_squads` + RPC `save_squad`/`load_squad` | `…150000_create_tcg_squads.sql` | ✅ |
| 3 | Moteur `logic/squadEngine.js` (réutilise `skillEngine.js`) | [squadEngine.js](../logic/squadEngine.js) | ✅ |
| 4 | Tests `tests/squadEngine.test.mjs` (17 tests) | [squadEngine.test.mjs](../tests/squadEngine.test.mjs) | ✅ |
| 5 | IA d'escouade (**dans `squadEngine.js`** : `autoPlaySquadTurn`/`pickAction`) | [squadEngine.js](../logic/squadEngine.js) | ✅ |
| 6 | UI Atelier d'escouade | [app/views/squadBuilder.js](../app/views/squadBuilder.js) | ✅ |
| 7 | UI Combat Escouade + récompense ledger | [app/views/squadBattle.js](../app/views/squadBattle.js) | ✅ |
| 8 | Tuto scénarisé | [app/views/squadTutorial.js](../app/views/squadTutorial.js) | ✅ |
| 9 | Quêtes du mode (`squad_first_win`, `squad_win_hard`) | `…000003_seed_squad_quests.sql` | ✅ |

> Note : l'IA n'a finalement **pas** réutilisé `aiEngine.js` (propre au mode salve) —
> elle est intégrée au moteur d'escouade. Liste complète des fichiers et migrations
> dans [MODE_ESCOUADE.md](MODE_ESCOUADE.md) §2-§3.

---

## 12. Décisions validées (2026-06-26)

1. **PV** → **pool partagé** d'équipe (pas de KO individuel) (§7).
2. **Équipement** → **attaché à un champion** via ses 3 slots, booste ses attaques (§5).
3. **Tuto** → **combat scénarisé guidé** (§10).
4. **Process** → **design doc d'abord** (ce document), validation avant code (§11).
5. **Périmètre cartes** → **Set 01 uniquement** pour l'instant (`logic/sets.js`) (§9).

## 13. Décisions de game design (résolues — 2026-06-26)

1. **Action par tour** → **1 action / champion / tour** (§4). Chaque champion choisit
   une seule action : attaque de base, skill, ou déclencher un actif équipé.
2. **Coût du spécial (skill)** → **`energy` du champion +1** (§4), en plus du cooldown.
3. **Autres types de cartes** → **tous intégrés comme cartes équipables** (§5), pas
   exclus : Object/Companion en passifs, Special en actif récurrent, Event/Team en
   actifs à usage unique, Terrain en aura d'équipe (slot dédié).
4. **Équipement pendant le combat** → **figé au loadout** (§5). Tout se décide à
   l'Atelier d'escouade ; rien ne se ré-équipe en combat.
5. **Déclenchement d'un actif équipé** → **consomme l'action du tour** du champion
   porteur (§4).
6. **Slot Terrain** → **slot d'équipe dédié** (1 par escouade), hors des 3×3 slots
   champion (§2, §5).

➡️ Toutes les décisions sont tranchées et **implémentées** (§11). Toute évolution
future de l'équilibrage se fait via les constantes 🎚️ de `logic/squadEngine.js`.
