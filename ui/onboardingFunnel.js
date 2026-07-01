/**
 * ui/onboardingFunnel.js — Parcours d'initiation guidé (onboarding, priorité 1)
 *
 * Bandeau affiché en haut du hub pour les nouveaux joueurs. Il enchaîne les
 * 4 premières étapes du jeu et pointe vers l'action suivante :
 *   1. ✦ Kit de départ          (quête `tuto_01`, gérée par Lemegeton)
 *   2. 🛒 Acheter un booster      (boutique → possède un pack OU des cartes)
 *   3. 📦 Ouvrir le booster       (possède au moins une carte)
 *   4. 🛡 Tutoriel Escouade       (quête `tuto_escouade`)
 *
 * L'état est dérivé de la BDD (aucune nouvelle colonne) ; le bandeau disparaît
 * dès que le tutoriel Escouade est terminé. Voir docs/MODE_ESCOUADE.md.
 */

import { showLemegetonTuto } from './lemegetonTuto.js?v=24';

const KIT_QUEST  = 'tuto_01';
const TUTO_QUEST = 'tuto_escouade';
const DISMISS_KEY = 'onb_funnel_dismissed'; // sessionStorage : masqué pour la session

const CSS = `
  .onb-funnel{position:relative;border:1px solid #0e3a2b;border-radius:12px;
    background:linear-gradient(135deg,#03110d 0%,#04140f 60%,#040d14 100%);
    padding:14px 16px 16px;margin-bottom:16px;
    box-shadow:0 0 24px rgba(0,245,196,.08),inset 0 0 30px rgba(0,245,196,.03);overflow:hidden}
  .onb-funnel::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;
    background:linear-gradient(180deg,#00f5c4,#f0a500);box-shadow:0 0 12px rgba(0,245,196,.6)}
  .onb-head{display:flex;align-items:center;gap:10px;margin-bottom:12px}
  .onb-title{font-family:'VT323',monospace;font-size:1.35em;letter-spacing:.18em;color:#00f5c4;
    text-shadow:0 0 10px rgba(0,245,196,.5)}
  .onb-sub{font-size:.62em;color:#3a6655;letter-spacing:.12em}
  .onb-skip{margin-left:auto;font-size:.62em;color:#3a6655;background:none;border:none;cursor:pointer;
    font-family:var(--font);letter-spacing:.08em}
  .onb-skip:hover{color:#c8ffe8}
  .onb-steps{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
  .onb-step{display:flex;align-items:center;gap:7px;padding:6px 10px;border:1px solid #0e2a1f;
    border-radius:8px;background:#04060a;flex:1;min-width:118px}
  .onb-step.done{border-color:#0e3a2b;opacity:.65}
  .onb-step.active{border-color:#f0a500;box-shadow:0 0 14px rgba(240,165,0,.18);background:#0a0a04}
  .onb-step-ico{font-size:1.05em;flex-shrink:0}
  .onb-step-txt{display:flex;flex-direction:column;min-width:0}
  .onb-step-label{font-size:.66em;color:#c8ffe8;letter-spacing:.04em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .onb-step-state{font-size:.55em;letter-spacing:.08em}
  .onb-step.done .onb-step-state{color:#00f5c4}
  .onb-step.active .onb-step-state{color:#f0a500}
  .onb-step.pending .onb-step-state{color:#3a6655}
  .onb-cta-row{display:flex;align-items:center;gap:12px}
  .onb-hint{flex:1;font-size:.68em;color:#8ab4a0;line-height:1.4}
  .onb-cta{flex-shrink:0;background:linear-gradient(90deg,#003d2e,#004d38);border:1px solid #00f5c4;
    color:#00f5c4;font-family:var(--font);font-size:.78em;letter-spacing:.1em;padding:10px 18px;
    cursor:pointer;border-radius:8px;text-shadow:0 0 8px rgba(0,245,196,.35);
    box-shadow:0 0 16px rgba(0,245,196,.12);transition:all .18s;white-space:nowrap}
  .onb-cta:hover{background:linear-gradient(90deg,#005a42,#006e50);box-shadow:0 0 28px rgba(0,245,196,.26)}
  .onb-progress{height:3px;background:#0a1a14;border-radius:2px;margin-top:12px;overflow:hidden}
  .onb-progress-fill{height:100%;background:linear-gradient(90deg,#00f5c4,#f0a500);border-radius:2px;transition:width .4s}
  @keyframes onb-pulse-kf{0%,100%{box-shadow:0 0 0 rgba(0,245,196,0)}
    50%{box-shadow:0 0 0 3px rgba(0,245,196,.55),0 0 26px rgba(0,245,196,.42)}}
  .onb-pulse{animation:onb-pulse-kf .8s ease 3 !important;border-color:#00f5c4 !important}
`;

function injectStyles() {
  if (document.getElementById('onb-funnel-styles')) return;
  const s = document.createElement('style');
  s.id = 'onb-funnel-styles';
  s.textContent = CSS;
  document.head.appendChild(s);
}

async function loadState(sb, user) {
  const uid = user.id;
  const [comps, cards, packs] = await Promise.all([
    sb.from('tcg_quest_completions').select('quest_id').eq('user_id', uid).in('quest_id', [KIT_QUEST, TUTO_QUEST]),
    sb.from('tcg_player_cards').select('quantity').eq('user_id', uid),
    sb.from('tcg_player_packs').select('quantity').eq('player_id', uid),
  ]);
  const done = new Set((comps.data || []).map(c => c.quest_id));
  const cardCount = (cards.data || []).reduce((s, r) => s + (r.quantity || 0), 0);
  const packCount = (packs.data || []).reduce((s, r) => s + (r.quantity || 0), 0);
  return {
    kit:      done.has(KIT_QUEST),
    hasPack:  packCount > 0,
    hasCards: cardCount > 0,
    tuto:     done.has(TUTO_QUEST),
  };
}

// Met en évidence un élément du hub (boutique, boosters) pour guider l'œil.
function pulse(selector) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('onb-pulse');
  setTimeout(() => el.classList.remove('onb-pulse'), 2500);
}

export async function renderOnboardingFunnel({ sb, user, host, openView, onChanged }) {
  if (!host || !sb || !user) return;
  if (sessionStorage.getItem(DISMISS_KEY)) { host.innerHTML = ''; return; }

  let st;
  try { st = await loadState(sb, user); }
  catch (e) { console.warn('[onboarding]', e); host.innerHTML = ''; return; }

  // Parcours terminé (tuto Escouade fait) → on retire définitivement le bandeau.
  if (st.tuto) { host.innerHTML = ''; return; }

  const steps = [
    { key: 'kit',  ico: '✦',  label: 'Kit de départ',    done: st.kit,
      cta: 'Réclamer ✦',        hint: "Réclame tes 1 000 chronicles de départ auprès de LEMEGETON." },
    { key: 'buy',  ico: '🛒', label: 'Premier booster',  done: st.hasCards || st.hasPack,
      cta: 'Voir la boutique ▸', hint: "Achète ton premier booster dans la boutique (panneau de droite ◈)." },
    { key: 'open', ico: '📦', label: 'Ouvre le booster', done: st.hasCards,
      cta: 'Ouvrir mon booster ▸', hint: "Ouvre ton booster pour révéler tes premières cartes." },
    { key: 'tuto', ico: '🛡', label: 'Tuto Escouade',    done: st.tuto,
      cta: 'Démarrer le tuto ▸',  hint: "Apprends le Mode Escouade en 2 min — et empoche 500 ✦." },
  ];

  const doneCount = steps.filter(s => s.done).length;
  const active = steps.find(s => !s.done);
  const pct = Math.round((doneCount / steps.length) * 100);

  injectStyles();
  host.innerHTML = `
    <div class="onb-funnel">
      <div class="onb-head">
        <span class="onb-title">PARCOURS D'INITIATION</span>
        <span class="onb-sub">${doneCount}/${steps.length} · NOUVEL AGENT</span>
        <button class="onb-skip" id="onb-skip">plus tard ✕</button>
      </div>
      <div class="onb-steps">
        ${steps.map(s => {
          const cls = s.done ? 'done' : (s === active ? 'active' : 'pending');
          const state = s.done ? '✓ FAIT' : (s === active ? '▸ EN COURS' : 'À VENIR');
          return `<div class="onb-step ${cls}">
            <span class="onb-step-ico">${s.ico}</span>
            <span class="onb-step-txt">
              <span class="onb-step-label">${s.label}</span>
              <span class="onb-step-state">${state}</span>
            </span>
          </div>`;
        }).join('')}
      </div>
      <div class="onb-cta-row">
        <span class="onb-hint">${active ? active.hint : 'Bravo, Agent — tu maîtrises les bases !'}</span>
        ${active ? `<button class="onb-cta" id="onb-cta">${active.cta}</button>` : ''}
      </div>
      <div class="onb-progress"><div class="onb-progress-fill" style="width:${pct}%"></div></div>
    </div>`;

  host.querySelector('#onb-skip')?.addEventListener('click', () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    host.innerHTML = '';
  });

  if (active) {
    host.querySelector('#onb-cta')?.addEventListener('click', async () => {
      switch (active.key) {
        case 'kit':
          showLemegetonTuto({ sb, user }, onChanged);
          break;
        case 'buy':
          document.querySelector('.right-panel')?.classList.add('mob-open');
          pulse('.right-panel');
          break;
        case 'open':
          document.querySelector('#boosters-grid .booster-open-btn')
            ? pulse('#boosters-grid')
            : (document.querySelector('.right-panel')?.classList.add('mob-open'), pulse('.right-panel'));
          break;
        case 'tuto':
          if (typeof openView === 'function') openView('#/squad-tuto');
          break;
      }
    });
  }
}
