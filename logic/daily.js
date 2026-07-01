// logic/daily.js — v2
// Source unique des récompenses journalières (login + widget).
// Paliers basés sur le streak : j1=+50, j2=+75, j3=+100, j4=+125, j5=+150, j6=+175, j7=+300 puis reset.
// Reset si le joueur a manqué plus d'un jour calendaire UTC.
// Source de vérité : streak/last_daily_at sur tcg_players, or sur profiles.chronicles.
import { getClient, getUser } from './supaRaw.js?v=24';

export const STREAK_REWARDS = [50, 75, 100, 125, 150, 175, 300];

/**
 * Retourne minuit UTC du jour courant (Date).
 */
function todayUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Minuit UTC du jour suivant — prochaine fenêtre de claim. */
function nextMidnightUTC() {
  const t = todayUTC();
  t.setUTCDate(t.getUTCDate() + 1);
  return t;
}

/**
 * Calcule le streak qu'aurait le prochain claim, vu le dernier claim.
 * @returns {number} nouveau streak (>=1)
 */
function nextStreak(lastAt, currentStreak, today) {
  if (!lastAt) return 1;
  const yesterday = new Date(today);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const lastDay = new Date(Date.UTC(lastAt.getUTCFullYear(), lastAt.getUTCMonth(), lastAt.getUTCDate()));
  return lastDay >= yesterday ? (currentStreak || 0) + 1 : 1;
}

/** Récompense (or) pour un streak donné. */
function rewardForStreak(streak) {
  return STREAK_REWARDS[(streak - 1) % 7];
}

/** Formate des millisecondes en HH:MM:SS. */
export function formatCountdown(ms) {
  if (ms <= 0) return '00:00:00';
  const s   = Math.floor(ms / 1000);
  const h   = Math.floor(s / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map(v => String(v).padStart(2, '0')).join(':');
}

/**
 * Affiche un toast léger dans le Bridge.
 * @param {string} msg
 */
function showDailyToast(msg) {
  let toast = document.getElementById('daily-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'daily-toast';
    Object.assign(toast.style, {
      position:      'fixed',
      bottom:        '24px',
      left:          '50%',
      transform:     'translateX(-50%) translateY(20px)',
      background:    'rgba(20,20,30,0.92)',
      color:         '#f0e6c8',
      border:        '1px solid rgba(255,220,100,0.25)',
      borderRadius:  '10px',
      padding:       '10px 20px',
      fontSize:      '0.85rem',
      fontWeight:    '600',
      letterSpacing: '0.02em',
      zIndex:        '9999',
      pointerEvents: 'none',
      opacity:       '0',
      transition:    'opacity 0.35s ease, transform 0.35s ease',
      whiteSpace:    'nowrap',
    });
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  requestAnimationFrame(() => {
    toast.style.opacity   = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
  });
  setTimeout(() => {
    toast.style.opacity   = '0';
    toast.style.transform = 'translateX(-50%) translateY(20px)';
  }, 3500);
}

/**
 * Vérifie et octroie la récompense journalière pour l'utilisateur connecté.
 * Doit être appelé après initPlayer() dans hub.js → init().
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @returns {Promise<{rewarded: boolean, amount: number, streak: number}>}
 */
export async function claimDailyReward(supabase, userId) {
  // Crédit VIA LE LEDGER (RPC claim_daily_login) : le trigger sync recalcule
  // profiles.chronicles = SUM(ledger), donc un crédit direct sur profiles serait
  // effacé à la prochaine opération ledger. Le streak reste géré côté serveur
  // sur tcg_players. (userId est conservé pour compat d'appel — l'RPC utilise auth.uid().)
  const { data, error } = await supabase.rpc('claim_daily_login');

  if (error || !data?.ok) {
    console.warn('[daily] claim_daily_login échec', error || data?.error);
    return { rewarded: false, amount: 0, streak: 0 };
  }

  if (!data.rewarded) {
    return { rewarded: false, amount: 0, streak: data.streak ?? 0, gold: data.balance ?? null };
  }

  const isSeventh = data.streak % 7 === 0;
  const dayLabel  = isSeventh ? `Jour ${data.streak} 🎉 BONUS` : `Jour ${data.streak}`;
  showDailyToast(`✦ +${data.amount} Chronicles · ${dayLabel}`);

  return { rewarded: true, amount: data.amount, streak: data.streak, gold: data.balance };
}

/**
 * Statut du daily pour l'utilisateur connecté (sans argument — utilisé par le widget).
 * @returns {Promise<{canClaim:boolean, nextClaimAt:Date|null, lastClaimAt:Date|null, streak:number, gold:number, nextReward:number}>}
 */
export async function getDailyStatus() {
  const sb   = await getClient();
  const user = await getUser();
  if (!user) throw new Error('Non connecté');

  const today = todayUTC();
  const [{ data: pl }, { data: prof }] = await Promise.all([
    sb.from('tcg_players').select('daily_streak, last_daily_at').eq('id', user.id).maybeSingle(),
    sb.from('profiles').select('chronicles').eq('id', user.id).maybeSingle(),
  ]);

  const lastClaimAt = pl?.last_daily_at ? new Date(pl.last_daily_at) : null;
  const canClaim    = !(lastClaimAt && lastClaimAt >= today);
  const streak      = pl?.daily_streak || 0;

  return {
    canClaim,
    nextClaimAt: canClaim ? null : nextMidnightUTC(),
    lastClaimAt,
    streak,
    gold: prof?.chronicles ?? 0,
    nextReward: rewardForStreak(nextStreak(lastClaimAt, streak, today)),
  };
}

/**
 * Réclame le daily pour l'utilisateur connecté (sans argument — utilisé par le widget).
 * Lève une erreur si déjà réclamé aujourd'hui.
 * @returns {Promise<{rewarded:boolean, amount:number, streak:number, gold:number}>}
 */
export async function claimDaily() {
  const sb   = await getClient();
  const user = await getUser();
  if (!user) throw new Error('Non connecté');

  const res = await claimDailyReward(sb, user.id);
  if (!res.rewarded) throw new Error('Déjà réclamé aujourd\'hui. Reviens demain.');
  return res;
}
