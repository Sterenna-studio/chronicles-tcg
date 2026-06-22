import { requireLogin } from '../../tcg_auth.js?v=3';
// Fetch Supabase data via the shared layer.  This centralizes all DB
// interactions in lab/shared.
import { initPlayer, loadPackTypes, loadPlayerPacks, decrementPlayerPack, addCardsBatch, loadPlayerCollection } from '../../../shared/supabaseData.js?v=3';
import { renderPackShelf, renderInventory } from '../../ui/renderer.js?v=3';
import { renderOpening } from '../../ui/openingRenderer.js?v=3';
import { generatePack } from '../../logic/packGenerator.js?v=3';
import { statsIncBoostersOpened, statsIncCardsObtained } from '../../state/store.js?v=3';

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
      loadPlayerPacks(player.id),
      loadPlayerCollection(player.id)
    ]);

    const ownedSet = new Set(coll.map(r => r.card_id));

    renderPackShelf(rootShelf, rows, {
      onOpen: async (packType) => {
        const ok = await decrementPlayerPack(player.id, packType.id);
        if (!ok) { console.warn('Plus de packs.'); return; }
        const setId = toBzhSetId(packType.set_id);
        const url = bust(`/data/${setId}.json`);
        const set = await fetch(url, { cache: 'no-store' }).then(r=>r.json());
        const picks = generatePack({
          cards: set,
          cardCount: packType.card_count,
          flags: {
            set_id: setId,
            require_champion: packType.require_champion,
            require_epic: packType.require_epic,
            require_legendary: packType.require_legendary,
            require_mythical: packType.require_mythical
          }
        });

        renderOpening(rootOpen, picks, {
          packImage: packType.image_name,
          ownedSet,
          onFinish: async (cards) => {
            await addCardsBatch(player.id, cards);
            statsIncBoostersOpened(1);
            statsIncCardsObtained(cards.length);
            rootOpen.innerHTML = '';
            await refreshShelf();
          }
        });
      }
    });

    const ownedCount = coll.reduce((a,c)=>a + (c.quantity||0), 0);
    rootInv.innerHTML = '';
    renderInventory(rootInv, ownedCount);
  }

  refreshShelf().catch(console.error);
})();
