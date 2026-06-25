-- Migration: 2026-06-25_fix_claim_quest_chronicles_constraint_v3
-- Fix: vérifie le solde avant UPDATE pour éviter la violation de la contrainte
-- CHECK (chronicles >= 0) sur la table profiles
-- Root cause: reward_chronicles négatif ou race condition levait une exception PG
-- brute qui remontait en 400 sans message JSON exploitable côté client

CREATE OR REPLACE FUNCTION public.claim_quest(p_quest_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id              uuid := auth.uid();
  v_quest                tcg_quests%ROWTYPE;
  v_current_chronicles   integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Non authentifie');
  END IF;

  -- Upsert profiles : créer si absent avec 1000, NE PAS toucher si déjà présent
  INSERT INTO profiles (id, chronicles)
  VALUES (v_user_id, 1000)
  ON CONFLICT (id) DO NOTHING;

  -- Upsert tcg_players : créer si absent, sync depuis profiles
  INSERT INTO tcg_players (id, username, chronicles)
  SELECT v_user_id, p.username, p.chronicles
  FROM profiles p
  WHERE p.id = v_user_id
  ON CONFLICT (id) DO NOTHING;

  -- Charger la quête
  SELECT * INTO v_quest FROM tcg_quests WHERE id = p_quest_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Quete introuvable');
  END IF;

  -- Vérifier si déjà réclamée
  IF EXISTS (
    SELECT 1 FROM tcg_quest_completions
    WHERE user_id = v_user_id AND quest_id = p_quest_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Deja reclamee');
  END IF;

  -- Lire le solde actuel pour vérifier la contrainte AVANT l'UPDATE
  SELECT chronicles INTO v_current_chronicles FROM profiles WHERE id = v_user_id;

  -- Sécurité : protège contre un reward_chronicles négatif mal configuré
  IF v_current_chronicles + v_quest.reward_chronicles < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Solde insuffisant');
  END IF;

  -- Créditer sur profiles (source de vérité)
  UPDATE profiles
  SET chronicles = chronicles + v_quest.reward_chronicles
  WHERE id = v_user_id;

  -- Ledger
  INSERT INTO chronicles_ledger (user_id, amount, type, meta)
  VALUES (
    v_user_id,
    v_quest.reward_chronicles,
    'quest',
    jsonb_build_object('quest_id', p_quest_id, 'quest_title', v_quest.title)
  );

  -- Marquer la quête comme complétée
  INSERT INTO tcg_quest_completions (user_id, quest_id)
  VALUES (v_user_id, p_quest_id);

  -- Sync tcg_players.chronicles
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
