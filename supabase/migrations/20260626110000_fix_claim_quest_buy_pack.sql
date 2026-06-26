-- Fix claim_quest and buy_pack_with_chronicles: add SET row_security = off so
-- SECURITY DEFINER functions can bypass RLS on profiles/tcg_players tables.
-- Also: claim_quest now uses chronicles_ledger as single source of truth.

CREATE OR REPLACE FUNCTION public.claim_quest(p_quest_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_quest   tcg_quests%ROWTYPE;
  v_balance integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Non authentifie');
  END IF;

  -- Init joueur (idempotent) — n'écrit PAS le solde via le ledger ici
  INSERT INTO profiles (id, chronicles) VALUES (v_user_id, 1000)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO tcg_players (id, username, chronicles)
  SELECT v_user_id, COALESCE(p.username, 'Agent'), COALESCE(p.chronicles, 0)
  FROM profiles p WHERE p.id = v_user_id
  ON CONFLICT (id) DO NOTHING;

  SELECT * INTO v_quest FROM tcg_quests WHERE id = p_quest_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Quete introuvable');
  END IF;

  IF EXISTS (SELECT 1 FROM tcg_quest_completions
             WHERE user_id = v_user_id AND quest_id = p_quest_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Deja reclamee');
  END IF;

  SELECT chronicles INTO v_balance FROM profiles WHERE id = v_user_id;
  IF v_balance + v_quest.reward_chronicles < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solde insuffisant');
  END IF;

  -- Source unique : le ledger. Le trigger sync_chronicles_balance crédite
  -- profiles, puis sync_chronicles_to_tcg propage vers tcg_players.
  INSERT INTO chronicles_ledger (user_id, amount, type, meta)
  VALUES (v_user_id, v_quest.reward_chronicles, 'quest',
          jsonb_build_object('quest_id', p_quest_id, 'quest_title', v_quest.title));

  INSERT INTO tcg_quest_completions (user_id, quest_id)
  VALUES (v_user_id, p_quest_id);

  RETURN jsonb_build_object('ok', true,
                            'chronicles_earned', v_quest.reward_chronicles,
                            'balance', v_balance + v_quest.reward_chronicles,
                            'quest_title', v_quest.title);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM, 'sqlstate', SQLSTATE);
END;
$$;

CREATE OR REPLACE FUNCTION public.buy_pack_with_chronicles(p_pack_type_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_balance integer;
  v_pack    pack_types%ROWTYPE;
  v_qty     integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Non authentifie');
  END IF;

  INSERT INTO profiles (id, chronicles) VALUES (v_user_id, 1000)
  ON CONFLICT (id) DO NOTHING;

  SELECT chronicles INTO v_balance FROM profiles WHERE id = v_user_id FOR UPDATE;

  SELECT * INTO v_pack FROM pack_types WHERE id = p_pack_type_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pack introuvable ou inactif');
  END IF;

  IF v_balance < v_pack.price THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Chronicles insuffisants',
                              'balance', v_balance, 'price', v_pack.price);
  END IF;

  -- Source unique : le ledger débite profiles via le trigger (puis tcg_players).
  INSERT INTO chronicles_ledger (user_id, amount, type, meta)
  VALUES (v_user_id, -v_pack.price, 'purchase',
          jsonb_build_object('pack_type_id', p_pack_type_id, 'pack_name', v_pack.name));

  INSERT INTO tcg_player_packs (player_id, pack_type_id, quantity)
  VALUES (v_user_id, p_pack_type_id, 1)
  ON CONFLICT (player_id, pack_type_id)
  DO UPDATE SET quantity = tcg_player_packs.quantity + 1, updated_at = now();

  SELECT quantity INTO v_qty FROM tcg_player_packs
  WHERE player_id = v_user_id AND pack_type_id = p_pack_type_id;

  RETURN jsonb_build_object('ok', true,
                            'chronicles_remaining', v_balance - v_pack.price,
                            'pack_qty', v_qty);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM, 'sqlstate', SQLSTATE);
END;
$$;
