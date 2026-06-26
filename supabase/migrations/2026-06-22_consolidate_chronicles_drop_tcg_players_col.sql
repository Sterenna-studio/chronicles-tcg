-- 2026-06-22 — Consolidate chronicles onto profiles, drop tcg_players.chronicles
--
-- Background: gold lived in TWO columns (profiles.chronicles used by the active
-- inline app + buy_pack RPC + daily + battle, and tcg_players.chronicles used by
-- the legacy module views). A trigger (trg_tcg_chronicles_to_profiles) mirrored
-- tcg_players.chronicles -> profiles.chronicles, which kept them roughly in sync.
-- All code now reads/writes profiles.chronicles directly, so both the column and
-- its sync trigger are obsolete.
--
-- ORDER OF OPERATIONS: run this AFTER deploying the code that repoints every
-- chronicles read/write to profiles.
--
-- Backfill keeps the HIGHER of the two values so no player loses gold from the
-- historical divergence (profiles is canonical; tcg_players was usually 0/low).

-- 1) Backfill any divergence onto profiles (canonical).
UPDATE profiles p
SET chronicles = GREATEST(COALESCE(p.chronicles, 0), COALESCE(t.chronicles, 0))
FROM tcg_players t
WHERE t.id = p.id;

-- 2) Drop the obsolete sync trigger and its (now orphaned) function.
DO $$
DECLARE fn text;
BEGIN
  SELECT t.tgfoid::regprocedure::text
    INTO fn
  FROM pg_trigger t
  WHERE t.tgname = 'trg_tcg_chronicles_to_profiles'
    AND t.tgrelid = 'tcg_players'::regclass;

  DROP TRIGGER IF EXISTS trg_tcg_chronicles_to_profiles ON tcg_players;

  IF fn IS NOT NULL THEN
    BEGIN
      EXECUTE 'DROP FUNCTION IF EXISTS ' || fn;
    EXCEPTION WHEN dependent_objects_still_exist THEN
      RAISE NOTICE 'Function % is used elsewhere; leaving it in place.', fn;
    END;
  END IF;
END $$;

-- 3) Drop the redundant column.
ALTER TABLE tcg_players DROP COLUMN IF EXISTS chronicles;
