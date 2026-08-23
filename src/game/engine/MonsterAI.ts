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
        // Spawn a monster at the lair entrance
        const def = MONSTER_DEFINITIONS[lair.monsterType];
        const spawnX = (lair.x + lair.width / 2) * this.gridManager.tileSize + (Math.random() * 20 - 10);
        const spawnY = (lair.y + lair.height) * this.gridManager.tileSize + 10;

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
          specialCooldown: 0
        };

        onSpawnMonster(newMonster);
      }
    }
  }

  public updateMonster(
    monster: Monster,
    delta: number,
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

    // Boss special mechanics
    if (monster.type === 'necromancer' && (!monster.specialCooldown || monster.specialCooldown <= 0)) {
      monster.specialCooldown = 14;
      // Summon 2 skeleton minions
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
            isAttackingAnimation: 0
          };
          onSummonMinion(minion);
        }
        if (onFloatingText) onFloatingText('Arise, Minions!', monster.x, monster.y - 20, '#c084fc');
      }
    }

    // Target Selection:
    // 1. Look for nearby Tax Collector (Goblins & Rats love gold bags!)
    let closestTarget: { x: number; y: number; id: string; type: 'hero' | 'building' | 'tax_collector' } | null = null;
    let closestDist = 180;

    for (const tc of taxCollectors) {
      const dist = Math.hypot(tc.x - monster.x, tc.y - monster.y);
      if (dist < closestDist) {
        closestDist = dist;
        closestTarget = { x: tc.x, y: tc.y, id: tc.id, type: 'tax_collector' };
      }
    }

    // 2. Look for nearby Hero
    for (const h of heroes) {
      if (h.isDead) continue;
      const dist = Math.hypot(h.x - monster.x, h.y - monster.y);
      if (dist < closestDist) {
        closestDist = dist;
        closestTarget = { x: h.x, y: h.y, id: h.id, type: 'hero' };
      }
    }

    // 3. Look for nearby Building to raid (e.g. Palace, Market, Guard Tower)
    if (!closestTarget) {
      for (const b of buildings) {
        if (b.hp <= 0) continue;
        const bx = (b.x + b.width / 2) * this.gridManager.tileSize;
        const by = (b.y + b.height / 2) * this.gridManager.tileSize;
        const dist = Math.hypot(bx - monster.x, by - monster.y);
        if (dist < 140) {
          closestTarget = { x: bx, y: by, id: b.id, type: 'building' };
          break;
        }
      }
    }

    if (closestTarget) {
      monster.state = 'attacking';
      monster.targetEntityId = closestTarget.id;
      monster.targetEntityType = closestTarget.type;

      const dist = Math.hypot(closestTarget.x - monster.x, closestTarget.y - monster.y);

      if (dist > monster.attackRange) {
        this.moveTowards(monster, closestTarget.x, closestTarget.y, delta);
      } else {
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
      // Monster wandering slowly towards town or near lair
      if (Math.random() < 0.02) {
        const palace = buildings.find(b => b.type === 'palace');
        const townX = palace ? (palace.x + palace.width / 2) * this.gridManager.tileSize : monster.x;
        const townY = palace ? (palace.y + palace.height / 2) * this.gridManager.tileSize : monster.y;

        // Roam with bias toward town
        const angle = Math.atan2(townY - monster.y, townX - monster.x) + (Math.random() - 0.5) * 1.5;
        const dist = 50;
        const tx = monster.x + Math.cos(angle) * dist;
        const ty = monster.y + Math.sin(angle) * dist;
        this.moveTowards(monster, tx, ty, delta * 0.4);
      }
    }
  }

  private moveTowards(monster: Monster, targetX: number, targetY: number, delta: number) {
    const dx = targetX - monster.x;
    const dy = targetY - monster.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 4) return;

    const moveDist = monster.speed * delta;
    const vx = (dx / dist) * moveDist;
    const vy = (dy / dist) * moveDist;

    const nextX = monster.x + vx;
    const nextY = monster.y + vy;

    const tile = this.gridManager.pixelToTile(nextX, nextY);
    if (this.gridManager.isWalkable(tile.x, tile.y)) {
      monster.x = nextX;
      monster.y = nextY;
    }

    if (Math.abs(dx) > Math.abs(dy)) {
      monster.direction = dx > 0 ? 'right' : 'left';
    } else {
      monster.direction = dy > 0 ? 'down' : 'up';
    }
  }
}
