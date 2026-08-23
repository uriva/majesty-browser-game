import { Building, FloatingText, Hero, Monster, MonsterLair, Particle, Peasant, Projectile, TaxCollector } from '../types';
import { GridManager } from './Grid';

export class CombatManager {
  private gridManager: GridManager;

  constructor(gridManager: GridManager) {
    this.gridManager = gridManager;
  }

  public updateProjectiles(
    projectiles: Projectile[],
    delta: number,
    heroes: Hero[],
    monsters: Monster[],
    lairs: MonsterLair[],
    buildings: Building[],
    taxCollectors: TaxCollector[],
    peasants: Peasant[],
    particles: Particle[],
    floatingTexts: FloatingText[],
    onHitSound?: (type: string) => void
  ) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      const dx = p.targetX - p.currentX;
      const dy = p.targetY - p.currentY;
      const dist = Math.hypot(dx, dy);

      const step = p.speed * delta;

      if (dist <= step) {
        // Projectile reached target!
        p.currentX = p.targetX;
        p.currentY = p.targetY;

        // Apply damage & effects
        this.handleProjectileImpact(p, heroes, monsters, lairs, buildings, taxCollectors, peasants, particles, floatingTexts);
        if (onHitSound) onHitSound(p.type);

        projectiles.splice(i, 1);
      } else {
        p.currentX += (dx / dist) * step;
        p.currentY += (dy / dist) * step;

        // Spawn trail particles
        if (p.type === 'fireball' || p.type === 'dragon_breath') {
          particles.push({
            id: `trail_${Date.now()}_${Math.random()}`,
            x: p.currentX + (Math.random() * 6 - 3),
            y: p.currentY + (Math.random() * 6 - 3),
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            color: '#f97316',
            size: Math.random() * 3 + 2,
            alpha: 0.8,
            life: 0.25,
            maxLife: 0.25,
            type: 'flame'
          });
        }
      }
    }
  }

  private handleProjectileImpact(
    p: Projectile,
    heroes: Hero[],
    monsters: Monster[],
    lairs: MonsterLair[],
    buildings: Building[],
    taxCollectors: TaxCollector[],
    peasants: Peasant[],
    particles: Particle[],
    floatingTexts: FloatingText[]
  ) {
    // Impact particles
    const particleCount = p.type === 'fireball' ? 14 : 6;
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = Math.random() * 40 + 20;
      particles.push({
        id: `p_impact_${Date.now()}_${i}`,
        x: p.currentX,
        y: p.currentY,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        color: p.type === 'fireball' ? '#f59e0b' : (p.type === 'holy_bolt' ? '#eab308' : (p.type === 'magic_missile' ? '#a855f7' : '#94a3b8')),
        size: Math.random() * 3 + 2,
        alpha: 1.0,
        life: 0.4,
        maxLife: 0.4,
        type: 'spark'
      });
    }

    if (p.isHeroProjectile) {
      const ownerHero = p.ownerHeroId ? heroes.find(h => h.id === p.ownerHeroId) : null;

      if (p.type === 'fireball') {
        // AOE Damage around impact point
        const aoeRadius = 45;
        for (const m of monsters) {
          const dist = Math.hypot(m.x - p.currentX, m.y - p.currentY);
          if (dist <= aoeRadius) {
            const actualDamage = Math.max(1, p.damage - m.defense);
            m.hp -= actualDamage;
            if (ownerHero) {
              ownerHero.xp += Math.max(3, Math.round(actualDamage * 0.35));
            }
            floatingTexts.push({
              id: `ft_${Date.now()}_${Math.random()}`,
              text: `-${actualDamage}`,
              x: m.x,
              y: m.y - 15,
              color: '#f97316',
              fontSize: 13,
              life: 0.9,
              maxLife: 0.9,
              vy: -25
            });
          }
        }
      } else {
        // Single target
        const targetMonster = monsters.find(m => m.id === p.targetEntityId);
        if (targetMonster) {
          const actualDamage = Math.max(1, p.damage - targetMonster.defense);
          targetMonster.hp -= actualDamage;
          if (ownerHero) {
            ownerHero.xp += Math.max(3, Math.round(actualDamage * 0.4));
          }
          floatingTexts.push({
            id: `ft_${Date.now()}_${Math.random()}`,
            text: `-${actualDamage}`,
            x: targetMonster.x,
            y: targetMonster.y - 12,
            color: p.type === 'holy_bolt' ? '#fde047' : '#ffffff',
            fontSize: 12,
            life: 0.8,
            maxLife: 0.8,
            vy: -25
          });
        } else {
          // Check if target is a lair
          const targetLair = lairs.find(l => l.id === p.targetEntityId);
          if (targetLair) {
            targetLair.hp -= p.damage;
            if (ownerHero) {
              ownerHero.xp += Math.max(2, Math.round(p.damage * 0.25));
            }
            floatingTexts.push({
              id: `ft_${Date.now()}_${Math.random()}`,
              text: `-${p.damage}`,
              x: p.currentX,
              y: p.currentY - 12,
              color: '#fbbf24',
              fontSize: 12,
              life: 0.8,
              maxLife: 0.8,
              vy: -25
            });
          }
        }
      }
    } else {
      // Monster projectile hitting heroes, buildings, tax collectors, or peasants
      if (p.type === 'dragon_breath') {
        // AOE Damage on heroes, peasants, tax collectors, and buildings
        const aoeRadius = 55;
        for (const h of heroes) {
          if (h.isDead) continue;
          const dist = Math.hypot(h.x - p.currentX, h.y - p.currentY);
          if (dist <= aoeRadius) {
            const actualDamage = Math.max(1, p.damage - h.defense);
            h.hp -= actualDamage;
            floatingTexts.push({
              id: `ft_${Date.now()}_${Math.random()}`,
              text: `-${actualDamage}`,
              x: h.x,
              y: h.y - 15,
              color: '#ef4444',
              fontSize: 14,
              life: 1.0,
              maxLife: 1.0,
              vy: -25
            });
          }
        }
        for (const b of buildings) {
          if (b.hp <= 0) continue;
          const bcx = (b.x + b.width / 2) * this.gridManager.tileSize;
          const bcy = (b.y + b.height / 2) * this.gridManager.tileSize;
          if (Math.hypot(bcx - p.currentX, bcy - p.currentY) <= aoeRadius + (b.width * 16)) {
            b.hp -= p.damage;
            floatingTexts.push({
              id: `ft_${Date.now()}_${Math.random()}`,
              text: `-${p.damage}`,
              x: p.currentX,
              y: p.currentY - 12,
              color: '#f97316',
              fontSize: 14,
              life: 0.9,
              maxLife: 0.9,
              vy: -25
            });
          }
        }
      } else {
        // Check if target is a Hero
        const targetHero = heroes.find(h => h.id === p.targetEntityId);
        if (targetHero && !targetHero.isDead) {
          const actualDamage = Math.max(1, p.damage - targetHero.defense);
          targetHero.hp -= actualDamage;
          floatingTexts.push({
            id: `ft_${Date.now()}_${Math.random()}`,
            text: `-${actualDamage}`,
            x: targetHero.x,
            y: targetHero.y - 12,
            color: '#ef4444',
            fontSize: 12,
            life: 0.8,
            maxLife: 0.8,
            vy: -25
          });
        } else {
          // Check if target is a Building (e.g. Goblin Shaman attacking a Peasant Cottage!)
          const targetBuilding = buildings.find(b => b.id === p.targetEntityId);
          if (targetBuilding && targetBuilding.hp > 0) {
            targetBuilding.hp -= p.damage;
            floatingTexts.push({
              id: `ft_${Date.now()}_${Math.random()}`,
              text: `-${p.damage}`,
              x: p.currentX,
              y: p.currentY - 12,
              color: '#f97316',
              fontSize: 13,
              life: 0.9,
              maxLife: 0.9,
              vy: -25
            });
          } else {
            // Check if target is a Tax Collector
            const targetTax = taxCollectors.find(tc => tc.id === p.targetEntityId);
            if (targetTax && targetTax.hp > 0) {
              targetTax.hp -= p.damage;
              floatingTexts.push({
                id: `ft_${Date.now()}_${Math.random()}`,
                text: `-${p.damage}`,
                x: targetTax.x,
                y: targetTax.y - 12,
                color: '#f87171',
                fontSize: 12,
                life: 0.8,
                maxLife: 0.8,
                vy: -25
              });
            } else {
              // Check if target is a Peasant
              const targetPeasant = peasants.find(peasant => peasant.id === p.targetEntityId);
              if (targetPeasant && targetPeasant.hp > 0) {
                targetPeasant.hp -= p.damage;
                floatingTexts.push({
                  id: `ft_${Date.now()}_${Math.random()}`,
                  text: `-${p.damage}`,
                  x: targetPeasant.x,
                  y: targetPeasant.y - 12,
                  color: '#f87171',
                  fontSize: 12,
                  life: 0.8,
                  maxLife: 0.8,
                  vy: -25
                });
              }
            }
          }
        }
      }
    }
  }

  public updateBuildingDefenses(
    buildings: Building[],
    monsters: Monster[],
    delta: number,
    projectiles: Projectile[]
  ) {
    for (const b of buildings) {
      if (b.isConstructing || b.hp <= 0 || !b.isDefense || !b.attackPower || !b.attackRange) continue;

      if (!b.currentAttackCooldown) b.currentAttackCooldown = 0;
      if (b.currentAttackCooldown > 0) {
        b.currentAttackCooldown -= delta;
        continue;
      }

      const bx = (b.x + b.width / 2) * this.gridManager.tileSize;
      const by = (b.y + b.height / 2) * this.gridManager.tileSize;

      // Find closest monster in range
      let closestMonster: Monster | null = null;
      let closestDist = b.attackRange;

      for (const m of monsters) {
        if (m.hp <= 0) continue;
        const dist = Math.hypot(m.x - bx, m.y - by);
        if (dist < closestDist) {
          closestDist = dist;
          closestMonster = m;
        }
      }

      if (closestMonster) {
        b.currentAttackCooldown = b.attackCooldown || 1.2;
        // Shoot arrow projectile from building
        projectiles.push({
          id: `b_proj_${Date.now()}_${Math.random()}`,
          type: 'arrow',
          startX: bx,
          startY: by - 15,
          currentX: bx,
          currentY: by - 15,
          targetX: closestMonster.x,
          targetY: closestMonster.y,
          targetEntityId: closestMonster.id,
          speed: 280,
          damage: b.attackPower,
          isHeroProjectile: true,
          progress: 0
        });
      }
    }
  }

  public updateParticlesAndText(particles: Particle[], floatingTexts: FloatingText[], delta: number) {
    // Update Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= delta;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.alpha = Math.max(0, p.life / p.maxLife);
    }

    // Update Floating Text
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const ft = floatingTexts[i];
      ft.life -= delta;
      if (ft.life <= 0) {
        floatingTexts.splice(i, 1);
        continue;
      }
      ft.y += ft.vy * delta;
    }
  }
}
