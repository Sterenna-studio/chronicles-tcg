-- 2026-06-22 — Recreate tcg_leaderboard with has_legendary
--
-- The leaderboard widget selects has_legendary, but the view never had it
-- (the original SQL tried to join a non-existent `cards` table). Card rarity is
-- now stored on tcg_player_cards.rarity at save time (addCardsBatch), so the
-- view can compute it directly: a player "has_legendary" if they own any card
-- whose rarity is Legendary (case-insensitive, qty > 0).
--
-- NOTE: cards added before the rarity-storing code shipped have NULL rarity and
-- won't count until re-saved or backfilled.

DROP VIEW IF EXISTS tcg_leaderboard;

CREATE VIEW tcg_leaderboard AS
SELECT
  p.id,
  p.username,
  COALESCE(SUM(c.quantity), 0)::int AS cards_count,
  COALESCE(pr.chronicles, 0)::int   AS gold,
  COALESCE(p.duels_won, 0)::int     AS duels_won,
  COALESCE(bool_or(c.quantity > 0 AND lower(c.rarity) = 'legendary'), false) AS has_legendary
FROM tcg_players p
LEFT JOIN tcg_player_cards c ON c.user_id = p.id
LEFT JOIN profiles pr        ON pr.id      = p.id
GROUP BY p.id, p.username, pr.chronicles, p.duels_won
ORDER BY cards_count DESC, gold DESC
LIMIT 50;
