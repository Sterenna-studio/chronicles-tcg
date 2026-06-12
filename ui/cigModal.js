// ui/cigModal.js — v6 (uses modalShell)
import { openModalShell } from './modalShell.js';

export function openCIG() {
  return openModalShell({
    id:          'cig',
    title:       '◈ CIG',
    defaultMode: 'compact',
    resizable:   true,
    draggable:   true,
    render: (content) => {
      content.style.cssText = 'flex:1;min-height:0;display:flex;flex-direction:column;';
      const iframe = document.createElement('iframe');
      iframe.src = `./pages/cig/index.html?v=1.5.0`;
      Object.assign(iframe.style, {
        width:  '100%',
        height: '100%',
        flex:   '1',
        border: '0',
        minHeight: '0',
      });
      iframe.setAttribute('loading', 'lazy');
      content.appendChild(iframe);
    },
  });
}
