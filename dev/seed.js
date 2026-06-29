// Use the shared supabase data layer for seeding rather than the local mocks.
import { initPlayer, loadPackTypes } from '../data/supabaseData.js?v=14';

const out = document.getElementById('out');
document.getElementById('seed').onclick = async () => {
  const player = await initPlayer();
  const packTypes = await loadPackTypes();
  if (!packTypes.length) {
    out.textContent = 'Aucun pack type — assure /data/pack_types.local.json ou localStorage.tcg_pack_types';
    return;
  }
  const map = JSON.parse(localStorage.getItem('tcg_player_packs') || '{}');
  const row = (map[player.id] ||= {});
  for (const pt of packTypes) {
    row[pt.id] = 3;
  }
  localStorage.setItem('tcg_player_packs', JSON.stringify(map));
  out.textContent = 'OK — 3 packs par type attribués.';
};
