-- 20260701000000_admin_superuser_tools.sql
-- Outils d'admin pour la page pages/admin/ : gestion des cartes (public.cards) et
-- des boosters (public.pack_types), réservée aux comptes profiles.role='superuser'
-- (même convention que les autres jeux du Supabase partagé : ar_write, pr_write,
-- proj_write, "Superuser gère ..." dans 20260626000000_baseline.sql).
--
-- Avant cette migration : `cards` n'était écrivable que par service_role (aucun
-- accès client, même admin) ; `pack_types` n'avait AUCUNE policy d'écriture du
-- tout. On n'ouvre pas l'accès direct à la table (pas de nouvelle policy RLS) :
-- on passe par des RPC SECURITY DEFINER qui valident le rôle côté serveur, comme
-- le reste des mutations sensibles de ce jeu (save_squad, buy_pack_with_chronicles,
-- claim_quest, award_squad_reward...).
--
-- Suppression : volontairement absente. `cards`/`pack_types` n'ont pas de FK
-- stricte vers tcg_player_cards/tcg_player_packs ; un DELETE laisserait des
-- références mortes dans les collections/inventaires des joueurs. La désactivation
-- se fait via les colonnes déjà existantes : cards.is_banned, pack_types.is_active
-- (même logique que la migration 20260626130000 qui a désactivé BZH02 ainsi).

-- ── pack_types.card_count ────────────────────────────────────────────────────
-- Le nombre de cartes par booster était codé en dur (5) dans ui/openingOverlay.js ;
-- le shop affichait déjà `p.card_count` (toujours "?" faute de colonne). On le
-- rend réel et éditable depuis l'admin.
ALTER TABLE public.pack_types
  ADD COLUMN IF NOT EXISTS card_count integer NOT NULL DEFAULT 5;

ALTER TABLE public.pack_types
  ADD CONSTRAINT pack_types_card_count_check CHECK (card_count BETWEEN 1 AND 20);

-- ── Helper interne : caller est-il superuser ? ───────────────────────────────
CREATE OR REPLACE FUNCTION public._is_superuser()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT role = 'superuser' FROM profiles WHERE id = auth.uid()),
    false
  );
$$;
REVOKE EXECUTE ON FUNCTION public._is_superuser() FROM anon, authenticated;

-- ── admin_upsert_card ─────────────────────────────────────────────────────────
-- Crée ou met à jour une carte (clé = id, ex. 'BZH01_RC010'). Valide type/rarity
-- contre les valeurs connues du moteur (cf. logic/sets.js, squadEngine, TI/RC maps
-- des vues) pour éviter qu'une faute de frappe casse le rendu/les filtres client.
CREATE OR REPLACE FUNCTION public.admin_upsert_card(p_card jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' SET row_security TO 'off'
AS $$
DECLARE
  v_id    text := NULLIF(trim(p_card->>'id'), '');
  v_name  text := NULLIF(trim(p_card->>'name'), '');
  v_type  text := NULLIF(trim(p_card->>'type'), '');
  v_rare  text := NULLIF(trim(p_card->>'rarity'), '');
  v_skill jsonb := p_card->'skill';
  v_row   public.cards%ROWTYPE;
BEGIN
  IF NOT public._is_superuser() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Réservé aux superusers');
  END IF;
  IF v_id IS NULL OR v_name IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'id et name sont requis');
  END IF;
  IF v_type IS NULL OR v_type NOT IN ('Champion','Companion','Event','Object','Special','Terrain') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'type invalide (Champion/Companion/Event/Object/Special/Terrain)');
  END IF;
  IF v_rare IS NULL OR v_rare NOT IN ('Common','Rare','Epic','Legendary','Mythical') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'rarity invalide (Common/Rare/Epic/Legendary/Mythical)');
  END IF;
  IF v_skill IS NOT NULL AND jsonb_typeof(v_skill) <> 'object' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'skill doit être un objet JSON (ou absent)');
  END IF;

  INSERT INTO public.cards (
    id, name, type, rarity, description, power, shield, energy,
    set_code, is_banned, artwork_url, skill, slots, updated_at
  ) VALUES (
    v_id, v_name, v_type, v_rare,
    NULLIF(trim(p_card->>'description'), ''),
    COALESCE((p_card->>'power')::int, 0),
    COALESCE((p_card->>'shield')::int, 0),
    COALESCE((p_card->>'energy')::int, 0),
    NULLIF(trim(p_card->>'set_code'), ''),
    COALESCE((p_card->>'is_banned')::boolean, false),
    NULLIF(trim(p_card->>'artwork_url'), ''),
    v_skill,
    COALESCE((p_card->>'slots')::int, 0),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    name        = EXCLUDED.name,
    type        = EXCLUDED.type,
    rarity      = EXCLUDED.rarity,
    description = EXCLUDED.description,
    power       = EXCLUDED.power,
    shield      = EXCLUDED.shield,
    energy      = EXCLUDED.energy,
    set_code    = EXCLUDED.set_code,
    is_banned   = EXCLUDED.is_banned,
    artwork_url = EXCLUDED.artwork_url,
    skill       = EXCLUDED.skill,
    slots       = EXCLUDED.slots,
    updated_at  = now()
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('ok', true, 'card', row_to_json(v_row));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_upsert_card(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_card(jsonb) TO authenticated;

-- ── admin_upsert_pack_type ────────────────────────────────────────────────────
-- Crée (id absent) ou met à jour (id fourni) un type de booster.
CREATE OR REPLACE FUNCTION public.admin_upsert_pack_type(p_pack jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' SET row_security TO 'off'
AS $$
DECLARE
  v_id    uuid := NULLIF(p_pack->>'id', '')::uuid;
  v_name  text := NULLIF(trim(p_pack->>'name'), '');
  v_set   text := NULLIF(trim(p_pack->>'set_id'), '');
  v_img   text := NULLIF(trim(p_pack->>'image_name'), '');
  v_price int  := COALESCE((p_pack->>'price')::int, 100);
  v_count int  := COALESCE((p_pack->>'card_count')::int, 5);
  v_active boolean := COALESCE((p_pack->>'is_active')::boolean, true);
  v_row   public.pack_types%ROWTYPE;
BEGIN
  IF NOT public._is_superuser() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Réservé aux superusers');
  END IF;
  IF v_name IS NULL OR v_set IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'name et set_id sont requis');
  END IF;
  IF v_price < 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'price doit être >= 0');
  END IF;
  IF v_count NOT BETWEEN 1 AND 20 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'card_count doit être entre 1 et 20');
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.pack_types (name, set_id, image_name, price, card_count, is_active)
    VALUES (v_name, v_set, v_img, v_price, v_count, v_active)
    RETURNING * INTO v_row;
  ELSE
    UPDATE public.pack_types SET
      name = v_name, set_id = v_set, image_name = v_img,
      price = v_price, card_count = v_count, is_active = v_active,
      updated_at = now()
    WHERE id = v_id
    RETURNING * INTO v_row;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Booster introuvable');
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'pack', row_to_json(v_row));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_upsert_pack_type(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_pack_type(jsonb) TO authenticated;
