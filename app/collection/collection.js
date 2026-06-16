// lab/tcg/app/collection/collection.js — simple collection viewer (placeholder)
import { getCollection } from '../../shared/packsRepo.js';

export async function renderCollection(root, { setId='BZH01' } = {}) {
  const rows = await getCollection({ setId });
  root.innerHTML = '<h2>Collection</h2><div id="col-grid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(140px,1fr)); gap:10px;"></div>';
  const grid = document.getElementById('col-grid');
  for (const r of rows) {
    const div = document.createElement('div');
    div.style.cssText = 'border:1px solid #333; padding:8px; border-radius:10px; color:#ddd;';
    div.innerHTML = `<div><b>${r.card_id}</b></div><div>Qty: ${r.qty}</div>`;
    grid.appendChild(div);
  }
}
