// app/views/squadBuilder.js — Atelier d'escouade (Mode Escouade, lot 6)
// Monte une escouade de 3 Champions, équipe chacun (max 3 cartes non-Champion),
// choisit 1 Terrain d'équipe, puis sauvegarde via le RPC save_squad.
// Voir docs/RULES_JRPG.md §2 (loadout) et §9 (persistance).
import { getClient, getUser } from '../../logic/supaRaw.js?v=6';
import { url } from '../../logic/paths.js?v=6';
import { playableSets } from '../../logic/sets.js?v=6';

const MAX_EQUIP = 3;
const EQUIP_TYPES = ['Object', 'Companion', 'Special', 'Event', 'Team'];
const RC = { Common:'#9da7b3', Rare:'#42b0ff', Epic:'#bb55d3', Legendary:'#ffbe46', Mythical:'#ff5080' };
const TI = { Champion:'⚔️', Companion:'🐾', Event:'⚡', Object:'🔧', Special:'✨', Terrain:'🌍', Team:'👥' };
const ROLE = { Object:'passif', Companion:'passif', Special:'actif', Event:'1×', Team:'1×' };

const cardImg = (id) => url(`/assets/cards/${id}.jpg`);
const isLegendary = (c) => (c?.rarity || '').toLowerCase() === 'legendary';
const isMythical  = (c) => (c?.rarity || '').toLowerCase() === 'mythical';

async function loadAllCards() {
  const results = await Promise.all(playableSets().map(s => fetch(url(s.file)).then(r => r.json())));
  return results.flat();
}
async function fetchOwned() {
  try {
    const sb = await getClient();
    const user = await getUser();
    if (!user) return {};
    const { data } = await sb.from('tcg_player_cards').select('card_id, quantity').eq('user_id', user.id);
    return Object.fromEntries((data || []).map(r => [r.card_id, r.quantity || 0]));
  } catch { return {}; }
}
async function loadExistingSquad() {
  try {
    const sb = await getClient();
    const { data } = await sb.rpc('load_squad');
    return data?.ok ? data.squad : null;
  } catch { return null; }
}

export async function renderSquadBuilder(root) {
  root.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;padding:40px;color:#3a6655">Chargement de l'atelier…</div>`;
  const [allCards, owned, existing] = await Promise.all([loadAllCards(), fetchOwned(), loadExistingSquad()]);
  const byId = Object.fromEntries(allCards.map(c => [c.id, c]));
  const ownedCards = allCards.filter(c => (owned[c.id] || 0) > 0);

  // État de l'escouade (cartes complètes ; on mappe vers des ids à la sauvegarde)
  const squad = {
    id: existing?.id || null,
    name: existing?.name || 'Escouade 1',
    is_active: existing?.is_active ?? true,
    slots: [0, 1, 2].map(i => ({
      champion: existing?.slots?.[i]?.champion ? byId[existing.slots[i].champion.id] || existing.slots[i].champion : null,
      equipment: (existing?.slots?.[i]?.equipment || []).map(e => byId[e.id] || e),
    })),
    terrain: existing?.terrain ? (byId[existing.terrain.id] || existing.terrain) : null,
  };

  let selectedSlot = 0;
  let filterType = 'all';
  let searchTxt = '';

  // ── Comptage d'usage (pour respecter la possession / doublons) ─────────────
  function usageCount(id) {
    let n = 0;
    squad.slots.forEach(s => {
      if (s.champion?.id === id) n++;
      s.equipment.forEach(e => { if (e.id === id) n++; });
    });
    if (squad.terrain?.id === id) n++;
    return n;
  }
  const canTakeAnother = (id) => usageCount(id) < (owned[id] || 0);
  function countRarity(pred) {
    let n = 0;
    squad.slots.forEach(s => {
      if (pred(s.champion)) n++;
      s.equipment.forEach(e => { if (pred(e)) n++; });
    });
    if (pred(squad.terrain)) n++;
    return n;
  }

  // ── Shell ──────────────────────────────────────────────────────────────────
  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:grid;grid-template-rows:auto 1fr;height:100vh;background:#04060a;color:#c8ffe8;font-family:"Share Tech Mono","Courier New",monospace;overflow:hidden';
  root.appendChild(wrap);

  const topbar = document.createElement('div');
  topbar.style.cssText = 'display:flex;align-items:center;gap:12px;padding:8px 16px;border-bottom:1px solid #0e2a1f;background:#020508;flex-shrink:0;flex-wrap:wrap';
  topbar.innerHTML = `
    <button id="sb-back" style="background:transparent;border:1px solid #3a6655;color:#3a6655;padding:3px 10px;cursor:pointer;font-family:inherit;font-size:.78em">← Retour</button>
    <span style="color:#00f5c4;font-family:'VT323',monospace;font-size:1.4em;letter-spacing:.15em">ATELIER D'ESCOUADE</span>
    <input id="sb-name" value="${squad.name.replace(/"/g,'&quot;')}" maxlength="32" style="background:#050d14;border:1px solid #0e2a1f;color:#c8ffe8;padding:4px 10px;font-family:inherit;font-size:.78em;width:160px">
    <div style="flex:1"></div>
    <input id="sb-search" placeholder="Chercher…" style="background:#050d14;border:1px solid #0e2a1f;color:#c8ffe8;padding:4px 10px;font-family:inherit;font-size:.78em;width:150px">
    <select id="sb-type" style="background:#050d14;border:1px solid #0e2a1f;color:#c8ffe8;padding:4px 8px;font-family:inherit;font-size:.78em">
      <option value="all">Tous types</option>
      ${['Champion', ...EQUIP_TYPES, 'Terrain'].map(t => `<option value="${t}">${TI[t]||''} ${t}</option>`).join('')}
    </select>`;
  wrap.appendChild(topbar);

  const body = document.createElement('div');
  body.style.cssText = 'display:grid;grid-template-columns:1fr 320px;overflow:hidden';
  wrap.appendChild(body);

  const gridWrap = document.createElement('div');
  gridWrap.style.cssText = 'overflow-y:auto;padding:12px 14px';
  body.appendChild(gridWrap);

  const panel = document.createElement('div');
  panel.style.cssText = 'border-left:1px solid #0e2a1f;background:#020508;display:flex;flex-direction:column;overflow:hidden';
  body.appendChild(panel);

  // ── Grille collection ──────────────────────────────────────────────────────
  function gridMatches(c) {
    if (filterType !== 'all' && c.type !== filterType) return false;
    if (searchTxt && !c.name.toLowerCase().includes(searchTxt.toLowerCase())) return false;
    return true;
  }

  function renderGrid() {
    const filtered = ownedCards.filter(gridMatches);
    gridWrap.innerHTML = '';
    if (!filtered.length) {
      gridWrap.innerHTML = '<div style="padding:20px;color:#3a6655;font-size:.8em">Aucune carte correspondante. Achète des boosters dans la boutique.</div>';
      return;
    }
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px';
    gridWrap.appendChild(grid);

    filtered.forEach(card => {
      const rc = RC[card.rarity] || '#9da7b3';
      const used = usageCount(card.id);
      const ownedQty = owned[card.id] || 0;
      const exhausted = used >= ownedQty;
      const div = document.createElement('div');
      div.title = `${card.name} — ${card.rarity}\n${card.type}${ROLE[card.type] ? ' ('+ROLE[card.type]+')' : ''}\n⚡${card.energy} ⚔${card.power} 🛡${card.shield}`;
      div.style.cssText = `border-radius:8px;border:1px solid ${exhausted ? '#0e2a1f' : rc+'88'};background:#04060a;overflow:hidden;cursor:${exhausted?'default':'pointer'};position:relative;transition:transform .15s,box-shadow .15s;${exhausted ? 'opacity:.4;' : ''}`;
      div.innerHTML = `
        <img src="${cardImg(card.id)}" alt="${card.name}" style="width:100%;aspect-ratio:2/3;object-fit:contain;background:#060c10;display:block" onerror="this.style.display='none'">
        <div style="padding:3px 5px;font-size:.58em;color:${rc};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${card.name}</div>
        <div style="padding:0 5px 3px;display:flex;justify-content:space-between;font-size:.55em;color:#3a6655">
          <span>${TI[card.type]||''}</span><span>⚡${card.energy} ⚔${card.power} 🛡${card.shield}</span>
        </div>
        <div style="position:absolute;top:3px;left:3px;background:#42b0ff22;color:#42b0ff;font-size:.55em;padding:1px 4px;border-radius:3px">${used}/${ownedQty}</div>`;
      if (!exhausted) {
        div.addEventListener('mouseenter', () => { div.style.transform = 'translateY(-2px)'; div.style.boxShadow = `0 4px 12px ${rc}55`; });
        div.addEventListener('mouseleave', () => { div.style.transform = ''; div.style.boxShadow = ''; });
        div.addEventListener('click', () => addCard(card));
      }
      grid.appendChild(div);
    });
  }

  // ── Ajout d'une carte selon son type ───────────────────────────────────────
  function addCard(card) {
    if (!canTakeAnother(card.id)) return flash('Tu n\'en possèdes pas assez d\'exemplaires', '#ff8a8a');

    if (card.type === 'Champion') {
      if (squad.slots.some(s => s.champion?.id === card.id)) return flash('Ce champion est déjà dans l\'escouade', '#ff8a8a');
      squad.slots[selectedSlot].champion = card;
    } else if (card.type === 'Terrain') {
      squad.terrain = card;
    } else if (EQUIP_TYPES.includes(card.type)) {
      const slot = squad.slots[selectedSlot];
      if (!slot.champion) return flash('Choisis d\'abord un champion pour ce slot', '#ffbe46');
      if (slot.equipment.length >= MAX_EQUIP) return flash(`Max ${MAX_EQUIP} équipements par champion`, '#ff8a8a');
      slot.equipment.push(card);
    }
    renderGrid(); renderPanel();
  }

  // ── Panneau escouade ───────────────────────────────────────────────────────
  function slotCard(i) {
    const slot = squad.slots[i];
    const active = i === selectedSlot;
    const el = document.createElement('div');
    el.style.cssText = `border:1px solid ${active ? '#00f5c4' : '#0e2a1f'};border-radius:8px;padding:8px;margin-bottom:8px;background:${active ? '#04140f' : '#04060a'};cursor:pointer;${active ? 'box-shadow:0 0 12px rgba(0,245,196,.18);' : ''}`;
    el.addEventListener('click', () => { selectedSlot = i; renderPanel(); });

    const ch = slot.champion;
    const rc = ch ? (RC[ch.rarity] || '#9da7b3') : '#0e2a1f';
    const head = ch
      ? `<div style="display:flex;align-items:center;gap:8px">
           <img src="${cardImg(ch.id)}" style="width:34px;height:48px;object-fit:contain;border-radius:3px;background:#060c10" onerror="this.style.display='none'">
           <div style="flex:1;min-width:0"><div style="font-size:.72em;color:${rc};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${ch.name}</div>
           <div style="font-size:.58em;color:#3a6655">⚔️ Champion ${i + 1} · ⚡${ch.energy} ⚔${ch.power} 🛡${ch.shield}</div></div>
           <button data-rm-champ="${i}" style="background:transparent;border:none;color:#ff2d4e88;cursor:pointer;font-size:.9em">✕</button></div>`
      : `<div style="font-size:.72em;color:#3a6655">Champion ${i + 1} — <span style="color:#00f5c4">slot vide</span>${active ? ' (clique une carte Champion)' : ''}</div>`;

    const equipRow = ch
      ? `<div style="display:flex;gap:4px;margin-top:6px">${
          [0, 1, 2].map(j => {
            const e = slot.equipment[j];
            if (!e) return `<div style="flex:1;border:1px dashed #143226;border-radius:4px;height:40px;display:flex;align-items:center;justify-content:center;color:#28503f;font-size:.7em">+</div>`;
            const erc = RC[e.rarity] || '#9da7b3';
            return `<div title="${e.name}" style="flex:1;position:relative;border:1px solid ${erc}66;border-radius:4px;height:40px;background:#060c10;display:flex;align-items:center;justify-content:center;font-size:1.1em">
              ${TI[e.type] || '🔧'}
              <button data-rm-eq="${i}:${j}" style="position:absolute;top:-6px;right:-6px;background:#0a0a0a;border:1px solid #ff2d4e88;color:#ff2d4e;border-radius:50%;width:16px;height:16px;line-height:1;cursor:pointer;font-size:.6em">✕</button>
            </div>`;
          }).join('')}</div>`
      : '';
    el.innerHTML = head + equipRow;
    return el;
  }

  function renderPanel() {
    panel.innerHTML = '';
    const header = document.createElement('div');
    header.style.cssText = 'padding:10px 12px;border-bottom:1px solid #0e2a1f;flex-shrink:0';
    const champsSet = squad.slots.filter(s => s.champion).length;
    const leg = countRarity(isLegendary), myth = countRarity(isMythical);
    header.innerHTML = `<div style="font-size:.78em;color:#00f5c4;letter-spacing:.1em;margin-bottom:6px">MON ESCOUADE — <span style="color:${champsSet === 3 ? '#22c55e' : '#ffbe46'}">${champsSet}/3</span> champions</div>
      <div style="font-size:.62em;color:#3a6655;display:flex;gap:10px">
        <span style="color:${leg > 1 ? '#ff8a8a' : '#3a6655'}">★ Lég. ${leg}/1</span>
        <span style="color:${myth > 1 ? '#ff8a8a' : '#3a6655'}">✦ Myth. ${myth}/1</span>
      </div>`;
    panel.appendChild(header);

    const list = document.createElement('div');
    list.style.cssText = 'flex:1;overflow-y:auto;padding:8px';
    [0, 1, 2].forEach(i => list.appendChild(slotCard(i)));

    // Slot Terrain d'équipe
    const terr = document.createElement('div');
    const t = squad.terrain;
    terr.style.cssText = 'border:1px solid #0e2a1f;border-radius:8px;padding:8px;margin-top:4px;background:#04060a';
    terr.innerHTML = t
      ? `<div style="display:flex;align-items:center;gap:8px"><span style="font-size:1.1em">🌍</span>
         <div style="flex:1;min-width:0"><div style="font-size:.72em;color:${RC[t.rarity]||'#9da7b3'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t.name}</div>
         <div style="font-size:.58em;color:#3a6655">Terrain d'équipe · +1 dégât / +1 garde</div></div>
         <button data-rm-terrain="1" style="background:transparent;border:none;color:#ff2d4e88;cursor:pointer;font-size:.9em">✕</button></div>`
      : `<div style="font-size:.72em;color:#3a6655">🌍 Terrain d'équipe — <span style="color:#00f5c4">optionnel</span> (clique une carte Terrain)</div>`;
    list.appendChild(terr);
    panel.appendChild(list);

    const footer = document.createElement('div');
    footer.style.cssText = 'padding:10px 12px;border-top:1px solid #0e2a1f;display:flex;flex-direction:column;gap:6px;flex-shrink:0';
    const ready = champsSet === 3 && leg <= 1 && myth <= 1;
    footer.innerHTML = `
      <label style="font-size:.66em;color:#3a6655;display:flex;align-items:center;gap:6px;cursor:pointer">
        <input type="checkbox" id="sb-active" ${squad.is_active ? 'checked' : ''}> Définir comme escouade active</label>
      <div id="sb-msg" style="font-size:.68em;min-height:18px;text-align:center"></div>
      <button id="sb-save" style="background:${ready ? '#00f5c422' : '#0a1a14'};border:1px solid ${ready ? '#00f5c4' : '#0e2a1f'};color:${ready ? '#00f5c4' : '#3a6655'};padding:9px;cursor:${ready ? 'pointer' : 'default'};font-family:inherit;font-size:.85em;font-weight:700;letter-spacing:.1em">💾 SAUVEGARDER L'ESCOUADE</button>
      <button id="sb-fight" style="background:${ready ? '#ff508022' : '#0a1a14'};border:1px solid ${ready ? '#ff5080' : '#0e2a1f'};color:${ready ? '#ff5080' : '#3a6655'};padding:9px;cursor:${ready ? 'pointer' : 'default'};font-family:inherit;font-size:.85em;font-weight:700;letter-spacing:.1em">⚔️ COMBATTRE</button>`;
    panel.appendChild(footer);

    // Handlers de suppression
    panel.querySelectorAll('[data-rm-champ]').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      const i = +b.dataset.rmChamp; squad.slots[i].champion = null; squad.slots[i].equipment = [];
      renderGrid(); renderPanel();
    }));
    panel.querySelectorAll('[data-rm-eq]').forEach(b => b.addEventListener('click', e => {
      e.stopPropagation();
      const [i, j] = b.dataset.rmEq.split(':').map(Number);
      squad.slots[i].equipment.splice(j, 1);
      renderGrid(); renderPanel();
    }));
    panel.querySelector('[data-rm-terrain]')?.addEventListener('click', e => {
      e.stopPropagation(); squad.terrain = null; renderGrid(); renderPanel();
    });
    panel.querySelector('#sb-active').addEventListener('change', e => { squad.is_active = e.target.checked; });
    if (ready) {
      panel.querySelector('#sb-save').addEventListener('click', saveSquad);
      panel.querySelector('#sb-fight').addEventListener('click', chooseDifficultyThenFight);
    }
  }

  // ── Lancer un combat : sauvegarde (active) puis va à la vue combat ──────────
  function chooseDifficultyThenFight() {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:20000;display:grid;place-items:center;padding:20px';
    overlay.innerHTML = `<div style="background:#05080d;border:1px solid #00f5c4;border-radius:14px;padding:26px 30px;text-align:center;font-family:'Share Tech Mono',monospace;color:#c8ffe8;width:min(360px,92vw)">
      <div style="font-family:'VT323',monospace;font-size:1.7em;color:#00f5c4;letter-spacing:.2em;margin-bottom:16px">DIFFICULTÉ</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <button class="sb-diff" data-d="easy"   style="background:#0a1a14;border:1px solid #22c55e;color:#22c55e;padding:11px;cursor:pointer;font-family:inherit;font-size:.86em;border-radius:8px">🟢 FACILE</button>
        <button class="sb-diff" data-d="normal" style="background:#0a1a14;border:1px solid #42b0ff;color:#42b0ff;padding:11px;cursor:pointer;font-family:inherit;font-size:.86em;border-radius:8px">🔵 NORMAL</button>
        <button class="sb-diff" data-d="hard"   style="background:#0a1a14;border:1px solid #ff2d4e;color:#ff2d4e;padding:11px;cursor:pointer;font-family:inherit;font-size:.86em;border-radius:8px">🔴 DIFFICILE</button>
      </div>
      <button id="sb-diff-cancel" style="margin-top:14px;background:transparent;border:none;color:#3a6655;cursor:pointer;font-family:inherit;font-size:.75em">Annuler</button></div>`;
    document.body.appendChild(overlay);
    overlay.querySelectorAll('.sb-diff').forEach(b => b.addEventListener('click', async () => {
      localStorage.setItem('tcg_squad_difficulty', b.dataset.d);
      overlay.remove();
      const saved = await saveSquad(true);  // force active
      if (!saved) return;                    // combat seulement si la sauvegarde passe
      const m = await import('./squadBattle.js?v=6');
      await m.renderSquadBattle(root, { difficulty: b.dataset.d });
    }));
    overlay.querySelector('#sb-diff-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  }

  // ── Sauvegarde via RPC (forceActive=true pour le flux combat) ──────────────
  async function saveSquad(forceActive) {
    const active = forceActive === true ? true : squad.is_active;
    if (forceActive === true) squad.is_active = true;
    const btn = panel.querySelector('#sb-save');
    if (btn) { btn.disabled = true; btn.textContent = 'SAUVEGARDE…'; }
    const payload = {
      id: squad.id,
      name: (topbar.querySelector('#sb-name').value || 'Escouade').trim(),
      is_active: active,
      terrain: squad.terrain?.id ?? null,
      slots: squad.slots.map(s => ({ champion: s.champion?.id ?? null, equipment: s.equipment.map(e => e.id) })),
    };
    const reset = () => { if (btn) { btn.disabled = false; btn.textContent = '💾 SAUVEGARDER L\'ESCOUADE'; } };
    try {
      const sb = await getClient();
      const { data, error } = await sb.rpc('save_squad', { p_squad: payload });
      if (error || !data?.ok) { flash(data?.error || error?.message || 'Erreur', '#ff8a8a'); reset(); return false; }
      squad.id = data.squad_id;
      flash('Escouade sauvegardée ✅', '#22c55e');
      if (btn) btn.textContent = '✓ SAUVEGARDÉE';
      setTimeout(reset, 1600);
      return true;
    } catch (e) { console.error('[squadBuilder] save', e); flash('Erreur réseau', '#ff8a8a'); reset(); return false; }
  }

  function flash(txt, color = '#42b0ff') {
    const el = panel.querySelector('#sb-msg');
    if (!el) return;
    el.innerHTML = `<span style="color:${color}">${txt}</span>`;
    setTimeout(() => { if (el) el.innerHTML = ''; }, 2400);
  }

  // ── Événements topbar ──────────────────────────────────────────────────────
  topbar.querySelector('#sb-back').addEventListener('click', () => {
    root.innerHTML = '';
    document.getElementById('app-root').style.display = 'none';
    document.querySelector('.shell').style.display = 'grid';
  });
  topbar.querySelector('#sb-search').addEventListener('input', e => { searchTxt = e.target.value; renderGrid(); });
  topbar.querySelector('#sb-type').addEventListener('change', e => { filterType = e.target.value; renderGrid(); });
  topbar.querySelector('#sb-name').addEventListener('input', e => { squad.name = e.target.value; });

  renderGrid();
  renderPanel();
}
