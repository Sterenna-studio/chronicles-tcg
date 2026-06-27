-- Boucle de rétention quotidienne (Priorité 2).
--
-- 1) claim_daily_login()    — bonus de connexion journalier CRÉDITÉ VIA LE LEDGER.
--    Corrige un bug : logic/daily.js écrivait en direct sur profiles.chronicles,
--    or le trigger sync_chronicles_balance fait profiles.chronicles = SUM(ledger).
--    Tout crédit hors ledger était donc EFFACÉ à la prochaine opération ledger
--    (quête, achat, combat). Le streak reste sur tcg_players (métadonnée, pas le solde).
--
-- 2) award_daily_squad_win() — bonus fixe (75 ✦) pour la 1re victoire Escouade du
--    jour (UTC) : donne une raison de jouer chaque jour. « Une fois / jour » est
--    vérifié côté serveur directement sur le ledger (pas de table supplémentaire).
--
-- Les deux : SECURITY DEFINER + row_security off (comme claim_quest / award_squad_reward),
-- montants FIXÉS côté serveur (aucun montant passé par le client → pas de triche).

-- ── 1) Bonus de connexion journalier (ledger) ────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_daily_login()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' SET row_security TO 'off'
AS $$
DECLARE
  v_user       uuid := auth.uid();
  v_streak     integer;
  v_last       timestamptz;
  v_today      date := (now() AT TIME ZONE 'UTC')::date;
  v_last_day   date;
  v_new_streak integer;
  v_reward     integer;
  v_bal        integer;
  -- Paliers (doivent rester alignés avec STREAK_REWARDS de logic/daily.js)
  v_rewards    integer[] := ARRAY[50, 75, 100, 125, 150, 175, 300];
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Non authentifie');
  END IF;

  -- Init joueur (idempotent), comme les autres RPC monnaie
  INSERT INTO profiles (id, chronicles) VALUES (v_user, 1000) ON CONFLICT (id) DO NOTHING;
  INSERT INTO tcg_players (id, username, chronicles)
  SELECT v_user, COALESCE(p.username, 'Agent'), COALESCE(p.chronicles, 0)
  FROM profiles p WHERE p.id = v_user
  ON CONFLICT (id) DO NOTHING;

  SELECT daily_streak, last_daily_at INTO v_streak, v_last
  FROM tcg_players WHERE id = v_user;

  v_last_day := (v_last AT TIME ZONE 'UTC')::date;

  -- Déjà réclamé aujourd'hui (UTC) ?
  IF v_last IS NOT NULL AND v_last_day >= v_today THEN
    SELECT chronicles INTO v_bal FROM profiles WHERE id = v_user;
    RETURN jsonb_build_object('ok', true, 'rewarded', false,
                              'streak', COALESCE(v_streak, 0), 'balance', v_bal);
  END IF;

  -- Streak : +1 si le dernier claim était hier, sinon reset à 1
  IF v_last IS NOT NULL AND v_last_day = v_today - 1 THEN
    v_new_streak := COALESCE(v_streak, 0) + 1;
  ELSE
    v_new_streak := 1;
  END IF;

  -- Cycle de 7 (tableaux PostgreSQL 1-indexés)
  v_reward := v_rewards[((v_new_streak - 1) % 7) + 1];

  -- Crédit via le ledger (source de vérité)
  INSERT INTO chronicles_ledger (user_id, amount, type, meta)
  VALUES (v_user, v_reward, 'daily_bonus',
          jsonb_build_object('kind', 'login', 'streak', v_new_streak));

  -- Le solde et le streak sont des métadonnées suivies sur tcg_players
  UPDATE tcg_players SET daily_streak = v_new_streak, last_daily_at = now()
  WHERE id = v_user;

  SELECT chronicles INTO v_bal FROM profiles WHERE id = v_user;
  RETURN jsonb_build_object('ok', true, 'rewarded', true,
                            'amount', v_reward, 'streak', v_new_streak, 'balance', v_bal);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM, 'sqlstate', SQLSTATE);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_daily_login() FROM anon;
GRANT  EXECUTE ON FUNCTION public.claim_daily_login() TO authenticated;

-- ── 2) Bonus quotidien « 1re victoire Escouade du jour » (ledger) ────────────
CREATE OR REPLACE FUNCTION public.award_daily_squad_win()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' SET row_security TO 'off'
AS $$
DECLARE
  v_user  uuid := auth.uid();
  v_amt   integer := 75;   -- bonus fixe (anti-triche : pas de montant client)
  v_bal   integer;
  v_today date := (now() AT TIME ZONE 'UTC')::date;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Non authentifie');
  END IF;

  INSERT INTO profiles (id, chronicles) VALUES (v_user, 1000) ON CONFLICT (id) DO NOTHING;

  -- Déjà obtenu le bonus de victoire Escouade aujourd'hui (UTC) ?
  IF EXISTS (
    SELECT 1 FROM chronicles_ledger
    WHERE user_id = v_user
      AND type = 'daily_bonus'
      AND meta->>'kind' = 'squad_win'
      AND (created_at AT TIME ZONE 'UTC')::date = v_today
  ) THEN
    SELECT chronicles INTO v_bal FROM profiles WHERE id = v_user;
    RETURN jsonb_build_object('ok', true, 'rewarded', false, 'balance', v_bal);
  END IF;

  INSERT INTO chronicles_ledger (user_id, amount, type, meta)
  VALUES (v_user, v_amt, 'daily_bonus', jsonb_build_object('kind', 'squad_win'));

  SELECT chronicles INTO v_bal FROM profiles WHERE id = v_user;
  RETURN jsonb_build_object('ok', true, 'rewarded', true, 'amount', v_amt, 'balance', v_bal);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM, 'sqlstate', SQLSTATE);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.award_daily_squad_win() FROM anon;
GRANT  EXECUTE ON FUNCTION public.award_daily_squad_win() TO authenticated;
