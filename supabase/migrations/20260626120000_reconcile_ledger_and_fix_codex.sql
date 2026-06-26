-- 1) Global ledger reconciliation
-- sync_chronicles_balance() sets profiles.chronicles = SUM(chronicles_ledger).
-- Many users got an initial balance written directly to profiles WITHOUT a
-- ledger entry. Their next ledger transaction would reset their balance to the
-- (much lower) ledger sum, silently destroying their Chronicles.
-- Fix: insert a reconciliation entry so SUM(ledger) == current profiles balance.
-- The INSERT fires sync_chronicles_balance per row, which re-sets the balance to
-- the new ledger sum (== current balance), so balances are unchanged.
INSERT INTO public.chronicles_ledger (user_id, amount, type, meta)
SELECT p.id,
       p.chronicles - COALESCE(SUM(l.amount), 0),
       'admin_grant',
       jsonb_build_object('reason', 'initial balance reconciliation — ledger backfill')
FROM public.profiles p
LEFT JOIN public.chronicles_ledger l ON l.user_id = p.id
WHERE p.chronicles IS NOT NULL
GROUP BY p.id, p.chronicles
HAVING p.chronicles <> COALESCE(SUM(l.amount), 0);

-- 2) Fix refresh_codex_botanique: old table names (species -> botanica_species,
-- player_codex -> botanica_player_codex). Caused db lint failure.
CREATE OR REPLACE FUNCTION public.refresh_codex_botanique()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE botanica_species s
  SET discovered_by_username = p.username
  FROM profiles p
  WHERE p.id = s.discovered_by
    AND s.discovered_by IS NOT NULL
    AND (s.discovered_by_username IS NULL OR s.discovered_by_username != p.username);

  UPDATE botanica_player_data bpd
  SET codex_count = (
    SELECT COUNT(*)
    FROM botanica_player_codex pc
    WHERE pc.user_id = bpd.user_id
  );

  REFRESH MATERIALIZED VIEW CONCURRENTLY codex_botanique_global;
END;
$$;
