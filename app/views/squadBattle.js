// app/views/squadBattle.js — Combat Mode Escouade (lot 7)
// Charge l'escouade active du joueur (load_squad), génère une escouade ennemie,
// et déroule le combat via logic/squadEngine.js. Récompense via award_squad_reward
// (ledger). Voir docs/RULES_JRPG.md.
import {
  createSquadBattle, startSquadTurn, championAct, getSquadResult, endSquadPlayerTurn,
  championAttackPower, teamShield, canChampionAct, SQUAD_HP,
} from '../../logic/squadEngine.js?v=10';
import { getClient } from '../../logic/supaRaw.js?v=10';
import { url } from '../../logic/paths.js?v=10';
import { PLAYABLE_SET_IDS, playableSets } from '../../logic/sets.js?v=10';

const RC = { Common:'#9da7b3', Rare:'#42b0ff', Epic:'#bb55d3', Legendary:'#ffbe46', Mythical:'#ff5080' };
const TI = { Champion:'⚔️', Companion:'🐾', Event:'⚡', Object:'🔧', Special:'✨', Terrain:'🌍', Team:'👥' };
const DIFF = { easy:'🟢 FACILE', normal:'🔵 NORMAL', hard:'🔴 DIFFICILE' };
const cardImg = (id) => url(`/assets/cards/${id}.jpg`);
const rnd = (a) => a[Math.floor(Math.random() * a.length)];

async function loadCombatCards() {
  // Source principale : table cards (avec skills) pour les joueurs connectés.
  try {
    const sb = await getClient();
    const { data } = await sb.from('cards').select('*').in('set_code', PLAYABLE_SET_IDS);
    if (data && data.length) return data;
  } catch {}
  // Fallback (ex: catalogue indisponible) : JSON, sans skills.
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
      // surtout des passifs ; un actif possible en hard
      const src = (difficulty === 'hard' && k === equipPer - 1 && actives.length) ? actives : passives;
      if (src.length) eq.push(rnd(src));
    }
    return { champion: ch, equipment: eq };
  });
  const terrain = (difficulty === 'hard' && terrains.length) ? rnd(terrains) : null;
  return { slots, terrain };
}

// ── Récompense (ledger) ───────────────────────────────────────────────────────
async function awardGold(amount, meta) {
  try {
    const sb = await getClient();
    const { data } = await sb.rpc('award_squad_reward', { p_amount: amount, p_meta: meta || {} });
    return data?.ok ? data.balance : null;
  } catch (e) { console.warn('[squadBattle] award', e); return null; }
}

// Bonus quotidien : 1re victoire Escouade du jour (UTC). Vérifié côté serveur.
async function awardDailyWin() {
  try {
    const sb = await getClient();
    const { data } = await sb.rpc('award_daily_squad_win');
    return (data?.ok && data.rewarded) ? data.amount : 0;
  } catch (e) { console.warn('[squadBattle] daily win', e); return 0; }
}

// Réclame les quêtes du mode à la victoire (claim_quest est idempotent).
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

// ── Vue ───────────────────────────────────────────────────────────────────────
export async function renderSquadBattle(root, opts = {}) {
  const difficulty = opts.difficulty || localStorage.getItem('tcg_squad_difficulty') || 'normal';
  root.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#3a6655;font-family:'Share Tech Mono',monospace;background:#04060a">Préparation du combat…</div>`;

  const [cards, playerSquad] = await Promise.all([loadCombatCards(), opts.playerSquad ? Promise.resolve(opts.playerSquad) : loadActiveSquad()]);

  const champCount = playerSquad?.slots?.filter(s => s.champion).length || 0;
  if (!playerSquad || champCount < 3) {
    root.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:16px;color:#c8ffe8;font-family:'Share Tech Mono',monospace;background:#04060a;text-align:center;padding:20px">
        <div style="font-family:'VT323',monospace;font-size:2em;color:#00f5c4;letter-spacing:.2em">AUCUNE ESCOUADE</div>
        <div style="font-size:.85em;max-width:360px;line-height:1.6">Monte une escouade de 3 champions dans l'Atelier avant de combattre.</div>
        <button id="go-atelier" style="background:transparent;border:1px solid #00f5c4;color:#00f5c4;padding:8px 22px;cursor:pointer;font-family:inherit">→ Atelier d'escouade</button>
      </div>`;
    root.querySelector('#go-atelier').addEventListener('click', () => import('./squadBuilder.js?v=10').then(m => m.renderSquadBuilder(root)));
    return;
  }

  const enemySquad = generateEnemySquad(cards, difficulty);
  let state = createSquadBattle(playerSquad, enemySquad);
  let selected = null;   // index du champion joueur sélectionné
  let busy = false;

  // ── Construction UI ────────────────────────────────────────────────────────
  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:grid;grid-template-rows:auto auto 1fr auto auto;height:100vh;background:#04060a;color:#c8ffe8;font-family:"Share Tech Mono","Courier New",monospace;overflow:hidden';
  root.appendChild(wrap);

  const topbar = document.createElement('div');
  topbar.style.cssText = 'display:flex;align-items:center;gap:12px;padding:7px 14px;border-bottom:1px solid #0e2a1f;background:#020508;flex-shrink:0';
  topbar.innerHTML = `
    <button id="sq-flee" style="background:transparent;border:1px solid #ff2d4e44;color:#ff2d4e88;padding:2px 8px;cursor:pointer;font-family:inherit;font-size:.72em">✕ Fuir</button>
    <span style="font-family:'VT323',monospace;font-size:1.3em;color:#00f5c4;letter-spacing:.15em">COMBAT ESCOUADE</span>
    <span style="font-size:.68em;color:#3a6655">${DIFF[difficulty]}</span>
    <div style="flex:1"></div>
    <span id="sq-turn" style="font-size:.75em;color:#ffbe46">Tour 1</span>`;
  wrap.appendChild(topbar);

  const enemyZone = document.createElement('div'); enemyZone.style.cssText = 'padding:8px 14px;border-bottom:1px solid #0e2a1f;background:#0a0508';
  const center = document.createElement('div'); center.style.cssText = 'overflow-y:auto;padding:8px 14px;font-size:.72em;color:#6fa694;background:#04060a';
  const playerZone = document.createElement('div'); playerZone.style.cssText = 'padding:8px 14px;border-top:1px solid #0e2a1f;background:#04100b';
  const actionBar = document.createElement('div'); actionBar.style.cssText = 'padding:8px 14px;border-top:1px solid #0e2a1f;background:#020508;min-height:54px;display:flex;align-items:center;gap:8px;flex-wrap:wrap';
  wrap.append(enemyZone, center, playerZone, actionBar);

  function hpBar(side, color) {
    const pct = Math.max(0, Math.min(100, (side.hp / SQUAD_HP) * 100));
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <span style="font-size:.72em;color:${color};min-width:70px">❤ ${side.hp}/${SQUAD_HP}</span>
      <div style="flex:1;height:10px;background:#0a1a14;border:1px solid #0e2a1f;border-radius:6px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${color};transition:width .3s"></div></div>
      <span style="font-size:.72em;color:#ffbe46;min-width:46px;text-align:right">⚡ ${side.energy}</span>
      <span style="font-size:.66em;color:#7fb3a0;min-width:42px;text-align:right">🛡 ${teamShield(side)}</span>
    </div>`;
  }

  function champMini(side, i, sideKey) {
    const ch = side.champions[i];
    const rc = RC[ch.rarity] || '#9da7b3';
    const cd = side.skillCooldowns?.[ch.id] || 0;
    const acted = ch.actedThisTurn;
    const isSel = sideKey === 'player' && selected === i;
    const atk = championAttackPower(side, i);
    const equipIcons = ch.equipment.map(e => TI[e.type] || '🔧').join(' ');
    return `<div data-champ="${sideKey}:${i}" style="flex:1;min-width:0;border:1px solid ${isSel ? '#00f5c4' : rc + '55'};border-radius:8px;padding:6px;background:${isSel ? '#04140f' : '#04060a'};${acted && sideKey === 'player' ? 'opacity:.5;' : ''}cursor:${sideKey === 'player' ? 'pointer' : 'default'};position:relative">
      <img src="${cardImg(ch.id)}" style="width:100%;aspect-ratio:2/3;object-fit:contain;background:#060c10;border-radius:4px" onerror="this.style.display='none'">
      <div style="font-size:.58em;color:${rc};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px">${ch.name}</div>
      <div style="font-size:.56em;color:#3a6655;display:flex;justify-content:space-between"><span>⚔${atk}</span><span>${cd > 0 ? '⏳' + cd : (ch.skill ? '✨' : '')}</span></div>
      <div style="font-size:.6em;color:#5a7a6a;min-height:12px">${equipIcons}</div>
    </div>`;
  }

  function renderZones() {
    topbar.querySelector('#sq-turn').textContent = `Tour ${state.turn}`;
    enemyZone.innerHTML = `<div style="font-size:.66em;color:#ff6f8a;letter-spacing:.1em;margin-bottom:4px">⬢ ESCOUADE ADVERSE</div>${hpBar(state.enemy, '#ff5080')}
      <div style="display:flex;gap:6px">${[0,1,2].map(i => champMini(state.enemy, i, 'enemy')).join('')}</div>`;
    playerZone.innerHTML = `<div style="display:flex;gap:6px">${[0,1,2].map(i => champMini(state.player, i, 'player')).join('')}</div>${hpBar(state.player, '#00f5c4')}
      <div style="font-size:.66em;color:#00f5c4;letter-spacing:.1em;margin-top:4px;text-align:right">TON ESCOUADE ⬢</div>`;
    // log (5 dernières lignes)
    center.innerHTML = state.log.slice(-6).map(l => `<div>${l.replace(/</g,'&lt;')}</div>`).join('');
    center.scrollTop = center.scrollHeight;

    playerZone.querySelectorAll('[data-champ^="player"]').forEach(el => {
      el.addEventListener('click', () => {
        if (busy || state.phase !== 'player_turn') return;
        const i = +el.dataset.champ.split(':')[1];
        selected = (selected === i) ? null : i;
        renderZones(); renderActions();
      });
    });
    renderActions();
  }

  function actionBtn(label, enabled, onClick, color = '#00f5c4') {
    const b = document.createElement('button');
    b.textContent = label;
    b.disabled = !enabled;
    b.style.cssText = `background:${enabled ? color + '22' : '#0a1a14'};border:1px solid ${enabled ? color : '#0e2a1f'};color:${enabled ? color : '#3a6655'};padding:7px 12px;cursor:${enabled ? 'pointer' : 'default'};font-family:inherit;font-size:.76em;border-radius:6px`;
    if (enabled) b.addEventListener('click', onClick);
    return b;
  }

  function renderActions() {
    actionBar.innerHTML = '';
    if (getSquadResult(state)) return;
    if (state.phase !== 'player_turn') {
      actionBar.innerHTML = `<span style="font-size:.74em;color:#3a6655">Tour adverse…</span>`;
      return;
    }
    if (selected == null) {
      actionBar.innerHTML = `<span style="font-size:.74em;color:#3a6655">Sélectionne un champion pour agir.</span>`;
    } else {
      const ch = state.player.champions[selected];
      const E = state.player.energy;
      if (!canChampionAct(state, 'player', selected)) {
        actionBar.innerHTML = `<span style="font-size:.74em;color:#3a6655">${ch.name} a déjà agi.</span>`;
      } else {
        actionBar.appendChild(actionBtn(`⚔️ Attaque (${ch.energy}⚡)`, E >= ch.energy, () => doAct(selected, { type: 'basic' })));
        if (ch.skill) {
          const cd = state.player.skillCooldowns?.[ch.id] || 0;
          const cost = ch.energy + 1;
          actionBar.appendChild(actionBtn(`✨ ${ch.skill.name} (${cost}⚡${cd ? ' ⏳' + cd : ''})`, cd === 0 && E >= cost, () => doAct(selected, { type: 'skill' }), '#bb55d3'));
        }
        ch.equipment.forEach((e, idx) => {
          if (!['Special','Event','Team'].includes(e.type)) return;
          const used = ch.usedActives[idx];
          const oneshot = ['Event','Team'].includes(e.type);
          actionBar.appendChild(actionBtn(`${TI[e.type]} ${e.name} (${e.energy}⚡${oneshot ? ' 1×' : ''})`, !(oneshot && used) && E >= (e.energy || 0), () => doAct(selected, { type: 'active', equipIndex: idx }), '#ffbe46'));
        });
      }
    }
    const end = actionBtn('⏭️ Fin du tour', true, endTurn, '#42b0ff');
    end.style.marginLeft = 'auto';
    actionBar.appendChild(end);
  }

  function doAct(i, action) {
    if (busy) return;
    const res = championAct(state, 'player', i, action);
    if (!res.ok) { flashLog(res.reason); return; }
    state = res.state;
    selected = null;
    renderZones();
    if (getSquadResult(state)) return finish();
  }

  function endTurn() {
    if (busy) return;
    busy = true; selected = null;
    state = endSquadPlayerTurn(state, difficulty);
    busy = false;
    renderZones();
    if (getSquadResult(state)) finish();
  }

  function flashLog(msg) {
    state.log.push(`  ⚠️ ${msg}`);
    center.innerHTML = state.log.slice(-6).map(l => `<div>${l.replace(/</g,'&lt;')}</div>`).join('');
    center.scrollTop = center.scrollHeight;
  }

  async function finish() {
    const res = getSquadResult(state);
    let balanceTxt = '', questHtml = '', dailyHtml = '';
    if (res.winner === 'player') {
      const claimed = await claimSquadQuests(difficulty);   // d'abord les quêtes (ledger)
      if (claimed.length) {
        questHtml = `<div style="margin:-8px 0 16px;padding:10px;border:1px solid #ffbe4644;border-radius:8px;background:#1a140022">
          <div style="font-size:.64em;color:#ffbe46;letter-spacing:.1em;margin-bottom:4px">QUÊTES VALIDÉES</div>
          ${claimed.map(q => `<div style="font-size:.74em;color:#c8ffe8">🎯 ${q.title} <span style="color:#22c55e">+${q.earned} ✦</span></div>`).join('')}</div>`;
      }
      const dailyBonus = await awardDailyWin();              // bonus quotidien (ledger)
      if (dailyBonus > 0) {
        dailyHtml = `<div style="margin:-8px 0 16px;padding:10px;border:1px solid #00f5c444;border-radius:8px;background:#04140f">
          <div style="font-size:.74em;color:#c8ffe8">📅 Bonus quotidien — 1re victoire du jour <span style="color:#22c55e">+${dailyBonus} ✦</span></div></div>`;
      }
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
      ${questHtml}
      ${dailyHtml}
      <div style="display:flex;flex-direction:column;gap:8px">
        <button id="sq-again" style="background:#00f5c422;border:1px solid #00f5c4;color:#00f5c4;padding:9px;cursor:pointer;font-family:inherit;font-size:.84em;border-radius:8px">⚔️ Rejouer</button>
        <button id="sq-home" style="background:transparent;border:1px solid #3a6655;color:#3a6655;padding:8px;cursor:pointer;font-family:inherit;font-size:.8em;border-radius:8px">← Retour au hub</button>
      </div></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#sq-again').addEventListener('click', () => { overlay.remove(); renderSquadBattle(root, { playerSquad, difficulty }); });
    overlay.querySelector('#sq-home').addEventListener('click', () => {
      overlay.remove(); root.innerHTML = '';
      document.getElementById('app-root').style.display = 'none';
      document.querySelector('.shell').style.display = 'grid';
      window.dispatchEvent(new Event('hub:refresh')); // resync solde + parcours
    });
  }

  topbar.querySelector('#sq-flee').addEventListener('click', () => {
    root.innerHTML = '';
    document.getElementById('app-root').style.display = 'none';
    document.querySelector('.shell').style.display = 'grid';
    window.dispatchEvent(new Event('hub:refresh')); // resync solde + parcours
  });

  renderZones();
}
