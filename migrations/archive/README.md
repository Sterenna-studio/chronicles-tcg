# Migrations archivées — NE PAS REJOUER

Ces fichiers redéfinissaient `claim_quest` / `buy_pack_with_chronicles` lors du
débogage du 400. Ils sont **obsolètes** : la version qui fait foi est

  `migrations/2026-06-26_fix_claim_quest_buy_pack_definitive.sql`

⚠️ Ne **PAS** exécuter ces fichiers : ils réintroduiraient une version ancienne
(buggée, sans le garde `EXCEPTION`) et recasseraient le claim de quête / l'achat
de pack. Conservés uniquement pour l'historique.

Ordre chronologique du débogage (du plus ancien au plus récent) :
1. `2026-06-24_claim_quest_upsert_profile.sql`
2. `2026-06-25_fix_claim_quest_upsert_profile_v2.sql`
3. `2026-06-25_fix_claim_quest_chronicles_constraint_v3.sql`
4. `2026-06-25_fix_security_definer_bypass_rls_v4.sql`
5. → **définitive** : `../2026-06-26_fix_claim_quest_buy_pack_definitive.sql`
