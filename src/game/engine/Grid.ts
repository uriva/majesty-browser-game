import { MAP_CONFIG } from '../constants';
import { Building, MonsterLair, Position } from '../types';

export class GridManager {
  public width: number;
  public height: number;
  public tileSize: number;
  public grid: number[][]; // 0: grass, 1: dirt_road, 2: water, 3: trees, 4: rocks
  public explored: boolean[][];
  public visible: boolean[][];

  constructor(width: number = MAP_CONFIG.DEFAULT_WIDTH, height: number = MAP_CONFIG.DEFAULT_HEIGHT, tileSize: number = MAP_CONFIG.TILE_SIZE) {
    this.width = width;
    this.height = height;
    this.tileSize = tileSize;
    this.grid = [];
    this.explored = [];
    this.visible = [];

    this.generateTerrain();
  }

  public generateTerrain() {
    this.grid = [];
    this.explored = [];
    this.visible = [];

    // Initialize blank grids
    for (let y = 0; y < this.height; y++) {
      const gridRow: number[] = [];
      const exploredRow: boolean[] = [];
      const visibleRow: boolean[] = [];
      for (let x = 0; x < this.width; x++) {
        gridRow.push(0); // default grass
        exploredRow.push(false);
        visibleRow.push(false);
      }
      this.grid.push(gridRow);
      this.explored.push(exploredRow);
      this.visible.push(visibleRow);
    }

    // Place natural features (forest clusters, ponds, rock formations)
    const centerX = Math.floor(this.width / 2);
    const centerY = Math.floor(this.height / 2);

    // Forest clusters (away from center)
    const numForests = 14;
    for (let f = 0; f < numForests; f++) {
      const fx = Math.floor(Math.random() * (this.width - 12)) + 6;
      const fy = Math.floor(Math.random() * (this.height - 12)) + 6;
      // Skip center town area
      if (Math.hypot(fx - centerX, fy - centerY) < 12) continue;

      const radius = Math.floor(Math.random() * 3) + 2;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const gx = fx + dx;
          const gy = fy + dy;
          if (this.isValid(gx, gy) && Math.hypot(dx, dy) <= radius) {
            if (Math.random() > 0.2) {
              this.grid[gy][gx] = 3; // trees
            }
          }
        }
      }
    }

    // Ponds / lakes (1 or 2 small natural lakes)
    const numPonds = 3;
    for (let p = 0; p < numPonds; p++) {
      const px = Math.floor(Math.random() * (this.width - 16)) + 8;
      const py = Math.floor(Math.random() * (this.height - 16)) + 8;
      if (Math.hypot(px - centerX, py - centerY) < 14) continue;

      const pRadius = 2;
      for (let dy = -pRadius; dy <= pRadius; dy++) {
        for (let dx = -pRadius; dx <= pRadius; dx++) {
          const gx = px + dx;
          const gy = py + dy;
          if (this.isValid(gx, gy) && Math.hypot(dx, dy) <= pRadius) {
            this.grid[gy][gx] = 2; // water
          }
        }
      }
    }

    // Rock formations
    const numRocks = 8;
    for (let r = 0; r < numRocks; r++) {
      const rx = Math.floor(Math.random() * (this.width - 10)) + 5;
      const ry = Math.floor(Math.random() * (this.height - 10)) + 5;
      if (Math.hypot(rx - centerX, ry - centerY) < 10) continue;

      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          if (this.isValid(rx + dx, ry + dy)) {
            this.grid[ry + dy][rx + dx] = 4; // rock
          }
        }
      }
    }

    // Clear and pave central kingdom area with cobblestone dirt roads
    for (let y = centerY - 6; y <= centerY + 6; y++) {
      for (let x = centerX - 6; x <= centerX + 6; x++) {
        if (this.isValid(x, y)) {
          this.grid[y][x] = 0; // clear grass
        }
      }
    }

    // Cobblestone town crossroad
    for (let x = centerX - 8; x <= centerX + 8; x++) {
      if (this.isValid(x, centerY)) this.grid[centerY][x] = 1;
      if (this.isValid(x, centerY + 1)) this.grid[centerY + 1][x] = 1;
    }
    for (let y = centerY - 8; y <= centerY + 8; y++) {
      if (this.isValid(centerX, y)) this.grid[y][centerX] = 1;
      if (this.isValid(centerX + 1, y)) this.grid[y][centerX + 1] = 1;
    }

    // Reveal initial town center
    this.revealArea(centerX, centerY, 12);
  }

  public isValid(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  public isWalkable(tileX: number, tileY: number): boolean {
    if (!this.isValid(tileX, tileY)) return false;
    const tile = this.grid[tileY][tileX];
    return tile !== 2 && tile !== 4; // water and rock block movement
  }

  public isWalkablePosition(
    px: number,
    py: number,
    buildings: Building[],
    lairs: MonsterLair[],
    excludeBuildingId?: string
  ): boolean {
    const tx = Math.floor(px / this.tileSize);
    const ty = Math.floor(py / this.tileSize);

    // 1. Terrain bounds & water/rock checks
    if (!this.isValid(tx, ty)) return false;
    const tile = this.grid[ty][tx];
    if (tile === 2 || tile === 4) return false;

    const ts = this.tileSize;
    const unitRadius = 5;

    // 2. Check solid buildings (Marketplace & Statue are open plazas heroes can walk through)
    for (const b of buildings) {
      if (b.id === excludeBuildingId || b.hp <= 0) continue;
      if (b.type === 'marketplace' || b.type === 'statue_king') continue;

      const bx = b.x * ts;
      const by = b.y * ts;
      const bw = b.width * ts;
      const bh = b.height * ts;

      if (
        px + unitRadius > bx + 2 &&
        px - unitRadius < bx + bw - 2 &&
        py + unitRadius > by + 2 &&
        py - unitRadius < by + bh - 2
      ) {
        return false;
      }
    }

    // 3. Check monster lairs
    for (const l of lairs) {
      if (l.id === excludeBuildingId || l.hp <= 0) continue;
      const lx = l.x * ts;
      const ly = l.y * ts;
      const lw = l.width * ts;
      const lh = l.height * ts;

      if (
        px + unitRadius > lx + 2 &&
        px - unitRadius < lx + lw - 2 &&
        py + unitRadius > ly + 2 &&
        py - unitRadius < ly + lh - 2
      ) {
        return false;
      }
    }

    return true;
  }

  public canPlaceBuilding(
    tileX: number,
    tileY: number,
    width: number,
    height: number,
    buildings: Building[],
    lairs: MonsterLair[]
  ): boolean {
    // Check bounds
    if (tileX < 1 || tileX + width >= this.width - 1 || tileY < 1 || tileY + height >= this.height - 1) {
      return false;
    }

    // Check terrain (cannot place on water or rocks)
    for (let y = tileY; y < tileY + height; y++) {
      for (let x = tileX; x < tileX + width; x++) {
        if (this.grid[y][x] === 2 || this.grid[y][x] === 4) {
          return false;
        }
      }
    }

    // Check overlap with existing buildings (plus 1 tile margin)
    for (const b of buildings) {
      if (
        tileX < b.x + b.width + 1 &&
        tileX + width + 1 > b.x &&
        tileY < b.y + b.height + 1 &&
        tileY + height + 1 > b.y
      ) {
        return false;
      }
    }

    // Check overlap with lairs
    for (const l of lairs) {
      if (
        tileX < l.x + l.width + 2 &&
        tileX + width + 2 > l.x &&
        tileY < l.y + l.height + 2 &&
        tileY + height + 2 > l.y
      ) {
        return false;
      }
    }

    return true;
  }

  public revealArea(centerX: number, centerY: number, radius: number) {
    const r2 = radius * radius;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy <= r2) {
          const gx = centerX + dx;
          const gy = centerY + dy;
          if (this.isValid(gx, gy)) {
            this.explored[gy][gx] = true;
            this.visible[gy][gx] = true;
          }
        }
      }
    }
  }

  public resetVisibility() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.visible[y][x] = false;
      }
    }
  }

  public isPixelExplored(px: number, py: number): boolean {
    const tx = Math.floor(px / this.tileSize);
    const ty = Math.floor(py / this.tileSize);
    return this.isValid(tx, ty) ? this.explored[ty][tx] : false;
  }

  public isPixelVisible(px: number, py: number): boolean {
    const tx = Math.floor(px / this.tileSize);
    const ty = Math.floor(py / this.tileSize);
    return this.isValid(tx, ty) ? this.visible[ty][tx] : false;
  }

  public pixelToTile(px: number, py: number): Position {
    return {
      x: Math.floor(px / this.tileSize),
      y: Math.floor(py / this.tileSize)
    };
  }

  public tileToPixel(tx: number, ty: number): Position {
    return {
      x: (tx + 0.5) * this.tileSize,
      y: (ty + 0.5) * this.tileSize
    };
  }
}
