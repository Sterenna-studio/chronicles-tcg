-- Security hardening: revoke anon access on sensitive/internal functions

-- complete_onboarding: should only be callable by authenticated users
REVOKE EXECUTE ON FUNCTION public.complete_onboarding() FROM anon;

-- set_updated_at: trigger-only function, never callable via RPC
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated;
ALTER FUNCTION public.set_updated_at() SET search_path = public;

-- Trigger functions: internal only, never callable via RPC
REVOKE EXECUTE ON FUNCTION public.trg_fn_botanica_alchimiste() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_fn_botanica_codex() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_fn_botanica_marchand() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_fn_botanica_semeur() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_fn_clicker_titles() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_fn_pokegang_legende() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_fn_pokegang_recrue() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_fn_pokegang_stats() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_fn_tcg_collectionneur() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_fn_tcg_duels() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_fn_tcg_legendaire() FROM anon, authenticated;
