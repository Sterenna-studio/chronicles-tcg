// ============================================================
// POKEFORGE v6 — Gang Wars  (vanilla JS, single-file engine)
// ============================================================

'use strict';

import { POKEDEX_DESC } from './data/pokedex-desc.js';
import { ZONE_BGS, COSMETIC_BGS } from './data/zones-visuals-data.js';
import { MISSIONS, HOURLY_QUEST_POOL } from './data/missions-data.js';
import { TRAINER_TYPES } from './data/trainers-data.js';
import { getDexDesc, buildSpeciesNameMaps } from './data/dex-helpers.js';
import { BALLS, SHOP_ITEMS, MYSTERY_EGG_BASE_COST, MYSTERY_EGG_POOL, MYSTERY_EGG_HATCH_MS, POTENTIAL_MULT, BASE_PRICE, getMysteryEggCost as computeMysteryEggCost } from './data/economy-data.js';
import { NATURES, NATURE_KEYS, BOSS_SPRITES, AGENT_NAMES_M, AGENT_NAMES_F, AGENT_SPRITES, AGENT_PERSONALITIES, TITLE_REQUIREMENTS, TITLE_BONUSES } from './data/game-config-data.js';
import { I18N } from './data/i18n-data.js';
import { ZONE_BG_URL, GYM_ORDER } from './data/zones-config-data.js';
import { HOURLY_QUEST_REROLL_COST, BOOST_DURATIONS } from './data/gameplay-config-data.js';
import { SPECIAL_TRAINER_KEYS, MAX_COMBAT_REWARD } from './data/combat-config-data.js';
import { FALLBACK_TRAINER_SVG, FALLBACK_POKEMON_SVG, BALL_SPRITES, ITEM_SPRITE_URLS, CHEST_SPRITE_URL } from './data/assets-data.js';
import { TRANSLATOR_PHRASES_FR } from './data/flavor-data.js';

// ════════════════════════════════════════════════════════════════
//  1.  CONFIG & CONSTANTS
// ════════════════════════════════════════════════════════════════

// → Moved to data/species-data.js

// ── Secret codes ───────────────────────────────────────────
// Helper : génère la fonction exec pour un code qui débloque un titre
// (TITLES et state sont accédés au moment de l'appel, pas de la définition)
const _mkTitleExec = (titleId) => (claim) => {
  if (!state.unlockedTitles) state.unlockedTitles = [];
  if (state.unlockedTitles.includes(titleId)) {
    notify('Ce titre est déjà débloqué !', 'error'); return;
  }
  const t = TITLES.find(x => x.id === titleId);
  state.unlockedTitles.push(titleId);
  // Sync avec purchases (pour les titres achetables en boutique)
  state.purchases = state.purchases || {};
  state.purchases[`title_${titleId}`] = true;
  claim(); saveState();
  notify(`🏆 Titre débloqué : "${t?.label || titleId}" !`, 'gold');
  if (typeof renderGangTab    === 'function' && activeTab === 'tabGang')      renderGangTab();
  if (typeof renderCosmeticsTab === 'function' && activeTab === 'tabCosmetics') renderCosmeticsTab();
};

const SECRET_CODES = {
  'MERCIDAVOIRJOUEMONJEU': {
    key: 'code_missingno',
    cooldownMs: 60 * 60 * 1000,
    label: '👾 MissingNo',
    exec: (claim) => {
      const existing = state.pokemons.find(p => p.species_en === 'missingno');
      if (existing) { notify('Tu possèdes déjà MissingNo !', 'error'); return; }
      const p = makePokemon('missingno', 'secret', 'pokeball');
      p.potential = 5; p.level = 1; p.shiny = Math.random() < 0.5; p.noSell = true;
      state.pokemons.push(p);
      if (!state.pokedex['missingno']) state.pokedex['missingno'] = {};
      state.pokedex['missingno'].caught = true; state.pokedex['missingno'].count = 1;
      claim();
      saveState();
      notify('👾 MissingNo a rejoint ton PC ! Le tissu du jeu tremble…', 'gold');
      _pcLastRenderKey = ''; renderPokemonGrid(true);
    }
  },
  'POKEGANGSTARTER': {
    key: 'code_starter',
    oneTime: true,
    label: '🌟 Starter surprise',
    exec: (claim) => {
      const starters = ['bulbasaur','charmander','squirtle'];
      const choices = starters.map(sp => {
        const shiny = Math.random() < 0.5;
        const spDef = POKEMON_GEN1.find(s => s.en === sp);
        return {
          emoji: `<img src="${pokeSprite(sp, shiny)}" style="width:56px;height:56px;image-rendering:pixelated${shiny ? ';filter:drop-shadow(0 0 6px gold)' : ''}">`,
          label: (shiny ? '✨ ' : '') + (spDef?.fr || sp),
          sublabel: 'Lv.1',
          onPick: () => {
            const p = makePokemon(sp, 'reward', 'pokeball');
            p.level = 1; p.shiny = shiny; p.potential = Math.random() < 0.2 ? 2 : 1;
            state.pokemons.push(p);
            claim(); saveState();
            notify(`🎁 ${spDef?.fr || sp}${shiny ? ' ✨' : ''} a rejoint ton PC !`, 'gold');
            _pcLastRenderKey = ''; renderPokemonGrid(true);
          }
        };
      });
      showRewardChoicePopup('🎁 Choisis ton Starter !', 'Une seule chance — choisit bien.', choices);
    }
  },
  'POKEGANGBALLS': {
    key: 'code_balls',
    cooldownMs: 24 * 60 * 60 * 1000,
    label: '🎯 Pack de Balls',
    exec: (claim) => {
      const packs = [
        { emoji: '🔴', label: '6× Poké Ball', sublabel: 'Bon départ', items: {pokeball:6} },
        { emoji: '🔵', label: '3× Super Ball', sublabel: 'Efficacité +', items: {greatball:3} },
        { emoji: '🟡', label: '1× Hyper Ball', sublabel: 'Pour les rares', items: {ultraball:1} },
      ];
      const choices = packs.map(pack => ({
        emoji: pack.emoji,
        label: pack.label,
        sublabel: pack.sublabel,
        onPick: () => {
          for (const [k, v] of Object.entries(pack.items)) state.inventory[k] = (state.inventory[k] || 0) + v;
          claim(); saveState(); updateTopBar();
          notify(`🎁 ${pack.label} ajouté à ton inventaire !`, 'success');
        }
      }));
      showRewardChoicePopup('🎯 Choisis ton pack de Balls !', 'Recharger dans 24h.', choices);
    }
  },
  'POKEGANGPIKACHU': {
    key: 'code_pikachu',
    oneTime: true,
    label: '⚡ Pikachu spécial',
    exec: (claim) => {
      const shiny = Math.random() < 0.5;
      const choices = [
        { sp:'pikachu', bonus: 'ATK ×2', atk: 2 },
        { sp:'pikachu', bonus: 'VIT ×2', spd: 2 },
        { sp:'pikachu', bonus: 'Potentiel ★★★', pot: 3 },
      ].map(opt => ({
        emoji: `<img src="${pokeSprite(opt.sp, shiny)}" style="width:56px;height:56px;image-rendering:pixelated${shiny ? ';filter:drop-shadow(0 0 6px gold)' : ''}">`,
        label: (shiny ? '✨ ' : '') + 'Pikachu',
        sublabel: opt.bonus,
        onPick: () => {
          const p = makePokemon('pikachu', 'reward', 'pokeball');
          p.level = 1; p.shiny = shiny;
          if (opt.atk) p.atk = Math.round((p.atk || 10) * opt.atk);
          if (opt.spd) p.spd = Math.round((p.spd || 10) * opt.spd);
          if (opt.pot) p.potential = opt.pot;
          state.pokemons.push(p);
          claim(); saveState();
          notify(`⚡ Pikachu${shiny ? ' ✨' : ''} — ${opt.bonus} — a rejoint ton PC !`, 'gold');
          _pcLastRenderKey = ''; renderPokemonGrid(true);
        }
      }));
      showRewardChoicePopup('⚡ Choisis ton Pikachu !', 'Chaque version est unique.', choices);
    }
  },

  // ── Codes titres (oneTime, distribués manuellement) ────────────────────────
  'R4PK2W7':  { key:'ct_apprenti',       oneTime:true, label:'🏆 Titre',  exec: _mkTitleExec('apprenti') },
  'B9XM3C6':  { key:'ct_chasseur',       oneTime:true, label:'🏆 Titre',  exec: _mkTitleExec('chasseur') },
  'T7GA5N2':  { key:'ct_agent',          oneTime:true, label:'🏆 Titre',  exec: _mkTitleExec('agent') },
  'Z3CP8K1':  { key:'ct_capo',           oneTime:true, label:'🏆 Titre',  exec: _mkTitleExec('capo') },
  'W6LT4M9':  { key:'ct_lieutenant',     oneTime:true, label:'🏆 Titre',  exec: _mkTitleExec('lieutenant') },
  'Q2BA7D5':  { key:'ct_boss_adj',       oneTime:true, label:'🏆 Titre',  exec: _mkTitleExec('boss_adj') },
  'K8BO3S4':  { key:'ct_boss',           oneTime:true, label:'🏆 Titre',  exec: _mkTitleExec('boss') },
  'Y5BR9N6':  { key:'ct_baron',          oneTime:true, label:'🏆 Titre',  exec: _mkTitleExec('baron') },
  'V1PR4N8':  { key:'ct_parrain',        oneTime:true, label:'🏆 Titre',  exec: _mkTitleExec('parrain') },
  'J9LD6G3':  { key:'ct_legende',        oneTime:true, label:'🏆 Titre',  exec: _mkTitleExec('legende') },
  'X4IT7C2':  { key:'ct_intouchable',    oneTime:true, label:'🏆 Titre',  exec: _mkTitleExec('intouchable') },
  'S6PY2M8':  { key:'ct_pyromane',       oneTime:true, label:'🏆 Titre',  exec: _mkTitleExec('pyromane') },
  'BF3SU7R5': { key:'ct_surfeur',        oneTime:true, label:'🏆 Titre',  exec: _mkTitleExec('surfeur') },
  'CW9BT4S1': { key:'ct_botaniste',      oneTime:true, label:'🏆 Titre',  exec: _mkTitleExec('botaniste') },
  'DQ7EL3C6': { key:'ct_electricien',    oneTime:true, label:'🏆 Titre',  exec: _mkTitleExec('electricien') },
  'HN4PS8Y2': { key:'ct_psy',            oneTime:true, label:'🏆 Titre',  exec: _mkTitleExec('psy') },
  'MK2SP6T9': { key:'ct_spectre',        oneTime:true, label:'🏆 Titre',  exec: _mkTitleExec('spectre') },
  'RJ5DL1N7': { key:'ct_dragon_lord',    oneTime:true, label:'🏆 Titre',  exec: _mkTitleExec('dragon_lord') },
  'AZ8VN3M4': { key:'ct_venimeux',       oneTime:true, label:'🏆 Titre',  exec: _mkTitleExec('venimeux') },
  'PF6CB9T3': { key:'ct_combattant',     oneTime:true, label:'🏆 Titre',  exec: _mkTitleExec('combattant') },
  'GT4CL7R2': { key:'ct_collectionneur', oneTime:true, label:'🏆 Titre',  exec: _mkTitleExec('collectionneur') },
  'XB1GV5D8': { key:'ct_grand_vendeur',  oneTime:true, label:'🏆 Titre',  exec: _mkTitleExec('grand_vendeur') },
  'WC9GU3R6': { key:'ct_guerrier',       oneTime:true, label:'🏆 Titre',  exec: _mkTitleExec('guerrier') },
  'QM7CS4Y5': { key:'ct_chasseur_shiny', oneTime:true, label:'🏆 Titre',  exec: _mkTitleExec('chasseur_shiny') },
  'ZH3RI8S2': { key:'ct_richissime',     oneTime:true, label:'🏆 Titre',  exec: _mkTitleExec('richissime') },
  'NK6GL9T4': { key:'ct_glitcheur',      oneTime:true, label:'🏆 Titre',  exec: _mkTitleExec('glitcheur') },
  'VD2PR5F8': { key:'ct_professeur',     oneTime:true, label:'🏆 Titre',  exec: _mkTitleExec('professeur') },
  'LR8MD3S1': { key:'ct_maitre_dresseur',oneTime:true, label:'🏆 Titre',  exec: _mkTitleExec('maitre_dresseur') },
  'FJ4TC7R6': { key:'ct_triade_chroma',  oneTime:true, label:'🏆 Titre',  exec: _mkTitleExec('triade_chroma') },
  'BW5SH2G9': { key:'ct_seigneur_chroma',oneTime:true, label:'🏆 Titre',  exec: _mkTitleExec('seigneur_chroma') },
  'YK3DC8R5': { key:'ct_dresseur_chroma',    oneTime:true, label:'🏆 Titre',  exec: _mkTitleExec('dresseur_chroma') },

  // ── Titres exclusifs ────────────────────────────────���───────────────────────
  'EP1C5AR7Y2': { key:'ct_early_backer',      oneTime:true, label:'🏆 Titre',  exec: _mkTitleExec('early_backer') },
  'MC9X4Z2W7K': { key:'ct_maitre_chronicles', oneTime:true, label:'🏆 Titre',  exec: _mkTitleExec('maitre_chronicles') },
};

function checkSecretCode(input) {
  const code = input.trim().toUpperCase();
  const def = SECRET_CODES[code];
  if (!def) return false;

  const now = Date.now();
  const lastUsed = state.claimedCodes?.[def.key];

  if (def.cooldownMs) {
    if (lastUsed && now - lastUsed < def.cooldownMs) {
      const remaining = Math.ceil((def.cooldownMs - (now - lastUsed)) / 60000);
      notify(`Code en recharge — ${remaining} min restante${remaining > 1 ? 's' : ''}.`, 'error');
      return true;
    }
  } else if (def.oneTime && lastUsed) {
    notify('Ce code a déjà été utilisé.', 'error');
    return true;
  }

  def.exec(() => {
    state.claimedCodes = state.claimedCodes || {};
    state.claimedCodes[def.key] = def.cooldownMs ? now : true;
  });
  return true;
}

// ── Reward choice popup ─────────────────────────────────────
// choices = array of { label, sublabel, emoji, onPick: () => void }
function showRewardChoicePopup(title, subtitle, choices) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9800;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;padding:16px';

  const cardsHtml = choices.map((c, i) => `
    <div class="reward-choice-card" data-choice="${i}" style="cursor:pointer;background:var(--bg-panel);border:2px solid var(--border);border-radius:var(--radius);padding:16px 12px;display:flex;flex-direction:column;align-items:center;gap:8px;min-width:120px;max-width:160px;flex:1;transition:border-color .15s,transform .15s">
      <div style="font-size:40px;line-height:1">${c.emoji}</div>
      <div style="font-family:var(--font-pixel);font-size:9px;color:var(--text);text-align:center;line-height:1.4">${c.label}</div>
      ${c.sublabel ? `<div style="font-size:9px;color:var(--text-dim);text-align:center">${c.sublabel}</div>` : ''}
      <button style="margin-top:4px;font-family:var(--font-pixel);font-size:8px;padding:6px 12px;background:var(--red-dark);border:1px solid var(--red);border-radius:var(--radius-sm);color:var(--text);cursor:pointer">Choisir</button>
    </div>`).join('');

  overlay.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--gold);border-radius:var(--radius);padding:24px;max-width:560px;width:100%;display:flex;flex-direction:column;gap:16px">
      <div style="font-family:var(--font-pixel);font-size:12px;color:var(--gold);text-align:center">${title}</div>
      ${subtitle ? `<div style="font-size:10px;color:var(--text-dim);text-align:center">${subtitle}</div>` : ''}
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">${cardsHtml}</div>
    </div>`;

  document.body.appendChild(overlay);

  overlay.querySelectorAll('.reward-choice-card').forEach(card => {
    card.addEventListener('mouseenter', () => { card.style.borderColor = 'var(--gold)'; card.style.transform = 'translateY(-3px)'; });
    card.addEventListener('mouseleave', () => { card.style.borderColor = 'var(--border)'; card.style.transform = ''; });
    card.addEventListener('click', () => {
      const idx = parseInt(card.dataset.choice);
      overlay.remove();
      choices[idx].onPick();
    });
  });
}

// Pokédex descriptions moved to data/pokedex-desc.js

// Dex helper logic moved to data/dex-helpers.js

// FR→EN / EN→FR name maps moved to data/dex-helpers.js
const { FR_TO_EN, EN_TO_FR } = buildSpeciesNameMaps(POKEMON_GEN1);

// Nature config moved to data/game-config-data.js

// Zone visuals/config moved to data/zones-visuals-data.js and data/zones-config-data.js

// Gym unlock order moved to data/zones-config-data.js

// → Moved to data/zones-data.js
// Applique le mapping aux objets de zone
Object.entries(ZONE_MUSIC_MAP).forEach(([id, track]) => {
  if (ZONE_BY_ID[id]) ZONE_BY_ID[id].music = track;
});

// Mission data moved to data/missions-data.js
// Hourly quest reroll cost moved to data/gameplay-config-data.js

// Trainer/combat config moved to data/trainers-data.js and data/combat-config-data.js

// Economy/shop config moved to data/economy-data.js
function getMysteryEggCost() {
  return computeMysteryEggCost(state);
}

// Game config moved to data/game-config-data.js

// I18N dictionary moved to data/i18n-data.js

function t(key, vars = {}) {
  const entry = I18N[key];
  if (!entry) return key;
  let str = entry[state.lang] || entry.fr || key;
  for (const [k, v] of Object.entries(vars)) {
    str = str.replace(`{${k}}`, v);
  }
  return str;
}

// ════════════════════════════════════════════════════════════════
//  2.  STATE MANAGEMENT
// ════════════════════════════════════════════════════════════════

// ── App version — bump on every deploy to force client reload ──
const APP_VERSION = '2.2.0';
const GAME_VERSION = 'v0.0 — pre-alpha';

const SAVE_KEYS = ['pokeforge.v6', 'pokeforge.v6.s2', 'pokeforge.v6.s3'];
let activeSaveSlot = Math.min(2, parseInt(localStorage.getItem('pokeforge.activeSlot') || '0'));
let SAVE_KEY = SAVE_KEYS[activeSaveSlot];

// ── Versionnage du schéma de save ────────────────────────────────────────────
// Incrémenter à chaque ajout de champ majeur pour déclencher le banner migration.
const SAVE_SCHEMA_VERSION = 7;

// Anciennes clés localStorage (versions antérieures à v6)
const LEGACY_SAVE_KEYS = ['pokeforge.v5', 'pokeforge.v4', 'pokeforge.v3', 'pokeforge.v2', 'pokeforge.v1', 'pokeforge'];

// Résultat de migration exposé au boot pour afficher le banner
let _migrationResult = null; // null | { from: string, fields: string[] }

const DEFAULT_STATE = {
  version: '6.0.0',
  _schemaVersion: SAVE_SCHEMA_VERSION,
  lang: 'fr',
  gang: {
    name: 'Team ???',
    bossName: 'Boss',
    bossSprite: '',
    bossZone: null, // the zone the boss is currently in
    bossTeam: [], // array of up to 3 pokemon IDs for boss combat
    showcase: [null, null, null],
    reputation: 0,
    money: 5000,
    initialized: false,
    titleA: 'recrue',
    titleB: null,
    titleLiaison: '',
    titleC: null,
    titleD: null,
  },
  inventory: {
    pokeball: 50,
    greatball: 0,
    ultraball: 0,
    duskball: 0,
    lure: 0,
    superlure: 0,
    potion: 0,
    incense: 2,
    rarescope: 1,
    aura: 0,
    evostone: 0,
    rarecandy: 0,
    masterball: 0,
    incubator: 0,
    egg_scanner: 0,
  },
  activeBall: 'pokeball',
  activeBoosts: {
    incense:   0, // timestamp when expires (0 = inactive)
    rarescope: 0,
    aura:      0,
    lure:      0,
    superlure: 0,
    chestBoost:0,
  },
  pokemons: [],
  agents: [],
  zones: {},
  pokedex: {},
  activeEvents: {}, // zoneId -> { eventId, expiresAt, data }
  missions: {
    completed: [],
    daily:  { reset: 0, progress: {}, claimed: [] },
    weekly: { reset: 0, progress: {}, claimed: [] },
    hourly: { reset: 0, slots: [], baseline: {}, claimed: [] },
  },
  stats: {
    totalCaught: 0,
    totalSold: 0,
    totalFights: 0,
    totalFightsWon: 0,
    totalMoneyEarned: 0,
    totalMoneySpent: 0,
    shinyCaught: 0,
    rocketDefeated: 0,
    chestsOpened: 0,
    eventsCompleted: 0,
    eggsHatched: 0,
    blueDefeated: 0,
  },
  settings: {
    llmEnabled: false,
    llmProvider: 'none',
    llmUrl: 'http://localhost:11434',
    llmModel: 'llama3',
    llmApiKey: '',
    sfxEnabled: true,
    musicVol: 50,
    uiScale: 100,
    musicEnabled: false,
    sfxVol: 80,
    zoneScale: 100,
    lightTheme: false,
    lowSpec: false,
    sfxIndividual: {},
    autoCombat: true,
    discoveryMode: true,
    autoBuyBall: null,  // null | 'pokeball' | 'greatball' | 'ultraball'
    classicSprites: false, // true = Showdown Gen 5 animés, false = sprites JSON (FireRed/LeafGreen)
  },
  log: [],
  marketSales: {}, // { [species_en]: { count, lastSale } } — supply/demand
  favorites: [],   // array of pokemon IDs marked as favorite
  trainingRoom: {
    pokemon: [],      // up to 6 pokemon IDs training here
    log: [],          // recent training events
    level: 1,         // room upgrade level
    lastFight: null,  // timestamp du dernier combat d'entraînement
  },
  _savedAt: 0,       // timestamp de la dernière sauvegarde
  cosmetics: {
    gameBg: null,       // CSS gradient/color for game background
    bossBg: null,       // CSS for boss panel background
    unlockedBgs: [],    // IDs of unlocked cosmetic backgrounds
  },
  lab: {
    trackedSpecies: [], // espèces suivies dans le tracker du labo
  },
  purchases: {
    translator: false,
    cosmeticsPanel: false, // 50 000₽ — débloque l'onglet Cosmétiques
    autoIncubator: false,  // 50 000₽ — Infirmière Joëlle corrompue (auto-incubation)
    chromaCharm: false,    // Gagné à 10 000 000₽ — taux shiny ×2
  },
  pension: {
    slotA: null,    // pokemon ID
    slotB: null,    // pokemon ID
    eggAt: null,    // timestamp when next egg generates
  },
  eggs: [],         // [{ id, species_en, hatchAt, potential, shiny }]
  playtime: 0,      // secondes de jeu total
  sessionStart: 0,  // timestamp début session
  openZoneOrder: [],
  favoriteZones: [], // zones ouvertes automatiquement au chargement
  claimedCodes: {},
  discoveryProgress: {
    marketUnlocked: false,
    pokedexUnlocked: false,
    missionsUnlocked: false,
    agentsUnlocked: false,
    battleLogUnlocked: false,
    cosmeticsUnlocked: false,
  },
  behaviourLogs: {
    firstCombatAt: 0,
    firstCaptureAt: 0,
    firstPurchaseAt: 0,
    firstAgentAt: 0,
    firstMissionAt: 0,
    tabViewCounts: {},
  },
};

let state = structuredClone(DEFAULT_STATE);

let _supaLastSaveAt = 0;
const SUPA_SAVE_THROTTLE_MS = 30_000; // max 1 cloud save / 30s

const MAX_HISTORY = 30; // cap des entrées d'historique par Pokémon (anti-QuotaExceeded)

// ── Sérialisation slim des pokémons ──────────────────────────────────────────
// On ne touche PAS les objets en mémoire : on crée un clone allégé pour la save.
// Champs supprimés : dérivables au runtime (species_fr, dex) + valeurs par défaut
// (assignedTo=null, cooldown=0, homesick=false, favorite=false, xp=0).
// Gain moyen : ~35% sur la section pokemons soit ~20-25% sur la save totale.
function slimPokemon(p) {
  const s = { ...p };
  // Dérivable depuis species_en via SPECIES_BY_EN
  delete s.species_fr;
  delete s.dex;
  // Valeurs par défaut — omises pour gagner de la place
  if (s.assignedTo === null)  delete s.assignedTo;
  if (s.cooldown   === 0)     delete s.cooldown;
  if (s.homesick   === false) delete s.homesick;
  if (s.favorite   === false) delete s.favorite;
  if (s.xp         === 0)     delete s.xp;
  // History : cap + suppression si vide
  if (s.history && s.history.length > MAX_HISTORY) s.history = s.history.slice(-MAX_HISTORY);
  if (!s.history || s.history.length === 0) delete s.history;
  return s;
}

function saveState() {
  if (!state.marketSales) state.marketSales = {}; // guard: toujours initialisé

  // Playtime accumulation
  if (state.sessionStart) {
    state.playtime = (state.playtime || 0) + Math.floor((Date.now() - state.sessionStart) / 1000);
    state.sessionStart = Date.now();
  }

  state._savedAt = Date.now();

  // Sérialisation slim : les objets en mémoire restent intacts
  const payload = { ...state, pokemons: state.pokemons.map(slimPokemon) };
  const data = JSON.stringify(payload);

  try {
    localStorage.setItem(SAVE_KEY, data);
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      notify('⚠ Save trop volumineuse — historiques supprimés', 'error');
      // Fallback : retirer tous les historiques
      const emergency = JSON.parse(data);
      for (const p of emergency.pokemons) delete p.history;
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(emergency)); } catch {}
    }
  }
  // Cloud sync : throttlé, non-bloquant
  if (_supabase && supaSession) {
    const now = Date.now();
    if (now - _supaLastSaveAt >= SUPA_SAVE_THROTTLE_MS) {
      _supaLastSaveAt = now;
      supaCloudSave();
    }
  }
}

function formatPlaytime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m}min`;
}

function loadState() {
  let raw = localStorage.getItem(SAVE_KEY);
  let legacyKey = null;

  // ── Détection save legacy (clés anciennes) ────────────────────────────────
  if (!raw) {
    for (const key of LEGACY_SAVE_KEYS) {
      const legacy = localStorage.getItem(key);
      if (legacy) { raw = legacy; legacyKey = key; break; }
    }
  }

  if (!raw) return null;
  try {
    const saved = JSON.parse(raw);
    const fromVersion = saved._schemaVersion ?? saved.version ?? 'inconnue';
    const needsMigration = legacyKey || (saved._schemaVersion !== SAVE_SCHEMA_VERSION);

    const migrated = migrate(saved);

    if (needsMigration) {
      // Lister les champs qui ont été ajoutés (présents dans DEFAULT_STATE mais absents du raw)
      const addedFields = [];
      if (!saved.behaviourLogs)       addedFields.push('Logs comportementaux');
      if (saved.discoveryProgress?.agentsUnlocked === undefined)
                                       addedFields.push('Progression découverte étendue');
      if (saved.settings?.classicSprites === undefined) addedFields.push('Option sprites');
      if (!saved.eggs)                addedFields.push('Système d\'œufs');
      if (!saved.pension)             addedFields.push('Pension');
      if (!saved.trainingRoom)        addedFields.push('Salle d\'entraînement');
      if (!saved.missions)            addedFields.push('Missions');
      if (!saved.cosmetics)           addedFields.push('Cosmétiques');

      _migrationResult = {
        from: legacyKey ? `clé ${legacyKey}` : `schéma v${fromVersion}`,
        toLegacyKey: legacyKey,
        fields: addedFields,
      };

      // Si c'était une clé legacy, migrer dans la clé v6 et nettoyer l'ancienne
      if (legacyKey) {
        try { localStorage.removeItem(legacyKey); } catch {}
      }
    }

    // Stamper le schéma courant dans la save migrée
    migrated._schemaVersion = SAVE_SCHEMA_VERSION;
    return migrated;
  } catch (e) {
    console.error('[PokéForge] Erreur loadState() — save corrompue ou illisible :', e);
    return null;
  }
}

function migrate(saved) {
  if (!saved.version) saved.version = '6.0.0';
  const merged = { ...structuredClone(DEFAULT_STATE), ...saved };
  merged.gang = { ...structuredClone(DEFAULT_STATE.gang), ...saved.gang };
  merged.inventory = { ...structuredClone(DEFAULT_STATE.inventory), ...saved.inventory };
  merged.stats = { ...structuredClone(DEFAULT_STATE.stats), ...saved.stats };
  merged.settings = { ...structuredClone(DEFAULT_STATE.settings), ...saved.settings };
  // Migration: discoveryProgress — merge avec valeurs par défaut complètes
  merged.discoveryProgress = { ...structuredClone(DEFAULT_STATE.discoveryProgress), ...(saved.discoveryProgress || {}) };
  if (!merged.behaviourLogs) merged.behaviourLogs = { firstCombatAt:0, firstCaptureAt:0, firstPurchaseAt:0, firstAgentAt:0, firstMissionAt:0, tabViewCounts:{} };
  if (!merged.behaviourLogs.tabViewCounts) merged.behaviourLogs.tabViewCounts = {};
  // Nouveau joueur → découverte ON ; joueur existant sans ce champ → OFF (déjà habitué)
  if (merged.settings.discoveryMode === undefined) merged.settings.discoveryMode = false;
  if (merged.settings.autoBuyBall === undefined) merged.settings.autoBuyBall = null;
  if (merged.settings.classicSprites === undefined) merged.settings.classicSprites = false;
  merged.activeBoosts = { ...structuredClone(DEFAULT_STATE.activeBoosts), ...(saved.activeBoosts || {}) };
  merged.activeEvents = saved.activeEvents || {};
  // Migration: bossTeam
  if (!merged.gang.bossTeam) merged.gang.bossTeam = [];
  if (!merged.gang.showcase) merged.gang.showcase = [null, null, null];
  // Migration: titles
  if (!merged.unlockedTitles) merged.unlockedTitles = ['recrue', 'fondateur'];
  if (!merged.gang.titleA) merged.gang.titleA = 'recrue';
  if (merged.gang.titleB === undefined) merged.gang.titleB = null;
  if (merged.gang.titleLiaison === undefined) merged.gang.titleLiaison = '';
  if (merged.gang.titleC === undefined) merged.gang.titleC = null;
  if (merged.gang.titleD === undefined) merged.gang.titleD = null;
  // Migration: marketSales + favorites
  if (!merged.marketSales) merged.marketSales = {};
  if (!merged.favorites) merged.favorites = [];
  // Migration: agent notifyCaptures
  for (const agent of (merged.agents || [])) {
    if (agent.notifyCaptures === undefined) agent.notifyCaptures = true;
  }
  // Migration: pokemon history + favorite
  for (const p of (merged.pokemons || [])) {
    // Restituer les champs omis par slimPokemon()
    const sp = SPECIES_BY_EN[p.species_en];
    if (!p.species_fr)             p.species_fr  = sp?.fr  || p.species_en;
    if (p.dex === undefined)       p.dex         = sp?.dex ?? 0;
    if (p.assignedTo === undefined) p.assignedTo = null;
    if (p.cooldown   === undefined) p.cooldown   = 0;
    if (p.homesick   === undefined) p.homesick   = false;
    if (p.favorite   === undefined) p.favorite   = false;
    if (p.xp         === undefined) p.xp         = 0;
    if (!p.history)                p.history     = [];
  }
  // Migration: missions
  if (!merged.missions) {
    merged.missions = structuredClone(DEFAULT_STATE.missions);
  }
  if (!merged.missions.daily) merged.missions.daily = { reset: 0, progress: {}, claimed: [] };
  if (!merged.missions.weekly) merged.missions.weekly = { reset: 0, progress: {}, claimed: [] };
  if (!merged.missions.completed) merged.missions.completed = [];
  if (!merged.missions.hourly) merged.missions.hourly = { reset: 0, slots: [], baseline: {}, claimed: [] };
  // Migration: trainingRoom + cosmetics + purchases
  if (!merged.trainingRoom) merged.trainingRoom = structuredClone(DEFAULT_STATE.trainingRoom);
  merged.trainingRoom = { ...structuredClone(DEFAULT_STATE.trainingRoom), ...merged.trainingRoom };
  if (!merged.cosmetics) merged.cosmetics = { gameBg: null, bossBg: null, unlockedBgs: [] };
  if (!merged.lab) merged.lab = { trackedSpecies: [] };
  if (!merged.lab.trackedSpecies) merged.lab.trackedSpecies = [];
  if (!merged.purchases) merged.purchases = { translator: false, mysteryEggCount: 0 };
  if (merged.purchases.mysteryEggCount === undefined) merged.purchases.mysteryEggCount = 0;
  if (merged.purchases.cosmeticsPanel === undefined) merged.purchases.cosmeticsPanel = false;
  if (merged.purchases.autoIncubator === undefined) merged.purchases.autoIncubator = false;
  if (merged.purchases.chromaCharm === undefined) merged.purchases.chromaCharm = false;
  if (!merged.favoriteZones) merged.favoriteZones = [];
  if (merged.settings.uiScale === undefined) merged.settings.uiScale = 100;
  if (merged.settings.musicVol === undefined) merged.settings.musicVol = 50;
  if (merged.settings.sfxVol === undefined)   merged.settings.sfxVol   = 80;
  if (merged.settings.zoneScale === undefined) merged.settings.zoneScale = 100;
  if (merged.settings.lightTheme === undefined) merged.settings.lightTheme = false;
  if (merged.settings.lowSpec === undefined)   merged.settings.lowSpec  = false;
  if (!merged.settings.sfxIndividual)          merged.settings.sfxIndividual = {};
  if (!merged.pension) merged.pension = { slotA: null, slotB: null, eggAt: null };
  if (!merged.eggs) merged.eggs = [];
  // Migration: eggs need incubating flag; auto-hatching eggs get paused
  for (const egg of merged.eggs) {
    if (egg.incubating === undefined) {
      egg.incubating = false;
      egg.hatchAt = null; // require manual incubation
    }
    if (!egg.rarity) egg.rarity = SPECIES_BY_EN[egg.species_en]?.rarity || 'common';
  }
  if (!merged.inventory.incubator) merged.inventory.incubator = 0;
  // Migration: agent perkLevels / pendingPerk
  for (const agent of (merged.agents || [])) {
    if (!agent.perkLevels) agent.perkLevels = [];
    if (agent.pendingPerk === undefined) agent.pendingPerk = false;
  }
  // Migration: homesick flag for imported pokemon
  merged.pokemons.forEach(p => { if (p.homesick === undefined) p.homesick = false; });
  // Clean up stale training room IDs (deleted pokemon)
  const allIds = new Set((merged.pokemons || []).map(p => p.id));
  merged.trainingRoom.pokemon = (merged.trainingRoom.pokemon || []).filter(id => allIds.has(id));
  // Résoudre les conflits d'affectation : priorité équipe > pension > formation
  {
    const teamSet = new Set(merged.gang.bossTeam || []);
    // Pension : retirer si aussi en équipe
    if (merged.pension.slotA && teamSet.has(merged.pension.slotA)) merged.pension.slotA = null;
    if (merged.pension.slotB && teamSet.has(merged.pension.slotB)) merged.pension.slotB = null;
    // Formation : retirer si en équipe ou en pension
    const resolvedPension = new Set([merged.pension.slotA, merged.pension.slotB].filter(Boolean));
    merged.trainingRoom.pokemon = (merged.trainingRoom.pokemon || []).filter(id => !teamSet.has(id) && !resolvedPension.has(id));
  }
  // ── Migration Gen 2 : convertir les Pokémon Gen 2 en ailes ────
  // Lugia et Ho-Oh ne spawnent plus dans les zones normales (zones dédiées désormais).
  // Si un joueur en a dans son PC, on les convertit en ailes.
  // Les évolutions Gen 2 (crobat, steelix, scizor, espeon, etc.) sont conservées :
  // elles restent obtenables par évolution et ne doivent PAS être effacées.
  const LEGENDARY_CONVERT = new Set(['lugia', 'ho-oh']);
  const legendaryFound = (merged.pokemons || []).filter(pk => LEGENDARY_CONVERT.has(pk.species_en));
  if (legendaryFound.length > 0) {
    merged.pokemons = merged.pokemons.filter(pk => !LEGENDARY_CONVERT.has(pk.species_en));
    merged.gang.bossTeam = (merged.gang.bossTeam || []).filter(id => !legendaryFound.some(p => p.id === id));
    merged.inventory = merged.inventory || {};
    for (const pk of legendaryFound) {
      if (pk.species_en === 'lugia') merged.inventory.silver_wing  = (merged.inventory.silver_wing  || 0) + 2;
      else                           merged.inventory.rainbow_wing = (merged.inventory.rainbow_wing || 0) + 2;
    }
    merged._gen2MigrationCount = legendaryFound.length;
  }

  // ── Migration limites : valeurs hors-limites → MissingNo reward ─
  // Limite incubateur = 10 (cohérent avec le shop qui bloque à owned >= 10)
  const LIMITS = { incubator: 10 };
  let limitViolation = false;
  for (const [item, max] of Object.entries(LIMITS)) {
    if ((merged.inventory[item] || 0) > max) {
      merged.inventory[item] = max;
      limitViolation = true;
    }
  }
  // Pokémon avec potential > 5 ou level > 100
  for (const pk of merged.pokemons || []) {
    if ((pk.potential || 1) > 5) { pk.potential = 5; limitViolation = true; }
    if ((pk.level || 1) > 100)   { pk.level = 100; limitViolation = true; }
  }
  if (limitViolation && !(merged.pokemons || []).some(p => p.species_en === 'missingno')) {
    const reward = { id: uid(), species_en:'missingno', species_fr:'MissingNo', dex:0,
      level:1, xp:0, potential:1, shiny:false, history:[{ type:'migration_reward', ts:Date.now() }],
      moves:['Morphing','Psyko','Métronome','Surf'] };
    merged.pokemons = merged.pokemons || [];
    merged.pokemons.push(reward);
    merged._limitViolationReward = true;
  }

  // Toujours stamper la version schéma courante
  merged._schemaVersion = SAVE_SCHEMA_VERSION;
  return merged;
}

function exportSave() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pokeforge-v6-save-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importSave(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const raw = JSON.parse(e.target.result);
      if (!raw || typeof raw !== 'object' || (!raw.gang && !raw.pokemons)) {
        notify('Import échoué — fichier invalide ou non-reconnu.', 'error'); return;
      }
      openImportPreviewModal(raw);
    } catch {
      notify('Import échoué — fichier JSON invalide.', 'error');
    }
  };
  reader.readAsText(file);
}

// ── Modal de prévisualisation + conversion d'import ──────────────────────────
function openImportPreviewModal(raw) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px';

  // ── Analyse de la save importée ──────────────────────────────────────────
  const schemaVer   = raw._schemaVersion ?? raw.version ?? '?';
  const isLegacy    = !raw.eggs || !raw.pension || !raw.trainingRoom;
  const isVeryOld   = !raw.gang || !raw.pokemons;
  const gangName    = raw.gang?.name    ?? '—';
  const bossName    = raw.gang?.bossName ?? '—';
  const reputation  = (raw.gang?.reputation ?? 0).toLocaleString();
  const money       = (raw.gang?.money ?? 0).toLocaleString();
  const pokeCount   = (raw.pokemons  || []).length;
  const agentCount  = (raw.agents    || []).length;
  const dexCaught   = Object.values(raw.pokedex || {}).filter(e => e.caught).length;
  const shinyCount  = Object.values(raw.pokedex || {}).filter(e => e.shiny).length;
  const savedAt     = raw._savedAt ? new Date(raw._savedAt).toLocaleString('fr-FR') : '—';
  const playtime    = raw.playtime  ? formatPlaytime(raw.playtime) : '—';

  // ── Liste des champs qui seront ajoutés/migrés ───────────────────────────
  const migrations = [];
  if (!raw.eggs)             migrations.push('Système d\'œufs');
  if (!raw.pension)          migrations.push('Pension');
  if (!raw.trainingRoom)     migrations.push('Salle d\'entraînement');
  if (!raw.missions)         migrations.push('Missions');
  if (!raw.cosmetics)        migrations.push('Cosmétiques');
  if (!raw.unlockedTitles)   migrations.push('Titres débloqués');
  if (raw.gang?.titleC === undefined) migrations.push('Slots de titres (×4)');
  if (!raw.behaviourLogs)    migrations.push('Logs comportementaux');
  if (!raw.lab)              migrations.push('Laboratoire');
  if (!raw.purchases)        migrations.push('Achats spéciaux');
  if (!raw.eggs && !raw.inventory?.incubator) migrations.push('Inventaire incubateurs');
  if (raw.settings?.uiScale === undefined) migrations.push('Paramètres UI avancés');

  const migHtml = migrations.length
    ? migrations.map(m => `<div style="display:flex;gap:6px;align-items:center;font-size:8px;color:var(--text-dim)"><span style="color:var(--green)">✓</span>${m}</div>`).join('')
    : '<div style="font-size:8px;color:var(--green)">Aucune migration nécessaire — save à jour</div>';

  const versionBadge = isLegacy
    ? `<span style="font-size:7px;padding:2px 6px;border-radius:8px;background:rgba(255,160,0,.15);border:1px solid #ffa000;color:#ffa000">Version ancienne</span>`
    : `<span style="font-size:7px;padding:2px 6px;border-radius:8px;background:rgba(0,200,100,.1);border:1px solid var(--green);color:var(--green)">Format compatible</span>`;

  overlay.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);padding:24px;max-width:620px;width:100%;max-height:90vh;overflow-y:auto;display:flex;flex-direction:column;gap:16px">

      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-family:var(--font-pixel);font-size:11px;color:var(--gold)">📥 Importer une Save</div>
        <button id="btnImportClose" style="background:none;border:none;color:var(--text-dim);font-size:18px;cursor:pointer">✕</button>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">

        <!-- Infos save importée -->
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;display:flex;flex-direction:column;gap:8px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div style="font-family:var(--font-pixel);font-size:8px;color:var(--text-dim)">SAVE IMPORTÉE</div>
            ${versionBadge}
          </div>
          <div style="font-family:var(--font-pixel);font-size:12px;color:var(--red)">${gangName}</div>
          <div style="font-size:9px;color:var(--text-dim)">Boss : <span style="color:var(--text)">${bossName}</span></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:4px">
            <div style="font-size:8px;color:var(--text-dim)">🎯 Pokémon <span style="color:var(--text)">${pokeCount}</span></div>
            <div style="font-size:8px;color:var(--text-dim)">👤 Agents <span style="color:var(--text)">${agentCount}</span></div>
            <div style="font-size:8px;color:var(--text-dim)">⭐ Rép. <span style="color:var(--gold)">${reputation}</span></div>
            <div style="font-size:8px;color:var(--text-dim)">₽ <span style="color:var(--text)">${money}</span></div>
            <div style="font-size:8px;color:var(--text-dim)">📖 Pokédex <span style="color:var(--text)">${dexCaught}</span></div>
            <div style="font-size:8px;color:var(--text-dim)">✨ Shinies <span style="color:var(--text)">${shinyCount}</span></div>
          </div>
          <div style="font-size:7px;color:var(--text-dim);border-top:1px solid var(--border);padding-top:6px;margin-top:2px">
            Sauvegardé le ${savedAt}<br>Temps de jeu : ${playtime} · Schéma v${schemaVer}
          </div>
        </div>

        <!-- Champs à migrer -->
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;display:flex;flex-direction:column;gap:6px">
          <div style="font-family:var(--font-pixel);font-size:8px;color:var(--text-dim);margin-bottom:4px">MIGRATION AUTOMATIQUE</div>
          ${migHtml}
        </div>
      </div>

      <!-- Avertissement écrasement -->
      <div style="background:rgba(204,51,51,.08);border:1px solid rgba(204,51,51,.3);border-radius:var(--radius-sm);padding:10px;font-size:9px;color:var(--text-dim)">
        ⚠ <b style="color:var(--red)">Import complet</b> : remplacera définitivement la save active (slot ${activeSaveSlot + 1}).
        Exporte d'abord ta save actuelle si tu veux la conserver.
      </div>

      <div style="display:flex;flex-direction:column;gap:8px">
        <button id="btnImportBackupFirst" style="font-family:var(--font-pixel);font-size:8px;padding:8px 12px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer;text-align:left">
          💾 Exporter ma save actuelle avant d'importer
        </button>
        <div style="display:flex;gap:8px">
          <button id="btnImportFull" style="flex:2;font-family:var(--font-pixel);font-size:9px;padding:12px;background:var(--bg);border:2px solid var(--gold);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">
            ⚡ Import complet<br><span style="font-size:7px;color:var(--text-dim);font-family:sans-serif">Tous les données migrées automatiquement</span>
          </button>
          ${isLegacy ? `<button id="btnImportHeritage" style="flex:1;font-family:var(--font-pixel);font-size:9px;padding:12px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">
            🏆 Mode héritage<br><span style="font-size:7px;font-family:sans-serif">1 agent + 2 Pokémon</span>
          </button>` : ''}
        </div>
        <button id="btnImportCancel" style="font-family:var(--font-pixel);font-size:8px;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">
          Annuler
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#btnImportClose')?.addEventListener('click',  () => overlay.remove());
  overlay.querySelector('#btnImportCancel')?.addEventListener('click', () => overlay.remove());

  overlay.querySelector('#btnImportBackupFirst')?.addEventListener('click', () => {
    exportSave();
    overlay.querySelector('#btnImportBackupFirst').textContent = '✅ Save actuelle exportée !';
    overlay.querySelector('#btnImportBackupFirst').style.color = 'var(--green)';
  });

  overlay.querySelector('#btnImportFull')?.addEventListener('click', () => {
    showConfirm(
      `Remplacer la save du slot ${activeSaveSlot + 1} par la save importée de "${gangName}" ?`,
      () => {
        try {
          state = migrate(raw);
          saveState();
          overlay.remove();
          renderAll();
          notify(`✅ Save de "${gangName}" importée et convertie au format actuel.`, 'success');
        } catch (err) {
          notify('Erreur lors de la conversion — save non-importée.', 'error');
          console.error(err);
        }
      },
      null,
      { confirmLabel: 'Importer', cancelLabel: 'Annuler' }
    );
  });

  overlay.querySelector('#btnImportHeritage')?.addEventListener('click', () => {
    overlay.remove();
    openLegacyImportModal(raw);
  });
}

function openLegacyImportModal(legacyData) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px';

  const agents = legacyData.agents || [];
  const pokemons = legacyData.pokemons || [];

  const agentHtml = agents.length
    ? agents.map(a => `<label style="display:flex;align-items:center;gap:8px;padding:6px;border-bottom:1px solid var(--border);cursor:pointer">
        <input type="radio" name="legacyAgent" value="${a.id}" style="accent-color:var(--gold)">
        <img src="${a.sprite || ''}" style="width:32px;height:32px" onerror="this.style.display='none'">
        <span style="font-size:10px">${a.name} — Lv.${a.level} (${a.title})</span>
      </label>`).join('')
    : '<div style="color:var(--text-dim);font-size:10px;padding:8px">Aucun agent dans cette save</div>';

  const pokeHtml = pokemons.slice(0, 60).map(p => `<label style="display:flex;align-items:center;gap:6px;padding:4px;border-bottom:1px solid var(--border);cursor:pointer">
      <input type="checkbox" name="legacyPoke" value="${p.id}" style="accent-color:var(--gold)">
      <img src="${pokeSprite(p.species_en, p.shiny)}" style="width:28px;height:28px">
      <span style="font-size:9px">${speciesName(p.species_en)} Lv.${p.level} ${'*'.repeat(p.potential)}${p.shiny?' [S]':''}</span>
    </label>`).join('') || '<div style="color:var(--text-dim);font-size:10px">Aucun Pokémon</div>';

  overlay.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);padding:20px;max-width:600px;width:100%;max-height:90vh;overflow-y:auto">
      <div style="font-family:var(--font-pixel);font-size:12px;color:var(--gold);margin-bottom:8px">IMPORT HERITAGE</div>
      <div style="font-size:10px;color:var(--text-dim);margin-bottom:16px">
        Save d'une version antérieure détectée. Tu peux conserver <b style="color:var(--text)">1 agent</b> et <b style="color:var(--text)">2 Pokémon</b>.<br>
        Les 2 Pokémon seront placés à la Pension pour pondre un oeuf de départ.
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div>
          <div style="font-family:var(--font-pixel);font-size:9px;color:var(--text-dim);margin-bottom:8px">CHOISIR 1 AGENT</div>
          <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);max-height:200px;overflow-y:auto">${agentHtml}</div>
        </div>
        <div>
          <div style="font-family:var(--font-pixel);font-size:9px;color:var(--text-dim);margin-bottom:8px">CHOISIR 2 POKEMON</div>
          <div id="legacyPokeCount" style="font-size:9px;color:var(--red);margin-bottom:4px">0/2 sélectionnés</div>
          <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);max-height:200px;overflow-y:auto">${pokeHtml}</div>
        </div>
      </div>

      <div style="margin-top:16px;display:flex;gap:8px">
        <button id="btnLegacyConfirm" style="flex:1;font-family:var(--font-pixel);font-size:10px;padding:10px;background:var(--bg);border:2px solid var(--gold);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">COMMENCER</button>
        <button id="btnLegacyCancel" style="font-family:var(--font-pixel);font-size:10px;padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">Annuler</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  // Limit pokemon checkboxes to 2
  overlay.querySelectorAll('input[name="legacyPoke"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const checked = [...overlay.querySelectorAll('input[name="legacyPoke"]:checked')];
      const countEl = document.getElementById('legacyPokeCount');
      if (checked.length > 2) { cb.checked = false; return; }
      if (countEl) countEl.textContent = `${checked.length}/2 sélectionnés`;
    });
  });

  document.getElementById('btnLegacyCancel')?.addEventListener('click', () => overlay.remove());

  document.getElementById('btnLegacyConfirm')?.addEventListener('click', () => {
    const agentId = overlay.querySelector('input[name="legacyAgent"]:checked')?.value;
    const pokeIds = [...overlay.querySelectorAll('input[name="legacyPoke"]:checked')].map(cb => cb.value);

    if (pokeIds.length !== 2) {
      notify('Sélectionne exactement 2 Pokémon.'); return;
    }

    // Build fresh state
    const fresh = structuredClone(DEFAULT_STATE);
    // Transfer gang basics from legacy
    fresh.gang.name = legacyData.gang?.name || 'La Gang';
    fresh.gang.bossName = legacyData.gang?.bossName || 'Boss';
    fresh.gang.bossSprite = legacyData.gang?.bossSprite || 'rocketgrunt';

    // Transfer chosen agent
    if (agentId) {
      const agent = agents.find(a => a.id === agentId);
      if (agent) {
        agent.team = []; // reset team
        agent.pendingPerk = false;
        fresh.agents = [agent];
      }
    }

    // Transfer chosen pokemon to pension
    const chosenPokes = pokeIds.map(id => pokemons.find(p => p.id === id)).filter(Boolean);
    chosenPokes.forEach(p => { p.homesick = true; });
    fresh.pokemons = chosenPokes;
    if (chosenPokes[0]) fresh.pension.slotA = chosenPokes[0].id;
    if (chosenPokes[1]) fresh.pension.slotB = chosenPokes[1].id;
    fresh.pension.eggAt = Date.now() + 60000; // first egg in 1 minute

    state = migrate(fresh);
    saveState();
    overlay.remove();
    renderAll();
    notify('Nouvelle partie héritée commencée ! Les Pokémon sont à la Pension.', 'gold');
    switchTab('tabPC');
  });
}

// ════════════════════════════════════════════════════════════════
//  3.  CORE UTILS
// ════════════════════════════════════════════════════════════════

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function formatIncome(n) {
  if (n >= 10000) return Math.round(n / 1000) + 'k';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toString();
}
function weightedPick(arr) {
  // arr: [{en, w}, ...] — returns en string
  const total = arr.reduce((s, e) => s + e.w, 0);
  let r = Math.random() * total;
  for (const e of arr) { r -= e.w; if (r <= 0) return e.en; }
  return arr[arr.length - 1].en;
}
function randInt(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function addLog(msg) {
  state.log.unshift({ msg, ts: Date.now() });
  if (state.log.length > 50) state.log.length = 50;
}

function sanitizeSpriteName(en) {
  // Showdown sprites use no hyphens for nidoran: nidoranf, nidoranm
  // and some others like mr-mime -> mrmime, farfetchd, etc.
  return en.replace(/[^a-z0-9]/g, '');
}

// ── Pokémon sprite resolution ────────────────────────────────────────────────
// Variants disponibles (depuis pokemon-sprites-kanto.json) :
//   'main'         → FireRed/LeafGreen (défaut)
//   'showdown'     → Animated GIF Showdown
//   'icon'         → Icône miniature Gen 7
//   'artwork'      → Artwork officiel haute résolution
//   'artworkShiny' → Artwork officiel shiny
//   'back'         → Dos face
//   'shiny'        → Version brillante face
//   'backShiny'    → Dos brillant
//   'retroRedBlue' → Sprite Rogue/Bleu
//   'retroYellow'  → Sprite Jaune
function pokeSpriteVariant(en, variant = 'main', shiny = false) {
  // Mode classique (Showdown Gen 5 animés) ou variante explicitement Showdown → bypass JSON
  const classic = state?.settings?.classicSprites || variant === 'showdown';
  if (!classic) {
    const sp = SPECIES_BY_EN[en];
    const dexId = sp?.dex;
    if (dexId && typeof getPokemonSprite === 'function') {
      const key = shiny && variant === 'main' ? 'shiny'
                : shiny && variant === 'back'  ? 'backShiny'
                : variant;
      const url = getPokemonSprite(dexId, key);
      if (url) return url;
    }
  }
  // Fallback / mode classique : Showdown Gen 5
  const base = shiny ? 'gen5-shiny' : 'gen5';
  return `https://play.pokemonshowdown.com/sprites/${base}/${sanitizeSpriteName(en)}.png`;
}

function pokeSprite(en, shiny = false) {
  return pokeSpriteVariant(en, 'main', shiny);
}

function pokeSpriteBack(en, shiny = false) {
  if (!state?.settings?.classicSprites) {
    const sp = SPECIES_BY_EN[en];
    const dexId = sp?.dex;
    if (dexId && typeof getPokemonSprite === 'function') {
      const url = getPokemonSprite(dexId, shiny ? 'backShiny' : 'back');
      if (url) return url;
    }
  }
  const base = shiny ? 'gen5-back-shiny' : 'gen5-back';
  return `https://play.pokemonshowdown.com/sprites/${base}/${sanitizeSpriteName(en)}.png`;
}

const SPRITE_FIX = {
  // ltsurge, rocketgrunt, rocketgruntf exist directly on Showdown — no fix needed
  // Elite Four sprites need suffix
  agatha:          'agatha-gen1',
  lorelei:         'lorelei-gen1',
  phoebe:          'phoebe-gen3',
  drake:           'drake-gen3',
  // Common trainers that 404 without suffix
  channeler:       'channeler-gen1',
  cueball:         'cueball-gen1',
  rocker:          'rocker-gen1',
  tamer:           'tamer-gen1',
  // cooltrainer doesn't exist on Showdown → use acetrainer
  cooltrainer:     'acetrainer',
  cooltrainerf:    'acetrainerf',
  // New trainers — pick the most iconic version
  rocketexecutive: 'rocketexecutive-gen2',
  pokemonrangerf:  'pokemonrangerf-gen3',
  policeman:       'policeman-gen8',
};

// Custom sprite overrides (non-Showdown sources)
const CUSTOM_TRAINER_SPRITES = {
  giovanni: 'https://www.pokepedia.fr/images/archive/7/73/20230124191924%21Sprite_Giovanni_RB.png',
};

// ── Trainer sprite resolution ────────────────────────────────────────────────
// Index à plat construit après chargement de trainer-sprites-grouped.json
const _trainerJsonIndex = {};

function _buildTrainerIndex(data) {
  // `data` = résultat de loadTrainerGroups() — TRAINER_GROUPS n'est plus global (IIFE loaders.js)
  if (!data?.trainers) return;
  const base = 'https://play.pokemonshowdown.com/sprites/trainers/';
  const groups = data.trainers;
  for (const [groupName, groupData] of Object.entries(groups)) {
    if (groupName === 'factions') {
      for (const [, arr] of Object.entries(groupData)) {
        if (Array.isArray(arr)) arr.forEach(rel => {
          const slug = rel.replace(/\.png$/, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
          _trainerJsonIndex[slug] = base + rel;
        });
      }
    } else if (typeof groupData === 'object' && !Array.isArray(groupData)) {
      for (const [key, rel] of Object.entries(groupData)) {
        const slug = rel.replace(/\.png$/, '').toLowerCase();
        const keyNorm = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
        _trainerJsonIndex[slug] = base + rel;
        _trainerJsonIndex[keyNorm] = base + rel;
      }
    }
  }
}

function trainerSprite(name) {
  if (CUSTOM_TRAINER_SPRITES[name]) return CUSTOM_TRAINER_SPRITES[name];
  // Chercher dans l'index JSON si disponible
  const norm = (name || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (_trainerJsonIndex[norm]) return _trainerJsonIndex[norm];
  // Fallback Showdown
  const fixed = SPRITE_FIX[name] || name;
  return `https://play.pokemonshowdown.com/sprites/trainers/${fixed}.png`;
}

// Asset fallbacks moved to data/assets-data.js

// Safe image helpers — with automatic fallback on load error
function safeTrainerImg(name, { style = '', cls = '' } = {}) {
  const src = trainerSprite(name);
  return `<img src="${src}" ${cls ? `class="${cls}"` : ''} style="${style}" alt="${name}" onerror="this.src='${FALLBACK_TRAINER_SVG}';this.onerror=null">`;
}
function safePokeImg(species_en, { shiny = false, back = false, variant = 'main', style = '', cls = '' } = {}) {
  const src = back ? pokeSpriteBack(species_en, shiny) : pokeSpriteVariant(species_en, variant, shiny);
  return `<img src="${src}" ${cls ? `class="${cls}"` : ''} style="${style}" alt="${species_en}" onerror="this.src='${FALLBACK_POKEMON_SVG}';this.onerror=null">`;
}

function speciesName(en) {
  if (!SPECIES_BY_EN[en]) return en;
  return state.lang === 'fr' ? SPECIES_BY_EN[en].fr : en.charAt(0).toUpperCase() + en.slice(1);
}

function pokemonDisplayName(p) {
  return p.nick || speciesName(p.species_en);
}

// ════════════════════════════════════════════════════════════════
// SESSION TRACKING  (30-min idle = nouvelle session)
// ════════════════════════════════════════════════════════════════
const SESSION_KEY     = 'pg_session_baseline';
const SESSION_IDLE_MS = 30 * 60 * 1000;
let _sessionBaseline  = null;

function initSession() {
  const now = Date.now();
  const raw = localStorage.getItem(SESSION_KEY);
  if (raw) {
    try {
      const saved = JSON.parse(raw);
      if (now - saved.ts < SESSION_IDLE_MS) {
        _sessionBaseline = saved;
        // Migration : anciens saves de session sans caught/sold
        if (_sessionBaseline.caughtAtStart === undefined) _sessionBaseline.caughtAtStart = state.stats.totalCaught || 0;
        if (_sessionBaseline.soldAtStart   === undefined) _sessionBaseline.soldAtStart   = state.stats.totalSold   || 0;
        return; // session en cours — on la continue
      }
    } catch {}
  }
  // Nouvelle session
  _sessionBaseline = {
    ts:           now,
    money:        state.gang.money,
    rep:          state.gang.reputation,
    pokemon:      state.pokemons.length,
    shinies:      state.stats.shinyCaught    || 0,
    fights:       state.stats.totalFightsWon || 0,
    caughtAtStart: state.stats.totalCaught   || 0,
    soldAtStart:   state.stats.totalSold     || 0,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(_sessionBaseline));
}

function _saveSessionActivity() {
  if (_sessionBaseline) {
    _sessionBaseline.ts = Date.now();
    localStorage.setItem(SESSION_KEY, JSON.stringify(_sessionBaseline));
  }
}

function getSessionDelta() {
  if (!_sessionBaseline) return null;
  const dMoney  = state.gang.money            - _sessionBaseline.money;
  const dRep    = state.gang.reputation       - _sessionBaseline.rep;
  const dCaught = (state.stats.totalCaught   || 0) - (_sessionBaseline.caughtAtStart || 0);
  const dSold   = (state.stats.totalSold     || 0) - (_sessionBaseline.soldAtStart   || 0);
  const dShiny  = (state.stats.shinyCaught   || 0) - (_sessionBaseline.shinies       || 0);
  const dFights = (state.stats.totalFightsWon|| 0) - (_sessionBaseline.fights        || 0);

  const parts = [];
  const fmtPos = (v, icon) => {
    if (v <= 0) return null;
    const color = 'var(--green-dim,#4a8)';
    return `<span style="color:${color}">+${Math.abs(v) >= 1000 ? v.toLocaleString() : v} ${icon}</span>`;
  };
  const fmtAny = (v, icon) => {
    if (v === 0) return null;
    const sign  = v > 0 ? '+' : '';
    const color = v > 0 ? 'var(--green-dim,#4a8)' : 'var(--red)';
    return `<span style="color:${color}">${sign}${Math.abs(v) >= 1000 ? v.toLocaleString() : v} ${icon}</span>`;
  };

  if (dMoney  !== 0) parts.push(fmtAny(dMoney,  '₽'));
  if (dCaught  > 0)  parts.push(fmtPos(dCaught, '🎯'));
  if (dSold    > 0)  parts.push(`<span style="color:var(--text-dim)">-${dSold} 💱</span>`);
  if (dRep    !== 0) parts.push(fmtAny(dRep,    '⭐'));
  if (dShiny   > 0)  parts.push(fmtPos(dShiny,  '✨'));
  if (dFights  > 0)  parts.push(fmtPos(dFights, '⚔'));
  return parts.filter(Boolean).join(' · ');
}

// ════════════════════════════════════════════════════════════════
// NEXT OBJECTIVE
// ════════════════════════════════════════════════════════════════
function getNextObjective() {
  const pc     = state.pokemons.length;
  const team   = state.gang.bossTeam.length;
  const agents = state.agents.length;
  const money  = state.gang.money;
  const rep    = state.gang.reputation;
  const zones  = openZones ? openZones.size : 0;
  const dex    = Object.values(state.pokedex).filter(e => e.caught).length;

  if (!state.gang.initialized)
    return { text: '👋 Crée ton Gang pour commencer', tab: null };
  if (pc === 0)
    return { text: '⚡ Capture ton premier Pokémon', detail: '→ Zones', tab: 'tabZones' };
  if (team === 0)
    return { text: '⚔ Place un Pokémon dans ton équipe Boss', detail: '→ PC', tab: 'tabPC' };
  if (team < 3)
    return { text: `⚔ Complète ton équipe Boss`, detail: `${team}/3`, tab: 'tabPC' };
  if (agents === 0) {
    const cost = typeof getAgentRecruitCost === 'function' ? getAgentRecruitCost() : 10000;
    const progress = money >= cost ? 'Prêt !' : `₽${money.toLocaleString()}/${cost.toLocaleString()}`;
    return { text: '👤 Recrute ton premier agent', detail: progress, tab: 'tabPC' };
  }
  // Zone suivante verrouillée
  const nextLocked = ZONES ? ZONES.find(z => !isZoneUnlocked(z.id)) : null;
  if (nextLocked) {
    const req = nextLocked.repRequired || 0;
    if (req > 0)
      return { text: `🗺 Débloquer ${nextLocked.fr}`, detail: `Rép. ${rep}/${req}`, tab: 'tabZones' };
  }
  if (agents < 3)
    return { text: `👥 Avoir ${agents+1} agents`, detail: `${agents}/3`, tab: 'tabAgents' };
  if (dex < 151)
    return { text: `📖 Pokédex ${dex}/151`, detail: `${151 - dex} espèces manquantes`, tab: 'tabPokedex' };
  return { text: '🏆 Pokédex complet — Tu domines Kanto !', detail: null, tab: null };
}

// ── Boost helpers ─────────────────────────────────────────────
function isBoostActive(boostId) {
  return (state.activeBoosts[boostId] || 0) > Date.now();
}
function boostRemaining(boostId) {
  const exp = state.activeBoosts[boostId] || 0;
  return Math.max(0, Math.ceil((exp - Date.now()) / 1000));
}
// Boost durations moved to data/gameplay-config-data.js

function activateBoost(boostId) {
  if ((state.inventory[boostId] || 0) <= 0) return false;
  state.inventory[boostId]--;
  const duration = BOOST_DURATIONS[boostId] || 90000;
  // Cumulate: extend from current expiry if already active, else from now
  const base = Math.max(Date.now(), state.activeBoosts[boostId] || 0);
  state.activeBoosts[boostId] = base + duration;
  saveState();
  return true;
}

// Item and ball sprite URLs moved to data/assets-data.js
function itemSprite(id) {
  const url = ITEM_SPRITE_URLS[id];
  return url
    ? `<img src="${url}" style="width:28px;height:28px;image-rendering:pixelated" onerror="this.style.display='none'">`
    : `<span style="font-family:var(--font-pixel);font-size:8px;color:var(--text-dim)">${id.toUpperCase().slice(0,3)}</span>`;
}

// Translator flavor text moved to data/flavor-data.js

// PC sub-view state
let pcView = 'grid'; // 'grid' | 'lab'
let _pcLastRenderKey = ''; // tracks last filter/sort/page combo to avoid unnecessary rebuilds

// Chest sprite URL moved to data/assets-data.js

// ── SFX Engine (Web Audio API) ────────────────────────────────
const SFX = (() => {
  let ctx;
  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }
  function playTone(freq, duration, type = 'square', volume = 0.15) {
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    const sfxMult = (state?.settings?.sfxVol ?? 80) / 100;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    gain.gain.setValueAtTime(volume * sfxMult, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + duration + 0.05); // +50 ms buffer → élimine le click/scratch à l'arrêt
  }
  return {
    ballThrow() {
      // Whoosh sound: descending noise
      playTone(800, 0.15, 'sawtooth', 0.08);
      setTimeout(() => playTone(400, 0.1, 'sawtooth', 0.06), 80);
    },
    capture(potential, shiny) {
      // Base capture jingle
      const base = 520;
      playTone(base, 0.12, 'square', 0.12);
      setTimeout(() => playTone(base * 1.25, 0.12, 'square', 0.12), 100);
      setTimeout(() => playTone(base * 1.5, 0.15, 'square', 0.12), 200);
      // Extra notes for high potential
      if (potential >= 4) {
        setTimeout(() => playTone(base * 2, 0.2, 'square', 0.15), 320);
      }
      if (potential >= 5 || shiny) {
        setTimeout(() => playTone(base * 2.5, 0.25, 'sine', 0.18), 440);
        setTimeout(() => playTone(base * 3, 0.3, 'sine', 0.15), 580);
      }
      if (shiny) {
        // Sparkle effect
        setTimeout(() => {
          for (let i = 0; i < 5; i++) {
            setTimeout(() => playTone(1200 + i * 200, 0.08, 'sine', 0.1), i * 60);
          }
        }, 700);
      }
    },
    error() {
      playTone(200, 0.2, 'sawtooth', 0.1);
    },
    levelUp() {
      // Ascending fanfare
      playTone(523, 0.1, 'square', 0.1);
      setTimeout(() => playTone(659, 0.1, 'square', 0.1), 110);
      setTimeout(() => playTone(784, 0.15, 'square', 0.1), 220);
      setTimeout(() => playTone(1047, 0.2, 'sine',  0.12), 360);
    },
    coin() {
      // Money sound
      playTone(988, 0.06, 'sine', 0.1);
      setTimeout(() => playTone(1318, 0.1, 'sine', 0.1), 80);
    },
    click() {
      // UI button click — tick léger
      playTone(1200, 0.04, 'square', 0.05);
    },
    tabSwitch() {
      // Changement d'onglet — glissement court
      playTone(660, 0.06, 'sine', 0.07);
      setTimeout(() => playTone(880, 0.05, 'sine', 0.05), 50);
    },
    buy() {
      // Achat confirmé — coin sound plus grave
      playTone(659, 0.08, 'sine', 0.1);
      setTimeout(() => playTone(880, 0.12, 'sine', 0.12), 80);
    },
    unlock() {
      // Déverrouillage / découverte — fanfare ascendante
      playTone(440, 0.08, 'square', 0.1);
      setTimeout(() => playTone(554, 0.08, 'square', 0.1), 100);
      setTimeout(() => playTone(659, 0.08, 'square', 0.1), 200);
      setTimeout(() => playTone(880, 0.16, 'sine',   0.12), 310);
      setTimeout(() => playTone(1108, 0.2, 'sine',   0.1),  450);
    },
    menuOpen() {
      // Ouverture modale / menu
      playTone(880, 0.08, 'sine', 0.07);
      setTimeout(() => playTone(1100, 0.1, 'sine', 0.06), 80);
    },
    menuClose() {
      // Fermeture modale
      playTone(660, 0.07, 'sine', 0.06);
      setTimeout(() => playTone(440, 0.09, 'sine', 0.05), 70);
    },
    chest() {
      // Coffre ouvert — effet magique
      playTone(660, 0.08, 'square', 0.08);
      setTimeout(() => playTone(880, 0.08, 'square', 0.09), 80);
      setTimeout(() => playTone(1100, 0.08, 'square', 0.1), 160);
      setTimeout(() => {
        for (let i = 0; i < 4; i++) {
          setTimeout(() => playTone(1200 + i * 180, 0.07, 'sine', 0.07), i * 55);
        }
      }, 260);
    },
    notify() {
      // Notification — ping doux
      playTone(880, 0.07, 'sine', 0.08);
      setTimeout(() => playTone(1108, 0.1, 'sine', 0.07), 90);
    },
    sell() {
      // Vente Pokémon
      playTone(660, 0.05, 'sine', 0.08);
      setTimeout(() => playTone(440, 0.08, 'sawtooth', 0.06), 70);
    },
    evolve() {
      // Évolution — fanfare complète
      const notes = [523, 659, 784, 1047, 1319];
      notes.forEach((f, i) => setTimeout(() => playTone(f, 0.15, 'square', 0.12), i * 120));
      setTimeout(() => {
        for (let i = 0; i < 6; i++) setTimeout(() => playTone(1200 + i * 150, 0.1, 'sine', 0.1), i * 60);
      }, notes.length * 120 + 100);
    },
    _enabled() { return state?.settings?.sfxEnabled !== false; },
    play(name, ...args) {
      if (!this._enabled()) return;
      if (state?.settings?.sfxIndividual?.[name] === false) return;
      try { this[name]?.(...args); } catch {}
    },
  };
})();

// ════════════════════════════════════════════════════════════════
//  3b.  MUSIC PLAYER (zone-aware, crossfade progressif)
// ════════════════════════════════════════════════════════════════

/**
 * MUSIC_TRACKS — catalogue de toutes les pistes audio.
 * Ajoutez des pistes ici + placez les fichiers dans game/music/.
 * Chaque zone référence une clé via sa propriété `music`.
 *
 * Structure :
 *   key:  identifiant unique (référencé dans ZONES[].music)
 *   file: chemin relatif depuis game/
 *   loop: true pour boucle continue
 *   vol:  volume de base 0–1
 */
const MUSIC_TRACKS = {
  // ── Base / Routes ─────────────────────────────────────────────
  base:        { file: 'music/BGM/First Town.mp3',    loop: true,  vol: 0.45, fr: 'Base du Gang'       },
  forest:      { file: 'music/BGM/Route 1.mp3',       loop: true,  vol: 0.50, fr: 'Route'               },
  cave:        { file: 'music/BGM/Cave.mp3',           loop: true,  vol: 0.45, fr: 'Caverne'             },
  city:        { file: 'music/BGM/Lab.mp3',            loop: true,  vol: 0.50, fr: 'Ville'               },
  sea:         { file: 'music/BGM/Introduction.mp3',   loop: true,  vol: 0.45, fr: 'Mer / Bateau'        },
  safari:      { file: 'music/BGM/Route 1.mp3',        loop: true,  vol: 0.45, fr: 'Parc Safari'         },
  lavender:    { file: 'music/BGM/Cave.mp3',           loop: true,  vol: 0.30, fr: 'Lavanville'          },
  tower:       { file: 'music/BGM/Cave.mp3',           loop: true,  vol: 0.28, fr: 'Tour Pokémon'        },
  mansion:     { file: 'music/BGM/Cave.mp3',           loop: true,  vol: 0.35, fr: 'Manoir Pokémon'      },
  // ── Combat / Arènes ───────────────────────────────────────────
  gym:         { file: 'music/BGM/VSTrainer.mp3',      loop: true,  vol: 0.55, fr: 'Arène'               },
  rocket:      { file: 'music/BGM/VSRival.mp3',        loop: true,  vol: 0.55, fr: 'Team Rocket'         },
  silph:       { file: 'music/BGM/Lab.mp3',            loop: true,  vol: 0.50, fr: 'Sylphe SARL'         },
  elite4:      { file: 'music/BGM/VSLegend.mp3',       loop: true,  vol: 0.60, fr: 'Élite 4 / Sommet'    },
  // ── Ambiances spéciales ────────────────────────────────────────
  casino:      { file: 'music/BGM/MysteryGift.mp3',    loop: true,  vol: 0.55, fr: 'Casino'              },
  halloffame:  { file: 'music/BGM/Hall of Fame.mp3',   loop: false, vol: 0.60, fr: 'Tableau d\'Honneur'  },
  title:       { file: 'music/BGM/Title.mp3',          loop: true,  vol: 0.50, fr: 'Titre'               },
};

/**
 * MusicPlayer — gère la lecture de fond avec crossfade.
 * Utilise deux éléments <audio> pour un fondu croisé doux.
 */
const MusicPlayer = (() => {
  let _trackA = null;   // HTMLAudioElement actif
  let _trackB = null;   // HTMLAudioElement en fondu entrant
  let _current = null;  // clé du morceau en cours
  let _fadeTimer = null;

  const FADE_DURATION = 2000; // ms

  function _createAudio(src, vol, loop) {
    const a = new Audio(src);
    a.loop = loop;
    a.volume = 0;
    a.preload = 'auto';
    a.dataset.targetVol = vol;
    return a;
  }

  function _isEnabled() {
    return state?.settings?.musicEnabled === true;
  }

  function _setVol(el, v) {
    if (el) el.volume = Math.max(0, Math.min(1, v));
  }

  function _fade(el, fromVol, toVol, durationMs, onDone) {
    const steps = 30;
    const dt = durationMs / steps;
    const delta = (toVol - fromVol) / steps;
    let step = 0;
    const id = setInterval(() => {
      step++;
      _setVol(el, fromVol + delta * step);
      if (step >= steps) {
        clearInterval(id);
        _setVol(el, toVol);
        if (onDone) onDone();
      }
    }, dt);
    return id;
  }

  return {
    /**
     * Joue la piste `trackId` avec crossfade si une piste est déjà active.
     * Ne fait rien si la piste est déjà en cours ou si la musique est désactivée.
     */
    play(trackId) {
      if (!_isEnabled()) return;
      if (!trackId || !MUSIC_TRACKS[trackId]) return;
      if (_current === trackId) return; // déjà en cours

      const def = MUSIC_TRACKS[trackId];
      const newAudio = _createAudio(def.file, def.vol, def.loop);
      const targetVol = def.vol;

      _current = trackId;

      if (_trackA && !_trackA.paused) {
        // Crossfade : fade out A, fade in B
        const oldA = _trackA;
        _trackB = newAudio;
        _trackB.play().catch(() => {});
        _fade(_trackB, 0, targetVol, FADE_DURATION);
        _fade(oldA, oldA.volume, 0, FADE_DURATION, () => {
          oldA.pause();
          oldA.src = '';
          _trackA = _trackB;
          _trackB = null;
        });
      } else {
        // Pas de piste active — démarre directement avec fade in
        if (_trackA) { _trackA.pause(); _trackA.src = ''; }
        _trackA = newAudio;
        _trackA.play().catch(() => {});
        _fade(_trackA, 0, targetVol, FADE_DURATION);
      }
    },

    /** Arrête la musique avec fade out. */
    stop() {
      if (_trackA) {
        const old = _trackA;
        _trackA = null;
        _current = null;
        _fade(old, old.volume, 0, FADE_DURATION / 2, () => {
          old.pause(); old.src = '';
        });
      }
    },

    /** Appelé lors du changement de zone ouverte ou d'onglet actif. */
    updateFromContext() {
      if (!_isEnabled()) { this.stop(); return; }

      // Priorité 0 : jukebox manuel
      if (state?.settings?.jukeboxTrack) {
        this.play(state.settings.jukeboxTrack);
        return;
      }

      // Priorité : première zone ouverte qui a une musique définie
      for (const zId of (state.openZoneOrder || [])) {
        const zone = ZONE_BY_ID[zId];
        if (zone?.music) { this.play(zone.music); return; }
      }
      // Fallback : musique de l'onglet actif
      if (activeTab === 'tabGang' || activeTab === 'tabZones') {
        this.play('base');
      } else {
        // Pas de zones ouvertes et onglet neutre → silence progressif
        this.stop();
      }
    },

    /** Volume global 0–1 */
    setVolume(v) {
      if (_trackA) _setVol(_trackA, Math.max(0, Math.min(1, v)) * (parseFloat(_trackA.dataset.targetVol) || 0.5));
    },

    get current() { return _current; },
  };
})();

/**
 * JinglePlayer — joue des courts extraits audio (ME) en one-shot.
 * Ne bloque pas la musique de fond — les deux coexistent.
 */
const JINGLES = {
  trainer_encounter: 'music/ME/VSTrainer_Intro.mp3',
  wild_encounter:    'music/ME/VSWildPoke_Intro.mp3',
  legend_encounter:  'music/ME/VSLegend_Intro.mp3',
  rival_encounter:   'music/ME/VSRival_Intro.mp3',
  youngster:         'music/ME/Encounter_Youngster.mp3',
  mystery_gift:      'music/BGM/MysteryGift.mp3',
  low_hp:            'music/ME/lowhp.mp3',
  slots_win:         'music/ME/SlotsWin.mp3',
  slots_big:         'music/ME/SlotsBigWin.mp3',
};

const JinglePlayer = (() => {
  let _current = null;
  function _enabled() { return state?.settings?.musicEnabled === true; }

  return {
    play(key) {
      if (!_enabled()) return;
      const src = JINGLES[key];
      if (!src) return;
      if (_current) { _current.pause(); _current = null; }
      const a = new Audio(src);
      a.volume = 0.7;
      a.play().catch(() => {});
      _current = a;
      a.addEventListener('ended', () => { _current = null; });
    },
    stop() { if (_current) { _current.pause(); _current = null; } },
  };
})();

/**
 * SE (Sound Effects) — sons d'attaque et événements gameplay.
 * Utilise Audio HTML plutôt que Web Audio pour les fichiers complexes.
 */
const SE_SOUNDS = {
  buy:        'music/SE/Charm.mp3',
  level_up:   'music/SE/BW2Summary.mp3',
  slash:      'music/SE/Slash.mp3',
  metronome:  'music/SE/Metronome.mp3',
  explosion:  'music/SE/Explosion.mp3',
  protect:    'music/SE/Protect.mp3',
  flash:      'music/SE/Flash.mp3',
};

function playSE(key, vol = 0.6) {
  if (state?.settings?.sfxEnabled === false) return;
  const src = SE_SOUNDS[key];
  if (!src) return;
  const a = new Audio(src);
  a.volume = vol;
  a.play().catch(() => {});
}

// ════════════════════════════════════════════════════════════════
//  3c.  DOPAMINE POPUP HELPERS
// ════════════════════════════════════════════════════════════════

let _shinyPopupTimer = null;

function showShinyPopup(species_en) {
  try {
    const el = document.getElementById('shinyPopup');
    const sprite = document.getElementById('shinyPopupSprite');
    const label  = document.getElementById('shinyPopupLabel');
    if (!el) return;
    sprite.src = pokeSprite(species_en, true);
    label.textContent = (state.lang === 'fr' ? '✨ SHINY ' : '✨ SHINY ') + speciesName(species_en) + ' !';
    el.classList.add('show');
    clearTimeout(_shinyPopupTimer);
    _shinyPopupTimer = setTimeout(() => el.classList.remove('show'), 3000);
  } catch {}
}

let _rarePopupTimer = null;

function showRarePopup(species_en, zoneId) {
  try {
    const el     = document.getElementById('rarePopup');
    const sprite = document.getElementById('rarePopupSprite');
    const label  = document.getElementById('rarePopupLabel');
    const hint   = document.getElementById('rarePopupHint');
    if (!el) return;
    sprite.src = pokeSprite(species_en);
    label.textContent = (state.lang === 'fr' ? '⚡ Rare aperçu : ' : '⚡ Rare spotted: ') + speciesName(species_en);

    // Afficher le nom de la zone et le hint cliquable
    if (zoneId && hint) {
      const zone = ZONE_BY_ID[zoneId];
      const zoneName = zone ? (state.lang === 'fr' ? zone.fr : zone.en) : zoneId;
      hint.textContent = `→ ${zoneName}`;
    } else if (hint) {
      hint.textContent = '';
    }

    // Stocker le zoneId pour le clic
    el.dataset.targetZone = zoneId || '';

    el.classList.add('show');
    clearTimeout(_rarePopupTimer);
    _rarePopupTimer = setTimeout(() => el.classList.remove('show'), 3500);
  } catch {}
}

// ── Clic sur le popup rare → switch vers la zone ──────────────
(function _bindRarePopupClick() {
  document.addEventListener('DOMContentLoaded', () => {
    const el = document.getElementById('rarePopup');
    if (!el) return;
    el.addEventListener('click', () => {
      const zoneId = el.dataset.targetZone;
      if (!zoneId) return;
      clearTimeout(_rarePopupTimer);
      el.classList.remove('show');
      // Ouvrir l'onglet Zones et y ouvrir la zone cible
      switchTab('tabZones');
      // S'assurer que la zone est ouverte dans les fenêtres
      if (!openZones.has(zoneId)) {
        openZones.add(zoneId);
        if (!state.openZoneOrder) state.openZoneOrder = [];
        if (!state.openZoneOrder.includes(zoneId)) state.openZoneOrder.push(zoneId);
      }
      renderZonesTab();
      // Scroll vers la fenêtre de zone après le rendu
      setTimeout(() => {
        const zoneWin = document.getElementById(`zw-${zoneId}`);
        zoneWin?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Bref highlight visuel
        zoneWin?.classList.add('zone-highlight');
        setTimeout(() => zoneWin?.classList.remove('zone-highlight'), 1500);
      }, 100);
    });
  });
})();

// ════════════════════════════════════════════════════════════════
//  3c.  MODAL HELPERS (confirm + info)
// ════════════════════════════════════════════════════════════════

function showConfirm(message, onConfirm, onCancel = null, opts = {}) {
  const existing = document.getElementById('confirmModal');
  if (existing) existing.remove();
  SFX.play('menuOpen');

  const modal = document.createElement('div');
  modal.id = 'confirmModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,.82);display:flex;align-items:center;justify-content:center;';

  const danger = opts.danger ? 'var(--red)' : 'var(--gold-dim)';
  const confirmLabel = opts.confirmLabel || (opts.lang === 'fr' ? 'Confirmer' : 'Confirm');
  const cancelLabel  = opts.cancelLabel  || (opts.lang === 'fr' ? 'Annuler'   : 'Cancel');

  modal.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid ${danger};border-radius:var(--radius);padding:24px 28px;max-width:440px;width:90%;display:flex;flex-direction:column;gap:16px">
      <div style="font-size:13px;color:var(--text);line-height:1.6">${message}</div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="confirmModalCancel" style="font-family:var(--font-pixel);font-size:9px;padding:8px 16px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">${cancelLabel}</button>
        <button id="confirmModalOk" style="font-family:var(--font-pixel);font-size:9px;padding:8px 16px;background:${opts.danger ? 'var(--red-dark)' : 'var(--bg)'};border:1px solid ${danger};border-radius:var(--radius-sm);color:${opts.danger ? '#fff' : 'var(--gold)'};cursor:pointer">${confirmLabel}</button>
      </div>
    </div>`;

  document.body.appendChild(modal);

  document.getElementById('confirmModalOk').addEventListener('click', () => { SFX.play('menuClose'); modal.remove(); onConfirm?.(); });
  document.getElementById('confirmModalCancel').addEventListener('click', () => { SFX.play('menuClose'); modal.remove(); onCancel?.(); });
  modal.addEventListener('click', e => { if (e.target === modal) { SFX.play('menuClose'); modal.remove(); onCancel?.(); } });
}

function showInfoModal(tabId) {
  const INFO = {
    tabGang: {
      title: '💀 LE GANG',
      body: `
        <strong>Réputation</strong> — Débloque zones, quêtes et achats. Visible dans la barre en haut à droite.<br><br>
        <strong>Argent (₽)</strong> — Les récompenses de combat s'accumulent dans les zones. Récupère-les via le bouton ₽ jaune (un combat est nécessaire).<br><br>
        <strong>Boss</strong> — Ton avatar. Assigne jusqu'à <strong>3 Pokémon</strong> à son équipe depuis le PC.<br><br>
        <strong>Sac</strong> — Clique sur une Ball pour l'activer. Clique sur un boost pour le lancer. L'incubateur ouvre la gestion des œufs.<br><br>
        <span class="dim">Conseil : assigne tes meilleurs Pokémon au Boss pour maximiser tes chances en combat.</span>
      `
    },
    tabAgents: {
      title: '👥 AGENTS',
      body: `
        <strong>CAP (Capture)</strong> — Chance de capturer automatiquement des Pokémon dans les zones non-ouvertes. Plus c'est haut, plus l'agent est efficace.<br><br>
        <strong>LCK (Chance)</strong> — Influence la rareté des captures passives et la qualité des récompenses de coffres.<br><br>
        <strong>ATK (Combat)</strong> — Puissance en combat automatique. Un agent fort bat des dresseurs difficiles.<br><br>
        <strong>Grade</strong> — Grunt → Lieutenant (50+ combats gagnés) → Captain (200+). Chaque grade donne un bonus ATK.<br><br>
        <strong>Zone assignée</strong> — L'agent farm passivement : captures, combats contre dresseurs, ouverture de coffres.<br><br>
        <span class="dim">Un agent sans zone assignée ne fait rien. Assigne-les toujours !</span>
      `
    },
    tabZones: {
      title: '🗺️ ZONES',
      body: `
        <strong>Zone de capture</strong> (field / safari / water / cave) — Des Pokémon sauvages apparaissent. Agents et Boss capturent automatiquement.<br><br>
        <strong>Zone d'arène</strong> (gym / elite) — Uniquement des combats. Récompenses en ₽ et réputation élevées.<br><br>
        <strong>Récolte ₽</strong> — Les gains de combat s'accumulent (icône jaune ₽). Clique pour lancer une récolte avec combat défensif.<br><br>
        <strong>Maîtrise ★</strong> — Augmente avec les victoires. Améliore les spawns et débloque des dresseurs élites.<br><br>
        <strong>Slots d'agents</strong> — Coût en réputation, croissant avec le niveau de la zone.<br><br>
        <span class="dim">Les zones dégradées (⚠) n'ont que des combats — remonte ta réputation pour les débloquer.</span>
      `
    },
    tabMarket: {
      title: '💰 MARCHÉ',
      body: `
        <strong>Quêtes horaires</strong> — 3 quêtes Moyennes + 2 Difficiles, réinitialisées toutes les heures. Reroll possible contre 10 rep.<br><br>
        <strong>Histoire & Objectifs</strong> — Quêtes permanentes liées à la progression. Complète-les pour des grosses récompenses.<br><br>
        <strong>Balls</strong> — Chaque type améliore le potentiel max capturé. Troc (onglet Troc) : 10 PB→1 GB, 10 GB→1 UB, 100 UB⇄1 MB.<br><br>
        <strong>Multiplicateur ×1/×5/×10</strong> — Achète en lot depuis la boutique.<br><br>
        <strong>Boosts temporaires</strong> — S'activent depuis le Sac dans la fenêtre de zone. Durée 60–90s.<br><br>
        <span class="dim">Vends des Pokémon depuis le PC pour financer tes achats.</span>
      `
    },
    tabPC: {
      title: '💻 PC',
      body: `
        <strong>Potentiel ★</strong> — Permanent, détermine le plafond de puissance. ★5 = top tier. Dépend de la Ball utilisée.<br><br>
        <strong>Nature</strong> — Chaque nature booste 2 stats et en pénalise 1. <em>Hardy</em> = équilibré.<br><br>
        <strong>ATK/DEF/SPD</strong> — Calculées depuis base × nature × niveau × potentiel.<br><br>
        <strong>Vente</strong> — Prix = rareté × potentiel × nature. Pas de malus de revente.<br><br>
        <strong>Labo</strong> — Fais évoluer tes Pokémon (pierre ou niveau requis).<br><br>
        <strong>Pension</strong> — 2 Pokémon compatibles → oeuf. Nécessite un incubateur. Les Pokémon de pension ont le "mal du pays" et ne peuvent pas être vendus.<br><br>
        <strong>Oeufs</strong> — Gère tes oeufs en attente d'incubation ou prêts à éclore.<br><br>
        <span class="dim">Filtre par rareté, type ou shiny pour retrouver facilement tes Pokémon.</span>
      `
    },
    tabPokedex: {
      title: '📖 POKÉDEX',
      body: `
        <strong>Vu 👁</strong> — Tu as aperçu ce Pokémon dans une zone (spawn visible).<br><br>
        <strong>Capturé ✓</strong> — Tu en possèdes au moins un dans ton PC.<br><br>
        <strong>Shiny ✨</strong> — Tu as capturé une version chromatique. Chance de base très faible, boostée par l'Aura Shiny.<br><br>
        <strong>Progression</strong> — Compléter le Pokédex donne des bonus de réputation et de récompenses de quêtes.<br><br>
        <span class="dim">Les légendaires et très rares n'apparaissent que dans des zones spécifiques avec le bon équipement.</span>
      `
    },
  };

  const info = INFO[tabId];
  if (!info) return;

  document.getElementById('infoModalTitle').textContent = info.title;
  document.getElementById('infoModalBody').innerHTML = info.body;
  document.getElementById('infoModal').classList.add('active');
}

// ════════════════════════════════════════════════════════════════
//  4.  POKEMON MODULE
// ════════════════════════════════════════════════════════════════

function rollNature() { return pick(NATURE_KEYS); }

function rollPotential(ballType) {
  const dist = BALLS[ballType]?.potential || BALLS.pokeball.potential;
  const r = Math.random() * 100;
  let acc = 0;
  let result = 1;
  for (let i = 0; i < dist.length; i++) {
    acc += dist[i];
    if (r < acc) { result = i + 1; break; }
  }
  // Lucky Incense: +1 potential (capped at 5)
  if (isBoostActive('incense') && result < 5) result++;
  return result;
}

function rollShiny() {
  // Shiny Aura: x5 rate (1/40 instead of 1/200) ; Chroma Charm: ×2 permanent
  let rate = isBoostActive('aura') ? 0.025 : 0.005;
  if (state?.purchases?.chromaCharm) rate *= 2;
  return Math.random() < rate;
}

function rollMoves(speciesEN) {
  const sp = SPECIES_BY_EN[speciesEN];
  if (!sp) return ['Charge', 'Griffe'];
  const pool = [...sp.moves];
  // Shuffle and pick 2 unique (or as many as available)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const unique = [...new Set(pool)];
  return unique.slice(0, 2);
}

function calculateStats(pokemon) {
  const sp = SPECIES_BY_EN[pokemon.species_en];
  if (!sp) return { atk: 10, def: 10, spd: 10 };
  const nat = NATURES[pokemon.nature] || NATURES.hardy;
  const potMult = 1 + pokemon.potential * 0.1;
  const lvlMult = 1 + pokemon.level / 100;
  return {
    atk: Math.round(sp.baseAtk * potMult * nat.atk * lvlMult),
    def: Math.round(sp.baseDef * potMult * nat.def * lvlMult),
    spd: Math.round(sp.baseSpd * potMult * nat.spd * lvlMult),
  };
}

function makePokemon(speciesEN, zoneId, ballType = 'pokeball') {
  const sp = SPECIES_BY_EN[speciesEN];
  if (!sp) return null;
  const nature = rollNature();
  const potential = rollPotential(ballType);
  const shiny = rollShiny();
  const level = randInt(3, 12);
  const pokemon = {
    id: `pk-${uid()}`,
    species_fr: sp.fr,
    species_en: sp.en,
    dex: sp.dex,
    level,
    xp: 0,
    nature,
    potential,
    shiny,
    moves: rollMoves(speciesEN),
    capturedIn: zoneId,
    stats: {},
    assignedTo: null,
    cooldown: 0,
    history: [],
    favorite: false,
  };
  pokemon.stats = calculateStats(pokemon);
  // Initial history entry
  pokemon.history.push({ type: 'captured', ts: Date.now(), zone: zoneId, ball: ballType });
  // Track most expensive obtained
  const obtainedValue = calculatePrice(pokemon);
  if (!state.stats.mostExpensiveObtained || obtainedValue > (state.stats.mostExpensiveObtained.price || 0)) {
    state.stats.mostExpensiveObtained = { name: speciesName(pokemon.species_en), price: obtainedValue };
  }
  return pokemon;
}

function getPokemonPower(pokemon) {
  const s = pokemon.stats;
  return Math.round((s.atk + s.def + s.spd) * (pokemon.homesick ? 0.75 : 1));
}

// → Moved to data/evolutions-data.js
function checkEvolution(pokemon) {
  const evos = EVO_BY_SPECIES[pokemon.species_en];
  if (!evos) return null;
  for (const evo of evos) {
    if (evo.req === 'item') continue; // item evolutions handled separately
    if (typeof evo.req === 'number' && pokemon.level >= evo.req) {
      return evo;
    }
  }
  return null;
}

function evolvePokemon(pokemon, targetEN) {
  const sp = SPECIES_BY_EN[targetEN];
  if (!sp) return false;
  const oldName = speciesName(pokemon.species_en);
  pokemon.species_en = sp.en;
  pokemon.species_fr = sp.fr;
  pokemon.dex = sp.dex;
  pokemon.stats = calculateStats(pokemon);
  pokemon.moves = rollMoves(sp.en);
  if (pokemon.history) {
    pokemon.history.push({ type: 'evolved', ts: Date.now(), from: oldName, to: speciesName(sp.en) });
  }
  // Update pokedex
  if (!state.pokedex[sp.en]) {
    state.pokedex[sp.en] = { seen: true, caught: true, shiny: pokemon.shiny, count: 1 };
  } else {
    state.pokedex[sp.en].caught = true;
    state.pokedex[sp.en].count++;
  }
  showPokemonLevelPopup(pokemon, pokemon.level);
  notify(`${oldName} ${state.lang === 'fr' ? 'évolue en' : 'evolved into'} ${speciesName(sp.en)} !`, 'gold');
  SFX.play('evolve'); // Evolution fanfare
  saveState();
  return true;
}

function tryAutoEvolution(pokemon) {
  const evo = checkEvolution(pokemon);
  if (evo) {
    evolvePokemon(pokemon, evo.to);
    return true;
  }
  return false;
}

function showPokemonLevelPopup(pokemon, newLevel) {
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;bottom:80px;right:16px;background:var(--bg-card);border:1px solid var(--gold-dim);border-radius:var(--radius);padding:8px 12px;font-family:var(--font-pixel);font-size:9px;color:var(--gold);z-index:9999;display:flex;align-items:center;gap:8px;animation:fadeIn .2s ease;pointer-events:none';
  el.innerHTML = `<img src="${pokeSprite(pokemon.species_en, pokemon.shiny)}" style="width:32px;height:32px"><span>${speciesName(pokemon.species_en)}<br>Lv.${newLevel} !</span>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

function levelUpPokemon(pokemon, xpGain) {
  pokemon.xp += xpGain;
  const xpNeeded = pokemon.level * 20;
  let leveled = false;
  while (pokemon.xp >= xpNeeded && pokemon.level < 100) {
    pokemon.xp -= xpNeeded;
    pokemon.level++;
    leveled = true;
    if (pokemon.history) {
      pokemon.history.push({ type: 'levelup', ts: Date.now(), level: pokemon.level });
    }
  }
  if (leveled) {
    pokemon.stats = calculateStats(pokemon);
    tryAutoEvolution(pokemon);
    // Show popup only for boss team / active training (not passive background XP spam)
    const isBossTeam = state.gang.bossTeam.includes(pokemon.id);
    const isInTraining = state.trainingRoom?.pokemon?.includes(pokemon.id);
    if (isBossTeam || isInTraining) {
      playSE('level_up', 0.5);
      showPokemonLevelPopup(pokemon, pokemon.level);
      SFX.play('levelUp')
    }
  }
  return leveled;
}

// ════════════════════════════════════════════════════════════════
//  5.  ZONE MODULE
// ════════════════════════════════════════════════════════════════

// Coûts en ₽ pour débloquer des slots d'agents par zone
// slot 2 → 2000₽, slot 3 → 6000₽, etc.
const ZONE_SLOT_COSTS = [2000, 6000, 15000, 50000, 150000]; // base costs (₽)

// → Moved to data/titles-data.js
const LIAISONS = ['', 'de', "de l'", 'du', 'des', 'à', 'et', '&', 'alias', 'dit'];

function getTitleLabel(titleId) {
  return TITLES.find(t => t.id === titleId)?.label || '';
}

function getBossFullTitle() {
  const t1 = getTitleLabel(state.gang.titleA);
  const t2 = getTitleLabel(state.gang.titleB);
  const lia = state.gang.titleLiaison || '';
  if (!t1 && !t2) return 'Recrue';
  if (t1 && !t2) return t1;
  if (!t1 && t2) return t2;
  return `${t1}${lia ? ' ' + lia : ''} ${t2}`;
}

function checkTitleUnlocks() {
  const unlocked = new Set(state.unlockedTitles || []);
  const newOnes = [];
  for (const t of TITLES) {
    if (unlocked.has(t.id)) continue;
    let unlock = false;
    if (t.category === 'rep') {
      unlock = state.gang.reputation >= t.repReq;
    } else if (t.category === 'type_capture') {
      const count = state.pokemons.filter(p => {
        const sp = POKEMON_GEN1.find(s => s.en === p.species_en);
        return sp?.types?.includes(t.typeReq);
      }).length;
      unlock = count >= t.countReq;
    } else if (t.category === 'stat') {
      unlock = (state.stats[t.statReq] || 0) >= t.countReq;
    } else if (t.category === 'special' && t.id === 'fondateur') {
      unlock = true; // toujours débloqué
    } else if (t.category === 'special' && t.id === 'glitcheur') {
      unlock = state.pokemons.some(p => p.species_en === 'missingno');
    } else if (t.category === 'pokedex') {
      if (t.dexType === 'kanto') {
        const kantoCount = POKEMON_GEN1.filter(s => !s.hidden && s.dex >= 1 && s.dex <= 151 && state.pokedex[s.en]?.caught).length;
        const kantoTotal = POKEMON_GEN1.filter(s => !s.hidden && s.dex >= 1 && s.dex <= 151).length;
        unlock = kantoCount >= kantoTotal;
      } else if (t.dexType === 'full') {
        const fullCount = POKEMON_GEN1.filter(s => !s.hidden && state.pokedex[s.en]?.caught).length;
        const fullTotal = POKEMON_GEN1.filter(s => !s.hidden).length;
        unlock = fullCount >= fullTotal;
      }
    } else if (t.category === 'shiny_special') {
      if (t.shinyType === 'starters') {
        unlock = ['bulbasaur','charmander','squirtle'].every(s => state.pokedex[s]?.shiny);
      } else if (t.shinyType === 'legendaries') {
        unlock = POKEMON_GEN1.filter(s => s.rarity === 'legendary' && !s.hidden).every(s => state.pokedex[s.en]?.shiny);
      } else if (t.shinyType === 'full_dex') {
        unlock = POKEMON_GEN1.filter(s => !s.hidden).every(s => state.pokedex[s.en]?.shiny);
      }
    }
    if (unlock) { unlocked.add(t.id); newOnes.push(t); }
  }
  if (newOnes.length > 0) {
    state.unlockedTitles = [...unlocked];
    // Set default titleA to best rep title
    if (!state.gang.titleA) state.gang.titleA = state.unlockedTitles[0] || 'recrue';
    newOnes.forEach(t => notify(`🏆 Titre débloqué : "${t.label}" !`, 'gold'));
    saveState();
  }
}

function updateDiscovery() {
  if (!state.settings.discoveryMode) {
    // Tout visible — aucune restriction
    ['tabMarket','tabPokedex','tabMissions','tabAgents','tabBattleLog','tabCosmetics'].forEach(id => {
      const btn = document.querySelector(`[data-tab="${id}"]`);
      if (btn) btn.style.display = '';
    });
    return;
  }

  const dexCaught = Object.values(state.pokedex).filter(e => e.caught).length;
  const totalFightsWon = state.stats?.totalFightsWon || 0;

  // Marché : débloqué quand 0 balls pour la première fois
  if (!state.discoveryProgress.marketUnlocked) {
    const totalBalls = getTotalBalls();
    if (totalBalls === 0) {
      state.discoveryProgress.marketUnlocked = true;
      saveState();
      notify('🏪 Le Marché est maintenant accessible ! Achète des Balls pour continuer.', 'gold');
    }
  }

  // Pokédex : débloqué quand 5+ espèces capturées
  if (!state.discoveryProgress.pokedexUnlocked && dexCaught >= 5) {
    state.discoveryProgress.pokedexUnlocked = true;
    saveState();
    notify('📖 Le Pokédex est maintenant accessible !', 'gold');
  }

  // Agents : débloqué quand 3+ combats gagnés
  if (!state.discoveryProgress.agentsUnlocked && totalFightsWon >= 3) {
    state.discoveryProgress.agentsUnlocked = true;
    saveState();
    notify('👥 Les Agents sont maintenant accessibles ! Assigne des Pokémon pour récolter en automatique.', 'gold');
  }

  // Missions : débloqué quand 10+ combats gagnés
  if (!state.discoveryProgress.missionsUnlocked && totalFightsWon >= 10) {
    state.discoveryProgress.missionsUnlocked = true;
    saveState();
    notify('📋 Les Missions sont maintenant accessibles !', 'gold');
  }

  // Log de combat : débloqué quand 15+ combats gagnés
  if (!state.discoveryProgress.battleLogUnlocked && totalFightsWon >= 15) {
    state.discoveryProgress.battleLogUnlocked = true;
    saveState();
    notify('⚔ Le Log de combat est maintenant accessible !', 'gold');
  }

  // Cosmétiques : débloqué quand 30+ combats gagnés
  if (!state.discoveryProgress.cosmeticsUnlocked && totalFightsWon >= 30) {
    state.discoveryProgress.cosmeticsUnlocked = true;
    saveState();
    notify('🎨 Les Cosmétiques sont maintenant accessibles !', 'gold');
  }

  // Appliquer la visibilité
  // PC (Pokémon) : TOUJOURS visible, jamais masqué
  const pcBtn = document.querySelector('[data-tab="tabPC"]');
  if (pcBtn) pcBtn.style.display = '';

  const marketBtn = document.querySelector('[data-tab="tabMarket"]');
  if (marketBtn) marketBtn.style.display = state.discoveryProgress.marketUnlocked ? '' : 'none';

  const dexBtn = document.querySelector('[data-tab="tabPokedex"]');
  if (dexBtn) dexBtn.style.display = state.discoveryProgress.pokedexUnlocked ? '' : 'none';

  const agentsBtn = document.querySelector('[data-tab="tabAgents"]');
  if (agentsBtn) agentsBtn.style.display = state.discoveryProgress.agentsUnlocked ? '' : 'none';

  const missionsBtn = document.querySelector('[data-tab="tabMissions"]');
  if (missionsBtn) missionsBtn.style.display = state.discoveryProgress.missionsUnlocked ? '' : 'none';

  const battleLogBtn = document.querySelector('[data-tab="tabBattleLog"]');
  if (battleLogBtn) battleLogBtn.style.display = state.discoveryProgress.battleLogUnlocked ? '' : 'none';

  const cosmeticsBtn = document.querySelector('[data-tab="tabCosmetics"]');
  if (cosmeticsBtn) cosmeticsBtn.style.display = state.discoveryProgress.cosmeticsUnlocked ? '' : 'none';
}

function openTitleModal() {
  const unlocked = new Set(state.unlockedTitles || []);
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9700;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;padding:16px';

  // Slot colors: 1=gold, 2=red, 3=cyan, 4=violet
  const SLOT_DEFS = [
    { key:'titleA', label:'Titre 1', color:'var(--gold)',     bg:'rgba(255,204,90,.15)' },
    { key:'titleB', label:'Titre 2', color:'var(--red)',      bg:'rgba(204,51,51,.15)' },
    { key:'titleC', label:'Badge 1', color:'#4fc3f7',         bg:'rgba(79,195,247,.12)' },
    { key:'titleD', label:'Badge 2', color:'#ce93d8',         bg:'rgba(206,147,216,.12)' },
  ];

  const categories = {
    rep:'Réputation', type_capture:'Type', stat:'Exploit',
    shop:'Boutique', special:'Spécial',
    pokedex:'Pokédex', shiny_special:'Chromatique'
  };

  let _activeSlot = 0; // index into SLOT_DEFS

  const renderModal = () => {
    const slots = SLOT_DEFS.map(s => state.gang[s.key]);
    const lia = state.gang.titleLiaison || '';
    const activeSlotDef = SLOT_DEFS[_activeSlot];

    const liaOptions = LIAISONS.map(l => `<option value="${l}" ${l === lia ? 'selected' : ''}>${l || '(aucun)'}</option>`).join('');

    // ── Slot selector buttons ──────────────────────────────────
    const slotBtns = SLOT_DEFS.map((s, i) => {
      const isActive = i === _activeSlot;
      const val = slots[i];
      const lbl = val ? getTitleLabel(val) : '—';
      return `<button class="slot-sel-btn" data-slot="${i}"
        style="flex:1;font-family:var(--font-pixel);font-size:7px;padding:5px 4px;border-radius:var(--radius-sm);cursor:pointer;
               background:${isActive ? s.bg : 'var(--bg)'};
               border:2px solid ${isActive ? s.color : 'var(--border)'};
               color:${isActive ? s.color : 'var(--text-dim)'}">
        ${s.label}<br><span style="font-size:6px;opacity:.8">${lbl}</span>
      </button>`;
    }).join('');

    // ── Liaison row (only relevant for titleA+titleB) ──────────
    const liaRow = `<div style="display:flex;gap:6px;align-items:center;justify-content:center;flex-wrap:wrap;margin-top:6px">
      <span style="font-size:8px;color:var(--text-dim)">Liaison :</span>
      <select id="titleLiaison" style="background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;font-size:8px;padding:2px 4px">${liaOptions}</select>
      <button id="btnClearTitles" style="font-size:7px;padding:2px 6px;background:var(--bg);border:1px solid var(--border);border-radius:3px;color:var(--text-dim);cursor:pointer">Tout effacer</button>
    </div>`;

    let titlesHtml = '';
    for (const [cat, catLabel] of Object.entries(categories)) {
      const group = TITLES.filter(t => t.category === cat);
      if (group.length === 0) continue;
      titlesHtml += `<div style="margin-bottom:12px">
        <div style="font-family:var(--font-pixel);font-size:8px;color:var(--text-dim);margin-bottom:6px;text-transform:uppercase;letter-spacing:1px">${catLabel}</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">`;
      for (const t of group) {
        const isUnlocked = unlocked.has(t.id);
        const slotIdx = slots.findIndex(s => s === t.id);
        let hint = '';
        if (!isUnlocked) {
          if (t.category === 'rep') hint = `⭐ ${t.repReq} rep`;
          else if (t.category === 'type_capture') hint = `${t.countReq}× type ${t.typeReq}`;
          else if (t.category === 'stat') hint = `${t.countReq}× ${t.statReq}`;
          else if (t.category === 'shop') hint = `${(t.shopPrice||0).toLocaleString()}₽`;
          else if (t.category === 'pokedex') hint = t.dexType === 'kanto' ? 'Compléter le Pokédex Kanto (151)' : 'Compléter tout le Pokédex';
          else if (t.category === 'shiny_special') hint = t.shinyType === 'starters' ? '3 starters chromatiques' : t.shinyType === 'legendaries' ? 'Tous légendaires chromatiques' : 'Pokédex chromatique complet';
          else hint = '???';
        }
        const assigned = slotIdx >= 0;
        const assignedColor = assigned ? SLOT_DEFS[slotIdx].color : '';
        const assignedBg    = assigned ? SLOT_DEFS[slotIdx].bg    : '';
        const style = isUnlocked
          ? `background:${assigned ? assignedBg : 'var(--bg-card)'};border:1px solid ${assigned ? assignedColor : 'var(--border)'};color:${assigned ? assignedColor : 'var(--text)'};cursor:pointer`
          : 'background:var(--bg);border:1px solid var(--border);color:var(--text-dim);opacity:.4;cursor:not-allowed';
        const badge = assigned ? ` <span style="font-size:6px;opacity:.7">${SLOT_DEFS[slotIdx].label}</span>` : '';
        titlesHtml += `<div class="title-chip ${isUnlocked ? 'title-unlocked' : 'title-locked'}" data-title-id="${t.id}"
          style="font-family:var(--font-pixel);font-size:8px;padding:4px 8px;border-radius:var(--radius-sm);${style}"
          title="${isUnlocked ? (assigned ? `Slot: ${SLOT_DEFS[slotIdx].label} — Cliquer pour retirer` : `Assigner au ${activeSlotDef.label}`) : hint}">
          ${t.label}${badge}
        </div>`;
      }
      titlesHtml += '</div></div>';
    }

    // Current title preview
    const mainTitle = getBossFullTitle();
    const tC = getTitleLabel(state.gang.titleC);
    const tD = getTitleLabel(state.gang.titleD);
    const badgesPreview = [tC, tD].filter(Boolean).map((b, i) => {
      const color = i === 0 ? '#4fc3f7' : '#ce93d8';
      return `<span style="font-family:var(--font-pixel);font-size:7px;padding:2px 6px;border-radius:10px;border:1px solid ${color};color:${color}">${b}</span>`;
    }).join('');

    overlay.innerHTML = `
      <div style="background:var(--bg-panel);border:2px solid var(--gold);border-radius:var(--radius);padding:20px;max-width:600px;width:100%;max-height:85vh;display:flex;flex-direction:column;gap:12px;overflow:hidden">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-family:var(--font-pixel);font-size:11px;color:var(--gold)">🏆 Titres</div>
          <button id="btnCloseTitleModal" style="background:none;border:none;color:var(--text-dim);font-size:18px;cursor:pointer">✕</button>
        </div>
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px;text-align:center">
          <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold-dim);margin-bottom:4px">${mainTitle}</div>
          ${badgesPreview ? `<div style="display:flex;gap:6px;justify-content:center;margin-bottom:4px">${badgesPreview}</div>` : ''}
          ${liaRow}
        </div>
        <div style="display:flex;gap:6px">
          <span style="font-size:8px;color:var(--text-dim);align-self:center;white-space:nowrap">Slot actif :</span>
          ${slotBtns}
        </div>
        <div style="font-size:8px;color:var(--text-dim);text-align:center">
          Clic → Assigner au <span style="color:${activeSlotDef.color}">${activeSlotDef.label}</span> &nbsp;|&nbsp; Clic sur badge → Retirer
        </div>
        <div style="overflow-y:auto;flex:1">${titlesHtml}</div>
      </div>`;

    overlay.querySelector('#btnCloseTitleModal')?.addEventListener('click', () => overlay.remove());
    overlay.querySelector('#titleLiaison')?.addEventListener('change', e => {
      state.gang.titleLiaison = e.target.value;
      saveState(); renderModal();
      if (activeTab === 'tabGang') renderGangTab();
    });
    overlay.querySelector('#btnClearTitles')?.addEventListener('click', () => {
      state.gang.titleA = 'recrue'; state.gang.titleB = null;
      state.gang.titleC = null;    state.gang.titleD = null;
      saveState(); renderModal();
      if (activeTab === 'tabGang') renderGangTab();
    });

    // Slot selector clicks
    overlay.querySelectorAll('.slot-sel-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _activeSlot = Number(btn.dataset.slot);
        renderModal();
      });
    });

    // Title chip clicks
    overlay.querySelectorAll('.title-unlocked').forEach(chip => {
      chip.addEventListener('click', () => {
        const id = chip.dataset.titleId;
        const slotKey = SLOT_DEFS[_activeSlot].key;
        // If already in this slot → deselect
        if (state.gang[slotKey] === id) {
          state.gang[slotKey] = _activeSlot === 0 ? 'recrue' : null;
        } else {
          // Remove from any other slot first (avoid duplicates)
          for (const s of SLOT_DEFS) {
            if (state.gang[s.key] === id) state.gang[s.key] = s.key === 'titleA' ? null : null;
          }
          state.gang[slotKey] = id;
        }
        saveState(); renderModal();
        if (activeTab === 'tabGang') renderGangTab();
      });
    });
  };

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  renderModal();
}

function getZoneSlotCost(zoneId, slotIndex) {
  const base = ZONE_SLOT_COSTS[slotIndex] ?? 9999;
  const zone = ZONE_BY_ID[zoneId];
  // tier based on zone unlock reputation: higher zone = more expensive slots
  const rep = zone?.rep || 0;
  const tier = rep < 50 ? 1 : rep < 150 ? 1.5 : rep < 300 ? 2 : rep < 600 ? 3 : rep < 1000 ? 4 : 5;
  return Math.round(base * tier);
}

function initZone(zoneId) {
  if (!state.zones[zoneId]) {
    state.zones[zoneId] = {
      unlocked: false,
      combatsWon: 0,
      captures: 0,
      assignedAgents: [],
      pendingIncome: 0,
      pendingItems: {},
      slots: 1,
    };
  }
  // Migration
  if (state.zones[zoneId].captures === undefined) state.zones[zoneId].captures = 0;
  if (state.zones[zoneId].pendingIncome === undefined) state.zones[zoneId].pendingIncome = 0;
  if (state.zones[zoneId].pendingItems === undefined) state.zones[zoneId].pendingItems = {};
  if (state.zones[zoneId].slots === undefined) state.zones[zoneId].slots = 1;
  // Remove legacy invest fields
  delete state.zones[zoneId].invested;
  delete state.zones[zoneId].investPower;
  return state.zones[zoneId];
}

function isZoneUnlocked(zoneId) {
  const zone = ZONE_BY_ID[zoneId];
  if (!zone) return false;
  // Check if zone was previously accessed (degraded mode: rep dropped, but still accessible)
  const zoneState = state.zones[zoneId];
  const wasPreviouslyAccessed = zoneState && (zoneState.combatsWon > 0 || zoneState.invested > 0 || zoneState.captures > 0);
  if (wasPreviouslyAccessed) {
    // Zone stays open (degraded if rep dropped), but still check unlock item
    if (zone.unlockItem && !state.purchases?.[zone.unlockItem]) return false;
    return true;
  }
  // Never visited: requires full conditions
  if (state.gang.reputation < zone.rep) return false;
  if (zone.unlockItem && !state.purchases?.[zone.unlockItem]) return false;
  // Cities (gyms) require sequential unlock: previous city must be defeated
  if (zone.type === 'city') {
    const idx = GYM_ORDER.indexOf(zoneId);
    if (idx > 0) {
      const prevId = GYM_ORDER[idx - 1];
      if (!state.zones[prevId]?.gymDefeated) return false;
    }
  }
  return true;
}

// Is a zone in "degraded" mode? (rep below threshold → combat only, no pokemon spawns)
function isZoneDegraded(zoneId) {
  const zone = ZONE_BY_ID[zoneId];
  if (!zone || zone.rep === 0) return false;
  return state.gang.reputation < zone.rep;
}

function getZoneMastery(zoneId) {
  const z = state.zones[zoneId];
  if (!z) return 0;
  if (z.combatsWon >= 50) return 3;
  if (z.combatsWon >= 10) return 2;
  return 1;
}

function getZoneAgentSlots(zoneId) {
  const m = getZoneMastery(zoneId);
  if (m >= 3) return 2;
  if (m >= 2) return 1;
  return 0;
}

// Open zone windows tracking
const openZones = new Set();
const zoneSpawnTimers = {};
const zoneSpawns = {}; // zoneId -> [{ type, data, el, timeout }]

function makeTrainerTeam(zone, trainerKey, forcedSize) {
  const trainer = TRAINER_TYPES[trainerKey];
  if (!trainer) return [];
  const teamSize = forcedSize ?? clamp(trainer.diff, 1, 3);
  const team = [];
  for (let i = 0; i < teamSize; i++) {
    const sp = pick(zone.pool);
    const level = randInt(5 + trainer.diff * 3, 10 + trainer.diff * 5);
    team.push({ species_en: sp, level, stats: calculateStats({ species_en: sp, level, nature: 'hardy', potential: 2 }) });
  }
  return team;
}

// Build a raid: 2-3 trainers combined into one encounter
function makeRaidSpawn(zone, zoneId) {
  const trainerKeys = zone.trainers.length >= 2
    ? [pick(zone.trainers), pick(zone.trainers), zone.eliteTrainer || pick(zone.trainers)]
    : [zone.eliteTrainer || 'acetrainer', zone.eliteTrainer || 'acetrainer', zone.eliteTrainer || 'acetrainer'];

  // Pick 2-3 distinct trainers
  const numTrainers = randInt(2, 3);
  const raidTrainers = [];
  const usedKeys = [];
  for (let i = 0; i < numTrainers; i++) {
    let key = pick(trainerKeys);
    if (!TRAINER_TYPES[key]) key = zone.eliteTrainer || 'acetrainer';
    raidTrainers.push({
      key,
      trainer: TRAINER_TYPES[key],
      team: makeTrainerTeam(zone, key, 2),
    });
    usedKeys.push(key);
  }

  // Combined enemy team (all trainers' Pokémon)
  const combinedTeam = raidTrainers.flatMap(rt => rt.team);

  // Combined reward + rep (sum of all trainers, x1.5)
  const totalReward = raidTrainers.reduce((s, rt) => {
    return [s[0] + rt.trainer.reward[0], s[1] + rt.trainer.reward[1]];
  }, [0, 0]).map(v => Math.round(v * 1.5));
  const totalRep = Math.round(raidTrainers.reduce((s, rt) => s + rt.trainer.rep, 0) * 1.5);
  const maxDiff = Math.max(...raidTrainers.map(rt => rt.trainer.diff));

  return {
    type: 'raid',
    raidTrainers,
    trainerKey: raidTrainers[0].key,
    trainer: {
      ...raidTrainers[0].trainer,
      fr: `[RAID] (${numTrainers} dresseurs)`,
      en: `[RAID] (${numTrainers} trainers)`,
      sprite: raidTrainers[0].key,
      diff: maxDiff + 1,
      reward: totalReward,
      rep: totalRep,
    },
    team: combinedTeam,
    isRaid: true,
  };
}

function spawnInZone(zoneId) {
  const zone = ZONE_BY_ID[zoneId];
  if (!zone) return null;
  const zState = initZone(zoneId);
  const isDegraded = isZoneDegraded(zoneId);
  const isChestBoosted = isBoostActive('chestBoost');
  const r = Math.random();

  // DEGRADED MODE: rep dropped below zone threshold — combat only (no pokemon, no chests, no events)
  if (isDegraded) {
    if (zone.trainers.length > 0) {
      const trainerKey = pick(zone.trainers);
      const trainer = TRAINER_TYPES[trainerKey];
      if (trainer) return { type: 'trainer', trainerKey, trainer, team: makeTrainerTeam(zone, trainerKey) };
    }
    return null;
  }

  // 1. Treasure chest (5% base, 25% during chest event)
  const chestChance = isChestBoosted ? 0.25 : 0.05;
  if (r < chestChance) {
    return { type: 'chest' };
  }

  // 2. Special event (mastery >= 1, i.e. always possible in active zones)
  const canEvent = getZoneMastery(zoneId) >= 1;
  if (canEvent && r < chestChance + 0.08) {
    const eligible = SPECIAL_EVENTS.filter(ev =>
      state.gang.reputation >= ev.minRep &&
      !state.activeEvents[zoneId] && // no stacking
      (!ev.zoneIds || ev.zoneIds.includes(zoneId)) // zone-specific filter
    );
    if (eligible.length > 0) {
      const event = pick(eligible);
      return { type: 'event', event };
    }
  }

  // 3. Elite trainer (mastery >= 2, i.e. 10+ wins in zone)
  if (getZoneMastery(zoneId) >= 2 && zone.eliteTrainer && r < chestChance + 0.13) {
    const trainerKey = zone.eliteTrainer;
    const trainer = TRAINER_TYPES[trainerKey];
    if (trainer) {
      // Elite: boosted difficulty (diff+2), bigger team, better rewards
      const eliteDiff = trainer.diff + 2;
      const teamSize = clamp(eliteDiff, 2, 4);
      const team = [];
      for (let i = 0; i < teamSize; i++) {
        const sp = pick(zone.pool);
        const level = randInt(10 + eliteDiff * 4, 20 + eliteDiff * 6);
        team.push({ species_en: sp, level, stats: calculateStats({ species_en: sp, level, nature: 'hardy', potential: 3 }) });
      }
      const eliteTrainer = {
        ...trainer,
        fr: '⭐ ' + trainer.fr,
        en: '⭐ ' + trainer.en,
        diff: eliteDiff,
        reward: [trainer.reward[0] * 3, trainer.reward[1] * 3],
        rep: trainer.rep * 2,
      };
      return { type: 'trainer', trainerKey, trainer: eliteTrainer, team, elite: true };
    }
  }

  // 4. Raid — 2+ agents (or boss+agent) in zone → group combat (~10%)
  const zoneAgentCount = state.agents.filter(a => a.assignedZone === zoneId).length;
  const bossHere = state.gang.bossZone === zoneId;
  const canRaid = (zoneAgentCount >= 2 || (zoneAgentCount >= 1 && bossHere)) && zone.trainers.length > 0;
  if (canRaid && r < 0.30 + 0.10) {
    return makeRaidSpawn(zone, zoneId);
  }

  // 5. Normal trainer (20%)
  if (r < 0.30 && zone.trainers.length > 0) {
    const trainerKey = pick(zone.trainers);
    const trainer = TRAINER_TYPES[trainerKey];
    const team = makeTrainerTeam(zone, trainerKey);
    return { type: 'trainer', trainerKey, trainer, team };
  }

  // 5. City zones — extra trainer chance (no fallback to combat-only, pokemon can also spawn)
  if (zone.type === 'city' && r < 0.55 && zone.trainers.length > 0) {
    const trainerKey = pick(zone.trainers);
    const trainer = TRAINER_TYPES[trainerKey];
    if (trainer) return { type: 'trainer', trainerKey, trainer, team: makeTrainerTeam(zone, trainerKey) };
  }

  // 6. Pokemon spawn — Rare Scope triples chance of rare+ species
  let speciesEN;
  // Safari rarePool: 10% chance to pick from rare uncapturable pool (boosted by rarescope)
  const rarePoolChance = zone.rarePool ? (isBoostActive('rarescope') ? 0.30 : 0.10) : 0;
  if (zone.rarePool && Math.random() < rarePoolChance) {
    speciesEN = weightedPick(zone.rarePool);
  } else if (isBoostActive('rarescope') && Math.random() < 0.5) {
    const filteredRare = zone.pool.filter(en => {
      const sp = SPECIES_BY_EN[en];
      return sp && (sp.rarity === 'rare' || sp.rarity === 'very_rare');
      // légendaires exclus du boost rarescope
    });
    speciesEN = filteredRare.length > 0 ? pick(filteredRare) : pick(zone.pool);
  } else {
    // Légendaires : taux fixe ~1% par légendaire (poids relatif aux non-légendaires)
    const _legCount    = zone.pool.filter(en => SPECIES_BY_EN[en]?.rarity === 'legendary').length;
    const _nonLegCount = zone.pool.length - _legCount;
    // legendaryW donne P(légendaire) ≈ 1% : poids = nonLeg / 99 vs non-leg poids = 1
    const _legendaryW  = _nonLegCount > 0 ? _nonLegCount / 99 : 1;
    const poolWithWeights = zone.pool.map(en => ({
      en,
      w: SPECIES_BY_EN[en]?.rarity === 'legendary' ? _legendaryW : 1,
    }));
    const totalW = poolWithWeights.reduce((s, x) => s + x.w, 0);
    let roll = Math.random() * totalW;
    speciesEN = poolWithWeights[poolWithWeights.length - 1].en;
    for (const x of poolWithWeights) {
      roll -= x.w;
      if (roll <= 0) { speciesEN = x.en; break; }
    }
  }
  return { type: 'pokemon', species_en: speciesEN };
}

// ── Chest loot resolution ─────────────────────────────────────
function rollChestLoot(zoneId, passive = false) {
  const totalWeight = CHEST_LOOT.reduce((s, l) => s + l.weight, 0);
  let roll = Math.random() * totalWeight;
  let loot = CHEST_LOOT[0];
  for (const l of CHEST_LOOT) {
    roll -= l.weight;
    if (roll <= 0) { loot = l; break; }
  }
  const zone = ZONE_BY_ID[zoneId];
  const name = state.lang === 'fr' ? loot.fr : loot.en;

  switch (loot.type) {
    case 'balls': {
      let qty = randInt(loot.qty[0], loot.qty[1]);
      if (isBallAssistActive()) qty *= 2; // early-game assist silencieux
      if (passive) {
        const zs = initZone(zoneId);
        zs.pendingItems = zs.pendingItems || {};
        zs.pendingItems[loot.ballType] = (zs.pendingItems[loot.ballType] || 0) + qty;
      } else {
        state.inventory[loot.ballType] = (state.inventory[loot.ballType] || 0) + qty;
      }
      return { msg: `📦 ${qty}x ${name}`, type: 'success' };
    }
    case 'money': {
      const amount = randInt(loot.qty[0], loot.qty[1]);
      if (passive) {
        const zs = initZone(zoneId);
        zs.pendingIncome = (zs.pendingIncome || 0) + amount;
      } else {
        state.gang.money += amount;
      }
      state.stats.totalMoneyEarned += amount;
      return { msg: `📦 ${amount}₽`, type: 'gold' };
    }
    case 'rare_pokemon': {
      if (zone) {
        const rarePool = zone.pool.filter(en => {
          const sp = SPECIES_BY_EN[en];
          return sp && sp.rarity !== 'common';
        });
        const speciesEN = rarePool.length > 0 ? pick(rarePool) : pick(zone.pool);
        const pokemon = makePokemon(speciesEN, zoneId, 'ultraball');
        if (pokemon) {
          pokemon.potential = Math.max(pokemon.potential, 3); // guaranteed 3+ stars
          pokemon.stats = calculateStats(pokemon);
          state.pokemons.push(pokemon);
          state.stats.totalCaught++;
          const pName = speciesName(pokemon.species_en);
          const stars = '★'.repeat(pokemon.potential);
          if (!state.pokedex[pokemon.species_en]) {
            state.pokedex[pokemon.species_en] = { seen: true, caught: true, shiny: pokemon.shiny, count: 1 };
          } else {
            state.pokedex[pokemon.species_en].caught = true;
            state.pokedex[pokemon.species_en].count++;
          }
          return { msg: `📦 ${pName} ${stars}${pokemon.shiny ? ' ✨' : ''}!`, type: 'gold' };
        }
      }
      // Fallback
      state.gang.money += 1000;
      return { msg: `📦 1000₽`, type: 'gold' };
    }
    case 'item': {
      state.inventory[loot.itemId] = (state.inventory[loot.itemId] || 0) + loot.qty;
      return { msg: `📦 ${loot.qty}x ${name}`, type: 'gold' };
    }
    case 'masterball': {
      state.inventory.masterball = (state.inventory.masterball || 0) + 1;
      return { msg: `📦 MASTER BALL !!`, type: 'gold' };
    }
    case 'event': {
      // Trigger a random event
      const eligible = SPECIAL_EVENTS.filter(ev => state.gang.reputation >= ev.minRep);
      if (eligible.length > 0 && zone) {
        const event = pick(eligible);
        activateEvent(zoneId, event);
        return { msg: `📦 ${state.lang === 'fr' ? event.fr : event.en}`, type: 'gold' };
      }
      state.gang.money += 2000;
      return { msg: `📦 2000₽`, type: 'gold' };
    }
    default:
      state.gang.money += 500;
      return { msg: `📦 500₽`, type: 'success' };
  }
}

// ── Event activation/resolution ───────────────────────────────
function activateEvent(zoneId, event) {
  const reward = event.reward;
  state.stats.eventsCompleted++;

  if (reward.shinyBoost) {
    state.activeBoosts.aura = Math.max(state.activeBoosts.aura || 0, Date.now() + reward.shinyBoost);
    notify(`${event.icon} ${state.lang === 'fr' ? event.fr : event.en}`, 'gold');
  }
  if (reward.rareBoost) {
    state.activeBoosts.rarescope = Math.max(state.activeBoosts.rarescope || 0, Date.now() + reward.rareBoost);
    notify(`${event.icon} ${state.lang === 'fr' ? event.fr : event.en}`, 'gold');
  }
  if (reward.chestBoost) {
    if (!state.activeBoosts.chestBoost) state.activeBoosts.chestBoost = 0;
    state.activeBoosts.chestBoost = Math.max(state.activeBoosts.chestBoost, Date.now() + reward.chestBoost);
    notify(`${event.icon} ${state.lang === 'fr' ? event.fr : event.en}`, 'gold');
  }
  if (reward.money) {
    const amount = randInt(reward.money[0], reward.money[1]);
    state.gang.money += amount;
    state.stats.totalMoneyEarned += amount;
    if (reward.rep) state.gang.reputation += reward.rep;
    notify(`${event.icon} ${state.lang === 'fr' ? event.fr : event.en} +${amount}₽`, 'gold');
  }
  if (reward.xpBonus) {
    // Grant XP to all pokemon in zone agents
    for (const agent of state.agents) {
      if (agent.assignedZone === zoneId) {
        grantAgentXP(agent, reward.xpBonus);
        for (const pkId of agent.team) {
          const p = state.pokemons.find(pk => pk.id === pkId);
          if (p) levelUpPokemon(p, reward.xpBonus);
        }
      }
    }
  }

  if (reward.pokemonGift) {
    const sp = SPECIES_BY_EN[reward.pokemonGift];
    if (sp) {
      const p = makePokemon(reward.pokemonGift, zoneId, 'pokeball');
      if (p) {
        p.level = Math.max(p.level, 20);
        p.stats = calculateStats(p);
        state.pokemons.push(p);
        notify(`${event.icon} ${speciesName(reward.pokemonGift)} rejoint le gang !`, 'gold');
      }
    }
  }
  if (reward.eggGift) {
    const species_en = pick(reward.eggGift);
    const sp = SPECIES_BY_EN[species_en];
    if (sp) {
      const potential = Math.random() < 0.2 ? 3 : 2;
      const shiny = Math.random() < 0.01;
      state.eggs.push({ id: uid(), species_en, hatchAt: null, incubating: false, potential, shiny, gifted: true });
      tryAutoIncubate();
      notify(`${event.icon} 🥚 Un œuf mystérieux est apparu… On se demande ce qu'il contient !`, 'gold');
    }
  }

  // Track active event on zone
  state.activeEvents[zoneId] = { eventId: event.id, expiresAt: Date.now() + 60000 };
  saveState();
}

// ── Zone Investment ───────────────────────────────────────────
function investInZone(zoneId) {
  const zone = ZONE_BY_ID[zoneId];
  if (!zone) return false;
  const zState = initZone(zoneId);
  if (zState.invested) return false;
  const cost = zone.investCost || 0;
  if (state.gang.money < cost) {
    notify(state.lang === 'fr' ? 'Pas assez d\'argent !' : 'Not enough money!');
    SFX.play('error')
    return false;
  }
  // Need minimum team power in zone
  const minPower = zone.rep * 10;
  let zonePower = 0;
  for (const agent of state.agents) {
    if (agent.assignedZone === zoneId) {
      zonePower += getAgentCombatPower(agent);
    }
  }
  if (zonePower < minPower && minPower > 0) {
    notify(state.lang === 'fr'
      ? `Puissance insuffisante ! (${zonePower}/${minPower}) Assignez des agents avec des Pokémon.`
      : `Not enough power! (${zonePower}/${minPower}) Assign agents with Pokémon.`);
    SFX.play('error')
    return false;
  }
  state.gang.money -= cost;
  state.stats.totalMoneySpent += cost;
  zState.invested = true;
  zState.investPower = zonePower;
  notify(state.lang === 'fr'
    ? `🏴 Zone investie ! Événements & élites débloqués.`
    : `🏴 Zone invested! Events & elites unlocked.`, 'gold');
  saveState();
  return true;
}

// ════════════════════════════════════════════════════════════════
//  6.  CAPTURE MODULE
// ════════════════════════════════════════════════════════════════

function tryCapture(zoneId, speciesEN, bonusPotential = 0) {
  const ball = state.activeBall;
  if ((state.inventory[ball] || 0) <= 0) {
    notify(t('no_balls', { ball: BALLS[ball]?.fr || ball }));
    SFX.play('error')
    return null;
  }
  state.inventory[ball]--;
  const pokemon = makePokemon(speciesEN, zoneId, ball);
  if (!pokemon) return null;
  if (bonusPotential > 0) pokemon.potential = Math.min(5, pokemon.potential + bonusPotential);
  state.pokemons.push(pokemon);
  state.stats.totalCaught++;
  // Behavioural log — première capture
  if (!state.behaviourLogs) state.behaviourLogs = {};
  if (!state.behaviourLogs.firstCaptureAt) state.behaviourLogs.firstCaptureAt = Date.now();
  // Zone captures counter
  if (zoneId && state.zones[zoneId]) state.zones[zoneId].captures = (state.zones[zoneId].captures || 0) + 1;
  // Pokedex
  if (!state.pokedex[pokemon.species_en]) {
    state.pokedex[pokemon.species_en] = { seen: true, caught: true, shiny: pokemon.shiny, count: 1 };
  } else {
    state.pokedex[pokemon.species_en].caught = true;
    state.pokedex[pokemon.species_en].count++;
    if (pokemon.shiny) state.pokedex[pokemon.species_en].shiny = true;
  }
  if (pokemon.shiny) state.stats.shinyCaught++;
  const name = speciesName(pokemon.species_en);
  const stars = '★'.repeat(pokemon.potential) + '☆'.repeat(5 - pokemon.potential);
  const shinyTag = pokemon.shiny ? ' ✨SHINY✨' : '';
  if (pokemon.shiny) {
    notify(`${name} ${stars}${shinyTag}`, 'gold');
    setTimeout(() => showShinyPopup(pokemon.species_en), 200);
  } else {
    notify(`${name} ${stars}`, pokemon.potential >= 4 ? 'gold' : 'success');
  }
  addLog(t('catch_success', { name }) + ` [${stars}]`);
  // SFX
  SFX.play('capture', pokemon.potential, pokemon.shiny);
  saveState();
  return pokemon;
}

// ════════════════════════════════════════════════════════════════
//  7.  COMBAT MODULE
// ════════════════════════════════════════════════════════════════

// Rep par combat : +1 dresseur normal / +10 spécial (arène, Elite 4, persos d'histoire) / -5 en cas de défaite
function getCombatRepGain(trainerKey, win) {
  if (!win) return -5;
  return SPECIAL_TRAINER_KEYS.has(trainerKey) ? 10 : 1;
}

function getTeamPower(pokemonIds) {
  let power = 0;
  for (const id of pokemonIds) {
    const p = state.pokemons.find(pk => pk.id === id);
    if (p) power += getPokemonPower(p);
  }
  return power;
}

function resolveCombat(playerTeamIds, trainerData) {
  const playerPower = getTeamPower(playerTeamIds);
  let enemyPower = 0;
  for (const t of trainerData.team) {
    enemyPower += (t.stats.atk + t.stats.def + t.stats.spd);
  }
  // Add some randomness (±20%)
  const pRoll = playerPower * (0.8 + Math.random() * 0.4);
  const eRoll = enemyPower * (0.8 + Math.random() * 0.4);
  const win = pRoll >= eRoll;
  const reward = win ? Math.min(MAX_COMBAT_REWARD, randInt(trainerData.trainer.reward[0], trainerData.trainer.reward[1])) : 0;
  const repGain = getCombatRepGain(trainerData.trainerKey || trainerData.trainer?.sprite, win);
  return { win, playerPower, enemyPower, reward, repGain };
}

function applyCombatResult(result, playerTeamIds, trainerData) {
  state.stats.totalFights++;
  // Behavioural log — premier combat
  if (!state.behaviourLogs) state.behaviourLogs = {};
  if (!state.behaviourLogs.firstCombatAt) state.behaviourLogs.firstCombatAt = Date.now();
  if (result.win && result.reward >= 0) {
    state.stats.totalFightsWon++;
    if (result.reward > 0) {
      const zs = initZone(trainerData.zoneId);
      zs.pendingIncome = (zs.pendingIncome || 0) + result.reward;
    }
    state.stats.totalMoneyEarned += result.reward;
    // Rep sur toutes les victoires (spécial = +10, normal = +1)
    if (result.repGain > 0) {
      const prevRep = state.gang.reputation;
      state.gang.reputation += result.repGain;
      checkForNewlyUnlockedZones(prevRep);
    }
    // Ball drops for regular trainer battles (2x less than before)
    if (!trainerData.isSpecial && !trainerData.isRaid) {
      const diff = trainerData.trainer?.diff || 1;
      const ballType = diff >= 5 ? 'ultraball' : diff >= 3 ? 'greatball' : 'pokeball';
      if (Math.random() < 0.5) { // 50% chance = moitié moins en moyenne
        state.inventory[ballType] = (state.inventory[ballType] || 0) + 1;
      }
    }
    if (trainerData.trainerKey === 'rocketgrunt' || trainerData.trainerKey === 'rocketgruntf' || trainerData.trainerKey === 'giovanni') {
      state.stats.rocketDefeated++;
    }
    if (trainerData.trainerKey === 'blue') {
      state.stats.blueDefeated = (state.stats.blueDefeated || 0) + 1;
    }
    // Mark gym as defeated when its leader is beaten
    const combatZone = ZONE_BY_ID[trainerData.zoneId];
    if (combatZone?.gymLeader && trainerData.trainerKey === combatZone.gymLeader) {
      const zs = initZone(trainerData.zoneId);
      const wasDefeated = zs.gymDefeated;
      zs.gymDefeated = true;
      if (!wasDefeated) {
        notify(`🏆 ${combatZone.fr} — Champion vaincu ! La voie est libre.`, 'gold');
        // Déclenche la vérification de nouvelles zones débloquées par la séquence
        setTimeout(() => checkForNewlyUnlockedZones(state.gang.reputation - 0.001), 600);
      }
      if (trainerData.isGymRaid) {
        zs.gymRaidLastFight = Date.now();
      }
    }
    // XP to team (gyms give bonus XP)
    const zone = ZONE_BY_ID[trainerData.zoneId];
    const gymBonus = (zone?.type === 'city' && zone?.xpBonus) ? zone.xpBonus : 1;
    const xpEach = Math.round((10 + trainerData.trainer.diff * 5) * gymBonus * 0.75);
    for (const id of playerTeamIds) {
      const p = state.pokemons.find(pk => pk.id === id);
      if (p) {
        levelUpPokemon(p, xpEach);
        if (p.history) p.history.push({ type: 'combat', ts: Date.now(), won: true });
      }
    }
  } else {
    state.gang.reputation = Math.max(0, state.gang.reputation + result.repGain);
    for (const id of playerTeamIds) {
      const p = state.pokemons.find(pk => pk.id === id);
      if (p) {
        if (p.history) p.history.push({ type: 'combat', ts: Date.now(), won: false });
      }
    }
  }
  saveState();
}

// ── Zone unlock detection ──────────────────────────────────────
function checkForNewlyUnlockedZones(prevRep) {
  const newZones = ZONES.filter(z => {
    if (!z.rep || z.rep === 0) return false;
    if (z.unlockItem && !state.purchases?.[z.unlockItem]) return false;
    // Cities require previous city to be defeated
    if (z.type === 'city') {
      const idx = GYM_ORDER.indexOf(z.id);
      if (idx > 0) {
        const prevId = GYM_ORDER[idx - 1];
        if (!state.zones[prevId]?.gymDefeated) return false;
      }
    }
    return prevRep < z.rep && state.gang.reputation >= z.rep;
  });
  newZones.forEach((zone, i) => {
    setTimeout(() => showZoneUnlockPopup(zone), 400 + i * 300);
  });
}

let _zoneUnlockQueue = [];
let _zoneUnlockActive = false;

function showZoneUnlockPopup(zone) {
  _zoneUnlockQueue.push(zone);
  if (!_zoneUnlockActive) _processZoneUnlockQueue();
}

function _processZoneUnlockQueue() {
  if (_zoneUnlockQueue.length === 0) { _zoneUnlockActive = false; return; }
  _zoneUnlockActive = true;
  const zone = _zoneUnlockQueue.shift();
  const popup = document.getElementById('zoneUnlockPopup');
  const nameEl = document.getElementById('zoneUnlockName');
  const repEl  = document.getElementById('zoneUnlockRep');
  if (!popup || !nameEl) return;
  nameEl.textContent = state.lang === 'fr' ? zone.fr : zone.en;
  if (repEl) repEl.textContent = `Réputation requise : ${zone.rep}`;
  popup._zoneId = zone.id;
  popup.classList.add('show');
}

// ════════════════════════════════════════════════════════════════
//  7b. MISSIONS MODULE
// ════════════════════════════════════════════════════════f════════

function getMissionStat(statKey) {
  if (statKey === '_reputation') return state.gang.reputation;
  if (statKey === '_agentCount') return state.agents.length;
  if (statKey === '_pokedexCaught') {
    return Object.values(state.pokedex).filter(e => e.caught).length;
  }
  if (statKey === '_starterCount') {
    const starters = ['bulbasaur', 'charmander', 'squirtle'];
    return starters.filter(s => state.pokemons.some(p => p.species_en === s)).length;
  }
  if (statKey === '_fossilCount') {
    const fossils = ['omanyte', 'kabuto', 'aerodactyl'];
    return fossils.filter(s => state.pokemons.some(p => p.species_en === s)).length;
  }
  if (statKey === '_zonesWithCapture') {
    return Object.values(state.zones).filter(z => (z.captures || 0) > 0).length;
  }
  if (statKey === '_dexKantoCaught') {
    return POKEMON_GEN1.filter(s => !s.hidden && s.dex >= 1 && s.dex <= 151 && state.pokedex[s.en]?.caught).length;
  }
  if (statKey === '_dexFullCaught') {
    return POKEMON_GEN1.filter(s => !s.hidden && state.pokedex[s.en]?.caught).length;
  }
  if (statKey === '_shinyDexCount') {
    return POKEMON_GEN1.filter(s => !s.hidden && state.pokedex[s.en]?.shiny).length;
  }
  if (statKey === '_shinyStarterCount') {
    return ['bulbasaur','charmander','squirtle'].filter(s => state.pokedex[s]?.shiny).length;
  }
  if (statKey === '_shinyLegendaryCount') {
    return POKEMON_GEN1.filter(s => s.rarity === 'legendary' && !s.hidden && state.pokedex[s.en]?.shiny).length;
  }
  return state.stats[statKey] || 0;
}

function initMissions() {
  if (!state.missions) {
    state.missions = { completed: [], daily: { reset: 0, progress: {}, claimed: [] }, weekly: { reset: 0, progress: {}, claimed: [] } };
  }
  // Reset daily/weekly if expired
  const now = Date.now();
  const DAY = 86400000;
  const WEEK = 604800000;
  if (now - state.missions.daily.reset >= DAY) {
    // Snapshot current stats as baseline
    const baseline = {};
    for (const m of MISSIONS.filter(m => m.type === 'daily')) {
      baseline[m.stat] = getMissionStat(m.stat);
    }
    state.missions.daily = { reset: now, progress: baseline, claimed: [] };
  }
  if (now - state.missions.weekly.reset >= WEEK) {
    const baseline = {};
    for (const m of MISSIONS.filter(m => m.type === 'weekly')) {
      baseline[m.stat] = getMissionStat(m.stat);
    }
    state.missions.weekly = { reset: now, progress: baseline, claimed: [] };
  }
}

// ── Hourly quests ─────────────────────────────────────────────
const HOUR_MS = 3600000;

function initHourlyQuests() {
  if (!state.missions.hourly) state.missions.hourly = { reset: 0, slots: [], baseline: {}, claimed: [] };
  const h = state.missions.hourly;
  if (Date.now() - h.reset >= HOUR_MS) {
    // Draw 3 medium + 2 hard from pool (no duplicates)
    const medium = HOURLY_QUEST_POOL.filter(q => q.diff === 'medium');
    const hard   = HOURLY_QUEST_POOL.filter(q => q.diff === 'hard');
    const pickRand = (arr, n) => {
      const shuffled = [...arr].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, n).map(q => q.id);
    };
    const slots = [...pickRand(medium, 3), ...pickRand(hard, 2)];
    const baseline = {};
    for (const qId of slots) {
      const q = HOURLY_QUEST_POOL.find(x => x.id === qId);
      if (q) baseline[q.stat] = (baseline[q.stat] === undefined) ? getMissionStat(q.stat) : baseline[q.stat];
    }
    state.missions.hourly = { reset: Date.now(), slots, baseline, claimed: [] };
    saveState();
  }
}

function getHourlyQuest(slotIdx) {
  const id = state.missions.hourly?.slots?.[slotIdx];
  return id ? HOURLY_QUEST_POOL.find(q => q.id === id) : null;
}

function getHourlyProgress(q) {
  const baseline = state.missions.hourly.baseline?.[q.stat] || 0;
  return Math.min(getMissionStat(q.stat) - baseline, q.target);
}

function isHourlyComplete(q)  { return getHourlyProgress(q) >= q.target; }
function isHourlyClaimed(idx) { return (state.missions.hourly.claimed || []).includes(idx); }

function claimHourlyQuest(idx) {
  const q = getHourlyQuest(idx);
  if (!q || !isHourlyComplete(q) || isHourlyClaimed(idx)) return;
  if (!state.missions.hourly.claimed) state.missions.hourly.claimed = [];
  state.missions.hourly.claimed.push(idx);
  if (q.reward.money) { state.gang.money += q.reward.money; state.stats.totalMoneyEarned += q.reward.money; }
  if (q.reward.rep)   { const prev = state.gang.reputation; state.gang.reputation += q.reward.rep; checkForNewlyUnlockedZones(prev); }
  notify(`✓ Quête : ${q.fr} — +${q.reward.money?.toLocaleString() || 0}₽${q.reward.rep ? ' +'+q.reward.rep+' rep' : ''}`, 'gold');
  SFX.play('coin')
  saveState();
}

function rerollHourlyQuest(idx) {
  if (state.gang.money < HOURLY_QUEST_REROLL_COST) { notify(`Pokédollars insuffisants (${HOURLY_QUEST_REROLL_COST}₽ req)`); return; }
  const h = state.missions.hourly;
  if (!h || isHourlyClaimed(idx)) return;
  const current = getHourlyQuest(idx);
  if (!current) return;
  state.gang.money -= HOURLY_QUEST_REROLL_COST;
  // Pick a different quest of same difficulty
  const pool = HOURLY_QUEST_POOL.filter(q => q.diff === current.diff && q.id !== current.id && !h.slots.includes(q.id));
  if (pool.length === 0) { notify('Aucune quête disponible pour le reroll'); state.gang.money += HOURLY_QUEST_REROLL_COST; return; }
  const newQ = pool[Math.floor(Math.random() * pool.length)];
  h.slots[idx] = newQ.id;
  if (h.baseline[newQ.stat] === undefined) h.baseline[newQ.stat] = getMissionStat(newQ.stat);
  saveState();
  notify(`Reroll : ${newQ.fr}`, 'success');
}

function getMissionProgress(mission) {
  const current = getMissionStat(mission.stat);
  if (mission.type === 'story') {
    return Math.min(current, mission.target);
  }
  const period = mission.type === 'daily' ? state.missions.daily : state.missions.weekly;
  const baseline = period.progress[mission.stat] || 0;
  return Math.min(current - baseline, mission.target);
}

function isMissionComplete(mission) {
  return getMissionProgress(mission) >= mission.target;
}

function isMissionClaimed(mission) {
  if (mission.type === 'story') return state.missions.completed.includes(mission.id);
  const period = mission.type === 'daily' ? state.missions.daily : state.missions.weekly;
  return period.claimed.includes(mission.id);
}

function claimMission(mission) {
  if (!isMissionComplete(mission) || isMissionClaimed(mission)) return;
  // Grant rewards
  if (mission.reward.money) {
    state.gang.money += mission.reward.money;
    state.stats.totalMoneyEarned += mission.reward.money;
  }
  if (mission.reward.rep) {
    state.gang.reputation += mission.reward.rep;
  }
  // Mark as claimed
  if (mission.type === 'story') {
    state.missions.completed.push(mission.id);
  } else {
    const period = mission.type === 'daily' ? state.missions.daily : state.missions.weekly;
    period.claimed.push(mission.id);
  }
  const name = state.lang === 'fr' ? mission.fr : mission.en;
  notify(`${mission.icon} ${name} — ${state.lang === 'fr' ? 'Récompense récupérée !' : 'Reward claimed!'}`, 'gold');
  saveState();
  updateTopBar();
}

// ════════════════════════════════════════════════════════════════
//  8.  AGENT MODULE
// ════════════════════════════════════════════════════════════════

// Exponential cost scaling: 5k → 20k → 80k → 320k → 1.28M → …
function getAgentRecruitCost() {
  const n = state.agents.length;
  const base = Math.round(5000 * Math.pow(4, n));
  // Au-dessus de 1M : palier linéaire = N millions (N = nb agents actuels)
  return base > 1_000_000 ? n * 1_000_000 : base;
}

function rollNewAgent() {
  const isFemale = Math.random() < 0.5;
  const name = pick(isFemale ? AGENT_NAMES_F : AGENT_NAMES_M);
  const sprite = pick(AGENT_SPRITES);
  const personality = [];
  const pool = [...AGENT_PERSONALITIES];
  for (let i = 0; i < 2; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    personality.push(pool.splice(idx, 1)[0]);
  }
  return {
    id: `ag-${uid()}`,
    name,
    sprite: trainerSprite(sprite),
    spriteKey: sprite,
    title: 'grunt',
    level: 1,
    xp: 0,
    combatsWon: 0,
    stats: {
      capture: randInt(3, 18),
      combat: randInt(3, 18),
      luck: randInt(1, 12),
    },
    personality,
    team: [],
    assignedZone: null,
    notifyCaptures: true,
    perkLevels: [],
    pendingPerk: false,
  };
}

function recruitAgent(agentData) {
  state.agents.push(agentData);
  addLog(t('recruit_agent') + ': ' + agentData.name);
  // Behavioural log — premier agent recruté
  if (!state.behaviourLogs) state.behaviourLogs = {};
  if (!state.behaviourLogs.firstAgentAt) state.behaviourLogs.firstAgentAt = Date.now();
  saveState();
}

function openAgentRecruitModal(onAfterRecruit) {
  const cost = getAgentRecruitCost();
  if (state.gang.money < cost) {
    notify(state.lang === 'fr' ? 'Pas assez d\'argent !' : 'Not enough money!');
    SFX.play('error')
    return;
  }

  const candidates = [rollNewAgent(), rollNewAgent(), rollNewAgent()];

  const TITLE_FR = { grunt:'Grunt', soldier:'Soldat', lieutenant:'Lieutenant', captain:'Capitaine', commander:'Commandant' };
  function statBar(val, max = 20) {
    const pct = Math.round(Math.min(val / max, 1) * 100);
    return `<div style="height:4px;background:var(--bg);border-radius:2px;width:80px;overflow:hidden"><div style="height:100%;width:${pct}%;background:var(--gold)"></div></div>`;
  }

  const cardsHtml = candidates.map((ag, i) => `
    <div class="recruit-card" data-idx="${i}" style="
      flex:1;min-width:140px;max-width:190px;
      background:var(--bg-card);border:1px solid var(--border);
      border-radius:var(--radius);padding:12px 10px;
      display:flex;flex-direction:column;align-items:center;gap:8px;
      cursor:pointer;transition:border-color .15s,box-shadow .15s">
      <img src="${ag.sprite}" style="width:48px;height:48px;image-rendering:pixelated">
      <div style="font-family:var(--font-pixel);font-size:10px;color:var(--text);text-align:center">${ag.name}</div>
      <div style="font-size:8px;color:var(--text-dim)">${ag.personality.map(p => p.fr || p).join(' · ')}</div>
      <div style="display:flex;flex-direction:column;gap:4px;width:100%;margin-top:2px">
        <div style="display:flex;justify-content:space-between;align-items:center;font-family:var(--font-pixel);font-size:7px;color:var(--text-dim)">
          <span>ATK</span>${statBar(ag.stats.combat)}
          <span style="color:var(--text)">${ag.stats.combat}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;font-family:var(--font-pixel);font-size:7px;color:var(--text-dim)">
          <span>CAP</span>${statBar(ag.stats.capture)}
          <span style="color:var(--text)">${ag.stats.capture}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;font-family:var(--font-pixel);font-size:7px;color:var(--text-dim)">
          <span>LCK</span>${statBar(ag.stats.luck, 12)}
          <span style="color:var(--text)">${ag.stats.luck}</span>
        </div>
      </div>
      <button class="recruit-pick-btn" data-idx="${i}" style="
        margin-top:4px;font-family:var(--font-pixel);font-size:8px;
        padding:5px 14px;background:var(--bg);border:1px solid var(--gold-dim);
        border-radius:var(--radius-sm);color:var(--gold);cursor:pointer;width:100%">
        Recruter
      </button>
    </div>`).join('');

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:9999';
  modal.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);padding:20px;max-width:640px;width:96%;display:flex;flex-direction:column;gap:14px">
      <div style="font-family:var(--font-pixel);font-size:11px;color:var(--gold);text-align:center">
        ★ RECRUTEMENT — Choisissez un candidat
      </div>
      <div style="font-size:8px;color:var(--text-dim);text-align:center;font-family:var(--font-pixel)">
        Coût : ${cost.toLocaleString()}₽ — Trois candidats disponibles
      </div>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">${cardsHtml}</div>
      <div style="text-align:center">
        <button id="recruitCancelBtn" style="font-family:var(--font-pixel);font-size:8px;padding:6px 16px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">Annuler</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  // Hover highlight
  modal.querySelectorAll('.recruit-card').forEach(card => {
    card.addEventListener('mouseenter', () => { card.style.borderColor = 'var(--gold-dim)'; card.style.boxShadow = '0 0 10px rgba(255,204,90,.2)'; });
    card.addEventListener('mouseleave', () => { card.style.borderColor = 'var(--border)'; card.style.boxShadow = ''; });
  });

  // Pick
  modal.querySelectorAll('.recruit-pick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      state.gang.money -= cost;
      recruitAgent(candidates[idx]);
      notify(`${state.lang === 'fr' ? 'Recruté' : 'Recruited'}: ${candidates[idx].name}!`, 'gold');
      updateTopBar();
      modal.remove();
      onAfterRecruit?.();
    });
  });

  document.getElementById('recruitCancelBtn').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function assignAgentToZone(agentId, zoneId) {
  const agent = state.agents.find(a => a.id === agentId);
  if (!agent) return;
  // Remove from old zone
  if (agent.assignedZone) {
    const oldZ = state.zones[agent.assignedZone];
    if (oldZ) {
      oldZ.assignedAgents = oldZ.assignedAgents.filter(id => id !== agentId);
    }
  }
  agent.assignedZone = zoneId;
  if (zoneId) {
    const z = initZone(zoneId);
    const maxSlots = z.slots || 1;
    if (!z.assignedAgents.includes(agentId)) {
      if (z.assignedAgents.length < maxSlots) {
        z.assignedAgents.push(agentId);
      } else {
        // Zone pleine — désassigner l'agent sans l'ajouter
        agent.assignedZone = null;
        notify(`Zone pleine (${maxSlots} slot${maxSlots > 1 ? 's' : ''}). Améliore la zone pour +1 agent.`, 'error');
        saveState();
        return;
      }
    }
  }
  saveState();
}

function grantAgentXP(agent, amount) {
  agent.xp += amount;
  const needed = agent.level * 30;
  while (agent.xp >= needed && agent.level < 100) {
    agent.xp -= needed;
    agent.level++;
    if (agent.level % 5 === 0) {
      agent.pendingPerk = true;
      notify(`${agent.name} a gagne un perk ! (Lv.${agent.level})`, 'gold');
    }
  }
  checkPromotion(agent);
}

function checkPromotion(agent) {
  if (agent.title === 'grunt' &&
      agent.level >= TITLE_REQUIREMENTS.lieutenant.level &&
      agent.combatsWon >= TITLE_REQUIREMENTS.lieutenant.combatsWon) {
    agent.title = 'lieutenant';
    notify(t('agent_promo', { agent: agent.name, title: 'Lieutenant' }), 'gold');
    addLog(t('agent_promo', { agent: agent.name, title: 'Lieutenant' }));
  }
  if (agent.title === 'lieutenant' &&
      agent.level >= TITLE_REQUIREMENTS.captain.level &&
      agent.combatsWon >= TITLE_REQUIREMENTS.captain.combatsWon) {
    agent.title = 'captain';
    notify(t('agent_promo', { agent: agent.name, title: 'Captain' }), 'gold');
    addLog(t('agent_promo', { agent: agent.name, title: 'Captain' }));
  }
}

function getAgentCombatPower(agent) {
  const bonus = 1 + (TITLE_BONUSES[agent.title] || 0);
  let teamPower = 0;
  for (const pkId of agent.team) {
    const p = state.pokemons.find(pk => pk.id === pkId);
    if (p) teamPower += getPokemonPower(p);
  }
  return Math.round((agent.stats.combat * 10 + teamPower) * bonus);
}

// ── Passive agent tick (background, no open window needed) ───────
// Runs every ~10s and simulates agent activity for closed zones
function passiveAgentTick() {
  if (!state.settings.autoCombat) return;
  let changed = false;
  const now = Date.now();

  for (const agent of state.agents) {
    if (!agent.assignedZone) continue;
    const zoneId = agent.assignedZone;
    // Skip zones already handled by the visual tick this frame
    if (openZones.has(zoneId)) continue;

    const zone = ZONE_BY_ID[zoneId];
    if (!zone || zone.spawnRate === 0) continue;

    // Chance to act this tick (proportional to agent capture stat)
    const actChance = 0.4 + agent.stats.capture / 100;
    if (Math.random() > actChance) continue;

    // Roll what would spawn
    const entry = spawnInZone(zoneId);
    if (!entry) continue;

    if (entry.type === 'pokemon') {
      // Agent captures silently
      const ball = 'pokeball';
      if ((state.inventory[ball] || 0) <= 0) continue;
      const pokemon = makePokemon(entry.species_en, zoneId, ball);
      if (!pokemon) continue;
      // Crit de capture : basé sur la stat CAP de l'agent
      const agentCritChance = (agent.stats.capture || 0) / 100;
      if (Math.random() < agentCritChance) {
        pokemon.potential = Math.min(5, (pokemon.potential || 1) + 1);
        if (agent.notifyCaptures) notify(`★ ${agent.name} — Capture critique ! ★`, 'gold');
      }
      state.inventory[ball]--;
      state.pokemons.push(pokemon);
      state.stats.totalCaught++;
      if (!state.pokedex[pokemon.species_en]) {
        state.pokedex[pokemon.species_en] = { seen: true, caught: true, shiny: pokemon.shiny, count: 1 };
      } else {
        state.pokedex[pokemon.species_en].caught = true;
        state.pokedex[pokemon.species_en].count++;
        if (pokemon.shiny) state.pokedex[pokemon.species_en].shiny = true;
      }
      if (pokemon.shiny) state.stats.shinyCaught++;
      grantAgentXP(agent, 5);
      const name = speciesName(pokemon.species_en);
      const stars = '★'.repeat(pokemon.potential);
      if (agent.notifyCaptures) {
        notify(`👤 ${agent.name} → ${name} ${stars}${pokemon.shiny ? ' ✨' : ''}`, pokemon.shiny ? 'gold' : 'success');
      }
      addLog(t('agent_catch', { agent: agent.name, pokemon: name }));
      changed = true;

    } else if (entry.type === 'trainer' || entry.type === 'raid') {
      // Agent auto-fights (raids are tougher — need zone group power)
      const agentPower = entry.type === 'raid'
        ? state.agents.filter(a => a.assignedZone === zoneId).reduce((s, a) => s + getAgentCombatPower(a), 0)
        : getAgentCombatPower(agent);
      let enemyPower = 0;
      for (const t of entry.team) enemyPower += (t.stats.atk + t.stats.def + t.stats.spd);
      const pRoll = agentPower * (0.8 + Math.random() * 0.4);
      const eRoll = enemyPower * (0.8 + Math.random() * 0.4);
      const win = pRoll >= eRoll;
      if (win) {
        const reward = Math.min(MAX_COMBAT_REWARD, randInt(entry.trainer.reward[0], entry.trainer.reward[1]));
        const repGain = getCombatRepGain(entry.trainerKey || entry.trainer?.sprite, true);
        // Accumulate in zone instead of direct payment
        const zs = initZone(zoneId);
        zs.pendingIncome = (zs.pendingIncome || 0) + reward;
        state.stats.totalMoneyEarned += reward;
        state.gang.reputation += repGain;
        state.stats.totalFights++;
        state.stats.totalFightsWon++;
        agent.combatsWon = (agent.combatsWon || 0) + 1;
        if (entry.trainerKey === 'rocketgrunt' || entry.trainerKey === 'rocketgruntf' || entry.trainerKey === 'giovanni') {
          state.stats.rocketDefeated++;
        }
        if (entry.trainerKey === 'blue') {
          state.stats.blueDefeated = (state.stats.blueDefeated || 0) + 1;
        }
        const xpEach = Math.round((10 + entry.trainer.diff * 5) * 0.75);
        grantAgentXP(agent, xpEach);
        for (const pkId of agent.team) {
          const p = state.pokemons.find(pk => pk.id === pkId);
          if (p) levelUpPokemon(p, xpEach);
        }
        // Zone combats counter
        zs.combatsWon = (zs.combatsWon || 0) + 1;
        if (agent.notifyCaptures) {
          notify(`[WIN] ${agent.name} +${reward}P`, 'success');
        }
        addLog(t('agent_win', { agent: agent.name }));
        addBattleLogEntry({
          ts: Date.now(),
          zoneName: `[Agent] ${agent.name} — ${ZONE_BY_ID[zoneId]?.fr || zoneId}`,
          win: true,
          reward: reward,
          repGain: repGain,
          lines: [`${agent.name} a battu un dresseur. +${reward}₽ +${repGain}rep`],
          trainerKey: entry.trainerKey,
          isAgent: true,
        });
      } else {
        state.stats.totalFights++;
        state.gang.reputation = Math.max(0, state.gang.reputation - 5);
        if (agent.notifyCaptures) notify(`[KO] ${agent.name} defaite...`);
        addLog(t('agent_lose', { agent: agent.name }));
        addBattleLogEntry({
          ts: Date.now(),
          zoneName: `[Agent] ${agent.name} — ${ZONE_BY_ID[zoneId]?.fr || zoneId}`,
          win: false,
          reward: 0,
          repGain: 0,
          lines: [`${agent.name} a perdu un combat.`],
          trainerKey: entry.trainerKey,
          isAgent: true,
        });
      }
      changed = true;

    } else if (entry.type === 'chest') {
      state.stats.chestsOpened = (state.stats.chestsOpened || 0) + 1;
      const loot = rollChestLoot(zoneId, true);
      if (agent.notifyCaptures) notify(`📦 ${agent.name} — ${loot.msg}`, loot.type);
      changed = true;
    }
  }

  // Auto gym raid: for each city zone with gymLeader, if cooldown passed + agent assigned + 1 manual win
  const raidCooldownMs = 5 * 60 * 1000;
  const checkedRaidZones = new Set();
  for (const agent of state.agents) {
    if (!agent.assignedZone) continue;
    const zid = agent.assignedZone;
    if (checkedRaidZones.has(zid)) continue;
    if (openZones.has(zid)) continue;
    const raidZone = ZONE_BY_ID[zid];
    if (!raidZone || raidZone.type !== 'city' || !raidZone.gymLeader) continue;
    const rzs = state.zones[zid];
    if (!rzs || !rzs.gymDefeated) continue; // need at least 1 manual win
    if ((rzs.combatsWon || 0) < 10) continue;
    if (Date.now() - (rzs.gymRaidLastFight || 0) < raidCooldownMs) continue;
    checkedRaidZones.add(zid);
    if (triggerGymRaid(zid, true)) changed = true;
  }

  if (changed) {
    saveState();
    updateTopBar();
    // Agent capture: only refresh grid (not full rebuild) to avoid resetting pcSelectedId / view state
    if (activeTab === 'tabPC') {
      if (pcView === 'grid') renderPokemonGrid();
      else if (pcView === 'eggs') { const el = document.getElementById('eggsInPC'); if (el) renderEggsView(el); }
      // Update eggs button count
      const eggsBtn = document.getElementById('pcBtnEggs');
      if (eggsBtn) eggsBtn.textContent = `[OEUFS${state.eggs.length ? ` (${state.eggs.length})` : ''}]`;
    }
    if (activeTab === 'tabGang') renderGangTab();
  }
}

// Agent automation tick — agents interact with VISIBLE spawns in zone windows
function agentTick() {
  if (!state.settings.autoCombat) return; // auto-combat off = agents idle
  const zoneDone = new Set(); // track zones already processed this tick
  for (const agent of state.agents) {
    if (!agent.assignedZone) continue;
    const zoneId = agent.assignedZone;
    if (!openZones.has(zoneId)) continue; // only act in open zone windows
    const spawns = zoneSpawns[zoneId];
    if (!spawns || spawns.length === 0) continue;
    if (zoneDone.has(zoneId)) continue; // one action per zone per tick
    // Chance to act this tick based on agent capture stat (higher = more active)
    const actChance = 0.5 + agent.stats.capture / 60;
    if (Math.random() > actChance) continue;

    // Priority: raids > trainers > pokemon > chests
    const trainerSpawn = spawns.find(s => (s.type === 'trainer' || s.type === 'raid') && !s._agentClaimed);
    const pokemonSpawn = spawns.find(s => s.type === 'pokemon' && !s._agentClaimed && !s.playerCatching);
    const chestSpawn = spawns.find(s => s.type === 'chest' && !s._agentClaimed);

    if (trainerSpawn) {
      // Mark claimed so other agents don't try
      trainerSpawn._agentClaimed = true;
      zoneDone.add(zoneId);
      // Open combat popup with auto-execute
      agentAutoCombat(zoneId, trainerSpawn, agent);
    } else if (pokemonSpawn) {
      pokemonSpawn._agentClaimed = true;
      zoneDone.add(zoneId);
      // Agent throws ball at visible pokemon spawn
      agentCaptureVisibleSpawn(agent, zoneId, pokemonSpawn);
    } else if (chestSpawn) {
      chestSpawn._agentClaimed = true;
      zoneDone.add(zoneId);
      // Agent opens chest
      agentOpenChest(agent, zoneId, chestSpawn);
    }
  }
}

// Agent captures a visible pokemon spawn with ball throw animation
function agentCaptureVisibleSpawn(agent, zoneId, spawnObj) {
  const win = document.getElementById(`zw-${zoneId}`);
  if (!win) return;
  const viewport = win.querySelector('.zone-viewport');
  if (!viewport) return;
  const spawnEl = viewport.querySelector(`[data-spawn-id="${spawnObj.id}"]`);
  if (!spawnEl) return;

  // Skip if player is already capturing this spawn
  if (spawnObj.playerCatching) return;

  // Mark as catching to prevent player clicks
  spawnEl.classList.add('catching');

  // Find agent sprite position in zone
  const agentEls = viewport.querySelectorAll('.zone-agent');
  let agentEl = null;
  for (const el of agentEls) {
    const label = el.querySelector('.agent-label');
    if (label && label.textContent === agent.name) { agentEl = el; break; }
  }
  let startX = 40, startY = 150;
  if (agentEl) {
    const r = agentEl.getBoundingClientRect();
    const wr = viewport.getBoundingClientRect();
    startX = r.left - wr.left + r.width / 2;
    startY = r.top - wr.top;
  }
  const targetX = parseInt(spawnEl.style.left) + 28;
  const targetY = parseInt(spawnEl.style.top) + 28;

  // Ball projectile
  const ball = document.createElement('div');
  ball.className = 'ball-projectile';
  ball.innerHTML = `<img src="${BALL_SPRITES.pokeball}">`;
  ball.style.left = startX + 'px';
  ball.style.top = startY + 'px';
  viewport.appendChild(ball);

  SFX.play('ballThrow')
  requestAnimationFrame(() => {
    ball.style.transition = 'left .35s ease-out, top .35s ease-in';
    ball.style.left = targetX + 'px';
    ball.style.top = targetY + 'px';
  });

  setTimeout(() => {
    ball.remove();
    // Try capture using tryCapture (uses balls from inventory)
    const caught = tryCapture(zoneId, spawnObj.species_en);
    if (caught) {
      // Luck reroll for agents
      if (agent.stats.luck > 8 && caught.potential < 3 && Math.random() < 0.3) {
        caught.potential = randInt(3, 5);
        caught.stats = calculateStats(caught);
      }
      showCaptureBurst(viewport, targetX, targetY, caught.potential, caught.shiny);
      grantAgentXP(agent, 2);
      if (agent.notifyCaptures !== false) {
        notify(t('agent_catch', { agent: agent.name, pokemon: speciesName(spawnObj.species_en) }), 'success');
      }
      addLog(t('agent_catch', { agent: agent.name, pokemon: speciesName(spawnObj.species_en) }));
      removeSpawn(zoneId, spawnObj.id);
      updateTopBar();
      updateZoneTimers(zoneId);
    } else {
      // No balls left — release spawn
      spawnEl.classList.remove('catching');
      spawnObj._agentClaimed = false;
    }
  }, 380);
}

// Agent auto-fights a trainer — opens inline combat and auto-executes
function agentAutoCombat(zoneId, spawnObj, agent) {
  // Don't start if a combat is already running
  if (currentCombat) return;
  // Open combat popup (same as player click)
  openCombatPopup(zoneId, spawnObj);
  // Auto-execute after a brief delay so the player can see it
  setTimeout(() => {
    if (!currentCombat) return;
    executeCombat();
    // Auto-close after showing result
    setTimeout(() => {
      const arena = document.getElementById('battleArena');
      if (arena && arena.classList.contains('active')) {
        closeCombatPopup();
        removeSpawn(zoneId, spawnObj.id);
        updateTopBar();
        if (activeTab === 'tabGang') renderGangTab();
      }
    }, 1500);
  }, 800);
}

// Agent opens a chest
function agentOpenChest(agent, zoneId, spawnObj) {
  state.stats.chestsOpened = (state.stats.chestsOpened || 0) + 1;
  const loot = rollChestLoot(zoneId);
  notify(`${agent.name}: ${loot.msg}`, loot.type);
  grantAgentXP(agent, 1);
  SFX.play('chest');
  removeSpawn(zoneId, spawnObj.id);
  updateTopBar();
  updateZoneTimers(zoneId);
  saveState();
}

// (Agent capture animation is now handled by agentCaptureVisibleSpawn above)

// ════════════════════════════════════════════════════════════════
//  9.  MARKET MODULE
// ════════════════════════════════════════════════════════════════

function calculatePrice(pokemon) {
  const sp = SPECIES_BY_EN[pokemon.species_en];
  if (!sp) return 50;
  const base = BASE_PRICE[sp.rarity] || 100;
  const potMult = POTENTIAL_MULT[pokemon.potential - 1] || 1;
  const shinyMult = pokemon.shiny ? 10 : 1;
  const nat = NATURES[pokemon.nature];
  const natMult = nat ? (nat.atk + nat.def + nat.spd) / 3 : 1;
  return Math.round(base * potMult * shinyMult * natMult);
}

// Returns the supply pressure as a percentage (0 = normal, 60 = max saturation)
function getMarketSaturation(species_en) {
  const sales = state.marketSales[species_en];
  if (!sales) return 0;
  return Math.min(60, sales.count * 8);
}

// Decay market sales over time (called on load + periodically)
function decayMarketSales() {
  const now = Date.now();
  const DECAY_PER_HOUR = 1; // lose 1 sale unit per hour
  for (const species of Object.keys(state.marketSales)) {
    const s = state.marketSales[species];
    const hoursElapsed = (now - s.lastSale) / 3600000;
    const decay = Math.floor(hoursElapsed * DECAY_PER_HOUR);
    if (decay > 0) {
      s.count = Math.max(0, s.count - decay);
      s.lastSale = now;
      if (s.count === 0) delete state.marketSales[species];
    }
  }
}

function removePokemonFromAllAssignments(pkId) {
  // Équipe Boss
  state.gang.bossTeam = state.gang.bossTeam.filter(id => id !== pkId);
  // Formation
  if (state.trainingRoom) state.trainingRoom.pokemon = (state.trainingRoom.pokemon || []).filter(id => id !== pkId);
  // Pension
  if (state.pension) {
    if (state.pension.slotA === pkId) { state.pension.slotA = null; state.pension.eggAt = null; }
    if (state.pension.slotB === pkId) { state.pension.slotB = null; state.pension.eggAt = null; }
  }
}

function sellPokemon(pokemonIds, _shinyConfirmed = false) {
  // Block noSell pokemon (ex: MissingNo)
  const noSellBlocked = pokemonIds.filter(id => {
    const p = state.pokemons.find(pk => pk.id === id);
    if (!p) return false;
    const species = POKEMON_GEN1.find(s => s.en === p.species_en);
    return species?.noSell === true;
  });
  if (noSellBlocked.length > 0) {
    notify('Ce Pokémon ne peut pas être vendu.', 'error');
    pokemonIds = pokemonIds.filter(id => !noSellBlocked.includes(id));
    if (pokemonIds.length === 0) return;
  }
  // Filter out homesick pokemon — they cannot be sold
  const homesickBlocked = pokemonIds.filter(id => {
    const p = state.pokemons.find(pk => pk.id === id);
    return p && p.homesick;
  });
  if (homesickBlocked.length > 0) {
    notify('Ce Pokémon souffre du mal du pays et ne peut pas être vendu.', 'error');
    pokemonIds = pokemonIds.filter(id => !homesickBlocked.includes(id));
    if (pokemonIds.length === 0) return;
  }
  // Block pension pokémon
  const pensionSet = new Set([state.pension?.slotA, state.pension?.slotB].filter(Boolean));
  const pensionBlocked = pokemonIds.filter(id => pensionSet.has(id));
  if (pensionBlocked.length > 0) {
    notify('Les Pokémon en pension ne peuvent pas être vendus.', 'error');
    pokemonIds = pokemonIds.filter(id => !pensionSet.has(id));
    if (pokemonIds.length === 0) return;
  }
  // Block training pokémon
  const trainingSet = new Set(state.trainingRoom?.pokemon || []);
  const trainingBlocked = pokemonIds.filter(id => trainingSet.has(id));
  if (trainingBlocked.length > 0) {
    notify('Les Pokémon en formation ne peuvent pas être vendus.', 'error');
    pokemonIds = pokemonIds.filter(id => !trainingSet.has(id));
    if (pokemonIds.length === 0) return;
  }
  // Shiny confirmation
  if (!_shinyConfirmed) {
    const shinyIds = pokemonIds.filter(id => state.pokemons.find(p => p.id === id)?.shiny);
    if (shinyIds.length > 0) {
      const names = shinyIds.map(id => speciesName(state.pokemons.find(p => p.id === id)?.species_en)).join(', ');
      const modal = document.createElement('div');
      modal.style.cssText = 'position:fixed;inset:0;z-index:9500;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center';
      modal.innerHTML = `<div style="background:var(--bg-panel);border:2px solid var(--gold);border-radius:var(--radius);padding:20px;max-width:360px;width:92%;display:flex;flex-direction:column;gap:14px">
        <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold)">⚠ Vente de Chromatique</div>
        <div style="font-size:11px;color:var(--text)">Tu t'apprêtes à vendre <b style="color:#ffcc5a">${shinyIds.length} Pokémon Shiny</b> :<br><span style="font-size:9px;color:#aaa">${names}</span></div>
        <div style="font-size:9px;color:var(--text-dim)">Cette action est irréversible.</div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button id="shinyCancel" style="font-family:var(--font-pixel);font-size:9px;padding:8px 14px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">Annuler</button>
          <button id="shinyConfirm" style="font-family:var(--font-pixel);font-size:9px;padding:8px 14px;background:var(--bg);border:1px solid var(--gold);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">Vendre quand même</button>
        </div>
      </div>`;
      document.body.appendChild(modal);
      modal.querySelector('#shinyCancel').addEventListener('click', () => modal.remove());
      modal.querySelector('#shinyConfirm').addEventListener('click', () => { modal.remove(); sellPokemon(pokemonIds, true); });
      return;
    }
  }

  let total = 0;
  const toRemove = new Set(pokemonIds);
  // Unassign from agents/boss
  for (const agent of state.agents) {
    agent.team = agent.team.filter(id => !toRemove.has(id));
  }
  state.gang.bossTeam = state.gang.bossTeam.filter(id => !toRemove.has(id));
  // Remove from favorites
  state.favorites = state.favorites.filter(id => !toRemove.has(id));

  for (const id of pokemonIds) {
    const idx = state.pokemons.findIndex(p => p.id === id);
    if (idx === -1) continue;
    const p = state.pokemons[idx];
    const soldPrice = calculatePrice(p);
    total += soldPrice;
    state.pokemons.splice(idx, 1);
    state.stats.totalSold++;
    // Track most expensive sale
    if (!state.stats.mostExpensiveSold || soldPrice > (state.stats.mostExpensiveSold.price || 0)) {
      state.stats.mostExpensiveSold = { name: speciesName(p.species_en), price: soldPrice };
    }
  }
  state.gang.money += total;
  state.stats.totalMoneyEarned += total;
  notify(t('sold', { n: pokemonIds.length, price: total }), 'gold');
  addLog(t('sold', { n: pokemonIds.length, price: total }));
  SFX.play('sell');
  saveState();
  return total;
}

const BOOST_ITEMS = new Set(['incense', 'rarescope', 'aura', 'lure', 'superlure']);

function buyItem(itemDef) {
  const actualCost = itemDef.id === 'mysteryegg' ? getMysteryEggCost() : itemDef.cost;
  if (state.gang.money < actualCost) {
    notify(t('not_enough'));
    SFX.play('error')
    return false;
  }
  state.gang.money -= actualCost;
  state.stats.totalMoneySpent += actualCost;
  // Behavioural log — premier achat
  if (!state.behaviourLogs) state.behaviourLogs = {};
  if (!state.behaviourLogs.firstPurchaseAt) state.behaviourLogs.firstPurchaseAt = Date.now();

  if (itemDef.id === 'translator') {
    state.purchases.translator = true;
    notify('Traducteur Pokemon obtenu !', 'gold');
    saveState();
    return true;
  }

  if (itemDef.id === 'incubator') {
    state.inventory.incubator = (state.inventory.incubator || 0) + 1;
    notify(`Incubateur obtenu ! Total: ${state.inventory.incubator}`, 'gold');
    saveState();
    return true;
  }

  // ── Permis ailes (coût en items, pas en ₽) ───────────────────
  const WING_PERMIT_ITEMS = new Set(['tourbillon_permit','carillon_permit']);
  if (WING_PERMIT_ITEMS.has(itemDef.id)) {
    if (state.purchases[itemDef.id]) {
      notify(state.lang === 'fr' ? 'Déjà possédé !' : 'Already owned!');
      return false;
    }
    const wc = itemDef.wingCost;
    const have = state.inventory[wc.item] || 0;
    if (have < wc.qty) {
      const itemName = wc.item === 'silver_wing' ? 'Argent\'Aile' : 'Arcenci\'Aile';
      notify(`Il te faut ${wc.qty}× ${itemName} (tu en as ${have}).`, 'error');
      return false;
    }
    state.inventory[wc.item] -= wc.qty;
    state.purchases[itemDef.id] = true;
    const zone = ZONES.find(z => z.unlockItem === itemDef.id);
    const zLabel = zone ? (state.lang === 'fr' ? zone.fr : zone.en) : '';
    const pName  = state.lang === 'fr' ? itemDef.fr : itemDef.en;
    notify(`${pName} obtenu !${zLabel ? ' → ' + zLabel + ' accessible' : ''}`, 'gold');
    saveState();
    renderZonesTab?.();
    return true;
  }

  const ZONE_UNLOCK_ITEMS = new Set(['map_pallet','casino_ticket','silph_keycard','boat_ticket']);
  if (ZONE_UNLOCK_ITEMS.has(itemDef.id)) {
    if (state.purchases[itemDef.id]) {
      notify(state.lang === 'fr' ? 'Déjà possédé !' : 'Already owned!');
      state.gang.money += actualCost; // refund
      state.stats.totalMoneySpent -= actualCost;
      return false;
    }
    state.purchases[itemDef.id] = true;
    const zoneName = ZONES.find(z => z.unlockItem === itemDef.id);
    const name = state.lang === 'fr' ? (itemDef.fr || itemDef.id) : (itemDef.en || itemDef.id);
    const zLabel = zoneName ? (state.lang === 'fr' ? zoneName.fr : zoneName.en) : '';
    notify(`${name} obtenu !${zLabel ? ' → ' + zLabel + ' accessible' : ''}`, 'gold');
    saveState();
    renderZonesTab?.();
    return true;
  }

  if (itemDef.id === 'mysteryegg') {
    const species_en = weightedPick(MYSTERY_EGG_POOL);
    const sp = SPECIES_BY_EN[species_en];
    const potential = Math.random() < 0.1 ? 3 : Math.random() < 0.4 ? 2 : 1;
    const shiny = Math.random() < 0.02;
    state.eggs.push({ id: uid(), species_en, hatchAt: null, incubating: false, potential, shiny, mystery: true });
    state.purchases.mysteryEggCount = (state.purchases.mysteryEggCount || 0) + 1;
    tryAutoIncubate();
    notify(`🥚 Un œuf mystérieux est apparu… On se demande ce qu'il contient !`, 'gold');
    saveState();
    return true;
  }

  // All consumables go to inventory — player activates manually from the Zone bag bar
  state.inventory[itemDef.id] = (state.inventory[itemDef.id] || 0) + itemDef.qty;
  const _itemName = state.lang === 'fr' ? (itemDef.fr || BALLS[itemDef.id]?.fr || itemDef.id) : (itemDef.en || BALLS[itemDef.id]?.en || itemDef.id);
  notify(`${itemDef.qty}× ${_itemName} → sac`, 'success');
  SFX.play('buy');
  playSE('buy', 0.5);
  saveState();
  return true;
}

// ════════════════════════════════════════════════════════════════
// 10.  LLM MODULE
// ════════════════════════════════════════════════════════════════

async function detectLLM() {
  if (state.settings.llmProvider === 'none') {
    state.settings.llmEnabled = false;
    return;
  }
  if (state.settings.llmProvider === 'local') {
    try {
      const res = await fetch(`${state.settings.llmUrl}/api/tags`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        state.settings.llmEnabled = true;
        addLog(t('llm_connected'));
        return;
      }
    } catch { /* ignore */ }
  }
  if ((state.settings.llmProvider === 'openai' || state.settings.llmProvider === 'anthropic') && state.settings.llmApiKey) {
    state.settings.llmEnabled = true;
    addLog(t('llm_connected'));
    return;
  }
  state.settings.llmEnabled = false;
}

const FALLBACK_DIALOGUES = {
  fr: [
    'Prépare-toi à avoir des problèmes !',
    'Et fais-le double !',
    'Tu oses défier notre gang ?',
    'Tes Pokémon ne font pas le poids !',
    'La Team Rocket va t\'écraser !',
    'Tu n\'as aucune chance contre nous !',
    'Ton gang est une blague !',
    'Je vais te montrer la vraie puissance !',
    'Quoi ? Tu veux te battre ? Très bien !',
    'Je suis un dresseur ! J\'affronte tout ceux que je croise !',
    'Hé ! Ne me sous-estime pas !',
    'Les insectes sont les meilleurs Pokémon !',
    'Je me suis entraîné dur pour ce moment !',
    'Tu as l\'air fort... intéressant !',
    'Mon Pokémon est le plus fort de la route !',
    'Tu vas regretter d\'être venu ici !',
    'J\'ai perdu mon chemin... mais je vais te battre !',
    'Je suis imbattable ! Enfin je crois...',
  ],
  en: [
    'Prepare for trouble!',
    'And make it double!',
    'You dare challenge our gang?',
    'Your Pokémon don\'t stand a chance!',
    'Team Rocket will crush you!',
    'You have no chance against us!',
    'Your gang is a joke!',
    'I\'ll show you real power!',
  ],
};

function getTrainerDialogue() {
  return pick(FALLBACK_DIALOGUES[state.lang] || FALLBACK_DIALOGUES.fr);
}

// ════════════════════════════════════════════════════════════════
// 11.  UI — NOTIFICATIONS
// ════════════════════════════════════════════════════════════════

function notify(msg, type = '') {
  const container = document.getElementById('notifications');
  if (!container) return;
  if (type === 'gold') SFX.play('notify');
  // Stack identical toasts instead of spamming duplicates
  const existing = [...container.querySelectorAll('.toast')].find(el =>
    el.dataset.notifyMsg === msg && el.dataset.notifyType === (type || '')
  );
  if (existing) {
    const count = (parseInt(existing.dataset.notifyCount) || 1) + 1;
    existing.dataset.notifyCount = String(count);
    existing.textContent = `${msg} ×${count}`;
    clearTimeout(parseInt(existing.dataset.timerId || '0'));
    const tid = setTimeout(() => { existing.classList.add('leaving'); setTimeout(() => existing.remove(), 300); }, 3000);
    existing.dataset.timerId = String(tid);
    return;
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  el.dataset.notifyMsg = msg;
  el.dataset.notifyType = type || '';
  el.dataset.notifyCount = '1';
  container.appendChild(el);
  const tid = setTimeout(() => { el.classList.add('leaving'); setTimeout(() => el.remove(), 300); }, 3000);
  el.dataset.timerId = String(tid);
}

// Milestone : 10 000 000₽ → Charme Chroma
function checkMoneyMilestone() {
  if (state?.purchases?.chromaCharm) return;
  if (state.gang.money >= 10_000_000) {
    state.gang.money -= 10_000_000;
    state.purchases.chromaCharm = true;
    saveState();
    SFX.play('unlock');
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.96);display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `
      <div style="background:var(--bg-panel);border:3px solid var(--red);border-radius:var(--radius);padding:28px 32px;max-width:440px;width:92%;text-align:center;display:flex;flex-direction:column;align-items:center;gap:14px">
        <img src="https://lab.sterenna.fr/PG/pokegang_logo.png" style="width:72px;height:72px;image-rendering:pixelated" onerror="this.style.display='none'">
        <div style="font-family:var(--font-pixel);font-size:9px;color:var(--red);letter-spacing:2px">⚠ ALERTE — 10 000 000₽ DÉTECTÉS</div>
        <div style="display:flex;align-items:center;justify-content:center;gap:20px">
          <img src="${trainerSprite('scientist')}" style="width:52px;height:52px;image-rendering:pixelated">
          <img src="${trainerSprite('giovanni')}" style="width:52px;height:52px;image-rendering:pixelated">
        </div>
        <div style="font-family:var(--font-pixel);font-size:8px;color:var(--gold);line-height:2">
          L'équipe de développement vous remercie<br>
          pour ces ressources utiles à la création<br>
          de son empire...<br>
          <span style="font-size:13px;color:var(--red)">MOUAHAHAHA !</span>
        </div>
        <div style="font-size:10px;color:var(--text-dim);line-height:1.6">
          Vos <b style="color:var(--red)">10 000 000₽</b> ont été convertis en<br>
          <b style="color:var(--gold)">✨ Charme Chroma</b> — taux shiny ×2 permanent !
        </div>
        <button style="font-family:var(--font-pixel);font-size:9px;padding:9px 24px;background:var(--red-dark);border:2px solid var(--red);border-radius:var(--radius-sm);color:var(--text);cursor:pointer" id="btnChromaCharmClose">... Très bien.</button>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('#btnChromaCharmClose').addEventListener('click', () => modal.remove());
    notify('✨ Charme Chroma obtenu ! Taux shiny ×2', 'gold');
  }
}

// ── Cheat Codes ───────────────────────────────────────────────
const _CHEAT_CODES = {
  [btoa('RICHISSIM')]:       { money: 5_000_000 },
  [btoa('DOUBLERICHISSIM')]: { money: 10_000_000, title: 'doublerichissim' },
};
const _usedCodes = new Set();

function tryCheatCode(inputId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const raw = input.value.trim().toUpperCase();
  input.value = '';
  if (!raw) return;

  // 1. Essaie d'abord SECRET_CODES (codes titres, codes spéciaux)
  if (checkSecretCode(raw)) {
    // checkSecretCode gère déjà les notifications et la sauvegarde
    // Refresh cosmétiques si tab actif
    if (activeTab === 'tabCosmetics') renderCosmeticsTab();
    return;
  }

  // 2. Sinon legacy _CHEAT_CODES
  const key = btoa(raw);
  if (_usedCodes.has(key)) { notify('❌ Code déjà utilisé cette session', 'error'); return; }
  const code = _CHEAT_CODES[key];
  if (!code) { notify('❌ Code invalide', 'error'); SFX.play('error'); return; }
  _usedCodes.add(key);
  if (code.money) {
    state.gang.money += code.money;
    updateTopBar();
    notify(`💰 +${code.money.toLocaleString()}₽ !`, 'gold');
    SFX.play('unlock');
  }
  if (code.title) {
    state.purchases[`title_${code.title}`] = true;
    notify(`🏆 Titre obtenu : ${code.title}`, 'gold');
  }
  saveState();
  if (activeTab === 'tabCosmetics') renderCosmeticsTab();
}

// ── Gym Raid (manual + auto) ──────────────────────────────────
function triggerGymRaid(zoneId, isAuto) {
  const zone = ZONE_BY_ID[zoneId];
  if (!zone || !zone.gymLeader) return false;
  const zs = initZone(zoneId);
  const raidCooldownMs = 5 * 60 * 1000;
  if (Date.now() - (zs.gymRaidLastFight || 0) < raidCooldownMs) {
    if (!isAuto) notify('⏳ Raid d\'arène en cooldown !', 'error');
    return false;
  }
  if ((zs.combatsWon || 0) < 10) {
    if (!isAuto) notify('⚔ Remportez 10 combats d\'abord !', 'error');
    return false;
  }
  // Auto requires at least 1 manual win
  if (isAuto && !zs.gymDefeated) return false;

  zs.gymRaidLastFight = Date.now();
  saveState();

  // Build the gym leader's team
  const trainerKey = zone.gymLeader;
  const trainer = TRAINER_TYPES[trainerKey];
  if (!trainer) return false;

  const eliteDiff = trainer.diff + 3;
  const teamSize = 3;
  const team = [];
  for (let i = 0; i < teamSize; i++) {
    const sp = pick(zone.pool);
    const level = randInt(15 + eliteDiff * 5, 25 + eliteDiff * 7);
    team.push({ species_en: sp, level, stats: calculateStats({ species_en: sp, level, nature: 'hardy', potential: 4 }) });
  }
  const raidTrainer = {
    ...trainer,
    fr: `⚔ ${trainer.fr} (Champion)`,
    en: `⚔ ${trainer.en} (Leader)`,
    diff: eliteDiff,
    reward: [trainer.reward[0] * 5, trainer.reward[1] * 5],
    rep: trainer.rep * 3,
  };

  if (isAuto) {
    // Auto-fight via agent power
    const agentPower = state.agents.filter(a => a.assignedZone === zoneId)
      .reduce((s, a) => s + getAgentCombatPower(a), 0);
    let enemyPower = 0;
    for (const t of team) enemyPower += (t.stats.atk + t.stats.def + t.stats.spd);
    const win = agentPower * (0.8 + Math.random() * 0.4) >= enemyPower * (0.8 + Math.random() * 0.4);
    if (win) {
      const reward = Math.min(MAX_COMBAT_REWARD, randInt(raidTrainer.reward[0], raidTrainer.reward[1]));
      zs.pendingIncome = (zs.pendingIncome || 0) + reward;
      state.gang.reputation += raidTrainer.rep;
      state.stats.totalMoneyEarned += reward;
      state.stats.totalFights++;
      state.stats.totalFightsWon++;
      zs.combatsWon = (zs.combatsWon || 0) + 1;
      zs.gymDefeated = true;
      notify(`🏆 RAID AUTO — ${zone.fr} vaincu ! +${reward}₽`, 'gold');
      addBattleLogEntry({ ts: Date.now(), zoneName: `[RAID] ${zone.fr}`, win: true,
        reward, repGain: raidTrainer.rep, lines: [`Raid auto réussi contre ${trainerKey}`], trainerKey, isAgent: true });
    } else {
      state.stats.totalFights++;
      notify(`❌ Raid auto échoué — ${zone.fr}`, 'error');
    }
    saveState(); updateTopBar();
    return win;
  }

  // Manual raid → open combat popup
  openCombatPopup(zoneId, { type: 'trainer', trainerKey, trainer: raidTrainer, team, isGymRaid: true });
  return true;
}

// ════════════════════════════════════════════════════════════════
// 12.  UI — TABS & LAYOUT
// ════════════════════════════════════════════════════════════════

let activeTab = 'tabZones';
let zoneFilter = 'all'; // 'all' | 'fav' | 'route' | 'city' | 'special'

function hintLink(label, tabId) {
  return `<button onclick="switchTab('${tabId}')" style="font-family:var(--font-pixel);font-size:9px;color:var(--red);background:none;border:none;border-bottom:1px solid var(--red);cursor:pointer;padding:0">${label}</button>`;
}

function getTabHint(tabId) {
  const pc       = state.pokemons.length;
  const agents   = state.agents.length;
  const money    = state.gang.money;
  const bossTeam = state.gang.bossTeam.length;
  const hasZone  = openZones.size > 0;

  switch (tabId) {
    case 'tabGang':
      if (!state.gang.initialized) return 'Crée ton gang pour commencer.';
      if (bossTeam === 0 && pc === 0) return `Capture des Pokémon dans ${hintLink('Zones', 'tabZones')} puis assigne-en à ton équipe Boss.`;
      if (bossTeam === 0) return `Assigne des Pokémon à ton équipe Boss depuis le ${hintLink('PC', 'tabPC')} — clique sur un Pokémon → Équipe.`;
      if (!hasZone) return `Ouvre une zone dans ${hintLink('Zones', 'tabZones')} pour explorer et combattre.`;
      return `Vitrine : montre tes meilleurs Pokémon. L\'équipe Boss combat quand tu entres en zone.`;
    case 'tabAgents':
      if (pc === 0) return `Capture des Pokémon en ${hintLink('Zones', 'tabZones')} — tu pourras en recruter comme agents.`;
      if (agents === 0) return `Recrute un agent depuis le ${hintLink('PC', 'tabPC')} : clique sur un Pokémon → Recruter Agent. Les agents explorent les zones et ramènent de l'argent automatiquement.`;
      if (!hasZone) return `Assigne tes agents à une zone depuis ${hintLink('Zones', 'tabZones')} ou directement ici via le menu déroulant.`;
      return `Les agents assignés à une zone génèrent des ₽ toutes les 5 min. Collecte depuis l'onglet ${hintLink('Zones', 'tabZones')}.`;
    case 'tabZones':
      if (!hasZone) return `Clique sur <b>Route 1</b> puis sur <b>Ouvrir</b> pour explorer ta première zone.`;
      if (bossTeam === 0) return `Entre dans une zone avec ton boss — assigne d'abord un Pokémon à ton équipe depuis le ${hintLink('PC', 'tabPC')}.`;
      return `Capture des Pokémon, bats des dresseurs. 10 victoires → combats élites. Clique 💰 pour collecter les revenus.`;
    case 'tabBag':
      return null;
    case 'tabMarket':
      if (money < 500) return `Tu n'as presque plus d'argent. Bats des dresseurs ou vends des Pokémon en double depuis le ${hintLink('PC', 'tabPC')}.`;
      if (!state.inventory.pokeball) return `Achète des Pokéballs (100₽) dans la boutique pour pouvoir capturer des Pokémon.`;
      return `Boutique : Pokéballs, objets de boost, incubateurs. Quêtes : missions journalières pour des récompenses.`;
    case 'tabPC':
      if (pc === 0) return `Ton PC est vide. Capture des Pokémon en ${hintLink('Zones', 'tabZones')} pour les voir ici.`;
      if (bossTeam === 0) return `Clique sur un Pokémon → menu → <b>Équipe Boss</b> pour l'ajouter à ton équipe de combat.`;
      return `Filtre (Eq/Tr/PS), trie par prix/niveau/potentiel, vends les doublons.`;
    case 'tabTraining':
      if (pc === 0) return `Capture des Pokémon en ${hintLink('Zones', 'tabZones')} pour les entraîner.`;
      return `Place 2 à 6 Pokémon — ils s'affrontent automatiquement toutes les 60s. Gagnant : XP ×1.25, tous gagnent de l'XP.`;
    case 'tabLab':
      if (pc < 3) return `Capture plusieurs exemplaires du même Pokémon pour les fusionner au Labo et augmenter le Potentiel.`;
      return `Potentiel (⭐) = multiplicateur de prix et de stats. Sacrifie des doublons pour monter jusqu'à 5⭐ (max).`;
    case 'tabMissions':
      return `Missions journalières et hebdomadaires = source de ₽ et d'objets rares. Reviens chaque jour.`;
    case 'tabPokedex':
      return `${Object.values(state.pokedex).filter(e=>e.caught).length}/${POKEMON_GEN1.length} espèces capturées. Certaines sont très rares — explore toutes les zones.`;
    default:
      return null;
  }
}

// ── First-visit contextual hint (non-bloquant, disparaît en 6s ou au clic) ──
const _FIRST_VISIT_HINTS = {
  tabGang:     { icon: '👑', title: 'Ton Gang', body: 'C\'est ta base. Gère ton équipe Boss, place des Pokémon en vitrine et exporte ta fiche.' },
  tabAgents:   { icon: '👥', title: 'Les Agents', body: 'Assigne-leur une zone → ils récoltent de l\'argent automatiquement, même quand tu ne joues pas.' },
  tabZones:    { icon: '🗺', title: 'Zones', body: 'Explore des zones avec ton Boss pour capturer des Pokémon et battre des dresseurs. Plus tu progresses, plus tu débloques de zones.' },
  tabMarket:   { icon: '🛒', title: 'Marché', body: 'Achète des Pokéballs pour capturer, des incubateurs pour faire éclore des œufs, et plus encore.' },
  tabPC:       { icon: '💾', title: 'Le PC', body: 'Tous tes Pokémon sont ici. Assigne-les à ton équipe, à un agent, à la pension ou à la salle d\'entraînement.' },
  tabTraining: { icon: '🏋', title: 'Salle d\'entraînement', body: 'Tes Pokémon s\'entraînent automatiquement. Parfait pour monter en niveau des Pokémon que tu n\'utilises pas.' },
  tabLab:      { icon: '🔬', title: 'Laboratoire', body: 'Le Potentiel (⭐) multiplie la valeur et les stats d\'un Pokémon. Fusionne des doublons pour monter jusqu\'à 5⭐.' },
  tabMissions: { icon: '📋', title: 'Missions', body: 'Objectifs quotidiens et hebdomadaires. Complète-les pour des ₽ et des objets rares.' },
  tabPokedex:  { icon: '📖', title: 'Pokédex', body: 'Chaque espèce capturée est enregistrée ici. Vise 151/151 pour tout débloquer.' },
};

function showFirstVisitHint(tabId) {
  const def = _FIRST_VISIT_HINTS[tabId];
  if (!def) return;
  // Remove any existing hint
  document.getElementById('firstVisitHint')?.remove();

  const el = document.createElement('div');
  el.id = 'firstVisitHint';
  el.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:4000;
    background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);
    padding:12px 14px;max-width:260px;box-shadow:0 4px 20px rgba(0,0,0,.6);
    animation:fvhIn .3s ease;cursor:pointer;
  `;
  el.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:10px">
      <span style="font-size:20px;flex-shrink:0">${def.icon}</span>
      <div>
        <div style="font-family:var(--font-pixel);font-size:8px;color:var(--gold);margin-bottom:4px">${def.title}</div>
        <div style="font-size:10px;color:var(--text-dim);line-height:1.5">${def.body}</div>
      </div>
      <button style="background:none;border:none;color:var(--text-dim);font-size:14px;cursor:pointer;padding:0;flex-shrink:0;line-height:1" onclick="document.getElementById('firstVisitHint')?.remove()">✕</button>
    </div>`;

  document.body.appendChild(el);

  // Auto-dismiss after 7s
  const timer = setTimeout(() => {
    el.style.animation = 'fvhOut .3s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, 7000);
  el.addEventListener('click', () => { clearTimeout(timer); el.remove(); });
}

function renderHint(tabId) {
  const bar = document.getElementById('hintBar');
  if (!bar) return;
  const hint = getTabHint(tabId);
  if (hint) {
    bar.innerHTML = '&gt;&gt; ' + hint;
    bar.style.display = 'block';
  } else {
    bar.style.display = 'none';
  }
}

// Track which tabs have been seen (first-visit hints)
const _visitedTabs = new Set(JSON.parse(sessionStorage.getItem('pg_visited_tabs') || '[]'));

// ── "Ball assist" early-game helper (silencieux, jamais affiché au joueur) ──
let _ballAssistUntil = 0; // timestamp de fin de l'assist en cours

function getTotalBalls() {
  const inv = state.inventory;
  return (inv.pokeball || 0) + (inv.greatball || 0) + (inv.ultraball || 0)
       + (inv.duskball || 0) + (inv.masterball || 0);
}

function checkBallAssist() {
  if (Date.now() < _ballAssistUntil) return; // déjà actif
  if (getTotalBalls() < 10) {
    _ballAssistUntil = Date.now() + 2 * 60 * 1000; // 2 minutes
  }
}

function isBallAssistActive() {
  return Date.now() < _ballAssistUntil;
}

// ════════════════════════════════════════════════════════════════
// RACCOURCIS CLAVIER GLOBAUX
//  1-7 → onglets  |  Échap → ferme modale/fenêtre de zone
// ════════════════════════════════════════════════════════════════
function initKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    // Ignore si le focus est dans un champ texte
    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    // Ignore si une modale bloquante est ouverte
    if (document.getElementById('settingsModal')?.classList.contains('active')) return;
    if (document.getElementById('confirmModal')) return;

    switch (e.key) {
      // ── Onglets principaux ───────────────────────────────────
      case '1': switchTab('tabZones');    break;
      case '2': switchTab('tabPC');       break;
      case '3': switchTab('tabAgents');   break;
      case '4': switchTab('tabMarket');   break;
      case '5': switchTab('tabGang');     break;
      case '6': switchTab('tabPokedex');  break;
      case '7': switchTab('tabCosmetics'); break;

      // ── Sous-vues PC ─────────────────────────────────────────
      case 'p': case 'P':
        pcView = 'grid'; switchTab('tabPC'); break;
      case 'e': case 'E':
        pcView = 'eggs'; switchTab('tabPC'); break;
      case 't': case 'T':
        pcView = 'training'; switchTab('tabPC'); break;
      case 'l': case 'L':
        pcView = 'lab'; switchTab('tabPC'); break;

      // ── Fermeture rapide ─────────────────────────────────────
      case 'Escape': {
        // Ferme d'abord les fenêtres de zone ouvertes
        if (openZones && openZones.size > 0) {
          for (const zid of [...openZones]) closeZoneWindow(zid);
        }
        break;
      }
    }
  });
}

function switchTab(tabId) {
  if (tabId !== 'tabPC') _pcLastRenderKey = ''; // force full rebuild on next PC visit
  SFX.play('tabSwitch');
  activeTab = tabId;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === tabId);
  });
  renderHint(tabId);
  renderActiveTab();
  MusicPlayer.updateFromContext();
  updateTopBar(); // refresh objective / session on tab change
  // First-visit contextual hint
  if (!_visitedTabs.has(tabId)) {
    _visitedTabs.add(tabId);
    sessionStorage.setItem('pg_visited_tabs', JSON.stringify([..._visitedTabs]));
    showFirstVisitHint(tabId);
  }
  // Behavioural log — compteur de visites par onglet
  if (!state.behaviourLogs) state.behaviourLogs = {};
  if (!state.behaviourLogs.tabViewCounts) state.behaviourLogs.tabViewCounts = {};
  state.behaviourLogs.tabViewCounts[tabId] = (state.behaviourLogs.tabViewCounts[tabId] || 0) + 1;
}

function updateTopBar() {
  const gangEl = document.getElementById('gangNameDisplay');
  const moneyEl = document.getElementById('moneyDisplay');
  if (gangEl) {
    const kantoComplete = POKEMON_GEN1.filter(s => !s.hidden && s.dex >= 1 && s.dex <= 151).every(s => state.pokedex[s.en]?.caught);
    const fullComplete  = POKEMON_GEN1.filter(s => !s.hidden).every(s => state.pokedex[s.en]?.caught);
    const dexIcon = fullComplete ? ' 🌟' : kantoComplete ? ' 📖' : '';
    gangEl.textContent = state.gang.name + dexIcon;
  }
  if (moneyEl) moneyEl.innerHTML = `<span>₽</span> ${state.gang.money.toLocaleString()}`;
  const repEl = document.getElementById('repDisplay');
  if (repEl) repEl.innerHTML = `<span>⭐</span> ${state.gang.reputation.toLocaleString()}`;
  const pkCountEl = document.getElementById('pokemonCountDisplay');
  if (pkCountEl) pkCountEl.innerHTML = `<img src="${ITEM_SPRITE_URLS.pokeball}" style="width:20px;height:20px;image-rendering:pixelated" onerror="this.style.display='none'"> ${state.pokemons.length.toLocaleString()}`;

  // ── Ball assist silencieux (early-game) ───────────────────
  checkBallAssist();
  checkTitleUnlocks();
  updateDiscovery();
  // Auto-buy ball
  if (state.settings.autoBuyBall) {
    const ballId = state.settings.autoBuyBall;
    if ((state.inventory[ballId] || 0) === 0) {
      const ballDef = BALLS[ballId];
      if (ballDef && state.gang.money >= ballDef.cost) {
        state.inventory[ballId] = (state.inventory[ballId] || 0) + 1;
        state.gang.money -= ballDef.cost;
        notify(`🔄 Achat auto : 1× ${ballDef.fr}`, 'success');
      }
    }
  }

  // ── Session delta bar ──────────────────────────────────────
  _saveSessionActivity();
  const sessionBar = document.getElementById('sessionBar');
  if (sessionBar) {
    const delta = getSessionDelta();
    if (delta) {
      sessionBar.innerHTML = `<span style="color:var(--text-dim);font-family:var(--font-pixel);font-size:7px;letter-spacing:.05em">SESSION</span> ${delta}`;
      sessionBar.style.display = 'flex';
    } else {
      sessionBar.style.display = 'none';
    }
  }

  // ── Objective bar ──────────────────────────────────────────
  const objBar = document.getElementById('objectiveBar');
  if (objBar) {
    const obj = getNextObjective();
    if (obj) {
      const tabBtn = obj.tab
        ? `<button onclick="switchTab('${obj.tab}')" style="font-family:var(--font-pixel);font-size:7px;color:var(--red);background:none;border:none;border-bottom:1px solid var(--red);cursor:pointer;padding:0;margin-left:6px">${obj.detail || obj.tab}</button>`
        : (obj.detail ? `<span style="color:var(--text-dim);font-size:9px;margin-left:6px">${obj.detail}</span>` : '');
      objBar.innerHTML = `<span style="font-family:var(--font-pixel);font-size:7px;color:var(--gold-dim,#999);margin-right:6px">▶</span><span style="font-size:9px;color:var(--text)">${obj.text}</span>${tabBtn}`;
      objBar.style.display = 'flex';
    } else {
      objBar.style.display = 'none';
    }
  }
}

function renderAll() {
  updateTopBar();
  renderHint(activeTab);
  renderActiveTab();
}

function renderActiveTab() {
  switch (activeTab) {
    case 'tabGang':     renderGangTab(); break;
    case 'tabZones':    renderZonesTab(); break;
    case 'tabMarket':   renderMarketTab(); break;
    case 'tabPC':       renderPCTab(); break;
    case 'tabPokedex':  renderPokedexTab(); break;
    case 'tabAgents':   renderAgentsTab(); break;
    case 'tabBag':        switchTab('tabMarket'); break;
    case 'tabCosmetics':  renderCosmeticsTab(); break;
    case 'tabMissions':   renderMissionsTab(); break;
    case 'tabTraining': pcView = 'training'; switchTab('tabPC'); break;
    case 'tabLab':      pcView = 'lab'; switchTab('tabPC'); break;
    case 'tabCompte':   renderCompteTab(); break;
  }
}

// ════════════════════════════════════════════════════════════════
//  SAVE SLOTS
// ════════════════════════════════════════════════════════════════

function getSlotPreview(slotIdx) {
  const raw = localStorage.getItem(SAVE_KEYS[slotIdx]);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    const teamIds = s.gang?.bossTeam || [];
    const teamSprites = teamIds.slice(0, 3).map(id => {
      const pk = (s.pokemons || []).find(p => p.id === id);
      return pk ? pk.species_en : null;
    }).filter(Boolean);
    const agentSprites = (s.agents || []).slice(0, 3).map(a => a.sprite);
    return {
      name: s.gang?.name || '???',
      money: s.gang?.money || 0,
      pokemon: (s.pokemons || []).length,
      rep: s.gang?.reputation || 0,
      ts: s._savedAt || 0,
      playtime: s.playtime || 0,
      bossName: s.gang?.bossName || 'Boss',
      bossSprite: s.gang?.bossSprite || '',
      teamSprites,
      agentCount: (s.agents || []).length,
      agentSprites,
    };
  } catch { return null; }
}

function openSaveSlotModal() {
  const overlay = document.createElement('div');
  overlay.id = 'saveSlotModal';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center';

  const slots = [0, 1, 2].map(i => {
    const prev = getSlotPreview(i);
    const isActive = i === activeSaveSlot;
    const label = prev
      ? `<div style="font-family:var(--font-pixel);font-size:9px;color:${isActive ? 'var(--gold)' : 'var(--text)'};margin-bottom:4px">${prev.name}</div>
         <div style="font-size:10px;color:var(--text-dim)">${prev.pokemon} Pokemon  |  ${prev.money.toLocaleString()}P  |  Rep ${prev.rep}</div>
         <div style="font-size:9px;color:var(--text-dim);margin-top:2px">${prev.ts ? new Date(prev.ts).toLocaleString() : ''}${prev.playtime ? ' — ' + formatPlaytime(prev.playtime) : ''}</div>`
      : `<div style="font-size:10px;color:var(--text-dim);font-style:italic">Slot vide</div>`;
    return `<div style="border:2px solid ${isActive ? 'var(--gold)' : 'var(--border)'};border-radius:var(--radius);padding:12px;margin-bottom:10px;background:var(--bg-panel)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-family:var(--font-pixel);font-size:9px;color:var(--text-dim)">SLOT ${i + 1}</span>
        ${isActive ? '<span style="font-size:9px;color:var(--gold);margin-left:auto">[ACTIF]</span>' : ''}
      </div>
      ${label}
      <div style="display:flex;gap:6px;margin-top:10px">
        ${prev ? `<button class="slot-load" data-slot="${i}" style="flex:1;font-size:9px;padding:5px;background:var(--bg);border:1px solid var(--green);border-radius:var(--radius-sm);color:var(--green);cursor:pointer">Charger</button>` : ''}
        <button class="slot-save" data-slot="${i}" style="flex:1;font-size:9px;padding:5px;background:var(--bg);border:1px solid var(--blue);border-radius:var(--radius-sm);color:var(--blue);cursor:pointer">Sauvegarder</button>
        ${prev && !isActive ? `<button class="slot-del" data-slot="${i}" style="flex:1;font-size:9px;padding:5px;background:var(--bg);border:1px solid var(--red);border-radius:var(--radius-sm);color:var(--red);cursor:pointer">Supprimer</button>` : ''}
      </div>
    </div>`;
  }).join('');

  overlay.innerHTML = `<div style="background:var(--bg-panel);border:2px solid var(--gold);border-radius:var(--radius);width:90%;max-width:420px;padding:20px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <span style="font-family:var(--font-pixel);font-size:11px;color:var(--gold)">SAUVEGARDES</span>
      <button id="closeSlotModal" style="background:none;border:none;color:var(--text-dim);font-size:20px;cursor:pointer">&times;</button>
    </div>
    ${slots}
  </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector('#closeSlotModal').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelectorAll('.slot-load').forEach(btn => {
    btn.addEventListener('click', () => { loadSlot(parseInt(btn.dataset.slot)); overlay.remove(); });
  });
  overlay.querySelectorAll('.slot-save').forEach(btn => {
    btn.addEventListener('click', () => { saveToSlot(parseInt(btn.dataset.slot)); overlay.remove(); });
  });
  overlay.querySelectorAll('.slot-del').forEach(btn => {
    btn.addEventListener('click', () => {
      showConfirm(`Supprimer le slot ${parseInt(btn.dataset.slot) + 1} ?`, () => {
        localStorage.removeItem(SAVE_KEYS[parseInt(btn.dataset.slot)]);
        overlay.remove();
        notify('Slot supprime.', 'success');
      }, null, { danger: true, confirmLabel: 'Supprimer', cancelLabel: 'Annuler' });
    });
  });
}

function saveToSlot(slotIdx) {
  // If switching slot: save current first
  const prev = activeSaveSlot;
  state._savedAt = Date.now();
  localStorage.setItem(SAVE_KEYS[prev], JSON.stringify(state));
  // Now copy to target slot
  activeSaveSlot = slotIdx;
  SAVE_KEY = SAVE_KEYS[slotIdx];
  localStorage.setItem('pokeforge.activeSlot', String(slotIdx));
  saveState();
  notify(`Sauvegarde Slot ${slotIdx + 1}`, 'success');
}

function loadSlot(slotIdx) {
  const raw = localStorage.getItem(SAVE_KEYS[slotIdx]);
  if (!raw) { notify('Slot vide.'); return; }
  try {
    state = migrate(JSON.parse(raw));
    activeSaveSlot = slotIdx;
    SAVE_KEY = SAVE_KEYS[slotIdx];
    localStorage.setItem('pokeforge.activeSlot', String(slotIdx));
    renderAll();
    notify(`Slot ${slotIdx + 1} charge !`, 'success');
  } catch { notify('Erreur de chargement.'); }
}

// ════════════════════════════════════════════════════════════════
//  COSMETICS
// ════════════════════════════════════════════════════════════════

function applyCosmetics() {
  const bgKey = state.cosmetics?.gameBg;
  const bg = bgKey ? COSMETIC_BGS[bgKey] : null;
  const _bgTargets = [document.documentElement, document.body];
  if (bg?.type === 'image') {
    _bgTargets.forEach(el => {
      el.style.backgroundImage = `url('${bg.url}')`;
      el.style.backgroundSize = 'cover';
      el.style.backgroundAttachment = 'fixed';
      el.style.backgroundPosition = 'center';
      el.style.backgroundRepeat = 'no-repeat';
    });
    document.documentElement.style.setProperty('--bg', 'rgba(10,10,10,0.72)');
    document.documentElement.style.setProperty('--bg-card', 'rgba(20,20,20,0.70)');
    document.documentElement.style.setProperty('--bg-panel', 'rgba(26,26,26,0.70)');
    document.documentElement.style.setProperty('--bg-hover', 'rgba(34,34,34,0.80)');
  } else if (bg?.type === 'gradient') {
    _bgTargets.forEach(el => {
      el.style.backgroundImage = bg.gradient;
      el.style.backgroundSize = 'cover';
      el.style.backgroundAttachment = 'fixed';
      el.style.backgroundPosition = 'center';
      el.style.backgroundRepeat = 'no-repeat';
    });
    document.documentElement.style.setProperty('--bg', '#0a0a0a');
    document.documentElement.style.setProperty('--bg-card', '#141414');
    document.documentElement.style.setProperty('--bg-panel', '#1a1a1a');
    document.documentElement.style.setProperty('--bg-hover', '#222');
  } else {
    _bgTargets.forEach(el => { el.style.backgroundImage = ''; });
    document.documentElement.style.setProperty('--bg', '#0a0a0a');
    document.documentElement.style.setProperty('--bg-card', '#141414');
    document.documentElement.style.setProperty('--bg-panel', '#1a1a1a');
    document.documentElement.style.setProperty('--bg-hover', '#222');
  }
}

function openSpritePicker(currentSprite, callback) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:5000;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);padding:16px;max-width:500px;width:95%;display:flex;flex-direction:column;gap:12px">
      <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold)">Choisir un sprite</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;max-height:280px;overflow-y:auto" id="spritePickerGrid">
        ${BOSS_SPRITES.map(s => `
          <div class="spr-opt" data-spr="${s}" style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px;border:2px solid ${s === currentSprite ? 'var(--gold)' : 'var(--border)'};border-radius:4px;cursor:pointer;background:var(--bg-card)">
            <img src="${trainerSprite(s)}" style="width:36px;height:36px;image-rendering:pixelated">
            <span style="font-size:7px;color:var(--text-dim)">${s}</span>
          </div>`).join('')}
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="spritePickerCancel" style="font-family:var(--font-pixel);font-size:9px;padding:6px 12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">Annuler</button>
        <button id="spritePickerConfirm" style="font-family:var(--font-pixel);font-size:9px;padding:6px 12px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">Confirmer</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  let selectedSpr = currentSprite || BOSS_SPRITES[0];
  overlay.querySelectorAll('.spr-opt').forEach(el => {
    el.addEventListener('click', () => {
      overlay.querySelectorAll('.spr-opt').forEach(o => o.style.borderColor = 'var(--border)');
      el.style.borderColor = 'var(--gold)';
      selectedSpr = el.dataset.spr;
    });
  });

  document.getElementById('spritePickerCancel').addEventListener('click', () => overlay.remove());
  document.getElementById('spritePickerConfirm').addEventListener('click', () => {
    overlay.remove();
    if (selectedSpr) callback(selectedSpr);
  });
}

function renderCosmeticsPanel(container) {
  const unlocked = new Set(state.cosmetics?.unlockedBgs || []);
  const active = state.cosmetics?.gameBg || null;

  // ── Jukebox ──────────────────────────────────────────────────
  const JUKEBOX_TRACKS = [
    { key: 'base',     icon: '🏠', label: 'Base' },
    { key: 'forest',   icon: '🌿', label: 'Route' },
    { key: 'cave',     icon: '⛏', label: 'Caverne' },
    { key: 'city',     icon: '🏙', label: 'Ville' },
    { key: 'sea',      icon: '🌊', label: 'Mer' },
    { key: 'safari',   icon: '🦒', label: 'Safari' },
    { key: 'lavender', icon: '💜', label: 'Lavanville' },
    { key: 'tower',    icon: '👻', label: 'Tour' },
    { key: 'mansion',  icon: '🕯', label: 'Manoir' },
    { key: 'gym',      icon: '⚔', label: 'Arène' },
    { key: 'rocket',   icon: '🚀', label: 'Rocket' },
    { key: 'silph',    icon: '🔬', label: 'Sylphe' },
    { key: 'elite4',   icon: '👑', label: 'Élite 4' },
    { key: 'casino',   icon: '🎰', label: 'Casino' },
  ];
  const isTrackUnlocked = (key) => {
    if (key === 'base') return true;
    return ZONES.some(z => z.music === key && isZoneUnlocked(z.id));
  };
  const currentJuke = state.settings?.jukeboxTrack || null;
  const jukeHtml = JUKEBOX_TRACKS.map(t => {
    const tUnlocked = isTrackUnlocked(t.key);
    const tActive = currentJuke === t.key;
    return `<div class="jukebox-track${tActive ? ' active' : ''}${tUnlocked ? '' : ' locked'}" data-jukebox-track="${t.key}" title="${t.label}${tUnlocked ? '' : ' — Verrou'}">
      <span class="juke-icon">${tUnlocked ? t.icon : '🔒'}</span>
      <span class="juke-label">${t.label}</span>
    </div>`;
  }).join('');

  // ── Fonds d'écran ─────────────────────────────────────────────
  const bgImagesHtml = Object.entries(COSMETIC_BGS).filter(([,c]) => c.type === 'image').map(([key, c]) => {
    const own = unlocked.has(key);
    const isActive = active === key;
    return `<div class="cosm-card ${isActive ? 'cosm-active' : ''}" data-cosm="${key}" style="border:2px solid ${isActive ? 'var(--gold)' : own ? 'var(--green)' : 'var(--border)'};border-radius:var(--radius-sm);padding:8px;cursor:pointer;background:var(--bg-card)">
      <div style="height:50px;background-image:url('${c.url}');background-size:cover;background-position:center;border-radius:2px;margin-bottom:6px"></div>
      <div style="font-size:9px">${c.fr}</div>
      <div style="font-size:8px;color:${isActive ? 'var(--gold)' : own ? 'var(--green)' : 'var(--text-dim)'}">
        ${isActive ? '[ ACTIF ]' : own ? 'Équiper' : c.cost.toLocaleString() + '₽'}
      </div>
    </div>`;
  }).join('');

  const bgGradientsHtml = Object.entries(COSMETIC_BGS).filter(([,c]) => c.type === 'gradient').map(([key, c]) => {
    const own = unlocked.has(key);
    const isActive = active === key;
    return `<div class="cosm-card ${isActive ? 'cosm-active' : ''}" data-cosm="${key}" style="border:2px solid ${isActive ? 'var(--gold)' : own ? 'var(--green)' : 'var(--border)'};border-radius:var(--radius-sm);padding:8px;cursor:pointer;background:var(--bg-card)">
      <div style="height:50px;background:${c.gradient};border-radius:2px;margin-bottom:6px"></div>
      <div style="font-size:9px">${c.fr}</div>
      <div style="font-size:8px;color:${isActive ? 'var(--gold)' : own ? 'var(--green)' : 'var(--text-dim)'}">
        ${isActive ? '[ ACTIF ]' : own ? 'Équiper' : c.cost.toLocaleString() + '₽'}
      </div>
    </div>`;
  }).join('');

  container.innerHTML = `
    <!-- ── Jukebox ── -->
    <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold);margin-bottom:8px">🎵 JUKEBOX
      <span style="font-size:7px;color:var(--text-dim);font-weight:normal;margin-left:6px">${currentJuke ? MUSIC_TRACKS[currentJuke]?.fr || currentJuke : 'AUTO'}</span>
    </div>
    <div class="base-jukebox" style="margin-bottom:18px">${jukeHtml}
      <div class="jukebox-track${!currentJuke ? ' active' : ''}" data-jukebox-track="__auto__" title="Musique automatique selon la zone">
        <span class="juke-icon">🔄</span>
        <span class="juke-label">AUTO</span>
      </div>
    </div>

    <!-- ── Fonds d'écran photo ── -->
    <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold);margin-bottom:10px">🖼 FOND D'ÉCRAN</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;margin-bottom:8px">
      <div class="cosm-card ${!active ? 'cosm-active' : ''}" data-cosm="none" style="border:2px solid ${!active ? 'var(--gold)' : 'var(--border)'};border-radius:var(--radius-sm);padding:8px;cursor:pointer;background:var(--bg-card)">
        <div style="height:50px;background:linear-gradient(180deg,#0a0a0a,#1a1a1a);border-radius:2px;margin-bottom:6px"></div>
        <div style="font-size:9px">Défaut</div>
        <div style="font-size:8px;color:${!active ? 'var(--gold)' : 'var(--text-dim)'}">Gratuit ${!active ? '[ ACTIF ]' : ''}</div>
      </div>
      ${bgImagesHtml}
    </div>

    <!-- ── Thèmes couleur ── -->
    <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold);margin-bottom:10px;margin-top:6px">🎨 THÈMES</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px">
      ${bgGradientsHtml}
    </div>`;

  // Jukebox handlers
  container.querySelectorAll('[data-jukebox-track]').forEach(el => {
    el.addEventListener('click', () => {
      const key = el.dataset.jukeboxTrack;
      if (el.classList.contains('locked')) { notify('🔒 Débloquez cette zone pour accéder à cette musique', 'error'); return; }
      if (key === '__auto__') {
        state.settings.jukeboxTrack = null;
        notify('🎵 Jukebox → Auto', 'success');
      } else {
        state.settings.jukeboxTrack = key;
        notify(`🎵 ${MUSIC_TRACKS[key]?.fr || key}`, 'success');
      }
      saveState();
      MusicPlayer.updateFromContext();
      renderCosmeticsPanel(container);
    });
  });

  // Wallpaper / theme handlers
  container.querySelectorAll('.cosm-card').forEach(el => {
    el.addEventListener('click', () => {
      const key = el.dataset.cosm;
      if (key === 'none') {
        state.cosmetics.gameBg = null;
        saveState(); applyCosmetics();
        renderCosmeticsPanel(container);
        return;
      }
      const c = COSMETIC_BGS[key];
      if (!c) return;
      if (unlocked.has(key)) {
        state.cosmetics.gameBg = key;
        saveState(); applyCosmetics();
        renderCosmeticsPanel(container);
      } else {
        if (state.gang.money < c.cost) { notify('Fonds insuffisants.', 'error'); return; }
        showConfirm(`Acheter "${c.fr}" pour ${c.cost.toLocaleString()}₽ ?`, () => {
          state.gang.money -= c.cost;
          state.cosmetics.unlockedBgs = [...(state.cosmetics.unlockedBgs || []), key];
          state.cosmetics.gameBg = key;
          saveState(); applyCosmetics();
          updateTopBar();
          notify(`🎨 "${c.fr}" débloqué !`, 'gold');
          SFX.play('unlock');
          renderCosmeticsPanel(container);
        }, null, { confirmLabel: 'Acheter', cancelLabel: 'Annuler' });
      }
    });
  });

  // Appearance section (reputation-based)
  const appHtml = `
    <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold);margin-top:18px;margin-bottom:10px">APPARENCE</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <div style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px;background:var(--bg-card)">
        <div style="font-size:9px;margin-bottom:6px">👤 Boss: <strong>${state.gang.bossName}</strong></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="cosm-action-btn" data-cosm-action="rename-boss" style="font-family:var(--font-pixel);font-size:8px;padding:4px 8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">✏ Renommer (2 000₽)</button>
          <button class="cosm-action-btn" data-cosm-action="sprite-boss" style="font-family:var(--font-pixel);font-size:8px;padding:4px 8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">🎨 Sprite (5 000₽)</button>
        </div>
      </div>
      ${state.agents.map(a => `
      <div style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px;background:var(--bg-card)" data-agent-cosm="${a.id}">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <img src="${a.sprite}" style="width:28px;height:28px;image-rendering:pixelated" onerror="this.src='${trainerSprite('acetrainer')}'">
          <span style="font-size:9px">Agent: <strong>${a.name}</strong></span>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="cosm-action-btn" data-cosm-action="rename-agent" data-agent-id="${a.id}" style="font-family:var(--font-pixel);font-size:8px;padding:4px 8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">✏ Renommer (2 000₽)</button>
          <button class="cosm-action-btn" data-cosm-action="sprite-agent" data-agent-id="${a.id}" style="font-family:var(--font-pixel);font-size:8px;padding:4px 8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">🎨 Sprite (5 000₽)</button>
        </div>
      </div>`).join('')}
    </div>`;

  const appDiv = document.createElement('div');
  appDiv.innerHTML = appHtml;
  container.appendChild(appDiv);

  // Bind appearance buttons
  container.querySelectorAll('.cosm-action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.cosmAction;
      const agentId = btn.dataset.agentId;

      if (action === 'rename-boss') {
        if (state.gang.money < 2000) { notify('Pokédollars insuffisants (2000₽)', 'error'); return; }
        const newName = prompt(`Nouveau nom du Boss (max 16 car.) :`);
        if (!newName || !newName.trim()) return;
        state.gang.money -= 2000;
        state.gang.bossName = newName.trim().slice(0, 16);
        saveState(); updateTopBar(); renderCosmeticsPanel(container);
        notify(`Boss renommé : ${state.gang.bossName}`, 'gold');
      } else if (action === 'rename-agent') {
        if (state.gang.money < 2000) { notify('Pokédollars insuffisants (2000₽)', 'error'); return; }
        const agent = state.agents.find(a => a.id === agentId);
        if (!agent) return;
        const newName = prompt(`Nouveau nom de ${agent.name} (max 16 car.) :`);
        if (!newName || !newName.trim()) return;
        state.gang.money -= 2000;
        agent.name = newName.trim().slice(0, 16);
        saveState(); updateTopBar(); renderCosmeticsPanel(container);
        notify(`Agent renommé : ${agent.name}`, 'gold');
      } else if (action === 'sprite-boss') {
        if (state.gang.money < 5000) { notify('Pokédollars insuffisants (5000₽)', 'error'); return; }
        openSpritePicker(state.gang.bossSprite, (newSprite) => {
          state.gang.money -= 5000;
          state.gang.bossSprite = newSprite;
          saveState(); updateTopBar(); renderZonesTab(); renderCosmeticsPanel(container);
          notify('Sprite du Boss mis à jour !', 'gold');
        });
      } else if (action === 'sprite-agent') {
        if (state.gang.money < 5000) { notify('Pokédollars insuffisants (5000₽)', 'error'); return; }
        const agent = state.agents.find(a => a.id === agentId);
        if (!agent) return;
        openSpritePicker(null, (newSprite) => {
          state.gang.money -= 5000;
          agent.sprite = trainerSprite(newSprite);
          saveState(); renderCosmeticsPanel(container);
          notify(`Sprite de ${agent.name} mis à jour !`, 'gold');
        });
      }
    });
  });

  // ── Section TITRES ─────────────────────────────────────────────
  const titresDiv = document.createElement('div');
  titresDiv.style.cssText = 'margin-top:20px';
  const t1id = state.gang.titleA; const t2id = state.gang.titleB;
  const lia  = state.gang.titleLiaison || '';
  const t1label = t1id ? (TITLES.find(t => t.id === t1id)?.label || t1id) : '—';
  const t2label = t2id ? (TITLES.find(t => t.id === t2id)?.label || t2id) : '—';
  const titleStr = [t1label, lia, t2label].filter(Boolean).join(' ');
  const tCLabel = getTitleLabel(state.gang.titleC);
  const tDLabel = getTitleLabel(state.gang.titleD);
  const badgesHtml = [tCLabel, tDLabel].filter(Boolean).map((b, i) => {
    const color = i === 0 ? '#4fc3f7' : '#ce93d8';
    return `<span style="font-family:var(--font-pixel);font-size:7px;padding:2px 7px;border-radius:10px;border:1px solid ${color};color:${color}">${b}</span>`;
  }).join('');
  titresDiv.innerHTML = `
    <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold);margin-bottom:10px">TITRES</div>
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px;display:flex;flex-direction:column;gap:8px">
      <div style="font-size:9px;color:var(--text-dim)">Titre principal :</div>
      <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold);min-height:1em">${titleStr || '(aucun)'}</div>
      ${badgesHtml ? `<div style="display:flex;gap:6px;flex-wrap:wrap">${badgesHtml}</div>` : ''}
      <div style="font-size:8px;color:var(--text-dim)">${(state.unlockedTitles||[]).length} titres débloqués</div>
      <button id="btnOpenTitlesFromCosm" style="font-family:var(--font-pixel);font-size:8px;padding:6px 12px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer;align-self:flex-start">🏷 Gérer les titres</button>
    </div>`;
  container.appendChild(titresDiv);
  titresDiv.querySelector('#btnOpenTitlesFromCosm')?.addEventListener('click', () => {
    openTitleModal();
  });

  // ── Infirmière Joëlle corrompue ────────────────────────────────
  const nurseDiv = document.createElement('div');
  nurseDiv.style.cssText = 'margin-top:20px';
  const nurseOwned   = !!state.purchases?.autoIncubator;
  const nurseEnabled = state.purchases?.autoIncubatorEnabled !== false; // true par défaut
  nurseDiv.innerHTML = `
    <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold);margin-bottom:10px">SERVICES SPÉCIAUX</div>
    <div style="background:var(--bg-card);border:1px solid ${nurseOwned ? (nurseEnabled ? 'var(--green)' : 'var(--border)') : 'var(--border)'};border-radius:var(--radius-sm);padding:10px;display:flex;gap:12px;align-items:flex-start">
      <img src="${trainerSprite('nurse')}" style="width:48px;height:48px;image-rendering:pixelated;flex-shrink:0;${nurseOwned && !nurseEnabled ? 'opacity:.4;filter:grayscale(1)' : ''}" onerror="this.style.display='none'">
      <div style="flex:1">
        <div style="font-family:var(--font-pixel);font-size:9px;color:${nurseOwned ? (nurseEnabled ? 'var(--green)' : 'var(--text-dim)') : 'var(--text)'};margin-bottom:4px">Infirmière Joëlle corrompue</div>
        <div style="font-size:8px;color:var(--text-dim);margin-bottom:8px">Met automatiquement les oeufs en incubation dès qu'un incubateur est libre.</div>
        ${nurseOwned
          ? `<div style="display:flex;align-items:center;gap:8px">
               <span style="font-family:var(--font-pixel);font-size:8px;color:${nurseEnabled ? 'var(--green)' : 'var(--text-dim)'}">
                 ${nurseEnabled ? '✓ EN POSTE' : '✗ CONGÉ'}
               </span>
               <button id="btnToggleNurse" style="font-family:var(--font-pixel);font-size:8px;padding:4px 10px;background:var(--bg);border:1px solid ${nurseEnabled ? 'var(--red)' : 'var(--green)'};border-radius:var(--radius-sm);color:${nurseEnabled ? 'var(--red)' : 'var(--green)'};cursor:pointer">
                 ${nurseEnabled ? 'Mettre en congé' : 'Rappeler'}
               </button>
             </div>`
          : `<button id="btnBuyNurse" style="font-family:var(--font-pixel);font-size:8px;padding:6px 12px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">Embaucher — 300 000₽</button>`}
      </div>
    </div>`;
  container.appendChild(nurseDiv);
  nurseDiv.querySelector('#btnBuyNurse')?.addEventListener('click', () => {
    if (state.gang.money < 300000) { notify('Fonds insuffisants.', 'error'); SFX.play('error'); return; }
    showConfirm('Embaucher l\'Infirmière Joëlle corrompue pour 300 000₽ ? (permanent)', () => {
      state.gang.money -= 300000;
      state.purchases.autoIncubator = true;
      state.purchases.autoIncubatorEnabled = true;
      saveState(); updateTopBar();
      SFX.play('unlock');
      notify('💉 Joëlle est en poste ! Les oeufs seront auto-incubés.', 'gold');
      tryAutoIncubate();
      renderCosmeticsPanel(container);
    }, null, { confirmLabel: 'Embaucher', cancelLabel: 'Annuler' });
  });
  nurseDiv.querySelector('#btnToggleNurse')?.addEventListener('click', () => {
    state.purchases.autoIncubatorEnabled = !nurseEnabled;
    saveState();
    const msg = state.purchases.autoIncubatorEnabled
      ? '💉 Joëlle est de retour en poste !'
      : '😴 Joëlle est en congé.';
    notify(msg, 'success');
    renderCosmeticsPanel(container);
  });

  // ── Achats spéciaux (Titres, Charme Chroma, Auto-récolte) ──────
  const SPECIAL_PURCHASES = [
    {
      id: 'title_richissime',
      icon: '💰', label: 'Titre "Richissime"',
      desc: 'Débloque le titre légendaire. Ostentation maximale.',
      cost: 5_000_000,
      owned: () => !!state.purchases?.title_richissime || (state.unlockedTitles || []).includes('richissime'),
      buy: () => {
        state.purchases = state.purchases || {};
        state.purchases.title_richissime = true;
        state.unlockedTitles = [...new Set([...(state.unlockedTitles || []), 'richissime'])];
        notify('💰 Titre "Richissime" débloqué !', 'gold');
      },
    },
    {
      id: 'title_doublerichissim',
      icon: '💎', label: 'Titre "Double Richissime"',
      desc: 'Débloque le titre ultime. Noblesse oblige.',
      cost: 10_000_000,
      owned: () => !!state.purchases?.title_doublerichissim || (state.unlockedTitles || []).includes('doublerichissim'),
      buy: () => {
        state.purchases = state.purchases || {};
        state.purchases.title_doublerichissim = true;
        state.unlockedTitles = [...new Set([...(state.unlockedTitles || []), 'doublerichissim'])];
        notify('💎 Titre "Double Richissime" débloqué !', 'gold');
      },
    },
    {
      id: 'chromaCharm',
      icon: '✨', label: 'Charme Chroma',
      desc: 'Double le taux de Pokémon chromatiques. Permanent.',
      cost: 5_000_000,
      owned: () => !!state.purchases?.chromaCharm,
      buy: () => {
        state.purchases.chromaCharm = true;
        notify('✨ Charme Chroma obtenu ! Taux shiny ×2', 'gold');
      },
    },
    {
      id: 'autoCollect',
      icon: `<img src="${ITEM_SPRITE_URLS.pokecoin}" style="width:28px;height:28px;image-rendering:pixelated" onerror="this.replaceWith(document.createTextNode('🪙'))">`,
      label: 'Récolte automatique',
      desc: 'Les collectes de zone se font sans combat. Permanent.',
      cost: 100_000,
      owned: () => !!state.purchases?.autoCollect,
      buy: () => {
        state.purchases.autoCollect = true;
        notify('🪙 Récolte automatique activée !', 'gold');
      },
    },
  ];

  const specialDiv = document.createElement('div');
  specialDiv.style.cssText = 'margin-top:24px';
  specialDiv.innerHTML = `
    <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold);margin-bottom:12px">🛒 ACHATS SPÉCIAUX</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${SPECIAL_PURCHASES.map(sp => {
        const owned = sp.owned();
        return `<div style="background:var(--bg-card);border:1px solid ${owned ? 'var(--green)' : 'var(--border)'};border-radius:var(--radius-sm);padding:10px;display:flex;gap:12px;align-items:center">
          <div style="font-size:24px;flex-shrink:0">${sp.icon}</div>
          <div style="flex:1">
            <div style="font-family:var(--font-pixel);font-size:9px;color:${owned ? 'var(--green)' : 'var(--text)'};margin-bottom:2px">${sp.label}</div>
            <div style="font-size:8px;color:var(--text-dim)">${sp.desc}</div>
          </div>
          ${owned
            ? `<div style="font-family:var(--font-pixel);font-size:8px;color:var(--green);white-space:nowrap">✓ ACTIF</div>`
            : `<button class="btn-special-buy" data-sp-id="${sp.id}" style="font-family:var(--font-pixel);font-size:8px;padding:6px 10px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer;white-space:nowrap">${sp.cost.toLocaleString()}₽</button>`}
        </div>`;
      }).join('')}
    </div>`;
  container.appendChild(specialDiv);

  specialDiv.querySelectorAll('.btn-special-buy').forEach(btn => {
    btn.addEventListener('click', () => {
      const sp = SPECIAL_PURCHASES.find(s => s.id === btn.dataset.spId);
      if (!sp || sp.owned()) return;
      if (state.gang.money < sp.cost) { notify('Fonds insuffisants.', 'error'); SFX.play('error'); return; }
      showConfirm(`Acheter "${sp.label}" pour ${sp.cost.toLocaleString()}₽ ?`, () => {
        state.gang.money -= sp.cost;
        sp.buy();
        saveState(); updateTopBar();
        SFX.play('unlock');
        renderCosmeticsPanel(container);
      }, null, { confirmLabel: 'Acheter', cancelLabel: 'Annuler' });
    });
  });
}

// ════════════════════════════════════════════════════════════════
// 13.  UI — GANG TAB
// ════════════════════════════════════════════════════════════════

function renderGangTab() {
  const tab = document.getElementById('tabGang');
  if (!tab) return;

  const g = state.gang;
  const s = state.stats;
  const teamPks = (g.bossTeam || []).map(id => state.pokemons.find(p => p.id === id)).filter(Boolean);
  const dexCaught = Object.values(state.pokedex).filter(e => e.caught).length;
  const mvp = state.pokemons.length > 0
    ? state.pokemons.reduce((best, p) => calculatePrice(p) > calculatePrice(best) ? p : best)
    : null;

  // ── Vitrine (showcase) ──
  const showcaseSlots = (g.showcase || [null, null, null]).slice(0, 3);
  const showcaseHtml = showcaseSlots.map((pkId, i) => {
    const pk = pkId ? state.pokemons.find(p => p.id === pkId) : null;
    if (pk) {
      const evos = EVO_BY_SPECIES[pk.species_en];
      const evoHint = evos && evos.length > 0 ? `<button class="gang-evo-hint" data-pk-id="${pk.id}" title="Voir évolution">❓</button>` : '';
      return `<div class="gang-showcase-slot filled" data-showcase-idx="${i}">
        <img src="${pokeSprite(pk.species_en, pk.shiny)}" style="width:56px;height:56px;image-rendering:pixelated;${pk.shiny ? 'filter:drop-shadow(0 0 4px var(--gold))' : ''}">
        <div style="font-size:8px;margin-top:2px;color:var(--text)">${pokemonDisplayName(pk)}${pk.shiny ? ' ✨' : ''}</div>
        <div style="font-size:7px;color:var(--text-dim)">Lv.${pk.level} ${'★'.repeat(pk.potential)}</div>
        <div style="display:flex;gap:4px;margin-top:4px;align-items:center">
          ${evoHint}
          <button class="gang-showcase-remove" data-idx="${i}" style="font-size:7px;padding:1px 5px;background:var(--bg);border:1px solid var(--red);border-radius:2px;color:var(--red);cursor:pointer">✕</button>
        </div>
      </div>`;
    }
    return `<div class="gang-showcase-slot empty" data-showcase-idx="${i}">
      <div style="font-size:18px;opacity:.3">🏆</div>
      <div style="font-size:7px;color:var(--text-dim);margin-top:4px">Slot vitrine</div>
      <button class="gang-showcase-add" data-idx="${i}" style="margin-top:6px;font-size:7px;padding:2px 6px;background:var(--bg);border:1px solid var(--border-light);border-radius:2px;color:var(--text-dim);cursor:pointer">+ Ajouter</button>
    </div>`;
  }).join('');

  // ── Boss team ──
  const teamHtml = [0, 1, 2].map(i => {
    const pk = teamPks[i];
    if (pk) return `<div class="gang-team-slot filled" data-boss-slot="${i}" title="${pokemonDisplayName(pk)} Lv.${pk.level}">
      <img src="${pokeSprite(pk.species_en, pk.shiny)}" style="width:52px;height:52px;image-rendering:pixelated">
      <div style="font-size:7px;margin-top:2px;color:${pk.shiny ? 'var(--gold)' : 'var(--text)'}">${pokemonDisplayName(pk)}</div>
      <div style="font-size:7px;color:var(--text-dim)">Lv.${pk.level}</div>
    </div>`;
    return `<div class="gang-team-slot empty" data-boss-slot="${i}"><span style="font-size:7px;color:var(--text-dim)">Slot ${i+1}</span></div>`;
  }).join('');

  // ── Agents ──
  const RECRUIT_COST = getAgentRecruitCost();
  const unlockedZones = ZONES.filter(z => isZoneUnlocked(z.id));
  let agentsHtml = `<div class="gang-agent-card" id="btnRecruitAgent" style="cursor:pointer;border:2px dashed var(--border-light);text-align:center;flex-direction:column;gap:4px">
    <div style="font-size:22px">➕</div>
    <div style="font-family:var(--font-pixel);font-size:8px;color:var(--text)">Recruter</div>
    <div style="font-size:9px;color:var(--gold)">${RECRUIT_COST.toLocaleString()}₽</div>
  </div>`;
  agentsHtml += state.agents.map(a => {
    const zoneName = a.assignedZone ? (ZONE_BY_ID[a.assignedZone]?.fr || a.assignedZone) : '—';
    const zoneOptions = unlockedZones.map(z => `<option value="${z.id}" ${a.assignedZone === z.id ? 'selected' : ''}>${z.fr}</option>`).join('');
    return `<div class="gang-agent-card" data-agent-id="${a.id}">
      <img src="${a.sprite}" style="width:44px;height:44px;image-rendering:pixelated" onerror="this.src='${trainerSprite('acetrainer')}'">
      <div style="flex:1;min-width:0">
        <div style="font-family:var(--font-pixel);font-size:9px;color:var(--text)">${a.name}</div>
        <div style="font-size:9px;color:var(--gold)">${a.title} — Lv.${a.level}</div>
        <div style="font-size:8px;color:var(--text-dim)">ATK ${a.stats.combat} CAP ${a.stats.capture} LCK ${a.stats.luck}</div>
        <select class="agent-zone-select" data-agent-id="${a.id}" style="width:100%;margin-top:3px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;font-size:8px;padding:2px 4px">
          <option value="">— Aucune zone —</option>${zoneOptions}
        </select>
      </div>
    </div>`;
  }).join('');

  // ── Stats ──
  const statsHtml = [
    [state.pokemons.length,                  'Possédés'],
    [s.totalCaught,                          'Capturés'],
    [s.totalSold,                            'Vendus'],
    [s.shinyCaught,                          '✨ Chromas'],
    [`${s.totalFightsWon}/${s.totalFights}`, 'Combats'],
    [`${s.totalMoneyEarned.toLocaleString()}₽`, 'Gains'],
  ].map(([val, label]) => `<div class="gang-stat-card"><div class="stat-value">${val}</div><div class="stat-label">${label}</div></div>`).join('');

  const repPct = Math.min(100, g.reputation);

  tab.innerHTML = `
  <div class="gang-card-layout">
    <!-- ── Header ── -->
    <div class="gang-card-header">
      <div class="gang-boss-sprite">
        ${g.bossSprite ? `<img src="${trainerSprite(g.bossSprite)}" style="width:80px;height:80px;image-rendering:pixelated">` : '<div style="width:80px;height:80px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm)"></div>'}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-family:var(--font-pixel);font-size:16px;color:var(--red);line-height:1.3">${g.name}</div>
        <div style="font-size:11px;color:var(--text-dim);margin-top:2px">Boss : <span style="color:var(--text)">${g.bossName}</span></div>
<div style="font-family:var(--font-pixel);font-size:8px;color:var(--gold-dim);margin-top:2px;letter-spacing:.5px">${getBossFullTitle()}</div>
${(() => {
  const tC = getTitleLabel(g.titleC);
  const tD = getTitleLabel(g.titleD);
  const badges = [tC, tD].filter(Boolean);
  if (!badges.length) return '';
  const colors = ['#4fc3f7','#ce93d8'];
  return `<div style="display:flex;gap:5px;margin-top:3px;flex-wrap:wrap">${badges.map((b,i)=>`<span style="font-family:var(--font-pixel);font-size:6px;padding:2px 6px;border-radius:10px;border:1px solid ${colors[i]};color:${colors[i]}">${b}</span>`).join('')}</div>`;
})()}
<button id="btnOpenTitles" style="margin-top:4px;font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">🏆 Titres</button>
        <div style="display:flex;gap:16px;margin-top:6px;flex-wrap:wrap">
          <span style="font-size:10px;color:var(--gold)">⭐ ${g.reputation.toLocaleString()}</span>
          <span style="font-size:10px;color:var(--text)">₽ ${g.money.toLocaleString()}</span>
          <span style="font-size:10px;color:var(--text-dim)">📖 ${dexCaught}/${POKEMON_GEN1.length}</span>
        </div>
        <div style="margin-top:8px;background:var(--border);border-radius:2px;height:4px;max-width:220px">
          <div style="background:var(--gold-dim);height:4px;border-radius:2px;width:${repPct}%;transition:width .5s"></div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
        <button id="btnExportGang" style="font-family:var(--font-pixel);font-size:7px;padding:6px 10px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">📋 Exporter</button>
        <button id="btnEditBoss" style="font-family:var(--font-pixel);font-size:7px;padding:6px 10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">✏ Modifier</button>
      </div>
    </div>

    <!-- ── Vitrine ── -->
    <div class="gang-section-label">— VITRINE —</div>
    <div class="gang-showcase-row">${showcaseHtml}</div>

    <!-- ── Équipe Boss ── -->
    <div class="gang-section-label">— ÉQUIPE BOSS —</div>
    <div class="gang-team-row">${teamHtml}</div>

    <!-- ── Agents ── -->
    <div class="gang-section-label">— AGENTS —</div>
    <div class="gang-agents-grid" id="gangAgentGrid">${agentsHtml}</div>

    <!-- ── Stats ── -->
    <div class="gang-section-label">— STATISTIQUES —</div>
    <div class="gang-stats-row">${statsHtml}</div>

    <!-- ── Version ── -->
    <div style="margin-top:16px;text-align:center;font-family:var(--font-pixel);font-size:7px;color:var(--text-dim);letter-spacing:1px;opacity:.5">${GAME_VERSION}</div>
  </div>`;

  // ── Handlers ──
  tab.querySelector('#btnOpenTitles')?.addEventListener('click', openTitleModal);

  tab.querySelector('#btnRecruitAgent')?.addEventListener('click', () => openAgentRecruitModal(() => renderGangTab()));

  tab.querySelector('#btnExportGang')?.addEventListener('click', () => openExportModal());

  tab.querySelector('#btnEditBoss')?.addEventListener('click', () => openBossEditModal(() => renderGangTab()));

  tab.querySelectorAll('.agent-zone-select').forEach(sel => {
    sel.addEventListener('change', e => {
      const agentId = e.target.dataset.agentId;
      assignAgentToZone(agentId, e.target.value || null);
      if (activeTab === 'tabZones') renderZoneWindows();
    });
  });

  // Showcase add
  tab.querySelectorAll('.gang-showcase-add').forEach(btn => {
    btn.addEventListener('click', () => openShowcasePicker(parseInt(btn.dataset.idx)));
  });
  tab.querySelectorAll('.gang-showcase-slot.filled').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.classList.contains('gang-showcase-remove') || e.target.classList.contains('gang-evo-hint')) return;
      openShowcasePicker(parseInt(el.dataset.showcaseIdx));
    });
  });
  tab.querySelectorAll('.gang-showcase-remove').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.idx);
      if (!state.gang.showcase) state.gang.showcase = [null, null, null];
      state.gang.showcase[idx] = null;
      saveState();
      renderGangTab();
    });
  });

  // Evo hint
  tab.querySelectorAll('.gang-evo-hint').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const pk = state.pokemons.find(p => p.id === btn.dataset.pkId);
      if (pk) showEvoPreviewModal(pk);
    });
  });

  // Boss team slots — click to open team picker
  tab.querySelectorAll('.gang-team-slot').forEach(el => {
    el.addEventListener('click', () => {
      const i = parseInt(el.dataset.bossSlot);
      if (el.classList.contains('filled')) {
        state.gang.bossTeam.splice(i, 1);
        saveState();
        renderGangTab();
      } else {
        openTeamPickerModal(i, () => renderGangTab());
      }
    });
  });
}

function openExportModal() {
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center';
  modal.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--red);border-radius:var(--radius);padding:24px;max-width:340px;width:90%;display:flex;flex-direction:column;gap:14px">
      <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold)">EXPORTER LA FICHE</div>
      <div style="display:flex;gap:10px">
        <button id="exportPortrait" style="flex:1;font-family:var(--font-pixel);font-size:8px;padding:12px;background:var(--bg);border:2px solid var(--border-light);border-radius:var(--radius-sm);color:var(--text);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px">
          <span style="font-size:20px">🖼</span> Portrait
        </button>
        <button id="exportLandscape" style="flex:1;font-family:var(--font-pixel);font-size:8px;padding:12px;background:var(--bg);border:2px solid var(--border-light);border-radius:var(--radius-sm);color:var(--text);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px">
          <span style="font-size:20px">🖼</span><span style="transform:rotate(90deg);display:inline-block">↕</span> Paysage
        </button>
      </div>
      <button id="exportCancel" style="font-family:var(--font-pixel);font-size:8px;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">Annuler</button>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector('#exportPortrait').addEventListener('click', () => { modal.remove(); exportGangImage('portrait'); });
  modal.querySelector('#exportLandscape').addEventListener('click', () => { modal.remove(); exportGangImage('landscape'); });
  modal.querySelector('#exportCancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function openShowcasePicker(slotIdx) {
  const usedIds = new Set((state.gang.showcase || []).filter(Boolean));
  const teamIds = new Set(state.gang.bossTeam);
  const candidates = state.pokemons.filter(p => !teamIds.has(p.id));

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;z-index:9000;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center';
  const listHtml = candidates.map(p => `
    <div class="showcase-pick-item" data-pk-id="${p.id}" style="display:flex;align-items:center;gap:8px;padding:6px;border-bottom:1px solid var(--border);cursor:pointer">
      <img src="${pokeSprite(p.species_en, p.shiny)}" style="width:36px;height:36px;image-rendering:pixelated">
      <div style="flex:1">
        <div style="font-size:10px">${pokemonDisplayName(p)}${p.shiny ? ' ✨' : ''} ${'★'.repeat(p.potential)}</div>
        <div style="font-size:9px;color:var(--text-dim)">Lv.${p.level}</div>
      </div>
    </div>`).join('') || `<div style="padding:16px;text-align:center;color:var(--text-dim);font-size:10px">Aucun Pokémon disponible</div>`;

  modal.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);padding:20px;max-width:360px;width:90%;display:flex;flex-direction:column;gap:12px;max-height:80vh">
      <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold)">VITRINE — SLOT ${slotIdx + 1}</div>
      <div style="overflow-y:auto;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);max-height:360px">${listHtml}</div>
      <button id="showcasePickCancel" style="font-family:var(--font-pixel);font-size:8px;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">Annuler</button>
    </div>`;
  document.body.appendChild(modal);

  modal.querySelectorAll('.showcase-pick-item').forEach(el => {
    el.addEventListener('click', () => {
      if (!state.gang.showcase) state.gang.showcase = [null, null, null];
      state.gang.showcase[slotIdx] = el.dataset.pkId;
      saveState();
      modal.remove();
      renderGangTab();
    });
  });
  modal.querySelector('#showcasePickCancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function showEvoPreviewModal(p) {
  const evos = EVO_BY_SPECIES[p.species_en] || [];
  if (!evos.length) return;

  // Stat la plus haute → détermine quelle evo suggérer si plusieurs
  const stats = p.stats || calculateStats(p);
  const statKeys = Object.keys(stats);
  let bestEvo = evos[0];
  if (evos.length > 1) {
    // Choisir selon la stat dominante (ATK → dernier, DEF → avant-dernier, SPD → premier)
    const maxStatKey = statKeys.reduce((a, b) => (stats[a] || 0) >= (stats[b] || 0) ? a : b, statKeys[0]);
    // Heuristique simple : si SPD dominant → première evo, si DEF → dernière, sinon première
    bestEvo = evos[0];
  }

  const sp = SPECIES_BY_EN[bestEvo.to];
  const reqText = bestEvo.req === 'item' ? 'Pierre d\'évolution' : `Niveau ${bestEvo.req}`;
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;z-index:9100;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center';
  modal.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);padding:20px;max-width:300px;width:90%;display:flex;flex-direction:column;align-items:center;gap:12px">
      <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold)">ÉVOLUTION</div>
      <div style="display:flex;align-items:center;gap:16px">
        <div style="text-align:center">
          <img src="${pokeSprite(p.species_en, p.shiny)}" style="width:64px;height:64px;image-rendering:pixelated">
          <div style="font-size:9px;margin-top:4px">${pokemonDisplayName(p)}</div>
          <div style="font-size:8px;color:var(--text-dim)">Lv.${p.level}</div>
        </div>
        <div style="font-size:18px;color:var(--gold)">→</div>
        <div style="text-align:center">
          <img src="${pokeSprite(bestEvo.to)}" style="width:64px;height:64px;image-rendering:pixelated;filter:brightness(.6)">
          <div style="font-size:9px;margin-top:4px;color:var(--gold)">${speciesName(bestEvo.to)}</div>
          <div style="font-size:8px;color:var(--text-dim)">${reqText}</div>
        </div>
      </div>
      ${evos.length > 1 ? `<div style="font-size:8px;color:var(--text-dim);text-align:center">Autres formes : ${evos.slice(1).map(e => speciesName(e.to)).join(', ')}</div>` : ''}
      <button style="font-family:var(--font-pixel);font-size:8px;padding:8px 16px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer" id="evoModalClose">Fermer</button>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector('#evoModalClose').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function openTeamPickerModal(slotIdx, onDone) {
  openTeamPicker('boss', null, onDone);
}

function openBossEditModal(onDone) {
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;z-index:9100;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center';
  modal.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);padding:20px;max-width:340px;width:90%;display:flex;flex-direction:column;gap:12px">
      <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold)">MODIFIER LE BOSS</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <label style="font-size:9px;color:var(--text-dim)">Nom du Boss</label>
        <input id="bossEditName" type="text" maxlength="16" value="${state.gang.bossName}"
          style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);padding:8px 10px;font-size:12px;outline:none;width:100%;box-sizing:border-box">
        <label style="font-size:9px;color:var(--text-dim)">Nom du Gang</label>
        <input id="bossEditGangName" type="text" maxlength="24" value="${state.gang.name}"
          style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);padding:8px 10px;font-size:12px;outline:none;width:100%;box-sizing:border-box">
      </div>
      <button id="bossEditSprite" style="font-family:var(--font-pixel);font-size:8px;padding:8px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">🎨 Changer le sprite</button>
      <div style="display:flex;gap:8px">
        <button id="bossEditCancel" style="flex:1;font-family:var(--font-pixel);font-size:8px;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">Annuler</button>
        <button id="bossEditConfirm" style="flex:1;font-family:var(--font-pixel);font-size:8px;padding:8px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">Confirmer</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector('#bossEditConfirm').addEventListener('click', () => {
    const newBossName = modal.querySelector('#bossEditName').value.trim();
    const newGangName = modal.querySelector('#bossEditGangName').value.trim();
    if (newBossName) state.gang.bossName = newBossName.slice(0, 16);
    if (newGangName) state.gang.name = newGangName.slice(0, 24);
    saveState();
    updateTopBar();
    notify('Gang mis à jour', 'success');
    modal.remove();
    if (onDone) onDone();
  });
  modal.querySelector('#bossEditSprite').addEventListener('click', () => {
    openSpritePicker(state.gang.bossSprite, (newSprite) => {
      state.gang.bossSprite = newSprite;
      saveState();
      updateTopBar();
      modal.remove();
      if (onDone) onDone();
    });
  });
  modal.querySelector('#bossEditCancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

// ════════════════════════════════════════════════════════════════
// 13b.  ZONE INCOME COLLECTION
// ════════════════════════════════════════════════════════════════

function openCollectionModal(zoneId) {
  const zs = initZone(zoneId);
  const income = zs.pendingIncome || 0;
  const items  = { ...zs.pendingItems };
  if (income === 0 && Object.keys(items).length === 0) return;

  // Récolte automatique débloquée : pas de combat
  if (state.purchases?.autoCollect) {
    autoCollectZone(zoneId);
    saveState(); updateTopBar();
    notify(`🤖 +${income.toLocaleString()}₽ (auto-récolte)`, 'gold');
    _refreshZoneIncomeTile(zoneId);
    _updateZoneButtons();
    return;
  }

  const zoneAgents = state.agents.filter(a => a.assignedZone === zoneId);
  const agentIds   = zoneAgents.map(a => a.id);

  // Vérification mode découverte
  if (state.settings.discoveryMode) {
    const dexCaught = Object.values(state.pokedex).filter(e => e.caught).length;
    const hasBossTeam = (state.gang.bossTeam || []).length > 0;
    if (dexCaught < 10 || !hasBossTeam) {
      const missing = [];
      if (dexCaught < 10) missing.push(`${10 - dexCaught} espèce(s) de plus dans le Pokédex`);
      if (!hasBossTeam) missing.push('au moins 1 Pokémon dans l\'équipe Boss (onglet Gang)');
      notify(`⚔ Combat non disponible — il te faut : ${missing.join(' et ')}`, 'error');
      return;
    }
  }
  // Combat direct — sans écran VS intermédiaire
  startZoneCollection(zoneId, agentIds);
}

function showCollectionEncounter(zoneId, agentIds, income, items) {
  // En mode découverte, bloquer si < 10 pokédex et pas de boss team
  if (state.settings.discoveryMode) {
    const dexCaught = Object.values(state.pokedex).filter(e => e.caught).length;
    const hasBossTeam = (state.gang.bossTeam || []).length > 0;
    if (dexCaught < 10 || !hasBossTeam) {
      const missing = [];
      if (dexCaught < 10) missing.push(`${10 - dexCaught} espèce(s) de plus dans le Pokédex`);
      if (!hasBossTeam) missing.push('au moins 1 Pokémon dans l\'équipe Boss (onglet Gang)');
      notify(`⚔ Combat non disponible — il te faut : ${missing.join(' et ')}`, 'error');
      return;
    }
  }
  const zone = ZONE_BY_ID[zoneId];
  const zoneName = zone ? (state.lang === 'fr' ? zone.fr : zone.en) : zoneId;
  const zoneAgents = agentIds.map(id => state.agents.find(a => a.id === id)).filter(Boolean);

  // Ennemis : policier aléatoire
  const policePool = ['officer', 'policeman', 'acetrainer', 'sabrina', 'officer'];
  const enemyKey = policePool[Math.floor(Math.random() * policePool.length)];

  // Pokémon du boss
  const bossPks = state.gang.bossTeam.map(id => state.pokemons.find(p => p.id === id)).filter(Boolean);

  const modal = document.createElement('div');
  modal.id = 'collectionEncounter';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9200;background:rgba(0,0,0,.9);display:flex;align-items:center;justify-content:center;';

  const agentSpritesHtml = zoneAgents.map(a =>
    `<img src="${a.sprite}" style="width:44px;height:44px;image-rendering:pixelated" onerror="this.src='${trainerSprite('acetrainer')}'"><span style="font-family:var(--font-pixel);font-size:7px;color:var(--text-dim)">${a.name}</span>`
  ).join('');

  const bossPksHtml = bossPks.slice(0,3).map(pk =>
    `<img src="${pokeSprite(pk.species_en, pk.shiny)}" style="width:36px;height:36px;image-rendering:pixelated">`
  ).join('');

  modal.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);padding:24px;max-width:480px;width:92%;display:flex;flex-direction:column;align-items:center;gap:16px;text-align:center">
      <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold)">⚡ INTERCEPTION — ${zoneName}</div>

      <!-- Scène de rencontre -->
      <div style="display:flex;align-items:center;justify-content:center;gap:24px;width:100%;padding:12px;background:rgba(0,0,0,.4);border-radius:var(--radius-sm);border:1px solid var(--border)">
        <!-- Côté Boss -->
        <div style="display:flex;flex-direction:column;align-items:center;gap:6px" id="encounterPlayerSide">
          ${state.gang.bossSprite
            ? `<img src="${trainerSprite(state.gang.bossSprite)}" style="width:56px;height:56px;image-rendering:pixelated;animation:trainerLeft 1s ease-in-out infinite">`
            : ''}
          ${zoneAgents.length > 0 ? `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">${agentSpritesHtml}</div>` : ''}
          <div style="display:flex;gap:3px;margin-top:2px">${bossPksHtml}</div>
          <span style="font-family:var(--font-pixel);font-size:7px;color:var(--text)">${state.gang.bossName}</span>
        </div>

        <!-- VS -->
        <div style="font-family:var(--font-pixel);font-size:16px;color:var(--red)">VS</div>

        <!-- Côté ennemi -->
        <div style="display:flex;flex-direction:column;align-items:center;gap:6px">
          <img src="${trainerSprite(enemyKey)}" style="width:56px;height:56px;image-rendering:pixelated;animation:trainerRight 1s ease-in-out infinite;transform:scaleX(-1)">
          <span style="font-family:var(--font-pixel);font-size:7px;color:var(--text-dim)">Officier Jenny</span>
        </div>
      </div>

      <div style="font-size:10px;color:var(--text-dim)">La police intercepte le convoy de récolte...</div>

      <button id="btnEncounterFight" style="font-family:var(--font-pixel);font-size:9px;padding:10px 24px;background:var(--red-dark);border:2px solid var(--red);border-radius:var(--radius-sm);color:var(--text);cursor:pointer;animation:glow 1.5s ease-in-out infinite alternate">⚔ COMBATTRE !</button>
    </div>`;

  document.body.appendChild(modal);

  modal.querySelector('#btnEncounterFight').addEventListener('click', () => {
    modal.remove();
    startZoneCollection(zoneId, agentIds);
  });

  // Clic hors modal = fermer sans combattre
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function startZoneCollection(zoneId, agentIds) {
  const zs = initZone(zoneId);
  const income = zs.pendingIncome || 0;
  const items  = { ...zs.pendingItems } || {};

  // Player power: boss team + selected agents
  let playerPower = 0;
  for (const pkId of state.gang.bossTeam) {
    const p = state.pokemons.find(pk => pk.id === pkId);
    if (p) playerPower += getPokemonPower(p);
  }
  for (const agId of agentIds) {
    const ag = state.agents.find(a => a.id === agId);
    if (ag) playerPower += getAgentCombatPower(ag);
  }

  const enemyBase = 800 + Math.floor(income / 100);
  const enemyPower = enemyBase * (0.8 + Math.random() * 0.4);
  const playerRoll = playerPower * (0.75 + Math.random() * 0.5);
  const win = playerRoll >= enemyPower;

  const collected = Math.round(income * (win ? 1.0 : 0.50));

  state.gang.money += collected;
  checkMoneyMilestone();
  zs.pendingIncome = 0;

  for (const [itemId, qty] of Object.entries(items)) {
    state.inventory[itemId] = (state.inventory[itemId] || 0) + qty;
  }
  zs.pendingItems = {};

  if (win) {
    state.stats.totalFightsWon = (state.stats.totalFightsWon || 0) + 1;
  } else {
    state.gang.reputation = Math.max(0, state.gang.reputation - 3);
  }

  saveState();
  updateTopBar();

  showCollectionResult(win, collected, items, agentIds);
}

function showCollectionResult(win, amount, items, agentIds) {
  const modal = document.createElement('div');
  modal.id = 'collectionResult';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9300;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;';

  const itemsHtml = Object.entries(items).length > 0
    ? `<div style="display:flex;gap:6px;align-items:center;justify-content:center;flex-wrap:wrap;margin-top:8px">
        ${Object.entries(items).map(([id, qty]) => `${itemSprite(id)}<span style="font-size:10px;color:var(--text)">×${qty}</span>`).join('')}
       </div>` : '';

  // Generate a random police opponent
  const policeTrainers = ['officer', 'policeman', 'acetrainer', 'sabrina'];
  const policeKey = policeTrainers[Math.floor(Math.random() * policeTrainers.length)];
  const policeName = 'Officier Jenny';

  // Battle scene HTML
  const combatSceneHtml = `
    <div style="display:flex;align-items:center;justify-content:center;gap:16px;padding:10px;background:rgba(0,0,0,.4);border-radius:var(--radius-sm);border:1px solid ${win ? 'var(--gold-dim)' : 'var(--red)'}">
      <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
        ${state.gang.bossSprite ? `<img src="${trainerSprite(state.gang.bossSprite)}" style="width:40px;height:40px;image-rendering:pixelated;${win ? '' : 'opacity:0.5;filter:grayscale(1)'}">` : ''}
        ${(agentIds || []).slice(0,2).map(id => { const ag = state.agents.find(a => a.id === id); return ag ? `<img src="${ag.sprite}" style="width:28px;height:28px;image-rendering:pixelated;${win ? '' : 'opacity:0.5;filter:grayscale(1)'}">` : ''; }).join('')}
        <span style="font-size:8px;color:${win ? 'var(--green)' : 'var(--red)'}">${win ? 'Victoire' : 'KO'}</span>
      </div>
      <div style="font-family:var(--font-pixel);font-size:14px;color:${win ? 'var(--gold)' : 'var(--red)'}">VS</div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
        <img src="${trainerSprite(policeKey)}" style="width:40px;height:40px;image-rendering:pixelated;${win ? 'opacity:0.5;filter:grayscale(1)' : ''}">
        <span style="font-size:8px;color:var(--text-dim)">${policeName}</span>
      </div>
    </div>`;

  modal.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid ${win ? 'var(--gold)' : 'var(--red)'};border-radius:var(--radius);padding:28px;max-width:400px;width:90%;display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center">
      ${combatSceneHtml}
      <div style="font-family:var(--font-pixel);font-size:12px;color:${win ? 'var(--gold)' : 'var(--red)'}">
        ${win ? 'Récolte réussie !' : 'Défaite — 50% récupérés'}
      </div>
      <div style="font-family:var(--font-pixel);font-size:18px;color:var(--gold)" id="collectAmountDisplay">0₽</div>
      ${itemsHtml}
      <button id="collectResultClose" style="font-family:var(--font-pixel);font-size:9px;padding:8px 20px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer;margin-top:4px">Fermer</button>
    </div>`;

  document.body.appendChild(modal);
  document.getElementById('collectResultClose').addEventListener('click', () => { modal.remove(); renderZonesTab(); });
  modal.addEventListener('click', e => { if (e.target === modal) { modal.remove(); renderZonesTab(); } });

  const display = document.getElementById('collectAmountDisplay');
  const steps = 55;
  const K = 5; // courbure exponentielle (plus grand = démarrage plus lent / fin plus rapide)
  const expMax = Math.exp(K) - 1;
  let step = 0;
  const interval = setInterval(() => {
    step++;
    const t = step / steps;
    const eased = (Math.exp(K * t) - 1) / expMax; // 0→0, 0.5→~8%, 1→100%
    const current = Math.min(amount, Math.round(amount * eased));
    display.textContent = current.toLocaleString() + '₽';
    if (step >= steps) {
      display.textContent = amount.toLocaleString() + '₽';
      clearInterval(interval);
      SFX.play('coin')
      // Animation de pièces après décompte
      setTimeout(() => spawnCoinRain(win, amount), 200);
    }
  }, 25);
}

function spawnCoinRain(win, amount) {
  // Sprite mascotte
  const mascotKey = win ? 'meowth' : 'growlithe';
  const mascotSrc = pokeSprite(mascotKey);
  const topBar = document.getElementById('topBar');
  if (!topBar) return;
  const tbRect = topBar.getBoundingClientRect();

  // Afficher la mascotte en bas à droite brièvement
  const mascot = document.createElement('div');
  mascot.style.cssText = `position:fixed;bottom:60px;right:30px;z-index:9500;animation:fvhIn .3s ease;`;
  mascot.innerHTML = `<img src="${mascotSrc}" style="width:64px;height:64px;image-rendering:pixelated;${win ? '' : 'filter:grayscale(.5)'}">`;
  document.body.appendChild(mascot);
  setTimeout(() => mascot.remove(), 2500);

  // Nombre de pièces proportionnel au montant (max 20)
  const coinCount = Math.min(20, Math.max(4, Math.floor(amount / 500)));
  const symbol = win ? '₽' : '−₽';
  const color  = win ? '#ffcc5a' : '#cc4444';

  for (let i = 0; i < coinCount; i++) {
    setTimeout(() => {
      const coin = document.createElement('div');
      const startX = 60 + Math.random() * (window.innerWidth - 120);
      const startY = window.innerHeight - 80 - Math.random() * 120;
      coin.style.cssText = `
        position:fixed;z-index:9400;pointer-events:none;
        font-family:var(--font-pixel);font-size:11px;color:${color};
        left:${startX}px;top:${startY}px;
        text-shadow:0 0 4px ${color};
      `;
      coin.textContent = symbol;
      document.body.appendChild(coin);

      // Voler vers la topbar
      const targetX = tbRect.left + tbRect.width / 2 + (Math.random() - 0.5) * 80;
      const targetY = tbRect.top + tbRect.height / 2;
      const duration = 600 + Math.random() * 400;

      coin.animate([
        { left: startX + 'px', top: startY + 'px', opacity: 1, transform: 'scale(1)' },
        { left: targetX + 'px', top: targetY + 'px', opacity: 0.8, transform: 'scale(0.6)' },
      ], { duration, easing: 'ease-in', fill: 'forwards' }).onfinish = () => {
        coin.remove();
        SFX.play('coin')
      };
    }, i * 60);
  }
}

// ── Récolte automatique (achetée dans Cosmétiques) ──────────────
function autoCollectZone(zoneId) {
  const zs = initZone(zoneId);
  const income = zs.pendingIncome || 0;
  const items = { ...zs.pendingItems };
  if (income === 0 && Object.keys(items).length === 0) return 0;
  state.gang.money += income;
  checkMoneyMilestone();
  zs.pendingIncome = 0;
  for (const [id, qty] of Object.entries(items)) {
    state.inventory[id] = (state.inventory[id] || 0) + qty;
  }
  zs.pendingItems = {};
  return income;
}

// ── Tout récolter ────────────────────────────────────────────────
function collectAllZones() {
  const zones = [...openZones].filter(zid => (state.zones[zid]?.pendingIncome || 0) > 0);
  if (zones.length === 0) { notify('Aucune récolte en attente.', ''); return; }

  // Si auto-collect débloqué → récolte silencieuse instantanée
  if (state.purchases?.autoCollect) {
    let total = 0;
    for (const zid of zones) total += autoCollectZone(zid);
    saveState(); updateTopBar();
    notify(`🤖 Récolte auto : +${total.toLocaleString()}₽`, 'gold');
    zones.forEach(zid => _refreshZoneIncomeTile(zid));
    _updateZoneButtons();
    return;
  }

  // Sinon → combat puis affichage séquentiel
  const modal = document.createElement('div');
  modal.id = 'collectAllModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9300;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;';

  // Calcul combat global (pool de force combiné)
  let playerPower = 0;
  for (const pkId of state.gang.bossTeam) {
    const p = state.pokemons.find(pk => pk.id === pkId);
    if (p) playerPower += getPokemonPower(p);
  }
  for (const a of state.agents) {
    if (zones.includes(a.assignedZone)) playerPower += getAgentCombatPower(a);
  }
  const totalIncome = zones.reduce((s, zid) => s + (state.zones[zid]?.pendingIncome || 0), 0);
  const enemyBase = 800 + Math.floor(totalIncome / 200);
  const win = (playerPower * (0.75 + Math.random() * 0.5)) >= enemyBase * (0.8 + Math.random() * 0.4);

  // Mascotte centrale
  const mascotKey = win ? 'meowth' : 'growlithe';
  const mascotSrc = pokeSprite(mascotKey);
  const collected = Math.round(totalIncome * (win ? 1.0 : 0.50));

  // Résultat par zone (lignes)
  const zoneRows = zones.map(zid => {
    const zone = ZONE_BY_ID[zid];
    const inc = state.zones[zid]?.pendingIncome || 0;
    const got = Math.round(inc * (win ? 1.0 : 0.50));
    return { zid, name: zone ? (state.lang === 'fr' ? zone.fr : zone.en) : zid, inc, got };
  });

  modal.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid ${win ? 'var(--gold)' : 'var(--red)'};border-radius:var(--radius);padding:24px;max-width:480px;width:92%;display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center">
      <img src="${mascotSrc}" style="width:80px;height:80px;image-rendering:pixelated;${win ? '' : 'filter:grayscale(.5)'}">
      <div style="font-family:var(--font-pixel);font-size:12px;color:${win ? 'var(--gold)' : 'var(--red)'}">${win ? '✓ Récolte réussie !' : '✗ Défaite — 50% récupérés'}</div>
      <div id="collectAllRows" style="width:100%;display:flex;flex-direction:column;gap:4px;max-height:200px;overflow-y:auto">
        ${zoneRows.map((r, i) => `<div id="collectRow_${i}" style="display:flex;justify-content:space-between;padding:4px 8px;border-bottom:1px solid var(--border);font-size:10px;opacity:.4">
          <span style="color:var(--text-dim)">${r.name}</span>
          <span id="collectRowAmt_${i}" style="color:var(--gold)">—</span>
        </div>`).join('')}
      </div>
      <div style="font-family:var(--font-pixel);font-size:9px;color:var(--text-dim)">TOTAL</div>
      <div style="font-family:var(--font-pixel);font-size:20px;color:var(--gold)" id="collectAllTotal">—</div>
      <button id="collectAllClose" style="font-family:var(--font-pixel);font-size:9px;padding:8px 20px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer;opacity:0" disabled>Fermer</button>
    </div>`;

  document.body.appendChild(modal);

  // Vider toutes les zones et créditer le bon montant (100% victoire, 50% défaite)
  for (const row of zoneRows) {
    const zs = initZone(row.zid);
    for (const [id, qty] of Object.entries(zs.pendingItems || {})) {
      state.inventory[id] = (state.inventory[id] || 0) + qty;
    }
    zs.pendingIncome = 0;
    zs.pendingItems = {};
  }
  state.gang.money += collected;
  checkMoneyMilestone();
  if (!win) state.gang.reputation = Math.max(0, state.gang.reputation - 3);
  else state.stats.totalFightsWon = (state.stats.totalFightsWon || 0) + 1;
  saveState(); updateTopBar();

  // Animate rows sequentially, then reveal total
  let idx = 0;
  function revealNext() {
    if (idx < zoneRows.length) {
      const row = document.getElementById(`collectRow_${idx}`);
      const amt = document.getElementById(`collectRowAmt_${idx}`);
      if (row) row.style.opacity = '1';
      if (amt) { amt.textContent = '+' + zoneRows[idx].got.toLocaleString() + '₽'; SFX.play('coin'); }
      idx++;
      setTimeout(revealNext, 400);
    } else {
      // Reveal total
      const totalEl = document.getElementById('collectAllTotal');
      if (totalEl) totalEl.textContent = collected.toLocaleString() + '₽';
      const closeBtn = document.getElementById('collectAllClose');
      if (closeBtn) { closeBtn.style.opacity = '1'; closeBtn.disabled = false; }
      setTimeout(() => spawnCoinRain(win, collected), 200);
    }
  }
  setTimeout(revealNext, 300);

  document.getElementById('collectAllClose').addEventListener('click', () => {
    modal.remove();
    zoneRows.forEach(r => _refreshZoneIncomeTile(r.zid));
    _updateZoneButtons();
  });
  modal.addEventListener('click', e => {
    if (e.target === modal) {
      modal.remove();
      zoneRows.forEach(r => _refreshZoneIncomeTile(r.zid));
      _updateZoneButtons();
    }
  });
}

// ════════════════════════════════════════════════════════════════
// 14.  UI — ZONES TAB
// ════════════════════════════════════════════════════════════════

function renderZonesTab() {
  renderZoneSelector();
  renderZoneWindows();
  _bindZoneActionButtons();
  renderGangBasePanel(); // updates drawer handle + panel content
}

function _bindZoneActionButtons() {
  // ── "Fermer tout" ──────────────────────────────────────────
  const btnCloseAll = document.getElementById('btnCloseAllZones');
  if (btnCloseAll && !btnCloseAll._bound) {
    btnCloseAll._bound = true;
    btnCloseAll.addEventListener('click', () => {
      [...openZones].forEach(zid => closeZoneWindow(zid));
    });
  }

  // ── "Tout récolter" ────────────────────────────────────────
  const btnCollectAll = document.getElementById('btnCollectAllZones');
  if (btnCollectAll && !btnCollectAll._bound) {
    btnCollectAll._bound = true;
    btnCollectAll.addEventListener('click', collectAllZones);
  }

  _updateZoneButtons();
}

function renderZoneSelector() {
  const el = document.getElementById('zoneSelector');
  if (!el) return;

  // Filter zones based on active tab
  let filteredZones;
  switch (zoneFilter) {
    case 'fav':     filteredZones = ZONES.filter(z => (state.favoriteZones||[]).includes(z.id)); break;
    case 'route':   filteredZones = ZONES.filter(z => z.type === 'route'); break;
    case 'city':    filteredZones = ZONES.filter(z => z.type === 'city'); break;
    case 'special': filteredZones = ZONES.filter(z => z.type === 'special'); break;
    default:        filteredZones = ZONES; break;
  }

  function buildTile(zone) {
    const unlocked = isZoneUnlocked(zone.id);
    const isOpen = openZones.has(zone.id);
    const name = state.lang === 'fr' ? zone.fr : zone.en;
    const bg = ZONE_BGS[zone.id];
    const bgStyle = bg
      ? `background-image:url('${bg.url}'),linear-gradient(180deg,${bg.fb});background-size:cover;background-position:center;`
      : `background:var(--bg-panel);`;
    const zState = state.zones[zone.id] || {};
    const combats = zState.combatsWon || 0;
    const gymTag = zone.type === 'city' ? ' [VILLE]' : zone.type === 'special' ? ' [SP]' : '';
    const mastery = getZoneMastery(zone.id) || 0;
    const degraded = isZoneDegraded(zone.id);

    if (unlocked) {
      const degradedTag = degraded ? ' ⚠' : '';
      const income = zState.pendingIncome || 0;
      const incomeTier = income <= 0 ? 0 : income < 500 ? 1 : income < 2000 ? 2 : income < 5000 ? 3 : income < 15000 ? 4 : 5;
      const incomeHtml = incomeTier > 0 ? `<div class="zone-income-btn income-tier${incomeTier}" data-collect-zone="${zone.id}">₽</div>` : '';
      const isCity = zone.type === 'city';
      const isFav = (state.favoriteZones || []).includes(zone.id);
      let displayName = name;
      if (isCity) {
        const raidReady = (state.zones[zone.id]?.combatsWon || 0) >= 10 && zone.gymLeader;
        displayName = zState.gymDefeated
          ? `<span style="color:var(--gold)">${name} ⚔</span>`
          : raidReady
            ? `<span style="color:var(--red)">${name} !</span>`
            : `<span style="color:var(--text-dim)">${name}</span>`;
      }
      const poolPreview = zone.pool.slice(0, 5).map(en =>
        `<img src="${pokeSprite(en)}" style="width:16px;height:16px;image-rendering:pixelated;filter:drop-shadow(0 1px 3px rgba(0,0,0,1))" title="${SPECIES_BY_EN[en]?.fr || en}">`
      ).join('');
      const musicKey = zone.music;
      const musicIcon = musicKey ? '🎵' : '';

      return `<div class="fog-tile unlocked ${isOpen ? 'fog-open' : ''} zone-type-${zone.type}${degraded ? ' fog-degraded' : ''}"
        data-zone="${zone.id}" style="${bgStyle}">
        <div class="fog-tile-overlay"></div>
        <div class="fog-tile-pool-preview">${poolPreview}</div>
        <div class="fog-tile-content">
          <div class="fog-tile-name">${displayName}${degradedTag}</div>
          <div class="fog-tile-stats">${'★'.repeat(mastery)}${mastery ? ' ' : ''}${combats}W${musicIcon ? ' '+musicIcon : ''}</div>
          <div class="fog-tile-status">${isOpen ? '[OUVERT]' : (degraded ? '[COMBAT]' : '[ENTRER]')}</div>
        </div>
        ${incomeHtml}
        <button class="zone-fav-btn" data-fav-zone="${zone.id}" title="${isFav ? 'Retirer des favoris' : 'Ouvrir automatiquement au démarrage'}">${isFav ? '★' : '☆'}</button>
      </div>`;
    } else {
      const repDiff = zone.rep > state.gang.reputation ? zone.rep - state.gang.reputation : 0;
      const needsItem = zone.unlockItem && !state.purchases?.[zone.unlockItem];
      const itemDef = needsItem ? SHOP_ITEMS.find(s => s.id === zone.unlockItem) : null;
      const isWingPermit = needsItem && (zone.unlockItem === 'tourbillon_permit' || zone.unlockItem === 'carillon_permit');
      let lockHint, lockSub;
      if (isWingPermit) {
        const wingId   = zone.unlockItem === 'tourbillon_permit' ? 'silver_wing' : 'rainbow_wing';
        const wingName = zone.unlockItem === 'tourbillon_permit' ? "Argent'Aile" : "Arcenci'Aile";
        const have     = state.inventory?.[wingId] || 0;
        const pct      = Math.min(100, Math.round(have / 50 * 100));
        lockHint = `${wingName}`;
        lockSub  = `<div style="height:3px;background:rgba(255,255,255,0.15);border-radius:2px;margin:3px 0;overflow:hidden">
                      <div style="height:100%;width:${pct}%;background:var(--gold);border-radius:2px"></div>
                    </div>
                    <div style="font-size:8px;color:var(--gold)">${have}/50</div>`;
      } else if (needsItem) {
        lockHint = state.lang === 'fr' ? (itemDef?.fr || zone.unlockItem) : (itemDef?.en || zone.unlockItem);
        lockSub  = '';
      } else {
        lockHint = `Rep +${repDiff}`;
        lockSub  = '';
      }
      return `<div class="fog-tile locked">
        <div class="fog-tile-overlay fog"></div>
        <div class="fog-tile-content">
          <div class="fog-tile-name" style="letter-spacing:2px;color:rgba(255,255,255,0.3)">?????</div>
          <div class="fog-tile-stats" style="${needsItem ? 'color:var(--gold)' : ''}">${lockHint}</div>
          ${lockSub}
        </div>
      </div>`;
    }
  }

  el.innerHTML = `<div class="fog-map">${filteredZones.map(buildTile).join('')}</div>`;

  el.querySelectorAll('.fog-tile.unlocked').forEach(tile => {
    tile.addEventListener('click', () => {
      const zid = tile.dataset.zone;
      if (openZones.has(zid)) closeZoneWindow(zid);
      else openZoneWindow(zid);
    });
  });

  el.querySelectorAll('[data-collect-zone]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openCollectionModal(btn.dataset.collectZone);
    });
  });

  el.querySelectorAll('[data-fav-zone]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const zid = btn.dataset.favZone;
      if (!state.favoriteZones) state.favoriteZones = [];
      const idx = state.favoriteZones.indexOf(zid);
      if (idx === -1) {
        state.favoriteZones.push(zid);
        btn.textContent = '★';
        btn.title = 'Retirer des favoris';
        notify(`${ZONE_BY_ID[zid]?.fr || zid} ajoutée aux favoris — s'ouvrira au démarrage`, 'success');
      } else {
        state.favoriteZones.splice(idx, 1);
        btn.textContent = '☆';
        btn.title = 'Ouvrir automatiquement au démarrage';
        notify(`${ZONE_BY_ID[zid]?.fr || zid} retirée des favoris`, 'success');
      }
      SFX.play('click');
      saveState();
    });
  });

  // Bind filter tabs
  document.querySelectorAll('.zone-ftab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === zoneFilter);
    if (!btn._filterBound) {
      btn._filterBound = true;
      btn.addEventListener('click', () => {
        zoneFilter = btn.dataset.filter;
        renderZoneSelector();
      });
    }
  });
}

// Mise à jour légère d'une tuile de zone sans re-render complet de la liste
function _refreshZoneTile(zoneId) {
  const tile = document.querySelector(`#zoneSelector [data-zone="${zoneId}"]`);
  if (!tile) return;
  const isOpen = openZones.has(zoneId);
  tile.classList.toggle('fog-open', isOpen);
  const statusEl = tile.querySelector('.fog-tile-status');
  if (statusEl) {
    const degraded = isZoneDegraded(zoneId);
    statusEl.textContent = isOpen ? '[OUVERT]' : degraded ? '[COMBAT]' : '[ENTRER]';
  }
  _refreshZoneIncomeTile(zoneId);
}

// Met à jour uniquement le bouton ₽ d'une fog-tile après une récolte
function _refreshZoneIncomeTile(zoneId) {
  const tile = document.querySelector(`#zoneSelector [data-zone="${zoneId}"]`);
  if (!tile) return;
  const income = state.zones?.[zoneId]?.pendingIncome || 0;
  const incomeTier = income <= 0 ? 0 : income < 500 ? 1 : income < 2000 ? 2 : income < 5000 ? 3 : income < 15000 ? 4 : 5;
  const existing = tile.querySelector('.zone-income-btn');
  if (incomeTier === 0) {
    existing?.remove();
  } else if (existing) {
    existing.className = `zone-income-btn income-tier${incomeTier}`;
  } else {
    const btn = document.createElement('div');
    btn.className = `zone-income-btn income-tier${incomeTier}`;
    btn.dataset.collectZone = zoneId;
    btn.textContent = '₽';
    btn.addEventListener('click', e => { e.stopPropagation(); openCollectionModal(zoneId); });
    const content = tile.querySelector('.fog-tile-content');
    if (content) content.appendChild(btn);
  }
}

// Met à jour la visibilité du bouton Fermer-tout + Tout-récolter
function _updateZoneButtons() {
  const btnClose = document.getElementById('btnCloseAllZones');
  const btnCollect = document.getElementById('btnCollectAllZones');
  const hasOpen = openZones.size > 0;
  if (btnClose) btnClose.style.display = hasOpen ? '' : 'none';
  if (btnCollect) {
    const hasPending = hasOpen && [...openZones].some(zid => (state.zones[zid]?.pendingIncome || 0) > 0);
    btnCollect.style.display = hasPending ? '' : 'none';
  }
}

function openZoneWindow(zoneId) {
  // Guard : si déjà ouverte, ne rien faire (évite les timers orphelins)
  if (openZones.has(zoneId)) { _refreshZoneTile(zoneId); return; }
  openZones.add(zoneId);
  // Persister l'ordre pour la musique et le rechargement
  if (!state.openZoneOrder) state.openZoneOrder = [];
  if (!state.openZoneOrder.includes(zoneId)) state.openZoneOrder.push(zoneId);
  saveState();
  initZone(zoneId);
  zoneSpawns[zoneId] = [];
  // Boss auto-moves to first opened zone if not set
  if (!state.gang.bossZone || !openZones.has(state.gang.bossZone)) {
    state.gang.bossZone = zoneId;
  }
  // Nettoyer un éventuel timer résiduel avant d'en créer un nouveau
  if (zoneSpawnTimers[zoneId]) { clearInterval(zoneSpawnTimers[zoneId]); delete zoneSpawnTimers[zoneId]; }
  // Start spawn timer
  const zone = ZONE_BY_ID[zoneId];
  if (zone) {
    const interval = Math.round(1000 / zone.spawnRate);
    zoneSpawnTimers[zoneId] = setInterval(() => tickZoneSpawn(zoneId), interval);
  }
  MusicPlayer.updateFromContext();
  // Mise à jour ciblée : tuile + fenêtres + base — sans reconstruire tout le sélecteur
  _refreshZoneTile(zoneId);
  renderGangBasePanel();
  renderZoneWindows();
  _updateZoneButtons();
}

function closeZoneWindow(zoneId) {
  openZones.delete(zoneId);
  // Retirer de l'ordre persisté → MusicPlayer ne lira plus cette zone
  state.openZoneOrder = (state.openZoneOrder || []).filter(id => id !== zoneId);
  saveState();
  if (zoneSpawnTimers[zoneId]) {
    clearInterval(zoneSpawnTimers[zoneId]);
    delete zoneSpawnTimers[zoneId];
  }
  // Clean up spawns
  if (zoneSpawns[zoneId]) {
    for (const s of zoneSpawns[zoneId]) {
      if (s.timeout) clearTimeout(s.timeout);
    }
    delete zoneSpawns[zoneId];
  }
  MusicPlayer.updateFromContext();
  // Mise à jour ciblée : tuile + fenêtres + base — sans reconstruire tout le sélecteur
  _refreshZoneTile(zoneId);
  renderGangBasePanel();
  renderZoneWindows();
  _updateZoneButtons();
}

// Track headbar expanded state per zone
const headbarExpanded = {};

function renderGangBasePanel() {
  const gangContainer = document.getElementById('gangBaseContainer');
  if (!gangContainer) return;
  const gangHtml = renderGangBaseWindow();
  const existingBase = gangContainer.querySelector('#gangBaseWin');
  if (existingBase) {
    const tmp = document.createElement('div');
    tmp.innerHTML = gangHtml;
    gangContainer.replaceChild(tmp.firstElementChild, existingBase);
  } else {
    gangContainer.innerHTML = gangHtml;
  }
  bindGangBase(gangContainer);
}

function renderZoneWindows() {
  const container = document.getElementById('zoneWindows');
  if (!container) return;

  // "No zones" placeholder
  let placeholder = container.querySelector('.zone-placeholder');
  if (openZones.size === 0) {
    if (!placeholder) {
      placeholder = document.createElement('div');
      placeholder.className = 'zone-placeholder';
      placeholder.style.cssText = 'color:var(--text-dim);padding:20px 0;text-align:center;width:100%';
      placeholder.textContent = 'Sélectionnez une zone dans la grille pour commencer';
      container.appendChild(placeholder);
    }
    return;
  }
  placeholder?.remove();

  // ── Remove zone windows that are no longer open ───────────────
  container.querySelectorAll('.zone-window').forEach(el => {
    if (!openZones.has(el.id.replace('zw-', ''))) el.remove();
  });

  // ── Sort open zones by saved order ───────────────────────────
  const ordered = [...openZones].sort((a, b) => {
    const order = state.openZoneOrder || [];
    const oa = order.indexOf(a);
    const ob = order.indexOf(b);
    return (oa === -1 ? 999 : oa) - (ob === -1 ? 999 : ob);
  });

  // ── Update or create each open zone window ────────────────────
  for (const zoneId of ordered) {
    const existing = document.getElementById(`zw-${zoneId}`);
    if (existing) {
      patchZoneWindow(zoneId, existing);
    } else {
      const win = buildZoneWindowEl(zoneId);
      // Drag & drop reordering
      win.setAttribute('draggable', 'true');
      win.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', zoneId);
        win.style.opacity = '0.5';
      });
      win.addEventListener('dragend', () => { win.style.opacity = ''; });
      win.addEventListener('dragover', e => { e.preventDefault(); win.style.borderColor = 'var(--gold)'; });
      win.addEventListener('dragleave', () => { win.style.borderColor = ''; });
      win.addEventListener('drop', e => {
        e.preventDefault();
        win.style.borderColor = '';
        const sourceId = e.dataTransfer.getData('text/plain');
        if (sourceId === zoneId) return;
        const order = [...openZones];
        const fromIdx = order.indexOf(sourceId);
        const toIdx = order.indexOf(zoneId);
        if (fromIdx !== -1 && toIdx !== -1) {
          order.splice(fromIdx, 1);
          order.splice(toIdx, 0, sourceId);
          state.openZoneOrder = order;
          saveState();
          renderZoneWindows();
        }
      });
      container.appendChild(win);
      updateZoneTimers(zoneId);
      (zoneSpawns[zoneId] || []).forEach(s => renderSpawnInWindow(zoneId, s));
    }
  }
}

// Build a fresh zone window element (used on first open)
function buildZoneWindowEl(zoneId) {
  const zone = ZONE_BY_ID[zoneId];
  const zState = state.zones[zoneId] || {};
  const mastery = getZoneMastery(zoneId);
  const name = state.lang === 'fr' ? zone.fr : zone.en;
  const degraded = isZoneDegraded(zoneId);

  const boosts = [];
  if (isBoostActive('incense'))    boosts.push('INC');
  if (isBoostActive('rarescope'))  boosts.push('SCO');
  if (isBoostActive('aura'))       boosts.push('AUR');
  if (isBoostActive('chestBoost')) boosts.push('CHT');

  const activeEvt = state.activeEvents[zoneId];
  const eventActive = activeEvt && activeEvt.expiresAt > Date.now();
  const eventDef = eventActive ? SPECIAL_EVENTS.find(e => e.id === activeEvt.eventId) : null;

  const assignedAgents = state.agents.filter(a => a.assignedZone === zoneId);
  const isExpanded = headbarExpanded[zoneId] || false;
  const gymDefeated = zState.gymDefeated;
  const combats = zState.combatsWon || 0;
  const captures = zState.captures || 0;
  const nextMastery = mastery < 3 ? (mastery < 2 ? 10 : 50) : null;
  const progressText = zone.type === 'city'
    ? `Combats: ${combats}${gymDefeated ? ' ✓GYM' : combats >= 10 && zone.gymLeader ? ' — RAID!' : ''}`
    : `Combats: ${combats}${nextMastery ? `/${nextMastery}` : ''} | Cap: ${captures}`;

  const bgStyle = (() => {
    const b = ZONE_BGS[zoneId];
    return b ? `background-image:url('${b.url}'),linear-gradient(180deg,${b.fb});background-size:cover,100%;background-position:center,center` : 'background:var(--bg-panel)';
  })();

  const win = document.createElement('div');
  win.className = `zone-window zone-type-${zone.type || 'field'}`;
  win.id = `zw-${zoneId}`;
  const masteryClass = mastery >= 3 ? 'zone-mastery-3' : mastery === 2 ? 'zone-mastery-2' : mastery === 1 ? 'zone-mastery-1' : '';
  if (masteryClass) win.classList.add(masteryClass);

  win.innerHTML = `
    <div class="zone-headbar${degraded ? ' zone-headbar-degraded' : ''}" data-zone-hb="${zoneId}">
      <span class="headbar-name">${name}${gymDefeated ? ' [V]' : ''}${degraded ? ' ⚠' : ''}</span>
      <span class="headbar-stats">${'*'.repeat(mastery)} ${boosts.map(b => `<span class="boost-tag">${b}</span>`).join('')}</span>
      <button class="headbar-collect-btn" data-headbar-collect="${zoneId}" style="display:${(zState.pendingIncome||0) > 0 ? 'flex' : 'none'};font-family:var(--font-pixel);font-size:7px;padding:1px 6px;background:rgba(200,160,40,.25);border:1px solid var(--gold-dim);border-radius:2px;color:var(--gold);cursor:pointer;align-items:center;gap:2px">₽ ${(zState.pendingIncome||0) > 0 ? (zState.pendingIncome).toLocaleString() : ''}</button>
      <span class="headbar-toggle">${isExpanded ? '▲' : '▼'}</span>
      <button class="headbar-close" data-close-zone="${zoneId}" title="Fermer">✕</button>
    </div>
    <div class="zone-headbar-content ${isExpanded ? 'expanded' : ''}" id="zt-${zoneId}"></div>
    <div class="zone-viewport" style="${bgStyle}">
      ${degraded ? `<div class="zone-degraded-banner">⚠ ${state.lang === 'fr' ? 'MODE COMBAT — Réputation insuffisante' : 'COMBAT MODE — Reputation too low'}</div>` : ''}
      ${boosts.length ? `<div class="zone-boosts">${boosts.map(b => `<span class="boost-badge">${b}</span>`).join('')}</div>` : ''}
      ${eventActive && eventDef ? `<div class="zone-event-banner">${state.lang === 'fr' ? eventDef.fr : eventDef.en}</div>` : ''}
      ${assignedAgents.map((a, i) => `
        <div class="zone-agent" data-agent-id="${a.id}" style="left:${8 + i * 44}px">
          <img src="${a.sprite}" alt="${a.name}" onerror="this.src='${trainerSprite('acetrainer')}'">
          <span class="agent-label">${a.name}</span>
          <span class="agent-cd-label" style="display:none;font-family:var(--font-pixel);font-size:7px;color:var(--red);background:rgba(0,0,0,.8);border-radius:2px;padding:1px 3px;white-space:nowrap;position:absolute;top:-16px;left:50%;transform:translateX(-50%)"></span>
        </div>
      `).join('')}
      <div id="zpb-${zoneId}" style="position:absolute;top:4px;left:50%;transform:translateX(-50%);font-family:var(--font-pixel);font-size:7px;color:var(--text-dim);background:rgba(0,0,0,.55);border-radius:2px;padding:1px 5px;white-space:nowrap;z-index:2;pointer-events:none">${progressText}${zone.type === 'city' ? ` — XP×${zone.xpBonus}` : ''}</div>
      ${zone.type === 'city' && zone.gymLeader && combats >= 10 ? (() => {
        const lastRaid = zState.gymRaidLastFight || 0;
        const raidCooldownMs = 5 * 60 * 1000;
        const raidReady = Date.now() - lastRaid >= raidCooldownMs;
        const cdSec = raidReady ? 0 : Math.ceil((raidCooldownMs - (Date.now() - lastRaid)) / 1000);
        return `<button class="zone-gym-raid-btn" data-gym-raid="${zoneId}"
          style="position:absolute;bottom:38px;left:50%;transform:translateX(-50%);
          font-family:var(--font-pixel);font-size:7px;padding:3px 10px;
          background:${raidReady ? 'rgba(180,20,20,.8)' : 'rgba(60,60,60,.8)'};
          border:1px solid ${raidReady ? 'var(--red)' : 'var(--border)'};
          border-radius:2px;color:${raidReady ? 'var(--text)' : 'var(--text-dim)'};
          cursor:${raidReady ? 'pointer' : 'default'};white-space:nowrap;z-index:3"
          ${raidReady ? '' : 'disabled'}>
          ⚔ RAID ${gymDefeated ? '(re)' : ''}${raidReady ? '' : ` ${cdSec}s`}
        </button>`;
      })() : ''}
      ${state.gang.bossSprite && state.gang.bossZone === zoneId ? `<div class="zone-boss" data-boss-cd>
        <img src="${trainerSprite(state.gang.bossSprite)}" alt="Boss" onerror="this.src='${trainerSprite('acetrainer')}'">
        <span class="boss-cd-label" style="display:none;font-family:var(--font-pixel);font-size:7px;color:var(--red);background:rgba(0,0,0,.8);border-radius:2px;padding:1px 3px;white-space:nowrap;position:absolute;top:-16px;left:50%;transform:translateX(-50%)"></span>
      </div>` : ''}
      <div class="zone-slots-bar" style="display:flex;align-items:center;gap:6px;padding:3px 8px;font-family:var(--font-pixel);font-size:8px;background:rgba(0,0,0,.4);border-top:1px solid var(--border)">
        <span class="slot-count" style="color:var(--text-dim)">Agents: ${assignedAgents.length}/${zState.slots || 1}</span>
        ${(zState.slots || 1) < ZONE_SLOT_COSTS.length + 1 ? (() => {
          const nextSlot = (zState.slots || 1);
          const cost = getZoneSlotCost(zoneId, nextSlot - 1);
          const canAfford = state.gang.money >= cost;
          return `<button class="zone-slot-upgrade" data-zone-upgrade="${zoneId}" data-cost="${cost}"
            style="font-family:var(--font-pixel);font-size:7px;padding:2px 6px;background:var(--bg);
            border:1px solid ${canAfford ? 'var(--gold-dim)' : 'var(--border)'};border-radius:2px;
            color:${canAfford ? 'var(--gold)' : 'var(--text-dim)'};cursor:${canAfford ? 'pointer' : 'default'}"
            ${canAfford ? '' : 'disabled'}>+slot ${cost.toLocaleString()}₽</button>`;
        })() : `<span style="color:var(--gold)">FULL</span>`}
      </div>
    </div>
  `;

  win.querySelector(`[data-close-zone="${zoneId}"]`)?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeZoneWindow(zoneId);
  });

  win.querySelector(`[data-headbar-collect="${zoneId}"]`)?.addEventListener('click', (e) => {
    e.stopPropagation();
    openCollectionModal(zoneId);
  });

  win.querySelector(`[data-zone-hb="${zoneId}"]`)?.addEventListener('click', () => {
    headbarExpanded[zoneId] = !headbarExpanded[zoneId];
    document.getElementById(`zt-${zoneId}`)?.classList.toggle('expanded', headbarExpanded[zoneId]);
    const toggle = win.querySelector('.headbar-toggle');
    if (toggle) toggle.textContent = headbarExpanded[zoneId] ? '▲' : '▼';
  });

  win.querySelector('.zone-viewport')?.addEventListener('dblclick', (e) => {
    if (e.target.closest('.zone-spawn')) return;
    if (e.target.closest('.zone-gym-raid-btn')) return;
    state.gang.bossZone = zoneId;
    saveState();
    renderZoneWindows();
  });

  win.querySelector(`[data-gym-raid="${zoneId}"]`)?.addEventListener('click', (e) => {
    e.stopPropagation();
    triggerGymRaid(zoneId);
  });

  win.querySelector(`[data-zone-upgrade="${zoneId}"]`)?.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    const zs = initZone(zoneId);
    const nextSlot = zs.slots || 1;
    const cost = getZoneSlotCost(zoneId, nextSlot - 1);
    if (!cost || state.gang.money < cost) { notify('Pokédollars insuffisants', 'error'); return; }
    showConfirm(`Dépenser ${cost.toLocaleString()}₽ pour débloquer un slot agent ?`, () => {
      state.gang.money -= cost;
      zs.slots = nextSlot + 1;
      saveState(); updateTopBar();
      notify(`Zone améliorée ! Slots agents: ${zs.slots}`, 'gold');
      renderZoneWindows();
    }, null, { confirmLabel: 'Oui', cancelLabel: 'Non' });
  });

  return win;
}

// Patch an existing zone window in place — leaves spawns untouched
function patchZoneWindow(zoneId, win) {
  const zone = ZONE_BY_ID[zoneId];
  if (!zone) return;
  const zState = state.zones[zoneId] || {};
  const mastery = getZoneMastery(zoneId);
  const name = state.lang === 'fr' ? zone.fr : zone.en;
  const degraded = isZoneDegraded(zoneId);
  const gymDefeated = zState.gymDefeated;
  const combats = zState.combatsWon || 0;
  const captures = zState.captures || 0;
  const nextMastery = mastery < 3 ? (mastery < 2 ? 10 : 50) : null;
  const progressText = zone.type === 'city'
    ? `Combats: ${combats}${gymDefeated ? ' ✓GYM' : combats >= 10 && zone.gymLeader ? ' — RAID!' : ''}`
    : `Combats: ${combats}${nextMastery ? `/${nextMastery}` : ''} | Cap: ${captures}`;

  const boosts = [];
  if (isBoostActive('incense'))    boosts.push('INC');
  if (isBoostActive('rarescope'))  boosts.push('SCO');
  if (isBoostActive('aura'))       boosts.push('AUR');
  if (isBoostActive('chestBoost')) boosts.push('CHT');

  // Headbar
  const headbar = win.querySelector(`[data-zone-hb="${zoneId}"]`);
  if (headbar) {
    headbar.className = `zone-headbar${degraded ? ' zone-headbar-degraded' : ''}`;
    const nameEl = headbar.querySelector('.headbar-name');
    if (nameEl) nameEl.innerHTML = `${name}${gymDefeated ? ' [V]' : ''}${degraded ? ' ⚠' : ''}`;
    const statsEl = headbar.querySelector('.headbar-stats');
    if (statsEl) statsEl.innerHTML = `${'*'.repeat(mastery)} ${boosts.map(b => `<span class="boost-tag">${b}</span>`).join('')}`;
    // ₽ collect button
    const collectBtn = headbar.querySelector(`[data-headbar-collect="${zoneId}"]`);
    const income = zState.pendingIncome || 0;
    if (collectBtn) {
      collectBtn.style.display = income > 0 ? 'flex' : 'none';
      if (income > 0) collectBtn.textContent = `₽ ${income.toLocaleString()}`;
    }
  }
  win.classList.remove('zone-mastery-1','zone-mastery-2','zone-mastery-3');
  const mc = mastery >= 3 ? 'zone-mastery-3' : mastery === 2 ? 'zone-mastery-2' : mastery === 1 ? 'zone-mastery-1' : '';
  if (mc) win.classList.add(mc);

  const viewport = win.querySelector('.zone-viewport');
  if (!viewport) return;

  // Degraded banner
  let banner = viewport.querySelector('.zone-degraded-banner');
  if (degraded && !banner) {
    banner = document.createElement('div');
    banner.className = 'zone-degraded-banner';
    banner.textContent = `⚠ ${state.lang === 'fr' ? 'MODE COMBAT — Réputation insuffisante' : 'COMBAT MODE — Reputation too low'}`;
    viewport.insertBefore(banner, viewport.firstChild);
  } else if (!degraded && banner) {
    banner.remove();
  }

  // Update progress bar
  const progressBar = win.querySelector(`#zpb-${zoneId}`);
  if (progressBar) progressBar.textContent = `${progressText}${zone.type === 'city' ? ` — XP×${zone.xpBonus}` : ''}`;

  // Agent overlays — remove + re-add (they're static overlays, not live spawns)
  viewport.querySelectorAll('.zone-agent').forEach(el => el.remove());
  state.agents.filter(a => a.assignedZone === zoneId).forEach((a, i) => {
    const agEl = document.createElement('div');
    agEl.className = 'zone-agent';
    agEl.dataset.agentId = a.id;
    agEl.style.left = `${8 + i * 44}px`;
    agEl.innerHTML = `<img src="${a.sprite}" alt="${a.name}" onerror="this.src='${trainerSprite('acetrainer')}'">`
      + `<span class="agent-label">${a.name}</span>`
      + `<span class="agent-cd-label" style="display:none;font-family:var(--font-pixel);font-size:7px;color:var(--red);background:rgba(0,0,0,.8);border-radius:2px;padding:1px 3px;white-space:nowrap;position:absolute;top:-16px;left:50%;transform:translateX(-50%)"></span>`;
    viewport.appendChild(agEl);
  });

  // Boss overlay
  viewport.querySelectorAll('.zone-boss').forEach(el => el.remove());
  if (state.gang.bossSprite && state.gang.bossZone === zoneId) {
    const bossEl = document.createElement('div');
    bossEl.className = 'zone-boss';
    bossEl.dataset.bossCd = '';
    bossEl.innerHTML = `<img src="${trainerSprite(state.gang.bossSprite)}" alt="Boss" onerror="this.src='${trainerSprite('acetrainer')}'">`
      + `<span class="boss-cd-label" style="display:none;font-family:var(--font-pixel);font-size:7px;color:var(--red);background:rgba(0,0,0,.8);border-radius:2px;padding:1px 3px;white-space:nowrap;position:absolute;top:-16px;left:50%;transform:translateX(-50%)"></span>`;
    viewport.appendChild(bossEl);
  }

  // Refresh slots bar
  const viewport2 = win.querySelector('.zone-viewport');
  const slotsBar = viewport2?.querySelector('.zone-slots-bar');
  if (slotsBar) {
    const freshAssigned = state.agents.filter(a => a.assignedZone === zoneId);
    const freshZState = state.zones[zoneId] || {};
    const freshMaxSlots = freshZState.slots || 1;
    const freshCanUpgrade = freshMaxSlots < ZONE_SLOT_COSTS.length + 1;
    const freshCost = freshCanUpgrade ? getZoneSlotCost(zoneId, freshMaxSlots - 1) : null;
    const freshCanAfford = freshCost && state.gang.money >= freshCost;
    slotsBar.innerHTML = `
      <span class="slot-count" style="color:var(--text-dim)">Agents: ${freshAssigned.length}/${freshMaxSlots}</span>
      ${freshCanUpgrade
        ? `<button class="zone-slot-upgrade" data-zone-upgrade="${zoneId}" data-cost="${freshCost}"
            style="font-family:var(--font-pixel);font-size:7px;padding:2px 6px;background:var(--bg);
            border:1px solid ${freshCanAfford ? 'var(--gold-dim)' : 'var(--border)'};border-radius:2px;
            color:${freshCanAfford ? 'var(--gold)' : 'var(--text-dim)'};cursor:${freshCanAfford ? 'pointer' : 'default'}"
            ${freshCanAfford ? '' : 'disabled'}>+slot ${freshCost.toLocaleString()}₽</button>`
        : '<span style="color:var(--gold)">FULL</span>'}
    `;
    // Rebind dblclick upgrade
    slotsBar.querySelector(`[data-zone-upgrade="${zoneId}"]`)?.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      const zs2 = initZone(zoneId);
      const ns = zs2.slots || 1;
      const uc = getZoneSlotCost(zoneId, ns - 1);
      if (!uc || state.gang.money < uc) { notify('Pokédollars insuffisants', 'error'); return; }
      showConfirm(`Dépenser ${uc.toLocaleString()}₽ pour débloquer un slot agent ?`, () => {
        state.gang.money -= uc;
        zs2.slots = ns + 1;
        saveState(); updateTopBar();
        notify(`Zone améliorée ! Slots agents: ${zs2.slots}`, 'gold');
        renderZoneWindows();
      }, null, { confirmLabel: 'Oui', cancelLabel: 'Non' });
    });
  }

  updateZoneTimers(zoneId);
}

// ── Gang Base Window (always first in zone windows) ─────────
function renderGangBaseWindow() {
  // ── Boss team slots
  const bossTeamHtml = [0, 1, 2].map(i => {
    const pkId = state.gang.bossTeam[i];
    const pk = pkId ? state.pokemons.find(p => p.id === pkId) : null;
    if (pk) {
      return `<div class="base-team-slot filled" data-boss-slot="${i}" title="${speciesName(pk.species_en)} Lv.${pk.level}">
        <img src="${pokeSprite(pk.species_en, pk.shiny)}" alt="${speciesName(pk.species_en)}">
      </div>`;
    }
    return `<div class="base-team-slot" data-boss-slot="${i}" title="${state.lang === 'fr' ? 'Assigner un Pokémon' : 'Assign a Pokémon'}">+</div>`;
  }).join('');

  // ── Glass background: top Pokémon + agents floutés
  const _BG_POSITIONS = [
    {left:'6%',bottom:'28%'},{left:'18%',bottom:'58%'},{left:'32%',bottom:'18%'},
    {left:'48%',bottom:'50%'},{left:'62%',bottom:'68%'},{left:'76%',bottom:'26%'},
    {left:'86%',bottom:'46%'},{left:'12%',bottom:'78%'},{left:'42%',bottom:'74%'},
    {left:'58%',bottom:'12%'},{left:'28%',bottom:'44%'},{left:'70%',bottom:'82%'},
  ];
  const _bgPokes = [...state.pokemons].sort((a, b) => getPokemonPower(b) - getPokemonPower(a)).slice(0, 12);
  const _bgPokeHtml = _bgPokes.map((p, i) => {
    const pos = _BG_POSITIONS[i % _BG_POSITIONS.length];
    const sz = i < 3 ? 48 : i < 6 ? 36 : 28;
    return `<img src="${pokeSprite(p.species_en, p.shiny)}" style="position:absolute;left:${pos.left};bottom:${pos.bottom};width:${sz}px;height:${sz}px;image-rendering:pixelated;opacity:.35;filter:brightness(.5)" alt="">`;
  }).join('');
  const _agentPositions = [{left:'4%',bottom:'4%'},{left:'72%',bottom:'4%'},{left:'22%',bottom:'4%'},{left:'50%',bottom:'4%'},{left:'88%',bottom:'4%'}];
  const _bgAgentHtml = state.agents.slice(0, 5).map((a, i) => {
    const pos = _agentPositions[i];
    return `<img src="${a.sprite}" style="position:absolute;left:${pos.left};bottom:${pos.bottom};width:30px;height:30px;image-rendering:pixelated;opacity:.28;filter:brightness(.45)" onerror="this.src='${trainerSprite('acetrainer')}'" alt="">`;
  }).join('');

  // ── Item tiles: sprite ombre si qty=0, normal + badge si qty>0
  const BALL_IDS  = ['pokeball','greatball','ultraball','duskball','masterball'];
  const BOOST_IDS = ['lure','superlure','incense','rarescope','aura'];
  const CRAFT_IDS = ['rarecandy','evostone'];
  const KEY_IDS   = ['incubator','map_pallet','casino_ticket','silph_keycard','boat_ticket'];

  function makeItemTile(id) {
    const qty      = state.inventory?.[id] || 0;
    const isBall   = BALL_IDS.includes(id);
    const isBoost  = BOOST_IDS.includes(id);
    const isActive = isBall && state.activeBall === id;
    const isBoosted= isBoost && isBoostActive(id);
    const owned    = qty > 0;
    const remStr   = isBoosted ? `<span class="base-item-rem">${Math.ceil(boostRemaining(id))}s</span>` : '';
    const isAuto   = isBall && state.settings.autoBuyBall === id;
    const autoBtn  = isBall
      ? `<button class="ball-auto-btn${isAuto ? ' active' : ''}" data-auto-ball="${id}" title="Achat auto"
           style="font-size:6px;padding:0 3px;background:${isAuto ? 'rgba(204,51,51,.5)' : 'transparent'};border:1px solid ${isAuto ? 'var(--red)' : 'rgba(255,255,255,.15)'};border-radius:2px;color:${isAuto ? 'var(--gold)' : 'var(--text-dim)'};cursor:pointer;line-height:1.6">🔄</button>`
      : '';
    const qtyBadge = owned
      ? `<span class="base-item-qty">${qty > 99 ? '99+' : '×'+qty}</span>`
      : `<span class="base-item-qty" style="color:var(--text-dim);opacity:.4">0</span>`;
    return `<div class="base-item-tile${isActive ? ' active' : ''}${isBoosted ? ' boosted' : ''}" data-bag-item="${id}" title="${id} ×${qty}">
      <div class="base-item-sprite${owned ? '' : ' locked'}">${itemSprite(id)}</div>
      ${qtyBadge}${remStr}${autoBtn}
    </div>`;
  }

  // Objets clés (1 seul exemplaire, ombre → ✓)
  function makeKeyTile(id) {
    const qty   = state.inventory?.[id] || 0;
    const owned = qty > 0;
    const badge = owned
      ? `<span class="base-item-qty" style="color:var(--green)">✓</span>`
      : `<span class="base-item-qty" style="color:var(--text-dim);opacity:.35">✗</span>`;
    return `<div class="base-item-tile${owned ? '' : ' locked-key'}" data-bag-item="${id}" title="${id}${owned ? ' — Obtenu' : ' — Non obtenu'}">
      <div class="base-item-sprite${owned ? '' : ' locked'}">${itemSprite(id)}</div>
      ${badge}
    </div>`;
  }

  const ballsHtml  = BALL_IDS.map(makeItemTile).join('');
  const boostsHtml = BOOST_IDS.map(makeItemTile).join('');
  const craftHtml  = CRAFT_IDS.map(makeItemTile).join('');
  const keysHtml   = KEY_IDS.map(makeKeyTile).join('');

  // ── Incubator slots visuels
  const incCount       = state.inventory?.incubator || 0;
  const eggs           = state.eggs || [];
  const incubatingEggs = eggs.filter(e => e.incubating);
  const waitingEggs    = eggs.filter(e => !e.incubating);
  const now            = Date.now();

  let incSlotsHtml = '';
  if (incCount > 0) {
    for (let i = 0; i < incCount; i++) {
      const egg = incubatingEggs[i];
      if (egg) {
        const isReady   = egg.hatchAt && egg.hatchAt <= now;
        const progress  = (egg.hatchAt && egg.incubatedAt)
          ? Math.min(100, Math.round((now - egg.incubatedAt) / (egg.hatchAt - egg.incubatedAt) * 100))
          : 0;
        const timeLeftMin = egg.hatchAt ? Math.max(0, Math.ceil((egg.hatchAt - now) / 60000)) : null;
        incSlotsHtml += `
          <div class="base-inc-slot ${isReady ? 'ready' : 'active'}" data-egg-id="${egg.id}"
            title="${egg.species_en}${isReady ? ' — PRÊT!' : timeLeftMin !== null ? ' — '+timeLeftMin+'min' : ''}">
            <img src="${pokeSprite(egg.species_en)}" class="base-inc-egg" alt=""
              style="${isReady ? '' : 'filter:brightness(0.18) saturate(0)'}">
            <div class="base-inc-bar">
              <div class="base-inc-fill" style="width:${isReady ? 100 : progress}%;background:${isReady ? 'var(--green)' : 'var(--gold)'}"></div>
            </div>
            ${isReady
              ? `<span class="base-inc-ready">!</span>`
              : timeLeftMin !== null ? `<span class="base-inc-time">${timeLeftMin}m</span>` : ''}
          </div>`;
      } else {
        incSlotsHtml += `<div class="base-inc-slot empty"><span style="font-size:18px;opacity:.25">🥚</span></div>`;
      }
    }
  }

  return `<div class="gang-base-window" id="gangBaseWin">

    <!-- ── Header ── -->
    <div class="base-window-header">
      <div style="display:flex;align-items:center;gap:6px">
        <span style="font-size:12px">🏠</span>
        <span style="font-family:var(--font-pixel);font-size:8px;color:var(--red);letter-spacing:1px">${state.gang.name}</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-family:var(--font-pixel);font-size:8px;color:var(--gold)">₽${state.gang.money.toLocaleString()}</span>
        <button class="base-export-btn" title="${state.lang === 'fr' ? 'Exporter mon gang' : 'Export my gang'}"
          style="font-size:11px;background:none;border:none;cursor:pointer;color:var(--text-dim);padding:0;line-height:1;transition:color .2s"
          onmouseover="this.style.color='var(--text)'" onmouseout="this.style.color='var(--text-dim)'">📷</button>
      </div>
    </div>

    <!-- ── Viewport environnement ── -->
    <div class="base-env-viewport">
      <div style="position:absolute;inset:0;overflow:hidden;pointer-events:none">
        ${_bgPokeHtml}${_bgAgentHtml}
        <div style="position:absolute;inset:0;background:rgba(12,4,4,.55);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px)"></div>
      </div>
      <div style="position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 8px 10px">
        ${state.gang.bossSprite
          ? `<img class="base-boss-sprite" src="${trainerSprite(state.gang.bossSprite)}" alt="Boss" onerror="this.src='${FALLBACK_TRAINER_SVG}';this.onerror=null">`
          : '<div style="width:72px;height:72px;background:rgba(0,0,0,.5);border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;font-size:28px">💀</div>'}
        <div style="font-family:var(--font-pixel);font-size:9px;color:var(--text)">${state.gang.bossName}</div>
        <div class="base-team-slots">${bossTeamHtml}</div>
      </div>
    </div>

    <!-- ── Balls ── -->
    <div class="base-inv-section">
      <div class="base-inv-label">🎯 BALLS</div>
      <div class="base-inv-row">${ballsHtml}</div>
    </div>

    <!-- ── Boosts ── -->
    <div class="base-inv-section">
      <div class="base-inv-label">⚡ BOOSTS</div>
      <div class="base-inv-row">${boostsHtml}</div>
    </div>

    <!-- ── Objets ── -->
    <div class="base-inv-section">
      <div class="base-inv-label">🔧 OBJETS</div>
      <div class="base-inv-row">${craftHtml}${keysHtml}</div>
    </div>

    <!-- ── Incubateurs ── -->
    <div class="base-inv-section"${incCount > 0 ? ' data-base-action="pension" style="cursor:pointer"' : ''}>
      <div class="base-inv-label">🥚 INCUBATEURS${waitingEggs.length > 0 ? ` <span style="color:var(--text-dim);font-weight:normal">+${waitingEggs.length} en attente</span>` : ''}</div>
      ${incCount > 0
        ? `<div class="base-inc-slots">${incSlotsHtml}</div>`
        : `<div style="font-size:8px;color:var(--text-dim);padding:2px 0 3px;opacity:.5">${state.lang === 'fr' ? 'Aucun incubateur — achetez-en au Marché' : 'No incubators — buy some at the Market'}</div>`}
    </div>

  </div>`;
}

function bindGangBase(container) {
  const BALL_IDS  = ['pokeball','greatball','ultraball','duskball','masterball'];
  const BOOST_IDS = ['lure','superlure','incense','rarescope','aura'];

  // Boss team slot clicks
  container.querySelectorAll('[data-boss-slot]').forEach(slot => {
    slot.addEventListener('click', () => {
      const idx = parseInt(slot.dataset.bossSlot);
      const pkId = state.gang.bossTeam[idx];
      if (pkId) {
        state.gang.bossTeam.splice(idx, 1);
        saveState();
        renderZoneWindows();
      } else {
        openTeamPicker('boss', null, () => renderZoneWindows());
      }
    });
  });

  // Incubator section → PC eggs tab
  container.querySelector('[data-base-action="pension"]')?.addEventListener('click', () => {
    pcView = 'eggs';
    switchTab('tabPC');
  });

  // Item tiles
  container.querySelectorAll('.base-item-tile[data-bag-item]').forEach(el => {
    el.addEventListener('click', () => {
      const id  = el.dataset.bagItem;
      const qty = state.inventory?.[id] || 0;

      if (BALL_IDS.includes(id)) {
        state.activeBall = id;
        saveState();
        renderZoneWindows();
        renderGangBasePanel();
        return;
      }
      if (id === 'rarecandy') { openRareCandyPicker(); return; }
      if (BOOST_IDS.includes(id)) {
        if (qty > 0 && activateBoost(id)) {
          notify(`Boost activé — ${Math.ceil(boostRemaining(id))}s`, 'success');
        }
        renderZoneWindows();
        renderGangBasePanel();
        return;
      }
    });
  });

  // Auto-buy ball toggle
  container.querySelectorAll('[data-auto-ball]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const ballId = btn.dataset.autoBall;
      state.settings.autoBuyBall = (state.settings.autoBuyBall === ballId) ? null : ballId;
      saveState();
      renderGangBasePanel();
    });
  });

  // Export button
  container.querySelector('.base-export-btn')?.addEventListener('click', exportGangImage);

}

// ── Codex — Prix & Spawns reference modal ────────────────────
function openCodexModal() {
  const RARITY_ORDER = ['common','uncommon','rare','very_rare','legendary'];
  const RARITY_FR = { common:'Commun', uncommon:'Peu commun', rare:'Rare', very_rare:'Très rare', legendary:'Légendaire' };
  const RARITY_COLOR = { common:'#aaa', uncommon:'#5be06c', rare:'#5b9be0', very_rare:'#c05be0', legendary:'#ffcc5a' };
  const POTENTIALS = [1,2,3,4,5];
  const POT_MULT   = POTENTIAL_MULT; // [0.5,1,2,5,15]

  // ── TAB 1: Prix ───────────────────────────────────────────
  function buildPrixTab() {
    const headCells = POTENTIALS.map(p =>
      `<th style="padding:6px 10px;color:#ccc">★${p}<br><span style="font-size:8px;color:#666">×${POT_MULT[p-1]}</span></th>`
    ).join('');
    const shinyHeadCells = POTENTIALS.map(p =>
      `<th style="padding:6px 10px;color:#ffcc5a">★${p} ✨<br><span style="font-size:8px;color:#888">×${POT_MULT[p-1]*10}</span></th>`
    ).join('');

    const rows = RARITY_ORDER.map(r => {
      const base = BASE_PRICE[r];
      const cells = POTENTIALS.map(p => {
        const v = Math.round(base * POT_MULT[p-1]);
        return `<td style="padding:5px 10px;text-align:right;color:#e0e0e0">${v.toLocaleString()}₽</td>`;
      }).join('');
      const shinyCells = POTENTIALS.map(p => {
        const v = Math.round(base * POT_MULT[p-1] * 10);
        return `<td style="padding:5px 10px;text-align:right;color:#ffcc5a">${v.toLocaleString()}₽</td>`;
      }).join('');
      return `
        <tr>
          <td style="padding:5px 10px;font-weight:bold;color:${RARITY_COLOR[r]};white-space:nowrap">${RARITY_FR[r]}</td>
          <td style="padding:5px 10px;text-align:right;color:#888">${base.toLocaleString()}₽</td>
          ${cells}
        </tr>
        <tr style="background:rgba(255,204,90,0.04)">
          <td style="padding:5px 10px;font-size:9px;color:#ffcc5a;white-space:nowrap">✨ Shiny</td>
          <td style="padding:5px 10px;text-align:right;color:#ffcc5a;font-size:9px">${(base*10).toLocaleString()}₽</td>
          ${shinyCells}
        </tr>`;
    }).join('');

    return `
      <div style="overflow-x:auto">
        <table style="border-collapse:collapse;font-family:'Courier New',monospace;font-size:11px;width:100%">
          <thead>
            <tr style="border-bottom:1px solid #333">
              <th style="padding:6px 10px;text-align:left;color:#888">Rareté</th>
              <th style="padding:6px 10px;color:#888">Base</th>
              ${headCells}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div style="margin-top:10px;font-size:9px;color:#555;font-family:'Courier New',monospace">
        Nature : toutes les natures ont un multiplicateur moyen de ×1.0 — aucun impact sur le prix final.
      </div>`;
  }

  // ── TAB 2: Spawns par zone ────────────────────────────────
  function buildSpawnsTab() {
    const TYPE_LABEL = { route:'🌿 Routes & Grottes', gym:'⚔ Arènes', special:'⭐ Lieux Spéciaux' };
    const TYPE_COLOR = { route:'#5be06c', gym:'#e05b5b', special:'#e0c05b' };
    const RARITY_C   = { common:'#aaa', uncommon:'#5be06c', rare:'#5b9be0', very_rare:'#c05be0', legendary:'#ffcc5a' };
    const GYM_LEADER_FR = {
      brock:'Pierre', misty:'Ondine', ltsurge:'Maj. Bob', erika:'Érika',
      koga:'Koga', sabrina:'Morgane', blaine:'Auguste', blue:'Blue',
    };

    const sections = { route:[], gym:[], special:[] };
    for (const zone of ZONES) sections[zone.type || 'route']?.push(zone);

    let html = '';
    for (const [type, zones] of Object.entries(sections)) {
      if (!zones.length) continue;
      html += `<div style="margin-bottom:20px">
        <div style="font-family:var(--font-pixel);font-size:9px;color:${TYPE_COLOR[type]};margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,.08)">
          ${TYPE_LABEL[type]} — ${zones.length} zones
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px">`;

      for (const zone of zones) {
        const bg     = ZONE_BGS[zone.id];
        const bgImg  = bg ? `url('${bg.url}'),linear-gradient(180deg,${bg.fb})` : `linear-gradient(180deg,#1a1a1a,#0d0d0d)`;
        const mKey   = zone.music;
        const mName  = mKey && MUSIC_TRACKS[mKey] ? MUSIC_TRACKS[mKey].fr : null;

        // Pokémon pool sprites
        const poolHtml = zone.pool.map(en => {
          const sp  = SPECIES_BY_EN[en];
          const col = RARITY_C[sp?.rarity] || '#aaa';
          return `<div style="display:flex;flex-direction:column;align-items:center;gap:1px" title="${sp?.fr || en}">
            <img src="${pokeSprite(en)}" style="width:26px;height:26px;image-rendering:pixelated;filter:drop-shadow(0 1px 3px rgba(0,0,0,.9))">
            <div style="width:4px;height:4px;border-radius:50%;background:${col};opacity:.8"></div>
          </div>`;
        }).join('');

        // Rare pool (premier 6)
        const rareHtml = zone.rarePool ? `
          <div style="margin-top:6px;padding-top:5px;border-top:1px solid rgba(255,255,255,.06)">
            <span style="font-size:7px;font-family:var(--font-pixel);color:#888">✨ Rare (10%) : </span>
            ${zone.rarePool.slice(0,6).map(e => {
              const sp = SPECIES_BY_EN[e.en];
              return `<img src="${pokeSprite(e.en)}" style="width:20px;height:20px;image-rendering:pixelated;opacity:.7" title="${sp?.fr || e.en} (w:${e.w})">`;
            }).join('')}
          </div>` : '';

        // Gym leader
        const gymHtml = zone.gymLeader ? (() => {
          const lFr = GYM_LEADER_FR[zone.gymLeader] || zone.gymLeader;
          return `<div style="display:flex;align-items:center;gap:6px;margin-top:6px;padding-top:5px;border-top:1px solid rgba(255,255,255,.06)">
            <img src="${trainerSprite(zone.gymLeader)}" style="width:28px;height:28px;image-rendering:pixelated">
            <div>
              <div style="font-family:var(--font-pixel);font-size:8px;color:var(--gold)">${lFr}</div>
              <div style="font-size:8px;color:var(--text-dim)">XP ×${zone.xpBonus}</div>
            </div>
          </div>`;
        })() : '';

        html += `<div style="border-radius:6px;overflow:hidden;border:1px solid rgba(255,255,255,.08)">
          <!-- Header avec background de zone -->
          <div style="position:relative;height:44px;background-image:${bgImg};background-size:cover;background-position:center">
            <div style="position:absolute;inset:0;background:rgba(0,0,0,.55)"></div>
            <div style="position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;padding:4px 8px;height:100%">
              <div>
                <div style="font-family:var(--font-pixel);font-size:8px;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.9)">${zone.fr}</div>
                <div style="font-size:7px;color:rgba(255,255,255,.5)">Rep ≥ ${zone.rep}${zone.unlockItem ? ' · 🔑' : ''}</div>
              </div>
              <div style="text-align:right;font-size:7px;color:rgba(255,255,255,.5)">
                ${mName ? `🎵 ${mName}` : ''}
                ${zone.spawnRate ? `<br>Spawn ×${zone.spawnRate}` : ''}
              </div>
            </div>
          </div>
          <!-- Pool -->
          <div style="background:rgba(0,0,0,.6);padding:6px 8px">
            <div style="display:flex;flex-wrap:wrap;gap:4px;align-items:flex-end">${poolHtml}</div>
            ${rareHtml}
            ${gymHtml}
          </div>
        </div>`;
      }
      html += '</div></div>';
    }
    return html;
  }

  // ── Modal shell ───────────────────────────────────────────
  const existing = document.getElementById('codexModal');
  if (existing) { existing.remove(); return; }

  const modal = document.createElement('div');
  modal.id = 'codexModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9300;background:rgba(0,0,0,.88);display:flex;align-items:flex-start;justify-content:center;padding:16px;overflow-y:auto';

  modal.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--border);border-radius:var(--radius);width:100%;max-width:800px;display:flex;flex-direction:column;gap:0">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--border)">
        <span style="font-family:var(--font-pixel);font-size:11px;color:var(--gold)">📖 Codex — Référence</span>
        <button id="codexClose" style="background:transparent;border:none;color:#aaa;font-size:18px;cursor:pointer;line-height:1">×</button>
      </div>
      <div style="display:flex;gap:0;border-bottom:1px solid var(--border)">
        <button class="codex-tab active" data-ct="prix" style="font-family:var(--font-pixel);font-size:9px;padding:10px 18px;background:transparent;border:none;border-bottom:2px solid var(--gold);color:var(--gold);cursor:pointer">💰 Prix</button>
        <button class="codex-tab" data-ct="spawns" style="font-family:var(--font-pixel);font-size:9px;padding:10px 18px;background:transparent;border:none;border-bottom:2px solid transparent;color:#888;cursor:pointer">🗺 Spawns</button>
      </div>
      <div id="codexBody" style="padding:18px;overflow-y:auto;max-height:calc(100vh - 160px)">
        ${buildPrixTab()}
      </div>
    </div>`;

  document.body.appendChild(modal);

  modal.querySelector('#codexClose').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  modal.querySelectorAll('.codex-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      modal.querySelectorAll('.codex-tab').forEach(b => {
        b.style.borderBottom = '2px solid transparent';
        b.style.color = '#888';
      });
      btn.style.borderBottom = '2px solid var(--gold)';
      btn.style.color = 'var(--gold)';
      const body = modal.querySelector('#codexBody');
      body.innerHTML = btn.dataset.ct === 'prix' ? buildPrixTab() : buildSpawnsTab();
    });
  });
}

// ── Gang Export (Canvas screenshot) ──────────────────────────
function exportGangImage(mode = 'portrait') {
  const g = state.gang;
  const s = state.stats;

  // ── Data ──────────────────────────────────────────────────
  const teamPks = g.bossTeam.map(id => state.pokemons.find(p => p.id === id)).filter(Boolean);
  const mvp = state.pokemons.length > 0
    ? state.pokemons.reduce((best, p) => calculatePrice(p) > calculatePrice(best) ? p : best)
    : null;
  const dexCaught = Object.values(state.pokedex).filter(e => e.caught).length;
  const dexTotal  = POKEMON_GEN1.length;
  const topSp = Object.entries(state.pokedex).sort((a,b) => (b[1].count||0) - (a[1].count||0))[0];

  // ── Background ────────────────────────────────────────────
  const bgKey = state.cosmetics?.gameBg;
  const bgUrl = bgKey ? COSMETIC_BGS[bgKey]?.url : null;
  const bgStyle = bgUrl
    ? `background-image:url('${bgUrl}');background-size:cover;background-position:center`
    : 'background:linear-gradient(180deg,#180606 0%,#200d0d 45%,#160808 80%,#0e0404 100%)';

  // ── Helpers ───────────────────────────────────────────────
  const sp = (src, size, alt = '') =>
    `<img src="${src}" width="${size}" height="${size}" alt="${alt}"
      style="image-rendering:pixelated;object-fit:contain;display:block"
      onerror="this.style.visibility='hidden'">`;

  // ── Boss team ─────────────────────────────────────────────
  const bossTeamHtml = teamPks.map(pk => `
    <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
      ${sp(pokeSprite(pk.species_en, pk.shiny), 64, speciesName(pk.species_en))}
      <span style="font-size:9px;color:${pk.shiny ? '#ffcc5a' : '#888'}">${'★'.repeat(pk.potential)} Lv.${pk.level}</span>
      <span style="font-size:8px;color:#aaa">${speciesName(pk.species_en)}</span>
    </div>`).join('');

  // ── MVP ───────────────────────────────────────────────────
  const mvpHtml = mvp ? `
    <div style="border:2px solid #ffcc5a;border-radius:6px;padding:8px 10px;background:rgba(255,204,90,0.08);text-align:center;flex-shrink:0">
      <div style="font-size:9px;color:#ffcc5a;margin-bottom:4px;font-family:'Press Start 2P',monospace">💰 MVP</div>
      ${sp(pokeSprite(mvp.species_en, mvp.shiny), 60, speciesName(mvp.species_en))}
      <div style="font-size:9px;color:#e0e0e0;margin-top:4px">${speciesName(mvp.species_en)}${mvp.shiny ? ' ★' : ''}</div>
      <div style="font-size:10px;color:#ffcc5a;font-weight:bold">${calculatePrice(mvp).toLocaleString()}₽</div>
    </div>` : '';

  // ── Agents ────────────────────────────────────────────────
  const agentsHtml = state.agents.map(ag => {
    const agPks = ag.team.map(id => state.pokemons.find(p => p.id === id)).filter(Boolean);
    const zoneName = ag.assignedZone ? (ZONE_BY_ID[ag.assignedZone]?.fr || ag.assignedZone) : 'Sans zone';
    const teamHtml = agPks.slice(0, 6).map(pk => `
      <div style="display:flex;flex-direction:column;align-items:center;gap:1px">
        ${sp(pokeSprite(pk.species_en, pk.shiny), 36, speciesName(pk.species_en))}
        <span style="font-size:7px;color:${pk.shiny ? '#ffcc5a' : '#666'}">${pk.level}</span>
      </div>`).join('');
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 16px;border-bottom:1px solid rgba(255,255,255,0.06)">
        ${sp(ag.sprite || trainerSprite('acetrainer'), 48, ag.name)}
        <div style="display:flex;flex-direction:column;gap:3px;min-width:130px">
          <span style="font-size:11px;color:#e0e0e0;font-weight:bold">${ag.name} <span style="color:#888">Lv.${ag.level}</span></span>
          <span style="font-size:9px;color:#888">${zoneName}</span>
          <span style="font-size:8px;color:#555">ATK:${ag.stats?.combat||0} &nbsp;CAP:${ag.stats?.capture||0} &nbsp;LCK:${ag.stats?.luck||0}</span>
        </div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;flex:1">${teamHtml}</div>
      </div>`;
  }).join('');

  // ── Stats ─────────────────────────────────────────────────
  const row = (l, lv, r, rv) => `
    <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:10px">
      <span style="color:#ccc">${l} : <strong style="color:#e0e0e0">${lv}</strong></span>
      ${r ? `<span style="color:#ccc">${r} : <strong style="color:#e0e0e0">${rv}</strong></span>` : ''}
    </div>`;

  const richest = mvp; // same calc
  const statsHtml = [
    row('✨ Shiny', s.shinyCaught||0, '⚔ Victoires', s.totalFightsWon||0),
    row('🎯 Captures', s.totalCaught||0, '📦 Coffres', s.chestsOpened||0),
    row('₽ Actuels', `${g.money.toLocaleString()}₽`, '₽ Gagné', `${(s.totalMoneyEarned||0).toLocaleString()}₽`),
    row('⭐ Réputation', g.reputation, topSp ? '🏆 Top' : '', topSp ? `${speciesName(topSp[0])} ×${topSp[1].count||1}` : ''),
    richest ? `<div style="padding:3px 0;font-size:10px;color:#ccc">💰 Pokémon le + cher : <strong style="color:#ffcc5a">${speciesName(richest.species_en)}${richest.shiny ? ' ★' : ''} — ${calculatePrice(richest).toLocaleString()}₽</strong></div>` : '',
    s.mostExpensiveSold ? `<div style="padding:3px 0;font-size:10px;color:#ccc">💎 Vente record : <strong>${s.mostExpensiveSold.name} — ${(s.mostExpensiveSold.price||0).toLocaleString()}₽</strong></div>` : '',
    s.mostExpensiveObtained ? `<div style="padding:3px 0;font-size:10px;color:#ccc">🌟 Capture record : <strong>${s.mostExpensiveObtained.name} — ${(s.mostExpensiveObtained.price||0).toLocaleString()}₽</strong></div>` : '',
  ].join('');

  // ── HTML document ─────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>PokéGang — ${g.name}</title>
  <link rel="icon" href="https://lab.sterenna.fr/PG/pokegang_logo/pokegang_logo_little.png">
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Courier New',monospace;background:#0a0404;color:#e0e0e0;min-height:100vh}
    .toolbar{position:fixed;top:0;left:0;right:0;z-index:100;background:rgba(14,4,4,.97);border-bottom:2px solid #cc3333;display:flex;align-items:center;justify-content:space-between;padding:10px 20px;gap:10px}
    .toolbar-title{font-family:'Press Start 2P',monospace;font-size:9px;color:#cc3333;white-space:nowrap}
    .toolbar-hint{font-size:9px;color:#555}
    .toolbar-btns{display:flex;gap:8px;flex-shrink:0}
    .btn{font-family:'Press Start 2P',monospace;font-size:8px;padding:8px 14px;border-radius:4px;cursor:pointer;border:1px solid;transition:all .2s;background:transparent}
    .btn-print{border-color:#aaa;color:#aaa}.btn-print:hover{background:rgba(255,255,255,.1)}
    .card{max-width:700px;margin:64px auto 40px;border:2px solid #cc3333;border-radius:4px;overflow:hidden;box-shadow:0 0 40px rgba(204,51,51,.2)}
    ${mode === 'landscape' ? `.card{max-width:900px;} .card-content{display:grid;grid-template-columns:1fr 1fr;} hr{display:none}` : ''}
    .card-bg{${bgStyle};position:relative}
    .card-bg::after{content:'';position:absolute;inset:0;background:rgba(0,0,0,.72);pointer-events:none}
    .card-content{position:relative;z-index:1}
    .sec-header{text-align:center;font-family:'Press Start 2P',monospace;font-size:8px;color:#666;padding:8px 0;letter-spacing:.1em}
    hr{border:none;border-top:1px solid rgba(204,51,51,.35);margin:0 16px}
    @media print{
      .toolbar{display:none!important}
      body{background:#0a0404!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .card{margin:0 auto;max-width:100%;border:none;box-shadow:none}
      @page{margin:8mm;background:#0a0404}
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <span class="toolbar-title">📋 ${g.name}</span>
    <span class="toolbar-hint">Ctrl+P pour PDF &nbsp;·&nbsp; clic droit → Enregistrer pour PNG</span>
    <div class="toolbar-btns">
      <button class="btn btn-print" onclick="window.print()">🖨 Imprimer / PDF</button>
    </div>
  </div>

  <div class="card">
    <div class="card-bg"><div class="card-content">

      <!-- ── Header ── -->
      <div style="display:flex;align-items:flex-start;gap:14px;padding:16px 16px 12px">
        ${g.bossSprite ? sp(trainerSprite(g.bossSprite), 88, g.bossName) : '<div style="width:88px;height:88px"></div>'}
        <div style="display:flex;flex-direction:column;gap:5px;flex:1">
          <div style="font-family:'Press Start 2P',monospace;font-size:18px;color:#cc3333;line-height:1.3">${g.name}</div>
          <div style="font-size:10px;color:#aaa">Boss : ${g.bossName}</div>
          <div style="display:flex;gap:20px;flex-wrap:wrap">
            <span style="font-size:9px;color:#ffcc5a">⭐ Réputation : ${g.reputation.toLocaleString()}</span>
            <span style="font-size:9px;color:#e0e0e0">₽ ${g.money.toLocaleString()}</span>
          </div>
          <div style="font-size:8px;color:#aaa">Pokémon : ${state.pokemons.length} &nbsp;&nbsp; Shiny : ${s.shinyCaught||0}</div>
          <div style="font-size:8px;color:#aaa">Victoires : ${s.totalFightsWon||0} &nbsp;&nbsp; Captures : ${s.totalCaught||0}</div>
          <div style="font-size:8px;color:${dexCaught >= dexTotal ? '#ffcc5a' : '#444'}">📖 Pokédex : ${dexCaught}/${dexTotal}${dexCaught >= dexTotal ? ' ✓ COMPLET !' : ''}</div>
        </div>
      </div>

      <!-- ── Équipe Boss ── -->
      <hr><div class="sec-header">— ÉQUIPE BOSS —</div>
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:8px 16px 14px;flex-wrap:wrap">
        <div style="display:flex;gap:8px;flex-wrap:wrap;flex:1">${bossTeamHtml}</div>
        ${mvpHtml}
      </div>

      ${state.agents.length > 0 ? `
      <!-- ── Agents ── -->
      <hr><div class="sec-header">— AGENTS —</div>
      <div>${agentsHtml}</div>
      ` : ''}

      <!-- ── Stats ── -->
      <hr><div class="sec-header">— STATISTIQUES —</div>
      <div style="padding:10px 20px 14px">${statsHtml}</div>

      <!-- ── Footer ── -->
      <div style="display:flex;align-items:center;justify-content:center;padding:10px 0 14px">
        <img src="https://lab.sterenna.fr/PG/pokegang_logo/pokegang_logo_medium.png"
          style="height:28px;width:auto;opacity:.5" alt="PokéGang"
          onerror="this.style.display='none'">
      </div>

    </div></div>
  </div>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) { notify('Autorise les popups pour l\'export', 'error'); return; }
  win.document.open();
  win.document.write(html);
  win.document.close();
  notify('📋 Fiche ouverte dans un nouvel onglet', 'success');
}

// ── Team Picker Modal ────────────────────────────────────────
// type: 'boss' | 'agent', targetId: agentId or null for boss
function openTeamPicker(type, targetId, onDone) {
  // Get all already-assigned IDs
  const assignedIds = new Set([...state.gang.bossTeam]);
  for (const a of state.agents) a.team.forEach(id => assignedIds.add(id));
  const available = state.pokemons
    .filter(p => !assignedIds.has(p.id))
    .sort((a, b) => getPokemonPower(b) - getPokemonPower(a));

  if (available.length === 0) {
    notify(state.lang === 'fr' ? 'Aucun Pokémon disponible' : 'No Pokémon available');
    return;
  }

  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.id = 'teamPickerOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;animation:fadeIn .2s ease';

  const targetLabel = type === 'boss'
    ? (state.lang === 'fr' ? 'Équipe du Boss' : 'Boss Team')
    : (state.agents.find(a => a.id === targetId)?.name || 'Agent');

  let listHtml = available.slice(0, 30).map(p => {
    const power = getPokemonPower(p);
    return `<div class="picker-pokemon" data-pick-id="${p.id}" style="display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s">
      <img src="${pokeSprite(p.species_en, p.shiny)}" style="width:40px;height:40px">
      <div style="flex:1;min-width:0">
        <div style="font-size:12px">${speciesName(p.species_en)} ${'★'.repeat(p.potential)}${p.shiny ? ' ✨' : ''}</div>
        <div style="font-size:10px;color:var(--text-dim)">Lv.${p.level} — PC: ${power}</div>
      </div>
    </div>`;
  }).join('');

  overlay.innerHTML = `<div style="background:var(--bg-panel);border:2px solid var(--border);border-radius:var(--radius);width:90%;max-width:400px;max-height:70vh;display:flex;flex-direction:column">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:2px solid var(--border)">
      <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold)">${state.lang === 'fr' ? 'Choisir un Pokémon' : 'Choose a Pokémon'} → ${targetLabel}</div>
      <button id="btnClosePicker" style="background:none;border:none;color:var(--text-dim);font-size:20px;cursor:pointer;line-height:1">&times;</button>
    </div>
    <div style="padding:6px 10px;border-bottom:1px solid var(--border)">
      <input id="pickerSearch" type="text" placeholder="Filtrer..." style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:11px;padding:4px 8px;box-sizing:border-box">
    </div>
    <div id="pickerList" style="overflow-y:auto;flex:1">${listHtml}</div>
  </div>`;

  document.body.appendChild(overlay);

  // Close
  overlay.querySelector('#btnClosePicker').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  // Pick handler
  overlay.querySelectorAll('[data-pick-id]').forEach(el => {
    el.addEventListener('click', () => {
      const pkId = el.dataset.pickId;
      const pk = state.pokemons.find(p => p.id === pkId);
      if (!pk) return;
      if (type === 'boss') {
        if (state.gang.bossTeam.length < 3) {
          removePokemonFromAllAssignments(pkId);
          state.gang.bossTeam.push(pkId);
        }
      } else {
        const agent = state.agents.find(a => a.id === targetId);
        if (agent && agent.team.length < 3) {
          agent.team.push(pkId);
        }
      }
      saveState();
      overlay.remove();
      notify(`${speciesName(pk.species_en)} → ${targetLabel}`, 'success');
      if (onDone) onDone();
    });
  });

  // Search filter
  const searchInput = overlay.querySelector('#pickerSearch');
  const pickerList = overlay.querySelector('#pickerList');
  if (searchInput && pickerList) {
    const bindPickHandlers = (container) => {
      container.querySelectorAll('[data-pick-id]').forEach(el => {
        el.addEventListener('click', () => {
          const pkId = el.dataset.pickId;
          const pk = state.pokemons.find(p => p.id === pkId);
          if (!pk) return;
          if (type === 'boss') {
            if (state.gang.bossTeam.length < 3) { removePokemonFromAllAssignments(pkId); state.gang.bossTeam.push(pkId); }
          } else {
            const agent = state.agents.find(a => a.id === targetId);
            if (agent && agent.team.length < 3) agent.team.push(pkId);
          }
          saveState();
          overlay.remove();
          notify(`${speciesName(pk.species_en)} → ${targetLabel}`, 'success');
          if (onDone) onDone();
        });
      });
    };
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase();
      const filtered = q ? available.filter(p => speciesName(p.species_en).toLowerCase().includes(q)) : available;
      pickerList.innerHTML = filtered.slice(0, 50).map(p => {
        const power = getPokemonPower(p);
        return `<div class="picker-pokemon" data-pick-id="${p.id}" style="display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s">
          <img src="${pokeSprite(p.species_en, p.shiny)}" style="width:40px;height:40px">
          <div style="flex:1;min-width:0">
            <div style="font-size:12px">${speciesName(p.species_en)} ${'★'.repeat(p.potential)}${p.shiny ? ' ✨' : ''}</div>
            <div style="font-size:10px;color:var(--text-dim)">Lv.${p.level} — PC: ${power}</div>
          </div>
        </div>`;
      }).join('');
      bindPickHandlers(pickerList);
    });
  }
}

// Assign a pokemon to a team from PC (shows picker for destination)
function openAssignToPicker(pokemonId) {
  const pk = state.pokemons.find(p => p.id === pokemonId);
  if (!pk) return;

  // Check if already assigned
  const assignedIds = new Set([...state.gang.bossTeam]);
  for (const a of state.agents) a.team.forEach(id => assignedIds.add(id));
  if (assignedIds.has(pokemonId)) {
    notify(state.lang === 'fr' ? 'Déjà dans une équipe !' : 'Already in a team!');
    return;
  }

  // Build list of destinations (Boss + all agents with < 3 team members)
  const destinations = [];
  if (state.gang.bossTeam.length < 3) {
    destinations.push({ type: 'boss', id: null, label: state.gang.bossName + ' (Boss)', sprite: state.gang.bossSprite ? trainerSprite(state.gang.bossSprite) : null });
  }
  for (const a of state.agents) {
    if (a.team.length < 3) {
      destinations.push({ type: 'agent', id: a.id, label: a.name, sprite: a.sprite });
    }
  }

  if (destinations.length === 0) {
    notify(state.lang === 'fr' ? 'Toutes les équipes sont pleines !' : 'All teams are full!');
    return;
  }

  const overlay = document.createElement('div');
  overlay.id = 'teamPickerOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;animation:fadeIn .2s ease';

  let listHtml = destinations.map(d => `
    <div class="picker-dest" data-dest-type="${d.type}" data-dest-id="${d.id || ''}" style="display:flex;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s">
      ${d.sprite ? `<img src="${d.sprite}" style="width:40px;height:40px;image-rendering:pixelated">` : '<div style="width:40px;height:40px;background:var(--bg);border-radius:4px;display:flex;align-items:center;justify-content:center">👤</div>'}
      <div style="font-size:12px">${d.label}</div>
      <div style="font-size:10px;color:var(--text-dim);margin-left:auto">${d.type === 'boss' ? state.gang.bossTeam.length : state.agents.find(a => a.id === d.id)?.team.length || 0}/3</div>
    </div>
  `).join('');

  overlay.innerHTML = `<div style="background:var(--bg-panel);border:2px solid var(--border);border-radius:var(--radius);width:90%;max-width:360px;max-height:60vh;display:flex;flex-direction:column">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:2px solid var(--border)">
      <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold)">${speciesName(pk.species_en)} → ?</div>
      <button id="btnClosePicker" style="background:none;border:none;color:var(--text-dim);font-size:20px;cursor:pointer;line-height:1">&times;</button>
    </div>
    <div style="overflow-y:auto;flex:1">${listHtml}</div>
  </div>`;

  document.body.appendChild(overlay);
  overlay.querySelector('#btnClosePicker').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelectorAll('.picker-dest').forEach(el => {
    el.addEventListener('click', () => {
      const destType = el.dataset.destType;
      const destId = el.dataset.destId;
      if (destType === 'boss') {
        if (state.gang.bossTeam.length < 3) { removePokemonFromAllAssignments(pokemonId); state.gang.bossTeam.push(pokemonId); }
      } else {
        const agent = state.agents.find(a => a.id === destId);
        if (agent && agent.team.length < 3) agent.team.push(pokemonId);
      }
      saveState();
      overlay.remove();
      const destLabel = destType === 'boss' ? state.gang.bossName : (state.agents.find(a => a.id === destId)?.name || 'Agent');
      notify(`${speciesName(pk.species_en)} → ${destLabel}`, 'success');
      renderPCTab();
    });
  });
}

// ── Zone timers & probability display ─────────────────────────
const zoneNextSpawn = {}; // zoneId -> { countdown, lastSpawnType }
const zoneSpawnHistory = {}; // zoneId -> { pokemon:N, trainer:N, total:N }

function updateZoneTimers(zoneId) {
  const el = document.getElementById(`zt-${zoneId}`);
  if (!el || !el.classList.contains('expanded')) return;
  const zone = ZONE_BY_ID[zoneId];
  if (!zone) return;

  const zState = initZone(zoneId);
  const combats = zState.combatsWon || 0;
  const captures = zState.captures || 0;
  const mastery = getZoneMastery(zoneId);
  const nextMastery = mastery < 2 ? 10 : mastery < 3 ? 50 : null;
  const pct = nextMastery ? Math.min(100, Math.round((combats / nextMastery) * 100)) : 100;

  let html = `
    <div style="padding:6px 8px;font-size:9px;font-family:var(--font-pixel)">
      <div style="color:var(--text-dim);margin-bottom:4px">${zone.type === 'city' ? 'VILLE / ARÈNE' : 'PROGRESSION'}</div>
      <div style="margin-bottom:4px">Combats: ${combats}${nextMastery ? `/${nextMastery}` : ' [MAX]'}
        ${zone.type !== 'city' ? ` | Captures: ${captures}` : ''}
        ${zState.gymDefeated ? ' <span style="color:var(--gold)">[V]</span>' : ''}
      </div>
      ${nextMastery ? `<div style="background:var(--border);border-radius:2px;height:4px;margin-bottom:6px">
        <div style="background:var(--gold-dim);height:4px;border-radius:2px;width:${pct}%"></div>
      </div>` : ''}`;

  // Active boosts remaining
  for (const bid of ['incense', 'rarescope', 'aura', 'chestBoost', 'lure', 'superlure']) {
    if (isBoostActive(bid)) {
      const rem = boostRemaining(bid);
      const labels = { incense:'INC', rarescope:'SCO', aura:'AUR', chestBoost:'CHT', lure:'LR', superlure:'SLR' };
      html += `<div style="color:var(--gold);margin-bottom:2px">${labels[bid]}: ${rem}s</div>`;
    }
  }

  // Active event countdown
  const activeEvt = state.activeEvents[zoneId];
  if (activeEvt && activeEvt.expiresAt > Date.now()) {
    const evtDef = SPECIAL_EVENTS.find(e => e.id === activeEvt.eventId);
    const rem = Math.ceil((activeEvt.expiresAt - Date.now()) / 1000);
    if (evtDef) html += `<div style="color:var(--red)">${state.lang === 'fr' ? evtDef.fr : evtDef.en}: ${rem}s</div>`;
  }

  html += '</div>';
  el.innerHTML = html;

  // Also refresh the zone-level inline display in viewport
  const zWin = document.getElementById(`zw-${zoneId}`);
  const levelEl = zWin?.querySelector('.zone-level');
  if (levelEl) {
    const freshCombats = zState.combatsWon || 0;
    const freshCaptures = zState.captures || 0;
    const freshNextMastery = mastery < 3 ? (mastery < 2 ? 10 : 50) : null;
    const freshProgressText = zone.type === 'city'
      ? `Combats: ${freshCombats}${zState.gymDefeated ? ' ✓GYM' : freshCombats >= 10 && zone.gymLeader ? ' — RAID!' : ''}`
      : `Combats: ${freshCombats}${freshNextMastery ? `/${freshNextMastery}` : ''} | Cap: ${freshCaptures}`;
    levelEl.innerHTML = freshProgressText + (zone.type === 'city' ? ` <span style="color:var(--gold);font-size:8px">XP*${zone.xpBonus}</span>` : '');
  }

  // Also refresh slots bar
  const slotsBarEl = zWin?.querySelector('.zone-slots-bar');
  if (slotsBarEl) {
    const assignedCount = state.agents.filter(a => a.assignedZone === zoneId).length;
    const maxSlots = (state.zones[zoneId]?.slots) || 1;
    const countSpan = slotsBarEl.querySelector('.slot-count');
    if (countSpan) countSpan.textContent = `Agents: ${assignedCount}/${maxSlots}`;
  }

  // Cooldown display on agents and boss in viewport
  const win = document.getElementById(`zw-${zoneId}`);
  if (!win) return;
  for (const agent of state.agents.filter(a => a.assignedZone === zoneId)) {
    const agentEl = win.querySelector(`[data-agent-id="${agent.id}"] .agent-cd-label`);
    if (!agentEl) continue;
    const agentPks = agent.team.map(id => state.pokemons.find(p => p.id === id)).filter(Boolean);
    const allCd = agentPks.length > 0 && agentPks.every(p => (p.cooldown || 0) > 0);
    if (allCd) {
      const maxCd = Math.max(...agentPks.map(p => p.cooldown || 0));
      agentEl.textContent = `CD ${maxCd * 10}s`;
      agentEl.style.display = '';
    } else {
      agentEl.style.display = 'none';
    }
  }
  // Boss cooldown
  const bossCdLabel = win.querySelector('.boss-cd-label');
  if (bossCdLabel) {
    const bossPks = state.gang.bossTeam.map(id => state.pokemons.find(p => p.id === id)).filter(Boolean);
    const allBossCd = bossPks.length > 0 && bossPks.every(p => (p.cooldown || 0) > 0);
    if (allBossCd) {
      const maxCd = Math.max(...bossPks.map(p => p.cooldown || 0));
      bossCdLabel.textContent = `CD ${maxCd * 10}s`;
      bossCdLabel.style.display = '';
    } else {
      bossCdLabel.style.display = 'none';
    }
  }
}

function tickZoneSpawn(zoneId) {
  if (!openZones.has(zoneId)) return;
  const spawns = zoneSpawns[zoneId];
  if (!spawns) return;
  // Max 5 spawns at once
  if (spawns.length >= 5) { updateZoneTimers(zoneId); return; }

  const entry = spawnInZone(zoneId);
  if (!entry) return;

  // Track history
  if (!zoneSpawnHistory[zoneId]) zoneSpawnHistory[zoneId] = { pokemon: 0, trainer: 0, chest: 0, event: 0, total: 0 };
  zoneSpawnHistory[zoneId].total++;
  if (entry.type === 'pokemon') zoneSpawnHistory[zoneId].pokemon++;
  else if (entry.type === 'trainer' || entry.type === 'raid') zoneSpawnHistory[zoneId].trainer++;
  else if (entry.type === 'chest') zoneSpawnHistory[zoneId].chest++;
  else if (entry.type === 'event') zoneSpawnHistory[zoneId].event++;

  // Track for timer
  if (!zoneNextSpawn[zoneId]) zoneNextSpawn[zoneId] = {};
  zoneNextSpawn[zoneId].lastSpawnType = entry.type;

  const spawnObj = { ...entry, id: uid() };
  spawns.push(spawnObj);

  // TTL: 10-15 seconds
  const ttl = randInt(10000, 15000);
  spawnObj.timeout = setTimeout(() => {
    removeSpawn(zoneId, spawnObj.id);
  }, ttl);

  renderSpawnInWindow(zoneId, spawnObj);
  updateZoneTimers(zoneId);

  // ── Wing drop passif (zone au max, mastery ≥ 3) ─────────────
  _tryWingDrop(zoneId);
}

// Chance de drop d'aile sur Îles Écume (silver_wing) et Route Victoire (rainbow_wing)
function _tryWingDrop(zoneId) {
  const WING_ZONES = { seafoam_islands: 'silver_wing', victory_road: 'rainbow_wing' };
  const wingId = WING_ZONES[zoneId];
  if (!wingId) return;
  const zs = state.zones?.[zoneId];
  if (!zs || (zs.mastery || 0) < 3) return; // zone doit être au moins niveau 3
  if (Math.random() > 0.05) return; // 5% par spawn
  const qty = Math.random() < 0.15 ? 3 : 1; // 15% chance d'obtenir 3
  zs.pendingItems = zs.pendingItems || {};
  zs.pendingItems[wingId] = (zs.pendingItems[wingId] || 0) + qty;
  saveState();
}

function renderSpawnInWindow(zoneId, spawnObj) {
  const win = document.getElementById(`zw-${zoneId}`);
  if (!win) return;
  const viewport = win.querySelector('.zone-viewport') || win;

  const el = document.createElement('div');
  el.className = 'zone-spawn pop';
  el.dataset.spawnId = spawnObj.id;

  // Random position (relative to viewport size)
  const x = randInt(10, 310);
  const y = randInt(10, 160);
  el.style.left = x + 'px';
  el.style.top = y + 'px';

  if (spawnObj.type === 'pokemon') {
    const sp = SPECIES_BY_EN[spawnObj.species_en];
    el.innerHTML = `<img src="${pokeSprite(spawnObj.species_en)}" style="width:56px;height:56px" alt="${sp?.fr || spawnObj.species_en}">`;
    el.title = sp ? (state.lang === 'fr' ? sp.fr : sp.en) : spawnObj.species_en;
    // Rare / very_rare / legendary popup notification
    if (sp && (sp.rarity === 'very_rare' || sp.rarity === 'legendary')) {
      setTimeout(() => showRarePopup(spawnObj.species_en, zoneId), 300);
    }
    el.addEventListener('click', () => {
      if (el.classList.contains('catching')) return;
      el.classList.add('catching');
      spawnObj.playerCatching = true;
      animateCapture(zoneId, spawnObj, el);
    });
  } else if (spawnObj.type === 'raid') {
    // Master Ball sprite for raids
    el.innerHTML = `<img src="${ITEM_SPRITE_URLS.masterball}" style="width:48px;height:48px;image-rendering:pixelated;filter:drop-shadow(0 0 8px #ff4444)">`;
    el.title = state.lang === 'fr' ? spawnObj.trainer.fr : spawnObj.trainer.en;
    el.style.animation = 'glow 1s ease-in-out infinite, float 2s ease-in-out infinite';
    el.addEventListener('click', () => {
      if (el.dataset.challenged) return;
      el.dataset.challenged = '1';
      openCombatPopup(zoneId, spawnObj);
    });
  } else if (spawnObj.type === 'trainer') {
    const eliteTag = spawnObj.elite ? ' style="filter:drop-shadow(0 0 6px gold)"' : '';
    el.innerHTML = `<img src="${trainerSprite(spawnObj.trainer.sprite)}"${eliteTag} style="width:56px;height:56px${spawnObj.elite ? ';filter:drop-shadow(0 0 6px gold)' : ''}" alt="${spawnObj.trainer.fr}">`;
    el.title = (state.lang === 'fr' ? spawnObj.trainer.fr : spawnObj.trainer.en) + (spawnObj.elite ? ' ⭐' : '');
    if (spawnObj.elite) el.style.animation = 'glow 1.5s ease-in-out infinite, float 3s ease-in-out infinite';
    el.addEventListener('click', () => {
      if (el.dataset.challenged) return;
      el.dataset.challenged = '1';
      openCombatPopup(zoneId, spawnObj);
    });
  } else if (spawnObj.type === 'chest') {
    el.innerHTML = `<div class="chest-sprite">📦</div>`;
    el.title = state.lang === 'fr' ? 'Coffre au trésor !' : 'Treasure Chest!';
    el.style.animation = 'float 2s ease-in-out infinite';
    el.addEventListener('click', () => {
      if (el.classList.contains('catching')) return;
      el.classList.add('catching');
      // Opening animation
      el.innerHTML = `<div style="font-size:36px;line-height:1;animation:pop .3s ease-out">🎁</div>`;
      state.stats.chestsOpened = (state.stats.chestsOpened || 0) + 1;
      setTimeout(() => {
        const loot = rollChestLoot(zoneId);
        notify(loot.msg, loot.type);
        SFX.play('chest'); // Loot jingle
        removeSpawn(zoneId, spawnObj.id);
        updateTopBar();
        updateZoneTimers(zoneId);
        saveState();
      }, 400);
    });
  } else if (spawnObj.type === 'event') {
    const evt = spawnObj.event;
    // Pokeball sprite based on event difficulty/rarity
    const evtBallKey = evt.trainerKey
      ? (evt.minRep >= 70 ? 'masterball' : evt.minRep >= 40 ? 'ultraball' : 'greatball')
      : 'pokeball';
    el.innerHTML = `<img src="${ITEM_SPRITE_URLS[evtBallKey]}" style="width:44px;height:44px;image-rendering:pixelated;filter:drop-shadow(0 0 8px rgba(255,204,90,.9))">`;
    el.title = state.lang === 'fr' ? evt.fr : evt.en;
    el.style.animation = 'glow 1s ease-in-out infinite, float 2s ease-in-out infinite';
    el.addEventListener('click', () => {
      if (el.classList.contains('catching')) return;
      el.classList.add('catching');
      if (evt.trainerKey) {
        // Event with combat
        const trainer = TRAINER_TYPES[evt.trainerKey];
        if (trainer) {
          const zone = ZONE_BY_ID[zoneId];
          const team = makeTrainerTeam(zone, evt.trainerKey);
          // Boosted difficulty
          team.forEach(t => {
            t.level += 10;
            t.stats = calculateStats({ species_en: t.species_en, level: t.level, nature: 'hardy', potential: 4 });
          });
          const combatSpawn = {
            ...spawnObj,
            type: 'trainer',
            trainerKey: evt.trainerKey,
            trainer: { ...trainer, fr: trainer.fr, en: trainer.en, diff: trainer.diff + 2, reward: [trainer.reward[0] * 4, trainer.reward[1] * 4], rep: trainer.rep * 3 },
            team,
            elite: true,
            isSpecial: true,
          };
          openCombatPopup(zoneId, combatSpawn);
        }
      } else {
        // Non-combat event: activate immediately
        activateEvent(zoneId, evt);
        removeSpawn(zoneId, spawnObj.id);
        updateZoneTimers(zoneId);
      }
    });
  }

  viewport.appendChild(el);
}

function removeSpawn(zoneId, spawnId) {
  const spawns = zoneSpawns[zoneId];
  if (!spawns) return;
  const idx = spawns.findIndex(s => s.id === spawnId);
  if (idx !== -1) {
    if (spawns[idx].timeout) clearTimeout(spawns[idx].timeout);
    spawns.splice(idx, 1);
  }
  // Remove DOM
  const el = document.querySelector(`[data-spawn-id="${spawnId}"]`);
  if (el) {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 300);
  }
}

// ── Ball throw + capture burst animation ──────────────────────

function animateCapture(zoneId, spawnObj, spawnEl) {
  const win = document.getElementById(`zw-${zoneId}`);
  if (!win) return;
  const viewport = win.querySelector('.zone-viewport') || win;

  // Find thrower position (boss or agent sprite in zone)
  const bossEl = viewport.querySelector('.zone-boss');
  const agentEl = viewport.querySelector('.zone-agent');
  const thrower = bossEl || agentEl;
  let startX, startY;
  if (thrower) {
    const r = thrower.getBoundingClientRect();
    const wr = viewport.getBoundingClientRect();
    startX = r.left - wr.left + r.width / 2;
    startY = r.top - wr.top;
  } else {
    // Default: bottom-right corner
    startX = 340;
    startY = 190;
  }
  const targetX = parseInt(spawnEl.style.left) + 28;
  const targetY = parseInt(spawnEl.style.top) + 28;

  // Create ball projectile
  const ball = document.createElement('div');
  ball.className = 'ball-projectile';
  ball.innerHTML = `<img src="${BALL_SPRITES[state.activeBall] || BALL_SPRITES.pokeball}">`;
  ball.style.left = startX + 'px';
  ball.style.top = startY + 'px';
  viewport.appendChild(ball);

  // Animate ball flight with CSS transition + SFX
  SFX.play('ballThrow')
  requestAnimationFrame(() => {
    ball.style.transition = 'left .35s ease-out, top .35s ease-in';
    ball.style.left = targetX + 'px';
    ball.style.top = targetY + 'px';
  });

  setTimeout(() => {
    // Ball lands — wobble 0-3 times (0 = critical catch, ★+1 bonus)
    const wobbles = Math.floor(Math.random() * 4); // 0, 1, 2, 3
    const isCritical = wobbles === 0;

    // Position ball on target (stop flight transition)
    ball.style.transition = 'none';
    ball.style.left = targetX - 10 + 'px';
    ball.style.top  = targetY - 10 + 'px';

    if (isCritical) {
      // Flash gold for critical
      ball.style.filter = 'drop-shadow(0 0 6px gold)';
    }

    function doCaptureAttempt() {
      ball.remove();
      const caught = tryCapture(zoneId, spawnObj.species_en, isCritical ? 1 : 0);
      if (caught) {
        if (isCritical) notify(`★ Capture critique ! +1 potentiel`, 'gold');
        if (caught.shiny) spawnEl.classList.add('shiny-flash');
        SFX.play('capture', caught.potential, caught.shiny);
        showCaptureBurst(viewport, targetX, targetY, caught.potential, caught.shiny);
        removeSpawn(zoneId, spawnObj.id);
        updateTopBar();
        if (activeTab === 'tabPC') renderPCTab();
        updateZoneTimers(zoneId);
      } else {
        // Fade out au contact, puis fade in si échec
        if (spawnEl) {
          spawnEl.style.transition = 'opacity .15s, transform .15s';
          spawnEl.style.opacity = '0';
          spawnEl.style.transform = 'scale(.7)';
          setTimeout(() => {
            spawnEl.style.opacity = '1';
            spawnEl.style.transform = '';
            spawnEl.classList.remove('catching');
          }, 350);
        }
      }
    }

    if (wobbles === 0) {
      // Critical — instant capture (no wobble)
      setTimeout(doCaptureAttempt, 150);
    } else {
      // Wobble N times then attempt
      let w = 0;
      function nextWobble() {
        w++;
        ball.classList.remove('ball-wobble');
        void ball.offsetWidth; // force reflow to restart animation
        ball.classList.add('ball-wobble');
        if (w < wobbles) {
          setTimeout(nextWobble, 480);
        } else {
          setTimeout(doCaptureAttempt, 520);
        }
      }
      setTimeout(nextWobble, 100);
    }
  }, 380);
}

function showCaptureBurst(container, x, y, potential, shiny) {
  const burst = document.createElement('div');
  burst.className = 'capture-burst';
  if (shiny) burst.classList.add('shiny');
  else if (potential >= 5) burst.classList.add('stars-5');
  else if (potential >= 4) burst.classList.add('stars-4');
  else if (potential >= 3) burst.classList.add('stars-3');
  burst.style.left = x + 'px';
  burst.style.top = y + 'px';

  // Ring
  const ring = document.createElement('div');
  ring.className = 'burst-ring';
  burst.appendChild(ring);

  // Particles
  const numParticles = shiny ? 16 : (potential >= 4 ? 12 : 8);
  for (let i = 0; i < numParticles; i++) {
    const p = document.createElement('div');
    p.className = 'burst-particle';
    const angle = (i / numParticles) * Math.PI * 2;
    const dist = 30 + Math.random() * 30;
    p.style.setProperty('--bx', Math.cos(angle) * dist + 'px');
    p.style.setProperty('--by', Math.sin(angle) * dist + 'px');
    burst.appendChild(p);
  }

  container.appendChild(burst);
  setTimeout(() => burst.remove(), 800);
}

// ════════════════════════════════════════════════════════════════
// 15.  UI — COMBAT POPUP
// ════════════════════════════════════════════════════════════════

let currentCombat = null;

function buildPlayerTeamForZone(zoneId) {
  const zoneAgents = state.agents.filter(a => a.assignedZone === zoneId);
  let allAllyIds = [];
  // Always include boss team (boss is omnipresent)
  if (state.gang.bossTeam.length > 0) {
    allAllyIds.push(...state.gang.bossTeam);
  }
  for (const agent of zoneAgents) allAllyIds.push(...agent.team);
  if (allAllyIds.length === 0) {
    allAllyIds = state.pokemons
      .sort((a, b) => getPokemonPower(b) - getPokemonPower(a))
      .slice(0, 3)
      .map(p => p.id);
  }
  return allAllyIds.map(id => state.pokemons.find(p => p.id === id)).filter(Boolean);
}

function openCombatPopup(zoneId, spawnObj) {
  // Prevent opening multiple combat popups simultaneously
  if (currentCombat) return;
  const available = buildPlayerTeamForZone(zoneId);
  if (available.length === 0) {
    notify(state.lang === 'fr' ? 'Aucun Pokémon disponible !' : 'No Pokémon available!');
    return;
  }

  currentCombat = { zoneId, spawnObj, playerTeam: available };

  // Jingle d'intro de combat — désactivé temporairement
  // (() => { ... })();

  const inlineCombat = document.getElementById('battleArena');
  if (!inlineCombat) return;

  // Mark combat active — ne pas forcer l'ouverture si le log est réduit
  const logPanel = document.getElementById('battleLog');
  logPanel?.classList.add('has-combat');
  const logTitle = document.getElementById('battleLogTitle');
  const logToggle = document.getElementById('battleLogToggle');
  const zoneDef = ZONE_BY_ID[zoneId];
  if (logTitle) logTitle.textContent = `COMBAT — ${zoneDef ? (state.lang === 'fr' ? zoneDef.fr : zoneDef.en) : zoneId}`;

  const trainerName = state.lang === 'fr' ? spawnObj.trainer.fr : spawnObj.trainer.en;
  const dialogue = getTrainerDialogue();
  const isRaid = spawnObj.isRaid;

  // ── Agent at rest check
  const agentsInZone = state.agents.filter(a => a.assignedZone === zoneId);
  const agentsAtRest = agentsInZone.filter(a => {
    const avail = a.team.map(id => state.pokemons.find(p => p.id === id)).filter(Boolean);
    return a.team.length > 0 && avail.length === 0;
  });
  function proceedWithCombat() {
  // ── Ally side: group by source (Boss always included + each Agent)
  const zoneAgents = state.agents.filter(a => a.assignedZone === zoneId);

  let allyGroupsHtml = '';
  // Boss is omnipresent — always show if they have a team
  if (state.gang.bossTeam.length > 0) {
    const bossPokemons = state.gang.bossTeam
      .map(id => state.pokemons.find(p => p.id === id))
      .filter(Boolean);
    if (bossPokemons.length) {
      allyGroupsHtml += `<div class="combat-group">
        <div class="combat-group-label">${state.gang.bossName}</div>
        <div class="combat-group-pokes">${bossPokemons.map(p => renderCombatPoke(p, true)).join('')}</div>
      </div>`;
    }
  }
  for (const agent of zoneAgents) {
    const agentPokemons = agent.team
      .map(id => state.pokemons.find(p => p.id === id))
      .filter(Boolean);
    if (agentPokemons.length) {
      allyGroupsHtml += `<div class="combat-group">
        <div class="combat-group-label">${agent.name}</div>
        <div class="combat-group-pokes">${agentPokemons.map(p => renderCombatPoke(p, true)).join('')}</div>
      </div>`;
    }
  }
  if (!allyGroupsHtml) {
    allyGroupsHtml = `<div class="combat-group"><div class="combat-group-pokes">${available.slice(0, 6).map(p => renderCombatPoke(p, true)).join('')}</div></div>`;
  }

  // ── Enemy side: all Pokémon with HP bars + trainer header(s)
  let enemyHeaderHtml = '';
  if (isRaid) {
    enemyHeaderHtml = spawnObj.raidTrainers.map(rt =>
      `<img src="${trainerSprite(rt.key)}" style="width:36px;height:36px;filter:drop-shadow(0 0 4px #f44)" title="${rt.trainer.fr || rt.key}">`
    ).join('');
  } else {
    enemyHeaderHtml = `<img src="${trainerSprite(spawnObj.trainer.sprite || spawnObj.trainerKey)}" style="width:40px;height:40px${spawnObj.elite ? ';filter:drop-shadow(0 0 6px gold)' : ''}">`;
  }

  const enemyPokesHtml = spawnObj.team.map((ep, i) =>
    `<div class="combat-enemy-slot" id="combatEnemyPoke-${zoneId}-${i}">
      <img src="${pokeSprite(ep.species_en)}" style="width:${spawnObj.team.length <= 3 ? 52 : 40}px;height:${spawnObj.team.length <= 3 ? 52 : 40}px" title="${speciesName(ep.species_en)} Lv.${ep.level}">
      <div style="font-size:8px;color:var(--text-dim);text-align:center">${speciesName(ep.species_en)}</div>
      <div class="hp-bar" style="width:48px"><div class="hp-fill" id="combatEnemyHp-${zoneId}-${i}" style="width:100%"></div></div>
    </div>`
  ).join('');

  const leadAlly  = available[0];
  const leadEnemy = spawnObj.team[0];
  const fighterTrainerHtml = isRaid
    ? `<img src="${trainerSprite(spawnObj.raidTrainers[0].key)}" style="width:32px;height:32px;image-rendering:pixelated">`
    : `<img src="${trainerSprite(spawnObj.trainer.sprite || spawnObj.trainerKey)}" style="width:32px;height:32px;image-rendering:pixelated${spawnObj.elite ? ';filter:drop-shadow(0 0 4px gold)' : ''}">`;

  inlineCombat.innerHTML = `
    <div class="combat-title ${isRaid ? 'raid-title' : ''}" data-zone-combat-toggle="${zoneId}">
      ${isRaid ? '[RAID] ' : '[ATK] '}${trainerName}
      <span style="font-size:8px;color:var(--text-dim);margin-left:4px">${spawnObj.team.length} Pok.</span>
    </div>
    <div class="combat-fighters-strip" id="combatFighters-${zoneId}">
      <div class="fighter-col fighter-col-ally">
        <img src="${pokeSpriteBack(leadAlly.species_en, leadAlly.shiny)}" class="fighter-sprite" id="combatFighterAlly-${zoneId}">
        <div class="fighter-name" id="combatFighterAllyName-${zoneId}">${speciesName(leadAlly.species_en)} Lv.${leadAlly.level}</div>
      </div>
      <div class="fighter-col fighter-col-vs">
        <span class="fighter-vs-icon">⚔</span>
        ${fighterTrainerHtml}
      </div>
      <div class="fighter-col fighter-col-enemy">
        <img src="${pokeSprite(leadEnemy.species_en)}" class="fighter-sprite" id="combatFighterEnemy-${zoneId}">
        <div class="fighter-name" id="combatFighterEnemyName-${zoneId}">${speciesName(leadEnemy.species_en)} Lv.${leadEnemy.level}</div>
      </div>
    </div>
    <div class="combat-arena-full">
      <div class="combat-side ally-side">
        <div style="font-size:8px;color:var(--text-dim);margin-bottom:4px">Ton gang (${available.length})</div>
        ${allyGroupsHtml}
      </div>
      <div class="combat-vs-col">VS</div>
      <div class="combat-side enemy-side">
        <div class="combat-enemy-header">${enemyHeaderHtml}</div>
        <div class="combat-enemy-pokes">${enemyPokesHtml}</div>
      </div>
    </div>
    <div class="combat-log-inline" id="inlineLog-${zoneId}">
      <div style="color:var(--text-dim)">"${dialogue}"</div>
      ${(() => {
        if (!state.purchases?.translator) return '';
        const POKEMON_SPEECH = ['Pika pi!', 'Chu...', 'Bulba!', 'Char char!', 'Squirt!', 'Gengar~', 'Eevee?', 'Meow!'];
        const cry = pick(POKEMON_SPEECH);
        const phrase = state.lang === 'fr' ? pick(TRANSLATOR_PHRASES_FR) : null;
        const text = phrase ? `[${cry}] &rarr; "${phrase}"` : `[${cry}]`;
        return `<div style="color:var(--blue);font-size:9px;margin-top:4px">${text}</div>`;
      })()}
    </div>
    <div class="combat-actions-inline" id="inlineActions-${zoneId}">
      <span style="color:var(--text-dim);font-size:9px">Combat automatique...</span>
      <button class="inline-flee-btn" data-zone-flee="${zoneId}">Fuir</button>
    </div>
    <div class="combat-summary"></div>
  `;

  inlineCombat.classList.add('active');
  inlineCombat.classList.remove('collapsed');

  // Auto-execute combat after brief delay (flee cancels it)
  let autoCombatTimer = setTimeout(executeCombat, 600);
  inlineCombat.querySelector(`[data-zone-flee="${zoneId}"]`)?.addEventListener('click', () => {
    clearTimeout(autoCombatTimer);
    closeCombatPopup();
  });
  inlineCombat.querySelector(`[data-zone-combat-toggle="${zoneId}"]`)?.addEventListener('click', () => {
    inlineCombat.classList.toggle('collapsed');
  });
  } // end proceedWithCombat

  proceedWithCombat();
}

function renderCombatPoke(p, isBack) {
  const fn = isBack ? pokeSpriteBack : pokeSprite;
  return `<div class="combat-ally-slot" title="${speciesName(p.species_en)} Lv.${p.level} ${'★'.repeat(p.potential)}">
    <img src="${fn(p.species_en, p.shiny)}" style="width:44px;height:44px${p.shiny ? ';filter:drop-shadow(0 0 4px gold)' : ''}">
    <div class="hp-bar" style="width:40px"><div class="hp-fill" style="width:100%"></div></div>
  </div>`;
}

function executeCombat() {
  if (!currentCombat) return;
  const { zoneId, spawnObj, playerTeam } = currentCombat;
  const inlineCombat = document.getElementById('battleArena');
  if (!inlineCombat) return;

  const actionsEl = document.getElementById(`inlineActions-${zoneId}`);
  const logEl = document.getElementById(`inlineLog-${zoneId}`);
  const summary = inlineCombat.querySelector('.combat-summary');

  // Resolve trainer display name (spawnObj.trainer has .fr/.en)
  const trainerName = spawnObj.trainer
    ? (state.lang === 'fr' ? spawnObj.trainer.fr : spawnObj.trainer.en)
    : (spawnObj.trainerKey || 'Dresseur');

  // Disable buttons during animation
  if (actionsEl) actionsEl.innerHTML = `<span style="color:var(--text-dim);font-size:10px">Combat en cours...</span>`;

  // --- Simulate turn-by-turn matchups ---
  const playerQueue = [...playerTeam]; // copies
  const enemyQueue = [...spawnObj.team];
  const battleLog = [];
  let playerLosses = 0;

  let pi = 0, ei = 0;
  const matchups = [];
  while (pi < playerQueue.length && ei < enemyQueue.length) {
    const player = playerQueue[pi];
    const enemy = enemyQueue[ei];
    const pPow = getPokemonPower(player) * (0.75 + Math.random() * 0.5);
    const ePow = (enemy.stats.atk + enemy.stats.def + enemy.stats.spd) * (0.75 + Math.random() * 0.5);
    const playerWins = pPow >= ePow;
    matchups.push({ playerIdx: pi, enemyIdx: ei, playerWins, pName: speciesName(player.species_en), eName: speciesName(enemy.species_en) });
    if (playerWins) { ei++; } // enemy fainted, next enemy
    else { pi++; playerLosses++; } // player fainted, next player
  }
  const overallWin = ei >= enemyQueue.length; // all enemies beaten

  // --- Animate matchups sequentially ---
  const spawnWithZone = { ...spawnObj, zoneId };
  const teamIds = playerTeam.map(p => p.id);

  let prevEnemyIdx = -1;
  let step = 0;
  function animateStep() {
    if (step < matchups.length) {
      const m = matchups[step];
      const pSlots = inlineCombat.querySelectorAll('.combat-ally-slot');
      const eSlot = document.getElementById(`combatEnemyPoke-${zoneId}-${m.enemyIdx}`);
      const eHp   = document.getElementById(`combatEnemyHp-${zoneId}-${m.enemyIdx}`);

      // Fighters strip
      const fAlly      = document.getElementById(`combatFighterAlly-${zoneId}`);
      const fEnemy     = document.getElementById(`combatFighterEnemy-${zoneId}`);
      const fAllyName  = document.getElementById(`combatFighterAllyName-${zoneId}`);
      const fEnemyName = document.getElementById(`combatFighterEnemyName-${zoneId}`);
      const curAlly    = playerQueue[m.playerIdx];
      const curEnemy   = enemyQueue[m.enemyIdx];

      if (fAlly  && curAlly)  { fAlly.src  = pokeSpriteBack(curAlly.species_en, curAlly.shiny);  fAlly.classList.add('fighter-active'); }
      if (fEnemy && curEnemy) { fEnemy.src  = pokeSprite(curEnemy.species_en);                    fEnemy.classList.add('fighter-active'); }
      if (fAllyName  && curAlly)  fAllyName.textContent  = `${speciesName(curAlly.species_en)} Lv.${curAlly.level}`;
      if (fEnemyName && curEnemy) fEnemyName.textContent = `${speciesName(curEnemy.species_en)} Lv.${curEnemy.level}`;

      // Highlight active combatants
      pSlots.forEach((s, i) => s.style.opacity = i === m.playerIdx ? '1' : '0.4');
      if (eSlot) eSlot.style.outline = '2px solid var(--red)';

      // "Trainer sends X!" when enemy changes
      if (m.enemyIdx !== prevEnemyIdx) {
        prevEnemyIdx = m.enemyIdx;
        if (logEl) logEl.innerHTML += `<div style="color:var(--text-dim);font-style:italic">→ ${trainerName} envoie <b style="color:var(--text)">${speciesName(curEnemy.species_en)}</b> !</div>`;
      }

      // Attack line with move name
      const moveName = (curAlly?.moves?.length ? curAlly.moves[Math.floor(Math.random() * curAlly.moves.length)] : null) || 'Attaque';
      if (logEl) logEl.innerHTML += `<div style="color:var(--text-dim);font-size:9px">${speciesName(curAlly.species_en)} utilise <b>${moveName}</b>...</div>`;
      logEl?.scrollTo(0, logEl.scrollHeight);

      setTimeout(() => {
        if (m.playerWins && eHp) {
          eHp.style.width = '0%';
          eHp.classList.add('critical');
          eSlot?.querySelector('img')?.classList.add('shake');
          if (logEl) logEl.innerHTML += `<div style="color:var(--green)">✓ <b>${speciesName(curEnemy.species_en)}</b> est mis K.O. !</div>`;
        } else {
          const pSlot = pSlots[m.playerIdx];
          if (pSlot) {
            pSlot.querySelector('.hp-fill') && (pSlot.querySelector('.hp-fill').style.width = '0%');
            pSlot.querySelector('.hp-fill')?.classList.add('critical');
            pSlot.classList.add('shake');
          }
          if (logEl) logEl.innerHTML += `<div style="color:var(--red)">✗ <b>${speciesName(curAlly.species_en)}</b> est K.O. !</div>`;
        }
        logEl?.scrollTo(0, logEl.scrollHeight);
        step++;
        setTimeout(animateStep, 600);
      }, 500);
    } else {
      // Animation done — apply result
      const reward = overallWin ? Math.min(MAX_COMBAT_REWARD, randInt(spawnWithZone.trainer.reward[0], spawnWithZone.trainer.reward[1])) : 0;
      const repGain = getCombatRepGain(spawnWithZone.trainerKey || spawnWithZone.trainer?.sprite, overallWin);
      applyCombatResult({ win: overallWin, reward, repGain }, teamIds, spawnWithZone);
      // Log to battle log panel
      const zoneDef = ZONE_BY_ID[zoneId];
      const zName = zoneDef ? (state.lang === 'fr' ? zoneDef.fr : zoneDef.en) : zoneId;
      addBattleLogEntry({
        ts: Date.now(),
        zoneName: zName,
        trainerName: spawnWithZone.trainer?.fr || spawnWithZone.trainerKey || '?',
        trainerKey: spawnWithZone.trainerKey || spawnWithZone.trainer?.sprite || null,
        allySpecies: playerQueue[0]?.species_en || null,
        allyLevel: playerQueue[0]?.level || null,
        enemySpecies: enemyQueue[0]?.species_en || null,
        enemyLevel: enemyQueue[0]?.level || null,
        win: overallWin,
        reward,
        repGain,
        lines: matchups.map(m => m.playerWins ? `${m.pName} bat ${m.eName}` : `${m.pName} KO`),
      });
      if (overallWin) {
        const z = state.zones[zoneId];
        if (z) z.combatsWon = (z.combatsWon || 0) + 1;
        if (logEl) logEl.innerHTML += `<div style="color:var(--gold);font-weight:bold">VICTOIRE ! ₽ accumulés · +${repGain} rep</div>`;
        if (summary) summary.innerHTML = `<span style="color:var(--gold)">₽ accumulés · +${repGain} rep</span>`;
      } else {
        if (logEl) logEl.innerHTML += `<div style="color:var(--red)">Defaite...</div>`;
        if (summary) summary.innerHTML = `<span style="color:var(--red)">Defaite</span>`;
      }
      // Flash loser sprite in fighters strip
      if (!overallWin) {
        document.getElementById(`combatFighterAlly-${zoneId}`)?.classList.add('fighter-ko');
      } else {
        document.getElementById(`combatFighterEnemy-${zoneId}`)?.classList.add('fighter-ko');
      }

      if (actionsEl) actionsEl.innerHTML = `<span style="color:var(--text-dim);font-size:9px;font-family:var(--font-pixel)">Fermeture...</span>`;
      logEl?.scrollTo(0, logEl.scrollHeight);

      // Auto-close after 3.5s
      setTimeout(() => {
        if (inlineCombat) inlineCombat.classList.remove('active');
        removeSpawn(zoneId, spawnObj.id);
        updateTopBar();
        currentCombat = null;
        if (activeTab === 'tabGang') renderGangTab();
      }, 3500);
    }
  }
  animateStep();
}

function closeCombatPopup() {
  const arena = document.getElementById('battleArena');
  if (arena) {
    arena.classList.remove('active');
    arena.innerHTML = '';
  }
  const logPanel = document.getElementById('battleLog');
  logPanel?.classList.remove('has-combat');
  const logTitle = document.getElementById('battleLogTitle');
  if (logTitle) logTitle.textContent = 'LOG COMBATS';
  currentCombat = null;
}

// ════════════════════════════════════════════════════════════════
// 15b. UI — COSMETICS TAB (panel dédié, débloquable 50 000₽)
// ════════════════════════════════════════════════════════════════

const COSMETICS_UNLOCK_COST = 50000;

function renderCosmeticsTab() {
  const tab = document.getElementById('tabCosmetics');
  if (!tab) return;

  const unlocked = state.purchases?.cosmeticsPanel;

  if (!unlocked) {
    // ── Panneau verrouillé — visible avec bouton d'achat ─────────
    tab.innerHTML = `
      <div class="cosm-tab-locked">
        <div class="cosm-tab-locked-inner">
          <div class="cosm-lock-icon">🎨</div>
          <div class="cosm-lock-title">ATELIER COSMÉTIQUES</div>
          <div class="cosm-lock-desc">Personnalise le fond d'écran, renomme ton Boss et tes Agents, change leurs sprites.</div>
          <div class="cosm-lock-preview">
            ${Object.entries(COSMETIC_BGS).slice(0,4).map(([,c]) =>
              `<div class="cosm-lock-preview-tile" style="background-image:url('${c.url}');background-size:cover;background-position:center"></div>`
            ).join('')}
          </div>
          <button id="btnUnlockCosmetics" class="cosm-unlock-btn">
            🔓 Débloquer — ${COSMETICS_UNLOCK_COST.toLocaleString()}₽
          </button>
          <div class="cosm-lock-balance" id="cosmLockBalance">
            Solde : ${(state.gang.money || 0).toLocaleString()}₽
          </div>
        </div>
      </div>`;

    tab.querySelector('#btnUnlockCosmetics')?.addEventListener('click', () => {
      if (state.gang.money < COSMETICS_UNLOCK_COST) {
        notify('Fonds insuffisants.', 'error');
        SFX.play('error')
        return;
      }
      showConfirm(`Débloquer l'Atelier Cosmétiques pour ${COSMETICS_UNLOCK_COST.toLocaleString()}₽ ?`, () => {
        state.gang.money -= COSMETICS_UNLOCK_COST;
        state.purchases.cosmeticsPanel = true;
        saveState();
        updateTopBar();
        SFX.play('unlock');
        notify('🎨 Atelier Cosmétiques débloqué !', 'gold');
        renderCosmeticsTab();
      });
    });
    return;
  }

  // ── Panneau débloqué ─────────────────────────────────────────
  const container = document.createElement('div');
  container.className = 'cosm-tab-content';
  tab.innerHTML = '';
  tab.appendChild(container);
  renderCosmeticsPanel(container);
}

// ════════════════════════════════════════════════════════════════
// 16.  UI — MARKET TAB
// ════════════════════════════════════════════════════════════════

function renderMarketTab() {
  renderQuestPanel();
  renderShopPanel();
  renderBarterPanel();
}

// ── Troc d'objets ─────────────────────────────────────────────
const BARTER_RECIPES = [
  // [donnerItemId, donnerQty, recevoirItemId, recevoirQty, label]
  ['pokeball',  10, 'greatball',  1,   '10 Poké Balls → 1 Super Ball'],
  ['greatball', 10, 'ultraball',  1,   '10 Super Balls → 1 Hyper Ball'],
  // index 2 = MB ⇄ HB (bidirectionnel — voir _barterMbReverse)
  ['ultraball', 100, 'masterball', 1,  '100 Hyper Balls → 1 Master Ball'],
  ['lure',       5, 'superlure',  1,   '5 Leurres → 1 Super Leurre'],
  ['superlure',  3, 'evostone',   1,   '3 Super Leurres → 1 Pierre Évol.'],
  ['rarecandy',  3, 'evostone',   1,   '3 Super Bonbons → 1 Pierre Évol.'],
  ['incense',    3, 'aura',       1,   '3 Encens → 1 Aura Shiny'],
  ['potion',    10, 'rarecandy',  1,   '10 Potions → 1 Super Bonbon'],
];

// Sens du troc MB ⇄ HB (false = 100 HB→1 MB ; true = 1 MB→100 HB)
let _barterMbReverse = false;

function renderBarterPanel() {
  const panel = document.querySelector('#barterPanel .barter-list');
  if (!panel) return;

  // Recette active pour le troc MB (index 2), sens selon _barterMbReverse
  const mbRecipe = _barterMbReverse
    ? ['masterball', 1,   'ultraball', 100, '1 Master Ball → 100 Hyper Balls']
    : ['ultraball',  100, 'masterball', 1,  '100 Hyper Balls → 1 Master Ball'];
  const recipes = [...BARTER_RECIPES];
  recipes[2] = mbRecipe;

  // Bouton toggle sens MB en tête de panel
  const toggleBtn = `<div style="padding:6px 4px 4px;border-bottom:1px solid var(--border)">
    <button id="btnBarterMbToggle" style="font-family:var(--font-pixel);font-size:7px;padding:4px 10px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">
      ⇄ ${_barterMbReverse ? 'MB → 100 HB' : '100 HB → MB'}
    </button>
  </div>`;

  // ── Recettes d'items classiques ────────────────────────────────
  const recipesHtml = recipes.map((r, i) => {
    const [giveId, giveQty, getId, getQty, label] = r;
    const owned = state.inventory?.[giveId] || 0;
    const canAfford = owned >= giveQty;
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid var(--border);opacity:${canAfford ? 1 : 0.5}">
      ${itemSprite(giveId)}
      <div style="flex:1;font-size:9px;color:var(--text)">${label}</div>
      <div style="font-size:8px;color:${canAfford ? 'var(--gold-dim)' : 'var(--text-dim)'}">×${owned}</div>
      <button data-barter="${i}" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:${canAfford ? 'var(--bg-hover)' : 'var(--bg)'};border:1px solid ${canAfford ? 'var(--gold-dim)' : 'var(--border)'};border-radius:var(--radius-sm);color:${canAfford ? 'var(--gold)' : 'var(--text-dim)'};cursor:${canAfford ? 'pointer' : 'default'}" ${canAfford ? '' : 'disabled'}>Troquer</button>
    </div>`;
  }).join('');

  // ── Section déblocage zones via ailes ──────────────────────────
  const WING_PERMITS = [
    { permitId:'tourbillon_permit', wingId:'silver_wing', wingName:"Argent'Aile",  wingQty:50,
      zoneName:'Îles Tourbillon', icon:'🌊', legendary:'Lugia' },
    { permitId:'carillon_permit',   wingId:'rainbow_wing', wingName:"Arcenci'Aile", wingQty:50,
      zoneName:'Tour Carillon',   icon:'🔔', legendary:'Ho-Oh' },
  ];
  const wingZonesHtml = `
    <div style="padding:8px 4px 4px;border-top:2px solid var(--border);margin-top:2px">
      <div style="font-family:var(--font-pixel);font-size:8px;color:var(--gold);margin-bottom:6px;letter-spacing:1px">— ZONES LÉGENDAIRES —</div>
      ${WING_PERMITS.map(wp => {
        const have = state.inventory?.[wp.wingId] || 0;
        const alreadyOwned = !!state.purchases?.[wp.permitId];
        const canBuy = !alreadyOwned && have >= wp.wingQty;
        const pct = Math.min(100, Math.round(have / wp.wingQty * 100));
        const progressColor = alreadyOwned ? 'var(--green)' : have >= wp.wingQty ? 'var(--gold)' : 'var(--red)';
        return `<div style="display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid var(--border);opacity:${alreadyOwned ? 0.6 : 1}">
          ${itemSprite(wp.wingId)}
          <div style="flex:1">
            <div style="font-size:9px;color:var(--text)">${wp.wingQty}× ${wp.wingName} → ${wp.icon} ${wp.zoneName}</div>
            <div style="font-size:8px;color:var(--text-dim);margin-top:2px">Légendaire : ${wp.legendary}</div>
            <div style="height:4px;background:var(--border);border-radius:2px;margin-top:4px;overflow:hidden">
              <div style="height:100%;width:${alreadyOwned ? 100 : pct}%;background:${progressColor};border-radius:2px;transition:width .3s"></div>
            </div>
            <div style="font-size:8px;color:${progressColor};margin-top:2px">${alreadyOwned ? '✓ Zone débloquée' : `${have} / ${wp.wingQty} ${wp.wingName}`}</div>
          </div>
          <button data-wing-permit="${wp.permitId}" style="font-family:var(--font-pixel);font-size:7px;padding:3px 8px;background:${canBuy ? 'var(--bg-hover)' : 'var(--bg)'};border:1px solid ${canBuy ? 'var(--gold-dim)' : 'var(--border)'};border-radius:var(--radius-sm);color:${alreadyOwned ? 'var(--green)' : canBuy ? 'var(--gold)' : 'var(--text-dim)'};cursor:${canBuy ? 'pointer' : 'default'}" ${canBuy ? '' : 'disabled'}>${alreadyOwned ? 'Acquis' : 'Échanger'}</button>
        </div>`;
      }).join('')}
    </div>`;

  panel.innerHTML = toggleBtn + recipesHtml + wingZonesHtml;

  document.getElementById('btnBarterMbToggle')?.addEventListener('click', () => {
    _barterMbReverse = !_barterMbReverse;
    renderBarterPanel();
  });

  panel.querySelectorAll('[data-barter]').forEach(btn => {
    btn.addEventListener('click', () => {
      const [giveId, giveQty, getId, getQty] = recipes[parseInt(btn.dataset.barter)];
      if ((state.inventory?.[giveId] || 0) < giveQty) { SFX.play('error'); return; }
      state.inventory[giveId] -= giveQty;
      state.inventory[getId] = (state.inventory[getId] || 0) + getQty;
      saveState(); updateTopBar(); SFX.play('buy');
      notify(`Troc effectué !`, 'success');
      renderBarterPanel();
    });
  });

  panel.querySelectorAll('[data-wing-permit]').forEach(btn => {
    btn.addEventListener('click', () => {
      const permitId = btn.dataset.wingPermit;
      const itemDef = SHOP_ITEMS.find(s => s.id === permitId);
      if (!itemDef) return;
      if (buyItem(itemDef)) {
        SFX.play('buy');
        renderBarterPanel();
        renderShopPanel();
        if (activeTab === 'tabZones') renderZonesTab();
      }
    });
  });
}

// ── Quest Panel (replaces sell panel) ────────────────────────────
function renderQuestPanel() {
  const panel = document.querySelector('#questPanel .quest-list');
  if (!panel) return;
  initMissions();
  initHourlyQuests();

  // ── Helper: build a classic mission section ──────────────────
  function buildSection(title, timer, missions) {
    if (missions.length === 0) return '';
    let html = `<div class="quest-section-title">${title}${timer ? `<span class="quest-timer">${timer}</span>` : ''}</div>`;
    for (const m of missions) {
      const progress = getMissionProgress(m);
      const complete  = isMissionComplete(m);
      const claimed   = isMissionClaimed(m);
      const pct = Math.min(100, (progress / m.target) * 100);
      const name = state.lang === 'fr' ? m.fr : m.en;
      const rewardStr = [m.reward.money ? m.reward.money.toLocaleString() + '₽' : '', m.reward.rep ? '+' + m.reward.rep + ' rep' : ''].filter(Boolean).join('  ');
      const fillColor = complete ? 'var(--green)' : 'var(--red)';
      html += `<div class="quest-entry${claimed ? ' claimed' : ''}">
        <span class="quest-icon">${m.icon}</span>
        <div class="quest-body">
          <div class="quest-name${claimed ? ' done' : ''}">${name}</div>
          ${m.desc_fr ? `<div class="quest-desc">${state.lang === 'fr' ? m.desc_fr : m.desc_en}</div>` : ''}
          <div class="quest-progress-bar"><div class="quest-progress-fill" style="width:${pct}%;background:${fillColor}"></div></div>
          <div class="quest-reward">${progress}/${m.target}${rewardStr ? '  —  ' + rewardStr : ''}</div>
        </div>
        ${complete && !claimed
          ? `<button class="btn-claim-quest" data-mission-id="${m.id}">Réclamer</button>`
          : claimed ? '<span style="font-size:12px;color:var(--green)">✓</span>' : ''}
      </div>`;
    }
    return html;
  }

  // ── Hourly section ────────────────────────────────────────────
  const hourlyRem = Math.max(0, HOUR_MS - (Date.now() - state.missions.hourly.reset));
  const hMin = Math.floor(hourlyRem / 60000);
  const hSec = Math.floor((hourlyRem % 60000) / 1000);
  const hourlyCountdown = `${hMin}m${String(hSec).padStart(2,'0')}s`;

  let hourlyHtml = `<div class="quest-section-title">Quêtes Horaires <span class="quest-timer">${hourlyCountdown}</span></div>`;
  for (let i = 0; i < 5; i++) {
    const q = getHourlyQuest(i);
    if (!q) continue;
    const progress = getHourlyProgress(q);
    const complete  = isHourlyComplete(q);
    const claimed   = isHourlyClaimed(i);
    const pct = Math.min(100, (progress / q.target) * 100);
    const rewardStr = [q.reward.money ? q.reward.money.toLocaleString() + '₽' : '', q.reward.rep ? '+' + q.reward.rep + ' rep' : ''].filter(Boolean).join('  ');
    const diffColor = q.diff === 'hard' ? 'var(--red)' : 'var(--blue)';
    const fillColor = complete ? 'var(--green)' : diffColor;
    hourlyHtml += `<div class="quest-entry${claimed ? ' claimed' : ''}" style="border-left:3px solid ${diffColor};padding-left:6px">
      <span class="quest-icon">${q.icon}</span>
      <div class="quest-body">
        <div class="quest-name${claimed ? ' done' : ''}" style="display:flex;align-items:center;gap:5px">
          ${q.fr}
          <span style="font-size:7px;padding:1px 4px;border-radius:3px;background:${diffColor};color:#fff;font-family:var(--font-pixel)">${q.diff === 'hard' ? 'HARD' : 'MED'}</span>
        </div>
        <div class="quest-progress-bar"><div class="quest-progress-fill" style="width:${pct}%;background:${fillColor}"></div></div>
        <div class="quest-reward">${progress}/${q.target}  —  ${rewardStr}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
        ${complete && !claimed
          ? `<button class="btn-claim-quest btn-claim-hourly" data-slot="${i}">Réclamer</button>`
          : claimed ? '<span style="font-size:12px;color:var(--green)">✓</span>' : ''}
        ${!claimed ? `<button class="btn-reroll-hourly" data-slot="${i}" title="Reroll (-${HOURLY_QUEST_REROLL_COST}₽)" style="font-size:7px;padding:3px 6px;background:var(--bg);border:1px solid var(--border);border-radius:3px;color:var(--text-dim);cursor:pointer">↻ ${HOURLY_QUEST_REROLL_COST}₽</button>` : ''}
      </div>
    </div>`;
  }

  // ── Regular missions ──────────────────────────────────────────
  const story   = MISSIONS.filter(m => m.type === 'story' && !isMissionClaimed(m));
  const done    = MISSIONS.filter(m => m.type === 'story' &&  isMissionClaimed(m));

  panel.innerHTML = hourlyHtml +
    buildSection('Histoire & Objectifs', '', story) +
    (done.length ? buildSection('Terminées ✓', '', done) : '');

  // Bind buttons
  panel.querySelectorAll('.btn-claim-quest').forEach(btn => {
    btn.addEventListener('click', () => {
      const m = MISSIONS.find(m => m.id === btn.dataset.missionId);
      if (m) { claimMission(m); renderQuestPanel(); }
    });
  });
  panel.querySelectorAll('.btn-claim-hourly').forEach(btn => {
    btn.addEventListener('click', () => {
      claimHourlyQuest(parseInt(btn.dataset.slot));
      renderQuestPanel();
    });
  });
  panel.querySelectorAll('.btn-reroll-hourly').forEach(btn => {
    btn.addEventListener('click', () => {
      rerollHourlyQuest(parseInt(btn.dataset.slot));
      renderQuestPanel();
    });
  });
}

let shopMultiplier = 1; // ×1, ×5, ×10

function renderShopPanel() {
  const panel = document.querySelector('#shopPanel .shop-list');
  if (!panel) return;

  const ZONE_UNLOCK_ITEM_IDS = new Set(['map_pallet','casino_ticket','silph_keycard','boat_ticket','tourbillon_permit','carillon_permit']);
  const ONE_OFF_IDS = new Set(['mysteryegg','incubator','translator','map_pallet','casino_ticket','silph_keycard','boat_ticket','tourbillon_permit','carillon_permit']);
  const WING_PERMIT_IDS = new Set(['tourbillon_permit','carillon_permit']);

  // ── Multiplier toolbar ─────────────────────────────────────────
  const multBar = [1,5,10].map(m =>
    `<button class="shop-mult-btn" data-mult="${m}" style="font-family:var(--font-pixel);font-size:9px;padding:4px 10px;border-radius:var(--radius-sm);cursor:pointer;
      background:${shopMultiplier===m?'var(--gold-dim)':'var(--bg)'};
      border:1px solid ${shopMultiplier===m?'var(--gold)':'var(--border)'};
      color:${shopMultiplier===m?'#0a0a0a':'var(--text)'}"
    >×${m}</button>`
  ).join('');

  // ── Shop items ─────────────────────────────────────────────────
  const itemsHtml = SHOP_ITEMS.map(item => {
    const ballInfo = BALLS[item.id];
    const name = ballInfo ? (state.lang === 'fr' ? ballInfo.fr : ballInfo.en) : (state.lang === 'fr' ? (item.fr || item.id) : (item.en || item.id));
    const owned = state.inventory[item.id] || 0;
    const isOneOff = ONE_OFF_IDS.has(item.id);
    const mult = isOneOff ? 1 : shopMultiplier;
    const baseCost = item.id === 'mysteryegg' ? getMysteryEggCost()
      : item.id === 'incubator' ? Math.round(15000 * Math.pow(2, owned))
      : item.cost;
    const totalCost = baseCost * mult;
    const totalQty  = item.qty * mult;
    const isUnlockItem = ZONE_UNLOCK_ITEM_IDS.has(item.id);
    const alreadyOwned = isUnlockItem && state.purchases?.[item.id];
    const incubatorMaxed = item.id === 'incubator' && owned >= 10;
    const desc = item.desc_fr
      ? (state.lang === 'fr' ? item.desc_fr : item.desc_en)
      : `×${totalQty}`;
    const isWingPermit = WING_PERMIT_IDS.has(item.id);
    const wingHave = isWingPermit ? (state.inventory[item.wingCost?.item] || 0) : 0;
    const wingName = isWingPermit
      ? (item.wingCost?.item === 'silver_wing' ? "Argent'Aile" : "Arcenci'Aile")
      : '';
    const extraInfo = item.id === 'mysteryegg'
      ? `<div style="font-size:9px;color:var(--text-dim)">Achat #${(state.purchases?.mysteryEggCount||0)+1} — 45min éclosion</div>`
      : item.id === 'incubator'
        ? `<div style="font-size:10px;color:var(--text-dim)">Possédés: ${owned}/10${incubatorMaxed ? ' <span style="color:var(--red)">MAX</span>' : ''}</div>`
        : isWingPermit
          ? `<div style="font-size:10px;color:${alreadyOwned?'var(--green)':wingHave>=(item.wingCost?.qty||50)?'var(--gold)':'var(--red)'}">
              ${alreadyOwned ? '✓ Possédé' : `${wingName} : ${wingHave}/${item.wingCost?.qty||50}`}
             </div>`
          : isUnlockItem
            ? `<div style="font-size:10px;color:${alreadyOwned?'var(--green)':'var(--text-dim)'}"> ${alreadyOwned ? '✓ Possédé' : 'Débloque une zone'}</div>`
            : `<div style="font-size:10px;color:var(--text-dim)">Stock: ${owned}${!isOneOff && mult>1 ? ` (+${totalQty})` : ''}</div>`;
    const btnDisabled = alreadyOwned || incubatorMaxed || (isWingPermit && wingHave < (item.wingCost?.qty || 50));
    const btnLabel = (alreadyOwned || incubatorMaxed)
      ? (incubatorMaxed ? 'MAX' : 'Acquis')
      : isWingPermit
        ? `${item.wingCost?.qty||50}× ${wingName}`
        : `${totalCost.toLocaleString()}₽${mult>1&&!isOneOff ? ` ×${mult}` : ''}`;
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px 4px;border-bottom:1px solid var(--border);opacity:${btnDisabled?'0.6':'1'}">
      ${itemSprite(item.id)}
      <div style="flex:1">
        <div style="font-size:12px">${name} <span style="color:var(--text-dim)">(${desc})</span></div>
        ${extraInfo}
      </div>
      <button style="font-family:var(--font-pixel);font-size:9px;padding:6px 10px;background:var(--bg);
        border:1px solid ${btnDisabled?'var(--border)':'var(--gold-dim)'};border-radius:var(--radius-sm);
        color:${btnDisabled?'var(--text-dim)':'var(--gold)'};cursor:${btnDisabled?'default':'pointer'};white-space:nowrap"
        data-shop-idx="${SHOP_ITEMS.indexOf(item)}" data-shop-mult="${mult}" ${btnDisabled?'disabled':''}>${btnLabel}</button>
    </div>`;
  }).join('');

  // ── Active ball selector ───────────────────────────────────────
  const ballSel = `
    <div style="padding:10px 4px;border-top:2px solid var(--border);margin-top:4px">
      <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold);margin-bottom:8px">— BALL ACTIVE —</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${Object.entries(BALLS).map(([key, ball]) => `
          <button data-ball="${key}" style="font-size:10px;padding:4px 10px;border-radius:var(--radius-sm);cursor:pointer;
            background:${state.activeBall===key?'var(--red-dark)':'var(--bg)'};
            border:1px solid ${state.activeBall===key?'var(--red)':'var(--border)'};color:var(--text)">
            ${state.lang==='fr'?ball.fr:ball.en} (${state.inventory[key]||0})
          </button>`).join('')}
      </div>
    </div>`;

  panel.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px;padding:6px 4px 8px;border-bottom:1px solid var(--border)">
      <span style="font-family:var(--font-pixel);font-size:8px;color:var(--text-dim)">Quantité :</span>
      ${multBar}
    </div>
    ${itemsHtml}${ballSel}`;

  // ── Bind events ────────────────────────────────────────────────
  panel.querySelectorAll('.shop-mult-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      shopMultiplier = parseInt(btn.dataset.mult);
      renderShopPanel();
    });
  });
  panel.querySelectorAll('[data-shop-idx]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = SHOP_ITEMS[parseInt(btn.dataset.shopIdx)];
      const mult = parseInt(btn.dataset.shopMult) || 1;
      if (!item || btn.disabled) return;
      for (let i = 0; i < mult; i++) {
        if (!buyItem(item)) break;
      }
      updateTopBar();
      renderShopPanel();
      if (activeTab === 'tabZones') renderZoneWindows();
    });
  });
  panel.querySelectorAll('[data-ball]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeBall = btn.dataset.ball;
      saveState();
      renderShopPanel();
    });
  });
}

// ════════════════════════════════════════════════════════════════
// 17.  UI — PC TAB
// ════════════════════════════════════════════════════════════════

let pcSelectedId = null;
let pcSelectedIds = new Set(); // Ctrl+click multi-selection
let pcPage = 0;
const PC_PAGE_SIZE = 36;
let pcGridCols = 6;   // colonnes de la grille (configurable)
let pcGridRows = 6;   // lignes par page (configurable)
let pcGroupMode = false; // regroupement par espèce
let pcGroupSpecies = null; // espèce sélectionnée en mode groupe

// ── Filter PC to a specific species (from detail panel or Pokédex) ──
function filterPCBySpecies(species_en) {
  switchTab('tabPC');
  const searchEl = document.getElementById('pcSearch');
  if (searchEl) searchEl.value = speciesName(species_en);
  pcGroupMode = false;
  pcGroupSpecies = null;
  pcPage = 0;
  _pcLastRenderKey = '';
  renderPCTab();
}

// ── Context Menu ──────────────────────────────────────────────
let ctxMenu = null;
function showContextMenu(x, y, items) {
  closeContextMenu();
  ctxMenu = document.createElement('div');
  ctxMenu.id = 'ctxMenu';
  ctxMenu.style.cssText = `position:fixed;left:${x}px;top:${y}px;background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius-sm);z-index:9000;min-width:150px;box-shadow:0 4px 12px rgba(0,0,0,.5);overflow:hidden`;
  ctxMenu.innerHTML = items.filter(it => it !== '---').map(it =>
    `<div class="ctx-item" data-action="${it.action}" style="padding:8px 14px;font-size:11px;cursor:pointer;white-space:nowrap">${it.label}</div>`
  ).join('');
  document.body.appendChild(ctxMenu);
  const actionMap = {};
  items.forEach(it => { if (it !== '---' && it.action) actionMap[it.action] = it.fn; });
  ctxMenu.querySelectorAll('.ctx-item').forEach(el => {
    el.addEventListener('mouseenter', () => el.style.background = 'rgba(255,255,255,.07)');
    el.addEventListener('mouseleave', () => el.style.background = '');
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const fn = actionMap[el.dataset.action];
      if (fn) fn();
      closeContextMenu();
    });
  });
  requestAnimationFrame(() => {
    if (!ctxMenu) return;
    const r = ctxMenu.getBoundingClientRect();
    if (r.right > window.innerWidth) ctxMenu.style.left = (x - r.width) + 'px';
    if (r.bottom > window.innerHeight) ctxMenu.style.top = (y - r.height) + 'px';
  });
  setTimeout(() => document.addEventListener('click', closeContextMenu, { once: true }), 0);
}
function closeContextMenu() {
  ctxMenu?.remove();
  ctxMenu = null;
}

// ── Battle Log ────────────────────────────────────────────────
const battleLogEntries = [];
const BATTLE_LOG_MAX = 50;

function addBattleLogEntry(entry) {
  battleLogEntries.unshift(entry);
  if (battleLogEntries.length > BATTLE_LOG_MAX) battleLogEntries.pop();
  renderBattleLog();
}

function renderBattleLog() {
  const history = document.getElementById('battleHistory');
  if (!history) return;
  if (battleLogEntries.length === 0) {
    history.innerHTML = '<div style="color:var(--text-dim);padding:8px;text-align:center;font-size:9px">Aucun combat enregistré</div>';
    return;
  }
  history.innerHTML = battleLogEntries.map((e, i) => {
    const time = new Date(e.ts).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const resultColor = e.win ? 'var(--green)' : 'var(--red)';
    const resultText = e.win ? `+${e.reward}₽ +${e.repGain}rep` : 'Défaite';
    return `<div class="battle-log-entry" data-log-idx="${i}">
      <div class="battle-log-summary" style="display:flex;gap:4px;align-items:center">
        <span style="color:var(--text-dim);font-size:9px">${time}</span>
        <span style="flex:1;font-size:9px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${e.zoneName}</span>
        <span style="color:${resultColor};font-size:9px;white-space:nowrap">${resultText}</span>
        <span style="color:var(--text-dim);font-size:8px">›</span>
      </div>
      <div class="battle-log-detail">${(e.lines || []).map(l => `<div>${l}</div>`).join('')}</div>
    </div>`;
  }).join('');
  history.querySelectorAll('.battle-log-entry').forEach(el => {
    el.addEventListener('click', () => el.classList.toggle('expanded'));
  });
  updateBattleLogMiniSprites();
}

// Show mini pokemon/trainer sprites in the battle log header when collapsed
function updateBattleLogMiniSprites() {
  const logPanel = document.getElementById('battleLog');
  const logTitle = document.getElementById('battleLogTitle');
  // If battle log is now a tab, mini sprites aren't needed
  if (!logTitle) return;
  if (!logPanel) return;

  const isCollapsed = logPanel.classList.contains('battle-log-collapsed');
  let miniEl = document.getElementById('battleLogMiniSprites');

  if (!isCollapsed) {
    if (miniEl) miniEl.remove();
    return;
  }

  // Build mini sprites from recent battle log entries
  const recentEntries = battleLogEntries.slice(0, 5);
  if (recentEntries.length === 0) {
    if (miniEl) miniEl.remove();
    return;
  }

  if (!miniEl) {
    miniEl = document.createElement('div');
    miniEl.id = 'battleLogMiniSprites';
    miniEl.className = 'battle-log-mini-sprites';
    logTitle.after(miniEl);
  }

  miniEl.innerHTML = recentEntries.map(e => {
    const sprites = [];
    // Add trainer sprite if available
    if (e.trainerKey) {
      sprites.push(`<img src="${trainerSprite(e.trainerKey)}" title="${e.trainerName || e.trainerKey}" onerror="this.style.display='none'">`);
    }
    // Add pokemon sprites from the fight (ally and enemy)
    if (e.allySpecies) sprites.push(`<span style="display:inline-flex;flex-direction:column;align-items:center;gap:0"><img src="${pokeSprite(e.allySpecies)}" title="${e.allySpecies}">${e.allyLevel ? `<span style="font-size:6px;color:var(--text-dim);line-height:1">Lv.${e.allyLevel}</span>` : ''}</span>`);
    if (e.enemySpecies) sprites.push(`<span style="display:inline-flex;flex-direction:column;align-items:center;gap:0"><img src="${pokeSprite(e.enemySpecies)}" title="${e.enemySpecies}">${e.enemyLevel ? `<span style="font-size:6px;color:var(--red);line-height:1">Lv.${e.enemyLevel}</span>` : ''}</span>`);
    return sprites.join('');
  }).join('<span style="color:var(--border);margin:0 2px">|</span>');
}

function renderPCTab() {
  // Inject view switcher if not present
  const pcLayout = document.querySelector('#tabPC .pc-layout');
  if (pcLayout) {
    let switcher = document.getElementById('pcViewSwitcher');
    if (!switcher) {
      switcher = document.createElement('div');
      switcher.id = 'pcViewSwitcher';
      switcher.className = 'pc-view-switcher';
      switcher.innerHTML = `
        <button class="pc-view-btn" id="pcBtnGrid" data-pcview="grid">[PC]</button>
        <button class="pc-view-btn" id="pcBtnTraining" data-pcview="training">[FORMATION]</button>
        <button class="pc-view-btn" id="pcBtnLab" data-pcview="lab">[LABO]</button>
        <button class="pc-view-btn" id="pcBtnPension" data-pcview="pension">[PENSION]</button>
        <button class="pc-view-btn" id="pcBtnEggs" data-pcview="eggs">[OEUFS${state.eggs.length ? ` (${state.eggs.length})` : ''}]</button>`;
      pcLayout.parentNode.insertBefore(switcher, pcLayout);
      switcher.querySelectorAll('.pc-view-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          pcView = btn.dataset.pcview;
          renderPCTab();
        });
      });
    }
    // Update active state + eggs count (always refresh)
    switcher.querySelectorAll('.pc-view-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.pcview === pcView);
    });
    const eggsBtn = switcher.querySelector('#pcBtnEggs');
    if (eggsBtn) eggsBtn.textContent = `[OEUFS${state.eggs.length ? ` (${state.eggs.length})` : ''}]`;

    const subViews = ['trainingInPC', 'labInPC', 'pensionInPC', 'eggsInPC'];
    if (pcView === 'training') {
      pcLayout.style.display = 'none';
      subViews.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = id === 'trainingInPC' ? '' : 'none'; });
      let trainingInPC = document.getElementById('trainingInPC');
      if (!trainingInPC) {
        trainingInPC = document.createElement('div');
        trainingInPC.id = 'trainingInPC';
        pcLayout.parentNode.appendChild(trainingInPC);
      }
      trainingInPC.style.display = '';
      renderTrainingTab();
      return;
    } else if (pcView === 'lab') {
      pcLayout.style.display = 'none';
      subViews.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = id === 'labInPC' ? '' : 'none'; });
      let labInPC = document.getElementById('labInPC');
      if (!labInPC) {
        labInPC = document.createElement('div');
        labInPC.id = 'labInPC';
        pcLayout.parentNode.appendChild(labInPC);
      }
      labInPC.style.display = '';
      renderLabTabInEl(labInPC);
      return;
    } else if (pcView === 'pension') {
      pcLayout.style.display = 'none';
      subViews.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = id === 'pensionInPC' ? '' : 'none'; });
      let pensionInPC = document.getElementById('pensionInPC');
      if (!pensionInPC) {
        pensionInPC = document.createElement('div');
        pensionInPC.id = 'pensionInPC';
        pcLayout.parentNode.appendChild(pensionInPC);
      }
      pensionInPC.style.display = '';
      renderPensionView(pensionInPC);
      return;
    } else if (pcView === 'eggs') {
      pcLayout.style.display = 'none';
      subViews.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = id === 'eggsInPC' ? '' : 'none'; });
      let eggsInPC = document.getElementById('eggsInPC');
      if (!eggsInPC) {
        eggsInPC = document.createElement('div');
        eggsInPC.id = 'eggsInPC';
        pcLayout.parentNode.appendChild(eggsInPC);
      }
      eggsInPC.style.display = '';
      renderEggsView(eggsInPC);
      return;
    } else {
      pcLayout.style.display = '';
      subViews.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    }
  }

  // ── Barre d'outils PC (grille + groupement) ───────────────────
  let pcToolbar = document.getElementById('pcToolbar');
  const pcGrid = document.getElementById('pokemonGrid');
  if (!pcToolbar && pcGrid) {
    pcToolbar = document.createElement('div');
    pcToolbar.id = 'pcToolbar';
    pcGrid.parentNode.insertBefore(pcToolbar, pcGrid);
  }
  if (pcToolbar) {
    pcToolbar.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 0 4px 2px;flex-wrap:wrap';
    pcToolbar.innerHTML = `
      <span style="font-family:var(--font-pixel);font-size:7px;color:var(--text-dim)">Grille:</span>
      <select id="pcColsSel" style="font-size:9px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;padding:2px 4px">
        <option value="4" ${pcGridCols===4?'selected':''}>4 col</option>
        <option value="6" ${pcGridCols===6?'selected':''}>6 col</option>
        <option value="8" ${pcGridCols===8?'selected':''}>8 col</option>
        <option value="10" ${pcGridCols===10?'selected':''}>10 col</option>
      </select>
      <select id="pcRowsSel" style="font-size:9px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;padding:2px 4px">
        <option value="4" ${pcGridRows===4?'selected':''}>4 lg</option>
        <option value="6" ${pcGridRows===6?'selected':''}>6 lg</option>
        <option value="8" ${pcGridRows===8?'selected':''}>8 lg</option>
      </select>
      <label style="display:flex;align-items:center;gap:4px;font-family:var(--font-pixel);font-size:8px;color:var(--text-dim);cursor:pointer;user-select:none">
        <input type="checkbox" id="pcGroupChk" ${pcGroupMode?'checked':''} style="accent-color:var(--gold)">
        Grouper
      </label>`;
    document.getElementById('pcColsSel')?.addEventListener('change', e => {
      pcGridCols = parseInt(e.target.value); pcPage = 0; renderPokemonGrid(true);
    });
    document.getElementById('pcRowsSel')?.addEventListener('change', e => {
      pcGridRows = parseInt(e.target.value); pcPage = 0; renderPokemonGrid(true);
    });
    document.getElementById('pcGroupChk')?.addEventListener('change', e => {
      pcGroupMode = e.target.checked;
      pcGroupSpecies = null; pcPage = 0;
      renderPokemonGrid(true); renderPokemonDetail();
    });
  }

  renderPokemonGrid();
  renderPokemonDetail();
}

// Auto-incubation — Infirmière Joëlle corrompue
function tryAutoIncubate() {
  if (!state.purchases?.autoIncubator) return;
  if (state.purchases?.autoIncubatorEnabled === false) return; // en congé
  const incubatorCount = state.inventory?.incubator || 0;
  if (incubatorCount === 0) return;
  const eggs = state.eggs || [];
  let changed = false;
  for (const egg of eggs) {
    if (egg.incubating) continue;
    const incubatingNow = eggs.filter(e => e.incubating).length;
    if (incubatingNow >= incubatorCount) break;
    egg.incubating = true;
    egg.incubatedAt = Date.now();
    egg.hatchAt = Date.now() + (egg.hatchMs || 2700000);
    changed = true;
  }
  if (changed) { saveState(); notify('💉 Joëlle a mis un oeuf en incubation !', 'success'); }
}

function hatchEgg(eggId) {
  const egg = state.eggs.find(e => e.id === eggId);
  if (!egg) return;

  // Always hatch as the lowest evolution stage (Dodrio → Doduo, etc.)
  const baseEn  = getBaseSpecies(egg.species_en);
  const hatched = makePokemon(baseEn, 'pension', 'pokeball');
  if (!hatched) { state.eggs = state.eggs.filter(e => e.id !== eggId); saveState(); renderPCTab(); return; }

  hatched.level = 1; hatched.xp = 0;
  hatched.potential = egg.potential;
  hatched.shiny     = egg.shiny;
  hatched.stats     = calculateStats(hatched);
  hatched.history   = [{ type: 'hatched', ts: Date.now() }];

  state.eggs = state.eggs.filter(e => e.id !== eggId);
  state.pokemons.push(hatched);
  state.stats.totalCaught++;
  state.stats.eggsHatched = (state.stats.eggsHatched || 0) + 1;
  if (!state.pokedex[baseEn]) {
    state.pokedex[baseEn] = { seen: true, caught: true, shiny: egg.shiny, count: 1 };
  } else {
    state.pokedex[baseEn].caught = true;
    state.pokedex[baseEn].count++;
    if (egg.shiny) state.pokedex[baseEn].shiny = true;
  }
  saveState();

  // ── Animation popup ─────────────────────────────────────────────
  const eggUrl = ITEM_SPRITE_URLS.mysteryegg;
  const pkUrl  = pokeSprite(baseEn, egg.shiny);
  const name   = speciesName(baseEn);
  const stars  = '★'.repeat(hatched.potential || 0);

  const modal = document.createElement('div');
  modal.id = 'hatchModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9400;background:rgba(0,0,0,.95);display:flex;align-items:center;justify-content:center;';
  modal.innerHTML = `
    <style>
      @keyframes _eggWobble {
        0%,100%{transform:rotate(0deg)}
        20%{transform:rotate(-9deg)}
        40%{transform:rotate(9deg)}
        60%{transform:rotate(-5deg)}
        80%{transform:rotate(5deg)}
      }
      @keyframes _eggCrack {
        0%{transform:scale(1);opacity:1}
        50%{transform:scale(1.2);opacity:.8}
        100%{transform:scale(0) rotate(20deg);opacity:0}
      }
      @keyframes _pkReveal {
        0%{transform:scale(0) translateY(16px);opacity:0}
        65%{transform:scale(1.15) translateY(-4px);opacity:1}
        100%{transform:scale(1) translateY(0);opacity:1}
      }
      #_hatchEgg { animation:_eggWobble .55s ease-in-out infinite; image-rendering:pixelated; }
      #_hatchEgg.cracking { animation:_eggCrack .45s ease-in forwards; }
      #_hatchPk { display:none; animation:_pkReveal .5s cubic-bezier(.17,.67,.37,1.3) forwards; image-rendering:pixelated; }
      #_hatchPk.visible { display:block; }
    </style>
    <div style="background:var(--bg-panel);border:2px solid var(--gold);border-radius:var(--radius);padding:32px 28px;max-width:300px;width:90%;display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center">
      <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold);letter-spacing:.1em">✦ ÉCLOSION ✦</div>
      <div style="position:relative;width:88px;height:88px;display:flex;align-items:center;justify-content:center">
        <img id="_hatchEgg" src="${eggUrl}" style="width:64px;height:64px">
        <img id="_hatchPk"  src="${pkUrl}"  style="width:88px;height:88px;position:absolute;inset:0;${egg.shiny ? 'filter:drop-shadow(0 0 8px gold)' : ''}">
      </div>
      <div id="_hatchInfo" style="opacity:0;transition:opacity .4s;display:flex;flex-direction:column;gap:6px">
        <div style="font-family:var(--font-pixel);font-size:12px;${egg.shiny ? 'color:gold' : 'color:var(--text)'}">${egg.shiny ? '✨ SHINY !  ' : ''}${name}</div>
        <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold)">Lv. 1 &nbsp; ${stars}</div>
      </div>
      <button id="_hatchClose" style="font-family:var(--font-pixel);font-size:8px;padding:6px 22px;background:var(--bg);border:1px solid var(--gold);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer;opacity:0;pointer-events:none;transition:opacity .3s">OK !</button>
    </div>`;
  document.body.appendChild(modal);

  // Wobble 2.4s → crack → reveal pokemon
  setTimeout(() => document.getElementById('_hatchEgg')?.classList.add('cracking'), 2400);
  setTimeout(() => {
    const eggEl = document.getElementById('_hatchEgg');
    const pkEl  = document.getElementById('_hatchPk');
    const info  = document.getElementById('_hatchInfo');
    const btn   = document.getElementById('_hatchClose');
    if (eggEl) eggEl.style.display = 'none';
    if (pkEl)  pkEl.classList.add('visible');
    if (info)  info.style.opacity  = '1';
    if (btn)   { btn.style.opacity = '1'; btn.style.pointerEvents = 'auto'; }
    SFX.play?.('unlock');
  }, 3000);

  document.getElementById('_hatchClose').addEventListener('click', () => {
    modal.remove();
    updateTopBar();
    renderPCTab();
  });
}

function renderEggsView(container) {
  const eggs = state.eggs || [];
  const incubatorCount = state.inventory?.incubator || 0;
  const incubatingCount = eggs.filter(e => e.incubating).length;
  const freeIncubators = incubatorCount - incubatingCount;

  if (eggs.length === 0) {
    container.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-dim);font-family:var(--font-pixel);font-size:10px">Aucun oeuf pour le moment.<br><br>Utilise la <b style="color:var(--text)">Pension</b> ou achète un <b style="color:var(--text)">Oeuf Mystère</b> au Marché.</div>`;
    return;
  }

  const now = Date.now();
  container.innerHTML = `
    <div style="display:flex;flex-wrap:wrap;gap:12px;padding:8px">
      ${eggs.map(egg => {
        const isIncubating = egg.incubating;
        const isReady = isIncubating && egg.hatchAt && egg.hatchAt <= now;
        const timeLeft = isIncubating && egg.hatchAt ? Math.max(0, Math.ceil((egg.hatchAt - now) / 60000)) : null;
        const progress = isIncubating && egg.hatchAt && egg.incubatedAt
          ? Math.min(100, Math.round((now - egg.incubatedAt) / (egg.hatchAt - egg.incubatedAt) * 100))
          : 0;

        // Parents info
        let parentHtml = '';
        if (egg.parentA && egg.parentB) {
          const pA = state.pokemons.find(p => p.id === egg.parentA) || { species_en: egg.parentASpecies };
          const pB = state.pokemons.find(p => p.id === egg.parentB) || { species_en: egg.parentBSpecies };
          const pAName = pA?.species_en ? speciesName(pA.species_en) : '?';
          const pBName = pB?.species_en ? speciesName(pB.species_en) : '?';
          const pALvl = pA?.level ? ` Lv.${pA.level}` : '';
          const pBLvl = pB?.level ? ` Lv.${pB.level}` : '';
          const pAPot = pA?.potential ? ' ' + '★'.repeat(pA.potential) : '';
          const pBPot = pB?.potential ? ' ' + '★'.repeat(pB.potential) : '';
          parentHtml = `<div style="display:flex;flex-direction:column;gap:3px;margin-top:4px;align-items:center">
            <div style="display:flex;align-items:center;gap:4px">
              ${pA?.species_en ? `<img src="${pokeSprite(pA.species_en)}" style="width:22px;height:22px" title="${pAName}${pALvl}${pAPot}">` : ''}
              <span style="font-size:9px;color:var(--red)">♥</span>
              ${pB?.species_en ? `<img src="${pokeSprite(pB.species_en)}" style="width:22px;height:22px" title="${pBName}${pBLvl}${pBPot}">` : ''}
            </div>
            <div style="font-size:7px;color:var(--text-dim);text-align:center">${pAName}${pAPot} × ${pBName}${pBPot}</div>
          </div>`;
        } else if (egg.source) {
          parentHtml = `<div style="font-size:8px;color:var(--text-dim);margin-top:4px">${egg.source}</div>`;
        } else {
          parentHtml = `<div style="font-size:8px;color:var(--text-dim);margin-top:4px">Mystère</div>`;
        }

        const statusColor = isReady ? 'var(--green)' : isIncubating ? 'var(--gold)' : 'var(--text-dim)';
        const statusText = isReady
          ? '✅ Prêt à éclore !'
          : isIncubating ? `🥚 ${timeLeft}min restantes`
          : '⏳ En attente d\'incubateur';

        return `<div style="background:var(--bg-card);border:1px solid ${isReady ? 'var(--green)' : 'var(--border)'};border-radius:var(--radius);padding:10px;min-width:130px;max-width:150px;display:flex;flex-direction:column;align-items:center;gap:6px;${isReady ? 'box-shadow:0 0 8px rgba(68,187,85,.3)' : ''}">
          <div style="font-size:28px">${isReady ? '🐣' : '🥚'}</div>
          ${parentHtml}
          <div style="font-size:8px;color:${statusColor};text-align:center;font-family:var(--font-pixel);line-height:1.4">${statusText}</div>
          ${isIncubating && !isReady ? `
            <div style="width:100%;height:4px;background:var(--bg);border-radius:2px;overflow:hidden">
              <div style="height:100%;width:${progress}%;background:var(--gold);transition:width .5s"></div>
            </div>` : ''}
          <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:center">
            ${isReady ? `<button class="egg-hatch-btn" data-egg-id="${egg.id}" style="font-family:var(--font-pixel);font-size:7px;padding:4px 8px;background:var(--green);border:none;border-radius:var(--radius-sm);color:#000;cursor:pointer">Éclore !</button>` : ''}
            ${!isIncubating && freeIncubators > 0 ? `<button class="egg-incubate-btn" data-egg-id="${egg.id}" style="font-family:var(--font-pixel);font-size:7px;padding:4px 8px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">Incuber</button>` : ''}
            ${!isIncubating && incubatorCount > 0 && freeIncubators === 0 ? `<span style="font-family:var(--font-pixel);font-size:7px;color:var(--text-dim)">Incubateurs pleins</span>` : ''}
            ${!isIncubating && incubatorCount === 0 ? `<span style="font-family:var(--font-pixel);font-size:7px;color:var(--text-dim)">Aucun incubateur</span>` : ''}
            <button class="egg-sell-btn" data-egg-id="${egg.id}" style="font-family:var(--font-pixel);font-size:7px;padding:4px 8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">Vendre</button>
            ${!egg.scanned && (state.inventory?.egg_scanner || 0) > 0
              ? `<button class="egg-scan-btn" data-egg-id="${egg.id}" style="font-family:var(--font-pixel);font-size:7px;padding:4px 8px;background:var(--bg);border:1px solid #c05be0;border-radius:var(--radius-sm);color:#c05be0;cursor:pointer">🔬 Scanner</button>`
              : ''}
            ${egg.scanned && egg.revealedSpecies
              ? `<div style="font-size:8px;color:#c05be0;text-align:center;font-family:var(--font-pixel)">🔬 ${speciesName(egg.revealedSpecies)}</div>`
              : egg.scanned && !egg.revealedSpecies
              ? `<div style="font-size:8px;color:#666;text-align:center">🔬 Inconnu…</div>`
              : ''}
          </div>
        </div>`;
      }).join('')}
    </div>`;

  // Bind buttons
  container.querySelectorAll('.egg-hatch-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const egg = state.eggs.find(e => e.id === btn.dataset.eggId);
      if (egg) hatchEgg(egg.id);
      renderPCTab();
    });
  });
  container.querySelectorAll('.egg-incubate-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const egg = state.eggs.find(e => e.id === btn.dataset.eggId);
      if (!egg) return;
      egg.incubating = true;
      egg.incubatedAt = Date.now();
      egg.hatchAt = Date.now() + (egg.hatchMs || 2700000); // 45min default
      saveState();
      renderPCTab();
      notify('Oeuf mis en incubation !', 'success');
    });
  });
  container.querySelectorAll('.egg-sell-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const egg = state.eggs.find(e => e.id === btn.dataset.eggId);
      if (!egg) return;
      const price = egg.sellPrice || 500;
      showConfirm(
        `Vendre cet oeuf pour <strong style="color:var(--gold)">${price.toLocaleString()}₽</strong> ?<br><span style="color:var(--text-dim);font-size:11px">Tu ne sauras jamais quel Pokémon était dedans.</span>`,
        () => {
          state.eggs = state.eggs.filter(e => e.id !== egg.id);
          state.gang.money += price;
          saveState();
          renderPCTab();
          notify(`Oeuf vendu — ${price}₽`, 'gold');
        },
        null,
        { confirmLabel: 'Vendre', cancelLabel: 'Garder', danger: true }
      );
    });
  });
  container.querySelectorAll('.egg-scan-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const egg = state.eggs.find(e => e.id === btn.dataset.eggId);
      if (!egg || egg.scanned) return;
      if ((state.inventory.egg_scanner || 0) < 1) { notify('Aucun Scanneur d\'Oeuf disponible.', 'error'); return; }
      // Roll d100: 1-89 = reveal (scanner survives), 90-99 = scanner détruit, 100 = oeuf détruit
      const roll = Math.random() * 100;
      if (roll < 89) {
        egg.revealedSpecies = egg.species_en;
        egg.scanned = true;
        notify(`🔬 Scan réussi ! C'est un ${speciesName(egg.species_en)} !`, 'gold');
      } else if (roll < 99) {
        state.inventory.egg_scanner--;
        egg.scanned = true;
        egg.revealedSpecies = null;
        notify('🔬 Scanneur détruit dans l\'opération… Espèce inconnue.', 'error');
      } else {
        state.inventory.egg_scanner--;
        const idx = state.eggs.indexOf(egg);
        if (idx !== -1) state.eggs.splice(idx, 1);
        notify('💥 L\'oeuf a été détruit par le scan défectueux !', 'error');
        saveState();
        const eggsEl = document.getElementById('eggsInPC');
        if (eggsEl) renderEggsView(eggsEl);
        return;
      }
      saveState();
      const eggsEl = document.getElementById('eggsInPC');
      if (eggsEl) renderEggsView(eggsEl);
    });
  });
}

// ── PC grid helpers ──────────────────────────────────────────────────────────

function _buildPCCard(p, teamIds, trainingIds, pensionIds) {
  const inTeam = teamIds.has(p.id);
  const inTraining = trainingIds.has(p.id);
  const inPension = pensionIds ? pensionIds.has(p.id) : false;
  return `<div class="pc-pokemon ${p.shiny ? 'shiny' : ''} ${pcSelectedId === p.id ? 'selected' : ''} ${pcSelectedIds.has(p.id) ? 'multi-selected' : ''} ${inTeam ? 'in-team' : ''} ${inTraining ? 'in-training' : ''}" data-pk-id="${p.id}" title="${speciesName(p.species_en)} Lv.${p.level} ${'★'.repeat(p.potential)}${p.shiny ? ' ✨' : ''}${inTraining ? ' [ENTRAINEMENT]' : ''}${inPension ? ' [PENSION]' : ''}">
    <img src="${pokeSprite(p.species_en, p.shiny)}" alt="${speciesName(p.species_en)}">
    ${p.favorite ? '<div class="pc-fav-badge">FAV</div>' : ''}
    ${inTeam ? '<div class="pc-team-badge">EQ</div>' : ''}
    ${inTraining ? '<div class="pc-training-badge">TR</div>' : ''}
    ${inPension ? '<div class="pc-pension-badge">PS</div>' : ''}
  </div>`;
}

function _bindPCCardListeners(el) {
  el.addEventListener('click', (e) => {
    if (e.ctrlKey || e.metaKey) {
      // Ctrl+Click : basculer la multi-sélection sans rebuild complet
      const id = el.dataset.pkId;
      if (pcSelectedIds.has(id)) {
        pcSelectedIds.delete(id);
        el.classList.remove('multi-selected');
      } else {
        pcSelectedIds.add(id);
        el.classList.add('multi-selected');
      }
      renderPokemonDetail();
    } else {
      // Clic normal : effacer la multi-sélection, sélectionner ce Pokémon
      if (pcSelectedIds.size > 0) {
        pcSelectedIds.clear();
        document.querySelectorAll('.pc-pokemon.multi-selected').forEach(c => c.classList.remove('multi-selected'));
      }
      pcSelectedId = el.dataset.pkId;
      renderPCTab();
    }
  });
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const pId = el.dataset.pkId;
    const pk = state.pokemons.find(p => p.id === pId);
    if (!pk) return;
    const price = calculatePrice(pk);
    const inTeam = state.gang.bossTeam.includes(pk.id) || state.agents.some(a => a.team.includes(pk.id));
    const hasCandy = (state.inventory.rarecandy || 0) > 0;
    showContextMenu(e.clientX, e.clientY, [
      { action:'sell', label:`Vendre (${price}₽)${pk.shiny ? ' ✨' : ''}`, fn: () => {
        if (pk.shiny) {
          showConfirm(`<span style="color:gold">✨ CHROMATIQUE !</span><br>Vendre <b>${speciesName(pk.species_en)}</b> pour <b>${price.toLocaleString()}₽</b> ?<br><span style="color:var(--text-dim);font-size:11px">Cette action est irréversible.</span>`,
            () => { sellPokemon([pk.id]); renderPCTab(); updateTopBar(); },
            null, { confirmLabel: 'Vendre', cancelLabel: 'Garder', danger: true });
        } else { sellPokemon([pk.id]); renderPCTab(); updateTopBar(); }
      }},
      inTeam
        ? { action:'unteam', label:'Retirer de l\'equipe', fn: () => { state.gang.bossTeam = state.gang.bossTeam.filter(id => id !== pk.id); state.agents.forEach(a => { a.team = a.team.filter(id => id !== pk.id); }); saveState(); renderPCTab(); } }
        : { action:'team', label:'Attribuer a...', fn: () => { openAssignToPicker(pk.id); } },
      { action:'candy', label:`Super Bonbon${hasCandy ? '' : ' (aucun)'}`, fn: () => { if (!hasCandy) return; state.inventory.rarecandy--; if (pk.level < 100) { pk.level++; pk.xp = 0; pk.stats = calculateStats(pk); tryAutoEvolution(pk); } saveState(); notify(`🍬 ${speciesName(pk.species_en)} → Lv.${pk.level}`, 'gold'); renderPCTab(); updateTopBar(); } },
      { action:'fav', label: pk.favorite ? 'Retirer favori' : 'Ajouter favori', fn: () => { pk.favorite = !pk.favorite; saveState(); renderPCTab(); } },
    ]);
  });
}

function renderPokemonGrid(forceRebuild = false) {
  const grid = document.getElementById('pokemonGrid');
  if (!grid) return;

  let list = [...state.pokemons];

  // Search filter
  const search = document.getElementById('pcSearch')?.value?.toLowerCase() || '';
  if (search) list = list.filter(p => speciesName(p.species_en).toLowerCase().includes(search) || p.species_en.includes(search));

  // Filter
  const filter = document.getElementById('pcFilter')?.value || 'all';
  if (filter === 'shiny') list = list.filter(p => p.shiny);
  else if (filter === 'fav') list = list.filter(p => p.favorite);
  else if (filter === 'team') {
    const tIds = new Set([...state.gang.bossTeam]);
    for (const a of state.agents) a.team.forEach(id => tIds.add(id));
    list = list.filter(p => tIds.has(p.id));
  }
  else if (filter.startsWith('pot')) list = list.filter(p => p.potential === parseInt(filter.replace('pot', '')));
  else if (filter === 'pension') {
    const psIds = new Set([state.pension?.slotA, state.pension?.slotB].filter(Boolean));
    list = list.filter(p => psIds.has(p.id));
  }
  else if (filter === 'training') list = list.filter(p => state.trainingRoom?.pokemon?.includes(p.id));

  // Sort
  const sort = document.getElementById('pcSort')?.value || 'recent';
  switch (sort) {
    case 'id':        list.sort((a, b) => a.dex - b.dex); break;
    case 'name':      list.sort((a, b) => speciesName(a.species_en).localeCompare(speciesName(b.species_en))); break;
    case 'cp':        list.sort((a, b) => getPokemonPower(b) - getPokemonPower(a)); break;
    case 'potential': list.sort((a, b) => (b.potential + (b.shiny ? 10 : 0)) - (a.potential + (a.shiny ? 10 : 0))); break;
    case 'level':     list.sort((a, b) => b.level - a.level); break;
    case 'species':   list.sort((a, b) => a.dex - b.dex || (b.potential - a.potential)); break;
    case 'price':     list.sort((a, b) => calculatePrice(b) - calculatePrice(a)); break;
    case 'recent':    break;
  }
  if (filter !== 'fav') list.sort((a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0));

  const pageSize = pcGroupMode ? list.length : (pcGridCols * pcGridRows);
  const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
  if (pcPage >= totalPages) pcPage = totalPages - 1;
  const pageList = list.slice(pcPage * pageSize, (pcPage + 1) * pageSize);

  const pagination = document.getElementById('pcPagination');
  const teamIds = new Set([...state.gang.bossTeam]);
  for (const a of state.agents) a.team.forEach(id => teamIds.add(id));
  const trainingIds = new Set(state.trainingRoom.pokemon);
  const pensionIds = new Set([state.pension?.slotA, state.pension?.slotB].filter(Boolean));

  // Render key: rebuild on any change (list length catches sells/releases, species catches evolutions)
  const speciesHash = list.slice(pcPage * pageSize, (pcPage + 1) * pageSize).map(p => p.species_en + p.level).join(',').length;
  const renderKey = `${search}|${filter}|${sort}|${pcPage}|${totalPages}|${list.length}|${speciesHash}|${pcGroupMode}|${pcGridCols}|${pcGroupSpecies}`;
  const needsRebuild = forceRebuild || renderKey !== _pcLastRenderKey;

  if (needsRebuild) {
    _pcLastRenderKey = renderKey;

    // Apply dynamic grid columns
    grid.style.gridTemplateColumns = `repeat(${pcGridCols}, 1fr)`;

    // Pagination (hidden in group mode)
    if (pagination) {
      pagination.innerHTML = (pcGroupMode || totalPages <= 1) ? '' :
        `<button class="pc-page-btn" id="pcPrev" ${pcPage === 0 ? 'disabled' : ''}>&lt;</button>
         <span style="font-size:9px;color:var(--text-dim)">${pcPage + 1} / ${totalPages} (${list.length})</span>
         <button class="pc-page-btn" id="pcNext" ${pcPage >= totalPages - 1 ? 'disabled' : ''}>&gt;</button>`;
      pagination.querySelector('#pcPrev')?.addEventListener('click', () => { pcPage--; renderPokemonGrid(true); });
      pagination.querySelector('#pcNext')?.addEventListener('click', () => { pcPage++; renderPokemonGrid(true); });
    }

    if (pcGroupMode) {
      // ── Mode regroupement : une carte par espèce ──────────────
      const groups = {};
      for (const p of list) {
        if (!groups[p.species_en]) groups[p.species_en] = [];
        groups[p.species_en].push(p);
      }
      const sortedGroups = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
      grid.innerHTML = sortedGroups.map(([species, pks]) => {
        const maxPot = Math.max(...pks.map(p => p.potential));
        const maxLvl = Math.max(...pks.map(p => p.level));
        const hasShiny = pks.some(p => p.shiny);
        const hasFav   = pks.some(p => p.favorite);
        const isSelected = pcGroupSpecies === species;
        return `<div class="pc-group-card${isSelected ? ' selected' : ''}" data-group-species="${species}"
          style="position:relative;cursor:pointer;padding:4px 2px;border-radius:var(--radius-sm);
          border:2px solid ${isSelected ? 'var(--gold)' : 'var(--border)'};
          background:var(--bg-card);text-align:center;transition:border-color .15s;overflow:hidden">
          <img src="${pokeSprite(species, hasShiny)}" style="width:48px;height:48px;${hasShiny ? 'filter:drop-shadow(0 0 4px gold)' : ''}">
          <div style="font-size:7px;font-family:var(--font-pixel);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 2px">${speciesName(species)}</div>
          <div style="font-size:8px;color:var(--gold)">×${pks.length}</div>
          <div style="font-size:6px;color:var(--text-dim)">${'★'.repeat(maxPot)} Lv.${maxLvl}</div>
          ${hasFav  ? '<div style="position:absolute;top:2px;right:2px;font-size:9px;line-height:1">⭐</div>' : ''}
          ${hasShiny ? '<div style="position:absolute;top:2px;left:2px;font-size:9px;line-height:1">✨</div>' : ''}
        </div>`;
      }).join('') || '<div style="color:var(--text-dim);padding:16px;grid-column:1/-1;text-align:center">Aucun Pokémon</div>';

      grid.querySelectorAll('.pc-group-card').forEach(el => {
        el.addEventListener('click', () => {
          pcGroupSpecies = el.dataset.groupSpecies;
          renderPokemonGrid(true);
          renderPokemonDetailGroup(pcGroupSpecies);
        });
      });

    } else {
      // ── Mode normal : une carte par Pokémon ───────────────────
      grid.innerHTML = pageList.map(p => _buildPCCard(p, teamIds, trainingIds, pensionIds)).join('')
        || '<div style="color:var(--text-dim);padding:16px;grid-column:1/-1;text-align:center">Aucun Pokémon</div>';
      grid.querySelectorAll('.pc-pokemon').forEach(el => _bindPCCardListeners(el));
    }

  } else {
    // Soft update: append new cards, sync classes — no full rebuild
    if (!pcGroupMode) {
      const existingIds = new Set([...grid.querySelectorAll('.pc-pokemon')].map(el => el.dataset.pkId));
      let added = 0;
      for (const p of pageList) {
        if (!existingIds.has(p.id)) {
          const wrap = document.createElement('div');
          wrap.innerHTML = _buildPCCard(p, teamIds, trainingIds, pensionIds);
          const card = wrap.firstElementChild;
          if (card) { grid.appendChild(card); _bindPCCardListeners(card); added++; }
        }
      }
      grid.querySelectorAll('.pc-pokemon').forEach(el => {
        el.classList.toggle('selected', el.dataset.pkId === pcSelectedId);
        el.classList.toggle('multi-selected', pcSelectedIds.has(el.dataset.pkId));
      });
      if (added > 0 && pagination) {
        const countEl = pagination.querySelector('span');
        if (countEl) countEl.textContent = `${pcPage + 1} / ${totalPages} (${list.length})`;
      }
    }
  }
}

function renderPotentialUpgradePanel(p) {
  if (p.potential >= 5) return '';
  const teamIds = new Set([...state.gang.bossTeam]);
  for (const a of state.agents) a.team.forEach(id => teamIds.add(id));
  const cost = POT_UPGRADE_COSTS[p.potential - 1];
  const donors = state.pokemons.filter(d =>
    d.species_en === p.species_en && d.id !== p.id &&
    !d.shiny && d.potential <= p.potential &&
    !teamIds.has(d.id) && !state.trainingRoom.pokemon?.includes(d.id)
  );
  const canUpgrade = donors.length >= cost;
  return `<div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border)">
    <div style="font-size:9px;color:var(--text-dim);margin-bottom:6px">MUTATION DE POTENTIEL</div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <div style="font-size:10px;flex:1">
        ${'*'.repeat(p.potential)} <span style="color:var(--text-dim)">→</span> ${'*'.repeat(p.potential + 1)}
        <span style="font-size:9px;color:${canUpgrade ? 'var(--green)' : 'var(--red)'}"> (${donors.length}/${cost} specimens)</span>
      </div>
    </div>
    <button id="btnPotUpgrade" style="width:100%;font-size:9px;padding:5px;background:var(--bg);border:1px solid ${canUpgrade ? 'var(--gold)' : 'var(--border)'};border-radius:var(--radius-sm);color:${canUpgrade ? 'var(--gold)' : 'var(--text-dim)'};cursor:${canUpgrade ? 'pointer' : 'default'}"${canUpgrade ? '' : ' disabled'}>
      ${canUpgrade ? 'MUTER LE POTENTIEL' : 'Pas assez de specimens'}
    </button>
  </div>`;
}

function renderEvolutionPanel(p) {
  const evos = EVO_BY_SPECIES[p.species_en];
  if (!evos || evos.length === 0) return '';
  let html = '<div style="margin-top:12px;padding-top:8px;border-top:1px solid var(--border)">';
  html += '<div style="font-size:10px;color:var(--text-dim);margin-bottom:6px">' + (state.lang === 'fr' ? 'Évolution' : 'Evolution') + '</div>';
  for (const evo of evos) {
    const targetSp = SPECIES_BY_EN[evo.to];
    if (!targetSp) continue;
    const targetName = state.lang === 'fr' ? targetSp.fr : evo.to;
    if (evo.req === 'item') {
      const hasStone = (state.inventory.evostone || 0) > 0;
      html += '<div style="display:flex;align-items:center;gap:8px;margin-top:6px">'
        + '<img src="' + pokeSprite(evo.to) + '" style="width:32px;height:32px;opacity:' + (hasStone ? 1 : 0.4) + '">'
        + '<div style="flex:1;font-size:10px">' + targetName + '</div>'
        + '<button class="btn-evolve-item" data-evo-target="' + evo.to + '" style="font-size:9px;padding:4px 10px;background:' + (hasStone ? 'var(--gold-dim)' : 'var(--bg)') + ';border:1px solid ' + (hasStone ? 'var(--gold)' : 'var(--border)') + ';border-radius:var(--radius-sm);color:' + (hasStone ? 'var(--bg)' : 'var(--text-dim)') + ';cursor:' + (hasStone ? 'pointer' : 'default') + '"' + (hasStone ? '' : ' disabled') + '>💎 ' + (state.lang === 'fr' ? 'Évoluer' : 'Evolve') + '</button>'
        + '</div>';
    } else {
      const ready = p.level >= evo.req;
      html += '<div style="display:flex;align-items:center;gap:8px;margin-top:6px">'
        + '<img src="' + pokeSprite(evo.to) + '" style="width:32px;height:32px;opacity:' + (ready ? 1 : 0.4) + '">'
        + '<div style="flex:1;font-size:10px">' + targetName + ' (Lv.' + evo.req + ')</div>';
      if (ready) {
        html += '<button class="btn-evolve-level" data-evo-target="' + evo.to + '" style="font-size:9px;padding:4px 10px;background:var(--green);border:1px solid var(--green);border-radius:var(--radius-sm);color:var(--bg);cursor:pointer">' + (state.lang === 'fr' ? 'Évoluer!' : 'Evolve!') + '</button>';
      } else {
        html += '<span style="font-size:9px;color:var(--text-dim)">Lv.' + p.level + '/' + evo.req + '</span>';
      }
      html += '</div>';
    }
  }
  html += '</div>';
  return html;
}

function renderPokemonDetail() {
  const panel = document.getElementById('pokemonDetail');
  if (!panel) return;

  // ── Mode groupe ───────────────────────────────────────────────
  if (pcGroupMode && pcGroupSpecies) {
    renderPokemonDetailGroup(pcGroupSpecies);
    return;
  }

  // ── Multi-sélection ───────────────────────────────────────────
  if (pcSelectedIds.size > 1) {
    panel.classList.remove('hidden');
    const pks = [...pcSelectedIds].map(id => state.pokemons.find(p => p.id === id)).filter(Boolean);
    const tIds = new Set([...state.gang.bossTeam]);
    for (const a of state.agents) a.team.forEach(id => tIds.add(id));
    const sellable = pks.filter(pk => !pk.favorite && !tIds.has(pk.id));
    const totalValue = sellable.reduce((s, pk) => s + calculatePrice(pk), 0);
    panel.innerHTML = `
      <div style="text-align:center;padding:14px;font-family:var(--font-pixel)">
        <div style="font-size:12px;color:var(--gold);margin-bottom:8px">${pks.length} sélectionnés</div>
        <div style="font-size:8px;color:var(--text-dim);margin-bottom:12px">Ctrl+Clic pour ajouter/retirer</div>
        <div style="display:flex;flex-wrap:wrap;gap:3px;justify-content:center;margin-bottom:12px">
          ${pks.slice(0, 15).map(pk => `<img src="${pokeSprite(pk.species_en, pk.shiny)}" style="width:30px;height:30px;${pk.shiny ? 'filter:drop-shadow(0 0 4px gold)' : ''}">`).join('')}
          ${pks.length > 15 ? `<div style="font-size:9px;color:var(--text-dim);align-self:center">+${pks.length - 15}</div>` : ''}
        </div>
        ${sellable.length > 0 ? `
          <div style="font-size:9px;color:var(--text-dim);margin-bottom:10px">${sellable.length} vendables — <span style="color:var(--gold)">${totalValue.toLocaleString()}₽</span></div>
          <button id="btnSellMulti" style="width:100%;font-family:var(--font-pixel);font-size:9px;padding:8px;background:var(--red-dark);border:1px solid var(--red);border-radius:var(--radius-sm);color:var(--text);cursor:pointer;margin-bottom:6px">
            Vendre ${sellable.length} Pokémon (${totalValue.toLocaleString()}₽)
          </button>` : ''}
        <button id="btnClearMulti" style="width:100%;font-family:var(--font-pixel);font-size:9px;padding:6px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">
          Annuler la sélection
        </button>
      </div>`;
    document.getElementById('btnSellMulti')?.addEventListener('click', () => {
      const ids = sellable.map(pk => pk.id);
      showConfirm(`Vendre <b>${ids.length}</b> Pokémon pour <b style="color:var(--gold)">${totalValue.toLocaleString()}₽</b> ?`, () => {
        sellPokemon(ids);
        pcSelectedIds.clear();
        _pcLastRenderKey = '';
        updateTopBar(); renderPCTab();
      }, null, { confirmLabel: 'Vendre', cancelLabel: 'Annuler', danger: true });
    });
    document.getElementById('btnClearMulti')?.addEventListener('click', () => {
      pcSelectedIds.clear();
      document.querySelectorAll('.pc-pokemon.multi-selected').forEach(c => c.classList.remove('multi-selected'));
      renderPokemonDetail();
    });
    return;
  }

  if (!pcSelectedId) {
    panel.classList.add('hidden');
    return;
  }

  const p = state.pokemons.find(pk => pk.id === pcSelectedId);
  if (!p) {
    panel.classList.add('hidden');
    pcSelectedId = null;
    return;
  }

  panel.classList.remove('hidden');
  const sp = SPECIES_BY_EN[p.species_en];
  const nat = NATURES[p.nature];
  const natName = nat ? (state.lang === 'fr' ? nat.fr : nat.en) : p.nature;
  const zoneDef = ZONE_BY_ID[p.capturedIn];
  const zoneName = zoneDef ? (state.lang === 'fr' ? zoneDef.fr : zoneDef.en) : p.capturedIn;
  const power = getPokemonPower(p);
  const price = calculatePrice(p);

  panel.innerHTML = `
    <div style="text-align:center;margin-bottom:12px">
      <img src="${pokeSprite(p.species_en, p.shiny)}" style="width:96px;height:96px;${p.shiny ? 'filter:drop-shadow(0 0 6px var(--gold))' : ''}">
      <div style="font-family:var(--font-pixel);font-size:12px;margin-top:4px">${speciesName(p.species_en)}${p.shiny ? ' ✨' : ''}</div>
      <div style="font-size:10px;color:var(--text-dim)">#${String(p.dex).padStart(3, '0')} — ${sp?.types.map(typeFr).join('/') || '?'}</div>
      ${p.homesick ? '<div style="display:inline-block;margin-top:4px;padding:2px 8px;background:#1a100a;border:1px solid #8b4513;border-radius:3px;font-size:9px;color:#cd853f">🏠 Mal du pays (-25%)</div>' : ''}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px;margin-bottom:12px">
      <div>${t('level')}: <b>${p.level}</b></div>
      <div>${t('nature')}: <b>${natName}</b></div>
      <div>${t('potential')}: <b style="color:var(--gold)">${'★'.repeat(p.potential)}</b></div>
      <div>PC: <b>${power}</b></div>
    </div>
    <div style="font-size:11px;margin-bottom:8px">
      <div style="color:var(--text-dim);margin-bottom:4px">${t('moves')}:</div>
      ${p.moves.map(m => `<div style="padding:2px 0">▸ ${m}</div>`).join('')}
    </div>
    <div style="font-size:11px;margin-bottom:8px">
      <div>ATK: <b>${p.stats.atk}</b> — DEF: <b>${p.stats.def}</b> — SPD: <b>${p.stats.spd}</b></div>
    </div>
    <div style="font-size:10px;color:var(--text-dim);margin-bottom:8px">${t('zone_caught')}: ${zoneName}</div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
      <div style="font-size:10px;color:var(--gold);flex:1">Valeur: ${price}₽${getMarketSaturation(p.species_en) > 0 ? ` <span style="color:var(--red);font-size:9px">▼${getMarketSaturation(p.species_en)}% offre</span>` : ''}</div>
      <button id="btnFavToggle" style="font-size:10px;padding:4px 10px;background:${p.favorite ? 'var(--gold-dim)' : 'var(--bg)'};border:1px solid ${p.favorite ? 'var(--gold)' : 'var(--border)'};border-radius:var(--radius-sm);color:${p.favorite ? 'var(--bg)' : 'var(--text-dim)'};cursor:pointer">${p.favorite ? '⭐ Favori' : '☆ Favori'}</button>
    </div>
    ${(() => {
      const hasCandy = (state.inventory.rarecandy || 0) > 0;
      return `<div style="margin-bottom:8px"><button id="btnRareCandy" style="width:100%;font-size:10px;padding:5px;background:${hasCandy ? 'var(--bg)' : 'var(--bg)'};border:1px solid ${hasCandy ? 'var(--gold)' : 'var(--border)'};border-radius:var(--radius-sm);color:${hasCandy ? 'var(--gold)' : 'var(--text-dim)'};cursor:${hasCandy ? 'pointer' : 'default'}"${hasCandy ? '' : ' disabled'}>🍬 Super Bonbon (+1 niveau) — stock: ${state.inventory.rarecandy || 0}</button></div>`;
    })()}
    ${(() => {
      // Check if in a team
      const inBossTeam = state.gang.bossTeam.includes(p.id);
      const inAgentTeam = state.agents.find(a => a.team.includes(p.id));
      const teamLabel = inBossTeam ? (state.lang === 'fr' ? 'Équipe Boss' : 'Boss Team')
        : inAgentTeam ? (state.lang === 'fr' ? 'Équipe ' + inAgentTeam.name : inAgentTeam.name + ' Team')
        : null;
      if (teamLabel) {
        return '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px"><button style="flex:1;font-size:10px;padding:6px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer" id="btnRemoveFromTeam">🔓 ' + (state.lang === 'fr' ? 'Retirer de ' : 'Remove from ') + teamLabel + '</button></div>';
      }
      return '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px"><button style="flex:1;font-size:10px;padding:6px;background:var(--bg);border:1px solid var(--green);border-radius:var(--radius-sm);color:var(--green);cursor:pointer" id="btnAssignTo">📋 ' + (state.lang === 'fr' ? 'Attribuer à...' : 'Assign to...') + '</button></div>';
    })()}
    ${(() => {
      const inPension = p.id === state.pension.slotA || p.id === state.pension.slotB;
      const inTraining = state.trainingRoom?.pokemon?.includes(p.id);
      const inTeam = state.gang.bossTeam.includes(p.id) || state.agents.some(a => a.team.includes(p.id));
      if (inTeam) return '';
      const pensionFull = state.pension.slotA && state.pension.slotB;
      const trainingFull = (state.trainingRoom?.pokemon?.length || 0) >= 6;
      let btns = '';
      if (!inPension && !inTraining) {
        btns += `<button style="flex:1;font-size:10px;padding:6px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:${pensionFull ? 'var(--text-dim)' : 'var(--text)'};cursor:${pensionFull ? 'default' : 'pointer'}" id="btnSendPension"${pensionFull ? ' disabled' : ''}>Pension ${pensionFull ? '(pleine)' : ''}</button>`;
        btns += `<button style="flex:1;font-size:10px;padding:6px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:${trainingFull ? 'var(--text-dim)' : 'var(--text)'};cursor:${trainingFull ? 'default' : 'pointer'}" id="btnSendTraining"${trainingFull ? ' disabled' : ''}>Formation ${trainingFull ? '(pleine)' : ''}</button>`;
      } else if (inPension) {
        btns += `<button style="flex:1;font-size:10px;padding:6px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer" id="btnRemovePension">Retirer pension</button>`;
      } else if (inTraining) {
        btns += `<button style="flex:1;font-size:10px;padding:6px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer" id="btnRemoveTraining">Retirer formation</button>`;
      }
      return btns ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">${btns}</div>` : '';
    })()}
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <button style="flex:1;font-size:10px;padding:6px;background:var(--red-dark);border:1px solid var(--red);border-radius:var(--radius-sm);color:var(--text);cursor:pointer" id="btnSellOne">${t('sell')} (${price}₽)</button>
      <button style="flex:1;font-size:10px;padding:6px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer" id="btnRelease">${t('release')}</button>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
      <button id="btnRename" style="flex:1;font-size:10px;padding:6px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">✏ Renommer</button>
    </div>
    <div style="margin-top:8px">
      <button id="btnFilterSpecies" style="width:100%;font-size:9px;padding:5px;background:var(--bg);border:1px solid var(--blue);border-radius:var(--radius-sm);color:var(--blue);cursor:pointer;font-family:var(--font-pixel)">
        🔍 Voir tous les ${speciesName(p.species_en)} (×${state.pokemons.filter(x => x.species_en === p.species_en).length})
      </button>
    </div>
    ${renderEvolutionPanel(p)}
    ${renderPotentialUpgradePanel(p)}
    ${renderPokemonHistory(p)}
  `;

  document.getElementById('btnFavToggle')?.addEventListener('click', () => {
    p.favorite = !p.favorite;
    saveState();
    renderPCTab();
  });

  document.getElementById('btnRareCandy')?.addEventListener('click', () => {
    if ((state.inventory.rarecandy || 0) <= 0) return;
    state.inventory.rarecandy--;
    if (p.level < 100) { p.level++; p.xp = 0; p.stats = calculateStats(p); tryAutoEvolution(p); }
    saveState();
    notify(`🍬 ${speciesName(p.species_en)} → Lv.${p.level}`, 'gold');
    renderPCTab();
    updateTopBar();
  });

  document.getElementById('btnSellOne')?.addEventListener('click', () => {
    sellPokemon([p.id]);
    pcSelectedId = null;
    updateTopBar();
    renderPCTab();
  });
  document.getElementById('btnRelease')?.addEventListener('click', () => {
    // Unassign from agent
    for (const agent of state.agents) {
      agent.team = agent.team.filter(id => id !== p.id);
    }
    state.gang.bossTeam = state.gang.bossTeam.filter(id => id !== p.id);
    state.pokemons = state.pokemons.filter(pk => pk.id !== p.id);
    pcSelectedId = null;
    saveState();
    renderPCTab();
  });
  document.getElementById('btnAssignTo')?.addEventListener('click', () => {
    openAssignToPicker(p.id);
  });
  document.getElementById('btnRemoveFromTeam')?.addEventListener('click', () => {
    // Remove from all teams
    state.gang.bossTeam = state.gang.bossTeam.filter(id => id !== p.id);
    for (const agent of state.agents) {
      agent.team = agent.team.filter(id => id !== p.id);
    }
    saveState();
    renderPCTab();
    notify(state.lang === 'fr' ? 'Retiré de l\'équipe' : 'Removed from team', 'success');
  });

  document.getElementById('btnSendPension')?.addEventListener('click', () => {
    removePokemonFromAllAssignments(p.id);
    if (!state.pension.slotA) state.pension.slotA = p.id;
    else if (!state.pension.slotB && state.pension.slotA !== p.id) state.pension.slotB = p.id;
    else { notify('Pension pleine'); return; }
    saveState();
    notify(`${speciesName(p.species_en)} → Pension`, 'success');
    renderPCTab();
  });
  document.getElementById('btnSendTraining')?.addEventListener('click', () => {
    removePokemonFromAllAssignments(p.id);
    if (!state.trainingRoom.pokemon) state.trainingRoom.pokemon = [];
    if (state.trainingRoom.pokemon.length >= 6) { notify('Salle pleine (max 6)'); return; }
    if (!state.trainingRoom.pokemon.includes(p.id)) state.trainingRoom.pokemon.push(p.id);
    saveState();
    notify(`${speciesName(p.species_en)} → Formation`, 'success');
    renderPCTab();
  });
  document.getElementById('btnRemovePension')?.addEventListener('click', () => {
    if (state.pension.slotA === p.id) state.pension.slotA = null;
    if (state.pension.slotB === p.id) state.pension.slotB = null;
    saveState();
    notify(`${speciesName(p.species_en)} retiré de la pension`, 'success');
    renderPCTab();
  });
  document.getElementById('btnRemoveTraining')?.addEventListener('click', () => {
    state.trainingRoom.pokemon = state.trainingRoom.pokemon.filter(id => id !== p.id);
    saveState();
    notify(`${speciesName(p.species_en)} retiré de la formation`, 'success');
    renderPCTab();
  });

  document.getElementById('btnFilterSpecies')?.addEventListener('click', () => {
    filterPCBySpecies(p.species_en);
  });

  document.getElementById('btnRename')?.addEventListener('click', () => {
    openRenameModal(p.id);
  });

  // Potential upgrade button
  document.getElementById('btnPotUpgrade')?.addEventListener('click', () => {
    if (p.potential >= 5) return;
    const teamIds = new Set([...state.gang.bossTeam]);
    for (const a of state.agents) a.team.forEach(id => teamIds.add(id));
    const cost = POT_UPGRADE_COSTS[p.potential - 1];
    const donors = state.pokemons.filter(d =>
      d.species_en === p.species_en && d.id !== p.id && !d.shiny &&
      !teamIds.has(d.id) && !state.trainingRoom.pokemon?.includes(d.id)
    );
    if (donors.length < cost) return;
    donors.slice(0, cost).forEach(d => {
      state.pokemons = state.pokemons.filter(pk => pk.id !== d.id);
    });
    p.potential++;
    p.stats = calculateStats(p);
    saveState();
    notify(`${speciesName(p.species_en)} est maintenant ${'*'.repeat(p.potential)} !`, 'gold');
    renderPCTab();
    updateTopBar();
  });

  // Evolution buttons
  panel.querySelectorAll('.btn-evolve-level').forEach(btn => {
    btn.addEventListener('click', () => {
      evolvePokemon(p, btn.dataset.evoTarget);
      _pcLastRenderKey = ''; renderPCTab();
    });
  });
  panel.querySelectorAll('.btn-evolve-item').forEach(btn => {
    btn.addEventListener('click', () => {
      if ((state.inventory.evostone || 0) <= 0) return;
      if (p.species_en === 'eevee') {
        openEeveeEvoPopup(p);
      } else {
        state.inventory.evostone--;
        evolvePokemon(p, btn.dataset.evoTarget);
        _pcLastRenderKey = ''; renderPCTab();
      }
    });
  });
}

// ── Eevee evolution popup ─────────────────────────────────────
function openEeveeEvoPopup(p) {
  const EEVEE_CHOICES = [
    { en: 'vaporeon', fr: 'Aquali',  type: 'Eau',      color: '#6ab4e8' },
    { en: 'jolteon',  fr: 'Voltali', type: 'Électrik', color: '#f0d050' },
    { en: 'flareon',  fr: 'Pyroli',  type: 'Feu',       color: '#f08030' },
  ];
  // Mélange aléatoire — le joueur ne sait pas quelle position correspond à quoi avant de regarder
  const shuffled = [...EEVEE_CHOICES].sort(() => Math.random() - 0.5);

  const modal = document.createElement('div');
  modal.className = 'eevee-evo-modal';
  modal.innerHTML = `
    <div class="eevee-evo-box">
      <div class="eevee-evo-header">
        <img src="${pokeSprite('eevee')}" style="width:40px;height:40px;image-rendering:pixelated">
        <div>
          <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold)">ÉVOLUTION D'ÉVOLI</div>
          <div style="font-size:9px;color:var(--text-dim)">Utilise la Pierre Évolution</div>
        </div>
      </div>
      <div class="eevee-evo-choices">
        ${shuffled.map(c => `
          <div class="eevee-choice-card" data-target="${c.en}" style="--evo-color:${c.color}">
            <img src="${pokeSprite(c.en)}" class="eevee-choice-sprite">
            <div class="eevee-choice-name">${c.fr}</div>
            <div class="eevee-choice-type">${c.type}</div>
          </div>`).join('')}
      </div>
      <div style="font-size:8px;color:var(--text-dim);text-align:center;margin-top:8px">Cliquez pour choisir • Échap pour annuler</div>
    </div>`;
  document.body.appendChild(modal);

  modal.querySelectorAll('.eevee-choice-card').forEach(card => {
    card.addEventListener('click', () => {
      const target = card.dataset.target;
      state.inventory.evostone--;
      evolvePokemon(p, target);
      modal.remove();
      _pcLastRenderKey = ''; renderPCTab();
    });
  });
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', esc); }
  });
}

function openRenameModal(pokemonId) {
  const p = state.pokemons.find(pk => pk.id === pokemonId);
  if (!p) return;
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;z-index:9100;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center';
  modal.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);padding:20px;max-width:320px;width:90%;display:flex;flex-direction:column;gap:12px">
      <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold)">RENOMMER</div>
      <div style="display:flex;align-items:center;gap:10px">
        <img src="${pokeSprite(p.species_en, p.shiny)}" style="width:48px;height:48px;image-rendering:pixelated">
        <div>
          <div style="font-size:11px">${speciesName(p.species_en)}</div>
          <div style="font-size:9px;color:var(--text-dim)">Nom actuel : ${p.nick || speciesName(p.species_en)}</div>
        </div>
      </div>
      <input id="renameInput" type="text" maxlength="16" placeholder="${p.nick || speciesName(p.species_en)}" value="${p.nick || ''}"
        style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);padding:8px 10px;font-size:12px;outline:none;width:100%;box-sizing:border-box">
      <div style="display:flex;gap:8px">
        <button id="renameClear" style="flex:1;font-family:var(--font-pixel);font-size:8px;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">Effacer surnom</button>
        <button id="renameConfirm" style="flex:1;font-family:var(--font-pixel);font-size:8px;padding:8px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">Confirmer</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelector('#renameInput').focus();
  modal.querySelector('#renameConfirm').addEventListener('click', () => {
    const val = modal.querySelector('#renameInput').value.trim();
    p.nick = val || null;
    saveState();
    notify(val ? `${speciesName(p.species_en)} renommé "${val}"` : 'Surnom effacé', 'success');
    modal.remove();
    _pcLastRenderKey = '';
    renderPokemonGrid(true);
  });
  modal.querySelector('#renameClear').addEventListener('click', () => {
    p.nick = null;
    saveState();
    notify('Surnom effacé', 'success');
    modal.remove();
    _pcLastRenderKey = '';
    renderPokemonGrid(true);
  });
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.querySelector('#renameInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') modal.querySelector('#renameConfirm').click();
    if (e.key === 'Escape') modal.remove();
  });
}

// ── Vue détail en mode "Grouper" ─────────────────────────────
function renderPokemonDetailGroup(species) {
  const panel = document.getElementById('pokemonDetail');
  if (!panel) return;
  const pks = state.pokemons.filter(p => p.species_en === species);
  if (!pks.length) { panel.classList.add('hidden'); return; }
  panel.classList.remove('hidden');
  const sp = SPECIES_BY_EN[species];
  const tIds = new Set([...state.gang.bossTeam]);
  for (const a of state.agents) a.team.forEach(id => tIds.add(id));
  const sellable = pks.filter(p => !p.favorite && !tIds.has(p.id));
  const totalValue = sellable.reduce((s, p) => s + calculatePrice(p), 0);
  const maxPot = Math.max(...pks.map(p => p.potential));
  const maxLvl = Math.max(...pks.map(p => p.level));

  panel.innerHTML = `
    <div style="text-align:center;margin-bottom:10px">
      <img src="${pokeSprite(species)}" style="width:72px;height:72px">
      <div style="font-family:var(--font-pixel);font-size:11px;margin-top:4px">${speciesName(species)}</div>
      <div style="font-size:9px;color:var(--text-dim)">#${String(sp?.dex||0).padStart(3,'0')} — ${(sp?.types||[]).join('/')}</div>
      <div style="font-size:9px;margin-top:2px">×${pks.length} · Max Lv.${maxLvl} · ${'★'.repeat(maxPot)}</div>
    </div>
    ${sellable.length > 0 ? `
      <div style="font-size:9px;color:var(--text-dim);margin-bottom:6px;text-align:center">${sellable.length} vendables — <span style="color:var(--gold)">${totalValue.toLocaleString()}₽</span></div>
      <button id="btnGroupSellAll" style="width:100%;font-family:var(--font-pixel);font-size:9px;padding:6px;background:var(--red-dark);border:1px solid var(--red);border-radius:var(--radius-sm);color:var(--text);cursor:pointer;margin-bottom:8px">
        Vendre tous (${totalValue.toLocaleString()}₽)
      </button>` : ''}
    <div style="display:flex;flex-direction:column;gap:3px;max-height:320px;overflow-y:auto">
      ${pks.map(p => {
        const inTeam = tIds.has(p.id);
        return `<div style="display:flex;align-items:center;gap:6px;padding:4px 6px;border:1px solid ${p.shiny ? 'var(--gold-dim)' : inTeam ? 'var(--green)' : 'var(--border)'};border-radius:3px;background:var(--bg);font-size:9px">
          <img src="${pokeSprite(p.species_en, p.shiny)}" style="width:24px;height:24px">
          <span style="flex:1">${p.shiny ? '✨ ' : ''}Lv.${p.level} ${'★'.repeat(p.potential)}</span>
          <span style="color:var(--text-dim);font-size:8px">${inTeam ? '👥' : p.favorite ? '⭐' : ''}</span>
          <button class="grp-detail-btn" data-pk-id="${p.id}" style="font-size:7px;padding:1px 5px;background:var(--bg);border:1px solid var(--border);border-radius:2px;color:var(--text-dim);cursor:pointer">→</button>
        </div>`;
      }).join('')}
    </div>`;

  document.getElementById('btnGroupSellAll')?.addEventListener('click', () => {
    const ids = sellable.map(p => p.id);
    showConfirm(`Vendre <b>${ids.length}</b> ${speciesName(species)} pour <b style="color:var(--gold)">${totalValue.toLocaleString()}₽</b> ?`, () => {
      sellPokemon(ids); pcGroupSpecies = null;
      _pcLastRenderKey = ''; updateTopBar(); renderPCTab();
    }, null, { confirmLabel: 'Vendre', cancelLabel: 'Annuler', danger: true });
  });
  panel.querySelectorAll('.grp-detail-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      pcGroupMode = false; pcGroupSpecies = null;
      const chk = document.getElementById('pcGroupChk');
      if (chk) chk.checked = false;
      pcSelectedId = btn.dataset.pkId;
      _pcLastRenderKey = ''; renderPCTab();
    });
  });
}

// ── Pokemon History ──────────────────────────────────────────
function renderPokemonHistory(pokemon) {
  if (!pokemon.history || pokemon.history.length === 0) return '';
  const entries = pokemon.history.slice(-10).reverse().map(h => {
    const date = new Date(h.ts);
    const timeStr = date.toLocaleTimeString(state.lang === 'fr' ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    switch (h.type) {
      case 'captured': {
        const zDef = ZONE_BY_ID[h.zone];
        const zName = zDef ? (state.lang === 'fr' ? zDef.fr : zDef.en) : h.zone;
        const ballName = BALLS[h.ball] ? (state.lang === 'fr' ? BALLS[h.ball].fr : BALLS[h.ball].en) : h.ball;
        return `<div class="history-entry">${timeStr} — ${state.lang === 'fr' ? 'Capturé' : 'Captured'} (${ballName}) @ ${zName}</div>`;
      }
      case 'combat':
        return `<div class="history-entry">${timeStr} — ${h.won ? (state.lang === 'fr' ? 'Combat gagné' : 'Won battle') : (state.lang === 'fr' ? 'Combat perdu' : 'Lost battle')}</div>`;
      case 'levelup':
        return `<div class="history-entry">${timeStr} — ${state.lang === 'fr' ? 'Niveau' : 'Level'} ${h.level}</div>`;
      case 'evolved':
        return `<div class="history-entry" style="color:var(--gold)">${timeStr} — ${h.from} → ${h.to} ✨</div>`;
      default:
        return `<div class="history-entry">${timeStr} — ${h.type}</div>`;
    }
  }).join('');
  return `<div class="pokemon-history">
    <div class="history-title">${state.lang === 'fr' ? '📜 Historique' : '📜 History'}</div>
    ${entries}
  </div>`;
}

// ════════════════════════════════════════════════════════════════
// 18.  UI — POKEDEX TAB
// ════════════════════════════════════════════════════════════════

let dexSelectedEn = null;

function getSpawnZones(species_en) {
  return ZONES
    .filter(z => z.pool && z.pool.includes(species_en))
    .map(z => ({ name: state.lang === 'fr' ? z.fr : z.en, rate: z.spawnRate, id: z.id }));
}

// ── Pokédex Assistant (Professeur Oak) ───────────────────────────────────────

const DEX_ASSISTANT_PRICES = {
  common:    100,
  uncommon:  300,
  rare:     1000,
  very_rare: 3000,
  legendary: 8000,
};

const DEX_ASSISTANT_TIPS = {
  legendary: [
    'Les légendaires sont extrêmement rares (≈1% par spawn). Installe plusieurs agents dans les zones concernées et sois patient.',
    'Un légendaire peut aussi apparaître pendant un raid de zone. Concentre tes forces !',
    'Active le mode "Rare Scope" depuis le marché pour forcer l\'apparition des espèces rares (légendaires exclus, mais ça libère de la place dans le pool).',
  ],
  very_rare: [
    'Cette espèce est très rare. Le "Rare Scope" du marché triple ses chances d\'apparition.',
    'Assigne plusieurs agents dans les zones indiquées pour multiplier les chances de rencontre.',
    'Un niveau de maîtrise élevé dans la zone augmente la fréquence des spawns globaux.',
  ],
  rare: [
    'Espèce rare — plusieurs sessions de farm seront nécessaires. Garde les Poké Balls prêtes !',
    'Le "Rare Scope" peut aider à filtrer les espèces communes et augmenter le taux des rares.',
    'En mode automatique, assigne un agent spécialisé en capture dans la zone la plus active.',
  ],
  uncommon: [
    'Espèce peu commune. Quelques heures de farm avec un agent en capture suffisent généralement.',
    'Privilégie la zone avec le meilleur spawnRate (affiché dans Zones de Spawn).',
    'Les coffres de zone peuvent parfois contenir des Pokémon de rareté peu commune.',
  ],
  common: [
    'Espèce commune — tu devrais en trouver rapidement, même sans agent assigné.',
    'Lance une capture manuelle depuis la zone ou laisse un agent s\'en occuper.',
    'Si tu en as besoin en shiny, active le Charme Chroma depuis le marché cosmétiques.',
  ],
};

function _getDexAssistantCostHtml(sp) {
  const price = DEX_ASSISTANT_PRICES[sp.rarity] ?? 500;
  const canAfford = state.gang.money >= price;
  return `<button id="dexAssistantBtn" style="
    width:100%;font-family:var(--font-pixel);font-size:8px;padding:7px 10px;
    background:rgba(255,204,90,.06);border:1px solid ${canAfford ? 'rgba(255,204,90,.4)' : 'var(--border)'};
    border-radius:var(--radius-sm);color:${canAfford ? 'var(--gold)' : 'var(--text-dim)'};
    cursor:${canAfford ? 'pointer' : 'default'};text-align:left;
    display:flex;align-items:center;justify-content:space-between;gap:6px
  ">
    <span>🎓 Conseil du Professeur</span>
    <span style="font-family:sans-serif;font-size:9px;color:${canAfford ? 'var(--gold-dim)' : '#444'}">${price.toLocaleString()}₽</span>
  </button>`;
}

function openDexAssistant(species_en) {
  const sp = SPECIES_BY_EN[species_en];
  if (!sp) return;

  const price = DEX_ASSISTANT_PRICES[sp.rarity] ?? 500;
  if (state.gang.money < price) {
    notify(`Fonds insuffisants — ${price.toLocaleString()}₽ requis.`, 'error');
    return;
  }

  const spawnZones = getSpawnZones(sp.en);
  const rarity     = sp.rarity ?? 'common';
  const rarityFR   = { common:'Commun', uncommon:'Peu commun', rare:'Rare', very_rare:'Très rare', legendary:'Légendaire' };
  const rarityCol  = { common:'#aaa', uncommon:'#5be06c', rare:'#5b9be0', very_rare:'#c05be0', legendary:'#ffcc5a' };

  // Pick 2 random tips for this rarity
  const pool = DEX_ASSISTANT_TIPS[rarity] ?? DEX_ASSISTANT_TIPS.common;
  const tips = pool.length <= 2 ? pool : [pool[Math.floor(Math.random() * pool.length)]];

  // Best zone by spawnRate
  const bestZone = spawnZones.sort((a, b) => b.rate - a.rate)[0];

  const zonesHtml = spawnZones.length
    ? spawnZones.map(z => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:9px">${z.name}</span>
          <span style="font-size:8px;color:var(--text-dim)">${(z.rate * 100).toFixed(1)}% / tick</span>
        </div>`).join('')
    : `<div style="font-size:9px;color:var(--text-dim)">Aucune zone connue pour cette espèce.</div>`;

  const tipsHtml = tips.map(tip =>
    `<div style="display:flex;gap:8px;align-items:flex-start;padding:6px 0;border-bottom:1px solid var(--border)">
      <span style="color:var(--gold);font-size:12px;flex-shrink:0">💡</span>
      <span style="font-size:9px;color:var(--text);line-height:1.5">${tip}</span>
    </div>`
  ).join('');

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px';
  overlay.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);padding:22px;max-width:440px;width:100%;max-height:88vh;overflow-y:auto;display:flex;flex-direction:column;gap:14px">

      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold)">🎓 Professeur Oak</div>
        <button id="btnDexAssistClose" style="background:none;border:none;color:var(--text-dim);font-size:18px;cursor:pointer">✕</button>
      </div>

      <!-- En-tête Pokémon -->
      <div style="display:flex;align-items:center;gap:12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px">
        <img src="${pokeSprite(sp.en, false)}" style="width:52px;height:52px;image-rendering:pixelated">
        <div>
          <div style="font-family:var(--font-pixel);font-size:11px">${sp.fr}</div>
          <div style="font-size:8px;color:var(--text-dim)">#${String(sp.dex).padStart(3,'0')} — ${sp.types.map(typeFr).join('/')}</div>
          <div style="margin-top:4px">
            <span style="font-size:8px;padding:2px 8px;border-radius:8px;background:rgba(255,204,90,.12);border:1px solid ${rarityCol[rarity]};color:${rarityCol[rarity]}">${rarityFR[rarity]}</span>
          </div>
        </div>
      </div>

      <!-- Zones de spawn -->
      <div>
        <div style="font-family:var(--font-pixel);font-size:8px;color:var(--text-dim);margin-bottom:6px">📍 ZONES DE SPAWN</div>
        ${zonesHtml}
        ${bestZone ? `<div style="font-size:8px;color:var(--green);margin-top:6px">✓ Meilleure zone : <b>${bestZone.name}</b> (${(bestZone.rate * 100).toFixed(1)}% / tick)</div>` : ''}
      </div>

      <!-- Conseils -->
      <div>
        <div style="font-family:var(--font-pixel);font-size:8px;color:var(--text-dim);margin-bottom:4px">📋 CONSEILS</div>
        ${tipsHtml}
      </div>

      <!-- Coût déduit -->
      <div style="font-size:8px;color:var(--text-dim);border-top:1px solid var(--border);padding-top:8px;text-align:right">
        −${price.toLocaleString()}₽ déduits · Solde : <span style="color:var(--gold)">${(state.gang.money - price).toLocaleString()}₽</span>
      </div>
    </div>`;

  // Déduire le prix
  state.gang.money -= price;
  updateTopBar();
  saveState();

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#btnDexAssistClose')?.addEventListener('click', () => overlay.remove());

  // Refresh le bouton dans le détail (plus assez d'argent peut-être)
  renderDexDetail(species_en);
}

function renderDexDetail(species_en) {
  const panel = document.getElementById('dexDetail');
  if (!panel) return;
  const sp = SPECIES_BY_EN[species_en];
  if (!sp) { panel.classList.add('hidden'); return; }

  const entry = state.pokedex[sp.en] || {};
  const caught = entry.caught || false;
  const ownedCount = state.pokemons.filter(p => p.species_en === sp.en).length;
  const spawnZones = getSpawnZones(sp.en);

  panel.classList.remove('hidden');
  panel.innerHTML = `
    <div style="text-align:center;margin-bottom:10px">
      <div style="display:inline-flex;gap:8px;align-items:flex-end;justify-content:center">
        <div style="position:relative;display:inline-block">
          <img src="${pokeSprite(sp.en, false)}" style="width:80px;height:80px;${!caught ? 'filter:grayscale(1) brightness(.5)' : ''}">
        </div>
        ${caught && entry.shiny ? `<div style="position:relative;display:inline-block">
          <img src="${pokeSprite(sp.en, true)}" style="width:64px;height:64px;filter:drop-shadow(0 0 6px gold)">
          <span style="position:absolute;top:-4px;right:-4px;font-size:11px">✨</span>
        </div>` : ''}
      </div>
      <div style="font-family:var(--font-pixel);font-size:11px;margin-top:4px">${caught ? (state.lang === 'fr' ? sp.fr : sp.en) : '???'}</div>
      <div style="font-size:9px;color:var(--text-dim)">#${String(sp.dex).padStart(3,'0')} — ${caught ? sp.types.map(typeFr).join('/') : '?'}</div>
    </div>

    ${caught ? `
    <div style="font-size:9px;color:var(--text);margin-bottom:10px;line-height:1.5;border-top:1px solid var(--border);padding-top:8px">
      ${getDexDesc(sp.en)}
    </div>

    <div style="font-size:9px;margin-bottom:10px">
      <div style="color:var(--text-dim);margin-bottom:4px;font-family:var(--font-pixel)">CAPTURES</div>
      <div>Total capturés : <b style="color:var(--gold)">${entry.count || 0}</b></div>
      <div>Dans le PC : <b>${ownedCount}</b></div>
      ${entry.shiny ? '<div style="color:var(--gold)">✨ Chromatique obtenu !</div>' : ''}
    </div>

    <div style="font-size:9px;margin-bottom:10px">
      <div style="color:var(--text-dim);margin-bottom:4px;font-family:var(--font-pixel)">ZONES DE SPAWN</div>
      ${spawnZones.length ? spawnZones.map(z => {
        const interval = (1 / z.rate).toFixed(0);
        return `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--border)">
          <span>${z.name}</span>
          <span style="color:var(--text-dim)">1/${interval}s</span>
        </div>`;
      }).join('') : '<div style="color:var(--text-dim)">Aucune zone connue</div>'}
    </div>

    <div style="font-size:9px">
      <div style="color:var(--text-dim);margin-bottom:4px;font-family:var(--font-pixel)">BASE STATS</div>
      <div style="display:flex;flex-direction:column;gap:3px">
        ${[['ATK', sp.baseAtk], ['DEF', sp.baseDef], ['SPD', sp.baseSpd]].map(([label, val]) => `
          <div style="display:flex;align-items:center;gap:6px">
            <span style="width:28px;color:var(--text-dim)">${label}</span>
            <div style="flex:1;background:var(--border);border-radius:2px;height:4px">
              <div style="background:var(--gold-dim);height:4px;border-radius:2px;width:${Math.round(val/150*100)}%"></div>
            </div>
            <span style="width:24px;text-align:right">${val}</span>
          </div>`).join('')}
      </div>
    </div>
    ${ownedCount > 0 ? `
    <div style="margin-top:10px">
      <button id="dexFilterPCBtn" style="width:100%;font-size:9px;padding:6px;background:var(--bg);border:1px solid var(--blue);border-radius:var(--radius-sm);color:var(--blue);cursor:pointer;font-family:var(--font-pixel)">
        🔍 Voir dans le PC (×${ownedCount})
      </button>
    </div>` : ''}
    <div style="margin-top:8px">
      ${_getDexAssistantCostHtml(sp)}
    </div>
    ` : `
    <div style="color:var(--text-dim);font-size:10px;padding:20px;text-align:center">Pas encore rencontré</div>
    <div style="margin-top:4px">
      ${_getDexAssistantCostHtml(sp)}
    </div>`}
  `;

  document.getElementById('dexFilterPCBtn')?.addEventListener('click', () => filterPCBySpecies(sp.en));
  document.getElementById('dexAssistantBtn')?.addEventListener('click', () => openDexAssistant(species_en));
}

function renderPokedexTab() {
  const grid = document.getElementById('pokedexGrid');
  if (!grid) return;

  const search = document.getElementById('dexSearchInput')?.value?.toLowerCase() || '';
  let list = POKEMON_GEN1;
  if (search) {
    list = list.filter(sp =>
      sp.en.includes(search) || sp.fr.toLowerCase().includes(search) ||
      String(sp.dex).includes(search)
    );
  }

  grid.innerHTML = list.map(sp => {
    const entry = state.pokedex[sp.en];
    const caught = entry?.caught;
    const seen = entry?.seen;
    const sel = dexSelectedEn === sp.en ? 'selected' : '';
    const hasShiny = !!entry?.shiny;
    return `<div class="dex-entry ${caught ? 'caught' : ''} ${!seen && !caught ? 'unseen' : ''} ${sel}" data-dex-en="${sp.en}" style="position:relative">
      ${caught || seen
        ? `<img src="${pokeSprite(sp.en, hasShiny)}" style="width:36px;height:36px;${!caught ? 'filter:brightness(0)' : ''}">`
        : `<div style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;color:var(--text-dim);font-size:14px">?</div>`
      }
      ${hasShiny ? `<span style="position:absolute;top:-3px;right:-3px;font-size:9px;line-height:1;pointer-events:none" title="Chromatique obtenu">✨</span>` : ''}
      <div class="dex-number">#${String(sp.dex).padStart(3, '0')}</div>
    </div>`;
  }).join('');

  const caught = Object.values(state.pokedex).filter(e => e.caught).length;
  const total = POKEMON_GEN1.length;
  let dexCounter = document.getElementById('dexCounter');
  if (!dexCounter) {
    dexCounter = document.createElement('div');
    dexCounter.id = 'dexCounter';
    dexCounter.style.cssText = 'font-family:var(--font-pixel);font-size:9px;color:var(--text-dim);margin-bottom:8px';
    grid.parentNode.insertBefore(dexCounter, grid);
  }
  dexCounter.textContent = `${caught}/${total} capturés`;

  grid.querySelectorAll('.dex-entry[data-dex-en]').forEach(el => {
    el.addEventListener('click', () => {
      dexSelectedEn = el.dataset.dexEn;
      grid.querySelectorAll('.dex-entry').forEach(e => e.classList.remove('selected'));
      el.classList.add('selected');
      renderDexDetail(dexSelectedEn);
    });
  });

  // Search input wiring (once)
  const searchInput = document.getElementById('dexSearchInput');
  if (searchInput && !searchInput.dataset.wired) {
    searchInput.dataset.wired = '1';
    searchInput.addEventListener('input', () => renderPokedexTab());
  }

  // Restore detail panel
  if (dexSelectedEn) renderDexDetail(dexSelectedEn);
}

// ════════════════════════════════════════════════════════════════
// 18b. UI — AGENTS TAB
// ════════════════════════════════════════════════════════════════

function renderAgentPerkModal(agentId) {
  const agent = state.agents.find(a => a.id === agentId);
  if (!agent) return;

  const overlay = document.createElement('div');
  overlay.className = 'perk-modal-overlay';
  overlay.innerHTML = `
    <div class="perk-modal-box">
      <div class="perk-modal-title">${agent.name} — PERK Lv.${agent.level}</div>
      <div style="font-size:10px;color:var(--text-dim);margin-bottom:12px">Choisis une amelioration :</div>
      <div class="perk-modal-btns">
        <button class="perk-modal-btn" data-perk="combat">+3 ATK</button>
        <button class="perk-modal-btn" data-perk="capture">+3 CAP</button>
        <button class="perk-modal-btn" data-perk="luck">+3 LCK</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  overlay.querySelectorAll('[data-perk]').forEach(btn => {
    btn.addEventListener('click', () => {
      const stat = btn.dataset.perk;
      agent.stats[stat] = (agent.stats[stat] || 0) + 3;
      if (!agent.perkLevels) agent.perkLevels = [];
      agent.perkLevels.push({ level: agent.level, stat });
      agent.pendingPerk = false;
      saveState();
      overlay.remove();
      renderAgentsTab();
    });
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

function renderAgentsTab() {
  const grid = document.getElementById('agentsGrid');
  if (!grid) return;

  const unlockedZones = ZONES.filter(z => isZoneUnlocked(z.id));
  const RECRUIT_COST = getAgentRecruitCost();

  let html = '';
  // Existing agents
  for (const a of state.agents) {
    const xpNeeded = a.level * 30;
    const xpPct = Math.min(100, (a.xp / xpNeeded) * 100);
    const zoneOptions = unlockedZones.map(z =>
      `<option value="${z.id}" ${a.assignedZone === z.id ? 'selected' : ''}>${state.lang === 'fr' ? z.fr : z.en}</option>`
    ).join('');

    // Team slots
    const teamSlots = [0, 1, 2].map(i => {
      const pkId = a.team[i];
      const pk = pkId ? state.pokemons.find(p => p.id === pkId) : null;
      if (pk) {
        return `<div class="agent-team-slot filled" data-agent-team="${a.id}" data-slot="${i}" title="${speciesName(pk.species_en)} Lv.${pk.level}">
          <img src="${pokeSprite(pk.species_en, pk.shiny)}">
        </div>`;
      }
      return `<div class="agent-team-slot" data-agent-team="${a.id}" data-slot="${i}" title="${state.lang === 'fr' ? 'Assigner' : 'Assign'}">+</div>`;
    }).join('');

    html += `<div class="agent-card-full" data-agent-id="${a.id}">
      <div class="agent-header">
        <img src="${a.sprite}" alt="${a.name}" onerror="this.src='${FALLBACK_TRAINER_SVG}';this.onerror=null">
        <div class="agent-meta">
          <div class="agent-name">${a.name}</div>
          <div class="agent-title">${a.title} — Lv.${a.level}</div>
          <div class="agent-xp-bar"><div class="agent-xp-fill" style="width:${xpPct}%"></div></div>
        </div>
      </div>
      <div class="agent-stats-row">
        <span>ATK ${a.stats.combat}</span>
        <span>CAP ${a.stats.capture}</span>
        <span>LCK ${a.stats.luck}</span>
      </div>
      <div style="font-size:9px">
        <select class="agents-zone-select" data-agent-id="${a.id}" style="background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:4px;font-size:9px;padding:2px 4px;width:100%">
          <option value="">— ${state.lang === 'fr' ? 'Aucune zone' : 'No zone'} —</option>
          ${zoneOptions}
        </select>
      </div>
      <div class="agent-team-slots">${teamSlots}</div>
      <div class="agent-personality">${a.personality.join(', ')}</div>
      ${a.pendingPerk ? `<button class="perk-available-btn" data-perk-agent="${a.id}">[PERK DISPONIBLE]</button>` : ''}
      <label class="agent-notify-toggle">
        <input type="checkbox" class="agent-notify-cb" data-agent-id="${a.id}" ${a.notifyCaptures !== false ? 'checked' : ''}>
        ${a.notifyCaptures !== false ? '🔔' : '🔕'} Notifications
      </label>
    </div>`;
  }

  // Recruit button at end
  html += `<div class="agent-card-full" style="display:flex;align-items:center;justify-content:center;cursor:pointer;border:2px dashed var(--border-light);min-height:120px" id="btnRecruitAgentFull">
    <div style="text-align:center">
      <div style="font-size:28px">➕</div>
      <div style="font-family:var(--font-pixel);font-size:9px;color:var(--text);margin-top:6px">${state.lang === 'fr' ? 'Recruter' : 'Recruit'}</div>
      <div style="font-size:10px;color:var(--gold)">₽ ${RECRUIT_COST.toLocaleString()}</div>
    </div>
  </div>`;

  grid.innerHTML = html;

  // Wire unequip-all button (once, guarded)
  const unequipBtn = document.getElementById('btnUnequipAll');
  if (unequipBtn && !unequipBtn.dataset.wired) {
    unequipBtn.dataset.wired = '1';
    unequipBtn.addEventListener('click', () => {
      for (const a of state.agents) a.team = [];
      saveState();
      renderAgentsTab();
      notify(state.lang === 'fr' ? 'Toutes les équipes vidées' : 'All teams cleared', 'success');
    });
  }

  // Bind events
  // Recruit
  document.getElementById('btnRecruitAgentFull')?.addEventListener('click', () => {
    openAgentRecruitModal(() => renderAgentsTab());
  });

  // Zone assignment
  grid.querySelectorAll('.agents-zone-select').forEach(sel => {
    sel.addEventListener('change', (e) => {
      assignAgentToZone(e.target.dataset.agentId, e.target.value || null);
      if (activeTab === 'tabZones') renderZoneWindows();
    });
  });

  // Team slot clicks
  grid.querySelectorAll('[data-agent-team]').forEach(slot => {
    slot.addEventListener('click', () => {
      const agentId = slot.dataset.agentTeam;
      const slotIdx = parseInt(slot.dataset.slot);
      const agent = state.agents.find(a => a.id === agentId);
      if (!agent) return;
      const pkId = agent.team[slotIdx];
      if (pkId) {
        // Remove from team
        agent.team.splice(slotIdx, 1);
        saveState();
        renderAgentsTab();
      } else {
        // Show picker
        openTeamPicker('agent', agentId, () => renderAgentsTab());
      }
    });
  });

  // Notification toggle
  grid.querySelectorAll('.agent-notify-cb').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const agent = state.agents.find(a => a.id === e.target.dataset.agentId);
      if (agent) {
        agent.notifyCaptures = e.target.checked;
        saveState();
        renderAgentsTab();
      }
    });
  });

  // Perk buttons
  grid.querySelectorAll('[data-perk-agent]').forEach(btn => {
    btn.addEventListener('click', () => {
      renderAgentPerkModal(btn.dataset.perkAgent);
    });
  });

  // Right-click context menu on agent cards
  grid.querySelectorAll('.agent-card-full[data-agent-id]').forEach(card => {
    card.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const aId = card.dataset.agentId;
      const agent = state.agents.find(a => a.id === aId);
      if (!agent) return;
      const unlockedZones = ZONES.filter(z => isZoneUnlocked(z.id));
      const zoneItems = unlockedZones.slice(0, 8).map(z => ({
        action: 'zone_' + z.id,
        label: (state.lang === 'fr' ? z.fr : z.en),
        fn: () => { agent.assignedZone = z.id; saveState(); renderAgentsTab(); notify(agent.name + ' -> ' + (state.lang === 'fr' ? z.fr : z.en), 'success'); }
      }));
      showContextMenu(e.clientX, e.clientY, [
        { action:'clearteam', label:'Vider l\'equipe', fn: () => { agent.team = []; saveState(); renderAgentsTab(); } },
        { action:'autoteam', label:'Auto-equipe (top 3)', fn: () => {
          const usedIds = new Set();
          state.agents.forEach(a => { if (a.id !== agent.id) a.team.forEach(id => usedIds.add(id)); });
          state.gang.bossTeam.forEach(id => usedIds.add(id));
          const avail = state.pokemons.filter(p => !usedIds.has(p.id)).sort((a,b) => getPokemonPower(b) - getPokemonPower(a));
          agent.team = avail.slice(0, 3).map(p => p.id);
          saveState(); renderAgentsTab(); notify('Equipe auto assignee', 'success');
        }},
        ...zoneItems.length ? [{ action:'envoyer', label:'Envoyer en zone', fn: () => {} }, ...zoneItems] : [],
        { action:'unassign', label:'Retirer de la zone', fn: () => { agent.assignedZone = null; saveState(); renderAgentsTab(); } },
      ]);
    });
  });

}

// ════════════════════════════════════════════════════════════════
// 18c. UI — MISSIONS TAB
// ════════════════════════════════════════════════════════════════

function renderMissionsTab() {
  const el = document.getElementById('tabMissions');
  if (!el) return;
  initMissions();

  const renderSection = (title, missions) => {
    let html = `<div style="margin-bottom:20px">
      <h3 style="font-family:var(--font-pixel);font-size:11px;color:var(--gold);margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border)">${title}</h3>`;
    for (const m of missions) {
      const progress = getMissionProgress(m);
      const complete = isMissionComplete(m);
      const claimed = isMissionClaimed(m);
      const pct = Math.min(100, (progress / m.target) * 100);
      const name = state.lang === 'fr' ? m.fr : m.en;
      const rewardStr = [];
      if (m.reward.money) rewardStr.push(m.reward.money.toLocaleString() + '₽');
      if (m.reward.rep) rewardStr.push('+' + m.reward.rep + ' rep');

      html += `<div style="display:flex;align-items:center;gap:10px;padding:8px;border-bottom:1px solid var(--border);opacity:${claimed ? '.5' : '1'}">
        <span style="font-size:20px">${m.icon}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;${claimed ? 'text-decoration:line-through' : ''}">${name}</div>
          ${m.desc_fr ? `<div style="font-size:9px;color:var(--text-dim);margin-top:2px">${state.lang === 'fr' ? m.desc_fr : m.desc_en}</div>` : ''}
          <div style="background:var(--bg);border-radius:3px;height:6px;margin-top:4px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:${complete ? 'var(--green)' : 'var(--red)'};transition:width .3s"></div>
          </div>
          <div style="font-size:9px;color:var(--text-dim);margin-top:2px">${progress}/${m.target} — ${rewardStr.join(', ')}</div>
        </div>
        ${complete && !claimed
          ? `<button class="btn-claim-mission" data-mission-id="${m.id}" style="font-family:var(--font-pixel);font-size:9px;padding:6px 12px;background:var(--green);border:1px solid var(--green);border-radius:var(--radius-sm);color:var(--bg);cursor:pointer;white-space:nowrap;animation:glow 1.5s ease-in-out infinite">${state.lang === 'fr' ? 'Récupérer' : 'Claim'}</button>`
          : claimed
          ? '<span style="font-size:9px;color:var(--green)">✓</span>'
          : ''}
      </div>`;
    }
    html += '</div>';
    return html;
  };

  // Daily reset countdown
  const dailyRem = Math.max(0, 86400000 - (Date.now() - state.missions.daily.reset));
  const dailyH = Math.floor(dailyRem / 3600000);
  const dailyM = Math.floor((dailyRem % 3600000) / 60000);
  const weeklyRem = Math.max(0, 604800000 - (Date.now() - state.missions.weekly.reset));
  const weeklyD = Math.floor(weeklyRem / 86400000);
  const weeklyH = Math.floor((weeklyRem % 86400000) / 3600000);

  const dailyMissions = MISSIONS.filter(m => m.type === 'daily');
  const weeklyMissions = MISSIONS.filter(m => m.type === 'weekly');
  const storyMissions = MISSIONS.filter(m => m.type === 'story');
  const unclaimedStory = storyMissions.filter(m => !isMissionClaimed(m));
  const claimedStory = storyMissions.filter(m => isMissionClaimed(m));

  let content = '';
  content += renderSection(
    `${state.lang === 'fr' ? 'Missions Quotidiennes' : 'Daily Missions'} (${dailyH}h${String(dailyM).padStart(2,'0')})`,
    dailyMissions
  );
  content += renderSection(
    `${state.lang === 'fr' ? 'Missions Hebdomadaires' : 'Weekly Missions'} (${weeklyD}j ${weeklyH}h)`,
    weeklyMissions
  );
  if (unclaimedStory.length > 0) {
    content += renderSection(
      state.lang === 'fr' ? 'Histoire & Objectifs' : 'Story & Objectives',
      unclaimedStory
    );
  }
  if (claimedStory.length > 0) {
    content += renderSection(
      state.lang === 'fr' ? 'Terminés' : 'Completed',
      claimedStory
    );
  }

  // ── Bouton "Tout réclamer" ──
  const claimableMissions = MISSIONS.filter(m => isMissionComplete(m) && !isMissionClaimed(m));
  const claimAllBtn = claimableMissions.length > 0
    ? `<button id="btnClaimAllMissions" style="font-family:var(--font-pixel);font-size:9px;padding:7px 16px;background:var(--green);border:1px solid var(--green);border-radius:var(--radius-sm);color:var(--bg);cursor:pointer;margin-bottom:14px;animation:glow 1.5s ease-in-out infinite">✓ Tout réclamer (${claimableMissions.length})</button>`
    : '';
  el.innerHTML = `<div style="padding:12px">${claimAllBtn}${content}</div>`;
  if (claimableMissions.length > 0) {
    document.getElementById('btnClaimAllMissions')?.addEventListener('click', () => {
      claimableMissions.forEach(m => claimMission(m));
      saveState(); updateTopBar();
      renderMissionsTab();
    });
  }

  // Claim buttons
  el.querySelectorAll('.btn-claim-mission').forEach(btn => {
    btn.addEventListener('click', () => {
      const mission = MISSIONS.find(m => m.id === btn.dataset.missionId);
      if (mission) {
        claimMission(mission);
        renderMissionsTab();
      }
    });
  });
}

// ════════════════════════════════════════════════════════════════
// 18d. UI — BAG TAB
// ════════════════════════════════════════════════════════════════

function openRareCandyPicker() {
  if ((state.inventory.rarecandy || 0) <= 0) return;

  // Build candidate list: team pokemon first, then others, all below lv100
  const teamIds = new Set([...state.gang.bossTeam]);
  for (const a of state.agents) a.team.forEach(id => teamIds.add(id));

  const candidates = state.pokemons
    .filter(p => p.level < 100)
    .sort((a, b) => {
      const aTeam = teamIds.has(a.id) ? 1 : 0;
      const bTeam = teamIds.has(b.id) ? 1 : 0;
      if (bTeam !== aTeam) return bTeam - aTeam;
      return getPokemonPower(b) - getPokemonPower(a);
    });

  if (candidates.length === 0) {
    notify(state.lang === 'fr' ? 'Tous les Pokémon sont au max !' : 'All Pokémon are maxed!');
    return;
  }

  const overlay = document.createElement('div');
  overlay.id = 'rareCandyOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;animation:fadeIn .2s ease';

  const listHtml = candidates.slice(0, 25).map(p => {
    const inTeam = teamIds.has(p.id);
    return `<div class="picker-pokemon" data-candy-id="${p.id}" style="display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid var(--border);cursor:pointer">
      <img src="${pokeSprite(p.species_en, p.shiny)}" style="width:40px;height:40px">
      <div style="flex:1">
        <div style="font-size:12px">${inTeam ? '[EQ] ' : ''}${speciesName(p.species_en)} ${'*'.repeat(p.potential)}${p.shiny ? ' [S]' : ''}</div>
        <div style="font-size:10px;color:var(--text-dim)">Lv.${p.level} → Lv.~${Math.min(100, p.level + 5)}</div>
      </div>
      ${inTeam ? '<span style="font-size:9px;color:var(--green)">Équipe</span>' : ''}
    </div>`;
  }).join('');

  overlay.innerHTML = `<div style="background:var(--bg-panel);border:2px solid var(--gold);border-radius:var(--radius);width:90%;max-width:380px;max-height:70vh;display:flex;flex-direction:column">
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:2px solid var(--border)">
      <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold)">🍬 Super Bonbon — stock: ${state.inventory.rarecandy}</div>
      <button id="btnCloseCandy" style="background:none;border:none;color:var(--text-dim);font-size:20px;cursor:pointer">&times;</button>
    </div>
    <div style="overflow-y:auto;flex:1">${listHtml}</div>
  </div>`;

  document.body.appendChild(overlay);
  overlay.querySelector('#btnCloseCandy').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelectorAll('[data-candy-id]').forEach(el => {
    el.addEventListener('mouseenter', () => { el.style.background = 'var(--bg-hover)'; });
    el.addEventListener('mouseleave', () => { el.style.background = ''; });
    el.addEventListener('click', () => {
      if ((state.inventory.rarecandy || 0) <= 0) { overlay.remove(); return; }
      const p = state.pokemons.find(pk => pk.id === el.dataset.candyId);
      if (!p) return;
      const oldLv = p.level;
      state.inventory.rarecandy--;
      if (p.level < 100) { p.level++; p.xp = 0; p.stats = calculateStats(p); tryAutoEvolution(p); }
      saveState();
      notify(`🍬 ${speciesName(p.species_en)} Lv.${oldLv} → Lv.${p.level}`, 'gold');
      overlay.remove();
      renderBagTab();
      if (activeTab === 'tabPC') renderPCTab();
      updateTopBar();
    });
  });
}

function renderBagTab() {
  const grid = document.getElementById('bagGrid');
  if (!grid) return;

  const items = [
    { id: 'pokeball',  icon: 'PB', fr: 'Poke Ball',      en: 'Poke Ball',      desc_fr: 'Ball standard',         desc_en: 'Standard ball' },
    { id: 'greatball', icon: 'GB', fr: 'Super Ball',      en: 'Great Ball',     desc_fr: 'Meilleur potentiel',    desc_en: 'Better potential' },
    { id: 'ultraball', icon: 'UB', fr: 'Hyper Ball',      en: 'Ultra Ball',     desc_fr: 'Excellent potentiel',   desc_en: 'Excellent potential' },
    { id: 'duskball',  icon: 'DB', fr: 'Sombre Ball',     en: 'Dusk Ball',      desc_fr: 'Potentiel equilibre',   desc_en: 'Balanced potential' },
    { id: 'lure',      icon: 'LR', fr: 'Leurre',          en: 'Lure',           desc_fr: 'x2 spawns 60s',         desc_en: 'x2 spawns 60s',      usable: true },
    { id: 'superlure', icon: 'SL', fr: 'Super Leurre',    en: 'Super Lure',     desc_fr: 'x3 spawns 60s',         desc_en: 'x3 spawns 60s',      usable: true },
    { id: 'incense',   icon: 'IN', fr: 'Encens Chance',   en: 'Lucky Incense',  desc_fr: '*+1 potentiel 90s',     desc_en: '*+1 potential 90s',  usable: true },
    { id: 'rarescope', icon: 'SC', fr: 'Rarioscope',       en: 'Rare Scope',     desc_fr: 'Spawns rares x3 90s',   desc_en: 'Rare spawns x3 90s', usable: true },
    { id: 'aura',      icon: 'AU', fr: 'Aura Shiny',       en: 'Shiny Aura',     desc_fr: 'Shiny x5 90s',          desc_en: 'Shiny x5 90s',       usable: true },
    { id: 'evostone',  icon: 'EV', fr: 'Pierre Evol.',     en: 'Evo Stone',      desc_fr: 'Evolution par pierre',  desc_en: 'Stone evolution' },
    { id: 'rarecandy', icon: 'RC', fr: 'Super Bonbon',     en: 'Rare Candy',     desc_fr: '+1 niveau',              desc_en: '+1 level',          usable: true },
    { id: 'masterball',icon: 'MB', fr: 'Master Ball',      en: 'Master Ball',    desc_fr: '***** garanti',         desc_en: '***** guaranteed' },
  ];

  grid.innerHTML = items.map(item => {
    const qty = state.inventory[item.id] || 0;
    const name = state.lang === 'fr' ? item.fr : item.en;
    const desc = state.lang === 'fr' ? item.desc_fr : item.desc_en;
    const active = isBoostActive(item.id);
    const remaining = active ? boostRemaining(item.id) : 0;
    return `<div class="bag-item" ${active ? 'style="border-color:var(--gold)"' : ''}>
      <span class="bag-icon">${itemSprite(item.id)}</span>
      <div class="bag-info">
        <div class="bag-name">${name}</div>
        <div class="bag-qty">x${qty}${active ? ` (${remaining}s)` : ''}</div>
        <div class="bag-desc">${desc}</div>
      </div>
      ${item.usable && qty > 0 ? `<button class="bag-use-btn" data-use-item="${item.id}">${state.lang === 'fr' ? 'Utiliser' : 'Use'}</button>` : ''}
    </div>`;
  }).join('');

  // Active ball selector
  grid.innerHTML += `
    <div class="bag-item" style="grid-column:1/-1;border-color:var(--gold-dim)">
      <span class="bag-icon">🎯</span>
      <div class="bag-info">
        <div class="bag-name">${state.lang === 'fr' ? 'Ball active' : 'Active Ball'}</div>
        <div class="bag-desc">${state.lang === 'fr' ? 'Ball utilisée pour les captures' : 'Ball used for captures'}</div>
      </div>
      <div style="display:flex;gap:4px;flex-wrap:wrap">
        ${Object.entries(BALLS).map(([key, ball]) => `
          <button style="font-size:9px;padding:3px 8px;border-radius:4px;cursor:pointer;
            background:${state.activeBall === key ? 'var(--red-dark)' : 'var(--bg)'};
            border:1px solid ${state.activeBall === key ? 'var(--red)' : 'var(--border)'};
            color:var(--text)" data-bag-ball="${key}">
            ${state.lang === 'fr' ? ball.fr : ball.en} (${state.inventory[key] || 0})
          </button>
        `).join('')}
      </div>
    </div>`;

  // Bind use buttons
  grid.querySelectorAll('[data-use-item]').forEach(btn => {
    btn.addEventListener('click', () => {
      const itemId = btn.dataset.useItem;
      if (itemId === 'rarecandy') {
        openRareCandyPicker();
      } else if (activateBoost(itemId)) {
        notify(state.lang === 'fr' ? 'Boost activé !' : 'Boost activated!', 'success');
      }
      renderBagTab();
    });
  });

  // Ball selector
  grid.querySelectorAll('[data-bag-ball]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeBall = btn.dataset.bagBall;
      saveState();
      renderBagTab();
    });
  });
}

// ════════════════════════════════════════════════════════════════
// 19.  UI — INTRO OVERLAY
// ════════════════════════════════════════════════════════════════

// ── Hub-Import helpers ────────────────────────────────────────────────────────

/**
 * Upgrades every 4★ pokémon to 5★ automatically.
 * Priority: shiny first → highest level → PC order (array index).
 * Note: shinies can't be used as recipe material in-game, but here
 * we just bulk-upgrade all 4★, shinies first (they benefit most).
 * Returns the number of pokémon mutated.
 */
function applyAutoMutation(pokemons) {
  const candidates = pokemons
    .map((p, idx) => ({ p, idx }))
    .filter(({ p }) => p.potential === 4);

  // Sort: shiny first → level desc → PC order
  candidates.sort((a, b) => {
    const aS = a.p.shiny ? 1 : 0, bS = b.p.shiny ? 1 : 0;
    if (bS !== aS) return bS - aS;
    const aL = a.p.level ?? 0, bL = b.p.level ?? 0;
    if (bL !== aL) return bL - aL;
    return a.idx - b.idx;
  });

  for (const { p } of candidates) p.potential = 5;
  return candidates.length;
}

/**
 * Removes zone states for zone IDs no longer present in the current ZONES list.
 * Returns the number of orphan zones removed.
 */
function cleanObsoleteData(s) {
  const validIds = new Set(ZONES.map(z => z.id));
  let removed = 0;
  if (s.zones) {
    for (const zoneId of Object.keys(s.zones)) {
      if (!validIds.has(zoneId)) {
        delete s.zones[zoneId];
        removed++;
      }
    }
  }
  return removed;
}

/**
 * Hub-screen slot repair modal.
 * Lets the user pick a slot and re-applies migrate() + cleanups on it.
 */
function openHubSlotRepairModal() {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px';

  const slotHtml = [0, 1, 2].map(i => {
    const prev = getSlotPreview(i);
    const label = prev
      ? `<b style="color:var(--text)">${prev.name}</b> <span style="color:var(--text-dim);font-size:9px">(${prev.pokemon} pkm · ⭐${prev.rep})</span>`
      : `<span style="color:#555;font-style:italic">Vide</span>`;
    return `<label style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;background:var(--bg);${!prev ? 'opacity:.4;pointer-events:none' : ''}">
      <input type="radio" name="repairTargetSlot" value="${i}" ${i === activeSaveSlot ? 'checked' : ''} ${!prev ? 'disabled' : ''} style="accent-color:#ffa000">
      <span style="font-family:var(--font-pixel);font-size:8px;color:#ffa000">SLOT ${i+1}</span>
      <span style="font-size:10px">${label}</span>
    </label>`;
  }).join('');

  overlay.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid #ffa000;border-radius:var(--radius);padding:24px;max-width:480px;width:100%;display:flex;flex-direction:column;gap:14px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-family:var(--font-pixel);font-size:11px;color:#ffa000">🔧 Réparer un slot</div>
        <button id="btnRepairSlotClose" style="background:none;border:none;color:var(--text-dim);font-size:18px;cursor:pointer">✕</button>
      </div>
      <div style="font-size:9px;color:var(--text-dim);line-height:1.5">
        Réapplique toutes les migrations, corrige les champs manquants et nettoie les incohérences.
        <b style="color:var(--text)">Tes données ne seront pas effacées.</b>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">${slotHtml}</div>
      <div style="display:flex;gap:8px;margin-top:4px">
        <button id="btnRepairSlotConfirm" style="flex:1;font-family:var(--font-pixel);font-size:9px;padding:10px;background:var(--bg);border:2px solid #ffa000;border-radius:var(--radius-sm);color:#ffa000;cursor:pointer">
          🔧 Réparer ce slot
        </button>
        <button id="btnRepairSlotCancel" style="font-family:var(--font-pixel);font-size:8px;padding:10px 14px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">
          Annuler
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#btnRepairSlotClose')?.addEventListener('click',  () => overlay.remove());
  overlay.querySelector('#btnRepairSlotCancel')?.addEventListener('click', () => overlay.remove());

  overlay.querySelector('#btnRepairSlotConfirm')?.addEventListener('click', () => {
    const targetSlot = parseInt(overlay.querySelector('input[name="repairTargetSlot"]:checked')?.value ?? activeSaveSlot);
    const raw = localStorage.getItem(SAVE_KEYS[targetSlot]);
    if (!raw) { notify('Slot vide — rien à réparer.', 'error'); overlay.remove(); return; }

    showConfirm(`Réparer le Slot ${targetSlot + 1} ?<br><span style="color:var(--text-dim);font-size:10px">Toutes les migrations seront réappliquées. Données intactes.</span>`, () => {
      try {
        const parsed = JSON.parse(raw);
        // Re-run migrate
        const fixed = migrate(parsed);
        // Trim histories
        let histTrimmed = 0;
        for (const p of fixed.pokemons || []) {
          if (p.history && p.history.length > MAX_HISTORY) {
            histTrimmed += p.history.length - MAX_HISTORY;
            p.history = p.history.slice(-MAX_HISTORY);
          }
        }
        // Ghost IDs
        const allIds = new Set((fixed.pokemons || []).map(p => p.id));
        fixed.gang.bossTeam = (fixed.gang.bossTeam || []).filter(id => allIds.has(id));
        if (fixed.pension?.slotA && !allIds.has(fixed.pension.slotA)) fixed.pension.slotA = null;
        if (fixed.pension?.slotB && !allIds.has(fixed.pension.slotB)) fixed.pension.slotB = null;
        if (fixed.trainingRoom?.pokemon) fixed.trainingRoom.pokemon = fixed.trainingRoom.pokemon.filter(id => allIds.has(id));
        // Invalid title slots
        const allTitleIds = new Set((TITLES || []).map(t => t.id));
        ['titleA','titleB','titleC','titleD'].forEach(slot => {
          if (fixed.gang[slot] && !allTitleIds.has(fixed.gang[slot])) fixed.gang[slot] = null;
        });

        localStorage.setItem(SAVE_KEYS[targetSlot], JSON.stringify(fixed));

        // If we just repaired the active slot, reload state
        if (targetSlot === activeSaveSlot) {
          state = fixed;
          saveState();
        }

        overlay.remove();
        notify(`✅ Slot ${targetSlot + 1} réparé.${histTrimmed > 0 ? ` ${histTrimmed} entrées d'historique nettoyées.` : ''}`, 'success');

        // Refresh hub
        const introOverlay = document.getElementById('introOverlay');
        if (introOverlay?.classList.contains('active')) {
          introOverlay.classList.remove('active');
          showIntro();
        }
      } catch (err) {
        notify('Erreur lors de la réparation — slot non modifié.', 'error');
        console.error(err);
      }
    }, null, { confirmLabel: 'Réparer', cancelLabel: 'Annuler' });
  });
}

/**
 * Hub-screen import modal.
 * Shows a save preview, a slot destination picker and optional cleanup options,
 * then writes the migrated save to the chosen slot.
 */
function openHubImportModal(raw) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px';

  // ── Save preview data ────────────────────────────────────────────────────
  const gangName    = raw.gang?.name     ?? '—';
  const bossName    = raw.gang?.bossName ?? '—';
  const reputation  = (raw.gang?.reputation ?? 0).toLocaleString();
  const money       = (raw.gang?.money ?? 0).toLocaleString();
  const pokeCount   = (raw.pokemons  || []).length;
  const count4star  = (raw.pokemons  || []).filter(p => p.potential === 4).length;
  const count4shiny = (raw.pokemons  || []).filter(p => p.potential === 4 && p.shiny).length;
  const agentCount  = (raw.agents    || []).length;
  const dexCaught   = Object.values(raw.pokedex || {}).filter(e => e.caught).length;
  const shinyCount  = Object.values(raw.pokedex || {}).filter(e => e.shiny).length;
  const savedAt     = raw._savedAt ? new Date(raw._savedAt).toLocaleString('fr-FR') : '—';
  const playtime    = raw.playtime  ? formatPlaytime(raw.playtime) : '—';
  const schemaVer   = raw._schemaVersion ?? raw.version ?? '?';

  // Detect potential orphan zones
  const validIds = new Set(ZONES.map(z => z.id));
  const orphanZones = Object.keys(raw.zones || {}).filter(id => !validIds.has(id));

  // ── Slot picker HTML ─────────────────────────────────────────────────────
  const slotHtml = [0, 1, 2].map(i => {
    const prev = getSlotPreview(i);
    const label = prev
      ? `<b style="color:var(--text)">${prev.name}</b> <span style="color:var(--text-dim);font-size:9px">(${prev.pokemon} pkm · ⭐${prev.rep})</span>`
      : `<span style="color:#555;font-style:italic">Vide</span>`;
    return `<label style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;background:var(--bg);transition:border-color .15s" id="hubSlotLabel${i}">
      <input type="radio" name="hubTargetSlot" value="${i}" ${i === 0 ? 'checked' : ''} style="accent-color:var(--gold)">
      <span style="font-family:var(--font-pixel);font-size:8px;color:var(--gold)">SLOT ${i+1}</span>
      <span style="font-size:10px">${label}</span>
    </label>`;
  }).join('');

  // ── Warnings ─────────────────────────────────────────────────────────────
  const warnMutation = count4star > 0
    ? `<span style="color:#ffa040">${count4star} Pokémon 4★ détectés${count4shiny > 0 ? ` (dont ${count4shiny} ✨ shiny)` : ''} — tous passeront en 5★</span>`
    : `<span style="color:var(--text-dim)">Aucun Pokémon 4★ détecté</span>`;
  const warnClean = orphanZones.length > 0
    ? `<span style="color:#ffa040">${orphanZones.length} zone(s) obsolète(s) supprimée(s)</span>`
    : `<span style="color:var(--text-dim)">Aucune zone obsolète</span>`;

  overlay.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid #ffa040;border-radius:var(--radius);padding:24px;max-width:640px;width:100%;max-height:92vh;overflow-y:auto;display:flex;flex-direction:column;gap:16px">

      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-family:var(--font-pixel);font-size:11px;color:#ffa040">📥 Importer une Save</div>
        <button id="btnHubImportClose" style="background:none;border:none;color:var(--text-dim);font-size:18px;cursor:pointer">✕</button>
      </div>

      <!-- Save preview -->
      <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:12px;display:flex;flex-direction:column;gap:6px">
        <div style="font-family:var(--font-pixel);font-size:8px;color:var(--text-dim);margin-bottom:4px">SAVE IMPORTÉE</div>
        <div style="font-family:var(--font-pixel);font-size:13px;color:var(--red)">${gangName}</div>
        <div style="font-size:9px;color:var(--text-dim)">Boss : <span style="color:var(--text)">${bossName}</span></div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:4px">
          <div style="font-size:8px;color:var(--text-dim)">🎯 Pokémon <span style="color:var(--text)">${pokeCount}</span></div>
          <div style="font-size:8px;color:var(--text-dim)">👤 Agents <span style="color:var(--text)">${agentCount}</span></div>
          <div style="font-size:8px;color:var(--text-dim)">⭐ Rép. <span style="color:var(--gold)">${reputation}</span></div>
          <div style="font-size:8px;color:var(--text-dim)">₽ <span style="color:var(--text)">${money}</span></div>
          <div style="font-size:8px;color:var(--text-dim)">📖 Pokédex <span style="color:var(--text)">${dexCaught}</span></div>
          <div style="font-size:8px;color:var(--text-dim)">✨ Shinies <span style="color:var(--text)">${shinyCount}</span></div>
        </div>
        <div style="font-size:7px;color:var(--text-dim);border-top:1px solid var(--border);padding-top:6px;margin-top:2px">
          Sauvegardé le ${savedAt} · Temps de jeu : ${playtime} · Schéma v${schemaVer}
        </div>
      </div>

      <!-- Slot picker -->
      <div>
        <div style="font-family:var(--font-pixel);font-size:8px;color:var(--gold);margin-bottom:8px;letter-spacing:1px">SLOT DE DESTINATION</div>
        <div style="display:flex;flex-direction:column;gap:6px" id="hubSlotPicker">
          ${slotHtml}
        </div>
      </div>

      <!-- Options -->
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="font-family:var(--font-pixel);font-size:8px;color:var(--gold);letter-spacing:1px">OPTIONS D'IMPORT</div>

        <label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);cursor:pointer">
          <input type="checkbox" id="chkAutoMutation" ${count4star > 0 ? 'checked' : ''} style="margin-top:2px;accent-color:var(--gold)">
          <div>
            <div style="font-family:var(--font-pixel);font-size:8px;color:var(--text);margin-bottom:3px">⚡ Mutation auto 4★ → 5★</div>
            <div style="font-size:9px;color:var(--text-dim)">Améliore tous les Pokémon 4★ en 5★ automatiquement.<br>Priorité : ✨ shiny → niveau → ordre PC. Les shinys ne seront jamais utilisés comme matière première.</div>
            <div style="font-size:8px;margin-top:4px">${warnMutation}</div>
          </div>
        </label>

        <label style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);cursor:pointer">
          <input type="checkbox" id="chkCleanObsolete" ${orphanZones.length > 0 ? 'checked' : ''} style="margin-top:2px;accent-color:var(--gold)">
          <div>
            <div style="font-family:var(--font-pixel);font-size:8px;color:var(--text);margin-bottom:3px">🧹 Nettoyage des données obsolètes</div>
            <div style="font-size:9px;color:var(--text-dim)">Supprime les zones, états et environnements qui n'existent plus dans la version actuelle du jeu.<br>Ces données seront remplacées par <i>"information perdue avec le temps"</i>.</div>
            <div style="font-size:8px;margin-top:4px">${warnClean}</div>
          </div>
        </label>
      </div>

      <!-- Warning -->
      <div style="background:rgba(255,140,0,.08);border:1px solid rgba(255,140,0,.3);border-radius:var(--radius-sm);padding:10px;font-size:9px;color:var(--text-dim)">
        ⚠ Le slot de destination sera <b style="color:#ffa040">écrasé</b>. Exporte ta save actuelle si tu veux la conserver.
      </div>

      <!-- Actions -->
      <div style="display:flex;gap:8px">
        <button id="btnHubImportBackup" style="flex:1;font-family:var(--font-pixel);font-size:8px;padding:10px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">
          💾 Exporter ma save actuelle
        </button>
        <button id="btnHubImportConfirm" style="flex:2;font-family:var(--font-pixel);font-size:9px;padding:10px;background:var(--bg);border:2px solid #ffa040;border-radius:var(--radius-sm);color:#ffa040;cursor:pointer">
          📥 Importer dans ce slot
        </button>
      </div>
      <button id="btnHubImportCancel" style="font-family:var(--font-pixel);font-size:8px;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">
        Annuler
      </button>

    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#btnHubImportClose')?.addEventListener('click',  () => overlay.remove());
  overlay.querySelector('#btnHubImportCancel')?.addEventListener('click', () => overlay.remove());

  // Slot label hover effect
  overlay.querySelectorAll('#hubSlotPicker label').forEach(lbl => {
    lbl.addEventListener('mouseenter', () => lbl.style.borderColor = '#ffa040');
    lbl.addEventListener('mouseleave', () => lbl.style.borderColor = 'var(--border)');
  });

  overlay.querySelector('#btnHubImportBackup')?.addEventListener('click', () => {
    exportSave();
    const btn = overlay.querySelector('#btnHubImportBackup');
    btn.textContent = '✅ Save exportée !';
    btn.style.color = 'var(--green)';
  });

  overlay.querySelector('#btnHubImportConfirm')?.addEventListener('click', () => {
    const targetSlot = parseInt(overlay.querySelector('input[name="hubTargetSlot"]:checked')?.value ?? '0');
    const doMutation = overlay.querySelector('#chkAutoMutation')?.checked ?? false;
    const doClean    = overlay.querySelector('#chkCleanObsolete')?.checked ?? false;

    showConfirm(
      `Importer la save de <b>${gangName}</b> dans le Slot ${targetSlot + 1} ?<br><span style="color:var(--text-dim);font-size:10px">Le contenu actuel du slot sera effacé.</span>`,
      () => {
        try {
          // Deep clone before mutation
          const draft = JSON.parse(JSON.stringify(raw));

          // Apply optional steps before migration
          let mutated = 0, cleaned = 0;
          if (doMutation && draft.pokemons) mutated = applyAutoMutation(draft.pokemons);
          if (doClean)                      cleaned  = cleanObsoleteData(draft);

          // Full migration to current schema
          const migrated = migrate(draft);

          // Add cleaned-zone log if relevant
          if (doClean && cleaned > 0) {
            if (!migrated.behaviourLogs) migrated.behaviourLogs = {};
            migrated.behaviourLogs._importCleanedZones = cleaned;
            // Add a visible log to pokedex area isn't natural — add a note to notifications array if present
            if (!migrated._importNotes) migrated._importNotes = [];
            migrated._importNotes.push(`information perdue avec le temps (${cleaned} zone(s) obsolète(s) supprimée(s))`);
          }

          // Save to the target slot (don't affect current active game)
          localStorage.setItem(SAVE_KEYS[targetSlot], JSON.stringify(migrated));

          overlay.remove();

          // Compose summary message
          const parts = [`✅ Save de "${gangName}" importée dans le Slot ${targetSlot + 1}.`];
          if (mutated > 0) parts.push(`⚡ ${mutated} Pokémon 4★ → 5★.`);
          if (cleaned > 0) parts.push(`🧹 ${cleaned} zone(s) obsolète(s) supprimée(s).`);
          parts.push('Clique ▶ sur le slot pour jouer.');
          notify(parts.join(' '), 'success');

          // Refresh hub slot display if introOverlay is visible
          const introSlots = document.getElementById('introSlots');
          if (introSlots) {
            // Re-trigger showIntro rendering by dispatching a custom event, or simply reload slots
            // We call the global renderSlots if accessible — it's locally scoped, so refresh the overlay
            const introOverlay = document.getElementById('introOverlay');
            if (introOverlay?.classList.contains('active')) {
              // Remove active class to reset, then re-show
              introOverlay.classList.remove('active');
              showIntro();
            }
          }
        } catch (err) {
          notify('Erreur lors de l\'importation — save non modifiée.', 'error');
          console.error(err);
        }
      },
      null,
      { confirmLabel: 'Importer', cancelLabel: 'Annuler' }
    );
  });
}

function showIntro() {
  const overlay = document.getElementById('introOverlay');
  if (!overlay) return;
  overlay.classList.add('active');

  // ── Settings gear button ──────────────────────────────────────
  document.getElementById('introSettingsBtn')?.addEventListener('click', () => {
    openSettingsModal();
  });

  // ── Animated showcase ─────────────────────────────────────────
  const SHOWCASE_SCENES = [
    {
      key: 'capture',
      render: () => {
        const poke = 'pikachu';
        return `
          <div class="intro-scene-title">Capturez des Pokémon rares</div>
          <div class="intro-scene-sprites" style="flex-direction:column;gap:8px">
            <img src="${pokeSprite(poke)}" style="animation:pokeBounce 1s ease-in-out infinite;image-rendering:pixelated;width:64px;height:64px">
            <div style="font-size:18px;animation:pokeballFall 1.2s ease forwards">⚪</div>
          </div>
          <div class="intro-scene-desc">Des centaines d'espèces à attraper</div>`;
      }
    },
    {
      key: 'combat',
      render: () => {
        return `
          <div class="intro-scene-title">Combattez des Dresseurs</div>
          <div class="intro-scene-sprites" style="gap:12px;align-items:flex-end">
            <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
              <img src="${trainerSprite('red')}" style="animation:trainerLeft 1.2s ease-in-out infinite;image-rendering:pixelated;width:56px;height:56px">
              <div class="intro-hp-bar"><div class="intro-hp-fill" id="introHpLeft" style="width:70%;background:#4c4"></div></div>
            </div>
            <div style="font-family:var(--font-pixel);font-size:10px;color:var(--red);align-self:center">VS</div>
            <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
              <img src="${trainerSprite('lance')}" style="animation:trainerRight 1.2s ease-in-out infinite 0.3s;image-rendering:pixelated;width:56px;height:56px">
              <div class="intro-hp-bar"><div class="intro-hp-fill" id="introHpRight" style="width:40%;background:#c44"></div></div>
            </div>
          </div>
          <div class="intro-scene-desc">Montez en puissance et dominez</div>`;
      }
    },
    {
      key: 'gang',
      render: () => {
        return `
          <div class="intro-scene-title">Développez votre Gang</div>
          <div class="intro-scene-sprites" style="gap:16px">
            <img src="${trainerSprite('giovanni')}" style="image-rendering:pixelated;width:56px;height:56px">
            <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-start">
              <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold)">RÉPUTATION</div>
              <div style="font-size:22px;font-family:var(--font-pixel);color:var(--gold);animation:repTick .5s ease-in-out infinite alternate" id="introRepCounter">1 337</div>
              <div style="font-size:10px;color:var(--text-dim)">Agents: 5 &nbsp;|&nbsp; Zones: 4</div>
            </div>
          </div>
          <div class="intro-scene-desc">Conquiers Kanto, un territoire à la fois</div>`;
      }
    }
  ];

  let sceneIdx = 0;
  let showcaseInterval = null;

  const renderScene = (idx) => {
    const container = document.getElementById('introSceneContainer');
    if (!container) return;
    container.innerHTML = SHOWCASE_SCENES[idx].render();
    container.style.animation = 'none';
    container.offsetHeight; // reflow
    container.style.animation = 'sceneIn .4s ease';
    // Update dots
    const dots = document.querySelectorAll('#introSceneDots .intro-dot');
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));
  };

  renderScene(0);
  showcaseInterval = setInterval(() => {
    sceneIdx = (sceneIdx + 1) % SHOWCASE_SCENES.length;
    renderScene(sceneIdx);
  }, 3000);

  // Stop interval when overlay closes
  const stopShowcase = () => {
    if (showcaseInterval) { clearInterval(showcaseInterval); showcaseInterval = null; }
  };

  // ── Save slots ────────────────────────────────────────────────
  let selectedSlotIdx = 0; // default new game slot
  const slotsContainer = document.getElementById('introSlots');
  const renderSlots = () => {
    if (!slotsContainer) return;
    slotsContainer.innerHTML = [0, 1, 2].map(i => {
      const preview = getSlotPreview(i);
      if (preview) {
        const d = new Date(preview.ts);
        const dateStr = preview.ts ? d.toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'2-digit' }) : '—';
        const teamSpritesHtml = (preview.teamSprites || []).map(sp =>
          `<img src="${pokeSprite(sp)}" style="width:28px;height:28px;image-rendering:pixelated" onerror="this.style.display='none'">`
        ).join('');
        const agentSpritesHtml = (preview.agentSprites || []).map(url =>
          `<img src="${url}" style="width:24px;height:24px;image-rendering:pixelated" onerror="this.style.display='none'">`
        ).join('');
        return `<div class="intro-slot-card has-data" data-slot="${i}">
          <div class="isc-left">
            <div class="isc-slot-label">SLOT ${i+1}</div>
            ${preview.bossSprite ? `<img src="${trainerSprite(preview.bossSprite)}" style="width:52px;height:52px;image-rendering:pixelated" onerror="this.style.display='none'">` : '<div style="width:52px;height:52px;background:var(--bg);border-radius:4px;opacity:.3"></div>'}
          </div>
          <div class="isc-info">
            <div class="isc-gang-name">${preview.name}</div>
            <div class="isc-boss-name">Boss : ${preview.bossName || '—'}</div>
            <div class="isc-meta">${preview.pokemon} Pkm · ₽${(preview.money||0).toLocaleString()} · ⭐${preview.rep}</div>
            <div class="isc-date">${dateStr}${preview.playtime ? ' · ' + formatPlaytime(preview.playtime) : ''}</div>
            <div class="isc-team" style="display:flex;gap:3px;margin-top:4px;flex-wrap:wrap">${teamSpritesHtml}</div>
            ${agentSpritesHtml ? `<div class="isc-agents" style="display:flex;gap:3px;margin-top:2px;opacity:.6">${agentSpritesHtml}</div>` : ''}
          </div>
          <div class="isc-actions">
            <button class="isc-btn isc-play" data-slot="${i}" title="Jouer">▶</button>
            <button class="isc-btn isc-del" data-slot="${i}" title="Supprimer">🗑</button>
          </div>
        </div>`;
      } else {
        const isSelected = selectedSlotIdx === i;
        return `<div class="intro-slot-card empty${isSelected ? ' selected-new' : ''}" data-slot="${i}" data-empty="1">
          <div class="isc-left">
            <div class="isc-slot-label">SLOT ${i+1}</div>
            <div style="font-size:22px;opacity:.2">💾</div>
          </div>
          <div class="isc-info">
            <div style="font-size:10px;color:#555">Vide — cliquer pour nouvelle partie</div>
          </div>
          <div class="isc-actions">
            <button class="isc-btn isc-new" data-slot="${i}" title="Sélectionner">✓</button>
          </div>
        </div>`;
      }
    }).join('');

    // Handlers
    slotsContainer.querySelectorAll('.isc-play').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.slot);
        stopShowcase();
        loadSlot(idx);
        overlay.classList.remove('active');
        renderAll();
      });
    });
    slotsContainer.querySelectorAll('.isc-del').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.slot);
        showConfirm(`Supprimer la sauvegarde Slot ${idx+1} ?<br><span style="color:var(--text-dim);font-size:11px">Cette action est irréversible.</span>`, () => {
          localStorage.removeItem(SAVE_KEYS[idx]);
          if (idx === activeSaveSlot) {
            activeSaveSlot = 0;
            SAVE_KEY = SAVE_KEYS[0];
            localStorage.setItem('pokeforge.activeSlot', '0');
          }
          renderSlots();
        }, null, { danger: true, confirmLabel: 'Supprimer', cancelLabel: 'Annuler' });
      });
    });
    slotsContainer.querySelectorAll('.isc-new, .intro-slot-card.empty').forEach(btn => {
      btn.addEventListener('click', e => {
        const el = btn.closest ? btn.closest('[data-slot]') : btn;
        const idx = parseInt((el || btn).dataset.slot);
        if (idx !== undefined && !isNaN(idx)) {
          selectedSlotIdx = idx;
          renderSlots();
        }
      });
    });
  };
  renderSlots();

  // ── Hub repair button ─────────────────────────────────────────
  document.getElementById('btnHubRepairSlot')?.addEventListener('click', () => openHubSlotRepairModal());

  // ── Hub import button ─────────────────────────────────────────
  document.getElementById('btnHubImportSave')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const parsed = JSON.parse(e.target.result);
          openHubImportModal(parsed);
        } catch {
          notify('Fichier invalide — impossible de lire la save.', 'error');
        }
      };
      reader.readAsText(file);
    });
    input.click();
  });

  // ── Sprite picker ─────────────────────────────────────────────
  const picker = document.getElementById('spritePicker');
  if (picker) {
    picker.innerHTML = BOSS_SPRITES.map(s => `
      <div class="sprite-option" data-sprite="${s}">
        <img src="${trainerSprite(s)}" alt="${s}">
      </div>
    `).join('');
    picker.querySelectorAll('.sprite-option').forEach(opt => {
      opt.addEventListener('click', () => {
        picker.querySelectorAll('.sprite-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
      });
    });
    picker.querySelector('.sprite-option')?.classList.add('selected');
  }

  // ── Start button ──────────────────────────────────────────────
  document.getElementById('btnStartGame')?.addEventListener('click', () => {
    const bossName = document.getElementById('inputBossName')?.value.trim() || 'Boss';
    const gangName = document.getElementById('inputGangName')?.value.trim() || 'Team Fury';
    const selectedSprite = picker?.querySelector('.sprite-option.selected')?.dataset.sprite || 'rocketgrunt';

    state.gang.bossName = bossName;
    state.gang.name = gangName;
    state.gang.bossSprite = selectedSprite;
    state.gang.initialized = true;
    saveToSlot(selectedSlotIdx);
    stopShowcase();
    overlay.classList.remove('active');
    renderAll();
  });
}

// ════════════════════════════════════════════════════════════════
// 19b. BOSS SPRITE VALIDATOR — detect broken sprite on save load
// ════════════════════════════════════════════════════════════════

function checkBossSpriteValidity() {
  if (!state.gang.initialized || !state.gang.bossSprite) return;
  const url = trainerSprite(state.gang.bossSprite);
  const testImg = new Image();
  testImg.onload = () => {}; // fine
  testImg.onerror = () => {
    // Sprite is broken — show picker modal
    showBossSpriteRepairModal();
  };
  testImg.src = url + '?v=' + Date.now(); // cache-bust
}

function showBossSpriteRepairModal() {
  // Avoid opening twice
  if (document.getElementById('spriteRepairModal')) return;

  const modal = document.createElement('div');
  modal.id = 'spriteRepairModal';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.85);
    display:flex;align-items:center;justify-content:center;
  `;

  const spriteOptionsHtml = BOSS_SPRITES.map(s =>
    `<div class="sprite-option" data-sprite="${s}" style="
      display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px;
      border:2px solid var(--border);border-radius:var(--radius-sm);cursor:pointer;
      background:var(--bg-card);transition:border-color .15s;min-width:60px
    ">
      <img src="${trainerSprite(s)}" style="width:44px;height:44px;image-rendering:pixelated"
           onerror="this.parentElement.style.display='none'">
      <span style="font-family:var(--font-pixel);font-size:6px;color:var(--text-dim)">${s}</span>
    </div>`
  ).join('');

  modal.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--red);border-radius:var(--radius);padding:24px;max-width:600px;width:90%;max-height:80vh;display:flex;flex-direction:column;gap:16px">
      <div style="font-family:var(--font-pixel);font-size:12px;color:var(--gold)">⚠ Sprite invalide</div>
      <div style="font-size:13px;color:var(--text-dim)">
        ${state.lang === 'fr'
          ? `Le sprite "<b style="color:var(--text)">${state.gang.bossSprite}</b>" est introuvable. Choisis un nouveau sprite pour ton Boss :`
          : `The sprite "<b style="color:var(--text)">${state.gang.bossSprite}</b>" could not be found. Pick a new sprite for your Boss:`
        }
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;overflow-y:auto;max-height:320px;padding:4px">
        ${spriteOptionsHtml}
      </div>
      <button id="spriteRepairConfirm" style="
        font-family:var(--font-pixel);font-size:10px;padding:10px 20px;
        background:var(--red-dark);border:1px solid var(--red);border-radius:var(--radius);
        color:var(--text);cursor:pointer;align-self:center
      ">${state.lang === 'fr' ? 'Confirmer' : 'Confirm'}</button>
    </div>
  `;

  document.body.appendChild(modal);

  let selected = BOSS_SPRITES[0];

  // Selection logic
  modal.querySelectorAll('.sprite-option').forEach(opt => {
    opt.addEventListener('click', () => {
      modal.querySelectorAll('.sprite-option').forEach(o => o.style.borderColor = 'var(--border)');
      opt.style.borderColor = 'var(--gold)';
      selected = opt.dataset.sprite;
    });
  });
  // Auto-select first visible
  const firstVisible = modal.querySelector('.sprite-option');
  if (firstVisible) firstVisible.style.borderColor = 'var(--gold)';

  document.getElementById('spriteRepairConfirm').addEventListener('click', () => {
    state.gang.bossSprite = selected;
    saveState();
    modal.remove();
    // Refresh boss sprite displays
    document.querySelectorAll('[data-boss-sprite-img]').forEach(img => {
      img.src = trainerSprite(selected);
    });
    renderAll();
    notify(state.lang === 'fr' ? 'Sprite mis à jour !' : 'Sprite updated!', 'success');
  });
}

// ════════════════════════════════════════════════════════════════
// 20.  UI — SETTINGS MODAL
// ════════════════════════════════════════════════════════════════

// ── SFX individual sound labels ────────────────────────────────
const SFX_LABELS = {
  levelUp:   'Montée de niveau',
  capture:   'Capture',
  evolve:    'Évolution',
  ballThrow: 'Lancer de Ball',
  notify:    'Notification',
  coin:      'Argent / Récolte',
  buy:       'Achat',
  unlock:    'Déverrouillage',
  chest:     'Coffre',
  sell:      'Vente',
  error:     'Erreur',
  click:     'Clic UI',
  tabSwitch: 'Changement onglet',
  menuOpen:  'Ouverture menu',
  menuClose: 'Fermeture menu',
};

// ── Snapshot pour live-preview + revert ─────────────────────────────────────
let _settingsSnap     = null;   // structuredClone(state.settings) au moment d'ouvrir
let _settingsLangSnap = 'fr';   // state.lang au moment d'ouvrir

// Ouvre la fenêtre de paramètres : snapshot + render + bind live
function openSettingsModal() {
  const modal = document.getElementById('settingsModal');
  if (!modal) return;
  _settingsSnap     = structuredClone(state.settings);
  _settingsLangSnap = state.lang;
  renderSettingsPanel();
  _bindSettingsLive();
  modal.classList.add('active');
}

// Applique immédiatement les effets visuels/audio depuis l'UI (working copy)
function _applySettingsLive() {
  const el = document.getElementById('settingsContent');
  if (!el) return;
  const readTog = (id, def) => {
    const b = el.querySelector(`[data-toggle-id="${id}"]`);
    return b ? b.dataset.on === 'true' : def;
  };

  const lightTheme  = readTog('lightTheme', false);
  const lowSpec     = readTog('lowSpec',    false);
  const musicOn     = readTog('music',      false);
  const sfxOn       = readTog('sfx',        true);
  const musicVol    = parseInt(document.getElementById('sVolMusic')?.value)   || 80;
  const sfxVol      = parseInt(document.getElementById('sVolSFX')?.value)     || 80;
  const uiScale     = parseInt(document.getElementById('sUIScale')?.value)    || 100;
  const zoneScale   = parseInt(document.getElementById('sZoneScale')?.value)  || 100;

  // DOM / CSS (effets immédiats)
  document.body.classList.toggle('theme-light', lightTheme);
  document.body.classList.toggle('low-spec',    lowSpec);
  document.documentElement.style.setProperty('--ui-scale',   (uiScale   / 100).toFixed(2));
  document.documentElement.style.setProperty('--zone-scale', (zoneScale / 100).toFixed(2));

  // Musique
  if (musicOn) {
    MusicPlayer.setVolume(musicVol / 1000);
    MusicPlayer.updateFromContext?.();
  } else {
    MusicPlayer.stop();
  }

  // Écriture dans state (working copy — pas encore sauvegardé)
  Object.assign(state.settings, {
    lightTheme, lowSpec, sfxEnabled: sfxOn, sfxVol,
    musicEnabled: musicOn, musicVol, uiScale, zoneScale,
  });
}

// Restaure l'état d'avant ouverture (bouton ×)
function _revertSettings() {
  if (!_settingsSnap) return;
  state.settings = structuredClone(_settingsSnap);
  state.lang      = _settingsLangSnap;

  const S = state.settings;
  document.body.classList.toggle('theme-light', S.lightTheme === true);
  document.body.classList.toggle('low-spec',    S.lowSpec    === true);
  document.documentElement.style.setProperty('--ui-scale',   ((S.uiScale   ?? 100) / 100).toFixed(2));
  document.documentElement.style.setProperty('--zone-scale', ((S.zoneScale ?? 100) / 100).toFixed(2));
  if (S.musicEnabled) {
    MusicPlayer.setVolume((S.musicVol ?? 80) / 1000);
    MusicPlayer.updateFromContext?.();
  } else {
    MusicPlayer.stop();
  }
}

// Bind tous les listeners live sur les contrôles (appelé après renderSettingsPanel)
function _bindSettingsLive() {
  const el = document.getElementById('settingsContent');
  if (!el) return;

  // Toggles principaux → live apply
  el.querySelectorAll('.s-toggle[data-toggle-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const on = btn.dataset.on !== 'true';
      btn.dataset.on  = String(on);
      btn.textContent = on ? 'Activé' : 'Désactivé';
      _applySettingsLive();
    });
  });

  // SFX individuels → mise à jour working copy immédiate
  el.querySelectorAll('.s-toggle[data-sfx-key]').forEach(btn => {
    btn.addEventListener('click', () => {
      const on = btn.dataset.on !== 'true';
      btn.dataset.on  = String(on);
      btn.textContent = on ? 'Activé' : 'Désactivé';
      if (!state.settings.sfxIndividual) state.settings.sfxIndividual = {};
      state.settings.sfxIndividual[btn.dataset.sfxKey] = on;
    });
  });

  // Boutons preview ▶ — joue le son directement (ignore le mute individuel)
  el.querySelectorAll('.sfx-preview-btn[data-sfx-preview]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.sfxPreview;
      try { SFX[key]?.(); } catch {}
      // Flash visuel bref
      btn.textContent = '♪';
      setTimeout(() => { btn.textContent = '▶'; }, 400);
    });
  });

  // Sliders → mise à jour du label + apply live
  const bindSlider = (id, labelId, suffix, applyFn) => {
    const slider = document.getElementById(id);
    const label  = document.getElementById(labelId);
    if (!slider) return;
    slider.addEventListener('input', function () {
      if (label) label.textContent = this.value + suffix;
      applyFn?.(this.value);
      _applySettingsLive();
    });
  };
  bindSlider('sVolMusic',  'sVolMusicVal',  '%');
  bindSlider('sVolSFX',    'sVolSFXVal',    '%');
  bindSlider('sUIScale',   'sUIScaleVal',   '%');
  bindSlider('sZoneScale', 'sZoneScaleVal', '%');

  // Accordéon sons individuels
  document.getElementById('btnSfxSubToggle')?.addEventListener('click', () => {
    const inner = document.getElementById('sfxSubList');
    if (inner) {
      inner.classList.toggle('open');
      const arrow = inner.classList.contains('open') ? '▾' : '▸';
      const b = document.getElementById('btnSfxSubToggle');
      if (b) b.textContent = `${arrow} Sons individuels`;
    }
  });

  // Boutons d'action (export / import / purge / reset / code)
  _bindSettingsActionButtons();

  // Version
  const vEl = document.getElementById('settingsVersion');
  if (vEl) vEl.textContent = GAME_VERSION;
}

// Rendu HTML uniquement (pas de listeners — séparation claire)
function renderSettingsPanel() {
  const el = document.getElementById('settingsContent');
  if (!el) return;

  const S = state.settings;

  const tog = (id, on) =>
    `<button class="s-toggle" data-toggle-id="${id}" data-on="${!!on}">${on ? 'Activé' : 'Désactivé'}</button>`;

  const sfxRows = Object.entries(SFX_LABELS).map(([key, label]) => {
    const on = S.sfxIndividual?.[key] !== false;
    return `<div class="sfx-sub-row">
      <label>${label}</label>
      <div style="display:flex;align-items:center;gap:6px">
        <button class="sfx-preview-btn" data-sfx-preview="${key}" title="Écouter" style="font-family:var(--font-pixel);font-size:9px;padding:2px 7px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer;line-height:1">▶</button>
        <button class="s-toggle" data-sfx-key="${key}" data-on="${on}">${on ? 'Activé' : 'Désactivé'}</button>
      </div>
    </div>`;
  }).join('');

  el.innerHTML = `
    <!-- Langue -->
    <div class="settings-section">
      <h4>🌐 Langue</h4>
      <div class="settings-row">
        <label>Langue du jeu</label>
        <select id="settingLang">
          <option value="fr" ${S.lang === 'fr' || state.lang === 'fr' ? 'selected' : ''}>Français</option>
          <option value="en" ${state.lang === 'en' ? 'selected' : ''}>English</option>
        </select>
      </div>
    </div>

    <!-- Gameplay -->
    <div class="settings-section">
      <h4>🎮 Gameplay</h4>
      <div class="settings-row">
        <label>Auto-combat agents</label>
        ${tog('autoCombat', S.autoCombat !== false)}
      </div>
      <div class="settings-row">
        <label>Mode Découverte <span style="font-size:.75em;opacity:.6">(tutoriel progressif)</span></label>
        ${tog('discoveryMode', S.discoveryMode !== false)}
      </div>
      <div class="settings-row">
        <label>Sprites classiques <span style="font-size:.75em;opacity:.6">(Gen 5 Showdown)</span></label>
        ${tog('classicSprites', S.classicSprites === true)}
      </div>
    </div>

    <!-- Audio -->
    <div class="settings-section">
      <h4>🔊 Audio</h4>
      <div class="settings-row">
        <label>Musique de fond</label>
        ${tog('music', S.musicEnabled === true)}
      </div>
      <div class="settings-row">
        <label>Volume musique <span id="sVolMusicVal" style="color:var(--gold);margin-left:4px">${S.musicVol ?? 80}%</span></label>
        <input type="range" id="sVolMusic" min="0" max="100" step="5" value="${S.musicVol ?? 80}" style="width:110px">
      </div>
      <div class="settings-row">
        <label>Effets sonores (SFX)</label>
        ${tog('sfx', S.sfxEnabled !== false)}
      </div>
      <div class="settings-row">
        <label>Volume SFX <span id="sVolSFXVal" style="color:var(--gold);margin-left:4px">${S.sfxVol ?? 80}%</span></label>
        <input type="range" id="sVolSFX" min="0" max="100" step="5" value="${S.sfxVol ?? 80}" style="width:110px">
      </div>
      <div class="sfx-sublist">
        <button id="btnSfxSubToggle" style="font-family:var(--font-pixel);font-size:8px;padding:4px 10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer;width:100%;text-align:left">
          ▸ Sons individuels
        </button>
        <div class="sfx-sublist-inner" id="sfxSubList">
          ${sfxRows}
        </div>
      </div>
    </div>

    <!-- Affichage -->
    <div class="settings-section">
      <h4>🖥 Affichage</h4>
      <div class="settings-row">
        <label>Thème clair</label>
        ${tog('lightTheme', S.lightTheme === true)}
      </div>
      <div class="settings-row">
        <label>Mode légère <span style="font-size:.75em;opacity:.6">(réduit animations)</span></label>
        ${tog('lowSpec', S.lowSpec === true)}
      </div>
      <div class="settings-row">
        <label>Taille interface <span id="sUIScaleVal" style="color:var(--gold);margin-left:4px">${S.uiScale ?? 100}%</span></label>
        <input type="range" id="sUIScale" min="70" max="130" step="5" value="${S.uiScale ?? 100}" style="width:110px">
      </div>
      <div class="settings-row">
        <label>Sprites zones <span id="sZoneScaleVal" style="color:var(--gold);margin-left:4px">${S.zoneScale ?? 100}%</span></label>
        <input type="range" id="sZoneScale" min="50" max="200" step="10" value="${S.zoneScale ?? 100}" style="width:110px">
      </div>
    </div>

    <!-- Sauvegarde -->
    <div class="settings-section">
      <h4>💾 Sauvegarde</h4>
      <div class="settings-actions">
        <button id="btnExportSave">📤 Exporter</button>
        <button id="btnImportSave">📥 Importer</button>
      </div>
    </div>

    <!-- Cache -->
    <div class="settings-section">
      <h4>🗑 Cache</h4>
      <div class="settings-actions">
        <button id="btnPurgeSprites" class="danger">Purger sprites</button>
        <button id="btnResetAll" class="danger">Reset complet</button>
      </div>
    </div>

    <!-- Code récompense -->
    <div class="settings-section">
      <h4>🎁 Code récompense</h4>
      <div class="settings-row" style="flex-direction:column;align-items:stretch;gap:6px">
        <div style="display:flex;gap:6px">
          <input type="text" id="rewardCodeInput" placeholder="Entre un code..." style="flex:1;text-transform:uppercase;letter-spacing:1px">
          <button id="btnRedeemCode" style="font-family:var(--font-pixel);font-size:8px;padding:6px 10px;background:var(--red-dark);border:1px solid var(--red);border-radius:var(--radius-sm);color:var(--text);cursor:pointer;white-space:nowrap">Valider</button>
        </div>
        <div style="font-size:9px;color:var(--text-dim)">Les codes sont distribués sur le Discord.</div>
      </div>
    </div>

    <!-- Aide -->
    <div class="settings-section">
      <h4>ℹ Aide &amp; Contact</h4>
      <div style="font-size:10px;color:var(--text-dim);line-height:1.6;margin-bottom:10px">
        <b style="color:var(--gold)">PokéForge — Gang Wars</b><br>
        Capturez des Pokémon, recrutez des agents, combattez des dresseurs et élargissez votre gang.<br><br>
        <b style="color:var(--text)">Progression :</b> Gagnez de la réputation via les <b>combats spéciaux</b> et les <b>raids</b>.<br>
        <b style="color:var(--text)">Oeufs :</b> Élevez des Pokémon à la Pension — achetez un <b>incubateur</b> au Marché.<br>
        <b style="color:var(--text)">Agents :</b> Recrutez des agents et assignez-les à des zones pour automatiser captures et combats.<br>
        <b style="color:var(--text)">Labo :</b> Sacrifiez des doublons pour améliorer le potentiel de vos meilleurs Pokémon.
      </div>
      <div style="padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);font-size:10px;text-align:center">
        Contact &amp; Support — Discord : <b style="color:var(--gold)">mutenrock</b>
      </div>
    </div>
  `;
}

function repairSave() {
  showConfirm(
    'Réparer la save : reappliquer toutes les migrations et corriger les champs manquants ?\nTes données ne seront pas effacées.',
    () => {
      try {
        // Snapshot avant
        const before = { pokemons: state.pokemons.length, agents: state.agents.length, money: state.gang.money, rep: state.gang.reputation };

        // Réappliquer migrate() sur le state courant
        const raw = JSON.parse(JSON.stringify(state)); // deep clone sérialisable
        state = migrate(raw);

        // Nettoyage supplémentaire
        // 1. Historiques trop longs
        let histTrimmed = 0;
        for (const p of state.pokemons) {
          if (p.history && p.history.length > MAX_HISTORY) {
            histTrimmed += p.history.length - MAX_HISTORY;
            p.history = p.history.slice(-MAX_HISTORY);
          }
        }
        // 2. IDs fantômes en équipe boss
        const allIds = new Set(state.pokemons.map(p => p.id));
        const teamBefore = state.gang.bossTeam.length;
        state.gang.bossTeam = state.gang.bossTeam.filter(id => allIds.has(id));
        // 3. IDs fantômes en pension
        if (state.pension.slotA && !allIds.has(state.pension.slotA)) state.pension.slotA = null;
        if (state.pension.slotB && !allIds.has(state.pension.slotB)) state.pension.slotB = null;
        // 4. IDs fantômes en salle d'entraînement
        const trainBefore = state.trainingRoom.pokemon.length;
        state.trainingRoom.pokemon = state.trainingRoom.pokemon.filter(id => allIds.has(id));
        // 5. Titres dans les slots qui n'existent plus
        const validTitleIds = new Set(TITLES.map(t => t.id));
        for (const key of ['titleA','titleB','titleC','titleD']) {
          if (state.gang[key] && !validTitleIds.has(state.gang[key])) state.gang[key] = null;
        }
        if (!state.gang.titleA) state.gang.titleA = 'recrue';

        saveState();

        // Rapport
        const ghostTeam  = teamBefore - state.gang.bossTeam.length;
        const ghostTrain = trainBefore - state.trainingRoom.pokemon.length;
        const after = { pokemons: state.pokemons.length, agents: state.agents.length };
        const lines = [
          `✅ Migrations reappliquées`,
          histTrimmed   ? `📋 ${histTrimmed} entrée(s) d'historique tronquées` : null,
          ghostTeam     ? `👥 ${ghostTeam} ID fantôme(s) retiré(s) de l'équipe boss` : null,
          ghostTrain    ? `🏋 ${ghostTrain} ID fantôme(s) retiré(s) de la salle d'entraînement` : null,
          before.pokemons !== after.pokemons ? `⚠ Nombre de Pokémon modifié (${before.pokemons} → ${after.pokemons})` : null,
          `💾 Save sauvegardée — ${after.pokemons} Pokémon, ${after.agents} agents`,
        ].filter(Boolean);

        // Afficher le rapport dans un mini-modal
        const rpt = document.createElement('div');
        rpt.style.cssText = 'position:fixed;inset:0;z-index:10100;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;padding:20px';
        rpt.innerHTML = `
          <div style="background:var(--bg-panel);border:2px solid #ffa000;border-radius:var(--radius);padding:20px;max-width:380px;width:100%;display:flex;flex-direction:column;gap:10px">
            <div style="font-family:var(--font-pixel);font-size:10px;color:#ffa000">🔧 Rapport de réparation</div>
            <div style="display:flex;flex-direction:column;gap:6px">${lines.map(l => `<div style="font-size:9px;color:var(--text)">${l}</div>`).join('')}</div>
            <button id="btnRptClose" style="font-family:var(--font-pixel);font-size:8px;padding:8px;background:var(--bg);border:1px solid #ffa000;border-radius:var(--radius-sm);color:#ffa000;cursor:pointer;margin-top:4px">Fermer</button>
          </div>`;
        document.body.appendChild(rpt);
        rpt.querySelector('#btnRptClose').addEventListener('click', () => { rpt.remove(); renderAll(); });

      } catch (err) {
        console.error('[PokéForge] repairSave() error:', err);
        notify('Erreur lors de la réparation — save non-modifiée.', 'error');
      }
    },
    null,
    { confirmLabel: 'Réparer', cancelLabel: 'Annuler' }
  );
}

function _bindSettingsActionButtons() {
  document.getElementById('btnExportSave')?.addEventListener('click', exportSave);
  document.getElementById('btnImportSave')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', () => {
      if (input.files[0]) importSave(input.files[0]);
    });
    input.click();
  });
  document.getElementById('btnPurgeSprites')?.addEventListener('click', () => {
    // Tente de vider le cache navigateur via Cache API, puis recharge
    const doReload = () => { saveState(); location.reload(true); };
    if ('caches' in window) {
      caches.keys().then(names => {
        Promise.all(names.map(n => caches.delete(n))).then(doReload).catch(doReload);
      }).catch(doReload);
    } else {
      doReload();
    }
    notify('🗑 Cache purgé — rechargement en cours…', 'success');
  });
  document.getElementById('btnResetAll')?.addEventListener('click', () => {
    showConfirm(t('reset_confirm'), () => {
      localStorage.removeItem(SAVE_KEY);
      state = structuredClone(DEFAULT_STATE);
      // Close all zone windows
      for (const zid of [...openZones]) closeZoneWindow(zid);
      pcSelectedId = null;
      selectedForSale.clear();
      showIntro();
    }, null, { danger: true, confirmLabel: 'Réinitialiser', cancelLabel: 'Annuler' });
  });
  document.getElementById('btnRedeemCode')?.addEventListener('click', () => tryCheatCode('rewardCodeInput'));
  document.getElementById('rewardCodeInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') tryCheatCode('rewardCodeInput');
  });
}

function initSettings() {
  // Ouvre depuis la barre principale
  document.getElementById('btnSettings')?.addEventListener('click', () => {
    SFX.play('menuOpen');
    openSettingsModal();
  });

  // × Ferme sans sauvegarder → revert vers le snapshot
  document.getElementById('btnCloseSettings')?.addEventListener('click', () => {
    _revertSettings();
    SFX.play('menuClose');
    document.getElementById('settingsModal')?.classList.remove('active');
  });

  // ✓ Valider → finalise la lecture UI → save → ferme
  document.getElementById('btnSaveSettings')?.addEventListener('click', () => {
    const el = document.getElementById('settingsContent');
    const readToggle = (id, def = true) => {
      const btn = el?.querySelector(`[data-toggle-id="${id}"]`);
      return btn ? btn.dataset.on === 'true' : def;
    };

    // Langue
    const langSel = document.getElementById('settingLang');
    if (langSel) state.lang = langSel.value;

    // Toggles (lecture complète — _applySettingsLive a déjà écrit la plupart, mais on consolide)
    state.settings.autoCombat     = readToggle('autoCombat',    true);
    state.settings.discoveryMode  = readToggle('discoveryMode', true);
    state.settings.classicSprites = readToggle('classicSprites',false);
    state.settings.musicEnabled   = readToggle('music',         false);
    state.settings.sfxEnabled     = readToggle('sfx',           true);
    state.settings.lightTheme     = readToggle('lightTheme',    false);
    state.settings.lowSpec        = readToggle('lowSpec',        false);

    // Sliders
    state.settings.musicVol  = parseInt(document.getElementById('sVolMusic')?.value)   || 80;
    state.settings.sfxVol    = parseInt(document.getElementById('sVolSFX')?.value)     || 80;
    state.settings.uiScale   = parseInt(document.getElementById('sUIScale')?.value)    || 100;
    state.settings.zoneScale = parseInt(document.getElementById('sZoneScale')?.value)  || 100;

    // SFX individuels
    if (!state.settings.sfxIndividual) state.settings.sfxIndividual = {};
    el?.querySelectorAll('.s-toggle[data-sfx-key]').forEach(btn => {
      state.settings.sfxIndividual[btn.dataset.sfxKey] = btn.dataset.on === 'true';
    });

    // Applique les effets définitifs
    document.body.classList.toggle('theme-light', state.settings.lightTheme === true);
    document.body.classList.toggle('low-spec',    state.settings.lowSpec    === true);
    document.documentElement.style.setProperty('--ui-scale',   (state.settings.uiScale   / 100).toFixed(2));
    document.documentElement.style.setProperty('--zone-scale', (state.settings.zoneScale / 100).toFixed(2));
    if (state.settings.musicEnabled) { MusicPlayer.setVolume(state.settings.musicVol / 1000); MusicPlayer.updateFromContext(); }
    else MusicPlayer.stop();

    saveState();
    detectLLM();
    SFX.play('menuClose');
    document.getElementById('settingsModal')?.classList.remove('active');

    // Rechargement auto si sprites classiques ou thème changé (modifications visuelles globales)
    const needsReload = (_settingsSnap?.classicSprites !== state.settings.classicSprites)
                     || (_settingsLangSnap             !== state.lang);
    if (needsReload) {
      setTimeout(() => location.reload(true), 150);
    } else {
      renderAll();
    }
  });
}

// ════════════════════════════════════════════════════════════════
// 21.  GAME LOOP & BOOT
// ════════════════════════════════════════════════════════════════
// 20.  TRAINING ROOM
// ════════════════════════════════════════════════════════════════

let _trSearch = '';           // persisté entre re-renders
let _trSelected = new Set(); // IDs cochés pour ajout groupé

function renderTrainingTab() {
  const tab = (activeTab === 'tabPC' && pcView === 'training')
    ? document.getElementById('trainingInPC')
    : document.getElementById('tabTraining');
  if (!tab) return;

  const tr = state.trainingRoom;
  const slots = 6;
  const inRoom = new Set(tr.pokemon);
  const teamIds = new Set([...state.gang.bossTeam]);
  for (const a of state.agents) a.team.forEach(id => teamIds.add(id));

  let slotsHtml = '';
  for (let i = 0; i < slots; i++) {
    const pkId = tr.pokemon[i];
    const p = pkId ? state.pokemons.find(pk => pk.id === pkId) : null;
    if (p) {
      slotsHtml += `<div class="training-slot filled" data-tr-remove="${p.id}">
        <img src="${pokeSprite(p.species_en, p.shiny)}" style="width:52px;height:52px;${p.shiny?'filter:drop-shadow(0 0 4px var(--gold))':''}">
        <div style="font-size:8px;margin-top:2px">${speciesName(p.species_en)}</div>
        <div style="font-size:8px;color:var(--text-dim)">Lv.${p.level} ${'*'.repeat(p.potential)}</div>
        <button class="tr-remove-btn" data-tr-remove="${p.id}" style="margin-top:4px;font-size:8px;padding:2px 6px;background:var(--bg);border:1px solid var(--red);border-radius:var(--radius-sm);color:var(--red);cursor:pointer">Retirer</button>
      </div>`;
    } else {
      slotsHtml += `<div class="training-slot empty"><span style="color:var(--text-dim);font-size:8px">Slot libre</span></div>`;
    }
  }

  // Pokemon not in room, not in team, not in pension — filtered by search
  const q = _trSearch.toLowerCase();
  const freeSlots = slots - tr.pokemon.length;
  const pensionIds = new Set([state.pension?.slotA, state.pension?.slotB].filter(Boolean));
  const allCandidates = state.pokemons
    .filter(p => !inRoom.has(p.id) && !teamIds.has(p.id) && !pensionIds.has(p.id) && p.level < 100)
    .sort((a, b) => getPokemonPower(b) - getPokemonPower(a));
  const candidates = q
    ? allCandidates.filter(p => speciesName(p.species_en).toLowerCase().includes(q) || p.species_en.includes(q))
    : allCandidates;

  // Nettoyer la sélection si les IDs ne sont plus valides
  _trSelected = new Set([..._trSelected].filter(id => candidates.find(p => p.id === id)));

  const addableCount = Math.min(_trSelected.size, freeSlots);
  const candidatesHtml = candidates.map(p => {
    const checked = _trSelected.has(p.id);
    return `<label class="tr-candidate" data-tr-add="${p.id}" style="display:flex;align-items:center;gap:8px;padding:6px;border-bottom:1px solid var(--border);cursor:pointer;background:${checked ? 'rgba(68,136,204,.12)' : ''}">
      <input type="checkbox" class="tr-check" data-id="${p.id}" ${checked ? 'checked' : ''} style="width:14px;height:14px;cursor:pointer;accent-color:var(--blue)">
      <img src="${pokeSprite(p.species_en, p.shiny)}" style="width:32px;height:32px">
      <div style="flex:1">
        <div style="font-size:10px">${speciesName(p.species_en)} ${'*'.repeat(p.potential)}${p.shiny ? ' ✨' : ''}</div>
        <div style="font-size:9px;color:var(--text-dim)">Lv.${p.level}</div>
      </div>
    </label>`;
  }).join('') || `<div style="color:var(--text-dim);font-size:10px;padding:12px">Aucun Pokemon disponible</div>`;

  const recentLog = (tr.log || []).slice(-8).reverse().map(e => {
    let color = 'var(--text-dim)';
    if (e.includes('[W]')) color = 'var(--gold)';
    else if (e.includes('[L]')) color = 'var(--red-dim, var(--red))';
    return `<div style="font-size:9px;color:${color};padding:2px 0">${e}</div>`;
  }).join('') || '<div style="font-size:9px;color:var(--text-dim)">Aucun evenement</div>';

  // Last fight display
  let lastFightHtml = '';
  if (tr.lastFight) {
    const { winner, loser } = tr.lastFight;
    lastFightHtml = `
      <div style="font-family:var(--font-pixel);font-size:9px;color:var(--text-dim);margin-bottom:6px">DERNIER COMBAT</div>
      <div style="display:flex;align-items:center;gap:8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px;margin-bottom:12px">
        <div style="text-align:center">
          <img src="${pokeSprite(winner.species_en)}" style="width:48px;height:48px">
          <div style="font-size:8px;color:var(--gold)">${speciesName(winner.species_en)}</div>
          <div style="font-size:7px;color:var(--text-dim)">Lv.${winner.level} [W]</div>
        </div>
        <div style="font-family:var(--font-pixel);font-size:10px;color:var(--text-dim)">VS</div>
        <div style="text-align:center;transform:scaleX(-1)">
          <img src="${pokeSprite(loser.species_en)}" style="width:48px;height:48px">
          <div style="font-size:8px;color:var(--red);transform:scaleX(-1)">${speciesName(loser.species_en)}</div>
          <div style="font-size:7px;color:var(--text-dim);transform:scaleX(-1)">Lv.${loser.level} [L]</div>
        </div>
      </div>`;
  }

  const roomLevel = tr.level || 1;
  const upgradeCost = Math.round(5000 * Math.pow(2, roomLevel - 1));
  const mult = Math.round((1 + 0.25 * (roomLevel - 1)) * 100);
  const winXPPreview = Math.round(25 * (mult / 100) * 1.25);

  tab.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 300px;gap:16px;padding:12px">
      <div>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
          <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold)">SALLE D\'ENTRAINEMENT</div>
          <div style="font-size:9px;color:var(--text-dim)">Niv.${roomLevel} — XP x${mult}%</div>
          ${tr.pokemon.length > 0 ? `<button id="btnTrClearAll" style="margin-left:auto;font-family:var(--font-pixel);font-size:8px;padding:4px 8px;background:var(--bg);border:1px solid var(--red);border-radius:var(--radius-sm);color:var(--red);cursor:pointer">Tout retirer</button>` : ''}
        </div>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px">
          <div style="flex:1;font-size:9px;color:var(--text-dim)">
            <b style="color:var(--text)">Melee generale</b> — Mode actif : gagnant +${winXPPreview} XP (x1.25), perdant +${Math.round(10*(mult/100))} XP
          </div>
          <button id="btnTrainingUpgrade" style="font-family:var(--font-pixel);font-size:8px;padding:6px 10px;background:var(--bg);border:2px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">
            AMELIORER<br>${upgradeCost.toLocaleString()}P
          </button>
        </div>
        <div style="font-size:10px;color:var(--text-dim);margin-bottom:12px">
          Min. 2 Pokemon pour s\'entrainer. Combat toutes les 60s.
        </div>
        ${lastFightHtml}
        <div class="training-slots" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">${slotsHtml}</div>
        <div style="font-family:var(--font-pixel);font-size:9px;color:var(--text-dim);margin-bottom:8px">JOURNAL</div>
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px;max-height:120px;overflow-y:auto">${recentLog}</div>
      </div>
      <div>
        <div style="font-family:var(--font-pixel);font-size:9px;color:var(--text-dim);margin-bottom:8px">AJOUTER UN POKEMON</div>
        <input id="trSearchInput" type="text" placeholder="Rechercher…" value="${_trSearch}"
          style="width:100%;padding:6px 8px;margin-bottom:6px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:10px;box-sizing:border-box;outline:none">
        ${_trSelected.size > 0 ? `
        <button id="btnTrAddSelected" style="width:100%;margin-bottom:6px;padding:6px;background:var(--bg);border:1px solid var(--blue);border-radius:var(--radius-sm);color:var(--blue);font-family:var(--font-pixel);font-size:8px;cursor:pointer">
          + Ajouter ${addableCount} sélectionné${addableCount > 1 ? 's' : ''} (${freeSlots} slot${freeSlots > 1 ? 's' : ''} libre${freeSlots > 1 ? 's' : ''})
        </button>` : ''}
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);max-height:400px;overflow-y:auto">${candidatesHtml}</div>
      </div>
    </div>`;

  // Clear all training slots
  document.getElementById('btnTrClearAll')?.addEventListener('click', () => {
    state.trainingRoom.pokemon = [];
    saveState();
    notify('Salle d\'entrainement vidée.', 'success');
    renderTrainingTab();
  });

  // Upgrade button
  document.getElementById('btnTrainingUpgrade')?.addEventListener('click', () => {
    const lvl = state.trainingRoom.level || 1;
    const cost = Math.round(5000 * Math.pow(2, lvl - 1));
    if (state.gang.money < cost) { notify('Fonds insuffisants.'); return; }
    state.gang.money -= cost;
    state.stats.totalMoneySpent = (state.stats.totalMoneySpent || 0) + cost;
    state.trainingRoom.level = lvl + 1;
    saveState();
    updateTopBar();
    notify(`Salle d'entrainement Niv.${state.trainingRoom.level} !`, 'gold');
    renderTrainingTab();
  });

  tab.querySelectorAll('.tr-remove-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const id = btn.dataset.trRemove;
      state.trainingRoom.pokemon = state.trainingRoom.pokemon.filter(x => x !== id);
      saveState();
      renderTrainingTab();
    });
  });
  // Recherche — filtre en temps réel sans re-render complet
  tab.querySelector('#trSearchInput')?.addEventListener('input', e => {
    _trSearch = e.target.value;
    renderTrainingTab();
  });

  // Checkboxes — toggle sélection
  tab.querySelectorAll('.tr-check').forEach(cb => {
    cb.addEventListener('change', e => {
      e.stopPropagation();
      const id = cb.dataset.id;
      if (cb.checked) _trSelected.add(id);
      else _trSelected.delete(id);
      renderTrainingTab();
    });
  });

  // Clic sur une ligne = toggle checkbox
  tab.querySelectorAll('.tr-candidate').forEach(el => {
    el.addEventListener('click', e => {
      if (e.target.type === 'checkbox') return; // géré par le cb lui-même
      const cb = el.querySelector('.tr-check');
      if (!cb) return;
      cb.checked = !cb.checked;
      const id = el.dataset.trAdd;
      if (cb.checked) _trSelected.add(id);
      else _trSelected.delete(id);
      renderTrainingTab();
    });
  });

  // Bouton "Ajouter X sélectionnés"
  tab.querySelector('#btnTrAddSelected')?.addEventListener('click', () => {
    const availSlots = 6 - state.trainingRoom.pokemon.length;
    let added = 0;
    for (const id of _trSelected) {
      if (added >= availSlots) break;
      if (!state.trainingRoom.pokemon.includes(id)) {
        removePokemonFromAllAssignments(id);
        state.trainingRoom.pokemon.push(id);
        added++;
      }
    }
    _trSelected.clear();
    saveState();
    notify(`${added} Pokémon ajouté${added > 1 ? 's' : ''} à la salle`, 'success');
    renderTrainingTab();
  });
}

function trainingRoomTick() {
  const room = state.trainingRoom;
  if (!room || room.pokemon.length < 2) return;

  // Collect valid Pokémon objects
  const fighters = room.pokemon
    .map(id => state.pokemons.find(p => p.id === id))
    .filter(Boolean);
  if (fighters.length < 2) return;

  // Room level multiplier: each upgrade adds 25% efficiency
  const roomLevel = room.level || 1;
  const mult = 1 + 0.25 * (roomLevel - 1);

  // Pick 2 random fighters
  const shuffled = [...fighters].sort(() => Math.random() - 0.5);
  const pA = shuffled[0];
  const pB = shuffled[1];

  // Simulate fight (±25% randomness)
  const powA = getPokemonPower(pA) * (0.75 + Math.random() * 0.5);
  const powB = getPokemonPower(pB) * (0.75 + Math.random() * 0.5);
  const winner = powA >= powB ? pA : pB;
  const loser  = powA >= powB ? pB : pA;

  // XP: winner gets 1.25x bonus (mêlée générale), loser still learns
  const winXP  = Math.round(25 * mult * 1.25);
  const loseXP = Math.round(10 * mult);
  const prevWinnerName = speciesName(winner.species_en);
  const prevLoserName  = speciesName(loser.species_en);
  levelUpPokemon(winner, winXP);
  levelUpPokemon(loser, loseXP);

  const msg = `${prevWinnerName} [W] bat ${prevLoserName} [L] (+${winXP} / +${loseXP} XP)`;
  room.log.push(msg);

  // Store last fight for visual display
  room.lastFight = {
    winner: { species_en: winner.species_en, level: winner.level },
    loser:  { species_en: loser.species_en,  level: loser.level  },
  };

  // Everyone else gets passive XP
  const passiveXP = Math.round(6 * mult);
  for (const p of fighters) {
    if (p.id !== pA.id && p.id !== pB.id) levelUpPokemon(p, passiveXP);
  }

  // Check for evolutions in training room
  for (const p of fighters) {
    const nameBefore = speciesName(p.species_en);
    const evolved = tryAutoEvolution(p);
    if (evolved) {
      const m = `${nameBefore} evolue en ${speciesName(p.species_en)} dans la salle !`;
      room.log.push(m);
      notify(m, 'gold');
    }
  }

  // Random events: potential gain
  for (const p of fighters) {
    if (Math.random() < 0.002 && p.potential < 5) {
      p.potential++;
      const m = `${speciesName(p.species_en)} a gagne du potentiel en s'entrainant ! (${p.potential}*)`;
      room.log.push(m);
      notify(m, 'gold');
    }
  }

  if (room.log.length > 50) room.log = room.log.slice(-50);

  saveState();
  if (activeTab === 'tabTraining' || (activeTab === 'tabPC' && pcView === 'training')) renderTrainingTab();
}

// ════════════════════════════════════════════════════════════════
// 21.  SCIENCE LAB (potential upgrade)
// ════════════════════════════════════════════════════════════════

let labSelectedId = null;
let labShowAll = false; // false = seulement mutations réalisables

function renderLabTabInEl(tab) {
  if (!tab) return;

  const teamIds = new Set([...state.gang.bossTeam]);
  for (const a of state.agents) a.team.forEach(id => teamIds.add(id));
  const pensionSet = new Set([state.pension?.slotA, state.pension?.slotB].filter(Boolean));

  // Tous les Pokémon améliorables
  const allUpgradeable = state.pokemons
    .filter(p => p.potential < 5)
    .sort((a, b) => b.potential - a.potential || getPokemonPower(b) - getPokemonPower(a));

  // Seulement ceux dont la mutation est réalisable maintenant
  const possible = allUpgradeable.filter(p => {
    const cost = POT_UPGRADE_COSTS[p.potential - 1] || 99;
    const donors = state.pokemons.filter(d =>
      d.species_en === p.species_en && d.id !== p.id &&
      !d.shiny && d.potential <= p.potential &&
      !teamIds.has(d.id) && !state.trainingRoom.pokemon?.includes(d.id) &&
      !pensionSet.has(d.id)
    );
    return donors.length >= cost;
  });

  const displayList = labShowAll ? allUpgradeable : possible;
  const selected = labSelectedId ? state.pokemons.find(p => p.id === labSelectedId) : null;

  // ── Panneau mutation ────────────────────────────────────────
  let mutationHtml = `
    <div style="color:var(--text-dim);font-size:9px;padding:16px;text-align:center;line-height:1.6">
      Sélectionne un Pokémon<br><br>
      <span style="font-size:8px">Par défaut, seules les mutations<br>réalisables sont affichées.</span>
    </div>`;
  if (selected) {
    const cost = POT_UPGRADE_COSTS[selected.potential - 1] || 99;
    const donors = state.pokemons.filter(d =>
      d.species_en === selected.species_en && d.id !== selected.id &&
      !d.shiny && d.potential <= selected.potential &&
      !teamIds.has(d.id) && !state.trainingRoom.pokemon?.includes(d.id) &&
      !pensionSet.has(d.id)
    );
    const canUpgrade = donors.length >= cost && selected.potential < 5;
    mutationHtml = `
      <div style="text-align:center;margin-bottom:12px">
        <img src="${pokeSprite(selected.species_en, selected.shiny)}" style="width:80px;height:80px">
        <div style="font-family:var(--font-pixel);font-size:10px;margin-top:4px">${speciesName(selected.species_en)}</div>
        <div style="font-size:10px;color:var(--gold)">${'*'.repeat(selected.potential)} → ${'*'.repeat(selected.potential + 1)}</div>
      </div>
      <div style="font-size:10px;margin-bottom:8px">
        <div>Potentiel : <b>${selected.potential}/5</b></div>
        <div>Spécimens : <b style="color:${donors.length >= cost ? 'var(--green)' : 'var(--red)'}">${donors.length}/${cost}</b></div>
      </div>
      <div style="font-size:8px;color:var(--text-dim);margin-bottom:10px">Équipe + Formation protégées.</div>
      <button id="btnLabUpgrade" style="width:100%;font-size:10px;padding:8px;background:var(--bg);
        border:2px solid ${canUpgrade ? 'var(--gold)' : 'var(--border)'};border-radius:var(--radius-sm);
        color:${canUpgrade ? 'var(--gold)' : 'var(--text-dim)'};cursor:${canUpgrade ? 'pointer' : 'default'}"
        ${canUpgrade ? '' : 'disabled'}>
        ${canUpgrade ? '⚗ MUTER LE POTENTIEL' : 'Spécimens insuffisants'}
      </button>
      <div style="margin-top:12px">
        <div style="font-size:8px;color:var(--text-dim);margin-bottom:4px">COÛTS</div>
        ${POT_UPGRADE_COSTS.map((c, i) =>
          `<div style="font-size:8px;${selected.potential - 1 === i ? 'color:var(--gold)' : 'color:var(--text-dim)'}">
            ${'★'.repeat(i+1)} → ${'★'.repeat(i+2)}: ${c} specimens
          </div>`
        ).join('')}
      </div>`;
  }

  // ── Panneau tracker ─────────────────────────────────────────
  const tracked = state.lab?.trackedSpecies || [];
  // Build a quick species list from owned pokémon for the selector
  const ownedSpecies = [...new Set(state.pokemons.map(p => p.species_en))].sort((a, b) =>
    speciesName(a).localeCompare(speciesName(b))
  );
  const trackerHtml = `
    <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold);margin-bottom:8px">🔍 TRACKER</div>
    <div style="display:flex;gap:6px;margin-bottom:10px">
      <select id="labTrackerSel" style="flex:1;font-size:9px;background:var(--bg);color:var(--text);border:1px solid var(--border);border-radius:3px;padding:3px">
        <option value="">— Espèce —</option>
        ${ownedSpecies.map(en => `<option value="${en}">${speciesName(en)}</option>`).join('')}
      </select>
      <button id="btnLabTrack" style="font-size:10px;padding:3px 10px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:3px;color:var(--gold);cursor:pointer">+</button>
    </div>
    ${tracked.length === 0
      ? '<div style="font-size:9px;color:var(--text-dim)">Aucune espèce suivie.</div>'
      : tracked.map(species => {
          const owned = state.pokemons.filter(p => p.species_en === species);
          const sp = SPECIES_BY_EN[species];
          const byPot = [1,2,3,4,5].map(pot => owned.filter(p => p.potential === pot).length);
          // Check if any mutation is currently possible
          const mutPossible = [1,2,3,4].some(pot => {
            const cost = POT_UPGRADE_COSTS[pot - 1] || 99;
            const donors = owned.filter(d => d.potential === pot &&
              !teamIds.has(d.id) && !state.trainingRoom.pokemon?.includes(d.id));
            const targets = owned.filter(d => d.potential === pot);
            return targets.length > 0 && donors.length >= cost + 1;
          });
          return `<div style="border:1px solid ${mutPossible ? 'var(--gold-dim)' : 'var(--border)'};border-radius:var(--radius-sm);padding:8px;background:var(--bg);margin-bottom:6px">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
              <img src="${pokeSprite(species)}" style="width:26px;height:26px">
              <span style="font-size:9px;flex:1"><b>${speciesName(species)}</b> — <span style="color:var(--gold)">${owned.length}</span></span>
              <button class="lab-untrack" data-untrack="${species}" style="font-size:8px;padding:1px 5px;background:var(--bg);border:1px solid var(--red);border-radius:2px;color:var(--red);cursor:pointer">✕</button>
            </div>
            <div style="display:flex;gap:3px;flex-wrap:wrap">
              ${byPot.map((n, i) => `<div style="font-size:8px;padding:2px 5px;border-radius:2px;
                background:${n > 0 ? 'rgba(255,204,90,0.12)' : 'rgba(0,0,0,0)'};
                border:1px solid ${n > 0 ? 'var(--gold-dim)' : 'var(--border)'}">
                ${'★'.repeat(i+1)}: <b>${n}</b>
              </div>`).join('')}
            </div>
            ${mutPossible ? '<div style="font-size:8px;color:var(--green);margin-top:4px">⚡ Mutation possible !</div>' : ''}
          </div>`;
        }).join('')
    }`;

  // ── Liste candidates ────────────────────────────────────────
  const listHtml = displayList.map(p => {
    const cost = POT_UPGRADE_COSTS[p.potential - 1] || 99;
    const donors = state.pokemons.filter(d =>
      d.species_en === p.species_en && d.id !== p.id &&
      !d.shiny && d.potential <= p.potential &&
      !teamIds.has(d.id) && !state.trainingRoom.pokemon?.includes(d.id)
    );
    const ready = donors.length >= cost;
    return `<div class="lab-candidate" data-lab-id="${p.id}"
      style="display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid var(--border);
      cursor:pointer;background:${labSelectedId === p.id ? 'var(--bg-hover)' : ''}">
      <img src="${pokeSprite(p.species_en, p.shiny)}" style="width:36px;height:36px">
      <div style="flex:1">
        <div style="font-size:10px">${speciesName(p.species_en)} ${'★'.repeat(p.potential)}</div>
        <div style="font-size:9px;color:${ready ? 'var(--green)' : 'var(--text-dim)'}">
          ${ready ? `✓ Prêt (${donors.length}/${cost})` : `${donors.length}/${cost} spécimens`}
        </div>
      </div>
    </div>`;
  }).join('') || `<div style="color:var(--text-dim);font-size:9px;padding:14px;text-align:center">
    ${labShowAll ? 'Tous vos Pokémon sont au potentiel max' : 'Aucune mutation réalisable actuellement.<br>Activez « Tous » pour voir tous les candidats.'}
  </div>`;

  // ── Rendu principal ─────────────────────────────────────────
  tab.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 290px;gap:14px;padding:12px;min-height:400px">
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold)">LABORATOIRE</div>
          <button id="btnLabToggleAll" style="font-family:var(--font-pixel);font-size:8px;padding:3px 8px;
            background:${labShowAll ? 'var(--gold-dim)' : 'var(--bg)'};
            border:1px solid ${labShowAll ? 'var(--gold)' : 'var(--border)'};border-radius:3px;
            color:${labShowAll ? 'var(--bg)' : 'var(--text-dim)'};cursor:pointer">
            ${labShowAll ? '✓ TOUS' : 'PRÊTS seulement'}
          </button>
        </div>
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);flex:1;overflow-y:auto;max-height:520px">${listHtml}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;overflow-y:auto;max-height:600px">
        <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);padding:12px">${mutationHtml}</div>
        <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);padding:12px">${trackerHtml}</div>
      </div>
    </div>`;

  // Bind — liste
  tab.querySelectorAll('.lab-candidate').forEach(el => {
    el.addEventListener('click', () => {
      labSelectedId = el.dataset.labId;
      if (pcView === 'lab') renderPCTab(); else renderLabTab();
    });
  });

  // Bind — toggle filtre
  tab.querySelector('#btnLabToggleAll')?.addEventListener('click', () => {
    labShowAll = !labShowAll;
    if (pcView === 'lab') renderPCTab(); else renderLabTab();
  });

  // Bind — mutation
  tab.querySelector('#btnLabUpgrade')?.addEventListener('click', () => {
    if (!selected) return;
    const cost = POT_UPGRADE_COSTS[selected.potential - 1];
    const pensionSet = new Set([state.pension?.slotA, state.pension?.slotB].filter(Boolean));
    const donors = state.pokemons.filter(d =>
      d.species_en === selected.species_en && d.id !== selected.id &&
      !d.shiny && d.potential <= selected.potential &&
      !teamIds.has(d.id) && !state.trainingRoom.pokemon?.includes(d.id) &&
      !pensionSet.has(d.id)
    );
    if (donors.length < cost) return;
    const toSacrifice = donors.slice(0, cost).map(p => p.id);
    state.pokemons = state.pokemons.filter(p => !toSacrifice.includes(p.id));
    selected.potential++;
    saveState();
    _pcLastRenderKey = '';
    notify(`${speciesName(selected.species_en)} est maintenant ${'★'.repeat(selected.potential)} !`, 'gold');
    if (pcView === 'lab') renderPCTab(); else renderLabTab();
    updateTopBar();
  });

  // Bind — tracker ajouter
  tab.querySelector('#btnLabTrack')?.addEventListener('click', () => {
    const val = document.getElementById('labTrackerSel')?.value;
    if (!val) return;
    if (!state.lab.trackedSpecies.includes(val)) {
      state.lab.trackedSpecies.push(val);
      saveState();
      if (pcView === 'lab') renderPCTab(); else renderLabTab();
    }
  });

  // Bind — tracker retirer
  tab.querySelectorAll('.lab-untrack').forEach(btn => {
    btn.addEventListener('click', () => {
      state.lab.trackedSpecies = state.lab.trackedSpecies.filter(s => s !== btn.dataset.untrack);
      saveState();
      if (pcView === 'lab') renderPCTab(); else renderLabTab();
    });
  });
}

function renderLabTab() {
  const tab = document.getElementById('tabLab');
  if (!tab) return;
  renderLabTabInEl(tab);
}

// ════════════════════════════════════════════════════════════════

let agentTickInterval   = null;
let autoSaveInterval    = null;
let cooldownInterval    = null;
let _gameLoopStarted    = false;  // guard against double-start

// ════════════════════════════════════════════════════════════════
// 22.  PENSION & EGGS
// ════════════════════════════════════════════════════════════════

const EGG_HATCH_MS = {
  common:    1 * 60 * 1000,
  uncommon:  5 * 60 * 1000,
  rare:      15 * 60 * 1000,
  very_rare: 45 * 60 * 1000,
  legendary: 60 * 60 * 1000,
};
const EGG_GEN_MS = 5 * 60 * 1000; // new egg every 5 min when both slots filled

function pensionTick() {
  const p = state.pension;
  const now = Date.now();

  // Generate egg when both slots filled and timer elapsed
  if (p.slotA && p.slotB && p.eggAt && now >= p.eggAt) {
    const pkA = state.pokemons.find(pk => pk.id === p.slotA);
    const pkB = state.pokemons.find(pk => pk.id === p.slotB);
    if (pkA && pkB) {
      // Legendaries can't transmit species; if both legendary, skip egg
      const isLegA = SPECIES_BY_EN[pkA.species_en]?.rarity === 'legendary';
      const isLegB = SPECIES_BY_EN[pkB.species_en]?.rarity === 'legendary';
      if (isLegA && isLegB) {
        p.eggAt = now + EGG_GEN_MS; // reset timer, no egg from two legends
        saveState(); return;
      }
      // Non-legendary always transmits; if both non-legendary, random pick
      const parent = isLegA ? pkB : isLegB ? pkA : (Math.random() < 0.5 ? pkA : pkB);
      // Eggs always hatch at stage 1 of the evolution chain
      const baseSpeciesEn = getBaseSpecies(parent.species_en);
      const sp = SPECIES_BY_EN[baseSpeciesEn];
      if (sp && EGG_HATCH_MS[sp.rarity] !== null) {
        const hatchMs = EGG_HATCH_MS[sp.rarity] || EGG_HATCH_MS.common;
        const avgPot = Math.floor((pkA.potential + pkB.potential) / 2);
        const potential = Math.min(5, avgPot + (Math.random() < 0.2 ? 1 : 0));
        const shinyChance = (pkA.shiny && pkB.shiny) ? 0.15 : (pkA.shiny || pkB.shiny) ? 0.05 : 0.01;
        const egg = {
          id: `egg_${now}_${Math.random().toString(36).slice(2,7)}`,
          species_en: baseSpeciesEn,
          hatchAt: null,
          incubating: false,
          rarity: sp.rarity,
          potential,
          shiny: Math.random() < shinyChance,
          parentA: pkA.species_en,
          parentB: pkB.species_en,
        };
        state.eggs.push(egg);
        tryAutoIncubate();
        p.eggAt = now + EGG_GEN_MS;
        notify(`Un oeuf de ${speciesName(baseSpeciesEn)} a ete depose !${state.purchases?.autoIncubator ? ' (auto-incubé)' : ' Placez-le dans un incubateur.'}`, 'gold');
        saveState();
        if (activeTab === 'tabPC') renderPCTab();
      }
    }
  }
  // Start timer when both slots first filled
  if (p.slotA && p.slotB && !p.eggAt) {
    p.eggAt = now + EGG_GEN_MS;
    saveState();
  }
  // Clear timer if slots empty
  if (!p.slotA || !p.slotB) p.eggAt = null;

  // Hatch only incubating eggs that are ready
  const ready = state.eggs.filter(e => e.incubating && e.hatchAt && e.hatchAt <= now);
  for (const egg of ready) {
    const baseEn = getBaseSpecies(egg.species_en);
    const sp = SPECIES_BY_EN[baseEn];
    if (!sp) continue;
    const hatched = makePokemon(baseEn, 'pension', 'pokeball');
    if (hatched) {
      hatched.level = 1;
      hatched.xp = 0;
      hatched.potential = egg.potential;
      hatched.shiny = egg.shiny;
      hatched.stats = calculateStats(hatched);
      hatched.history = [{ type: 'hatched', ts: now }];
      state.pokemons.push(hatched);
      state.stats.totalCaught++;
      state.stats.eggsHatched = (state.stats.eggsHatched || 0) + 1;
      if (!state.pokedex[baseEn]) {
        state.pokedex[baseEn] = { seen: true, caught: true, shiny: egg.shiny, count: 1 };
      } else {
        state.pokedex[baseEn].caught = true;
        state.pokedex[baseEn].count++;
        if (egg.shiny) state.pokedex[baseEn].shiny = true;
      }
      notify(`L\'oeuf a eclore ! ${egg.shiny ? '[SHINY] ' : ''}${speciesName(baseEn)} Lv.1 ${'*'.repeat(egg.potential)} rejoint le PC.`, 'gold');
    }
    state.eggs = state.eggs.filter(e => e.id !== egg.id);
    saveState();
    if (activeTab === 'tabPC') renderPCTab();
  }
}

function renderPensionView(container) {
  const p = state.pension;
  const now = Date.now();
  const pkA = p.slotA ? state.pokemons.find(pk => pk.id === p.slotA) : null;
  const pkB = p.slotB ? state.pokemons.find(pk => pk.id === p.slotB) : null;

  const slotHtml = (pk, slot) => {
    if (pk) {
      return `<div class="pension-slot filled" data-pension-slot="${slot}">
        <img src="${pokeSprite(pk.species_en, pk.shiny)}" style="width:52px;height:52px">
        <div style="font-size:8px;margin-top:2px">${speciesName(pk.species_en)}</div>
        <div style="font-size:8px;color:var(--text-dim)">Lv.${pk.level} ${'*'.repeat(pk.potential)}</div>
        <button class="pension-remove-btn" data-slot="${slot}" style="margin-top:4px;font-size:8px;padding:2px 6px;background:var(--bg);border:1px solid var(--red);border-radius:var(--radius-sm);color:var(--red);cursor:pointer">Retirer</button>
      </div>`;
    }
    return `<div class="pension-slot empty" data-pension-slot="${slot}">
      <div style="font-size:9px;color:var(--text-dim)">Slot ${slot === 'slotA' ? 'A' : 'B'}</div>
      <div style="font-size:8px;color:var(--text-dim);margin-top:4px">Cliquer un Pokemon</div>
    </div>`;
  };

  const nextEggMs = p.eggAt ? Math.max(0, p.eggAt - now) : null;
  const nextEggStr = nextEggMs !== null ? `${Math.ceil(nextEggMs / 60000)}min` : '--';

  // ── Incubator slots ──
  const incubatorCount = state.inventory.incubator || 0;
  const incubatingEggs = state.eggs.filter(e => e.incubating);
  const freeSlots = incubatorCount - incubatingEggs.length;

  const incubatorHtml = (() => {
    if (incubatorCount === 0) {
      return `<div style="font-size:9px;color:var(--text-dim);padding:8px;text-align:center">
        Aucun incubateur — achetez-en un au Marche (15 000P)
      </div>`;
    }
    let html = '';
    // Active incubations
    for (const egg of incubatingEggs) {
      const rarity = egg.rarity || SPECIES_BY_EN[egg.species_en]?.rarity || 'common';
      const total = EGG_HATCH_MS[rarity] || EGG_HATCH_MS.common;
      const rem = Math.max(0, (egg.hatchAt || 0) - now);
      const pct = total > 0 ? Math.round((1 - rem / total) * 100) : 100;
      const remStr = rem <= 0 ? 'Pret !' : rem < 60000 ? `${Math.ceil(rem / 1000)}s` : `${Math.ceil(rem / 60000)}min`;
      html += `<div style="display:flex;align-items:center;gap:8px;padding:8px;border:1px solid var(--gold-dim);border-radius:var(--radius-sm);margin-bottom:6px;background:var(--bg)">
        <img src="${ITEM_SPRITE_URLS.incubator}" style="width:24px;height:24px">
        <img src="${pokeSprite(egg.species_en)}" style="width:36px;height:36px">
        <div style="flex:1">
          <div style="font-size:9px">${speciesName(egg.species_en)}${egg.shiny ? ' [S]' : ''} ${'*'.repeat(egg.potential)}</div>
          <div style="background:var(--border);border-radius:2px;height:4px;margin-top:4px">
            <div style="background:var(--gold-dim);height:4px;border-radius:2px;width:${pct}%"></div>
          </div>
          <div style="font-size:8px;color:var(--gold);margin-top:2px">${remStr}</div>
        </div>
      </div>`;
    }
    // Free slots
    for (let i = 0; i < freeSlots; i++) {
      html += `<div style="display:flex;align-items:center;gap:8px;padding:8px;border:1px dashed var(--border);border-radius:var(--radius-sm);margin-bottom:6px;color:var(--text-dim);font-size:9px">
        <img src="${ITEM_SPRITE_URLS.incubator}" style="width:24px;height:24px;opacity:.4">
        <span>Incubateur libre — cliquez un oeuf ci-dessous</span>
      </div>`;
    }
    return html;
  })();

  // ── Waiting eggs (not incubating) ──
  const waitingEggs = state.eggs.filter(e => !e.incubating);
  const waitingHtml = waitingEggs.length
    ? waitingEggs.map(egg => {
        const rarity = egg.rarity || SPECIES_BY_EN[egg.species_en]?.rarity || 'common';
        const hatchTime = EGG_HATCH_MS[rarity] || EGG_HATCH_MS.common;
        const hatchStr = hatchTime < 60000 ? `${hatchTime/1000}s` : `${hatchTime/60000}min`;
        // Prix de vente : valeur marchande × 50 %
        const sellPrice = Math.round((BASE_PRICE[rarity] || 100) * (POTENTIAL_MULT[(egg.potential || 1) - 1] || 1) * 0.5);
        // Afficher parents sans révéler le Pokémon intérieur
        const parentsStr = egg.mystery
          ? 'Oeuf Mystère'
          : (egg.parentA && egg.parentB)
            ? `${speciesName(egg.parentA)} × ${speciesName(egg.parentB)}`
            : '? × ?';
        return `<div style="display:flex;align-items:center;gap:8px;padding:6px;border-bottom:1px solid var(--border)">
          <img src="${ITEM_SPRITE_URLS.incubator}" style="width:36px;height:36px;opacity:.85;image-rendering:pixelated">
          <div style="flex:1">
            <div style="font-size:9px;color:var(--gold)">Oeuf ${rarity} ${'*'.repeat(egg.potential || 1)}</div>
            <div style="font-size:8px;color:var(--text-dim)">${parentsStr} — éclosion : ${hatchStr}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:3px;align-items:flex-end">
            ${freeSlots > 0
              ? `<button class="pension-incubate-btn" data-egg-id="${egg.id}" style="font-size:8px;padding:3px 8px;background:var(--bg);border:1px solid var(--gold-dim);border-radius:var(--radius-sm);color:var(--gold);cursor:pointer">Incuber</button>`
              : ''}
            <button class="pension-sell-egg-btn" data-egg-id="${egg.id}" data-sell-price="${sellPrice}" style="font-size:8px;padding:3px 8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);cursor:pointer">Vendre ${sellPrice.toLocaleString()}₽</button>
          </div>
        </div>`;
      }).join('')
    : `<div style="color:var(--text-dim);font-size:9px;padding:8px">Aucun oeuf en attente</div>`;

  // Pokemon picker (not in pension, not in team, not in training room, not legendary)
  const usedIds = new Set([p.slotA, p.slotB].filter(Boolean));
  const teamIds = new Set([...state.gang.bossTeam]);
  for (const a of state.agents) a.team.forEach(id => teamIds.add(id));
  const trainingIds = new Set(state.trainingRoom?.pokemon || []);

  // Récupère la valeur de recherche courante (persistée entre re-renders)
  const pensionQ = (container.querySelector('#pensionSearchInput')?.value || '').toLowerCase();

  const allPensionCandidates = state.pokemons
    .filter(pk => !usedIds.has(pk.id) && !teamIds.has(pk.id) && !trainingIds.has(pk.id) && SPECIES_BY_EN[pk.species_en]?.rarity !== 'legendary')
    .sort((a, b) => getPokemonPower(b) - getPokemonPower(a));
  const candidates = pensionQ
    ? allPensionCandidates.filter(pk => speciesName(pk.species_en).toLowerCase().includes(pensionQ) || pk.species_en.includes(pensionQ))
    : allPensionCandidates;

  const pickerHtml = candidates.map(pk =>
    `<div class="pension-candidate" data-pk-id="${pk.id}" style="display:flex;align-items:center;gap:8px;padding:6px;border-bottom:1px solid var(--border);cursor:pointer">
      <img src="${pokeSprite(pk.species_en, pk.shiny)}" style="width:32px;height:32px">
      <div style="flex:1">
        <div style="font-size:10px">${speciesName(pk.species_en)} ${'*'.repeat(pk.potential)}${pk.shiny ? ' ✨' : ''}</div>
        <div style="font-size:9px;color:var(--text-dim)">Lv.${pk.level}</div>
      </div>
    </div>`
  ).join('') || `<div style="color:var(--text-dim);font-size:10px;padding:12px">Aucun Pokemon disponible</div>`;

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 220px;gap:16px;padding:12px">
      <div>
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
          <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold)">PENSION POKEMON</div>
          ${(p.slotA || p.slotB) ? `<button id="btnPensionClearAll" style="margin-left:auto;font-family:var(--font-pixel);font-size:8px;padding:4px 8px;background:var(--bg);border:1px solid var(--red);border-radius:var(--radius-sm);color:var(--red);cursor:pointer">Tout retirer</button>` : ''}
        </div>
        <div style="font-size:10px;color:var(--text-dim);margin-bottom:12px">Deposez deux Pokemon — un oeuf sera pond tous les ${EGG_GEN_MS/60000}min.</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          ${slotHtml(pkA, 'slotA')}
          ${slotHtml(pkB, 'slotB')}
        </div>
        ${pkA && pkB ? `<div style="font-size:9px;color:var(--text-dim);padding:6px 8px;background:var(--bg);border-radius:var(--radius-sm);margin-bottom:12px">Prochain oeuf dans : <b style="color:var(--gold)">${nextEggStr}</b></div>` : ''}

        <div style="font-family:var(--font-pixel);font-size:9px;color:var(--gold);margin-bottom:6px">INCUBATEURS (${incubatingEggs.length}/${incubatorCount})</div>
        <div style="margin-bottom:12px">${incubatorHtml}</div>

        <div style="font-family:var(--font-pixel);font-size:9px;color:var(--text-dim);margin-bottom:6px">OEUFS EN ATTENTE (${waitingEggs.length})</div>
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);max-height:180px;overflow-y:auto">${waitingHtml}</div>
      </div>
      <div>
        <div style="font-family:var(--font-pixel);font-size:9px;color:var(--text-dim);margin-bottom:8px">CHOISIR UN POKEMON</div>
        <input id="pensionSearchInput" type="text" placeholder="Rechercher…" value="${pensionQ}"
          style="width:100%;padding:6px 8px;margin-bottom:6px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:10px;box-sizing:border-box;outline:none">
        <div style="font-size:8px;color:var(--text-dim);margin-bottom:6px">Cliquer pour placer dans slot vide</div>
        <div id="pensionPicker" style="background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);max-height:460px;overflow-y:auto">${pickerHtml}</div>
      </div>
    </div>`;

  // Clear all pension slots
  container.querySelector('#btnPensionClearAll')?.addEventListener('click', () => {
    state.pension.slotA = null;
    state.pension.slotB = null;
    state.pension.eggAt = null;
    saveState();
    notify('Pension vidée.', 'success');
    renderPensionView(container);
  });

  // Recherche pension
  container.querySelector('#pensionSearchInput')?.addEventListener('input', () => {
    renderPensionView(container);
  });

  container.querySelectorAll('.pension-remove-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      state.pension[btn.dataset.slot] = null;
      state.pension.eggAt = null;
      saveState();
      renderPensionView(container);
    });
  });

  // Place egg in incubator
  container.querySelectorAll('.pension-incubate-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      if (freeSlots <= 0) { notify('Pas d\'incubateur libre.'); return; }
      const egg = state.eggs.find(eg => eg.id === btn.dataset.eggId);
      if (!egg || egg.incubating) return;
      const rarity = egg.rarity || SPECIES_BY_EN[egg.species_en]?.rarity || 'common';
      egg.incubating = true;
      egg.hatchAt = Date.now() + (EGG_HATCH_MS[rarity] || EGG_HATCH_MS.common);
      saveState();
      notify(`Oeuf de ${speciesName(egg.species_en)} place en incubateur !`, 'gold');
      renderPensionView(container);
    });
  });

  // Sell waiting egg
  container.querySelectorAll('.pension-sell-egg-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const egg = state.eggs.find(eg => eg.id === btn.dataset.eggId);
      if (!egg || egg.incubating) return;
      const price = parseInt(btn.dataset.sellPrice) || 0;
      const rarity = egg.rarity || 'common';
      const parentsStr = egg.mystery ? 'Oeuf Mystère' : (egg.parentA && egg.parentB) ? `${speciesName(egg.parentA)} × ${speciesName(egg.parentB)}` : 'oeuf';
      showConfirm(
        `Vendre cet oeuf (${parentsStr}) pour ${price.toLocaleString()}₽ ?<br><span style="color:var(--text-dim);font-size:11px">Vous ne saurez jamais quel Pokémon était dedans.</span>`,
        () => {
          state.eggs = state.eggs.filter(eg => eg.id !== egg.id);
          state.gang.money += price;
          state.stats.totalMoneyEarned = (state.stats.totalMoneyEarned || 0) + price;
          saveState();
          updateTopBar();
          notify(`Oeuf vendu pour ${price.toLocaleString()}₽`, 'success');
          renderPensionView(container);
        },
        null,
        { danger: true, confirmLabel: 'Vendre', cancelLabel: 'Garder' }
      );
    });
  });

  container.querySelectorAll('.pension-candidate').forEach(el => {
    el.addEventListener('click', () => {
      const pkId = el.dataset.pkId;
      removePokemonFromAllAssignments(pkId);
      if (!state.pension.slotA) state.pension.slotA = pkId;
      else if (!state.pension.slotB && state.pension.slotA !== pkId) state.pension.slotB = pkId;
      else return;
      saveState();
      renderPensionView(container);
    });
  });
}

function startGameLoop() {
  // Guard: only start once — prevents interval accumulation on hot-reload
  if (_gameLoopStarted) return;
  _gameLoopStarted = true;

  // Agent automation every 2 seconds (agents interact with visible spawns)
  agentTickInterval = setInterval(agentTick, 2000);

  // Passive agent tick every 10 seconds (closed zones, background activity)
  setInterval(passiveAgentTick, 10000);

  // Hourly quests countdown refresh (every 10s when market tab open)
  setInterval(() => {
    if (activeTab === 'tabMarket') renderQuestPanel();
  }, 10000);

  // Hourly quest reset check (every minute)
  setInterval(() => {
    if (state.missions?.hourly && Date.now() - state.missions.hourly.reset >= HOUR_MS) {
      initHourlyQuests();
      if (activeTab === 'tabMarket') renderQuestPanel();
      notify('⏰ Nouvelles quêtes horaires disponibles !', 'gold');
    }
  }, 60000);

  // Market decay every 5 minutes
  setInterval(decayMarketSales, 300000);

  // Remote version polling every hour (detects new deploys)
  setInterval(pollRemoteVersion, 3600000);
  setTimeout(pollRemoteVersion, 15000); // first check 15s after boot

  // Daily reload at 12h00 + 00h00 to flush new versions
  startDailyReloadSchedule();

  // Auto-save every 10 seconds
  autoSaveInterval = setInterval(saveState, 10000);

  // Cooldown tick removed — cooldowns no longer exist in gameplay

  // Training room tick every 60 seconds
  setInterval(trainingRoomTick, 60000);

  // Pension / egg tick every 30 seconds
  setInterval(pensionTick, 30000);

  // Passive XP for pokemon in teams every 30 seconds
  setInterval(() => {
    const teamIds = new Set([...state.gang.bossTeam]);
    for (const a of state.agents) a.team.forEach(id => teamIds.add(id));
    if (teamIds.size === 0) return;
    let leveled = false;
    for (const id of teamIds) {
      const p = state.pokemons.find(pk => pk.id === id);
      if (p) leveled = levelUpPokemon(p, 3) || leveled; // 3 XP/30s passif
    }
    if (leveled) saveState();
  }, 30000);

  // Zone timers refresh every second (for boost countdowns + stats)
  setInterval(() => {
    if (openZones.size === 0) return;
    for (const zoneId of openZones) {
      updateZoneTimers(zoneId);
    }
  }, 1000);

}

// ════════════════════════════════════════════════════════════════
// 23.  SUPABASE — AUTH & CLOUD SAVE
// ════════════════════════════════════════════════════════════════

let _supabase    = null;
let supaSession = null;
let supaLastSync = null;   // timestamp dernier cloud save réussi
let supaSyncing  = false;

// ── Helpers ───────────────────────────────────────────────────────
function supaConfigured() {
  return typeof SUPABASE_URL !== 'undefined'
    && SUPABASE_URL
    && !SUPABASE_URL.includes('VOTRE_PROJET');
}

// ── Init ──────────────────────────────────────────────────────────
function initSupabase() {
  if (!supaConfigured()) return;
  if (typeof window.supabase === 'undefined') {
    console.warn('PokéForge: Supabase SDK non chargé.');
    return;
  }
  try {
    _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Restaurer la session existante (localStorage Supabase)
    _supabase.auth.getSession().then(({ data }) => {
      supaSession = data.session || null;
      updateSupaIndicator();
      if (activeTab === 'tabCompte') renderCompteTab();
    });

    // Écouter les changements d'auth (login / logout / refresh token)
    _supabase.auth.onAuthStateChange((_event, session) => {
      supaSession = session;
      updateSupaIndicator();
      updateSupaTabLabel();
      if (activeTab === 'tabCompte') renderCompteTab();
    });
  } catch (e) {
    console.warn('PokéForge: Supabase init error', e);
  }
}

// ── Auth ──────────────────────────────────────────────────────────
async function supaSignIn(email, password) {
  if (!_supabase) return { error: 'Supabase non configuré' };
  const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  // Après connexion : proposer de charger la save cloud si plus récente
  await supaCheckCloudLoad();
  return { data };
}

async function supaSignUp(email, password) {
  if (!_supabase) return { error: 'Supabase non configuré' };
  const { data, error } = await _supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };
  return { data };
}

async function supaSignOut() {
  if (!_supabase) return;
  await _supabase.auth.signOut();
  supaLastSync = null;
  supaSession  = null;
  updateSupaIndicator();
  updateSupaTabLabel();
  if (activeTab === 'tabCompte') renderCompteTab();
}

// ── Cloud Save ────────────────────────────────────────────────────
async function supaCloudSave() {
  if (!_supabase || !supaSession) return;
  if (supaSyncing) return;
  supaSyncing = true;
  updateSupaIndicator();
  try {
    const { error } = await _supabase
      .from('player_saves')
      .upsert({
        user_id:  supaSession.user.id,
        slot:     activeSaveSlot,
        state:    state,
        saved_at: new Date().toISOString(),
      });
    if (!error) {
      supaLastSync = Date.now();
      await supaUpdateLeaderboard();
    }
  } catch { /* silencieux — la save locale est toujours là */ }
  supaSyncing = false;
  updateSupaIndicator();
  if (activeTab === 'tabCompte') renderCompteTab();
}

async function supaCheckCloudLoad() {
  if (!_supabase || !supaSession) return;
  const { data, error } = await _supabase
    .from('player_saves')
    .select('state, saved_at')
    .eq('user_id', supaSession.user.id)
    .eq('slot', activeSaveSlot)
    .single();
  if (error || !data) return;

  const cloudTs = new Date(data.saved_at).getTime();
  const localTs = state._savedAt || 0;
  if (cloudTs > localTs) {
    const fmt = new Date(cloudTs).toLocaleString('fr-FR');
    showConfirm(
      `Une sauvegarde cloud plus récente existe (${fmt}).<br>Charger la sauvegarde cloud ? <span style="color:var(--text-dim);font-size:11px">(La save locale sera remplacée)</span>`,
      () => {
        state = migrate(data.state);
        saveState();
        renderAll();
        notify('Sauvegarde cloud chargée !', 'success');
      },
      null,
      { confirmLabel: 'Charger', cancelLabel: 'Ignorer' }
    );
  }
}

async function supaForceCloudLoad() {
  if (!_supabase || !supaSession) return;
  const { data, error } = await _supabase
    .from('player_saves')
    .select('state, saved_at')
    .eq('user_id', supaSession.user.id)
    .eq('slot', activeSaveSlot)
    .single();
  if (error || !data) { notify('Aucune sauvegarde cloud trouvée.', 'error'); return; }

  const fmt = new Date(data.saved_at).toLocaleString('fr-FR');
  showConfirm(
    `Charger la save cloud du ${fmt} ?<br><span style="color:var(--text-dim);font-size:11px">La save locale sera écrasée.</span>`,
    () => {
      state = migrate(data.state);
      saveState();
      renderAll();
      notify('Sauvegarde cloud chargée !', 'success');
    },
    null,
    { confirmLabel: 'Charger', cancelLabel: 'Annuler', danger: true }
  );
}

async function supaUpdateLeaderboard() {
  if (!_supabase || !supaSession) return;
  const shinyCount  = (state.pokemons || []).filter(p => p.shiny).length;
  const dexCount    = Object.values(state.pokedex || {}).filter(v => v > 0).length;
  await _supabase.from('players').upsert({
    user_id:       supaSession.user.id,
    gang_name:     state.gang.name     || 'Team ???',
    boss_name:     state.gang.bossName || 'Boss',
    reputation:    state.gang.reputation  || 0,
    total_caught:  state.stats?.caught    || 0,
    total_sold:    state.stats?.sold      || 0,
    shiny_count:   shinyCount,
    pokedex_count: dexCount,
    updated_at:    new Date().toISOString(),
  });
}

// ── Top-bar indicator ─────────────────────────────────────────────
function updateSupaIndicator() {
  const el = document.getElementById('supaIndicator');
  if (!el) return;
  if (!supaConfigured()) { el.style.display = 'none'; return; }

  el.style.display = 'flex';
  if (!supaSession) {
    el.textContent = '☁';
    el.style.color = 'var(--text-dim)';
    el.title       = 'Non connecté — cliquer pour se connecter';
  } else if (supaSyncing) {
    el.textContent = '⟳';
    el.style.color = 'var(--gold)';
    el.title       = 'Synchronisation en cours…';
  } else if (supaLastSync) {
    const ago = Math.round((Date.now() - supaLastSync) / 1000);
    el.textContent = '☁';
    el.style.color = 'var(--green)';
    el.title       = `Cloud syncé il y a ${ago}s`;
  } else {
    el.textContent = '☁';
    el.style.color = '#ff9900';
    el.title       = 'Connecté — non encore syncé';
  }

  // Clic = aller sur l'onglet Compte
  el.onclick = () => switchTab('tabCompte');
}

// Mettre à jour le label du bouton tab Compte (connecté / non connecté)
function updateSupaTabLabel() {
  const btn = document.getElementById('tabBtnCompte');
  if (!btn) return;
  btn.textContent = supaSession ? '☁ Compte ●' : '☁ Compte';
  btn.style.color = supaSession ? 'var(--green)' : '';
}

// ── Compte Tab UI ─────────────────────────────────────────────────
async function renderCompteTab() {
  const tab = document.getElementById('tabCompte');
  if (!tab) return;

  if (!supaConfigured()) {
    tab.innerHTML = `
      <div style="padding:40px;text-align:center;color:var(--text-dim)">
        <div style="font-family:var(--font-pixel);font-size:12px;color:var(--gold);margin-bottom:20px">☁ COMPTE CLOUD</div>
        <div style="font-size:11px;margin-bottom:12px">Supabase non configuré.</div>
        <div style="font-size:10px;line-height:1.8">
          1. Copie <code style="color:var(--gold)">game/config.example.js</code> → <code style="color:var(--gold)">game/config.js</code><br>
          2. Remplis <code>SUPABASE_URL</code> et <code>SUPABASE_ANON_KEY</code><br>
          3. Suis le guide SQL dans <code>docs/supabase-setup.md</code>
        </div>
      </div>`;
    return;
  }

  if (!supaSession) {
    // ── Formulaire de connexion ──────────────────────────────────
    tab.innerHTML = `
      <div style="max-width:380px;margin:48px auto;padding:28px;background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius)">
        <div style="font-family:var(--font-pixel);font-size:12px;color:var(--gold);margin-bottom:8px;text-align:center">☁ COMPTE CLOUD</div>
        <div style="font-size:9px;color:var(--text-dim);text-align:center;margin-bottom:24px">
          Connecte-toi pour activer la sauvegarde cloud et le classement.
        </div>
        <div id="supaMsg" style="font-size:10px;min-height:18px;text-align:center;margin-bottom:12px"></div>
        <div style="margin-bottom:12px">
          <label style="font-size:9px;display:block;margin-bottom:4px;color:var(--text-dim);letter-spacing:.05em">EMAIL</label>
          <input id="supaEmail" type="email" placeholder="joueur@exemple.com" style="width:100%;padding:9px 10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:11px;outline:none">
        </div>
        <div style="margin-bottom:24px">
          <label style="font-size:9px;display:block;margin-bottom:4px;color:var(--text-dim);letter-spacing:.05em">MOT DE PASSE</label>
          <input id="supaPassword" type="password" placeholder="••••••••" style="width:100%;padding:9px 10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:11px;outline:none">
        </div>
        <div style="display:flex;gap:8px">
          <button id="btnSupaLogin"    style="flex:1;padding:11px;background:var(--red);border:none;border-radius:var(--radius-sm);color:#fff;font-family:var(--font-pixel);font-size:9px;cursor:pointer;letter-spacing:.04em">CONNEXION</button>
          <button id="btnSupaRegister" style="flex:1;padding:11px;background:var(--bg);border:1px solid var(--border-light);border-radius:var(--radius-sm);color:var(--text);font-family:var(--font-pixel);font-size:9px;cursor:pointer;letter-spacing:.04em">CRÉER COMPTE</button>
        </div>
      </div>`;

    const msg = () => tab.querySelector('#supaMsg');
    const setMsg = (txt, color) => {
      const el = msg();
      if (el) { el.textContent = txt; el.style.color = color || 'var(--text)'; }
    };

    tab.querySelector('#btnSupaLogin')?.addEventListener('click', async () => {
      const email    = tab.querySelector('#supaEmail')?.value.trim();
      const password = tab.querySelector('#supaPassword')?.value;
      if (!email || !password) { setMsg('Remplis tous les champs.', 'var(--red)'); return; }
      setMsg('Connexion…', 'var(--gold)');
      const { error } = await supaSignIn(email, password);
      if (error) setMsg(error, 'var(--red)');
    });

    tab.querySelector('#btnSupaRegister')?.addEventListener('click', async () => {
      const email    = tab.querySelector('#supaEmail')?.value.trim();
      const password = tab.querySelector('#supaPassword')?.value;
      if (!email || !password) { setMsg('Remplis tous les champs.', 'var(--red)'); return; }
      if (password.length < 6) { setMsg('Mot de passe trop court (6 caractères min).', 'var(--red)'); return; }
      setMsg('Création du compte…', 'var(--gold)');
      const { error } = await supaSignUp(email, password);
      if (error) setMsg(error, 'var(--red)');
      else setMsg('Compte créé ! Vérifie ton email pour confirmer, puis connecte-toi.', 'var(--green)');
    });

  } else {
    // ── Interface connectée ──────────────────────────────────────
    const user     = supaSession.user;
    const syncAgo  = supaLastSync
      ? `il y a ${Math.round((Date.now() - supaLastSync) / 1000)}s`
      : 'jamais';
    const syncColor = supaLastSync ? 'var(--green)' : '#ff9900';
    const syncLabel = supaSyncing ? '⟳ Synchronisation…' : supaLastSync ? `✅ Syncé ${syncAgo}` : '⚠ Non encore syncé';

    tab.innerHTML = `
      <div style="padding:16px;max-width:760px">
        <div style="font-family:var(--font-pixel);font-size:12px;color:var(--gold);margin-bottom:16px">☁ COMPTE CLOUD</div>

        <!-- Carte joueur -->
        <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:16px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
          ${state.gang.bossSprite
            ? `<img src="https://play.pokemonshowdown.com/sprites/gen5/${state.gang.bossSprite}.png" style="width:64px;height:64px;image-rendering:pixelated">`
            : ''}
          <div style="flex:1;min-width:160px">
            <div style="font-family:var(--font-pixel);font-size:11px;margin-bottom:6px">${state.gang.name}</div>
            <div style="font-size:10px;color:var(--text-dim);margin-bottom:4px">${user.email}</div>
            <div style="font-size:10px">⭐ <b style="color:var(--gold)">${state.gang.reputation || 0}</b> réputation</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;min-width:160px">
            <div style="font-size:9px;color:${syncColor};text-align:right;margin-bottom:2px">${syncLabel}</div>
            <button id="btnSupaForceSave"  style="padding:7px 12px;background:var(--bg);border:1px solid var(--green);border-radius:var(--radius-sm);color:var(--green);font-size:9px;cursor:pointer;letter-spacing:.04em">↑ Sauvegarder maintenant</button>
            <button id="btnSupaLoadCloud"  style="padding:7px 12px;background:var(--bg);border:1px solid var(--blue);border-radius:var(--radius-sm);color:var(--blue);font-size:9px;cursor:pointer;letter-spacing:.04em">↓ Charger depuis le cloud</button>
            <button id="btnSupaLogout"     style="padding:7px 12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-dim);font-size:9px;cursor:pointer">Déconnexion</button>
          </div>
        </div>

        <!-- Classement -->
        <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:var(--radius);padding:16px">
          <div style="font-family:var(--font-pixel);font-size:10px;color:var(--gold);margin-bottom:12px">🏆 CLASSEMENT — TOP GANGS</div>
          <div id="supaLeaderboard" style="min-height:60px">
            <div style="color:var(--text-dim);font-size:10px;padding:8px">Chargement…</div>
          </div>
        </div>
      </div>`;

    tab.querySelector('#btnSupaForceSave')?.addEventListener('click', async () => {
      _supaLastSaveAt = 0; // forcer le throttle
      await supaCloudSave();
    });
    tab.querySelector('#btnSupaLoadCloud')?.addEventListener('click', async () => {
      await supaForceCloudLoad();
    });
    tab.querySelector('#btnSupaLogout')?.addEventListener('click', () => {
      showConfirm('Se déconnecter du compte cloud ?', async () => { await supaSignOut(); }, null, { danger: true, confirmLabel: 'Déconnecter', cancelLabel: 'Annuler' });
    });

    // Charger le classement en async
    supaFetchLeaderboard().then(html => {
      const el = document.getElementById('supaLeaderboard');
      if (el) el.innerHTML = html;
    });
  }
}

async function supaFetchLeaderboard() {
  if (!_supabase) return '<div style="color:var(--text-dim);font-size:10px">Non disponible.</div>';
  const { data, error } = await _supabase
    .from('players')
    .select('user_id, gang_name, boss_name, reputation, shiny_count, pokedex_count')
    .order('reputation', { ascending: false })
    .limit(10);

  if (error || !data?.length) {
    return '<div style="color:var(--text-dim);font-size:10px;padding:8px">Aucun joueur classé pour l\'instant — sois le premier !</div>';
  }

  const myId = supaSession?.user?.id;
  return data.map((p, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `<span style="font-family:var(--font-pixel);font-size:9px">${i + 1}.</span>`;
    const isMe  = p.user_id === myId;
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:9px 6px;border-bottom:1px solid var(--border);background:${isMe ? 'rgba(255,204,90,.06)' : ''};border-left:${isMe ? '2px solid var(--gold)' : '2px solid transparent'}">
        <span style="width:28px;text-align:center;font-size:14px">${medal}</span>
        <div style="flex:1">
          <div style="font-family:var(--font-pixel);font-size:9px;color:${isMe ? 'var(--gold)' : 'var(--text)'}">${p.gang_name}${isMe ? ' ◀ toi' : ''}</div>
          <div style="font-size:9px;color:var(--text-dim)">${p.boss_name}</div>
        </div>
        <div style="text-align:right">
          <div style="color:var(--gold);font-size:10px;font-weight:bold">${p.reputation.toLocaleString('fr-FR')} rép</div>
          <div style="color:var(--text-dim);font-size:8px;margin-top:2px">✨ ${p.shiny_count} shiny &nbsp;·&nbsp; 📖 ${p.pokedex_count}/151</div>
        </div>
      </div>`;
  }).join('');
}

// ════════════════════════════════════════════════════════════════

// ── Version check on boot ─────────────────────────────────────
// If the stored version doesn't match APP_VERSION, a new deploy
// has happened → store the new version then hard-reload.
function checkVersionOnBoot() {
  const PG_VER_KEY = 'pg.appVersion';
  const stored = localStorage.getItem(PG_VER_KEY);
  if (stored && stored !== APP_VERSION) {
    localStorage.setItem(PG_VER_KEY, APP_VERSION);
    location.reload(true);
    return true; // signal: reload in progress
  }
  localStorage.setItem(PG_VER_KEY, APP_VERSION);
  return false;
}

// ── Remote version polling (every 5 min) ─────────────────────
// Fetches index.html with a cache-buster, reads the meta tag,
// shows a sticky banner if a new version is available.
let _remoteVersionBannerShown = false;
function pollRemoteVersion() {
  if (_remoteVersionBannerShown) return;
  fetch(`./index.html?_v=${Date.now()}`, { cache: 'no-store' })
    .then(r => r.text())
    .then(html => {
      const match = html.match(/<meta\s+name="app-version"\s+content="([^"]+)"/);
      if (!match) return;
      const remoteVer = match[1];
      if (remoteVer !== APP_VERSION && !_remoteVersionBannerShown) {
        _remoteVersionBannerShown = true;
        showUpdateBanner(remoteVer);
      }
    })
    .catch(() => {}); // silently ignore network errors
}

function showUpdateBanner(newVer) {
  document.getElementById('updateBanner')?.remove();

  const COUNTDOWN = 60; // secondes avant reload forcé
  let remaining = COUNTDOWN;

  const banner = document.createElement('div');
  banner.id = 'updateBanner';
  banner.style.cssText = `
    position:fixed; top:0; left:0; right:0; z-index:99999;
    background:#cc3333; color:#fff; text-align:center;
    padding:10px 16px; font-size:13px; font-family:inherit;
    display:flex; align-items:center; justify-content:center; gap:12px;
    box-shadow:0 2px 12px rgba(0,0,0,0.5);
  `;
  banner.innerHTML = `
    <span id="updateBannerMsg">⚡ Nouvelle version <strong>${newVer}</strong> — rechargement dans <strong id="updateCountdown">${COUNTDOWN}</strong>s</span>
    <button id="updateBannerBtn" style="
      background:#fff; color:#cc3333; border:none; border-radius:4px;
      padding:4px 12px; font-size:12px; cursor:pointer; font-weight:bold;
    ">Recharger maintenant</button>
  `;
  document.body.prepend(banner);

  const doReload = () => { saveState(); location.reload(true); };

  document.getElementById('updateBannerBtn')?.addEventListener('click', doReload);

  const ticker = setInterval(() => {
    remaining--;
    const el = document.getElementById('updateCountdown');
    if (el) el.textContent = remaining;
    if (remaining <= 0) { clearInterval(ticker); doReload(); }
  }, 1000);
}

// ── Daily scheduled reload at 12h00 and 00h00 ────────────────
// 30s before the deadline a toast countdown starts,
// then saveState() + hard reload to pick up the new deploy.
let _dailyReloadLastHour = -1;   // prevents double-trigger in same minute
let _dailyCountdownActive = false;

function startDailyReloadSchedule() {
  setInterval(_checkDailyReload, 30000); // check every 30 seconds
}

function _checkDailyReload() {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();

  // Trigger 1 minute before 12:00 or 00:00 to show countdown
  const isReloadHour = (h === 11 && m === 59) || (h === 23 && m === 59);
  const reloadKey = h < 12 ? 0 : 12; // 0 or 12 identifies which window

  if (isReloadHour && _dailyReloadLastHour !== reloadKey && !_dailyCountdownActive) {
    _dailyCountdownActive = true;
    _dailyReloadLastHour = reloadKey;
    _runDailyCountdown(60); // 60 second countdown
  }

  // Safety: if we somehow missed the countdown, force reload at the exact hour
  const isMissedReload = (h === 12 || h === 0) && m === 0 && _dailyReloadLastHour !== reloadKey;
  if (isMissedReload) {
    _dailyReloadLastHour = reloadKey;
    saveState();
    location.reload(true);
  }
}

function _runDailyCountdown(seconds) {
  // Show persistent warning toast
  const container = document.getElementById('notifications');
  if (!container) { _triggerDailyReload(); return; }

  const el = document.createElement('div');
  el.className = 'toast warning';
  el.id = 'dailyReloadToast';
  el.style.cssText = 'position:relative; min-width:220px; pointer-events:none;';
  el.textContent = `🔄 Maintenance — rechargement dans ${seconds}s`;
  container.appendChild(el);

  let remaining = seconds;
  const interval = setInterval(() => {
    remaining--;
    const toastEl = document.getElementById('dailyReloadToast');
    if (toastEl) toastEl.textContent = `🔄 Maintenance — rechargement dans ${remaining}s`;
    if (remaining <= 0) {
      clearInterval(interval);
      _triggerDailyReload();
    }
  }, 1000);
}

function _triggerDailyReload() {
  saveState();
  // Navigate to hub tab before reload so player lands on it after
  switchTab('tabGang');
  setTimeout(() => location.reload(true), 500);
}

function showMigrationBanner({ from, toLegacyKey, fields }) {
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.82);z-index:12000;
    display:flex;align-items:center;justify-content:center;padding:16px;
    animation:fadeIn .3s ease
  `;
  const fieldsHtml = fields.length
    ? `<ul style="margin:8px 0 0 0;padding-left:18px;font-size:9px;color:var(--text-dim);line-height:1.8">
        ${fields.map(f => `<li>${f}</li>`).join('')}
      </ul>`
    : '';
  const legacyNote = toLegacyKey
    ? `<div style="margin-top:8px;font-size:9px;color:var(--red);background:rgba(255,0,0,.07);padding:6px 8px;border-radius:4px;border-left:2px solid var(--red)">
        ⚠ Ancienne sauvegarde détectée (<code style="font-size:9px">${toLegacyKey}</code>).<br>
        Convertie et transférée vers le slot actuel. L'ancienne clé a été supprimée.
      </div>`
    : '';

  overlay.innerHTML = `
    <div style="background:var(--bg-panel);border:2px solid var(--gold-dim);border-radius:var(--radius);
                padding:22px 24px;max-width:420px;width:100%;box-shadow:0 8px 40px rgba(0,0,0,.6)">
      <div style="font-family:var(--font-pixel);font-size:11px;color:var(--gold);margin-bottom:4px">
        🔄 SAVE MISE À JOUR
      </div>
      <div style="font-size:10px;color:var(--text-dim);margin-bottom:4px">
        Depuis : <span style="color:var(--text)">${from}</span> →
        schéma <span style="color:var(--gold)">v${SAVE_SCHEMA_VERSION}</span>
      </div>
      ${fields.length ? `<div style="font-size:9px;color:var(--text-dim);margin-top:6px">Nouveaux éléments ajoutés :</div>${fieldsHtml}` : ''}
      ${legacyNote}
      <div style="margin-top:8px;font-size:9px;color:var(--text-dim)">
        Ta progression, Pokémon et argent sont intacts. ✅
      </div>
      <div style="margin-top:16px;text-align:right">
        <button id="btnMigrationOk" class="btn-gold" style="padding:6px 20px;font-size:10px">
          OK, continuer →
        </button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.querySelector('#btnMigrationOk').addEventListener('click', () => {
    overlay.remove();
    saveState(); // persiste le nouveau schéma
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

function boot() {
  // Version check — must run before anything else; may trigger reload
  if (checkVersionOnBoot()) return;

  // Try to load saved state
  const saved = loadState();
  if (saved) {
    state = saved;
  }
  state.sessionStart = Date.now();

  // ── Banner de migration si save convertie ────────────────────────────────
  if (_migrationResult) {
    setTimeout(() => showMigrationBanner(_migrationResult), 1200);
  }

  // ── Notification migration Gen 2 ─────────────────────────────
  if (state._gen2MigrationCount) {
    const n = state._gen2MigrationCount;
    setTimeout(() => notify(
      `🌟 ${n} légendaire${n > 1 ? 's' : ''} (Lugia / Ho-Oh) converti${n > 1 ? 's' : ''} en ailes — débloque les nouvelles zones dédiées !`
    , 'gold'), 1500);
    delete state._gen2MigrationCount;
    saveState();
  }
  // ── Notification limite dépassée → MissingNo reward ──────────
  if (state._limitViolationReward) {
    setTimeout(() => notify(
      '⚠️ Valeurs hors-limites détectées et corrigées — MissingNo Lv.1 ajouté au PC !'
    , 'gold'), 2000);
    delete state._limitViolationReward;
    saveState();
  }

  // Init tab navigation
  document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Tab drag-to-reorder
  (() => {
    const tabNav = document.querySelector('.tab-nav');
    if (!tabNav) return;
    tabNav.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
      btn.setAttribute('draggable', 'true');
      btn.addEventListener('dragstart', e => {
        e.dataTransfer.setData('tabReorderId', btn.dataset.tab);
        btn.style.opacity = '0.5';
      });
      btn.addEventListener('dragend', () => { btn.style.opacity = ''; });
      btn.addEventListener('dragover', e => { e.preventDefault(); btn.style.outline = '1px solid var(--gold)'; });
      btn.addEventListener('dragleave', () => { btn.style.outline = ''; });
      btn.addEventListener('drop', e => {
        e.preventDefault();
        btn.style.outline = '';
        const fromId = e.dataTransfer.getData('tabReorderId');
        if (!fromId || fromId === btn.dataset.tab) return;
        const fromBtn = tabNav.querySelector(`.tab-btn[data-tab="${fromId}"]`);
        if (!fromBtn) return;
        const allBtns = [...tabNav.querySelectorAll('.tab-btn[data-tab]')];
        const fromIdx = allBtns.indexOf(fromBtn);
        const toIdx   = allBtns.indexOf(btn);
        if (fromIdx < toIdx) btn.after(fromBtn); else btn.before(fromBtn);
        SFX.play('click');
      });
    });
  })();

  document.getElementById('btnSaveSlots')?.addEventListener('click', openSaveSlotModal);
  document.getElementById('btnBackToIntro')?.addEventListener('click', () => showIntro());
  document.getElementById('btnCodex')?.addEventListener('click', openCodexModal);

  // Battle log toggle + drag
  const battleLogPanel = document.getElementById('battleLog');
  const battleLogHeader = document.getElementById('battleLogHeader');
  if (battleLogHeader && battleLogPanel) {
    let isDragging = false, dragStartX = 0, dragStartY = 0, panelStartRight = 0, panelStartBottom = 0;

    battleLogHeader.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      const rect = battleLogPanel.getBoundingClientRect();
      panelStartRight = window.innerWidth - rect.right;
      panelStartBottom = window.innerHeight - rect.bottom;
      battleLogPanel.classList.add('is-dragging');
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = dragStartX - e.clientX;
      const dy = dragStartY - e.clientY;
      const newRight = Math.max(0, Math.min(window.innerWidth - 100, panelStartRight + dx));
      const newBottom = Math.max(0, Math.min(window.innerHeight - 40, panelStartBottom + dy));
      battleLogPanel.style.right = newRight + 'px';
      battleLogPanel.style.bottom = newBottom + 'px';
      battleLogPanel.style.left = 'auto';
      battleLogPanel.style.top = 'auto';
    });

    document.addEventListener('mouseup', (e) => {
      if (!isDragging) return;
      isDragging = false;
      battleLogPanel.classList.remove('is-dragging');
      // If minimal movement, treat as click (toggle collapse)
      const dx = Math.abs(dragStartX - e.clientX);
      const dy = Math.abs(dragStartY - e.clientY);
      if (dx < 5 && dy < 5) {
        battleLogPanel.classList.toggle('battle-log-collapsed');
        const tog = document.getElementById('battleLogToggle');
        if (tog) tog.textContent = battleLogPanel.classList.contains('battle-log-collapsed') ? '▲' : '▼';
        updateBattleLogMiniSprites();
      }
    });
  }
  renderBattleLog();

  // Init filter/sort listeners for PC (reset page on change, force full rebuild)
  document.getElementById('pcSearch')?.addEventListener('input', () => {
    const val = document.getElementById('pcSearch')?.value || '';
    if (checkSecretCode(val)) {
      document.getElementById('pcSearch').value = '';
      return;
    }
    if (activeTab === 'tabPC') { pcPage = 0; renderPokemonGrid(true); }
  });
  document.getElementById('pcSort')?.addEventListener('change', () => {
    if (activeTab === 'tabPC') { pcPage = 0; renderPokemonGrid(true); }
  });
  document.getElementById('pcFilter')?.addEventListener('change', () => {
    if (activeTab === 'tabPC') { pcPage = 0; renderPokemonGrid(true); }
  });

  // Info buttons (ℹ on tab nav)
  document.querySelectorAll('.tab-info-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      showInfoModal(btn.dataset.infoTab);
    });
  });
  document.getElementById('infoModalClose')?.addEventListener('click', () => {
    document.getElementById('infoModal')?.classList.remove('active');
  });
  document.getElementById('infoModal')?.addEventListener('click', e => {
    if (e.target.id === 'infoModal') e.target.classList.remove('active');
  });

  // Init settings
  initSettings();

  // Raccourcis clavier globaux
  initKeyboardShortcuts();

  // Init missions
  initMissions();

  // Detect LLM
  detectLLM();

  // Init Supabase (auth + cloud save)
  initSupabase();

  // Show intro if not initialized
  if (!state.gang.initialized) {
    showIntro();
  }

  // Zone unlock popup bindings
  document.getElementById('zoneUnlockGo')?.addEventListener('click', () => {
    const popup = document.getElementById('zoneUnlockPopup');
    if (!popup) return;
    popup.classList.remove('show');
    const zoneId = popup._zoneId;
    if (!zoneId) { _processZoneUnlockQueue(); return; }
    switchTab('tabZones');
    if (!openZones.has(zoneId)) openZoneWindow(zoneId);
    else renderZonesTab();
    setTimeout(() => {
      const zw = document.getElementById(`zw-${zoneId}`);
      if (zw) { zw.scrollIntoView({ behavior: 'smooth' }); zw.classList.add('zone-highlight'); setTimeout(() => zw.classList.remove('zone-highlight'), 1500); }
    }, 150);
    _processZoneUnlockQueue();
  });
  document.getElementById('zoneUnlockClose')?.addEventListener('click', () => {
    document.getElementById('zoneUnlockPopup')?.classList.remove('show');
    _processZoneUnlockQueue();
  });
  document.getElementById('zoneUnlockPopup')?.addEventListener('click', e => {
    if (e.target.id === 'zoneUnlockPopup') { e.target.classList.remove('show'); _processZoneUnlockQueue(); }
  });

  // Apply cosmetics (bg theme)
  applyCosmetics();

  // Init session tracking (must be after state is loaded)
  initSession();

  // Auto-ouvre les zones favorites au chargement
  for (const zId of (state.favoriteZones || [])) {
    if (isZoneUnlocked(zId) && !openZones.has(zId)) {
      openZones.add(zId);
      initZone(zId);
      zoneSpawns[zId] = [];
      const zone = ZONE_BY_ID[zId];
      if (zone) {
        const interval = Math.round(1000 / zone.spawnRate);
        zoneSpawnTimers[zId] = setInterval(() => tickZoneSpawn(zId), interval);
      }
      if (!state.openZoneOrder) state.openZoneOrder = [];
      if (!state.openZoneOrder.includes(zId)) state.openZoneOrder.push(zId);
    }
  }

  // Apply saved UI scale
  const savedScale = state.settings?.uiScale ?? 100;
  document.documentElement.style.setProperty('--ui-scale', (savedScale / 100).toFixed(2));
  document.documentElement.style.setProperty('--zone-scale', ((state.settings?.zoneScale ?? 100) / 100).toFixed(2));
  document.body.classList.toggle('theme-light', state.settings?.lightTheme === true);
  document.body.classList.toggle('low-spec',    state.settings?.lowSpec === true);
  // Apply saved music volume
  MusicPlayer.setVolume((state.settings?.musicVol ?? 80) / 1000);

  // Initial render — force l'onglet actif correct au chargement
  switchTab(activeTab);
  renderAll();

  // Check boss sprite validity (broken save migration)
  checkBossSpriteValidity();

  // ── Charger les données de sprites (async, non-bloquant) ─────────────────
  // loaders.js doit être chargé avant app.js dans le HTML
  if (typeof loadPokemonSprites === 'function') {
    Promise.allSettled([
      loadPokemonSprites(),
      loadItemSprites(),
      loadTrainerGroups().then(data => _buildTrainerIndex(data)),
      loadZoneTrainerPools(),
    ]).then(results => {
      const labels = ['pokemon-sprites', 'item-sprites', 'trainer-sprites', 'zone-trainer-pools'];
      results.forEach((r, i) => {
        if (r.status === 'rejected') console.warn(`[Sprites] Échec chargement ${labels[i]} :`, r.reason);
      });
    });
  }

  // Start game loop
  startGameLoop();
}

window.addEventListener('DOMContentLoaded', boot);
