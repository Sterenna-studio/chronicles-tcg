// pages/leaderboardWidget.js — v1.0.0
// Leaderboard from tcg_leaderboard view (top 50, sorted by cards_count desc, gold desc)
// mount(container) — injectable anywhere
import { getClient } from '../logic/supaRaw.js?v=18';

const MEDALS = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];

const CSS = `
.lb-wrap {
  width: 100%;
  max-width: 640px;
}
.lb-title {
  font-weight: 800;
  font-size: 14px;
  color: #aaedbb;
  text-transform: uppercase;
  letter-spacing: .6px;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.lb-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.lb-table thead th {
  color: #5a8a7a;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: .5px;
  padding: 4px 10px;
  text-align: left;
  border-bottom: 1px solid #1a2e22;
}
.lb-table thead th.num { text-align: right; }
.lb-row {
  transition: background .1s;
}
.lb-row:hover { background: #0d1c14; }
.lb-row.me {
  background: #0b1e14;
  outline: 1px solid #2a5e34;
  outline-offset: -1px;
  border-radius: 6px;
}
.lb-row td {
  padding: 7px 10px;
  border-bottom: 1px solid #0f1c14;
  color: #cde;
  vertical-align: middle;
}
.lb-rank   { width: 36px; text-align: center; font-weight: 700; color: #7ab; font-size: 15px; }
.lb-name   { font-weight: 600; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lb-badge  { font-size: 13px; margin-left: 4px; }
.lb-num    { text-align: right; font-family: monospace; color: #ffd36b; }
.lb-cards  { text-align: right; font-family: monospace; color: #9ef; }
.lb-empty  { color: #456; font-size: 13px; padding: 12px 0; text-align: center; }
.lb-loading { color: #456; font-size: 13px; padding: 12px 10px; }
`;

/**
 * Mounts the leaderboard widget inside `container`.
 * @param {HTMLElement} container
 * @param {string|null} currentUserId  — highlights the current player's row
 */
export async function mount(container, currentUserId = null) {
  if (!document.getElementById('lb-style')) {
    const s = document.createElement('style');
    s.id = 'lb-style';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  const wrap = document.createElement('div');
  wrap.className = 'lb-wrap';
  wrap.innerHTML = `
    <div class="lb-title">🏆 Classement</div>
    <div class="lb-loading">Chargement…</div>
  `;
  container.appendChild(wrap);

  try {
    const sb = await getClient();
    // Lecture via fonction RPC SECURITY DEFINER (la vue security-definer a été
    // remplacée pour satisfaire l'audit sécurité Supabase).
    const { data, error } = await sb.rpc('get_tcg_leaderboard', { p_limit: 20 });

    if (error) throw error;

    if (!data || !data.length) {
      wrap.innerHTML = `
        <div class="lb-title">🏆 Classement</div>
        <div class="lb-empty">Aucun joueur pour l’instant.</div>
      `;
      return;
    }

    const table = document.createElement('table');
    table.className = 'lb-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th style="width:36px"></th>
          <th>Joueur</th>
          <th class="num">🃏 Cartes</th>
          <th class="num">⛁ Or</th>
          <th class="num">⚔️ Duels</th>
        </tr>
      </thead>
      <tbody id="lb-body"></tbody>
    `;

    const tbody = table.querySelector('#lb-body');
    data.forEach((row, i) => {
      const rank   = i + 1;
      const medal  = MEDALS[i] ?? String(rank);
      const isMe   = row.id === currentUserId;
      const legend = row.has_legendary ? '<span class="lb-badge" title="Possède une légendaire">🔥</span>' : '';
      const tr = document.createElement('tr');
      tr.className = 'lb-row' + (isMe ? ' me' : '');
      tr.innerHTML = `
        <td class="lb-rank">${medal}</td>
        <td class="lb-name">${escHtml(row.username || 'Anonyme')}${legend}</td>
        <td class="lb-cards">${row.cards_count ?? 0}</td>
        <td class="lb-num">${row.gold ?? 0}</td>
        <td class="lb-num">${row.duels_won ?? 0}</td>
      `;
      tbody.appendChild(tr);
    });

    wrap.innerHTML = '';
    wrap.appendChild(document.createElement('div')).className = 'lb-title';
    wrap.querySelector('.lb-title').innerHTML = '🏆 Classement';
    wrap.appendChild(table);

  } catch (e) {
    wrap.innerHTML = `<div class="lb-empty">⚠️ Erreur leaderboard : ${escHtml(e?.message || String(e))}</div>`;
  }
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
