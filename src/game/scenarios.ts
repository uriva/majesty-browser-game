import { Scenario } from './types';

export const SCENARIOS: Scenario[] = [
  {
    id: 'goblin_borderlands',
    name: 'The Goblin Borderlands',
    difficulty: 'Easy',
    description: 'Goblin outposts have severed the royal trade routes. Establish your town, train brave heroes, place bounties, and raze all Goblin Encampments and monster dens across the province.',
    startingGold: 1100,
    startingMana: 100,
    objectiveText: 'Destroy all Goblin Encampments, Wolf Dens & Sewer Nests across the borderlands.',
    defeatText: 'The Royal Palace has fallen to the greenskin horde.',
    mapWidth: 96,
    mapHeight: 96,
    initialLairs: [
      { type: 'sewer_grate', x: 38, y: 42, monsterType: 'giant_rat', maxMonsters: 4, spawnInterval: 10 },
      { type: 'sewer_grate', x: 58, y: 56, monsterType: 'giant_rat', maxMonsters: 4, spawnInterval: 12 },
      { type: 'goblin_hut', x: 18, y: 20, monsterType: 'goblin_spearman', maxMonsters: 5, spawnInterval: 14 },
      { type: 'goblin_hut', x: 78, y: 22, monsterType: 'goblin_spearman', maxMonsters: 5, spawnInterval: 14 },
      { type: 'goblin_hut', x: 76, y: 76, monsterType: 'goblin_shaman', maxMonsters: 4, spawnInterval: 16 },
      { type: 'goblin_hut', x: 22, y: 74, monsterType: 'goblin_spearman', maxMonsters: 5, spawnInterval: 15 },
      { type: 'wolf_den', x: 20, y: 48, monsterType: 'dire_wolf', maxMonsters: 3, spawnInterval: 18 },
      { type: 'wolf_den', x: 80, y: 52, monsterType: 'dire_wolf', maxMonsters: 3, spawnInterval: 18 }
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
    description: 'An ancient curse plagues the vast misty valley. At dusk, legions of skeletons and rotting zombies emerge from the mausoleums. Recruit holy Clerics to purge the evil and banish the Dark Necromancer.',
    startingGold: 1350,
    startingMana: 150,
    objectiveText: 'Purge all Cursed Graveyards and slay the Dark Necromancer.',
    defeatText: 'Your kingdom has been consumed by eternal darkness.',
    mapWidth: 112,
    mapHeight: 112,
    initialLairs: [
      { type: 'graveyard', x: 24, y: 24, monsterType: 'skeleton', maxMonsters: 5, spawnInterval: 11 },
      { type: 'graveyard', x: 88, y: 22, monsterType: 'zombie', maxMonsters: 5, spawnInterval: 12 },
      { type: 'graveyard', x: 22, y: 86, monsterType: 'skeleton', maxMonsters: 5, spawnInterval: 11 },
      { type: 'graveyard', x: 86, y: 88, monsterType: 'zombie', maxMonsters: 5, spawnInterval: 13 },
      { type: 'graveyard', x: 18, y: 54, monsterType: 'skeleton', maxMonsters: 4, spawnInterval: 12 },
      { type: 'graveyard', x: 92, y: 56, monsterType: 'zombie', maxMonsters: 4, spawnInterval: 14 },
      { type: 'sewer_grate', x: 44, y: 46, monsterType: 'giant_rat', maxMonsters: 4, spawnInterval: 10 },
      { type: 'ancient_ruins', x: 56, y: 14, monsterType: 'necromancer', maxMonsters: 1, spawnInterval: 999 }
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
    description: 'The ancient Red Dragon Fryre has awakened atop the northern mountain peaks. Build a thriving metropolis, forge masterwork Dragonforged weapons, withstand devastating dragon raids, and place a king\'s ransom on the beast.',
    startingGold: 1600,
    startingMana: 200,
    objectiveText: 'Slay Red Dragon Fryre and eradicate all hostile monster dens.',
    defeatText: 'The dragon reduced your kingdom to cinders and ash.',
    mapWidth: 132,
    mapHeight: 132,
    initialLairs: [
      { type: 'wolf_den', x: 26, y: 32, monsterType: 'dire_wolf', maxMonsters: 4, spawnInterval: 12 },
      { type: 'wolf_den', x: 104, y: 36, monsterType: 'dire_wolf', maxMonsters: 4, spawnInterval: 13 },
      { type: 'ancient_ruins', x: 102, y: 100, monsterType: 'minotaur', maxMonsters: 3, spawnInterval: 20 },
      { type: 'ancient_ruins', x: 28, y: 98, monsterType: 'minotaur', maxMonsters: 3, spawnInterval: 22 },
      { type: 'graveyard', x: 32, y: 64, monsterType: 'skeleton', maxMonsters: 5, spawnInterval: 12 },
      { type: 'goblin_hut', x: 98, y: 66, monsterType: 'goblin_shaman', maxMonsters: 4, spawnInterval: 14 },
      { type: 'sewer_grate', x: 54, y: 58, monsterType: 'giant_rat', maxMonsters: 4, spawnInterval: 10 },
      { type: 'dragon_cavern', x: 66, y: 14, monsterType: 'red_dragon', maxMonsters: 1, spawnInterval: 999 }
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
    description: 'An expansive open-ended realm. Build a sprawling empire, master kingdom economics, explore uncharted frontiers, and defend against endless waves of migrating predators and roaming titans.',
    startingGold: 1800,
    startingMana: 250,
    objectiveText: 'Expand your kingdom and survive as many days as possible.',
    defeatText: 'Your reign has come to an end.',
    mapWidth: 144,
    mapHeight: 144,
    initialLairs: [
      { type: 'sewer_grate', x: 58, y: 62, monsterType: 'giant_rat', maxMonsters: 4, spawnInterval: 10 },
      { type: 'goblin_hut', x: 30, y: 30, monsterType: 'goblin_spearman', maxMonsters: 5, spawnInterval: 16 },
      { type: 'goblin_hut', x: 114, y: 32, monsterType: 'goblin_shaman', maxMonsters: 4, spawnInterval: 18 },
      { type: 'graveyard', x: 112, y: 110, monsterType: 'skeleton', maxMonsters: 5, spawnInterval: 14 },
      { type: 'graveyard', x: 34, y: 112, monsterType: 'zombie', maxMonsters: 5, spawnInterval: 15 },
      { type: 'wolf_den', x: 30, y: 72, monsterType: 'dire_wolf', maxMonsters: 4, spawnInterval: 18 },
      { type: 'ancient_ruins', x: 116, y: 74, monsterType: 'minotaur', maxMonsters: 3, spawnInterval: 24 },
      { type: 'dragon_cavern', x: 72, y: 16, monsterType: 'red_dragon', maxMonsters: 1, spawnInterval: 999 }
    ],
    winCondition: () => false, // endless
    lossCondition: (state) => {
      const palace = state.buildings.find(b => b.type === 'palace');
      return !palace || palace.hp <= 0;
    }
  }
];
