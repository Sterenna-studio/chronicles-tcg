// pages/admin/admin.js — Back-office Chronicles TCG (réservé profiles.role='superuser').
// Page statique séparée du hub SPA (cf. pages/cig/ pour le même pattern). Gate
// d'accès côté client (UX) + RPC SECURITY DEFINER côté serveur qui revalident le
// rôle (cf. supabase/migrations/20260701000000_admin_superuser_tools.sql) — la
// vraie protection est server-side, ce fichier ne fait que refléter l'état.
import { getClient } from '../../logic/supaRaw.js?v=24';
import { url } from '../../logic/paths.js?v=24';
import { ALL_SETS } from '../../logic/sets.js?v=24';
import { attachCardPreview, showCardPreview } from '../../ui/cardPreview.js?v=24';
import { loadAllCardsForAdmin, adminUpsertCard } from '../../data/cardsRepo.js?v=24';
import { loadAllPackTypesForAdmin, adminUpsertPackType } from '../../data/packsRepo.js?v=24';
import { getFxSettings, saveFxSettings, resetFxSettings } from '../../state/settings.js?v=24';

const RC = { Common:'#9da7b3', Rare:'#42b0ff', Epic:'#bb55d3', Legendary:'#ffbe46', Mythical:'#ff5080' };
const TI = { Champion:'⚔️', Companion:'🐾', Event:'⚡', Object:'🔧', Special:'✨', Terrain:'🌍' };
const TYPES = ['Champion', 'Companion', 'Event', 'Object', 'Special', 'Terrain'];
const RARITIES = ['Common', 'Rare', 'Epic', 'Legendary', 'Mythical'];
const SKILL_EFFECTS = [
  'ally_double_turn', 'aoe_damage', 'charge_shield', 'copy_enemy_skill', 'dodge_counter',
  'double_base_attack', 'full_dodge_strike', 'full_team_shield_turn', 'half_damage_riposte',
  'hijack_enemy_object', 'ignore_shield', 'lifedrain', 'negate_next_card', 'negate_next_skill',
  'predict_shot', 'revive_card_from_discard', 'stack_power_on_ko', 'summon_random_companion',
  'target_highest_hp', 'trio_bonus_damage', 'true_damage', 'true_dmg_stun',
];
const PACK_IMAGES = ['set01.jpg', 'set01_champ.jpg', 'set02.jpg', 'Set02_champ.jpg'];

const cardImg = (id) => url(`/assets/cards/${id}.jpg`);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

// ── Styles ──────────────────────────────────────────────────────────────────
const CSS = `
  .adm-wrap{display:flex;flex-direction:column;height:100vh;overflow:hidden}
  .adm-top{display:flex;align-items:center;gap:14px;padding:10px 18px;border-bottom:1px solid var(--border);background:#020508;flex-shrink:0;flex-wrap:wrap}
  .adm-title{font-family:'VT323',monospace;font-size:1.5em;color:var(--red);letter-spacing:.16em}
  .adm-back{background:transparent;border:1px solid #3a6655;color:#8ab4a0;padding:3px 10px;cursor:pointer;font-family:inherit;font-size:.74em;text-decoration:none;border-radius:5px}
  .adm-tabs{display:flex;gap:6px;margin-left:auto}
  .adm-tab{background:transparent;border:1px solid var(--border);color:var(--muted);padding:6px 14px;cursor:pointer;font-family:inherit;font-size:.76em;border-radius:7px;letter-spacing:.06em}
  .adm-tab.active{border-color:var(--cyan);color:var(--cyan);background:#04140f}
  .adm-body{flex:1;overflow:hidden;display:flex}
  .adm-toast{position:fixed;top:14px;right:18px;z-index:99999;padding:9px 16px;border-radius:8px;font-size:.8em;font-weight:700;box-shadow:0 4px 18px rgba(0,0,0,.5);animation:adm-toast-in .15s ease-out}
  @keyframes adm-toast-in{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
  .adm-cols{display:grid;grid-template-columns:1fr 360px;width:100%;overflow:hidden}
  .adm-list-wrap{overflow-y:auto;padding:14px}
  .adm-filters{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
  .adm-filters input,.adm-filters select{background:#050d14;border:1px solid var(--border);color:var(--fg);padding:5px 9px;font-family:inherit;font-size:.78em;border-radius:5px}
  .adm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:8px}
  .adm-card{border-radius:8px;border:1px solid var(--border);background:#04060a;overflow:hidden;cursor:pointer;position:relative;transition:transform .12s,box-shadow .12s}
  .adm-card:hover{transform:translateY(-2px)}
  .adm-card.sel{border-color:var(--cyan);box-shadow:0 0 12px rgba(0,245,196,.3)}
  .adm-card img{width:100%;aspect-ratio:2/3;object-fit:contain;background:#060c10;display:block}
  .adm-card .nm{padding:3px 5px;font-size:.58em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .adm-card .meta{padding:0 5px 4px;font-size:.54em;color:var(--muted);display:flex;justify-content:space-between}
  .adm-card .banned{position:absolute;top:3px;left:3px;background:#ff2d4ecc;color:#fff;font-size:.5em;padding:1px 5px;border-radius:4px;font-weight:700}
  .adm-panel{border-left:1px solid var(--border);background:#020508;overflow-y:auto;padding:16px}
  .adm-field{display:flex;flex-direction:column;gap:3px;margin-bottom:10px}
  .adm-field label{font-size:.66em;color:var(--muted);letter-spacing:.05em}
  .adm-field input,.adm-field select,.adm-field textarea{background:#050d14;border:1px solid var(--border);color:var(--fg);padding:6px 9px;font-family:inherit;font-size:.8em;border-radius:6px;width:100%}
  .adm-field textarea{resize:vertical;min-height:54px}
  .adm-row2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .adm-row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
  .adm-check{display:flex;align-items:center;gap:7px;font-size:.76em;color:var(--fg);cursor:pointer;margin-bottom:10px}
  .adm-btn{font-family:inherit;font-size:.8em;padding:8px 16px;border-radius:7px;cursor:pointer;border:1px solid var(--cyan);background:#00f5c422;color:var(--cyan);font-weight:700}
  .adm-btn:hover{filter:brightness(1.2)}
  .adm-btn.ghost{border-color:var(--border);background:transparent;color:var(--muted);font-weight:400}
  .adm-btn.danger{border-color:var(--red);background:#ff508022;color:var(--red)}
  .adm-panel-title{font-size:.82em;color:var(--cyan);letter-spacing:.08em;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center}
  .adm-list-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;cursor:pointer;background:#04060a}
  .adm-list-row:hover{border-color:#1e4a3a}
  .adm-list-row.sel{border-color:var(--cyan)}
  .adm-list-row img{width:40px;height:56px;object-fit:contain;background:#060c10;border-radius:4px;flex-shrink:0}
  .adm-list-row .info{flex:1;min-width:0}
  .adm-list-row .info .nm{font-size:.8em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .adm-list-row .info .sub{font-size:.64em;color:var(--muted)}
  .adm-pill{font-size:.62em;padding:2px 8px;border-radius:10px;font-weight:700;flex-shrink:0}
  .adm-skill-box{border:1px solid #2a3a4a;border-radius:8px;padding:10px;margin-top:4px;background:#04080c}
  .adm-fxnote{font-size:.7em;color:var(--muted);line-height:1.5;margin-bottom:14px}
`;
function injectCss() {
  if (document.getElementById('adm-css')) return;
  const s = document.createElement('style'); s.id = 'adm-css'; s.textContent = CSS;
  document.head.appendChild(s);
}

function toast(msg, color = '#22c55e') {
  const t = document.createElement('div');
  t.className = 'adm-toast';
  t.style.cssText += `background:${color}22;border:1px solid ${color};color:${color}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

// ── Auth gate ───────────────────────────────────────────────────────────────
async function boot() {
  const root = document.getElementById('admin-root');
  injectCss();
  const sb = await getClient();
  const { data: { session } } = await sb.auth.getSession();
  const user = session?.user ?? null;
  if (!user) return renderDenied(root, "Non connecté — connecte-toi depuis le hub d'abord.");
  const { data: profile, error } = await sb.from('profiles').select('role, username').eq('id', user.id).single();
  if (error || profile?.role !== 'superuser') return renderDenied(root, 'Accès réservé aux comptes superuser.');
  renderAdmin(root, profile);
}

function renderDenied(root, msg) {
  root.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:14px;text-align:center;padding:20px">
      <div style="font-family:'VT323',monospace;font-size:1.8em;color:var(--red);letter-spacing:.15em">⛔ ACCÈS REFUSÉ</div>
      <div style="font-size:.85em;color:var(--muted);max-width:340px">${esc(msg)}</div>
      <a href="../../index.html" class="adm-back" style="font-size:.85em;padding:8px 18px">← Retour au hub</a>
    </div>`;
}

// ── Shell : tabs ────────────────────────────────────────────────────────────
function renderAdmin(root, profile) {
  let tab = 'cards';
  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'adm-wrap';
  wrap.innerHTML = `
    <div class="adm-top">
      <a href="../../index.html" class="adm-back">← Hub</a>
      <span class="adm-title">🛠 ADMIN</span>
      <span style="font-size:.7em;color:var(--muted)">${esc(profile?.username || 'superuser')}</span>
      <div class="adm-tabs">
        <button class="adm-tab" data-tab="cards">🃏 Cartes</button>
        <button class="adm-tab" data-tab="boosters">📦 Boosters</button>
        <button class="adm-tab" data-tab="fx">🔊 UI &amp; Audio</button>
      </div>
    </div>
    <div class="adm-body" id="adm-body"></div>`;
  root.appendChild(wrap);
  const body = wrap.querySelector('#adm-body');
  const tabs = [...wrap.querySelectorAll('.adm-tab')];

  function selectTab(next) {
    tab = next;
    tabs.forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    body.innerHTML = '';
    if (tab === 'cards') renderCardsTab(body);
    else if (tab === 'boosters') renderBoostersTab(body);
    else renderFxTab(body);
  }
  tabs.forEach(b => b.addEventListener('click', () => selectTab(b.dataset.tab)));
  selectTab('cards');
}

// ── Onglet CARTES ───────────────────────────────────────────────────────────
let cardsCache = null;   // chargées une fois par session de page

async function renderCardsTab(body) {
  body.innerHTML = `<div style="padding:20px;color:var(--muted)">Chargement des cartes…</div>`;
  if (!cardsCache) {
    try { cardsCache = await loadAllCardsForAdmin(); }
    catch (e) { body.innerHTML = `<div style="padding:20px;color:#ff8a8a">Erreur de chargement : ${esc(e.message)}</div>`; return; }
  }

  let filter = { q: '', type: 'all', rarity: 'all', set: 'all', banned: 'all' };
  let selected = null;   // carte en cours d'édition (objet) | null = nouvelle

  body.innerHTML = `<div class="adm-cols">
    <div class="adm-list-wrap">
      <div class="adm-filters">
        <input id="cf-q" placeholder="Chercher nom / id…" style="flex:1;min-width:160px">
        <select id="cf-type"><option value="all">Tous types</option>${TYPES.map(t => `<option value="${t}">${TI[t] || ''} ${t}</option>`).join('')}</select>
        <select id="cf-rarity"><option value="all">Toutes raretés</option>${RARITIES.map(r => `<option value="${r}">${r}</option>`).join('')}</select>
        <select id="cf-set"><option value="all">Tous sets</option>${ALL_SETS.map(s => `<option value="${s.id}">${s.id}</option>`).join('')}</select>
        <select id="cf-banned"><option value="all">Bannies + actives</option><option value="banned">Bannies seulement</option><option value="active">Actives seulement</option></select>
        <button class="adm-btn" id="cf-new">+ Nouvelle carte</button>
      </div>
      <div class="adm-grid" id="cf-grid"></div>
    </div>
    <div class="adm-panel" id="cf-panel"></div>
  </div>`;

  const grid = body.querySelector('#cf-grid');
  const panel = body.querySelector('#cf-panel');

  function matches(c) {
    if (filter.type !== 'all' && c.type !== filter.type) return false;
    if (filter.rarity !== 'all' && c.rarity !== filter.rarity) return false;
    if (filter.set !== 'all' && c.set_code !== filter.set) return false;
    if (filter.banned === 'banned' && !c.is_banned) return false;
    if (filter.banned === 'active' && c.is_banned) return false;
    if (filter.q) {
      const q = filter.q.toLowerCase();
      if (!c.name?.toLowerCase().includes(q) && !c.id?.toLowerCase().includes(q)) return false;
    }
    return true;
  }

  function renderGrid() {
    const list = cardsCache.filter(matches);
    grid.innerHTML = '';
    if (!list.length) { grid.innerHTML = `<div style="grid-column:1/-1;color:var(--muted);font-size:.8em;padding:16px">Aucune carte.</div>`; return; }
    list.forEach(c => {
      const rc = RC[c.rarity] || '#9da7b3';
      const el = document.createElement('div');
      el.className = 'adm-card' + (selected?.id === c.id ? ' sel' : '');
      el.style.borderColor = selected?.id === c.id ? 'var(--cyan)' : rc + '55';
      el.innerHTML = `
        ${c.is_banned ? `<span class="banned">BANNIE</span>` : ''}
        <img src="${cardImg(c.id)}" alt="${esc(c.name)}" onerror="this.style.display='none'">
        <div class="nm" style="color:${rc}">${esc(c.name)}</div>
        <div class="meta"><span>${TI[c.type] || ''} ${c.type}</span><span>${c.set_code || '—'}</span></div>`;
      el.addEventListener('click', () => { selected = c; renderGrid(); renderPanel(); });
      attachCardPreview(el, c);
      grid.appendChild(el);
    });
  }

  function blankCard() {
    return { id: '', name: '', type: 'Champion', rarity: 'Common', description: '', power: 0, shield: 0, energy: 0, set_code: ALL_SETS[0]?.id || '', is_banned: false, artwork_url: '', skill: null, slots: 0 };
  }

  function renderPanel() {
    const c = selected || blankCard();
    const isNew = !selected;
    const hasSkill = !!c.skill;
    panel.innerHTML = `
      <div class="adm-panel-title">${isNew ? '✨ NOUVELLE CARTE' : '✏️ ÉDITER'} ${!isNew ? `<button class="adm-btn ghost" id="cf-clear" style="padding:3px 10px;font-size:.85em">Nouvelle</button>` : ''}</div>
      <div class="adm-field"><label>ID (clé, ex. BZH01_RC031)</label><input id="cf-id" value="${esc(c.id)}" ${isNew ? '' : 'disabled'}></div>
      <div class="adm-field"><label>Nom</label><input id="cf-name" value="${esc(c.name)}"></div>
      <div class="adm-row2">
        <div class="adm-field"><label>Type</label><select id="cf-type-f">${TYPES.map(t => `<option value="${t}" ${t === c.type ? 'selected' : ''}>${TI[t] || ''} ${t}</option>`).join('')}</select></div>
        <div class="adm-field"><label>Rareté</label><select id="cf-rarity-f">${RARITIES.map(r => `<option value="${r}" ${r === c.rarity ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
      </div>
      <div class="adm-field"><label>Set</label><input id="cf-set-f" list="adm-set-list" value="${esc(c.set_code || '')}"></div>
      <datalist id="adm-set-list">${ALL_SETS.map(s => `<option value="${s.id}">`).join('')}</datalist>
      <div class="adm-row3">
        <div class="adm-field"><label>⚡ Énergie</label><input id="cf-energy" type="number" min="0" value="${c.energy ?? 0}"></div>
        <div class="adm-field"><label>⚔ Puissance</label><input id="cf-power" type="number" min="0" value="${c.power ?? 0}"></div>
        <div class="adm-field"><label>🛡 Bouclier</label><input id="cf-shield" type="number" min="0" value="${c.shield ?? 0}"></div>
      </div>
      <div class="adm-field"><label>Slots d'équipement (Champion seulement, 0 sinon)</label><input id="cf-slots" type="number" min="0" max="6" value="${c.slots ?? 0}"></div>
      <div class="adm-field"><label>Description (lore)</label><textarea id="cf-desc">${esc(c.description || '')}</textarea></div>
      <label class="adm-check"><input type="checkbox" id="cf-banned" ${c.is_banned ? 'checked' : ''}> Bannie (désactivée — n'apparaît plus en pioche/Atelier)</label>
      <label class="adm-check"><input type="checkbox" id="cf-hasskill" ${hasSkill ? 'checked' : ''}> A une Skill (Champion)</label>
      <div class="adm-skill-box" id="cf-skill-box" style="display:${hasSkill ? '' : 'none'}">
        <div class="adm-field"><label>Nom de la skill</label><input id="cf-skill-name" value="${esc(c.skill?.name || '')}"></div>
        <div class="adm-field"><label>Effet (moteur)</label><input id="cf-skill-effect" list="adm-effect-list" value="${esc(c.skill?.effect || '')}"></div>
        <datalist id="adm-effect-list">${SKILL_EFFECTS.map(e => `<option value="${e}">`).join('')}</datalist>
        <div class="adm-field"><label>Description de la skill</label><textarea id="cf-skill-desc">${esc(c.skill?.desc || '')}</textarea></div>
        <div class="adm-field"><label>Cooldown (tours)</label><input id="cf-skill-cd" type="number" min="0" value="${c.skill?.cooldown ?? 3}"></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="adm-btn" id="cf-save" style="flex:1">💾 Sauvegarder</button>
        <button class="adm-btn ghost" id="cf-preview">👁 Aperçu</button>
      </div>
      <div style="font-size:.62em;color:var(--muted);margin-top:10px;line-height:1.5">L'image vient de <code>/assets/cards/&lt;ID&gt;.jpg</code> (à déposer manuellement) — ce formulaire ne gère pas l'upload d'image.</div>
    `;
    panel.querySelector('#cf-clear')?.addEventListener('click', () => { selected = null; renderGrid(); renderPanel(); });
    panel.querySelector('#cf-hasskill').addEventListener('change', (e) => {
      panel.querySelector('#cf-skill-box').style.display = e.target.checked ? '' : 'none';
    });
    panel.querySelector('#cf-preview').addEventListener('click', () => showCardPreview(readForm()));
    panel.querySelector('#cf-save').addEventListener('click', async () => {
      const payload = readForm();
      if (!payload.id || !payload.name) return toast('ID et nom sont requis.', '#ff8a8a');
      const btn = panel.querySelector('#cf-save'); btn.disabled = true; btn.textContent = 'Sauvegarde…';
      const res = await adminUpsertCard(payload);
      btn.disabled = false; btn.textContent = '💾 Sauvegarder';
      if (!res.ok) return toast(res.error || 'Erreur de sauvegarde', '#ff8a8a');
      const idx = cardsCache.findIndex(x => x.id === res.card.id);
      if (idx >= 0) cardsCache[idx] = res.card; else cardsCache.push(res.card);
      selected = res.card;
      toast(`✅ "${res.card.name}" sauvegardée`, '#22c55e');
      renderGrid(); renderPanel();
    });

    function readForm() {
      const hasSkill = panel.querySelector('#cf-hasskill').checked;
      return {
        id: panel.querySelector('#cf-id').value.trim(),
        name: panel.querySelector('#cf-name').value.trim(),
        type: panel.querySelector('#cf-type-f').value,
        rarity: panel.querySelector('#cf-rarity-f').value,
        set_code: panel.querySelector('#cf-set-f').value.trim() || null,
        energy: Number(panel.querySelector('#cf-energy').value) || 0,
        power: Number(panel.querySelector('#cf-power').value) || 0,
        shield: Number(panel.querySelector('#cf-shield').value) || 0,
        slots: Number(panel.querySelector('#cf-slots').value) || 0,
        description: panel.querySelector('#cf-desc').value.trim() || null,
        is_banned: panel.querySelector('#cf-banned').checked,
        artwork_url: c.artwork_url || null,
        skill: hasSkill ? {
          name: panel.querySelector('#cf-skill-name').value.trim(),
          effect: panel.querySelector('#cf-skill-effect').value.trim(),
          desc: panel.querySelector('#cf-skill-desc').value.trim(),
          cooldown: Number(panel.querySelector('#cf-skill-cd').value) || 0,
        } : null,
      };
    }
  }

  body.querySelector('#cf-q').addEventListener('input', e => { filter.q = e.target.value; renderGrid(); });
  body.querySelector('#cf-type').addEventListener('change', e => { filter.type = e.target.value; renderGrid(); });
  body.querySelector('#cf-rarity').addEventListener('change', e => { filter.rarity = e.target.value; renderGrid(); });
  body.querySelector('#cf-set').addEventListener('change', e => { filter.set = e.target.value; renderGrid(); });
  body.querySelector('#cf-banned').addEventListener('change', e => { filter.banned = e.target.value; renderGrid(); });
  body.querySelector('#cf-new').addEventListener('click', () => { selected = null; renderGrid(); renderPanel(); });

  renderGrid();
  renderPanel();
}

// ── Onglet BOOSTERS ─────────────────────────────────────────────────────────
let packsCache = null;

async function renderBoostersTab(body) {
  body.innerHTML = `<div style="padding:20px;color:var(--muted)">Chargement des boosters…</div>`;
  try { packsCache = await loadAllPackTypesForAdmin(); }
  catch (e) { body.innerHTML = `<div style="padding:20px;color:#ff8a8a">Erreur de chargement : ${esc(e.message)}</div>`; return; }

  let selected = null;

  body.innerHTML = `<div class="adm-cols">
    <div class="adm-list-wrap">
      <div class="adm-filters"><button class="adm-btn" id="pf-new">+ Nouveau booster</button></div>
      <div id="pf-list"></div>
    </div>
    <div class="adm-panel" id="pf-panel"></div>
  </div>`;

  const list = body.querySelector('#pf-list');
  const panel = body.querySelector('#pf-panel');

  function renderList() {
    list.innerHTML = '';
    if (!packsCache.length) { list.innerHTML = `<div style="color:var(--muted);font-size:.8em">Aucun booster.</div>`; return; }
    packsCache.forEach(p => {
      const row = document.createElement('div');
      row.className = 'adm-list-row' + (selected?.id === p.id ? ' sel' : '');
      row.innerHTML = `
        <img src="${url('/assets/packs/' + (p.image_name || 'set01.jpg'))}" onerror="this.style.display='none'">
        <div class="info">
          <div class="nm">${esc(p.name)}</div>
          <div class="sub">Set ${esc(p.set_id)} · ${p.card_count || 5} cartes · ✦ ${p.price}</div>
        </div>
        <span class="adm-pill" style="background:${p.is_active ? '#22c55e22' : '#ff2d4e22'};color:${p.is_active ? '#22c55e' : '#ff8a8a'}">${p.is_active ? 'ACTIF' : 'INACTIF'}</span>`;
      row.addEventListener('click', () => { selected = p; renderList(); renderPanel(); });
      list.appendChild(row);
    });
  }

  function blankPack() {
    return { id: null, name: '', set_id: ALL_SETS[0]?.id || '', image_name: 'set01.jpg', price: 100, card_count: 5, is_active: true };
  }

  function renderPanel() {
    const p = selected || blankPack();
    const isNew = !selected;
    panel.innerHTML = `
      <div class="adm-panel-title">${isNew ? '✨ NOUVEAU BOOSTER' : '✏️ ÉDITER'} ${!isNew ? `<button class="adm-btn ghost" id="pf-clear" style="padding:3px 10px;font-size:.85em">Nouveau</button>` : ''}</div>
      <div class="adm-field"><label>Nom</label><input id="pf-name" value="${esc(p.name)}"></div>
      <div class="adm-field"><label>Set</label><input id="pf-set" list="adm-set-list2" value="${esc(p.set_id)}"></div>
      <datalist id="adm-set-list2">${ALL_SETS.map(s => `<option value="${s.id}">`).join('')}</datalist>
      <div class="adm-field"><label>Image (assets/packs/)</label><select id="pf-image">${PACK_IMAGES.map(img => `<option value="${img}" ${img === p.image_name ? 'selected' : ''}>${img}</option>`).join('')}</select></div>
      <div class="adm-row2">
        <div class="adm-field"><label>Prix (✦)</label><input id="pf-price" type="number" min="0" value="${p.price}"></div>
        <div class="adm-field"><label>Cartes par booster</label><input id="pf-count" type="number" min="1" max="20" value="${p.card_count || 5}"></div>
      </div>
      <label class="adm-check"><input type="checkbox" id="pf-active" ${p.is_active ? 'checked' : ''}> Actif (achetable dans la boutique)</label>
      <button class="adm-btn" id="pf-save" style="width:100%;margin-top:8px">💾 Sauvegarder</button>
      ${!isNew ? `<div style="font-size:.62em;color:var(--muted);margin-top:10px">Pas de suppression : désactive plutôt (les joueurs qui possèdent déjà ce booster gardent leur stock).</div>` : ''}
    `;
    panel.querySelector('#pf-clear')?.addEventListener('click', () => { selected = null; renderList(); renderPanel(); });
    panel.querySelector('#pf-save').addEventListener('click', async () => {
      const payload = {
        id: p.id,
        name: panel.querySelector('#pf-name').value.trim(),
        set_id: panel.querySelector('#pf-set').value.trim(),
        image_name: panel.querySelector('#pf-image').value,
        price: Number(panel.querySelector('#pf-price').value) || 0,
        card_count: Number(panel.querySelector('#pf-count').value) || 5,
        is_active: panel.querySelector('#pf-active').checked,
      };
      if (!payload.name || !payload.set_id) return toast('Nom et set sont requis.', '#ff8a8a');
      const btn = panel.querySelector('#pf-save'); btn.disabled = true; btn.textContent = 'Sauvegarde…';
      const res = await adminUpsertPackType(payload);
      btn.disabled = false; btn.textContent = '💾 Sauvegarder';
      if (!res.ok) return toast(res.error || 'Erreur de sauvegarde', '#ff8a8a');
      const idx = packsCache.findIndex(x => x.id === res.pack.id);
      if (idx >= 0) packsCache[idx] = { ...res.pack, pack_type_id: res.pack.id };
      else packsCache.push({ ...res.pack, pack_type_id: res.pack.id });
      selected = packsCache.find(x => x.id === res.pack.id);
      toast(`✅ "${res.pack.name}" sauvegardé`, '#22c55e');
      renderList(); renderPanel();
    });
  }

  body.querySelector('#pf-new').addEventListener('click', () => { selected = null; renderList(); renderPanel(); });
  renderList();
  renderPanel();
}

// ── Onglet UI & AUDIO ───────────────────────────────────────────────────────
// Seuls des réglages réellement branchés au jeu sont exposés ici (audio du
// reveal de cartes, cf. ui/openingOverlay.js → playRaritySound). L'ancien panneau
// "rays/burst/badge" pilotait un mécanisme de carte flip qui n'existe plus dans le
// flux d'ouverture actuel — retiré plutôt que laissé à régler dans le vide.
function renderFxTab(body) {
  const s = getFxSettings();
  body.innerHTML = `<div style="padding:20px;max-width:420px">
    <div class="adm-fxnote">Ces réglages contrôlent le <b>son de révélation des cartes</b> à l'ouverture d'un booster (<code>ui/openingOverlay.js</code>). Stockés en <code>localStorage</code> côté navigateur — ils s'appliquent à QUI les configure, pas à tous les joueurs (pas de réglage serveur global pour l'instant).</div>
    <label class="adm-check"><input type="checkbox" id="fx-audio-enabled" ${s.audio_enabled ? 'checked' : ''}> Son activé</label>
    <div class="adm-field"><label>Volume</label><input id="fx-audio-volume" type="range" min="0" max="1" step="0.05" value="${s.audio_volume}"></div>
    <div style="display:flex;gap:8px;margin-top:10px">
      <button class="adm-btn" id="fx-save">💾 Sauvegarder</button>
      <button class="adm-btn ghost" id="fx-test">🔊 Tester (legendary)</button>
      <button class="adm-btn ghost" id="fx-reset">↩️ Défauts</button>
    </div>
  </div>`;
  body.querySelector('#fx-save').addEventListener('click', () => {
    saveFxSettings({
      audio_enabled: body.querySelector('#fx-audio-enabled').checked,
      audio_volume: parseFloat(body.querySelector('#fx-audio-volume').value),
    });
    toast('✅ Réglages sauvegardés', '#22c55e');
  });
  body.querySelector('#fx-test').addEventListener('click', () => {
    saveFxSettings({
      audio_enabled: body.querySelector('#fx-audio-enabled').checked,
      audio_volume: parseFloat(body.querySelector('#fx-audio-volume').value),
    });
    try { new Audio(url('/sounds/legendary.mp3')).play().catch(() => {}); } catch {}
  });
  body.querySelector('#fx-reset').addEventListener('click', () => { resetFxSettings(); renderFxTab(body); toast('↩️ Réinitialisé', '#8ab4a0'); });
}

boot();
