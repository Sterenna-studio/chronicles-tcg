// app/views/home.js - rework complet
import { loadPlayerPacks } from '../../data/packsRepo.js';
import { getClient, getUser } from '../../logic/supaRaw.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import { url } from '../../logic/paths.js';

export async function renderHome(root) {
  const el = document.createElement('div');
  el.className = 'panel';
  el.innerHTML = `
    <div class="h-section">Accueil</div>
    <div id="home-stats" style="display:flex;gap:16px;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid var(--border)">
      <span style="color:var(--muted);font-size:.9em">Chargement...</span>
    </div>
    <div style="padding:12px 16px">
      <div style="font-weight:700;margin-bottom:12px">Inventaire - Boosters posses</div>
      <div id="owned-packs" class="shelf-angled"></div>
    </div>
  `;
  root.appendChild(el);

  const statsEl = el.querySelector('#home-stats');
  const shelf = el.querySelector('#owned-packs');

  async function loadStats() {
    try {
      const sb = await getClient();
      const user = await getUser();
      const [{ data: pl }, { data: cards }, { data: packs }] = await Promise.all([
        sb.from('players').select('gold').eq('id', user.id).single(),
        sb.from('player_cards').select('qty').eq('player_id', user.id),
        sb.from('player_packs').select('quantity').eq('player_id', user.id),
      ]);
      const gold = pl?.gold ?? (state.gold || 0);
      const totalCards = (cards || []).reduce((s, r) => s + (r.qty || 0), 0);
      const totalPacks = (packs || []).reduce((s, r) => s + (r.quantity || 0), 0);
      statsEl.innerHTML = `
        <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px 16px">
          <div style="font-size:.75em;color:var(--muted)">Or</div>
          <div style="font-weight:700;font-size:1.1em">${gold} monnaies</div>
        </div>
        <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px 16px">
          <div style="font-size:.75em;color:var(--muted)">Cartes possedees</div>
          <div style="font-weight:700;font-size:1.1em">${totalCards}</div>
        </div>
        <div style="background:var(--card);border:1px solid var(--border);border-radius:10px;padding:10px 16px">
          <div style="font-size:.75em;color:var(--muted)">Boosters</div>
          <div style="font-weight:700;font-size:1.1em">${totalPacks}</div>
        </div>
      `;
    } catch {
      statsEl.innerHTML = '';
    }
  }

  async function loadPacks() {
    try {
      const items = await loadPlayerPacks();
      const owned = items.filter(p => (p.quantity || 0) > 0);
      if (!owned.length) {
        shelf.innerHTML = `
          <div style="opacity:.7;padding:8px">
            Aucun booster pour le moment.
            <button class="btn" style="margin-left:12px" id="goto-shop">Aller a la boutique</button>
          </div>`;
        shelf.querySelector('#goto-shop')?.addEventListener('click', () => navigate('#/shop'));
        return;
      }
      shelf.innerHTML = '';
      const frag = document.createDocumentFragment();
      owned.forEach(p => {
        const imgSrc = url('/assets/packs/' + p.image_name + '?v=cyber');
        const card = document.createElement('div');
        card.className = 'booster-card';
        card.style.cssText = 'background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;cursor:pointer;transition:transform .18s ease,box-shadow .18s ease;';
        card.innerHTML = `
          <div style="height:160px;background-image:url('${imgSrc}');background-size:cover;background-position:center;position:relative">
            <span style="position:absolute;top:8px;right:8px;background:#1f6feb;color:#fff;font-weight:700;font-size:.8em;padding:3px 8px;border-radius:6px">x${p.quantity}</span>
          </div>
          <div style="padding:10px 12px">
            <div style="font-weight:700;font-size:.95em">${p.name}</div>
            <div style="color:var(--muted);font-size:.8em;margin-top:2px">${p.card_count} cartes</div>
            <button class="btn open-btn" style="width:100%;margin-top:8px;font-size:.85em">Ouvrir</button>
          </div>
        `;
        card.querySelector('.open-btn').addEventListener('click', () => {
          document.dispatchEvent(new CustomEvent('tcg:open-pack', {
            detail: { pack_type_id: p.pack_type_id ?? p.id, set_id: p.set_id }
          }));
          navigate('#/opening');
        });
        card.addEventListener('mouseenter', () => {
          card.style.transform = 'translateY(-4px)';
          card.style.boxShadow = '0 8px 24px rgba(0,0,0,.5)';
        });
        card.addEventListener('mouseleave', () => {
          card.style.transform = '';
          card.style.boxShadow = '';
        });
        frag.appendChild(card);
      });
      shelf.appendChild(frag);
    } catch (err) {
      console.error('Failed to load owned packs', err);
      shelf.innerHTML = '<div style="color:#ff8a8a">Erreur de chargement des boosters.</div>';
    }
  }

  await Promise.all([loadStats(), loadPacks()]);
}
