// lab/shared/assetHelpers.js
const ASSETS_BASE = '/lab/shared/assets';
export function assetUrl(path){ return `${ASSETS_BASE}/${path}`.replace(/\/{2,}/g, '/'); }
export function packImageFromName(imageName, setId){
  return imageName ? assetUrl(`packs/${imageName}`) : assetUrl(`packs/${setId}-default.jpg`);
}
export function cardArtworkUrl(cardId){
  const setFolder = cardId.startsWith('BZH01') ? 'SET01' : cardId.startsWith('BZH02') ? 'SET02' : 'SET_UNKNOWN';
  return assetUrl(`artworks/${setFolder}/${cardId}.jpg`);
}
