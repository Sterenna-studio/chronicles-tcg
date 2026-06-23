/**
 * lemegetonTuto.js
 * Modale d'accueil Lemegeton — Quête tuto_01
 * S'affiche automatiquement si le joueur n'a pas encore réclamé tuto_01.
 */
import { getClient, getUser } from '../logic/supaRaw.js?v=3';

const QUEST_ID = 'tuto_01';

const DIALOGUE = [
  "Connexion établie. Je suis <span class='lem-name'>LEMEGETON</span>, intelligence artificielle du Gwen Ha Stêar.",
  "Bienvenue dans le <span class='lem-accent'>Bridge</span>, Agent. Ce terminal est votre point d'entrée vers la collection Chronicles TCG.",
  "Avant de commencer, réclamez votre <span class='lem-accent'>kit de départ</span>. Il contient les ressources nécessaires pour acquérir vos premiers boosters.",
  "Le chemin est long. La collection, vaste. Bonne chance, Agent."
];

const CSS = `
  .lem-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,.85);
    z-index: 8000;
    display: grid; place-items: center;
    padding: 16px;
    animation: lem-fade-in .3s ease;
  }
  @keyframes lem-fade-in { from { opacity:0 } to { opacity:1 } }
  .lem-modal {
    background: #03080f;
    border: 1px solid #00f5c4;
    border-radius: 12px;
    width: min(520px, 95vw);
    box-shadow: 0 0 60px rgba(0,245,196,.18), 0 0 120px rgba(0,245,196,.06);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .lem-header {
    display: flex; align-items: center; gap: 12px;
    padding: 14px 18px;
    border-bottom: 1px solid #0e2a1f;
    background: linear-gradient(90deg, #020d10 0%, #031410 100%);
  }
  .lem-avatar {
    width: 44px; height: 44px; border-radius: 50%;
    border: 2px solid #00f5c4;
    background: #010a0d;
    display: flex; align-items: center; justify-content: center;
    font-size: 1.4em;
    box-shadow: 0 0 14px rgba(0,245,196,.5);
    flex-shrink: 0;
    animation: lem-pulse 3s ease-in-out infinite;
  }
  @keyframes lem-pulse {
    0%,100% { box-shadow: 0 0 10px rgba(0,245,196,.4); }
    50%      { box-shadow: 0 0 22px rgba(0,245,196,.8); }
  }
  .lem-header-info { flex: 1; }
  .lem-title {
    font-family: 'VT323', monospace;
    font-size: 1.5em; letter-spacing: .2em;
    color: #00f5c4;
    text-shadow: 0 0 10px rgba(0,245,196,.7);
  }
  .lem-subtitle { font-size: .62em; color: #3a6655; letter-spacing: .12em; margin-top: 1px; }
  .lem-status {
    font-size: .6em; color: #00f5c4; letter-spacing: .1em;
    display: flex; align-items: center; gap: 5px;
  }
  .lem-status::before {
    content: ''; display: inline-block;
    width: 6px; height: 6px; border-radius: 50%;
    background: #00f5c4;
    box-shadow: 0 0 6px #00f5c4;
    animation: lem-blink 1.2s step-end infinite;
  }
  @keyframes lem-blink { 0%,100%{opacity:1} 50%{opacity:0} }

  .lem-body { padding: 20px 20px 8px; display: flex; flex-direction: column; gap: 12px; }
  .lem-dialogue-box {
    background: #010d0a;
    border: 1px solid #0e2a1f;
    border-radius: 8px;
    padding: 14px 16px;
    min-height: 80px;
    font-size: .78em; line-height: 1.7; letter-spacing: .04em;
    color: #c8ffe8;
    position: relative;
  }
  .lem-cursor {
    display: inline-block;
    width: 8px; height: 1em;
    background: #00f5c4;
    vertical-align: text-bottom;
    animation: lem-blink 1s step-end infinite;
    margin-left: 2px;
  }
  .lem-nav { display: flex; justify-content: flex-end; gap: 6px; padding: 0 20px 14px; }
  .lem-btn-next {
    background: transparent; border: 1px solid #3a6655;
    color: #3a6655; font-family: var(--font); font-size: .7em;
    letter-spacing: .1em; padding: 4px 14px; cursor: pointer;
    border-radius: 4px; transition: all .18s;
  }
  .lem-btn-next:hover { border-color: #00f5c4; color: #00f5c4; }

  .lem-footer {
    padding: 14px 20px 18px;
    border-top: 1px solid #0e2a1f;
    background: #020b0e;
    display: flex; flex-direction: column; align-items: center; gap: 8px;
  }
  .lem-reward {
    display: flex; align-items: center; gap: 8px;
    font-family: 'VT323', monospace; font-size: 1.3em;
    color: #f0a500; letter-spacing: .12em;
    text-shadow: 0 0 10px rgba(240,165,0,.5);
  }
  .lem-btn-claim {
    width: 100%;
    background: linear-gradient(90deg, #003d2e 0%, #004d38 100%);
    border: 1px solid #00f5c4; color: #00f5c4;
    font-family: var(--font); font-size: .78em; letter-spacing: .12em;
    padding: 10px 0; cursor: pointer; border-radius: 6px;
    transition: all .2s;
    text-shadow: 0 0 8px rgba(0,245,196,.4);
    box-shadow: 0 0 18px rgba(0,245,196,.1);
  }
  .lem-btn-claim:hover:not(:disabled) {
    background: linear-gradient(90deg, #005a42 0%, #006e50 100%);
    box-shadow: 0 0 28px rgba(0,245,196,.25);
  }
  .lem-btn-claim:disabled { opacity: .5; cursor: default; }
  .lem-btn-claim.claimed {
    border-color: #f0a500; color: #f0a500;
    text-shadow: 0 0 8px rgba(240,165,0,.4);
    background: linear-gradient(90deg, #1a0d00 0%, #1f1000 100%);
  }
  .lem-name   { color: #00f5c4; font-weight: 700; }
  .lem-accent { color: #f0a500; }
  .lem-skip {
    font-size: .58em; color: #3a6655; letter-spacing: .1em;
    cursor: pointer; background: none; border: none;
    font-family: var(--font); transition: color .18s;
  }
  .lem-skip:hover { color: #c8ffe8; }
`;

function injectStyles() {
  if (document.getElementById('lem-styles')) return;
  const s = document.createElement('style');
  s.id = 'lem-styles';
  s.textContent = CSS;
  document.head.appendChild(s);
}

async function hasClaimedTuto(sb, userId) {
  const { data } = await sb
    .from('tcg_quest_completions')
    .select('quest_id')
    .eq('user_id', userId)
    .eq('quest_id', QUEST_ID)
    .maybeSingle();
  return !!data;
}

function buildModal() {
  const overlay = document.createElement('div');
  overlay.className = 'lem-overlay';
  overlay.innerHTML = `
    <div class="lem-modal">
      <div class="lem-header">
        <div class="lem-avatar">⬡</div>
        <div class="lem-header-info">
          <div class="lem-title">LEMEGETON</div>
          <div class="lem-subtitle">INTELLIGENCE ARTIFICIELLE · GWEN HA STÊAR</div>
        </div>
        <div class="lem-status">ONLINE</div>
      </div>
      <div class="lem-body">
        <div class="lem-dialogue-box" id="lem-dialogue"><span class="lem-cursor"></span></div>
      </div>
      <div class="lem-nav">
        <button class="lem-btn-next" id="lem-btn-next">SUITE ▶</button>
      </div>
      <div class="lem-footer">
        <div class="lem-reward">✦ <span>+1 000 CHRONICLES</span> — KIT DE DÉPART</div>
        <button class="lem-btn-claim" id="lem-btn-claim" disabled>
          RÉCLAMER MON KIT DE DÉPART
        </button>
        <button class="lem-skip" id="lem-skip">passer l'introduction</button>
      </div>
    </div>
  `;
  return overlay;
}

function typewrite(el, html, speed = 22) {
  return new Promise(resolve => {
    // On parse les balises HTML proprement
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const text = tmp.innerHTML; // HTML avec balises
    // On va afficher caractère par caractère sur le textContent brut puis swap
    const plain = tmp.textContent;
    let i = 0;
    el.innerHTML = '<span class="lem-cursor"></span>';
    const cursor = el.querySelector('.lem-cursor');
    const span = document.createElement('span');
    el.insertBefore(span, cursor);
    const interval = setInterval(() => {
      span.textContent = plain.slice(0, ++i);
      if (i >= plain.length) {
        clearInterval(interval);
        // Remplace par le HTML complet une fois fini
        span.innerHTML = html;
        resolve();
      }
    }, speed);
  });
}

export async function showLemegetonTuto(onDone) {
  const sb = await getClient();
  const user = await getUser();
  if (!user) return;

  const already = await hasClaimedTuto(sb, user.id);
  if (already) return;

  injectStyles();
  const overlay = buildModal();
  document.body.appendChild(overlay);

  const dialogueEl = document.getElementById('lem-dialogue');
  const btnNext    = document.getElementById('lem-btn-next');
  const btnClaim   = document.getElementById('lem-btn-claim');
  const btnSkip    = document.getElementById('lem-skip');

  let step = 0;

  async function showStep(idx) {
    btnNext.disabled = true;
    await typewrite(dialogueEl, DIALOGUE[idx]);
    btnNext.disabled = false;
    if (idx >= DIALOGUE.length - 1) {
      btnNext.style.display = 'none';
      btnClaim.disabled = false;
    }
  }

  btnNext.addEventListener('click', () => {
    step++;
    if (step < DIALOGUE.length) showStep(step);
  });

  btnClaim.addEventListener('click', async () => {
    btnClaim.disabled = true;
    btnClaim.textContent = 'CONNEXION EN COURS...';
    try {
      const { data, error } = await sb.rpc('claim_quest', { p_quest_id: QUEST_ID });
      if (error || !data?.ok) {
        btnClaim.textContent = data?.error || 'Erreur';
        btnClaim.style.borderColor = '#ff2d4e';
        btnClaim.style.color = '#ff2d4e';
        return;
      }
      btnClaim.textContent = `✦ +${data.chronicles_earned} CHRONICLES REÇUS — BONNE CHANCE, AGENT`;
      btnClaim.classList.add('claimed');
      if (typeof onDone === 'function') await onDone();
      setTimeout(() => {
        overlay.style.animation = 'lem-fade-in .3s ease reverse';
        setTimeout(() => overlay.remove(), 280);
      }, 1800);
    } catch(e) {
      console.error('[lemegeton]', e);
      btnClaim.disabled = false;
      btnClaim.textContent = 'ERREUR — RÉESSAYER';
    }
  });

  btnSkip.addEventListener('click', () => overlay.remove());

  // Démarre le premier dialogue
  showStep(0);
}
