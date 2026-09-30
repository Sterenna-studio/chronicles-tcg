const KEY = 'tcg_fx_settings';

const defaults = {
  // Enable audio by default but set a moderate volume.  The user prefers
  // success sounds at half volume.
  audio_enabled: true,
  audio_volume: 0.5,
  // Visual effects: rays are enabled but spin is disabled and opacity lowered.
  visual_rays_enabled: true,
  visual_rays_spin: false,
  visual_rays_opacity: 0.85,
  // Enable burst and new badge effects by default.
  visual_burst_enabled: true,
  new_badge_enabled: true
};

export function getFxSettings() {
  try {
    const cur = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { ...defaults, ...cur };
  } catch {
    return { ...defaults };
  }
}
export function saveFxSettings(partial) {
  const cur = getFxSettings();
  const next = { ...cur, ...partial };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
export function resetFxSettings() {
  localStorage.setItem(KEY, JSON.stringify(defaults));
  return getFxSettings();
}
