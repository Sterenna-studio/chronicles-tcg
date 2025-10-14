import { supabase } from './shared/supabaseClient.js';

export async function requireLogin(redirect = '/base/login.html') {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) { window.location.href = redirect; return null; }
  return session.user;
}

export async function logout(redirect = '/base/login.html') {
  await supabase.auth.signOut();
  window.location.href = redirect;
}
