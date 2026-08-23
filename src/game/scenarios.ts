import { Scenario } from './types';

export const SCENARIOS: Scenario[] = [
  {
    id: 'goblin_borderlands',
    name: 'The Goblin Borderlands',
    difficulty: 'Easy',
    description: 'Goblin outposts have severed the royal trade routes. Establish your town, train brave heroes, place bounties, and raze all 3 Goblin Encampments.',
    startingGold: 1400,
    startingMana: 120,
    objectiveText: 'Destroy all 3 Goblin Encampments & sewer rat nests.',
    defeatText: 'The Royal Palace has fallen to the greenskin horde.',
    mapWidth: 60,
    mapHeight: 60,
    initialLairs: [
      { type: 'sewer_grate', x: 22, y: 24, monsterType: 'giant_rat', maxMonsters: 3, spawnInterval: 12 },
      { type: 'sewer_grate', x: 38, y: 22, monsterType: 'giant_rat', maxMonsters: 3, spawnInterval: 14 },
      { type: 'goblin_hut', x: 12, y: 14, monsterType: 'goblin_spearman', maxMonsters: 4, spawnInterval: 16 },
      { type: 'goblin_hut', x: 48, y: 15, monsterType: 'goblin_spearman', maxMonsters: 4, spawnInterval: 18 },
      { type: 'goblin_hut', x: 46, y: 46, monsterType: 'goblin_shaman', maxMonsters: 3, spawnInterval: 20 },
      { type: 'wolf_den', x: 14, y: 44, monsterType: 'dire_wolf', maxMonsters: 2, spawnInterval: 22 }
    ],
    winCondition: (state) => {
      // Win when all initial lairs are destroyed
      return state.lairs.length === 0;
    },
    lossCondition: (state) => {
      const palace = state.buildings.find(b => b.type === 'palace');
      return !palace || palace.hp <= 0;
    }
  },
  {
    id: 'cursed_graveyards',
    name: 'Night of the Cursed Graveyards',
    difficulty: 'Medium',
    description: 'An ancient curse plagues the valley. At dusk, legions of skeletons and rotting zombies emerge from the mausoleums. Recruit holy Clerics to purge the evil and banish the Necromancer.',
    startingGold: 1750,
    startingMana: 180,
    objectiveText: 'Purge all Graveyards and slay the Dark Necromancer.',
    defeatText: 'Your kingdom has been consumed by eternal darkness.',
    mapWidth: 64,
    mapHeight: 64,
    initialLairs: [
      { type: 'graveyard', x: 15, y: 15, monsterType: 'skeleton', maxMonsters: 4, spawnInterval: 12 },
      { type: 'graveyard', x: 50, y: 14, monsterType: 'zombie', maxMonsters: 4, spawnInterval: 14 },
      { type: 'graveyard', x: 16, y: 48, monsterType: 'skeleton', maxMonsters: 4, spawnInterval: 13 },
      { type: 'graveyard', x: 48, y: 50, monsterType: 'zombie', maxMonsters: 4, spawnInterval: 15 },
      { type: 'ancient_ruins', x: 32, y: 10, monsterType: 'necromancer', maxMonsters: 1, spawnInterval: 999 }
    ],
    winCondition: (state) => {
      return state.lairs.length === 0 && !state.monsters.some(m => m.type === 'necromancer');
    },
    lossCondition: (state) => {
      const palace = state.buildings.find(b => b.type === 'palace');
      return !palace || palace.hp <= 0;
    }
  },
  {
    id: 'dragon_caldor',
    name: "The Dragon's Wrath",
    difficulty: 'Hard',
    description: 'The ancient Red Dragon Fryre has awakened in the northern mountains. Build a thriving metropolis, forge masterwork Dragonforged weapons, and set an enormous bounty on the dragon.',
    startingGold: 2200,
    startingMana: 250,
    objectiveText: 'Slay Red Dragon Fryre and eradicate the monster dens.',
    defeatText: 'The dragon reduced your kingdom to cinders and ash.',
    mapWidth: 70,
    mapHeight: 70,
    initialLairs: [
      { type: 'wolf_den', x: 18, y: 22, monsterType: 'dire_wolf', maxMonsters: 3, spawnInterval: 14 },
      { type: 'ancient_ruins', x: 54, y: 24, monsterType: 'minotaur', maxMonsters: 2, spawnInterval: 25 },
      { type: 'graveyard', x: 20, y: 52, monsterType: 'skeleton', maxMonsters: 4, spawnInterval: 15 },
      { type: 'goblin_hut', x: 52, y: 50, monsterType: 'goblin_shaman', maxMonsters: 3, spawnInterval: 18 },
      { type: 'dragon_cavern', x: 35, y: 10, monsterType: 'red_dragon', maxMonsters: 1, spawnInterval: 999 }
    ],
    winCondition: (state) => {
      const dragonAlive = state.monsters.some(m => m.type === 'red_dragon');
      const dragonLairAlive = state.lairs.some(l => l.type === 'dragon_cavern');
      return !dragonAlive && !dragonLairAlive;
    },
    lossCondition: (state) => {
      const palace = state.buildings.find(b => b.type === 'palace');
      return !palace || palace.hp <= 0;
    }
  },
  {
    id: 'endless_realm',
    name: 'Endless Sovereign (Sandbox)',
    difficulty: 'Endless',
    description: 'An open-ended sandbox mode. Build your dream kingdom, manage a bustling economy, explore a vast uncharted realm with periodic wandering beasts and bosses.',
    startingGold: 2500,
    startingMana: 300,
    objectiveText: 'Expand your kingdom and survive as many days as possible.',
    defeatText: 'Your reign has come to an end.',
    mapWidth: 80,
    mapHeight: 80,
    initialLairs: [
      { type: 'sewer_grate', x: 30, y: 32, monsterType: 'giant_rat', maxMonsters: 3, spawnInterval: 15 },
      { type: 'goblin_hut', x: 20, y: 20, monsterType: 'goblin_spearman', maxMonsters: 4, spawnInterval: 20 },
      { type: 'graveyard', x: 60, y: 22, monsterType: 'skeleton', maxMonsters: 4, spawnInterval: 18 },
      { type: 'wolf_den', x: 22, y: 62, monsterType: 'dire_wolf', maxMonsters: 3, spawnInterval: 22 },
      { type: 'ancient_ruins', x: 62, y: 60, monsterType: 'minotaur', maxMonsters: 2, spawnInterval: 30 }
    ],
    winCondition: () => false, // endless
    lossCondition: (state) => {
      const palace = state.buildings.find(b => b.type === 'palace');
      return !palace || palace.hp <= 0;
    }
  }
];
