import { Flag, FloatingText, Hero, Monster, MonsterLair } from '../types';
import { GridManager } from './Grid';

export class FlagManager {
  private gridManager: GridManager;

  constructor(gridManager: GridManager) {
    this.gridManager = gridManager;
  }

  public updateFlags(
    flags: Flag[],
    heroes: Hero[],
    monsters: Monster[],
    lairs: MonsterLair[],
    floatingTexts: FloatingText[],
    onBountyClaimed?: (flag: Flag, hero: Hero, goldAmount: number) => void
  ) {
    for (let i = flags.length - 1; i >= 0; i--) {
      const flag = flags[i];

      // 1. EXPLORE FLAG CHECK
      if (flag.type === 'explore') {
        const flagTile = this.gridManager.pixelToTile(flag.x, flag.y);
        if (this.gridManager.isValid(flagTile.x, flagTile.y) && this.gridManager.explored[flagTile.y][flagTile.x]) {
          // Find nearest hero who explored it
          let closestHero: Hero | null = null;
          let closestDist = 120;
          for (const h of heroes) {
            if (h.isDead) continue;
            const dist = Math.hypot(h.x - flag.x, h.y - flag.y);
            if (dist < closestDist) {
              closestDist = dist;
              closestHero = h;
            }
          }

          if (closestHero) {
            closestHero.gold += flag.goldReward;
            closestHero.xp += 25;
            if (onBountyClaimed) onBountyClaimed(flag, closestHero, flag.goldReward);
            floatingTexts.push({
              id: `ft_bounty_${Date.now()}`,
              text: `+${flag.goldReward}g Bounty!`,
              x: closestHero.x,
              y: closestHero.y - 20,
              color: '#fbbf24',
              fontSize: 14,
              life: 1.2,
              maxLife: 1.2,
              vy: -25
            });
          }

          flags.splice(i, 1);
          continue;
        }
      }

      // 2. ATTACK FLAG CHECK
      if (flag.type === 'attack') {
        let isTargetDead = false;
        let targetPos = { x: flag.x, y: flag.y };

        if (flag.targetEntityType === 'monster') {
          const monster = monsters.find(m => m.id === flag.targetEntityId);
          if (!monster || monster.hp <= 0) {
            isTargetDead = true;
          } else {
            // Keep flag pinned to moving monster!
            flag.x = monster.x;
            flag.y = monster.y;
            targetPos = { x: monster.x, y: monster.y };
          }
        } else if (flag.targetEntityType === 'lair') {
          const lair = lairs.find(l => l.id === flag.targetEntityId);
          if (!lair || lair.hp <= 0) {
            isTargetDead = true;
          }
        }

        if (isTargetDead) {
          // Find nearby heroes who participated in attack
          const nearbyHeroes = heroes.filter(
            h => !h.isDead && Math.hypot(h.x - targetPos.x, h.y - targetPos.y) < 180
          );

          if (nearbyHeroes.length > 0) {
            const splitGold = Math.floor(flag.goldReward / nearbyHeroes.length);
            for (const h of nearbyHeroes) {
              h.gold += splitGold;
              h.kills += 1;
              h.xp += 25;
              if (onBountyClaimed) onBountyClaimed(flag, h, splitGold);
              floatingTexts.push({
                id: `ft_bounty_split_${Date.now()}_${h.id}`,
                text: `+${splitGold}g Bounty Claimed!`,
                x: h.x,
                y: h.y - 20,
                color: '#fbbf24',
                fontSize: 14,
                life: 1.2,
                maxLife: 1.2,
                vy: -25
              });
            }
          }

          flags.splice(i, 1);
          continue;
        }
      }

      // 3. DEFEND FLAG CHECK
      if (flag.type === 'defend') {
        // If expired or no enemies within 250px for 15s
        const age = (Date.now() - flag.createdAt) / 1000;
        if (age > 45) {
          flags.splice(i, 1);
          continue;
        }
      }
    }
  }
}
