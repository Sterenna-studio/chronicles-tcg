// state/settings.js — réglages FX persistés en localStorage.
// Historique : portait aussi des toggles "rays/burst/badge" pour un ancien
// mécanisme de carte flip qui n'existe plus dans ui/openingOverlay.js (le flux
// d'ouverture réel n'a jamais lu ces champs). Retirés ~2026-07-01 : seul l'audio
// est branché à du vrai code (playRaritySound dans openingOverlay.js).
const KEY = 'tcg_fx_settings';

const defaults = {
  audio_enabled: true,
  audio_volume: 1.0,
};

export function getFxSettings() {
  try {
    const cur = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { ...defaults, ...cur };
  } catch {
    return { ...defaults };
  }
}
export function saveFxSettings(partial) {
  const cur = getFxSettings();
  const next = { ...cur, ...partial };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
export function resetFxSettings() {
  localStorage.setItem(KEY, JSON.stringify(defaults));
  return getFxSettings();
}
