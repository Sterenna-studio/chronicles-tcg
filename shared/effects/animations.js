// shared/effects/animations.js — v1.0
// Effets visuels : particules burst + célébration carte légendaire/mythique

/**
 * Burst de particules au point (x, y) dans le container.
 * @param {HTMLElement} container
 * @param {{ x: number, y: number, count?: number, color?: string }} opts
 */
export function burstParticles(container, { x, y, count = 28, color = null } = {}) {
  const colors = color
    ? [color]
    : ['#42b0ff', '#7ee8a2', '#bb55d3', '#ffbe46', '#ff5080', '#ffffff'];

  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    const angle   = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
    const speed   = 60 + Math.random() * 100;
    const dx      = Math.cos(angle) * speed;
    const dy      = Math.sin(angle) * speed;
    const size    = 5 + Math.random() * 7;
    const col     = colors[Math.floor(Math.random() * colors.length)];
    const dur     = 500 + Math.random() * 400;

    Object.assign(p.style, {
      position:        'fixed',
      left:            x + 'px',
      top:             y + 'px',
      width:           size + 'px',
      height:          size + 'px',
      background:      col,
      borderRadius:    '50%',
      pointerEvents:   'none',
      zIndex:          '99999',
      transition:      `transform ${dur}ms ease-out, opacity ${dur}ms ease-out`,
      opacity:         '1',
      transform:       'translate(-50%, -50%)',
      willChange:      'transform, opacity',
    });

    container.appendChild(p);
    requestAnimationFrame(() => {
      p.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      p.style.opacity   = '0';
    });
    setTimeout(() => p.remove(), dur + 50);
  }
}

/**
 * Effet de célébration pour une carte légendaire / mythique.
 * Affiche un halo + burst de particules sur la carte.
 * @param {HTMLElement} container
 * @param {{ img: string, rarity: string, duration?: number }} opts
 * @returns {Promise<void>} résout après `duration` ms
 */
export function celebrateCard(container, { img, rarity, duration = 900 } = {}) {
  return new Promise(resolve => {
    const colors = {
      legendary: ['#ffbe46', '#fff4c2', '#ffaa00'],
      mythical:  ['#ff5080', '#42b0ff', '#bb55d3', '#ffffff'],
    }[String(rarity).toLowerCase()] || ['#ffffff'];

    // Burst centré sur le container
    const rect = container.getBoundingClientRect();
    const cx   = rect.left + rect.width  / 2;
    const cy   = rect.top  + rect.height / 2;

    for (const col of colors) {
      burstParticles(document.body, { x: cx, y: cy, count: 18, color: col });
    }

    // Halo flash
    const halo = document.createElement('div');
    Object.assign(halo.style, {
      position:      'fixed',
      inset:         '0',
      pointerEvents: 'none',
      zIndex:        '9998',
      background:    colors[0] + '22',
      transition:    `opacity ${duration}ms ease-out`,
      opacity:       '1',
    });
    document.body.appendChild(halo);
    requestAnimationFrame(() => { halo.style.opacity = '0'; });
    setTimeout(() => { halo.remove(); resolve(); }, duration);
  });
}
