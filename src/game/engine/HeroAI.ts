import { BUILDING_DEFINITIONS, HERO_CLASS_DEFINITIONS, MONSTER_DEFINITIONS } from '../constants';
import { Building, Flag, Hero, Monster, MonsterLair, Treasure } from '../types';
import { audioManager } from './Audio';
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
    if (hero.fearCooldown && hero.fearCooldown > 0) {
      hero.fearCooldown -= delta;
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

    if (hpPercent < fleeThreshold && hero.state !== 'fleeing' && hero.state !== 'resting_at_guild' && hero.state !== 'visiting_inn') {
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
      audioManager.playVoice(`${hero.heroClass}_flee`, hero.x, hero.y);
    }

    // FEAR ON SIGHT: An overwhelming monster nearby spooks the hero into a panicked rout (with cooldown and delta rate scaling)
    if ((hero.fearCooldown ?? 0) <= 0 && hero.state !== 'fleeing' && hero.state !== 'attacking_target' && hero.state !== 'resting_at_guild' && hero.state !== 'visiting_inn') {
      const terrorRadius = 85;
      const terror = monsters.find(
        m => m.hp > 0 && this.isOverwhelming(hero, m, allHeroes) && Math.hypot(m.x - hero.x, m.y - hero.y) < terrorRadius
      );
      const fearChancePerSec = 0.25 * Math.max(0.08, (100 - hero.traits.bravery) / 100);
      if (terror && Math.random() < fearChancePerSec * delta) {
        hero.state = 'fleeing';
        hero.stateTimer = 4.0;
        hero.fearCooldown = 12.0; // 12 second cooldown prevents fear spam loops
        hero.targetEntityId = undefined;
        hero.targetFlagId = undefined;
        hero.currentThought = `The ${terror.name} terrifies me! Run!`;
        if (onFloatingText) onFloatingText('Terrified!', hero.x, hero.y - 15, '#f87171');
        audioManager.playVoice(`${hero.heroClass}_flee`, hero.x, hero.y);
      }
    }

    // 2. State Actions & Transitions
    switch (hero.state) {
      case 'fleeing':
        this.handleFleeing(hero, delta, buildings, lairs, monsters);
        break;

      case 'resting_at_guild':
      case 'visiting_inn':
        this.handleResting(hero, delta, buildings, lairs, onFloatingText);
        break;

      case 'visiting_marketplace':
      case 'visiting_blacksmith':
        this.handleShopping(hero, delta, buildings, lairs, onFloatingText);
        break;

      case 'healing_ally':
        this.handleClericHealing(hero, delta, allHeroes, buildings, lairs, onFloatingText);
        break;

      case 'collecting_treasure':
        this.handleCollectingTreasure(hero, delta, treasures, buildings, lairs, onFloatingText, onCollectTreasure);
        break;

      case 'attacking_target':
        this.handleAttacking(hero, delta, monsters, lairs, buildings, onSpawnProjectile, onFloatingText);
        break;

      case 'pursuing_flag':
        this.handlePursuingFlag(hero, delta, flags, monsters, lairs, buildings);
        break;

      case 'wandering':
        this.handleWandering(hero, delta, allHeroes, buildings, lairs, monsters, flags, treasures);
        break;

      case 'idle':
      default:
        if (hero.stateTimer <= 0) {
          this.decideNextGoal(hero, delta, allHeroes, monsters, lairs, buildings, flags, treasures);
        }
        break;
    }
  }

  private estimateHeroPower(hero: Hero, allies?: Hero[]): number {
    let power = hero.level * 12 + hero.attackPower +
      hero.equipment.weaponLevel * 8 + hero.equipment.armorLevel * 6 + hero.maxHp / 10;

    // PACK HUNTING: Heroes bolder in numbers — safety in comrades
    if (allies) {
      const nearbyAllies = allies.filter(
        h => h.id !== hero.id && !h.isDead && Math.hypot(h.x - hero.x, h.y - hero.y) < 160
      ).length;
      power *= 1 + Math.min(nearbyAllies, 4) * 0.18;
    }
    return power;
  }

  private estimateMonsterThreat(monster: Monster): number {
    let threat = monster.maxHp / 12 + monster.attackPower * 1.6;
    if (monster.isBoss) threat *= 1.6;
    return threat;
  }

  private isOverwhelming(hero: Hero, monster: Monster, allies?: Hero[]): boolean {
    const courageFactor = 0.55 + hero.traits.bravery / 250;
    return this.estimateMonsterThreat(monster) > this.estimateHeroPower(hero, allies) * courageFactor;
  }

  private handleWandering(
    hero: Hero,
    delta: number,
    allHeroes: Hero[],
    buildings: Building[],
    lairs: MonsterLair[],
    monsters: Monster[],
    flags: Flag[],
    treasures: Treasure[]
  ) {
    // 1. Self Defense: Interrupt wandering immediately if an active monster threat is near
    const searchRadius = hero.heroClass === 'warrior' || hero.heroClass === 'dwarf' ? 220 : 160;
    let nearbyMonster: Monster | null = null;
    let avoidedThreat: Monster | null = null;
    for (const m of monsters) {
      if (m.hp <= 0) continue;
      const dist = Math.hypot(m.x - hero.x, m.y - hero.y);
      if (dist < searchRadius && this.gridManager.isPixelVisible(m.x, m.y)) {
        if (this.isOverwhelming(hero, m, allHeroes)) {
          avoidedThreat = m; // Cowardly discretion — do not pick fights with dragons
        } else {
          nearbyMonster = m;
          break;
        }
      }
    }
    if (nearbyMonster) {
      hero.state = 'attacking_target';
      hero.targetEntityId = nearbyMonster.id;
      hero.targetEntityType = 'monster';
      hero.targetX = undefined;
      hero.targetY = undefined;
      hero.currentThought = `Engaging ${nearbyMonster.name}!`;
      return;
    }
    if (avoidedThreat) {
      const threatDist = Math.hypot(avoidedThreat.x - hero.x, avoidedThreat.y - hero.y);
      const isHuntingMe = avoidedThreat.targetEntityId === hero.id;
      hero.currentThought = `I dare not face that ${avoidedThreat.name}...`;
      // Cowardice means RUNNING away, not standing still while it mauls us
      if (threatDist < 110 || isHuntingMe) {
        hero.state = 'fleeing';
        hero.stateTimer = 3.0;
        hero.targetX = undefined;
        hero.targetY = undefined;
        audioManager.playVoice(`${hero.heroClass}_flee`, hero.x, hero.y);
        return;
      }
      // fall through to treasure/destination logic below
    }

    // 2. Interrupt if a visible treasure chest or gold bag is nearby
    const nearbyTreasure = treasures.find(
      t => Math.hypot(t.x - hero.x, t.y - hero.y) < 120 && this.gridManager.isPixelVisible(t.x, t.y)
    );
    if (nearbyTreasure) {
      hero.state = 'collecting_treasure';
      hero.targetEntityId = nearbyTreasure.id;
      hero.targetX = nearbyTreasure.x;
      hero.targetY = nearbyTreasure.y;
      hero.currentThought = `Spotted a ${nearbyTreasure.type === 'chest' ? 'Treasure Chest' : 'Gold Sack'}!`;
      return;
    }

    // 3. Continue moving towards destination
    if (hero.targetX !== undefined && hero.targetY !== undefined) {
      const dist = Math.hypot(hero.targetX - hero.x, hero.targetY - hero.y);
      if (dist > 8) {
        this.moveTowards(hero, hero.targetX, hero.targetY, delta, buildings, lairs);
      } else {
        // Destination reached! Short pause to stand guard then patrol again
        hero.state = 'idle';
        hero.stateTimer = Math.random() * 0.8 + 0.5;
        hero.targetX = undefined;
        hero.targetY = undefined;
        hero.currentThought = 'Standing guard over the realm';
      }
    } else {
      hero.state = 'idle';
      hero.stateTimer = 0.5;
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

    // B. Critical HP Recovery: Rest at Inn or Guild Hall
    if (hero.hp < hero.maxHp * 0.6) {
      const inn = buildings.find(b => b.type === 'royal_inn' && !b.isConstructing && b.hp > 0);
      if (inn && hero.gold >= 15) {
        hero.state = 'visiting_inn';
        hero.targetEntityId = inn.id;
        hero.targetEntityType = 'building';
        hero.currentThought = 'Resting at the Inn to recover health';
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

    // C. Evaluate Active Bounty Flags (Majesty Bounty System)
    let bestFlag: Flag | null = null;
    let highestAppeal = -999;

    for (const flag of flags) {
      const dist = Math.hypot(flag.x - hero.x, flag.y - hero.y);
      let appeal = 0;

      if (flag.type === 'attack') {
        // Greed + Bravery multiplier
        appeal = (flag.goldReward * (hero.traits.greed / 50)) - (dist * 0.4) + (hero.traits.bravery * 0.5);

        // COURAGE CHECK: Weak heroes refuse suicide bounties unless the purse is truly heroic
        let targetThreat = 0;
        if (flag.targetEntityType === 'monster') {
          const m = monsters.find(mon => mon.id === flag.targetEntityId);
          if (m && m.hp > 0) targetThreat = this.estimateMonsterThreat(m);
        } else if (flag.targetEntityType === 'lair') {
          const l = lairs.find(la => la.id === flag.targetEntityId);
          if (l && l.hp > 0) {
            const def = MONSTER_DEFINITIONS[l.monsterType];
            targetThreat = def.hp / 12 + def.attackPower * 1.6 + (def.isBoss ? 30 : 0);
          }
        }
        const courageFactor = 0.55 + hero.traits.bravery / 250;
        if (targetThreat > this.estimateHeroPower(hero, allHeroes) * courageFactor) {
          const fearPenalty = (targetThreat - this.estimateHeroPower(hero)) * (2.2 - hero.traits.greed / 100);
          appeal -= fearPenalty;
          if (appeal <= 20) hero.currentThought = 'That bounty spells certain doom...';
        }
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
      hero.currentThought = `Answering ${bestFlag.type} bounty flag (${bestFlag.goldReward}g)!`;
      audioManager.playVoice(`${hero.heroClass}_flag`, hero.x, hero.y);
      return;
    }

    // D. Look for nearby monsters (Combat Priority! — but only fights we can win)
    const searchRadius = hero.heroClass === 'warrior' || hero.heroClass === 'dwarf' ? 240 : (hero.heroClass === 'ranger' ? 200 : 160);
    let closestMonster: Monster | null = null;
    let closestDist = searchRadius;
    let dreadedMonster: Monster | null = null;

    for (const m of monsters) {
      if (m.hp <= 0) continue;
      const dist = Math.hypot(m.x - hero.x, m.y - hero.y);
      if (dist < closestDist && this.gridManager.isPixelVisible(m.x, m.y)) {
        if (this.isOverwhelming(hero, m, allHeroes)) {
          dreadedMonster = m;
          continue;
        }
        closestDist = dist;
        closestMonster = m;
      }
    }

    if (closestMonster) {
      hero.state = 'attacking_target';
      hero.targetEntityId = closestMonster.id;
      hero.targetEntityType = 'monster';
      hero.targetX = undefined;
      hero.targetY = undefined;
      hero.currentThought = `Engaging ${closestMonster.name}!`;
      return;
    }
    if (dreadedMonster && !hero.currentThought) {
      hero.currentThought = `That ${dreadedMonster.name} is beyond my strength. I need more training...`;
    }

    // E. Autonomous Enemy Lair Attack (Only if NO monsters are nearby!)
    // Heroes weigh the lair's brood against their own strength; dragon caverns demand a royal bounty.
    if (hero.level >= 2) {
      let closestLair: MonsterLair | null = null;
      let closestLairDist = searchRadius * 0.85;

      for (const l of lairs) {
        if (l.hp <= 0) continue;
        const def = MONSTER_DEFINITIONS[l.monsterType];
        if (l.type === 'dragon_cavern' || def.isBoss) continue; // Never assaulted without a bounty

        const lairThreat = def.hp / 12 + def.attackPower * 1.6;
        const courageFactor = 0.5 + hero.traits.bravery / 220;
        if (lairThreat > this.estimateHeroPower(hero, allHeroes) * courageFactor) continue;

        const lcx = (l.x + l.width / 2) * this.gridManager.tileSize;
        const lcy = (l.y + l.height / 2) * this.gridManager.tileSize;
        const dist = Math.hypot(lcx - hero.x, lcy - hero.y);

        if (dist < closestLairDist && this.gridManager.isPixelExplored(lcx, lcy)) {
          closestLairDist = dist;
          closestLair = l;
        }
      }

      if (closestLair) {
        hero.state = 'attacking_target';
        hero.targetEntityId = closestLair.id;
        hero.targetEntityType = 'lair';
        hero.targetX = undefined;
        hero.targetY = undefined;
        hero.currentThought = `Razing enemy stronghold: ${closestLair.name}!`;
        return;
      }
    }

    // F. Check for visible Treasures & Chests
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

    // G. Equipment & Potion Shopping (Only if building has available researched stock!)
    if (hero.gold >= 25) {
      // 1. Marketplace
      const market = buildings.find(b => b.type === 'marketplace' && !b.isConstructing && b.hp > 0);
      if (market) {
        const canBuyPotion = market.researchedUpgrades.includes('healing_elixirs') && !hero.equipment.hasHealingPotion && hero.gold >= 25;
        const canBuySpeed = market.researchedUpgrades.includes('speed_draughts') && !hero.equipment.hasSpeedPotion && hero.gold >= 60;
        const canBuyAmulet = market.researchedUpgrades.includes('warding_amulets') && !hero.equipment.hasAmulet && hero.gold >= 100;

        if (canBuyPotion || canBuySpeed || canBuyAmulet) {
          hero.state = 'visiting_marketplace';
          hero.targetEntityId = market.id;
          hero.targetEntityType = 'building';
          hero.currentThought = 'Heading to Marketplace to buy supplies';
          return;
        }
      }

      // 2. Blacksmith
      const blacksmith = buildings.find(b => b.type === 'blacksmith' && !b.isConstructing && b.hp > 0);
      if (blacksmith) {
        const maxWepTier = blacksmith.researchedUpgrades.includes('dragonforged') ? 3 : (blacksmith.researchedUpgrades.includes('mithril_forging') ? 2 : (blacksmith.researchedUpgrades.includes('iron_weapons') ? 1 : 0));
        const maxArmorTier = blacksmith.researchedUpgrades.includes('dragonforged') ? 3 : (blacksmith.researchedUpgrades.includes('mithril_forging') ? 2 : (blacksmith.researchedUpgrades.includes('steel_armor') ? 1 : 0));

        const canUpgradeWep = hero.equipment.weaponLevel < maxWepTier && hero.gold >= (hero.equipment.weaponLevel === 0 ? 50 : (hero.equipment.weaponLevel === 1 ? 120 : 250));
        const canUpgradeArmor = hero.equipment.armorLevel < maxArmorTier && hero.gold >= (hero.equipment.armorLevel === 0 ? 50 : (hero.equipment.armorLevel === 1 ? 120 : 250));

        if (canUpgradeWep || canUpgradeArmor) {
          hero.state = 'visiting_blacksmith';
          hero.targetEntityId = blacksmith.id;
          hero.targetEntityType = 'building';
          hero.currentThought = 'Visiting Blacksmith for forged upgrades';
          return;
        }
      }
    }

    // H. Purposeful Autonomous Exploration / Patrol Destination
    hero.state = 'wandering';
    hero.stateTimer = 6.0;

    if (hero.heroClass === 'ranger') {
      // Rangers scout towards the nearest unexplored Fog of War frontier!
      const unexploredSpot = this.gridManager.findNearestUnexploredTile(hero.x, hero.y, 28);
      if (unexploredSpot) {
        hero.targetX = unexploredSpot.x;
        hero.targetY = unexploredSpot.y;
        hero.currentThought = 'Scouting the unexplored wilderness';
      } else {
        const ts = this.gridManager.tileSize;
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 160 + 80;
        const rawX = Math.max(ts * 1.5, Math.min((this.gridManager.width - 2) * ts, hero.x + Math.cos(angle) * dist));
        const rawY = Math.max(ts * 1.5, Math.min((this.gridManager.height - 2) * ts, hero.y + Math.sin(angle) * dist));
        const safe = this.gridManager.findNearestWalkablePosition(rawX, rawY, buildings, lairs);
        hero.targetX = safe.x;
        hero.targetY = safe.y;
        hero.currentThought = 'Patrolling the outer wilderness';
      }
    } else if (hero.heroClass === 'warrior' || hero.heroClass === 'dwarf') {
      // Stalwart Warriors & Dwarves patrol kingdom buildings, gates, and the perimeter
      const ts = this.gridManager.tileSize;
      const distantBuildings = buildings.filter(b => b.hp > 0 && Math.hypot((b.x + b.width / 2) * ts - hero.x, (b.y + b.height / 2) * ts - hero.y) > 40);
      if (distantBuildings.length > 0 && Math.random() < 0.75) {
        const chosen = distantBuildings[Math.floor(Math.random() * distantBuildings.length)];
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.max(chosen.width, chosen.height) * ts * 0.6 + 24;
        const rawX = (chosen.x + chosen.width / 2) * ts + Math.cos(angle) * radius;
        const rawY = (chosen.y + chosen.height / 2) * ts + Math.sin(angle) * radius;
        const safe = this.gridManager.findNearestWalkablePosition(rawX, rawY, buildings, lairs);
        hero.targetX = safe.x;
        hero.targetY = safe.y;
        hero.currentThought = `Marching patrol to ${chosen.name}`;
      } else {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 140 + 60;
        const rawX = Math.max(ts * 2, Math.min((this.gridManager.width - 2) * ts, hero.x + Math.cos(angle) * dist));
        const rawY = Math.max(ts * 2, Math.min((this.gridManager.height - 2) * ts, hero.y + Math.sin(angle) * dist));
        const safe = this.gridManager.findNearestWalkablePosition(rawX, rawY, buildings, lairs);
        hero.targetX = safe.x;
        hero.targetY = safe.y;
        hero.currentThought = 'Patrolling kingdom perimeter';
      }
    } else if (hero.heroClass === 'rogue') {
      const ts = this.gridManager.tileSize;
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 140 + 60;
      const rawX = Math.max(ts * 1.5, Math.min((this.gridManager.width - 2) * ts, hero.x + Math.cos(angle) * dist));
      const rawY = Math.max(ts * 1.5, Math.min((this.gridManager.height - 2) * ts, hero.y + Math.sin(angle) * dist));
      const safe = this.gridManager.findNearestWalkablePosition(rawX, rawY, buildings, lairs);
      hero.targetX = safe.x;
      hero.targetY = safe.y;
      hero.currentThought = 'Prowling for gold & vulnerable prey';
    } else {
      const ts = this.gridManager.tileSize;
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 80 + 30;
      const rawX = Math.max(ts * 1.5, Math.min((this.gridManager.width - 2) * ts, hero.x + Math.cos(angle) * dist));
      const rawY = Math.max(ts * 1.5, Math.min((this.gridManager.height - 2) * ts, hero.y + Math.sin(angle) * dist));
      const safe = this.gridManager.findNearestWalkablePosition(rawX, rawY, buildings, lairs);
      hero.targetX = safe.x;
      hero.targetY = safe.y;
      hero.currentThought = hero.heroClass === 'wizard' ? 'Studying arcane ley lines' : 'Blessing the town commoners';
    }

    if (hero.targetX !== undefined && hero.targetY !== undefined) {
      this.moveTowards(hero, hero.targetX, hero.targetY, delta, buildings, lairs);
    }
  }

  private handleCollectingTreasure(
    hero: Hero,
    delta: number,
    treasures: Treasure[],
    buildings: Building[],
    lairs: MonsterLair[],
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

    const pickupRadius = 26;
    let shouldClaim = dist <= pickupRadius;

    if (!shouldClaim) {
      const reached = this.moveTowards(hero, treasure.x, treasure.y, delta, buildings, lairs, 1.15);
      const newDist = Math.hypot(treasure.x - hero.x, treasure.y - hero.y);
      if (reached || newDist <= pickupRadius + 2) {
        shouldClaim = true;
      }
    }

    if (shouldClaim) {
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
      hero.stateTimer = 0.5;
      hero.targetEntityId = undefined;
      hero.currentThought = `Looted ${treasure.goldAmount} gold!`;
    }
  }

  private handleFleeing(hero: Hero, delta: number, buildings: Building[], lairs: MonsterLair[], monsters: Monster[]) {
    // Run towards nearest friendly guild or palace
    const safeBuilding = buildings.find(b => (b.id === hero.homeGuildId || b.type === 'palace') && b.hp > 0);
    if (safeBuilding) {
      const targetPos = this.gridManager.getNearestExteriorWalkablePosition(hero.x, hero.y, safeBuilding, buildings, lairs, 14);
      const dist = Math.hypot(targetPos.x - hero.x, targetPos.y - hero.y);

      if (dist > 22 && hero.stateTimer > 0) {
        this.moveTowards(hero, targetPos.x, targetPos.y, delta, buildings, lairs, 1.2, safeBuilding.id); // sprint when fleeing
      } else {
        hero.targetX = undefined;
        hero.targetY = undefined;
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
    lairs: MonsterLair[],
    onFloatingText?: (text: string, x: number, y: number, color: string) => void
  ) {
    const building = buildings.find(b => b.id === hero.targetEntityId || b.id === hero.homeGuildId);
    if (!building) {
      hero.state = 'idle';
      return;
    }

    const targetPos = this.gridManager.getNearestExteriorWalkablePosition(hero.x, hero.y, building, buildings, lairs, 14);
    const dist = Math.hypot(targetPos.x - hero.x, targetPos.y - hero.y);

    if (dist > 24) {
      this.moveTowards(hero, targetPos.x, targetPos.y, delta, buildings, lairs, 1.0, building.id);
    } else {
      // Arrived at doorstep/entrance
      hero.targetX = undefined;
      hero.targetY = undefined;

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
    lairs: MonsterLair[],
    onFloatingText?: (text: string, x: number, y: number, color: string) => void
  ) {
    const shop = buildings.find(b => b.id === hero.targetEntityId);
    if (!shop || shop.hp <= 0) {
      hero.state = 'idle';
      hero.stateTimer = 1.0;
      return;
    }

    const targetPos = this.gridManager.getNearestExteriorWalkablePosition(hero.x, hero.y, shop, buildings, lairs, 14);
    const dist = Math.hypot(targetPos.x - hero.x, targetPos.y - hero.y);

    if (dist > 24) {
      this.moveTowards(hero, targetPos.x, targetPos.y, delta, buildings, lairs, 1.0, shop.id);
    } else {
      // Arrived at shop doorstep
      hero.targetX = undefined;
      hero.targetY = undefined;

      // At shop! Perform purchase with hero's gold -> transfers to shop.goldStored
      if (shop.type === 'marketplace') {
        const hasPotions = shop.researchedUpgrades.includes('healing_elixirs');
        const hasSpeed = shop.researchedUpgrades.includes('speed_draughts');
        const hasAmulets = shop.researchedUpgrades.includes('warding_amulets');

        if (hasPotions && hero.gold >= 25 && !hero.equipment.hasHealingPotion) {
          hero.gold -= 25;
          shop.goldStored += 25;
          hero.equipment.hasHealingPotion = true;
          audioManager.playPotionSound(hero.x, hero.y);
          if (onFloatingText) onFloatingText('-25g Healing Potion', hero.x, hero.y - 15, '#38bdf8');
        } else if (hasSpeed && hero.gold >= 60 && !hero.equipment.hasSpeedPotion) {
          hero.gold -= 60;
          shop.goldStored += 60;
          hero.equipment.hasSpeedPotion = true;
          hero.speed = Math.round(hero.speed * 1.2);
          audioManager.playPotionSound(hero.x, hero.y);
          if (onFloatingText) onFloatingText('-60g Speed Draught', hero.x, hero.y - 15, '#fbbf24');
        } else if (hasAmulets && hero.gold >= 100 && !hero.equipment.hasAmulet) {
          hero.gold -= 100;
          shop.goldStored += 100;
          hero.equipment.hasAmulet = true;
          hero.defense += 5;
          audioManager.playCoinSound(hero.x, hero.y);
          if (onFloatingText) onFloatingText('-100g Warding Amulet', hero.x, hero.y - 15, '#c084fc');
        }
      } else if (shop.type === 'blacksmith') {
        // Upgrade weapon or armor based on researched blacksmith tier
        const maxWepTier = shop.researchedUpgrades.includes('dragonforged') ? 3 : (shop.researchedUpgrades.includes('mithril_forging') ? 2 : (shop.researchedUpgrades.includes('iron_weapons') ? 1 : 0));
        const maxArmorTier = shop.researchedUpgrades.includes('dragonforged') ? 3 : (shop.researchedUpgrades.includes('mithril_forging') ? 2 : (shop.researchedUpgrades.includes('steel_armor') ? 1 : 0));

        const nextWepTier = hero.equipment.weaponLevel + 1;
        const wepCost = nextWepTier === 1 ? 50 : (nextWepTier === 2 ? 120 : 250);

        const nextArmorTier = hero.equipment.armorLevel + 1;
        const armorCost = nextArmorTier === 1 ? 50 : (nextArmorTier === 2 ? 120 : 250);

        if (nextWepTier <= maxWepTier && hero.gold >= wepCost) {
          hero.gold -= wepCost;
          shop.goldStored += wepCost;
          hero.equipment.weaponLevel += 1;
          hero.attackPower += 5;
          audioManager.playSwordClash(hero.x, hero.y);
          if (onFloatingText) onFloatingText(`-${wepCost}g Weapon Tier ${hero.equipment.weaponLevel}!`, hero.x, hero.y - 15, '#fbbf24');
        } else if (nextArmorTier <= maxArmorTier && hero.gold >= armorCost) {
          hero.gold -= armorCost;
          shop.goldStored += armorCost;
          hero.equipment.armorLevel += 1;
          hero.defense += 4;
          audioManager.playSwordClash(hero.x, hero.y);
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
      hero.stateTimer = 4.0; // 4s cooldown before next shopping intent
      hero.currentThought = 'Finished shopping and gear preparation';
    }
  }

  private handleClericHealing(
    hero: Hero,
    delta: number,
    allHeroes: Hero[],
    buildings: Building[],
    lairs: MonsterLair[],
    onFloatingText?: (text: string, x: number, y: number, color: string) => void
  ) {
    const ally = allHeroes.find(h => h.id === hero.targetEntityId);
    if (!ally || ally.isDead || ally.hp >= ally.maxHp) {
      hero.state = 'idle';
      return;
    }

    const dist = Math.hypot(ally.x - hero.x, ally.y - hero.y);
    if (dist > 70) {
      this.moveTowards(hero, ally.x, ally.y, delta, buildings, lairs);
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
    lairs: MonsterLair[],
    buildings: Building[]
  ) {
    const flag = flags.find(f => f.id === hero.targetFlagId);
    if (!flag) {
      hero.state = 'idle';
      return;
    }

    // Determine destination target position (exterior perimeter if target is inside a building/lair)
    let targetX = flag.x;
    let targetY = flag.y;
    let targetEntityRadius = 0;

    if (flag.targetEntityType === 'lair') {
      const lair = lairs.find(l => l.id === flag.targetEntityId);
      if (lair) {
        const targetPos = this.gridManager.getNearestExteriorWalkablePosition(hero.x, hero.y, lair, buildings, lairs, 10);
        targetX = targetPos.x;
        targetY = targetPos.y;
        targetEntityRadius = Math.max(lair.width, lair.height) * this.gridManager.tileSize * 0.5;
      }
    } else if (flag.targetEntityType === 'building') {
      const b = buildings.find(build => build.id === flag.targetEntityId);
      if (b) {
        const targetPos = this.gridManager.getNearestExteriorWalkablePosition(hero.x, hero.y, b, buildings, lairs, 10);
        targetX = targetPos.x;
        targetY = targetPos.y;
        targetEntityRadius = Math.max(b.width, b.height) * this.gridManager.tileSize * 0.5;
      }
    }

    // While traveling to flag, engage any monster directly blocking or attacking (unless overwhelming)
    const nearbyMonster = monsters.find(
      m => m.hp > 0 && Math.hypot(m.x - hero.x, m.y - hero.y) < 130 &&
        this.gridManager.isPixelVisible(m.x, m.y) && !this.isOverwhelming(hero, m)
    );
    if (nearbyMonster) {
      hero.state = 'attacking_target';
      hero.targetEntityId = nearbyMonster.id;
      hero.targetEntityType = 'monster';
      hero.currentThought = `Engaging ${nearbyMonster.name}!`;
      return;
    }

    const distToPerimeter = Math.hypot(targetX - hero.x, targetY - hero.y);
    const distToCenter = Math.hypot(flag.x - hero.x, flag.y - hero.y);
    const arrivalThreshold = Math.max(30, targetEntityRadius + 18);

    const hasReached = distToPerimeter <= 24 || distToCenter <= arrivalThreshold;

    if (!hasReached) {
      const speedMult = hero.traits.quirk === 'Gold Hungry' || hero.heroClass === 'rogue' ? 1.2 : 1.0;
      const reached = this.moveTowards(hero, targetX, targetY, delta, buildings, lairs, speedMult);
      if (!reached && Math.hypot(targetX - hero.x, targetY - hero.y) > 24) {
        return;
      }
    }

    // Hero reached the flag / bounty target perimeter!
    if (flag.type === 'attack') {
      const monster = monsters.find(m => m.id === flag.targetEntityId && m.hp > 0);
      const lair = lairs.find(l => l.id === flag.targetEntityId && l.hp > 0);
      if (monster) {
        hero.state = 'attacking_target';
        hero.targetEntityId = monster.id;
        hero.targetEntityType = 'monster';
        hero.currentThought = `Attacking ${monster.name}!`;
      } else if (lair) {
        const guardMonster = monsters.find(
          m => m.hp > 0 && Math.hypot(m.x - flag.x, m.y - flag.y) < 180 && this.gridManager.isPixelVisible(m.x, m.y)
        );
        if (guardMonster) {
          hero.state = 'attacking_target';
          hero.targetEntityId = guardMonster.id;
          hero.targetEntityType = 'monster';
          hero.currentThought = `Engaging ${guardMonster.name}!`;
        } else {
          hero.state = 'attacking_target';
          hero.targetEntityId = lair.id;
          hero.targetEntityType = 'lair';
          hero.currentThought = `Razing ${lair.name}!`;
        }
      } else {
        hero.state = 'idle';
      }
    } else if (flag.type === 'defend') {
      hero.state = 'idle';
      hero.stateTimer = 4.0;
      hero.currentThought = 'Defending royal territory';
    } else {
      hero.state = 'idle';
    }
  }

  private handleAttacking(
    hero: Hero,
    delta: number,
    monsters: Monster[],
    lairs: MonsterLair[],
    buildings: Building[],
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

    // MONSTER THREAT OVERRIDE: If hero is targeting a building/lair and a monster is within combat range, switch to monster!
    if (hero.targetEntityType === 'lair') {
      const threatDist = hero.heroClass === 'warrior' || hero.heroClass === 'dwarf' ? 200 : 160;
      const threateningMonster = monsters.find(
        m => m.hp > 0 && Math.hypot(m.x - hero.x, m.y - hero.y) < threatDist && this.gridManager.isPixelVisible(m.x, m.y)
      );

      if (threateningMonster) {
        hero.targetEntityId = threateningMonster.id;
        hero.targetEntityType = 'monster';
        hero.currentThought = `Defending against ${threateningMonster.name}!`;
      }
    }

    if (hero.targetEntityType === 'monster') {
      const targetMonster = monsters.find(m => m.id === hero.targetEntityId);
      if (targetMonster && targetMonster.hp > 0) {
        targetX = targetMonster.x;
        targetY = targetMonster.y;
        targetAlive = true;
      }
    } else if (hero.targetEntityType === 'lair') {
      const targetLair = lairs.find(l => l.id === hero.targetEntityId);
      if (targetLair && targetLair.hp > 0) {
        // Calculate nearest point on exterior perimeter of the lair (safe distance outside lair boundary)
        const targetPos = this.gridManager.getNearestExteriorWalkablePosition(hero.x, hero.y, targetLair, buildings, lairs, 16);
        targetX = targetPos.x;
        targetY = targetPos.y;
        targetAlive = true;
      }
    }

    if (!targetAlive) {
      hero.state = 'idle';
      hero.targetEntityId = undefined;
      return;
    }

    const dist = Math.hypot(targetX - hero.x, targetY - hero.y);

    if (dist > hero.attackRange + 2) {
      this.moveTowards(hero, targetX, targetY, delta, buildings, lairs, 1.0);
    } else {
      // In attack range! Stop moving and face target
      hero.path = undefined;
      hero.pathTargetKey = undefined;

      const dx = targetX - hero.x;
      const dy = targetY - hero.y;
      if (Math.abs(dx) > Math.abs(dy)) hero.direction = dx > 0 ? 'right' : 'left';
      else hero.direction = dy > 0 ? 'down' : 'up';

      if (hero.currentCooldown <= 0) {
        hero.currentCooldown = hero.attackCooldown;
        hero.isAttackingAnimation = 0.3;

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
            audioManager.playArrowShoot(hero.x, hero.y);
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
            audioManager.playSpellCast(hero.x, hero.y);
          }
        } else if (hero.heroClass === 'cleric') {
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
            audioManager.playSpellCast(hero.x, hero.y);
          }
        } else {
          // Melee strike directly applied
          audioManager.playSwordSwing(hero.x, hero.y);
          if (hero.targetEntityType === 'monster') {
            const m = monsters.find(mon => mon.id === hero.targetEntityId);
            if (m) {
              const actualDamage = Math.max(1, Math.round(totalDamage - m.defense));
              m.hp -= actualDamage;
              audioManager.playSwordClash(m.x, m.y);
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
              const dmg = Math.round(totalDamage);
              l.hp -= dmg;
              audioManager.playSwordClash(targetX, targetY);
              hero.xp += Math.max(2, Math.round(dmg * 0.25));
              if (onFloatingText) onFloatingText(`-${dmg}`, targetX, targetY - 12, '#fbbf24');
            }
          }
        }
      }
    }
  }

  private moveTowards(
    hero: Hero,
    targetX: number,
    targetY: number,
    delta: number,
    buildings: Building[],
    lairs: MonsterLair[],
    speedMultiplier = 1.0,
    targetBuildingId?: string
  ) {
    const reached = this.gridManager.moveEntityAlongPath(
      hero,
      targetX,
      targetY,
      delta,
      buildings,
      lairs,
      targetBuildingId,
      speedMultiplier
    );

    if (reached) {
      hero.targetX = undefined;
      hero.targetY = undefined;
      if (hero.state === 'wandering') {
        hero.state = 'idle';
        hero.stateTimer = 1.2;
      }
    }

    return reached;
  }

  private levelUpHero(hero: Hero) {
    const def = HERO_CLASS_DEFINITIONS[hero.heroClass];
    hero.level += 1;
    hero.xp -= hero.xpToNextLevel;
    hero.xpToNextLevel = Math.round(hero.xpToNextLevel * 1.5);
    hero.maxHp = Math.round(hero.maxHp + def.hpPerLevel);
    hero.hp = hero.maxHp;
    hero.maxMp = Math.round(hero.maxMp + def.mpPerLevel);
    hero.mp = hero.maxMp;
    hero.attackPower = Math.round((hero.attackPower + def.attackPerLevel) * 10) / 10;
    hero.defense = Math.round((hero.defense + def.defensePerLevel) * 10) / 10;
    audioManager.playVoice(`${hero.heroClass}_levelup`, hero.x, hero.y);

    // Upgrade Title
    if (hero.level >= 10) hero.title = `Grand Champion ${hero.name}`;
    else if (hero.level >= 7) hero.title = `Veteran ${hero.name}`;
    else if (hero.level >= 4) hero.title = `Adept ${hero.name}`;
    else hero.title = `${hero.name}`;
  }
}
