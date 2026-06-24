-- Migration: 2026-06-24_fix_rls_completions_own
-- Fixes RLS policy on quest_completions so users can insert their own completions
-- Previous policy name was ambiguous; replaced with explicit INSERT + SELECT policies

-- Drop old catch-all policy if it exists
DROP POLICY IF EXISTS completions_own ON public.quest_completions;
DROP POLICY IF EXISTS "completions_own" ON public.quest_completions;

-- Allow users to read their own completions
CREATE POLICY completions_select_own
  ON public.quest_completions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Allow users to insert their own completions
-- (claim_quest function is SECURITY DEFINER so this is belt-and-suspenders)
CREATE POLICY completions_insert_own
  ON public.quest_completions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
