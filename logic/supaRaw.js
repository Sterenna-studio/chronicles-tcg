// logic/supaRaw.js — minimal direct Supabase helper (fallback for shop buy)
import { url } from './paths.js';
let _client = null;
export async function getClient(){
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
export async function getUser(){
  const supabase = await getClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
