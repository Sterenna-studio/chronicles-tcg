# POKEFORGE — Gang Wars v6

## Fichiers

- `index.html` — Interface de jeu (page unique, 5 onglets)
- `app.js`     — Logique complète (state, zones, combat, agents, marche, pokedex)

### Demarrage
```bash
npm run dev   # serve game/ sur localhost:8080
```
Ouvrir `http://localhost:8080/` directement.

### Fonctionnalites

- **Gang** : Boss + agents recrutables, assignation aux zones, progression (Grunt > Lieutenant > Captain)
- **Zones** : 11 environnements Gen1, fonds Showdown, spawns en temps reel (pokemon, dresseurs, coffres, evenements)
- **Investissement** : Debloquer elites et events en investissant des agents dans une zone
- **Capture** : Animation ball throw + burst d'effets selon potentiel/shiny, SFX Web Audio
- **Combat** : Popup avec HP bars, dialogues, calcul de puissance, XP et reputation
- **Marche** : Achat/vente avec tri (prix, nom, niveau, potentiel), items boost (Encens, Rarioscope, Aura Shiny)
- **PC** : Grille de pokemon avec filtres, tri, detail panel
- **Pokedex** : 151 Gen1, sprites Showdown, suivi caught/seen/shiny
- **Coffres** : Loot random (balls, argent, pokemon rare 3*+, items, declenchement d'events)
- **Events** : Invasion Rocket, Nuee Shiny, Migration Rare, Pluie de Tresors, Defi Elite
- **Agents auto** : Capture et combat automatiques, XP, promotions

### Notes
- Save unique dans localStorage : `pokeforge.v6`
- LLM optionnel (Ollama / OpenAI / Anthropic) configurable dans Settings
- Compatible Chromium / Firefox — pas de backend requis
- Sprites : Pokemon Showdown (gen5, trainers, itemicons, backgrounds)
