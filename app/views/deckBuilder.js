// app/views/deckBuilder.js
import { getClient, getUser } from '../../logic/supaRaw.js?v=19';
import { url } from '../../logic/paths.js?v=19';
import { playableSets } from '../../logic/sets.js?v=19';

// Sets jouables uniquement (Set 02 visible en collection mais hors combat).
const SETS = playableSets();
const MAX_DECK   = 6;
const MAX_CHAMPS = 2;
const DECK_KEY   = 'tcg_saved_deck'; // localStorage

const RC = { Common:'#9da7b3', Rare:'#42b0ff', Epic:'#bb55d3', Legendary:'#ffbe46', Mythical:'#ff5080' };
const TI = { Champion:'⚔️', Companion:'🐾', Event:'⚡', Object:'🔧', Special:'✨', Terrain:'🌍', Team:'👥' };

// ── Chargement données ────────────────────────────────────────────────────────

async function loadAllCards() {
  const results = await Promise.all(
    SETS.map(s => fetch(url(s.file)).then(r => r.json()))
  );
  return results.flat().map(c => Array.isArray(c) ? c : c).flat();
}

async function fetchOwned() {
  try {
    const sb   = await getClient();
    const user = await getUser();
    if (!user) return {};
    const { data } = await sb.from('tcg_player_cards').select('card_id, quantity').eq('user_id', user.id);
    return Object.fromEntries((data || []).map(r => [r.card_id, r.quantity || 0]));
  } catch { return {}; }
}

// ── Rendu ─────────────────────────────────────────────────────────────────────

export async function renderDeckBuilder(root) {
  root.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;padding:40px;color:#3a6655">Chargement…</div>`;

  const [allCards, owned] = await Promise.all([loadAllCards(), fetchOwned()]);
  const ownedCards = allCards.filter(c => (owned[c.id] || 0) > 0);

  // Collection vide → message d'aide
  if (!ownedCards.length) {
    root.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:80vh;gap:16px;font-family:'Share Tech Mono',monospace;color:#3a6655;text-align:center;padding:20px">
        <div style="font-family:'VT323',monospace;font-size:2.4em;color:#00f5c4;letter-spacing:.2em">COLLECTION VIDE</div>
        <div style="font-size:.82em;max-width:360px;line-height:1.6">Tu n'as pas encore de cartes.<br>Achète des boosters dans la boutique pour construire ton deck !</div>
        <button id="db-back-empty" style="margin-top:12px;background:transparent;border:1px solid #00f5c4;color:#00f5c4;padding:8px 24px;cursor:pointer;font-family:inherit;font-size:.85em">← Retour au hub</button>
      </div>`;
    root.querySelector('#db-back-empty').addEventListener('click', () => {
      root.innerHTML = '';
      document.getElementById('app-root').style.display = 'none';
      document.querySelector('.shell').style.display = 'grid';
    });
    return;
  }

  // Deck courant (restauré depuis localStorage)
  const savedIds  = JSON.parse(localStorage.getItem(DECK_KEY) || '[]');
  let deck        = savedIds.map(id => allCards.find(c => c.id === id)).filter(Boolean);

  // Filtres actifs
  let filterType   = 'all';
  let filterRarity = 'all';
  let searchTxt    = '';

  // ── Shell principal ──────────────────────────────────────────────────────
  root.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:grid;grid-template-rows:auto 1fr;height:100vh;background:var(--bg,#04060a);color:#c8ffe8;font-family:"Share Tech Mono","Courier New",monospace;overflow:hidden';
  root.appendChild(wrap);

  // Topbar
  const topbar = document.createElement('div');
  topbar.style.cssText = 'display:flex;align-items:center;gap:12px;padding:8px 16px;border-bottom:1px solid #0e2a1f;background:#020508;flex-shrink:0;flex-wrap:wrap';
  topbar.innerHTML = `
    <button id="db-back" style="background:transparent;border:1px solid #3a6655;color:#3a6655;padding:3px 10px;cursor:pointer;font-family:inherit;font-size:.78em">← Retour</button>
    <span style="color:#00f5c4;font-family:'VT323',monospace;font-size:1.4em;letter-spacing:.15em">CONSTRUCTION DE DECK</span>
    <span style="color:#3a6655;font-size:.75em">Max ${MAX_DECK} cartes · Max ${MAX_CHAMPS} Champions</span>
    <div style="flex:1"></div>
    <input id="db-search" placeholder="Chercher…" style="background:#050d14;border:1px solid #0e2a1f;color:#c8ffe8;padding:4px 10px;font-family:inherit;font-size:.78em;width:160px">
    <select id="db-type" style="background:#050d14;border:1px solid #0e2a1f;color:#c8ffe8;padding:4px 8px;font-family:inherit;font-size:.78em">
      <option value="all">Tous types</option>
      ${[...new Set(ownedCards.map(c => c.type))].sort().map(t => `<option value="${t}">${TI[t]||''} ${t}</option>`).join('')}
    </select>
    <select id="db-rarity" style="background:#050d14;border:1px solid #0e2a1f;color:#c8ffe8;padding:4px 8px;font-family:inherit;font-size:.78em">
      <option value="all">Toutes raretés</option>
      ${['Common','Rare','Epic','Legendary','Mythical'].map(r => `<option value="${r}">${r}</option>`).join('')}
    </select>
  `;
  wrap.appendChild(topbar);

  // Corps : grille cartes gauche + deck droite
  const body = document.createElement('div');
  body.style.cssText = 'display:grid;grid-template-columns:1fr 280px;overflow:hidden';
  wrap.appendChild(body);

  // Grille cartes disponibles
  const gridWrap = document.createElement('div');
  gridWrap.style.cssText = 'overflow-y:auto;padding:12px 14px';
  body.appendChild(gridWrap);

  // Panel deck
  const deckPanel = document.createElement('div');
  deckPanel.style.cssText = 'border-left:1px solid #0e2a1f;background:#020508;display:flex;flex-direction:column;overflow:hidden';
  body.appendChild(deckPanel);

  // ── Rendu grille ────────────────────────────────────────────────────────
  function renderGrid() {
    const filtered = ownedCards.filter(c => {
      if (filterType   !== 'all' && c.type   !== filterType)   return false;
      if (filterRarity !== 'all' && c.rarity !== filterRarity) return false;
      if (searchTxt && !c.name.toLowerCase().includes(searchTxt.toLowerCase())) return false;
      return true;
    });

    gridWrap.innerHTML = '';
    if (!filtered.length) {
      gridWrap.innerHTML = '<div style="padding:20px;color:#3a6655;font-size:.8em">Aucune carte correspondante.</div>';
      return;
    }

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px';
    gridWrap.appendChild(grid);

    filtered.forEach(card => {
      const inDeck  = deck.some(d => d.id === card.id);
      const rc      = RC[card.rarity] || '#9da7b3';
      const imgSrc  = url(`/assets/cards/${card.id}.jpg`);
      const qty     = owned[card.id] || 0;

      const div = document.createElement('div');
      div.title = `${card.name} — ${card.rarity}\npower:${card.power} shield:${card.shield} energy:${card.energy}`;
      div.style.cssText = `
        border-radius:8px;border:1px solid ${inDeck ? rc : '#0e2a1f'};
        background:#04060a;overflow:hidden;cursor:pointer;position:relative;
        transition:transform .15s,box-shadow .15s;
        ${inDeck ? `box-shadow:0 0 10px ${rc}55;` : 'opacity:.75;'}
      `;
      div.innerHTML = `
        <img src="${imgSrc}" alt="${card.name}"
          style="width:100%;aspect-ratio:2/3;object-fit:contain;background:#060c10;display:block"
          onerror="this.style.display='none'">
        <div style="padding:3px 5px;font-size:.58em;color:${rc};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${card.name}</div>
        <div style="padding:0 5px 3px;display:flex;justify-content:space-between;font-size:.55em;color:#3a6655">
          <span>⚡${card.energy}</span><span>⚔${card.power}</span><span>🛡${card.shield}</span>
        </div>
        ${inDeck ? `<div style="position:absolute;top:3px;right:3px;background:${rc};color:#000;font-size:.55em;font-weight:700;padding:1px 4px;border-radius:3px">✓</div>` : ''}
        ${qty > 1 ? `<div style="position:absolute;top:3px;left:3px;background:#42b0ff22;color:#42b0ff;font-size:.55em;padding:1px 4px;border-radius:3px">x${qty}</div>` : ''}
      `;

      div.addEventListener('mouseenter', () => { div.style.transform = 'translateY(-2px)'; div.style.boxShadow = inDeck ? `0 6px 16px ${rc}66` : `0 4px 12px rgba(0,0,0,.5)`; });
      div.addEventListener('mouseleave', () => { div.style.transform = ''; div.style.boxShadow = inDeck ? `0 0 10px ${rc}55` : ''; });

      div.addEventListener('click', () => {
        if (inDeck) {
          deck = deck.filter(d => d.id !== card.id);
        } else {
          if (deck.length >= MAX_DECK) { flashMsg('Deck plein (6 cartes max) !', '#ff8a8a'); return; }
          const champCount = deck.filter(d => d.type === 'Champion').length;
          if (card.type === 'Champion' && champCount >= MAX_CHAMPS) { flashMsg(`Max ${MAX_CHAMPS} Champions !`, '#ff8a8a'); return; }
          const r = (card.rarity || '').toLowerCase();
          if (r === 'legendary' && deck.some(d => (d.rarity || '').toLowerCase() === 'legendary')) { flashMsg('Max 1 légendaire !', '#ff8a8a'); return; }
          if (r === 'mythical'  && deck.some(d => (d.rarity || '').toLowerCase() === 'mythical'))  { flashMsg('Max 1 mythique !', '#ff8a8a'); return; }
          deck.push(card);
        }
        renderGrid();
        renderDeckPanel();
      });

      grid.appendChild(div);
    });
  }

  // ── Panel deck ──────────────────────────────────────────────────────────
  function renderDeckPanel() {
    deckPanel.innerHTML = '';

    const header = document.createElement('div');
    header.style.cssText = 'padding:10px 12px;border-bottom:1px solid #0e2a1f;flex-shrink:0';
    const champCount = deck.filter(d => d.type === 'Champion').length;
    const totalPower = deck.reduce((s, c) => s + c.power, 0);
    const ready = deck.length === MAX_DECK && champCount >= 1;
    header.innerHTML = `
      <div style="font-size:.78em;color:#00f5c4;letter-spacing:.1em;margin-bottom:6px">MON DECK — <span id="deck-count" style="color:${ready ? '#22c55e' : '#ffbe46'}">${deck.length}/${MAX_DECK}</span></div>
      <div style="font-size:.65em;color:#3a6655;display:flex;gap:10px">
        <span>⚔️ ${champCount}/${MAX_CHAMPS} Champ.</span>
        <span>💥 Σpower: ${totalPower}</span>
      </div>
    `;
    deckPanel.appendChild(header);

    const list = document.createElement('div');
    list.style.cssText = 'flex:1;overflow-y:auto;padding:8px';
    deckPanel.appendChild(list);

    if (!deck.length) {
      list.innerHTML = '<div style="color:#3a6655;font-size:.72em;padding:8px;text-align:center">Clique sur des cartes pour les ajouter</div>';
    } else {
      deck.forEach((card, idx) => {
        const rc  = RC[card.rarity] || '#9da7b3';
        const row = document.createElement('div');
        row.style.cssText = `display:flex;align-items:center;gap:6px;padding:5px 6px;border:1px solid #0e2a1f;border-radius:6px;margin-bottom:4px;background:#04060a;cursor:pointer;transition:border-color .15s`;
        row.innerHTML = `
          <img src="${url(`/assets/cards/${card.id}.jpg`)}" style="width:30px;height:42px;object-fit:contain;border-radius:3px;background:#060c10;flex-shrink:0" onerror="this.style.display='none'">
          <div style="flex:1;min-width:0">
            <div style="font-size:.68em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:${rc}">${card.name}</div>
            <div style="font-size:.58em;color:#3a6655">${TI[card.type]||''} ${card.type}</div>
            <div style="font-size:.55em;color:#6fa694">⚡${card.energy} ⚔${card.power} 🛡${card.shield}</div>
          </div>
          <button data-idx="${idx}" style="background:transparent;border:none;color:#3a6655;cursor:pointer;font-size:.9em;padding:2px 4px" title="Retirer">✕</button>
        `;
        row.addEventListener('mouseenter', () => row.style.borderColor = '#ff2d4e44');
        row.addEventListener('mouseleave', () => row.style.borderColor = '#0e2a1f');
        row.querySelector('button').addEventListener('click', e => {
          e.stopPropagation();
          deck.splice(idx, 1);
          renderGrid();
          renderDeckPanel();
        });
        list.appendChild(row);
      });
    }

    // Boutons bas
    const footer = document.createElement('div');
    footer.style.cssText = 'padding:10px 12px;border-top:1px solid #0e2a1f;display:flex;flex-direction:column;gap:6px;flex-shrink:0';
    footer.innerHTML = `
      <div id="db-msg" style="font-size:.68em;min-height:18px;text-align:center"></div>
      <button id="btn-save" style="background:transparent;border:1px solid #00f5c4;color:#00f5c4;padding:6px;cursor:pointer;font-family:inherit;font-size:.78em;${!ready?'opacity:.4;pointer-events:none':''}">
        💾 Sauvegarder le deck
      </button>
      <button id="btn-fight" style="background:${ready?'#00f5c422':'#0a1a14'};border:1px solid ${ready?'#00f5c4':'#0e2a1f'};color:${ready?'#00f5c4':'#3a6655'};padding:8px;cursor:${ready?'pointer':'default'};font-family:inherit;font-size:.85em;font-weight:700;letter-spacing:.1em">
        ⚔️ COMBATTRE
      </button>
    `;
    deckPanel.appendChild(footer);

    if (ready) {
      footer.querySelector('#btn-save').addEventListener('click', () => {
        localStorage.setItem(DECK_KEY, JSON.stringify(deck.map(c => c.id)));
        flashMsg('Deck sauvegardé ✅', '#22c55e');
      });
      footer.querySelector('#btn-fight').addEventListener('click', () => {
        localStorage.setItem(DECK_KEY, JSON.stringify(deck.map(c => c.id)));
        showDifficultySelector(deck);
      });
    }
  }

  // ── Sélecteur difficulté (modal avant combat) ────────────────────────────
  function showDifficultySelector(playerDeck) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:20000;display:grid;place-items:center';
    const box = document.createElement('div');
    box.style.cssText = 'background:#05080d;border:1px solid #00f5c4;border-radius:14px;padding:28px 32px;color:#c8ffe8;font-family:"Share Tech Mono",monospace;width:min(380px,92vw);text-align:center';
    box.innerHTML = `
      <div style="font-family:'VT323',monospace;font-size:1.8em;color:#00f5c4;letter-spacing:.2em;margin-bottom:16px">CHOISIR DIFFICULTÉ</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <button class="diff-btn" data-diff="easy"   style="background:#0a1a14;border:1px solid #22c55e;color:#22c55e;padding:12px;cursor:pointer;font-family:inherit;font-size:.88em;border-radius:8px">🟢 FACILE — 20-40 ✦</button>
        <button class="diff-btn" data-diff="normal" style="background:#0a1a14;border:1px solid #42b0ff;color:#42b0ff;padding:12px;cursor:pointer;font-family:inherit;font-size:.88em;border-radius:8px">🔵 NORMAL — 30-55 ✦</button>
        <button class="diff-btn" data-diff="hard"   style="background:#0a1a14;border:1px solid #ff2d4e;color:#ff2d4e;padding:12px;cursor:pointer;font-family:inherit;font-size:.88em;border-radius:8px">🔴 DIFFICILE — 45-75 ✦</button>
      </div>
      <button id="diff-cancel" style="margin-top:14px;background:transparent;border:none;color:#3a6655;cursor:pointer;font-family:inherit;font-size:.75em">Annuler</button>
    `;
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    box.querySelectorAll('.diff-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.remove();
        localStorage.setItem('tcg_battle_difficulty', btn.dataset.diff);
        // Navigate to battle
        root.innerHTML = '';
        document.querySelector('.shell')?.style.setProperty('display', 'none');
        document.getElementById('app-root').style.display = 'block';
        import('./battle.js?v=19').then(m => m.renderBattle(root, { playerDeck, allCards }));
      });
    });
    box.querySelector('#diff-cancel').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  }

  // ── Message flash ───────────────────────────────────────────────────────
  function flashMsg(txt, color = '#42b0ff') {
    const el = deckPanel.querySelector('#db-msg');
    if (!el) return;
    el.innerHTML = `<span style="color:${color}">${txt}</span>`;
    setTimeout(() => { if (el) el.innerHTML = ''; }, 2200);
  }

  // ── Événements filtres ──────────────────────────────────────────────────
  topbar.querySelector('#db-back').addEventListener('click', () => {
    root.innerHTML = '';
    document.getElementById('app-root').style.display = 'none';
    document.querySelector('.shell').style.display = 'grid';
  });
  topbar.querySelector('#db-search').addEventListener('input', e => { searchTxt = e.target.value; renderGrid(); });
  topbar.querySelector('#db-type').addEventListener('change', e => { filterType = e.target.value; renderGrid(); });
  topbar.querySelector('#db-rarity').addEventListener('change', e => { filterRarity = e.target.value; renderGrid(); });

  renderGrid();
  renderDeckPanel();
}
