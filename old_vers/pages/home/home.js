import { requireLogin } from '../../tcg_auth.js';
import { initPlayer, getPlayer, loadPackTypes, loadPlayerPacks, loadPlayerCollection, decrementPlayerPack, addCardsBatch } from '../../data/supabaseData.js';
import { generatePack } from '../../logic/packGenerator.js';
import { renderDragOpen } from '../../ui/dragOpenRenderer.js';
import { statsIncBoostersOpened, statsIncCardsObtained } from '../../state/store.js';

function bust(url){ return `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`; }
function toBzhSetId(s){ const t = String(s??'').toLowerCase(); const m=t.match(/(\d+)/); if(!m) return 'bzh_set01'; const n=String(parseInt(m[1],10)).padStart(2,'0'); return `bzh_set${n}`; }

(async function main(){
  await requireLogin();
  const player = await initPlayer();

  async function refresh() {
    const [packTypes, packRows, playerRow, collRows] = await Promise.all([
      loadPackTypes(),
      loadPlayerPacks(player.id),
      getPlayer(player.id),
      loadPlayerCollection(player.id)
    ]);

    document.getElementById('gold').textContent = playerRow.gold;
    const boostersTotal = packRows.reduce((a,r)=>a + (r.quantity||0), 0);
    document.getElementById('boosters').textContent = boostersTotal;
    const unique = new Set(collRows.filter(r => (r.quantity||0)>0).map(r => r.card_id)).size;
    document.getElementById('unique').textContent = unique;

    const ownedSet = new Set(collRows.map(r => r.card_id));

    const root = document.getElementById('owned-packs');
    root.innerHTML = '';
    for (const r of packRows) {
      const pt = r.pack_types;
      if (!pt) continue;
      for (let i=0;i<r.quantity;i++) {
        const btn = document.createElement('div');
        btn.className = 'pack-diag';
        btn.style.backgroundImage = `url(${bust('/assets/packs/' + pt.image_name)})`;
        btn.title = pt.name;
        btn.addEventListener('click', async () => {
          const ok = await decrementPlayerPack(player.id, pt.id);
          if (!ok) return;
          const setId = toBzhSetId(pt.set_id);
          const url = bust(`/data/${setId}.json`);
          const set = await fetch(url, { cache: 'no-store' }).then(r=>r.json());
          const picks = generatePack({
            cards: set,
            cardCount: pt.card_count,
            flags: {
              set_id: setId,
              require_champion: pt.require_champion,
              require_epic: pt.require_epic,
              require_legendary: pt.require_legendary,
              require_mythical: pt.require_mythical
            }
          });
          renderDragOpen(document.body, {
            packImage: pt.image_name,
            picks,
            ownedSet,
            onFinish: async (cards) => {
              await addCardsBatch(player.id, cards.map(c => c.id));
              statsIncBoostersOpened(1);
              statsIncCardsObtained(cards.length);
              await refresh();
            }
          });
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
