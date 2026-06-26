-- Mode Escouade — récompense de combat via le ledger (lot 7).
-- Le combat se joue côté client ; la récompense doit passer par chronicles_ledger
-- (le trigger sync_chronicles_balance recalcule profiles.chronicles = SUM(ledger),
-- donc tout crédit hors ledger serait effacé à la prochaine opération).

-- 1) Nouveau type de ledger
ALTER TABLE public.chronicles_ledger DROP CONSTRAINT IF EXISTS chronicles_ledger_type_check;
ALTER TABLE public.chronicles_ledger ADD CONSTRAINT chronicles_ledger_type_check
  CHECK (type = ANY (ARRAY[
    'slot_bet','slot_win','daily_bonus','admin_grant','purchase',
    'achievement','raid_reward','raid_penalty','quest','battle_reward'
  ]));

-- 2) RPC : crédite une récompense de combat Escouade.
-- Le montant est clampé [0,100] côté serveur (le combat étant client, on limite
-- la surface de triche au plafond d'un gain légitime).
CREATE OR REPLACE FUNCTION public.award_squad_reward(p_amount integer, p_meta jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' SET row_security TO 'off'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_amt  integer;
  v_bal  integer;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Non authentifie');
  END IF;

  v_amt := LEAST(GREATEST(COALESCE(p_amount, 0), 0), 100);

  -- Init joueur (idempotent), comme les autres RPC monnaie
  INSERT INTO profiles (id, chronicles) VALUES (v_user, 1000)
  ON CONFLICT (id) DO NOTHING;

  IF v_amt > 0 THEN
    INSERT INTO chronicles_ledger (user_id, amount, type, meta)
    VALUES (v_user, v_amt, 'battle_reward',
            COALESCE(p_meta, '{}'::jsonb) || jsonb_build_object('mode', 'escouade'));
  END IF;

  SELECT chronicles INTO v_bal FROM profiles WHERE id = v_user;
  RETURN jsonb_build_object('ok', true, 'awarded', v_amt, 'balance', v_bal);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM, 'sqlstate', SQLSTATE);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.award_squad_reward(integer, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.award_squad_reward(integer, jsonb) TO authenticated;
