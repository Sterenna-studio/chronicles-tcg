// logic/combatRecorder.js — enregistrement des combats Escouade.
// Capture le SETUP (escouades + decks, en ids) et la SÉQUENCE d'actions du joueur
// (déploiement, équipement, attaques, fin de tour) + le résultat. Objectif :
// pouvoir rejouer/simuler un combat et analyser le comportement des joueurs.
//
// Stockage SIMPLE : localStorage (historique glissant). Export JSON (téléchargement),
// copie presse-papier, et envoi par e-mail (mailto) vers contact@sterenna.fr.
// (Aucune dépendance serveur — un envoi auto vers Supabase pourrait être ajouté.)

const KEY = 'tcg_combat_logs';
const MAX = 40;                          // n derniers combats conservés
export const RECORDER_EMAIL = 'contact@sterenna.fr';

/**
 * Démarre un enregistrement. `setup` = { app, difficulty, player, enemy }
 * où player/enemy = { champions:[id], terrain:id|null, deck:[id] }.
 */
export function createRecorder(setup) {
  const rec = {
    v: 1,
    ts: new Date().toISOString(),
    app: setup.app || '',
    difficulty: setup.difficulty || 'normal',
    player: setup.player,
    enemy: setup.enemy,
    events: [],
    result: null,
  };
  let seq = 0;
  return {
    /** type: 'deploy'|'equip'|'act'|'endturn' ; data = champs/action/etc. */
    event(type, data = {}) { rec.events.push({ n: ++seq, type, ...data }); },
    finish(result) { rec.result = result; persist(rec); return rec; },
    get: () => rec,
  };
}

function persist(rec) {
  try {
    const all = loadHistory();
    all.unshift(rec);
    localStorage.setItem(KEY, JSON.stringify(all.slice(0, MAX)));
  } catch (e) { console.warn('[recorder] persist', e); }
}

export function loadHistory() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
export function clearHistory() { try { localStorage.removeItem(KEY); } catch {} }

// ── Export / partage ────────────────────────────────────────────────────────────
function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 100);
}

/** Télécharge tout l'historique en un fichier JSON. */
export function exportHistory() {
  downloadText(`chronicles-combats-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(loadHistory(), null, 2));
}

/** Copie tout l'historique dans le presse-papier. */
export async function copyHistory() {
  try { await navigator.clipboard.writeText(JSON.stringify(loadHistory(), null, 2)); return true; }
  catch { return false; }
}

/**
 * Ouvre le client mail vers contact@sterenna.fr avec un résumé, et télécharge le
 * fichier JSON à joindre (mailto ne peut pas attacher de pièce jointe lui-même).
 */
export function emailHistory() {
  const hist = loadHistory();
  exportHistory();   // le fichier complet à joindre
  const lines = hist.slice(0, 12).map(r =>
    `• ${r.ts.slice(0, 16).replace('T', ' ')} · ${r.difficulty} · ${r.result?.winner || '?'} en ${r.result?.turns ?? '?'} tours`).join('\n');
  const body =
    `Logs de combats Chronicles — ${hist.length} combat(s).\n` +
    `Le fichier JSON complet vient d'être téléchargé : merci de le joindre à ce mail.\n\n` +
    `Aperçu des derniers combats :\n${lines}`;
  const href = `mailto:${RECORDER_EMAIL}?subject=${encodeURIComponent('Chronicles — logs de combats')}&body=${encodeURIComponent(body)}`;
  window.location.href = href;
}
