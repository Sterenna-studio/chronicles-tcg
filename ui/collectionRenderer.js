function bust(url){ return `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`; }
function setBgWithFallback(el, url, fallback) {
  const u = bust(url);
  const f = bust(fallback);
  const img = new Image();
  img.onload = () => { el.style.backgroundImage = `url(${u})`; };
  img.onerror = () => { el.style.backgroundImage = `url(${f})`; };
  img.src = u;
}

export function renderCollection(root, { setCards, ownedMap, perPage = 16, onCardClick }) {
  root.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'collection-grid';

  const pages = Math.max(1, Math.ceil(setCards.length / perPage));
  let page = 1;

  function drawPage() {
    grid.innerHTML = '';
    const start = (page - 1) * perPage;
    const slice = setCards.slice(start, start + perPage);
    for (const c of slice) {
      const has = (ownedMap.get(c.id) ?? 0) > 0;
      const slot = document.createElement('div');
      slot.className = `sleeve ${has ? 'owned' : 'missing'}`;
      if (has) setBgWithFallback(slot, `/artworks/${c.id}.jpg`, '/assets/card_back.png');
      slot.addEventListener('click', () => onCardClick(c));
      const label = document.createElement('div');
      label.className = 'label';
      label.textContent = c.name;
      slot.appendChild(label);
      grid.appendChild(slot);
    }
  }

  const pagination = document.createElement('div');
  pagination.className = 'pagination';
  const prev = document.createElement('button'); prev.textContent = '‹';
  const next = document.createElement('button'); next.textContent = '›';
  const info = document.createElement('span');
  function updInfo(){ info.textContent = `${page}/${pages}`; }

  prev.onclick = () => { page = Math.max(1, page - 1); drawPage(); updInfo(); };
  next.onclick = () => { page = Math.min(pages, page + 1); drawPage(); updInfo(); };

  pagination.append(prev, info, next);

  const modal = document.createElement('div'); modal.className = 'modal hidden';
  const sheet = document.createElement('div'); sheet.className = 'card-sheet';
  modal.appendChild(sheet);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  function open(c) {
    sheet.innerHTML = `
      <div class="art" style="background-image:url(${bust('/artworks/' + c.id + '.jpg')})"></div>
      <div class="meta">
        <h3>${c.name}</h3>
        <p><b>Type:</b> ${c.type} &nbsp;&nbsp; <b>Rareté:</b> ${c.rarity}</p>
        <p>${c.desc ?? ''}</p>
      </div>`;
    modal.classList.remove('hidden');
  }
  function close(){ modal.classList.add('hidden'); }
  window.addEventListener('keydown', (e)=>{ if (e.key === 'Escape') close(); });

  root.append(grid, pagination, modal);
  drawPage(); updInfo();

  return { openCard: open, closeCard: close };
}
