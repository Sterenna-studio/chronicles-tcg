function bust(url){ return `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`; }

export function renderPackShelf(root, packRows, { onOpen }) {
  root.innerHTML = '';
  const shelf = document.createElement('div');
  shelf.className = 'shelf';

  for (const row of packRows) {
    const btn = document.createElement('button');
    btn.className = 'pack-icon';
    btn.disabled = row.quantity <= 0;
    btn.title = `${row.pack_types.name} x${row.quantity}`;
    btn.style.backgroundImage = `url(${bust('/assets/packs/' + row.pack_types.image_name)})`;
    btn.addEventListener('click', () => onOpen(row.pack_types));
    shelf.appendChild(btn);
  }

  root.appendChild(shelf);
}

export function renderInventory(root, playerCardsCount) {
  const el = document.createElement('div');
  el.className = 'inventory';
  el.textContent = `Cartes possédées: ${playerCardsCount}`;
  root.appendChild(el);
}
