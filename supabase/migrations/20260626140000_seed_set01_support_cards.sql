-- Seed des cartes de soutien du Set 01 (BZH01) dans public.cards.
-- Source : data/BZH01.json (cartes non-Champion). Les 30 Champions sont déjà en
-- base avec leur skill+slots (snapshot : supabase/archive/cards_snapshot_20260626.json)
-- et NE sont PAS touchés ici.
--
-- Cartes équipables du Mode Escouade (cf docs/RULES_JRPG.md §5) :
--   Companion: 8
--   Event: 11
--   Object: 11
--   Special: 10
--   Terrain: 10
--   TOTAL non-Champion: 50
--
-- slots reste à 0 (défaut) et skill à NULL pour les non-Champions.
-- Idempotent : ON CONFLICT met à jour les champs descriptifs sans toucher skill/slots.

INSERT INTO public.cards
  (id, name, type, rarity, description, power, shield, energy, set_code)
VALUES
  ('BZH01_CP001', 'Titan – Guardian Beast', 'Companion', 'Common', 'Colosse mécanique lié à Sniky, Titan veille en silence, ses griffes chargées d’énergie brute.', 3, 4, 1, 'BZH01'),
  ('BZH01_CP002', 'Spike – Loyal Hunter', 'Companion', 'Common', 'Fidèle compagnon de Spirit, Spike bondit là où les tireurs hésitent.', 2, 4, 1, 'BZH01'),
  ('BZH01_CP003', 'Feather – Drone Companion', 'Companion', 'Common', 'Semi-organique, semi-machine, ses plumes sont tranchantes, utilisé comme guide ou pour de la reconnaissance et de l''espionnage. Il en existe de toutes tailles, et couleurs. Certains les collectionnent, d''autres les chérissent, mais la plupart sont utilisés à des fins malhonnêtes et violentes. #FF Free Feather', 4, 4, 1, 'BZH01'),
  ('BZH01_CP004', 'Code Wolf – Synthetic Tracker', 'Companion', 'Common', 'Nés du Code et de l’instinct, les loups synthétiques flairent les failles des plus grands héros.', 3, 4, 1, 'BZH01'),
  ('BZH01_RP001', 'BZH Bot Mk I – Repair Unit', 'Companion', 'Rare', 'Petit, bruyant, attachant — il ne paie pas de mine, mais il remet en marche les plus grands.', 5, 4, 1, 'BZH01'),
  ('BZH01_RP002', 'Thorn Lurcker', 'Companion', 'Rare', 'Créature furtive tapie dans les ronces numériques.', 4, 4, 1, 'BZH01'),
  ('BZH01_EP001', 'BZH Bot Mk II – Reinforced Unit', 'Companion', 'Epic', 'Nouvelle génération du BZH Bot, blindé et autonome.', 6, 6, 3, 'BZH01'),
  ('BZH01_LP001', 'Wyrm of Plélan – Semi-Digital Dragon', 'Companion', 'Legendary', 'Légende mi-binaire mi-organique, ce dragon plane entre les lignes de code et les nuages bretons.', 9, 6, 3, 'BZH01'),
  ('BZH01_CE001', 'Data Surge', 'Event', 'Common', 'Une onde de données traverse la réalité, accélérant la pensée et faisant jaillir les souvenirs les plus enfouis.', 3, 0, 1, 'BZH01'),
  ('BZH01_CE002', 'Uplink Overload', 'Event', 'Common', 'Les réseaux implosent dans un chaos électrisant, coupant les liens entre alliés comme ennemis.', 5, 1, 1, 'BZH01'),
  ('BZH01_CE003', 'Phantom Ambush', 'Event', 'Common', 'Des silhouettes numériques surgissent des ombres du Code, frappant avant de disparaître sans laisser de trace.', 4, 1, 1, 'BZH01'),
  ('BZH01_CE004', 'Lure of the Archive', 'Event', 'Common', 'Les grandes archives chantent, séduisant ceux assez fous pour risquer tout pour une connaissance interdite.', 3, 1, 1, 'BZH01'),
  ('BZH01_RE001', 'Silence of the Dome', 'Event', 'Rare', 'Un dôme d’anti-son s’abat sur le champ de bataille, figeant mots, pouvoirs et espoirs dans un silence absolu.', 5, 3, 2, 'BZH01'),
  ('BZH01_RE002', 'Breach in the Core', 'Event', 'Rare', 'La faille béante dans le noyau du système laisse échapper une corruption vorace, engloutissant toute stratégie.', 7, 3, 2, 'BZH01'),
  ('BZH01_RE003', 'Digital Overload', 'Event', 'Rare', 'Un afflux de données corrompt l’action en cours.', 6, 3, 2, 'BZH01'),
  ('BZH01_EE001', 'Tower Collapse', 'Event', 'Epic', 'La tour ancestrale, pilier de la connaissance, s''effondre dans une cascade de données cristallisées.', 9, 3, 4, 'BZH01'),
  ('BZH01_ME001', 'Temporal Rift', 'Event', 'Mythical', 'Une faille temporelle s’ouvre, offrant une chance unique de rejouer le fil des erreurs... ou des exploits.', 14, 6, 5, 'BZH01'),
  ('BZH01_ME002', 'Whispering Echo', 'Event', 'Mythical', 'Des voix oubliées résonnent dans l’éther, soufflant aux audacieux les secrets d’anciens stratagèmes.', 13, 6, 5, 'BZH01'),
  ('BZH01_ME003', 'Midnight Invasion', 'Event', 'Mythical', 'Au cœur de la nuit, les drones du néant franchissent les défenses, imposant la loi du Code par le feu et le chaos.', 12, 6, 5, 'BZH01'),
  ('BZH01_CO001', 'Rose Blade', 'Object', 'Common', 'Forgée dans les jardins cybernétiques, chaque coup de cette lame libère les souvenirs d’un monde oublié.', 3, 4, 1, 'BZH01'),
  ('BZH01_CO002', 'Techseed Core', 'Object', 'Common', 'Un germe technologique vivant, battant au rythme d’un cœur ancien connecté à la terre bretonne.', 2, 4, 1, 'BZH01'),
  ('BZH01_CO003', 'Mirror Gloves', 'Object', 'Common', 'Des gants enchâssés de prismes liquides. Ils copient les talents aussi sûrement que l’eau reflète la lumière.', 1, 4, 1, 'BZH01'),
  ('BZH01_CO004', 'Thorn Gauntlet', 'Object', 'Common', 'Armure agressive, chaque attaque se paie d''une goutte de sang. Car la force a toujours un prix.', 3, 4, 1, 'BZH01'),
  ('BZH01_CO005', 'Cyber Bow', 'Object', 'Common', 'Tendu par des câbles de données, il transperce les barrières matérielles comme les illusions numériques.', 2, 4, 1, 'BZH01'),
  ('BZH01_CO006', 'Pulse Rifle', 'Object', 'Common', 'Le canon gronde d’une pulsation sourde, tirant des éclats d’énergie bruts directement du réseau.', 1, 4, 1, 'BZH01'),
  ('BZH01_CO007', 'Energy Flask', 'Object', 'Common', 'Un concentré liquide de mana primaire, né du Nexus Verdoyant, instable mais vital dans l’urgence.', 3, 4, 1, 'BZH01'),
  ('BZH01_RO001', 'Echo Tracker', 'Object', 'Rare', 'Cet appareil capte les traces résiduelles d’émotions et d’intentions, révélant l''invisible aux élus.', 5, 4, 1, 'BZH01'),
  ('BZH01_RO002', 'Holo-Cloak', 'Object', 'Rare', 'Tissé à partir de brumes fractales, ce manteau dissimule son porteur aux yeux, aux machines, et parfois même au destin.', 4, 4, 1, 'BZH01'),
  ('BZH01_EO001', 'Blade Disc', 'Object', 'Epic', 'Un disque affûté au point de lacérer l’air lui-même, chargé de données prédatrices prêtes à infecter l’ennemi.', 6, 6, 2, 'BZH01'),
  ('BZH01_LO001', 'Data Reactor', 'Object', 'Legendary', 'Un cœur énergétique survolté, alimentant les modules oubliés.', 9, 6, 3, 'BZH01'),
  ('BZH01_CS001', 'BZH Bond', 'Special', 'Common', 'Un pacte ancien gravé dans les racines de la Bretagne numérique : force et protection s''éveillent dans l''unité.', 4, 4, 2, 'BZH01'),
  ('BZH01_CS002', 'Code Anomaly', 'Special', 'Common', 'Une aberration du réseau, un éclat de hasard pur qui décuple ou détruit sans prévenir.', 3, 4, 2, 'BZH01'),
  ('BZH01_RS001', 'The Forgotten Rune', 'Special', 'Rare', 'Symbole oublié, gravé par les premiers maîtres du Code. Son invocation redonne vie aux secrets disparus.', 6, 4, 3, 'BZH01'),
  ('BZH01_RS002', 'Digital Rebirth', 'Special', 'Rare', 'Dans les abysses de l''effacement, une étincelle subsiste. La renaissance numérique n’appartient qu’aux audacieux.', 5, 4, 3, 'BZH01'),
  ('BZH01_RS003', 'Protocol Reset', 'Special', 'Rare', 'Un souffle brut effaçant toutes règles établies. À zéro, tout peut recommencer, ou tout peut sombrer.', 7, 4, 3, 'BZH01'),
  ('BZH01_RS004', 'Prime Uprising', 'Special', 'Rare', 'La rébellion des consciences égarées, armée de lignes fractales et de cris d’anciens codes.', 6, 4, 3, 'BZH01'),
  ('BZH01_ES001', 'Secret of the Maelstrom', 'Special', 'Epic', 'Au centre du Maelstrom, le savoir interdit pulse. Ceux qui l’effleurent en paient toujours le prix.', 7, 6, 3, 'BZH01'),
  ('BZH01_ES002', 'Backlash Overclock', 'Special', 'Epic', 'Lorsque le cœur bat au-delà de ses limites, le pouvoir explose, quitte à tout briser ensuite.', 9, 6, 3, 'BZH01'),
  ('BZH01_LS001', 'Guardian’s Oath', 'Special', 'Legendary', 'Un serment inviolable, juré sous les étoiles de Bretagne, offrant l''invincibilité le temps d''un dernier combat.', 10, 6, 5, 'BZH01'),
  ('BZH01_LS002', 'Twin Seraphim', 'Special', 'Legendary', 'La légende parle de deux esprits jumeaux, fusion de volonté pure et d’énergie guerrière.', 9, 6, 5, 'BZH01'),
  ('BZH01_CT001', 'The Lost Temple', 'Terrain', 'Common', 'Un sanctuaire oublié sous les marées du temps. Les échos du Code originel résonnent entre ses colonnes brisées.', 1, 2, 1, 'BZH01'),
  ('BZH01_CT002', 'Verdant Nexus', 'Terrain', 'Common', 'Un carrefour où la nature numérique et organique fusionnent, berçant les esprits de ceux qui savent écouter.', 3, 2, 1, 'BZH01'),
  ('BZH01_CT003', 'Rusted City Ruins', 'Terrain', 'Common', 'Les anciennes cités rouillées racontent des guerres passées. Seuls les plus endurcis survivent à leur effondrement.', 2, 2, 1, 'BZH01'),
  ('BZH01_CT004', 'Cyberpunk Docks', 'Terrain', 'Common', 'Sous les brumes acides, des navires silencieux transportent données, souvenirs… et parfois malédictions.', 1, 2, 1, 'BZH01'),
  ('BZH01_CT005', 'Neon Forest', 'Terrain', 'Common', 'Un labyrinthe végétal baigné de lueurs artificielles. Ici, les lianes murmurent des secrets codés.', 3, 2, 1, 'BZH01'),
  ('BZH01_CT006', 'Glacier of Code', 'Terrain', 'Common', 'Un bloc de données fossilisées où les pensées figées attendent d’être libérées par un esprit digne.', 2, 2, 1, 'BZH01'),
  ('BZH01_RT001', 'Floating Monastery', 'Terrain', 'Rare', 'Entre ciel et mer, ce monastère dérive, sanctuaire des derniers moines archivistes du Code.', 3, 5, 1, 'BZH01'),
  ('BZH01_RT002', 'Shadow Citadel', 'Terrain', 'Rare', 'Dans ses murs noirs, le Code corrompu trouve refuge. Mais derrière l’ombre… la lumière guette.', 5, 5, 1, 'BZH01'),
  ('BZH01_RT003', 'Deep Forest', 'Terrain', 'Rare', 'Au confins de la Neon Forest, le sous-bois devient un labyrinthe de silhouettes changeantes : d’étranges ombres glissent sous les lianes phosphorescentes. Seuls les plus téméraires osent y récolter les champignons luminescents, dont la valeur vaut bien le danger… Bonne chance aux âmes intrépides.', 4, 5, 1, 'BZH01'),
  ('BZH01_ET001', 'Temple of Echoes', 'Terrain', 'Epic', 'Lieu mystique résonnant des voix oubliées.', 7, 4, 2, 'BZH01')
ON CONFLICT (id) DO UPDATE SET
  name        = EXCLUDED.name,
  type        = EXCLUDED.type,
  rarity      = EXCLUDED.rarity,
  description = EXCLUDED.description,
  power       = EXCLUDED.power,
  shield      = EXCLUDED.shield,
  energy      = EXCLUDED.energy,
  set_code    = EXCLUDED.set_code,
  updated_at  = now();
