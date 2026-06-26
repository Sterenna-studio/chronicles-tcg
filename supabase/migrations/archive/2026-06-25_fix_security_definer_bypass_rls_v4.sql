-- Migration: 2026-06-25_fix_security_definer_bypass_rls_v4
-- Fix: SECURITY DEFINER functions must bypass RLS explicitly via SET row_security = off
-- Without it, RLS policies still apply and block UPDATE on profiles (profiles_update_own
-- WITH CHECK subquery fails), causing silent 400 on claim_quest and buy_pack_with_chronicles

CREATE OR REPLACE FUNCTION public.claim_quest(p_quest_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security = off
AS $$
DECLARE
  v_user_id            uuid := auth.uid();
  v_quest              tcg_quests%ROWTYPE;
  v_current_chronicles integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Non authentifie');
  END IF;

  INSERT INTO profiles (id, chronicles)
  VALUES (v_user_id, 1000)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO tcg_players (id, username, chronicles)
  SELECT v_user_id, p.username, p.chronicles
  FROM profiles p
  WHERE p.id = v_user_id
  ON CONFLICT (id) DO NOTHING;

  SELECT * INTO v_quest FROM tcg_quests WHERE id = p_quest_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Quete introuvable');
  END IF;

  IF EXISTS (
    SELECT 1 FROM tcg_quest_completions
    WHERE user_id = v_user_id AND quest_id = p_quest_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Deja reclamee');
  END IF;

  SELECT chronicles INTO v_current_chronicles FROM profiles WHERE id = v_user_id;

  IF v_current_chronicles + v_quest.reward_chronicles < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solde insuffisant');
  END IF;

  UPDATE profiles
  SET chronicles = chronicles + v_quest.reward_chronicles
  WHERE id = v_user_id;

  INSERT INTO chronicles_ledger (user_id, amount, type, meta)
  VALUES (
    v_user_id,
    v_quest.reward_chronicles,
    'quest',
    jsonb_build_object('quest_id', p_quest_id, 'quest_title', v_quest.title)
  );

  INSERT INTO tcg_quest_completions (user_id, quest_id)
  VALUES (v_user_id, p_quest_id);

  UPDATE tcg_players
  SET chronicles = (SELECT chronicles FROM profiles WHERE id = v_user_id)
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'chronicles_earned', v_quest.reward_chronicles,
    'quest_title', v_quest.title
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.buy_pack_with_chronicles(p_pack_type_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security = off
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_balance  integer;
  v_pack     pack_types%ROWTYPE;
  v_qty      integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Non authentifie');
  END IF;

  SELECT chronicles INTO v_balance FROM profiles WHERE id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Profil introuvable');
  END IF;

  SELECT * INTO v_pack FROM pack_types WHERE id = p_pack_type_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pack introuvable ou inactif');
  END IF;

  IF v_balance < v_pack.price THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Chronicles insuffisants',
      'balance', v_balance,
      'price', v_pack.price
    );
  END IF;

  UPDATE profiles SET chronicles = chronicles - v_pack.price WHERE id = v_user_id;

  INSERT INTO chronicles_ledger (user_id, amount, type, meta)
  VALUES (
    v_user_id,
    -v_pack.price,
    'purchase',
    jsonb_build_object('pack_type_id', p_pack_type_id, 'pack_name', v_pack.name)
  );

  INSERT INTO tcg_player_packs (player_id, pack_type_id, quantity)
  VALUES (v_user_id, p_pack_type_id, 1)
  ON CONFLICT (player_id, pack_type_id)
  DO UPDATE SET quantity = tcg_player_packs.quantity + 1, updated_at = now();

  SELECT quantity INTO v_qty FROM tcg_player_packs
  WHERE player_id = v_user_id AND pack_type_id = p_pack_type_id;

  UPDATE tcg_players
  SET chronicles = v_balance - v_pack.price, updated_at = now()
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'chronicles_remaining', v_balance - v_pack.price,
    'pack_qty', v_qty
  );
END;
$$;
