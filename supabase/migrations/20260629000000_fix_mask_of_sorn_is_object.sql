-- "The Mask of Sorn" (BZH01_EC001) était typé Champion alors que c'est un artefact
-- (desc : « Un artefact scellé… »). On le repasse en Object.
-- On GARDE l'id (référencé dans tcg_player_cards / squads) ; on retire skill + slots,
-- propres aux champions. data/BZH01.json est corrigé en parallèle (même valeur).
UPDATE public.cards
SET type = 'Object', skill = NULL, slots = 0
WHERE id = 'BZH01_EC001';
