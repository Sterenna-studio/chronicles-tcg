// app/views/battle.js
import { createBattle, playCard, getBattleResult, startTurn, mulligan, START_HP } from '../../logic/battleEngine.js?v=6';
import { runEnemyTurn } from '../../logic/aiEngine.js?v=6';
import { getClient, getUser } from '../../logic/supaRaw.js?v=6';
import { url } from '../../logic/paths.js?v=6';
import { playableSets } from '../../logic/sets.js?v=6';
import { getDailyChallenges, checkAndCompleteChallenges, getChallengeProgress } from '../../logic/challengeEngine.js?v=6';

const RC = { Common:'#9da7b3', Rare:'#42b0ff', Epic:'#bb55d3', Legendary:'#ffbe46', Mythical:'#ff5080' };
const TI = { Champion:'⚔️', Companion:'🐾', Event:'⚡', Object:'🔧', Special:'✨', Terrain:'🌍', Team:'👥' };

const DIFFICULTY_LABELS = { easy:'🟢 FACILE', normal:'🔵 NORMAL', hard:'🔴 DIFFICILE' };

// ── Génération du deck ennemi ─────────────────────────────────────────────────

function generateEnemyDeck(allCards, difficulty) {
  const rng = () => Math.random();

  const pools = {
    easy:   allCards.filter(c => ['Common','Rare'].includes(c.rarity) && c.type !== 'Champion'),
    normal: allCards.filter(c => ['Common','Rare','Epic'].includes(c.rarity)),
    hard:   allCards.filter(c => ['Rare','Epic','Legendary','Mythical'].includes(c.rarity)),
  };

  const maxChamps = { easy: 0, normal: 1, hard: 2 };
  const pool      = pools[difficulty] || pools.normal;
  const deck      = [];
  const used      = new Set();

  // Pioche jusqu'à 6 cartes, respect max champions
  const shuffled = [...pool].sort(() => rng() - 0.5);
  for (const card of shuffled) {
    if (deck.length >= 6) break;
    if (used.has(card.id)) continue;
    const champsIn = deck.filter(c => c.type === 'Champion').length;
    if (card.type === 'Champion' && champsIn >= maxChamps[difficulty]) continue;
    deck.push(card);
    used.add(card.id);
  }

  // Compléter avec des cartes quelconques si pas assez
  if (deck.length < 6) {
    const fallback = allCards.filter(c => !used.has(c.id)).sort(() => rng() - 0.5);
    for (const card of fallback) {
      if (deck.length >= 6) break;
      deck.push(card);
      used.add(card.id);
    }
  }

  return deck;
}

// ── Récompense gold ───────────────────────────────────────────────────────────

const GOLD_RANGES = {
  easy:   { win: [20, 40],  lose: [5, 10]  },
  normal: { win: [30, 55],  lose: [8, 15]  },
  hard:   { win: [45, 75],  lose: [12, 20] },
};

function calcGold(difficulty, won, turns) {
  const range  = GOLD_RANGES[difficulty] || GOLD_RANGES.normal;
  const [lo, hi] = won ? range.win : range.lose;
  const base   = lo + Math.floor(Math.random() * (hi - lo + 1));
  const bonus  = won ? Math.max(0, (10 - turns) * 2) : 0;
  return base + bonus;
}

async function awardGold(amount) {
  try {
    const sb   = await getClient();
    const user = await getUser();
    if (!user) return;
    // Source de vérité : profiles.chronicles
    const { data: prof } = await sb.from('profiles').select('chronicles').eq('id', user.id).single();
    const newVal = (prof?.chronicles || 0) + amount;
    await sb.from('profiles').update({ chronicles: newVal }).eq('id', user.id);
    // Met à jour l'affichage hub si visible
    const elGold = document.getElementById('ub-gold');
    const elStat = document.getElementById('stat-gold');
    const elChr  = document.getElementById('ub-chronicles');
    if (elGold) elGold.textContent = newVal;
    if (elStat) elStat.textContent = newVal;
    if (elChr)  elChr.textContent  = newVal;
  } catch(e) { console.warn('[battle] awardGold', e); }
}

// ── Export principal ──────────────────────────────────────────────────────────

/**
 * @param {HTMLElement} root
 * @param {{ playerDeck: Array, allCards: Array }} opts
 *   Si allCards n'est pas fourni, les cartes sont rechargées depuis les JSON.
 */
export async function renderBattle(root, opts = {}) {
  const difficulty = localStorage.getItem('tcg_battle_difficulty') || 'normal';

  let { playerDeck, allCards } = opts;

  // Charger les cartes si non fournies (sets jouables uniquement)
  if (!allCards || !allCards.length) {
    try {
      const loaded = await Promise.all(
        playableSets().map(s => fetch(url(s.file)).then(r => r.json()))
      );
      allCards = loaded.flat();
    } catch {
      root.innerHTML = '<div style="color:#ff8a8a;padding:32px;text-align:center">Erreur chargement cartes.</div>';
      return;
    }
  }

  // Charger le deck depuis localStorage si non fourni
  if (!playerDeck || !playerDeck.length) {
    const ids = JSON.parse(localStorage.getItem('tcg_saved_deck') || '[]');
    playerDeck = ids.map(id => allCards.find(c => c.id === id)).filter(Boolean);
  }

  if (playerDeck.length < 1) {
    root.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:16px;color:#c8ffe8;font-family:'Share Tech Mono',monospace;background:#04060a">
        <div style="font-size:1.1em;color:#ff8a8a">Aucun deck configuré.</div>
        <button id="go-deck" style="background:transparent;border:1px solid #00f5c4;color:#00f5c4;padding:8px 20px;cursor:pointer;font-family:inherit">Construire un deck</button>
      </div>`;
    root.querySelector('#go-deck').addEventListener('click', () => {
      import('./deckBuilder.js?v=6').then(m => m.renderDeckBuilder(root));
    });
    return;
  }

  const enemyDeck = generateEnemyDeck(allCards, difficulty);
  let state       = createBattle(playerDeck, enemyDeck);
  let busy        = false; // bloque les interactions pendant les animations

  // ── Contexte de combat (pour défis quotidiens) ────────────────────────────
  const battleCtx = {
    difficulty,
    champsPlayed: 0, companionsPlayed: 0, eventsPlayed: 0,
    terrainsPlayed: 0, objectsPlayed: 0, specialsPlayed: 0, teamsPlayed: 0,
    totalDamageDealt: 0,
    _turnDamage: 0,          // cumul dégâts du tour courant (privé)
    highestDamageOneTurn: 0,
    noRarePlayed: true,
    finalHp: 0,
  };

  // ── Build UI ─────────────────────────────────────────────────────────────
  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.style.cssText = [
    'display:grid;grid-template-rows:auto 1fr auto auto;height:100vh;',
    'background:#04060a;color:#c8ffe8;font-family:"Share Tech Mono","Courier New",monospace;overflow:hidden;',
  ].join('');
  root.appendChild(wrap);

  // ── Topbar ────────────────────────────────────────────────────────────────
  const topbar = document.createElement('div');
  topbar.style.cssText = 'display:flex;align-items:center;gap:12px;padding:7px 14px;border-bottom:1px solid #0e2a1f;background:#020508;flex-shrink:0';
  topbar.innerHTML = `
    <button id="btn-flee" style="background:transparent;border:1px solid #ff2d4e44;color:#ff2d4e88;padding:2px 8px;cursor:pointer;font-family:inherit;font-size:.72em">✕ Fuir</button>
    <span style="font-family:'VT323',monospace;font-size:1.3em;color:#00f5c4;letter-spacing:.15em">COMBAT</span>
    <span style="font-size:.68em;color:#3a6655">${DIFFICULTY_LABELS[difficulty]}</span>
    <div style="flex:1"></div>
    <span id="tb-turn" style="font-size:.75em;color:#ffbe46">Tour 1</span>
  `;
  wrap.appendChild(topbar);

  // ── Zone ennemi ───────────────────────────────────────────────────────────
  const enemyZone = document.createElement('div');
  enemyZone.style.cssText = 'padding:12px 16px;border-bottom:1px solid #0e2a1f;background:#020508;flex-shrink:0';
  enemyZone.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px">
      <span style="font-size:.72em;color:#ff2d4e;letter-spacing:.1em">🤖 ENNEMI</span>
      <span id="enemy-shield-badge" style="display:none;font-size:.68em;color:#42b0ff;background:#061828;border:1px solid #42b0ff44;padding:1px 7px;border-radius:10px"></span>
      <div style="flex:1;height:12px;background:#0e2a1f;border-radius:6px;overflow:hidden;border:1px solid #1a0a0f">
        <div id="enemy-hp-bar" style="height:100%;background:linear-gradient(90deg,#ff2d4e,#ff6080);transition:width .4s ease;border-radius:6px;width:100%"></div>
      </div>
      <span id="enemy-hp" style="font-size:.82em;color:#ff2d4e;font-weight:700;min-width:60px;text-align:right;transition:color .3s">30 / 30</span>
      <div id="enemy-hand-count" style="font-size:.68em;color:#3a6655">Main: 3</div>
    </div>
    <div id="enemy-played-card" style="min-height:20px;margin-bottom:4px"></div>
    <div id="enemy-field" style="display:flex;gap:6px;flex-wrap:wrap"></div>
  `;
  wrap.appendChild(enemyZone);

  // ── Log de combat ─────────────────────────────────────────────────────────
  const logEl = document.createElement('div');
  logEl.id = 'battle-log';
  logEl.style.cssText = 'overflow-y:auto;padding:10px 14px;font-size:.7em;line-height:1.7;color:#6fa694;background:#030709';
  wrap.appendChild(logEl);

  // ── Zone joueur ───────────────────────────────────────────────────────────
  const playerZone = document.createElement('div');
  playerZone.style.cssText = 'border-top:1px solid #0e2a1f;background:#020508;flex-shrink:0';

  // Barre HP joueur
  const hpBar = document.createElement('div');
  hpBar.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 14px 4px';
  hpBar.innerHTML = `
    <span style="font-size:.72em;color:#00f5c4;letter-spacing:.1em">⚡ <span id="player-energy">1</span>/<span id="player-energy-max">7</span></span>
    <span id="player-shield-badge" style="display:none;font-size:.68em;color:#42b0ff;background:#061828;border:1px solid #42b0ff44;padding:1px 7px;border-radius:10px;letter-spacing:.06em"></span>
    <div style="flex:1;height:12px;background:#0e2a1f;border-radius:6px;overflow:hidden;border:1px solid #082814">
      <div id="player-hp-bar" style="height:100%;background:linear-gradient(90deg,#00f5c4,#22c55e);transition:width .4s ease;border-radius:6px;width:100%"></div>
    </div>
    <span id="player-hp" style="font-size:.82em;color:#00f5c4;font-weight:700;min-width:60px;text-align:right;transition:color .3s">30 / 30</span>
  `;
  playerZone.appendChild(hpBar);

  // Main du joueur
  const handEl = document.createElement('div');
  handEl.id = 'player-hand';
  handEl.style.cssText = 'display:flex;gap:8px;padding:6px 14px 10px;overflow-x:auto;align-items:flex-end;min-height:120px';
  playerZone.appendChild(handEl);

  // Bouton fin de tour
  const footerEl = document.createElement('div');
  footerEl.style.cssText = 'display:flex;justify-content:flex-end;padding:6px 14px 10px;gap:10px';
  footerEl.innerHTML = `
    <div id="player-field-info" style="font-size:.65em;color:#3a6655;flex:1;display:flex;align-items:center;gap:8px"></div>
    <button id="btn-end-turn" style="background:#0e2a1f;border:1px solid #00f5c4;color:#00f5c4;padding:8px 20px;cursor:pointer;font-family:inherit;font-size:.82em;font-weight:700;letter-spacing:.1em;border-radius:6px">
      FIN DE TOUR →
    </button>
  `;
  playerZone.appendChild(footerEl);
  wrap.appendChild(playerZone);

  // ── Rendu état ───────────────────────────────────────────────────────────
  let _prevPlayerHp = START_HP;
  let _prevEnemyHp  = START_HP;

  function flashHpBar(elBar, elText, accentColor) {
    elBar.style.background = accentColor;
    elText.style.color     = '#fff';
    elText.style.textShadow = '0 0 10px ' + accentColor;
    elBar.parentElement.style.animation = 'hpShake .35s ease';
    setTimeout(() => {
      elBar.style.background    = '';
      elText.style.color        = '';
      elText.style.textShadow   = '';
      if (elBar.parentElement) elBar.parentElement.style.animation = '';
    }, 600);
  }

  function renderState(s) {
    const maxHp = START_HP;

    // HP bars + shake on damage
    const phBar  = document.getElementById('player-hp-bar');
    const phText = document.getElementById('player-hp');
    const ehBar  = document.getElementById('enemy-hp-bar');
    const ehText = document.getElementById('enemy-hp');

    const curPlayerHp = Math.max(0, s.player.hp);
    const curEnemyHp  = Math.max(0, s.enemy.hp);

    phText.textContent  = curPlayerHp + ' / ' + maxHp;
    phBar.style.width   = (curPlayerHp / maxHp * 100) + '%';
    ehText.textContent  = curEnemyHp + ' / ' + maxHp;
    ehBar.style.width   = (curEnemyHp / maxHp * 100) + '%';

    if (curPlayerHp < _prevPlayerHp) flashHpBar(phBar, phText, '#ff2d4e');
    if (curEnemyHp  < _prevEnemyHp)  flashHpBar(ehBar, ehText, '#ff8a8a');
    _prevPlayerHp = curPlayerHp;
    _prevEnemyHp  = curEnemyHp;

    // Énergie
    document.getElementById('player-energy').textContent     = s.player.energy;
    document.getElementById('player-energy-max').textContent = s.energyMax;

    // Tour
    document.getElementById('tb-turn').textContent = `Tour ${s.turn}`;

    // Main ennemi (cartes dos)
    document.getElementById('enemy-hand-count').textContent = `Main: ${s.enemy.hand.length}`;

    // Shield temporaire joueur (shieldTemp + champ shield)
    const totalPlayerShield = (s.player.shieldTemp || 0)
      + (s.player.field || []).reduce((a, o) => a + (o.shield || 0), 0);
    const shieldEl = document.getElementById('player-shield-badge');
    if (shieldEl) {
      if (totalPlayerShield > 0) {
        shieldEl.textContent = '🛡 ' + totalPlayerShield;
        shieldEl.style.display = 'inline';
      } else {
        shieldEl.style.display = 'none';
      }
    }

    // Shield ennemi
    const totalEnemyShield = (s.enemy.shieldTemp || 0)
      + (s.enemy.field || []).reduce((a, o) => a + (o.shield || 0), 0);
    const eShieldEl = document.getElementById('enemy-shield-badge');
    if (eShieldEl) {
      if (totalEnemyShield > 0) {
        eShieldEl.textContent = '🛡 ' + totalEnemyShield;
        eShieldEl.style.display = 'inline';
      } else {
        eShieldEl.style.display = 'none';
      }
    }

    // Objets ennemis sur le terrain
    const ef = document.getElementById('enemy-field');
    ef.innerHTML = '';
    (s.enemy.field || []).forEach(obj => {
      const chip = document.createElement('span');
      chip.style.cssText = 'font-size:.6em;background:#1a0810;border:1px solid #ff2d4e44;color:#ff8a8a;padding:2px 7px;border-radius:10px';
      chip.textContent = `${obj.kind === 'companion' ? '🐾' : '🔧'} ${obj.name} (🛡${obj.shield})`;
      ef.appendChild(chip);
    });
    if (s.enemy.terrain) {
      const t = document.createElement('span');
      t.style.cssText = 'font-size:.6em;background:#101a08;border:1px solid #ffbe4644;color:#ffbe46;padding:2px 7px;border-radius:10px';
      t.textContent = `🌍 ${s.enemy.terrain.name}`;
      ef.appendChild(t);
    }

    // Objets joueur
    const pf = document.getElementById('player-field-info');
    pf.innerHTML = '';
    const buffs = (s.player.buffs || []);
    if (buffs.length) {
      const chip = document.createElement('span');
      chip.style.cssText = 'font-size:.62em;background:#0a1a14;border:1px solid #00f5c444;color:#00f5c4;padding:2px 8px;border-radius:10px';
      chip.textContent = `🐾 Companion +${buffs.reduce((a,b) => a + (b.powerBoost||0), 0)} pour prochain Champion`;
      pf.appendChild(chip);
    }
    (s.player.field || []).forEach(obj => {
      const chip = document.createElement('span');
      chip.style.cssText = 'font-size:.62em;background:#0a1a14;border:1px solid #00f5c444;color:#00f5c4;padding:2px 8px;border-radius:10px';
      chip.textContent = `${obj.kind === 'companion' ? '🐾' : '🔧'} ${obj.name} (🛡${obj.shield})`;
      pf.appendChild(chip);
    });
    if (s.player.terrain) {
      const t = document.createElement('span');
      t.style.cssText = 'font-size:.62em;background:#101a08;border:1px solid #ffbe4644;color:#ffbe46;padding:2px 8px;border-radius:10px';
      t.textContent = `🌍 ${s.player.terrain.name}`;
      pf.appendChild(t);
    }

    // Main joueur
    renderHand(s);

    // Log
    appendNewLogs(s);
  }

  let lastLogLen = 0;
  function appendNewLogs(s) {
    const newLines = s.log.slice(lastLogLen);
    lastLogLen = s.log.length;
    newLines.forEach(line => {
      const p = document.createElement('div');
      p.style.cssText = 'padding:1px 0;border-bottom:1px solid #0a1510';
      p.style.color = line.startsWith('⚔️') || line.startsWith('---') ? '#ffbe46'
                    : line.startsWith('  🤖') ? '#ff8a8a'
                    : line.startsWith('  ⚡') ? '#bb55d3'
                    : '#6fa694';
      p.textContent = line;
      logEl.appendChild(p);
    });
    logEl.scrollTop = logEl.scrollHeight;
  }

  function renderHand(s) {
    handEl.innerHTML = '';
    if (!s.player.hand.length) {
      handEl.innerHTML = '<div style="color:#3a6655;font-size:.72em;padding:8px">Deck vide</div>';
      return;
    }
    s.player.hand.forEach((card, idx) => {
      const rc       = RC[card.rarity] || '#9da7b3';
      const canPlay  = card.energy <= s.player.energy && s.phase === 'player_turn' && !busy;
      const imgSrc   = url(`/assets/cards/${card.id}.jpg`);

      const cardEl = document.createElement('div');
      cardEl.style.cssText = `
        width:80px;flex-shrink:0;border-radius:8px;overflow:hidden;
        border:1px solid ${canPlay ? rc : '#0e2a1f'};
        background:#04060a;cursor:${canPlay ? 'pointer' : 'not-allowed'};
        transition:transform .15s,box-shadow .15s;
        opacity:${canPlay ? '1' : '.45'};
        position:relative;
      `;
      cardEl.title = `${card.name}\n${card.type} · ${card.rarity}\n⚡ Énergie: ${card.energy}  ⚔ Power: ${card.power}  🛡 Shield: ${card.shield}\n\n${card.desc || ''}`;
      cardEl.innerHTML = `
        <img src="${imgSrc}" alt="${card.name}"
          style="width:100%;aspect-ratio:2/3;object-fit:contain;background:#060c10;display:block"
          onerror="this.style.display='none'">
        <div style="padding:2px 4px;font-size:.55em;color:${rc};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${card.name}</div>
        <div style="padding:0 4px 3px;display:flex;justify-content:space-between;font-size:.52em;color:#3a6655">
          <span style="color:#ffbe46">⚡${card.energy}</span><span>⚔${card.power}</span><span>🛡${card.shield}</span>
        </div>
        <div style="position:absolute;top:2px;left:2px;font-size:.6em;background:rgba(0,0,0,.7);padding:1px 4px;border-radius:3px;color:${rc}">${TI[card.type]||''}</div>
      `;

      if (canPlay) {
        cardEl.addEventListener('mouseenter', () => {
          cardEl.style.transform = 'translateY(-6px) scale(1.05)';
          cardEl.style.boxShadow = `0 8px 20px ${rc}55`;
        });
        cardEl.addEventListener('mouseleave', () => {
          cardEl.style.transform = '';
          cardEl.style.boxShadow = '';
        });
        cardEl.addEventListener('click', () => onPlayCard(idx));
      }

      handEl.appendChild(cardEl);
    });
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  function onPlayCard(idx, opts) {
    if (busy || state.phase !== 'player_turn') return;
    const card = state.player.hand[idx];
    const prevEnemyHp = state.enemy.hp;
    const res = playCard(state, 'player', idx, opts || {});
    if (!res.ok && res.needsDiscard) { promptFieldDiscard(idx); return; }
    if (!res.ok) { flashBanner(res.reason || 'Impossible', '#ff8a8a'); return; }
    state = res.state;

    // ── Suivi contexte défis ────────────────────────────────────────────────
    if (card) {
      const t = card.type;
      if (t === 'Champion')  battleCtx.champsPlayed++;
      else if (t === 'Companion') battleCtx.companionsPlayed++;
      else if (t === 'Event')     battleCtx.eventsPlayed++;
      else if (t === 'Terrain')   battleCtx.terrainsPlayed++;
      else if (t === 'Object')    battleCtx.objectsPlayed++;
      else if (t === 'Special')   battleCtx.specialsPlayed++;
      else if (t === 'Team')      battleCtx.teamsPlayed++;

      if (card.rarity && card.rarity.toLowerCase() !== 'common') battleCtx.noRarePlayed = false;

      const dmg = Math.max(0, prevEnemyHp - state.enemy.hp);
      battleCtx.totalDamageDealt += dmg;
      battleCtx._turnDamage      += dmg;
      if (battleCtx._turnDamage > battleCtx.highestDamageOneTurn) {
        battleCtx.highestDamageOneTurn = battleCtx._turnDamage;
      }
    }

    renderState(state);
    checkEnd();
  }

  // Champ plein : choisir la carte du champ à défausser pour faire de la place
  function promptFieldDiscard(idx) {
    const fld = state.player.field || [];
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:25000;display:grid;place-items:center;padding:20px';
    const box = document.createElement('div');
    box.style.cssText = 'background:#05080d;border:1px solid #00f5c4;border-radius:12px;padding:20px;max-width:460px;color:#c8ffe8;font-family:inherit;text-align:center';
    box.innerHTML = '<div style="font-size:.9em;color:#00f5c4;margin-bottom:12px">Champ plein — défausse une carte pour faire de la place</div>';
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;justify-content:center';
    fld.forEach((o, j) => {
      const b = document.createElement('button');
      b.style.cssText = 'background:#0a1a14;border:1px solid #00f5c455;color:#c8ffe8;padding:6px 10px;cursor:pointer;font-family:inherit;font-size:.72em;border-radius:6px';
      b.textContent = `${o.kind === 'companion' ? '🐾' : '🔧'} ${o.name} (🛡${o.shield})`;
      b.addEventListener('click', () => { overlay.remove(); onPlayCard(idx, { replaceFieldIndex: j }); });
      row.appendChild(b);
    });
    box.appendChild(row);
    const cancel = document.createElement('button');
    cancel.style.cssText = 'margin-top:12px;background:transparent;border:none;color:#3a6655;cursor:pointer;font-family:inherit;font-size:.72em';
    cancel.textContent = 'Annuler';
    cancel.addEventListener('click', () => overlay.remove());
    box.appendChild(cancel);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  async function onEndTurn() {
    if (busy || state.phase !== 'player_turn') return;
    busy = true;
    document.getElementById('btn-end-turn').disabled = true;

    // Tour ennemi avec IA
    // Enregistre le plus haut dégât d'un seul tour avant de reset
    battleCtx._turnDamage = 0;

    // Début du tour ennemi : énergie, garde (reset + Terrain), pioche
    state = startTurn('enemy', state);

    // Petite pause pour que le joueur voit la transition
    await delay(300);
    const logBefore = state.log.length;
    state = runEnemyTurn(state, difficulty);

    // ── Affichage des cartes jouées par l'ennemi ──────────────────────────
    const enemyPlayedEl = document.getElementById('enemy-played-card');
    if (enemyPlayedEl) {
      enemyPlayedEl.innerHTML = '';
      const newLogs = state.log.slice(logBefore);
      // Cherche les lignes "🤖 joue [CardName]" dans le log
      const playLines = newLogs.filter(l => l.includes('joue'));
      playLines.forEach(line => {
        const chip = document.createElement('div');
        chip.style.cssText = 'display:inline-flex;align-items:center;gap:6px;background:#180a0a;border:1px solid #ff2d4e55;color:#ff8a8a;padding:3px 10px;border-radius:8px;font-size:.65em;margin:2px 4px 2px 0;animation:enemyCardIn .3s ease';
        chip.textContent = line.trim();
        enemyPlayedEl.appendChild(chip);
      });
      // Efface après 2s
      if (playLines.length) setTimeout(() => { if (enemyPlayedEl) enemyPlayedEl.innerHTML = ''; }, 2200);
    }

    renderState(state);

    if (checkEnd()) { busy = false; return; }

    // Nouveau tour joueur : turn+1, énergie, garde (reset + Terrain), pioche
    state = startTurn('player', state);

    renderState(state);
    document.getElementById('btn-end-turn').disabled = false;
    busy = false;
  }

  function checkEnd() {
    const result = getBattleResult(state);
    if (!result) return false;
    state = { ...state, phase: 'end' };
    renderState(state);
    setTimeout(() => showEndScreen(result), 700);
    return true;
  }

  // ── Écran de fin ─────────────────────────────────────────────────────────

  async function showEndScreen(result) {
    const won  = result.winner === 'player';
    const draw = result.winner === 'draw';
    const gold = calcGold(difficulty, won, result.turns);

    // ── Défis quotidiens ────────────────────────────────────────────────────
    battleCtx.finalHp = Math.max(0, state.player.hp);
    const completedChallenges = checkAndCompleteChallenges(result, battleCtx);
    const bonusGold = completedChallenges.reduce((s, c) => s + c.goldEarned, 0);
    const totalGold = gold + bonusGold;

    await awardGold(totalGold);

    // Bloc défis complétés
    let challengeHtml = '';
    if (completedChallenges.length) {
      const rows = completedChallenges.map(c => `
        <div style="display:flex;align-items:center;gap:8px;background:#07170f;border:1px solid #00f5c444;border-radius:6px;padding:6px 10px">
          <span style="font-size:1.1em">${c.challenge.icon}</span>
          <div style="flex:1;text-align:left">
            <div style="font-size:.72em;color:#00f5c4">${c.challenge.label}</div>
            <div style="font-size:.6em;color:#3a6655">${c.challenge.desc}</div>
          </div>
          <span style="color:#ffbe46;font-size:.78em;font-weight:700">+${c.goldEarned}🪙</span>
        </div>
      `).join('');
      challengeHtml = `
        <div style="margin-bottom:16px;display:flex;flex-direction:column;gap:6px">
          <div style="font-size:.6em;color:#3a6655;letter-spacing:.15em;margin-bottom:4px">DÉFIS COMPLÉTÉS</div>
          ${rows}
        </div>
      `;
    }

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:20000;display:grid;place-items:center;animation:fadeIn .4s ease';
    const box = document.createElement('div');
    const accentColor = won ? '#00f5c4' : draw ? '#ffbe46' : '#ff2d4e';
    const glowColor   = won ? 'rgba(0,245,196,.25)' : draw ? 'rgba(240,165,0,.25)' : 'rgba(255,45,78,.25)';
    box.style.cssText = 'background:#05080d;border:2px solid ' + accentColor + ';border-radius:16px;padding:28px 32px;'
      + 'color:#c8ffe8;font-family:"Share Tech Mono",monospace;'
      + 'text-align:center;width:min(380px,94vw);'
      + 'box-shadow:0 0 60px ' + glowColor + ';max-height:90vh;overflow-y:auto';
    const goldMarginBottom = completedChallenges.length ? '4px' : '20px';
    const baseGoldHtml     = bonusGold > 0 ? '+' + gold + ' <span style="font-size:.65em;color:#3a6655">🪙 base</span>' : '+' + gold + ' 🪙';
    const totalGoldHtml    = bonusGold > 0 ? '<div style="font-size:.9em;color:#ffbe46;margin-bottom:14px;font-weight:700">Total : +' + totalGold + ' 🪙</div>' : '';
    box.innerHTML = '<div style="font-family:\'VT323\',monospace;font-size:3em;color:' + accentColor + ';letter-spacing:.2em;margin-bottom:8px">'
      + (won ? 'VICTOIRE' : draw ? 'ÉGALITÉ' : 'DÉFAITE')
      + '</div>'
      + '<div style="font-size:.85em;color:#6fa694;margin-bottom:12px">' + result.turns + ' tours · ' + DIFFICULTY_LABELS[difficulty] + '</div>'
      + '<div style="font-size:1.2em;font-weight:700;color:#ffbe46;margin-bottom:' + goldMarginBottom + '">' + baseGoldHtml + '</div>'
      + totalGoldHtml
      + challengeHtml
      + '<div style="display:flex;flex-direction:column;gap:8px">'
      + '<button id="end-replay" style="background:#0a1a14;border:1px solid #00f5c4;color:#00f5c4;padding:10px;cursor:pointer;font-family:inherit;font-size:.82em">🔄 Rejouer</button>'
      + '<button id="end-deck" style="background:transparent;border:1px solid #3a6655;color:#3a6655;padding:8px;cursor:pointer;font-family:inherit;font-size:.78em">🃏 Changer de deck</button>'
      + '<button id="end-hub" style="background:transparent;border:none;color:#3a6655;padding:6px;cursor:pointer;font-family:inherit;font-size:.72em">← Retour au hub</button>'
      + '</div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    box.querySelector('#end-replay').addEventListener('click', () => {
      overlay.remove();
      renderBattle(root, { playerDeck, allCards });
    });
    box.querySelector('#end-deck').addEventListener('click', () => {
      overlay.remove();
      import('./deckBuilder.js?v=6').then(m => m.renderDeckBuilder(root));
    });
    box.querySelector('#end-hub').addEventListener('click', () => {
      overlay.remove();
      root.innerHTML = '';
      document.getElementById('app-root').style.display = 'none';
      document.querySelector('.shell').style.display = 'grid';
      renderDailyChallenges();
    });
  }

  // ── Banner flash ─────────────────────────────────────────────────────────

  function flashBanner(txt, color) {
    color = color || '#42b0ff';
    const b = document.createElement('div');
    b.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);background:#05080d;border:1px solid ' + color + ';color:' + color + ';padding:6px 18px;font-family:inherit;font-size:.8em;border-radius:8px;z-index:30000;pointer-events:none;animation:fadeIn .2s ease';
    b.textContent = txt;
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 1800);
  }

  // ── Init ─────────────────────────────────────────────────────────────────

  topbar.querySelector('#btn-flee').addEventListener('click', () => {
    if (!confirm('Fuir le combat ? (pas de récompense)')) return;
    root.innerHTML = '';
    document.getElementById('app-root').style.display = 'none';
    document.querySelector('.shell').style.display = 'grid';
  });

  document.getElementById('btn-end-turn').addEventListener('click', onEndTurn);

  // Inject CSS animations
  if (!document.getElementById('battle-css')) {
    const style = document.createElement('style');
    style.id = 'battle-css';
    style.textContent = [
      '@keyframes fadeIn{from{opacity:0;transform:translateX(-50%) scale(.95)}to{opacity:1;transform:translateX(-50%) scale(1)}}',
      '@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}',
      '@keyframes hpShake{0%{transform:translateX(0)}20%{transform:translateX(-5px)}40%{transform:translateX(4px)}60%{transform:translateX(-3px)}80%{transform:translateX(2px)}100%{transform:translateX(0)}}',
      '@keyframes enemyCardIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}',
    ].join(' ');
    document.head.appendChild(style);
  }

  // Mulligan (une fois) avant le tour 1
  function offerMulligan() {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:25000;display:grid;place-items:center;padding:20px';
    const box = document.createElement('div');
    box.style.cssText = 'background:#05080d;border:1px solid #00f5c4;border-radius:12px;padding:22px 26px;max-width:420px;color:#c8ffe8;font-family:inherit;text-align:center';
    box.innerHTML = '<div style="font-family:\'VT323\',monospace;font-size:1.5em;color:#00f5c4;letter-spacing:.12em;margin-bottom:8px">MAIN DE DÉPART</div>'
      + '<div style="font-size:.78em;color:#6fa694;margin-bottom:14px">Tu peux re-piocher une nouvelle main (une seule fois).</div>'
      + '<div style="display:flex;gap:10px;justify-content:center">'
      + '<button id="mull-keep" style="background:#0a1a14;border:1px solid #00f5c4;color:#00f5c4;padding:8px 18px;cursor:pointer;font-family:inherit;font-size:.82em;border-radius:6px">Garder</button>'
      + '<button id="mull-redraw" style="background:transparent;border:1px solid #ffbe46;color:#ffbe46;padding:8px 18px;cursor:pointer;font-family:inherit;font-size:.82em;border-radius:6px">🔄 Mulligan</button>'
      + '</div>';
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    box.querySelector('#mull-keep').addEventListener('click', () => overlay.remove());
    box.querySelector('#mull-redraw').addEventListener('click', () => {
      state = mulligan('player', state);
      renderState(state);
      overlay.remove();
    });
  }

  renderState(state);
  offerMulligan();
}

function renderDailyChallenges() {
  const el = document.getElementById('daily-challenges-list');
  if (!el) return;
  import('../../logic/challengeEngine.js?v=6').then(({ getDailyChallenges, getChallengeProgress }) => {
    const challenges = getDailyChallenges();
    const progress   = getChallengeProgress();
    el.innerHTML = '';
    challenges.forEach(ch => {
      const done = !!progress[ch.id]?.completed;
      const item = document.createElement('div');
      item.style.cssText = 'display:flex;align-items:center;gap:7px;padding:5px 7px;border-radius:5px;border:1px solid ' + (done ? '#0e2a1f' : 'rgba(0,245,196,.2)') + ';background:#04060a;margin-bottom:4px;opacity:' + (done ? '.55' : '1');
      item.innerHTML = ch.icon + ' <div style="flex:1"><div style="font-size:.62em;color:' + (done ? '#3a6655' : '#c8ffe8') + '">' + ch.label + '</div>'
        + '<div style="font-size:.55em;color:#3a6655">' + ch.desc + '</div></div>'
        + '<span style="color:' + (done ? '#3a6655' : '#ffbe46') + ';font-size:.62em">' + (done ? '\u2713' : '+' + ch.gold + '\u{1fa99}') + '</span>';
      el.appendChild(item);
    });
  });
}

const delay = ms => new Promise(r => setTimeout(r, ms));
