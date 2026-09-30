// lab/tcg/pages/albumPage.js — hotfix keep header height
import { getCollection } from '../../shared/packsRepo.js';
import { cardArtworkUrl } from '../../shared/assetHelpers.js';

const PER_PAGE = 6;
const COVER_URL = '/lab/shared/assets/ui/album.jpg';
const BACK_URL  = '/lab/shared/assets/ui/card_back.png';

export async function render(root){
  const topbar = document.querySelector('.ui-topbar, header, .topbar, #topbar');
  const h = topbar ? topbar.offsetHeight : 64;
  document.documentElement.style.setProperty('--album-available-h', `calc(100vh - ${h}px)`);

  root.innerHTML = `
    <style>
      .album-wrap { color:#dfe; height:var(--album-available-h, 100vh); overflow:hidden; display:flex; flex-direction:column; }
      .album-head { display:flex; gap:12px; align-items:center; margin-bottom:12px; }
      .album-title { font-family:monospace; color:#8df; display:flex; align-items:center; gap:8px; }
      .v-arrows { display:flex; flex-direction:column; gap:2px; }
      .btn-mini { width:24px; height:20px; border:1px solid #335; background:#0d1620; color:#def; border-radius:6px; cursor:pointer; line-height:18px; text-align:center; }
      .spread { flex:1; display:grid; grid-template-columns: 1fr 1fr; gap:18px; align-items:stretch; perspective:1200px; min-height:0; }
      .page { height:100%; aspect-ratio: calc((3 * var(--card-ar, 0.711)) / 2); border-radius:16px; border:1px solid #234; background:linear-gradient(#0a1018,#070b11); overflow:hidden; transform-style:preserve-3d; position:relative; }
      .left  { transform:rotateY(7deg);  box-shadow:inset 12px 0 24px rgba(0,0,0,.35); }
      .right { transform:rotateY(-7deg); box-shadow:inset -12px 0 24px rgba(0,0,0,.35); }
      .grid { display:grid; grid-template-columns:repeat(3, 1fr); gap:16px; padding:16px; box-sizing:border-box; height:100%; }
      .slot { position:relative; width:100%; aspect-ratio: var(--card-ar, 0.711); border-radius:14px; border:1px solid #234; background:#0a1018; overflow:hidden; }
      .slot img.card { width:100%; height:100%; object-fit:cover; filter:contrast(1.05) brightness(.98); }
      .slot.empty { display:grid; place-items:center; color:#224; }
      .slot .glass { position:absolute; inset:0; background:linear-gradient(120deg, rgba(255,255,255,.06), rgba(255,255,255,0) 40%, rgba(255,255,255,.08)); pointer-events:none; }
      .cover { position:relative; width:100%; height:100%; }
      .cover img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
      .cover .overlay { position:absolute; inset:0; background:linear-gradient(180deg, rgba(0,0,0,.15), rgba(0,0,0,.55)); display:flex; align-items:flex-end; padding:16px; color:#dfe; }
      .controls { text-align:center; margin-top:12px; display:flex; justify-content:center; gap:12px; }
      @media (max-width: 1100px){ .spread { grid-template-columns: 1fr; } }
    </style>
    <section class="album-wrap">
      <div class="album-head">
        <div class="album-title">
          <span style="font-size:20px; letter-spacing:2px;">BZH0</span>
          <div class="v-arrows">
            <button id="set-inc" class="btn-mini">▲</button>
            <button id="set-dec" class="btn-mini">▼</button>
          </div>
          <span id="set-num" style="font-size:20px;">1</span>
        </div>
      </div>
      <div id="spread" class="spread"></div>
      <div class="controls">
        <button id="prev" class="btn-mini">◀︎</button>
        <div id="spread-label" style="opacity:.85"></div>
        <button id="next" class="btn-mini">▶︎</button>
      </div>
    </section>
  `;

  const ratio = await getBackRatio();
  document.documentElement.style.setProperty("--card-ar", String(ratio));

  let setNum = 1;
  let rows = [];
  let spreadIndex = 0;

  const spreadEl  = root.querySelector('#spread');
  const setLabel  = root.querySelector('#set-num');
  const spLabel   = root.querySelector('#spread-label');

  async function load(){
    rows = await getCollection({ setId: `BZH0${setNum}` });
    spreadIndex = 0;
    setLabel.textContent = String(setNum);
    renderSpread();
  }

  function totalCardPages(){ return Math.max(1, Math.ceil(rows.length / PER_PAGE)); }
  function totalSpreads(){ return 1 + Math.ceil(totalCardPages() / 2); }

  function renderSpread(){
    spreadEl.innerHTML = '';
    const spreads = totalSpreads();
    spLabel.textContent = `Double page ${spreadIndex+1} / ${spreads}`;

    const left = document.createElement('div');  left.className = 'page left';
    const right = document.createElement('div'); right.className = 'page right';

    if (spreadIndex === 0){
      left.style.visibility = 'hidden';
      right.appendChild(renderCover());
    } else {
      const leftPageNum  = (spreadIndex-1)*2 + 1;
      const rightPageNum = leftPageNum + 1;
      left.appendChild(renderCardsPage(leftPageNum));
      right.appendChild(renderCardsPage(rightPageNum));
    }

    spreadEl.appendChild(left);
    spreadEl.appendChild(right);
  }

  function renderCover(){
    const box = document.createElement('div');
    box.className = 'cover';
    box.innerHTML = `
      <img src="${COVER_URL}" alt="Couverture"/>
      <div class="overlay">
        <div>
          <div style="font-size:22px;font-weight:700;">Album — BZH0${setNum}</div>
          <div style="opacity:.85">Chaque page contient ${PER_PAGE} cartes.</div>
        </div>
      </div>`;
    return box;
  }

  function renderCardsPage(pageNum){
    const start = (pageNum-1)*PER_PAGE;
    const slice = rows.slice(start, start+PER_PAGE);
    const grid = document.createElement('div');
    grid.className = 'grid';
    for (let i=0;i<PER_PAGE;i++){
      const slot = document.createElement('div');
      slot.className = 'slot';
      const item = slice[i];
      if (item){
        slot.innerHTML = `<img class="card" src="${cardArtworkUrl(item.card_id)}" alt="${item.card_id}"/><div class="glass"></div>`;
      } else {
        slot.classList.add('empty');
        slot.textContent = '—';
      }
      grid.appendChild(slot);
    }
    return grid;
  }

  const dec = ()=>{ if (spreadIndex > 0) { spreadIndex--; renderSpread(); } };
  const inc = ()=>{ if (spreadIndex + 1 < totalSpreads()) { spreadIndex++; renderSpread(); } };
  root.querySelector('#prev').addEventListener('click', dec);
  root.querySelector('#next').addEventListener('click', inc);
  root.querySelector('#set-inc').addEventListener('click', ()=>{ setNum = Math.max(1, setNum - 1); load(); });
  root.querySelector('#set-dec').addEventListener('click', ()=>{ setNum = setNum + 1; load(); });

  await load();
  root.addEventListener('removed', ()=>{});
}

function getBackRatio(){
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const r = img.naturalWidth && img.naturalHeight ? (img.naturalWidth / img.naturalHeight) : (512 / 720);
      resolve(r);
    };
    img.onerror = () => resolve(512/720);
    img.src = BACK_URL + '?v=' + Date.now();
  });
}
