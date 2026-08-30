import { BuildingType, HeroClass, LairDef, LairType, MonsterType, SovereignSpell } from './types';

export const MAP_CONFIG = {
  DEFAULT_WIDTH: 100, // in tiles
  DEFAULT_HEIGHT: 100,
  TILE_SIZE: 32, // in pixels
  FOG_REVEAL_RADIUS_HERO: 8,
  FOG_REVEAL_RADIUS_PEASANT: 6,
  FOG_REVEAL_RADIUS_TAX_COLLECTOR: 6,
  FOG_REVEAL_RADIUS_BUILDING: 10,
  FOG_REVEAL_RADIUS_EXPLORE_FLAG: 7,
};

export interface BuildingDef {
  type: BuildingType;
  name: string;
  cost: number;
  maxHp: number;
  width: number;
  height: number;
  description: string;
  constructionTime?: number;
  recruits?: HeroClass[];
  heroRecruitCost?: Record<string, number>;
  maxHeroSlots?: number;
  upgrades?: {
    id: string;
    name: string;
    cost: number;
    description: string;
    icon: string;
    requiredHeroes?: number;
    requiredBuilding?: BuildingType;
    requiresPalaceLevel?: number;
    requiresUpgrade?: string;
    requiredUpgrades?: string[];
    researchTime?: number;
  }[];
  requiresPalaceLevel?: number;
  requiresBuilding?: BuildingType;
  isDefense?: boolean;
  attackPower?: number;
  attackRange?: number;
  attackCooldown?: number;
}

export const BUILDING_DEFINITIONS: Record<BuildingType, BuildingDef> = {
  palace: {
    type: 'palace',
    name: 'Royal Palace',
    cost: 0,
    maxHp: 3500,
    width: 4,
    height: 4,
    description: 'The seat of your sovereign realm. If it falls, your kingdom is lost.',
    constructionTime: 0,
    recruits: [],
    isDefense: true,
    attackPower: 25,
    attackRange: 160,
    attackCooldown: 1.8,
    upgrades: [
      {
        id: 'palace_lvl2',
        name: 'Palace Fortress (Lvl 2)',
        cost: 1200,
        description: 'Increases Palace HP and unlocks Tier 2 buildings: Wizard Tower, Temple of Dauros & Statue. Requires: 4+ Active Heroes & Marketplace.',
        requiredHeroes: 4,
        requiredBuilding: 'marketplace',
        researchTime: 16.0,
        icon: 'Castle'
      },
      {
        id: 'palace_lvl3',
        name: 'Imperial Citadel (Lvl 3)',
        cost: 3000,
        description: 'Max palace upgrades, unlocks Dwarven Settlement & Grand Magic. Requires: Palace Lv 2, 8+ Active Heroes & Blacksmith.',
        requiresPalaceLevel: 2,
        requiresUpgrade: 'palace_lvl2',
        requiredHeroes: 8,
        requiredBuilding: 'blacksmith',
        researchTime: 24.0,
        icon: 'Crown'
      }
    ]
  },
  warrior_guild: {
    type: 'warrior_guild',
    name: "Warrior's Guild",
    cost: 350,
    maxHp: 900,
    width: 3,
    height: 3,
    description: 'Trains stalwart warriors who brave the battlefield and protect the realm.',
    constructionTime: 22.0,
    recruits: ['warrior'],
    heroRecruitCost: { warrior: 150 },
    maxHeroSlots: 4,
    upgrades: [
      { id: 'iron_resolve', name: 'Iron Resolve', cost: 250, researchTime: 8.0, description: 'Warriors gain +20% HP and 10% more bravery.', icon: 'Shield' },
      { id: 'shield_bash', name: 'Shield Bash Technique', cost: 400, researchTime: 12.0, description: 'Warriors can stun enemies for 1.5s. Requires: Iron Resolve.', requiresUpgrade: 'iron_resolve', icon: 'Swords' }
    ]
  },
  ranger_guild: {
    type: 'ranger_guild',
    name: "Ranger's Guild",
    cost: 300,
    maxHp: 750,
    width: 3,
    height: 3,
    description: 'Recruits keen-eyed bowmen who naturally explore the Fog of War and snipe from distance.',
    constructionTime: 18.0,
    recruits: ['ranger'],
    heroRecruitCost: { ranger: 120 },
    maxHeroSlots: 4,
    upgrades: [
      { id: 'eagle_eye', name: 'Eagle Eye Scouting', cost: 200, researchTime: 7.0, description: 'Rangers gain +30% sight radius and reveal map faster.', icon: 'Eye' },
      { id: 'piercing_arrows', name: 'Piercing Arrows', cost: 350, researchTime: 10.0, description: 'Ranger attacks penetrate 30% enemy armor. Requires: Eagle Eye Scouting.', requiresUpgrade: 'eagle_eye', icon: 'Target' }
    ]
  },
  rogue_guild: {
    type: 'rogue_guild',
    name: "Rogue's Guild",
    cost: 280,
    maxHp: 650,
    width: 3,
    height: 3,
    description: 'Recruits cunning rogues who jump on high bounties, plunder ruins, and sneak attack.',
    constructionTime: 16.0,
    recruits: ['rogue'],
    heroRecruitCost: { rogue: 100 },
    maxHeroSlots: 4,
    upgrades: [
      { id: 'poison_daggers', name: 'Poison Blades', cost: 200, researchTime: 8.0, description: 'Rogue attacks apply damage over time.', icon: 'Skull' },
      { id: 'bounty_greed', name: 'Bounty Rush', cost: 300, researchTime: 10.0, description: 'Rogues gain +30% movement speed when pursuing flags. Requires: Poison Blades.', requiresUpgrade: 'poison_daggers', icon: 'Coins' }
    ]
  },
  wizard_tower: {
    type: 'wizard_tower',
    name: "Wizard's Tower",
    cost: 500,
    maxHp: 600,
    width: 3,
    height: 3,
    description: 'Recruits mystical spellcasters wielding destructive fireballs and arcana. Requires Palace Level 2.',
    constructionTime: 30.0,
    recruits: ['wizard'],
    heroRecruitCost: { wizard: 220 },
    maxHeroSlots: 3,
    requiresPalaceLevel: 2,
    upgrades: [
      { id: 'arcane_library', name: 'Arcane Library', cost: 350, researchTime: 12.0, description: 'Wizards learn Fireball spell for AOE damage.', icon: 'Flame' },
      { id: 'teleportation', name: 'Emergency Blink', cost: 500, researchTime: 15.0, description: 'Wizards automatically teleport to safety when near death. Requires: Arcane Library.', requiresUpgrade: 'arcane_library', icon: 'Sparkles' }
    ]
  },
  cleric_temple: {
    type: 'cleric_temple',
    name: 'Temple of Dauros',
    cost: 450,
    maxHp: 1000,
    width: 3,
    height: 3,
    description: 'Trains holy Clerics who heal wounded companions and banish undead. Requires Palace Level 2.',
    constructionTime: 26.0,
    recruits: ['cleric'],
    heroRecruitCost: { cleric: 180 },
    maxHeroSlots: 4,
    requiresPalaceLevel: 2,
    upgrades: [
      { id: 'holy_blessing', name: 'Holy Radiance', cost: 300, researchTime: 10.0, description: 'Cleric healing aura is 40% stronger and hits nearby allies.', icon: 'Heart' },
      { id: 'smite_undead', name: 'Divine Smite', cost: 400, researchTime: 12.0, description: 'Clerics deal double damage against skeletons, zombies & wraiths. Requires: Holy Radiance.', requiresUpgrade: 'holy_blessing', icon: 'Sun' }
    ]
  },
  dwarf_settlement: {
    type: 'dwarf_settlement',
    name: 'Dwarven Settlement',
    cost: 550,
    maxHp: 1300,
    width: 3,
    height: 3,
    description: 'Recruits tough Dwarves with high siege damage and building repair prowess. Requires Palace Level 2 & Blacksmith.',
    constructionTime: 28.0,
    recruits: ['dwarf'],
    heroRecruitCost: { dwarf: 200 },
    maxHeroSlots: 3,
    requiresPalaceLevel: 2,
    requiresBuilding: 'blacksmith',
    upgrades: [
      { id: 'dwarf_stonecraft', name: 'Stonecraft Reinforcement', cost: 350, researchTime: 12.0, description: 'All kingdom buildings gain +25% Max HP.', icon: 'Hammer' }
    ]
  },
  marketplace: {
    type: 'marketplace',
    name: 'Royal Marketplace',
    cost: 250,
    maxHp: 800,
    width: 3,
    height: 3,
    description: 'Sells healing elixirs and speed charms to heroes. A primary source of kingdom tax revenue.',
    constructionTime: 22.0,
    upgrades: [
      { id: 'healing_elixirs', name: 'Healing Potions Stock', cost: 150, researchTime: 8.0, description: 'Heroes can buy Healing Potions (25g) to survive in the wild.', icon: 'Cross' },
      { id: 'speed_draughts', name: 'Speed Draughts Stock', cost: 250, researchTime: 9.0, description: 'Heroes can buy Speed Potions (60g) to rush toward objectives. Requires: Healing Potions Stock.', requiresUpgrade: 'healing_elixirs', icon: 'Zap' },
      { id: 'warding_amulets', name: 'Warding Amulets', cost: 400, researchTime: 14.0, description: 'Heroes can buy Magic Amulets (+10 Defense). Requires: Speed Draughts Stock & Palace Level 2.', requiresUpgrade: 'speed_draughts', requiresPalaceLevel: 2, icon: 'ShieldAlert' }
    ]
  },
  blacksmith: {
    type: 'blacksmith',
    name: 'Blacksmith Forge',
    cost: 300,
    maxHp: 850,
    width: 3,
    height: 3,
    description: 'Forges upgraded weapons and armor. Heroes spend their bounty earnings here. Available from the start.',
    constructionTime: 24.0,
    upgrades: [
      { id: 'iron_weapons', name: 'Iron Weapons (Tier 1)', cost: 150, researchTime: 8.0, description: 'Heroes can purchase Iron weapons (+5 ATK).', icon: 'Sword' },
      { id: 'steel_armor', name: 'Steel Armor (Tier 1)', cost: 200, researchTime: 9.0, description: 'Heroes can purchase Steel armor (+4 DEF).', icon: 'Shield' },
      { id: 'mithril_forging', name: 'Mithril Arms (Tier 2)', cost: 400, researchTime: 14.0, description: 'Unlocks Mithril tier gear (+14 ATK, +10 DEF). Requires: Iron Weapons or Steel Armor & Palace Level 2.', requiresPalaceLevel: 2, icon: 'Sparkles' },
      { id: 'dragonforged', name: 'Dragonforged Gear (Tier 3)', cost: 800, researchTime: 20.0, description: 'Masterwork tier (+25 ATK, +18 DEF). Requires: Mithril Arms & Palace Level 3.', requiresUpgrade: 'mithril_forging', requiresPalaceLevel: 3, icon: 'Flame' }
    ]
  },
  guard_tower: {
    type: 'guard_tower',
    name: 'Royal Guard Tower',
    cost: 175,
    maxHp: 550,
    width: 2,
    height: 2,
    description: 'Automated arrow tower that attacks passing monsters and provides area vision.',
    constructionTime: 15.0,
    isDefense: true,
    attackPower: 18,
    attackRange: 150,
    attackCooldown: 1.5,
    upgrades: [
      { id: 'heavy_ballista', name: 'Heavy Ballista', cost: 200, researchTime: 8.0, description: 'Increases Tower range by 30% and damage to 30.', icon: 'Crosshair' }
    ]
  },
  royal_inn: {
    type: 'royal_inn',
    name: 'The Boar & Flagon Inn',
    cost: 220,
    maxHp: 700,
    width: 3,
    height: 3,
    description: 'Heroes rest, party, and recover health/mana. Generates continuous tavern revenue. Available from the start.',
    constructionTime: 20.0,
    upgrades: [
      { id: 'fine_ales', name: 'Dwarven Stout & Spirits', cost: 180, researchTime: 8.0, description: 'Resting heroes recover HP 50% faster and gain temporary Morale Boost.', icon: 'Beer' }
    ]
  },
  statue_king: {
    type: 'statue_king',
    name: 'Statue of the Sovereign',
    cost: 400,
    maxHp: 1200,
    width: 2,
    height: 2,
    description: 'Inspires your subjects. Heroes within vicinity gain +15% Bravery and +10% Attack. Requires Palace Level 2.',
    constructionTime: 25.0,
    requiresPalaceLevel: 2,
    upgrades: []
  },
  peasant_cottage: {
    type: 'peasant_cottage',
    name: 'Peasant Cottage',
    cost: 0,
    maxHp: 280,
    width: 2,
    height: 2,
    description: 'Home for kingdom commoners. Increases peasant builder limit and generates periodic land rent.',
    constructionTime: 16.0,
    upgrades: []
  }
};

export interface HeroClassDef {
  name: string;
  baseHp: number;
  hpPerLevel: number;
  baseMp: number;
  mpPerLevel: number;
  baseAttack: number;
  attackPerLevel: number;
  baseDefense: number;
  defensePerLevel: number;
  speed: number;
  attackRange: number;
  attackCooldown: number;
  trainingTime: number; // in seconds
  baseBravery: number;
  baseGreed: number;
  baseExploration: number;
  baseLoyalty: number;
  description: string;
  color: string;
  accentColor: string;
}

export const HERO_CLASS_DEFINITIONS: Record<HeroClass, HeroClassDef> = {
  warrior: {
    name: 'Warrior',
    baseHp: 140,
    hpPerLevel: 30,
    baseMp: 0,
    mpPerLevel: 0,
    baseAttack: 16,
    attackPerLevel: 3.5,
    baseDefense: 6,
    defensePerLevel: 1.8,
    speed: 30,
    attackRange: 28,
    attackCooldown: 1.5,
    trainingTime: 5.5,
    baseBravery: 80,
    baseGreed: 50,
    baseExploration: 35,
    baseLoyalty: 85,
    description: 'Heavy armored champion who confronts enemies head-on and defends the town.',
    color: '#3b82f6',
    accentColor: '#1d4ed8'
  },
  ranger: {
    name: 'Ranger',
    baseHp: 95,
    hpPerLevel: 18,
    baseMp: 20,
    mpPerLevel: 5,
    baseAttack: 14,
    attackPerLevel: 3.0,
    baseDefense: 3,
    defensePerLevel: 1.0,
    speed: 36,
    attackRange: 130,
    attackCooldown: 1.6,
    trainingTime: 5.0,
    baseBravery: 55,
    baseGreed: 60,
    baseExploration: 95,
    baseLoyalty: 60,
    description: 'Master of the wilderness. Scouts the unknown, snipes foes from afar.',
    color: '#10b981',
    accentColor: '#047857'
  },
  rogue: {
    name: 'Rogue',
    baseHp: 80,
    hpPerLevel: 16,
    baseMp: 10,
    mpPerLevel: 2,
    baseAttack: 20,
    attackPerLevel: 4.0,
    baseDefense: 2,
    defensePerLevel: 0.8,
    speed: 38,
    attackRange: 26,
    attackCooldown: 1.2,
    trainingTime: 4.0,
    baseBravery: 40,
    baseGreed: 95,
    baseExploration: 65,
    baseLoyalty: 40,
    description: 'Opportunist who chases bounties passionately and lands lethal critical strikes.',
    color: '#f59e0b',
    accentColor: '#b45309'
  },
  wizard: {
    name: 'Wizard',
    baseHp: 65,
    hpPerLevel: 12,
    baseMp: 100,
    mpPerLevel: 25,
    baseAttack: 24,
    attackPerLevel: 5.5,
    baseDefense: 1,
    defensePerLevel: 0.5,
    speed: 26,
    attackRange: 140,
    attackCooldown: 2.0,
    trainingTime: 7.0,
    baseBravery: 35,
    baseGreed: 45,
    baseExploration: 40,
    baseLoyalty: 65,
    description: 'Devastating magic wielder. Fragile in melee, but annihilates groups with spells.',
    color: '#8b5cf6',
    accentColor: '#6d28d9'
  },
  cleric: {
    name: 'Cleric',
    baseHp: 110,
    hpPerLevel: 22,
    baseMp: 80,
    mpPerLevel: 20,
    baseAttack: 12,
    attackPerLevel: 2.5,
    baseDefense: 5,
    defensePerLevel: 1.4,
    speed: 28,
    attackRange: 32,
    attackCooldown: 1.7,
    trainingTime: 6.0,
    baseBravery: 70,
    baseGreed: 30,
    baseExploration: 40,
    baseLoyalty: 95,
    description: 'Devout healer who supports allies in battle and banishes dark abominations.',
    color: '#ec4899',
    accentColor: '#be185d'
  },
  dwarf: {
    name: 'Dwarf',
    baseHp: 160,
    hpPerLevel: 35,
    baseMp: 0,
    mpPerLevel: 0,
    baseAttack: 18,
    attackPerLevel: 4.0,
    baseDefense: 9,
    defensePerLevel: 2.2,
    speed: 24,
    attackRange: 26,
    attackCooldown: 1.8,
    trainingTime: 6.5,
    baseBravery: 90,
    baseGreed: 70,
    baseExploration: 30,
    baseLoyalty: 80,
    description: 'Indomitable tank with crushing hammer attacks and natural magic resistance.',
    color: '#d97706',
    accentColor: '#92400e'
  },
  elf: {
    name: 'Elf',
    baseHp: 85,
    hpPerLevel: 17,
    baseMp: 40,
    mpPerLevel: 10,
    baseAttack: 16,
    attackPerLevel: 3.2,
    baseDefense: 2,
    defensePerLevel: 0.9,
    speed: 40,
    attackRange: 135,
    attackCooldown: 1.3,
    trainingTime: 5.0,
    baseBravery: 50,
    baseGreed: 65,
    baseExploration: 85,
    baseLoyalty: 55,
    description: 'Graceful swift archer with rapid fire and high evasion.',
    color: '#06b6d4',
    accentColor: '#0e7490'
  }
};

export interface MonsterDef {
  name: string;
  hp: number;
  attackPower: number;
  defense: number;
  speed: number;
  attackRange: number;
  attackCooldown: number;
  xpReward: number;
  goldBountyReward: number;
  isRanged?: boolean;
  isBoss?: boolean;
  isFlying?: boolean;
  color: string;
}

export const MONSTER_DEFINITIONS: Record<MonsterType, MonsterDef> = {
  giant_rat: {
    name: 'Giant Sewer Rat',
    hp: 48,
    attackPower: 9,
    defense: 1,
    speed: 36,
    attackRange: 22,
    attackCooldown: 1.2,
    xpReward: 25,
    goldBountyReward: 2,
    color: '#78716c'
  },
  skeleton: {
    name: 'Skeleton Warrior',
    hp: 95,
    attackPower: 16,
    defense: 4,
    speed: 28,
    attackRange: 26,
    attackCooldown: 1.5,
    xpReward: 45,
    goldBountyReward: 4,
    color: '#e7e5e4'
  },
  zombie: {
    name: 'Rotting Zombie',
    hp: 175,
    attackPower: 22,
    defense: 5,
    speed: 20,
    attackRange: 24,
    attackCooldown: 2.0,
    xpReward: 65,
    goldBountyReward: 6,
    color: '#4d7c0f'
  },
  goblin_spearman: {
    name: 'Goblin Spearman',
    hp: 75,
    attackPower: 14,
    defense: 2,
    speed: 36,
    attackRange: 30,
    attackCooldown: 1.2,
    xpReward: 40,
    goldBountyReward: 5,
    color: '#84cc16'
  },
  goblin_shaman: {
    name: 'Goblin Shaman',
    hp: 110,
    attackPower: 24,
    defense: 3,
    speed: 28,
    attackRange: 130,
    attackCooldown: 2.1,
    isRanged: true,
    xpReward: 85,
    goldBountyReward: 12,
    color: '#a855f7'
  },
  dire_wolf: {
    name: 'Dire Wolf',
    hp: 130,
    attackPower: 22,
    defense: 3,
    speed: 42,
    attackRange: 26,
    attackCooldown: 1.2,
    xpReward: 70,
    goldBountyReward: 6,
    color: '#52525b'
  },
  troll: {
    name: 'Bridge Troll',
    hp: 340,
    attackPower: 34,
    defense: 10,
    speed: 22,
    attackRange: 30,
    attackCooldown: 2.0,
    xpReward: 190,
    goldBountyReward: 28,
    color: '#65a30d'
  },
  harpy: {
    name: 'Harpy',
    hp: 85,
    attackPower: 16,
    defense: 2,
    speed: 46,
    attackRange: 26,
    attackCooldown: 1.1,
    xpReward: 60,
    goldBountyReward: 9,
    isFlying: true,
    color: '#e879f9'
  },
  werewolf: {
    name: 'Werewolf',
    hp: 200,
    attackPower: 30,
    defense: 5,
    speed: 50,
    attackRange: 26,
    attackCooldown: 1.0,
    xpReward: 140,
    goldBountyReward: 16,
    color: '#92400e'
  },
  minotaur: {
    name: 'Labyrinth Minotaur',
    hp: 480,
    attackPower: 45,
    defense: 12,
    speed: 30,
    attackRange: 34,
    attackCooldown: 1.8,
    xpReward: 250,
    goldBountyReward: 40,
    color: '#b91c1c'
  },
  necromancer: {
    name: 'Dark Necromancer',
    hp: 750,
    attackPower: 48,
    defense: 8,
    speed: 26,
    attackRange: 140,
    attackCooldown: 1.8,
    isRanged: true,
    isBoss: true,
    xpReward: 550,
    goldBountyReward: 80,
    color: '#4c1d95'
  },
  vampire_lord: {
    name: 'Vampire Lord Malachar',
    hp: 1500,
    attackPower: 58,
    defense: 14,
    speed: 42,
    attackRange: 30,
    attackCooldown: 1.4,
    isBoss: true,
    xpReward: 1000,
    goldBountyReward: 140,
    color: '#7f1d1d'
  },
  red_dragon: {
    name: 'Red Dragon Fryre',
    hp: 2200,
    attackPower: 75,
    defense: 20,
    speed: 36,
    attackRange: 150,
    attackCooldown: 2.2,
    isRanged: true,
    isBoss: true,
    isFlying: true,
    xpReward: 1800,
    goldBountyReward: 200,
    color: '#dc2626'
  }
};

export const SOVEREIGN_SPELLS: SovereignSpell[] = [
  {
    id: 'royal_lightning',
    name: 'Lightning Strike',
    description: 'Calls down divine wrath upon target location or foe, dealing 120 magic damage in an area.',
    goldCost: 75,
    manaCost: 40,
    cooldown: 5,
    currentCooldown: 0,
    targetType: 'position',
    icon: 'Zap'
  },
  {
    id: 'holy_restoration',
    name: 'Holy Restoration',
    description: 'Restores 100 HP to all friendly heroes and buildings in target area.',
    goldCost: 50,
    manaCost: 35,
    cooldown: 8,
    currentCooldown: 0,
    targetType: 'position',
    icon: 'HeartPulse'
  },
  {
    id: 'far_sight',
    name: 'Far Sight',
    description: 'Permanently reveals a large region of the Fog of War.',
    goldCost: 40,
    manaCost: 20,
    cooldown: 10,
    currentCooldown: 0,
    targetType: 'position',
    icon: 'Eye'
  },
  {
    id: 'call_to_arms',
    name: 'Call to Arms',
    description: 'Grants all heroes across the kingdom +25% Speed and +20% Attack for 20 seconds.',
    goldCost: 150,
    manaCost: 60,
    cooldown: 45,
    currentCooldown: 0,
    targetType: 'global',
    icon: 'Swords'
  },
  {
    id: 'midas_blessing',
    name: "Midas' Prosperity",
    description: 'Instantly grants 250 Gold directly to the Royal Treasury.',
    goldCost: 0,
    manaCost: 80,
    cooldown: 60,
    currentCooldown: 0,
    targetType: 'global',
    icon: 'Coins'
  }
];

export const LAIR_NAMES: Record<string, string> = {
  sewer_grate: 'Sewer Nest',
  graveyard: 'Cursed Graveyard',
  goblin_hut: 'Goblin Encampment',
  wolf_den: 'Wolf Den',
  ancient_ruins: 'Ancient Ruins',
  dragon_cavern: "Dragon's Cavern",
  harpy_roost: 'Harpy Roost',
  troll_bridge: 'Troll Bridge',
  dark_castle: 'Dark Castle'
};

export const LAIR_DEFINITIONS: Record<LairType, LairDef> = {
  sewer_grate: {
    type: 'sewer_grate',
    name: 'Sewer Nest',
    width: 2,
    height: 2,
    maxHp: 280,
    description: 'A foul subterranean street grate spewing giant sewer rats.',
    defaultMonster: 'giant_rat',
    defaultMaxMonsters: 4,
    defaultSpawnInterval: 10
  },
  goblin_hut: {
    type: 'goblin_hut',
    name: 'Goblin Encampment',
    width: 3,
    height: 3,
    maxHp: 450,
    description: 'A tribal mud & thatch teepee encampment of vicious goblin warbands.',
    defaultMonster: 'goblin_spearman',
    defaultMaxMonsters: 5,
    defaultSpawnInterval: 14
  },
  wolf_den: {
    type: 'wolf_den',
    name: 'Wolf Den',
    width: 3,
    height: 3,
    maxHp: 400,
    description: 'A dark bone-littered rocky cave burrow harboring feral wolf packs.',
    defaultMonster: 'dire_wolf',
    defaultMaxMonsters: 4,
    defaultSpawnInterval: 16
  },
  harpy_roost: {
    type: 'harpy_roost',
    name: 'Harpy Roost',
    width: 3,
    height: 3,
    maxHp: 420,
    description: 'A perilous dead-tree mountain crag where shrieking harpies nest.',
    defaultMonster: 'harpy',
    defaultMaxMonsters: 3,
    defaultSpawnInterval: 20
  },
  graveyard: {
    type: 'graveyard',
    name: 'Cursed Graveyard',
    width: 4,
    height: 4,
    maxHp: 650,
    description: 'Desecrated mausoleums and crumbling tombstones raising undead legions at dusk.',
    defaultMonster: 'skeleton',
    defaultMaxMonsters: 5,
    defaultSpawnInterval: 12
  },
  ancient_ruins: {
    type: 'ancient_ruins',
    name: 'Ancient Ruins',
    width: 4,
    height: 4,
    maxHp: 750,
    description: 'A crumbling cursed citadel steeped in dark sorcery and monstrous minotaurs.',
    defaultMonster: 'minotaur',
    defaultMaxMonsters: 3,
    defaultSpawnInterval: 22
  },
  troll_bridge: {
    type: 'troll_bridge',
    name: 'Troll Bridge',
    width: 4,
    height: 3,
    maxHp: 600,
    description: 'A fortified stone crossing where hulking trolls bludgeon travelers for gold.',
    defaultMonster: 'troll',
    defaultMaxMonsters: 2,
    defaultSpawnInterval: 28
  },
  dark_castle: {
    type: 'dark_castle',
    name: 'Dark Castle',
    width: 5,
    height: 5,
    maxHp: 1000,
    description: 'An obsidian keep with spires and battlements commanded by terrible dark lords.',
    defaultMonster: 'werewolf',
    defaultMaxMonsters: 2,
    defaultSpawnInterval: 25
  },
  dragon_cavern: {
    type: 'dragon_cavern',
    name: "Dragon's Cavern",
    width: 5,
    height: 5,
    maxHp: 1500,
    description: 'A titanic volcanic mountain caldera breathing flame and brooding terror.',
    defaultMonster: 'red_dragon',
    defaultMaxMonsters: 1,
    defaultSpawnInterval: 999
  }
};

export const HERO_QUIRKS = [
  'Fearless Vanguard',
  'Gold Hungry',
  'Wanderlust Explorer',
  'Patient Strategist',
  'Caffeine Addict',
  'Devout Believer',
  'Pyromaniac',
  'Glory Hound',
  'Monster Hunter',
  'Tavern Regular',
  'Cautious Survivor'
];

export const HERO_NAMES: Record<HeroClass, string[]> = {
  warrior: ['Sir Daniel', 'Lady Gwen', 'Gareth the Bold', 'Vance Ironheart', 'Kaelen Stout', 'Astrid Shieldmaid', 'Boran Steel', 'Rowan the Brave'],
  ranger: ['Robin Swift', 'Lyanna Hawk', 'Theron Greenleaf', 'Faelar Windstrider', 'Sylvan Whisper', 'Talia Bramble', 'Elric Bowstring', 'Kip Quiver'],
  rogue: ['Shadowjack', 'Nimble Pip', 'Corbin Black', 'Silas Locke', 'Vesper Night', 'Vanna Quickfinger', 'Dax the Cutpurse', 'Mercutio Keen'],
  wizard: ['Archmage Ignis', 'Valerius Rune', 'Moros Voidseeker', 'Elysia Starlight', 'Zephyr Flameweaver', 'Thalor Mistwalker', 'Kaelen Ash'],
  cleric: ['Brother Paul', 'Sister Clara', 'Father Michael', 'Luminara the Pure', 'Dawnseeker Aaron', 'Justina Faith', 'Balthazar Light', 'Seraphina Sun'],
  dwarf: ['Thorgar Ironfist', 'Bruenor Stone', 'Dain Deepdelver', 'Krag Hammerfall', 'Grimli Anvil', 'Breg Heavyaxe', 'Helga Ironforge'],
  elf: ['Elrond Silverleaf', 'Aerdrie Song', 'Faeron Duskwalker', 'Caelynn Starfall', 'Ilyana Brightwood', 'Valandil Swiftarrow']
};
