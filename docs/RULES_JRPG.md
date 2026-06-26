# Chronicles TCG — Mode Escouade (3 Champions) — Règles v1

> Statut : **PROPOSITION à valider** (2026-06-26).
> Spécification de référence pour le futur moteur `logic/squadEngine.js` + le tuto
> scénarisé `ui/squadTuto.js`. Les valeurs marquées 🎚️ sont des **paramètres
> d'équilibrage** ajustables.
>
> Ce mode **coexiste** avec le mode « salve » 1-Champion existant ([RULES.md](RULES.md)),
> qui reste la référence du moteur actuel `logic/battleEngine.js`. Le mode Escouade
> est un **nouveau moteur**, il ne remplace rien tant qu'il n'est pas validé.

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
| Équipement | cartes de type **Object** de la collection | — |
| Même Object sur 2 champions | autorisé **seulement si** tu en possèdes 2 exemplaires | — |

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
   champions**. Chaque Champion peut agir **une fois par tour** 🎚️.
   - **Attaque de base** : coûte l'`energy` du Champion. Inflige
     `power_champion + bonus_équipement` (cf §5).
   - **Attaque spéciale (skill)** : coûte l'`energy` du Champion **+1** 🎚️, et n'est
     dispo que si le cooldown est à 0. Applique l'effet de `card.skill.effect`
     (moteur `skillEngine.js`, déjà écrit), puis pose le cooldown.
   - Un Champion **étourdi** ou **KO-able ?** (non : pool partagé, pas de KO
     individuel — cf §7) ne peut pas être bloqué individuellement.
3. **Fin de tour** : passe la main. La **garde n'est PAS réinitialisée ici**
   (seulement au début du tour suivant — même correction que le mode salve).

L'énergie non dépensée est **perdue** (pas de report) 🎚️.

---

## 5. Équipement & attaques (règle centrale du mode)

Chaque Champion a **3 slots**. On y attache des cartes **Object**. L'équipement
modifie **les attaques de CE Champion uniquement** :

- **Bonus d'attaque** : l'attaque de base du Champion devient
  `power_champion + Σ(power des Objects équipés sur lui)`.
- **Bouclier d'équipe** : le `shield` de chaque Object équipé alimente le
  **bouclier permanent partagé** du camp (cf §6). Le bouclier protège le pool,
  pas un champion en particulier.
- **Effets d'équipement (v1.1, 🎚️ optionnel)** : certains Objects rares pourront
  porter un mot-clé (`pierce` = ignore le bouclier, `lifesteal` = soigne le pool,
  etc.). En **v1**, on s'en tient à `power`/`shield` pour garder le moteur simple ;
  les mots-clés sont une extension documentée mais non implémentée d'emblée.

Exemple : Champion `power 7`, équipé de *Rose Blade* (P3/S4) et *Cyber Bow*
(P2/S4) → attaque de base = **7 + 3 + 2 = 12**, et le camp gagne **+8** de bouclier
permanent tant que ces Objects sont en jeu.

---

## 6. Bouclier & dégâts

Deux sources de réduction, identiques en esprit au mode salve :

- **Garde** (`shieldTemp`) : bouclier temporaire gagné via skills/Specials. Persiste
  pendant le tour adverse, remis à 0 au début de ton tour suivant.
- **Bouclier permanent** : somme des `shield` de **tout l'équipement en jeu** des
  3 champions du camp.

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
- Or (chronicles) crédité **via le ledger** (`chronicles_ledger`, jamais d'écriture
  directe sur `profiles.chronicles` — cf architecture monnaie). Barème :
  `base (victoire 30 / nul 15 / défaite 10) + bonus de rapidité` 🎚️, réutilise la
  logique de `getBattleResult` du mode salve.

---

## 9. Données / persistance

**Le catalogue de cartes** est dans `data/BZH01.json` + `BZH02.json` (Champions,
Companions, Events, Objects, Specials, Terrains, Teams), mais la table `public.cards`
**ne contient aujourd'hui que les 30 Champions**. Pour le mode Escouade il faut donc :

1. **Seeder les Objects** (équipement) dans `public.cards` depuis les JSON
   (migration de seed) — sinon aucun équipement disponible.
2. **Nouvelle table `tcg_squads`** (escouade sauvegardée) :

```
tcg_squads (
  id          uuid pk default gen_random_uuid(),
  player_id   uuid not null references profiles(id) on delete cascade,
  name        text not null default 'Escouade 1',
  is_active   boolean not null default false,
  -- 3 champions + leurs équipements
  slot1_champion_id text references cards(id),
  slot1_equipment   text[] default '{}',   -- ids d'Objects, max 3
  slot2_champion_id text references cards(id),
  slot2_equipment   text[] default '{}',
  slot3_champion_id text references cards(id),
  slot3_equipment   text[] default '{}',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
)
```
   - RLS : un joueur ne lit/écrit que **ses** escouades (`player_id = auth.uid()`).
   - Validation de possession (champions/objets réellement dans la collection) faite
     côté RPC `save_squad(...)` SECURITY DEFINER, pour ne pas faire confiance au client.

---

## 10. Le tuto scénarisé (combat guidé)

Remplace/complète l'accueil `lemegetonTuto.js` (qui ne fait que créditer 1000 ✦).
Nouveau fichier `ui/squadTuto.js` : un **vrai premier combat dirigé**, IA passive,
escouade pré-montée imposée, bulles d'aide étape par étape.

Déroulé proposé (5 beats) :

1. **« Voici ton escouade »** — surligne les 3 champions + leurs slots d'équipement.
2. **« Attaque de base »** — force le joueur à faire attaquer le champion 1
   (montre `power + équipement`). L'IA ne riposte pas.
3. **« L'équipement compte »** — montre qu'un champion équipé frappe plus fort +
   donne du bouclier d'équipe.
4. **« Attaque spéciale »** — débloque et fait lancer la skill d'un champion
   (cooldown visible).
5. **« Achève l'adversaire »** — le joueur réduit le pool ennemi à 0 et gagne. Récompense
   créditée via le ledger (quête `tuto_combat` 🎚️).

Le tuto est marqué fait via `tcg_quest_completions` (comme `tuto_01`) pour ne pas se
relancer.

---

## 11. Plan d'implémentation (séquencé)

| # | Lot | Fichiers | Dépend de |
|---|---|---|---|
| 1 | **Seed Objects** dans `cards` | migration `…_seed_object_cards.sql` | — |
| 2 | **Table `tcg_squads`** + RPC `save_squad`/`load_squad` | migration `…_create_tcg_squads.sql` | — |
| 3 | **Moteur** `logic/squadEngine.js` (état, attaque de base, skill, bouclier, pool) | réutilise `skillEngine.js` | 1 |
| 4 | **Tests** `tests/squadEngine.test.mjs` | — | 3 |
| 5 | **IA** d'escouade (réutilise/adapte `aiEngine.js`) | — | 3 |
| 6 | **UI Atelier d'escouade** (compo 3 champions + drag équipement) | nouvelle vue | 2 |
| 7 | **UI Combat Escouade** (vue combat) | nouvelle vue | 3,5 |
| 8 | **Tuto scénarisé** `ui/squadTuto.js` | — | 7 |
| 9 | **Quêtes** liées au mode (jouer/gagner un combat Escouade) | seed `tcg_quests` | 7 |

L'ordre 1→4 est purement back/logique (testable sans UI). 6→8 est le front.

---

## 12. Décisions validées (2026-06-26)

1. **PV** → **pool partagé** d'équipe (pas de KO individuel) (§7).
2. **Équipement** → **attaché à un champion** via ses 3 slots, booste ses attaques (§5).
3. **Tuto** → **combat scénarisé guidé** (§10).
4. **Process** → **design doc d'abord** (ce document), validation avant code (§11).

## 13. Questions ouvertes (à trancher avant le lot 3)

- **Action par tour** : 1 action/champion/tour (proposé §4) ou énergie libre sans
  limite d'actions ? → impacte fortement l'équilibrage.
- **Coût du spécial** : `energy +1` (proposé) ou coût fixe ?
- **Autres types de cartes** (Companion/Event/Terrain/Special/Team) : exclus de la v1
  (mode 100 % champions+équipement) ou réintroduits comme « cartes tactiques » à part ?
- **Équipement pendant le combat** : figé au loadout (proposé) ou ré-équipable en jeu ?
