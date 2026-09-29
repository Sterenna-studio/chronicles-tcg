// shared/assetHelpers.js — v1.0
// Helpers pour construire les URLs des assets (cartes, packs, sons…)

/**
 * Retourne l'URL de l'artwork d'une carte.
 * @param {string} cardId
 * @returns {string}
 */
export function cardArtworkUrl(cardId) {
  if (!cardId) return '/TCG/assets/cards/placeholder.jpg';
  return `/TCG/assets/cards/${cardId}.jpg`;
}

/**
 * Retourne l'URL de l'image d'un pack.
 * @param {string} imageName
 * @returns {string}
 */
export function packImageUrl(imageName) {
  if (!imageName) return '/TCG/assets/packs/default.jpg';
  return `/TCG/assets/packs/${imageName}`;
}

/**
 * Retourne l'URL d'un son de rareté.
 * @param {string} rarity
 * @returns {string}
 */
export function raritySound(rarity) {
  const key = String(rarity || 'common').toLowerCase();
  const known = ['common', 'rare', 'epic', 'legendary', 'mythical'];
  const file  = known.includes(key) ? key : 'common';
  return `/TCG/sounds/${file}.mp3`;
}
