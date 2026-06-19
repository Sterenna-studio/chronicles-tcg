import json, os

# Seed déterministe basé sur l'id de la carte
def card_seed(card_id):
    s = 0
    for i, c in enumerate(card_id):
        s = (s * 31 + ord(c) * (i + 1)) & 0xFFFFFFFF
    return s

def seeded_range(seed, lo, hi):
    """Retourne un entier dans [lo, hi] de façon déterministe."""
    return lo + (seed % (hi - lo + 1))

RARITY_RANGES = {
    'Common':    dict(power=(2,4),  shield=(1,3),  energy=(1,2)),
    'Rare':      dict(power=(4,6),  shield=(2,4),  energy=(2,3)),
    'Epic':      dict(power=(6,8),  shield=(3,5),  energy=(3,4)),
    'Legendary': dict(power=(8,10), shield=(4,6),  energy=(4,5)),
    'Mythical':  dict(power=(10,13),shield=(5,8),  energy=(5,6)),
}

TYPE_MODS = {
    'Champion':  dict(power=+1, shield= 0, energy=+1),
    'Companion': dict(power= 0, shield=+1, energy=-1),
    'Event':     dict(power=+1, shield=-1, energy= 0),
    'Object':    dict(power=-1, shield=+2, energy=-1),
    'Terrain':   dict(power=-1, shield=+1, energy=-1),
    'Special':   dict(power=+1, shield=+1, energy= 0),
    'Team':      dict(power=+2, shield=+1, energy=+2),
}

def gen_stats(card):
    if 'power' in card and 'shield' in card and 'energy' in card:
        return card  # idempotent

    rarity = card.get('rarity', 'Common')
    ctype  = card.get('type', 'Special')
    seed   = card_seed(card['id'])

    ranges = RARITY_RANGES.get(rarity, RARITY_RANGES['Common'])
    mods   = TYPE_MODS.get(ctype, TYPE_MODS['Special'])

    # Variation dans la plage via différents bits du seed
    power  = seeded_range(seed,        *ranges['power'])
    shield = seeded_range(seed >> 8,   *ranges['shield'])
    energy = seeded_range(seed >> 16,  *ranges['energy'])

    # Applique les modificateurs de type
    power  = max(1, power  + mods['power'])
    shield = max(0, shield + mods['shield'])
    energy = max(1, energy + mods['energy'])

    return {**card, 'power': power, 'shield': shield, 'energy': energy}

sets = ['BZH01.json', 'BZH02.json']
base = '/sessions/compassionate-sharp-pasteur/mnt/chronicles-tcg/data'

for fname in sets:
    path = os.path.join(base, fname)
    with open(path) as f:
        cards = json.load(f)
    updated = [gen_stats(c) for c in cards]
    with open(path, 'w') as f:
        json.dump(updated, f, indent=2, ensure_ascii=False)
    already = sum(1 for c in cards if 'power' in c)
    new_     = len(cards) - already
    print(f"{fname}: {len(cards)} cartes ({already} déjà statsées, {new_} ajoutées)")
    # Distribution
    from collections import Counter
    dist = Counter(c['rarity'] for c in updated)
    for r,n in sorted(dist.items()): print(f"  {r}: {n}")
    print(f"  power range: {min(c['power'] for c in updated)}-{max(c['power'] for c in updated)}")
    print(f"  shield range: {min(c['shield'] for c in updated)}-{max(c['shield'] for c in updated)}")
    print(f"  energy range: {min(c['energy'] for c in updated)}-{max(c['energy'] for c in updated)}")
    print()
