-- 20260702010000_radio_admin_audio_tools.sql
-- Admin audio Gwen Ha Star Radio + nouvelles regles de dedicaces.

-- Helper superuser conserve ici pour rendre la migration autonome si elle est rejouee.
CREATE OR REPLACE FUNCTION public._is_superuser()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT role = 'superuser' FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;
REVOKE EXECUTE ON FUNCTION public._is_superuser() FROM anon, authenticated;

-- Dedicace utilisateur : 20 Chronicles, 100 caracteres max.
CREATE OR REPLACE FUNCTION public.submit_radio_dedication(p_message text)
RETURNS TABLE(id uuid, message text, username text, cost integer, new_balance integer, created_at timestamp with time zone)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' SET row_security TO 'off'
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

-- Liste admin des dedicaces.
CREATE OR REPLACE FUNCTION public.admin_radio_list_dedications(p_status text DEFAULT NULL, p_limit integer DEFAULT 100)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  username text,
  message text,
  cost integer,
  status text,
  slot_key text,
  scheduled_at timestamp with time zone,
  played_at timestamp with time zone,
  created_at timestamp with time zone
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' SET row_security TO 'off'
AS $$
DECLARE
  v_status text := NULLIF(trim(coalesce(p_status, '')), '');
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 250);
BEGIN
  IF NOT public._is_superuser() THEN
    RAISE EXCEPTION 'ACCESS_DENIED' USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT d.id, d.user_id, d.username_snapshot, d.message, d.cost, d.status,
         d.slot_key, d.scheduled_at, d.played_at, d.created_at
    FROM public.radio_dedications d
   WHERE v_status IS NULL OR d.status = v_status
   ORDER BY d.created_at DESC
   LIMIT v_limit;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_radio_list_dedications(text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_radio_list_dedications(text, integer) TO authenticated;

-- Modification admin : statut et/ou message. Le statut hidden masque la dedicace du flux.
CREATE OR REPLACE FUNCTION public.admin_radio_update_dedication(p_id uuid, p_status text DEFAULT NULL, p_message text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' SET row_security TO 'off'
AS $$
DECLARE
  v_status text := NULLIF(trim(coalesce(p_status, '')), '');
  v_message text := CASE WHEN p_message IS NULL THEN NULL ELSE regexp_replace(trim(p_message), '\s+', ' ', 'g') END;
  v_row public.radio_dedications%ROWTYPE;
BEGIN
  IF NOT public._is_superuser() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Acces refuse');
  END IF;

  IF p_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'id requis');
  END IF;

  IF v_status IS NOT NULL AND v_status NOT IN ('queued', 'scheduled', 'played', 'hidden') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Statut invalide');
  END IF;

  IF p_message IS NOT NULL AND (char_length(v_message) < 3 OR char_length(v_message) > 100) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Message entre 3 et 100 caracteres');
  END IF;

  UPDATE public.radio_dedications
     SET status = COALESCE(v_status, status),
         message = COALESCE(v_message, message),
         played_at = CASE
           WHEN v_status = 'played' THEN COALESCE(played_at, now())
           WHEN v_status IN ('queued', 'scheduled') THEN NULL
           ELSE played_at
         END,
         scheduled_at = CASE WHEN v_status = 'queued' THEN NULL ELSE scheduled_at END,
         slot_key = CASE WHEN v_status = 'queued' THEN NULL ELSE slot_key END
   WHERE id = p_id
   RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Dedicace introuvable');
  END IF;

  RETURN jsonb_build_object('ok', true, 'dedication', row_to_json(v_row));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_radio_update_dedication(uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_radio_update_dedication(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_radio_stats()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' SET row_security TO 'off'
AS $$
DECLARE
  v_stats jsonb;
BEGIN
  IF NOT public._is_superuser() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Acces refuse');
  END IF;

  SELECT jsonb_build_object(
    'ok', true,
    'total', count(*),
    'queued', count(*) FILTER (WHERE status = 'queued'),
    'scheduled', count(*) FILTER (WHERE status = 'scheduled'),
    'played', count(*) FILTER (WHERE status = 'played'),
    'hidden', count(*) FILTER (WHERE status = 'hidden'),
    'cost', 20,
    'maxChars', 100
  ) INTO v_stats
  FROM public.radio_dedications;

  RETURN v_stats;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_radio_stats() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_radio_stats() TO authenticated;
