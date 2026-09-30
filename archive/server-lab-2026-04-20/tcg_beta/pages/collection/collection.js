import { requireLogin } from '../../tcg_auth.js';
// Use the shared data layer to load player state from Supabase.
// initPlayer still seeds the player record; collection operations are routed through packsRepo.
import { initPlayer } from '../../../shared/supabaseData.js';
// Use the custom album renderer instead of the simple collection renderer.  It
// presents the collection as a book with double pages and includes 3D card
// details and reveal mechanics.
import { render as renderAlbum } from './album.js';

function bust(url){ return `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`; }

// Convert any query like 'bzh_setNN' or 'BZHNN' into the canonical set ID used in lab/shared assets.
function toSetId(s) {
  const m = String(s ?? '').match(/(\d+)/);
  const n = m ? String(parseInt(m[1],10)).padStart(2,'0') : '01';
  return `BZH${n}`;
}

(async function main(){
  await requireLogin();
  const player = await initPlayer();

  const root = document.getElementById('collection');
  // Delegate rendering to the album renderer.  The album renderer handles
  // set selection internally via its own navigation controls.
  await renderAlbum(root);
})();
