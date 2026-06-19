// data/dailyRepo.js — v1.0.0
// Daily gold claim: 24h cooldown, +50 gold
import { getClient, getUser } from '../logic/supaRaw.js';

export const DAILY_AMOUNT     = 50;
export const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * Returns { canClaim, nextClaimAt, lastClaimAt, gold }
 */
export async function getDailyStatus() {
  const sb   = await getClient();
  const user = await getUser();
  if (!user) throw new Error('Non connecté');

  const { data, error } = await sb
    .from('tcg_players')
    .select('chronicles, last_daily_at')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;

  const lastClaimAt = data?.last_daily_at ? new Date(data.last_daily_at) : null;
  const now         = Date.now();
  const elapsed     = lastClaimAt ? now - lastClaimAt.getTime() : Infinity;
  const canClaim    = elapsed >= DAILY_COOLDOWN_MS;
  const nextClaimAt = lastClaimAt
    ? new Date(lastClaimAt.getTime() + DAILY_COOLDOWN_MS)
    : null;

  return { canClaim, nextClaimAt, lastClaimAt, gold: data?.chronicles ?? 0 };
}

/**
 * Claims daily gold. Throws if on cooldown or not logged in.
 * Returns { gold } — new total.
 */
export async function claimDaily() {
  const sb   = await getClient();
  const user = await getUser();
  if (!user) throw new Error('Non connecté');

  const { data, error: fetchErr } = await sb
    .from('tcg_players')
    .select('chronicles, last_daily_at')
    .eq('id', user.id)
    .maybeSingle();
  if (fetchErr) throw fetchErr;

  const lastClaimAt = data?.last_daily_at ? new Date(data.last_daily_at) : null;
  const elapsed     = lastClaimAt ? Date.now() - lastClaimAt.getTime() : Infinity;
  if (elapsed < DAILY_COOLDOWN_MS) {
    const rem = DAILY_COOLDOWN_MS - elapsed;
    throw new Error(`Déjà réclamé. Reviens dans ${formatCountdown(rem)}.`);
  }

  const newGold = (data?.chronicles ?? 0) + DAILY_AMOUNT;
  const { error: updateErr } = await sb
    .from('tcg_players')
    .update({ chronicles: newGold, last_daily_at: new Date().toISOString() })
    .eq('id', user.id);
  if (updateErr) throw updateErr;

  return { gold: newGold };
}

/** Formats milliseconds to HH:MM:SS */
export function formatCountdown(ms) {
  if (ms <= 0) return '00:00:00';
  const s   = Math.floor(ms / 1000);
  const h   = Math.floor(s / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map(v => String(v).padStart(2, '0')).join(':');
}
