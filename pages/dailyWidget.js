// pages/dailyWidget.js — v1.0.0
// Injectable daily-gold widget. Call mount(container) to attach.
import { getDailyStatus, claimDaily, formatCountdown, DAILY_AMOUNT } from '../data/dailyRepo.js?v=3';

const CSS = `
.daily-widget {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  background: linear-gradient(160deg, #0b1520 0%, #0e1c12 100%);
  border: 1px solid #1e3a22;
  border-radius: 18px;
  padding: 20px 24px;
  min-width: 220px;
  max-width: 320px;
  box-shadow: 0 0 32px rgba(80,200,120,.08);
}
.daily-title  { font-weight:800; font-size:15px; color:#aaedbb; letter-spacing:.5px; text-transform:uppercase; }
.daily-amount { font-size:32px; font-weight:900; color:#ffd36b; text-shadow:0 0 14px rgba(255,210,80,.35); }
.daily-sub    { font-size:12px; color:#6a9a70; }
.daily-btn {
  border:1px solid #2a5e34; background:linear-gradient(180deg,#133d1e 0%,#0d2815 100%);
  color:#b5f0c0; font-weight:700; font-size:14px; padding:10px 28px;
  border-radius:12px; cursor:pointer; transition:filter .15s,transform .1s;
}
.daily-btn:hover:not([disabled]) { filter:brightness(1.15); transform:translateY(-1px); }
.daily-btn[disabled] { opacity:.5; cursor:not-allowed; background:#0a1a0e; }
.daily-countdown { font-family:monospace; font-size:18px; color:#7ecf90; letter-spacing:1px; }
.daily-msg       { font-size:12px; min-height:16px; color:#88c894; text-align:center; }
.daily-msg.err   { color:#f99; }
`;

/**
 * Mounts the daily widget inside `container`.
 * Dispatches window event 'tcg:gold' with { detail: { gold } } after a successful claim.
 */
export async function mount(container) {
  if (!document.getElementById('daily-widget-style')) {
    const style = document.createElement('style');
    style.id = 'daily-widget-style';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  const el = document.createElement('div');
  el.className = 'daily-widget';
  el.innerHTML = `
    <div class="daily-title">⛁ Or Quotidien</div>
    <div class="daily-amount">+${DAILY_AMOUNT}</div>
    <div class="daily-sub">par jour</div>
    <button class="daily-btn" id="daily-claim-btn" disabled>Chargement…</button>
    <div class="daily-countdown" id="daily-countdown"></div>
    <div class="daily-msg"      id="daily-msg"></div>
  `;
  container.appendChild(el);

  const btn       = el.querySelector('#daily-claim-btn');
  const countdown = el.querySelector('#daily-countdown');
  const msg       = el.querySelector('#daily-msg');
  let _intervalId  = null;

  function startCountdown(nextClaimAt) {
    if (_intervalId) clearInterval(_intervalId);
    _intervalId = setInterval(() => {
      const rem = nextClaimAt.getTime() - Date.now();
      if (rem <= 0) {
        clearInterval(_intervalId);
        _intervalId = null;
        countdown.textContent = '';
        btn.disabled    = false;
        btn.textContent = 'Réclamer';
        msg.textContent = '';
        msg.className   = 'daily-msg';
      } else {
        countdown.textContent = formatCountdown(rem);
      }
    }, 1000);
  }

  // Auto-cleanup when element is removed from DOM
  const observer = new MutationObserver(() => {
    if (!document.body.contains(el)) {
      if (_intervalId) clearInterval(_intervalId);
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Init
  try {
    const status = await getDailyStatus();
    if (status.canClaim) {
      btn.disabled    = false;
      btn.textContent = 'Réclamer';
    } else {
      btn.disabled    = true;
      btn.textContent = 'Déjà réclamé';
      startCountdown(status.nextClaimAt);
    }
  } catch (e) {
    btn.disabled    = true;
    btn.textContent = 'Erreur';
    msg.textContent = e?.message || String(e);
    msg.className   = 'daily-msg err';
  }

  btn.addEventListener('click', async () => {
    btn.disabled    = true;
    msg.textContent = '';
    msg.className   = 'daily-msg';
    try {
      const result    = await claimDaily();
      btn.textContent = `+${DAILY_AMOUNT} ⛁ reçus !`;
      msg.textContent = `Total or : ${result.gold} ⛁`;
      window.dispatchEvent(new CustomEvent('tcg:gold', { detail: { gold: result.gold } }));
      startCountdown(new Date(Date.now() + 24 * 60 * 60 * 1000));
    } catch (e) {
      btn.textContent = 'Déjà réclamé';
      msg.textContent = e?.message || String(e);
      msg.className   = 'daily-msg err';
      // Re-sync in case of clock drift
      try {
        const status = await getDailyStatus();
        if (!status.canClaim && status.nextClaimAt) startCountdown(status.nextClaimAt);
      } catch (_) {}
    }
  });
}
