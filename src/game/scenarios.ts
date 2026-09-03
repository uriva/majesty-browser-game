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
    mapWidth: 144,
    mapHeight: 144,
    initialLairs: [
      { type: 'sewer_grate', x: 58, y: 64, monsterType: 'giant_rat', maxMonsters: 4, spawnInterval: 10 },
      { type: 'sewer_grate', x: 86, y: 82, monsterType: 'giant_rat', maxMonsters: 4, spawnInterval: 12 },
      { type: 'goblin_hut', x: 28, y: 30, monsterType: 'goblin_spearman', maxMonsters: 5, spawnInterval: 14 },
      { type: 'goblin_hut', x: 116, y: 32, monsterType: 'goblin_spearman', maxMonsters: 5, spawnInterval: 14 },
      { type: 'goblin_hut', x: 112, y: 114, monsterType: 'goblin_shaman', maxMonsters: 4, spawnInterval: 16 },
      { type: 'goblin_hut', x: 32, y: 110, monsterType: 'goblin_spearman', maxMonsters: 5, spawnInterval: 15 },
      { type: 'wolf_den', x: 30, y: 70, monsterType: 'dire_wolf', maxMonsters: 3, spawnInterval: 18 },
      { type: 'wolf_den', x: 118, y: 76, monsterType: 'dire_wolf', maxMonsters: 3, spawnInterval: 18 },
      { type: 'harpy_roost', x: 72, y: 18, monsterType: 'harpy', maxMonsters: 3, spawnInterval: 20 },
      { type: 'harpy_roost', x: 18, y: 98, monsterType: 'harpy', maxMonsters: 3, spawnInterval: 22 },
      { type: 'troll_bridge', x: 126, y: 126, monsterType: 'troll', maxMonsters: 2, spawnInterval: 30 }
    ],
    initialPOIs: [
      { type: 'healing_shrine', x: 50, y: 88, name: 'Shrine of Dauros', description: 'Ancient holy spring that heals weary champions to full health and restores mana.' },
      { type: 'gold_mine', x: 120, y: 48, name: 'Royal Iron & Gold Quarry', description: 'Abandoned quarry. Once claimed by your heroes, pays +35g tribute every 25 seconds.', tributeAmount: 35 },
      { type: 'ancient_vault', x: 26, y: 128, name: 'Crypt of the First King', description: 'Sealed vault containing an ancient war-chest (+350g) and mastercrafted weapons.' }
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
    mapWidth: 160,
    mapHeight: 160,
    initialLairs: [
      { type: 'graveyard', x: 36, y: 36, monsterType: 'skeleton', maxMonsters: 5, spawnInterval: 11 },
      { type: 'graveyard', x: 126, y: 32, monsterType: 'zombie', maxMonsters: 5, spawnInterval: 12 },
      { type: 'graveyard', x: 32, y: 122, monsterType: 'skeleton', maxMonsters: 5, spawnInterval: 11 },
      { type: 'graveyard', x: 122, y: 128, monsterType: 'zombie', maxMonsters: 5, spawnInterval: 13 },
      { type: 'graveyard', x: 26, y: 78, monsterType: 'skeleton', maxMonsters: 4, spawnInterval: 12 },
      { type: 'graveyard', x: 132, y: 82, monsterType: 'zombie', maxMonsters: 4, spawnInterval: 14 },
      { type: 'dark_castle', x: 80, y: 138, monsterType: 'werewolf', maxMonsters: 2, spawnInterval: 26 },
      { type: 'sewer_grate', x: 68, y: 68, monsterType: 'giant_rat', maxMonsters: 4, spawnInterval: 10 },
      { type: 'ancient_ruins', x: 82, y: 22, monsterType: 'necromancer', maxMonsters: 1, spawnInterval: 999 }
    ],
    initialPOIs: [
      { type: 'healing_shrine', x: 92, y: 44, name: 'Sanctuary of Light', description: 'Blessed consecrated ground whose font cures wounds and purges dark curses.' },
      { type: 'ancient_vault', x: 142, y: 38, name: 'Mausoleum of Saint Judis', description: 'A holy resting place holding sacred relics (+400g) and holy weaponry.' },
      { type: 'gold_mine', x: 38, y: 140, name: 'Flooded Peat Quarry', description: 'An old mining pit paying steady +35g tribute once claimed by your champions.', tributeAmount: 35 }
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
    mapWidth: 192,
    mapHeight: 192,
    initialLairs: [
      { type: 'wolf_den', x: 42, y: 52, monsterType: 'dire_wolf', maxMonsters: 4, spawnInterval: 12 },
      { type: 'wolf_den', x: 150, y: 56, monsterType: 'dire_wolf', maxMonsters: 4, spawnInterval: 13 },
      { type: 'ancient_ruins', x: 148, y: 144, monsterType: 'minotaur', maxMonsters: 3, spawnInterval: 20 },
      { type: 'ancient_ruins', x: 42, y: 142, monsterType: 'minotaur', maxMonsters: 3, spawnInterval: 22 },
      { type: 'graveyard', x: 50, y: 94, monsterType: 'skeleton', maxMonsters: 5, spawnInterval: 12 },
      { type: 'goblin_hut', x: 144, y: 98, monsterType: 'goblin_shaman', maxMonsters: 4, spawnInterval: 14 },
      { type: 'troll_bridge', x: 96, y: 118, monsterType: 'troll', maxMonsters: 2, spawnInterval: 28 },
      { type: 'troll_bridge', x: 30, y: 160, monsterType: 'troll', maxMonsters: 2, spawnInterval: 32 },
      { type: 'harpy_roost', x: 160, y: 28, monsterType: 'harpy', maxMonsters: 3, spawnInterval: 20 },
      { type: 'sewer_grate', x: 82, y: 86, monsterType: 'giant_rat', maxMonsters: 4, spawnInterval: 10 },
      { type: 'dragon_cavern', x: 96, y: 22, monsterType: 'red_dragon', maxMonsters: 1, spawnInterval: 999 }
    ],
    initialPOIs: [
      { type: 'healing_shrine', x: 72, y: 76, name: 'Spring of the Salamander', description: 'Thermal volcanic spring that purges wounds and bolsters heroes against dragonfire.' },
      { type: 'gold_mine', x: 168, y: 64, name: 'Deep Mithril & Gold Vein', description: 'Rich northern mountain lode paying +50g tribute once secured by your champions.', tributeAmount: 50 },
      { type: 'ancient_vault', x: 164, y: 168, name: 'Forge of the Dragon-Smiths', description: 'Ancient titan workshop holding lost dragonscale armaments and royal treasure (+450g).' }
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
    mapWidth: 180,
    mapHeight: 180,
    initialLairs: [
      { type: 'dark_castle', x: 90, y: 150, monsterType: 'vampire_lord', maxMonsters: 1, spawnInterval: 999 },
      { type: 'dark_castle', x: 32, y: 118, monsterType: 'werewolf', maxMonsters: 2, spawnInterval: 24 },
      { type: 'graveyard', x: 36, y: 44, monsterType: 'skeleton', maxMonsters: 5, spawnInterval: 12 },
      { type: 'graveyard', x: 144, y: 52, monsterType: 'zombie', maxMonsters: 5, spawnInterval: 13 },
      { type: 'harpy_roost', x: 146, y: 122, monsterType: 'harpy', maxMonsters: 4, spawnInterval: 18 },
      { type: 'harpy_roost', x: 28, y: 148, monsterType: 'harpy', maxMonsters: 3, spawnInterval: 21 },
      { type: 'troll_bridge', x: 134, y: 86, monsterType: 'troll', maxMonsters: 2, spawnInterval: 27 },
      { type: 'wolf_den', x: 54, y: 78, monsterType: 'dire_wolf', maxMonsters: 4, spawnInterval: 15 },
      { type: 'sewer_grate', x: 88, y: 74, monsterType: 'giant_rat', maxMonsters: 4, spawnInterval: 10 }
    ],
    initialPOIs: [
      { type: 'healing_shrine', x: 110, y: 64, name: 'Moonstone Grotto', description: 'Luminous coastal springs that cleanse wounds and replenish royal mana.' },
      { type: 'ancient_vault', x: 44, y: 160, name: 'Sunken Corsair Galleon', description: 'A half-submerged pirate wreck laden with plundered doubloons (+400g).' },
      { type: 'gold_mine', x: 156, y: 148, name: 'Black-Sand Pearl Bank', description: 'Rich coastal oyster banks yielding +40g tribute every 25 seconds.', tributeAmount: 40 }
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
    mapWidth: 224,
    mapHeight: 224,
    initialLairs: [
      { type: 'sewer_grate', x: 92, y: 100, monsterType: 'giant_rat', maxMonsters: 4, spawnInterval: 10 },
      { type: 'goblin_hut', x: 48, y: 48, monsterType: 'goblin_spearman', maxMonsters: 5, spawnInterval: 16 },
      { type: 'goblin_hut', x: 178, y: 52, monsterType: 'goblin_shaman', maxMonsters: 4, spawnInterval: 18 },
      { type: 'graveyard', x: 176, y: 172, monsterType: 'skeleton', maxMonsters: 5, spawnInterval: 14 },
      { type: 'graveyard', x: 54, y: 176, monsterType: 'zombie', maxMonsters: 5, spawnInterval: 15 },
      { type: 'wolf_den', x: 48, y: 114, monsterType: 'dire_wolf', maxMonsters: 4, spawnInterval: 18 },
      { type: 'harpy_roost', x: 114, y: 28, monsterType: 'harpy', maxMonsters: 3, spawnInterval: 20 },
      { type: 'troll_bridge', x: 182, y: 118, monsterType: 'troll', maxMonsters: 2, spawnInterval: 28 },
      { type: 'dark_castle', x: 30, y: 30, monsterType: 'werewolf', maxMonsters: 2, spawnInterval: 25 },
      { type: 'ancient_ruins', x: 184, y: 184, monsterType: 'minotaur', maxMonsters: 3, spawnInterval: 24 },
      { type: 'dragon_cavern', x: 114, y: 24, monsterType: 'red_dragon', maxMonsters: 1, spawnInterval: 999 }
    ],
    initialPOIs: [
      { type: 'healing_shrine', x: 80, y: 128, name: 'Shrine of the Sovereign', description: 'Holy sanctuary that fully restores hit points and replenishes mana.' },
      { type: 'healing_shrine', x: 140, y: 78, name: 'Font of the Dawn', description: 'Sunlit spring granting vigor and divine fortitude.' },
      { type: 'gold_mine', x: 188, y: 64, name: 'Imperial Gold Diggings', description: 'Vast vein yielding +45g tribute every 25 seconds once claimed.', tributeAmount: 45 },
      { type: 'gold_mine', x: 40, y: 188, name: 'South Sea Pearl Bed', description: 'Exotic coastal fishery paying +40g tribute.', tributeAmount: 40 },
      { type: 'ancient_vault', x: 194, y: 194, name: 'Vault of the Dragon Kings', description: 'Colossal subterranean treasure chamber (+500g).' }
    ],
    winCondition: () => false, // endless
    lossCondition: (state) => {
      const palace = state.buildings.find(b => b.type === 'palace');
      return !palace || palace.hp <= 0;
    }
  }
];
