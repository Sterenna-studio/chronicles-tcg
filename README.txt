Mini-TCG — v5 Scripts Patch (version 1.5.0)

Objectif : afficher le PSEUDO partout + CIG en pop-up (iframe), set selector dynamique en Collection.
Scripts uniquement (aucun asset/HTML écrasé).

FICHIERS
- data/playersRepo.js      → ensurePlayer() hydrate players.username depuis profiles.username
- data/supabaseData.js     → initPlayer(), getDisplayName(), ASSET_VERSION
- ui/cigModal.js           → ouvre la CIG en pop-up (iframe)
- pages/collection/collection.js → set selector dynamique bzh_set01..99, popup détail, sleeve gloss
- pages/cig/cigController.js     → (optionnel) remplit [data-cig-username] dans la CIG
- version.js               → TCG_VERSION = 1.5.0

INTÉGRATION
1) Bouton CIG (index.html etc.) :
   <button class="btn-nav" id="btn-cig" type="button">📇 CIG</button>
   <script type="module">
     import { openCIG } from './ui/cigModal.js';
     document.getElementById('btn-cig')?.addEventListener('click', openCIG);
   </script>

2) CIG (affichage pseudo dédié) :
   Dans /pages/cig/index.html, ajouter un noeud :
     <span data-cig-username></span>
   puis :
     <script type="module" src="../cig/cigController.js?v=1.5.0"></script>

3) Collection :
   Remplacer pages/collection/collection.js par celui du patch.
   Les boutons de sets sont générés auto (bzh_set01..99) via fetch HEAD.

4) Pseudo dans toasts/titres :
   import { getDisplayName } from '/data/supabaseData.js';
   toast.success(`GG ${getDisplayName()} !`);

5) Version :
   <script type="module" src="/version.js"></script> (optionnel — log console uniquement)

Notes : RLS inchangées. Aucun CSS de base modifié.
