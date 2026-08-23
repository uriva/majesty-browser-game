import { BUILDING_DEFINITIONS, HERO_CLASS_DEFINITIONS, MONSTER_DEFINITIONS } from '../constants';
import { Building, Corpse, Flag, FloatingText, GameState, Hero, Monster, MonsterLair, Particle, Projectile, TaxCollector, Treasure } from '../types';
import { GridManager } from './Grid';

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private gridManager: GridManager;

  constructor(canvas: HTMLCanvasElement, gridManager: GridManager) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;
    this.gridManager = gridManager;
  }

  public render(state: GameState, mousePos: { x: number; y: number } | null) {
    const { ctx, canvas } = this;
    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    // Apply Camera Transform
    ctx.translate(width / 2, height / 2);
    ctx.scale(state.camera.zoom, state.camera.zoom);
    ctx.translate(-state.camera.x, -state.camera.y);

    // 1. Render Terrain Grid
    this.renderTerrain(state);

    // 2. Render Roads & Ground Details
    this.renderGroundDecorations(state);

    // 3. Render Monster Lairs
    for (const lair of state.lairs) {
      this.renderLair(lair, state);
    }

    // 4. Render Buildings (including Peasant Cottages)
    for (const building of state.buildings) {
      this.renderBuilding(building, state);
    }

    // 4.5. Render Corpses & Building Ruins
    for (const corpse of state.corpses) {
      this.renderCorpse(corpse, state);
    }

    // 5. Render Treasures & Chests
    for (const treasure of state.treasures) {
      this.renderTreasure(treasure, state);
    }

    // 6. Render Flags
    for (const flag of state.flags) {
      this.renderFlag(flag, state);
    }

    // 7. Render Tax Collectors
    for (const tc of state.taxCollectors) {
      this.renderTaxCollector(tc, state);
    }

    // 8. Render Monsters (Sorted by Y for depth layering)
    const sortedMonsters = [...state.monsters].sort((a, b) => a.y - b.y);
    for (const monster of sortedMonsters) {
      this.renderMonster(monster, state);
    }

    // 9. Render Heroes (Sorted by Y for depth layering)
    const sortedHeroes = [...state.heroes].sort((a, b) => a.y - b.y);
    for (const hero of sortedHeroes) {
      this.renderHero(hero, state);
    }

    // 10. Render Projectiles
    for (const proj of state.projectiles) {
      this.renderProjectile(proj);
    }

    // 11. Render Particles
    for (const p of state.particles) {
      this.renderParticle(p);
    }

    // 12. Render Fog of War Overlay
    this.renderFogOfWar(state);

    // 13. Render Day/Night Atmosphere Lighting
    this.renderDayNightLighting(state);

    // 14. Render Active Placement Preview (Ghost building / flag)
    if (state.activePlacement && mousePos) {
      this.renderPlacementPreview(state, mousePos);
    }

    // 15. Render Floating Combat Text (rendered in world coordinates)
    for (const ft of state.floatingTexts) {
      this.renderFloatingText(ft);
    }

    ctx.restore();
  }

  private renderTerrain(state: GameState) {
    const { ctx } = this;
    const ts = this.gridManager.tileSize;

    for (let y = 0; y < this.gridManager.height; y++) {
      for (let x = 0; x < this.gridManager.width; x++) {
        if (!this.gridManager.explored[y][x]) continue;

        const tileType = this.gridManager.grid[y][x];
        const px = x * ts;
        const py = y * ts;

        if (tileType === 0) {
          // Lush painterly fantasy meadow with organic multi-tonal grass patches
          const hash = ((x * 197 + y * 311) % 100);
          let grassColor = '#2d6a4f';
          if (hash < 25) grassColor = '#22533a';
          else if (hash < 55) grassColor = '#2d6a4f';
          else if (hash < 80) grassColor = '#387a55';
          else grassColor = '#40916c';

          ctx.fillStyle = grassColor;
          ctx.fillRect(px, py, ts, ts);

          // Fine grass blade texture & clover clumps
          if (hash % 3 === 0) {
            ctx.fillStyle = '#52b788';
            ctx.fillRect(px + 4 + (hash % 6), py + 5 + (hash % 7), 1.5, 3.5);
            ctx.fillRect(px + 16 + (hash % 8), py + 14 + (hash % 9), 1.5, 3.5);
          }

          // Scattered Wildflower Blooms in open meadows
          if (hash > 72 && (x * 7 + y * 13) % 5 === 0) {
            const fType = (x + y) % 4;
            if (fType === 0) {
              // Buttercup
              ctx.fillStyle = '#facc15';
              ctx.beginPath(); ctx.arc(px + 10, py + 12, 2.2, 0, Math.PI * 2); ctx.fill();
            } else if (fType === 1) {
              // Scarlet Poppy
              ctx.fillStyle = '#ef4444';
              ctx.beginPath(); ctx.arc(px + 20, py + 18, 2.5, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = '#1c1917';
              ctx.fillRect(px + 19.5, py + 17.5, 1, 1);
            } else if (fType === 2) {
              // Azure Bluebell
              ctx.fillStyle = '#38bdf8';
              ctx.beginPath(); ctx.arc(px + 14, py + 22, 2.0, 0, Math.PI * 2); ctx.fill();
            } else {
              // White Daisy
              ctx.fillStyle = '#ffffff';
              ctx.beginPath(); ctx.arc(px + 18, py + 8, 2.2, 0, Math.PI * 2); ctx.fill();
              ctx.fillStyle = '#facc15';
              ctx.beginPath(); ctx.arc(px + 18, py + 8, 1.0, 0, Math.PI * 2); ctx.fill();
            }
          }
        } else if (tileType === 1) {
          // Cobblestone / Dirt Road
          ctx.fillStyle = '#78716c';
          ctx.fillRect(px, py, ts, ts);
          ctx.fillStyle = '#57534e';
          ctx.fillRect(px + 2, py + 2, ts - 4, ts - 4);
          ctx.fillStyle = '#a8a29e';
          ctx.fillRect(px + 4, py + 4, 8, 8);
          ctx.fillRect(px + 16, py + 16, 8, 8);
        } else if (tileType === 2) {
          // Shimmering Water
          const time = Date.now() * 0.002;
          const wave = Math.sin(time + x + y) * 10;
          ctx.fillStyle = '#0284c7';
          ctx.fillRect(px, py, ts, ts);
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(px + 4, py + 8 + wave * 0.2, ts - 8, 3);
        } else if (tileType === 5) {
          // Stone Bridge over Water
          ctx.fillStyle = '#0284c7';
          ctx.fillRect(px, py, ts, ts);
          ctx.fillStyle = '#64748b';
          ctx.fillRect(px, py + 2, ts, ts - 4);
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(px + 2, py + 4, ts - 4, ts - 8);
          // Railings
          ctx.fillStyle = '#334155';
          ctx.fillRect(px, py + 1, ts, 2);
          ctx.fillRect(px, py + ts - 3, ts, 2);
        } else if (tileType === 3) {
          // Forest base
          ctx.fillStyle = '#1b4332';
          ctx.fillRect(px, py, ts, ts);
        } else if (tileType === 4) {
          // Mountain base
          ctx.fillStyle = '#475569';
          ctx.fillRect(px, py, ts, ts);
        }
      }
    }
  }

  private renderGroundDecorations(state: GameState) {
    const { ctx } = this;
    const ts = this.gridManager.tileSize;
    const time = Date.now() * 0.002;

    for (let y = 0; y < this.gridManager.height; y++) {
      for (let x = 0; x < this.gridManager.width; x++) {
        if (!this.gridManager.explored[y][x]) continue;

        const tileType = this.gridManager.grid[y][x];
        const px = x * ts;
        const py = y * ts;

        if (tileType === 3) {
          // Pine tree with wind sway
          const sway = Math.sin(time + x * 0.5 + y * 0.5) * 2;
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.beginPath();
          ctx.ellipse(px + 16, py + 26, 12, 5, 0, 0, Math.PI * 2);
          ctx.fill();

          // Trunk
          ctx.fillStyle = '#78350f';
          ctx.fillRect(px + 14, py + 18, 4, 10);

          // Canopy
          ctx.fillStyle = '#064e3b';
          ctx.beginPath();
          ctx.moveTo(px + 16 + sway, py - 6);
          ctx.lineTo(px + 3, py + 20);
          ctx.lineTo(px + 29, py + 20);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#047857';
          ctx.beginPath();
          ctx.moveTo(px + 16 + sway * 0.7, py - 3);
          ctx.lineTo(px + 7, py + 13);
          ctx.lineTo(px + 25, py + 13);
          ctx.closePath();
          ctx.fill();
        } else if (tileType === 4) {
          // Mountain Crag
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.beginPath();
          ctx.ellipse(px + 16, py + 24, 13, 6, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#334155';
          ctx.beginPath();
          ctx.moveTo(px + 4, py + 24);
          ctx.lineTo(px + 16, py + 2);
          ctx.lineTo(px + 28, py + 24);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#64748b';
          ctx.beginPath();
          ctx.moveTo(px + 16, py + 2);
          ctx.lineTo(px + 28, py + 24);
          ctx.lineTo(px + 16, py + 24);
          ctx.closePath();
          ctx.fill();
        }
      }
    }
  }

  private renderBuilding(b: Building, state: GameState) {
    const { ctx } = this;
    const ts = this.gridManager.tileSize;
    const px = b.x * ts;
    const py = b.y * ts;
    const w = b.width * ts;
    const h = b.height * ts;

    if (!this.gridManager.explored[Math.floor(b.y)][Math.floor(b.x)]) return;

    const isSelected = state.selectedEntity?.type === 'building' && state.selectedEntity.id === b.id;

    if (isSelected) {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3;
      ctx.strokeRect(px - 4, py - 4, w + 8, h + 8);
    }

    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(px + 6, py + 6, w, h);

    if (b.isConstructing) {
      if (b.constructionProgress <= 0) {
        // Blueprint Schematic (Before Builder Arrives)
        ctx.fillStyle = 'rgba(2, 132, 199, 0.45)';
        ctx.fillRect(px, py, w, h);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(px + 2, py + 2, w - 4, h - 4);
        ctx.setLineDash([]);

        ctx.fillStyle = '#f0f9ff';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('📐 BLUEPRINT', px + w / 2, py + h / 2 - 5);
        ctx.font = '9px sans-serif';
        ctx.fillStyle = '#7dd3fc';
        ctx.fillText('Awaiting Builder', px + w / 2, py + h / 2 + 7);
        return;
      }

      // Scaffolding & Active Construction
      ctx.fillStyle = '#78350f';
      ctx.fillRect(px, py, w, h);
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 2, py + 2, w - 4, h - 4);
      // Progress bar
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(px + 4, py + h / 2 - 6, w - 8, 12);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(px + 4, py + h / 2 - 6, (w - 8) * (b.constructionProgress / 100), 12);
      return;
    }

    switch (b.type) {
      case 'palace':
        this.drawPalaceSprite(px, py, w, h, b.level);
        break;
      case 'warrior_guild':
        this.drawWarriorGuildSprite(px, py, w, h);
        break;
      case 'ranger_guild':
        this.drawRangerGuildSprite(px, py, w, h);
        break;
      case 'rogue_guild':
        this.drawRogueGuildSprite(px, py, w, h);
        break;
      case 'wizard_tower':
        this.drawWizardTowerSprite(px, py, w, h);
        break;
      case 'cleric_temple':
        this.drawClericTempleSprite(px, py, w, h);
        break;
      case 'dwarf_settlement':
        this.drawDwarfSettlementSprite(px, py, w, h);
        break;
      case 'marketplace':
        this.drawMarketplaceSprite(px, py, w, h);
        break;
      case 'blacksmith':
        this.drawBlacksmithSprite(px, py, w, h);
        break;
      case 'guard_tower':
        this.drawGuardTowerSprite(px, py, w, h);
        break;
      case 'royal_inn':
        this.drawInnSprite(px, py, w, h);
        break;
      case 'statue_king':
        this.drawStatueSprite(px, py, w, h);
        break;
      case 'peasant_cottage':
        this.drawPeasantCottageSprite(px, py, w, h, b.id);
        break;
      default:
        ctx.fillStyle = '#475569';
        ctx.fillRect(px, py, w, h);
        break;
    }

    // Health bar if damaged
    if (b.hp < b.maxHp) {
      const barW = w;
      const barH = 6;
      const hpPercent = Math.max(0, b.hp / b.maxHp);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(px, py - 10, barW, barH);
      ctx.fillStyle = hpPercent > 0.5 ? '#22c55e' : (hpPercent > 0.25 ? '#eab308' : '#ef4444');
      ctx.fillRect(px, py - 10, barW * hpPercent, barH);
    }

    // Training progress bar if training heroes
    if (b.trainingQueue && b.trainingQueue.length > 0) {
      const current = b.trainingQueue[0];
      const barW = w;
      const barH = 5;
      const progress = Math.max(0, Math.min(1, current.progress / 100));
      const barY = b.hp < b.maxHp ? py - 18 : py - 10;

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(px, barY, barW, barH);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(px, barY, barW * progress, barH);
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1;
      ctx.strokeRect(px, barY, barW, barH);

      if (b.trainingQueue.length > 1) {
        ctx.fillStyle = '#0284c7';
        ctx.beginPath();
        ctx.arc(px + w - 4, barY - 4, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`+${b.trainingQueue.length - 1}`, px + w - 4, barY - 1);
      }
    }

    // Gold ready indicator (for marketplace/blacksmith/inn with > 20g)
    if (b.goldStored >= 20) {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(px + w - 8, py + 8, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#78350f';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', px + w - 8, py + 11);
    }
  }

  private drawPalaceSprite(px: number, py: number, w: number, h: number, level: number) {
    const { ctx } = this;
    ctx.fillStyle = '#475569';
    ctx.fillRect(px + 8, py + 16, w - 16, h - 20);
    // Battlements
    ctx.fillStyle = '#64748b';
    for (let i = px + 8; i < px + w - 16; i += 16) {
      ctx.fillRect(i, py + 10, 10, 8);
    }
    // Main Roof
    ctx.fillStyle = '#991b1b';
    ctx.beginPath();
    ctx.moveTo(px + w / 2, py - 8);
    ctx.lineTo(px + 10, py + 16);
    ctx.lineTo(px + w - 10, py + 16);
    ctx.closePath();
    ctx.fill();

    // Spire & Crown
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(px + w / 2 - 2, py - 18, 4, 12);
    ctx.beginPath();
    ctx.arc(px + w / 2, py - 20, 5, 0, Math.PI * 2);
    ctx.fill();

    // Golden Royal Door
    ctx.fillStyle = '#b45309';
    ctx.fillRect(px + w / 2 - 12, py + h - 24, 24, 20);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(px + w / 2 - 2, py + h - 24, 4, 20);

    // Palace Level Badge
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(px + 12, py + 22, 22, 14);
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`Lv.${level}`, px + 23, py + 33);
  }

  private drawWarriorGuildSprite(px: number, py: number, w: number, h: number) {
    const { ctx } = this;
    // Heavy Stone Base
    ctx.fillStyle = '#475569';
    ctx.fillRect(px + 4, py + 16, w - 8, h - 20);
    // Buttresses
    ctx.fillStyle = '#334155';
    ctx.fillRect(px + 2, py + 18, 5, h - 22);
    ctx.fillRect(px + w - 7, py + 18, 5, h - 22);
    // Tudor timber second floor
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(px + 6, py + 8, w - 12, 10);
    ctx.fillStyle = '#451a03';
    ctx.fillRect(px + 6, py + 17, w - 12, 2); // Corbel beam
    // Slate Gable Roof
    ctx.fillStyle = '#1e3a8a';
    ctx.beginPath();
    ctx.moveTo(px + w / 2, py - 4);
    ctx.lineTo(px + 2, py + 10);
    ctx.lineTo(px + w - 2, py + 10);
    ctx.closePath();
    ctx.fill();
    // Shield Crest with gold swords
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.arc(px + w / 2, py + 26, 8, 0, Math.PI);
    ctx.lineTo(px + w / 2 - 8, py + 19);
    ctx.lineTo(px + w / 2 + 8, py + 19);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(px + w / 2 - 1, py + 20, 2, 8);
  }

  private drawRangerGuildSprite(px: number, py: number, w: number, h: number) {
    const { ctx } = this;
    // Forest Lodge Timber Log Base
    ctx.fillStyle = '#451a03';
    ctx.fillRect(px + 4, py + 14, w - 8, h - 18);
    // Thatch / Cedar Shingle Roof
    ctx.fillStyle = '#065f46';
    ctx.beginPath();
    ctx.moveTo(px + w * 0.4, py - 2);
    ctx.lineTo(px + 2, py + 15);
    ctx.lineTo(px + w * 0.75, py + 15);
    ctx.closePath();
    ctx.fill();
    // Watchtower Lookout on right
    ctx.fillStyle = '#271306';
    ctx.fillRect(px + w - 14, py + 4, 10, h - 8);
    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.moveTo(px + w - 9, py - 6);
    ctx.lineTo(px + w - 16, py + 4);
    ctx.lineTo(px + w - 2, py + 4);
    ctx.closePath();
    ctx.fill();
    // Target board with bullseye
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(px + 14, py + 30, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(px + 14, py + 30, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawRogueGuildSprite(px: number, py: number, w: number, h: number) {
    const { ctx } = this;
    // Dark Shadowy Hideout
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(px + 5, py + 14, w - 10, h - 18);
    // Upper Story with Tudor beams
    ctx.fillStyle = '#d4d4d8';
    ctx.fillRect(px + 7, py + 6, w - 14, 10);
    // Jagged Dark Slate Roof
    ctx.fillStyle = '#27272a';
    ctx.beginPath();
    ctx.moveTo(px + w * 0.45, py - 6);
    ctx.lineTo(px + 2, py + 8);
    ctx.lineTo(px + w - 2, py + 8);
    ctx.closePath();
    ctx.fill();
    // Warm Amber Hanging Lantern
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(px + w - 8, py + 18, 3.5, 0, Math.PI * 2);
    ctx.fill();
    // Loot Chest outside
    ctx.fillStyle = '#451a03';
    ctx.fillRect(px + 8, py + h - 10, 8, 6);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(px + 11, py + h - 9, 2, 2);
  }

  private drawWizardTowerSprite(px: number, py: number, w: number, h: number) {
    const { ctx } = this;
    // Arcane Tower Shaft
    ctx.fillStyle = '#312e81';
    ctx.fillRect(px + 14, py + 10, w - 28, h - 14);
    // Tower Balcony
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(px + 12, py + 18, w - 24, 3);
    // Conical Violet Spire
    ctx.fillStyle = '#6d28d9';
    ctx.beginPath();
    ctx.moveTo(px + w / 2, py - 14);
    ctx.lineTo(px + 8, py + 12);
    ctx.lineTo(px + w - 8, py + 12);
    ctx.closePath();
    ctx.fill();
    // Levitating Pulsing Arcane Crystal
    const glow = (Math.sin(Date.now() * 0.005) + 1) * 3;
    ctx.fillStyle = '#c084fc';
    ctx.beginPath();
    ctx.arc(px + w / 2, py - 18, 5 + glow * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawClericTempleSprite(px: number, py: number, w: number, h: number) {
    const { ctx } = this;
    // Marble Cathedral Walls
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(px + 6, py + 14, w - 12, h - 18);
    // Marble Pillars
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(px + 8, py + 14, 3, h - 18);
    ctx.fillRect(px + w - 11, py + 14, 3, h - 18);
    // Grand Golden Dome
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(px + w / 2, py + 16, 20, Math.PI, 0);
    ctx.fill();
    // Solar Cross atop Dome
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(px + w / 2 - 2, py - 10, 4, 16);
    ctx.fillRect(px + w / 2 - 6, py - 6, 12, 4);
    // Stained glass rose window
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.arc(px + w / 2, py + 26, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawDwarfSettlementSprite(px: number, py: number, w: number, h: number) {
    const { ctx } = this;
    // Granite Mountain Fortress
    ctx.fillStyle = '#334155';
    ctx.fillRect(px + 4, py + 10, w - 8, h - 14);
    // Parapet Battlements
    ctx.fillStyle = '#475569';
    ctx.fillRect(px + 2, py + 6, w - 4, 6);
    // Iron Blast Gates & Gold Crest
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(px + w / 2 - 8, py + 24, 16, h - 24);
    ctx.fillStyle = '#d97706';
    ctx.fillRect(px + w / 2 - 4, py + 28, 8, 4);
    // Heavy Ballista Bow on roof
    ctx.fillStyle = '#451a03';
    ctx.fillRect(px + w / 2 - 8, py + 2, 16, 3);
  }

  private drawMarketplaceSprite(px: number, py: number, w: number, h: number) {
    const { ctx } = this;
    const numStripes = 6;
    const stripeW = w / numStripes;
    for (let i = 0; i < numStripes; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#ef4444' : '#f8fafc';
      ctx.fillRect(px + i * stripeW, py + 4, stripeW, 18);
    }
    ctx.fillStyle = '#92400e';
    ctx.fillRect(px + 6, py + 22, w - 12, h - 26);
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(px + 18, py + 34, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(px + 30, py + 34, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawBlacksmithSprite(px: number, py: number, w: number, h: number) {
    const { ctx } = this;
    ctx.fillStyle = '#7f1d1d';
    ctx.fillRect(px + 6, py + 14, w - 12, h - 18);
    ctx.fillStyle = '#450a0a';
    ctx.fillRect(px + w - 18, py - 6, 12, 22);
    // Animated glowing forge fire
    const fireFlicker = Math.sin(Date.now() * 0.02) * 2;
    ctx.fillStyle = '#f97316';
    ctx.fillRect(px + 14, py + 30, 16, 12);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(px + 18, py + 33, 8 + fireFlicker, 6);
    // Steel Anvil
    ctx.fillStyle = '#334155';
    ctx.fillRect(px + 8, py + 28, 6, 8);
  }

  private drawGuardTowerSprite(px: number, py: number, w: number, h: number) {
    const { ctx } = this;
    // Stone Tower Shaft
    ctx.fillStyle = '#475569';
    ctx.fillRect(px + 6, py + 6, w - 12, h - 10);
    // Machicolations
    ctx.fillStyle = '#64748b';
    ctx.fillRect(px + 3, py + 2, w - 6, 6);
    // Conical Slate Roof
    ctx.fillStyle = '#1e3a8a';
    ctx.beginPath();
    ctx.moveTo(px + w / 2, py - 10);
    ctx.lineTo(px + 4, py + 3);
    ctx.lineTo(px + w - 4, py + 3);
    ctx.closePath();
    ctx.fill();
    // Royal Blue Banner
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(px + w / 2, py - 14, 5, 4);
  }

  private drawInnSprite(px: number, py: number, w: number, h: number) {
    const { ctx } = this;
    // Lower stone / upper tudor
    ctx.fillStyle = '#475569';
    ctx.fillRect(px + 6, py + 20, w - 12, h - 24);
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(px + 6, py + 10, w - 12, 12);
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.moveTo(px + w / 2, py - 2);
    ctx.lineTo(px + 2, py + 12);
    ctx.lineTo(px + w - 2, py + 12);
    ctx.closePath();
    ctx.fill();
    // Gilded Beer Sign
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(px + 2, py + 16, 7, 7);
  }

  private drawStatueSprite(px: number, py: number, w: number, h: number) {
    const { ctx } = this;
    // Marble Plinth
    ctx.fillStyle = '#475569';
    ctx.fillRect(px + 4, py + h - 10, w - 8, 8);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(px + 8, py + h - 16, w - 16, 6);
    // Gilded Sovereign Statue with Sword
    ctx.fillStyle = '#eab308';
    ctx.fillRect(px + w / 2 - 5, py + 12, 10, 18);
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(px + w / 2, py + 8, 5, 0, Math.PI * 2);
    ctx.fill();
    // Sword aloft
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(px + w / 2 + 5, py + 2, 2, 14);
  }

  private drawPeasantCottageSprite(px: number, py: number, w: number, h: number, id: string = '') {
    const { ctx } = this;
    const variant = Math.abs(id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % 3;
    const smokeY = (Date.now() * 0.015) % 15;

    if (variant === 0) {
      // --- VARIANT 0: Two-Story Narrow Cottage with Overhanging Loft & Lean-To ---
      // Right side Lean-to Wood Store
      ctx.fillStyle = '#57534e';
      ctx.fillRect(px + w * 0.54, py + h * 0.46, w * 0.38, h * 0.44);
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.moveTo(px + w * 0.52, py + h * 0.44);
      ctx.lineTo(px + w * 0.94, py + h * 0.58);
      ctx.lineTo(px + w * 0.52, py + h * 0.58);
      ctx.closePath();
      ctx.fill();
      // Stacked firewood logs in shed
      ctx.fillStyle = '#451a03';
      ctx.fillRect(px + w * 0.60, py + h * 0.68, w * 0.26, 4);

      // Ground floor stone walls (Narrow & compact)
      ctx.fillStyle = '#64748b';
      ctx.fillRect(px + 3, py + h * 0.46, w * 0.52, h * 0.46);

      // Wooden door
      ctx.fillStyle = '#451a03';
      ctx.fillRect(px + 8, py + h * 0.62, 7, 10);

      // Second floor overhanging jetty (Tudor plaster & timber beams)
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(px + 1, py + h * 0.22, w * 0.56, h * 0.26);
      ctx.fillStyle = '#451a03';
      ctx.fillRect(px + 1, py + h * 0.44, w * 0.56, 2.5); // Corbel beam
      ctx.fillRect(px + w * 0.28, py + h * 0.22, 2, h * 0.24); // Center timber post

      // Loft window
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(px + 10, py + h * 0.26, 5, 5);

      // Steep peaked thatch roof
      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.moveTo(px + w * 0.29, py + 1);
      ctx.lineTo(px - 1, py + h * 0.24);
      ctx.lineTo(px + w * 0.59, py + h * 0.24);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(px + 1, py + h * 0.22, w * 0.56, 2);

      // Stone chimney with animated smoke
      ctx.fillStyle = '#475569';
      ctx.fillRect(px + 4, py + 1, 4, 8);
      ctx.fillStyle = 'rgba(203, 213, 225, 0.45)';
      ctx.beginPath();
      ctx.arc(px + 6, py - 3 - smokeY, 2.5 + smokeY * 0.25, 0, Math.PI * 2);
      ctx.fill();
    } else if (variant === 1) {
      // --- VARIANT 1: One-Story Asymmetrical L-Shaped Cottage with Inner Nook Porch ---
      // Back horizontal wing
      ctx.fillStyle = '#64748b';
      ctx.fillRect(px + 4, py + 8, w - 10, h * 0.40);

      // Front projecting wing (forming the 'L')
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(px + 4, py + h * 0.42, w * 0.44, h * 0.48);
      ctx.fillStyle = '#451a03';
      ctx.fillRect(px + 4, py + h * 0.42, w * 0.44, 2); // Timber divider
      ctx.fillRect(px + w * 0.24, py + h * 0.44, 2, h * 0.44);

      // Window on projecting wing
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(px + 8, py + h * 0.55, 5, 5);

      // Main Thatch Roof across back
      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.moveTo(px + w * 0.52, py + 1);
      ctx.lineTo(px + 2, py + 10);
      ctx.lineTo(px + w - 4, py + 10);
      ctx.closePath();
      ctx.fill();

      // Cross Wing Thatch Roof (Projecting forward)
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.moveTo(px + w * 0.26, py + 7);
      ctx.lineTo(px + 2, py + h * 0.44);
      ctx.lineTo(px + w * 0.50, py + h * 0.44);
      ctx.closePath();
      ctx.fill();

      // Inner Nook Door & Porch Canopy (Sheltered inside the L)
      ctx.fillStyle = '#451a03';
      ctx.fillRect(px + w * 0.52, py + h * 0.50, 7, 10);
      ctx.fillStyle = '#ca8a04';
      ctx.fillRect(px + w * 0.50, py + h * 0.46, 11, 3); // Porch awning

      // Water barrel in garden corner
      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.arc(px + w - 10, py + h * 0.72, 4, 0, Math.PI * 2);
      ctx.fill();

      // Chimney on gable end
      ctx.fillStyle = '#475569';
      ctx.fillRect(px + w - 12, py + 2, 4, 8);
      ctx.fillStyle = 'rgba(203, 213, 225, 0.45)';
      ctx.beginPath();
      ctx.arc(px + w - 10, py - 2 - smokeY, 2.5 + smokeY * 0.25, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // --- VARIANT 2: Quaint Rectangular Long-Cottage with Dormer & Bread Oven ---
      // Fieldstone base walls
      ctx.fillStyle = '#64748b';
      ctx.fillRect(px + 4, py + 11, w - 8, h - 15);

      // Thatch Roof with wide eaves
      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.moveTo(px + w / 2, py + 1);
      ctx.lineTo(px + 1, py + 14);
      ctx.lineTo(px + w - 1, py + 14);
      ctx.closePath();
      ctx.fill();

      // Dormer Window on Roof
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(px + 8, py + 5, 6, 5);
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.moveTo(px + 11, py + 2);
      ctx.lineTo(px + 6, py + 6);
      ctx.lineTo(px + 16, py + 6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(px + 9, py + 6, 4, 3);

      // Stone Bread Oven on left side
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(px + 3, py + h * 0.65, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Wooden door & warm window
      ctx.fillStyle = '#451a03';
      ctx.fillRect(px + w - 15, py + h - 13, 7, 10);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(px + 12, py + 17, 5, 5);

      // Chimney with animated smoke
      ctx.fillStyle = '#475569';
      ctx.fillRect(px + 4, py + 1, 4, 8);
      ctx.fillStyle = 'rgba(203, 213, 225, 0.45)';
      ctx.beginPath();
      ctx.arc(px + 6, py - 2 - smokeY, 2.5 + smokeY * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderLair(lair: MonsterLair, state: GameState) {
    const { ctx } = this;
    const ts = this.gridManager.tileSize;
    const px = lair.x * ts;
    const py = lair.y * ts;
    const w = lair.width * ts;
    const h = lair.height * ts;

    if (!this.gridManager.explored[Math.floor(lair.y)][Math.floor(lair.x)]) return;

    const isSelected = state.selectedEntity?.type === 'lair' && state.selectedEntity.id === lair.id;

    if (isSelected) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.strokeRect(px - 4, py - 4, w + 8, h + 8);
    }

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(px + 4, py + 4, w, h);

    switch (lair.type) {
      case 'sewer_grate':
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(px + 4, py + 4, w - 8, h - 8);
        ctx.fillStyle = '#10b981';
        ctx.fillRect(px + 8, py + 8, w - 16, h - 16);
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 6, py + 6, w - 12, h - 12);
        break;
      case 'graveyard':
        ctx.fillStyle = '#292524';
        ctx.fillRect(px + 4, py + 6, w - 8, h - 10);
        ctx.fillStyle = '#78716c';
        ctx.fillRect(px + 8, py + 10, 8, 12);
        ctx.fillRect(px + 24, py + 12, 8, 14);
        break;
      case 'goblin_hut':
        ctx.fillStyle = '#713f12';
        ctx.beginPath();
        ctx.arc(px + w / 2, py + h / 2 + 4, 16, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#ca8a04';
        ctx.fillRect(px + 10, py + 8, w - 20, 6);
        break;
      case 'wolf_den':
        ctx.fillStyle = '#1c1917';
        ctx.beginPath();
        ctx.ellipse(px + w / 2, py + h / 2, 16, 12, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'ancient_ruins':
        ctx.fillStyle = '#334155';
        ctx.fillRect(px + 6, py + 6, 10, h - 12);
        ctx.fillRect(px + w - 16, py + 6, 10, h - 12);
        ctx.fillRect(px + 6, py + 6, w - 12, 8);
        break;
      case 'dragon_cavern':
        ctx.fillStyle = '#450a0a';
        ctx.fillRect(px + 4, py + 4, w - 8, h - 8);
        ctx.fillStyle = '#ea580c';
        ctx.fillRect(px + 10, py + 14, w - 20, 8);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(px + 14, py + 16, w - 28, 4);
        break;
    }

    // Health bar
    const barW = w;
    const barH = 5;
    const hpPercent = Math.max(0, lair.hp / lair.maxHp);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(px, py - 8, barW, barH);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(px, py - 8, barW * hpPercent, barH);
  }

  private renderCorpse(c: Corpse, state: GameState) {
    const { ctx } = this;
    if (!this.gridManager.isPixelVisible(c.x, c.y)) return;

    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.rotation || 0);

    if (c.type === 'building_ruin') {
      const ts = this.gridManager.tileSize;
      const w = (c.width || 3) * ts;
      const h = (c.height || 3) * ts;

      // Charred foundation plinth
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(-w / 2, -h / 2, w, h);

      // Crumbling stone walls
      ctx.fillStyle = '#475569';
      ctx.fillRect(-w * 0.45, -h * 0.45, w * 0.4, 4);
      ctx.fillRect(w * 0.1, -h * 0.45, 4, h * 0.4);
      ctx.fillRect(-w * 0.3, h * 0.35, w * 0.5, 4);

      // Broken timber beams
      ctx.fillStyle = '#292524';
      ctx.fillRect(-w * 0.25, -2, w * 0.5, 3);

      // Glowing ash embers
      ctx.fillStyle = '#f97316';
      ctx.fillRect(-4, -4, 2, 2);
      ctx.fillRect(6, 4, 2, 2);
      ctx.fillRect(-8, 6, 2, 2);
    } else if (c.type === 'hero') {
      // Grave cross
      ctx.fillStyle = '#78350f';
      ctx.fillRect(-2, -10, 4, 20);
      ctx.fillRect(-7, -5, 14, 4);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(4, 2, 6, 5); // helmet
    } else if (c.type === 'monster') {
      ctx.fillStyle = '#44403c';
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#57534e';
      ctx.fillRect(-5, -3, 10, 6);
    }

    ctx.restore();
  }

  private renderTreasure(t: Treasure, state: GameState) {
    const { ctx } = this;
    if (!this.gridManager.isPixelVisible(t.x, t.y)) return;

    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(t.x, t.y + 4, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    const gleam = (Math.sin(Date.now() * 0.006 + t.x) + 1) * 0.5;

    if (t.type === 'chest') {
      // Detailed Wooden & Gold Bound Chest
      ctx.fillStyle = '#78350f';
      ctx.fillRect(t.x - 7, t.y - 7, 14, 11);
      // Brass Bands
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(t.x - 7, t.y - 7, 3, 11);
      ctx.fillRect(t.x + 4, t.y - 7, 3, 11);
      // Keyhole / Lock
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(t.x - 1.5, t.y - 3, 3, 4);

      // Gold Sparkle Gleam
      if (gleam > 0.6) {
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(t.x + 4, t.y - 7, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Bulging Gold Sack with red string tie
      ctx.fillStyle = '#b45309';
      ctx.beginPath();
      ctx.arc(t.x, t.y - 4, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ef4444'; // Red string tie
      ctx.fillRect(t.x - 4, t.y - 9, 8, 2);
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 7px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', t.x, t.y - 2);
    }
  }

  // --- RICH ANIMATED HERO RENDERING ---
  private renderHero(hero: Hero, state: GameState) {
    if (hero.isDead) return;
    const { ctx } = this;
    const x = hero.x;
    const y = hero.y;

    if (!this.gridManager.isPixelVisible(x, y)) return;

    const isSelected = state.selectedEntity?.type === 'hero' && state.selectedEntity.id === hero.id;

    // Selection ring
    if (isSelected) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y + 4, 13, 7, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + 5, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    const isMoving = hero.state === 'wandering' || hero.state === 'pursuing_flag' || hero.state === 'fleeing' || hero.state === 'collecting_treasure';
    const walkPhase = isMoving ? Date.now() * 0.012 : 0;
    const legStride = isMoving ? Math.sin(walkPhase) * 4 : 0;
    const bodyBob = isMoving ? Math.abs(Math.sin(walkPhase)) * 1.5 : 0;
    const isAttacking = hero.isAttackingAnimation > 0;
    const dir = hero.direction;

    // 1. LEGS (Walking animation)
    ctx.fillStyle = '#1e293b'; // Dark pants
    ctx.fillRect(x - 4 + legStride, y - 4 - bodyBob, 3, 7);
    ctx.fillRect(x + 1 - legStride, y - 4 - bodyBob, 3, 7);

    // Boots
    ctx.fillStyle = '#451a03';
    ctx.fillRect(x - 5 + legStride, y + 1 - bodyBob, 4, 3);
    ctx.fillRect(x + 1 - legStride, y + 1 - bodyBob, 4, 3);

    // 2. CAPE / BACK CLOAK (billows in wind)
    const capeWiggle = Math.sin(Date.now() * 0.008 + x) * 2;
    if (hero.heroClass === 'warrior') {
      ctx.fillStyle = '#1d4ed8'; // Royal Blue Cape
      ctx.fillRect(x - 5, y - 11 - bodyBob, 10, 10);
    } else if (hero.heroClass === 'ranger') {
      ctx.fillStyle = '#047857'; // Forest Green Cloak
      ctx.fillRect(x - 5, y - 11 - bodyBob, 10, 10);
    } else if (hero.heroClass === 'wizard') {
      ctx.fillStyle = '#581c87'; // Purple Archmage Robe
      ctx.fillRect(x - 6, y - 12 - bodyBob, 12, 12);
    }

    // 3. TORSO / ARMOR
    const classDef = HERO_CLASS_DEFINITIONS[hero.heroClass];
    ctx.fillStyle = classDef.color;
    ctx.fillRect(x - 5, y - 11 - bodyBob, 10, 9);

    // Chest Plate highlight
    if (hero.heroClass === 'warrior' || hero.heroClass === 'dwarf') {
      ctx.fillStyle = '#cbd5e1'; // Steel Plate
      ctx.fillRect(x - 4, y - 10 - bodyBob, 8, 7);
      ctx.fillStyle = '#fbbf24'; // Gold lion crest
      ctx.fillRect(x - 1, y - 8 - bodyBob, 2, 3);
    }

    // 4. HEAD & HAIR / HELMET
    ctx.fillStyle = '#fed7aa'; // Skin tone
    ctx.beginPath();
    ctx.arc(x, y - 15 - bodyBob, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Helmets / Hats
    if (hero.heroClass === 'warrior' || hero.heroClass === 'dwarf') {
      // Iron Visor & Plume
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(x - 5, y - 19 - bodyBob, 10, 5);
      ctx.fillStyle = '#ef4444'; // Red Crest Plume
      ctx.fillRect(x - 1, y - 22 - bodyBob, 2, 4);
    } else if (hero.heroClass === 'wizard') {
      // Pointed Wizard Hat
      ctx.fillStyle = '#6d28d9';
      ctx.beginPath();
      ctx.moveTo(x, y - 25 - bodyBob);
      ctx.lineTo(x - 6, y - 17 - bodyBob);
      ctx.lineTo(x + 6, y - 17 - bodyBob);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(x - 3, y - 18 - bodyBob, 6, 1.5);
    } else if (hero.heroClass === 'ranger') {
      // Green Hood
      ctx.fillStyle = '#065f46';
      ctx.beginPath();
      ctx.arc(x, y - 16 - bodyBob, 5.5, Math.PI, 0);
      ctx.fill();
    } else if (hero.heroClass === 'cleric') {
      // Golden Circlet / Mitre
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(x - 5, y - 18 - bodyBob, 10, 2);
    }

    // 5. WEAPONS & ATTACK ANIMATIONS
    const attackDir = dir === 'left' ? -1 : 1;
    const attackSwing = isAttacking ? Math.sin(hero.isAttackingAnimation * 15) * 8 : 0;

    if (hero.heroClass === 'warrior') {
      // Steel Kite Shield (Left Arm)
      ctx.fillStyle = '#1e3a8a';
      ctx.fillRect(x - 7 * attackDir, y - 9 - bodyBob, 4, 8);
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 7 * attackDir, y - 9 - bodyBob, 4, 8);

      // Gleaming Sword (Right Arm)
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x + 4 * attackDir, y - 8 - bodyBob);
      ctx.lineTo(x + (12 + attackSwing) * attackDir, y - (14 + attackSwing) - bodyBob);
      ctx.stroke();

      // Sword slash trail on attack
      if (isAttacking) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x + 8 * attackDir, y - 10 - bodyBob, 14, -Math.PI / 3, Math.PI / 3);
        ctx.stroke();
      }
    } else if (hero.heroClass === 'ranger' || hero.heroClass === 'elf') {
      // Recurve Bow & Arrow
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + 6 * attackDir, y - 8 - bodyBob, 8, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
    } else if (hero.heroClass === 'wizard') {
      // Arcane Staff with glowing orb
      ctx.strokeStyle = '#78350f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 5 * attackDir, y - bodyBob);
      ctx.lineTo(x + 5 * attackDir, y - 20 - bodyBob);
      ctx.stroke();

      // Glowing Arcane Orb
      const magicGlow = (Math.sin(Date.now() * 0.01) + 1) * 2;
      ctx.fillStyle = '#c084fc';
      ctx.beginPath();
      ctx.arc(x + 5 * attackDir, y - 22 - bodyBob, 3 + magicGlow * 0.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (hero.heroClass === 'cleric') {
      // Holy Sun Mace
      ctx.strokeStyle = '#ca8a04';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 5 * attackDir, y - bodyBob);
      ctx.lineTo(x + 6 * attackDir, y - 16 - bodyBob);
      ctx.stroke();
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(x + 6 * attackDir, y - 18 - bodyBob, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (hero.heroClass === 'rogue') {
      // Dual Daggers
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + 4 * attackDir, y - 6 - bodyBob);
      ctx.lineTo(x + 9 * attackDir, y - 10 - bodyBob);
      ctx.moveTo(x - 4 * attackDir, y - 6 - bodyBob);
      ctx.lineTo(x - 9 * attackDir, y - 10 - bodyBob);
      ctx.stroke();
    } else if (hero.heroClass === 'dwarf') {
      // Heavy Warhammer & Braided Beard
      ctx.fillStyle = '#d97706'; // Red braided beard
      ctx.fillRect(x - 3, y - 12 - bodyBob, 6, 6);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + 4 * attackDir, y - bodyBob);
      ctx.lineTo(x + 8 * attackDir, y - 14 - bodyBob);
      ctx.stroke();
    }

    // 6. HEALTH BAR
    const hpW = 20;
    const hpH = 3;
    const hpPercent = Math.max(0, hero.hp / hero.maxHp);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x - hpW / 2, y - 24 - bodyBob, hpW, hpH);
    ctx.fillStyle = hpPercent > 0.5 ? '#22c55e' : (hpPercent > 0.25 ? '#eab308' : '#ef4444');
    ctx.fillRect(x - hpW / 2, y - 24 - bodyBob, hpW * hpPercent, hpH);

    // 7. LEVEL BADGE
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x - 5, y - 31 - bodyBob, 10, 8);
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${hero.level}`, x, y - 25 - bodyBob);
  }

  // --- RICH ANIMATED MONSTER RENDERING ---
  private renderMonster(monster: Monster, state: GameState) {
    if (monster.hp <= 0) return;
    const { ctx } = this;
    const x = monster.x;
    const y = monster.y;

    if (!this.gridManager.isPixelVisible(x, y)) return;

    const isSelected = state.selectedEntity?.type === 'monster' && state.selectedEntity.id === monster.id;
    if (isSelected) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y + 4, monster.isBoss ? 20 : 13, monster.isBoss ? 10 : 7, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    const walkPhase = Date.now() * 0.01;
    const walkBob = Math.sin(walkPhase) * 2;
    const legStride = Math.sin(walkPhase) * 4;

    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + 4, monster.isBoss ? 18 : 8, monster.isBoss ? 9 : 4, 0, 0, Math.PI * 2);
    ctx.fill();

    const def = MONSTER_DEFINITIONS[monster.type];

    if (monster.type === 'giant_rat') {
      // 4-legged scurrying rat with tail
      ctx.fillStyle = '#78716c';
      ctx.beginPath();
      ctx.ellipse(x, y - 3 + walkBob, 8, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Paws
      ctx.fillStyle = '#57534e';
      ctx.fillRect(x - 6 + legStride, y + 1, 3, 3);
      ctx.fillRect(x + 3 - legStride, y + 1, 3, 3);
      // Whipping Tail
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - 7, y - 3 + walkBob);
      ctx.quadraticCurveTo(x - 14, y - 8 + walkBob, x - 18, y - 4 + walkBob);
      ctx.stroke();
    } else if (monster.type === 'skeleton') {
      // Bone warrior
      ctx.fillStyle = '#e2e8f0'; // Ribs and skull
      ctx.beginPath();
      ctx.arc(x, y - 14 + walkBob, 4, 0, Math.PI * 2);
      ctx.fill();
      // Glowing eye sockets
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(x - 2, y - 15 + walkBob, 1.5, 1.5);
      ctx.fillRect(x + 1, y - 15 + walkBob, 1.5, 1.5);
      // Ribcage & spine
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(x - 4, y - 10 + walkBob, 8, 7);
      // Bone Legs
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(x - 3 + legStride, y - 3 + walkBob, 2, 6);
      ctx.fillRect(x + 1 - legStride, y - 3 + walkBob, 2, 6);
      // Rusty sword
      ctx.strokeStyle = '#78716c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 4, y - 8 + walkBob);
      ctx.lineTo(x + 11, y - 13 + walkBob);
      ctx.stroke();
    } else if (monster.type === 'zombie') {
      // Rotting zombie with dragging gait
      ctx.fillStyle = '#4d7c0f'; // Putrid green
      ctx.fillRect(x - 5, y - 10 + walkBob, 10, 10);
      ctx.beginPath();
      ctx.arc(x, y - 14 + walkBob, 4.5, 0, Math.PI * 2);
      ctx.fill();
      // Outstretched rotting claw arms
      ctx.fillStyle = '#3f6212';
      ctx.fillRect(x - 8, y - 8 + walkBob, 16, 3);
    } else if (monster.type === 'goblin_spearman') {
      // Green goblin with tribal spear
      ctx.fillStyle = '#84cc16';
      ctx.beginPath();
      ctx.arc(x, y - 13 + walkBob, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#713f12'; // Leather loincloth
      ctx.fillRect(x - 4, y - 9 + walkBob, 8, 7);
      // Spear
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 3, y - 3 + walkBob);
      ctx.lineTo(x + 12, y - 18 + walkBob);
      ctx.stroke();
      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.moveTo(x + 12, y - 18 + walkBob);
      ctx.lineTo(x + 15, y - 22 + walkBob);
      ctx.lineTo(x + 10, y - 20 + walkBob);
      ctx.closePath();
      ctx.fill();
    } else if (monster.type === 'dire_wolf') {
      // Running Wolf
      ctx.fillStyle = '#52525b';
      ctx.beginPath();
      ctx.ellipse(x, y - 6 + walkBob, 12, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + 10, y - 9 + walkBob, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3f3f46';
      ctx.fillRect(x - 8 + legStride, y - 1, 3, 5);
      ctx.fillRect(x + 6 - legStride, y - 1, 3, 5);
    } else if (monster.type === 'minotaur') {
      // Giant Horned Minotaur
      ctx.fillStyle = '#991b1b';
      ctx.fillRect(x - 8, y - 18 + walkBob, 16, 16);
      ctx.beginPath();
      ctx.arc(x, y - 22 + walkBob, 7, 0, Math.PI * 2);
      ctx.fill();
      // Curved Bull Horns
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - 6, y - 24 + walkBob);
      ctx.quadraticCurveTo(x - 14, y - 30 + walkBob, x - 12, y - 34 + walkBob);
      ctx.moveTo(x + 6, y - 24 + walkBob);
      ctx.quadraticCurveTo(x + 14, y - 30 + walkBob, x + 12, y - 34 + walkBob);
      ctx.stroke();
      // Giant Battleaxe
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + 8, y - 8 + walkBob);
      ctx.lineTo(x + 16, y - 26 + walkBob);
      ctx.stroke();
    } else if (monster.type === 'necromancer') {
      // Floating Dark Necromancer
      const floatY = Math.sin(Date.now() * 0.005) * 4;
      ctx.fillStyle = '#3b0764';
      ctx.fillRect(x - 7, y - 16 - floatY, 14, 16);
      ctx.fillStyle = '#581c87';
      ctx.beginPath();
      ctx.arc(x, y - 19 - floatY, 5, 0, Math.PI * 2);
      ctx.fill();
      // Orbiting glowing green skull
      const orbX = x + Math.cos(Date.now() * 0.008) * 12;
      const orbY = y - 14 - floatY + Math.sin(Date.now() * 0.008) * 6;
      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.arc(orbX, orbY, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (monster.type === 'red_dragon') {
      // Flying Red Dragon Fryre with Animated Altitude & Flapping Wings
      const time = Date.now() * 0.005;
      const flyAltitude = 26 + Math.sin(time * 0.7) * 4;
      const wingFlap = Math.sin(time * 1.6) * 14;

      // Ground Shadow on Terrain below Flying Dragon
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.beginPath();
      ctx.ellipse(x, y + 4, 22, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // Elevated Dragon Body Position
      const flyY = y - flyAltitude;

      // Sinuous Tail
      const tailSway = Math.sin(time * 1.2) * 8;
      ctx.fillStyle = '#991b1b';
      ctx.beginPath();
      ctx.moveTo(x - 6, flyY - 2);
      ctx.quadraticCurveTo(x + tailSway, flyY + 16, x + tailSway * 1.4, flyY + 24);
      ctx.lineTo(x + 4, flyY - 2);
      ctx.closePath();
      ctx.fill();

      // Massive Flying Wings
      ctx.fillStyle = '#7f1d1d';
      ctx.beginPath();
      ctx.moveTo(x - 34, flyY - 24 + wingFlap);
      ctx.lineTo(x - 4, flyY - 10);
      ctx.lineTo(x + 34, flyY - 24 + wingFlap);
      ctx.lineTo(x + 18, flyY - 2);
      ctx.lineTo(x - 18, flyY - 2);
      ctx.closePath();
      ctx.fill();

      // Wing Bone Struts
      ctx.strokeStyle = '#450a0a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, flyY - 10);
      ctx.lineTo(x - 34, flyY - 24 + wingFlap);
      ctx.moveTo(x, flyY - 10);
      ctx.lineTo(x + 34, flyY - 24 + wingFlap);
      ctx.stroke();

      // Main Torso & Head
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.ellipse(x, flyY - 10, 16, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + 12, flyY - 18, 8, 0, Math.PI * 2);
      ctx.fill();

      // Obsidian Horns
      ctx.fillStyle = '#1c1917';
      ctx.beginPath();
      ctx.moveTo(x + 8, flyY - 24);
      ctx.lineTo(x + 12, flyY - 18);
      ctx.lineTo(x + 4, flyY - 20);
      ctx.closePath();
      ctx.fill();

      // Glowing Fire Eyes & Fire Maw
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(x + 15, flyY - 20, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x + 16, flyY - 16, 5, 3);
    } else {
      ctx.fillStyle = def.color;
      ctx.fillRect(x - 4, y - 8, 8, 10);
      ctx.beginPath();
      ctx.arc(x, y - 12, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Health Bar
    const hpW = monster.isBoss ? 36 : 18;
    const hpH = monster.isBoss ? 5 : 3;
    const hpPercent = Math.max(0, monster.hp / monster.maxHp);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x - hpW / 2, y - (monster.isBoss ? 34 : 20), hpW, hpH);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(x - hpW / 2, y - (monster.isBoss ? 34 : 20), hpW * hpPercent, hpH);
  }

  private renderTaxCollector(tc: TaxCollector, state: GameState) {
    const { ctx } = this;
    if (!this.gridManager.isPixelVisible(tc.x, tc.y)) return;

    const isSelected = state.selectedEntity?.type === 'tax_collector' && state.selectedEntity.id === tc.id;
    const bob = Math.sin(Date.now() * 0.008) * 2;

    if (isSelected) {
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(tc.x, tc.y + 4, 14, 7, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(tc.x, tc.y + 5, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body (Royal Purple Tunic with Gold Trim)
    ctx.fillStyle = '#6b21a8';
    ctx.fillRect(tc.x - 6, tc.y - 12 + bob, 12, 14);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(tc.x - 6, tc.y - 6 + bob, 12, 2.5);

    // Head & Feathered Cap
    ctx.fillStyle = '#fed7aa';
    ctx.beginPath();
    ctx.arc(tc.x, tc.y - 16 + bob, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#581c87';
    ctx.beginPath();
    ctx.ellipse(tc.x, tc.y - 20 + bob, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // White Feather Plume
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tc.x - 3, tc.y - 20 + bob);
    ctx.quadraticCurveTo(tc.x - 10, tc.y - 28 + bob, tc.x - 7, tc.y - 32 + bob);
    ctx.stroke();

    // Ledger Book
    ctx.fillStyle = '#78350f';
    ctx.fillRect(tc.x - 9, tc.y - 10 + bob, 4, 8);

    // Heavy Burlap Coin Sack on Back
    const sackSize = tc.goldCarried > 0 ? Math.min(10, 6 + (tc.goldCarried / 40) * 3) : 5;
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.arc(tc.x + 7, tc.y - 8 + bob, sackSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (tc.goldCarried > 0) {
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', tc.x + 7, tc.y - 5 + bob);
    }

    // Health bar if damaged
    if (tc.hp < tc.maxHp) {
      const hpW = 18;
      const hpH = 3;
      const hpPercent = Math.max(0, tc.hp / tc.maxHp);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(tc.x - hpW / 2, tc.y - 26 + bob, hpW, hpH);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(tc.x - hpW / 2, tc.y - 26 + bob, hpW * hpPercent, hpH);
    }

    // Floating Identification Badge
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(tc.x - 22, tc.y - 38 + bob, 44, 11);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1;
    ctx.strokeRect(tc.x - 22, tc.y - 38 + bob, 44, 11);
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(tc.goldCarried > 0 ? `Tax (${tc.goldCarried}g)` : 'Taxman', tc.x, tc.y - 30 + bob);
  }

  private renderFlag(flag: Flag, state: GameState) {
    const { ctx } = this;
    const x = flag.x;
    const y = flag.y;

    ctx.strokeStyle = '#d4d4d8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 26);
    ctx.stroke();

    ctx.fillStyle = flag.type === 'attack' ? '#dc2626' : (flag.type === 'explore' ? '#2563eb' : '#eab308');
    ctx.beginPath();
    ctx.moveTo(x, y - 26);
    ctx.lineTo(x + 18, y - 20);
    ctx.lineTo(x, y - 14);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x - 14, y - 36, 28, 11);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 14, y - 36, 28, 11);

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${flag.goldReward}g`, x, y - 28);
  }

  private renderProjectile(proj: Projectile) {
    const { ctx } = this;
    ctx.save();
    if (proj.type === 'arrow') {
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      const angle = Math.atan2(proj.targetY - proj.startY, proj.targetX - proj.startX);
      ctx.translate(proj.currentX, proj.currentY);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(6, 0);
      ctx.stroke();
    } else if (proj.type === 'fireball' || proj.type === 'dragon_breath') {
      ctx.fillStyle = '#f97316';
      ctx.beginPath();
      ctx.arc(proj.currentX, proj.currentY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(proj.currentX, proj.currentY, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (proj.type === 'magic_missile') {
      ctx.fillStyle = '#c084fc';
      ctx.beginPath();
      ctx.arc(proj.currentX, proj.currentY, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (proj.type === 'holy_bolt') {
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(proj.currentX, proj.currentY, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private renderParticle(p: Particle) {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private renderFloatingText(ft: FloatingText) {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
    ctx.fillStyle = ft.color;
    ctx.font = `bold ${ft.fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 4;
    const displayText = ft.text.replace(/(\d+)\.\d+/g, (match) => Math.round(parseFloat(match)).toString());
    ctx.fillText(displayText, ft.x, ft.y);
    ctx.restore();
  }

  private renderFogOfWar(state: GameState) {
    const { ctx } = this;
    const ts = this.gridManager.tileSize;

    for (let y = 0; y < this.gridManager.height; y++) {
      for (let x = 0; x < this.gridManager.width; x++) {
        const px = x * ts;
        const py = y * ts;

        if (!this.gridManager.explored[y][x]) {
          ctx.fillStyle = '#090d16';
          ctx.fillRect(px, py, ts, ts);
        } else if (!this.gridManager.visible[y][x]) {
          ctx.fillStyle = 'rgba(9, 13, 22, 0.45)';
          ctx.fillRect(px, py, ts, ts);
        }
      }
    }
  }

  private renderDayNightLighting(state: GameState) {
    const { ctx } = this;
    const mapW = this.gridManager.width * this.gridManager.tileSize;
    const mapH = this.gridManager.height * this.gridManager.tileSize;

    if (state.dayPhase === 'night') {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.38)';
      ctx.fillRect(0, 0, mapW, mapH);
    } else if (state.dayPhase === 'dusk') {
      ctx.fillStyle = 'rgba(180, 83, 9, 0.15)';
      ctx.fillRect(0, 0, mapW, mapH);
    } else if (state.dayPhase === 'dawn') {
      ctx.fillStyle = 'rgba(251, 191, 36, 0.1)';
      ctx.fillRect(0, 0, mapW, mapH);
    }
  }

  private renderPlacementPreview(state: GameState, mousePos: { x: number; y: number }) {
    if (!state.activePlacement) return;
    const { ctx } = this;
    const ts = this.gridManager.tileSize;

    const tileX = Math.floor(mousePos.x / ts);
    const tileY = Math.floor(mousePos.y / ts);

    if (state.activePlacement.type === 'building') {
      const bDef = BUILDING_DEFINITIONS[state.activePlacement.subType as keyof typeof BUILDING_DEFINITIONS];
      if (!bDef) return;

      const isValid = this.gridManager.canPlaceBuilding(tileX, tileY, bDef.width, bDef.height, state.buildings, state.lairs);

      ctx.fillStyle = isValid ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)';
      ctx.strokeStyle = isValid ? '#22c55e' : '#ef4444';
      ctx.lineWidth = 2;
      ctx.fillRect(tileX * ts, tileY * ts, bDef.width * ts, bDef.height * ts);
      ctx.strokeRect(tileX * ts, tileY * ts, bDef.width * ts, bDef.height * ts);
    } else if (state.activePlacement.type === 'flag') {
      const flagType = state.activePlacement.subType;
      const color = flagType === 'attack' ? 'rgba(239, 68, 68, 0.6)' : (flagType === 'explore' ? 'rgba(59, 130, 246, 0.6)' : 'rgba(251, 191, 36, 0.6)');
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(mousePos.x, mousePos.y, 25, 0, Math.PI * 2);
      ctx.fill();
    } else if (state.activePlacement.type === 'spell') {
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mousePos.x, mousePos.y, 60, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}
