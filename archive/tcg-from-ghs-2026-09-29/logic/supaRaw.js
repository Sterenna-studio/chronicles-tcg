// TCG/logic/supaRaw.js
import { supabase } from '../shared/supabaseClient.js';
import { getUser as nitroGetUser, getSession } from '/shared/auth.js';
import { getProfile, getDisplayNameFromUser } from '/shared/profile.js';

export async function getClient() {
  return supabase;
}

export async function getUser() {
  return await nitroGetUser();
}

export async function getSession_() {
  return await getSession();
}

// Retourne { user, profile, displayName }
export async function getAgentInfo() {
  const user = await getUser();
  if (!user) return { user: null, profile: null, displayName: 'Agent invité' };
  const profile = await getProfile(user.id);
  const displayName = getDisplayNameFromUser(user, profile);
  return { user, profile, displayName };
}

export async function requireLogin() {
  const user = await getUser();
  if (!user) throw new Error('Non connecté — redirection login');
  return user;
}
