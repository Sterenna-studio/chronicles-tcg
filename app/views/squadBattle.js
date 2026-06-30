// app/views/squadBattle.js — Combat Mode Escouade (page dédiée).
// Séquence d'ouverture, directement sur l'arène (plus d'écran de déploiement séparé) :
//   1) LE SCEAU D'OUVERTURE (runOpeningSeal) — sceau goétique/glitch qui désigne un
//      camp ; le camp désigné PREND ou LAISSE la main (= ouvre la Chronique : déploie
//      et agit en premier). Si l'ennemi est désigné, l'IA tranche.
//   2) DÉPLOIEMENT chacun-son-tour (runPlacement) — chaque camp pose UN champion à
//      son tour, en alternance, en commençant par le camp qui a la main.
//   3) COMBAT (startCombat) — mulligan d'ouverture (garder/rebattre la main), puis si
//      l'ennemi a la main il joue le 1er tour (openEnemyTurn). Moteur logic/squadEngine.js.
// Récompenses via le ledger (quêtes, bonus quotidien, défis du jour, or). Voir docs/RULES_JRPG.md.
//
// Équipement « en main » : deck de 20, pioche 3/tour, équiper un champion coûte
//   l'énergie de la carte (pool partagé avec l'attaque), échange → défausse,
//   emplacements dynamiques (champion.slots, défaut 3).
//   ⚠️ Deck TEMPORAIRE (buildEquipmentDeck) si l'escouade n'a pas de deck Atelier.
import {
  createSquadBattle, championAct, getSquadResult, startSquadTurn, planAutoTurn,
  championAttackPower, teamShield, canChampionAct, actionCost, equipCard,
  mulliganEquipment,
  SQUAD_HP, DECK_SIZE, ENERGY_MAX,
} from '../../logic/squadEngine.js?v=23';
import { getClient } from '../../logic/supaRaw.js?v=23';
import { url } from '../../logic/paths.js?v=23';
import { PLAYABLE_SET_IDS, playableSets } from '../../logic/sets.js?v=23';
import { checkAndCompleteSquadChallenges } from '../../logic/challengeEngine.js?v=23';
import { createRecorder } from '../../logic/combatRecorder.js?v=23';
import { attachCardPreview } from '../../ui/cardPreview.js?v=23';

const RC = { Common:'#9da7b3', Rare:'#42b0ff', Epic:'#bb55d3', Legendary:'#ffbe46', Mythical:'#ff5080' };
const TI = { Champion:'⚔️', Companion:'🐾', Event:'⚡', Object:'🔧', Special:'✨', Terrain:'🌍', Team:'👥' };
const DIFF = { easy:'🟢 FACILE', normal:'🔵 NORMAL', hard:'🔴 DIFFICILE' };
const cardImg = (id) => url(`/assets/cards/${id}.jpg`);
const rnd = (a) => a[Math.floor(Math.random() * a.length)];

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
  .sqb-row{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
  .sqb-champ{flex:0 0 120px;width:120px;border:1px solid #0e2a1f;border-radius:10px;padding:6px;background:#04060acc;position:relative;transition:border-color .15s,box-shadow .15s,transform .1s}
  .sqb-champ.clk{cursor:pointer}
  .sqb-champ.clk:hover{transform:translateY(-2px)}
  .sqb-champ.sel{border-color:#00f5c4;box-shadow:0 0 16px rgba(0,245,196,.3);background:#04140f}
  .sqb-champ.acted{opacity:.45}
  .sqb-champ.acting{border-color:#ff5080 !important;box-shadow:0 0 26px rgba(255,80,80,.6);transform:translateY(-4px) scale(1.04);z-index:3;animation:sqb-acting 1s ease-in-out infinite}
  .sqb-champ.acting::after{content:'⚔';position:absolute;top:-10px;left:50%;transform:translateX(-50%);font-size:.9em;color:#ff5080;text-shadow:0 0 8px rgba(255,80,80,.8)}
  @keyframes sqb-acting{0%,100%{box-shadow:0 0 18px rgba(255,80,80,.45)}50%{box-shadow:0 0 30px rgba(255,80,80,.85)}}
  .sqb-enemy-turn{color:#ff6f8a;display:flex;align-items:center;gap:8px;font-size:.8em;letter-spacing:.04em}
  .sqb-enemy-turn .dots{display:inline-flex;gap:3px}
  .sqb-enemy-turn .dots i{width:5px;height:5px;border-radius:50%;background:#ff5080;animation:sqb-dot 1s infinite}
  .sqb-enemy-turn .dots i:nth-child(2){animation-delay:.15s}
  .sqb-enemy-turn .dots i:nth-child(3){animation-delay:.3s}
  @keyframes sqb-dot{0%,100%{opacity:.25}50%{opacity:1}}
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
  @media(max-width:560px){ .sqb-card{width:84px} .sqb-slot,.sqb-terrain-slot{width:96px} .sqb-champ{flex-basis:96px;width:96px} }
  /* ── Sceau d'ouverture (initiative) ── */
  .sqb-seal-ov{position:fixed;inset:0;z-index:21000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;padding:24px;background:radial-gradient(120% 90% at 50% 30%,#0a1622 0%,#04060a 72%);font-family:'Share Tech Mono','Courier New',monospace;color:#c8ffe8;text-align:center;animation:sqb-fade .25s ease-out}
  .sqb-seal-title{font-family:'VT323',monospace;font-size:2em;letter-spacing:.28em;color:#9be7ff;text-shadow:0 0 14px rgba(120,200,255,.45)}
  .sqb-seal-sub{font-size:.82em;color:#7c93a6;max-width:420px;line-height:1.6;font-style:italic}
  .sqb-seal-ring{position:relative;width:180px;height:180px;display:grid;place-items:center}
  .sqb-seal-ring::before{content:'';position:absolute;inset:0;border-radius:50%;padding:4px;background:conic-gradient(#00f5c4,#42b0ff,#ff5080,#bb55d3,#00f5c4);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:sqb-spin 1s linear infinite;filter:drop-shadow(0 0 10px rgba(80,180,255,.5))}
  .sqb-seal-ring.locked::before{animation:none;background:var(--seal-col)}
  .sqb-seal-glyph{font-size:3.4em;line-height:1;filter:drop-shadow(0 0 12px currentColor);animation:sqb-flick .12s steps(2) infinite}
  .sqb-seal-ring.locked .sqb-seal-glyph{animation:none}
  .sqb-seal-verdict{font-family:'VT323',monospace;font-size:1.5em;letter-spacing:.18em;min-height:1.2em}
  .sqb-seal-actions{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;animation:sqb-rise .3s ease-out}
  .sqb-seal-pick{display:flex;flex-direction:column;align-items:center;gap:3px;min-width:170px;padding:14px 18px;border-radius:12px;cursor:pointer;font-family:inherit;background:#05080d;transition:transform .12s,box-shadow .15s,filter .12s}
  .sqb-seal-pick:hover{transform:translateY(-3px);filter:brightness(1.15)}
  .sqb-seal-pick b{font-size:1em;letter-spacing:.08em}
  .sqb-seal-pick small{font-size:.66em;color:#8ab4a0;line-height:1.4}
  .sqb-seal-pick.take{border:1px solid #00f5c4;box-shadow:0 0 18px rgba(0,245,196,.18);color:#00f5c4}
  .sqb-seal-pick.leave{border:1px solid #ff8a8a;box-shadow:0 0 18px rgba(255,80,80,.12);color:#ff8a8a}
  .sqb-seal-quit{background:transparent;border:none;color:#3a6655;cursor:pointer;font-family:inherit;font-size:.74em;margin-top:4px}
  /* ── Déploiement chacun-son-tour (sur l'arène) ── */
  .sqb-place-status{font-size:.84em;letter-spacing:.06em;text-align:center;padding:4px 0}
  .sqb-place-status b{font-family:'VT323',monospace;font-size:1.15em}
  .sqb-slot.placed-in{animation:sqb-drop .32s cubic-bezier(.2,1.3,.5,1)}
  .sqb-reserve{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;padding:8px 0}
  .sqb-reserve .sqb-card.disabled{opacity:.4;cursor:default;filter:grayscale(.5)}
  .sqb-reserve .sqb-card.live{border-color:#00f5c4;box-shadow:0 0 12px rgba(0,245,196,.22)}
  /* ── Mulligan ── */
  .sqb-mull-ov{position:fixed;inset:0;z-index:21000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:24px;background:rgba(2,5,8,.92);font-family:'Share Tech Mono',monospace;color:#c8ffe8;text-align:center;animation:sqb-fade .2s ease-out}
  .sqb-mull-hand{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
  .sqb-mull-hand .mc{width:96px;border:1px solid #0e2a1f;border-radius:10px;padding:6px;background:#05080d}
  .sqb-mull-hand .mc img{width:100%;aspect-ratio:2/3;object-fit:contain;background:#060c10;border-radius:6px}
  .sqb-mull-hand .mc .nm{font-size:.56em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:3px}
  .sqb-mull-hand .mc .st{font-size:.54em;color:#7fb3a0}
  @keyframes sqb-spin{to{transform:rotate(360deg)}}
  @keyframes sqb-flick{0%{opacity:1}50%{opacity:.55}100%{opacity:1}}
  @keyframes sqb-fade{from{opacity:0}to{opacity:1}}
  @keyframes sqb-rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
  @keyframes sqb-drop{from{opacity:0;transform:translateY(-14px) scale(.9)}to{opacity:1;transform:none}}
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

// ── Génération de l'escouade ennemie (mode deck, symétrique au joueur) ─────────
// L'ennemi a lui aussi un deck d'équipement : il pioche 3/tour et s'équipe via l'IA
// (squadEngine.autoPlaySquadTurn). Taille du deck + qualité selon la difficulté.
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

  // Deck d'équipement : surtout des passifs, quelques actifs en normal/hard.
  const passives = cards.filter(c => ['Object','Companion'].includes(c.type));
  const actives  = cards.filter(c => ['Special','Event','Team'].includes(c.type));
  const terrains = cards.filter(c => c.type === 'Terrain');
  const deckSize  = { easy: 10, normal: 16, hard: 20 }[difficulty] ?? 16;
  const activeRatio = { easy: 0, normal: 0.25, hard: 0.4 }[difficulty] ?? 0.25;
  const deck = [];
  for (let i = 0; i < deckSize; i++) {
    const src = (Math.random() < activeRatio && actives.length) ? actives : passives;
    if (src.length) deck.push(rnd(src));
  }
  const terrain = (difficulty === 'hard' && terrains.length) ? rnd(terrains) : null;
  return { slots: chosen.map(ch => ({ champion: ch })), terrain, equipmentDeck: deck };
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

function backToHub() {
  window.dispatchEvent(new Event('hub:refresh'));   // resync solde + parcours + défis
  location.hash = '#/hub';                           // onRoute réaffiche le hub + nettoie app-root
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
    root.querySelector('#go-atelier').addEventListener('click', () => import('./squadBuilder.js?v=23').then(m => m.renderSquadBuilder(root)));
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

  const enemySquad = generateEnemySquad(cards, difficulty);

  // Rejouer : on saute la séquence d'ouverture (même disposition, le joueur ouvre).
  if (opts.skipDeploy && opts.playerSquad) {
    startCombat(root, playerSquad, enemySquad, difficulty, 'player', { skipSetup: true });
    return;
  }

  // ── Séquence d'ouverture, directement sur l'arène ──
  // 1) Le Sceau d'ouverture désigne un camp → il PREND ou LAISSE la main.
  const first = await runOpeningSeal(root, difficulty);
  if (!first) return;                                       // renoncé au Sceau
  // 2) Déploiement chacun-son-tour : le camp à la main place son champion en premier.
  const arranged = await runPlacement(root, playerSquad, enemySquad, first, difficulty);
  if (!arranged) return;                                    // quitté au déploiement
  // 3) Combat : mulligan d'ouverture, puis si l'ennemi a la main, il ouvre la Chronique.
  startCombat(root, arranged, enemySquad, difficulty, first);
}

// ── Ouverture 1/2 : LE SCEAU D'OUVERTURE (initiative, lore Chronicles) ───────────
// Un sceau goétique/glitch tourne puis désigne un camp. Le camp désigné choisit
// « prendre la main » (ouvrir la Chronique : déployer + agir en premier) ou
// « laisser la main ». Si l'ennemi est désigné, l'IA tranche et révèle son choix.
// Résout 'player' | 'enemy' (= qui ouvre), ou null si on renonce.
function runOpeningSeal(root, difficulty) {
  return new Promise((resolve) => {
    const ov = document.createElement('div');
    ov.className = 'sqb-seal-ov';
    ov.innerHTML = `
      <div class="sqb-seal-title">LE SCEAU D'OUVERTURE</div>
      <div class="sqb-seal-sub">Le Sceau de Lemegeton s'embrase et tourne… Il tranche qui, cette nuit, <b>ouvre la Chronique</b> — et frappe le premier.</div>
      <div class="sqb-seal-ring" id="seal-ring"><div class="sqb-seal-glyph" id="seal-glyph">🜲</div></div>
      <div class="sqb-seal-verdict" id="seal-verdict">&nbsp;</div>
      <div id="seal-choice"></div>
      <button class="sqb-seal-quit" id="seal-quit">✕ Renoncer au combat</button>`;
    root.innerHTML = '';
    root.appendChild(ov);

    const ring = ov.querySelector('#seal-ring');
    const glyph = ov.querySelector('#seal-glyph');
    const verdict = ov.querySelector('#seal-verdict');
    const choice = ov.querySelector('#seal-choice');
    let done = false;
    const finish = (side) => { if (!done) { done = true; resolve(side); } };
    ov.querySelector('#seal-quit').addEventListener('click', () => { finish(null); backToHub(); });

    const glyphs = ['🜲', '⛧', '✶', '🜏', '◈', '⬡', '✷', '⟁', '🝳'];
    const flick = setInterval(() => { glyph.textContent = rnd(glyphs); }, 110);

    setTimeout(() => {
      clearInterval(flick);
      const designated = Math.random() < 0.5 ? 'player' : 'enemy';
      const col = designated === 'player' ? '#00f5c4' : '#ff5080';
      ring.style.setProperty('--seal-col', col);
      ring.classList.add('locked');
      glyph.textContent = designated === 'player' ? '⬢' : '⬣';
      glyph.style.color = col;
      verdict.style.color = col;
      verdict.textContent = designated === 'player' ? 'LE SCEAU TE DÉSIGNE' : "LE SCEAU DÉSIGNE L'ADVERSAIRE";

      if (designated === 'player') {
        choice.className = 'sqb-seal-actions';
        choice.innerHTML = `
          <div class="sqb-seal-pick take" id="pick-take"><b>✊ PRENDRE LA MAIN</b><small>Tu ouvres la Chronique :<br>tu déploies et agis en premier.</small></div>
          <div class="sqb-seal-pick leave" id="pick-leave"><b>✋ LAISSER LA MAIN</b><small>L'adversaire ouvre :<br>tu réponds ensuite.</small></div>`;
        choice.querySelector('#pick-take').addEventListener('click', () => finish('player'));
        choice.querySelector('#pick-leave').addEventListener('click', () => finish('enemy'));
      } else {
        choice.innerHTML = `<div class="sqb-seal-sub" style="margin-top:6px">L'adversaire consulte le Code…</div>`;
        setTimeout(() => {
          // L'IA prend l'initiative (tempo) ; en facile elle la cède parfois.
          const aiTakes = difficulty === 'easy' ? Math.random() < 0.5 : true;
          const opener = aiTakes ? 'enemy' : 'player';
          const c2 = aiTakes ? '#ff5080' : '#00f5c4';
          choice.className = 'sqb-seal-actions';
          choice.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;gap:12px">
            <div class="sqb-seal-verdict" style="color:${c2}">${aiTakes ? "L'ADVERSAIRE PREND LA MAIN" : "L'ADVERSAIRE TE LAISSE LA MAIN"}</div>
            <button class="sqb-cta" id="seal-go">${aiTakes ? 'Il ouvre la Chronique ▶' : "À toi d'ouvrir ▶"}</button></div>`;
          choice.querySelector('#seal-go').addEventListener('click', () => finish(opener));
        }, 1100);
      }
    }, 1700);
  });
}

// ── Ouverture 2/2 : DÉPLOIEMENT chacun-son-tour, sur l'arène ────────────────────
// Plus d'écran séparé : on montre directement le plateau de combat (escouades vides)
// et chaque camp pose UN champion à son tour, en alternance, en commençant par le
// camp qui a la main. Résout la disposition du joueur (et réordonne l'ennemi pour
// que le combat affiche le même ordre), ou null si on quitte.
function runPlacement(root, playerSquad, enemySquad, first, difficulty) {
  return new Promise((resolve) => {
    const pChamps = playerSquad.slots.map(s => s.champion);             // à placer (ordre choisi par le joueur)
    const eQueue  = [...enemySquad.slots.map(s => s.champion)].sort(() => Math.random() - 0.5);
    const pPos = [null, null, null];
    const ePos = [null, null, null];
    let placedP = 0, placedE = 0;
    let turn = first;
    let picking = false;

    const wrap = document.createElement('div');
    wrap.className = 'sqb-wrap';
    wrap.innerHTML = `
      <div class="sqb-top">
        <button class="sqb-quit" id="pl-quit">✕ Quitter</button>
        <span class="sqb-title">DÉPLOIEMENT</span>
        <span class="sqb-pill">${DIFF[difficulty]}</span>
        <div style="flex:1"></div>
        <span class="sqb-pill" id="pl-count">0/6 déployés</span>
      </div>
      <div class="sqb-arena">
        <div class="sqb-side sqb-side-enemy">
          <div class="sqb-side-lbl" style="color:#ff6f8a">⬣ ESCOUADE ADVERSE</div>
          <div class="sqb-row" id="pl-enemy"></div>
        </div>
        <div class="sqb-log" style="display:flex;align-items:center;justify-content:center">
          <div class="sqb-place-status" id="pl-status">…</div>
        </div>
        <div class="sqb-side sqb-side-player">
          <div class="sqb-row" id="pl-player"></div>
          <div class="sqb-side-lbl" style="color:#00f5c4;justify-content:flex-end">TON ESCOUADE ⬢</div>
        </div>
      </div>
      <div class="sqb-hand-combat">
        <div class="sqb-hand-lbl">RÉSERVE — clique un champion pour le déployer</div>
        <div class="sqb-reserve" id="pl-reserve"></div>
      </div>`;
    root.innerHTML = '';
    root.appendChild(wrap);

    const elEnemy = wrap.querySelector('#pl-enemy');
    const elPlayer = wrap.querySelector('#pl-player');
    const elReserve = wrap.querySelector('#pl-reserve');
    const elStatus = wrap.querySelector('#pl-status');
    const elCount = wrap.querySelector('#pl-count');

    function filled(ch) {
      const rc = RC[ch.rarity] || '#9da7b3';
      const d = document.createElement('div');
      d.className = 'sqb-champ placed-in';
      d.style.borderColor = rc + '66';
      d.innerHTML = `<img src="${cardImg(ch.id)}" onerror="this.style.display='none'">
        <div class="nm" style="color:${rc}">${ch.name}</div>
        <div class="st"><span>⚔${ch.power || 0}</span><span>${ch.energy || 0}⚡</span></div>`;
      attachCardPreview(d, ch);
      return d;
    }
    function empty(n) {
      const d = document.createElement('div');
      d.className = 'sqb-slot';
      d.style.cssText = 'width:120px;flex:0 0 120px';
      d.innerHTML = `<div class="sqb-slot-num">${n}</div><div class="sqb-slot-lbl">POSITION</div>`;
      return d;
    }
    const renderRow = (el, pos) => { el.innerHTML = ''; pos.forEach((ch, i) => el.appendChild(ch ? filled(ch) : empty(i + 1))); };
    function renderReserve() {
      const remain = pChamps.filter(ch => !pPos.some(p => p?.id === ch.id));
      elReserve.innerHTML = '';
      if (!remain.length) { elReserve.innerHTML = `<div class="sqb-hint" style="padding:10px">Tous tes champions sont déployés.</div>`; return; }
      remain.forEach((ch) => {
        const rc = RC[ch.rarity] || '#9da7b3';
        const c = document.createElement('div');
        c.className = 'sqb-card' + (picking ? ' live' : ' disabled');
        c.innerHTML = `<img src="${cardImg(ch.id)}" onerror="this.style.display='none'">
          <div class="nm" style="color:${rc}">${ch.name}</div>
          <div class="st"><span>⚔${ch.power || 0}</span><span>🛡${ch.shield || 0}</span></div>`;
        attachCardPreview(c, ch);
        if (picking) c.addEventListener('click', () => placePlayer(ch));
        elReserve.appendChild(c);
      });
    }
    function renderAll() {
      renderRow(elEnemy, ePos);
      renderRow(elPlayer, pPos);
      renderReserve();
      elCount.textContent = `${placedP + placedE}/6 déployés`;
    }

    function placePlayer(ch) {
      if (turn !== 'player' || !picking || placedP >= 3) return;
      pPos[placedP++] = ch; picking = false;
      renderAll(); advance();
    }
    function placeEnemy() {
      if (placedE >= 3) return;
      ePos[placedE] = eQueue[placedE]; placedE++;
      renderAll(); advance();
    }
    function finalize() {
      elStatus.innerHTML = `<b style="color:#00f5c4">DÉPLOIEMENT TERMINÉ</b>`;
      enemySquad.slots = ePos.filter(Boolean).map(ch => ({ champion: ch }));   // même ordre au combat
      setTimeout(() => resolve({
        slots: pPos.filter(Boolean).map(ch => ({ champion: ch })),
        terrain: playerSquad.terrain || null,
        equipmentDeck: playerSquad.equipmentDeck,
      }), 540);
    }
    function advance() {
      if (placedP >= 3 && placedE >= 3) return finalize();
      const otherSide = turn === 'player' ? 'enemy' : 'player';
      const remaining = (s) => (s === 'player' ? 3 - placedP : 3 - placedE);
      if (remaining(otherSide) > 0) turn = otherSide;
      step();
    }
    function step() {
      if (turn === 'enemy') {
        picking = false; renderReserve();
        elStatus.innerHTML = `<b style="color:#ff6f8a">L'ADVERSAIRE DÉPLOIE…</b>`;
        setTimeout(placeEnemy, 680);
      } else {
        picking = true; renderReserve();
        elStatus.innerHTML = `<b style="color:#00f5c4">À TOI</b><br><span style="font-size:.82em;color:#8ab4a0">choisis un champion à déployer</span>`;
      }
    }

    wrap.querySelector('#pl-quit').addEventListener('click', () => { resolve(null); backToHub(); });

    elStatus.innerHTML = first === 'player'
      ? `<b style="color:#00f5c4">TU AS LA MAIN</b><br><span style="font-size:.82em;color:#8ab4a0">tu déploies en premier</span>`
      : `<b style="color:#ff6f8a">L'ADVERSAIRE A LA MAIN</b><br><span style="font-size:.82em;color:#8ab4a0">il déploie en premier</span>`;
    renderAll();
    setTimeout(step, 880);
  });
}

// ── Phase COMBAT ─────────────────────────────────────────────────────────────
// `first` = qui ouvre (a pris la main) : 'player' | 'enemy'.
// setupOpts.skipSetup : saute mulligan + ouverture (rejouer).
function startCombat(root, playerSquad, enemySquad, difficulty, first = 'player', setupOpts = {}) {
  let state = createSquadBattle(playerSquad, enemySquad);
  let selected = null;
  let busy = false;
  let enemyActing = null;    // index du champion ennemi en train d'agir (animation)
  let pickedHand = null;     // index de la carte d'équipement sélectionnée (main)
  let replaceChamp = null;   // index du champion en attente d'un choix de remplacement
  const delay = (ms) => new Promise(r => setTimeout(r, ms));
  const stats = { damageDealt: 0, highestHit: 0, skillsUsed: 0, activesUsed: 0, eventsUsed: 0 };

  // Enregistreur de combat (replay/analytics) — cf logic/combatRecorder.js
  const sqIds = (sq) => ({
    champions: (sq.slots || []).map(s => s.champion?.id).filter(Boolean),
    terrain: sq.terrain?.id || null,
    deck: (sq.equipmentDeck || []).map(c => c.id),
  });
  const rec = createRecorder({ app: 'escouade', difficulty, player: sqIds(playerSquad), enemy: sqIds(enemySquad) });
  rec.event('deploy', { order: sqIds(playerSquad).champions, terrain: playerSquad.terrain?.id || null });

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

  // Difficulté = PV de l'ennemi (il joue en second, donc on compense par la survie).
  // L'ennemi reste symétrique (pioche/équipe), mais encaisse plus en montant. 🎚️
  const ENEMY_MAX = { easy: 22, normal: 30, hard: 42 }[difficulty] ?? 30;
  state.enemy.hp = ENEMY_MAX;

  const enemyZone = wrap.querySelector('#sq-enemy');
  const playerZone = wrap.querySelector('#sq-player');
  const logEl = wrap.querySelector('#sq-log');
  const handEl = wrap.querySelector('#sq-hand');
  const actionBar = wrap.querySelector('#sq-actions');

  function bar(side, color, max) {
    const pct = Math.max(0, Math.min(100, (side.hp / max) * 100));
    return `<div class="sqb-bar">
      <span class="hp" style="color:${color}">❤ ${side.hp}/${max}</span>
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
    const acting = sideKey === 'enemy' && enemyActing === i;
    const cls = 'sqb-champ' + (sideKey === 'player' ? ' clk' : '') + (isSel ? ' sel' : '')
      + (ch.actedThisTurn && sideKey === 'player' ? ' acted' : '') + (equipable ? ' equipable' : '')
      + (acting ? ' acting' : '');
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
      ${bar(state.enemy, '#ff5080', ENEMY_MAX)}`;
    playerZone.innerHTML = `${bar(state.player, '#00f5c4', SQUAD_HP)}
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
    // Clic droit / appui long sur n'importe quel champion (ami ou ennemi) → aperçu.
    [enemyZone, playerZone].forEach(zone => zone.querySelectorAll('[data-champ]').forEach(el => {
      const [sk, idx] = el.dataset.champ.split(':');
      attachCardPreview(el, () => state[sk]?.champions[+idx]);
    }));
    renderHand();
    renderActions();
  }

  function tryEquip(championIndex, replaceIdx = null) {
    if (pickedHand == null) return;
    const card = state.player.equipHand[pickedHand];
    const r = equipCard(state, 'player', championIndex, pickedHand, replaceIdx);
    if (!r.ok) {
      if (r.needsReplace) { replaceChamp = championIndex; render(); flashLog('Emplacements pleins — choisis une carte à remplacer.'); return; }
      flashLog(r.reason); return;
    }
    state = r.state; pickedHand = null; replaceChamp = null;
    rec.event('equip', { turn: state.turn, champ: championIndex, card: card?.id, replace: replaceIdx });
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
      d.addEventListener('click', () => { if (busy || state.phase !== 'player_turn') return; pickedHand = (pickedHand === idx) ? null : idx; replaceChamp = null; render(); });
      d.addEventListener('dragstart', () => { pickedHand = idx; replaceChamp = null; });
      attachCardPreview(d, card);
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
    if (busy || state.phase !== 'player_turn') {
      actionBar.innerHTML = `<span class="sqb-enemy-turn">⬢ L'adversaire joue son tour<span class="dots"><i></i><i></i><i></i></span></span>`;
      return;
    }
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
    rec.event('act', { turn: state.turn, champ: i, action: action.type, equip: action.equipIndex, dmg });
    selected = null; pickedHand = null; replaceChamp = null;
    render();
    if (getSquadResult(state)) return finish();
  }
  function endTurn() {
    if (busy) return;
    selected = null; pickedHand = null; replaceChamp = null;
    rec.event('endturn', { turn: state.turn });
    runEnemyTurn(false);
  }

  // Joue le tour ennemi en ANIMANT chaque action (~1 s) : on surligne le champion
  // qui agit, on attend, puis on applique le résultat (dégâts + log). `opening` =
  // l'ennemi a pris la main et ouvre le combat (pas de startSquadTurn joueur avant).
  async function runEnemyTurn(opening) {
    busy = true; selected = null; pickedHand = null; replaceChamp = null; enemyActing = null;
    if (opening) {
      state.enemy.energy = Math.min(state.turn, state.energyMax || ENERGY_MAX);
      state.phase = 'enemy_turn';
      state.log.push(`\n⚔️  L'adversaire ouvre la Chronique — Tour ${state.turn} · Énergie ${state.enemy.energy}`);
    } else {
      state = startSquadTurn('enemy', state);
    }
    render();
    await delay(560);

    if (state.phase === 'enemy_turn') {
      const { frames, final } = planAutoTurn(state, 'enemy', difficulty);
      if (!frames.length) await delay(350);
      for (const f of frames) {
        enemyActing = f.actor;        // surligne le champion qui agit
        render();
        await delay(820);
        state = f.state;              // applique le résultat (dégâts, log)
        enemyActing = null;
        render();
        await delay(280);
        if (getSquadResult(state)) { busy = false; return finish(); }
      }
      state = final;
    }

    if (getSquadResult(state)) { busy = false; return finish(); }
    if (opening) state.phase = 'player_turn';
    else state = startSquadTurn('player', state);
    busy = false; enemyActing = null;
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
    rec.finish({ winner: res.winner, turns: res.turns, playerHp: state.player.hp, enemyHp: state.enemy.hp, ...stats });
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
    overlay.querySelector('#sq-home').addEventListener('click', () => { overlay.remove(); backToHub(); });
  }

  wrap.querySelector('#sq-flee').addEventListener('click', () => backToHub());

  // ── Démarrage : mulligan d'ouverture → (si l'ennemi a la main) il ouvre. ──────
  function beginCombat() {
    render();
    if (first === 'enemy') runEnemyTurn(true);   // l'ennemi a la main : il ouvre (animé)
    else if (getSquadResult(state)) finish();
  }

  // Mulligan : le joueur garde sa main d'ouverture, ou la rebat UNE fois.
  function runMulligan() {
    if (!state.player.useDeck || !state.player.equipHand.length) return beginCombat();
    const ov = document.createElement('div');
    ov.className = 'sqb-mull-ov';
    let used = false;
    const handHtml = () => state.player.equipHand.map(c => `
      <div class="mc"><img src="${cardImg(c.id)}" onerror="this.style.display='none'">
        <div class="nm" style="color:${RC[c.rarity] || '#9da7b3'}">${c.name}</div>
        <div class="st">${TI[c.type] || '🔧'} ⚔${c.power || 0} 🛡${c.shield || 0}</div></div>`).join('');
    const paint = () => {
      ov.innerHTML = `
        <div class="sqb-seal-title" style="font-size:1.6em;color:#9be7ff">LA MAIN D'OUVERTURE</div>
        <div class="sqb-seal-sub">Les premières cartes que t'offre le Code. <b>Garde-les</b>… ou <b>rebats tout</b> une fois pour tenter un meilleur tirage.</div>
        <div class="sqb-mull-hand">${handHtml()}</div>
        <div class="sqb-seal-actions">
          <button class="sqb-cta" id="mull-keep">✊ Garder la main</button>
          ${used ? '' : '<button class="sqb-ghost" id="mull-shuffle">🔀 Rebattre les cartes</button>'}
        </div>
        ${used ? `<div class="sqb-hint">Nouveau tirage tranché — pas de second remélange.</div>` : ''}`;
      ov.querySelector('#mull-keep').addEventListener('click', () => { ov.remove(); beginCombat(); });
      const sh = ov.querySelector('#mull-shuffle');
      if (sh) sh.addEventListener('click', () => { state = mulliganEquipment(state, 'player'); used = true; paint(); });
    };
    paint();
    document.body.appendChild(ov);
  }

  render();                          // peuple l'arène (escouades déployées) derrière l'overlay
  if (setupOpts.skipSetup) beginCombat();
  else runMulligan();
}
