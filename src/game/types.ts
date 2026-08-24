export type HeroClass = 'warrior' | 'ranger' | 'rogue' | 'wizard' | 'cleric' | 'dwarf' | 'elf';

export type MonsterType = 
  | 'giant_rat'
  | 'skeleton'
  | 'zombie'
  | 'goblin_spearman'
  | 'goblin_shaman'
  | 'dire_wolf'
  | 'troll'
  | 'harpy'
  | 'werewolf'
  | 'minotaur'
  | 'necromancer'
  | 'vampire_lord'
  | 'red_dragon';

export type BuildingType = 
  | 'palace'
  | 'warrior_guild'
  | 'ranger_guild'
  | 'rogue_guild'
  | 'wizard_tower'
  | 'cleric_temple'
  | 'dwarf_settlement'
  | 'marketplace'
  | 'blacksmith'
  | 'guard_tower'
  | 'royal_inn'
  | 'statue_king'
  | 'peasant_cottage';

export type LairType = 
  | 'sewer_grate'
  | 'graveyard'
  | 'goblin_hut'
  | 'wolf_den'
  | 'ancient_ruins'
  | 'dragon_cavern'
  | 'harpy_roost'
  | 'troll_bridge'
  | 'dark_castle';

export type FlagType = 'attack' | 'explore' | 'defend';

export type HeroState = 
  | 'idle'
  | 'wandering'
  | 'pursuing_flag'
  | 'attacking_target'
  | 'collecting_treasure'
  | 'fleeing'
  | 'visiting_marketplace'
  | 'visiting_blacksmith'
  | 'visiting_inn'
  | 'resting_at_guild'
  | 'healing_ally'
  | 'casting_spell';

export interface Position {
  x: number;
  y: number;
}

export interface Equipment {
  weaponLevel: number; // 0: basic, 1: iron (+5 atk), 2: steel (+12 atk), 3: mithril (+22 atk), 4: dragonforged (+35 atk)
  armorLevel: number;  // 0: cloth/leather, 1: chain (+3 def), 2: plate (+8 def), 3: runic (+15 def), 4: dragonscale (+25 def)
  hasHealingPotion: boolean;
  hasSpeedPotion: boolean;
  hasAmulet: boolean;
}

export interface HeroTraits {
  bravery: number;       // 0-100: willingness to fight strong foes / low HP threshold for fleeing
  greed: number;         // 0-100: how strongly bounties attract them
  explorationUrge: number; // 0-100: tendency to wander into Fog of War
  loyalty: number;       // 0-100: responds to defend flags
  quirk: string;         // e.g. "Treasure Hunter", "Bloodthirsty", "Cowardly", "Glutton", "Devout", "Pyromancer"
}

export interface Hero {
  id: string;
  name: string;
  heroClass: HeroClass;
  level: number;
  xp: number;
  xpToNextLevel: number;
  x: number;
  y: number;
  targetX?: number;
  targetY?: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  gold: number;
  kills: number;
  speed: number;
  attackPower: number;
  defense: number;
  attackRange: number;
  attackCooldown: number;
  currentCooldown: number;
  state: HeroState;
  stateTimer: number;
  homeGuildId: string;
  targetEntityId?: string;
  targetEntityType?: 'monster' | 'lair' | 'building' | 'flag' | 'hero';
  targetFlagId?: string;
  equipment: Equipment;
  traits: HeroTraits;
  currentThought: string;
  title: string;
  direction: 'left' | 'right' | 'up' | 'down';
  isAttackingAnimation: number; // timer for attack frame
  isDead?: boolean;
  restingProgress?: number;
  fearCooldown?: number;
  path?: Position[];
  pathTargetKey?: string;
}

export interface Monster {
  id: string;
  name: string;
  type: MonsterType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  attackPower: number;
  defense: number;
  speed: number;
  attackRange: number;
  attackCooldown: number;
  currentCooldown: number;
  xpReward: number;
  goldBountyReward: number;
  lairId?: string;
  state: 'wandering' | 'attacking' | 'raiding' | 'returning_to_lair';
  targetEntityId?: string;
  targetEntityType?: 'hero' | 'building' | 'tax_collector' | 'peasant';
  direction: 'left' | 'right' | 'up' | 'down';
  isAttackingAnimation: number;
  isBoss?: boolean;
  isFlying?: boolean;
   specialCooldown?: number;
   targetX?: number;
   targetY?: number;
   wanderTimer?: number;
   targetHoldTimer?: number;
   isEngaged?: boolean;
   raidTargetId?: string; // set for war-party raiders: march on this building deliberately
   path?: Position[];
   pathTargetKey?: string;
}

export interface ResearchItem {
  upgradeId: string;
  progress: number;
  totalTime: number;
  isBuildingUpgrade?: boolean;
}

export interface Building {
  id: string;
  type: BuildingType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  level: number;
  maxLevel: number;
  isConstructing: boolean;
  constructionProgress: number; // 0 - 100
  constructionTime: number;
  goldStored: number; // uncollected taxes/sales
  heroSlots: number;
  recruitedHeroIds: string[];
  trainingQueue?: { id?: string; heroClass: HeroClass; progress: number; totalTime: number }[];
  researchQueue?: ResearchItem[];
  researchedUpgrades: string[];
  availableUpgrades: string[];
  taxRate: number;
  facing?: 'south' | 'north' | 'east' | 'west';
  isDefense?: boolean;
  attackCooldown?: number;
  currentAttackCooldown?: number;
  attackRange?: number;
  attackPower?: number;
}

export interface MonsterLair {
  id: string;
  type: LairType;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  spawnTimer: number;
  spawnInterval: number;
  monsterType: MonsterType;
  maxMonsters: number;
  currentMonsters: number;
  bountyFlagId?: string;
}

export interface Flag {
  id: string;
  type: FlagType;
  x: number;
  y: number;
  goldReward: number;
  initialGoldReward: number;
  targetEntityId?: string;
  targetEntityType?: 'monster' | 'lair' | 'building';
  radius: number;
  assignedHeroIds: string[];
  createdAt: number;
}

export interface TaxCollector {
  id: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  goldCarried: number;
  targetBuildingId?: string;
  state: 'seeking_building' | 'returning_to_palace' | 'fleeing';
  direction: 'left' | 'right' | 'up' | 'down';
  path?: Position[];
  pathTargetKey?: string;
}

export interface Peasant {
  id: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  state: 'idle_at_palace' | 'walking_to_site' | 'hammering_construction' | 'repairing_building' | 'fleeing';
  targetBuildingId?: string;
  hammerTimer: number;
  direction: 'left' | 'right' | 'up' | 'down';
  path?: Position[];
  pathTargetKey?: string;
}

export interface Corpse {
  id: string;
  type: 'hero' | 'monster' | 'peasant' | 'tax_collector' | 'building_ruin';
  subType: string;
  name: string;
  x: number;
  y: number;
  rotation: number;
  createdAt: number;
  lifetime: number; // in seconds (e.g. 35s or 180s for ruins)
  width?: number;
  height?: number;
}

export interface Treasure {
  id: string;
  x: number;
  y: number;
  goldAmount: number;
  type: 'chest' | 'gold_bag' | 'ancient_relic';
  item?: string;
  createdAt: number;
}

export interface Projectile {
  id: string;
  type: 'arrow' | 'fireball' | 'magic_missile' | 'holy_bolt' | 'lightning_arc' | 'dragon_breath';
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  targetX: number;
  targetY: number;
  targetEntityId?: string;
  speed: number;
  damage: number;
  isHeroProjectile: boolean;
  ownerHeroId?: string;
  progress: number;
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
  type?: 'spark' | 'smoke' | 'blood' | 'gold_sparkle' | 'heal_sparkle' | 'magic' | 'flame';
}

export interface FloatingText {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  fontSize: number;
  life: number;
  maxLife: number;
  vy: number;
}

export interface SovereignSpell {
  id: string;
  name: string;
  description: string;
  goldCost: number;
  manaCost: number;
  cooldown: number;
  currentCooldown: number;
  targetType: 'position' | 'entity' | 'global';
  icon: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'danger' | 'success' | 'quest';
  timestamp: number;
  targetPos?: Position;
}

export interface Scenario {
  id: string;
  name: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Endless';
  description: string;
  startingGold: number;
  startingMana: number;
  objectiveText: string;
  defeatText: string;
  mapWidth: number;
  mapHeight: number;
  initialLairs: { type: LairType; x: number; y: number; monsterType: MonsterType; maxMonsters: number; spawnInterval: number }[];
  winCondition: (state: GameState) => boolean;
  lossCondition: (state: GameState) => boolean;
}

export interface GameStats {
  monstersKilled: number;
  goldEarned: number;
  goldSpent: number;
  heroesRecruited: number;
  heroesLost: number;
  buildingsConstructed: number;
  lairsDestroyed: number;
  spellsCast: number;
  dayTime: number; // 0 to 2400 (day-night cycle)
  daysPassed: number;
}

export interface SaveMeta {
  savedAt: number;
  scenarioId: string;
  scenarioName: string;
  day: number;
  treasuryGold: number;
  slotId?: string;
  heroCount?: number;
  buildingCount?: number;
  label?: string;
}

export interface SaveData {
  version: 1;
  savedAt: number;
  scenarioId: string;
  scenarioName: string;
  day: number;
  state: Omit<GameState, 'scenario' | 'grid' | 'fogOfWar' | 'exploredMap'>;
  grid: number[][];
  explored: boolean[][];
  timers: {
    cottageSproutTimer: number;
    peasantReplenishTimer: number;
    warPartyTimer?: number;
    eventTimer?: number;
    treasureRespawnTimer?: number;
  };
}

export interface GameState {
  scenario: Scenario;
  isPaused: boolean;
  gameSpeed: number; // 1, 2, 4, 8
  isGameOver: boolean;
  gameWon: boolean;
  treasuryGold: number;
  mana: number;
  maxMana: number;
  mapWidth: number;
  mapHeight: number;
  tileSize: number;
  grid: number[][]; // terrain types (0: grass, 1: dirt/road, 2: water, 3: dense trees, 4: rock/mountain)
  fogOfWar: boolean[][]; // false: hidden, true: visible
  exploredMap: boolean[][]; // false: unrevealed, true: revealed
  heroes: Hero[];
  monsters: Monster[];
  buildings: Building[];
  lairs: MonsterLair[];
  flags: Flag[];
  taxCollectors: TaxCollector[];
  peasants: Peasant[];
  treasures: Treasure[];
  corpses: Corpse[];
  projectiles: Projectile[];
  particles: Particle[];
  floatingTexts: FloatingText[];
  spells: SovereignSpell[];
  notifications: NotificationItem[];
  stats: GameStats;
  selectedEntity: {
    type: 'hero' | 'building' | 'monster' | 'lair' | 'flag' | 'tax_collector' | 'peasant';
    id: string;
  } | null;
  camera: {
    x: number;
    y: number;
    zoom: number;
  };
  activePlacement: {
    type: 'building' | 'flag' | 'spell';
    subType: string;
    bountyAmount?: number;
  } | null;
  dayPhase: 'day' | 'dusk' | 'night' | 'dawn';
}
