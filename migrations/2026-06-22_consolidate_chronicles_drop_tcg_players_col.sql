-- 2026-06-22 — Consolidate chronicles onto profiles, drop tcg_players.chronicles
--
-- Background: gold lived in TWO columns (profiles.chronicles used by the active
-- inline app + buy_pack RPC + daily + battle, and tcg_players.chronicles used by
-- the legacy module views). All code now reads/writes profiles.chronicles.
--
-- ORDER OF OPERATIONS: run this AFTER deploying the code that repoints every
-- chronicles read/write to profiles (commit that ships data/supabaseData.js,
-- data/playersRepo.js, data/achievementsRepo.js, app/*, ui/shopModal.js, ...).
--
-- Backfill keeps the HIGHER of the two values so no player loses gold from the
-- historical divergence (profiles is canonical; tcg_players was usually 0/low).

UPDATE profiles p
SET chronicles = GREATEST(COALESCE(p.chronicles, 0), COALESCE(t.chronicles, 0))
FROM tcg_players t
WHERE t.id = p.id;

ALTER TABLE tcg_players DROP COLUMN IF EXISTS chronicles;
