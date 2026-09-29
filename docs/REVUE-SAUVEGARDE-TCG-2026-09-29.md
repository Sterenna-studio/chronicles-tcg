# Revue de la sauvegarde serveur TCG — 29 septembre 2026

## Conclusion

Ne pas remplacer le jeu actuel par cette sauvegarde : les 233 fichiers mélangent
plusieurs générations de Chronicles TCG et du code Pokeforge. 181 correspondent
exactement au dépôt actuel, 27 existent dans son historique Git local, 4 dans
celui de Pokeforge et le README correspond au README Pokeforge actuel.
Les 20 fichiers restants ont été examinés ci-dessous.

Aucun changement fonctionnel, appel à la base distante ou import de configuration.
Les originaux ont été déplacés dans
`local-private/tcg-from-ghs-2026-09-29/` le 29 septembre 2026 : 233 fichiers
vérifiés par SHA-256, aucun contenu perdu. Le manifeste est dans
`docs/ARCHIVE-TCG-2026-09-29.json`. Ce dossier est ignoré par Git et exclu du
déploiement ; la copie complète est locale, pas sauvegardée sur GitHub.

## Les 20 fichiers non retrouvés exactement

| Fichiers | Constat et décision |
| --- | --- |
| `index.html`, `app/router.js` | Ancien shell et routes home/shop/packs. Le routeur actuel gère hub, collection, escouades, combat et tutoriel. Ne pas rétrograder. |
| `app/ui-shell.js`, `app/version.js` | Navigation et étiquette v4.0.0 liées aux anciennes routes. Le fichier version force aussi le titre du document. Référence historique. |
| `app/ui-settings.js` | Modal volume/quantité de boosters persistée dans `lab.settings`. Aucun branchement audio dans ce module : idée à réimplémenter, pas une fonctionnalité complète à copier. |
| `data/achievementsRepo.js` | Ancienne évaluation basée sur `gold`. Le dépôt actuel lit `profiles.chronicles`. Garder le code actuel. |
| `data/cardsRepo.js` | Ancien `saveCards` séquentiel, erreurs d’écriture non propagées. L’API actuelle expose `addCardsBatch`, regroupe quantités et métadonnées. Non interchangeable. |
| `data/dailyRepo.js` | Calcule le délai et écrit `gold` côté navigateur. Le code actuel `logic/daily.js` appelle `claim_daily_login` et le ledger. Ne pas réintroduire cette ancienne gestion de monnaie. |
| `data/packsRepo.js` | Ancien inventaire et décrémentation par lecture puis écriture, sans refus explicite de solde insuffisant. Référence uniquement. |
| `data/playersRepo.js`, `data/supabaseData.js` | Ancienne monnaie dans `tcg_players`, initialisation avec fallback direct si RPC indisponible. Le code actuel utilise notamment `profiles.chronicles`. Pas d’import automatique. |
| `logic/supaRaw.js`, `shared/supabaseClient.js` | Pont vers `/shared/…` de Nitro. Idée utile pour mutualiser la session, mais dépend de fichiers externes au lot et d’un contrat d’authentification différent. Une migration dédiée doit valider connexion/déconnexion et dépendances. |
| `pages/homePage.js`, `app/views/home.js`, `app/views/shop.js` | Variantes d’accueil/boutique, probabilités et infobulles. Références visuelles possibles ; dépendent de l’ancien routeur et des anciennes données. |
| `shared/packsRepo.js` | `openOnePack` génère et sauvegarde les cartes mais n’appelle jamais `decrementPlayerPack` malgré son import. Ce chemin ne prouve pas la consommation d’un booster. Ne pas réactiver. |
| `app/collection/collection.js` | Placeholder important `getCollection`, absent des exports de `shared/packsRepo.js` dans ce lot. Non fonctionnel tel quel. |
| `app/views/collection.js` | Ancienne vue à sets fixes et retour manuel au hub. La version actuelle centralise les sets, distingue les sets jouables et utilise le routeur. Garder la version actuelle. |
| `pages/admin/index.html` | Ancien tableau d’administration avec écritures/suppressions directes et modification de monnaie. Le dépôt actuel possède un module admin et des RPC dédiées. Pas de substitution ; droits effectifs en base non audités ici. |

## Pollution Pokeforge confirmée

`app.js`, `config.js`, `add_secret_code.py` et `VERIFICATION.txt` sont retrouvés
dans l’historique Pokeforge ; `README.md` correspond au fichier actuel
`repos/pokeforge/game/README.md`. Les 13 imports relatifs de cet `app.js` pointent
vers des fichiers absents du lot TCG. Ne pas les intégrer dans le moteur TCG.

## Références utiles à conserver

- Variantes visuelles accueil/boutique.
- Idée d’un panneau de préférences, à raccorder au véritable moteur audio.
- Pont d’authentification Nitro, comme point de départ d’une revue distincte.

Aucun correctif autonome identifié à transplanter directement. Conserver la
sauvegarde originale ; ne pas publier son `config.js`. Revue statique et
comparative : aucun test de connexion, transaction ou politique RLS distante.
Manifeste initial : `C:/DEV/docs/AUDIT-FROM-GHS-2026-09-28.json`.
