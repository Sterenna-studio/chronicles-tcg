-- Mode Escouade — lot 9 : quêtes du mode.
-- Réclamées via claim_quest (idempotent : récompense unique) à la victoire.
INSERT INTO public.tcg_quests (id, title, description, reward_chronicles, is_tuto, sort_order)
VALUES
  ('squad_first_win', 'Première victoire d''escouade',
   'Gagne ton premier combat en Mode Escouade.', 300, false, 20),
  ('squad_win_hard', 'Vétéran d''escouade',
   'Gagne un combat d''escouade en difficulté Difficile.', 500, false, 21)
ON CONFLICT (id) DO NOTHING;
