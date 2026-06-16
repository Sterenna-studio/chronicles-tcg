// lab/tcg/app/ui-settings.js
export function getSettings(){ try{return JSON.parse(localStorage.getItem('lab.settings'))||{}}catch{return{}} }
export function saveSettings(s){ localStorage.setItem('lab.settings', JSON.stringify(s||{})); }
export function openSettingsModal(){
  const s = getSettings();
  const o = document.createElement('div');
  Object.assign(o.style,{position:'fixed',inset:'0',background:'rgba(0,0,0,.65)',zIndex:9999,display:'grid',placeItems:'center'});
  const c = document.createElement('div');
  Object.assign(c.style,{width:'420px',padding:'20px',borderRadius:'16px',color:'#fff',background:'#0b0f14',boxShadow:'0 0 25px rgba(100,150,255,.4)'});
  c.innerHTML = `
    <div style="font-weight:bold;font-size:18px;text-align:center;margin-bottom:12px;">Paramètres</div>
    <label style="display:block;margin:8px 0;">
      <span>Volume (0–100)</span>
      <input id="st-volume" type="range" min="0" max="100" value="${('volume' in s)?s.volume:80}" style="width:100%"/>
    </label>
    <label style="display:flex;align-items:center;gap:8px;margin:8px 0;">
      <input id="st-boosters-qty" type="checkbox" ${s.showBoosterQuantities?'checked':''} />
      <span>Afficher boosters en quantités</span>
    </label>
    <div style="text-align:right;margin-top:14px;">
      <button id="st-cancel" class="btn-nav" style="margin-right:8px;">Annuler</button>
      <button id="st-save" class="btn-nav">Sauvegarder</button>
    </div>
  `;
  o.appendChild(c); o.addEventListener('click',e=>{if(e.target===o)o.remove()});
  c.querySelector('#st-cancel').addEventListener('click',()=>o.remove());
  c.querySelector('#st-save').addEventListener('click',()=>{
    const ns={...s,volume:parseInt(c.querySelector('#st-volume').value,10),showBoosterQuantities:!!c.querySelector('#st-boosters-qty').checked};
    saveSettings(ns); o.remove();
  });
  document.body.appendChild(o);
}
