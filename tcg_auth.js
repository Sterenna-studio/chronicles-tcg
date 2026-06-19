// Use the shared Supabase client through the supaRaw helper.  This avoids
// duplicating Supabase configuration in the tcg_beta folder.  See
// lab/shared/supaRaw.js for details.
import { getClient } from '../shared/supaRaw.js'

export async function requireLogin(redirect = '../lab/login.html') {
  const sb = await getClient();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    window.location.href = redirect;
    return null;
  }
  return session.user;
}

export async function getUser() {
  const sb = await getClient();
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

export async function logout() {
  const sb = await getClient();
  await sb.auth.signOut();
  window.location.href = '../lab/login.html';
}
