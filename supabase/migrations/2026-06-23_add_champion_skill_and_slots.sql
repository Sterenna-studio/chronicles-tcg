-- ============================================================
-- Migration : 2026-06-23_add_champion_skill_and_slots
-- Description : Adds `skill` (jsonb) and `slots` (integer)
--               columns to public.cards for the JRPG combat
--               system. Champions get 3 equip slots by default;
--               all other card types stay at 0.
-- ============================================================

-- 1. Add `skill` column (nullable jsonb — non-Champion cards
--    leave it NULL; Champions will have it set via data layer)
ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS skill jsonb DEFAULT NULL;

COMMENT ON COLUMN public.cards.skill IS
  'Unique skill definition for Champion cards. '
  'Shape: { name: string, desc: string, effect: string, cooldown: number }. '
  'NULL for non-Champion card types.';

-- 2. Add `slots` column (integer, default 0)
ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS slots integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.cards.slots IS
  'Number of equipment slots available around this card in JRPG combat. '
  'Champions default to 3. All other types default to 0.';

-- 3. Backfill: set slots = 3 for all Champion cards
UPDATE public.cards
  SET slots = 3
  WHERE type = 'Champion';

-- ============================================================
-- Expected result after migration:
--   • All Champion rows  → slots = 3,  skill = NULL (to be
--     populated via admin panel or future data migration)
--   • All other rows     → slots = 0,  skill = NULL
-- ============================================================
