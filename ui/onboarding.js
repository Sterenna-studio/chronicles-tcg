import { supabase } from '../shared/supabaseClient.js?v=19';

// ── Guard : rediriger si déjà connecté + onboarding fait ──────────────────
async function guardOnboarding() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // Pas connecté → login du hub, avec retour ici après connexion
    window.location.href = '/login.html?next=' + encodeURIComponent(location.pathname);
    return false;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_done')
    .eq('id', user.id)
    .single();

  if (profile?.onboarding_done) {
    // Onboarding déjà fait → jeu directement
    window.location.href = '/index.html';
    return false;
  }

  return true;
}

// ── Navigation entre étapes ───────────────────────────────────────────────
let currentStep = 0;
const TOTAL_STEPS = 4;

window.nextStep = function () {
  const current = document.getElementById(`step-${currentStep}`);
  current.classList.remove('active');

  // Marquer le dot courant comme done
  document.querySelector(`[data-step="${currentStep}"]`).classList.replace('active', 'done');

  currentStep++;

  const next = document.getElementById(`step-${currentStep}`);
  next.classList.add('active');
  document.querySelector(`[data-step="${currentStep}"]`).classList.add('active');
};

// ── Claim onboarding ──────────────────────────────────────────────────────
window.claimOnboarding = async function () {
  const btn = document.getElementById('claimBtn');
  const errorMsg = document.getElementById('errorMsg');
  const rewardIcon = document.getElementById('rewardIcon');

  btn.disabled = true;
  btn.textContent = 'Réclamation en cours...';
  errorMsg.textContent = '';

  const { data, error } = await supabase.rpc('complete_onboarding');

  if (error) {
    errorMsg.textContent = `Erreur : ${error.message}`;
    btn.disabled = false;
    btn.innerHTML = 'Réessayer <span>→</span>';
    return;
  }

  const questResult = data?.quest_result;

  if (!data?.ok) {
    errorMsg.textContent = questResult?.error || 'Une erreur est survenue.';
    btn.disabled = false;
    btn.innerHTML = 'Réessayer <span>→</span>';
    return;
  }

  // ── Succès ──
  rewardIcon.textContent = '✦';
  rewardIcon.classList.add('success-anim');
  btn.textContent = `+${questResult?.chronicles_earned ?? 1000} Chronicles reçus !`;
  btn.style.background = '#4caf80';

  // Redirect après 1.8s
  setTimeout(() => {
    window.location.href = '/index.html';
  }, 1800);
};

// ── Init ──────────────────────────────────────────────────────────────────
guardOnboarding();
