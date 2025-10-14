// script.js
import { requireLogin } from './tcg_auth.js';
import {
  initPlayer,
  loadPlayerCollection,
  savePlayerData,
  addCardsBatch,
  loadPlayerPacks,
  decrementPlayerPack
} from './supabaseData.js';
import store from './store.js';

const usernameDisplay   = document.getElementById('usernameDisplay');
const shelf             = document.querySelector('.shelf');
const cardStack         = document.getElementById('cardStack');
const openedCards       = document.getElementById('openedCards');
const nextCardContainer = document.getElementById('nextCardContainer');
const newPackBtn        = document.getElementById('newPackBtn');
const nextCardBtn       = document.getElementById('nextCardBtn');
const collectionBtn     = document.getElementById('collectionBtn');
const revealedCountEl   = document.getElementById('revealedCount');
const collectionCountEl = document.getElementById('collectionCount');
const goldCountEl       = document.getElementById('goldCount');

let cardsSample = [];
let pack         = [];
let currentIndex = 0;
let totalRevealed = 0;
let userId       = null;

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Authentification et initialisation du joueur
  const user = await requireLogin();
  if (!user) return;
  userId = await initPlayer(user);

  // 2. Chargement de la collection et des packs du joueur
  await loadPlayerCollection(userId);
  const playerPacks = await loadPlayerPacks(userId);

  // 3. Chargement par défaut du premier set
  cardsSample = await fetch('data/bzh_set01.json').then(r => r.json());

  // 4. Initialisation du store
  store.set({
    username:    window.currentUsername,
    totalGold:   window.totalGold,
    playerPacks,
    collection:  window.collection
  });

  // 5. Abonnement pour mise à jour UI
  store.subscribe(state => {
    usernameDisplay.textContent   = state.username;
    goldCountEl.textContent       = state.totalGold;
    collectionCountEl.textContent = state.collection.reduce((a,c)=>a+c.quantity,0);
    revealedCountEl.textContent   = totalRevealed;
    renderShelf(state.playerPacks);
  });

  // 6. Affiche le bouton d’ouverture
  newPackBtn.classList.remove('hidden');

  // 7. Gestion des événements
  newPackBtn.onclick    = openRandomShelfPack;
  nextCardBtn.onclick   = () => currentIndex < pack.length ? revealCard() : sendToAlbum();
  collectionBtn.onclick = () => window.location.href = 'collection.html';
});

/**
 * Affiche l’étagère de packs, intercalant les sets.
 */
function renderShelf(packs) {
  shelf.innerHTML = '';
  // Grouper par set_id
  const grouped = {};
  packs.forEach(p => {
    (grouped[p.set_id] = grouped[p.set_id]||[]).push({...p});
  });
  const sets = Object.keys(grouped).sort();
  const icons = [];
  let more;
  do {
    more = false;
    for (const set of sets) {
      const arr = grouped[set];
      if (arr.length && arr[0].quantity > 0) {
        icons.push(arr[0]);
        arr[0].quantity--;
        more = true;
      }
    }
  } while (more);

  // Crée chaque icône
  icons.forEach(p => {
    const img = document.createElement('img');
    img.src       = `assets/packs/${p.image_name}`;
    img.className = 'pack-icon';
    img.title     = p.name;
    img.onclick   = () => openShelfPack(p);
    shelf.appendChild(img);
  });

  // Icône album
  const album = document.createElement('img');
  album.id      = 'albumIcon';
  album.src     = 'assets/album.jpg';
  album.onclick = () => window.location.href = 'collection.html';
  shelf.appendChild(album);
}

/** Ouvre un pack au hasard depuis l’étagère */
function openRandomShelfPack() {
  const icons = shelf.querySelectorAll('.pack-icon');
  if (!icons.length) return;
  icons[Math.floor(Math.random()*icons.length)].click();
}

/**
 * Ouvre un pack spécifique et décompte en base.
 */
async function openShelfPack(p) {
  document.body.classList.add('blurred');

  // Décrémente la QTE en base puis recharge
  await decrementPlayerPack(userId, p.pack_type_id);
  const updated = await loadPlayerPacks(userId);
  store.set({ playerPacks: updated });

  // Charge le dataset correspondant au set
  cardsSample = await fetch(`data/${p.set_id}.json`).then(r=>r.json());

  // Génère et affiche le pack
  pack = createPackFromType(p);
  displayPack(pack);
}

/**
 * Génère un tableau de cartes selon la config du pack.
 */
function createPackFromType(pt) {
  const result = [];
  const seen = new Set();

  // Garanties
  if (pt.require_champion)  addOne(c => c.type==='Champion');
  if (pt.require_epic)      addOne(c => c.rarity==='Epic');
  if (pt.require_legendary) addOne(c => c.rarity==='Legendary');
  if (pt.require_mythical)  addOne(c => c.rarity==='Mythical');

  // Remplissage
  while (result.length < pt.card_count) {
    const c = randomFrom(cardsSample);
    if (!seen.has(c.id)) { seen.add(c.id); result.push(c); }
  }

  return result;

  function addOne(fn) {
    const pool = cardsSample.filter(fn);
    if (pool.length) {
      const c = randomFrom(pool);
      if (!seen.has(c.id)) { seen.add(c.id); result.push(c); }
    }
  }
}

/** Affiche les dos de cartes prêts à être révélés */
function displayPack(cards) {
  pack = cards;
  currentIndex = 0;
  totalRevealed = 0;

  cardStack.innerHTML = '';
  openedCards.innerHTML = '';
  nextCardContainer.classList.remove('hidden');
  newPackBtn.classList.add('hidden');
  nextCardBtn.textContent = 'Carte suivante';

  cards.forEach((_, i) => {
    const back = document.createElement('div');
    back.className = 'card';
    const dx = Math.random()*20 - 10;
    const dy = Math.random()*20 - 10;
    const rt = Math.random()*30 - 15;
    back.style.top       = `${i*2 + dy}px`;
    back.style.left      = `${i*2 + dx}px`;
    back.style.transform = `rotate(${rt}deg)`;
    cardStack.appendChild(back);
  });
}

/** Révèle une carte */
function revealCard() {
  const back = cardStack.lastElementChild; back.remove();
  const data = pack[currentIndex];
  new Audio(`sounds/${data.rarity.toLowerCase()}.mp3`).play();

  const cont = document.createElement('div');
  cont.className = 'card-container';
  const tx = Math.random()*40 - 20;
  const ty = Math.random()*40 - 20;
  const rt = Math.random()*20 - 10;
  cont.style.transform = `translate(${tx}px, ${ty}px) rotate(${rt}deg)`;

  if (['legendary','mythical'].includes(data.rarity.toLowerCase())) {
    cont.classList.add('shake');
  }

  const front = document.createElement('div');
  front.className = `card-front ${data.rarity.toLowerCase()}`;
  front.innerHTML = `
    <img src="artworks/${data.id}.jpg" alt="${data.name}">
    <div class="rarity-badge">${data.rarity}</div>
    <div class="card-title">${data.name}</div>
    <div class="card-desc">${data.desc}</div>
  `;
  cont.appendChild(front);
  openedCards.appendChild(cont);
  setTimeout(() => cont.classList.add('flip'), 50);

  currentIndex++;
  totalRevealed++;
  revealedCountEl.textContent = totalRevealed;

  if (currentIndex === pack.length) {
    nextCardBtn.textContent = 'Ranger mes cartes';
  }
}

/** Envoie les cartes révélées dans la collection (batch RPC) */
async function sendToAlbum() {
  Array.from(openedCards.children).forEach((el, i) =>
    setTimeout(() => el.classList.add('send-to-inventory'), i*100)
  );

  setTimeout(async () => {
    await addCardsBatch(userId, pack.map(c => c.id));
    await loadPlayerCollection(userId);
    store.set({ collection: window.collection });

    nextCardContainer.classList.add('hidden');
    newPackBtn.classList.remove('hidden');
    document.body.classList.remove('blurred');
  }, 800);
}

/** Helper aléatoire */
function randomFrom(arr) {
  return arr[Math.floor(Math.random()*arr.length)];
}
