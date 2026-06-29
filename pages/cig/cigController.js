// pages/cig/cigController.js — v5
import { getClient, getUser } from '../../logic/supaRaw.js?v=15';
import { initPlayer, getDisplayName } from '../../data/supabaseData.js?v=15';

(async function run() {
  try {
    const supabase = await getClient();
    const user = await getUser();
    await initPlayer(supabase, user);
    const name = getDisplayName();
    const el = document.querySelector('[data-cig-username]');
    if (el) el.textContent = name;
  } catch (e) {}
})();
