const KEY = 'tcg_fx_settings';

const defaults = {
  audio_enabled: true,
  audio_volume: 1.0,
  visual_rays_enabled: true,
  visual_rays_spin: true,
  visual_rays_opacity: 1.0,
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
