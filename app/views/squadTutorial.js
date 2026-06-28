// app/views/squadTutorial.js — Tutoriel guidé du Mode Escouade (lot 8)
// Combat scénarisé : escouade fixe pré-montée, ennemi faible, IA passive, bulles
// d'aide étape par étape qui enseignent attaque / équipement / attaque spéciale.
// Récompense via la quête 'tuto_escouade' (claim_quest). Voir docs/RULES_JRPG.md §10.
import {
  createSquadBattle, championAct, getSquadResult,
  championAttackPower, teamShield, canChampionAct, SQUAD_HP,
} from '../../logic/squadEngine.js?v=13';
import { getClient } from '../../logic/supaRaw.js?v=13';
import { url } from '../../logic/paths.js?v=13';
import { playableSets } from '../../logic/sets.js?v=13';

const QUEST_ID = 'tuto_escouade';
const RC = { Common:'#9da7b3', Rare:'#42b0ff', Epic:'#bb55d3', Legendary:'#ffbe46', Mythical:'#ff5080' };
const TI = { Object:'🔧', Companion:'🐾', Special:'✨', Event:'⚡', Team:'👥' };
const cardImg = (id) => url(`/assets/cards/${id}.jpg`);
const ENEMY_HP = 14;

const SQUAD_IDS = {
  champions: ['BZH01_RC001', 'BZH01_RC002', 'BZH01_RC003'],
  equipment: ['BZH01_CO001', 'BZH01_CO004', 'BZH01_CO005'],
  enemy: 'BZH01_RC004',
};

async function loadCardsById(ids) {
  try {
    const sb = await getClient();
    const { data } = await sb.from('cards').select('*').in('id', ids);
    if (data && data.length) return data;
  } catch {}
  // Fallback JSON (champions sans skill)
  const all = (await Promise.all(playableSets().map(s => fetch(url(s.file)).then(r => r.json())))).flat();
  return all.filter(c => ids.includes(c.id));
}

// Étapes du tutoriel : mode = condition d'avancement ; allow = actions autorisées
const STEPS = [
  { text: "Bienvenue à l'Académie ! Voici ton <b>escouade de 3 champions</b>. Vous partagez un <b>pool de 30 PV</b> — réduis celui de l'adversaire à 0.", mode: 'continue' },
  { text: "Sélectionne ton <b>1er champion</b> (en bas), puis clique <b>⚔️ Attaque</b>. Son attaque = sa puissance + l'équipement.", mode: 'basic', allow: ['basic'] },
  { text: "Bien joué ! L'<b>équipement</b> (🔧🐾) renforce l'attaque et donne du <b>bouclier d'équipe</b>. Le bouclier réduit chaque coup reçu.", mode: 'continue' },
  { text: "Lance maintenant une <b>✨ Attaque spéciale</b> avec un champion (coûte un peu plus, puis se recharge).", mode: 'skill', allow: ['skill'] },
  { text: "Parfait. Termine l'adversaire : continue d'<b>attaquer</b> jusqu'à mettre son pool à 0 !", mode: 'win', allow: ['basic', 'skill', 'active'] },
];

export async function renderSquadTutorial(root) {
  root.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100vh;color:#3a6655;font-family:'Share Tech Mono',monospace;background:#04060a">Préparation du tutoriel…</div>`;
  const cards = await loadCardsById([...SQUAD_IDS.champions, ...SQUAD_IDS.equipment, SQUAD_IDS.enemy]);
  const byId = Object.fromEntries(cards.map(c => [c.id, c]));

  const playerSquad = {
    slots: SQUAD_IDS.champions.map((cid, i) => ({
      champion: byId[cid],
      equipment: byId[SQUAD_IDS.equipment[i]] ? [byId[SQUAD_IDS.equipment[i]]] : [],
    })).filter(s => s.champion),
    terrain: null,
  };
  const enemySquad = { slots: byId[SQUAD_IDS.enemy] ? [{ champion: byId[SQUAD_IDS.enemy], equipment: [] }] : [], terrain: null };

  if (playerSquad.slots.length < 3 || !enemySquad.slots.length) {
    root.innerHTML = `<div style="display:flex;flex-direction:column;gap:14px;align-items:center;justify-content:center;height:100vh;color:#c8ffe8;font-family:'Share Tech Mono',monospace;background:#04060a;text-align:center;padding:20px">
      <div style="color:#ff8a8a">Catalogue indisponible — réessaie plus tard.</div>
      <button id="t-back" style="background:transparent;border:1px solid #00f5c4;color:#00f5c4;padding:8px 20px;cursor:pointer;font-family:inherit">← Retour</button></div>`;
    root.querySelector('#t-back').addEventListener('click', backToHub);
    return;
  }

  let state = createSquadBattle(playerSquad, enemySquad);
  state.enemy.hp = ENEMY_HP;
  let selected = null;
  let step = 0;
  const skillCapable = playerSquad.slots.some(s => s.champion.skill);
  // Si le catalogue est dégradé (fallback JSON sans skills), l'étape spéciale
  // devient informative pour ne pas bloquer le joueur.
  const steps = STEPS.map(s => (s.mode === 'skill' && !skillCapable)
    ? { text: 'Astuce : en combat réel, chaque champion possède une <b>attaque spéciale ✨</b> à cooldown ! Continue pour terminer.', mode: 'continue' }
    : s);
  // Sandbox : énergie haute, et on neutralise le tour adverse (IA passive)
  function refill() { state.player.energy = 12; state.player.champions.forEach(c => { c.actedThisTurn = false; }); }
  refill();

  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:grid;grid-template-rows:auto auto 1fr auto auto;height:100vh;background:#04060a;color:#c8ffe8;font-family:"Share Tech Mono","Courier New",monospace;overflow:hidden';
  root.appendChild(wrap);

  const topbar = document.createElement('div');
  topbar.style.cssText = 'display:flex;align-items:center;gap:12px;padding:7px 14px;border-bottom:1px solid #0e2a1f;background:#020508';
  topbar.innerHTML = `<button id="t-quit" style="background:transparent;border:1px solid #3a6655;color:#3a6655;padding:2px 10px;cursor:pointer;font-family:inherit;font-size:.72em">← Quitter</button>
    <span style="font-family:'VT323',monospace;font-size:1.3em;color:#00f5c4;letter-spacing:.15em">TUTORIEL · ESCOUADE</span>
    <div style="flex:1"></div><span id="t-step" style="font-size:.72em;color:#3a6655"></span>`;
  wrap.appendChild(topbar);

  const bubble = document.createElement('div');
  bubble.style.cssText = 'padding:12px 16px;background:linear-gradient(90deg,#031410,#04140f);border-bottom:1px solid #0e2a1f;display:flex;align-items:center;gap:12px;min-height:56px';
  wrap.appendChild(bubble);

  const enemyZone = document.createElement('div'); enemyZone.style.cssText = 'padding:8px 14px;border-bottom:1px solid #0e2a1f;background:#0a0508';
  const center = document.createElement('div'); center.style.cssText = 'overflow-y:auto;padding:8px 14px;font-size:.72em;color:#6fa694';
  const playerZone = document.createElement('div'); playerZone.style.cssText = 'padding:8px 14px;border-top:1px solid #0e2a1f;background:#04100b';
  const actionBar = document.createElement('div'); actionBar.style.cssText = 'padding:8px 14px;border-top:1px solid #0e2a1f;background:#020508;min-height:52px;display:flex;align-items:center;gap:8px;flex-wrap:wrap';
  wrap.append(enemyZone, center, playerZone, actionBar);

  function hpBar(side, color) {
    const max = side === state.enemy ? ENEMY_HP : SQUAD_HP;
    const pct = Math.max(0, Math.min(100, (side.hp / max) * 100));
    return `<div style="display:flex;align-items:center;gap:8px;margin:4px 0">
      <span style="font-size:.72em;color:${color};min-width:64px">❤ ${side.hp}/${max}</span>
      <div style="flex:1;height:9px;background:#0a1a14;border:1px solid #0e2a1f;border-radius:6px;overflow:hidden"><div style="width:${pct}%;height:100%;background:${color}"></div></div>
      <span style="font-size:.66em;color:#7fb3a0">🛡 ${teamShield(side)}</span></div>`;
  }
  function champMini(side, i, sideKey) {
    const ch = side.champions[i]; const rc = RC[ch.rarity] || '#9da7b3';
    const isSel = sideKey === 'player' && selected === i;
    return `<div data-champ="${sideKey}:${i}" style="flex:1;min-width:0;max-width:120px;border:1px solid ${isSel ? '#00f5c4' : rc + '55'};border-radius:8px;padding:5px;background:${isSel ? '#04140f' : '#04060a'};${ch.actedThisTurn && sideKey === 'player' ? 'opacity:.55;' : ''}cursor:${sideKey === 'player' ? 'pointer' : 'default'}">
      <img src="${cardImg(ch.id)}" style="width:100%;aspect-ratio:2/3;object-fit:contain;background:#060c10;border-radius:4px" onerror="this.style.display='none'">
      <div style="font-size:.56em;color:${rc};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px">${ch.name}</div>
      <div style="font-size:.56em;color:#3a6655;display:flex;justify-content:space-between"><span>⚔${championAttackPower(side, i)}</span><span>${ch.equipment.map(e => TI[e.type] || '').join('')}</span></div></div>`;
  }

  function renderBubble() {
    const s = steps[step];
    topbar.querySelector('#t-step').textContent = `Étape ${Math.min(step + 1, steps.length)}/${steps.length}`;
    bubble.innerHTML = `<div style="font-size:1.6em">🤖</div><div style="flex:1;font-size:.82em;line-height:1.5;color:#c8ffe8">${s.text}</div>`;
    if (s.mode === 'continue') {
      const b = document.createElement('button');
      b.textContent = 'Continuer ▶';
      b.style.cssText = 'background:#00f5c422;border:1px solid #00f5c4;color:#00f5c4;padding:7px 16px;cursor:pointer;font-family:inherit;font-size:.78em;border-radius:6px;white-space:nowrap';
      b.addEventListener('click', () => { advanceFrom('continue'); });
      bubble.appendChild(b);
    }
  }

  function renderZones() {
    enemyZone.innerHTML = `<div style="font-size:.64em;color:#ff6f8a;letter-spacing:.1em">⬢ ADVERSAIRE</div>${hpBar(state.enemy, '#ff5080')}
      <div style="display:flex;gap:6px;max-width:140px">${state.enemy.champions.map((_, i) => champMini(state.enemy, i, 'enemy')).join('')}</div>`;
    playerZone.innerHTML = `<div style="display:flex;gap:6px">${state.player.champions.map((_, i) => champMini(state.player, i, 'player')).join('')}</div>${hpBar(state.player, '#00f5c4')}`;
    center.innerHTML = state.log.slice(-5).map(l => `<div>${l.replace(/</g, '&lt;')}</div>`).join('');
    center.scrollTop = center.scrollHeight;
    playerZone.querySelectorAll('[data-champ^="player"]').forEach(el => el.addEventListener('click', () => {
      const i = +el.dataset.champ.split(':')[1];
      selected = selected === i ? null : i;
      renderZones(); renderActions();
    }));
    renderActions();
  }

  function btn(label, enabled, onClick, color) {
    const b = document.createElement('button');
    b.textContent = label; b.disabled = !enabled;
    b.style.cssText = `background:${enabled ? color + '22' : '#0a1a14'};border:1px solid ${enabled ? color : '#0e2a1f'};color:${enabled ? color : '#3a6655'};padding:7px 12px;cursor:${enabled ? 'pointer' : 'default'};font-family:inherit;font-size:.76em;border-radius:6px`;
    if (enabled) b.addEventListener('click', onClick);
    return b;
  }

  function renderActions() {
    actionBar.innerHTML = '';
    const s = steps[step];
    if (!s || s.mode === 'continue') { actionBar.innerHTML = `<span style="font-size:.74em;color:#3a6655">Lis l'instruction puis continue.</span>`; return; }
    const allow = s.allow || [];
    if (selected == null) { actionBar.innerHTML = `<span style="font-size:.74em;color:#ffbe46">↓ Sélectionne un champion.</span>`; return; }
    const ch = state.player.champions[selected];
    if (!canChampionAct(state, 'player', selected)) { refill(); }
    actionBar.appendChild(btn(`⚔️ Attaque`, allow.includes('basic'), () => doAct({ type: 'basic' }), '#00f5c4'));
    if (ch.skill) {
      const cd = state.player.skillCooldowns?.[ch.id] || 0;
      actionBar.appendChild(btn(`✨ ${ch.skill.name}${cd ? ' ⏳' + cd : ''}`, allow.includes('skill') && cd === 0, () => doAct({ type: 'skill' }), '#bb55d3'));
    }
  }

  function doAct(action) {
    const res = championAct(state, 'player', selected, action);
    if (!res.ok) { state.log.push(`  ⚠️ ${res.reason}`); renderZones(); return; }
    state = res.state;
    refill();              // sandbox : on garde l'escouade prête
    selected = null;
    renderZones();
    if (getSquadResult(state)) return finish();
    advanceFrom(action.type);
  }

  function advanceFrom(kind) {
    const s = steps[step];
    if (!s) return;
    const ok = (s.mode === 'continue' && kind === 'continue')
      || (s.mode === 'basic' && kind === 'basic')
      || (s.mode === 'skill' && (kind === 'skill' || !skillCapable)) // tolère l'absence de skill (fallback JSON)
      || (s.mode === 'win'); // 'win' n'avance que par KO (géré dans finish)
    if (ok && s.mode !== 'win') { step++; renderBubble(); renderZones(); }
  }

  async function finish() {
    let rewardTxt = '';
    try {
      const sb = await getClient();
      const { data } = await sb.rpc('claim_quest', { p_quest_id: QUEST_ID });
      if (data?.ok) rewardTxt = `+${data.chronicles_earned} ✦`;
      else if (data?.error === 'Deja reclamee') rewardTxt = 'déjà réclamée';
    } catch {}
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:20000;display:grid;place-items:center;padding:20px';
    overlay.innerHTML = `<div style="background:#05080d;border:1px solid #22c55e;border-radius:14px;padding:28px 32px;text-align:center;font-family:'Share Tech Mono',monospace;color:#c8ffe8;width:min(380px,92vw)">
      <div style="font-family:'VT323',monospace;font-size:2.2em;color:#22c55e;letter-spacing:.2em;margin-bottom:8px">🎓 TUTORIEL TERMINÉ</div>
      <div style="font-size:.82em;color:#8ab4a0;margin-bottom:18px">Tu maîtrises les bases du Mode Escouade ! ${rewardTxt}</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button id="t-atelier" style="background:#00f5c422;border:1px solid #00f5c4;color:#00f5c4;padding:9px;cursor:pointer;font-family:inherit;font-size:.84em;border-radius:8px">🛡 Monter mon escouade</button>
        <button id="t-home" style="background:transparent;border:1px solid #3a6655;color:#3a6655;padding:8px;cursor:pointer;font-family:inherit;font-size:.8em;border-radius:8px">← Retour au hub</button>
      </div></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#t-atelier').addEventListener('click', () => { overlay.remove(); import('./squadBuilder.js?v=13').then(m => m.renderSquadBuilder(root)); });
    overlay.querySelector('#t-home').addEventListener('click', () => { overlay.remove(); backToHub(); });
  }

  function backToHub() {
    root.innerHTML = '';
    document.getElementById('app-root').style.display = 'none';
    document.querySelector('.shell').style.display = 'grid';
    // Resynchronise le hub (parcours d'initiation, solde) après le tutoriel.
    window.dispatchEvent(new Event('hub:refresh'));
  }
  topbar.querySelector('#t-quit').addEventListener('click', backToHub);

  renderBubble();
  renderZones();
}
