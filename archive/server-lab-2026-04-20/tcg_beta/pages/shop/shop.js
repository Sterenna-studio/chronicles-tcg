import { requireLogin } from '../../tcg_auth.js';
// Pull shared data accessors from the common lab/shared folder.  These
// functions talk to Supabase via the shared client rather than using
// tcg_beta's own data layer.
// We still call initPlayer from supabaseData to ensure the player record exists.
import { initPlayer } from '../../../shared/supabaseData.js';
// Use the dedicated shopRepo for pack listings and purchases.
import { getPackTypes, getOwnedPacks, buyPack } from '../../../shared/shopRepo.js';
// Economy helper to read the player's current gold.
import { getGold } from '../../../shared/economy.js';
import { renderShop } from '../../ui/shopRenderer.js';
import { cartAdd, cartClear, cartCount, cartTotal, statsIncGoldSpent } from '../../state/store.js';

(async function main(){
  await requireLogin();
  const player = await initPlayer();

  async function refresh() {
    // Load available pack types, current inventory and the player's gold from the shared repos.
    const [packTypes, packRows, gold] = await Promise.all([
      getPackTypes({}),
      getOwnedPacks({}),
      getGold()
    ]);
    const qMap = new Map(packRows.map(r => [r.pack_type_id, r.quantity]));
    const root = document.getElementById('shop');
    renderShop(root, {
      packTypes,
      quantities: qMap,
      gold,
      onAdd: (pt) => { cartAdd(pt, 1); refresh(); },
      onCheckout: async () => {
        const total = cartTotal();
        if (total > gold) {
          console.warn('Or insuffisant pour le panier.');
          return;
        }
        // Get cart snapshot
        const st = JSON.parse(localStorage.getItem('tcg_ui_state') || '{}');
        const items = st.cart?.items || {};
        let spent = 0;
        for (const key of Object.keys(items)) {
          const { pt, qty } = items[key];
          for (let i=0;i<qty;i++) {
            // buyPack handles decrementing quantity and spending gold via economy.spent
            await buyPack({ packTypeId: pt.id, price: pt.price });
            spent += pt.price;
          }
        }
        statsIncGoldSpent(spent);
        cartClear();
        await refresh();
      }
    });
  }

  refresh().catch(console.error);
})();
