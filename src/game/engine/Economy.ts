import { Building, MonsterLair, TaxCollector } from '../types';
import { GridManager } from './Grid';
import { audioManager } from './Audio';

export class EconomyManager {
  private gridManager: GridManager;
  private taxSpawnCooldown: number = 10.0;
  private lastVoiceTime: number = 0;

  constructor(gridManager: GridManager) {
    this.gridManager = gridManager;
  }

  public updateEconomy(
    delta: number,
    buildings: Building[],
    lairs: MonsterLair[],
    taxCollectors: TaxCollector[],
    onTaxDelivery: (amount: number) => void,
    onSpawnTaxCollector: (tc: TaxCollector) => void,
    onFloatingText?: (text: string, x: number, y: number, color: string) => void
  ) {
    const palace = buildings.find(b => b.type === 'palace' && b.hp > 0);
    if (!palace) return;

    const palaceGate = {
      x: (palace.x + palace.width / 2) * this.gridManager.tileSize,
      y: (palace.y + palace.height) * this.gridManager.tileSize + 6
    };

    // 1. Peasant cottages generate modest periodic land rent awaiting tax collection (~21g/min per cottage)
    for (const b of buildings) {
      if (b.isConstructing || b.hp <= 0) continue;
      if (b.type === 'peasant_cottage') {
        b.goldStored += 0.35 * delta;
      }
    }

    // 2. Dispatch Tax Collector periodically when buildings have accumulated significant uncollected taxes (>= 30g)
    this.taxSpawnCooldown -= delta;
    const maxCollectors = (palace.level || 1) === 1 ? 1 : 2;

    if (this.taxSpawnCooldown <= 0 && taxCollectors.length < maxCollectors) {
      let highestBuilding: Building | null = null;
      let maxGold = 30;

      for (const b of buildings) {
        if (b.type === 'palace' || b.isConstructing || b.hp <= 0) continue;
        const alreadyTargeted = taxCollectors.some(tc => tc.targetBuildingId === b.id);
        const threshold = b.type === 'peasant_cottage' ? 25 : 40;
        if (!alreadyTargeted && b.goldStored >= threshold && b.goldStored > maxGold) {
          maxGold = b.goldStored;
          highestBuilding = b;
        }
      }

      if (highestBuilding) {
        this.taxSpawnCooldown = 18.0; // Steady 18s cooldown between tax runs
        const newCollector: TaxCollector = {
          id: `tax_${Date.now()}`,
          name: 'Royal Tax Collector',
          x: palaceGate.x,
          y: palaceGate.y + 4,
          hp: 100,
          maxHp: 100,
          speed: 34,
          goldCarried: 0,
          targetBuildingId: highestBuilding.id,
          state: 'seeking_building',
          direction: 'down'
        };
        onSpawnTaxCollector(newCollector);
      }
    }

    // 3. Update existing Tax Collectors
    const now = Date.now();

    for (let i = taxCollectors.length - 1; i >= 0; i--) {
      const tc = taxCollectors[i];

      if (tc.hp <= 0) {
        // Tax collector slain!
        if (onFloatingText) onFloatingText('Tax Collector Slain!', tc.x, tc.y - 20, '#ef4444');
        audioManager.playVoice('tax_death', tc.x, tc.y);
        taxCollectors.splice(i, 1);
        continue;
      }

      if (tc.state === 'seeking_building') {
        const targetBuilding = buildings.find(b => b.id === tc.targetBuildingId && b.hp > 0);
        if (!targetBuilding) {
          tc.state = 'returning_to_palace';
          continue;
        }

        const ts = this.gridManager.tileSize;
        const bLeft = targetBuilding.x * ts;
        const bRight = (targetBuilding.x + targetBuilding.width) * ts;
        const bTop = targetBuilding.y * ts;
        const bBottom = (targetBuilding.y + targetBuilding.height) * ts;

        const clampX = Math.max(bLeft - 4, Math.min(bRight + 4, tc.x));
        const clampY = Math.max(bTop - 4, Math.min(bBottom + 4, tc.y));

        const dist = Math.hypot(clampX - tc.x, clampY - tc.y);

        if (dist > 18) {
          this.moveTowards(tc, clampX, clampY, delta, buildings, lairs, targetBuilding.id);
        } else {
          // Collect the gold!
          const collected = Math.floor(targetBuilding.goldStored);
          targetBuilding.goldStored -= collected;
          tc.goldCarried += collected;
          tc.state = 'returning_to_palace';

          // Debounce voice lines (only play every 25s)
          if (now - this.lastVoiceTime > 25000) {
            audioManager.playVoice('tax_collect', tc.x, tc.y);
            this.lastVoiceTime = now;
          } else {
            audioManager.playCoinSound(tc.x, tc.y);
          }

          if (onFloatingText) onFloatingText(`+${collected}g Taxes`, tc.x, tc.y - 15, '#fbbf24');
        }
      } else if (tc.state === 'returning_to_palace') {
        const dist = Math.hypot(palaceGate.x - tc.x, palaceGate.y - tc.y);
        if (dist > 16) {
          this.moveTowards(tc, palaceGate.x, palaceGate.y, delta, buildings, lairs, palace.id);
        } else {
          // Safely reached palace front gate! Deposit into Royal Treasury
          if (tc.goldCarried > 0) {
            onTaxDelivery(tc.goldCarried);

            // Debounce delivery voice line
            if (now - this.lastVoiceTime > 25000) {
              audioManager.playVoice('tax_delivered', palaceGate.x, palaceGate.y);
              this.lastVoiceTime = now;
            } else {
              audioManager.playCoinSound(palaceGate.x, palaceGate.y);
            }

            if (onFloatingText) onFloatingText(`+${tc.goldCarried}g Treasury!`, palaceGate.x, palaceGate.y - 25, '#fbbf24');
          }
          // Remove collector after completing duty
          taxCollectors.splice(i, 1);
        }
      }
    }
  }

  private moveTowards(
    tc: TaxCollector,
    targetX: number,
    targetY: number,
    delta: number,
    buildings: Building[],
    lairs: MonsterLair[],
    targetBuildingId?: string
  ) {
    this.gridManager.moveEntityAlongPath(
      tc,
      targetX,
      targetY,
      delta,
      buildings,
      lairs,
      targetBuildingId
    );
  }
}
