-- =============================================================================
-- BASELINE SCHEMA — gwen-ha-star (nmdjrcswlnydglrxaivx)
-- Captured 2026-06-26 — represents the full current state of the DB
-- Future changes should be added as new numbered migration files
-- =============================================================================

-- ---------------------------------------------------------------------------
-- SEQUENCES
-- ---------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS public.activity_log_id_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.npc_sales_log_id_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.species_id_seq START WITH 1 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.testers_id_seq START WITH 1 INCREMENT BY 1;

-- ---------------------------------------------------------------------------
-- TABLES
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.activity_log (
  id bigint NOT NULL DEFAULT nextval('activity_log_id_seq'::regclass),
  type text NOT NULL,
  payload jsonb,
  created_at timestamp with time zone DEFAULT now(),
  user_id uuid
);

CREATE TABLE IF NOT EXISTS public.agent_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  label_fr text NOT NULL,
  label_en text NOT NULL,
  description_fr text,
  icon text,
  color text DEFAULT '#6b7280'::text,
  is_selectable boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_titles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  agent_id uuid,
  title_id uuid,
  unlocked_at timestamp with time zone DEFAULT now(),
  source text DEFAULT 'achievement'::text
);

CREATE TABLE IF NOT EXISTS public.botanica_leaderboard (
  rank bigint,
  display_name text,
  avatar_url text,
  codex_count integer,
  level integer,
  xp integer
);

CREATE TABLE IF NOT EXISTS public.botanica_mutation_pots (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  species_a_id integer,
  species_b_id integer,
  started_at timestamp with time zone DEFAULT now(),
  ready_at timestamp with time zone DEFAULT (now() + '12:00:00'::interval),
  status text DEFAULT 'growing'::text,
  result_species_id integer,
  growth_stage integer DEFAULT 0,
  quality_tier_id smallint
);

CREATE TABLE IF NOT EXISTS public.botanica_npc_sales_log (
  id bigint NOT NULL DEFAULT nextval('npc_sales_log_id_seq'::regclass),
  user_id uuid,
  species_id integer,
  quality_tier_id smallint,
  price_sold integer,
  sold_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.botanica_player_codex (
  user_id uuid NOT NULL,
  species_id integer NOT NULL,
  unlocked_at timestamp with time zone DEFAULT now(),
  was_first_server boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.botanica_player_data (
  user_id uuid NOT NULL,
  coins integer NOT NULL DEFAULT 100,
  xp integer NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 1,
  codex_count integer NOT NULL DEFAULT 0,
  last_active timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  last_seed_claimed_at timestamp with time zone,
  pot_slots integer NOT NULL DEFAULT 1,
  onboarding_done boolean NOT NULL DEFAULT false,
  onboarded_at timestamp with time zone,
  onboarding_done_at timestamp with time zone,
  onboarding_completed boolean NOT NULL DEFAULT false,
  display_name text,
  avatar_url text
);

CREATE TABLE IF NOT EXISTS public.botanica_player_flowers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  species_id integer NOT NULL,
  quality_tier_id smallint NOT NULL DEFAULT 1,
  quantity integer NOT NULL DEFAULT 1,
  obtained_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.botanica_player_garden (
  user_id uuid NOT NULL,
  updated_at timestamp with time zone DEFAULT now(),
  effects jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.botanica_player_seeds (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  species_id integer,
  quantity integer DEFAULT 1,
  obtained_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.botanica_species (
  id integer NOT NULL DEFAULT nextval('species_id_seq'::regclass),
  slug text NOT NULL,
  name text NOT NULL,
  tier integer NOT NULL DEFAULT 0,
  rarity text,
  description text,
  parent_a_id integer,
  parent_b_id integer,
  sprite_key text,
  body_color text DEFAULT '#7ec850'::text,
  stem_color text DEFAULT '#4a7c2f'::text,
  eye_color text DEFAULT '#222'::text,
  discovered_by uuid,
  discovered_at timestamp with time zone,
  is_base_species boolean DEFAULT false,
  discovered_by_username text,
  sigil text,
  visual_effect text,
  emoji text DEFAULT '🌱'::text
);

CREATE TABLE IF NOT EXISTS public.botanica_tasting_log (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tester_id integer,
  species_id integer,
  reaction_text text,
  happiness_delta integer,
  tasted_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.botanica_testers (
  id integer NOT NULL DEFAULT nextval('testers_id_seq'::regclass),
  user_id uuid,
  name text NOT NULL,
  happiness integer DEFAULT 50,
  last_tasted_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.botanica_world_prices (
  species_en text NOT NULL,
  price_modifier double precision NOT NULL DEFAULT 1.0,
  total_sold integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cards (
  id text NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  rarity text NOT NULL,
  description text,
  power integer NOT NULL DEFAULT 0,
  shield integer NOT NULL DEFAULT 0,
  energy integer NOT NULL DEFAULT 0,
  set_code text,
  is_banned boolean NOT NULL DEFAULT false,
  artwork_url text,
  skill jsonb,
  slots integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chronicles_ledger (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount integer NOT NULL,
  type text NOT NULL,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clicker_players (
  id uuid NOT NULL,
  total_clicks bigint NOT NULL DEFAULT 0,
  upgrades_bought integer NOT NULL DEFAULT 0,
  current_score bigint NOT NULL DEFAULT 0,
  prestige_count integer NOT NULL DEFAULT 0,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  saved_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.daily_content (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  date date NOT NULL DEFAULT CURRENT_DATE,
  title text,
  url text NOT NULL,
  platform text NOT NULL,
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pack_types (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  set_id text NOT NULL,
  image_name text,
  price integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pokegang_gang_defenses (
  user_id uuid NOT NULL,
  gang_name text NOT NULL DEFAULT 'Team ???'::text,
  boss_name text NOT NULL DEFAULT 'Boss'::text,
  boss_sprite text,
  reputation_snapshot bigint NOT NULL DEFAULT 0,
  defense_pokemon jsonb NOT NULL DEFAULT '[]'::jsonb,
  defense_agent jsonb,
  defense_zone text,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  boss_title text
);

CREATE TABLE IF NOT EXISTS public.pokegang_gang_raids (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  attacker_id uuid NOT NULL,
  defender_id uuid NOT NULL,
  attacker_gang text NOT NULL DEFAULT 'Team ???'::text,
  defender_gang text NOT NULL DEFAULT 'Team ???'::text,
  result text NOT NULL,
  rep_delta integer NOT NULL DEFAULT 0,
  money_penalty integer NOT NULL DEFAULT 0,
  defender_snap_rep bigint NOT NULL DEFAULT 0,
  executed_at timestamp with time zone NOT NULL DEFAULT now(),
  seen_by_defender boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.pokegang_leaderboard (
  token text NOT NULL,
  user_id uuid,
  gang_name text,
  boss_name text,
  boss_sprite text,
  reputation bigint DEFAULT 0,
  total_caught integer DEFAULT 0,
  shiny_count integer DEFAULT 0,
  shiny_species_count integer DEFAULT 0,
  dex_kanto_count integer DEFAULT 0,
  dex_national_count integer DEFAULT 0,
  agents_count integer DEFAULT 0,
  is_anonymous boolean DEFAULT true,
  updated_at timestamp with time zone DEFAULT now(),
  total_sold bigint DEFAULT 0,
  total_money_earned bigint DEFAULT 0,
  month_key text DEFAULT ''::text,
  rep_monthly bigint DEFAULT 0,
  caught_monthly integer DEFAULT 0,
  shiny_monthly integer DEFAULT 0,
  shiny_species_monthly integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.pokegang_players (
  user_id uuid NOT NULL,
  gang_name text NOT NULL DEFAULT 'Team ???'::text,
  boss_name text NOT NULL DEFAULT 'Boss'::text,
  reputation bigint NOT NULL DEFAULT 0,
  total_caught integer NOT NULL DEFAULT 0,
  total_sold integer NOT NULL DEFAULT 0,
  shiny_count integer NOT NULL DEFAULT 0,
  shiny_species_count integer NOT NULL DEFAULT 0,
  dex_kanto_count integer NOT NULL DEFAULT 0,
  dex_national_count integer NOT NULL DEFAULT 0,
  agents_count integer NOT NULL DEFAULT 0,
  agents_elite_count integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pokegang_save_snapshots (
  id bigint NOT NULL,
  user_id uuid NOT NULL,
  slot smallint NOT NULL DEFAULT 0,
  state jsonb NOT NULL,
  gang_name text,
  rep integer DEFAULT 0,
  saved_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pokegang_saves (
  user_id uuid NOT NULL,
  slot smallint NOT NULL DEFAULT 0,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  saved_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profile_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  role_slug text NOT NULL,
  assigned_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.profile_titles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  profile_id uuid,
  title_slug text,
  unlocked_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  email text,
  role text DEFAULT 'guest'::text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  username text,
  avatar_url text,
  specialty text DEFAULT 'Recrue'::text,
  bio text,
  lang text DEFAULT 'fr'::text,
  titles text[] DEFAULT ARRAY['Recrue'::text],
  active_title text DEFAULT 'Recrue'::text,
  joined_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  lol_id text,
  rl_id text,
  gaming_cache jsonb DEFAULT '{}'::jsonb,
  specialty_id uuid,
  chronicles integer NOT NULL DEFAULT 1000,
  onboarding_done boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code_name text NOT NULL,
  display_name text NOT NULL,
  description_fr text,
  description_en text,
  is_active boolean NOT NULL DEFAULT false,
  require_login boolean NOT NULL DEFAULT false,
  url text,
  icon text,
  category text DEFAULT 'game'::text,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.radio_dedications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  username_snapshot text NOT NULL DEFAULT 'AGENT'::text,
  message text NOT NULL,
  cost integer NOT NULL DEFAULT 200,
  status text NOT NULL DEFAULT 'queued'::text,
  slot_key text,
  scheduled_at timestamp with time zone,
  played_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.specialties (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  label_fr text NOT NULL,
  label_en text NOT NULL,
  description_fr text,
  icon text,
  color text DEFAULT '#6b7280'::text,
  is_selectable boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tcg_duels (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  attacker_id uuid NOT NULL,
  defender_id uuid,
  result text NOT NULL,
  deck_used jsonb,
  played_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tcg_player_cards (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  card_id text NOT NULL,
  set_id text NOT NULL,
  rarity text,
  quantity integer NOT NULL DEFAULT 1,
  obtained_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tcg_player_packs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL,
  pack_type_id uuid NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tcg_players (
  id uuid NOT NULL,
  username text,
  cards_count integer NOT NULL DEFAULT 0,
  duels_won integer NOT NULL DEFAULT 0,
  has_legendary boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  last_daily_at timestamp with time zone,
  pack_count integer NOT NULL DEFAULT 0,
  daily_streak integer NOT NULL DEFAULT 0,
  chronicles integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.tcg_quest_completions (
  user_id uuid NOT NULL,
  quest_id text NOT NULL,
  claimed_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tcg_quests (
  id text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  reward_chronicles integer NOT NULL DEFAULT 0,
  is_tuto boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.titles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  label_fr text NOT NULL,
  label_en text NOT NULL,
  description_fr text,
  description_en text,
  category text DEFAULT 'general'::text,
  rarity text DEFAULT 'common'::text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  unlock_type text DEFAULT 'achievement'::text,
  price_coins integer,
  is_active boolean DEFAULT true
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.botanica_leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.botanica_mutation_pots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.botanica_npc_sales_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.botanica_player_codex ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.botanica_player_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.botanica_player_flowers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.botanica_player_garden ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.botanica_player_seeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.botanica_species ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.botanica_tasting_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.botanica_testers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.botanica_world_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chronicles_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clicker_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pack_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pokegang_gang_defenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pokegang_gang_raids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pokegang_leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pokegang_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pokegang_save_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pokegang_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radio_dedications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specialties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tcg_duels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tcg_player_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tcg_player_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tcg_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tcg_quest_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tcg_quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.titles ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- FUNCTIONS
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_botanica_player()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'auth' AS $$
BEGIN
  INSERT INTO public.botanica_player_data (user_id, coins, xp, level, pot_slots)
  VALUES (NEW.id, 0, 0, 1, 1)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_chronicles_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.profiles
  SET chronicles = (
    SELECT COALESCE(SUM(amount), 0)
    FROM public.chronicles_ledger
    WHERE user_id = NEW.user_id
  )
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_chronicles_to_tcg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.chronicles IS DISTINCT FROM OLD.chronicles THEN
    UPDATE tcg_players SET chronicles = NEW.chronicles, updated_at = now()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_title(p_user_id uuid, p_slug text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.profile_titles (profile_id, title_slug)
  VALUES (p_user_id, p_slug)
  ON CONFLICT DO NOTHING;
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_primo_explorateur_on_profile_create()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_email text;
BEGIN
  SELECT email INTO v_email FROM auth.users WHERE id = NEW.id;
  IF v_email IN (
    'pierrehoyaux@hotmail.fr',
    'martin.b.spd@orange.fr',
    'mutenrock08@gmail.com',
    'giosaleo@gmail.com',
    'mutenrock07@gmail.com',
    'gabriel.gerard5156@gmail.com'
  ) THEN
    INSERT INTO public.profile_titles (profile_id, title_slug)
    VALUES (NEW.id, 'primo-explorateur')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_tcg_player()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_player  tcg_players%ROWTYPE;
  v_name    text;
  v_is_new  boolean := false;
BEGIN
  IF v_user_id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','Non authentifié'); END IF;
  SELECT * INTO v_player FROM tcg_players WHERE id = v_user_id;
  IF NOT FOUND THEN
    SELECT username INTO v_name FROM profiles WHERE id = v_user_id;
    IF v_name IS NULL THEN v_name := 'Agent#' || substring(v_user_id::text,1,6); END IF;
    INSERT INTO tcg_players (id, username, chronicles, cards_count, has_legendary, duels_won)
      VALUES (v_user_id, v_name, 150, 0, false, 0) ON CONFLICT (id) DO NOTHING;
    SELECT * INTO v_player FROM tcg_players WHERE id = v_user_id;
    v_is_new := true;
  END IF;
  RETURN jsonb_build_object('ok',true,'chronicles',v_player.chronicles,'is_new',v_is_new);
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_quest(p_quest_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' SET row_security TO 'off' AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_quest   tcg_quests%ROWTYPE;
  v_balance integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Non authentifie');
  END IF;

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
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' SET row_security TO 'off' AS $$
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

CREATE OR REPLACE FUNCTION public.complete_onboarding()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result  jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Non authentifie');
  END IF;

  INSERT INTO profiles (id, chronicles, onboarding_done)
  VALUES (v_user_id, 0, false)
  ON CONFLICT (id) DO UPDATE
    SET chronicles = COALESCE(profiles.chronicles, 0);

  SELECT public.claim_quest('tuto_01') INTO v_result;

  UPDATE profiles
  SET onboarding_done = true
  WHERE id = v_user_id;

  RETURN jsonb_build_object('ok', true, 'quest_result', v_result);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_grant_chronicles(p_target_user_id uuid, p_amount integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_caller_role text;
  v_new_bal     integer;
BEGIN
  SELECT role INTO v_caller_role FROM profiles WHERE id = auth.uid();
  IF v_caller_role IS DISTINCT FROM 'superuser' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Accès refusé');
  END IF;

  UPDATE profiles
  SET chronicles = GREATEST(0, chronicles + p_amount)
  WHERE id = p_target_user_id
  RETURNING chronicles INTO v_new_bal;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Utilisateur introuvable');
  END IF;

  INSERT INTO chronicles_ledger (user_id, amount, type, meta)
  VALUES (p_target_user_id, p_amount, 'admin_grant',
          jsonb_build_object('granted_by', auth.uid()));

  UPDATE tcg_players SET chronicles = v_new_bal, updated_at = now()
  WHERE id = p_target_user_id;

  RETURN jsonb_build_object('ok', true, 'chronicles', v_new_bal);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_tcg_leaderboard(p_limit integer DEFAULT 50)
RETURNS TABLE(id uuid, username text, cards_count integer, gold integer, duels_won integer, has_legendary boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT
    p.id,
    p.username,
    COALESCE(SUM(c.quantity), 0)::int                                          AS cards_count,
    COALESCE(pr.chronicles, 0)::int                                            AS gold,
    COALESCE(p.duels_won, 0)::int                                              AS duels_won,
    COALESCE(bool_or(c.quantity > 0 AND lower(c.rarity) = 'legendary'), false) AS has_legendary
  FROM tcg_players p
  LEFT JOIN tcg_player_cards c ON c.user_id = p.id
  LEFT JOIN profiles pr        ON pr.id      = p.id
  GROUP BY p.id, p.username, pr.chronicles, p.duels_won
  ORDER BY cards_count DESC, gold DESC
  LIMIT GREATEST(p_limit, 0);
$$;

CREATE OR REPLACE FUNCTION public.tcg_buy_pack(p_player_id uuid, p_pack_type_id uuid, p_cost integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_chronicles integer;
BEGIN
  SELECT chronicles INTO v_chronicles
  FROM public.tcg_players
  WHERE id = p_player_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'player_not_found');
  END IF;

  IF v_chronicles < p_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient_chronicles', 'balance', v_chronicles);
  END IF;

  UPDATE public.tcg_players
  SET chronicles = chronicles - p_cost,
      pack_count = pack_count + 1,
      updated_at = now()
  WHERE id = p_player_id;

  INSERT INTO public.tcg_player_packs (player_id, pack_type_id, quantity, updated_at)
  VALUES (p_player_id, p_pack_type_id, 1, now())
  ON CONFLICT (player_id, pack_type_id)
  DO UPDATE SET quantity = tcg_player_packs.quantity + 1, updated_at = now();

  RETURN jsonb_build_object('success', true, 'spent', p_cost, 'balance', v_chronicles - p_cost);
END;
$$;

CREATE OR REPLACE FUNCTION public.tcg_duel_reward()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_winner_id uuid;
  v_reward    integer := 50;
BEGIN
  IF NEW.result = 'attacker_win' THEN
    v_winner_id := NEW.attacker_id;
  ELSIF NEW.result = 'defender_win' THEN
    v_winner_id := NEW.defender_id;
  ELSE
    RETURN NEW;
  END IF;

  UPDATE public.tcg_players
  SET chronicles = chronicles + v_reward,
      duels_won  = duels_won + 1,
      updated_at = now()
  WHERE id = v_winner_id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_radio_dedication_for_slot(p_slot_key text, p_scheduled_at timestamp with time zone DEFAULT now())
RETURNS TABLE(id uuid, message text, username text, cost integer, status text, slot_key text, scheduled_at timestamp with time zone, created_at timestamp with time zone)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
declare
  v_slot_key text := trim(coalesce(p_slot_key, ''));
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if char_length(v_slot_key) < 6 or char_length(v_slot_key) > 120 then
    raise exception 'INVALID_SLOT_KEY' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext(v_slot_key));

  return query
  select d.id, d.message, d.username_snapshot, d.cost, d.status, d.slot_key, d.scheduled_at, d.created_at
    from public.radio_dedications d
   where d.slot_key = v_slot_key and d.status in ('scheduled', 'played')
   limit 1;

  if found then return; end if;

  return query
  with next_item as (
    select d.id from public.radio_dedications d
     where d.status = 'queued'
     order by d.created_at asc
     for update skip locked limit 1
  ),
  claimed as (
    update public.radio_dedications d
       set status = 'scheduled', slot_key = v_slot_key, scheduled_at = coalesce(p_scheduled_at, now())
      from next_item where d.id = next_item.id
     returning d.id, d.message, d.username_snapshot, d.cost, d.status, d.slot_key, d.scheduled_at, d.created_at
  )
  select claimed.id, claimed.message, claimed.username_snapshot, claimed.cost,
         claimed.status, claimed.slot_key, claimed.scheduled_at, claimed.created_at from claimed;
end;
$$;

CREATE OR REPLACE FUNCTION public.mark_radio_dedication_played(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  update public.radio_dedications
     set status = 'played', played_at = coalesce(played_at, now())
   where id = p_id and status in ('scheduled', 'played');
end;
$$;

CREATE OR REPLACE FUNCTION public.submit_radio_dedication(p_message text)
RETURNS TABLE(id uuid, message text, username text, cost integer, new_balance integer, created_at timestamp with time zone)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
declare
  v_user_id    uuid := auth.uid();
  v_message    text := regexp_replace(trim(coalesce(p_message, '')), '\s+', ' ', 'g');
  v_cost       integer := 200;
  v_balance    integer;
  v_username   text;
  v_id         uuid;
  v_created_at timestamptz;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if char_length(v_message) < 3 or char_length(v_message) > 160 then
    raise exception 'MESSAGE_LENGTH_INVALID' using errcode = '22023';
  end if;

  update public.profiles
     set chronicles = chronicles - v_cost
   where profiles.id = v_user_id and profiles.chronicles >= v_cost
   returning profiles.chronicles,
             coalesce(nullif(trim(profiles.username), ''), split_part(profiles.email, '@', 1), 'AGENT')
        into v_balance, v_username;

  if not found then raise exception 'INSUFFICIENT_CHRONICLES' using errcode = 'P0001'; end if;

  insert into public.radio_dedications (user_id, username_snapshot, message, cost)
  values (v_user_id, v_username, v_message, v_cost)
  returning radio_dedications.id, radio_dedications.created_at into v_id, v_created_at;

  id := v_id; message := v_message; username := v_username;
  cost := v_cost; new_balance := v_balance; created_at := v_created_at;
  return next;
end;
$$;

-- Botanica title triggers
CREATE OR REPLACE FUNCTION public.trg_fn_botanica_alchimiste()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'harvested' AND (OLD.status IS DISTINCT FROM 'harvested')
     AND NEW.result_species_id IS NOT NULL
     AND NEW.result_species_id <> NEW.species_a_id
     AND NEW.result_species_id <> NEW.species_b_id
  THEN
    PERFORM public.grant_title(NEW.user_id, 'botanica-alchimiste');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_fn_botanica_semeur()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'harvested' AND (OLD.status IS DISTINCT FROM 'harvested') THEN
    PERFORM public.grant_title(NEW.user_id, 'botanica-semeur');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_fn_botanica_marchand()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.grant_title(NEW.user_id, 'botanica-marchand');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_fn_botanica_codex()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.codex_count >= 10 THEN PERFORM public.grant_title(NEW.user_id, 'botanica-collectionneur'); END IF;
  IF NEW.codex_count >= 50 THEN PERFORM public.grant_title(NEW.user_id, 'botanica-maître-jardinier'); END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_fn_clicker_titles()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.total_clicks >= 1000     AND OLD.total_clicks < 1000     THEN PERFORM public.grant_title(NEW.id, 'clicker-débutant'); END IF;
  IF NEW.total_clicks >= 100000   AND OLD.total_clicks < 100000   THEN PERFORM public.grant_title(NEW.id, 'clicker-acharné'); END IF;
  IF NEW.total_clicks >= 1000000  AND OLD.total_clicks < 1000000  THEN PERFORM public.grant_title(NEW.id, 'clicker-obsessionnel'); END IF;
  IF NEW.upgrades_bought >= 1 AND OLD.upgrades_bought = 0 THEN PERFORM public.grant_title(NEW.id, 'clicker-automatisé'); END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_fn_pokegang_recrue()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.grant_title(NEW.user_id, 'pokegang-recrue');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_fn_pokegang_stats()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.total_caught >= 100  AND OLD.total_caught < 100  THEN PERFORM public.grant_title(NEW.user_id, 'pokegang-chasseur'); END IF;
  IF NEW.reputation >= 10000  AND OLD.reputation < 10000  THEN PERFORM public.grant_title(NEW.user_id, 'pokegang-gangster'); END IF;
  IF NEW.shiny_count >= 1     AND OLD.shiny_count = 0     THEN PERFORM public.grant_title(NEW.user_id, 'pokegang-shiny-hunter'); END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_fn_pokegang_legende()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_rank int;
BEGIN
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  SELECT COUNT(*) + 1 INTO v_rank FROM public.pokegang_leaderboard
  WHERE reputation > NEW.reputation AND user_id IS NOT NULL;
  IF v_rank <= 10 THEN PERFORM public.grant_title(NEW.user_id, 'pokegang-légende'); END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_fn_tcg_collectionneur()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.grant_title(NEW.user_id, 'tcg-collectionneur');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_fn_tcg_duels()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.duels_won >= 1  AND OLD.duels_won = 0  THEN PERFORM public.grant_title(NEW.id, 'tcg-duelliste'); END IF;
  IF NEW.duels_won >= 10 AND OLD.duels_won < 10 THEN PERFORM public.grant_title(NEW.id, 'tcg-stratège'); END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_fn_tcg_legendaire()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.has_legendary = true AND OLD.has_legendary = false THEN
    PERFORM public.grant_title(NEW.id, 'tcg-légendaire');
  END IF;
  RETURN NEW;
END;
$$;

-- refresh_codex_botanique — kept but references stale table names (botanica_species, botanica_player_codex)
-- TODO: fix to use correct table names if this function is needed
CREATE OR REPLACE FUNCTION public.refresh_codex_botanique()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE botanica_species s
  SET discovered_by_username = p.username
  FROM profiles p
  WHERE p.id = s.discovered_by
    AND s.discovered_by IS NOT NULL
    AND (s.discovered_by_username IS NULL OR s.discovered_by_username != p.username);

  UPDATE botanica_player_data bpd
  SET codex_count = (
    SELECT COUNT(*) FROM botanica_player_codex pc WHERE pc.user_id = bpd.user_id
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- TRIGGERS
-- ---------------------------------------------------------------------------

CREATE TRIGGER trg_botanica_alchimiste
  AFTER UPDATE ON public.botanica_mutation_pots
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_botanica_alchimiste();

CREATE TRIGGER trg_botanica_semeur
  AFTER UPDATE ON public.botanica_mutation_pots
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_botanica_semeur();

CREATE TRIGGER trg_botanica_marchand
  AFTER INSERT ON public.botanica_npc_sales_log
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_botanica_marchand();

CREATE TRIGGER trg_botanica_codex
  AFTER UPDATE ON public.botanica_player_data
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_botanica_codex();

CREATE TRIGGER cards_updated_at
  BEFORE UPDATE ON public.cards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_sync_chronicles
  AFTER INSERT ON public.chronicles_ledger
  FOR EACH ROW EXECUTE FUNCTION public.sync_chronicles_balance();

CREATE TRIGGER trg_clicker_titles
  AFTER UPDATE ON public.clicker_players
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_clicker_titles();

CREATE TRIGGER trg_pokegang_legende
  AFTER INSERT ON public.pokegang_leaderboard
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_pokegang_legende();

CREATE TRIGGER trg_pokegang_stats
  AFTER UPDATE ON public.pokegang_players
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_pokegang_stats();

CREATE TRIGGER trg_pokegang_recrue
  AFTER INSERT ON public.pokegang_saves
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_pokegang_recrue();

CREATE TRIGGER on_auth_user_created_botanica
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_botanica_player();

CREATE TRIGGER trg_primo_explorateur_on_profile_create
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.assign_primo_explorateur_on_profile_create();

CREATE TRIGGER trg_profiles_chronicles_to_tcg
  AFTER UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_chronicles_to_tcg();

CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_tcg_duel_reward
  AFTER INSERT ON public.tcg_duels
  FOR EACH ROW EXECUTE FUNCTION public.tcg_duel_reward();

CREATE TRIGGER trg_tcg_collectionneur
  AFTER INSERT ON public.tcg_player_cards
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_tcg_collectionneur();

CREATE TRIGGER trg_tcg_duels
  AFTER UPDATE ON public.tcg_players
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_tcg_duels();

CREATE TRIGGER trg_tcg_legendaire
  AFTER UPDATE ON public.tcg_players
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_tcg_legendaire();

-- ---------------------------------------------------------------------------
-- RLS POLICIES — activity_log
-- ---------------------------------------------------------------------------

CREATE POLICY "al_insert" ON public.activity_log FOR INSERT TO public WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "al_select_own" ON public.activity_log FOR SELECT TO public USING (((user_id = auth.uid()) OR (auth.uid() IN (SELECT profiles.id FROM profiles WHERE (profiles.role = 'superuser'::text)))));
CREATE POLICY "auth read" ON public.activity_log FOR SELECT TO authenticated USING (true);

-- agent_roles
CREATE POLICY "ar_select" ON public.agent_roles FOR SELECT TO public USING (true);
CREATE POLICY "ar_write" ON public.agent_roles FOR ALL TO public USING ((auth.uid() IN (SELECT profiles.id FROM profiles WHERE (profiles.role = 'superuser'::text))));

-- agent_titles
CREATE POLICY "agent_titles_delete_superuser" ON public.agent_titles FOR DELETE TO authenticated USING (((SELECT profiles.role FROM profiles WHERE (profiles.id = auth.uid())) = 'superuser'::text));
CREATE POLICY "agent_titles_insert_superuser" ON public.agent_titles FOR INSERT TO authenticated WITH CHECK (((SELECT profiles.role FROM profiles WHERE (profiles.id = auth.uid())) = 'superuser'::text));
CREATE POLICY "agent_titles_select_own" ON public.agent_titles FOR SELECT TO authenticated USING ((agent_id = auth.uid()));
CREATE POLICY "agent_titles_select_superuser" ON public.agent_titles FOR SELECT TO authenticated USING (((SELECT profiles.role FROM profiles WHERE (profiles.id = auth.uid())) = 'superuser'::text));

-- botanica_mutation_pots
CREATE POLICY "mutation_pots_own" ON public.botanica_mutation_pots FOR ALL TO public USING ((auth.uid() = user_id));

-- botanica_npc_sales_log
CREATE POLICY "owner" ON public.botanica_npc_sales_log FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

-- botanica_player_codex
CREATE POLICY "codex_public_read" ON public.botanica_player_codex FOR SELECT TO public USING (true);
CREATE POLICY "player_codex_insert" ON public.botanica_player_codex FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));

-- botanica_player_data
CREATE POLICY "botanica_player_data: own row" ON public.botanica_player_data FOR ALL TO public USING ((auth.uid() = user_id));

-- botanica_player_flowers
CREATE POLICY "flowers_delete_own" ON public.botanica_player_flowers FOR DELETE TO public USING ((auth.uid() = user_id));
CREATE POLICY "flowers_insert_own" ON public.botanica_player_flowers FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "flowers_select_own" ON public.botanica_player_flowers FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "flowers_update_own" ON public.botanica_player_flowers FOR UPDATE TO public USING ((auth.uid() = user_id));

-- botanica_player_garden
CREATE POLICY "botanica_player_garden_insert_own" ON public.botanica_player_garden FOR INSERT TO authenticated WITH CHECK (((SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "botanica_player_garden_select_own" ON public.botanica_player_garden FOR SELECT TO authenticated USING (((SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "botanica_player_garden_update_own" ON public.botanica_player_garden FOR UPDATE TO authenticated USING (((SELECT auth.uid() AS uid) = user_id)) WITH CHECK (((SELECT auth.uid() AS uid) = user_id));

-- botanica_player_seeds
CREATE POLICY "botanica_player_seeds_delete_own" ON public.botanica_player_seeds FOR DELETE TO authenticated USING (((SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "botanica_player_seeds_insert_own" ON public.botanica_player_seeds FOR INSERT TO authenticated WITH CHECK (((SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "botanica_player_seeds_select_own" ON public.botanica_player_seeds FOR SELECT TO authenticated USING (((SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "botanica_player_seeds_update_own" ON public.botanica_player_seeds FOR UPDATE TO authenticated USING (((SELECT auth.uid() AS uid) = user_id)) WITH CHECK (((SELECT auth.uid() AS uid) = user_id));

-- botanica_species
CREATE POLICY "species_public_read" ON public.botanica_species FOR SELECT TO public USING (true);

-- botanica_tasting_log
CREATE POLICY "tasting_public_read" ON public.botanica_tasting_log FOR SELECT TO public USING (true);

-- botanica_testers
CREATE POLICY "testers_own" ON public.botanica_testers FOR ALL TO public USING ((auth.uid() = user_id));

-- botanica_world_prices
CREATE POLICY "world_prices: lecture publique" ON public.botanica_world_prices FOR SELECT TO public USING (true);
CREATE POLICY "world_prices: mise à jour connecté" ON public.botanica_world_prices FOR INSERT TO public WITH CHECK ((auth.role() = 'authenticated'::text));
CREATE POLICY "world_prices: update connecté" ON public.botanica_world_prices FOR UPDATE TO public USING ((auth.role() = 'authenticated'::text));

-- cards
CREATE POLICY "cards_read_authenticated" ON public.cards FOR SELECT TO authenticated USING (true);
CREATE POLICY "cards_write_service_role" ON public.cards FOR ALL TO service_role USING (true) WITH CHECK (true);

-- chronicles_ledger
CREATE POLICY "cl_insert" ON public.chronicles_ledger FOR INSERT TO public WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "cl_select" ON public.chronicles_ledger FOR SELECT TO public USING ((user_id = auth.uid()));

-- clicker_players
CREATE POLICY "clicker_insert" ON public.clicker_players FOR INSERT TO public WITH CHECK ((auth.uid() = id));
CREATE POLICY "clicker_select" ON public.clicker_players FOR SELECT TO public USING ((auth.uid() = id));
CREATE POLICY "clicker_update" ON public.clicker_players FOR UPDATE TO public USING ((auth.uid() = id));

-- daily_content
CREATE POLICY "daily_content public read" ON public.daily_content FOR SELECT TO public USING (true);

-- pack_types
CREATE POLICY "pack_types_select_public" ON public.pack_types FOR SELECT TO public USING (true);

-- pokegang_gang_defenses
CREATE POLICY "gang_defenses_delete_own" ON public.pokegang_gang_defenses FOR DELETE TO authenticated USING (((SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "gang_defenses_insert_own" ON public.pokegang_gang_defenses FOR INSERT TO authenticated WITH CHECK (((SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "gang_defenses_read_public" ON public.pokegang_gang_defenses FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "gang_defenses_update_own" ON public.pokegang_gang_defenses FOR UPDATE TO authenticated USING (((SELECT auth.uid() AS uid) = user_id)) WITH CHECK (((SELECT auth.uid() AS uid) = user_id));

-- pokegang_gang_raids
CREATE POLICY "gang_raids_insert_attacker" ON public.pokegang_gang_raids FOR INSERT TO authenticated WITH CHECK (((SELECT auth.uid() AS uid) = attacker_id));
CREATE POLICY "gang_raids_select_participant" ON public.pokegang_gang_raids FOR SELECT TO authenticated USING ((((SELECT auth.uid() AS uid) = attacker_id) OR ((SELECT auth.uid() AS uid) = defender_id)));
CREATE POLICY "gang_raids_update_defender" ON public.pokegang_gang_raids FOR UPDATE TO authenticated USING (((SELECT auth.uid() AS uid) = defender_id)) WITH CHECK (((SELECT auth.uid() AS uid) = defender_id));

-- pokegang_leaderboard
CREATE POLICY "lb_insert" ON public.pokegang_leaderboard FOR INSERT TO public WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "lb_read" ON public.pokegang_leaderboard FOR SELECT TO public USING (true);
CREATE POLICY "lb_update" ON public.pokegang_leaderboard FOR UPDATE TO public USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

-- pokegang_players
CREATE POLICY "players_delete_own" ON public.pokegang_players FOR DELETE TO authenticated USING (((SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "players_insert_own" ON public.pokegang_players FOR INSERT TO authenticated WITH CHECK (((SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "players_select_own" ON public.pokegang_players FOR SELECT TO authenticated USING (((SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "players_update_own" ON public.pokegang_players FOR UPDATE TO authenticated USING (((SELECT auth.uid() AS uid) = user_id)) WITH CHECK (((SELECT auth.uid() AS uid) = user_id));

-- pokegang_save_snapshots
CREATE POLICY "ss_own" ON public.pokegang_save_snapshots FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

-- pokegang_saves
CREATE POLICY "player_saves: lecture personnelle" ON public.pokegang_saves FOR SELECT TO public USING ((auth.uid() = user_id));
CREATE POLICY "player_saves: mise à jour personnelle" ON public.pokegang_saves FOR UPDATE TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));
CREATE POLICY "player_saves: suppression personnelle" ON public.pokegang_saves FOR DELETE TO public USING ((auth.uid() = user_id));
CREATE POLICY "player_saves: écriture personnelle" ON public.pokegang_saves FOR INSERT TO public WITH CHECK ((auth.uid() = user_id));

-- profile_roles
CREATE POLICY "pr_select" ON public.profile_roles FOR SELECT TO public USING (true);
CREATE POLICY "pr_write" ON public.profile_roles FOR ALL TO public USING ((auth.uid() IN (SELECT profiles.id FROM profiles WHERE (profiles.role = 'superuser'::text))));

-- profile_titles
CREATE POLICY "Lecture publique profile_titles" ON public.profile_titles FOR SELECT TO public USING (true);
CREATE POLICY "Superuser gère profile_titles" ON public.profile_titles FOR ALL TO public USING ((EXISTS (SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'superuser'::text)))));

-- profiles
CREATE POLICY "Lecture publique des profils" ON public.profiles FOR SELECT TO public USING (true);
CREATE POLICY "Les utilisateurs modifient leur propre profil" ON public.profiles FOR UPDATE TO public USING ((auth.uid() = id));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((role = (SELECT profiles_1.role FROM profiles profiles_1 WHERE (profiles_1.id = auth.uid()))));
CREATE POLICY "users can upsert own profile" ON public.profiles FOR INSERT TO public WITH CHECK ((auth.uid() = id));

-- projects
CREATE POLICY "proj_select" ON public.projects FOR SELECT TO public USING (true);
CREATE POLICY "proj_write" ON public.projects FOR ALL TO public USING ((auth.uid() IN (SELECT profiles.id FROM profiles WHERE (profiles.role = 'superuser'::text))));

-- radio_dedications
CREATE POLICY "radio_dedications authenticated read" ON public.radio_dedications FOR SELECT TO authenticated USING ((status = ANY (ARRAY['queued'::text, 'scheduled'::text, 'played'::text])));

-- specialties
CREATE POLICY "specialties_insert_superuser" ON public.specialties FOR INSERT TO authenticated WITH CHECK (((SELECT profiles.role FROM profiles WHERE (profiles.id = auth.uid())) = 'superuser'::text));
CREATE POLICY "specialties_select" ON public.specialties FOR SELECT TO authenticated USING (true);
CREATE POLICY "specialties_update_superuser" ON public.specialties FOR UPDATE TO authenticated USING (((SELECT profiles.role FROM profiles WHERE (profiles.id = auth.uid())) = 'superuser'::text));

-- tcg_duels
CREATE POLICY "tcg_duels_insert" ON public.tcg_duels FOR INSERT TO public WITH CHECK ((auth.uid() = attacker_id));
CREATE POLICY "tcg_duels_select" ON public.tcg_duels FOR SELECT TO public USING (((auth.uid() = attacker_id) OR (auth.uid() = defender_id)));

-- tcg_player_cards
CREATE POLICY "tcg_player_cards_insert" ON public.tcg_player_cards FOR INSERT TO public WITH CHECK ((user_id = auth.uid()));
CREATE POLICY "tcg_player_cards_select" ON public.tcg_player_cards FOR SELECT TO public USING ((user_id = auth.uid()));
CREATE POLICY "tcg_player_cards_update" ON public.tcg_player_cards FOR UPDATE TO public USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

-- tcg_player_packs
CREATE POLICY "tcg_player_packs_insert" ON public.tcg_player_packs FOR INSERT TO public WITH CHECK ((player_id = auth.uid()));
CREATE POLICY "tcg_player_packs_select" ON public.tcg_player_packs FOR SELECT TO public USING ((player_id = auth.uid()));
CREATE POLICY "tcg_player_packs_update" ON public.tcg_player_packs FOR UPDATE TO public USING ((player_id = auth.uid())) WITH CHECK ((player_id = auth.uid()));

-- tcg_players
CREATE POLICY "tcg_players_insert" ON public.tcg_players FOR INSERT TO public WITH CHECK ((id = auth.uid()));
CREATE POLICY "tcg_players_select" ON public.tcg_players FOR SELECT TO public USING ((id = auth.uid()));
CREATE POLICY "tcg_players_update" ON public.tcg_players FOR UPDATE TO public USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));

-- tcg_quest_completions
CREATE POLICY "completions_own" ON public.tcg_quest_completions FOR ALL TO public USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

-- tcg_quests
CREATE POLICY "quests_read_all" ON public.tcg_quests FOR SELECT TO public USING (true);

-- titles
CREATE POLICY "Lecture publique des titres" ON public.titles FOR SELECT TO public USING (true);
CREATE POLICY "Superuser gère les titres" ON public.titles FOR ALL TO public USING ((EXISTS (SELECT 1 FROM profiles WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'superuser'::text)))));
