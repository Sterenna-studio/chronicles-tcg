-- 2026-06-25 — Durcissement sécurité RPC (base Supabase partagée multi-jeux)
-- À exécuter dans l'éditeur SQL Supabase. Idempotent (REVOKE/ALTER).
-- Périmètre : Chronicles TCG + hygiène cross-game (bloc commenté en bas).
--
-- Note : si un REVOKE échoue sur "function ... does not exist", c'est que la
-- signature diffère — ajuste les types d'arguments (ou retire la ligne).

-- 1) complete_onboarding : CONFIRMÉ appelable par anon (HTTP 200 via REST).
--    Le flow d'onboarding exige d'être connecté -> réserver à authenticated.
REVOKE EXECUTE ON FUNCTION public.complete_onboarding() FROM anon;

-- 2) admin_grant_chronicles : crédite de la monnaie -> jamais public.
--    Réserver à service_role (admin) uniquement.
REVOKE EXECUTE ON FUNCTION public.admin_grant_chronicles(uuid, integer) FROM anon, authenticated;

-- 3) set_updated_at : search_path mutable (lint Supabase "function_search_path_mutable").
ALTER FUNCTION public.set_updated_at() SET search_path = public;

-- 4) Fonctions de trigger TCG : ne doivent jamais être appelables en RPC.
REVOKE EXECUTE ON FUNCTION public.trg_fn_tcg_collectionneur() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_fn_tcg_duels()          FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_fn_tcg_legendaire()     FROM anon, authenticated;

-- 5) Doublon d'achat de pack — À AUDITER AVANT SUPPRESSION.
--    L'app (index.html, data/packsRepo.js) appelle buy_pack_with_chronicles,
--    qui dérive le joueur de auth.uid() (sûr).
--    tcg_buy_pack(p_player_id, ...) prend l'id joueur en PARAMÈTRE = spoofable.
--    Si rien d'autre ne l'appelle, durcis puis supprime (adapter la signature) :
-- REVOKE EXECUTE ON FUNCTION public.tcg_buy_pack(uuid, uuid, integer) FROM anon, authenticated;
-- DROP FUNCTION public.tcg_buy_pack(uuid, uuid, integer);

-- ── CROSS-GAME (autres jeux, même base) — décommenter pour tout durcir d'un coup ──
-- REVOKE EXECUTE ON FUNCTION public.trg_fn_botanica_alchimiste() FROM anon, authenticated;
-- REVOKE EXECUTE ON FUNCTION public.trg_fn_botanica_codex()      FROM anon, authenticated;
-- REVOKE EXECUTE ON FUNCTION public.trg_fn_botanica_marchand()   FROM anon, authenticated;
-- REVOKE EXECUTE ON FUNCTION public.trg_fn_botanica_semeur()     FROM anon, authenticated;
-- REVOKE EXECUTE ON FUNCTION public.trg_fn_clicker_titles()      FROM anon, authenticated;
-- REVOKE EXECUTE ON FUNCTION public.trg_fn_pokegang_legende()    FROM anon, authenticated;
-- REVOKE EXECUTE ON FUNCTION public.trg_fn_pokegang_recrue()     FROM anon, authenticated;
-- REVOKE EXECUTE ON FUNCTION public.trg_fn_pokegang_stats()      FROM anon, authenticated;

-- ── NON couvert ici (à faire côté plateforme / dashboard) ──
--  • Storage : désactiver le listing public des buckets tcg-cards/tcg-packs/tcg-sounds
--    (policies sur storage.objects ; les URLs directes continuent de marcher).
--  • Auth : activer "Leaked password protection" (HaveIBeenPwned) dans le dashboard.
