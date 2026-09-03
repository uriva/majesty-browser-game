import { BuildingType, GameState, LairType, QuestDef, QuestObjective, QuestProgress } from './types';

/**
 * Quest chains: the plot layer on top of the sandbox.
 * Main quests unlock in array order; side quests are active from the start.
 * All progress is polled from live state (see evaluateObjective) so objectives
 * survive save/load without extra bookkeeping.
 */
export const QUEST_CHAINS: Record<string, QuestDef[]> = {
  goblin_borderlands: [
    {
      id: 'borderlands_foothold',
      name: 'A Foothold in the Borderlands',
      act: 'Act I — Survive & Build',
      description: 'The trade routes are severed and goblin drums beat in the hills. Raise guildhalls, recruit blades, and show the frontier the crown still rules.',
      stages: [
        {
          id: 'raise_guildhall',
          title: 'Raise a Guildhall',
          introText: 'No heroes without a hearth. Build a Warrior, Ranger, or Rogue guildhall.',
          objectives: [
            { kind: 'construct', description: 'Build a guildhall', count: 1, buildingTypes: ['warrior_guild', 'ranger_guild', 'rogue_guild'] }
          ],
          rewardGold: 100
        },
        {
          id: 'recruit_blades',
          title: 'Recruit Blades',
          introText: 'Three sellswords will answer the call. The tavern keeper already waters the wine.',
          objectives: [{ kind: 'recruit', description: 'Recruit heroes', count: 3 }],
          rewardGold: 100,
          rewardMana: 40
        },
        {
          id: 'first_blood_money',
          title: 'First Blood Money',
          introText: 'Heroes follow coin, not crowns. Post a bounty flag and watch them move.',
          objectives: [{ kind: 'place_bounty', description: 'Post bounty flags', count: 1 }],
          rewardGold: 50
        }
      ]
    },
    {
      id: 'borderlands_horde',
      name: 'The Horde Stirs',
      act: 'Act II — Strike Back',
      description: 'The outposts multiply. Burn their nests — and answer Warlord Gitz, who has sworn to hang your banner from his hut.',
      stages: [
        {
          id: 'burn_nests',
          title: 'Burn Two Nests',
          introText: 'Pick two lairs, price them in gold, and let the guilds earn it.',
          objectives: [{ kind: 'destroy_lairs', description: 'Destroy monster lairs', count: 2 }],
          rewardGold: 150
        },
        {
          id: 'slay_warlord',
          title: 'Slay Warlord Gitz',
          introText: 'Gitz the One-Eyed marches with his bodyguard. Put a royal bounty on his head.',
          objectives: [{ kind: 'slay_boss', description: 'Slay Warlord Gitz' }],
          rewardGold: 250,
          rewardMana: 60,
          spawnBoss: {
            monsterType: 'goblin_shaman',
            name: 'Warlord Gitz',
            title: 'One-Eyed Warlord of the Hills',
            hpMult: 3.4,
            attackMult: 1.7,
            nearLairType: 'goblin_hut',
            introText: 'Warlord Gitz has left his hut with a bodyguard, marching on your lands!'
          }
        }
      ]
    },
    {
      id: 'borderlands_warrens',
      name: 'Raze the Warrens',
      act: 'Act III — End It',
      description: 'Gitz is dead but the warrens still fester. Leave none standing and the Borderlands are yours.',
      stages: [
        {
          id: 'leave_none',
          title: 'Leave None Standing',
          introText: 'Every sewer, den, roost, and bridge. Burn it all.',
          objectives: [{ kind: 'raze_all', description: 'Raze every lair (0 remain)' }],
          rewardGold: 400,
          rewardMana: 100
        }
      ]
    },
    {
      id: 'borderlands_ratcatcher',
      name: 'Ratcatcher',
      act: 'Side Contract',
      description: 'Rats in the sewers, rats in the grain. The palace steward offers a standing bounty on sewer grates.',
      side: true,
      stages: [
        {
          id: 'cull_sewers',
          title: 'Cull the Sewers',
          introText: 'Collapse two sewer grates. The steward pays in coin, no questions.',
          objectives: [{ kind: 'destroy_lairs', description: 'Destroy sewer grates', count: 2, lairType: 'sewer_grate' }],
          rewardGold: 120
        }
      ]
    }
  ],

  cursed_graveyards: [
    {
      id: 'graveyards_consecration',
      name: 'Consecration of the Valley',
      act: 'Act I — Holy Fire',
      description: 'The dead do not sleep in these misty moors. Found a Cleric Temple or Warrior Guild, muster faithful champions, and withstand the nightly terrors.',
      stages: [
        {
          id: 'holy_hearth',
          title: 'Consecrate the Ground',
          introText: 'The living need holy ground. Build a Cleric Temple, Warrior Guild, or Guard Tower.',
          objectives: [
            { kind: 'construct', description: 'Build a sanctuary', count: 1, buildingTypes: ['cleric_temple', 'warrior_guild', 'guard_tower'] }
          ],
          rewardGold: 150,
          rewardMana: 50
        },
        {
          id: 'muster_faithful',
          title: 'Muster the Faithful',
          introText: 'Recruit four champions to patrol the parish boundaries and guard the commonfolk.',
          objectives: [{ kind: 'recruit', description: 'Recruit champions', count: 4 }],
          rewardGold: 150,
          rewardMana: 50
        },
        {
          id: 'survive_night',
          title: 'Survive the Witching Hour',
          introText: 'Hold the settlement through dusk and darkness until dawn breaks on Day 2.',
          objectives: [{ kind: 'reach_day', description: 'Survive to Day 2', day: 2 }],
          rewardGold: 120
        }
      ]
    },
    {
      id: 'graveyards_howling',
      name: 'The Howling Crypts',
      act: 'Act II — Purge the Tombs',
      description: 'Barrow wolves and flesh-eaters prowl the fog. Break into the ancient mausoleums and bring down Alpha Grimfang before his pack overwhelms the town.',
      stages: [
        {
          id: 'purge_mausoleums',
          title: 'Purge Three Crypts',
          introText: 'Shatter three graveyards or cursed mausoleums across the moor.',
          objectives: [{ kind: 'destroy_lairs', description: 'Destroy graveyards', count: 3, lairType: 'graveyard' }],
          rewardGold: 220,
          rewardMana: 60
        },
        {
          id: 'slay_grimfang',
          title: 'Slay Alpha Grimfang',
          introText: 'The cursed werewolf Alpha stalks the outskirts! Post a royal bounty on the beast.',
          objectives: [{ kind: 'slay_boss', description: 'Slay Alpha Grimfang' }],
          rewardGold: 320,
          rewardMana: 80,
          spawnBoss: {
            monsterType: 'werewolf',
            name: 'Alpha Grimfang',
            title: 'Dread Werewolf of the Barrow',
            hpMult: 3.5,
            attackMult: 1.6,
            nearLairType: 'dark_castle',
            introText: 'Alpha Grimfang lets out a bloodcurdling howl and stalks toward your settlement!'
          }
        }
      ]
    },
    {
      id: 'graveyards_banishing',
      name: 'Banish the Darkness',
      act: 'Act III — The Necromancer Falls',
      description: 'The valley groans under eternal night. Slay Lord Morpheus the Dark Necromancer in his ancient ruin.',
      stages: [
        {
          id: 'banish_lich',
          title: 'Slay the Dark Necromancer',
          introText: 'Burn every remaining crypt and strike down the Dark Necromancer.',
          objectives: [{ kind: 'raze_all', description: 'Raze every cursed lair (0 remain)' }],
          rewardGold: 500,
          rewardMana: 150
        }
      ]
    },
    {
      id: 'graveyards_saint_chalice',
      name: 'The Saint’s Relic',
      act: 'Side Contract',
      description: 'The ancient abbey chronicles speak of Saint Judis’ holy chalice, sealed within the ruined barrows.',
      side: true,
      stages: [
        {
          id: 'find_chalice',
          title: 'Recover the Sacred Relic',
          introText: 'Unseal the ancient tomb of Saint Judis in the eastern wilderness.',
          objectives: [{ kind: 'treasury', description: 'Accumulate 1500g in royal treasury', gold: 1500 }],
          rewardGold: 200,
          rewardMana: 80
        }
      ]
    }
  ],

  dragon_caldor: [
    {
      id: 'caldor_bastion',
      name: 'Bastion of Fire',
      act: 'Act I — Fortify Against the Flame',
      description: 'Fryre the Red has reduced kingdoms to cinders. Construct a Blacksmith, reinforce towers, and equip your heroes in fire-tempered steel.',
      stages: [
        {
          id: 'blacksmith_tower',
          title: 'Forge & Watchtower',
          introText: 'Build a Blacksmith to temper steel and a Guard Tower to watch the volcanic peaks.',
          objectives: [
            { kind: 'construct', description: 'Build a Blacksmith or Guard Tower', count: 1, buildingTypes: ['blacksmith', 'guard_tower'] }
          ],
          rewardGold: 160
        },
        {
          id: 'expeditionary_force',
          title: 'Muster the Expedition',
          introText: 'Recruit five brave champions across your guilds to spearhead the mountain assault.',
          objectives: [{ kind: 'recruit', description: 'Recruit heroes', count: 5 }],
          rewardGold: 180,
          rewardMana: 60
        }
      ]
    },
    {
      id: 'caldor_titans',
      name: 'Toll of the Titans',
      act: 'Act II — Break the Mountain Passes',
      description: 'Stone trolls have fortified the gorges. Smash the toll bridges and bring down Gorgar Stonefist, the volcanic colossus.',
      stages: [
        {
          id: 'smash_bridges',
          title: 'Smash Two Troll Bridges',
          introText: 'Sever the trolls’ mountain hold. Raze two troll bridges in the ravines.',
          objectives: [{ kind: 'destroy_lairs', description: 'Destroy troll bridges', count: 2, lairType: 'troll_bridge' }],
          rewardGold: 250
        },
        {
          id: 'slay_gorgar',
          title: 'Slay Gorgar Stonefist',
          introText: 'The mountain titan Gorgar Stonefist descends from the volcanic ridge!',
          objectives: [{ kind: 'slay_boss', description: 'Slay Gorgar Stonefist' }],
          rewardGold: 380,
          rewardMana: 100,
          spawnBoss: {
            monsterType: 'troll',
            name: 'Gorgar Stonefist',
            title: 'Volcanic Mountain Colossus',
            hpMult: 4.0,
            attackMult: 1.8,
            nearLairType: 'ancient_ruins',
            introText: 'The ground quakes! Gorgar Stonefist the colossal mountain troll marches on your gates!'
          }
        }
      ]
    },
    {
      id: 'caldor_dragonslayer',
      name: 'Dragonslayer',
      act: 'Act III — Extinguish the Drake',
      description: 'The ancient Red Dragon Fryre circles overhead. Place a king’s bounty, weather his breath, and end his thousand-year reign.',
      stages: [
        {
          id: 'slay_fryre',
          title: 'Slay Red Dragon Fryre',
          introText: 'Assault the northern dragon peak. Slay the dragon and shatter his cavern.',
          objectives: [{ kind: 'slay_boss', description: 'Slay Red Dragon Fryre' }],
          rewardGold: 600,
          rewardMana: 200
        }
      ]
    },
    {
      id: 'caldor_mithril',
      name: 'The Lost Mithril Lode',
      act: 'Side Contract',
      description: 'Dwarven lore tells of a rich vein of raw mithril in the northern crags. Secure it for steady tribute.',
      side: true,
      stages: [
        {
          id: 'secure_mine',
          title: 'Secure the Deep Vein',
          introText: 'Amass 2200g in the treasury to fund a permanent royal mining expedition.',
          objectives: [{ kind: 'treasury', description: 'Hold 2200g in treasury', gold: 2200 }],
          rewardGold: 300,
          rewardMana: 100
        }
      ]
    }
  ],

  vampire_coast: [
    {
      id: 'coast_foothold',
      name: 'The Drowned Haven',
      act: 'Act I — Coastal Haven',
      description: 'Shipwrecks litter the salt-fens. Establish a tavern, recruit rogue smugglers, and clear the harpy flock from the sea-cliffs.',
      stages: [
        {
          id: 'coastal_haven',
          title: 'Establish a Coastal Guild',
          introText: 'Found a Royal Inn, Rogue Guild, or Marketplace on the salt flats.',
          objectives: [
            { kind: 'construct', description: 'Build coastal structure', count: 1, buildingTypes: ['royal_inn', 'rogue_guild', 'marketplace'] }
          ],
          rewardGold: 160
        },
        {
          id: 'clear_harpies',
          title: 'Shatter the Harpy Roosts',
          introText: 'The winged scavengers drown our sailors. Destroy two harpy roosts.',
          objectives: [{ kind: 'destroy_lairs', description: 'Destroy harpy roosts', count: 2, lairType: 'harpy_roost' }],
          rewardGold: 220,
          rewardMana: 60
        }
      ]
    },
    {
      id: 'coast_bloodmoon',
      name: 'The Blood Moon Hunt',
      act: 'Act II — The Werewolf Baron',
      description: 'At the blood tide, Baron Vane leads his sea-wolf pack to sack the harbors. Send him to the depths.',
      stages: [
        {
          id: 'slay_baron',
          title: 'Slay Baron Vane',
          introText: 'Baron Vane the Corsair Werewolf marches from the drowned keep!',
          objectives: [{ kind: 'slay_boss', description: 'Slay Baron Vane' }],
          rewardGold: 350,
          rewardMana: 80,
          spawnBoss: {
            monsterType: 'werewolf',
            name: 'Baron Vane',
            title: 'Corsair Werewolf of the Fens',
            hpMult: 3.6,
            attackMult: 1.7,
            nearLairType: 'dark_castle',
            introText: 'Baron Vane the dread werewolf corsair lands on your shores!'
          }
        }
      ]
    },
    {
      id: 'coast_malachar',
      name: 'Heart of the Vampire',
      act: 'Act III — End the Eternal Night',
      description: 'Vampire Lord Malachar waits in his sunken castle. Purge every unholy den and slay the vampire lord.',
      stages: [
        {
          id: 'slay_malachar',
          title: 'Slay Vampire Lord Malachar',
          introText: 'Storm Malachar’s fortress and purge every lair on the coast.',
          objectives: [{ kind: 'raze_all', description: 'Raze every hostile lair (0 remain)' }],
          rewardGold: 600,
          rewardMana: 200
        }
      ]
    }
  ]
};

export function getQuestChain(scenarioId: string): QuestDef[] {
  return QUEST_CHAINS[scenarioId] || [];
}

export function getQuestDef(scenarioId: string, questId: string): QuestDef | undefined {
  return getQuestChain(scenarioId).find(q => q.id === questId);
}

export function initQuestsForScenario(scenarioId: string): QuestProgress[] {
  const chain = getQuestChain(scenarioId);
  let mainUnlocked = false;
  return chain.map(q => {
    const active = q.side ? true : !mainUnlocked;
    if (!q.side) mainUnlocked = true;
    return {
      questId: q.id,
      stageIndex: 0,
      status: active ? 'active' : 'locked',
      baselineStage: -1,
      baseline: { heroesRecruited: 0, buildingsConstructed: 0, lairsDestroyed: 0, bountiesPlaced: 0 },
      bossSpawned: false
    } as QuestProgress;
  });
}

export interface ObjectiveProgress {
  current: number;
  target: number;
  done: boolean;
}

function countLiveBuildings(state: GameState, types?: BuildingType[]): number {
  return state.buildings.filter(b =>
    b.hp > 0 && !b.isConstructing && (!types || types.length === 0 || types.includes(b.type))
  ).length;
}

/**
 * Pure progress evaluation shared by the engine tick and the quest tracker UI.
 * `bossAlive` is resolved by the caller (engine knows spawn ids).
 */
export function evaluateObjective(
  state: GameState,
  progress: QuestProgress,
  objective: QuestObjective,
  bossAlive: boolean
): ObjectiveProgress {
  const s = state.stats;
  const b = progress.baseline;
  switch (objective.kind) {
    case 'construct': {
      const target = objective.count || 1;
      const current = Math.min(countLiveBuildings(state, objective.buildingTypes), target);
      return { current, target, done: current >= target };
    }
    case 'recruit': {
      const target = objective.count || 1;
      const current = Math.min(Math.max(0, s.heroesRecruited - b.heroesRecruited), target);
      return { current, target, done: current >= target };
    }
    case 'destroy_lairs': {
      const target = objective.count || 1;
      if (objective.lairType) {
        // Typed: lairs of this type destroyed = (initial of type) - (live of type).
        // Initial counts come from the scenario definition.
        const initial = state.scenario.initialLairs.filter(l => l.type === objective.lairType).length;
        const live = state.lairs.filter(l => l.hp > 0 && l.type === objective.lairType).length;
        const current = Math.min(Math.max(0, initial - live), target);
        return { current, target, done: current >= target };
      }
      const current = Math.min(Math.max(0, s.lairsDestroyed - b.lairsDestroyed), target);
      return { current, target, done: current >= target };
    }
    case 'place_bounty': {
      const target = objective.count || 1;
      const current = Math.min(Math.max(0, (s.bountiesPlaced || 0) - b.bountiesPlaced), target);
      return { current, target, done: current >= target };
    }
    case 'reach_day': {
      const target = objective.day || 1;
      return { current: Math.min(s.daysPassed, target), target, done: s.daysPassed >= target };
    }
    case 'treasury': {
      const target = objective.gold || 0;
      return { current: Math.min(Math.floor(state.treasuryGold), target), target, done: state.treasuryGold >= target };
    }
    case 'raze_all': {
      const remaining = state.lairs.filter(l => l.hp > 0).length;
      return { current: remaining === 0 ? 1 : 0, target: 1, done: remaining === 0 };
    }
    case 'slay_boss': {
      return { current: bossAlive ? 0 : 1, target: 1, done: !bossAlive };
    }
  }
}

export function bossIdFor(questId: string, stageIndex: number): string {
  return `boss_${questId}_${stageIndex}`;
}
