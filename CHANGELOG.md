# Historique des versions — Chronicles TCG (« Bridge »)

Regroupé par version (dates des commits). Détails techniques :
[docs/MODE_ESCOUADE.md](docs/MODE_ESCOUADE.md) · [docs/RULES_JRPG.md](docs/RULES_JRPG.md).

---

## v2.6 — Ouverture repensée, IA animée & outils admin (2026-06-30 → 2026-07-01)

**Mode Escouade — ouverture de combat**
- Fin de l'écran de déploiement séparé : la séquence d'ouverture se joue
  désormais **directement sur l'arène**, en trois temps lore-cohérents.
  1. **Le Sceau d'ouverture** — sceau goétique animé qui désigne un camp ; il
     **prend** ou **laisse la main** (ouvrir la Chronique = déployer et agir
     en premier). L'IA tranche et révèle son choix si elle est désignée.
  2. **Déploiement chacun-son-tour** — chaque camp pose un champion en
     alternance, le camp à la main commence.
  3. **Mulligan d'ouverture** — garder sa main d'équipement de départ ou la
     rebattre une fois, avant le premier coup.
- **Tour de l'IA animé** : chaque action ennemie (équipement puis attaque/
  skill/actif) se joue en ~1 s, champion surligné avant résolution — on voit
  l'IA jouer au lieu qu'elle résolve son tour instantanément.
- Moteur : `mulliganEquipment`, `openEnemyTurn` / `planAutoTurn` (tour IA
  découpé en frames pour l'animation).

**Cartes & boutique**
- **Aperçu de carte en grand** (`ui/cardPreview.js`) : clic droit (desktop) /
  appui long (tactile) sur n'importe quelle carte — Atelier, déploiement,
  combat, tuto — ouvre une fiche avec stats, skill et description.
- **Achat de packs ×5 / ×10** dans la boutique (en plus de ×1), RPC
  d'achat bouclé avec arrêt propre si le solde s'épuise en cours de route.
- Correctif : le nombre de cartes par booster était codé en dur (5) ; c'est
  maintenant une colonne `pack_types.card_count` réelle et éditable.

**Administration**
- Nouvelle page **`pages/admin/`** (back-office), réservée aux comptes
  `profiles.role = 'superuser'` : gestion des **cartes** (recherche, édition
  complète y compris la skill, bannissement) et des **boosters** (prix, image,
  nombre de cartes, actif/inactif). Écritures via RPC `SECURITY DEFINER`
  (`admin_upsert_card`, `admin_upsert_pack_type`) qui revalident le rôle
  côté serveur — pas de nouvelle policy RLS ouverte.
- Bouton **🛠 ADMIN** dans le hub, visible uniquement pour les superusers.
- Ancien panneau FX (rays/burst/badge) retiré : il pilotait un mécanisme de
  carte-flip qui n'existait plus dans le jeu réel. Seul l'**audio** (son de
  révélation de carte) est resté, et il est maintenant **réellement câblé**
  à `ui/openingOverlay.js` (avant : sans aucun effet).

## v2.5 — Mode Escouade & refonte du hub (2026-06-26 → 2026-06-30)

Ajout du **Mode Escouade** (mode principal : 3 champions, pool de PV partagé) et
modernisation du hub.

**Mode Escouade**
- Moteur de combat `squadEngine` + tests (≈23) ; IA selon la difficulté.
- **Page de combat dédiée** : phase de **déploiement** (glisser-déposer des 3
  champions + terrain) puis combat à l'UI redessinée (cartes à taille fixe,
  ennemi en haut).
- **Équipement « en main »** : deck de **20 cartes** construit à l'**Atelier**,
  pioche **3/tour**, équiper coûte l'énergie de la carte (anti-stomp),
  échange → défausse, emplacements **dynamiques** (`champion.slots`).
- **IA ennemie symétrique** (pioche & équipe) ; difficulté = PV de l'ennemi.
- Tutoriel scénarisé + quêtes d'escouade.
- Persistance `tcg_squads` (+ colonne `equipment_deck`), RPC `save_squad` /
  `load_squad` (validation serveur).
- **Enregistreur de combats** (`combatRecorder`) : historique local, export JSON,
  copie, envoi e-mail (`contact@sterenna.fr`).

**Hub & onboarding**
- **Écran de chargement d'entrée** animé + **URL propre `#/hub`** (le routeur
  pilote seul l'affichage hub ↔ vue).
- **Parcours d'initiation** (onboarding guidé) sur le hub.
- **Boucle de rétention quotidienne** : bonus de connexion (réparé → via le
  ledger) + bonus « 1re victoire Escouade du jour ».
- **Défis du jour** migrés vers le Mode Escouade.
- Retrait de l'accès à l'**ancien mode 1-champion** (fichiers dormants).

**Données & correctifs**
- « The Mask of Sorn » re-typé Champion → **Object**.
- Combat escouade rendu **jouable** (boucliers/énergie rééquilibrés ; il était
  mathématiquement bloqué).
- Bug du bonus de connexion (écriture directe sur `profiles.chronicles`) corrigé.
- Harness de `tests/battleEngine.test.mjs` réparé.

## v2.4 — Durcissement sécurité & ledger Chronicles (2026-06-25 → 2026-06-26)

- **Sécurité** : REVOKE des RPC pour `anon`, `search_path` fixé, bypass RLS
  (`SET row_security = off`) dans les RPC monnaie.
- **`chronicles_ledger` = source unique de vérité** : fix du double-crédit
  (le trigger SET le solde), réconciliation globale du ledger.
- `ensure_tcg_player` (RPC) au lieu d'un insert direct.
- **Restriction au Set 01** (Set 02 visible en collection, non jouable/achetable).
- Auth : redirection des déconnectés vers `login.html?next=`.
- `claim_quest` / `buy_pack_with_chronicles` définitifs (plus de 400 silencieux).

## v1.5.0 — Mini-TCG (patch scripts)

*(ancien `README.txt`, conservé pour mémoire)*
- Affichage du **pseudo** partout (hydraté depuis `profiles.username`).
- **CIG** ouverte en pop-up (iframe).
- **Sélecteur de set dynamique** en Collection, pop-up de détail de carte.
- RLS inchangées, aucun CSS de base modifié.
