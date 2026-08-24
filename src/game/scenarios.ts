import { Scenario } from './types';

export const SCENARIOS: Scenario[] = [
  {
    id: 'goblin_borderlands',
    name: 'The Goblin Borderlands',
    difficulty: 'Easy',
    description: 'Goblin outposts have severed the royal trade routes. Establish your town, train brave heroes, place bounties, and raze every encampment across the province. Beware: the warbands will not sit idle — they will march on your kingdom.',
    startingGold: 1100,
    startingMana: 100,
    objectiveText: 'Destroy all Goblin Encampments, Harpy Roosts, Troll Bridges, Wolf Dens & Sewer Nests.',
    defeatText: 'The Royal Palace has fallen to the greenskin horde.',
    mapWidth: 128,
    mapHeight: 128,
    initialLairs: [
      { type: 'sewer_grate', x: 50, y: 56, monsterType: 'giant_rat', maxMonsters: 4, spawnInterval: 10 },
      { type: 'sewer_grate', x: 78, y: 74, monsterType: 'giant_rat', maxMonsters: 4, spawnInterval: 12 },
      { type: 'goblin_hut', x: 24, y: 26, monsterType: 'goblin_spearman', maxMonsters: 5, spawnInterval: 14 },
      { type: 'goblin_hut', x: 104, y: 28, monsterType: 'goblin_spearman', maxMonsters: 5, spawnInterval: 14 },
      { type: 'goblin_hut', x: 100, y: 102, monsterType: 'goblin_shaman', maxMonsters: 4, spawnInterval: 16 },
      { type: 'goblin_hut', x: 28, y: 98, monsterType: 'goblin_spearman', maxMonsters: 5, spawnInterval: 15 },
      { type: 'wolf_den', x: 26, y: 62, monsterType: 'dire_wolf', maxMonsters: 3, spawnInterval: 18 },
      { type: 'wolf_den', x: 106, y: 68, monsterType: 'dire_wolf', maxMonsters: 3, spawnInterval: 18 },
      { type: 'harpy_roost', x: 64, y: 16, monsterType: 'harpy', maxMonsters: 3, spawnInterval: 20 },
      { type: 'harpy_roost', x: 14, y: 88, monsterType: 'harpy', maxMonsters: 3, spawnInterval: 22 },
      { type: 'troll_bridge', x: 114, y: 114, monsterType: 'troll', maxMonsters: 2, spawnInterval: 30 }
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
    description: 'An ancient curse plagues a vast misty valley. At dusk, legions of skeletons and rotting zombies emerge from the mausoleums — and when the moon rises, werewolves stalk the dark. Recruit holy Clerics to purge the evil and banish the Dark Necromancer.',
    startingGold: 1350,
    startingMana: 150,
    objectiveText: 'Purge all Cursed Graveyards & Dark Castles, and slay the Dark Necromancer.',
    defeatText: 'Your kingdom has been consumed by eternal darkness.',
    mapWidth: 136,
    mapHeight: 136,
    initialLairs: [
      { type: 'graveyard', x: 32, y: 32, monsterType: 'skeleton', maxMonsters: 5, spawnInterval: 11 },
      { type: 'graveyard', x: 106, y: 28, monsterType: 'zombie', maxMonsters: 5, spawnInterval: 12 },
      { type: 'graveyard', x: 28, y: 104, monsterType: 'skeleton', maxMonsters: 5, spawnInterval: 11 },
      { type: 'graveyard', x: 104, y: 108, monsterType: 'zombie', maxMonsters: 5, spawnInterval: 13 },
      { type: 'graveyard', x: 22, y: 68, monsterType: 'skeleton', maxMonsters: 4, spawnInterval: 12 },
      { type: 'graveyard', x: 112, y: 70, monsterType: 'zombie', maxMonsters: 4, spawnInterval: 14 },
      { type: 'dark_castle', x: 68, y: 118, monsterType: 'werewolf', maxMonsters: 2, spawnInterval: 26 },
      { type: 'sewer_grate', x: 58, y: 58, monsterType: 'giant_rat', maxMonsters: 4, spawnInterval: 10 },
      { type: 'ancient_ruins', x: 70, y: 18, monsterType: 'necromancer', maxMonsters: 1, spawnInterval: 999 }
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
    description: 'The ancient Red Dragon Fryre has awakened atop the northern mountain peaks. Bridge Tolls exacted by trolls strangle the trade roads while dragonfire rains from above. Build a thriving metropolis, forge masterwork Dragonforged weapons, withstand devastating raids, and place a king\'s ransom on the beast.',
    startingGold: 1600,
    startingMana: 200,
    objectiveText: 'Slay Red Dragon Fryre and eradicate all hostile monster dens.',
    defeatText: 'The dragon reduced your kingdom to cinders and ash.',
    mapWidth: 156,
    mapHeight: 156,
    initialLairs: [
      { type: 'wolf_den', x: 34, y: 42, monsterType: 'dire_wolf', maxMonsters: 4, spawnInterval: 12 },
      { type: 'wolf_den', x: 122, y: 46, monsterType: 'dire_wolf', maxMonsters: 4, spawnInterval: 13 },
      { type: 'ancient_ruins', x: 120, y: 116, monsterType: 'minotaur', maxMonsters: 3, spawnInterval: 20 },
      { type: 'ancient_ruins', x: 34, y: 114, monsterType: 'minotaur', maxMonsters: 3, spawnInterval: 22 },
      { type: 'graveyard', x: 40, y: 76, monsterType: 'skeleton', maxMonsters: 5, spawnInterval: 12 },
      { type: 'goblin_hut', x: 116, y: 80, monsterType: 'goblin_shaman', maxMonsters: 4, spawnInterval: 14 },
      { type: 'troll_bridge', x: 78, y: 96, monsterType: 'troll', maxMonsters: 2, spawnInterval: 28 },
      { type: 'troll_bridge', x: 24, y: 130, monsterType: 'troll', maxMonsters: 2, spawnInterval: 32 },
      { type: 'harpy_roost', x: 130, y: 22, monsterType: 'harpy', maxMonsters: 3, spawnInterval: 20 },
      { type: 'sewer_grate', x: 66, y: 70, monsterType: 'giant_rat', maxMonsters: 4, spawnInterval: 10 },
      { type: 'dragon_cavern', x: 78, y: 18, monsterType: 'red_dragon', maxMonsters: 1, spawnInterval: 999 }
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
    id: 'vampire_coast',
    name: 'The Vampire Coast',
    difficulty: 'Hard',
    description: 'Vampire Lord Malachar has claimed the drowned marshes of the southern coast. His werewolf packs prowl the fens by night, harpies darken the skies, and his Dark Castle bleeds the land of life. Slay the undying lord in his own halls.',
    startingGold: 1700,
    startingMana: 220,
    objectiveText: 'Slay Vampire Lord Malachar and raze his Dark Castle.',
    defeatText: 'Malachar has drained the last royal bloodline. The night reigns eternal.',
    mapWidth: 148,
    mapHeight: 148,
    initialLairs: [
      { type: 'dark_castle', x: 74, y: 122, monsterType: 'vampire_lord', maxMonsters: 1, spawnInterval: 999 },
      { type: 'dark_castle', x: 26, y: 96, monsterType: 'werewolf', maxMonsters: 2, spawnInterval: 24 },
      { type: 'graveyard', x: 30, y: 36, monsterType: 'skeleton', maxMonsters: 5, spawnInterval: 12 },
      { type: 'graveyard', x: 118, y: 42, monsterType: 'zombie', maxMonsters: 5, spawnInterval: 13 },
      { type: 'harpy_roost', x: 120, y: 100, monsterType: 'harpy', maxMonsters: 4, spawnInterval: 18 },
      { type: 'harpy_roost', x: 22, y: 122, monsterType: 'harpy', maxMonsters: 3, spawnInterval: 21 },
      { type: 'troll_bridge', x: 110, y: 70, monsterType: 'troll', maxMonsters: 2, spawnInterval: 27 },
      { type: 'wolf_den', x: 44, y: 64, monsterType: 'dire_wolf', maxMonsters: 4, spawnInterval: 15 },
      { type: 'sewer_grate', x: 72, y: 60, monsterType: 'giant_rat', maxMonsters: 4, spawnInterval: 10 }
    ],
    winCondition: (state) => {
      const vampireAlive = state.monsters.some(m => m.type === 'vampire_lord');
      const vampireCastleAlive = state.lairs.some(l => l.monsterType === 'vampire_lord');
      return !vampireAlive && !vampireCastleAlive;
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
    description: 'An expansive open-ended realm. Build a sprawling empire, master kingdom economics, explore uncharted frontiers, and defend against endless war parties, migrating predators and roaming titans.',
    startingGold: 1800,
    startingMana: 250,
    objectiveText: 'Expand your kingdom and survive as many days as possible.',
    defeatText: 'Your reign has come to an end.',
    mapWidth: 176,
    mapHeight: 176,
    initialLairs: [
      { type: 'sewer_grate', x: 72, y: 78, monsterType: 'giant_rat', maxMonsters: 4, spawnInterval: 10 },
      { type: 'goblin_hut', x: 38, y: 38, monsterType: 'goblin_spearman', maxMonsters: 5, spawnInterval: 16 },
      { type: 'goblin_hut', x: 140, y: 40, monsterType: 'goblin_shaman', maxMonsters: 4, spawnInterval: 18 },
      { type: 'graveyard', x: 138, y: 134, monsterType: 'skeleton', maxMonsters: 5, spawnInterval: 14 },
      { type: 'graveyard', x: 42, y: 138, monsterType: 'zombie', maxMonsters: 5, spawnInterval: 15 },
      { type: 'wolf_den', x: 38, y: 90, monsterType: 'dire_wolf', maxMonsters: 4, spawnInterval: 18 },
      { type: 'harpy_roost', x: 90, y: 22, monsterType: 'harpy', maxMonsters: 3, spawnInterval: 20 },
      { type: 'troll_bridge', x: 142, y: 92, monsterType: 'troll', maxMonsters: 2, spawnInterval: 28 },
      { type: 'dark_castle', x: 24, y: 24, monsterType: 'werewolf', maxMonsters: 2, spawnInterval: 25 },
      { type: 'ancient_ruins', x: 144, y: 144, monsterType: 'minotaur', maxMonsters: 3, spawnInterval: 24 },
      { type: 'dragon_cavern', x: 90, y: 20, monsterType: 'red_dragon', maxMonsters: 1, spawnInterval: 999 }
    ],
    winCondition: () => false, // endless
    lossCondition: (state) => {
      const palace = state.buildings.find(b => b.type === 'palace');
      return !palace || palace.hp <= 0;
    }
  }
];
