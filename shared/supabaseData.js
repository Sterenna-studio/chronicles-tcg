// shared/supabaseData.js — re-export bridge
// Résout les imports depuis pages/collection/collection.js et autres sous-pages.
export { getDisplayName, getCachedPlayer, initPlayer, formatUserTag, ASSET_VERSION } from '../data/supabaseData.js';
export { loadPlayerCollection, addCardsBatch } from '../data/cardsRepo.js';
