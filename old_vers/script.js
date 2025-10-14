import { requireLogin } from './tcg_auth.js';
import {
  initPlayer,
  loadPlayerCollection,
  savePlayerData,
  addCardsBatch,
  loadPackTypes
} from './supabaseData.js';
import store from './store.js';

const usernameDisplay = document.getElementById('usernameDisplay');
const shelf = document.querySelector('.shelf');
const cardStack = document.getElementById('cardStack');
const openedCards = document.getElementById('openedCards');
const nextCardContainer = document.getElementById('nextCardContainer');
const newPackBtn = document.getElementById('newPackBtn');
const nextCardBtn = document.getElementById('nextCardBtn');
const collectionBtn = document.getElementById('collectionBtn');
const shopButtons = document.getElementById('shopButtons');
const shopMessage = document.getElementById('shopMessage');
const packCountEl = document.getElementById('packCount');
const revealedCountEl = document.getElementById('revealedCount');
const collectionCountEl = document.getElementById('collectionCount');
const goldCountEl = document.getElementById('goldCount');

let cardsSample = [];
let pack = [];
let currentIndex = 0;
let totalRevealed = 0;
let userId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const user = await requireLogin();
  if (!user) return;
  userId = await initPlayer(user);
  await loadPlayerCollection(userId);
  const packTypes = await loadPackTypes();
  cardsSample = await fetch('data/bzh_set01.json').then(r => r.json());

  store.set({
    username: window.currentUsername,
    totalGold: window.totalGold,
    totalPacks: window.totalPacks,
    collection: window.collection,
    packTypes
  });

  store.subscribe(state => {
    usernameDisplay.textContent = state.username;
    goldCountEl.textContent = state.totalGold;
    packCountEl.textContent = state.totalPacks;
    revealedCountEl.textContent = totalRevealed;
    collectionCountEl.textContent = state.collection.reduce((a,c)=>a+c.quantity,0);
    renderShelf();
  });

  newPackBtn.classList.remove('hidden');
  renderShop();

  newPackBtn.addEventListener('click', () => {
    if (store.get('totalPacks')>0) openRandomShelfPack();
    else shopMessage.textContent='Plus de packs!';
  });
  nextCardBtn.addEventListener('click', () => currentIndex<pack.length?revealCard():sendToAlbum());
  collectionBtn.addEventListener('click', ()=>location.href='collection.html');
});

function renderShop() {
  shopButtons.innerHTML='';
  store.get('packTypes')
    .filter(pt=>pt.name!=='Classique')
    .forEach(pt=>{
      const btn=document.createElement('button');
      btn.textContent=`Acheter ${pt.name} — ${pt.price}G`;
      btn.onclick=()=>buyDynamicPack(pt);
      shopButtons.appendChild(btn);
    });
}

async function buyDynamicPack(pt) {
  if(store.get('totalGold')<pt.price){shopMessage.textContent='Pas assez de gold';return;}
  store.set({ totalGold:store.get('totalGold')-pt.price, totalPacks:store.get('totalPacks')+1 });
  await savePlayerData(userId);
  shopMessage.textContent=`+1 ${pt.name}`;setTimeout(()=>shopMessage.textContent='',2000);
}

function renderShelf() {
  shelf.innerHTML='';
  for(let i=0;i<store.get('totalPacks');i++){
    const img=document.createElement('img');
    img.src='assets/pack.jpg';img.className='pack-icon';img.dataset.idx=i;
    img.onclick=()=>openShelfPack(i);
    shelf.appendChild(img);
  }
  const album=document.createElement('img');
  album.id='albumIcon';album.src='assets/album.jpg';
  album.onclick=()=>location.href='collection.html';
  shelf.appendChild(album);
}

function openShelfPack(idx) {
  document.body.classList.add('blurred');
  store.set({ totalPacks:store.get('totalPacks')-1 });
  pack=generateClassicPack(); openPack(pack);
}

function generateClassicPack(){
  const arr=[]; while(arr.length<5){
    const c=randomFrom(cardsSample); if(!arr.find(x=>x.id===c.id))arr.push(c);
  }
  const leg=cardsSample.filter(c=>c.rarity==='Legendary');
  arr.push(randomFrom(leg)); return arr;
}

function openPack(cards){
  pack=cards; currentIndex=0; totalRevealed=0;
  cardStack.innerHTML=''; openedCards.innerHTML='';
  newPackBtn.classList.add('hidden'); nextCardContainer.classList.remove('hidden');
  nextCardBtn.textContent='Carte suivante';
  cards.forEach((_,i)=>{
    const back=document.createElement('div'); back.className='card';
    const dx=Math.random()*20-10, dy=Math.random()*20-10, rt=Math.random()*30-15;
    back.style.top=`${i*2+dy}px`;back.style.left=`${i*2+dx}px`;back.style.transform=`rotate(${rt}deg)`;
    cardStack.appendChild(back);
  });
}

function revealCard(){
  const back=cardStack.lastChild;back.remove();
  const data=pack[currentIndex];
  new Audio(`sounds/${data.rarity.toLowerCase()}.mp3`).play();
  const cont=document.createElement('div');cont.className='card-container';
  const tx=Math.random()*40-20, ty=Math.random()*40-20, rt=Math.random()*20-10;
  cont.style.transform=`translate(${tx}px,${ty}px) rotate(${rt}deg)`;
  if(['legendary','mythical'].includes(data.rarity.toLowerCase()))cont.classList.add('shake');
  const front=document.createElement('div');front.className=`card-front ${data.rarity.toLowerCase()}`;
  front.innerHTML=`<img src="artworks/${data.id}.jpg" alt="${data.name}"><div class="rarity-badge">${data.rarity}</div><div class="card-title">${data.name}</div><div class="card-desc">${data.desc}</div>`;
  cont.appendChild(front);openedCards.appendChild(cont);setTimeout(()=>cont.classList.add('flip'),50);
  currentIndex++; totalRevealed++; if(currentIndex===pack.length)nextCardBtn.textContent='Ranger mes cartes';
  revealedCountEl.textContent=totalRevealed;
}

async function sendToAlbum(){
  Array.from(openedCards.children).forEach((el,i)=>setTimeout(()=>el.classList.add('send-to-inventory'),i*100));
  setTimeout(async()=>{
    await addCardsBatch(userId,pack.map(c=>c.id));
    await savePlayerData(userId);
    const col=await loadPlayerCollection(userId); store.set({collection:col});
    openedCards.innerHTML='';cardStack.innerHTML='';
    nextCardContainer.classList.add('hidden');newPackBtn.classList.remove('hidden');
    document.body.classList.remove('blurred');
  },800);
}

function randomFrom(arr){return arr[Math.floor(Math.random()*arr.length)];}
