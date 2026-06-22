# Chronicles TCG — Règles du jeu (v2, modèle « salve »)

> Statut : **PROPOSITION à valider**. Ce document est la spécification de référence
> pour l'implémentation du moteur (`logic/battleEngine.js` + `logic/aiEngine.js`).
> Les valeurs marquées 🎚️ sont des **paramètres d'équilibrage** ajustables.

---

## 1. Vue d'ensemble

- **Format** : duel 1 contre 1 (joueur vs IA pour l'instant).
- **Modèle** : « salve » — une carte jouée **se résout immédiatement** puis va à la
  défausse. Seules certaines cartes laissent une **présence persistante** (voir §6).
- **Objectif** : réduire les PV de l'adversaire à **0**.

---

## 2. Mise en place

| Élément | Valeur | 🎚️ |
|---|---|---|
| Points de vie (PV) de départ | **30** | oui |
| Taille du deck | **6 cartes** | oui |
| Main de départ | **3 cartes** | oui |
| Énergie de départ (tour 1) | **1** | oui |
| Mulligan (re-pioche unique de la main de départ) | **autorisé** | — |

Contraintes de deck (voir §8) vérifiées par le deck builder.

**Mulligan** : avant le tour 1, chaque joueur peut, **une seule fois**, remettre sa
main dans le deck, mélanger et re-piocher 3 cartes.

---

## 3. Structure d'un tour

Le joueur actif enchaîne :

1. **Début de tour**
   - Énergie = `min(numéro_du_tour, 7)` 🎚️ (plafond **7**, pour rendre toutes les cartes jouables).
   - Réinitialise la **garde** (bouclier temporaire) du joueur actif à 0 (cf §5).
   - Pioche **1** carte. Si le deck est vide → **fatigue** : −2 PV 🎚️ (pas de carte piochée).
   - Applique les effets de **début de tour** des Terrains/Objects en jeu (cf §6).
2. **Phase principale** : jouer autant de cartes que l'énergie le permet, dans n'importe quel ordre.
   - Jouer une carte coûte son `energy`. Impossible si énergie insuffisante.
   - La carte se résout (cf §7) puis va à la défausse (sauf présence persistante).
3. **Fin de tour** : passe la main à l'adversaire. **La garde du joueur actif n'est PAS réinitialisée ici** (correction du bug actuel, cf §5).

L'énergie non dépensée est **perdue** (pas de report) 🎚️.

---

## 4. Anatomie d'une carte

Trois statistiques, déjà présentes dans les données :

- **`power`** (1–14) : dégâts ou montant du buff selon le type.
- **`shield`** (0–7) : bouclier conféré (garde temporaire ou permanent selon le type).
- **`energy`** (1–7) : coût pour jouer la carte.

Plus : `type`, `rarity` (minuscule en base : `common|uncommon|rare|epic|legendary|mythical`), `id`, `name`, `desc`.

---

## 5. Bouclier & dégâts (règle centrale)

Deux sources de réduction de dégâts :

- **Garde** (`shieldTemp`) : bouclier **temporaire**. Gagné à ton tour, il **persiste pendant
  le tour adverse** et n'est réinitialisé qu'au **début de ton tour suivant**.
  → corrige le bug actuel où la garde était effacée avant l'attaque ennemie.
- **Bouclier permanent** : somme des `shield` des cartes persistantes en jeu (Objects + Companions, cf §6).

**Dégâts reçus** = `max(0, dégâts_bruts − (garde + bouclier_permanent))`, sauf mention
« ignore le bouclier » (Event).

Ordre de résolution d'une attaque : calcul des dégâts bruts → soustraction garde+permanent → PV.

---

## 6. Présence persistante (le « champ »)

En modèle salve, la plupart des cartes se défaussent. **Exceptions** qui restent en jeu :

- **Objects** : restent sur le champ, fournissent leur `shield` en bouclier permanent.
- **Champ plein** : le champ (Objects + Companions) contient **max 5** 🎚️ cartes. Si le champ est plein, jouer une nouvelle carte de champ te demande de **défausser une carte du champ de ton choix** pour faire de la place.
- **Companions** : restent en soutien, fournissent leur `shield` en bouclier permanent **tant qu'ils sont en jeu**, en plus de leur buff au moment où ils sont joués (cf §7).
- **Terrain** : **un seul actif à la fois** par joueur. Jouer un nouveau Terrain remplace l'ancien. Effet passif tant qu'il est en jeu (cf §7).

Tout le reste (Champion, Event, Special, Team) se résout puis se défausse.

---

## 7. Effets par type

> `P` = `power`, `S` = `shield` de la carte. « garde » = bouclier temporaire (§5).

### ⚔️ Champion — attaquant principal
- Consomme tous les **buffs Companion** en attente (cf ci-dessous).
- Inflige `P + buffs` dégâts à l'adversaire (réduits par son bouclier).
- Le contrôleur gagne `S` en **garde**.
- Bonus Terrain : si tu contrôles un Terrain, `+1` dégât 🎚️.

### 🐾 Companion — soutien
- **À la pose** : ajoute `+P` à la file de buffs (consommée par le prochain Champion).
- **Tant qu'il reste en jeu** : contribue `S` au bouclier permanent.
- Reste sur le champ (zone de soutien, partagée avec Objects, max 5 🎚️).

### ⚡ Event — sort instantané
- Inflige `P` **dégâts directs** qui **ignorent tout bouclier**.
- Puis **pioche 1** carte.
- Se défausse.

### 🛡️ Object — équipement permanent
- Reste en jeu, ajoute `S` au bouclier permanent (max 5 cartes de champ 🎚️).
- `power` ignoré.

### 🌍 Terrain — zone persistante
- Un seul actif (remplace le précédent).
- Tant qu'il est en jeu : tes Champions infligent `+1` (déjà compté ci-dessus) **et** tu gagnes `+1` garde au **début de ton tour** 🎚️.
- À la pose : inflige `round(P/2)` dégâts (petit impact immédiat) 🎚️.

### ✨ Special — joker
- Inflige `P` dégâts **+** confère `S` garde. Effet volontairement **simple** : un couteau-suisse offense/défense, sans clause spéciale.

### 👥 Team — frappe lourde
- Inflige `P` dégâts, **non modifiables par les buffs Companion**.
- Bonus : `+round(P/2)` 🎚️ si tu contrôles un Terrain (synergie « armée déployée »).
- Cartes chères (Epic+), rôle de finisher.

---

## 8. Construction de deck

| Règle | Valeur | 🎚️ |
|---|---|---|
| Taille | exactement 6 | oui |
| Champions | 1 à 2, **1 exemplaire max par Champion** | oui |
| Légendaires | **max 1** (rareté `legendary`) | oui |
| Mythiques | **max 1** (rareté `mythical`) | oui |
| Autres cartes | doublons libres (limités par ta collection) | — |

---

## 9. Repères d'équilibrage (bandes de stats par rareté)

Source : `generate_stats.py` (rappel, avant modificateurs de type) :

| Rareté | power | shield | energy |
|---|---|---|---|
| common | 2–4 | 1–3 | 1–2 |
| rare | 4–6 | 2–4 | 2–3 |
| epic | 6–8 | 3–5 | 3–4 |
| legendary | 8–10 | 4–6 | 4–5 |
| mythical | 10–13 | 5–8 | 5–6 |

Modificateurs de type appliqués ensuite (Champion P+1/E+1, Team P+2/S+1/E+2, etc.).

---

## 10. Fin de partie & récompenses

- Victoire dès que les PV adverses ≤ 0. Si les deux tombent à 0 le même tour → **match nul**.
- Or (chronicles) crédité sur `profiles.chronicles` (déjà en place dans `battle.js`),
  barème selon difficulté + bonus de rapidité.

---

## 11. Différences vs moteur actuel (notes d'implémentation)

| # | Changement | Fichier |
|---|---|---|
| 1 | **Garde non réinitialisée en fin de tour** (seulement au début du tour suivant) | `battleEngine.endPlayerTurn` |
| 2 | Plafond d'énergie **6 → 7** | `createBattle` / `endPlayerTurn` |
| 3 | PV **20 → 30** | `createBattle` |
| 4 | **Fatigue** quand le deck est vide (−2 PV/pioche ratée) | `drawCards` |
| 5 | **Companions persistants** (bouclier permanent + buff) | `applyCardEffect` / état `field` |
| 6 | **Terrain persistant** (1 actif, effet de début de tour) au lieu d'un effet ponctuel | `applyCardEffect` + début de tour |
| 7 | Bonus Champion/Team conditionnés au contrôle d'un Terrain | `applyCardEffect` |
| 8 | IA mise à jour pour évaluer correctement la garde persistante | `aiEngine` |

---

## 12. Décisions prises (2026-06-22)

1. **Champ plein** → on peut **défausser une carte du champ de son choix** pour faire de la place (§6).
2. **Deck** → Champions : 1 exemplaire max chacun ; **max 1 légendaire** ; **max 1 mythique** ; autres cartes : doublons libres (§8).
3. **Double KO** → **match nul** (§10).
4. **Special** → effet **simple** (P dégâts + S garde), sans clause Terrain (§7).
5. **Mulligan** → **autorisé**, une fois (§2).
6. **Mythiques** → plafonnées à **1 par deck** (§8).

✅ Tous les points sont tranchés — le spec est prêt pour l'implémentation (§11).
