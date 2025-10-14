// ui/cigModal.js — v5: display CIG in modal (iframe)
export function openCIG() {
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position:'fixed', inset:'0', background:'rgba(0,0,0,.65)',
    backdropFilter:'blur(2px)', zIndex:'9999'
  });

  const wrap = document.createElement('div');
  Object.assign(wrap.style, {
    position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
    width:'min(420px,95vw)', height:'min(640px,90vh)', borderRadius:'16px',
    overflow:'hidden', boxShadow:'0 10px 40px rgba(0,0,0,.5)', background:'#000'
  });

  const iframe = document.createElement('iframe');
  iframe.src = `./pages/cig/index.html?v=1.5.0`;
  Object.assign(iframe.style, { width:'100%', height:'100%', border:'0' });
  iframe.setAttribute('loading','lazy');

  function close() { overlay.remove(); }
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  const onEsc = (e) => { if (e.key === 'Escape') { close(); window.removeEventListener('keydown', onEsc); } };
  window.addEventListener('keydown', onEsc);

  wrap.appendChild(iframe);
  overlay.appendChild(wrap);
  document.body.appendChild(overlay);
}
