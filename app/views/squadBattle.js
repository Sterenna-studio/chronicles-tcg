// app/views/squadBattle.js — Combat Mode Escouade (page dédiée).
// Flux : DÉPLOIEMENT (glisser-déposer des 3 champions sur les positions + terrain,
// placement visuel) → COMBAT (moteur logic/squadEngine.js). Récompenses via le
// ledger (quêtes, bonus quotidien, défis du jour, or de combat). Voir docs/RULES_JRPG.md.
//
// Phase A : UI + déploiement (drag&drop des champions + terrain).
// Phase B1 (cette version) : équipement « en main » — deck de 20, pioche 3/tour,
//   équiper un champion coûte l'énergie de la carte (pool partagé avec l'attaque),
//   échange → défausse, emplacements dynamiques (champion.slots, défaut 3).
//   ⚠️ Deck TEMPORAIRE (buildEquipmentDeck) ; B2 = vrai constructeur à l'Atelier.
import {
  createSquadBattle, championAct, getSquadResult, endSquadPlayerTurn,
  championAttackPower, teamShield, canChampionAct, actionCost, equipCard,
  SQUAD_HP, DECK_SIZE,
} from '../../logic/squadEngine.js?v=15';
import { getClient } from '../../logic/supaRaw.js?v=15';
import { url } from '../../logic/paths.js?v=15';
import { PLAYABLE_SET_IDS, playableSets } from '../../logic/sets.js?v=15';
import { checkAndCompleteSquadChallenges } from '../../logic/challengeEngine.js?v=15';

const RC = { Common:'#9da7b3', Rare:'#42b0ff', Epic:'#bb55d3', Legendary:'#ffbe46', Mythical:'#ff5080' };
const TI = { Champion:'⚔️', Companion:'🐾', Event:'⚡', Object:'🔧', Special:'✨', Terrain:'🌍', Team:'👥' };
const DIFF = { easy:'🟢 FACILE', normal:'🔵 NORMAL', hard:'🔴 DIFFICILE' };
const cardImg = (id) => url(`/assets/cards/${id}.jpg`);
const rnd = (a) => a[Math.floor(Math.random() * a.length)];

// Puissance d'attaque prévue d'un slot {champion, equipment} (avant combat).
const slotAtk = (s) => (s.champion.power || 0) +
  (s.equipment || []).filter(e => ['Object','Companion'].includes(e.type)).reduce((a, e) => a + (e.power || 0), 0);
const slotShield = (s) => (s.equipment || []).filter(e => ['Object','Companion'].includes(e.type)).reduce((a, e) => a + (e.shield || 0), 0);

// Deck d'équipement TEMPORAIRE (B1) : l'équipement déjà choisi dans l'escouade +
// complément aléatoire jusqu'à 20 cartes jouables. ⚠️ Remplacé en B2 par un vrai
// constructeur de deck à l'Atelier (le joueur choisit ses 20 cartes).
function buildEquipmentDeck(squad, cards) {
  const pool = cards.filter(c => ['Object','Companion','Special','Event','Team'].includes(c.type));
  const deck = [];
  (squad.slots || []).forEach(s => (s.equipment || []).forEach(e => deck.push(e)));
  while (deck.length < DECK_SIZE && pool.length) deck.push(rnd(pool));
  return deck.slice(0, DECK_SIZE);
}

// ── Styles (injectés une fois) ─────────────────────────────────────────────────
const CSS = `
  .sqb-wrap{display:flex;flex-direction:column;height:100vh;background:radial-gradient(120% 80% at 50% 0%,#06121a 0%,#04060a 70%);color:#c8ffe8;font-family:'Share Tech Mono','Courier New',monospace;overflow:hidden}
  .sqb-top{display:flex;align-items:center;gap:12px;padding:8px 14px;border-bottom:1px solid #0e2a1f;background:#020508cc;flex-shrink:0}
  .sqb-title{font-family:'VT323',monospace;font-size:1.4em;color:#00f5c4;letter-spacing:.18em;text-shadow:0 0 12px rgba(0,245,196,.5)}
  .sqb-pill{font-size:.66em;color:#8ab4a0;border:1px solid #0e2a1f;border-radius:20px;padding:2px 10px}
  .sqb-quit{background:transparent;border:1px solid #ff2d4e44;color:#ff2d4e99;padding:3px 10px;cursor:pointer;font-family:inherit;font-size:.7em;border-radius:6px}
  .sqb-quit:hover{background:#ff2d4e22;color:#ff6f8a}
  /* ── Déploiement ── */
  .sqb-deploy{flex:1;display:flex;flex-direction:column;overflow-y:auto;padding:14px 16px;gap:14px}
  .sqb-deploy-hint{text-align:center;font-size:.8em;color:#8ab4a0;line-height:1.5}
  .sqb-deploy-hint b{color:#00f5c4}
  .sqb-positions{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}
  .sqb-slot{width:120px;aspect-ratio:2/3;border:2px dashed #1e4a3a;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;background:#04100b66;cursor:pointer;transition:border-color .15s,box-shadow .15s,background .15s;position:relative}
  .sqb-slot .sqb-slot-num{font-family:'VT323',monospace;font-size:1.6em;color:#1e4a3a;letter-spacing:.1em}
  .sqb-slot .sqb-slot-lbl{font-size:.56em;color:#3a6655;letter-spacing:.12em}
  .sqb-slot.over{border-color:#00f5c4;box-shadow:0 0 20px rgba(0,245,196,.25);background:#04140f}
  .sqb-slot.target{border-color:#ffbe46;box-shadow:0 0 16px rgba(240,165,0,.2)}
  .sqb-terrain-slot{width:120px;aspect-ratio:3/2;border:2px dashed #3a5a2a;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#0a120466;cursor:pointer;transition:all .15s}
  .sqb-terrain-slot.over,.sqb-terrain-slot.target{border-color:#9be15d;box-shadow:0 0 16px rgba(155,225,93,.2)}
  .sqb-hand{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;padding-top:8px;border-top:1px solid #0e2a1f}
  .sqb-card{width:104px;border:1px solid #0e2a1f;border-radius:10px;padding:5px;background:#05080d;cursor:grab;transition:transform .12s,border-color .15s,box-shadow .15s;user-select:none}
  .sqb-card:hover{transform:translateY(-4px)}
  .sqb-card.picked{border-color:#00f5c4;box-shadow:0 0 18px rgba(0,245,196,.3);transform:translateY(-4px)}
  .sqb-card img{width:100%;aspect-ratio:2/3;object-fit:contain;background:#060c10;border-radius:6px;pointer-events:none}
  .sqb-card .nm{font-size:.58em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:3px}
  .sqb-card .st{font-size:.56em;color:#7fb3a0;display:flex;justify-content:space-between;margin-top:1px}
  .sqb-deploy-actions{display:flex;gap:10px;justify-content:center;padding:6px 0 2px}
  /* ── Combat ── */
  .sqb-arena{flex:1;display:grid;grid-template-rows:auto 1fr auto;overflow:hidden}
  .sqb-side{padding:8px 14px}
  .sqb-side-enemy{border-bottom:1px solid #0e2a1f;background:linear-gradient(180deg,#150509,#0a0508)}
  .sqb-side-player{border-top:1px solid #0e2a1f;background:linear-gradient(0deg,#05140d,#04100b)}
  .sqb-side-lbl{font-size:.64em;letter-spacing:.12em;margin-bottom:5px;display:flex;align-items:center;gap:6px}
  .sqb-row{display:flex;gap:8px}
  .sqb-champ{flex:1;min-width:0;border:1px solid #0e2a1f;border-radius:10px;padding:6px;background:#04060acc;position:relative;transition:border-color .15s,box-shadow .15s,transform .1s}
  .sqb-champ.clk{cursor:pointer}
  .sqb-champ.clk:hover{transform:translateY(-2px)}
  .sqb-champ.sel{border-color:#00f5c4;box-shadow:0 0 16px rgba(0,245,196,.3);background:#04140f}
  .sqb-champ.acted{opacity:.45}
  .sqb-champ img{width:100%;aspect-ratio:2/3;object-fit:contain;background:#060c10;border-radius:6px}
  .sqb-champ .nm{font-size:.56em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:3px}
  .sqb-champ .st{font-size:.55em;color:#6fa694;display:flex;justify-content:space-between}
  .sqb-champ .eq{font-size:.6em;color:#5a7a6a;min-height:13px}
  .sqb-champ .badge{position:absolute;top:4px;right:5px;font-size:.6em}
  .sqb-bar{display:flex;align-items:center;gap:8px;margin-top:6px}
  .sqb-bar .hp{font-size:.7em;min-width:64px}
  .sqb-track{flex:1;height:11px;background:#0a1a14;border:1px solid #0e2a1f;border-radius:7px;overflow:hidden}
  .sqb-track > div{height:100%;transition:width .35s ease}
  .sqb-bar .meta{font-size:.66em;color:#8ab4a0;display:flex;gap:8px;flex-shrink:0}
  .sqb-log{overflow-y:auto;padding:8px 14px;font-size:.72em;color:#6fa694;line-height:1.55;background:#04060a}
  .sqb-log .vs{text-align:center;color:#1e4a3a;letter-spacing:.4em;font-family:'VT323',monospace;font-size:1.2em;margin:2px 0 6px}
  .sqb-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 14px;border-top:1px solid #0e2a1f;background:#020508;min-height:54px;flex-shrink:0}
  .sqb-hint{font-size:.74em;color:#3a6655}
  .sqb-btn{font-family:inherit;font-size:.76em;padding:8px 13px;border-radius:7px;cursor:pointer;transition:filter .12s}
  .sqb-btn:hover:not(:disabled){filter:brightness(1.18)}
  .sqb-btn:disabled{opacity:.4;cursor:default}
  .sqb-cta{background:linear-gradient(90deg,#003d2e,#005a42);border:1px solid #00f5c4;color:#00f5c4;font-family:inherit;font-size:.9em;letter-spacing:.1em;padding:11px 26px;border-radius:9px;cursor:pointer;text-shadow:0 0 8px rgba(0,245,196,.4);box-shadow:0 0 20px rgba(0,245,196,.14)}
  .sqb-cta:disabled{opacity:.4;cursor:default;box-shadow:none}
  .sqb-ghost{background:transparent;border:1px solid #3a6655;color:#8ab4a0;font-family:inherit;font-size:.78em;padding:9px 16px;border-radius:8px;cursor:pointer}
  /* ── Main d'équipement (combat) ── */
  .sqb-hand-combat{border-top:1px solid #0e2a1f;background:#03100bcc;padding:6px 12px;flex-shrink:0}
  .sqb-hand-lbl{font-size:.6em;letter-spacing:.1em;color:#5a7a6a;margin-bottom:4px}
  .sqb-hand-lbl b{color:#00f5c4}
  .sqb-hand-row{display:flex;gap:7px;overflow-x:auto;padding-bottom:3px}
  .sqb-hcard{flex:0 0 auto;width:72px;border:1px solid #0e2a1f;border-radius:8px;padding:4px;background:#05080d;cursor:grab;transition:transform .12s,border-color .15s,box-shadow .15s;user-select:none}
  .sqb-hcard:hover{transform:translateY(-3px)}
  .sqb-hcard.picked{border-color:#00f5c4;box-shadow:0 0 14px rgba(0,245,196,.35);transform:translateY(-3px)}
  .sqb-hcard.dim{opacity:.45}
  .sqb-hcard img{width:100%;aspect-ratio:2/3;object-fit:contain;background:#060c10;border-radius:5px;pointer-events:none}
  .sqb-hcard .nm{font-size:.52em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;color:#c8ffe8}
  .sqb-hcard .st{font-size:.52em;color:#7fb3a0}
  .sqb-champ.equipable{border-color:#00f5c4 !important;box-shadow:0 0 12px rgba(0,245,196,.25)}
  .sqb-replace{display:inline-block;font-size:.62em;color:#ff8a8a;border:1px solid #ff2d4e55;border-radius:5px;padding:1px 5px;margin:1px 2px 0 0;cursor:pointer}
  .sqb-replace:hover{background:#ff2d4e22}
  @media(max-width:560px){ .sqb-card{width:84px} .sqb-slot,.sqb-terrain-slot{width:96px} }
`;
function injectCss() {
  if (document.getElementById('sqb-css')) return;
  const s = document.createElement('style'); s.id = 'sqb-css'; s.textContent = CSS;
  document.head.appendChild(s);
}

async function loadCombatCards() {
  try {
    const sb = await getClient();
    const { data } = await sb.from('cards').select('*').in('set_code', PLAYABLE_SET_IDS);
    if (data && data.length) return data;
  } catch {}
  const results = await Promise.all(playableSets().map(s => fetch(url(s.file)).then(r => r.json())));
  return results.flat();
}
async function loadActiveSquad() {
  try {
    const sb = await getClient();
    const { data } = await sb.rpc('load_squad');
    return data?.ok ? data.squad : null;
  } catch { return null; }
}

// ── Génération de l'escouade ennemie ──────────────────────────────────────────
function generateEnemySquad(cards, difficulty) {
  const champs = cards.filter(c => c.type === 'Champion');
  const pools = {
    easy:   champs.filter(c => ['Common','Rare'].includes(c.rarity)),
    normal: champs.filter(c => ['Common','Rare','Epic'].includes(c.rarity)),
    hard:   champs,
  };
  let pool = pools[difficulty] || pools.normal;
  if (pool.length < 3) pool = champs;
  const chosen = [...pool].sort(() => Math.random() - 0.5).slice(0, 3);

  const passives = cards.filter(c => ['Object','Companion'].includes(c.type));
  const actives  = cards.filter(c => ['Special','Event','Team'].includes(c.type));
  const terrains = cards.filter(c => c.type === 'Terrain');
  const equipPer = { easy: 1, normal: 2, hard: 3 }[difficulty] ?? 2;

  const slots = chosen.map(ch => {
    const eq = [];
    for (let k = 0; k < equipPer; k++) {
      const src = (difficulty === 'hard' && k === equipPer - 1 && actives.length) ? actives : passives;
      if (src.length) eq.push(rnd(src));
    }
    return { champion: ch, equipment: eq };
  });
  const terrain = (difficulty === 'hard' && terrains.length) ? rnd(terrains) : null;
  return { slots, terrain };
}

// ── Récompenses (ledger) ───────────────────────────────────────────────────────
async function awardGold(amount, meta) {
  try {
    const sb = await getClient();
    const { data } = await sb.rpc('award_squad_reward', { p_amount: amount, p_meta: meta || {} });
    return data?.ok ? data.balance : null;
  } catch (e) { console.warn('[squadBattle] award', e); return null; }
}
async function awardDailyWin() {
  try {
    const sb = await getClient();
    const { data } = await sb.rpc('award_daily_squad_win');
    return (data?.ok && data.rewarded) ? data.amount : 0;
  } catch (e) { console.warn('[squadBattle] daily win', e); return 0; }
}
async function claimSquadQuests(diff) {
  const ids = ['squad_first_win', ...(diff === 'hard' ? ['squad_win_hard'] : [])];
  const done = [];
  try {
    const sb = await getClient();
    for (const id of ids) {
      const { data } = await sb.rpc('claim_quest', { p_quest_id: id });
      if (data?.ok) done.push({ title: data.quest_title, earned: data.chronicles_earned });
    }
  } catch (e) { console.warn('[squadBattle] quests', e); }
  return done;
}

function backToHub(root) {
  root.innerHTML = '';
  document.getElementById('app-root').style.display = 'none';
  document.querySelector('.shell').style.display = 'grid';
  window.dispatchEvent(new Event('hub:refresh'));   // resync solde + parcours + défis
}

// ── Entrée ──────────────────────────────────────────────────────────────────────
export async function renderSquadBattle(root, opts = {}) {
  injectCss();
  const difficulty = opts.difficulty || localStorage.getItem('tcg_squad_difficulty') || 'normal';
  root.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#3a6655;font-family:'Share Tech Mono',monospace">Préparation du combat…</div>`;

  const [cards, playerSquad] = await Promise.all([
    loadCombatCards(),
    opts.playerSquad ? Promise.resolve(opts.playerSquad) : loadActiveSquad(),
  ]);

  const champCount = playerSquad?.slots?.filter(s => s.champion).length || 0;
  if (!playerSquad || champCount < 3) {
    root.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:16px;color:#c8ffe8;font-family:'Share Tech Mono',monospace;text-align:center;padding:20px">
        <div style="font-family:'VT323',monospace;font-size:2em;color:#00f5c4;letter-spacing:.2em">AUCUNE ESCOUADE</div>
        <div style="font-size:.85em;max-width:360px;line-height:1.6">Monte une escouade de 3 champions dans l'Atelier avant de combattre.</div>
        <button class="sqb-ghost" id="go-atelier">→ Atelier d'escouade</button>
      </div>`;
    root.querySelector('#go-atelier').addEventListener('click', () => import('./squadBuilder.js?v=15').then(m => m.renderSquadBuilder(root)));
    return;
  }

  // Deck d'équipement (mode "en main") : le deck choisi à l'Atelier (load_squad →
  // equipmentDeck) est prioritaire. Sinon (vieille escouade ou deck vide) on en
  // bâtit un depuis l'équipement de slots + complément aléatoire.
  if (!Array.isArray(playerSquad.equipmentDeck) || playerSquad.equipmentDeck.length === 0) {
    playerSquad.equipmentDeck = buildEquipmentDeck(playerSquad, cards);
  }
  // Les champions démarrent nus : l'équipement se joue depuis la main en combat.
  playerSquad.slots = playerSquad.slots.map(s => ({ ...s, equipment: [] }));

  // Rejouer : on saute le déploiement (même disposition).
  const arranged = (opts.skipDeploy && opts.playerSquad)
    ? playerSquad
    : await runDeployment(root, playerSquad, difficulty);
  if (!arranged) return; // quitté pendant le déploiement
  startCombat(root, arranged, cards, difficulty);
}

// ── Phase DÉPLOIEMENT ─────────────────────────────────────────────────────────
function runDeployment(root, squad, difficulty) {
  return new Promise((resolve) => {
    const hand = squad.slots.map(s => ({ ...s }));   // {champion, equipment}
    const terrainCard = squad.terrain || null;
    const positions = [null, null, null];            // slots placés (gauche→droite)
    let terrainSlot = null;
    let picked = null;   // { kind:'champ', id } | { kind:'terrain' }

    const wrap = document.createElement('div');
    wrap.className = 'sqb-wrap';
    wrap.innerHTML = `
      <div class="sqb-top">
        <button class="sqb-quit" id="d-quit">✕ Quitter</button>
        <span class="sqb-title">DÉPLOIEMENT</span>
        <span class="sqb-pill">${DIFF[difficulty]}</span>
        <div style="flex:1"></div>
        <span class="sqb-pill" id="d-count">0/3 placés</span>
      </div>
      <div class="sqb-deploy">
        <div class="sqb-deploy-hint">Place tes <b>3 champions</b> sur les positions${terrainCard ? ' et ton <b>terrain</b>' : ''}.<br>Glisse une carte, ou <b>clique</b> une carte puis une position (mobile). <span style="color:#5a7a6a">L'équipement se pioche et s'attribue en combat.</span></div>
        <div class="sqb-positions" id="d-positions"></div>
        ${terrainCard ? `<div style="display:flex;justify-content:center"><div class="sqb-terrain-slot" id="d-terrain"></div></div>` : ''}
        <div class="sqb-hand" id="d-hand"></div>
        <div class="sqb-deploy-actions">
          <button class="sqb-ghost" id="d-auto">⚡ Déploiement auto</button>
          <button class="sqb-cta" id="d-start" disabled>COMMENCER LE COMBAT ▶</button>
        </div>
      </div>`;
    root.innerHTML = '';
    root.appendChild(wrap);

    const elPos  = wrap.querySelector('#d-positions');
    const elTerr = wrap.querySelector('#d-terrain');
    const elHand = wrap.querySelector('#d-hand');
    const elStart= wrap.querySelector('#d-start');
    const elCount= wrap.querySelector('#d-count');

    const placedIds = () => positions.filter(Boolean).map(s => s.champion.id);
    const inHand = () => hand.filter(s => !placedIds().includes(s.champion.id));

    function cardHtml(slot) {
      const rc = RC[slot.champion.rarity] || '#9da7b3';
      const eq = (slot.equipment || []).map(e => TI[e.type] || '🔧').join('');
      return `<img src="${cardImg(slot.champion.id)}" onerror="this.style.display='none'">
        <div class="nm" style="color:${rc}">${slot.champion.name}</div>
        <div class="st"><span>⚔${slotAtk(slot)}</span><span>🛡${slotShield(slot)}</span></div>
        <div class="st" style="color:#5a7a6a">${eq || '—'}</div>`;
    }

    function render() {
      // Positions
      elPos.innerHTML = '';
      positions.forEach((slot, i) => {
        const d = document.createElement('div');
        d.className = 'sqb-slot' + (slot ? ' filled' : '') + (picked?.kind === 'champ' && !slot ? ' target' : '');
        if (slot) {
          d.innerHTML = cardHtml(slot);
          d.title = 'Cliquer pour retirer';
        } else {
          d.innerHTML = `<div class="sqb-slot-num">${i + 1}</div><div class="sqb-slot-lbl">POSITION</div>`;
        }
        d.addEventListener('dragover', (e) => { e.preventDefault(); d.classList.add('over'); });
        d.addEventListener('dragleave', () => d.classList.remove('over'));
        d.addEventListener('drop', (e) => { e.preventDefault(); d.classList.remove('over'); onDropChamp(i); });
        d.addEventListener('click', () => onSlotClick(i));
        elPos.appendChild(d);
      });
      // Terrain
      if (elTerr) {
        elTerr.className = 'sqb-terrain-slot' + (picked?.kind === 'terrain' ? ' target' : '');
        if (terrainSlot) {
          elTerr.innerHTML = `<div style="font-size:1.5em">🌍</div><div style="font-size:.58em;color:#9be15d;max-width:108px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${terrainSlot.name}</div>`;
        } else {
          elTerr.innerHTML = `<div style="font-size:1.4em;opacity:.4">🌍</div><div class="sqb-slot-lbl">TERRAIN</div>`;
        }
        elTerr.ondragover = (e) => { e.preventDefault(); elTerr.classList.add('over'); };
        elTerr.ondragleave = () => elTerr.classList.remove('over');
        elTerr.ondrop = (e) => { e.preventDefault(); elTerr.classList.remove('over'); if (picked?.kind === 'terrain' || draggingTerrain) placeTerrain(); };
        elTerr.onclick = () => { if (terrainSlot) { terrainSlot = null; render(); } else if (picked?.kind === 'terrain') placeTerrain(); };
      }
      // Main
      elHand.innerHTML = '';
      inHand().forEach((slot) => {
        const c = document.createElement('div');
        c.className = 'sqb-card' + (picked?.kind === 'champ' && picked.id === slot.champion.id ? ' picked' : '');
        c.draggable = true;
        c.innerHTML = cardHtml(slot);
        c.addEventListener('dragstart', () => { picked = { kind: 'champ', id: slot.champion.id }; draggingTerrain = false; });
        c.addEventListener('click', () => { picked = (picked?.id === slot.champion.id) ? null : { kind: 'champ', id: slot.champion.id }; render(); });
        elHand.appendChild(c);
      });
      if (terrainCard && !terrainSlot) {
        const t = document.createElement('div');
        t.className = 'sqb-card' + (picked?.kind === 'terrain' ? ' picked' : '');
        t.draggable = true;
        t.style.width = '104px';
        t.innerHTML = `<img src="${cardImg(terrainCard.id)}" onerror="this.style.display='none'">
          <div class="nm" style="color:#9be15d">${terrainCard.name}</div>
          <div class="st" style="color:#5a7a6a">🌍 Terrain</div>`;
        t.addEventListener('dragstart', () => { picked = { kind: 'terrain' }; draggingTerrain = true; });
        t.addEventListener('click', () => { picked = picked?.kind === 'terrain' ? null : { kind: 'terrain' }; render(); });
        elHand.appendChild(t);
      }
      if (!inHand().length && (!terrainCard || terrainSlot)) {
        elHand.innerHTML = `<div class="sqb-hint" style="padding:10px">Tout est placé — prêt au combat !</div>`;
      }
      // État
      const n = placedIds().length;
      elCount.textContent = `${n}/3 placés`;
      elStart.disabled = n < 3;
    }

    let draggingTerrain = false;

    function firstEmpty() { return positions.findIndex(p => !p); }
    function placeChampAt(i) {
      if (!picked || picked.kind !== 'champ') return;
      const slot = hand.find(s => s.champion.id === picked.id);
      if (!slot) return;
      // retire-le d'une position existante (déplacement)
      const cur = positions.findIndex(p => p && p.champion.id === slot.champion.id);
      if (cur >= 0) positions[cur] = null;
      positions[i] = slot;
      picked = null;
      render();
    }
    function onDropChamp(i) { if (picked?.kind === 'champ') placeChampAt(i); }
    function onSlotClick(i) {
      if (positions[i]) {            // retirer → revient en main
        positions[i] = null; picked = null; render();
      } else if (picked?.kind === 'champ') {
        placeChampAt(i);
      }
    }
    function placeTerrain() { terrainSlot = terrainCard; picked = null; render(); }

    wrap.querySelector('#d-auto').addEventListener('click', () => {
      hand.forEach((s, i) => { if (i < 3) positions[i] = s; });
      if (terrainCard) terrainSlot = terrainCard;
      picked = null; render();
    });
    wrap.querySelector('#d-start').addEventListener('click', () => {
      if (placedIds().length < 3) return;
      resolve({ slots: positions.filter(Boolean), terrain: terrainSlot, equipmentDeck: squad.equipmentDeck });
    });
    wrap.querySelector('#d-quit').addEventListener('click', () => { backToHub(root); resolve(null); });

    render();
  });
}

// ── Phase COMBAT ─────────────────────────────────────────────────────────────
function startCombat(root, playerSquad, cards, difficulty) {
  const enemySquad = generateEnemySquad(cards, difficulty);
  let state = createSquadBattle(playerSquad, enemySquad);
  let selected = null;
  let busy = false;
  let pickedHand = null;     // index de la carte d'équipement sélectionnée (main)
  let replaceChamp = null;   // index du champion en attente d'un choix de remplacement
  const stats = { damageDealt: 0, highestHit: 0, skillsUsed: 0, activesUsed: 0, eventsUsed: 0 };

  const wrap = document.createElement('div');
  wrap.className = 'sqb-wrap';
  wrap.innerHTML = `
    <div class="sqb-top">
      <button class="sqb-quit" id="sq-flee">✕ Fuir</button>
      <span class="sqb-title">COMBAT ESCOUADE</span>
      <span class="sqb-pill">${DIFF[difficulty]}</span>
      <div style="flex:1"></div>
      <span class="sqb-pill" id="sq-turn" style="color:#ffbe46;border-color:#3a2a05">Tour 1</span>
    </div>
    <div class="sqb-arena">
      <div class="sqb-side sqb-side-enemy" id="sq-enemy"></div>
      <div class="sqb-log" id="sq-log"></div>
      <div class="sqb-side sqb-side-player" id="sq-player"></div>
    </div>
    <div class="sqb-hand-combat" id="sq-hand"></div>
    <div class="sqb-actions" id="sq-actions"></div>`;
  root.innerHTML = '';
  root.appendChild(wrap);

  const enemyZone = wrap.querySelector('#sq-enemy');
  const playerZone = wrap.querySelector('#sq-player');
  const logEl = wrap.querySelector('#sq-log');
  const handEl = wrap.querySelector('#sq-hand');
  const actionBar = wrap.querySelector('#sq-actions');

  function bar(side, color) {
    const pct = Math.max(0, Math.min(100, (side.hp / SQUAD_HP) * 100));
    return `<div class="sqb-bar">
      <span class="hp" style="color:${color}">❤ ${side.hp}/${SQUAD_HP}</span>
      <div class="sqb-track"><div style="width:${pct}%;background:${color}"></div></div>
      <span class="meta"><span style="color:#ffbe46">⚡${side.energy}</span><span style="color:#7fb3a0">🛡${teamShield(side)}</span></span>
    </div>`;
  }
  function champHtml(side, i, sideKey) {
    const ch = side.champions[i];
    const rc = RC[ch.rarity] || '#9da7b3';
    const cd = side.skillCooldowns?.[ch.id] || 0;
    const isSel = sideKey === 'player' && selected === i;
    const equipable = sideKey === 'player' && pickedHand != null && state.phase === 'player_turn';
    const cls = 'sqb-champ' + (sideKey === 'player' ? ' clk' : '') + (isSel ? ' sel' : '')
      + (ch.actedThisTurn && sideKey === 'player' ? ' acted' : '') + (equipable ? ' equipable' : '');
    const badge = cd > 0 ? '⏳' + cd : (ch.skill ? '✨' : '');
    // En attente d'un remplacement : l'équipement devient des cibles cliquables.
    const eqLine = (sideKey === 'player' && replaceChamp === i)
      ? ch.equipment.map((e, ei) => `<span class="sqb-replace" data-replace="${i}:${ei}">${TI[e.type] || '🔧'}✕</span>`).join('')
      : ch.equipment.map(e => TI[e.type] || '🔧').join(' ') + (sideKey === 'player' ? ` <span style="color:#3a6655">${ch.equipment.length}/${ch.slots}</span>` : '');
    return `<div class="${cls}" data-champ="${sideKey}:${i}" style="border-color:${isSel ? '#00f5c4' : rc + '55'}">
      <span class="badge">${badge}</span>
      <img src="${cardImg(ch.id)}" onerror="this.style.display='none'">
      <div class="nm" style="color:${rc}">${ch.name}</div>
      <div class="st"><span>⚔${championAttackPower(side, i)}</span><span>${ch.energy}⚡</span></div>
      <div class="eq">${eqLine}</div>
    </div>`;
  }

  function render() {
    wrap.querySelector('#sq-turn').textContent = `Tour ${state.turn}`;
    enemyZone.innerHTML = `<div class="sqb-side-lbl" style="color:#ff6f8a">⬢ ESCOUADE ADVERSE</div>
      <div class="sqb-row">${[0,1,2].map(i => champHtml(state.enemy, i, 'enemy')).join('')}</div>
      ${bar(state.enemy, '#ff5080')}`;
    playerZone.innerHTML = `${bar(state.player, '#00f5c4')}
      <div class="sqb-row">${[0,1,2].map(i => champHtml(state.player, i, 'player')).join('')}</div>
      <div class="sqb-side-lbl" style="color:#00f5c4;justify-content:flex-end">TON ESCOUADE ⬢</div>`;
    logEl.innerHTML = `<div class="vs">— ⚔ —</div>` + state.log.slice(-6).map(l => `<div>${l.replace(/</g,'&lt;')}</div>`).join('');
    logEl.scrollTop = logEl.scrollHeight;
    playerZone.querySelectorAll('[data-champ^="player"]').forEach(el => {
      const i = +el.dataset.champ.split(':')[1];
      el.addEventListener('click', (ev) => {
        if (busy || state.phase !== 'player_turn') return;
        const chip = ev.target.closest('.sqb-replace');
        if (chip) { const [ci, ei] = chip.dataset.replace.split(':').map(Number); tryEquip(ci, ei); return; }
        if (pickedHand != null) { tryEquip(i); return; }   // équiper la carte choisie
        selected = (selected === i) ? null : i; replaceChamp = null; render();
      });
      el.addEventListener('dragover', (e) => { if (pickedHand != null) e.preventDefault(); });
      el.addEventListener('drop', (e) => { e.preventDefault(); if (pickedHand != null) tryEquip(i); });
    });
    renderHand();
    renderActions();
  }

  function tryEquip(championIndex, replaceIdx = null) {
    if (pickedHand == null) return;
    const r = equipCard(state, 'player', championIndex, pickedHand, replaceIdx);
    if (!r.ok) {
      if (r.needsReplace) { replaceChamp = championIndex; render(); flashLog('Emplacements pleins — choisis une carte à remplacer.'); return; }
      flashLog(r.reason); return;
    }
    state = r.state; pickedHand = null; replaceChamp = null;
    render();
  }

  function renderHand() {
    if (!state.player.useDeck) { handEl.style.display = 'none'; return; }
    const hand = state.player.equipHand;
    const picking = pickedHand != null;
    handEl.innerHTML = `<div class="sqb-hand-lbl">MAIN ÉQUIPEMENT · <b>${hand.length}</b> · deck ${state.player.equipDeck.length} · défausse ${state.player.equipDiscard.length}${picking ? ' — clique un champion pour équiper' : ''}</div><div class="sqb-hand-row" id="sq-hand-row"></div>`;
    const row = handEl.querySelector('#sq-hand-row');
    if (!hand.length) { row.innerHTML = `<span class="sqb-hint">Main vide — tu pioches 3 cartes au début de ton tour.</span>`; return; }
    hand.forEach((card, idx) => {
      const cost = actionCost(card);
      const affordable = state.player.energy >= cost && state.phase === 'player_turn';
      const d = document.createElement('div');
      d.className = 'sqb-hcard' + (pickedHand === idx ? ' picked' : '') + (affordable ? '' : ' dim');
      d.draggable = true;
      d.innerHTML = `<img src="${cardImg(card.id)}" onerror="this.style.display='none'">
        <div class="nm">${card.name}</div>
        <div class="st">${TI[card.type] || '🔧'} ${cost}⚡ · ⚔${card.power || 0} 🛡${card.shield || 0}</div>`;
      d.addEventListener('click', () => { pickedHand = (pickedHand === idx) ? null : idx; replaceChamp = null; render(); });
      d.addEventListener('dragstart', () => { pickedHand = idx; replaceChamp = null; });
      row.appendChild(d);
    });
  }

  function btn(label, enabled, onClick, color = '#00f5c4') {
    const b = document.createElement('button');
    b.className = 'sqb-btn'; b.textContent = label; b.disabled = !enabled;
    b.style.cssText += `background:${color}22;border:1px solid ${enabled ? color : '#0e2a1f'};color:${enabled ? color : '#3a6655'}`;
    if (enabled) b.addEventListener('click', onClick);
    return b;
  }
  function renderActions() {
    actionBar.innerHTML = '';
    if (getSquadResult(state)) return;
    if (state.phase !== 'player_turn') { actionBar.innerHTML = `<span class="sqb-hint">Tour adverse…</span>`; return; }
    if (selected == null) { actionBar.innerHTML = `<span class="sqb-hint">↑ Sélectionne un champion pour agir.</span>`; }
    else {
      const ch = state.player.champions[selected];
      const E = state.player.energy;
      if (!canChampionAct(state, 'player', selected)) {
        actionBar.innerHTML = `<span class="sqb-hint">${ch.name} a déjà agi ce tour.</span>`;
      } else {
        const basic = actionCost(ch, 'basic');
        actionBar.appendChild(btn(`⚔️ Attaque (${basic}⚡)`, E >= basic, () => doAct(selected, { type: 'basic' })));
        if (ch.skill) {
          const cd = state.player.skillCooldowns?.[ch.id] || 0;
          const cost = actionCost(ch, 'skill');
          actionBar.appendChild(btn(`✨ ${ch.skill.name} (${cost}⚡${cd ? ' ⏳' + cd : ''})`, cd === 0 && E >= cost, () => doAct(selected, { type: 'skill' }), '#bb55d3'));
        }
        ch.equipment.forEach((e, idx) => {
          if (!['Special','Event','Team'].includes(e.type)) return;
          const oneshot = ['Event','Team'].includes(e.type);
          const eCost = actionCost(e, 'active');
          actionBar.appendChild(btn(`${TI[e.type]} ${e.name} (${eCost}⚡${oneshot ? ' 1×' : ''})`, !(oneshot && ch.usedActives[idx]) && E >= eCost, () => doAct(selected, { type: 'active', equipIndex: idx }), '#ffbe46'));
        });
      }
    }
    const end = btn('⏭️ Fin du tour', true, endTurn, '#42b0ff');
    end.style.marginLeft = 'auto';
    actionBar.appendChild(end);
  }

  function doAct(i, action) {
    if (busy) return;
    const equip = action.type === 'active' ? state.player.champions[i].equipment[action.equipIndex] : null;
    const eHpBefore = state.enemy.hp;
    const res = championAct(state, 'player', i, action);
    if (!res.ok) { flashLog(res.reason); return; }
    state = res.state;
    const dmg = Math.max(0, eHpBefore - state.enemy.hp);
    stats.damageDealt += dmg;
    if (dmg > stats.highestHit) stats.highestHit = dmg;
    if (action.type === 'skill') stats.skillsUsed++;
    if (action.type === 'active') { stats.activesUsed++; if (equip?.type === 'Event') stats.eventsUsed++; }
    selected = null; pickedHand = null; replaceChamp = null;
    render();
    if (getSquadResult(state)) return finish();
  }
  function endTurn() {
    if (busy) return;
    busy = true; selected = null; pickedHand = null; replaceChamp = null;
    state = endSquadPlayerTurn(state, difficulty);
    busy = false;
    render();
    if (getSquadResult(state)) finish();
  }
  function flashLog(msg) {
    state.log.push(`  ⚠️ ${msg}`);
    logEl.innerHTML = `<div class="vs">— ⚔ —</div>` + state.log.slice(-6).map(l => `<div>${l.replace(/</g,'&lt;')}</div>`).join('');
    logEl.scrollTop = logEl.scrollHeight;
  }

  async function finish() {
    const res = getSquadResult(state);
    let balanceTxt = '', questHtml = '', dailyHtml = '', challengeHtml = '';
    if (res.winner === 'player') {
      const claimed = await claimSquadQuests(difficulty);
      if (claimed.length) {
        questHtml = `<div style="margin:-8px 0 16px;padding:10px;border:1px solid #ffbe4644;border-radius:8px;background:#1a140022">
          <div style="font-size:.64em;color:#ffbe46;letter-spacing:.1em;margin-bottom:4px">QUÊTES VALIDÉES</div>
          ${claimed.map(q => `<div style="font-size:.74em;color:#c8ffe8">🎯 ${q.title} <span style="color:#22c55e">+${q.earned} ✦</span></div>`).join('')}</div>`;
      }
      const dailyBonus = await awardDailyWin();
      if (dailyBonus > 0) {
        dailyHtml = `<div style="margin:-8px 0 16px;padding:10px;border:1px solid #00f5c444;border-radius:8px;background:#04140f">
          <div style="font-size:.74em;color:#c8ffe8">📅 Bonus quotidien — 1re victoire du jour <span style="color:#22c55e">+${dailyBonus} ✦</span></div></div>`;
      }
    }
    const ctx = { difficulty, finalHp: state.player.hp, ...stats };
    const doneChallenges = checkAndCompleteSquadChallenges(res, ctx);
    for (const c of doneChallenges) await awardGold(c.goldEarned, { kind: 'challenge', challenge_id: c.challenge.id });
    if (doneChallenges.length) {
      challengeHtml = `<div style="margin:-8px 0 16px;padding:10px;border:1px solid #42b0ff44;border-radius:8px;background:#04101a">
        <div style="font-size:.64em;color:#42b0ff;letter-spacing:.1em;margin-bottom:4px">DÉFIS DU JOUR</div>
        ${doneChallenges.map(c => `<div style="font-size:.74em;color:#c8ffe8">${c.challenge.icon} ${c.challenge.label} <span style="color:#22c55e">+${c.goldEarned} ✦</span></div>`).join('')}</div>`;
    }
    if (res.winner === 'player' || res.winner === 'draw') {
      const bal = await awardGold(res.goldReward, { difficulty, turns: res.turns, winner: res.winner });
      if (bal != null) balanceTxt = ` · Solde : ✦ ${bal}`;
    }
    const title = res.winner === 'player' ? '🏆 VICTOIRE' : res.winner === 'draw' ? '🤝 MATCH NUL' : '💀 DÉFAITE';
    const color = res.winner === 'player' ? '#22c55e' : res.winner === 'draw' ? '#ffbe46' : '#ff2d4e';
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:20000;display:grid;place-items:center;padding:20px';
    overlay.innerHTML = `<div style="background:#05080d;border:1px solid ${color};border-radius:14px;padding:28px 32px;text-align:center;font-family:'Share Tech Mono',monospace;color:#c8ffe8;width:min(380px,92vw)">
      <div style="font-family:'VT323',monospace;font-size:2.2em;color:${color};letter-spacing:.2em;margin-bottom:10px">${title}</div>
      <div style="font-size:.82em;color:#8ab4a0;margin-bottom:18px">${res.winner === 'player' ? `+${res.goldReward} ✦ en ${res.turns} tours${balanceTxt}` : res.winner === 'draw' ? `+${res.goldReward} ✦${balanceTxt}` : 'Retente ta chance, Agent.'}</div>
      ${questHtml}${dailyHtml}${challengeHtml}
      <div style="display:flex;flex-direction:column;gap:8px">
        <button class="sqb-cta" id="sq-again" style="width:100%">⚔️ Rejouer</button>
        <button class="sqb-ghost" id="sq-home" style="width:100%">← Retour au hub</button>
      </div></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#sq-again').addEventListener('click', () => { overlay.remove(); renderSquadBattle(root, { playerSquad, difficulty, skipDeploy: true }); });
    overlay.querySelector('#sq-home').addEventListener('click', () => { overlay.remove(); backToHub(root); });
  }

  wrap.querySelector('#sq-flee').addEventListener('click', () => backToHub(root));
  render();
}
