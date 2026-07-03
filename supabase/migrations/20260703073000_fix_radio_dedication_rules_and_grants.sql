-- 20260703073000_fix_radio_dedication_rules_and_grants.sql
-- Align Gwen Ha Star radio dedications with frontend rules.
-- Safe migration: no table change, no ledger rewrite.

CREATE OR REPLACE FUNCTION public.submit_radio_dedication(p_message text)
RETURNS TABLE(id uuid, message text, username text, cost integer, new_balance integer, created_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
SET row_security TO 'off'
AS $$
DECLARE
  v_user_id     uuid := auth.uid();
  v_message     text := regexp_replace(trim(coalesce(p_message, '')), '\s+', ' ', 'g');
  v_cost        integer := 20;
  v_balance     integer;
  v_username    text;
  v_id          uuid;
  v_created_at  timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING errcode = '28000';
  END IF;

  IF char_length(v_message) < 3 OR char_length(v_message) > 100 THEN
    RAISE EXCEPTION 'MESSAGE_LENGTH_INVALID' USING errcode = '22023';
  END IF;

  UPDATE public.profiles
     SET chronicles = chronicles - v_cost
   WHERE profiles.id = v_user_id
     AND profiles.chronicles >= v_cost
   RETURNING profiles.chronicles,
             coalesce(nullif(trim(profiles.username), ''), split_part(profiles.email, '@', 1), 'AGENT')
        INTO v_balance, v_username;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INSUFFICIENT_CHRONICLES' USING errcode = 'P0001';
  END IF;

  INSERT INTO public.radio_dedications (user_id, username_snapshot, message, cost)
  VALUES (v_user_id, v_username, v_message, v_cost)
  RETURNING radio_dedications.id, radio_dedications.created_at INTO v_id, v_created_at;

  id := v_id;
  message := v_message;
  username := v_username;
  cost := v_cost;
  new_balance := v_balance;
  created_at := v_created_at;
  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_radio_dedication(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_radio_dedication(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_radio_dedication_for_slot(text, timestamp with time zone) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_radio_dedication_for_slot(text, timestamp with time zone) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.mark_radio_dedication_played(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_radio_dedication_played(uuid) TO authenticated;
