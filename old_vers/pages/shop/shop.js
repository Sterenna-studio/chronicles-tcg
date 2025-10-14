import { requireLogin } from '../../tcg_auth.js';
import { initPlayer, getPlayer, loadPackTypes, loadPlayerPacks, buyPack } from '../../data/supabaseData.js';
import { renderShop } from '../../ui/shopRenderer.js';
import { cartAdd, cartClear, cartCount, cartTotal, statsIncGoldSpent } from '../../state/store.js';

(async function main(){
  await requireLogin();
  const player = await initPlayer();

  async function refresh() {
    const [packTypes, packRows, playerRow] = await Promise.all([
      loadPackTypes(),
      loadPlayerPacks(player.id),
      getPlayer(player.id)
    ]);
    const qMap = new Map(packRows.map(r => [r.pack_type_id, r.quantity]));
    const root = document.getElementById('shop');
    renderShop(root, {
      packTypes,
      quantities: qMap,
      gold: playerRow.gold,
      onAdd: (pt) => { cartAdd(pt, 1); refresh(); },
      onCheckout: async () => {
        const total = cartTotal();
        if (total > playerRow.gold) {
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
            const ok = await buyPack(player.id, pt.id);
            if (ok) spent += pt.price;
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
