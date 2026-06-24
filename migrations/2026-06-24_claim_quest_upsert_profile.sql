-- Migration: 2026-06-24_claim_quest_upsert_profile
-- Adds the claim_quest RPC function with profile upsert (v2)
-- Fixes: profile not found error when claiming a quest reward

CREATE OR REPLACE FUNCTION public.claim_quest(
  p_quest_id TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_quest RECORD;
  v_already_completed BOOLEAN;
  v_reward_gold INT;
  v_reward_gems INT;
  v_reward_cards INT;
BEGIN
  -- Resolve user
  v_user_id := COALESCE(p_user_id, auth.uid());
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Get quest definition
  SELECT * INTO v_quest FROM public.quests WHERE id = p_quest_id AND active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'quest_not_found');
  END IF;

  -- Check if already completed
  SELECT EXISTS(
    SELECT 1 FROM public.quest_completions
    WHERE user_id = v_user_id AND quest_id = p_quest_id
  ) INTO v_already_completed;

  IF v_already_completed THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_completed');
  END IF;

  -- Upsert profile to ensure it exists (avoids FK violation)
  INSERT INTO public.profiles (id, gold, gems)
  VALUES (v_user_id, 0, 0)
  ON CONFLICT (id) DO NOTHING;

  -- Parse rewards
  v_reward_gold  := COALESCE((v_quest.rewards->>'gold')::INT, 0);
  v_reward_gems  := COALESCE((v_quest.rewards->>'gems')::INT, 0);
  v_reward_cards := COALESCE((v_quest.rewards->>'cards')::INT, 0);

  -- Apply rewards to profile
  UPDATE public.profiles
  SET
    gold = gold + v_reward_gold,
    gems = gems + v_reward_gems
  WHERE id = v_user_id;

  -- Record completion
  INSERT INTO public.quest_completions (user_id, quest_id, completed_at)
  VALUES (v_user_id, p_quest_id, NOW());

  RETURN jsonb_build_object(
    'success', true,
    'reward_gold',  v_reward_gold,
    'reward_gems',  v_reward_gems,
    'reward_cards', v_reward_cards
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_quest(TEXT, UUID) TO authenticated;
