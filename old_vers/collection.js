import { requireLogin } from './tcg_auth.js';
import { loadPlayerCollection } from './supabaseData.js';

document.addEventListener('DOMContentLoaded', async () => {
  const user = await requireLogin();
  if (!user) return;
  const userId = user.id;

  // Current set selection
  let currentSet = 'bzh_set01';
  // Load initial data
  await loadAndRender(currentSet);

  // Set selector buttons
  document.querySelectorAll('.set-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (btn.classList.contains('disabled') || btn.classList.contains('active')) return;
      document.querySelector('.set-btn.active').classList.remove('active');
      btn.classList.add('active');
      currentSet = btn.dataset.set;
      await loadAndRender(currentSet);
    });
  });

  // Popup elements
  const popup = document.getElementById('cardPopup');
  const backdrop = popup.querySelector('.popup-backdrop');

  backdrop.addEventListener('click', () => popup.classList.add('hidden'));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') popup.classList.add('hidden');
  });

  async function loadAndRender(setId) {
    // Load player collection from supabase
    await loadPlayerCollection(userId);
    const owned = (window.collection || []).map(c => c.card_id);

    // Fetch card definitions JSON for this set
    const allCards = await fetch(`data/${setId}.json`).then(r => r.json());

    // Pagination
    const perPage = 10;
    let currentPage = 1;
    const totalPages = Math.ceil(allCards.length / perPage);

    // Elements
    const grid = document.getElementById('collectionGrid');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    const indicator = document.getElementById('pageIndicator');

    function renderPage(page) {
      currentPage = page;
      grid.innerHTML = '';
      const slice = allCards.slice((page - 1) * perPage, page * perPage);
      slice.forEach(card => {
        const slot = document.createElement('div');
        slot.className = 'card-slot';
        const sleeve = document.createElement('div');
        sleeve.className = 'card-sleeve';
        if (owned.includes(card.id)) sleeve.classList.add('unlocked');
        slot.appendChild(sleeve);

        if (owned.includes(card.id)) {
          const img = document.createElement('img');
          img.src = `artworks/${card.id}.jpg`;
          img.alt = card.name;
          img.className = 'card-thumb';
          sleeve.appendChild(img);
          slot.addEventListener('click', () => {
            document.getElementById('popupImg').src = img.src;
            document.getElementById('popupName').textContent = card.name;
            document.getElementById('popupType').textContent = card.type;
            document.getElementById('popupRarity').textContent = card.rarity;
            document.getElementById('popupDesc').textContent = card.desc;
            popup.classList.remove('hidden');
          });
        }

        const nameDiv = document.createElement('div');
        nameDiv.className = 'card-name';
        nameDiv.textContent = card.name;
        if (owned.includes(card.id)) nameDiv.classList.add('unlocked-name');
        slot.appendChild(nameDiv);

        grid.appendChild(slot);
      });

      indicator.textContent = `${currentPage} / ${totalPages}`;
      prevBtn.disabled = currentPage === 1;
      nextBtn.disabled = currentPage === totalPages;
    }

    prevBtn.onclick = () => renderPage(currentPage - 1);
    nextBtn.onclick = () => renderPage(currentPage + 1);

    renderPage(1);
  }
});
