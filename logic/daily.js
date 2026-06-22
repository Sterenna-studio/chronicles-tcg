// logic/daily.js — v1
// Récompenses journalières au login, basées sur le streak.
// Paliers : j1=+50, j2=+75, j3=+100, j4=+125, j5=+150, j6=+175, j7=+300 puis reset.
// Reset si le joueur a manqué plus d'un jour calendaire UTC.

const STREAK_REWARDS = [50, 75, 100, 125, 150, 175, 300];

/**
 * Retourne minuit UTC du jour courant (Date).
 */
function todayUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
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
  const today = todayUTC();

  const { data: pl, error } = await supabase
    .from('tcg_players')
    .select('daily_streak, last_daily_at')
    .eq('id', userId)
    .single();

  if (error || !pl) {
    console.warn('[daily] lecture joueur échouée', error);
    return { rewarded: false, amount: 0, streak: 0 };
  }

  const lastAt = pl.last_daily_at ? new Date(pl.last_daily_at) : null;

  // Déjà claimé aujourd'hui ?
  if (lastAt && lastAt >= today) {
    return { rewarded: false, amount: 0, streak: pl.daily_streak };
  }

  // Calcul du nouveau streak
  let newStreak;
  if (!lastAt) {
    newStreak = 1;
  } else {
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const lastDay = new Date(Date.UTC(
      lastAt.getUTCFullYear(),
      lastAt.getUTCMonth(),
      lastAt.getUTCDate()
    ));
    newStreak = lastDay >= yesterday ? (pl.daily_streak || 0) + 1 : 1;
  }

  const idx       = (newStreak - 1) % 7;
  const reward    = STREAK_REWARDS[idx];
  const isSeventh = newStreak % 7 === 0;

  // Crédite sur profiles.chronicles (source de vérité)
  const { data: prof } = await supabase.from('profiles').select('chronicles').eq('id', userId).single();
  const [{ error: profErr }, { error: updateErr }] = await Promise.all([
    supabase.from('profiles').update({ chronicles: (prof?.chronicles || 0) + reward }).eq('id', userId),
    supabase.from('tcg_players').update({ daily_streak: newStreak, last_daily_at: new Date().toISOString() }).eq('id', userId),
  ]);

  if (profErr || updateErr) {
    console.warn('[daily] mise à jour échouée', profErr || updateErr);
    return { rewarded: false, amount: 0, streak: pl.daily_streak };
  }

  const dayLabel = isSeventh ? `Jour ${newStreak} 🎉 BONUS` : `Jour ${newStreak}`;
  showDailyToast(`✦ +${reward} Chronicles · ${dayLabel}`);

  return { rewarded: true, amount: reward, streak: newStreak };
}
