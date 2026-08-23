import { BUILDING_DEFINITIONS, HERO_CLASS_DEFINITIONS, HERO_NAMES, HERO_QUIRKS, MAP_CONFIG, SOVEREIGN_SPELLS } from '../constants';
import { Building, BuildingType, Corpse, Flag, FlagType, GameState, Hero, HeroClass, Monster, MonsterLair, NotificationItem, Peasant, Projectile, Scenario, SovereignSpell, Treasure } from '../types';
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
  private cottageSproutTimer: number = 18.0;
  private peasantReplenishTimer: number = 0;

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
      peasants: [],
      treasures: [],
      corpses: [],
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
        dayTime: 800, // Starts at 8:00 AM in bright, clear morning daylight
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
      trainingQueue: [],
      researchQueue: [],
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
    this.gridManager.clearRoadsUnderBuilding(palace);
    this.gridManager.paveRoadToBuilding(palace, this.state.buildings, this.state.lairs);

    // Spawn 3 initial Peasant Cottages snug around Palace outskirts generating initial kingdom taxes
    const cottageOffsets = [
      { dx: -5, dy: -4 },
      { dx: 5, dy: -4 },
      { dx: -4, dy: 5 }
    ];

    const cottageDef = BUILDING_DEFINITIONS['peasant_cottage'];
    cottageOffsets.forEach((pos, idx) => {
      const cx = centerX + pos.dx;
      const cy = centerY + pos.dy;
      if (this.gridManager.canPlaceBuilding(cx, cy, 2, 2, this.state.buildings, [])) {
        const initCottage: Building = {
          id: `cottage_start_${idx}`,
          type: 'peasant_cottage',
          name: 'Peasant Cottage',
          x: cx,
          y: cy,
          width: cottageDef.width,
          height: cottageDef.height,
          hp: cottageDef.maxHp,
          maxHp: cottageDef.maxHp,
          level: 1,
          maxLevel: 1,
          isConstructing: false,
          constructionProgress: 100,
          constructionTime: 0,
          goldStored: 12, // initial land rent awaiting collection
          heroSlots: 0,
          recruitedHeroIds: [],
          trainingQueue: [],
          researchQueue: [],
          researchedUpgrades: [],
          availableUpgrades: [],
          taxRate: 0.15
        };
        this.state.buildings.push(initCottage);
        this.gridManager.clearRoadsUnderBuilding(initCottage);
        this.gridManager.paveRoadToBuilding(initCottage, this.state.buildings, this.state.lairs);
      }
    });

    // Spawn 2 initial Royal Peasant Builders at the Palace
    for (let p = 0; p < 2; p++) {
      const peasant: Peasant = {
        id: `peasant_${p}`,
        name: p === 0 ? 'Cedric the Builder' : 'Giles the Mason',
        x: (palace.x + palace.width / 2) * MAP_CONFIG.TILE_SIZE + (p === 0 ? -12 : 12),
        y: (palace.y + palace.height) * MAP_CONFIG.TILE_SIZE + 10,
        hp: 120,
        maxHp: 120,
        speed: 24,
        state: 'idle_at_palace',
        hammerTimer: 0,
        direction: 'down'
      };
      this.state.peasants.push(peasant);
    }

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
      this.gridManager.clearRoadsUnderBuilding(lair);
    }

    // Seed hidden ancient treasure chests in uncharted wilderness
    const numWildChests = Math.max(6, Math.floor((scenario.mapWidth * scenario.mapHeight) / 800));
    for (let c = 0; c < numWildChests; c++) {
      const cx = Math.floor(Math.random() * (scenario.mapWidth - 14)) + 7;
      const cy = Math.floor(Math.random() * (scenario.mapHeight - 14)) + 7;
      if (Math.hypot(cx - centerX, cy - centerY) < 14) continue;
      const dropPos = this.gridManager.findNearestWalkablePosition((cx + 0.5) * MAP_CONFIG.TILE_SIZE, (cy + 0.5) * MAP_CONFIG.TILE_SIZE, this.state.buildings, this.state.lairs);

      this.state.treasures.push({
        id: `treasure_wild_${c}`,
        x: dropPos.x,
        y: dropPos.y,
        goldAmount: Math.floor(Math.random() * 60) + 40,
        type: 'chest',
        createdAt: Date.now()
      });
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

    // 4. Update Buildings & Peasant Construction & Peasant Cottage Sprouting
    this.updateBuildings(delta);
    this.updatePeasants(delta);
    this.updateCottageSprouting(delta);

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
        audioManager.playVoice(`${hero.heroClass}_death`, hero.x, hero.y);
        const classDef = HERO_CLASS_DEFINITIONS[hero.heroClass];
        this.addNotification('Hero Fallen', `${hero.title} the Level ${hero.level} ${classDef.name} has fallen in battle (${hero.kills} kills). A grave marks their resting place.`, 'danger', { x: hero.x, y: hero.y });

        // Permanent gravestone so the kingdom remembers its fallen
        this.state.corpses.push({
          id: `grave_${Date.now()}_${hero.id}`,
          type: 'hero',
          subType: hero.heroClass,
          name: `${hero.title}, Level ${hero.level}`,
          x: hero.x,
          y: hero.y,
          rotation: Math.random() * Math.PI * 2,
          createdAt: Date.now(),
          lifetime: 900.0
        });

        // Fallen heroes drop their purse — brave souls may recover it!
        if (hero.gold > 0) {
          this.state.treasures.push({
            id: `purse_${Date.now()}_${hero.id}`,
            x: hero.x + (Math.random() * 16 - 8),
            y: hero.y + (Math.random() * 16 - 8),
            goldAmount: Math.max(10, Math.round(hero.gold)),
            type: 'gold_bag',
            createdAt: Date.now()
          });
        }

        // Clean up hero from all guild rosters so guilds accurately free up member slots
        for (const b of this.state.buildings) {
          if (b.recruitedHeroIds && b.recruitedHeroIds.includes(hero.id)) {
            b.recruitedHeroIds = b.recruitedHeroIds.filter(id => id !== hero.id);
          }
        }

        // Clean up hero from bounty flags
        for (const f of this.state.flags) {
          if (f.assignedHeroIds && f.assignedHeroIds.includes(hero.id)) {
            f.assignedHeroIds = f.assignedHeroIds.filter(id => id !== hero.id);
          }
        }

        // Deselect if currently inspected
        if (this.state.selectedEntity?.type === 'hero' && this.state.selectedEntity.id === hero.id) {
          this.state.selectedEntity = null;
        }

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
        this.state.treasures,
        () => audioManager.playLevelUp(),
        (proj) => {
          this.state.projectiles.push({
            id: `h_proj_${Date.now()}_${Math.random()}`,
            ...proj,
            ownerHeroId: hero.id,
            currentX: proj.startX,
            currentY: proj.startY,
            speed: proj.type === 'arrow' ? 220 : 180,
            isHeroProjectile: true,
            progress: 0
          });
        },
        (text, x, y, color) => this.addFloatingText(text, x, y, color),
        (treasure, h) => {
          audioManager.playCoinSound();
          this.addNotification('Treasure Looted', `${h.name} discovered a ${treasure.type === 'chest' ? 'Treasure Chest' : 'Gold Sack'} (+${treasure.goldAmount}g)!`, 'success');
        }
      );
    }

    // 7. Update Monsters AI
    for (let i = this.state.monsters.length - 1; i >= 0; i--) {
      const monster = this.state.monsters[i];
      if (monster.hp <= 0) {
        this.state.stats.monstersKilled += 1;
        audioManager.playSwordClash();

        // Award kill XP (and optional pocket loot) to the hero(es) involved
        const nearbyHeroes = this.state.heroes.filter(
          h => !h.isDead && (h.targetEntityId === monster.id || Math.hypot(h.x - monster.x, h.y - monster.y) < 180)
        );

        if (nearbyHeroes.length > 0) {
          nearbyHeroes.sort((a, b) => Math.hypot(a.x - monster.x, a.y - monster.y) - Math.hypot(b.x - monster.x, b.y - monster.y));

          // Primary killer
          const killer = nearbyHeroes[0];
          killer.kills += 1;
          killer.xp += monster.xpReward;
          this.addFloatingText(`+${monster.xpReward} XP`, killer.x, killer.y - 20, '#38bdf8');

          if (monster.goldBountyReward > 0) {
            killer.gold += monster.goldBountyReward;
            this.addFloatingText(`+${monster.goldBountyReward}g`, killer.x, killer.y - 32, '#fbbf24');
          }

          // Assisting heroes
          for (let k = 1; k < nearbyHeroes.length; k++) {
            const assistHero = nearbyHeroes[k];
            const assistXp = Math.round(monster.xpReward * 0.5);
            assistHero.xp += assistXp;
            this.addFloatingText(`+${assistXp} XP (Assist)`, assistHero.x, assistHero.y - 20, '#38bdf8');
          }
        }

        // Spawn monster corpse / carcass on battlefield
        this.state.corpses.push({
          id: `corpse_mon_${Date.now()}_${monster.id}`,
          type: 'monster',
          subType: monster.type,
          name: monster.name,
          x: monster.x,
          y: monster.y,
          rotation: Math.random() * Math.PI * 2,
          createdAt: Date.now(),
          lifetime: monster.isBoss ? 60.0 : 25.0
        });

        // Bosses or high-tier beasts drop ground loot for heroes to collect
        const dropChance = monster.isBoss ? 1.0 : (monster.type === 'minotaur' || monster.type === 'goblin_shaman' ? 0.35 : 0);
        if (Math.random() < dropChance) {
          const dropPos = this.gridManager.findNearestWalkablePosition(monster.x, monster.y, this.state.buildings, this.state.lairs);
          this.state.treasures.push({
            id: `loot_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            x: dropPos.x,
            y: dropPos.y,
            goldAmount: monster.isBoss ? 150 : Math.floor(Math.random() * 20) + 15,
            type: monster.isBoss ? 'chest' : 'gold_bag',
            createdAt: Date.now()
          });
        }

        this.state.monsters.splice(i, 1);
        continue;
      }

      this.monsterAIManager.updateMonster(
        monster,
        delta,
        this.state.monsters,
        this.state.heroes,
        this.state.buildings,
        this.state.lairs,
        this.state.taxCollectors,
        this.state.peasants,
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
      this.state.lairs,
      this.state.taxCollectors,
      (amount) => {
        // Tax collector physically delivers taxes to Palace!
        this.state.treasuryGold += amount;
        this.state.stats.goldEarned += amount;
        audioManager.playCoinSound();
      },
      (tc) => this.state.taxCollectors.push(tc),
      (text, x, y, color) => this.addFloatingText(text, x, y, color),
      (treasure) => this.state.treasures.push(treasure)
    );

    // 10. Update Projectiles & Combat Particles
    this.combatManager.updateProjectiles(
      this.state.projectiles,
      delta,
      this.state.heroes,
      this.state.monsters,
      this.state.lairs,
      this.state.buildings,
      this.state.taxCollectors,
      this.state.peasants,
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

        const lx = (lair.x + lair.width / 2) * this.gridManager.tileSize;
        const ly = (lair.y + lair.height / 2) * this.gridManager.tileSize;

        audioManager.playBuildingDestroyed(lx, ly);
        audioManager.playCoinSound(lx, ly);

        // Spawn ground plunder loot on the ruins for heroes to collect
        for (let l = 0; l < 2; l++) {
          const rawX = lx + (Math.random() * 24 - 12);
          const rawY = ly + (Math.random() * 24 - 12);
          const dropPos = this.gridManager.findNearestWalkablePosition(rawX, rawY, this.state.buildings, this.state.lairs, lair.id);
          this.state.treasures.push({
            id: `loot_lair_${Date.now()}_${l}`,
            x: dropPos.x,
            y: dropPos.y,
            goldAmount: Math.floor(plunderGold * 0.12) + 25,
            type: lair.type === 'dragon_cavern' ? 'chest' : 'gold_bag',
            createdAt: Date.now()
          });
        }

        this.addFloatingText(`+${plunderGold}g Plunder!`, lx, ly - 20, '#fbbf24');
        this.addNotification('Lair Destroyed & Plundered!', `The ${lair.name} was razed! +${plunderGold}g deposited to Treasury!`, 'success');
        this.state.lairs.splice(i, 1);
      }
    }

    // 13. Update Corpses Lifetime (Fades away over time)
    for (let i = this.state.corpses.length - 1; i >= 0; i--) {
      const c = this.state.corpses[i];
      c.lifetime -= delta;
      if (c.lifetime <= 0) {
        this.state.corpses.splice(i, 1);
      }
    }

    // 14. Update Spell Cooldowns
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
    this.state.stats.dayTime += delta * 5.0; // 2400 = 1 full day (~480 seconds / 8 minutes realtime)
    if (this.state.stats.dayTime >= 2400) {
      this.state.stats.dayTime = 0;
      this.state.stats.daysPassed += 1;
      this.addNotification('A New Dawn', `Day ${this.state.stats.daysPassed} begins across your kingdom.`, 'info');
    }

    const time = this.state.stats.dayTime;
    if (time >= 600 && time < 1900) {
      this.state.dayPhase = 'day';
    } else if (time >= 1900 && time < 2150) {
      this.state.dayPhase = 'dusk';
    } else if (time >= 2150 || time < 450) {
      this.state.dayPhase = 'night';
    } else {
      this.state.dayPhase = 'dawn';
    }
  }

  private recalculateVisibility() {
    this.gridManager.resetVisibility();

    // 1. Palace & Buildings sight
    for (const b of this.state.buildings) {
      if (b.hp <= 0) continue;
      const bx = Math.floor(b.x + b.width / 2);
      const by = Math.floor(b.y + b.height / 2);
      const radius = b.type === 'guard_tower' ? 11 : (b.type === 'palace' ? 12 : 8);
      this.gridManager.revealArea(bx, by, radius);
    }

    // 2. Heroes sight
    for (const h of this.state.heroes) {
      if (h.isDead) continue;
      const hTile = this.gridManager.pixelToTile(h.x, h.y);
      const radius = h.heroClass === 'ranger' ? 9 : 7;
      this.gridManager.revealArea(hTile.x, hTile.y, radius);
    }

    // 3. Peasants sight (Dispel fog of war as peasants walk, construct, repair)
    for (const p of this.state.peasants) {
      if (p.hp <= 0) continue;
      const pTile = this.gridManager.pixelToTile(p.x, p.y);
      this.gridManager.revealArea(pTile.x, pTile.y, MAP_CONFIG.FOG_REVEAL_RADIUS_PEASANT);
    }

    // 4. Tax Collectors sight
    for (const tc of this.state.taxCollectors) {
      if (tc.hp <= 0) continue;
      const tcTile = this.gridManager.pixelToTile(tc.x, tc.y);
      this.gridManager.revealArea(tcTile.x, tcTile.y, MAP_CONFIG.FOG_REVEAL_RADIUS_TAX_COLLECTOR);
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

        const ts = this.gridManager.tileSize;
        const centerBx = (b.x + b.width / 2) * ts;
        const centerBy = (b.y + b.height / 2) * ts;

        audioManager.playBuildingDestroyed(centerBx, centerBy);
        this.addNotification('Building Destroyed', `The ${b.name} was reduced to rubble!`, 'danger');

        // Spawn smoke and rubble destruction particles
        for (let p = 0; p < 18; p++) {
          this.state.particles.push({
            id: `p_ruin_${Date.now()}_${p}`,
            x: centerBx + (Math.random() - 0.5) * b.width * ts * 0.7,
            y: centerBy + (Math.random() - 0.5) * b.height * ts * 0.7,
            vx: (Math.random() - 0.5) * 35,
            vy: (Math.random() - 0.5) * 35,
            life: 1.8 + Math.random() * 0.8,
            maxLife: 2.6,
            color: p % 2 === 0 ? '#475569' : '#1c1917',
            size: 6 + Math.random() * 6,
            alpha: 1.0,
            type: 'smoke'
          });
        }

        // Spawn persistent smoking ruins on the building footprint
        this.state.corpses.push({
          id: `ruin_${Date.now()}_${b.id}`,
          type: 'building_ruin',
          subType: b.type,
          name: `${b.name} Ruins`,
          x: centerBx,
          y: centerBy,
          rotation: 0,
          createdAt: Date.now(),
          lifetime: 180.0, // Persists for 3 minutes as smoking ruins
          width: b.width,
          height: b.height
        });

        this.state.buildings.splice(i, 1);
        continue;
      }

      if (b.trainingQueue && b.trainingQueue.length > 0 && !b.isConstructing) {
        // Process hero recruitment training over time
        const currentRecruit = b.trainingQueue[0];
        currentRecruit.progress += (100 / currentRecruit.totalTime) * delta;

        if (currentRecruit.progress >= 100) {
          b.trainingQueue.shift();
          this.spawnTrainedHero(b, currentRecruit.heroClass);
        }
      }

      if (b.researchQueue && b.researchQueue.length > 0 && !b.isConstructing) {
        // Process upgrade / technology research over time
        const currentResearch = b.researchQueue[0];
        currentResearch.progress += (100 / currentResearch.totalTime) * delta;

        if (currentResearch.progress >= 100) {
          b.researchQueue.shift();
          const upgId = currentResearch.upgradeId;
          b.researchedUpgrades.push(upgId);

          const bDef = BUILDING_DEFINITIONS[b.type];
          const upg = bDef.upgrades?.find(u => u.id === upgId);
          const upgName = upg?.name || 'Upgrade';

          // Apply building upgrade stats
          if (upgId === 'palace_lvl2') {
            b.level = 2;
            b.maxHp += 1500;
            b.hp += 1500;
            this.state.maxMana += 100;
          } else if (upgId === 'palace_lvl3') {
            b.level = 3;
            b.maxHp += 2000;
            b.hp += 2000;
            this.state.maxMana += 200;
          }

          audioManager.playAdvisorChime();
          audioManager.playBuildingPlaced((b.x + b.width / 2) * this.gridManager.tileSize, (b.y + b.height / 2) * this.gridManager.tileSize);
          this.addNotification('Upgrade Complete', `${upgName} completed at the ${b.name}!`, 'success');
        }
      }
    }
  }

  private updatePeasants(delta: number) {
    const palace = this.state.buildings.find(b => b.type === 'palace' && b.hp > 0);
    if (!palace) return;

    const palaceCenter = {
      x: (palace.x + palace.width / 2) * this.gridManager.tileSize,
      y: (palace.y + palace.height / 2) * this.gridManager.tileSize
    };

    const palaceGate = {
      x: (palace.x + palace.width / 2) * this.gridManager.tileSize,
      y: (palace.y + palace.height) * this.gridManager.tileSize + 6
    };

    // 1. Clean up slain peasants, spawn corpses and trigger replenishment timer
    for (let i = this.state.peasants.length - 1; i >= 0; i--) {
      const p = this.state.peasants[i];
      if (p.hp <= 0) {
        audioManager.playVoice('peasant_death', p.x, p.y);
        this.addNotification('Peasant Slain', `${p.name} was slain by monsters! A new builder will arrive at the palace in 20 seconds.`, 'danger', { x: p.x, y: p.y });
        this.state.corpses.push({
          id: `corpse_peasant_${Date.now()}_${p.id}`,
          type: 'hero',
          subType: 'peasant',
          name: p.name,
          x: p.x,
          y: p.y,
          rotation: Math.random() * Math.PI * 2,
          createdAt: Date.now(),
          lifetime: 40.0
        });
        this.state.peasants.splice(i, 1);
        if (this.peasantReplenishTimer <= 0) {
          this.peasantReplenishTimer = 20.0;
        }
      }
    }

    // 2. Replenish peasant builders over time up to workforce capacity
    const peasantCottages = this.state.buildings.filter(b => b.type === 'peasant_cottage' && !b.isConstructing && b.hp > 0).length;
    const targetPeasantCount = 2 + (palace.level - 1) + Math.floor(peasantCottages / 2);

    if (this.state.peasants.length < targetPeasantCount) {
      if (this.peasantReplenishTimer > 0) {
        this.peasantReplenishTimer -= delta;
      }
      if (this.peasantReplenishTimer <= 0) {
        const pIdx = this.state.peasants.length;
        const newPeasant: Peasant = {
          id: `peasant_${Date.now()}_${pIdx}`,
          name: pIdx % 2 === 0 ? 'Robin the Carpenter' : 'Will the Mason',
          x: palaceGate.x + (pIdx % 2 === 0 ? -8 : 8),
          y: palaceGate.y + 4,
          hp: 120,
          maxHp: 120,
          speed: 24,
          state: 'idle_at_palace',
          hammerTimer: 0,
          direction: 'down'
        };
        this.state.peasants.push(newPeasant);
        this.addNotification('New Builder Recruited', `${newPeasant.name} reported for royal construction duty at the Palace!`, 'info');
        this.peasantReplenishTimer = 20.0;
      }
    } else {
      this.peasantReplenishTimer = 0;
    }

    const isNight = this.state.dayPhase === 'night';
    const ts = this.gridManager.tileSize;

    // Group active peasants by target building to assign distinct perimeter work slots
    const peasantsOnBuilding = new Map<string, Peasant[]>();
    for (const p of this.state.peasants) {
      if (p.hp > 0 && p.targetBuildingId) {
        const list = peasantsOnBuilding.get(p.targetBuildingId) || [];
        list.push(p);
        peasantsOnBuilding.set(p.targetBuildingId, list);
      }
    }

    // Process each peasant builder
    for (let pIdx = 0; pIdx < this.state.peasants.length; pIdx++) {
      const p = this.state.peasants[pIdx];
      if (p.hp <= 0) continue;

      if (isNight) {
        // At night, peasants walk to individual spaced resting spots in the Palace Courtyard
        const idleSpotX = palaceGate.x + Math.sin(pIdx * 1.6) * (14 + (pIdx % 3) * 6);
        const idleSpotY = palaceGate.y + 12 + Math.cos(pIdx * 1.6) * 10;
        const distToGate = Math.hypot(idleSpotX - p.x, idleSpotY - p.y);
        if (distToGate > 8) {
          this.movePeasantTowards(p, idleSpotX, idleSpotY, delta);
        } else {
          p.state = 'idle_at_palace';
          p.targetBuildingId = undefined;
        }
        continue;
      }

      if (p.state === 'idle_at_palace') {
        // Priority 1: Unfinished construction sites (Prioritize sites with 0 active workers first, then highest progress)
        const unbuiltSites = this.state.buildings.filter(b => b.isConstructing && b.hp > 0);
        let bestTarget: Building | null = null;

        if (unbuiltSites.length > 0) {
          unbuiltSites.sort((a, b) => {
            const countA = (peasantsOnBuilding.get(a.id) || []).length;
            const countB = (peasantsOnBuilding.get(b.id) || []).length;
            if (countA !== countB) return countA - countB; // Fewest workers first!
            return (b.constructionProgress || 0) - (a.constructionProgress || 0); // Highest progress first
          });
          bestTarget = unbuiltSites[0];
        }

        // Priority 2: Damaged buildings needing repair
        if (!bestTarget) {
          const damaged = this.state.buildings.filter(b => !b.isConstructing && b.hp > 0 && b.hp < b.maxHp * 0.95);
          if (damaged.length > 0) {
            damaged.sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp));
            bestTarget = damaged[0];
          }
        }

        if (bestTarget) {
          p.targetBuildingId = bestTarget.id;
          p.state = 'walking_to_site';
          const list = peasantsOnBuilding.get(bestTarget.id) || [];
          list.push(p);
          peasantsOnBuilding.set(bestTarget.id, list);
        } else {
          // Wander/idle in courtyard at personal resting coordinates
          const courtyardX = palaceGate.x + Math.sin(pIdx * 1.4) * (16 + (pIdx % 2) * 8);
          const courtyardY = palaceGate.y + 14 + Math.cos(pIdx * 1.4) * 8;
          if (Math.hypot(courtyardX - p.x, courtyardY - p.y) > 10) {
            this.movePeasantTowards(p, courtyardX, courtyardY, delta);
          }
        }
      } else if (p.state === 'walking_to_site') {
        const targetBuilding = this.state.buildings.find(b => b.id === p.targetBuildingId && b.hp > 0);
        if (!targetBuilding) {
          p.state = 'idle_at_palace';
          p.targetBuildingId = undefined;
          continue;
        }

        const buildersList = peasantsOnBuilding.get(targetBuilding.id) || [p];
        const slotIdx = buildersList.indexOf(p);
        const workSlot = this.getBuildingWorkSlot(targetBuilding, slotIdx, ts);
        const distToSlot = Math.hypot(workSlot.x - p.x, workSlot.y - p.y);

        const reached = this.movePeasantTowards(p, workSlot.x, workSlot.y, delta);

        if (distToSlot <= 16 || reached) {
          // Reached perimeter work slot! Start hammering
          const bCenterX = (targetBuilding.x + targetBuilding.width / 2) * ts;
          const bCenterY = (targetBuilding.y + targetBuilding.height / 2) * ts;
          const dx = bCenterX - p.x;
          const dy = bCenterY - p.y;
          if (Math.abs(dx) > Math.abs(dy)) {
            p.direction = dx > 0 ? 'right' : 'left';
          } else {
            p.direction = dy > 0 ? 'down' : 'up';
          }
          p.state = targetBuilding.isConstructing ? 'hammering_construction' : 'repairing_building';
        }
      } else if (p.state === 'hammering_construction') {
        const targetBuilding = this.state.buildings.find(b => b.id === p.targetBuildingId && b.hp > 0);
        if (!targetBuilding || !targetBuilding.isConstructing) {
          p.state = 'idle_at_palace';
          p.targetBuildingId = undefined;
          continue;
        }

        p.hammerTimer += delta;
        targetBuilding.constructionProgress += (100 / targetBuilding.constructionTime) * delta;
        targetBuilding.hp = Math.min(targetBuilding.maxHp, Math.max(1, Math.floor(targetBuilding.maxHp * (targetBuilding.constructionProgress / 100))));

        if (targetBuilding.constructionProgress >= 100) {
          targetBuilding.constructionProgress = 100;
          targetBuilding.hp = targetBuilding.maxHp;
          targetBuilding.isConstructing = false;
          this.state.stats.buildingsConstructed += 1;
          this.gridManager.paveRoadToBuilding(targetBuilding, this.state.buildings, this.state.lairs);
          audioManager.playBuildingPlaced();
          this.addFloatingText('Building Complete!', p.x, p.y - 20, '#22c55e');
          this.addNotification('Construction Complete', `${targetBuilding.name} was built by your peasants!`, 'success');
          p.state = 'idle_at_palace';
          p.targetBuildingId = undefined;
        }
      } else if (p.state === 'repairing_building') {
        const targetBuilding = this.state.buildings.find(b => b.id === p.targetBuildingId && b.hp > 0);
        if (!targetBuilding || targetBuilding.hp >= targetBuilding.maxHp) {
          p.state = 'idle_at_palace';
          p.targetBuildingId = undefined;
          continue;
        }

        p.hammerTimer += delta;
        targetBuilding.hp = Math.min(targetBuilding.maxHp, targetBuilding.hp + 35 * delta);

        if (targetBuilding.hp >= targetBuilding.maxHp) {
          targetBuilding.hp = targetBuilding.maxHp;
          this.addFloatingText('Repaired!', p.x, p.y - 20, '#22c55e');
          p.state = 'idle_at_palace';
          p.targetBuildingId = undefined;
        }
      }
    }

    // Soft unit-to-unit separation to prevent peasants from ever overlapping or stacking
    const minDist = 9.0;
    for (let i = 0; i < this.state.peasants.length; i++) {
      const p1 = this.state.peasants[i];
      if (p1.hp <= 0) continue;

      for (let j = i + 1; j < this.state.peasants.length; j++) {
        const p2 = this.state.peasants[j];
        if (p2.hp <= 0) continue;

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);

        if (dist < minDist && dist > 0.01) {
          const overlap = (minDist - dist) * 0.5;
          const nx = dx / dist;
          const ny = dy / dist;

          p1.x -= nx * overlap * Math.min(1.0, delta * 10);
          p1.y -= ny * overlap * Math.min(1.0, delta * 10);
          p2.x += nx * overlap * Math.min(1.0, delta * 10);
          p2.y += ny * overlap * Math.min(1.0, delta * 10);
        }
      }
    }
  }

  private getBuildingWorkSlot(b: Building, slotIndex: number, ts: number): { x: number; y: number } {
    const bLeft = b.x * ts;
    const bRight = (b.x + b.width) * ts;
    const bTop = b.y * ts;
    const bBottom = (b.y + b.height) * ts;
    const bW = b.width * ts;
    const bH = b.height * ts;
    const margin = 12;

    const slots: { x: number; y: number }[] = [
      { x: bLeft + bW * 0.25, y: bBottom + margin }, // South-left
      { x: bLeft + bW * 0.75, y: bBottom + margin }, // South-right
      { x: bRight + margin, y: bTop + bH * 0.35 },  // East-upper
      { x: bLeft - margin, y: bTop + bH * 0.35 },   // West-upper
      { x: bRight + margin, y: bTop + bH * 0.75 },  // East-lower
      { x: bLeft - margin, y: bTop + bH * 0.75 },   // West-lower
      { x: bLeft + bW * 0.35, y: bTop - margin },   // North-left
      { x: bLeft + bW * 0.65, y: bTop - margin }    // North-right
    ];

    const idx = Math.max(0, slotIndex) % slots.length;
    const chosen = slots[idx];
    return this.gridManager.findNearestWalkablePosition(chosen.x, chosen.y, this.state.buildings, this.state.lairs, b.id);
  }

  private movePeasantTowards(p: Peasant, targetX: number, targetY: number, delta: number) {
    this.gridManager.moveEntityAlongPath(
      p,
      targetX,
      targetY,
      delta,
      this.state.buildings,
      this.state.lairs,
      p.targetBuildingId
    );
  }

  private updateCottageSprouting(delta: number) {
    const palace = this.state.buildings.find(b => b.type === 'palace' && b.hp > 0);
    if (!palace) return;

    // Authentic Majesty Rule: As you recruit more heroes, their families build cottages outside the walls
    const activeHeroes = this.state.heroes.filter(h => !h.isDead).length;
    const palaceLevel = palace.level || 1;

    // Max allowed cottages is proportional to hero families + palace tier (starts at 2 for a quiet town, expanding as hero guild roster grows)
    const maxCottages = Math.min(14, Math.max(2, Math.floor(activeHeroes * 0.75) + (palaceLevel - 1)));
    const currentCottages = this.state.buildings.filter(b => b.type === 'peasant_cottage').length;

    if (currentCottages >= maxCottages) return;

    this.cottageSproutTimer -= delta;
    if (this.cottageSproutTimer <= 0) {
      this.cottageSproutTimer = Math.random() * 20 + 25; // Sprout comfortably every 25-45s

      const palaceCenterX = Math.floor(palace.x + palace.width / 2);
      const palaceCenterY = Math.floor(palace.y + palace.height / 2);

      // Anchor near the Palace or existing royal buildings (guilds, markets, blacksmiths)
      const mainBuildings = this.state.buildings.filter(b => b.type !== 'peasant_cottage' && b.hp > 0);
      const anchors = mainBuildings.length > 0 ? mainBuildings : [palace];

      for (let attempt = 0; attempt < 35; attempt++) {
        const anchor = anchors[Math.floor(Math.random() * anchors.length)];
        const anchorX = Math.floor(anchor.x + anchor.width / 2);
        const anchorY = Math.floor(anchor.y + anchor.height / 2);

        const angle = Math.random() * Math.PI * 2;
        // Sprout within 4 to 8 tiles of anchor, staying snug around the settlement
        const dist = Math.floor(Math.random() * 4) + 4;
        const tx = Math.floor(anchorX + Math.cos(angle) * dist);
        const ty = Math.floor(anchorY + Math.sin(angle) * dist);

        // Keep all cottages within 12 tiles of the palace center (cozy royal settlement)
        const distToPalace = Math.hypot(tx - palaceCenterX, ty - palaceCenterY);
        if (distToPalace > 12) continue;

        // Keep distance from monster lairs so commoners don't settle near monster nests
        const nearLair = this.state.lairs.some(l => {
          const lx = l.x + l.width / 2;
          const ly = l.y + l.height / 2;
          return Math.hypot(lx - tx, ly - ty) < 9;
        });
        if (nearLair) continue;

        if (this.gridManager.canPlaceBuilding(tx, ty, 2, 2, this.state.buildings, this.state.lairs)) {
          const cottageDef = BUILDING_DEFINITIONS['peasant_cottage'];
          const dx = palaceCenterX - tx;
          const dy = palaceCenterY - ty;
          const facing: 'south' | 'north' | 'east' | 'west' = Math.abs(dy) >= Math.abs(dx) ? (dy < 0 ? 'north' : 'south') : (dx < 0 ? 'west' : 'east');

          const newCottage: Building = {
            id: `cottage_${Date.now()}_${attempt}`,
            type: 'peasant_cottage',
            name: cottageDef.name,
            x: tx,
            y: ty,
            width: cottageDef.width,
            height: cottageDef.height,
            hp: 1,
            maxHp: cottageDef.maxHp,
            level: 1,
            maxLevel: 1,
            isConstructing: true,
            constructionProgress: 0,
            constructionTime: cottageDef.constructionTime || 16.0,
            goldStored: 0,
            heroSlots: 0,
            recruitedHeroIds: [],
            trainingQueue: [],
            researchQueue: [],
            researchedUpgrades: [],
            availableUpgrades: [],
            taxRate: 0.15,
            facing
          };

          this.state.buildings.push(newCottage);
          this.addNotification('New Hamlet Sprouting', 'Commoners are building a new thatched cottage in the settlement outskirts!', 'info');
          break;
        }
      }
    }
  }

  public placeBuilding(type: BuildingType, tileX: number, tileY: number): boolean {
    const bDef = BUILDING_DEFINITIONS[type];
    if (!bDef) return false;

    const palace = this.state.buildings.find(b => b.type === 'palace' && b.hp > 0);
    const palaceLevel = palace?.level || 1;

    // 1. Check Palace Level requirement
    if (bDef.requiresPalaceLevel && palaceLevel < bDef.requiresPalaceLevel) {
      this.addNotification('Prerequisite Not Met', `${bDef.name} requires Palace Level ${bDef.requiresPalaceLevel}! Upgrade your Palace first.`, 'warning');
      return false;
    }

    // 2. Check Prerequisite Building requirement
    if (bDef.requiresBuilding) {
      const hasPrereq = this.state.buildings.some(b => b.type === bDef.requiresBuilding && !b.isConstructing && b.hp > 0);
      if (!hasPrereq) {
        const reqName = BUILDING_DEFINITIONS[bDef.requiresBuilding].name;
        this.addNotification('Prerequisite Not Met', `${bDef.name} requires an existing ${reqName}!`, 'warning');
        return false;
      }
    }

    if (this.state.treasuryGold < bDef.cost) {
      this.addNotification('Insufficient Gold', `You need ${bDef.cost}g to construct ${bDef.name}.`, 'warning');
      return false;
    }

    if (!this.gridManager.canPlaceBuilding(tileX, tileY, bDef.width, bDef.height, this.state.buildings, this.state.lairs)) {
      return false;
    }

    this.state.treasuryGold -= bDef.cost;
    this.state.stats.goldSpent += bDef.cost;

    // Clear any pre-existing road tiles directly under the new building's foundation
    for (let by = tileY; by < tileY + bDef.height; by++) {
      for (let bx = tileX; bx < tileX + bDef.width; bx++) {
        if (this.gridManager.isValid(bx, by) && this.gridManager.grid[by][bx] === 1) {
          this.gridManager.grid[by][bx] = 0;
        }
      }
    }
    this.gridManager.roadVersion++;

    // Calculate facing towards the closest existing road or palace
    const centerBx = tileX + bDef.width / 2;
    const centerBy = tileY + bDef.height / 2;
    let closestRoad = { x: this.state.scenario.mapWidth / 2, y: this.state.scenario.mapHeight / 2 };
    let minD = Infinity;

    for (let gy = 0; gy < this.gridManager.height; gy++) {
      for (let gx = 0; gx < this.gridManager.width; gx++) {
        if (this.gridManager.grid[gy][gx] === 1) {
          const d = Math.hypot(gx - centerBx, gy - centerBy);
          if (d < minD) {
            minD = d;
            closestRoad = { x: gx, y: gy };
          }
        }
      }
    }

    const fdx = closestRoad.x - centerBx;
    const fdy = closestRoad.y - centerBy;
    const facing: 'south' | 'north' | 'east' | 'west' = Math.abs(fdy) >= Math.abs(fdx) ? (fdy < 0 ? 'north' : 'south') : (fdx < 0 ? 'west' : 'east');

    const newBuilding: Building = {
      id: `b_${Date.now()}_${type}`,
      type,
      name: bDef.name,
      x: tileX,
      y: tileY,
      width: bDef.width,
      height: bDef.height,
      hp: 1,
      maxHp: bDef.maxHp,
      level: 1,
      maxLevel: 3,
      isConstructing: true,
      constructionProgress: 0,
      constructionTime: bDef.constructionTime || 20.0,
      goldStored: 0,
      heroSlots: bDef.maxHeroSlots || 0,
      recruitedHeroIds: [],
      trainingQueue: [],
      researchQueue: [],
      researchedUpgrades: [],
      availableUpgrades: bDef.upgrades?.map(u => u.id) || [],
      taxRate: 0.15,
      facing,
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

    // Sanitize recruitedHeroIds to ensure only living heroes count towards guild capacity
    building.recruitedHeroIds = building.recruitedHeroIds.filter(id =>
      this.state.heroes.some(h => h.id === id && !h.isDead)
    );

    const currentTotal = building.recruitedHeroIds.length + building.trainingQueue.length;
    if (currentTotal >= (building.heroSlots || 4)) {
      this.addNotification('Guild Full', `This guild has reached its maximum hero roster and training queue.`, 'warning');
      return false;
    }

    this.state.treasuryGold -= cost;
    this.state.stats.goldSpent += cost;
    building.goldStored += Math.round(cost * 0.35); // Guild receives training fees, creating taxable commerce!

    const classDef = HERO_CLASS_DEFINITIONS[heroClass];
    const trainingTime = classDef.trainingTime || 5.0;

    building.trainingQueue.push({
      id: `recruit_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
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

    audioManager.playVoice(`${heroClass}_ready`);
    this.addFloatingText(`+${newHero.name} Trained!`, spawnX, spawnY - 20, '#38bdf8');
    this.addNotification('Hero Ready!', `${newHero.name} (${classDef.name}) has completed training and joined the realm!`, 'success');
  }

  public researchUpgrade(buildingId: string, upgradeId: string): boolean {
    const building = this.state.buildings.find(b => b.id === buildingId);
    if (!building) return false;

    if (building.isConstructing) {
      this.addNotification('Under Construction', `The ${building.name} must be fully constructed before researching upgrades!`, 'warning');
      return false;
    }

    const bDef = BUILDING_DEFINITIONS[building.type];
    const upg = bDef.upgrades?.find(u => u.id === upgradeId);
    if (!upg) return false;

    if (!building.researchQueue) {
      building.researchQueue = [];
    }
    if (building.researchQueue.length > 0) {
      this.addNotification('Already Upgrading', `${building.name} is already busy researching!`, 'warning');
      return false;
    }
    if (building.researchedUpgrades.includes(upgradeId)) {
      return false;
    }

    // Check Hero Count Requirement (e.g. Palace Lv.2 requires 4+ heroes, Palace Lv.3 requires 8+ heroes)
    const livingHeroes = this.state.heroes.filter(h => !h.isDead).length;
    if (upg.requiredHeroes && livingHeroes < upg.requiredHeroes) {
      this.addNotification('Prerequisite Not Met', `${upg.name} requires at least ${upg.requiredHeroes} active heroes in your realm (currently ${livingHeroes}/${upg.requiredHeroes})!`, 'warning');
      return false;
    }

    // Check Building Requirement (e.g. Palace Lv.2 requires Marketplace, Palace Lv.3 requires Blacksmith)
    if (upg.requiredBuilding) {
      const hasReqBuilding = this.state.buildings.some(b => b.type === upg.requiredBuilding && !b.isConstructing && b.hp > 0);
      if (!hasReqBuilding) {
        const reqName = BUILDING_DEFINITIONS[upg.requiredBuilding].name;
        this.addNotification('Prerequisite Not Met', `${upg.name} requires a functioning ${reqName}!`, 'warning');
        return false;
      }
    }

    if (this.state.treasuryGold < upg.cost) {
      this.addNotification('Insufficient Gold', `Researching ${upg.name} costs ${upg.cost}g.`, 'warning');
      return false;
    }

    this.state.treasuryGold -= upg.cost;
    this.state.stats.goldSpent += upg.cost;

    const isBuildingUpgrade = upgradeId.startsWith('palace_') || upgradeId.includes('_lvl');
    const researchTime = upg.researchTime || (upgradeId === 'palace_lvl3' ? 24.0 : (upgradeId === 'palace_lvl2' ? 16.0 : 8.0));

    building.researchQueue.push({
      upgradeId,
      progress: 0,
      totalTime: researchTime,
      isBuildingUpgrade
    });

    audioManager.playVoice('peasant_upgrade', (building.x + building.width / 2) * this.gridManager.tileSize, (building.y + building.height / 2) * this.gridManager.tileSize);
    this.addNotification(isBuildingUpgrade ? 'Upgrade Begun' : 'Research Begun', `Started ${upg.name} at ${building.name}!`, 'info');
    return true;
  }

  public placeFlag(type: FlagType, x: number, y: number, bountyAmount: number, targetEntityId?: string, targetEntityType?: 'monster' | 'lair' | 'building'): boolean {
    if (type === 'attack') {
      if (!targetEntityId || (targetEntityType !== 'monster' && targetEntityType !== 'lair')) {
        this.addNotification('Invalid Target', 'Attack flags can only be placed on enemy monsters or monster lairs!', 'warning');
        return false;
      }
      if (targetEntityType === 'monster') {
        const monster = this.state.monsters.find(m => m.id === targetEntityId && m.hp > 0);
        if (!monster) {
          this.addNotification('Invalid Target', 'Target monster is no longer valid.', 'warning');
          return false;
        }
      } else if (targetEntityType === 'lair') {
        const lair = this.state.lairs.find(l => l.id === targetEntityId && l.hp > 0);
        if (!lair) {
          this.addNotification('Invalid Target', 'Target monster lair is no longer valid.', 'warning');
          return false;
        }
      }
    }

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

  public cancelFlag(flagId: string): boolean {
    const flagIndex = this.state.flags.findIndex(f => f.id === flagId);
    if (flagIndex === -1) return false;
    const flag = this.state.flags[flagIndex];

    // Check if any friendly unit (hero, peasant, tax collector) is near the flag (within 120px)
    const nearDist = 120;
    const hasNearbyFriendly =
      this.state.heroes.some(h => !h.isDead && Math.hypot(h.x - flag.x, h.y - flag.y) < nearDist) ||
      this.state.peasants.some(p => p.hp > 0 && Math.hypot(p.x - flag.x, p.y - flag.y) < nearDist) ||
      this.state.taxCollectors.some(tc => tc.hp > 0 && Math.hypot(tc.x - flag.x, tc.y - flag.y) < nearDist);

    if (hasNearbyFriendly) {
      this.addNotification('Cannot Cancel Bounty', 'Friendly units are already nearby or engaging the target!', 'warning');
      return false;
    }

    // Refund gold to kingdom treasury
    const refund = flag.goldReward;
    this.state.treasuryGold += refund;
    this.addFloatingText(`+${refund}g Refunded`, flag.x, flag.y - 20, '#fbbf24');
    audioManager.playCoinSound(flag.x, flag.y);
    this.addNotification('Bounty Cancelled', `Cancelled ${flag.type.toUpperCase()} flag. Refunded ${refund}g to Treasury.`, 'info');

    // Unassign heroes pursuing this flag
    for (const h of this.state.heroes) {
      if (h.targetFlagId === flag.id) {
        h.targetFlagId = undefined;
        if (h.state === 'pursuing_flag') {
          h.state = 'idle';
          h.targetX = undefined;
          h.targetY = undefined;
        }
      }
    }

    this.state.flags.splice(flagIndex, 1);
    if (this.state.selectedEntity?.type === 'flag' && this.state.selectedEntity.id === flagId) {
      this.state.selectedEntity = null;
    }
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
    // Cleanly sanitize any floating numbers into rounded integers (e.g. 4.000000003 -> 4)
    const cleanText = text.replace(/(\d+)\.\d+/g, (match) => Math.round(parseFloat(match)).toString());

    this.state.floatingTexts.push({
      id: `ft_${Date.now()}_${Math.random()}`,
      text: cleanText,
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
