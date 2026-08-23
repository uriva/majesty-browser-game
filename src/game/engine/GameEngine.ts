import { BUILDING_DEFINITIONS, HERO_CLASS_DEFINITIONS, HERO_NAMES, HERO_QUIRKS, MAP_CONFIG, SOVEREIGN_SPELLS } from '../constants';
import { Building, BuildingType, Flag, FlagType, GameState, Hero, HeroClass, Monster, MonsterLair, NotificationItem, Projectile, Scenario, SovereignSpell } from '../types';
import { audioManager } from './Audio';
import { CombatManager } from './Combat';
import { EconomyManager } from './Economy';
import { FlagManager } from './Flags';
import { GridManager } from './Grid';
import { HeroAIManager } from './HeroAI';
import { MonsterAIManager } from './MonsterAI';

export class GameEngine {
  public state: GameState;
  public gridManager: GridManager;
  public heroAIManager: HeroAIManager;
  public monsterAIManager: MonsterAIManager;
  public economyManager: EconomyManager;
  public combatManager: CombatManager;
  public flagManager: FlagManager;

  private onStateChangeCallback?: (state: GameState) => void;

  constructor(scenario: Scenario) {
    this.gridManager = new GridManager(scenario.mapWidth, scenario.mapHeight, MAP_CONFIG.TILE_SIZE);
    this.heroAIManager = new HeroAIManager(this.gridManager);
    this.monsterAIManager = new MonsterAIManager(this.gridManager);
    this.economyManager = new EconomyManager(this.gridManager);
    this.combatManager = new CombatManager(this.gridManager);
    this.flagManager = new FlagManager(this.gridManager);

    this.state = this.createInitialState(scenario);
    this.initWorld();
  }

  public setOnStateChange(cb: (state: GameState) => void) {
    this.onStateChangeCallback = cb;
  }

  private createInitialState(scenario: Scenario): GameState {
    const spells: SovereignSpell[] = SOVEREIGN_SPELLS.map(s => ({ ...s }));

    const centerX = (scenario.mapWidth * MAP_CONFIG.TILE_SIZE) / 2;
    const centerY = (scenario.mapHeight * MAP_CONFIG.TILE_SIZE) / 2;

    return {
      scenario,
      isPaused: false,
      gameSpeed: 1,
      isGameOver: false,
      gameWon: false,
      treasuryGold: scenario.startingGold,
      mana: scenario.startingMana,
      maxMana: 300,
      mapWidth: scenario.mapWidth,
      mapHeight: scenario.mapHeight,
      tileSize: MAP_CONFIG.TILE_SIZE,
      grid: this.gridManager.grid,
      fogOfWar: this.gridManager.visible,
      exploredMap: this.gridManager.explored,
      heroes: [],
      monsters: [],
      buildings: [],
      lairs: [],
      flags: [],
      taxCollectors: [],
      projectiles: [],
      particles: [],
      floatingTexts: [],
      spells,
      notifications: [],
      stats: {
        monstersKilled: 0,
        goldEarned: 0,
        goldSpent: 0,
        heroesRecruited: 0,
        heroesLost: 0,
        buildingsConstructed: 0,
        lairsDestroyed: 0,
        spellsCast: 0,
        dayTime: 600, // starts at 6:00 AM
        daysPassed: 1
      },
      selectedEntity: null,
      camera: {
        x: centerX,
        y: centerY,
        zoom: 1.0
      },
      activePlacement: null,
      dayPhase: 'day'
    };
  }

  private initWorld() {
    const { scenario } = this.state;
    const centerX = Math.floor(scenario.mapWidth / 2);
    const centerY = Math.floor(scenario.mapHeight / 2);

    // Place Palace at center of kingdom
    const palaceDef = BUILDING_DEFINITIONS['palace'];
    const palace: Building = {
      id: 'building_palace',
      type: 'palace',
      name: palaceDef.name,
      x: centerX - Math.floor(palaceDef.width / 2),
      y: centerY - Math.floor(palaceDef.height / 2),
      width: palaceDef.width,
      height: palaceDef.height,
      hp: palaceDef.maxHp,
      maxHp: palaceDef.maxHp,
      level: 1,
      maxLevel: 3,
      isConstructing: false,
      constructionProgress: 100,
      constructionTime: 0,
      goldStored: 0,
      heroSlots: 0,
      recruitedHeroIds: [],
      researchedUpgrades: [],
      availableUpgrades: palaceDef.upgrades?.map(u => u.id) || [],
      taxRate: 0.15,
      isDefense: palaceDef.isDefense,
      attackPower: palaceDef.attackPower,
      attackRange: palaceDef.attackRange,
      attackCooldown: palaceDef.attackCooldown,
      currentAttackCooldown: 0
    };
    this.state.buildings.push(palace);

    // Spawn initial Monster Lairs from scenario definition
    for (let i = 0; i < scenario.initialLairs.length; i++) {
      const lairConf = scenario.initialLairs[i];
      const lair: MonsterLair = {
        id: `lair_${i}_${lairConf.type}`,
        type: lairConf.type,
        name: lairConf.type.replace('_', ' ').toUpperCase(),
        x: lairConf.x,
        y: lairConf.y,
        width: 3,
        height: 3,
        hp: 450,
        maxHp: 450,
        spawnTimer: 4,
        spawnInterval: lairConf.spawnInterval,
        monsterType: lairConf.monsterType,
        maxMonsters: lairConf.maxMonsters,
        currentMonsters: 0
      };
      this.state.lairs.push(lair);
    }

    this.addNotification('The Realm Awaits', `Your reign begins, Sovereign! Build guilds and establish trade to protect the realm.`, 'quest');
  }

  public update(rawDelta: number) {
    if (this.state.isPaused || this.state.isGameOver) return;

    // Apply speed multiplier (1x, 2x, 4x, 8x)
    const delta = Math.min(rawDelta * this.state.gameSpeed, 0.25);

    // 1. Day / Night Cycle
    this.updateDayNight(delta);

    // 2. Passive Mana Regeneration
    this.state.mana = Math.min(this.state.maxMana, this.state.mana + 3.0 * delta);

    // 3. Recalculate Fog of War / Line of Sight
    this.recalculateVisibility();

    // 4. Update Buildings & Construction
    this.updateBuildings(delta);

    // 5. Update Monster Lairs
    for (const lair of this.state.lairs) {
      this.monsterAIManager.updateLair(lair, delta, this.state.monsters, (monster) => {
        this.state.monsters.push(monster);
      });
    }

    // 6. Update Heroes AI
    for (let i = this.state.heroes.length - 1; i >= 0; i--) {
      const hero = this.state.heroes[i];
      if (hero.hp <= 0 && !hero.isDead) {
        hero.isDead = true;
        this.state.stats.heroesLost += 1;
        this.addNotification('Hero Fallen', `${hero.title} has fallen in battle!`, 'danger', { x: hero.x, y: hero.y });
        this.state.heroes.splice(i, 1);
        continue;
      }

      this.heroAIManager.updateHero(
        hero,
        delta,
        this.state.heroes,
        this.state.monsters,
        this.state.lairs,
        this.state.buildings,
        this.state.flags,
        () => audioManager.playLevelUp(),
        (proj) => {
          this.state.projectiles.push({
            id: `h_proj_${Date.now()}_${Math.random()}`,
            ...proj,
            ownerHeroId: hero.id,
            currentX: proj.startX,
            currentY: proj.startY,
            speed: proj.type === 'arrow' ? 320 : 250,
            isHeroProjectile: true,
            progress: 0
          });
        },
        (text, x, y, color) => this.addFloatingText(text, x, y, color)
      );
    }

    // 7. Update Monsters AI
    for (let i = this.state.monsters.length - 1; i >= 0; i--) {
      const monster = this.state.monsters[i];
      if (monster.hp <= 0) {
        this.state.stats.monstersKilled += 1;
        audioManager.playSwordClash();

        // Award kill XP & gold bounty to the hero(es) involved
        const nearbyHeroes = this.state.heroes.filter(
          h => !h.isDead && (h.targetEntityId === monster.id || Math.hypot(h.x - monster.x, h.y - monster.y) < 180)
        );

        if (nearbyHeroes.length > 0) {
          nearbyHeroes.sort((a, b) => Math.hypot(a.x - monster.x, a.y - monster.y) - Math.hypot(b.x - monster.x, b.y - monster.y));
          
          // Primary killer
          const killer = nearbyHeroes[0];
          killer.kills += 1;
          killer.xp += monster.xpReward;
          killer.gold += monster.goldBountyReward;
          this.addFloatingText(`+${monster.xpReward} XP`, killer.x, killer.y - 20, '#38bdf8');
          if (monster.goldBountyReward > 0) {
            this.addFloatingText(`+${monster.goldBountyReward}g`, killer.x, killer.y - 32, '#fbbf24');
          }

          // Assisting heroes
          for (let k = 1; k < nearbyHeroes.length; k++) {
            const assistHero = nearbyHeroes[k];
            const assistXp = Math.round(monster.xpReward * 0.5);
            assistHero.xp += assistXp;
            this.addFloatingText(`+${assistXp} XP (Assist)`, assistHero.x, assistHero.y - 20, '#38bdf8');
          }
        } else {
          // Monster slain by defenses
          this.state.treasuryGold += monster.goldBountyReward;
          this.addFloatingText(`+${monster.goldBountyReward}g Bounty`, monster.x, monster.y - 10, '#fbbf24');
        }

        this.state.monsters.splice(i, 1);
        continue;
      }

      this.monsterAIManager.updateMonster(
        monster,
        delta,
        this.state.heroes,
        this.state.buildings,
        this.state.taxCollectors,
        (proj) => {
          this.state.projectiles.push({
            id: `m_proj_${Date.now()}_${Math.random()}`,
            ...proj,
            currentX: proj.startX,
            currentY: proj.startY,
            speed: 240,
            isHeroProjectile: false,
            progress: 0
          });
        },
        (text, x, y, color) => this.addFloatingText(text, x, y, color),
        (minion) => this.state.monsters.push(minion)
      );
    }

    // 8. Update Building Defenses (Arrow attacks)
    this.combatManager.updateBuildingDefenses(this.state.buildings, this.state.monsters, delta, this.state.projectiles);

    // 9. Update Economy & Tax Collectors (Gold ONLY enters treasury via physical Tax Collector delivery!)
    this.economyManager.updateEconomy(
      delta,
      this.state.buildings,
      this.state.taxCollectors,
      (amount) => {
        // Tax collector physically delivers taxes to Palace!
        this.state.treasuryGold += amount;
        this.state.stats.goldEarned += amount;
        audioManager.playCoinSound();
      },
      (tc) => this.state.taxCollectors.push(tc),
      (text, x, y, color) => this.addFloatingText(text, x, y, color)
    );

    // 10. Update Projectiles & Combat Particles
    this.combatManager.updateProjectiles(
      this.state.projectiles,
      delta,
      this.state.heroes,
      this.state.monsters,
      this.state.lairs,
      this.state.particles,
      this.state.floatingTexts,
      () => audioManager.playSwordClash()
    );

    this.combatManager.updateParticlesAndText(this.state.particles, this.state.floatingTexts, delta);

    // 11. Update Flags & Bounties
    this.flagManager.updateFlags(
      this.state.flags,
      this.state.heroes,
      this.state.monsters,
      this.state.lairs,
      this.state.floatingTexts,
      (flag, hero, amount) => {
        audioManager.playCoinSound();
        this.addNotification('Bounty Claimed!', `${hero.name} claimed the ${flag.type.toUpperCase()} bounty of ${amount}g!`, 'success');
      }
    );

    // 12. Check Lair Health
    for (let i = this.state.lairs.length - 1; i >= 0; i--) {
      const lair = this.state.lairs[i];
      if (lair.hp <= 0) {
        this.state.stats.lairsDestroyed += 1;
        const plunderGold = lair.type === 'dragon_cavern' ? 1000 : (lair.type === 'ancient_ruins' ? 450 : 250);
        this.state.treasuryGold += plunderGold;
        this.state.stats.goldEarned += plunderGold;
        audioManager.playCoinSound();

        const lx = (lair.x + lair.width / 2) * this.gridManager.tileSize;
        const ly = (lair.y + lair.height / 2) * this.gridManager.tileSize;
        this.addFloatingText(`+${plunderGold}g Plunder!`, lx, ly - 20, '#fbbf24');
        this.addNotification('Lair Destroyed & Plundered!', `The ${lair.name} was razed! +${plunderGold}g deposited to Treasury!`, 'success');
        this.state.lairs.splice(i, 1);
      }
    }

    // 13. Update Spell Cooldowns
    for (const spell of this.state.spells) {
      if (spell.currentCooldown > 0) {
        spell.currentCooldown = Math.max(0, spell.currentCooldown - delta);
      }
    }

    // 14. Win / Loss Condition Evaluation
    this.checkWinLoss();

    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(this.state);
    }
  }

  private updateDayNight(delta: number) {
    this.state.stats.dayTime += delta * 15; // 2400 = 1 full day (~160 seconds realtime)
    if (this.state.stats.dayTime >= 2400) {
      this.state.stats.dayTime = 0;
      this.state.stats.daysPassed += 1;
      this.addNotification('A New Dawn', `Day ${this.state.stats.daysPassed} begins across your kingdom.`, 'info');
    }

    const time = this.state.stats.dayTime;
    if (time >= 500 && time < 1700) {
      this.state.dayPhase = 'day';
    } else if (time >= 1700 && time < 2000) {
      this.state.dayPhase = 'dusk';
    } else if (time >= 2000 || time < 400) {
      this.state.dayPhase = 'night';
    } else {
      this.state.dayPhase = 'dawn';
    }
  }

  private recalculateVisibility() {
    this.gridManager.resetVisibility();

    // Palace & Buildings sight
    for (const b of this.state.buildings) {
      if (b.hp <= 0) continue;
      const bx = Math.floor(b.x + b.width / 2);
      const by = Math.floor(b.y + b.height / 2);
      const radius = b.type === 'guard_tower' ? 11 : (b.type === 'palace' ? 12 : 8);
      this.gridManager.revealArea(bx, by, radius);
    }

    // Heroes sight
    for (const h of this.state.heroes) {
      if (h.isDead) continue;
      const hTile = this.gridManager.pixelToTile(h.x, h.y);
      const radius = h.heroClass === 'ranger' ? 9 : 7;
      this.gridManager.revealArea(hTile.x, hTile.y, radius);
    }
  }

  private updateBuildings(delta: number) {
    for (let i = this.state.buildings.length - 1; i >= 0; i--) {
      const b = this.state.buildings[i];
      if (b.hp <= 0) {
        if (b.type === 'palace') {
          this.state.isGameOver = true;
          this.state.gameWon = false;
          audioManager.playDefeatSound();
          this.addNotification('Defeat!', this.state.scenario.defeatText, 'danger');
          return;
        }
        this.addNotification('Building Destroyed', `The ${b.name} was reduced to rubble!`, 'danger');
        this.state.buildings.splice(i, 1);
        continue;
      }

      if (b.isConstructing) {
        b.constructionProgress += (100 / b.constructionTime) * delta;
        if (b.constructionProgress >= 100) {
          b.constructionProgress = 100;
          b.isConstructing = false;
          this.state.stats.buildingsConstructed += 1;
          audioManager.playBuildingPlaced();
          this.addNotification('Construction Complete', `${b.name} is ready to serve your realm!`, 'success');
        }
      } else if (b.trainingQueue && b.trainingQueue.length > 0) {
        // Process hero recruitment training over time
        const currentRecruit = b.trainingQueue[0];
        currentRecruit.progress += (100 / currentRecruit.totalTime) * delta;

        if (currentRecruit.progress >= 100) {
          b.trainingQueue.shift();
          this.spawnTrainedHero(b, currentRecruit.heroClass);
        }
      }
    }
  }

  public placeBuilding(type: BuildingType, tileX: number, tileY: number): boolean {
    const bDef = BUILDING_DEFINITIONS[type];
    if (!bDef) return false;

    if (this.state.treasuryGold < bDef.cost) {
      this.addNotification('Insufficient Gold', `You need ${bDef.cost}g to construct ${bDef.name}.`, 'warning');
      return false;
    }

    if (!this.gridManager.canPlaceBuilding(tileX, tileY, bDef.width, bDef.height, this.state.buildings, this.state.lairs)) {
      return false;
    }

    this.state.treasuryGold -= bDef.cost;
    this.state.stats.goldSpent += bDef.cost;

    const newBuilding: Building = {
      id: `b_${Date.now()}_${type}`,
      type,
      name: bDef.name,
      x: tileX,
      y: tileY,
      width: bDef.width,
      height: bDef.height,
      hp: bDef.maxHp,
      maxHp: bDef.maxHp,
      level: 1,
      maxLevel: 3,
      isConstructing: true,
      constructionProgress: 0,
      constructionTime: 6.0,
      goldStored: 0,
      heroSlots: bDef.maxHeroSlots || 0,
      recruitedHeroIds: [],
      researchedUpgrades: [],
      availableUpgrades: bDef.upgrades?.map(u => u.id) || [],
      taxRate: 0.15,
      isDefense: bDef.isDefense,
      attackPower: bDef.attackPower,
      attackRange: bDef.attackRange,
      attackCooldown: bDef.attackCooldown,
      currentAttackCooldown: 0
    };

    this.state.buildings.push(newBuilding);
    audioManager.playBuildingPlaced();
    this.state.activePlacement = null;
    return true;
  }

  public recruitHero(buildingId: string, heroClass: HeroClass): boolean {
    const building = this.state.buildings.find(b => b.id === buildingId);
    if (!building || building.isConstructing) return false;

    const bDef = BUILDING_DEFINITIONS[building.type];
    const cost = bDef.heroRecruitCost?.[heroClass] || 150;

    if (this.state.treasuryGold < cost) {
      this.addNotification('Treasury Low', `Recruiting a ${heroClass} requires ${cost}g.`, 'warning');
      return false;
    }

    if (!building.trainingQueue) {
      building.trainingQueue = [];
    }

    const currentTotal = building.recruitedHeroIds.length + building.trainingQueue.length;
    if (currentTotal >= (building.heroSlots || 4)) {
      this.addNotification('Guild Full', `This guild has reached its maximum hero roster and training queue.`, 'warning');
      return false;
    }

    this.state.treasuryGold -= cost;
    this.state.stats.goldSpent += cost;

    const classDef = HERO_CLASS_DEFINITIONS[heroClass];
    const trainingTime = classDef.trainingTime || 5.0;

    building.trainingQueue.push({
      heroClass,
      progress: 0,
      totalTime: trainingTime
    });

    audioManager.playCoinSound();
    this.addNotification('Enlisted for Training', `${classDef.name} entered training at ${building.name} (${trainingTime}s).`, 'info');
    return true;
  }

  private spawnTrainedHero(building: Building, heroClass: HeroClass) {
    this.state.stats.heroesRecruited += 1;

    const classDef = HERO_CLASS_DEFINITIONS[heroClass];
    const names = HERO_NAMES[heroClass];
    const name = names[Math.floor(Math.random() * names.length)];
    const quirk = HERO_QUIRKS[Math.floor(Math.random() * HERO_QUIRKS.length)];

    const spawnX = (building.x + building.width / 2) * this.gridManager.tileSize;
    const spawnY = (building.y + building.height) * this.gridManager.tileSize + 10;

    const newHero: Hero = {
      id: `hero_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name,
      heroClass,
      level: 1,
      xp: 0,
      xpToNextLevel: 100,
      x: spawnX,
      y: spawnY,
      hp: classDef.baseHp,
      maxHp: classDef.baseHp,
      mp: classDef.baseMp,
      maxMp: classDef.baseMp,
      gold: 50,
      kills: 0,
      speed: classDef.speed,
      attackPower: classDef.baseAttack,
      defense: classDef.baseDefense,
      attackRange: classDef.attackRange,
      attackCooldown: classDef.attackCooldown,
      currentCooldown: 0,
      state: 'wandering',
      stateTimer: 2,
      homeGuildId: building.id,
      equipment: {
        weaponLevel: 0,
        armorLevel: 0,
        hasHealingPotion: false,
        hasSpeedPotion: false,
        hasAmulet: false
      },
      traits: {
        bravery: classDef.baseBravery + Math.floor(Math.random() * 20 - 10),
        greed: classDef.baseGreed + Math.floor(Math.random() * 20 - 10),
        explorationUrge: classDef.baseExploration + Math.floor(Math.random() * 20 - 10),
        loyalty: classDef.baseLoyalty + Math.floor(Math.random() * 20 - 10),
        quirk
      },
      currentThought: 'Ready for royal service!',
      title: name,
      direction: 'down',
      isAttackingAnimation: 0
    };

    building.recruitedHeroIds.push(newHero.id);
    this.state.heroes.push(newHero);

    audioManager.playLevelUp();
    this.addFloatingText(`+${newHero.name} Trained!`, spawnX, spawnY - 20, '#38bdf8');
    this.addNotification('Hero Ready!', `${newHero.name} (${classDef.name}) has completed training and joined the realm!`, 'success');
  }

  public researchUpgrade(buildingId: string, upgradeId: string): boolean {
    const building = this.state.buildings.find(b => b.id === buildingId);
    if (!building) return false;

    const bDef = BUILDING_DEFINITIONS[building.type];
    const upg = bDef.upgrades?.find(u => u.id === upgradeId);
    if (!upg) return false;

    if (this.state.treasuryGold < upg.cost) {
      this.addNotification('Insufficient Gold', `Researching ${upg.name} costs ${upg.cost}g.`, 'warning');
      return false;
    }

    this.state.treasuryGold -= upg.cost;
    this.state.stats.goldSpent += upg.cost;
    building.researchedUpgrades.push(upgradeId);

    // Apply immediate global benefits if applicable
    if (upgradeId === 'palace_lvl2') {
      building.level = 2;
      building.maxHp += 1500;
      building.hp += 1500;
      this.state.maxMana += 100;
    } else if (upgradeId === 'palace_lvl3') {
      building.level = 3;
      building.maxHp += 2000;
      building.hp += 2000;
      this.state.maxMana += 200;
    }

    audioManager.playAdvisorChime();
    this.addNotification('Research Complete', `${upg.name} researched at the ${building.name}!`, 'success');
    return true;
  }

  public placeFlag(type: FlagType, x: number, y: number, bountyAmount: number, targetEntityId?: string, targetEntityType?: 'monster' | 'lair' | 'building'): boolean {
    if (this.state.treasuryGold < bountyAmount) {
      this.addNotification('Insufficient Gold', `You need ${bountyAmount}g to set this bounty.`, 'warning');
      return false;
    }

    this.state.treasuryGold -= bountyAmount;
    this.state.stats.goldSpent += bountyAmount;

    const newFlag: Flag = {
      id: `flag_${Date.now()}`,
      type,
      x,
      y,
      goldReward: bountyAmount,
      initialGoldReward: bountyAmount,
      targetEntityId,
      targetEntityType,
      radius: 120,
      assignedHeroIds: [],
      createdAt: Date.now()
    };

    this.state.flags.push(newFlag);
    audioManager.playFlagPlaced();
    this.state.activePlacement = null;
    this.addNotification('Bounty Posted', `${type.toUpperCase()} bounty of ${bountyAmount}g placed!`, 'info', { x, y });
    return true;
  }

  public castSpell(spellId: string, targetX: number, targetY: number): boolean {
    const spell = this.state.spells.find(s => s.id === spellId);
    if (!spell || spell.currentCooldown > 0) return false;

    if (this.state.treasuryGold < spell.goldCost) {
      this.addNotification('Treasury Low', `Spell requires ${spell.goldCost}g.`, 'warning');
      return false;
    }
    if (this.state.mana < spell.manaCost) {
      this.addNotification('Mana Depleted', `Spell requires ${spell.manaCost} Mana.`, 'warning');
      return false;
    }

    this.state.treasuryGold -= spell.goldCost;
    this.state.mana -= spell.manaCost;
    spell.currentCooldown = spell.cooldown;
    this.state.stats.spellsCast += 1;

    switch (spell.id) {
      case 'royal_lightning':
        audioManager.playLightningBolt();
        // Deal 120 damage to all monsters in 70px radius
        for (const m of this.state.monsters) {
          if (Math.hypot(m.x - targetX, m.y - targetY) < 70) {
            m.hp -= 120;
            this.addFloatingText('-120 (Lightning)', m.x, m.y - 20, '#fbbf24');
          }
        }
        for (const l of this.state.lairs) {
          const lx = (l.x + l.width / 2) * this.gridManager.tileSize;
          const ly = (l.y + l.height / 2) * this.gridManager.tileSize;
          if (Math.hypot(lx - targetX, ly - targetY) < 80) {
            l.hp -= 120;
            this.addFloatingText('-120 (Lightning)', lx, ly - 20, '#fbbf24');
          }
        }
        // Visual blast particles
        for (let i = 0; i < 20; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * 60;
          this.state.particles.push({
            id: `p_light_${Date.now()}_${i}`,
            x: targetX + Math.cos(angle) * dist,
            y: targetY + Math.sin(angle) * dist,
            vx: (Math.random() - 0.5) * 60,
            vy: (Math.random() - 0.5) * 60,
            color: '#facc15',
            size: Math.random() * 4 + 2,
            alpha: 1.0,
            life: 0.5,
            maxLife: 0.5,
            type: 'spark'
          });
        }
        break;

      case 'holy_restoration':
        audioManager.playHealSound();
        for (const h of this.state.heroes) {
          if (!h.isDead && Math.hypot(h.x - targetX, h.y - targetY) < 140) {
            h.hp = Math.min(h.maxHp, h.hp + 120);
            this.addFloatingText('+120 HP', h.x, h.y - 20, '#22c55e');
          }
        }
        for (const b of this.state.buildings) {
          const bx = (b.x + b.width / 2) * this.gridManager.tileSize;
          const by = (b.y + b.height / 2) * this.gridManager.tileSize;
          if (Math.hypot(bx - targetX, by - targetY) < 140) {
            b.hp = Math.min(b.maxHp, b.hp + 200);
            this.addFloatingText('+200 HP', bx, by - 20, '#22c55e');
          }
        }
        break;

      case 'far_sight':
        audioManager.playSpellCast();
        const tile = this.gridManager.pixelToTile(targetX, targetY);
        this.gridManager.revealArea(tile.x, tile.y, 14);
        break;

      case 'call_to_arms':
        audioManager.playAdvisorChime();
        for (const h of this.state.heroes) {
          h.speed *= 1.3;
          h.attackPower += 10;
          this.addFloatingText('+Call to Arms!', h.x, h.y - 20, '#f59e0b');
        }
        break;

      case 'midas_blessing':
        audioManager.playCoinSound();
        this.state.treasuryGold += 250;
        this.addFloatingText('+250g Prosperity!', targetX, targetY - 20, '#fbbf24');
        break;
    }

    this.state.activePlacement = null;
    return true;
  }

  private checkWinLoss() {
    if (this.state.isGameOver) return;

    if (this.state.scenario.winCondition(this.state)) {
      this.state.isGameOver = true;
      this.state.gameWon = true;
      audioManager.playVictoryFanfare();
      this.addNotification('Victory!', 'The realm is secured! You have triumphed over evil!', 'success');
      return;
    }

    if (this.state.scenario.lossCondition(this.state)) {
      this.state.isGameOver = true;
      this.state.gameWon = false;
      audioManager.playDefeatSound();
      this.addNotification('Defeat', this.state.scenario.defeatText, 'danger');
      return;
    }
  }

  public addNotification(title: string, message: string, type: NotificationItem['type'], targetPos?: { x: number; y: number }) {
    const item: NotificationItem = {
      id: `notif_${Date.now()}_${Math.random()}`,
      title,
      message,
      type,
      timestamp: Date.now(),
      targetPos
    };
    this.state.notifications.unshift(item);
    if (this.state.notifications.length > 20) {
      this.state.notifications.pop();
    }
  }

  public addFloatingText(text: string, x: number, y: number, color: string) {
    this.state.floatingTexts.push({
      id: `ft_${Date.now()}_${Math.random()}`,
      text,
      x,
      y,
      color,
      fontSize: 13,
      life: 1.0,
      maxLife: 1.0,
      vy: -20
    });
  }
}
