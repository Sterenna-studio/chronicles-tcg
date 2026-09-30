import { requireLogin } from '../../tcg_auth.js';
// Fetch Supabase data via the shared layer.  This centralizes all DB
// interactions in lab/shared.
// Only initPlayer comes from supabaseData; everything else (packs, collection)
// is handled via the shared repos.
import { initPlayer } from '../../../shared/supabaseData.js';
import { getOwnedPacks } from '../../../shared/shopRepo.js';
import { openOnePack, commitOpenedCards, getCollection } from '../../../shared/packsRepo.js';
import { renderPackShelf, renderInventory } from '../../ui/renderer.js';
import { renderOpening } from '../../ui/openingRenderer.js';
// No need for the local generator here; pack opening is now delegated to the back‑end.
import { statsIncBoostersOpened, statsIncCardsObtained } from '../../state/store.js';

function bust(url){ return `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`; }

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
  const rootShelf = document.getElementById('shelf');
  const rootOpen = document.getElementById('opening');
  const rootInv = document.getElementById('inventory');

  async function refreshShelf() {
    const [rows, coll] = await Promise.all([
      getOwnedPacks({}),
      getCollection()
    ]);

    const ownedSet = new Set(coll.map(r => r.card_id));

    renderPackShelf(rootShelf, rows, {
      onOpen: async (packType) => {
        try {
          // openOnePack will atomically decrement the player_packs quantity and
          // return the randomly selected cards.
          const { results } = await openOnePack({ packTypeId: packType.id });
          renderOpening(rootOpen, results, {
            packImage: packType.image_name,
            ownedSet,
            onFinish: async (cards) => {
              await commitOpenedCards({ results: cards });
              statsIncBoostersOpened(1);
              statsIncCardsObtained(cards.length);
              rootOpen.innerHTML = '';
              await refreshShelf();
            }
          });
        } catch(err){
          console.error(err);
        }
      }
    });

    const ownedCount = coll.reduce((a,c)=>a + (c.qty||0), 0);
    rootInv.innerHTML = '';
    renderInventory(rootInv, ownedCount);
  }

  refreshShelf().catch(console.error);
})();
