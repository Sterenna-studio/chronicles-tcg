-- ============================================================
-- Migration : 2026-06-23_backfill_champion_skills
-- Description : Inserts all 30 Champion cards (16 BZH01 + 14
--               BZH02) into public.cards with skill jsonb and
--               slots=3. ON CONFLICT DO UPDATE = idempotent.
-- ============================================================

INSERT INTO public.cards
  (id, name, type, rarity, description, power, shield, energy, set_code, slots, skill)
VALUES

-- ── BZH01 Champions ──────────────────────────────────────────

('BZH01_RC001', 'Aligax & Spirit – The Shield and the Aim', 'Champion', 'Rare',
 'Le bouclier infranchissable et l’œil infaillible. Lorsque défense et précision s’unissent, aucun assaut ne prospère.',
 7, 2, 3, 'BZH01', 3,
 '{"name":"Shield and Aim","desc":"R\u00e9duit de moiti\u00e9 les d\u00e9g\u00e2ts re\u00e7us ce tour et inflige power/2 d\u00e9g\u00e2ts en riposte.","effect":"half_damage_riposte","cooldown":3}'::jsonb),

('BZH01_RC002', 'MutenRock & Gabilone – Natural Harmony', 'Champion', 'Rare',
 'Deux \u00e2mes tiss\u00e9es par la nature et le Code. Ensemble, ils font rena\u00eetre l\u2019\u00e9quilibre dans les ruines du monde.',
 6, 2, 3, 'BZH01', 3,
 '{"name":"Natural Harmony","desc":"Soigne 3 PV \u00e0 un Champion alli\u00e9 de son choix.","effect":"heal_ally_3","cooldown":3}'::jsonb),

('BZH01_RC003', 'Sniky & Titan – Silent Strike', 'Champion', 'Rare',
 'La lame invisible et son ombre canine. Ils frappent sans bruit, disparaissent sans trace.',
 5, 3, 3, 'BZH01', 3,
 '{"name":"Silent Strike","desc":"Attaque qui ignore le bouclier adverse.","effect":"ignore_shield","cooldown":3}'::jsonb),

('BZH01_RC004', 'The Power of Three', 'Champion', 'Rare',
 'Lorsque Sniky, Aligax et MutenRock conjuguent leurs forces, m\u00eame les fondations du Code tremblent.',
 7, 3, 3, 'BZH01', 3,
 '{"name":"Power of Three","desc":"Si 3 Champions sont en jeu, inflige power x1.5 d\u00e9g\u00e2ts.","effect":"trio_bonus_damage","cooldown":4}'::jsonb),

('BZH01_EC001', 'The Mask of Sorn', 'Champion', 'Epic',
 'Un artefact scell\u00e9, capable de transcender la mort et de plier la r\u00e9alit\u00e9 au r\u00e9cit de celui qui l\u2019ose.',
 8, 5, 4, 'BZH01', 3,
 '{"name":"Reality Bend","desc":"Annule la prochaine skill utilis\u00e9e par l\u2019adversaire.","effect":"negate_next_skill","cooldown":4}'::jsonb),

('BZH01_EC002', 'The Core of the Code', 'Champion', 'Epic',
 'Un fragment pur et incontr\u00f4lable du pouvoir originel. Ceux qui le d\u00e9tiennent deviennent intouchables... ou maudits.',
 7, 5, 4, 'BZH01', 3,
 '{"name":"Core Pulse","desc":"Inflige power d\u00e9g\u00e2ts \u00e0 tous les Champions adverses.","effect":"aoe_damage","cooldown":4}'::jsonb),

('BZH01_EC003', 'First Awakening', 'Champion', 'Epic',
 'Le premier rugissement des consciences libres, appelant \u00e0 la r\u00e9volte contre l\u2019ordre corrompu du monde ancien.',
 9, 5, 4, 'BZH01', 3,
 '{"name":"First Awakening","desc":"Double l\u2019attaque de base ce tour.","effect":"double_base_attack","cooldown":4}'::jsonb),

('BZH01_EC004', 'The Source of the ZT', 'Champion', 'Epic',
 'L\u2019origine de toute \u00e9nergie, o\u00f9 l\u2019esprit, la nature et le Code convergent dans une pulsation primordiale.',
 8, 5, 4, 'BZH01', 3,
 '{"name":"ZT Surge","desc":"Gagne +2 \u00e9nergie ce tour.","effect":"gain_energy_2","cooldown":3}'::jsonb),

('BZH01_LC001', 'Echo of Brittany Originelle', 'Champion', 'Legendary',
 'Le souvenir d\u2019une Bretagne pure, enfoui dans les strates du Code.',
 11, 4, 6, 'BZH01', 3,
 '{"name":"Echo Strike","desc":"Rejoue l\u2019attaque de base une seconde fois gratuitement.","effect":"repeat_basic_attack","cooldown":5}'::jsonb),

('BZH01_LC002', 'The Final Pulse', 'Champion', 'Legendary',
 'Le dernier battement d\u2019un monde, lib\u00e9rant une onde de v\u00e9rit\u00e9 si puissante.',
 10, 4, 6, 'BZH01', 3,
 '{"name":"Final Pulse","desc":"Inflige power d\u00e9g\u00e2ts en ignorant tout bouclier.","effect":"true_damage","cooldown":5}'::jsonb),

('BZH01_MC001', 'The Iron Maiden (Aligax)', 'Champion', 'Mythical',
 'Armure vivante forg\u00e9e dans le code et le feu, Aligax prot\u00e8ge les siens au prix de sa propre humanit\u00e9.',
 14, 5, 7, 'BZH01', 3,
 '{"name":"Iron Fortress","desc":"Absorbe tous les d\u00e9g\u00e2ts subis par l\u2019\u00e9quipe ce tour.","effect":"full_team_shield_turn","cooldown":5}'::jsonb),

('BZH01_MC002', 'The Nature Owner (MutenRock)', 'Champion', 'Mythical',
 'MutenRock tire sa force des racines du vieux monde, fusion de l\u2019organique et du techno-druidisme.',
 13, 5, 7, 'BZH01', 3,
 '{"name":"Nature Wrath","desc":"Soigne toute l\u2019\u00e9quipe de 4 PV et inflige 4 d\u00e9g\u00e2ts \u00e0 l\u2019adversaire.","effect":"heal_team_4_dmg_4","cooldown":5}'::jsonb),

('BZH01_MC003', 'The Cyber Assassin (Sniky)', 'Champion', 'Mythical',
 'Tueur silencieux de la r\u00e9sistance bretonne, Sniky traverse les lignes ennemies comme une ombre num\u00e9rique.',
 12, 5, 7, 'BZH01', 3,
 '{"name":"Cyber Shadow","desc":"Esquive la prochaine attaque et contre-attaque avec power d\u00e9g\u00e2ts.","effect":"dodge_counter","cooldown":4}'::jsonb),

('BZH01_MC004', 'The Cooker (Spirit)', 'Champion', 'Mythical',
 'Calme, pr\u00e9cis, Spirit vise toujours juste.',
 11, 5, 7, 'BZH01', 3,
 '{"name":"Surgical Shot","desc":"Cible un Champion adverse pr\u00e9cis et l\u2019\u00e9tourdit 1 tour.","effect":"stun_target_1turn","cooldown":4}'::jsonb),

('BZH01_MC005', 'The Story Doctor (Dr. Sorn)', 'Champion', 'Mythical',
 'Gardien des r\u00e9cits perdus, Sorn soigne les failles du monde avec des mots ou des hacks.',
 14, 5, 7, 'BZH01', 3,
 '{"name":"Story Hack","desc":"Copie la skill unique du dernier Champion adverse utilis\u00e9.","effect":"copy_enemy_skill","cooldown":5}'::jsonb),

('BZH01_MC006', 'The Naturalist (Gabilone)', 'Champion', 'Mythical',
 'Bricoleur des \u00e2mes sylvestres et gardien des semences anciennes.',
 13, 5, 7, 'BZH01', 3,
 '{"name":"Sylvan Network","desc":"Pioche 2 cartes suppl\u00e9mentaires et gagne +1 \u00e9nergie.","effect":"draw_2_energy_1","cooldown":4}'::jsonb),

-- ── BZH02 Champions ──────────────────────────────────────────

('BZH02_MC001', 'Commandant MutenRock', 'Champion', 'Mythical',
 'Capitaine du Gwen-Ha-Star, l\u00e9gendaire b\u00e2timent cargo reconverti en vaisseau de contrebande tactique.',
 11, 5, 6, 'BZH02', 3,
 '{"name":"Captain Order","desc":"Permet \u00e0 un Champion alli\u00e9 d\u2019agir deux fois ce tour.","effect":"ally_double_turn","cooldown":5}'::jsonb),

('BZH02_MC002', 'Sniky l\u2019Ombre du Vide', 'Champion', 'Mythical',
 'Il traverse les coques sans alarme, tue sans t\u00e9moin, et repart sans trace.',
 14, 5, 6, 'BZH02', 3,
 '{"name":"Void Shadow","desc":"Esquive tous les d\u00e9g\u00e2ts ce tour et inflige power d\u00e9g\u00e2ts en sortie.","effect":"full_dodge_strike","cooldown":4}'::jsonb),

('BZH02_MC003', 'Aligax-13', 'Champion', 'Mythical',
 'Interface de Combat. Ancienne hackeuse fusionn\u00e9e avec une exo-armure exp\u00e9rimentale.',
 13, 5, 6, 'BZH02', 3,
 '{"name":"Resonance Totale","desc":"Prend le contr\u00f4le d\u2019un Object adverse \u00e9quip\u00e9 pour 1 tour.","effect":"hijack_enemy_object","cooldown":5}'::jsonb),

('BZH02_MC004', 'Spirit.EXE', 'Champion', 'Mythical',
 'Tireur d\u2019\u00e9lite augment\u00e9. Il voit 2 secondes dans le futur, et tire 1 seconde avant.',
 12, 5, 6, 'BZH02', 3,
 '{"name":"Precognition Shot","desc":"Inflige power d\u00e9g\u00e2ts et r\u00e9duit les d\u00e9g\u00e2ts re\u00e7us de 50% ce tour.","effect":"predict_shot","cooldown":4}'::jsonb),

('BZH02_MC005', 'Dr. Sorn le R\u00e9cursif', 'Champion', 'Mythical',
 'Scientifique cybern\u00e9tique, archiviste des \u00e2mes et m\u00e9decin de bord.',
 11, 5, 6, 'BZH02', 3,
 '{"name":"Memory Archive","desc":"Ressuscite une carte Object/Companion d\u00e9fauss\u00e9e dans la main.","effect":"revive_card_from_discard","cooldown":5}'::jsonb),

('BZH02_MC006', 'Gabil-One', 'Champion', 'Mythical',
 'Druidologue. Il implante des semences biom\u00e9caniques dans les vaisseaux.',
 14, 5, 6, 'BZH02', 3,
 '{"name":"Biomechanical Swarm","desc":"Invoque un Companion al\u00e9atoire de ton deck qui agit imm\u00e9diatement.","effect":"summon_random_companion","cooldown":5}'::jsonb),

('BZH02_MC007', 'Abbadon le Fondateur', 'Champion', 'Mythical',
 'Un ancien du programme BZH-PW. Fondateur du projet, il fut captur\u00e9 par le Syndicat.',
 13, 5, 6, 'BZH02', 3,
 '{"name":"Echo of Abadon","desc":"Inflige power d\u00e9g\u00e2ts et pioche 1 carte.","effect":"damage_draw_1","cooldown":4}'::jsonb),

('BZH02_MC008', 'Sigma Loops', 'Champion', 'Mythical',
 'Champion du Syndicat Solaire, chasseur de primes. Mercenaire de l\u2019espace.',
 12, 5, 6, 'BZH02', 3,
 '{"name":"Bounty Hunt","desc":"Inflige power d\u00e9g\u00e2ts au Champion adverse avec le plus de PV.","effect":"target_highest_hp","cooldown":3}'::jsonb),

('BZH02_MC009', 'Sigma Loops (EN ARMURE)', 'Champion', 'Mythical',
 'Champion du Syndicat Solaire, chasseur de primes.',
 11, 5, 6, 'BZH02', 3,
 '{"name":"Armored Charge","desc":"Inflige power d\u00e9g\u00e2ts et gagne shield en bouclier permanent.","effect":"charge_shield","cooldown":4}'::jsonb),

('BZH02_MC010', 'GR4CE', 'Champion', 'Mythical',
 'Ex-assistante IA domestique dont l\u2019humain a perdu le contr\u00f4le. Elle sait tuer de 48 fa\u00e7ons avec une tasse.',
 14, 6, 6, 'BZH02', 3,
 '{"name":"48 Ways to Kill","desc":"Inflige power d\u00e9g\u00e2ts en vrais d\u00e9g\u00e2ts + \u00e9tourdit la cible 1 tour.","effect":"true_dmg_stun","cooldown":5}'::jsonb),

('BZH02_MC011', 'Rufus le Mangeur de Mondes', 'Champion', 'Mythical',
 'Petite cr\u00e9ature verte au m\u00e9tabolisme fusionnel. Il d\u00e9vore le sol d\u2019une plan\u00e8te tout en grossissant.',
 13, 6, 6, 'BZH02', 3,
 '{"name":"World Devour","desc":"Gagne +2 power permanent pour chaque Champion adverse KO.","effect":"stack_power_on_ko","cooldown":4}'::jsonb),

('BZH02_MC012', 'Otto l\u2019H\u00e9misph\u00e8re', 'Champion', 'Mythical',
 'Cerveau flottant sous globe blind\u00e9. Personne ne sait de quand il date.',
 12, 6, 6, 'BZH02', 3,
 '{"name":"Neural Override","desc":"Annule la prochaine carte jou\u00e9e par l\u2019adversaire.","effect":"negate_next_card","cooldown":5}'::jsonb),

('BZH02_MC013', 'Le Code-Vivant', 'Champion', 'Mythical',
 'Il respire \u00e0 travers les c\u00e2bles. Il r\u00eave \u00e0 travers les logs. Il attend un porteur.',
 11, 6, 6, 'BZH02', 3,
 '{"name":"Living Code","desc":"Se soigne de power PV et inflige power/2 d\u00e9g\u00e2ts.","effect":"lifedrain","cooldown":4}'::jsonb),

('BZH02_MC014', 'Druide du Vide', 'Champion', 'Mythical',
 'Portent une robe faite de poussi\u00e8re d\u2019\u00e9toile. Ils peuvent murmurer aux \u00eatres vivants.',
 14, 6, 6, 'BZH02', 3,
 '{"name":"Void Whisper","desc":"R\u00e9duit l\u2019\u00e9nergie de l\u2019adversaire de 2 ce tour.","effect":"drain_enemy_energy_2","cooldown":4}'::jsonb)

ON CONFLICT (id) DO UPDATE SET
  name        = EXCLUDED.name,
  type        = EXCLUDED.type,
  rarity      = EXCLUDED.rarity,
  description = EXCLUDED.description,
  power       = EXCLUDED.power,
  shield      = EXCLUDED.shield,
  energy      = EXCLUDED.energy,
  set_code    = EXCLUDED.set_code,
  slots       = EXCLUDED.slots,
  skill       = EXCLUDED.skill,
  updated_at  = now();

-- V\u00e9rification (\u00e0 ex\u00e9cuter manuellement apr\u00e8s migration) :
-- SELECT id, name, slots, skill->>'name' AS skill_name
-- FROM public.cards WHERE type = 'Champion' ORDER BY id;
