// logic/supaRaw.js — moderne (ESM only)
import { url } from './paths.js';

let _client = null;

export async function getClient() {
  if (_client) return _client;
  try {
    const mod = await import(url('/shared/supabaseClient.js'));
    _client = mod.supabase || mod.client || mod.default || mod;
  } catch {
    const mod2 = await import('/shared/supabaseClient.js');
    _client = mod2.supabase || mod2.client || mod2.default || mod2;
  }
  return _client;
}

export async function getUser() {
  const supabase = await getClient();
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user || null;
  } catch (e) {
    console.warn('getUser error:', e);
    return null;
  }
}

export async function requireLogin() {
  let user = null;
  try {
    user = await getUser();
  } catch (e) {
    console.warn('Erreur getUser dans requireLogin:', e);
  }

  if (!user && typeof window !== 'undefined') {
    window.location.href = '/base/login.html';
  }
}

console.info('[supaRaw.js moderne] loaded');
