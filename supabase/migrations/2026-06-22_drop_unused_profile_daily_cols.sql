-- 2026-06-22 — Drop unused daily columns on profiles
--
-- The daily-reward system stores streak/last_daily_at on tcg_players
-- (see logic/daily.js, data/achievementsRepo.js). The identically-named
-- columns on profiles were never read or written by any code path, so they
-- only invited confusion about the source of truth. Safe to remove.
--
-- NOTE: tcg_players.chronicles is intentionally NOT dropped here — despite the
-- profiles.chronicles split, it is still actively read/written by the module
-- views (app/views/shop.js, ui/shopModal.js, app/hub.js, data/playersRepo.js,
-- data/supabaseData.js, ...). Consolidating the two chronicles columns is a
-- separate code+data migration.

ALTER TABLE profiles
  DROP COLUMN IF EXISTS daily_streak,
  DROP COLUMN IF EXISTS last_daily_at;
