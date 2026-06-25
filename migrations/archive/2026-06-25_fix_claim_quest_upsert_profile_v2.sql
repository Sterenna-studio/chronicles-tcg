-- Migration: 2026-06-25_fix_claim_quest_upsert_profile_v2
-- Fix: claim_quest now upserts profile BEFORE any operation
-- Prevents 400 when profile row doesn't exist yet for a new user

CREATE OR REPLACE FUNCTION public.claim_quest(p_quest_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_quest   tcg_quests%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Non authentifie');
  END IF;

  -- Upsert profiles : créer si absent avec 1000, NE PAS écraser chronicles si déjà présent
  INSERT INTO profiles (id, chronicles)
  VALUES (v_user_id, 1000)
  ON CONFLICT (id) DO NOTHING;

  -- Upsert tcg_players : créer si absent, sync username + chronicles depuis profiles
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

  -- Créditer sur profiles (source de vérité)
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

  -- Sync tcg_players.chronicles depuis profiles
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
