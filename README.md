# Chronicles TCG — le « Bridge »

Jeu de cartes (TCG) web de l'univers **Gwen Ha Stêar**, un des jeux de la
plateforme **Sterenna / Nitro**. SPA statique en **modules ES natifs** (pas de
build), backend **Supabase** (auth, cartes, monnaie, escouades).

En prod : `https://nitro.sterenna.fr/TCG/` (auth déléguée à la plateforme Nitro).

Historique des versions : [CHANGELOG.md](CHANGELOG.md).

---

## Démarrer en local

```bash
python -m http.server 8000      # ou le serveur "tcg-static" de .claude/launch.json
# http://localhost:8000/index.html
```

En local il n'y a **pas de session Supabase** : le hub affiche « non connecté » et
les vues authentifiées (combat, boutique) ne se peuplent pas. Pour vérifier ces
vues, on **mock-rend** le composant ou on **simule** le moteur (cf
`docs/MODE_ESCOUADE.md`), on ne charge pas le hub.

## Cache-busting

Tous les imports locaux portent un `?v=N` partagé. Après toute modif de JS/HTML :

```bash
node dev/bump-cache.mjs          # incrémente la version partout (singletons OK)
```

---

## Architecture

- **`index.html`** — le **hub** (« Bridge ») : topbar, panneau gauche (stats, bonus
  journalier, défis du jour), modules (Collection, Escouade, Succès, Classement,
  Ouverture), boutique intégrée à droite. Écran de chargement d'entrée animé.
- **`app/router.js`** — routeur par hash. `#/hub` (ou vide) = hub ; sinon une vue
  plein écran rendue dans `#app-root`. `onRoute()` pilote seul l'affichage hub↔vue.
  Routes : `#/collection`, `#/squad-builder`, `#/squad-battle`, `#/squad-tuto`.
- **`app/views/`** — vues : `collection`, `squadBuilder` (Atelier), `squadBattle`
  (combat + séquence d'ouverture), `squadTutorial`. *(`battle` + `deckBuilder` =
  ancien mode 1-champion, **dormants**, non routés.)*
- **`logic/`** — moteurs purs : `squadEngine` (Mode Escouade), `skillEngine`
  (effets de skills, réutilisé), `combatRecorder` (journal de combats),
  `challengeEngine` (défis), `daily` (bonus de connexion), `sets` (sets jouables).
- **`ui/`** — `lemegetonTuto` (accueil + kit de départ), `onboardingFunnel`
  (parcours d'initiation), `openingOverlay` (ouverture de boosters),
  `cardPreview` (aperçu carte en grand, clic droit / appui long — partagé
  par toutes les vues).
- **`state/settings.js`** — réglages persistés en `localStorage` (volume/on-off
  du son de révélation de carte), édités depuis l'admin.
- **`pages/admin/`** — back-office (cartes, boosters, audio), réservé aux
  comptes `profiles.role='superuser'` — cf section [Administration](#administration-superuser).
- **`data/`** — `BZH01.json` (jouable), `BZH02.json` (visible en collection, pas
  encore jouable — cf `logic/sets.js` `PLAYABLE_SET_IDS`). Repos Supabase
  (`cardsRepo`, `packsRepo`, `supabaseData`).
- **`assets/`** — `cards/<id>.jpg`, `packs/<image>`, `card_back.png`.

## Monnaie : Chronicles (⚠️ règle d'or)

La monnaie est gérée par la table **`chronicles_ledger`** = **source unique de
vérité**. Un trigger fait `profiles.chronicles = SUM(ledger)` à chaque insert.
**Ne jamais écrire `profiles.chronicles` directement** (la prochaine opération
ledger l'effacerait). Tout crédit/débit passe par un RPC `SECURITY DEFINER` qui
insère dans le ledger (`claim_quest`, `buy_pack_with_chronicles`,
`award_squad_reward`, `claim_daily_login`, `award_daily_squad_win`, …).

## Mode Escouade (mode principal)

3 champions partageant un pool de 30 PV. À l'Atelier : 3 champions + 1 terrain +
un **deck d'équipement (≤20)**.

Ouverture d'un combat, directement sur l'arène (plus d'écran séparé) :
1. **Le Sceau d'ouverture** — désigne un camp, qui **prend ou laisse la main**
   (= ouvre la Chronique : déploie et agit en premier).
2. **Déploiement chacun-son-tour** — un champion par camp, en alternance.
3. **Mulligan** — garder sa main d'équipement d'ouverture ou la rebattre.

En combat : on **pioche 3 cartes d'équipement/tour** et on les **équipe**
(coût en énergie). L'IA (symétrique, difficulté = PV de l'ennemi) joue son
tour **animé** — champion surligné avant résolution, pas de résultat instantané.
Clic droit / appui long sur une carte l'affiche en grand. Récompenses via le
ledger. **Détails complets : [docs/MODE_ESCOUADE.md](docs/MODE_ESCOUADE.md)** ;
règles de jeu : [docs/RULES_JRPG.md](docs/RULES_JRPG.md).

## Administration (superuser)

`pages/admin/` est un back-office statique séparé du hub SPA, réservé aux
comptes dont `profiles.role = 'superuser'` (même convention que les autres
jeux du Supabase partagé). Un bouton **🛠 ADMIN** apparaît dans le hub pour ces
comptes ; sinon la page affiche un écran d'accès refusé.

Onglets : **Cartes** (recherche/filtre, édition complète y compris la skill,
bannissement — pas de suppression, `cards`/`pack_types` n'ont pas de FK stricte
et un DELETE laisserait des références mortes dans les collections/inventaires
des joueurs), **Boosters** (prix, image, nombre de cartes, actif/inactif), **UI
& Audio** (son de révélation de carte, le seul réglage réellement branché au jeu).

Écritures via RPC `SECURITY DEFINER` (`admin_upsert_card`,
`admin_upsert_pack_type`) qui revalident le rôle côté serveur — aucune policy
RLS d'écriture ouverte sur ces tables.

Pour se donner l'accès :
```sql
UPDATE profiles SET role = 'superuser' WHERE id = '<uuid>';
```

---

## Base de données (Supabase)

Migrations versionnées dans `supabase/migrations/`. Appliquer :

```bash
supabase db push                 # local = remote ; trackées via migration repair
```

Tables clés : `cards`, `profiles` (chronicles, `role` — `superuser` = accès
admin), `tcg_players`, `tcg_player_cards` (`user_id`), `tcg_player_packs`
(`player_id`), `tcg_squads` (+ `equipment_deck`), `chronicles_ledger`,
`tcg_quests` / `tcg_quest_completions`, `pack_types` (+ `card_count`).

## Tests

```bash
node tests/squadEngine.test.mjs   # 23 tests (moteur Escouade)
node tests/battleEngine.test.mjs  #  9 tests (ancien mode, conservé)
```

Harness : chaque moteur est évalué via une data: URL ESM, en réécrivant l'import
relatif de `skillEngine` vers une data: URL séparée.
