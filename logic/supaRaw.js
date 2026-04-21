// logic/supaRaw.js
import { supabase as _sb } from '../shared/supabaseClient.js';
let _user = null;
export function getClient() { return _sb; }
export async function getUser() {
  if (_user) return _user;
  const { data: { user } } = await _sb.auth.getUser();
  _user = user;
  return user;
}
export function clearUserCache() { _user = null; }
