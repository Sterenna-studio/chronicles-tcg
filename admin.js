import { supabase } from '/shared/supabaseClient.js';

document.addEventListener('DOMContentLoaded', async () => {
  const { data:{session} } = await supabase.auth.getSession();
  if (!session || session.user.id !== 'c496aac4-7ed3-4173-9666-a4f30098cac7') {
    return window.location.href = '/';
  }

  const form = document.getElementById('packForm');
  const status = document.getElementById('statusMsg');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    status.textContent = '';
    const f = e.target;
    const newPack = {
      name:        f.name.value.trim(),
      price:       parseInt(f.price.value, 10),
      set_id:      f.set_id.value.trim(),
      image_name:  f.image_name.value.trim(),
      card_count:  parseInt(f.card_count.value, 10),
      require_champion:  f.require_champion.checked,
      require_epic:      f.require_epic.checked,
      require_legendary: f.require_legendary.checked,
      require_mythical:  f.require_mythical.checked
    };
    const { data, error } = await supabase.from('pack_types').insert(newPack).select();
    if (error) {
      status.textContent = `❌ ${error.message}`;
      status.style.color = 'crimson';
    } else {
      status.textContent = `✅ Pack "${data?.[0]?.name ?? newPack.name}" créé!`;
      status.style.color = '#0f0';
      form.reset();
    }
  });
});
