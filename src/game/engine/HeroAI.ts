import { BUILDING_DEFINITIONS, HERO_CLASS_DEFINITIONS } from '../constants';
import { Building, Flag, Hero, Monster, MonsterLair, Treasure } from '../types';
import { GridManager } from './Grid';

export class HeroAIManager {
  private gridManager: GridManager;

  constructor(gridManager: GridManager) {
    this.gridManager = gridManager;
  }

  public updateHero(
    hero: Hero,
    delta: number,
    allHeroes: Hero[],
    monsters: Monster[],
    lairs: MonsterLair[],
    buildings: Building[],
    flags: Flag[],
    treasures: Treasure[],
    onHeroLevelUp?: (hero: Hero) => void,
    onSpawnProjectile?: (proj: {
      type: 'arrow' | 'fireball' | 'magic_missile' | 'holy_bolt';
      startX: number;
      startY: number;
      targetX: number;
      targetY: number;
      targetEntityId?: string;
      ownerHeroId?: string;
      damage: number;
    }) => void,
    onFloatingText?: (text: string, x: number, y: number, color: string) => void,
    onCollectTreasure?: (treasure: Treasure, hero: Hero) => void
  ) {
    if (hero.isDead) return;

    // Cooldown management
    if (hero.currentCooldown > 0) {
      hero.currentCooldown -= delta;
    }
    if (hero.isAttackingAnimation > 0) {
      hero.isAttackingAnimation -= delta;
    }

    // Health / Mana passive regeneration if not fleeing or in combat
    if (hero.state !== 'attacking_target' && hero.state !== 'fleeing') {
      const regenRate = 1.5;
      hero.hp = Math.min(hero.maxHp, hero.hp + regenRate * delta);
      hero.mp = Math.min(hero.maxMp, hero.mp + (hero.heroClass === 'wizard' ? 8 : 4) * delta);
    }

    // Check level up
    if (hero.xp >= hero.xpToNextLevel) {
      this.levelUpHero(hero);
      if (onHeroLevelUp) onHeroLevelUp(hero);
      if (onFloatingText) onFloatingText('LEVEL UP!', hero.x, hero.y - 20, '#fbbf24');
    }

    // Hero sight reveals fog of war
    const heroTile = this.gridManager.pixelToTile(hero.x, hero.y);
    const sightRadius = hero.heroClass === 'ranger' ? 8 : 6;
    this.gridManager.revealArea(heroTile.x, heroTile.y, sightRadius);

    // State Machine Decision Cycle
    hero.stateTimer -= delta;

    // 1. SURVIVAL CHECK: Should hero flee?
    const hpPercent = hero.hp / hero.maxHp;
    const fleeThreshold = Math.max(0.15, (100 - hero.traits.bravery) / 180);
    
    // If low HP and has healing potion, consume it!
    if (hpPercent < 0.4 && hero.equipment.hasHealingPotion) {
      hero.equipment.hasHealingPotion = false;
      hero.hp = Math.min(hero.maxHp, hero.hp + hero.maxHp * 0.5);
      if (onFloatingText) onFloatingText('+50% HP (Potion)', hero.x, hero.y - 15, '#22c55e');
    }

    if (hpPercent < fleeThreshold && hero.state === 'attacking_target') {
      // Wizard special: emergency teleport if available
      const wizardTower = buildings.find(b => b.type === 'wizard_tower');
      const hasTeleport = wizardTower?.researchedUpgrades.includes('teleportation');
      if (hero.heroClass === 'wizard' && hasTeleport && hero.mp >= 30) {
        hero.mp -= 30;
        const homeGuild = buildings.find(b => b.id === hero.homeGuildId) || wizardTower;
        if (homeGuild) {
          hero.x = (homeGuild.x + homeGuild.width / 2) * this.gridManager.tileSize;
          hero.y = (homeGuild.y + homeGuild.height / 2) * this.gridManager.tileSize;
          hero.state = 'resting_at_guild';
          hero.currentThought = 'Teleported to safety!';
          if (onFloatingText) onFloatingText('Blink!', hero.x, hero.y - 15, '#c084fc');
          return;
        }
      }

      hero.state = 'fleeing';
      hero.stateTimer = 4.0;
      hero.targetEntityId = undefined;
      hero.currentThought = 'Tactical retreat! Low health!';
    }

    // 2. State Actions & Transitions
    switch (hero.state) {
      case 'fleeing':
        this.handleFleeing(hero, delta, buildings, monsters);
        break;

      case 'resting_at_guild':
      case 'visiting_inn':
        this.handleResting(hero, delta, buildings, onFloatingText);
        break;

      case 'visiting_marketplace':
      case 'visiting_blacksmith':
        this.handleShopping(hero, delta, buildings, onFloatingText);
        break;

      case 'healing_ally':
        this.handleClericHealing(hero, delta, allHeroes, onFloatingText);
        break;

      case 'collecting_treasure':
        this.handleCollectingTreasure(hero, delta, treasures, onFloatingText, onCollectTreasure);
        break;

      case 'attacking_target':
        this.handleAttacking(hero, delta, monsters, lairs, onSpawnProjectile, onFloatingText);
        break;

      case 'pursuing_flag':
        this.handlePursuingFlag(hero, delta, flags, monsters, lairs);
        break;

      case 'wandering':
      case 'idle':
      default:
        this.decideNextGoal(hero, delta, allHeroes, monsters, lairs, buildings, flags, treasures);
        break;
    }
  }

  private decideNextGoal(
    hero: Hero,
    delta: number,
    allHeroes: Hero[],
    monsters: Monster[],
    lairs: MonsterLair[],
    buildings: Building[],
    flags: Flag[],
    treasures: Treasure[]
  ) {
    // A. Cleric behavior: Heal critical allies nearby
    if (hero.heroClass === 'cleric' && hero.mp >= 25) {
      const hurtAlly = allHeroes.find(
        h => h.id !== hero.id && !h.isDead && h.hp < h.maxHp * 0.6 && Math.hypot(h.x - hero.x, h.y - hero.y) < 180
      );
      if (hurtAlly) {
        hero.state = 'healing_ally';
        hero.targetEntityId = hurtAlly.id;
        hero.targetEntityType = 'hero';
        hero.currentThought = `Healing ${hurtAlly.name}!`;
        return;
      }
    }

    // B. Check for visible Treasures & Chests (Rogues & Rangers are especially keen!)
    const treasureDetectRadius = hero.heroClass === 'rogue' ? 240 : (hero.heroClass === 'ranger' ? 200 : 130);
    let nearestTreasure: Treasure | null = null;
    let nearestTreasureDist = treasureDetectRadius;

    for (const t of treasures) {
      const dist = Math.hypot(t.x - hero.x, t.y - hero.y);
      if (dist < nearestTreasureDist && this.gridManager.isPixelVisible(t.x, t.y)) {
        nearestTreasureDist = dist;
        nearestTreasure = t;
      }
    }

    if (nearestTreasure) {
      hero.state = 'collecting_treasure';
      hero.targetEntityId = nearestTreasure.id;
      hero.targetX = nearestTreasure.x;
      hero.targetY = nearestTreasure.y;
      hero.currentThought = `Spotted a ${nearestTreasure.type === 'chest' ? 'Treasure Chest' : 'Gold Sack'}!`;
      return;
    }

    // C. Check if hero wants to shop or upgrade gear with their earned bounty gold
    if (hero.gold >= 30) {
      // 1. Visit Marketplace for healing potions or travel rations
      if (!hero.equipment.hasHealingPotion || (!hero.equipment.hasSpeedPotion && hero.gold >= 60)) {
        const market = buildings.find(b => b.type === 'marketplace' && !b.isConstructing && b.hp > 0);
        if (market) {
          hero.state = 'visiting_marketplace';
          hero.targetEntityId = market.id;
          hero.targetEntityType = 'building';
          hero.currentThought = 'Heading to Marketplace to buy potions & gear';
          return;
        }
      }

      // 2. Visit Blacksmith for Weapon or Armor forged upgrades
      if (hero.gold >= 60 && (hero.equipment.weaponLevel < 3 || hero.equipment.armorLevel < 3)) {
        const blacksmith = buildings.find(b => b.type === 'blacksmith' && !b.isConstructing && b.hp > 0);
        if (blacksmith) {
          hero.state = 'visiting_blacksmith';
          hero.targetEntityId = blacksmith.id;
          hero.targetEntityType = 'building';
          hero.currentThought = 'Visiting Blacksmith to forge weapon & armor';
          return;
        }
      }

      // 3. Visit Inn to celebrate, drink ale, gamble, and socialize
      if (hero.gold >= 25 && Math.random() < 0.25) {
        const inn = buildings.find(b => b.type === 'royal_inn' && !b.isConstructing && b.hp > 0);
        if (inn) {
          hero.state = 'visiting_inn';
          hero.targetEntityId = inn.id;
          hero.targetEntityType = 'building';
          hero.currentThought = 'Heading to the Inn for ale & celebration';
          return;
        }
      }
    }

    // C. Check if hero needs to rest at Inn or Guild hall
    if (hero.hp < hero.maxHp * 0.75) {
      const inn = buildings.find(b => b.type === 'royal_inn' && !b.isConstructing && b.hp > 0);
      if (inn && hero.gold >= 15) {
        hero.state = 'visiting_inn';
        hero.targetEntityId = inn.id;
        hero.targetEntityType = 'building';
        hero.currentThought = 'Resting at the Inn with warm food & ale';
        return;
      } else {
        const homeGuild = buildings.find(b => b.id === hero.homeGuildId && b.hp > 0);
        if (homeGuild) {
          hero.state = 'resting_at_guild';
          hero.targetEntityId = homeGuild.id;
          hero.targetEntityType = 'building';
          hero.currentThought = 'Returning to guild hall to recover';
          return;
        }
      }
    }

    // D. Evaluate Active Flags (Majesty Bounty System)
    let bestFlag: Flag | null = null;
    let highestAppeal = -999;

    for (const flag of flags) {
      const dist = Math.hypot(flag.x - hero.x, flag.y - hero.y);
      let appeal = 0;

      if (flag.type === 'attack') {
        // Greed + Bravery multiplier
        appeal = (flag.goldReward * (hero.traits.greed / 50)) - (dist * 0.4) + (hero.traits.bravery * 0.5);
      } else if (flag.type === 'explore') {
        // Rangers & Rogues love explore flags
        const exploreBonus = hero.heroClass === 'ranger' ? 80 : (hero.heroClass === 'rogue' ? 50 : 10);
        appeal = (flag.goldReward * (hero.traits.greed / 60)) + (hero.traits.explorationUrge * 0.8) + exploreBonus - (dist * 0.3);
      } else if (flag.type === 'defend') {
        // Warriors & Clerics love defend flags
        const loyaltyBonus = hero.heroClass === 'warrior' || hero.heroClass === 'cleric' ? 70 : 20;
        appeal = (flag.goldReward * (hero.traits.greed / 70)) + (hero.traits.loyalty * 0.8) + loyaltyBonus - (dist * 0.3);
      }

      if (appeal > highestAppeal && appeal > 20) {
        highestAppeal = appeal;
        bestFlag = flag;
      }
    }

    if (bestFlag) {
      hero.state = 'pursuing_flag';
      hero.targetFlagId = bestFlag.id;
      hero.targetX = bestFlag.x;
      hero.targetY = bestFlag.y;
      hero.currentThought = `Answering ${bestFlag.type.toUpperCase()} bounty (${bestFlag.goldReward}g)`;
      return;
    }

    // E. Look for nearby monsters within hero's awareness radius
    const searchRadius = hero.heroClass === 'warrior' ? 180 : 140;
    let closestMonster: Monster | null = null;
    let closestDist = searchRadius;

    for (const m of monsters) {
      const dist = Math.hypot(m.x - hero.x, m.y - hero.y);
      // Only target visible monsters (in explored and visible tile)
      if (dist < closestDist && this.gridManager.isPixelVisible(m.x, m.y)) {
        closestDist = dist;
        closestMonster = m;
      }
    }

    if (closestMonster) {
      hero.state = 'attacking_target';
      hero.targetEntityId = closestMonster.id;
      hero.targetEntityType = 'monster';
      hero.currentThought = `Engaging ${closestMonster.name}!`;
      return;
    }

    // F. Default: Wander around town perimeter or explore
    if (hero.stateTimer <= 0) {
      hero.state = 'wandering';
      hero.stateTimer = Math.random() * 4 + 3;

      let wanderRadius = 140;
      if (hero.heroClass === 'ranger') wanderRadius = 260; // rangers roam wider

      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * wanderRadius;
      
      const homeGuild = buildings.find(b => b.id === hero.homeGuildId);
      const originX = homeGuild ? (homeGuild.x + homeGuild.width / 2) * this.gridManager.tileSize : hero.x;
      const originY = homeGuild ? (homeGuild.y + homeGuild.height / 2) * this.gridManager.tileSize : hero.y;

      const targetX = Math.max(32, Math.min((this.gridManager.width - 2) * 32, originX + Math.cos(angle) * dist));
      const targetY = Math.max(32, Math.min((this.gridManager.height - 2) * 32, originY + Math.sin(angle) * dist));

      hero.targetX = targetX;
      hero.targetY = targetY;
      hero.currentThought = hero.heroClass === 'ranger' ? 'Scouting the perimeter' : 'Patrolling the kingdom';
    }

    // Move toward target position
    if (hero.targetX !== undefined && hero.targetY !== undefined) {
      this.moveTowards(hero, hero.targetX, hero.targetY, delta);
    }
  }

  private handleCollectingTreasure(
    hero: Hero,
    delta: number,
    treasures: Treasure[],
    onFloatingText?: (text: string, x: number, y: number, color: string) => void,
    onCollectTreasure?: (treasure: Treasure, hero: Hero) => void
  ) {
    const treasureIndex = treasures.findIndex(t => t.id === hero.targetEntityId);
    if (treasureIndex === -1) {
      hero.state = 'idle';
      hero.targetEntityId = undefined;
      return;
    }

    const treasure = treasures[treasureIndex];
    const dist = Math.hypot(treasure.x - hero.x, treasure.y - hero.y);

    if (dist > 18) {
      this.moveTowards(hero, treasure.x, treasure.y, delta, 1.15);
    } else {
      // Pick up treasure!
      hero.gold += treasure.goldAmount;
      hero.xp += 25;

      if (onFloatingText) {
        onFloatingText(`+${treasure.goldAmount}g Loot!`, hero.x, hero.y - 18, '#fbbf24');
      }

      if (onCollectTreasure) {
        onCollectTreasure(treasure, hero);
      }

      treasures.splice(treasureIndex, 1);
      hero.state = 'idle';
      hero.stateTimer = 1.0;
      hero.currentThought = `Looted ${treasure.goldAmount} gold!`;
    }
  }

  private handleFleeing(hero: Hero, delta: number, buildings: Building[], monsters: Monster[]) {
    // Run towards nearest friendly guild or palace
    const safeBuilding = buildings.find(b => (b.id === hero.homeGuildId || b.type === 'palace') && b.hp > 0);
    if (safeBuilding) {
      const bx = (safeBuilding.x + safeBuilding.width / 2) * this.gridManager.tileSize;
      const by = (safeBuilding.y + safeBuilding.height / 2) * this.gridManager.tileSize;
      this.moveTowards(hero, bx, by, delta, 1.2); // sprint when fleeing

      if (Math.hypot(bx - hero.x, by - hero.y) < 30 || hero.stateTimer <= 0) {
        hero.state = 'resting_at_guild';
        hero.stateTimer = 5.0;
        hero.currentThought = 'Resting in safety';
      }
    } else {
      hero.state = 'idle';
      hero.stateTimer = 1.0;
    }
  }

  private handleResting(
    hero: Hero,
    delta: number,
    buildings: Building[],
    onFloatingText?: (text: string, x: number, y: number, color: string) => void
  ) {
    const building = buildings.find(b => b.id === hero.targetEntityId || b.id === hero.homeGuildId);
    if (!building) {
      hero.state = 'idle';
      return;
    }

    const bx = (building.x + building.width / 2) * this.gridManager.tileSize;
    const by = (building.y + building.height / 2) * this.gridManager.tileSize;

    if (Math.hypot(bx - hero.x, by - hero.y) > 40) {
      this.moveTowards(hero, bx, by, delta);
    } else {
      // Resting inside/at building: rapid recovery
      const healSpeed = building.type === 'royal_inn' ? 35 : 20;
      hero.hp = Math.min(hero.maxHp, hero.hp + healSpeed * delta);
      hero.mp = Math.min(hero.maxMp, hero.mp + 25 * delta);

      if (building.type === 'royal_inn' && hero.gold >= 15 && !hero.restingProgress) {
        hero.gold -= 15;
        building.goldStored += 15;
        hero.restingProgress = 1;
        if (onFloatingText) onFloatingText('-15g Tavern Ale & Meal', hero.x, hero.y - 15, '#fbbf24');
      } else if (building.id === hero.homeGuildId && hero.gold >= 10 && !hero.restingProgress) {
        hero.gold -= 10;
        building.goldStored += 10;
        hero.restingProgress = 1;
      }

      if (hero.hp >= hero.maxHp * 0.95 && hero.mp >= hero.maxMp * 0.95) {
        hero.state = 'idle';
        hero.restingProgress = 0;
        hero.currentThought = 'Rested and ready for adventure!';
      }
    }
  }

  private handleShopping(
    hero: Hero,
    delta: number,
    buildings: Building[],
    onFloatingText?: (text: string, x: number, y: number, color: string) => void
  ) {
    const shop = buildings.find(b => b.id === hero.targetEntityId);
    if (!shop || shop.hp <= 0) {
      hero.state = 'idle';
      return;
    }

    const sx = (shop.x + shop.width / 2) * this.gridManager.tileSize;
    const sy = (shop.y + shop.height / 2) * this.gridManager.tileSize;

    if (Math.hypot(sx - hero.x, sy - hero.y) > 35) {
      this.moveTowards(hero, sx, sy, delta);
    } else {
      // At shop! Perform purchase with hero's gold -> transfers to shop.goldStored
      if (shop.type === 'marketplace') {
        if (hero.gold >= 35 && !hero.equipment.hasHealingPotion) {
          hero.gold -= 35;
          shop.goldStored += 35;
          hero.equipment.hasHealingPotion = true;
          if (onFloatingText) onFloatingText('-35g Healing Elixir', hero.x, hero.y - 15, '#38bdf8');
        } else if (hero.gold >= 30 && !hero.equipment.hasSpeedPotion) {
          hero.gold -= 30;
          shop.goldStored += 30;
          hero.equipment.hasSpeedPotion = true;
          hero.speed += 8;
          if (onFloatingText) onFloatingText('-30g Speed Draught', hero.x, hero.y - 15, '#fbbf24');
        } else if (hero.gold >= 50 && !hero.equipment.hasAmulet) {
          hero.gold -= 50;
          shop.goldStored += 50;
          hero.equipment.hasAmulet = true;
          hero.defense += 4;
          if (onFloatingText) onFloatingText('-50g Warding Amulet', hero.x, hero.y - 15, '#c084fc');
        }
      } else if (shop.type === 'blacksmith') {
        // Upgrade weapon or armor
        const nextWepTier = hero.equipment.weaponLevel + 1;
        const wepCost = nextWepTier * 50;
        const nextArmorTier = hero.equipment.armorLevel + 1;
        const armorCost = nextArmorTier * 45;

        if (hero.gold >= wepCost && hero.equipment.weaponLevel < 3) {
          hero.gold -= wepCost;
          shop.goldStored += wepCost;
          hero.equipment.weaponLevel += 1;
          hero.attackPower += 5;
          if (onFloatingText) onFloatingText(`-${wepCost}g Weapon Tier ${hero.equipment.weaponLevel}!`, hero.x, hero.y - 15, '#fbbf24');
        } else if (hero.gold >= armorCost && hero.equipment.armorLevel < 3) {
          hero.gold -= armorCost;
          shop.goldStored += armorCost;
          hero.equipment.armorLevel += 1;
          hero.defense += 4;
          if (onFloatingText) onFloatingText(`-${armorCost}g Armor Tier ${hero.equipment.armorLevel}!`, hero.x, hero.y - 15, '#38bdf8');
        }
      } else if (shop.type === 'royal_inn') {
        if (hero.gold >= 20) {
          hero.gold -= 20;
          shop.goldStored += 20;
          if (onFloatingText) onFloatingText('-20g Tavern Entertainment', hero.x, hero.y - 15, '#fbbf24');
        }
      }

      hero.state = 'idle';
      hero.stateTimer = 1.5;
      hero.currentThought = 'Finished shopping and gear preparation';
    }
  }

  private handleClericHealing(
    hero: Hero,
    delta: number,
    allHeroes: Hero[],
    onFloatingText?: (text: string, x: number, y: number, color: string) => void
  ) {
    const ally = allHeroes.find(h => h.id === hero.targetEntityId);
    if (!ally || ally.isDead || ally.hp >= ally.maxHp) {
      hero.state = 'idle';
      return;
    }

    const dist = Math.hypot(ally.x - hero.x, ally.y - hero.y);
    if (dist > 70) {
      this.moveTowards(hero, ally.x, ally.y, delta);
    } else if (hero.currentCooldown <= 0 && hero.mp >= 20) {
      hero.mp -= 20;
      hero.currentCooldown = hero.attackCooldown;
      hero.isAttackingAnimation = 0.3;
      const healAmount = 45 + hero.level * 8;
      ally.hp = Math.min(ally.maxHp, ally.hp + healAmount);
      hero.xp += 15;
      if (onFloatingText) {
        onFloatingText(`+${healAmount} HP`, ally.x, ally.y - 15, '#22c55e');
        onFloatingText('Healed Ally (+15 XP)', hero.x, hero.y - 25, '#c084fc');
      }
      hero.state = 'idle';
    }
  }

  private handlePursuingFlag(
    hero: Hero,
    delta: number,
    flags: Flag[],
    monsters: Monster[],
    lairs: MonsterLair[]
  ) {
    const flag = flags.find(f => f.id === hero.targetFlagId);
    if (!flag) {
      hero.state = 'idle';
      return;
    }

    const dist = Math.hypot(flag.x - hero.x, flag.y - hero.y);
    if (dist > 30) {
      const speedMult = hero.traits.quirk === 'Gold Hungry' || hero.heroClass === 'rogue' ? 1.2 : 1.0;
      this.moveTowards(hero, flag.x, flag.y, delta, speedMult);
    } else {
      // Hero reached the flag!
      if (flag.type === 'attack') {
        // If flag targets a monster or lair, switch to attack
        const monster = monsters.find(m => m.id === flag.targetEntityId);
        const lair = lairs.find(l => l.id === flag.targetEntityId);
        if (monster) {
          hero.state = 'attacking_target';
          hero.targetEntityId = monster.id;
          hero.targetEntityType = 'monster';
        } else if (lair) {
          hero.state = 'attacking_target';
          hero.targetEntityId = lair.id;
          hero.targetEntityType = 'lair';
        }
      }
    }
  }

  private handleAttacking(
    hero: Hero,
    delta: number,
    monsters: Monster[],
    lairs: MonsterLair[],
    onSpawnProjectile?: (proj: {
      type: 'arrow' | 'fireball' | 'magic_missile' | 'holy_bolt';
      startX: number;
      startY: number;
      targetX: number;
      targetY: number;
      targetEntityId?: string;
      ownerHeroId?: string;
      damage: number;
    }) => void,
    onFloatingText?: (text: string, x: number, y: number, color: string) => void
  ) {
    let targetX = 0;
    let targetY = 0;
    let targetAlive = false;

    if (hero.targetEntityType === 'monster') {
      const targetMonster = monsters.find(m => m.id === hero.targetEntityId);
      if (targetMonster) {
        targetX = targetMonster.x;
        targetY = targetMonster.y;
        targetAlive = true;
      }
    } else if (hero.targetEntityType === 'lair') {
      const targetLair = lairs.find(l => l.id === hero.targetEntityId);
      if (targetLair) {
        targetX = (targetLair.x + targetLair.width / 2) * this.gridManager.tileSize;
        targetY = (targetLair.y + targetLair.height / 2) * this.gridManager.tileSize;
        targetAlive = true;
      }
    }

    if (!targetAlive) {
      hero.state = 'idle';
      hero.targetEntityId = undefined;
      return;
    }

    const dist = Math.hypot(targetX - hero.x, targetY - hero.y);

    if (dist > hero.attackRange) {
      this.moveTowards(hero, targetX, targetY, delta);
    } else {
      // In attack range!
      if (hero.currentCooldown <= 0) {
        hero.currentCooldown = hero.attackCooldown;
        hero.isAttackingAnimation = 0.25;

        const isCrit = Math.random() < (hero.heroClass === 'rogue' ? 0.35 : 0.12);
        const critMult = isCrit ? 2.0 : 1.0;
        const totalDamage = Math.round(hero.attackPower * critMult);

        if (hero.heroClass === 'ranger' || hero.heroClass === 'elf') {
          if (onSpawnProjectile) {
            onSpawnProjectile({
              type: 'arrow',
              startX: hero.x,
              startY: hero.y,
              targetX,
              targetY,
              targetEntityId: hero.targetEntityId,
              ownerHeroId: hero.id,
              damage: totalDamage
            });
          }
        } else if (hero.heroClass === 'wizard') {
          if (onSpawnProjectile) {
            onSpawnProjectile({
              type: hero.level >= 3 ? 'fireball' : 'magic_missile',
              startX: hero.x,
              startY: hero.y,
              targetX,
              targetY,
              targetEntityId: hero.targetEntityId,
              ownerHeroId: hero.id,
              damage: totalDamage
            });
          }
        } else if (hero.heroClass === 'cleric' && hero.targetEntityType === 'monster') {
          if (onSpawnProjectile) {
            onSpawnProjectile({
              type: 'holy_bolt',
              startX: hero.x,
              startY: hero.y,
              targetX,
              targetY,
              targetEntityId: hero.targetEntityId,
              ownerHeroId: hero.id,
              damage: totalDamage
            });
          }
        } else {
          // Melee strike directly applied
          if (hero.targetEntityType === 'monster') {
            const m = monsters.find(mon => mon.id === hero.targetEntityId);
            if (m) {
              const actualDamage = Math.max(1, totalDamage - m.defense);
              m.hp -= actualDamage;
              // Award hit combat XP
              const hitXp = Math.max(3, Math.round(actualDamage * 0.4));
              hero.xp += hitXp;

              if (onFloatingText) {
                onFloatingText(isCrit ? `CRIT! -${actualDamage}` : `-${actualDamage}`, m.x, m.y - 12, isCrit ? '#ef4444' : '#ffffff');
              }
            }
          } else if (hero.targetEntityType === 'lair') {
            const l = lairs.find(lair => lair.id === hero.targetEntityId);
            if (l) {
              l.hp -= totalDamage;
              hero.xp += Math.max(2, Math.round(totalDamage * 0.25));
              if (onFloatingText) onFloatingText(`-${totalDamage}`, targetX, targetY - 12, '#fbbf24');
            }
          }
        }
      }
    }
  }

  private moveTowards(hero: Hero, targetX: number, targetY: number, delta: number, speedMultiplier = 1.0) {
    const dx = targetX - hero.x;
    const dy = targetY - hero.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 4) {
      hero.targetX = undefined;
      hero.targetY = undefined;
      if (hero.state === 'wandering') {
        hero.state = 'idle';
        hero.stateTimer = Math.random() * 2 + 1;
      }
      return;
    }

    const moveDist = hero.speed * speedMultiplier * delta;
    const vx = (dx / dist) * moveDist;
    const vy = (dy / dist) * moveDist;

    // Check collision / grid bounds
    const nextX = hero.x + vx;
    const nextY = hero.y + vy;

    const tile = this.gridManager.pixelToTile(nextX, nextY);
    if (this.gridManager.isWalkable(tile.x, tile.y)) {
      hero.x = nextX;
      hero.y = nextY;
    } else {
      // Try sliding on X or Y
      const tileX = this.gridManager.pixelToTile(nextX, hero.y);
      const tileY = this.gridManager.pixelToTile(hero.x, nextY);
      if (this.gridManager.isWalkable(tileX.x, tileX.y)) {
        hero.x = nextX;
      } else if (this.gridManager.isWalkable(tileY.x, tileY.y)) {
        hero.y = nextY;
      }
    }

    // Direction facing
    if (Math.abs(dx) > Math.abs(dy)) {
      hero.direction = dx > 0 ? 'right' : 'left';
    } else {
      hero.direction = dy > 0 ? 'down' : 'up';
    }
  }

  private levelUpHero(hero: Hero) {
    const def = HERO_CLASS_DEFINITIONS[hero.heroClass];
    hero.level += 1;
    hero.xp -= hero.xpToNextLevel;
    hero.xpToNextLevel = Math.round(hero.xpToNextLevel * 1.5);
    hero.maxHp += def.hpPerLevel;
    hero.hp = hero.maxHp;
    hero.maxMp += def.mpPerLevel;
    hero.mp = hero.maxMp;
    hero.attackPower += def.attackPerLevel;
    hero.defense += def.defensePerLevel;

    // Upgrade Title
    if (hero.level >= 10) hero.title = `Grand Champion ${hero.name}`;
    else if (hero.level >= 7) hero.title = `Veteran ${hero.name}`;
    else if (hero.level >= 4) hero.title = `Adept ${hero.name}`;
    else hero.title = `${hero.name}`;
  }
}
