// logic/supaRaw.js — static Supabase helper
import { supabase } from '../shared/supabaseClient.js?v=8';

export async function getClient(){
  return supabase;
}

/**
 * @deprecated Utiliser sb.auth.getSession() directement pour garantir
 * la session avant tout appel rpc(). Cette fonction sera supprimée.
 */
export async function getUser(){
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function requireLogin(){
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Utilisateur non connecté');
  return user;
}
