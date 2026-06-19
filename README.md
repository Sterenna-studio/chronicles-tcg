# BZH TCG — v1 (Programs Only) — bzh_setXX enforced

Build locale **sans datasets/images**, mais totalement fonctionnelle avec tes fichiers.
Toutes les lectures de sets utilisent **strictement** `/data/bzh_setNN.json` (ex: `bzh_set01.json`).

## Fournir
- `/data/bzh_setNN.json` (ex: `bzh_set01.json`)
- `/artworks/<card_id>.jpg`
- `/assets/packs/<image_name>`
- `/assets/card_back.png`
- (optionnel) `/sounds/common.mp3, rare.mp3, epic.mp3, legendary.mp3, mythical.mp3`
- (optionnel) `/data/pack_types.local.json` **ou** `localStorage.tcg_pack_types`

## Anti-cache
- `fetch(..., { cache: 'no-store' })` + `?v=Date.now()` pour JSON et images.

## Lancer
1) `python -m http.server 8000`
2) `http://localhost:8000/index.html`


## Boutique (nouveau)
- Page: `/pages/shop/index.html`
- Fonctionnement: affiche les packs (pack_types), ton or (gold), et permet d'**acheter** un pack si assez d'or.
- Achat = décrémente `players.gold` et **incrémente** `player_packs.quantity` pour le `pack_type_id` choisi.
- Le bouton est **désactivé** si gold < price.

