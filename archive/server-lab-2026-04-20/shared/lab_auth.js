import { supabase } from '/shared/supabaseClient.js';

async function initLab() {
  const { data: { user } } = await supabase.auth.getUser();
  const status = document.getElementById('user-status');
  const btn = document.getElementById('auth-btn');
  const cards = document.querySelectorAll('.card');

  if (user) {
    status.textContent = `Connecté en tant que ${user.email}`;
    btn.textContent = "Déconnexion";
    btn.onclick = async () => { await supabase.auth.signOut(); location.reload(); };
    cards.forEach(c => c.classList.remove('locked'));
  } else {
    status.textContent = "Non connecté";
    btn.textContent = "Connexion / Inscription";
    btn.onclick = () => { window.location.href = "/lab/signup.html"; };
    cards.forEach(c => {
      c.classList.add('locked');
      c.onclick = (e) => { e.preventDefault(); alert("Connectez-vous pour accéder à cette section."); };
    });
  }
}
initLab();