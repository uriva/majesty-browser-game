import { MONSTER_DEFINITIONS } from '../constants';
import { Building, Hero, Monster, MonsterLair, Peasant, TaxCollector } from '../types';
import { GridManager } from './Grid';

export class MonsterAIManager {
  private gridManager: GridManager;

  constructor(gridManager: GridManager) {
    this.gridManager = gridManager;
  }

  public updateLair(
    lair: MonsterLair,
    delta: number,
    monsters: Monster[],
    onSpawnMonster: (monster: Monster) => void
  ) {
    if (lair.hp <= 0) return;

    // Count how many living monsters currently belong to this lair
    const currentCount = monsters.filter(m => m.lairId === lair.id).length;
    lair.currentMonsters = currentCount;

    if (currentCount < lair.maxMonsters) {
      lair.spawnTimer -= delta;
      if (lair.spawnTimer <= 0) {
        lair.spawnTimer = lair.spawnInterval;

        const def = MONSTER_DEFINITIONS[lair.monsterType];
        // Spawn with radial dispersion around the perimeter of the lair (outside the structure)
        const angle = Math.random() * Math.PI * 2;
        const lairHalfSize = Math.max(lair.width, lair.height) * (this.gridManager.tileSize / 2);
        const radius = lairHalfSize + 10 + Math.random() * 12;
        const spawnX = (lair.x + lair.width / 2) * this.gridManager.tileSize + Math.cos(angle) * radius;
        const spawnY = (lair.y + lair.height / 2) * this.gridManager.tileSize + Math.sin(angle) * radius;

        const newMonster: Monster = {
          id: `monster_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          name: def.name,
          type: lair.monsterType,
          x: spawnX,
          y: spawnY,
          hp: def.hp,
          maxHp: def.hp,
          attackPower: def.attackPower,
          defense: def.defense,
          speed: def.speed,
          attackRange: def.attackRange,
          attackCooldown: def.attackCooldown,
          currentCooldown: 0,
          xpReward: def.xpReward,
          goldBountyReward: def.goldBountyReward,
          lairId: lair.id,
          state: 'wandering',
          direction: 'down',
          isAttackingAnimation: 0,
          isBoss: def.isBoss,
          isFlying: def.isFlying,
          specialCooldown: 0,
          wanderTimer: 0
        };

        onSpawnMonster(newMonster);
      }
    }
  }

  public updateMonster(
    monster: Monster,
    delta: number,
    allMonsters: Monster[],
    heroes: Hero[],
    buildings: Building[],
    lairs: MonsterLair[],
    taxCollectors: TaxCollector[],
    peasants: Peasant[],
    onSpawnProjectile?: (proj: {
      type: 'arrow' | 'fireball' | 'magic_missile' | 'dragon_breath';
      startX: number;
      startY: number;
      targetX: number;
      targetY: number;
      targetEntityId?: string;
      damage: number;
      isHeroProjectile?: boolean;
    }) => void,
    onFloatingText?: (text: string, x: number, y: number, color: string) => void,
    onSummonMinion?: (minion: Monster) => void,
    dayPhase?: 'day' | 'dusk' | 'night' | 'dawn'
  ) {
    if (monster.hp <= 0) return;

    // WEREWOLF NIGHT FURY: recomputed idempotently each frame from base definition
    if (monster.type === 'werewolf') {
      const base = MONSTER_DEFINITIONS['werewolf'];
      const furyMult = dayPhase === 'night' ? 1.35 : 1.0;
      monster.speed = Math.round(base.speed * furyMult);
      monster.attackPower = Math.round(base.attackPower * furyMult);
      if (dayPhase === 'night' && Math.random() < delta * 0.06 && onFloatingText) {
        onFloatingText('Howwwwl!', monster.x, monster.y - 22, '#fbbf24');
      }
    }

    if (monster.currentCooldown > 0) {
      monster.currentCooldown -= delta;
    }
    if (monster.isAttackingAnimation > 0) {
      monster.isAttackingAnimation -= delta;
    }
    if (monster.specialCooldown && monster.specialCooldown > 0) {
      monster.specialCooldown -= delta;
    }

    // 1. CROWD SEPARATION: Repulse from other nearby monsters so they NEVER stack! (Flying monsters fly free in the air)
    if (!monster.isFlying && monster.type !== 'red_dragon') {
      const minSeparation = monster.type === 'giant_rat' ? 16 : 22;
      const minSepSq = minSeparation * minSeparation;
      for (const other of allMonsters) {
        if (other.id === monster.id || other.hp <= 0 || other.isFlying) continue;
        const dx = monster.x - other.x;
        if (dx > minSeparation || dx < -minSeparation) continue;
        const dy = monster.y - other.y;
        if (dy > minSeparation || dy < -minSeparation) continue;
        const distSq = dx * dx + dy * dy;

        if (distSq < minSepSq && distSq > 0.01) {
          const dist = Math.sqrt(distSq);
          const pushForce = ((minSeparation - dist) / minSeparation) * 40 * delta;
          monster.x += (dx / dist) * pushForce;
          monster.y += (dy / dist) * pushForce;
        }
      }
    }

    // 2. BOSS & SPECIAL MONSTER ABILITIES
    if (monster.type === 'necromancer' && (!monster.specialCooldown || monster.specialCooldown <= 0)) {
      monster.specialCooldown = 12;
      if (onSummonMinion) {
        for (let i = 0; i < 3; i++) {
          const skelDef = MONSTER_DEFINITIONS['skeleton'];
          const minion: Monster = {
            id: `skel_summon_${Date.now()}_${i}`,
            name: 'Risen Skeleton',
            type: 'skeleton',
            x: monster.x + (Math.random() * 50 - 25),
            y: monster.y + (Math.random() * 50 - 25),
            hp: skelDef.hp,
            maxHp: skelDef.hp,
            attackPower: skelDef.attackPower,
            defense: skelDef.defense,
            speed: skelDef.speed,
            attackRange: skelDef.attackRange,
            attackCooldown: skelDef.attackCooldown,
            currentCooldown: 0,
            xpReward: skelDef.xpReward,
            goldBountyReward: skelDef.goldBountyReward,
            state: 'wandering',
            direction: 'down',
            isAttackingAnimation: 0,
            wanderTimer: 0
          };
          onSummonMinion(minion);
        }
        if (onFloatingText) onFloatingText('Rise, Legion of the Damned!', monster.x, monster.y - 20, '#c084fc');
      }
    } else if (monster.type === 'goblin_shaman' && (!monster.specialCooldown || monster.specialCooldown <= 0)) {
      // Shaman Battle Cry (Haste nearby goblins)
      monster.specialCooldown = 10;
      let buffedCount = 0;
      for (const other of allMonsters) {
        if (other.hp > 0 && (other.type === 'goblin_spearman' || other.type === 'goblin_shaman')) {
          if (Math.hypot(other.x - monster.x, other.y - monster.y) < 140) {
            other.speed = Math.min(50, other.speed * 1.25);
            buffedCount++;
          }
        }
      }
      if (buffedCount > 0 && onFloatingText) {
        onFloatingText('Goblin Bloodlust!', monster.x, monster.y - 18, '#a855f7');
      }
    }

    // 3. TARGET SELECTION — WITH COMMITMENT (monsters lock onto prey instead of flip-flopping)
    type MonsterTarget = { x: number; y: number; id: string; type: 'hero' | 'building' | 'tax_collector' | 'peasant' };
    let closestTarget: MonsterTarget | null = null;
    let closestDist = monster.type === 'giant_rat' ? 160 : 240;

    // WAR PARTY OVERRIDE: Raiders march deliberately on their assigned royal building,
    // only stopping to fight heroes that actively engage them en route.
    let raidOverride: MonsterTarget | null = null;
    if (monster.raidTargetId) {
      const raidBuilding = buildings.find(b => b.id === monster.raidTargetId && b.hp > 0 && !(b.isConstructing && b.constructionProgress <= 0));
      if (!raidBuilding) {
        monster.raidTargetId = undefined; // Target razed — resume normal pillaging behavior
      } else {
        const raidPos = this.gridManager.getNearestExteriorWalkablePosition(monster.x, monster.y, raidBuilding, buildings, lairs, 10);
        let interceptor: Hero | null = null;
        for (const h of heroes) {
          if (h.isDead) continue;
          const d = Math.hypot(h.x - monster.x, h.y - monster.y);
          if ((h.targetEntityId === monster.id && d < 130) || d < 42) {
            interceptor = h;
            break;
          }
        }
        if (interceptor) {
          raidOverride = { x: interceptor.x, y: interceptor.y, id: interceptor.id, type: 'hero' };
        } else {
          raidOverride = { x: raidPos.x, y: raidPos.y, id: raidBuilding.id, type: 'building' };
        }
      }
    }

    if (monster.targetHoldTimer === undefined) monster.targetHoldTimer = 0;
    if (monster.isEngaged === undefined) monster.isEngaged = false;
    monster.targetHoldTimer -= delta;

    // STICKY TARGET: Keep chasing the current victim while it stays alive & within the leash radius.
    // Only re-scan when the hold timer expires (~2s), the prey dies, or it escapes the leash.
    let stickyTarget: MonsterTarget | null = null;
    if (monster.targetEntityId && monster.targetEntityType && monster.targetHoldTimer > 0) {
      const leash = closestDist * 1.5;
      const t = monster.targetEntityType;
      if (t === 'hero') {
        const h = heroes.find(x => x.id === monster.targetEntityId);
        if (h && !h.isDead && Math.hypot(h.x - monster.x, h.y - monster.y) < leash) {
          stickyTarget = { x: h.x, y: h.y, id: h.id, type: 'hero' };
        }
      } else if (t === 'peasant') {
        const p = peasants.find(x => x.id === monster.targetEntityId);
        if (p && p.hp > 0 && Math.hypot(p.x - monster.x, p.y - monster.y) < leash) {
          stickyTarget = { x: p.x, y: p.y, id: p.id, type: 'peasant' };
        }
      } else if (t === 'tax_collector') {
        const tc = taxCollectors.find(x => x.id === monster.targetEntityId);
        if (tc && tc.hp > 0 && Math.hypot(tc.x - monster.x, tc.y - monster.y) < leash) {
          stickyTarget = { x: tc.x, y: tc.y, id: tc.id, type: 'tax_collector' };
        }
      } else if (t === 'building') {
        const b = buildings.find(x => x.id === monster.targetEntityId);
        if (b && b.hp > 0 && (!b.isConstructing || b.constructionProgress > 0)) {
          const tp = this.gridManager.getNearestExteriorWalkablePosition(monster.x, monster.y, b, buildings, lairs, 10);
          if (Math.hypot(tp.x - monster.x, tp.y - monster.y) < leash * 1.2) {
            stickyTarget = { x: tp.x, y: tp.y, id: b.id, type: 'building' };
          }
        }
      }
    }

    if (raidOverride) {
      closestTarget = raidOverride;
    } else if (!stickyTarget) {
      monster.isEngaged = false;

    // Check if monster's home lair is under attack by a hero
    const homeLair = lairs.find(l => l.id === monster.lairId);
    if (homeLair && homeLair.hp < homeLair.maxHp) {
      // Find hero nearest to the home lair
      let nearestLairAttacker: Hero | null = null;
      let minAttackerDist = 280;
      for (const h of heroes) {
        if (h.isDead) continue;
        const d = Math.hypot(h.x - (homeLair.x + homeLair.width / 2) * this.gridManager.tileSize, h.y - (homeLair.y + homeLair.height / 2) * this.gridManager.tileSize);
        if (d < minAttackerDist) {
          minAttackerDist = d;
          nearestLairAttacker = h;
        }
      }
      if (nearestLairAttacker) {
        closestTarget = { x: nearestLairAttacker.x, y: nearestLairAttacker.y, id: nearestLairAttacker.id, type: 'hero' };
        closestDist = minAttackerDist;
      }
    }

    // A. PRIORITY: Peasants actively repairing or constructing structures!
    if (!closestTarget) {
      for (const p of peasants) {
        if (p.hp <= 0) continue;
        const isWorking = p.state === 'repairing_building' || p.state === 'hammering_construction' || p.state === 'walking_to_site';
        const dist = Math.hypot(p.x - monster.x, p.y - monster.y);
        const maxDetectDist = isWorking ? closestDist * 1.35 : closestDist * 0.85;
        if (dist < maxDetectDist && dist < closestDist) {
          closestDist = dist;
          closestTarget = { x: p.x, y: p.y, id: p.id, type: 'peasant' };
        }
      }
    }

    // B. Check for Tax Collectors (Goblins & Rats love gold bags!)
    if (!closestTarget) {
      for (const tc of taxCollectors) {
        const dist = Math.hypot(tc.x - monster.x, tc.y - monster.y);
        if (dist < closestDist) {
          closestDist = dist;
          closestTarget = { x: tc.x, y: tc.y, id: tc.id, type: 'tax_collector' };
        }
      }
    }

    // C. Check for Heroes
    if (!closestTarget) {
      for (const h of heroes) {
        if (h.isDead) continue;
        const dist = Math.hypot(h.x - monster.x, h.y - monster.y);
        if (dist < closestDist) {
          closestDist = dist;
          closestTarget = { x: h.x, y: h.y, id: h.id, type: 'hero' };
        }
      }
    }

    // D. Check for other idle peasants
    if (!closestTarget) {
      for (const p of peasants) {
        if (p.hp <= 0) continue;
        const dist = Math.hypot(p.x - monster.x, p.y - monster.y);
        if (dist < closestDist) {
          closestDist = dist;
          closestTarget = { x: p.x, y: p.y, id: p.id, type: 'peasant' };
        }
      }
    }

    // E. Check for Buildings / Cottages to raid (Stop at exterior wall, do not walk inside!)
    if (!closestTarget) {
      for (const b of buildings) {
        if (b.hp <= 0) continue;
        // Blueprints cannot be attacked before construction begins (first builder arrives)
        if (b.isConstructing && b.constructionProgress <= 0) continue;

        // If a peasant is currently repairing/hammering this building, target the peasant instead!
        const repairingPeasant = peasants.find(p => p.hp > 0 && p.targetBuildingId === b.id && (p.state === 'repairing_building' || p.state === 'hammering_construction'));
        if (repairingPeasant) {
          closestTarget = { x: repairingPeasant.x, y: repairingPeasant.y, id: repairingPeasant.id, type: 'peasant' };
          break;
        }

        // Find nearest point on exterior perimeter of building
        const targetPos = this.gridManager.getNearestExteriorWalkablePosition(monster.x, monster.y, b, buildings, lairs, 10);
        const dist = Math.hypot(targetPos.x - monster.x, targetPos.y - monster.y);

        const raidRange = b.type === 'peasant_cottage' ? 180 : (b.type === 'palace' ? 140 : 150);
        if (dist < raidRange) {
          closestTarget = { x: targetPos.x, y: targetPos.y, id: b.id, type: 'building' };
          break;
        }
      }
    }
    } else {
      closestTarget = stickyTarget;
    }

    if (closestTarget) {
      // Fresh acquisition → arm the commitment window
      if (monster.targetEntityId !== closestTarget.id) {
        monster.targetHoldTimer = 2.0;
        monster.isEngaged = false;
      }
    }

    // 4. COMBAT EXECUTION
    if (closestTarget) {
      monster.state = 'attacking';
      monster.targetEntityId = closestTarget.id;
      monster.targetEntityType = closestTarget.type;
      monster.targetX = closestTarget.x;
      monster.targetY = closestTarget.y;

      const dist = Math.hypot(closestTarget.x - monster.x, closestTarget.y - monster.y);

      // ATTACK HYSTERESIS: engage inside attackRange+4, but only re-chase beyond attackRange+16.
      // Prevents start/stop stutter when crowd separation nudges the monster across the boundary.
      const engageRange = monster.attackRange + 4;
      const disengageRange = monster.attackRange + 16;
      if (dist <= engageRange) monster.isEngaged = true;
      else if (dist > disengageRange) monster.isEngaged = false;

      if (!monster.isEngaged) {
        this.moveTowards(monster, closestTarget.x, closestTarget.y, delta, buildings, 1.0, closestTarget.type === 'building' ? closestTarget.id : undefined);
      } else {
        // In attack range! Stop moving and face target
        monster.path = undefined;
        monster.pathTargetKey = undefined;

        const dx = closestTarget.x - monster.x;
        const dy = closestTarget.y - monster.y;
        if (Math.abs(dx) > Math.abs(dy)) monster.direction = dx > 0 ? 'right' : 'left';
        else monster.direction = dy > 0 ? 'down' : 'up';

        // Attack!
        if (monster.currentCooldown <= 0) {
          monster.currentCooldown = monster.attackCooldown;
          monster.isAttackingAnimation = 0.35;

          if (monster.type === 'goblin_shaman' || monster.type === 'necromancer') {
            if (onSpawnProjectile) {
              onSpawnProjectile({
                type: 'magic_missile',
                startX: monster.x,
                startY: monster.y,
                targetX: closestTarget.x,
                targetY: closestTarget.y,
                targetEntityId: closestTarget.id,
                damage: monster.attackPower,
                isHeroProjectile: false
              });
            }
          } else if (monster.type === 'red_dragon') {
            if (onSpawnProjectile) {
              onSpawnProjectile({
                type: 'dragon_breath',
                startX: monster.x,
                startY: monster.y,
                targetX: closestTarget.x,
                targetY: closestTarget.y,
                targetEntityId: closestTarget.id,
                damage: monster.attackPower,
                isHeroProjectile: false
              });

              // Dragon breath splash damage to nearby heroes and structures!
              for (const h of heroes) {
                if (h.isDead || h.id === closestTarget.id) continue;
                if (Math.hypot(h.x - closestTarget.x, h.y - closestTarget.y) < 60) {
                  const splashDmg = Math.max(1, Math.round(monster.attackPower * 0.6 - h.defense));
                  h.hp -= splashDmg;
                  if (onFloatingText) onFloatingText(`-${splashDmg}`, h.x, h.y - 12, '#f97316');
                }
              }
            }
          } else if (monster.type === 'minotaur') {
            // Minotaur Cleaving Smash (hits main target and all heroes in melee arc)
            if (closestTarget.type === 'hero') {
              const h = heroes.find(hero => hero.id === closestTarget!.id);
              if (h) {
                const damage = Math.max(1, Math.round(monster.attackPower - h.defense));
                h.hp -= damage;
                if (onFloatingText) onFloatingText(`-${damage}`, h.x, h.y - 12, '#ef4444');
              }
            } else if (closestTarget.type === 'building') {
              const b = buildings.find(build => build.id === closestTarget!.id);
              if (b && (!b.isConstructing || b.constructionProgress > 0)) {
                const damage = Math.max(1, Math.round(monster.attackPower * 1.25)); // High siege damage
                b.hp -= damage;
                if (onFloatingText) onFloatingText(`-${damage}`, closestTarget.x, closestTarget.y - 12, '#f97316');
              }
            }

            // Minotaur Cleave Splash
            for (const h of heroes) {
              if (h.isDead || h.id === closestTarget.id) continue;
              if (Math.hypot(h.x - monster.x, h.y - monster.y) < 45) {
                const splashDmg = Math.max(1, Math.round(monster.attackPower * 0.5 - h.defense));
                h.hp -= splashDmg;
                if (onFloatingText) onFloatingText(`-${splashDmg}`, h.x, h.y - 12, '#ef4444');
              }
            }
          } else if (monster.type === 'vampire_lord') {
            // VAMPIRE LIFE DRAIN: strikes and feeds, healing himself for most of the damage dealt
            let drainedDamage = 0;
            if (closestTarget.type === 'hero') {
              const h = heroes.find(hero => hero.id === closestTarget!.id);
              if (h) {
                drainedDamage = Math.max(1, Math.round(monster.attackPower - h.defense));
                h.hp -= drainedDamage;
              }
            } else if (closestTarget.type === 'building') {
              const b = buildings.find(build => build.id === closestTarget!.id);
              if (b && (!b.isConstructing || b.constructionProgress > 0)) {
                drainedDamage = Math.max(1, Math.round(monster.attackPower * 1.1));
                b.hp -= drainedDamage;
              }
            } else if (closestTarget.type === 'tax_collector') {
              const tc = taxCollectors.find(collector => collector.id === closestTarget!.id);
              if (tc) {
                drainedDamage = Math.max(1, Math.round(monster.attackPower));
                tc.hp -= drainedDamage;
              }
            } else if (closestTarget.type === 'peasant') {
              const p = peasants.find(peasant => peasant.id === closestTarget!.id);
              if (p && p.hp > 0) {
                drainedDamage = Math.max(1, Math.round(monster.attackPower));
                p.hp -= drainedDamage;
              }
            }
            const healAmount = Math.round(drainedDamage * 0.65);
            if (healAmount > 0 && monster.hp < monster.maxHp) {
              monster.hp = Math.min(monster.maxHp, monster.hp + healAmount);
            }
            if (onFloatingText) {
              onFloatingText(`-${drainedDamage}`, closestTarget.x, closestTarget.y - 12, '#ef4444');
              if (healAmount > 0) onFloatingText(`Life Drain +${healAmount}`, monster.x, monster.y - 24, '#dc2626');
            }
          } else {
            // Direct melee strike
            if (closestTarget.type === 'hero') {
              const h = heroes.find(hero => hero.id === closestTarget!.id);
              if (h) {
                const damage = Math.max(1, Math.round(monster.attackPower - h.defense));
                h.hp -= damage;
                if (onFloatingText) onFloatingText(`-${damage}`, h.x, h.y - 12, '#ef4444');
              }
            } else if (closestTarget.type === 'tax_collector') {
              const tc = taxCollectors.find(collector => collector.id === closestTarget!.id);
              if (tc) {
                const damage = Math.max(1, Math.round(monster.attackPower));
                tc.hp -= damage;
                if (onFloatingText) onFloatingText(`-${damage}`, tc.x, tc.y - 12, '#f87171');
              }
            } else if (closestTarget.type === 'peasant') {
              const p = peasants.find(peasant => peasant.id === closestTarget!.id);
              if (p && p.hp > 0) {
                const damage = Math.max(1, Math.round(monster.attackPower));
                p.hp -= damage;
                if (onFloatingText) onFloatingText(`-${damage}`, closestTarget.x, closestTarget.y - 12, '#f87171');
              }
            } else if (closestTarget.type === 'building') {
              const b = buildings.find(build => build.id === closestTarget!.id);
              if (b && (!b.isConstructing || b.constructionProgress > 0)) {
                const damage = Math.max(1, Math.round(monster.attackPower));
                b.hp -= damage;
                if (onFloatingText) onFloatingText(`-${damage}`, closestTarget.x, closestTarget.y - 12, '#f97316');
              }
            }
          }
        }
      }
    } else {
      // 5. ACTIVE AUTONOMOUS TERRITORIAL WANDERING & FORAGING (Near their lair)
      monster.state = 'wandering';

      // TROLL BLOOD: Bridge Trolls slowly regenerate when left alone
      if (monster.type === 'troll' && monster.hp < monster.maxHp) {
        monster.hp = Math.min(monster.maxHp, monster.hp + 4.5 * delta);
        if (Math.random() < delta * 0.5 && onFloatingText) {
          onFloatingText('+Regen', monster.x, monster.y - 20, '#84cc16');
        }
      }

      if (!monster.wanderTimer) monster.wanderTimer = 0;
      monster.wanderTimer -= delta;

      if (monster.wanderTimer <= 0 || !monster.targetX || !monster.targetY) {
        monster.wanderTimer = monster.type === 'giant_rat' ? Math.random() * 2.5 + 2 : Math.random() * 4 + 3;

        const lair = lairs.find(l => l.id === monster.lairId);
        const ts = this.gridManager.tileSize;
        const originX = lair ? (lair.x + lair.width / 2) * ts : monster.x;
        const originY = lair ? (lair.y + lair.height / 2) * ts : monster.y;

        // Radius based on monster type (rats stay close to sewers, wolves/goblins roam further, dragons roam the skies)
        let maxRadius = 90;
        let minRadius = 22;
        if (monster.type === 'giant_rat') { maxRadius = 75; minRadius = 22; }
        else if (monster.type === 'dire_wolf') { maxRadius = 160; minRadius = 28; }
        else if (monster.type === 'goblin_spearman' || monster.type === 'goblin_shaman') { maxRadius = 140; minRadius = 26; }
        else if (monster.type === 'skeleton' || monster.type === 'zombie') { maxRadius = 110; minRadius = 24; }
        else if (monster.type === 'werewolf') { maxRadius = 240; minRadius = 40; }
        else if (monster.type === 'troll') { maxRadius = 70; minRadius = 18; }
        else if (monster.isFlying || monster.type === 'red_dragon') { maxRadius = 230; minRadius = 55; }

        if (monster.isFlying || monster.type === 'red_dragon') {
          // Flying dragon soars across the kingdom skies freely
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * (maxRadius - minRadius) + minRadius;
          const candidateX = Math.max(ts * 3, Math.min((this.gridManager.width - 3) * ts, originX + Math.cos(angle) * dist));
          const candidateY = Math.max(ts * 3, Math.min((this.gridManager.height - 3) * ts, originY + Math.sin(angle) * dist));
          monster.targetX = candidateX;
          monster.targetY = candidateY;
          monster.wanderTimer = Math.random() * 5 + 4;
        } else {
          // Pick a clear walkable destination outside lair bounds
          let foundSpot = false;
          for (let attempt = 0; attempt < 10; attempt++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * (maxRadius - minRadius) + minRadius;
            const candidateX = Math.max(ts, Math.min((this.gridManager.width - 2) * ts, originX + Math.cos(angle) * dist));
            const candidateY = Math.max(ts, Math.min((this.gridManager.height - 2) * ts, originY + Math.sin(angle) * dist));

            if (this.gridManager.isWalkablePosition(candidateX, candidateY, buildings, lairs)) {
              monster.targetX = candidateX;
              monster.targetY = candidateY;
              foundSpot = true;
              break;
            }
          }

          if (!foundSpot) {
            const fallbackAngle = Math.random() * Math.PI * 2;
            const fallbackDist = monster.type === 'giant_rat' ? 26 : 34;
            monster.targetX = originX + Math.cos(fallbackAngle) * fallbackDist;
            monster.targetY = originY + Math.sin(fallbackAngle) * fallbackDist;
          }
        }
      }

      if (monster.targetX !== undefined && monster.targetY !== undefined) {
        this.moveTowards(monster, monster.targetX, monster.targetY, delta, buildings, 0.65);
      }
    }
  }

  private moveTowards(
    monster: Monster,
    targetX: number,
    targetY: number,
    delta: number,
    buildings: Building[],
    speedMult = 1.0,
    targetBuildingId?: string
  ) {
    if (monster.isFlying || monster.type === 'red_dragon') {
      const dx = targetX - monster.x;
      const dy = targetY - monster.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 8) {
        monster.targetX = undefined;
        monster.targetY = undefined;
        monster.path = undefined;
        monster.pathTargetKey = undefined;
        if (monster.state === 'wandering') {
          monster.wanderTimer = 0;
        }
        return true;
      }

      // Flying monsters soar straight over all terrain and obstacles without pathfinding or collision slowdown
      const moveDist = Math.min(dist, monster.speed * speedMult * delta);
      monster.x += (dx / dist) * moveDist;
      monster.y += (dy / dist) * moveDist;

      if (Math.abs(dx) > Math.abs(dy)) {
        monster.direction = dx > 0 ? 'right' : 'left';
      } else {
        monster.direction = dy > 0 ? 'down' : 'up';
      }

      const reached = Math.hypot(targetX - monster.x, targetY - monster.y) < 8;
      if (reached) {
        monster.targetX = undefined;
        monster.targetY = undefined;
        if (monster.state === 'wandering') {
          monster.wanderTimer = 0;
        }
      }
      return reached;
    }

    const reached = this.gridManager.moveEntityAlongPath(
      monster,
      targetX,
      targetY,
      delta,
      buildings,
      [],
      targetBuildingId,
      speedMult
    );

    if (reached) {
      monster.targetX = undefined;
      monster.targetY = undefined;
      if (monster.state === 'wandering') {
        monster.wanderTimer = 0;
      }
    }
  }
}
