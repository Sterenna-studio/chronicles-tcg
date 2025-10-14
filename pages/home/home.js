import { url, bust } from '../../logic/paths.js';
import { requireLogin } from '../../tcg_auth.js';
import { initPlayer, loadPlayerPacks, loadPlayerCollection, decrementPlayerPack, addCardsBatch } from '../../supabaseData.js';
import { generatePack } from '../../logic/packGenerator.js';
import { renderDragOpen } from '../../ui/dragOpenRenderer.js';

function toBzhSetId(s){ const t=String(s??'').toLowerCase(); const m=t.match(/(\d+)/); if(!m) return 'bzh_set01'; const n=String(parseInt(m[1],10)).padStart(2,'0'); return `bzh_set${n}`; }

(async function main(){
  const user = await requireLogin('/base/login.html'); if(!user) return;
  const userId = await initPlayer(user);

  async function refresh(){
    const rows = await loadPlayerPacks(userId);
    const host = document.getElementById('owned-packs'); host.innerHTML='';
    await loadPlayerCollection(userId);
    const owned = new Set((window.collection||[]).filter(r=>(r.quantity||0)>0).map(r=>r.card_id));

    rows.forEach(row => {
      for (let i=0;i<row.quantity;i++){
        const el=document.createElement('div'); el.className='pack-diag';
        el.style.backgroundImage = `url(${bust(url('/assets/packs/'+row.image_name))})`;
        el.title = row.name;
        el.addEventListener('click', async ()=>{
          await decrementPlayerPack(userId, row.pack_type_id);
          const setId = toBzhSetId(row.set_id);
          const cards = await fetch(bust(url(`/data/${setId}.json`)), { cache:'no-store' }).then(r=>r.json());
          const seed = (Date.now().toString(16)+Math.random().toString(16).slice(2,6)).slice(0,12);
          const picks = generatePack({ cards, cardCount: row.card_count, flags: row, seedHex: seed });
          renderDragOpen(document.body, { packImage: row.image_name, picks, ownedSet: owned, onFinish: async (p)=>{
            await addCardsBatch(userId, p.map(c=>c.id));
            await refresh();
          }});
        });
        host.appendChild(el);
      }
    });
  }

  await refresh();
})();
