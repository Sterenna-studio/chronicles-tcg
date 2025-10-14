function bust(url){ return `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`; }

export function renderShop(root, { packTypes, quantities, gold, onAdd, onCheckout }) {
  root.innerHTML = '';

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';
  header.style.margin = '8px 0 12px 0';

  const goldEl = document.createElement('div');
  goldEl.textContent = `Or: ${gold}`;
  header.appendChild(goldEl);

  const cartBar = document.createElement('div');
  cartBar.style.display = 'flex';
  cartBar.style.gap = '8px';
  const countEl = document.createElement('span');
  const totalEl = document.createElement('span');
  const btnCheckout = document.createElement('button');
  btnCheckout.textContent = 'Acheter le panier';
  btnCheckout.onclick = onCheckout;
  cartBar.append(countEl, totalEl, btnCheckout);
  header.appendChild(cartBar);

  const grid = document.createElement('div');
  grid.className = 'shelf';

  for (const pt of packTypes) {
    const card = document.createElement('div');
    card.style.border = '1px solid #30363d';
    card.style.borderRadius = '12px';
    card.style.padding = '8px';
    card.style.background = '#0e1116';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '8px';

    const art = document.createElement('div');
    art.className = 'pack-icon';
    art.style.height = '140px';
    art.style.backgroundImage = `url(${bust('/assets/packs/' + pt.image_name)})`;
    card.appendChild(art);

    const title = document.createElement('div');
    title.textContent = pt.name;
    title.style.fontWeight = '600';
    card.appendChild(title);

    const meta = document.createElement('div');
    meta.style.fontSize = '12px';
    meta.style.opacity = '0.8';
    meta.textContent = `${pt.card_count} cartes • set: ${pt.set_id}`;
    card.appendChild(meta);

    const flags = document.createElement('div');
    flags.style.display = 'flex';
    flags.style.flexWrap = 'wrap';
    flags.style.gap = '6px';
    function badge(label){
      const b = document.createElement('span');
      b.textContent = label;
      b.style.fontSize = '11px';
      b.style.border = '1px solid #30363d';
      b.style.borderRadius = '999px';
      b.style.padding = '2px 6px';
      b.style.opacity = '0.9';
      return b;
    }
    if (pt.require_champion) flags.appendChild(badge('Champion'));
    if (pt.require_epic) flags.appendChild(badge('≥ 1 Epic'));
    if (pt.require_legendary) flags.appendChild(badge('≥ 1 Legendary'));
    if (pt.require_mythical) flags.appendChild(badge('≥ 1 Mythical'));
    card.appendChild(flags);

    const qty = quantities.get(pt.id) || 0;
    const qtyEl = document.createElement('div');
    qtyEl.style.fontSize = '12px';
    qtyEl.style.opacity = '0.8';
    qtyEl.textContent = `Possédé: ${qty}`;
    card.appendChild(qtyEl);

    const bar = document.createElement('div');
    bar.style.display = 'flex';
    bar.style.alignItems = 'center';
    bar.style.justifyContent = 'space-between';
    const priceEl = document.createElement('div');
    priceEl.textContent = `${pt.price} or`;
    const btn = document.createElement('button');
    btn.textContent = 'Ajouter au panier';
    btn.onclick = () => onAdd(pt);
    bar.append(priceEl, btn);
    card.appendChild(bar);

    grid.appendChild(card);
  }

  function refreshCartBar(){
    try {
      const st = JSON.parse(localStorage.getItem('tcg_ui_state') || '{}');
      const items = st.cart?.items || {};
      let count = 0, total = 0;
      for (const { pt, qty } of Object.values(items)) {
        count += qty;
        total += (pt?.price || 0) * qty;
      }
      countEl.textContent = `Panier: ${count} packs`;
      totalEl.textContent = `Total: ${total} or`;
      btnCheckout.disabled = total === 0 || gold < total;
    } catch {
      countEl.textContent = `Panier: 0`;
      totalEl.textContent = `Total: 0 or`;
      btnCheckout.disabled = true;
    }
  }
  refreshCartBar();

  root.append(header, grid);
}
