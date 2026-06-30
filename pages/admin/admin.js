import { getFxSettings, saveFxSettings, resetFxSettings } from '../../state/settings.js?v=22';

const ids = ['visual_rays_enabled','visual_rays_spin','visual_rays_opacity','visual_burst_enabled','new_badge_enabled','audio_enabled','audio_volume'];
const el = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
const status = document.getElementById('status');
function load(){
  const s = getFxSettings();
  el.visual_rays_enabled.checked = s.visual_rays_enabled;
  el.visual_rays_spin.checked = s.visual_rays_spin;
  el.visual_rays_opacity.value = s.visual_rays_opacity;
  el.visual_burst_enabled.checked = s.visual_burst_enabled;
  el.new_badge_enabled.checked = s.new_badge_enabled;
  el.audio_enabled.checked = s.audio_enabled;
  el.audio_volume.value = s.audio_volume;
  drawPreview();
}
function current(){
  return {
    visual_rays_enabled: el.visual_rays_enabled.checked,
    visual_rays_spin: el.visual_rays_spin.checked,
    visual_rays_opacity: parseFloat(el.visual_rays_opacity.value),
    visual_burst_enabled: el.visual_burst_enabled.checked,
    new_badge_enabled: el.new_badge_enabled.checked,
    audio_enabled: el.audio_enabled.checked,
    audio_volume: parseFloat(el.audio_volume.value)
  };
}
document.getElementById('save').onclick = () => {
  saveFxSettings(current());
  status.textContent = '✅ Sauvegardé';
  drawPreview();
};
document.getElementById('reset').onclick = () => {
  resetFxSettings();
  status.textContent = '↩️ Réinitialisé';
  load();
};

function drawPreview(){
  const s = getFxSettings();
  const host = document.getElementById('preview');
  host.innerHTML = '';

  const card = document.createElement('div');
  card.className = 'flip-card flipped';
  const inner = document.createElement('div');
  inner.className = 'flip-inner';
  const front = document.createElement('div');
  front.className = 'flip-face flip-front card rarity-legendary';
  front.style.backgroundImage = 'url(/assets/card_back.png)'; // placeholder

  if (s.visual_rays_enabled) {
    const rays = document.createElement('div');
    rays.className = 'fx-rays';
    rays.style.opacity = s.visual_rays_opacity;
    if (!s.visual_rays_spin) {
      rays.style.animation = 'none';
      rays.style.transform = 'none';
    }
    front.appendChild(rays);
  }
  if (s.visual_burst_enabled) {
    const burst = document.createElement('div');
    burst.className = 'fx-burst';
    front.appendChild(burst);
  }
  if (s.new_badge_enabled) {
    const b = document.createElement('div');
    b.className = 'badge-new'; b.textContent = 'NEW!';
    front.appendChild(b);
  }

  inner.appendChild(front);
  card.appendChild(inner);
  host.appendChild(card);
}

load();
