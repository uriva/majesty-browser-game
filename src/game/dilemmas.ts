import { RoyalDilemma } from './types';

export const DILEMMA_POOL: RoyalDilemma[] = [
  {
    id: 'rogue_embezzlement',
    title: 'The Stolen Tariffs',
    sender: 'Chancellor of the Exchequer',
    description: 'Sire! The Guildmaster of Rogues was caught intercepting caravan tariff wagons on the king’s highway. 180 gold pieces were found in a hollow barrel behind the tavern.',
    choices: [
      {
        text: 'Seize the Gold & Fine the Guild',
        effectDescription: 'Recover 180g immediately into the treasury. Rogues will remember this slight.',
        goldGain: 180,
        actionId: 'fine_rogues'
      },
      {
        text: 'Pardon Them & Hire Their Knives (-100g)',
        effectDescription: 'Pay 100g to commission their scouts. All heroes gain +15% movement speed on bounties.',
        goldCost: 100,
        actionId: 'bribe_rogues'
      }
    ]
  },
  {
    id: 'wandering_paladin',
    title: 'A Knight of the Dawn Petitions',
    sender: 'Sir Galahault the Pious',
    description: 'A towering paladin in tarnished plate armor kneels in the throne room: "My sword is sworn to the light, Sovereign. Sponsor my holy vows and supply my steed, and I shall purge your borders."',
    choices: [
      {
        text: 'Sponsor Sir Galahault (-180g)',
        effectDescription: 'A seasoned Level 3 Knight with Steel armor joins your heroes immediately.',
        goldCost: 180,
        actionId: 'sponsor_paladin'
      },
      {
        text: 'Decline with Royal Blessings',
        effectDescription: 'The paladin departs in peace, leaving a vial of holy incense (+50 Sovereign Mana).',
        manaGain: 50,
        actionId: 'decline_paladin'
      }
    ]
  },
  {
    id: 'peasant_grain_relief',
    title: 'Cottagers Plead for Grain',
    sender: 'Delegation of Village Elders',
    description: 'Frost has ravaged the turnip crops and winter approaches. A crowd of commoners gathers outside the portcullis begging for relief from the royal granaries.',
    choices: [
      {
        text: 'Open the Royal Granaries (-140g)',
        effectDescription: 'Spend 140g on provisions. Commoners rejoice! Builders hammer 35% faster for 3 days.',
        goldCost: 140,
        actionId: 'grain_relief'
      },
      {
        text: 'Remind Them of Their Duties',
        effectDescription: 'Keep the royal gold safe. Commoners grumble, but the kingdom treasury remains intact.',
        actionId: 'deny_relief'
      }
    ]
  },
  {
    id: 'alchemist_elixir',
    title: 'The Quicksilver Draught',
    sender: 'Ignatius the Wandering Alchemist',
    description: 'A cloaked apothecary carrying smoking vials offers a proposition: "Pour this tincture of boiled quicksilver into your tavern kegs, Sovereign, and your heroes shall sprint like stags!"',
    choices: [
      {
        text: 'Purchase the Draught (-120g)',
        effectDescription: 'Pay 120g. All heroes gain +20% movement speed and vigor for 2 days.',
        goldCost: 120,
        actionId: 'quicksilver'
      },
      {
        text: 'Confiscate the Reagents',
        effectDescription: 'Expel the charlatan and seize his arcane salts (+60 Sovereign Mana).',
        manaGain: 60,
        actionId: 'seize_reagents'
      }
    ]
  },
  {
    id: 'dwarven_surveyor',
    title: 'Prospector Ironfoot’s Map',
    sender: 'Master Prospector Ironfoot',
    description: 'A soot-stained dwarf unrolls a crinkled parchment covered in subterranean runes: "Found an ancient ore seam in the crags, Your Grace. Fund my drill-crew and the crown takes half the haul."',
    choices: [
      {
        text: 'Fund the Mining Crew (-150g)',
        effectDescription: 'Spend 150g. If successful, yields 350g in raw gold nuggets delivered to your palace!',
        goldCost: 150,
        actionId: 'fund_mine'
      },
      {
        text: 'The Treasury Cannot Gamble',
        effectDescription: 'Politely refuse. The dwarf grunts and heads to the local inn instead.',
        actionId: 'refuse_dwarf'
      }
    ]
  }
];

export function getRandomDilemma(excludeIds: string[] = []): RoyalDilemma | null {
  const available = DILEMMA_POOL.filter(d => !excludeIds.includes(d.id));
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}
