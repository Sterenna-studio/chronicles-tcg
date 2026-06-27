-- Mode Escouade — lot 8 : quête du tutoriel guidé.
-- Réutilise claim_quest (idempotent : pas de double récompense).
INSERT INTO public.tcg_quests (id, title, description, reward_chronicles, is_tuto, sort_order)
VALUES ('tuto_escouade', 'Académie d''Escouade',
        'Termine le tutoriel du Mode Escouade : attaque, équipement, attaque spéciale.',
        500, true, 10)
ON CONFLICT (id) DO NOTHING;
