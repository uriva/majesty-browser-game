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
      if (b.id === excludeBuildingId || b.hp <= 0) continue;
      if (b.type === 'marketplace' || b.type === 'statue_king') continue;
      if (tx >= b.x && tx < b.x + b.width && ty >= b.y && ty < b.y + b.height) {
        return true;
      }
    }

    for (const l of lairs) {
      if (l.id === excludeBuildingId || l.hp <= 0) continue;
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
    excludeBuildingId?: string
  ): boolean {
    const dist = Math.hypot(endX - startX, endY - startY);
    if (dist < 4) return true;

    const step = 8;
    const steps = Math.ceil(dist / step);
    const dx = (endX - startX) / steps;
    const dy = (endY - startY) / steps;

    for (let i = 1; i < steps; i++) {
      const cx = startX + dx * i;
      const cy = startY + dy * i;
      if (!this.isWalkablePosition(cx, cy, buildings, lairs, excludeBuildingId)) {
        return false;
      }
    }

    return true;
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
    // 1. Direct line-of-sight shortcut
    if (this.hasLineOfSight(startPx, startPy, endPx, endPy, buildings, lairs, excludeBuildingId)) {
      return [{ x: endPx, y: endPy }];
    }

    const startTile = this.pixelToTile(startPx, startPy);
    let endTile = this.pixelToTile(endPx, endPy);

    if (!this.isValid(startTile.x, startTile.y)) return [{ x: endPx, y: endPy }];

    // If destination tile itself is blocked (e.g. inside a wall), find nearest adjacent walkable tile
    if (this.isTileBlocked(endTile.x, endTile.y, buildings, lairs, excludeBuildingId)) {
      let nearestDist = Infinity;
      let bestTile = endTile;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
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
      endTile = bestTile;
    }

    if (startTile.x === endTile.x && startTile.y === endTile.y) {
      return [{ x: endPx, y: endPy }];
    }

    // A* Pathfinding
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
    while (openList.length > 0 && iterations < 800) {
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

        // Diagonal corner clearance check
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

    // String pulling / Line-of-Sight Path Smoothing
    const smoothPath: Position[] = [rawWaypoints[0]];
    let curIndex = 0;
    while (curIndex < rawWaypoints.length - 1) {
      let furthest = curIndex + 1;
      for (let j = rawWaypoints.length - 1; j > curIndex + 1; j--) {
        if (this.hasLineOfSight(rawWaypoints[curIndex].x, rawWaypoints[curIndex].y, rawWaypoints[j].x, rawWaypoints[j].y, buildings, lairs, excludeBuildingId)) {
          furthest = j;
          break;
        }
      }
      smoothPath.push(rawWaypoints[furthest]);
      curIndex = furthest;
    }

    // Replace final destination with exact destination coordinate if line of sight is clear
    if (this.hasLineOfSight(smoothPath[smoothPath.length - 1].x, smoothPath[smoothPath.length - 1].y, endPx, endPy, buildings, lairs, excludeBuildingId)) {
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

    if (distToTarget < 4) {
      entity.path = undefined;
      entity.pathTargetKey = undefined;
      return true;
    }

    // 1. Direct line of sight optimization: if path is clear, move directly without A* re-pathing jitter
    if (this.hasLineOfSight(entity.x, entity.y, targetX, targetY, buildings, lairs, targetBuildingId)) {
      entity.path = undefined;
      entity.pathTargetKey = undefined;

      const moveDist = Math.min(distToTarget, entity.speed * speedMult * delta);
      const dx = targetX - entity.x;
      const dy = targetY - entity.y;

      entity.x += (dx / distToTarget) * moveDist;
      entity.y += (dy / distToTarget) * moveDist;

      if (Math.abs(dx) > Math.abs(dy)) {
        entity.direction = dx > 0 ? 'right' : 'left';
      } else {
        entity.direction = dy > 0 ? 'down' : 'up';
      }

      return distToTarget <= moveDist + 4;
    }

    // 2. Obstacle pathfinding: only recompute A* path if target moved significantly (> 16px) or path is empty
    let needNewPath = !entity.path || entity.path.length === 0 || !entity.pathTargetKey;
    if (entity.pathTargetKey) {
      const [lastTx, lastTy] = entity.pathTargetKey.split('_').map(Number);
      if (Math.hypot(targetX - lastTx, targetY - lastTy) > 16) {
        needNewPath = true;
      }
    }

    if (needNewPath) {
      entity.path = this.findPath(entity.x, entity.y, targetX, targetY, buildings, lairs, targetBuildingId);
      entity.pathTargetKey = `${Math.round(targetX)}_${Math.round(targetY)}`;
    }

    let moveBudget = entity.speed * speedMult * delta;

    while (entity.path && entity.path.length > 0 && moveBudget > 0.001) {
      const wp = entity.path[0];
      const dx = wp.x - entity.x;
      const dy = wp.y - entity.y;
      const dist = Math.hypot(dx, dy);

      if (dist <= moveBudget) {
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
        // Move partially towards waypoint
        const vx = (dx / dist) * moveBudget;
        const vy = (dy / dist) * moveBudget;
        entity.x += vx;
        entity.y += vy;
        moveBudget = 0;

        if (Math.abs(dx) > Math.abs(dy)) {
          entity.direction = dx > 0 ? 'right' : 'left';
        } else {
          entity.direction = dy > 0 ? 'down' : 'up';
        }
      }
    }

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
