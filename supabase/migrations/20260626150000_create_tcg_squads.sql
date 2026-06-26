-- Mode Escouade — lot 2 : table tcg_squads + RPC save_squad / load_squad.
-- Voir docs/RULES_JRPG.md §2 (règles de loadout) et §9 (persistance).
--
-- Une escouade = 3 Champions, chacun avec jusqu'à 3 cartes équipées (n'importe
-- quel type non-Champion), + 1 slot Terrain d'équipe optionnel. Toute la
-- validation (possession réelle, types, limites légendaire/mythique, set jouable)
-- est faite côté serveur dans save_squad (SECURITY DEFINER) — on ne fait jamais
-- confiance au client.

-- ─── Table ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tcg_squads (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name              text NOT NULL DEFAULT 'Escouade 1',
  is_active         boolean NOT NULL DEFAULT false,
  slot1_champion_id text REFERENCES public.cards(id),
  slot1_equipment   text[] NOT NULL DEFAULT '{}',
  slot2_champion_id text REFERENCES public.cards(id),
  slot2_equipment   text[] NOT NULL DEFAULT '{}',
  slot3_champion_id text REFERENCES public.cards(id),
  slot3_equipment   text[] NOT NULL DEFAULT '{}',
  terrain_id        text REFERENCES public.cards(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tcg_squads_player_idx ON public.tcg_squads (player_id);
-- Au plus une escouade active par joueur
CREATE UNIQUE INDEX IF NOT EXISTS tcg_squads_one_active_per_player
  ON public.tcg_squads (player_id) WHERE is_active;

-- ─── RLS : un joueur ne voit/gère que ses escouades ─────────────────────────
ALTER TABLE public.tcg_squads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tcg_squads_select_own ON public.tcg_squads;
CREATE POLICY tcg_squads_select_own ON public.tcg_squads
  FOR SELECT USING (player_id = auth.uid());

DROP POLICY IF EXISTS tcg_squads_insert_own ON public.tcg_squads;
CREATE POLICY tcg_squads_insert_own ON public.tcg_squads
  FOR INSERT WITH CHECK (player_id = auth.uid());

DROP POLICY IF EXISTS tcg_squads_update_own ON public.tcg_squads;
CREATE POLICY tcg_squads_update_own ON public.tcg_squads
  FOR UPDATE USING (player_id = auth.uid()) WITH CHECK (player_id = auth.uid());

DROP POLICY IF EXISTS tcg_squads_delete_own ON public.tcg_squads;
CREATE POLICY tcg_squads_delete_own ON public.tcg_squads
  FOR DELETE USING (player_id = auth.uid());

-- ─── Helper interne : ids[] -> jsonb[] de cartes (ordre préservé) ───────────
CREATE OR REPLACE FUNCTION public._resolve_cards(p_ids text[])
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY e.ord), '[]'::jsonb)
  FROM unnest(COALESCE(p_ids, '{}')) WITH ORDINALITY AS e(cid, ord)
  JOIN public.cards c ON c.id = e.cid;
$$;

-- ─── save_squad : valide puis upsert ────────────────────────────────────────
-- Payload attendu :
-- {
--   "id": null | "<uuid>",            -- update si fourni, insert sinon
--   "name": "Escouade 1",
--   "is_active": true,
--   "terrain": null | "<card_id>",
--   "slots": [
--     { "champion": "<card_id>", "equipment": ["<id>", ...] },  -- max 3 equip
--     { "champion": "<card_id>", "equipment": [] },
--     { "champion": "<card_id>", "equipment": ["<id>"] }
--   ]
-- }
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
  v_equip1    text[];
  v_equip2    text[];
  v_equip3    text[];
  v_all_equip text[];
  v_all       text[];
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

  -- Structure : exactement 3 slots
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

  v_equip1 := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_squad->'slots'->0->'equipment', '[]'::jsonb)));
  v_equip2 := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_squad->'slots'->1->'equipment', '[]'::jsonb)));
  v_equip3 := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_squad->'slots'->2->'equipment', '[]'::jsonb)));

  IF COALESCE(array_length(v_equip1,1),0) > 3
     OR COALESCE(array_length(v_equip2,1),0) > 3
     OR COALESCE(array_length(v_equip3,1),0) > 3 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Max 3 equipements par champion');
  END IF;
  v_all_equip := v_equip1 || v_equip2 || v_equip3;

  -- Types : champions
  IF EXISTS (
    SELECT 1 FROM unnest(v_champs) AS x(cid)
    WHERE NOT EXISTS (SELECT 1 FROM cards c WHERE c.id = x.cid AND c.type = 'Champion')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Champion invalide');
  END IF;

  -- Types : equipement (tout sauf Champion / Terrain)
  IF EXISTS (
    SELECT 1 FROM unnest(v_all_equip) AS x(cid)
    WHERE NOT EXISTS (
      SELECT 1 FROM cards c
      WHERE c.id = x.cid AND c.type IN ('Object','Companion','Special','Event','Team')
    )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Equipement invalide (type non autorise)');
  END IF;

  -- Type : terrain
  IF v_terrain IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM cards c WHERE c.id = v_terrain AND c.type = 'Terrain'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Terrain invalide');
  END IF;

  -- Toutes les cartes utilisées (avec doublons pour le comptage possession/rareté)
  v_all := v_champs || v_all_equip
           || CASE WHEN v_terrain IS NOT NULL THEN ARRAY[v_terrain] ELSE '{}'::text[] END;

  WITH need AS (
    SELECT cid, count(*)::int AS n FROM unnest(v_all) AS t(cid) GROUP BY cid
  ), chk AS (
    SELECT need.n, c.set_code, c.rarity, COALESCE(pc.quantity, 0) AS owned
    FROM need
    JOIN cards c ON c.id = need.cid
    LEFT JOIN tcg_player_cards pc ON pc.card_id = need.cid AND pc.user_id = v_user
  )
  SELECT
    COALESCE(bool_or(set_code NOT IN (SELECT set_id FROM pack_types WHERE is_active)), false),
    COALESCE(bool_or(owned < n), false),
    COALESCE(sum(n) FILTER (WHERE lower(rarity) = 'legendary'), 0),
    COALESCE(sum(n) FILTER (WHERE lower(rarity) = 'mythical'), 0)
  INTO v_wrong_set, v_unowned, v_legendary, v_mythical
  FROM chk;

  IF v_wrong_set THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Carte hors set jouable');
  END IF;
  IF v_unowned THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Carte non possedee (ou quantite insuffisante)');
  END IF;
  IF v_legendary > 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Max 1 carte legendaire dans l''escouade');
  END IF;
  IF v_mythical > 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Max 1 carte mythique dans l''escouade');
  END IF;

  -- Désactive les autres escouades si celle-ci devient active
  IF v_active THEN
    UPDATE tcg_squads SET is_active = false, updated_at = now()
    WHERE player_id = v_user AND is_active AND (v_id IS NULL OR id <> v_id);
  END IF;

  IF v_id IS NOT NULL THEN
    UPDATE tcg_squads SET
      name = v_name, is_active = v_active,
      slot1_champion_id = v_champs[1], slot1_equipment = v_equip1,
      slot2_champion_id = v_champs[2], slot2_equipment = v_equip2,
      slot3_champion_id = v_champs[3], slot3_equipment = v_equip3,
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
      slot1_champion_id, slot1_equipment,
      slot2_champion_id, slot2_equipment,
      slot3_champion_id, slot3_equipment,
      terrain_id
    ) VALUES (
      v_user, v_name, v_active,
      v_champs[1], v_equip1, v_champs[2], v_equip2, v_champs[3], v_equip3,
      v_terrain
    ) RETURNING id INTO v_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'squad_id', v_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM, 'sqlstate', SQLSTATE);
END;
$$;

-- ─── load_squad : escouade (active par défaut) avec cartes résolues ──────────
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
    'terrain', (SELECT to_jsonb(c) FROM cards c WHERE c.id = v_sq.terrain_id)
  ));
END;
$$;

-- ─── Permissions : authenticated only ───────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public._resolve_cards(text[]) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.save_squad(jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.load_squad(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_squad(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.load_squad(uuid) TO authenticated;
