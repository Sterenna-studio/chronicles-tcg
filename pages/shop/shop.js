import { url, bust } from '../../logic/paths.js';
import { requireLogin } from '../../tcg_auth.js';
import { initPlayer, loadPackTypes } from '../../supabaseData.js';
import { getClient, getUser } from '../../logic/supaRaw.js';

const fmt = n => new Intl.NumberFormat('fr-FR').format(n);

async function buyClassic(pack_type_id){
  const supabase = await getClient();
  const user = await getUser();
  const { data: pt } = await supabase.from('pack_types').select('*').eq('id', pack_type_id).single();
  const { data: p }  = await supabase.from('players').select('*').eq('id', user.id).single();
  if ((p?.gold||0) < (pt?.price||0)) return { ok:false, code:'NO_GOLD' };
  const { error: e1 } = await supabase.from('players').update({ gold: (p.gold||0) - pt.price }).eq('id', user.id);
  if (e1) return { ok:false, code:'GOLD_FAIL' };
  const { data: r0 } = await supabase.from('player_packs').select('quantity').eq('player_id', user.id).eq('pack_type_id', pack_type_id).maybeSingle();
  const nextQ = (r0?.quantity || 0) + 1;
  const up = r0
    ? supabase.from('player_packs').update({ quantity: nextQ }).eq('player_id', user.id).eq('pack_type_id', pack_type_id)
    : supabase.from('player_packs').insert({ player_id: user.id, pack_type_id, quantity: 1 });
  const { error: e2 } = await up;
  if (e2) return { ok:false, code:'PACK_FAIL' };
  return { ok:true };
}

(async function main(){
  const user = await requireLogin('/base/login.html'); if(!user) return;
  const userId = await initPlayer(user);

  const host = document.getElementById('shop');
  host.innerHTML = '<div style="opacity:.7">Chargement…</div>';

  const types = await loadPackTypes();
  host.innerHTML = '';

  // gold display
  const goldBar = document.createElement('div');
  goldBar.style.margin='0 0 12px 0'; goldBar.style.opacity='.8';
  goldBar.id = 'goldBar';
  host.appendChild(goldBar);

  async function refreshGold(){
    const supabase = await getClient();
    const { data: p } = await supabase.from('players').select('gold').eq('id', user.id).single();
    document.getElementById('goldBar').textContent = `💰 Or: ${fmt(p?.gold||0)}`;
  }
  await refreshGold();

  // grid
  const grid = document.createElement('div');
  grid.style.display='grid'; grid.style.gridTemplateColumns='repeat(auto-fill, minmax(220px,1fr))'; grid.style.gap='16px';
  host.appendChild(grid);

  types.forEach(pt => {
    const card = document.createElement('div');
    card.style.border='1px solid #30363d'; card.style.borderRadius='12px'; card.style.overflow='hidden'; card.style.background='#0e141b';
    const img = document.createElement('div');
    img.style.height='160px'; img.style.backgroundSize='cover'; img.style.backgroundPosition='center';
    img.style.backgroundImage = `url(${bust(url('/assets/packs/'+pt.image_name))})`;
    const body = document.createElement('div'); body.style.padding='12px';
    const title = document.createElement('div'); title.innerHTML = `<b>${pt.name}</b>`;
    const meta = document.createElement('div'); meta.style.opacity='.8'; meta.textContent = `${pt.card_count} cartes • ${fmt(pt.price)} or`;
    const btn = document.createElement('button'); btn.className='btn'; btn.textContent='Acheter'; btn.style.marginTop='8px';
    btn.addEventListener('click', async () => {
      btn.disabled = true; btn.textContent = '…';
      try {
        let ok = false;
        try {
          const maybeAPI = await import('../../supabaseData.js');
          if (typeof maybeAPI.buyPack === 'function') ok = !!(await maybeAPI.buyPack(userId, pt.id));
        } catch {}
        if (!ok) {
          const res = await buyClassic(pt.id);
          ok = res.ok;
        }
        if (!ok) throw new Error('BUY_FAIL');
        const toast = document.createElement('div');
        toast.textContent = `+1 ${pt.name}`;
        toast.style.position='fixed'; toast.style.right='16px'; toast.style.bottom='16px'; toast.style.background='#111820';
        toast.style.border='1px solid #30363d'; toast.style.padding='10px 12px'; toast.style.borderRadius='10px';
        document.body.appendChild(toast); setTimeout(()=>toast.remove(), 2200);
      } catch (e) {
        alert('Achat impossible (or insuffisant ?).');
      } finally {
        btn.disabled = false; btn.textContent='Acheter';
        await refreshGold();
      }
    });
    body.append(title, meta, btn); card.append(img, body); grid.appendChild(card);
  });
})();
