import { MAP_CONFIG } from '../constants';
import { Building, MonsterLair, Position } from '../types';

export class GridManager {
  public width: number;
  public height: number;
  public tileSize: number;
  public grid: number[][]; // 0: grass, 1: dirt_road, 2: water, 3: trees, 4: rocks
  public explored: boolean[][];
  public visible: boolean[][];
  public roadVersion: number = 0;

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

    // Place natural features (forest clusters, rivers, bridges, rock formations)
    const centerX = Math.floor(this.width / 2);
    const centerY = Math.floor(this.height / 2);

    // 1. Natural Winding Rivers with Generous Stone Arch Bridges
    // Western Countryside River
    const westOffset = Math.floor(this.width * 0.26);
    const eastOffset = Math.floor(this.width * 0.30);
    const bridgeY1 = Math.floor(this.height * 0.28);
    const bridgeY2 = Math.floor(this.height * 0.72);
    const westBridgeRows = [bridgeY1, bridgeY1 + 1, bridgeY2, bridgeY2 + 1];

    for (let y = 0; y < this.height; y++) {
      const rx = Math.floor(centerX - westOffset + Math.sin(y * 0.13) * 5 + Math.cos(y * 0.05) * 3);
      const isBridge = westBridgeRows.includes(y);
      for (let w = 0; w < 2; w++) {
        const tx = rx + w;
        if (this.isValid(tx, y)) {
          this.grid[y][tx] = isBridge ? 5 : 2; // 5: bridge, 2: water
        }
      }

      // Pave bridge approach roads on both riverbanks
      if (isBridge) {
        if (this.isValid(rx - 1, y)) this.grid[y][rx - 1] = 1;
        if (this.isValid(rx + 2, y)) this.grid[y][rx + 2] = 1;
      }
    }

    // Eastern Mountain Brook
    const bridgeY3 = Math.floor(this.height * 0.48);
    const eastBridgeRows = [bridgeY3, bridgeY3 + 1];
    for (let y = 0; y < this.height; y++) {
      const rx = Math.floor(centerX + eastOffset + Math.sin(y * 0.15 + 1.2) * 4);
      const isBridge = eastBridgeRows.includes(y);
      for (let w = 0; w < 2; w++) {
        const tx = rx + w;
        if (this.isValid(tx, y)) {
          this.grid[y][tx] = isBridge ? 5 : 2;
        }
      }

      if (isBridge) {
        if (this.isValid(rx - 1, y)) this.grid[y][rx - 1] = 1;
        if (this.isValid(rx + 2, y)) this.grid[y][rx + 2] = 1;
      }
    }

    // Forest clusters (away from center and rivers)
    const numForests = Math.max(12, Math.floor((this.width * this.height) / 220));
    for (let f = 0; f < numForests; f++) {
      const fx = Math.floor(Math.random() * (this.width - 12)) + 6;
      const fy = Math.floor(Math.random() * (this.height - 12)) + 6;
      // Skip center town area
      if (Math.hypot(fx - centerX, fy - centerY) < 14) continue;

      const radius = Math.floor(Math.random() * 3) + 2;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const gx = fx + dx;
          const gy = fy + dy;
          if (this.isValid(gx, gy) && Math.hypot(dx, dy) <= radius) {
            // Do not overwrite rivers or bridges
            if (this.grid[gy][gx] === 0 && Math.random() > 0.2) {
              this.grid[gy][gx] = 3; // trees
            }
          }
        }
      }
    }

    // Ponds / lakes
    const numPonds = Math.max(2, Math.floor((this.width * this.height) / 2000));
    for (let p = 0; p < numPonds; p++) {
      const px = Math.floor(Math.random() * (this.width - 16)) + 8;
      const py = Math.floor(Math.random() * (this.height - 16)) + 8;
      if (Math.hypot(px - centerX, py - centerY) < 18) continue;

      const pRadius = 2;
      for (let dy = -pRadius; dy <= pRadius; dy++) {
        for (let dx = -pRadius; dx <= pRadius; dx++) {
          const gx = px + dx;
          const gy = py + dy;
          if (this.isValid(gx, gy) && Math.hypot(dx, dy) <= pRadius) {
            if (this.grid[gy][gx] === 0 || this.grid[gy][gx] === 3) {
              this.grid[gy][gx] = 2; // water
            }
          }
        }
      }
    }

    // Rock formations
    const numRocks = Math.max(8, Math.floor((this.width * this.height) / 450));
    for (let r = 0; r < numRocks; r++) {
      const rx = Math.floor(Math.random() * (this.width - 10)) + 5;
      const ry = Math.floor(Math.random() * (this.height - 10)) + 5;
      if (Math.hypot(rx - centerX, ry - centerY) < 14) continue;

      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          if (this.isValid(rx + dx, ry + dy) && this.grid[ry + dy][rx + dx] === 0) {
            this.grid[ry + dy][rx + dx] = 4; // rock
          }
        }
      }
    }

    // Clear and pave central kingdom area
    for (let y = centerY - 6; y <= centerY + 6; y++) {
      for (let x = centerX - 6; x <= centerX + 6; x++) {
        if (this.isValid(x, y)) {
          this.grid[y][x] = 0; // clear grass
        }
      }
    }

    // Cobblestone town avenues extending outward from Palace perimeter (Palace occupies centerX-2..centerX+1, centerY-2..centerY+1)
    // South Royal Avenue (heading south from Palace Gate)
    for (let y = centerY + 2; y <= centerY + 8; y++) {
      if (this.isValid(centerX, y)) this.grid[y][centerX] = 1;
      if (this.isValid(centerX - 1, y)) this.grid[y][centerX - 1] = 1;
    }
    // North Road
    for (let y = centerY - 8; y <= centerY - 3; y++) {
      if (this.isValid(centerX, y)) this.grid[y][centerX] = 1;
      if (this.isValid(centerX - 1, y)) this.grid[y][centerX - 1] = 1;
    }
    // East Road
    for (let x = centerX + 2; x <= centerX + 8; x++) {
      if (this.isValid(x, centerY)) this.grid[centerY][x] = 1;
      if (this.isValid(x, centerY + 1)) this.grid[centerY + 1][x] = 1;
    }
    // West Road
    for (let x = centerX - 8; x <= centerX - 3; x++) {
      if (this.isValid(x, centerY)) this.grid[centerY][x] = 1;
      if (this.isValid(x, centerY + 1)) this.grid[centerY + 1][x] = 1;
    }

    // Reveal initial town center
    this.revealArea(centerX, centerY, 12);
    this.roadVersion = 1;
  }

  public clearRoadsUnderBuilding(area: { x: number; y: number; width: number; height: number }) {
    for (let y = area.y; y < area.y + area.height; y++) {
      for (let x = area.x; x < area.x + area.width; x++) {
        if (this.isValid(x, y) && this.grid[y][x] === 1) {
          this.grid[y][x] = 0; // return to clean grass
        }
      }
    }
  }

  public paveRoadToBuilding(building: Building, buildings: Building[] = [], lairs: MonsterLair[] = []) {
    const centerX = Math.floor(this.width / 2);
    const centerY = Math.floor(this.height / 2);

    // 1. Clear any road tiles directly beneath this building foundation
    this.clearRoadsUnderBuilding(building);

    // 2. Determine doorstep/entrance tile outside the building based on facing
    const facing = building.facing || 'south';
    let entranceX = Math.floor(building.x + building.width / 2);
    let entranceY = building.y + building.height; // South default

    if (facing === 'north') {
      entranceX = Math.floor(building.x + building.width / 2);
      entranceY = building.y - 1;
    } else if (facing === 'east') {
      entranceX = building.x + building.width;
      entranceY = Math.floor(building.y + building.height / 2);
    } else if (facing === 'west') {
      entranceX = building.x - 1;
      entranceY = Math.floor(building.y + building.height / 2);
    }

    entranceX = Math.max(1, Math.min(this.width - 2, entranceX));
    entranceY = Math.max(1, Math.min(this.height - 2, entranceY));

    // Helper to check if a tile is inside any solid building or lair
    const isTileInsideStructure = (tx: number, ty: number) => {
      for (const b of buildings) {
        if (b.hp <= 0 || b.type === 'marketplace' || b.type === 'statue_king') continue;
        if (tx >= b.x && tx < b.x + b.width && ty >= b.y && ty < b.y + b.height) return true;
      }
      for (const l of lairs) {
        if (l.hp <= 0) continue;
        if (tx >= l.x && tx < l.x + l.width && ty >= l.y && ty < l.y + l.height) return true;
      }
      return false;
    };

    // Pave entrance doorstep tile if not inside a structure
    if (!isTileInsideStructure(entranceX, entranceY) && (this.grid[entranceY][entranceX] === 0 || this.grid[entranceY][entranceX] === 3)) {
      this.grid[entranceY][entranceX] = 1;
    }

    // 3. Find closest existing road tile (or palace crossroads) that is NOT inside any structure
    let bestRoadTile: Position | null = null;
    let minRoadDist = Infinity;

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if ((this.grid[y][x] === 1 || this.grid[y][x] === 5) && !isTileInsideStructure(x, y)) {
          // Skip if inside this building's perimeter or right at entrance
          if (x >= building.x && x < building.x + building.width && y >= building.y && y < building.y + building.height) continue;
          if (x === entranceX && y === entranceY) continue;
          const d = Math.hypot(x - entranceX, y - entranceY);
          if (d < minRoadDist && d >= 1) {
            minRoadDist = d;
            bestRoadTile = { x, y };
          }
        }
      }
    }

    const palace = buildings.find(b => b.type === 'palace');
    const targetRoad = bestRoadTile || (palace ? { x: Math.floor(palace.x + palace.width / 2), y: palace.y + palace.height } : { x: centerX, y: centerY + 3 });

    // 4. BFS Pathfinding on Tile Grid avoiding water, rock, and all structures
    interface BFSNode {
      x: number;
      y: number;
      parent?: BFSNode;
    }

    const queue: BFSNode[] = [{ x: entranceX, y: entranceY }];
    const visited = new Uint8Array(this.width * this.height);
    visited[entranceY * this.width + entranceX] = 1;
    let reachedNode: BFSNode | null = null;
    let iterations = 0;

    const dirs = [
      { x: 0, y: 1 },
      { x: 0, y: -1 },
      { x: 1, y: 0 },
      { x: -1, y: 0 }
    ];

    while (queue.length > 0 && iterations < 800) {
      iterations++;
      const curr = queue.shift()!;
      if (curr.x === targetRoad.x && curr.y === targetRoad.y) {
        reachedNode = curr;
        break;
      }

      // If we touched any existing valid road tile outside the start point, we reached the road network!
      if ((curr.x !== entranceX || curr.y !== entranceY) && (this.grid[curr.y][curr.x] === 1 || this.grid[curr.y][curr.x] === 5) && !isTileInsideStructure(curr.x, curr.y)) {
        reachedNode = curr;
        break;
      }

      for (const d of dirs) {
        const nx = curr.x + d.x;
        const ny = curr.y + d.y;
        if (!this.isValid(nx, ny)) continue;
        const idx = ny * this.width + nx;
        if (visited[idx]) continue;
        visited[idx] = 1;

        // Cannot path through water, rock, or any solid building/lair
        const t = this.grid[ny][nx];
        if (t === 2 || t === 4) continue;
        if (isTileInsideStructure(nx, ny)) continue;

        queue.push({ x: nx, y: ny, parent: curr });
      }
    }

    // Pave along the BFS path from entrance to connected road
    let step: BFSNode | null | undefined = reachedNode;
    while (step) {
      if (!isTileInsideStructure(step.x, step.y)) {
        if (this.grid[step.y][step.x] === 0 || this.grid[step.y][step.x] === 3) {
          this.grid[step.y][step.x] = 1;
        }
      }
      step = step.parent;
    }

    // Safety: ensure all existing buildings and lairs have no road tiles beneath them
    for (const b of buildings) {
      if (b.type === 'marketplace' || b.type === 'statue_king') continue;
      this.clearRoadsUnderBuilding(b);
    }
    for (const l of lairs) {
      this.clearRoadsUnderBuilding(l);
    }

    this.roadVersion++;
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
    excludeBuildingId?: string,
    unitRadius: number = 7
  ): boolean {
    const centerTx = Math.floor(px / this.tileSize);
    const centerTy = Math.floor(py / this.tileSize);
    if (!this.isValid(centerTx, centerTy)) return false;
    const centerTile = this.grid[centerTy][centerTx];

    // 1. Terrain & Water/Rock checks
    // If unit center is on a stone bridge (tile 5), it is safely crossing the river roadway
    const isOnBridge = centerTile === 5;

    if (!isOnBridge) {
      if (centerTile === 2 || centerTile === 4) return false;

      // Test cardinal perimeter sample points of unit body for water & rock collision
      const r = Math.max(2, unitRadius - 1.5);
      const samplePoints = [
        { x: px - r, y: py },
        { x: px + r, y: py },
        { x: px, y: py - r },
        { x: px, y: py + r }
      ];

      for (const pt of samplePoints) {
        const tx = Math.floor(pt.x / this.tileSize);
        const ty = Math.floor(pt.y / this.tileSize);
        if (!this.isValid(tx, ty)) return false;
        const tile = this.grid[ty][tx];
        // If a perimeter sample is on a bridge, that point is safe
        if (tile === 5) continue;
        if (tile === 2 || tile === 4) return false;
      }
    }

    const ts = this.tileSize;

    // 2. Check solid buildings (Marketplace & Statue are open plazas heroes can walk through)
    for (const b of buildings) {
      if (b.hp <= 0) continue;
      if (b.type === 'marketplace' || b.type === 'statue_king') continue;
      if (excludeBuildingId && b.id === excludeBuildingId) continue;

      const bx = b.x * ts;
      const by = b.y * ts;
      const bw = b.width * ts;
      const bh = b.height * ts;

      if (
        px + unitRadius > bx &&
        px - unitRadius < bx + bw &&
        py + unitRadius > by &&
        py - unitRadius < by + bh
      ) {
        return false;
      }
    }

    // 3. Check monster lairs
    for (const l of lairs) {
      if (l.hp <= 0) continue;
      if (excludeBuildingId && l.id === excludeBuildingId) continue;
      const lx = l.x * ts;
      const ly = l.y * ts;
      const lw = l.width * ts;
      const lh = l.height * ts;

      if (
        px + unitRadius > lx &&
        px - unitRadius < lx + lw &&
        py + unitRadius > ly &&
        py - unitRadius < ly + lh
      ) {
        return false;
      }
    }

    return true;
  }

  public resolveCollision(
    entity: { x: number; y: number },
    buildings: Building[],
    lairs: MonsterLair[],
    excludeBuildingId?: string,
    unitRadius: number = 7
  ) {
    const ts = this.tileSize;
    for (const b of buildings) {
      if (b.hp <= 0) continue;
      if (b.type === 'marketplace' || b.type === 'statue_king') continue;
      if (excludeBuildingId && b.id === excludeBuildingId) continue;

      const bx = b.x * ts;
      const by = b.y * ts;
      const bw = b.width * ts;
      const bh = b.height * ts;

      if (
        entity.x + unitRadius > bx &&
        entity.x - unitRadius < bx + bw &&
        entity.y + unitRadius > by &&
        entity.y - unitRadius < by + bh
      ) {
        // Overlapping building! Push out along shortest penetration axis with clean 1px clearance
        const leftDist = entity.x - (bx - unitRadius);
        const rightDist = (bx + bw + unitRadius) - entity.x;
        const topDist = entity.y - (by - unitRadius);
        const bottomDist = (by + bh + unitRadius) - entity.y;

        const minDist = Math.min(leftDist, rightDist, topDist, bottomDist);
        if (minDist === leftDist) entity.x = bx - unitRadius - 1.5;
        else if (minDist === rightDist) entity.x = bx + bw + unitRadius + 1.5;
        else if (minDist === topDist) entity.y = by - unitRadius - 1.5;
        else if (minDist === bottomDist) entity.y = by + bh + unitRadius + 1.5;
      }
    }

    for (const l of lairs) {
      if (l.hp <= 0) continue;
      if (excludeBuildingId && l.id === excludeBuildingId) continue;
      const lx = l.x * ts;
      const ly = l.y * ts;
      const lw = l.width * ts;
      const lh = l.height * ts;

      if (
        entity.x + unitRadius > lx &&
        entity.x - unitRadius < lx + lw &&
        entity.y + unitRadius > ly &&
        entity.y - unitRadius < ly + lh
      ) {
        const leftDist = entity.x - (lx - unitRadius);
        const rightDist = (lx + lw + unitRadius) - entity.x;
        const topDist = entity.y - (ly - unitRadius);
        const bottomDist = (ly + lh + unitRadius) - entity.y;

        const minDist = Math.min(leftDist, rightDist, topDist, bottomDist);
        if (minDist === leftDist) entity.x = lx - unitRadius - 1.5;
        else if (minDist === rightDist) entity.x = lx + lw + unitRadius + 1.5;
        else if (minDist === topDist) entity.y = ly - unitRadius - 1.5;
        else if (minDist === bottomDist) entity.y = ly + lh + unitRadius + 1.5;
      }
    }
  }

  public isTileBlocked(
    tx: number,
    ty: number,
    buildings: Building[],
    lairs: MonsterLair[],
    excludeBuildingId?: string
  ): boolean {
    if (!this.isValid(tx, ty)) return true;
    const tile = this.grid[ty][tx];
    if (tile === 2 || tile === 4) return true; // water or rock

    for (const b of buildings) {
      if (b.hp <= 0) continue;
      if (b.type === 'marketplace' || b.type === 'statue_king') continue;
      if (tx >= b.x && tx < b.x + b.width && ty >= b.y && ty < b.y + b.height) {
        return true;
      }
    }

    for (const l of lairs) {
      if (l.hp <= 0) continue;
      if (tx >= l.x && tx < l.x + l.width && ty >= l.y && ty < l.y + l.height) {
        return true;
      }
    }

    return false;
  }

  public hasLineOfSight(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    buildings: Building[],
    lairs: MonsterLair[],
    excludeBuildingId?: string,
    unitRadius: number = 7
  ): boolean {
    const dist = Math.hypot(endX - startX, endY - startY);
    if (dist < 3) return true;

    // High resolution sampling to prevent corner clipping
    const step = 2.5;
    const steps = Math.ceil(dist / step);
    const dx = (endX - startX) / steps;
    const dy = (endY - startY) / steps;

    for (let i = 0; i <= steps; i++) {
      const cx = startX + dx * i;
      const cy = startY + dy * i;
      if (!this.isWalkablePosition(cx, cy, buildings, lairs, excludeBuildingId, unitRadius)) {
        return false;
      }
    }

    return true;
  }

  public getNearestExteriorWalkablePosition(
    fromX: number,
    fromY: number,
    building: { x: number; y: number; width: number; height: number; id?: string },
    buildings: Building[],
    lairs: MonsterLair[],
    margin: number = 10
  ): Position {
    const ts = this.tileSize;
    const bLeft = building.x * ts;
    const bRight = (building.x + building.width) * ts;
    const bTop = building.y * ts;
    const bBottom = (building.y + building.height) * ts;

    let cx = Math.max(bLeft - margin, Math.min(bRight + margin, fromX));
    let cy = Math.max(bTop - margin, Math.min(bBottom + margin, fromY));

    // If point is strictly inside or on the inner edge, project outward to nearest side
    if (fromX >= bLeft - 2 && fromX <= bRight + 2 && fromY >= bTop - 2 && fromY <= bBottom + 2) {
      const dLeft = Math.abs(fromX - bLeft);
      const dRight = Math.abs(bRight - fromX);
      const dTop = Math.abs(fromY - bTop);
      const dBottom = Math.abs(bBottom - fromY);
      const minD = Math.min(dLeft, dRight, dTop, dBottom);
      if (minD === dLeft) { cx = bLeft - margin; cy = fromY; }
      else if (minD === dRight) { cx = bRight + margin; cy = fromY; }
      else if (minD === dTop) { cx = fromX; cy = bTop - margin; }
      else { cx = fromX; cy = bBottom + margin; }
    }

    return this.findNearestWalkablePosition(cx, cy, buildings, lairs, building.id);
  }

  public findPath(
    startPx: number,
    startPy: number,
    endPx: number,
    endPy: number,
    buildings: Building[],
    lairs: MonsterLair[],
    excludeBuildingId?: string
  ): Position[] {
    // 1. Direct line-of-sight shortcut with generous corner clearance
    if (this.hasLineOfSight(startPx, startPy, endPx, endPy, buildings, lairs, excludeBuildingId, 9.5)) {
      return [{ x: endPx, y: endPy }];
    }

    let startTile = this.pixelToTile(startPx, startPy);
    let endTile = this.pixelToTile(endPx, endPy);

    if (!this.isValid(startTile.x, startTile.y)) return [{ x: endPx, y: endPy }];

    // If destination tile itself is blocked (e.g. inside a wall), find nearest adjacent walkable tile
    if (this.isTileBlocked(endTile.x, endTile.y, buildings, lairs, excludeBuildingId)) {
      let nearestDist = Infinity;
      let bestTile = endTile;
      for (let r = 1; r <= 4; r++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const nx = endTile.x + dx;
            const ny = endTile.y + dy;
            if (this.isValid(nx, ny) && !this.isTileBlocked(nx, ny, buildings, lairs, excludeBuildingId)) {
              const d = Math.hypot(nx - endTile.x, ny - endTile.y);
              if (d < nearestDist) {
                nearestDist = d;
                bestTile = { x: nx, y: ny };
              }
            }
          }
        }
        if (nearestDist < Infinity) break;
      }
      endTile = bestTile;
    }

    // If start tile itself is blocked (e.g. unit placed on edge), find nearest unblocked start tile
    if (this.isTileBlocked(startTile.x, startTile.y, buildings, lairs, excludeBuildingId)) {
      let nearestDist = Infinity;
      let bestStartTile = startTile;
      for (let r = 1; r <= 3; r++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const nx = startTile.x + dx;
            const ny = startTile.y + dy;
            if (this.isValid(nx, ny) && !this.isTileBlocked(nx, ny, buildings, lairs, excludeBuildingId)) {
              const d = Math.hypot(nx - startTile.x, ny - startTile.y);
              if (d < nearestDist) {
                nearestDist = d;
                bestStartTile = { x: nx, y: ny };
              }
            }
          }
        }
        if (nearestDist < Infinity) break;
      }
      startTile = bestStartTile;
    }

    if (startTile.x === endTile.x && startTile.y === endTile.y) {
      return [{ x: endPx, y: endPy }];
    }

    // A* Pathfinding with Min-Heap
    interface AStarNode {
      x: number;
      y: number;
      g: number;
      h: number;
      f: number;
      parent?: AStarNode;
    }

    const openList: AStarNode[] = [];
    const closedSet = new Uint8Array(this.width * this.height);
    const gScores = new Float32Array(this.width * this.height).fill(Infinity);

    const getIndex = (x: number, y: number) => y * this.width + x;
    const heuristic = (x1: number, y1: number, x2: number, y2: number) => {
      const dx = Math.abs(x1 - x2);
      const dy = Math.abs(y1 - y2);
      return Math.max(dx, dy) * 10 + Math.min(dx, dy) * 4;
    };

    const startNode: AStarNode = {
      x: startTile.x,
      y: startTile.y,
      g: 0,
      h: heuristic(startTile.x, startTile.y, endTile.x, endTile.y),
      f: heuristic(startTile.x, startTile.y, endTile.x, endTile.y)
    };

    openList.push(startNode);
    gScores[getIndex(startTile.x, startTile.y)] = 0;

    let targetNode: AStarNode | null = null;
    let closestNode: AStarNode = startNode;
    let closestHeuristic = startNode.h;

    const directions = [
      { x: 0, y: -1, cost: 10 },
      { x: 0, y: 1, cost: 10 },
      { x: -1, y: 0, cost: 10 },
      { x: 1, y: 0, cost: 10 },
      { x: -1, y: -1, cost: 14 },
      { x: 1, y: -1, cost: 14 },
      { x: -1, y: 1, cost: 14 },
      { x: 1, y: 1, cost: 14 }
    ];

    let iterations = 0;
    while (openList.length > 0 && iterations < 3000) {
      iterations++;
      let lowestIdx = 0;
      for (let i = 1; i < openList.length; i++) {
        if (openList[i].f < openList[lowestIdx].f) {
          lowestIdx = i;
        }
      }
      const current = openList.splice(lowestIdx, 1)[0];
      const currentIdx = getIndex(current.x, current.y);
      closedSet[currentIdx] = 1;

      if (current.x === endTile.x && current.y === endTile.y) {
        targetNode = current;
        break;
      }

      if (current.h < closestHeuristic) {
        closestHeuristic = current.h;
        closestNode = current;
      }

      for (const dir of directions) {
        const nx = current.x + dir.x;
        const ny = current.y + dir.y;

        if (!this.isValid(nx, ny)) continue;
        const nIdx = getIndex(nx, ny);
        if (closedSet[nIdx]) continue;

        if (this.isTileBlocked(nx, ny, buildings, lairs, excludeBuildingId)) continue;

        // Diagonal corner clearance check: both adjacent orthogonal tiles must be unblocked
        if (dir.x !== 0 && dir.y !== 0) {
          if (
            this.isTileBlocked(current.x + dir.x, current.y, buildings, lairs, excludeBuildingId) ||
            this.isTileBlocked(current.x, current.y + dir.y, buildings, lairs, excludeBuildingId)
          ) {
            continue;
          }
        }

        const tentativeG = current.g + dir.cost;
        if (tentativeG < gScores[nIdx]) {
          gScores[nIdx] = tentativeG;
          const h = heuristic(nx, ny, endTile.x, endTile.y);
          const neighborNode: AStarNode = {
            x: nx,
            y: ny,
            g: tentativeG,
            h,
            f: tentativeG + h,
            parent: current
          };

          const existingIdx = openList.findIndex(n => n.x === nx && n.y === ny);
          if (existingIdx >= 0) {
            openList[existingIdx] = neighborNode;
          } else {
            openList.push(neighborNode);
          }
        }
      }
    }

    const finalNode = targetNode || closestNode;
    const tilePath: { x: number; y: number }[] = [];
    let curr: AStarNode | undefined = finalNode;
    while (curr) {
      tilePath.unshift({ x: curr.x, y: curr.y });
      curr = curr.parent;
    }

    if (tilePath.length <= 1) {
      return [{ x: endPx, y: endPy }];
    }

    // Convert tile path to pixel centers
    const rawWaypoints: Position[] = tilePath.map(tp => this.tileToPixel(tp.x, tp.y));

    // String pulling / Line-of-Sight Path Smoothing with generous corner safety cushion
    const smoothPath: Position[] = [rawWaypoints[0]];
    let curIndex = 0;
    while (curIndex < rawWaypoints.length - 1) {
      let furthest = curIndex + 1;
      for (let j = rawWaypoints.length - 1; j > curIndex + 1; j--) {
        if (this.hasLineOfSight(rawWaypoints[curIndex].x, rawWaypoints[curIndex].y, rawWaypoints[j].x, rawWaypoints[j].y, buildings, lairs, excludeBuildingId, 10.5)) {
          furthest = j;
          break;
        }
      }
      smoothPath.push(rawWaypoints[furthest]);
      curIndex = furthest;
    }

    // Replace final destination with exact destination coordinate if line of sight is clear
    if (this.hasLineOfSight(smoothPath[smoothPath.length - 1].x, smoothPath[smoothPath.length - 1].y, endPx, endPy, buildings, lairs, excludeBuildingId, 8.5)) {
      smoothPath[smoothPath.length - 1] = { x: endPx, y: endPy };
    } else {
      smoothPath.push({ x: endPx, y: endPy });
    }

    // Remove first waypoint if already very close
    if (smoothPath.length > 1 && Math.hypot(smoothPath[0].x - startPx, smoothPath[0].y - startPy) < 8) {
      smoothPath.shift();
    }

    return smoothPath;
  }

  public moveEntityAlongPath(
    entity: {
      x: number;
      y: number;
      speed: number;
      direction: 'left' | 'right' | 'up' | 'down';
      path?: Position[];
      pathTargetKey?: string;
    },
    targetX: number,
    targetY: number,
    delta: number,
    buildings: Building[],
    lairs: MonsterLair[],
    targetBuildingId?: string,
    speedMult: number = 1.0
  ): boolean {
    const distToTarget = Math.hypot(targetX - entity.x, targetY - entity.y);

    if (distToTarget < 6) {
      entity.path = undefined;
      entity.pathTargetKey = undefined;
      return true;
    }

    // 1. Direct line-of-sight shortcut: only use direct movement if line of sight is strictly unobstructed
    const hasActiveMultiPath = !!(entity.path && entity.path.length > 1);
    const hasClearLOS = this.hasLineOfSight(entity.x, entity.y, targetX, targetY, buildings, lairs, targetBuildingId, 8.5);
    const canDirectMove = (distToTarget < 12 && hasClearLOS) || (!hasActiveMultiPath && hasClearLOS);

    if (canDirectMove) {
      entity.path = undefined;
      entity.pathTargetKey = undefined;

      const moveDist = Math.min(distToTarget, entity.speed * speedMult * delta);
      const dx = targetX - entity.x;
      const dy = targetY - entity.y;
      const vx = (dx / distToTarget) * moveDist;
      const vy = (dy / distToTarget) * moveDist;

      if (this.isWalkablePosition(entity.x + vx, entity.y + vy, buildings, lairs, targetBuildingId, 7)) {
        entity.x += vx;
        entity.y += vy;
      } else if (this.isWalkablePosition(entity.x + vx, entity.y, buildings, lairs, targetBuildingId, 7)) {
        entity.x += vx;
      } else if (this.isWalkablePosition(entity.x, entity.y + vy, buildings, lairs, targetBuildingId, 7)) {
        entity.y += vy;
      } else {
        // Multi-angle deflection when brushing a corner
        const angles = [0.35, -0.35, 0.70, -0.70, 1.05, -1.05, 1.40, -1.40];
        let deflected = false;
        for (const ang of angles) {
          const cosA = Math.cos(ang);
          const sinA = Math.sin(ang);
          const rvx = (vx * cosA - vy * sinA) * 0.9;
          const rvy = (vx * sinA + vy * cosA) * 0.9;
          if (this.isWalkablePosition(entity.x + rvx, entity.y + rvy, buildings, lairs, targetBuildingId, 7)) {
            entity.x += rvx;
            entity.y += rvy;
            deflected = true;
            break;
          }
        }
        if (!deflected) {
          // Re-route with A* path on next frame
          entity.pathTargetKey = undefined;
        }
      }

      this.resolveCollision(entity, buildings, lairs, targetBuildingId, 7);

      if (Math.abs(dx) > Math.abs(dy)) {
        entity.direction = dx > 0 ? 'right' : 'left';
      } else {
        entity.direction = dy > 0 ? 'down' : 'up';
      }

      return Math.hypot(targetX - entity.x, targetY - entity.y) < 6;
    }

    // 2. Obstacle pathfinding: only recompute A* path if target moved significantly (> 20px) or path is empty
    let needNewPath = !entity.path || entity.path.length === 0 || !entity.pathTargetKey;
    if (entity.pathTargetKey) {
      const [lastTx, lastTy] = entity.pathTargetKey.split('_').map(Number);
      if (Math.hypot(targetX - lastTx, targetY - lastTy) > 20) {
        needNewPath = true;
      }
    }

    if (needNewPath) {
      entity.path = this.findPath(entity.x, entity.y, targetX, targetY, buildings, lairs, targetBuildingId);
      entity.pathTargetKey = `${Math.round(targetX)}_${Math.round(targetY)}`;
    }

    let moveBudget = entity.speed * speedMult * delta;
    let loopGuard = 0;

    while (entity.path && entity.path.length > 0 && moveBudget > 0.001 && loopGuard < 10) {
      loopGuard++;
      const wp = entity.path[0];
      const dx = wp.x - entity.x;
      const dy = wp.y - entity.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= Math.max(7, moveBudget)) {
        // Reached this waypoint, pop and continue to next
        entity.x = wp.x;
        entity.y = wp.y;
        moveBudget -= dist;
        entity.path.shift();

        if (Math.abs(dx) > Math.abs(dy)) {
          entity.direction = dx > 0 ? 'right' : 'left';
        } else if (Math.abs(dy) > 0.1) {
          entity.direction = dy > 0 ? 'down' : 'up';
        }
      } else {
        // Move partially towards waypoint with corner collision sliding
        const vx = (dx / dist) * moveBudget;
        const vy = (dy / dist) * moveBudget;

        if (this.isWalkablePosition(entity.x + vx, entity.y + vy, buildings, lairs, targetBuildingId, 7)) {
          entity.x += vx;
          entity.y += vy;
        } else if (this.isWalkablePosition(entity.x + vx, entity.y, buildings, lairs, targetBuildingId, 7)) {
          entity.x += vx;
        } else if (this.isWalkablePosition(entity.x, entity.y + vy, buildings, lairs, targetBuildingId, 7)) {
          entity.y += vy;
        } else {
          // Multi-angle deflection checks to smoothly glide around building corners and doorways
          const angles = [0.35, -0.35, 0.70, -0.70, 1.05, -1.05, 1.40, -1.40];
          let deflected = false;
          for (const ang of angles) {
            const cosA = Math.cos(ang);
            const sinA = Math.sin(ang);
            const rvx = (vx * cosA - vy * sinA) * 0.9;
            const rvy = (vx * sinA + vy * cosA) * 0.9;
            if (this.isWalkablePosition(entity.x + rvx, entity.y + rvy, buildings, lairs, targetBuildingId, 7)) {
              entity.x += rvx;
              entity.y += rvy;
              deflected = true;
              break;
            }
          }
          if (!deflected) {
            // Cannot make progress; clear path to recalculate on next tick
            entity.path = undefined;
            entity.pathTargetKey = undefined;
          }
        }
        moveBudget = 0;

        if (Math.abs(dx) > Math.abs(dy)) {
          entity.direction = dx > 0 ? 'right' : 'left';
        } else {
          entity.direction = dy > 0 ? 'down' : 'up';
        }
      }
    }

    this.resolveCollision(entity, buildings, lairs, targetBuildingId, 7);
    return Math.hypot(targetX - entity.x, targetY - entity.y) < 6;
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

    // Check terrain (cannot place on water, rocks, or bridges)
    for (let y = tileY; y < tileY + height; y++) {
      for (let x = tileX; x < tileX + width; x++) {
        if (this.grid[y][x] === 2 || this.grid[y][x] === 4 || this.grid[y][x] === 5) {
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

  public findNearestWalkablePosition(
    px: number,
    py: number,
    buildings: Building[],
    lairs: MonsterLair[],
    excludeBuildingId?: string
  ): Position {
    if (this.isWalkablePosition(px, py, buildings, lairs, excludeBuildingId, 4)) {
      return { x: px, y: py };
    }

    const ts = this.tileSize;
    const startTx = Math.floor(px / ts);
    const startTy = Math.floor(py / ts);

    // Search outwards in concentric rings up to 5 tiles (80px) for the nearest dry walkable ground
    for (let r = 1; r <= 5; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const tx = startTx + dx;
          const ty = startTy + dy;
          if (this.isValid(tx, ty)) {
            const candidatePx = (tx + 0.5) * ts;
            const candidatePy = (ty + 0.5) * ts;
            if (this.isWalkablePosition(candidatePx, candidatePy, buildings, lairs, excludeBuildingId, 4)) {
              return { x: candidatePx, y: candidatePy };
            }
          }
        }
      }
    }

    return { x: px, y: py };
  }

  public isPixelVisible(px: number, py: number): boolean {
    const tx = Math.floor(px / this.tileSize);
    const ty = Math.floor(py / this.tileSize);
    return this.isValid(tx, ty) ? this.visible[ty][tx] : false;
  }

  public findNearestUnexploredTile(startPx: number, startPy: number, maxRadiusTiles: number = 24): Position | null {
    const start = this.pixelToTile(startPx, startPy);
    for (let r = 2; r <= maxRadiusTiles; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) === r || Math.abs(dy) === r) {
            const tx = start.x + dx;
            const ty = start.y + dy;
            if (this.isValid(tx, ty) && !this.explored[ty][tx]) {
              const tile = this.grid[ty][tx];
              if (tile !== 2 && tile !== 4) {
                return this.tileToPixel(tx, ty);
              }
            }
          }
        }
      }
    }
    return null;
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
