-- 2026-06-22 — Fix "Security Definer View" (tcg_leaderboard)
--
-- A SECURITY DEFINER *view* bypasses the caller's RLS (Supabase flags it
-- CRITICAL). We replace it with a SECURITY DEFINER *function* with a fixed
-- search_path: it exposes only the aggregated leaderboard columns, never
-- broadens table access, and the leaderboard keeps working for everyone.
--
-- Run AFTER deploying the frontend change (leaderboardWidget.js -> rpc).
-- Order is not critical: the widget just errors briefly if run before deploy.

DROP VIEW IF EXISTS public.tcg_leaderboard;

CREATE OR REPLACE FUNCTION public.get_tcg_leaderboard(p_limit int DEFAULT 50)
RETURNS TABLE (
  id            uuid,
  username      text,
  cards_count   int,
  gold          int,
  duels_won     int,
  has_legendary boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    p.id,
    p.username,
    COALESCE(SUM(c.quantity), 0)::int                                          AS cards_count,
    COALESCE(pr.chronicles, 0)::int                                            AS gold,
    COALESCE(p.duels_won, 0)::int                                              AS duels_won,
    COALESCE(bool_or(c.quantity > 0 AND lower(c.rarity) = 'legendary'), false) AS has_legendary
  FROM tcg_players p
  LEFT JOIN tcg_player_cards c ON c.user_id = p.id
  LEFT JOIN profiles pr        ON pr.id      = p.id
  GROUP BY p.id, p.username, pr.chronicles, p.duels_won
  ORDER BY cards_count DESC, gold DESC
  LIMIT GREATEST(p_limit, 0);
$$;

GRANT EXECUTE ON FUNCTION public.get_tcg_leaderboard(int) TO anon, authenticated;
