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
