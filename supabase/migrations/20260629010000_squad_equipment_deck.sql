-- Phase B2 : deck d'équipement (jusqu'à 20 cartes) au lieu de l'équipement figé
-- par champion. L'équipement se pioche/équipe désormais en combat (cf squadEngine).
-- save_squad accepte p_squad->'deck' (ids d'équipement) ; pour rétro-compat on y
-- fusionne aussi tout équipement encore envoyé par slot. Le cap rareté (1 lég/1 myth)
-- ne s'applique plus qu'aux champions + terrain (pas au deck, sinon trop restrictif).

ALTER TABLE public.tcg_squads ADD COLUMN IF NOT EXISTS equipment_deck text[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.save_squad(p_squad jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' SET row_security TO 'off'
AS $$
DECLARE
  v_user      uuid := auth.uid();
  v_id        uuid;
  v_name      text;
  v_active    boolean;
  v_terrain   text;
  v_champs    text[];
  v_slot_eq   text[];
  v_deck      text[];
  v_core      text[];   -- champions + terrain (pour le cap rareté)
  v_all       text[];   -- tout (pour possession + set)
  v_wrong_set boolean;
  v_unowned   boolean;
  v_legendary int;
  v_mythical  int;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Non authentifie');
  END IF;

  v_name    := COALESCE(NULLIF(trim(p_squad->>'name'), ''), 'Escouade');
  v_active  := COALESCE((p_squad->>'is_active')::boolean, false);
  v_terrain := NULLIF(p_squad->>'terrain', '');
  v_id      := NULLIF(p_squad->>'id', '')::uuid;

  IF jsonb_typeof(p_squad->'slots') <> 'array' OR jsonb_array_length(p_squad->'slots') <> 3 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Il faut exactement 3 champions');
  END IF;

  v_champs := ARRAY[
    NULLIF(p_squad->'slots'->0->>'champion', ''),
    NULLIF(p_squad->'slots'->1->>'champion', ''),
    NULLIF(p_squad->'slots'->2->>'champion', '')
  ];
  IF v_champs[1] IS NULL OR v_champs[2] IS NULL OR v_champs[3] IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Chaque slot doit avoir un champion');
  END IF;
  IF v_champs[1] = v_champs[2] OR v_champs[1] = v_champs[3] OR v_champs[2] = v_champs[3] THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Les 3 champions doivent etre differents');
  END IF;

  -- Deck = cartes du payload->'deck' + tout équipement encore envoyé par slot (rétro-compat).
  v_slot_eq :=
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_squad->'slots'->0->'equipment', '[]'::jsonb)))
    || ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_squad->'slots'->1->'equipment', '[]'::jsonb)))
    || ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_squad->'slots'->2->'equipment', '[]'::jsonb)));
  v_deck := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_squad->'deck', '[]'::jsonb))) || v_slot_eq;

  IF COALESCE(array_length(v_deck, 1), 0) > 20 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Deck trop grand (max 20 cartes)');
  END IF;

  -- Types : champions
  IF EXISTS (
    SELECT 1 FROM unnest(v_champs) AS x(cid)
    WHERE NOT EXISTS (SELECT 1 FROM cards c WHERE c.id = x.cid AND c.type = 'Champion')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Champion invalide');
  END IF;

  -- Types : deck (équipement uniquement)
  IF EXISTS (
    SELECT 1 FROM unnest(v_deck) AS x(cid)
    WHERE NOT EXISTS (
      SELECT 1 FROM cards c
      WHERE c.id = x.cid AND c.type IN ('Object','Companion','Special','Event','Team')
    )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Deck : carte non-équipement');
  END IF;

  IF v_terrain IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM cards c WHERE c.id = v_terrain AND c.type = 'Terrain'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Terrain invalide');
  END IF;

  v_core := v_champs || CASE WHEN v_terrain IS NOT NULL THEN ARRAY[v_terrain] ELSE '{}'::text[] END;
  v_all  := v_core || v_deck;

  -- Possession + set (sur TOUT), rareté (sur le cœur : champions + terrain)
  WITH need AS (
    SELECT cid, count(*)::int AS n FROM unnest(v_all) AS t(cid) GROUP BY cid
  ), chk AS (
    SELECT need.n, c.set_code, COALESCE(pc.quantity, 0) AS owned
    FROM need
    JOIN cards c ON c.id = need.cid
    LEFT JOIN tcg_player_cards pc ON pc.card_id = need.cid AND pc.user_id = v_user
  )
  SELECT
    COALESCE(bool_or(set_code NOT IN (SELECT set_id FROM pack_types WHERE is_active)), false),
    COALESCE(bool_or(owned < n), false)
  INTO v_wrong_set, v_unowned
  FROM chk;

  SELECT
    COALESCE(count(*) FILTER (WHERE lower(c.rarity) = 'legendary'), 0),
    COALESCE(count(*) FILTER (WHERE lower(c.rarity) = 'mythical'), 0)
  INTO v_legendary, v_mythical
  FROM unnest(v_core) AS t(cid) JOIN cards c ON c.id = t.cid;

  IF v_wrong_set THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Carte hors set jouable');
  END IF;
  IF v_unowned THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Carte non possedee (ou quantite insuffisante)');
  END IF;
  IF v_legendary > 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Max 1 champion/terrain legendaire');
  END IF;
  IF v_mythical > 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Max 1 champion/terrain mythique');
  END IF;

  IF v_active THEN
    UPDATE tcg_squads SET is_active = false, updated_at = now()
    WHERE player_id = v_user AND is_active AND (v_id IS NULL OR id <> v_id);
  END IF;

  IF v_id IS NOT NULL THEN
    UPDATE tcg_squads SET
      name = v_name, is_active = v_active,
      slot1_champion_id = v_champs[1], slot1_equipment = '{}',
      slot2_champion_id = v_champs[2], slot2_equipment = '{}',
      slot3_champion_id = v_champs[3], slot3_equipment = '{}',
      equipment_deck = v_deck,
      terrain_id = v_terrain, updated_at = now()
    WHERE id = v_id AND player_id = v_user;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Escouade introuvable');
    END IF;
  ELSE
    IF (SELECT count(*) FROM tcg_squads WHERE player_id = v_user) >= 20 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Trop d''escouades (max 20)');
    END IF;
    INSERT INTO tcg_squads (
      player_id, name, is_active,
      slot1_champion_id, slot2_champion_id, slot3_champion_id,
      equipment_deck, terrain_id
    ) VALUES (
      v_user, v_name, v_active,
      v_champs[1], v_champs[2], v_champs[3],
      v_deck, v_terrain
    ) RETURNING id INTO v_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'squad_id', v_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM, 'sqlstate', SQLSTATE);
END;
$$;

-- load_squad : renvoie aussi equipmentDeck (cartes résolues).
CREATE OR REPLACE FUNCTION public.load_squad(p_squad_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' SET row_security TO 'off'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_sq   tcg_squads%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Non authentifie');
  END IF;

  IF p_squad_id IS NOT NULL THEN
    SELECT * INTO v_sq FROM tcg_squads WHERE id = p_squad_id AND player_id = v_user;
  ELSE
    SELECT * INTO v_sq FROM tcg_squads
    WHERE player_id = v_user AND is_active ORDER BY updated_at DESC LIMIT 1;
    IF NOT FOUND THEN
      SELECT * INTO v_sq FROM tcg_squads
      WHERE player_id = v_user ORDER BY updated_at DESC LIMIT 1;
    END IF;
  END IF;

  IF v_sq.id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'squad', NULL);
  END IF;

  RETURN jsonb_build_object('ok', true, 'squad', jsonb_build_object(
    'id', v_sq.id,
    'name', v_sq.name,
    'is_active', v_sq.is_active,
    'slots', jsonb_build_array(
      jsonb_build_object('champion', (SELECT to_jsonb(c) FROM cards c WHERE c.id = v_sq.slot1_champion_id),
                         'equipment', public._resolve_cards(v_sq.slot1_equipment)),
      jsonb_build_object('champion', (SELECT to_jsonb(c) FROM cards c WHERE c.id = v_sq.slot2_champion_id),
                         'equipment', public._resolve_cards(v_sq.slot2_equipment)),
      jsonb_build_object('champion', (SELECT to_jsonb(c) FROM cards c WHERE c.id = v_sq.slot3_champion_id),
                         'equipment', public._resolve_cards(v_sq.slot3_equipment))
    ),
    'equipmentDeck', public._resolve_cards(v_sq.equipment_deck),
    'terrain', (SELECT to_jsonb(c) FROM cards c WHERE c.id = v_sq.terrain_id)
  ));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_squad(jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.load_squad(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.save_squad(jsonb) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.load_squad(uuid) TO authenticated;
