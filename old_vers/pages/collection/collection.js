import { requireLogin } from '../../tcg_auth.js';
import { initPlayer, loadPlayerCollection } from '../../data/supabaseData.js';
import { renderCollection } from '../../ui/collectionRenderer.js';

function bust(url){ return `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`; }

// Inline helper: force 'bzh_setNN'
function toBzhSetId(s) {
  const t = String(s ?? '').toLowerCase();
  const m = t.match(/(\d+)/);
  if (!m) return 'bzh_set01';
  const n = String(parseInt(m[1],10)).padStart(2,'0');
  return `bzh_set${n}`;
}

(async function main(){
  await requireLogin();
  const player = await initPlayer();

  const root = document.getElementById('collection');
  const raw = new URLSearchParams(location.search).get('set') ?? 'bzh_set01';
  const setId = toBzhSetId(raw);
  const setUrl = bust(`/data/${setId}.json`);
  const setCards = await fetch(setUrl, { cache: 'no-store' }).then(r=>r.json());

  const ownedRows = await loadPlayerCollection(player.id);
  const ownedMap = new Map(ownedRows.map(r => [r.card_id, r.quantity]));

  const ui = renderCollection(root, {
    setCards,
    ownedMap,
    perPage: 16,
    onCardClick: (c) => ui.openCard(c)
  });
})();
