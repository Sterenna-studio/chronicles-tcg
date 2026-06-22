// logic/supaRaw.js — static Supabase helper
import { supabase } from '../shared/supabaseClient.js?v=3';

export async function getClient(){
  return supabase;
}

export async function getUser(){
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function requireLogin(){
  const user = await getUser();
  if (!user) {
    throw new Error('Utilisateur non connecté');
  }
  return user;
}
