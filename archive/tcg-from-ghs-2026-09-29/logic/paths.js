// logic/paths.js
export function ROOT(){
  const meta = document.querySelector('meta[name="tcg-root"]')?.content;
  if (meta) return meta.replace(/\/$/, '');
  const m = location.pathname.match(/^(.*\/lab\/tcg)(?:\/|$)/) || location.pathname.match(/^(.*\/tcg)(?:\/|$)/);
  if (m) return m[1];
  const parts = location.pathname.split('/'); parts.pop(); return parts.join('/');
}
export const url = (p)=> `${ROOT()}${p.startsWith('/')?p:'/'+p}`;
export const bust = (u)=> `${u}${u.includes('?')?'&':'?'}v=${Date.now()}`;
