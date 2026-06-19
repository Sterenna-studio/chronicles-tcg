// Facade for the app — points to the local mock layer.
export { ensurePlayer as initPlayer, saveGold, getPlayer, loadPackTypes, loadPlayerPacks, decrementPlayerPack, buyPack, loadPlayerCollection, addCardsBatch } from './localData.js';
