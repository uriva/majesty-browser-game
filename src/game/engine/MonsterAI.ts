import { MONSTER_DEFINITIONS } from '../constants';
import { Building, Hero, Monster, MonsterLair, TaxCollector } from '../types';
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
        // Spawn with radial dispersion around lair
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * 24 + 18;
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
    taxCollectors: TaxCollector[],
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
    onSummonMinion?: (minion: Monster) => void
  ) {
    if (monster.hp <= 0) return;

    if (monster.currentCooldown > 0) {
      monster.currentCooldown -= delta;
    }
    if (monster.isAttackingAnimation > 0) {
      monster.isAttackingAnimation -= delta;
    }
    if (monster.specialCooldown && monster.specialCooldown > 0) {
      monster.specialCooldown -= delta;
    }

    // 1. CROWD SEPARATION: Repulse from other nearby monsters so they NEVER stack!
    for (const other of allMonsters) {
      if (other.id === monster.id || other.hp <= 0) continue;
      const dx = monster.x - other.x;
      const dy = monster.y - other.y;
      const dist = Math.hypot(dx, dy);
      const minSeparation = monster.type === 'giant_rat' ? 16 : 22;

      if (dist < minSeparation && dist > 0.1) {
        const pushForce = ((minSeparation - dist) / minSeparation) * 40 * delta;
        monster.x += (dx / dist) * pushForce;
        monster.y += (dy / dist) * pushForce;
      }
    }

    // 2. BOSS SPECIAL ABILITIES
    if (monster.type === 'necromancer' && (!monster.specialCooldown || monster.specialCooldown <= 0)) {
      monster.specialCooldown = 14;
      if (onSummonMinion) {
        for (let i = 0; i < 2; i++) {
          const skelDef = MONSTER_DEFINITIONS['skeleton'];
          const minion: Monster = {
            id: `skel_summon_${Date.now()}_${i}`,
            name: 'Risen Skeleton',
            type: 'skeleton',
            x: monster.x + (Math.random() * 40 - 20),
            y: monster.y + (Math.random() * 40 - 20),
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
        if (onFloatingText) onFloatingText('Arise, Minions!', monster.x, monster.y - 20, '#c084fc');
      }
    }

    // 3. TARGET SELECTION
    let closestTarget: { x: number; y: number; id: string; type: 'hero' | 'building' | 'tax_collector' } | null = null;
    let closestDist = monster.type === 'giant_rat' ? 140 : 200;

    // A. Check for Tax Collectors (Goblins & Rats love gold bags!)
    for (const tc of taxCollectors) {
      const dist = Math.hypot(tc.x - monster.x, tc.y - monster.y);
      if (dist < closestDist) {
        closestDist = dist;
        closestTarget = { x: tc.x, y: tc.y, id: tc.id, type: 'tax_collector' };
      }
    }

    // B. Check for Heroes
    for (const h of heroes) {
      if (h.isDead) continue;
      const dist = Math.hypot(h.x - monster.x, h.y - monster.y);
      if (dist < closestDist) {
        closestDist = dist;
        closestTarget = { x: h.x, y: h.y, id: h.id, type: 'hero' };
      }
    }

    // C. Check for Buildings / Cottages to raid (Stop at exterior wall, do not walk inside!)
    if (!closestTarget) {
      for (const b of buildings) {
        if (b.hp <= 0) continue;
        const halfW = (b.width * this.gridManager.tileSize) / 2;
        const halfH = (b.height * this.gridManager.tileSize) / 2;
        const centerBx = (b.x + b.width / 2) * this.gridManager.tileSize;
        const centerBy = (b.y + b.height / 2) * this.gridManager.tileSize;

        // Find nearest point on exterior perimeter of building
        const clampX = Math.max(centerBx - halfW, Math.min(centerBx + halfW, monster.x));
        const clampY = Math.max(centerBy - halfH, Math.min(centerBy + halfH, monster.y));
        const dist = Math.hypot(clampX - monster.x, clampY - monster.y);

        const raidRange = b.type === 'peasant_cottage' ? 140 : (b.type === 'palace' ? 100 : 120);
        if (dist < raidRange) {
          closestTarget = { x: clampX, y: clampY, id: b.id, type: 'building' };
          break;
        }
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

      if (dist > monster.attackRange + 4) {
        this.moveTowards(monster, closestTarget.x, closestTarget.y, delta, buildings, 1.0, closestTarget.type === 'building' ? closestTarget.id : undefined);
      } else {
        // Face the target
        const dx = closestTarget.x - monster.x;
        const dy = closestTarget.y - monster.y;
        if (Math.abs(dx) > Math.abs(dy)) monster.direction = dx > 0 ? 'right' : 'left';
        else monster.direction = dy > 0 ? 'down' : 'up';

        // Attack!
        if (monster.currentCooldown <= 0) {
          monster.currentCooldown = monster.attackCooldown;
          monster.isAttackingAnimation = 0.25;

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
            }
          } else {
            // Direct melee strike
            if (closestTarget.type === 'hero') {
              const h = heroes.find(hero => hero.id === closestTarget!.id);
              if (h) {
                const damage = Math.max(1, monster.attackPower - h.defense);
                h.hp -= damage;
                if (onFloatingText) onFloatingText(`-${damage}`, h.x, h.y - 12, '#ef4444');
              }
            } else if (closestTarget.type === 'tax_collector') {
              const tc = taxCollectors.find(collector => collector.id === closestTarget!.id);
              if (tc) {
                tc.hp -= monster.attackPower;
                if (onFloatingText) onFloatingText(`-${monster.attackPower}`, tc.x, tc.y - 12, '#f87171');
              }
            } else if (closestTarget.type === 'building') {
              const b = buildings.find(build => build.id === closestTarget!.id);
              if (b) {
                b.hp -= monster.attackPower;
                if (onFloatingText) onFloatingText(`-${monster.attackPower}`, closestTarget.x, closestTarget.y - 12, '#f97316');
              }
            }
          }
        }
      }
    } else {
      // 5. ACTIVE AUTONOMOUS WANDERING & FORAGING
      monster.state = 'wandering';
      if (!monster.wanderTimer) monster.wanderTimer = 0;
      monster.wanderTimer -= delta;

      if (monster.wanderTimer <= 0 || !monster.targetX || !monster.targetY) {
        monster.wanderTimer = monster.type === 'giant_rat' ? Math.random() * 2 + 1.5 : Math.random() * 4 + 3;

        const palace = buildings.find(b => b.type === 'palace');
        const townX = palace ? (palace.x + palace.width / 2) * this.gridManager.tileSize : monster.x;
        const townY = palace ? (palace.y + palace.height / 2) * this.gridManager.tileSize : monster.y;

        // Angle with bias towards town outskirts
        const angleToTown = Math.atan2(townY - monster.y, townX - monster.x);
        const roamAngle = angleToTown + (Math.random() - 0.5) * 1.8;
        const roamDist = monster.type === 'giant_rat' ? Math.random() * 60 + 30 : Math.random() * 90 + 40;

        monster.targetX = Math.max(32, Math.min((this.gridManager.width - 2) * 32, monster.x + Math.cos(roamAngle) * roamDist));
        monster.targetY = Math.max(32, Math.min((this.gridManager.height - 2) * 32, monster.y + Math.sin(roamAngle) * roamDist));
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
    const dx = targetX - monster.x;
    const dy = targetY - monster.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 4) {
      monster.targetX = undefined;
      monster.targetY = undefined;
      return;
    }

    const moveDist = monster.speed * speedMult * delta;
    const vx = (dx / dist) * moveDist;
    const vy = (dy / dist) * moveDist;

    const nextX = monster.x + vx;
    const nextY = monster.y + vy;

    // Check solid building collision (open buildings like marketplace are walkable)
    if (this.gridManager.isWalkablePosition(nextX, nextY, buildings, [], targetBuildingId)) {
      monster.x = nextX;
      monster.y = nextY;
    } else {
      // Wall sliding around solid buildings
      if (this.gridManager.isWalkablePosition(nextX, monster.y, buildings, [], targetBuildingId)) {
        monster.x = nextX;
      } else if (this.gridManager.isWalkablePosition(monster.x, nextY, buildings, [], targetBuildingId)) {
        monster.y = nextY;
      }
    }

    if (Math.abs(dx) > Math.abs(dy)) {
      monster.direction = dx > 0 ? 'right' : 'left';
    } else {
      monster.direction = dy > 0 ? 'down' : 'up';
    }
  }
}
