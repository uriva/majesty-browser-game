import { Building, TaxCollector } from '../types';
import { GridManager } from './Grid';

export class EconomyManager {
  private gridManager: GridManager;
  private taxSpawnCooldown: number = 0;

  constructor(gridManager: GridManager) {
    this.gridManager = gridManager;
  }

  public updateEconomy(
    delta: number,
    buildings: Building[],
    taxCollectors: TaxCollector[],
    onDepositGold: (amount: number) => void,
    onSpawnTaxCollector: (tc: TaxCollector) => void,
    onFloatingText?: (text: string, x: number, y: number, color: string) => void
  ) {
    const palace = buildings.find(b => b.type === 'palace' && b.hp > 0);
    if (!palace) return;

    const palaceCenter = {
      x: (palace.x + palace.width / 2) * this.gridManager.tileSize,
      y: (palace.y + palace.height / 2) * this.gridManager.tileSize
    };

    // 1. Passive income accumulation for commercial buildings
    for (const b of buildings) {
      if (b.isConstructing || b.hp <= 0) continue;

      if (b.type === 'marketplace') {
        b.goldStored += 3.5 * delta;
      } else if (b.type === 'royal_inn') {
        b.goldStored += 2.0 * delta;
      } else if (b.type === 'blacksmith') {
        b.goldStored += 1.5 * delta;
      }
    }

    // 2. Check if a Tax Collector should be dispatched from Palace
    this.taxSpawnCooldown -= delta;
    if (this.taxSpawnCooldown <= 0 && taxCollectors.length < 2) {
      // Find building with highest stored gold (> 25g)
      let highestBuilding: Building | null = null;
      let maxGold = 25;

      for (const b of buildings) {
        if (b.type === 'palace' || b.isConstructing || b.hp <= 0) continue;
        // Check if another tax collector is already targeting it
        const alreadyTargeted = taxCollectors.some(tc => tc.targetBuildingId === b.id);
        if (!alreadyTargeted && b.goldStored > maxGold) {
          maxGold = b.goldStored;
          highestBuilding = b;
        }
      }

      if (highestBuilding) {
        this.taxSpawnCooldown = 8.0;
        const newCollector: TaxCollector = {
          id: `tax_${Date.now()}`,
          name: 'Royal Tax Collector',
          x: palaceCenter.x,
          y: palaceCenter.y + 20,
          hp: 80,
          maxHp: 80,
          speed: 45,
          goldCarried: 0,
          targetBuildingId: highestBuilding.id,
          state: 'seeking_building',
          direction: 'down'
        };
        onSpawnTaxCollector(newCollector);
      }
    }

    // 3. Update existing Tax Collectors
    for (let i = taxCollectors.length - 1; i >= 0; i--) {
      const tc = taxCollectors[i];

      if (tc.hp <= 0) {
        // Tax collector slain!
        if (onFloatingText) onFloatingText('Tax Collector Slain!', tc.x, tc.y - 20, '#ef4444');
        taxCollectors.splice(i, 1);
        continue;
      }

      if (tc.state === 'seeking_building') {
        const targetBuilding = buildings.find(b => b.id === tc.targetBuildingId && b.hp > 0);
        if (!targetBuilding) {
          tc.state = 'returning_to_palace';
          continue;
        }

        const bx = (targetBuilding.x + targetBuilding.width / 2) * this.gridManager.tileSize;
        const by = (targetBuilding.y + targetBuilding.height / 2) * this.gridManager.tileSize;
        const dist = Math.hypot(bx - tc.x, by - tc.y);

        if (dist > 30) {
          this.moveTowards(tc, bx, by, delta);
        } else {
          // Collect the gold!
          const collected = Math.floor(targetBuilding.goldStored);
          targetBuilding.goldStored -= collected;
          tc.goldCarried += collected;
          tc.state = 'returning_to_palace';
          if (onFloatingText) onFloatingText(`+${collected}g Taxes`, tc.x, tc.y - 15, '#fbbf24');
        }
      } else if (tc.state === 'returning_to_palace') {
        const dist = Math.hypot(palaceCenter.x - tc.x, palaceCenter.y - tc.y);
        if (dist > 30) {
          this.moveTowards(tc, palaceCenter.x, palaceCenter.y, delta);
        } else {
          // Safely reached palace! Deposit into Royal Treasury
          if (tc.goldCarried > 0) {
            onDepositGold(tc.goldCarried);
            if (onFloatingText) onFloatingText(`+${tc.goldCarried}g Treasury!`, palaceCenter.x, palaceCenter.y - 25, '#fbbf24');
          }
          // Remove collector after completing duty
          taxCollectors.splice(i, 1);
        }
      }
    }
  }

  private moveTowards(tc: TaxCollector, targetX: number, targetY: number, delta: number) {
    const dx = targetX - tc.x;
    const dy = targetY - tc.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 4) return;

    const moveDist = tc.speed * delta;
    const vx = (dx / dist) * moveDist;
    const vy = (dy / dist) * moveDist;

    tc.x += vx;
    tc.y += vy;

    if (Math.abs(dx) > Math.abs(dy)) {
      tc.direction = dx > 0 ? 'right' : 'left';
    } else {
      tc.direction = dy > 0 ? 'down' : 'up';
    }
  }
}
