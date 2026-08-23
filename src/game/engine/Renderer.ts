import { BUILDING_DEFINITIONS, HERO_CLASS_DEFINITIONS, MONSTER_DEFINITIONS } from '../constants';
import { Building, Flag, FloatingText, GameState, Hero, Monster, MonsterLair, Particle, Projectile, TaxCollector } from '../types';
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
    ctx.fillStyle = '#0f172a';
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

    // 4. Render Buildings
    for (const building of state.buildings) {
      this.renderBuilding(building, state);
    }

    // 5. Render Flags
    for (const flag of state.flags) {
      this.renderFlag(flag, state);
    }

    // 6. Render Tax Collectors
    for (const tc of state.taxCollectors) {
      this.renderTaxCollector(tc, state);
    }

    // 7. Render Monsters
    for (const monster of state.monsters) {
      this.renderMonster(monster, state);
    }

    // 8. Render Heroes
    for (const hero of state.heroes) {
      this.renderHero(hero, state);
    }

    // 9. Render Projectiles
    for (const proj of state.projectiles) {
      this.renderProjectile(proj);
    }

    // 10. Render Particles
    for (const p of state.particles) {
      this.renderParticle(p);
    }

    // 11. Render Fog of War Overlay
    this.renderFogOfWar(state);

    // 12. Render Day/Night Atmosphere Lighting
    this.renderDayNightLighting(state);

    // 13. Render Active Placement Preview (Ghost building / flag)
    if (state.activePlacement && mousePos) {
      this.renderPlacementPreview(state, mousePos);
    }

    // 14. Render Floating Combat Text (rendered in world coordinates)
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
        // Optimization: skip rendering tiles completely shrouded in unrevealed Fog
        if (!this.gridManager.explored[y][x]) continue;

        const tileType = this.gridManager.grid[y][x];
        const px = x * ts;
        const py = y * ts;

        if (tileType === 0) {
          // Grass with subtle grid pattern
          const isAlt = (x + y) % 2 === 0;
          ctx.fillStyle = isAlt ? '#2d6a4f' : '#285e46';
          ctx.fillRect(px, py, ts, ts);

          // Subtle grass blades
          if ((x * 7 + y * 13) % 5 === 0) {
            ctx.fillStyle = '#40916c';
            ctx.fillRect(px + 4, py + 6, 2, 4);
            ctx.fillRect(px + 18, py + 14, 2, 4);
          }
        } else if (tileType === 1) {
          // Cobblestone / Dirt Road
          ctx.fillStyle = '#78716c';
          ctx.fillRect(px, py, ts, ts);
          ctx.fillStyle = '#57534e';
          ctx.fillRect(px + 2, py + 2, ts - 4, ts - 4);
          // Cobble stones
          ctx.fillStyle = '#a8a29e';
          ctx.fillRect(px + 4, py + 4, 8, 8);
          ctx.fillRect(px + 16, py + 16, 8, 8);
        } else if (tileType === 2) {
          // Water
          const time = Date.now() * 0.002;
          const wave = Math.sin(time + x + y) * 10;
          ctx.fillStyle = '#0284c7';
          ctx.fillRect(px, py, ts, ts);
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(px + 4, py + 8 + wave * 0.2, ts - 8, 3);
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

    for (let y = 0; y < this.gridManager.height; y++) {
      for (let x = 0; x < this.gridManager.width; x++) {
        if (!this.gridManager.explored[y][x]) continue;

        const tileType = this.gridManager.grid[y][x];
        const px = x * ts;
        const py = y * ts;

        if (tileType === 3) {
          // Pine tree
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.beginPath();
          ctx.ellipse(px + 16, py + 26, 12, 5, 0, 0, Math.PI * 2);
          ctx.fill();

          // Trunk
          ctx.fillStyle = '#78350f';
          ctx.fillRect(px + 14, py + 18, 4, 10);

          // Canopy
          ctx.fillStyle = '#064e3b';
          ctx.beginPath();
          ctx.moveTo(px + 16, py - 4);
          ctx.lineTo(px + 4, py + 20);
          ctx.lineTo(px + 28, py + 20);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#047857';
          ctx.beginPath();
          ctx.moveTo(px + 16, py - 2);
          ctx.lineTo(px + 8, py + 14);
          ctx.lineTo(px + 24, py + 14);
          ctx.closePath();
          ctx.fill();
        } else if (tileType === 4) {
          // Rock formation
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.beginPath();
          ctx.ellipse(px + 16, py + 24, 13, 6, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#334155';
          ctx.beginPath();
          ctx.moveTo(px + 6, py + 24);
          ctx.lineTo(px + 16, py + 4);
          ctx.lineTo(px + 26, py + 24);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#64748b';
          ctx.beginPath();
          ctx.moveTo(px + 16, py + 4);
          ctx.lineTo(px + 26, py + 24);
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

    // Check if explored
    if (!this.gridManager.explored[Math.floor(b.y)][Math.floor(b.x)]) return;

    const isSelected = state.selectedEntity?.type === 'building' && state.selectedEntity.id === b.id;

    // Selection circle
    if (isSelected) {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3;
      ctx.strokeRect(px - 4, py - 4, w + 8, h + 8);
    }

    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(px + 6, py + 6, w, h);

    if (b.isConstructing) {
      // Scaffolding rendering
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

    // Architectural styling based on building type
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

      // Queue badge if multiple
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

    // Gold ready indicator (for marketplace/blacksmith/inn with > 30g)
    if (b.goldStored >= 30) {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(px + w - 10, py + 10, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#78350f';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', px + w - 10, py + 13);
    }
  }

  private drawPalaceSprite(px: number, py: number, w: number, h: number, level: number) {
    const { ctx } = this;
    // Palace stone walls
    ctx.fillStyle = '#475569';
    ctx.fillRect(px + 8, py + 16, w - 16, h - 20);
    // Battlements
    ctx.fillStyle = '#64748b';
    for (let i = px + 8; i < px + w - 16; i += 16) {
      ctx.fillRect(i, py + 10, 10, 8);
    }
    // Main Roof
    ctx.fillStyle = '#991b1b'; // Crimson royal roof
    ctx.beginPath();
    ctx.moveTo(px + w / 2, py - 6);
    ctx.lineTo(px + 12, py + 16);
    ctx.lineTo(px + w - 12, py + 16);
    ctx.closePath();
    ctx.fill();

    // Spire & Crown
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(px + w / 2 - 2, py - 16, 4, 12);
    ctx.beginPath();
    ctx.arc(px + w / 2, py - 18, 5, 0, Math.PI * 2);
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
    ctx.fillStyle = '#334155';
    ctx.fillRect(px + 6, py + 14, w - 12, h - 18);
    // Blue roof
    ctx.fillStyle = '#1e3a8a';
    ctx.beginPath();
    ctx.moveTo(px + w / 2, py + 2);
    ctx.lineTo(px + 2, py + 16);
    ctx.lineTo(px + w - 2, py + 16);
    ctx.closePath();
    ctx.fill();
    // Shield insignia
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(px + w / 2, py + 26, 8, 0, Math.PI);
    ctx.lineTo(px + w / 2 - 8, py + 20);
    ctx.lineTo(px + w / 2 + 8, py + 20);
    ctx.closePath();
    ctx.fill();
  }

  private drawRangerGuildSprite(px: number, py: number, w: number, h: number) {
    const { ctx } = this;
    // Timber lodge
    ctx.fillStyle = '#78350f';
    ctx.fillRect(px + 6, py + 14, w - 12, h - 18);
    // Green moss roof
    ctx.fillStyle = '#065f46';
    ctx.beginPath();
    ctx.moveTo(px + w / 2, py + 2);
    ctx.lineTo(px + 2, py + 16);
    ctx.lineTo(px + w - 2, py + 16);
    ctx.closePath();
    ctx.fill();
    // Target board
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(px + w / 2, py + 30, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(px + w / 2, py + 30, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawRogueGuildSprite(px: number, py: number, w: number, h: number) {
    const { ctx } = this;
    // Dark shadowy facade
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(px + 6, py + 14, w - 12, h - 18);
    ctx.fillStyle = '#3f3f46';
    ctx.fillRect(px + 4, py + 4, w - 8, 12);
    // Dagger icon
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(px + w / 2 - 2, py + 22, 4, 14);
    ctx.fillRect(px + w / 2 - 6, py + 26, 12, 3);
  }

  private drawWizardTowerSprite(px: number, py: number, w: number, h: number) {
    const { ctx } = this;
    // Tall cylinder
    ctx.fillStyle = '#312e81';
    ctx.fillRect(px + 16, py + 10, w - 32, h - 14);
    // Purple cone roof
    ctx.fillStyle = '#7c3aed';
    ctx.beginPath();
    ctx.moveTo(px + w / 2, py - 12);
    ctx.lineTo(px + 10, py + 12);
    ctx.lineTo(px + w - 10, py + 12);
    ctx.closePath();
    ctx.fill();
    // Glowing crystal on top
    const glow = (Math.sin(Date.now() * 0.005) + 1) * 3;
    ctx.fillStyle = '#c084fc';
    ctx.beginPath();
    ctx.arc(px + w / 2, py - 14, 5 + glow * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawClericTempleSprite(px: number, py: number, w: number, h: number) {
    const { ctx } = this;
    // White marble walls
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(px + 6, py + 14, w - 12, h - 18);
    // Gold dome
    ctx.fillStyle = '#eab308';
    ctx.beginPath();
    ctx.arc(px + w / 2, py + 16, 20, Math.PI, 0);
    ctx.fill();
    // Sun cross
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(px + w / 2 - 2, py - 8, 4, 14);
    ctx.fillRect(px + w / 2 - 6, py - 4, 12, 4);
  }

  private drawDwarfSettlementSprite(px: number, py: number, w: number, h: number) {
    const { ctx } = this;
    // Heavy fortified stone
    ctx.fillStyle = '#292524';
    ctx.fillRect(px + 4, py + 10, w - 8, h - 14);
    ctx.fillStyle = '#d97706';
    ctx.fillRect(px + 8, py + 6, w - 16, 8);
    // Anvil emblem
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(px + w / 2 - 8, py + 26, 16, 8);
  }

  private drawMarketplaceSprite(px: number, py: number, w: number, h: number) {
    const { ctx } = this;
    // Canopy stalls with red/white stripes
    const numStripes = 6;
    const stripeW = w / numStripes;
    for (let i = 0; i < numStripes; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#ef4444' : '#f8fafc';
      ctx.fillRect(px + i * stripeW, py + 4, stripeW, 18);
    }
    // Wooden counter & barrels
    ctx.fillStyle = '#92400e';
    ctx.fillRect(px + 6, py + 22, w - 12, h - 26);
    // Potion flasks
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
    // Brick forge
    ctx.fillStyle = '#7f1d1d';
    ctx.fillRect(px + 6, py + 14, w - 12, h - 18);
    // Chimney with smoke
    ctx.fillStyle = '#450a0a';
    ctx.fillRect(px + w - 18, py - 4, 10, 20);
    // Glowing forge fire
    ctx.fillStyle = '#f97316';
    ctx.fillRect(px + 14, py + 30, 16, 12);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(px + 18, py + 33, 8, 6);
  }

  private drawGuardTowerSprite(px: number, py: number, w: number, h: number) {
    const { ctx } = this;
    ctx.fillStyle = '#475569';
    ctx.fillRect(px + 8, py + 4, w - 16, h - 8);
    // Parapet
    ctx.fillStyle = '#64748b';
    ctx.fillRect(px + 4, py - 2, w - 8, 8);
    // Arrow slit
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(px + w / 2 - 2, py + 16, 4, 12);
  }

  private drawInnSprite(px: number, py: number, w: number, h: number) {
    const { ctx } = this;
    ctx.fillStyle = '#b45309';
    ctx.fillRect(px + 6, py + 14, w - 12, h - 18);
    // Dark brown roof
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.moveTo(px + w / 2, py + 2);
    ctx.lineTo(px + 2, py + 16);
    ctx.lineTo(px + w - 2, py + 16);
    ctx.closePath();
    ctx.fill();
    // Beer mug sign
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(px + w / 2 - 6, py + 24, 12, 10);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px + w / 2 - 6, py + 22, 12, 3);
  }

  private drawStatueSprite(px: number, py: number, w: number, h: number) {
    const { ctx } = this;
    // Marble pedestal
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(px + 8, py + h - 16, w - 16, 14);
    // Golden sovereign statue
    ctx.fillStyle = '#eab308';
    ctx.fillRect(px + w / 2 - 6, py + 10, 12, 22);
    // Crown
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(px + w / 2 - 7, py + 4, 14, 6);
  }

  private renderLair(lair: MonsterLair, state: GameState) {
    const { ctx } = this;
    const ts = this.gridManager.tileSize;
    const px = lair.x * ts;
    const py = lair.y * ts;
    const w = lair.width * ts;
    const h = lair.height * ts;

    // Only render if explored
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
        ctx.fillStyle = '#10b981'; // Green slime
        ctx.fillRect(px + 8, py + 8, w - 16, h - 16);
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 6, py + 6, w - 12, h - 12);
        break;
      case 'graveyard':
        ctx.fillStyle = '#292524';
        ctx.fillRect(px + 4, py + 6, w - 8, h - 10);
        // Tombstones
        ctx.fillStyle = '#78716c';
        ctx.fillRect(px + 8, py + 10, 8, 12);
        ctx.fillRect(px + 24, py + 12, 8, 14);
        break;
      case 'goblin_hut':
        // Mud hut
        ctx.fillStyle = '#713f12';
        ctx.beginPath();
        ctx.arc(px + w / 2, py + h / 2 + 4, 16, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#ca8a04'; // Straw thatch
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
        // Lava veins
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

  private renderHero(hero: Hero, state: GameState) {
    if (hero.isDead) return;
    const { ctx } = this;
    const x = hero.x;
    const y = hero.y;

    // Check if visible
    if (!this.gridManager.isPixelVisible(x, y)) return;

    const isSelected = state.selectedEntity?.type === 'hero' && state.selectedEntity.id === hero.id;

    // Selection ring
    if (isSelected) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y + 4, 12, 6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + 5, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    const classDef = HERO_CLASS_DEFINITIONS[hero.heroClass];

    // Character body
    const isAttacking = hero.isAttackingAnimation > 0;
    const bob = Math.sin(Date.now() * 0.01) * (hero.state === 'wandering' || hero.state === 'pursuing_flag' ? 2 : 0);

    ctx.fillStyle = classDef.color;
    ctx.fillRect(x - 5, y - 10 + bob, 10, 12);

    // Head
    ctx.fillStyle = '#fed7aa'; // Skin tone
    ctx.beginPath();
    ctx.arc(x, y - 14 + bob, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Helmet / Hair
    if (hero.heroClass === 'warrior' || hero.heroClass === 'dwarf') {
      ctx.fillStyle = '#94a3b8'; // Iron helm
      ctx.fillRect(x - 5, y - 18 + bob, 10, 5);
    } else if (hero.heroClass === 'wizard') {
      ctx.fillStyle = '#6d28d9'; // Wizard hat
      ctx.beginPath();
      ctx.moveTo(x, y - 24 + bob);
      ctx.lineTo(x - 6, y - 16 + bob);
      ctx.lineTo(x + 6, y - 16 + bob);
      ctx.closePath();
      ctx.fill();
    } else if (hero.heroClass === 'ranger' || hero.heroClass === 'elf') {
      ctx.fillStyle = '#047857'; // Green hood
      ctx.beginPath();
      ctx.arc(x, y - 15 + bob, 5.5, Math.PI, 0);
      ctx.fill();
    }

    // Weapon / Attack animation
    if (isAttacking) {
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 2;
      const attackDir = hero.direction === 'right' ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(x, y - 6 + bob);
      ctx.lineTo(x + attackDir * 14, y - 10 + bob);
      ctx.stroke();
    }

    // HP Bar
    const hpW = 20;
    const hpH = 3;
    const hpPercent = Math.max(0, hero.hp / hero.maxHp);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x - hpW / 2, y - 22 + bob, hpW, hpH);
    ctx.fillStyle = hpPercent > 0.5 ? '#22c55e' : (hpPercent > 0.25 ? '#eab308' : '#ef4444');
    ctx.fillRect(x - hpW / 2, y - 22 + bob, hpW * hpPercent, hpH);

    // Level Badge above head
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x - 5, y - 29 + bob, 10, 8);
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${hero.level}`, x, y - 23 + bob);
  }

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
      ctx.ellipse(x, y + 4, 12, 6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(x, y + 4, monster.isBoss ? 16 : 8, monster.isBoss ? 8 : 4, 0, 0, Math.PI * 2);
    ctx.fill();

    const def = MONSTER_DEFINITIONS[monster.type];
    ctx.fillStyle = def.color;

    if (monster.type === 'giant_rat') {
      ctx.beginPath();
      ctx.ellipse(x, y - 2, 7, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (monster.type === 'red_dragon') {
      // Big Boss Dragon
      ctx.fillStyle = '#991b1b';
      // Wings
      ctx.beginPath();
      ctx.moveTo(x - 24, y - 28);
      ctx.lineTo(x, y - 10);
      ctx.lineTo(x + 24, y - 28);
      ctx.fill();
      // Body
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.arc(x, y - 12, 14, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Standard bipedal monster
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
    ctx.fillRect(x - hpW / 2, y - (monster.isBoss ? 32 : 18), hpW, hpH);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(x - hpW / 2, y - (monster.isBoss ? 32 : 18), hpW * hpPercent, hpH);
  }

  private renderTaxCollector(tc: TaxCollector, state: GameState) {
    const { ctx } = this;
    if (!this.gridManager.isPixelVisible(tc.x, tc.y)) return;

    const isSelected = state.selectedEntity?.type === 'tax_collector' && state.selectedEntity.id === tc.id;
    const bob = Math.sin(Date.now() * 0.008) * 2;

    // Selection ring
    if (isSelected) {
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(tc.x, tc.y + 4, 14, 7, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(tc.x, tc.y + 5, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body (Royal Purple Tunic with Gold Trim)
    ctx.fillStyle = '#6b21a8';
    ctx.fillRect(tc.x - 6, tc.y - 12 + bob, 12, 14);

    // Gold Trim / Sash
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(tc.x - 6, tc.y - 6 + bob, 12, 2.5);
    ctx.fillRect(tc.x - 1, tc.y - 12 + bob, 2, 14);

    // Head
    ctx.fillStyle = '#fed7aa';
    ctx.beginPath();
    ctx.arc(tc.x, tc.y - 16 + bob, 5, 0, Math.PI * 2);
    ctx.fill();

    // Renaissance Feathered Beret (Purple Velvet + Gold Ribbon)
    ctx.fillStyle = '#581c87';
    ctx.beginPath();
    ctx.ellipse(tc.x, tc.y - 20 + bob, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(tc.x - 7, tc.y - 19 + bob, 14, 2);

    // White Feather Plume
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tc.x - 3, tc.y - 20 + bob);
    ctx.quadraticCurveTo(tc.x - 10, tc.y - 28 + bob, tc.x - 7, tc.y - 32 + bob);
    ctx.stroke();

    // Ledger Book under right arm
    ctx.fillStyle = '#78350f';
    ctx.fillRect(tc.x - 9, tc.y - 10 + bob, 4, 8);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(tc.x - 9, tc.y - 8 + bob, 4, 2);

    // Heavy Coin Sack on Back
    const sackSize = tc.goldCarried > 0 ? Math.min(10, 6 + (tc.goldCarried / 40) * 3) : 5;
    ctx.fillStyle = '#b45309'; // Burlap brown
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

    // Flag Pole
    ctx.strokeStyle = '#d4d4d8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 26);
    ctx.stroke();

    // Banner color
    ctx.fillStyle = flag.type === 'attack' ? '#dc2626' : (flag.type === 'explore' ? '#2563eb' : '#eab308');
    ctx.beginPath();
    ctx.moveTo(x, y - 26);
    ctx.lineTo(x + 18, y - 20);
    ctx.lineTo(x, y - 14);
    ctx.closePath();
    ctx.fill();

    // Bounty Gold badge
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
    ctx.fillText(ft.text, ft.x, ft.y);
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
          // Unexplored: Complete black
          ctx.fillStyle = '#090d16';
          ctx.fillRect(px, py, ts, ts);
        } else if (!this.gridManager.visible[y][x]) {
          // Explored but currently in shadow: 45% dark tint
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
      ctx.fillStyle = 'rgba(236, 72, 153, 0.1)';
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
      ctx.fillStyle = 'rgba(251, 191, 36, 0.5)';
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
