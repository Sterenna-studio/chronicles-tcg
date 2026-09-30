import { requireLogin } from '../../tcg_auth.js';
// Import data accessors from the shared supabase data layer instead of the local mocks.
// Pull only initPlayer from supabaseData to ensure the player row exists.
// All other operations (packs, shop, economy) are now routed through the
// dedicated repos in lab/shared.  These repos encapsulate Supabase calls
// and provide a stable API for the front‑end.
import { initPlayer } from '../../../shared/supabaseData.js';
import { getClient } from '../../../shared/supaRaw.js';
// Packs and shop helpers
import { getPackTypes, getOwnedPacks } from '../../../shared/shopRepo.js';
import { openOnePack, commitOpenedCards, getCollection } from '../../../shared/packsRepo.js';
import { getGold } from '../../../shared/economy.js';
// We still use the same UI and stats helpers.
// Use the simple opening renderer instead of the drag‑tear version.  The
// renderOpening function displays the booster opening sequence without
// requiring a drag gesture, which aligns better with the hold‑to‑open UX.
import { renderDragOpen } from '../../ui/dragOpenRenderer.js';
import { statsIncBoostersOpened, statsIncCardsObtained } from '../../state/store.js';

function bust(url){ return `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`; }
function toBzhSetId(s){ const t = String(s??'').toLowerCase(); const m=t.match(/(\d+)/); if(!m) return 'bzh_set01'; const n=String(parseInt(m[1],10)).padStart(2,'0'); return `bzh_set${n}`; }

(async function main(){
  await requireLogin();
  const player = await initPlayer();

  // Determine whether the user is an admin by querying the profiles table.  If the
  // `isAdmin` flag is true then reveal the admin button in the header.  This is
  // done here instead of inside shared code to avoid coupling to external modules.
  try {
    const sb = await getClient();
    // Query the `is_admin` column (snake_case) instead of `isAdmin`.  The
    // Supabase table uses snake_case column names, so selecting the wrong
    // field causes a 400 error.  See user feedback about the failed request.
    const { data, error } = await sb.from('profiles').select('is_admin').maybeSingle();
    if (error) throw error;
    const isAdmin = !!data?.is_admin;
    const adminBtnEl = document.getElementById('admin-btn');
    if (isAdmin && adminBtnEl) {
      adminBtnEl.style.display = '';
    }
  } catch (err) {
    console.error('Failed to check admin status', err);
  }

  // Hook up the info bubble toggle.  Clicking the ℹ️ button shows the guide,
  // clicking the close button hides it.  Clicking outside of the bubble also
  // dismisses it.
  const infoBtn = document.getElementById('btn-info');
  const infoBubble = document.getElementById('info-bubble');
  const closeInfo = document.getElementById('close-info');
  if (infoBtn && infoBubble && closeInfo) {
    infoBtn.addEventListener('click', () => {
      infoBubble.classList.remove('hidden');
    });
    closeInfo.addEventListener('click', () => {
      infoBubble.classList.add('hidden');
    });
    // Close info bubble on escape key or outside click
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') infoBubble.classList.add('hidden');
    });
    infoBubble.addEventListener('click', (e) => {
      // click inside bubble should not propagate
      e.stopPropagation();
    });
    document.body.addEventListener('click', (e) => {
      if (!infoBubble.classList.contains('hidden')) {
        // If click happens outside the bubble and not on the info button, close it
        if (!infoBubble.contains(e.target) && e.target !== infoBtn) {
          infoBubble.classList.add('hidden');
        }
      }
    });
  }

  async function refresh() {
    // Load pack types, owned packs, gold and collection via the new shared repos.
    const [packTypes, packRows, gold, collRows] = await Promise.all([
      getPackTypes({}),
      getOwnedPacks({}),
      getGold(),
      getCollection()
    ]);

    // Update player stats in the header
    document.getElementById('gold').textContent = gold;
    const boostersTotal = packRows.reduce((a,r)=>a + (r.quantity||0), 0);
    document.getElementById('boosters').textContent = boostersTotal;
    const unique = new Set(collRows.filter(r => (r.qty||0)>0).map(r => r.card_id)).size;
    document.getElementById('unique').textContent = unique;

    // Build a set of owned card IDs for the NEW! badge in the opening animation
    const ownedSet = new Set(collRows.map(r => r.card_id));

    const root = document.getElementById('owned-packs');
    root.innerHTML = '';
    for (const r of packRows) {
      const pt = r.pack_types;
      if (!pt) continue;
      for (let i=0;i<r.quantity;i++) {
        const btn = document.createElement('div');
        btn.className = 'pack-diag';
        // Use the pack art from the shared assets folder to avoid local duplication.
        // Load pack image from the shared assets folder
        btn.style.backgroundImage = `url(${bust('/lab/shared/assets/packs/' + pt.image_name)})`;
        btn.title = pt.name;
        // When the user clicks on a pack icon, open a drag‑to‑tear overlay.
        // This restores the classic drag interaction: the player opens the
        // booster by dragging the invisible handle.  The pack quantity is
        // decremented on the server before the overlay is shown.  Once the
        // player has finished flipping the cards, the results are committed
        // and the inventory and stats are refreshed.
        btn.addEventListener('click', async () => {
          if (btn.dataset.locked) return;
          btn.dataset.locked = 'true';
          try {
            // Fetch random cards and decrement pack quantity server‑side.
            const { results } = await openOnePack({ packTypeId: pt.id });
            renderDragOpen(document.body, {
              packImage: pt.image_name,
              picks: results,
              ownedSet,
              onFinish: async (cards) => {
                await commitOpenedCards({ results: cards });
                statsIncBoostersOpened(1);
                statsIncCardsObtained(cards.length);
                await refresh();
              }
            });
          } catch (err) {
            console.error(err);
          }
        });
        root.appendChild(btn);
      }
    }

    const stBtn = document.getElementById('btn-stats');
    const modal = document.getElementById('stats-modal');
    stBtn.onclick = () => modal.classList.remove('hidden');
    document.getElementById('close-stats').onclick = () => modal.classList.add('hidden');
    window.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') modal.classList.add('hidden'); });
  }

  await refresh();
})();
