-- Restrict the game to Set 01 (BZH01) for now.
-- Set 02 (BZH02) packs are no longer purchasable: deactivate them so
-- buy_pack_with_chronicles rejects them (it requires is_active = true) and the
-- shop UI (which loads only active packs) hides them.
--
-- Already-owned BZH02 packs remain openable and already-owned BZH02 cards stay
-- visible in the collection — they are simply not usable in combat (enforced
-- client-side via logic/sets.js PLAYABLE_SET_IDS).
--
-- To re-enable Set 02 later:
--   UPDATE public.pack_types SET is_active = true WHERE set_id = 'BZH02';
--   and add 'BZH02' back to PLAYABLE_SET_IDS in logic/sets.js.
UPDATE public.pack_types
SET is_active = false
WHERE set_id = 'BZH02';
