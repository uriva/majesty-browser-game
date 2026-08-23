import * as THREE from 'three';
import { BUILDING_DEFINITIONS, HERO_CLASS_DEFINITIONS, MONSTER_DEFINITIONS } from '../constants';
import { Building, Corpse, Flag, FloatingText, GameState, Hero, Monster, MonsterLair, Particle, Peasant, Projectile, TaxCollector, Treasure } from '../types';
import { GridManager } from './Grid';

export class ThreeRenderer {
  private container: HTMLDivElement;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private gridManager: GridManager;

  // Lighting
  private ambientLight: THREE.AmbientLight;
  private dirLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;

  // Procedural Canvas Textures
  private grassTexture: THREE.CanvasTexture;
  private cobbleTexture: THREE.CanvasTexture;
  private stoneWallTexture: THREE.CanvasTexture;
  private thatchTexture: THREE.CanvasTexture;

  // Object pools / mappings
  private terrainGroup: THREE.Group;
  private fogGroup: THREE.Group;
  private buildingsMap: Map<string, THREE.Group> = new Map();
  private heroesMap: Map<string, THREE.Group> = new Map();
  private monstersMap: Map<string, THREE.Group> = new Map();
  private lairsMap: Map<string, THREE.Group> = new Map();
  private taxCollectorsMap: Map<string, THREE.Group> = new Map();
  private peasantsMap: Map<string, THREE.Group> = new Map();
  private treasuresMap: Map<string, THREE.Group> = new Map();
  private corpsesMap: Map<string, THREE.Group> = new Map();
  private flagsMap: Map<string, THREE.Group> = new Map();
  private projectilesMap: Map<string, THREE.Group> = new Map();
  private floatingTextsMap: Map<string, THREE.Sprite> = new Map();
  private heroLabelsMap: Map<string, { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture; sprite: THREE.Sprite; lastHp: number; lastLevel: number }> = new Map();

  // Selection & Placement Highlights
  private selectionGroup: THREE.Group;
  private placementPreviewGroup: THREE.Group;

  // Raycaster for 3D mouse interaction
  public raycaster: THREE.Raycaster = new THREE.Raycaster();
  public groundPlane: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  // Camera Orbit / Target
  public cameraTarget: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public cameraDistance: number = 380;
  public cameraPitch: number = 0.85; // Angle above horizon (~50 deg)
  public cameraYaw: number = 0.0;    // Rotation around Y axis
  public cameraMode: 'isometric' | 'free' | 'top_down' | 'follow' = 'isometric';
  private lastRenderTime: number = performance.now();

  constructor(container: HTMLDivElement, gridManager: GridManager) {
    this.container = container;
    this.gridManager = gridManager;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // Generate Procedural Textures
    this.grassTexture = this.createGrassTexture();
    this.cobbleTexture = this.createCobbleTexture();
    this.stoneWallTexture = this.createStoneWallTexture();
    this.thatchTexture = this.createThatchTexture();

    // 1. Scene Setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#090d16');
    this.scene.fog = new THREE.FogExp2('#090d16', 0.0012);

    // 2. Camera Setup
    this.camera = new THREE.PerspectiveCamera(45, width / height, 1, 3000);

    // 3. WebGL Renderer with Shadows & Antialiasing
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    container.appendChild(this.renderer.domElement);

    // 4. Lighting
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x334155, 0.45);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xfffbeb, 1.4);
    this.dirLight.position.set(250, 400, 200);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 10;
    this.dirLight.shadow.camera.far = 1500;
    const shadowD = 600;
    this.dirLight.shadow.camera.left = -shadowD;
    this.dirLight.shadow.camera.right = shadowD;
    this.dirLight.shadow.camera.top = shadowD;
    this.dirLight.shadow.camera.bottom = -shadowD;
    this.dirLight.shadow.bias = -0.0001;
    this.dirLight.shadow.normalBias = 0.05;
    this.scene.add(this.dirLight);

    // 5. Groups
    this.terrainGroup = new THREE.Group();
    this.fogGroup = new THREE.Group();
    this.selectionGroup = new THREE.Group();
    this.placementPreviewGroup = new THREE.Group();

    this.scene.add(this.terrainGroup);
    this.scene.add(this.fogGroup);
    this.scene.add(this.selectionGroup);
    this.scene.add(this.placementPreviewGroup);

    this.buildTerrain();
    this.buildFogOfWar();
    this.buildSelectionMeshes();
  }

  // --- PROCEDURAL PROCEDURAL TEXTURE GENERATORS ---
  private createGrassTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#2d6a4f';
    ctx.fillRect(0, 0, 256, 256);

    // Blade and patch variations
    for (let i = 0; i < 400; i++) {
      const x = Math.random() * 256;
      const y = Math.random() * 256;
      const shade = Math.random() > 0.5 ? '#40916c' : '#1b4332';
      ctx.fillStyle = shade;
      ctx.fillRect(x, y, Math.random() * 3 + 1, Math.random() * 6 + 2);
    }

    // Tiny clover & wild flower dots
    for (let f = 0; f < 35; f++) {
      const fx = Math.random() * 256;
      const fy = Math.random() * 256;
      ctx.fillStyle = Math.random() > 0.5 ? '#fbbf24' : '#f43f5e';
      ctx.beginPath();
      ctx.arc(fx, fy, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(12, 12);
    return tex;
  }

  private createCobbleTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#44403c';
    ctx.fillRect(0, 0, 256, 256);

    const stoneSize = 32;
    for (let y = 0; y < 256; y += stoneSize) {
      for (let x = 0; x < 256; x += stoneSize) {
        const ox = (y / stoneSize) % 2 === 0 ? 0 : stoneSize / 2;
        const px = (x + ox) % 256;
        ctx.fillStyle = '#78716c';
        ctx.beginPath();
        ctx.roundRect(px + 2, y + 2, stoneSize - 4, stoneSize - 4, 6);
        ctx.fill();

        ctx.fillStyle = '#a8a29e';
        ctx.beginPath();
        ctx.roundRect(px + 4, y + 4, stoneSize - 10, stoneSize - 10, 4);
        ctx.fill();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  private createStoneWallTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 256, 256);

    const blockH = 24;
    const blockW = 48;
    for (let y = 0; y < 256; y += blockH) {
      const row = Math.floor(y / blockH);
      const shift = (row % 2) * (blockW / 2);
      for (let x = -blockW; x < 256 + blockW; x += blockW) {
        ctx.fillStyle = (x + y) % 3 === 0 ? '#475569' : '#334155';
        ctx.fillRect(x + shift + 2, y + 2, blockW - 4, blockH - 4);
        ctx.fillStyle = '#64748b';
        ctx.fillRect(x + shift + 3, y + 3, blockW - 6, 2);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  private createThatchTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#b45309';
    ctx.fillRect(0, 0, 256, 256);

    for (let y = 0; y < 256; y += 16) {
      ctx.fillStyle = '#ca8a04';
      ctx.fillRect(0, y, 256, 12);
      ctx.fillStyle = '#eab308';
      for (let i = 0; i < 256; i += 8) {
        ctx.fillRect(i, y + 2, 4, 8);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  public handleResize() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  // --- BUILD 3D TERRAIN ---
  private buildTerrain() {
    const ts = this.gridManager.tileSize;
    const w = this.gridManager.width;
    const h = this.gridManager.height;

    // Base Ground Plane
    const groundGeo = new THREE.PlaneGeometry(w * ts, h * ts, w, h);
    groundGeo.rotateX(-Math.PI / 2);

    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x3d7a59,
      map: this.grassTexture,
      roughness: 0.85,
      metalness: 0.05
    });

    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.position.set((w * ts) / 2, 0, (h * ts) / 2);
    groundMesh.receiveShadow = true;
    this.terrainGroup.add(groundMesh);

    // Natural features (trees, rocks, roads, water)
    const rockGeo = new THREE.DodecahedronGeometry(5.5, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9 });

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const tile = this.gridManager.grid[y][x];
        const px = (x + 0.5) * ts;
        const pz = (y + 0.5) * ts;

        if (tile === 1) {
          // Cobblestone Road tile
          const roadGeo = new THREE.PlaneGeometry(ts, ts);
          roadGeo.rotateX(-Math.PI / 2);
          const roadMat = new THREE.MeshStandardMaterial({
            color: 0xa8a29e,
            map: this.cobbleTexture,
            roughness: 0.8
          });
          const roadMesh = new THREE.Mesh(roadGeo, roadMat);
          roadMesh.position.set(px, 0.2, pz);
          roadMesh.receiveShadow = true;
          this.terrainGroup.add(roadMesh);
        } else if (tile === 2) {
          // Water Pond
          const waterGeo = new THREE.PlaneGeometry(ts, ts);
          waterGeo.rotateX(-Math.PI / 2);
          const waterMat = new THREE.MeshStandardMaterial({
            color: 0x0284c7,
            roughness: 0.1,
            metalness: 0.3,
            transparent: true,
            opacity: 0.85
          });
          const waterMesh = new THREE.Mesh(waterGeo, waterMat);
          waterMesh.position.set(px, 0.4, pz);
          this.terrainGroup.add(waterMesh);
        } else if (tile === 3) {
          // Beautiful Organic Medieval Fantasy Tree (Oak, Pine, Birch variants)
          const variant = (x * 7 + y * 13) % 3;
          const tree = this.create3DTreeMesh(variant);
          const scale = 0.85 + ((x * 3 + y * 5) % 5) * 0.08;
          tree.scale.set(scale, scale, scale);
          tree.rotation.y = ((x * 11 + y * 17) % 360) * (Math.PI / 180);
          tree.position.set(px + ((x * 3) % 5 - 2), 0, pz + ((y * 3) % 5 - 2));
          this.terrainGroup.add(tree);
        } else if (tile === 4) {
          // Mountain Rock Formation with natural facets
          const rock = new THREE.Mesh(rockGeo, rockMat);
          rock.position.set(px, 3.5, pz);
          rock.scale.set(1.4, 1.2, 1.3);
          rock.rotation.set((x * 0.4) % Math.PI, (y * 0.6) % Math.PI, 0.2);
          rock.castShadow = true;
          rock.receiveShadow = true;
          this.terrainGroup.add(rock);
        }
      }
    }
  }

  private create3DTreeMesh(variant: number): THREE.Group {
    const tree = new THREE.Group();

    if (variant === 0) {
      // 1. Lush Royal Broadleaf Oak Tree (Gnarled trunk + 5 fluffy organic foliage cloud clusters)
      const trunkGeo = new THREE.CylinderGeometry(1.4, 2.2, 8, 7);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 4;
      trunk.castShadow = true;
      tree.add(trunk);

      // Overlapping foliage cloud spheres
      const leafColors = [0x15803d, 0x16a34a, 0x166534, 0x4d7c0f];
      const cloudClusters = [
        { x: 0, y: 11, z: 0, r: 5.5, col: leafColors[0] },
        { x: -2.6, y: 9.5, z: 1.5, r: 4.2, col: leafColors[1] },
        { x: 2.6, y: 10.0, z: -1.2, r: 4.0, col: leafColors[2] },
        { x: 1.2, y: 13.0, z: 1.8, r: 3.8, col: leafColors[3] },
        { x: -1.0, y: 13.5, z: -1.8, r: 3.5, col: leafColors[1] },
      ];

      cloudClusters.forEach(c => {
        const leafGeo = new THREE.DodecahedronGeometry(c.r, 1);
        const leafMat = new THREE.MeshStandardMaterial({ color: c.col, roughness: 0.8 });
        const cloud = new THREE.Mesh(leafGeo, leafMat);
        cloud.position.set(c.x, c.y, c.z);
        cloud.castShadow = true;
        cloud.receiveShadow = true;
        tree.add(cloud);
      });
    } else if (variant === 1) {
      // 2. Majestic Tiered Nordic Pine / Fir Tree (4 Layered Scalloped Boughs)
      const trunkGeo = new THREE.CylinderGeometry(1.2, 1.8, 10, 6);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x381e05, roughness: 0.95 });
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 5;
      trunk.castShadow = true;
      tree.add(trunk);

      const tiers = [
        { y: 8.5, r: 6.8, h: 7.5, col: 0x064e3b },
        { y: 13.0, r: 5.4, h: 6.5, col: 0x047857 },
        { y: 17.0, r: 4.2, h: 5.5, col: 0x065f46 },
        { y: 20.5, r: 2.8, h: 4.5, col: 0x0f766e },
      ];

      tiers.forEach((t, i) => {
        const tierGeo = new THREE.ConeGeometry(t.r, t.h, 7);
        const tierMat = new THREE.MeshStandardMaterial({ color: t.col, roughness: 0.8 });
        const bough = new THREE.Mesh(tierGeo, tierMat);
        bough.position.y = t.y;
        bough.rotation.y = (i * Math.PI) / 4;
        bough.castShadow = true;
        bough.receiveShadow = true;
        tree.add(bough);
      });
    } else {
      // 3. Golden Autumn Birch Tree (Pale bark with warm amber/golden foliage)
      const trunkGeo = new THREE.CylinderGeometry(1.1, 1.5, 9, 6);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.7 });
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 4.5;
      trunk.castShadow = true;
      tree.add(trunk);

      const goldColors = [0xd97706, 0xeab308, 0xca8a04, 0x84cc16];
      const clusters = [
        { x: 0, y: 11.5, z: 0, r: 4.8, col: goldColors[0] },
        { x: -2.2, y: 10.0, z: 1.2, r: 3.6, col: goldColors[1] },
        { x: 2.0, y: 11.0, z: -1.0, r: 3.5, col: goldColors[2] },
        { x: 0.5, y: 14.0, z: 1.0, r: 3.2, col: goldColors[3] },
      ];

      clusters.forEach(c => {
        const leafGeo = new THREE.DodecahedronGeometry(c.r, 1);
        const leafMat = new THREE.MeshStandardMaterial({ color: c.col, roughness: 0.8 });
        const cloud = new THREE.Mesh(leafGeo, leafMat);
        cloud.position.set(c.x, c.y, c.z);
        cloud.castShadow = true;
        cloud.receiveShadow = true;
        tree.add(cloud);
      });
    }

    return tree;
  }

  // --- BUILD SELECTION HIGHLIGHT MESHES ---
  private buildSelectionMeshes() {
    this.selectionGroup.clear();
    this.selectionGroup.visible = false;
  }

  // --- BUILD 3D FOG OF WAR SHROUD ---
  private buildFogOfWar() {
    const ts = this.gridManager.tileSize;
    const w = this.gridManager.width;
    const h = this.gridManager.height;

    const fogTileGeo = new THREE.PlaneGeometry(ts, ts);
    fogTileGeo.rotateX(-Math.PI / 2);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const fogMat = new THREE.MeshBasicMaterial({
          color: 0x090d16,
          transparent: true,
          opacity: 1.0,
          depthWrite: false
        });
        const fogTile = new THREE.Mesh(fogTileGeo, fogMat);
        fogTile.position.set((x + 0.5) * ts, 1.5, (y + 0.5) * ts);
        fogTile.name = `fog_${x}_${y}`;
        this.fogGroup.add(fogTile);
      }
    }
  }

  private updateFogOfWar(state: GameState) {
    for (let y = 0; y < this.gridManager.height; y++) {
      for (let x = 0; x < this.gridManager.width; x++) {
        const fogTile = this.fogGroup.getObjectByName(`fog_${x}_${y}`) as THREE.Mesh;
        if (!fogTile) continue;

        const isExplored = this.gridManager.explored[y]?.[x];
        const isVisible = this.gridManager.visible[y]?.[x];

        const mat = fogTile.material as THREE.MeshBasicMaterial;
        if (!isExplored) {
          mat.opacity = 1.0;
          fogTile.visible = true;
        } else if (!isVisible) {
          mat.opacity = 0.48;
          fogTile.visible = true;
        } else {
          fogTile.visible = false;
        }
      }
    }
  }

  private updateCamera(state: GameState) {
    if (this.cameraMode === 'follow' && state.selectedEntity?.type === 'hero') {
      const hero = state.heroes.find(h => h.id === state.selectedEntity?.id);
      if (hero) {
        this.cameraTarget.set(hero.x, 0, hero.y);
      }
    } else {
      this.cameraTarget.set(state.camera.x, 0, state.camera.y);
    }

    const cosPitch = Math.cos(this.cameraPitch);
    const sinPitch = Math.sin(this.cameraPitch);
    const sinYaw = Math.sin(this.cameraYaw);
    const cosYaw = Math.cos(this.cameraYaw);

    const dist = this.cameraDistance;
    state.camera.zoom = 380 / dist;

    const camX = this.cameraTarget.x + dist * cosPitch * sinYaw;
    const camY = this.cameraTarget.y + dist * sinPitch;
    const camZ = this.cameraTarget.z + dist * cosPitch * cosYaw;

    this.camera.position.set(camX, camY, camZ);
    this.camera.lookAt(this.cameraTarget);
  }

  private updateDayNightLighting(state: GameState) {
    const timeNorm = (state.stats.dayTime / 2400) * Math.PI * 2;
    const sunDist = 500;

    const sunX = Math.sin(timeNorm) * sunDist + this.cameraTarget.x;
    const sunY = Math.max(80, Math.cos(timeNorm) * sunDist + 150);
    const sunZ = Math.cos(timeNorm) * 200 + this.cameraTarget.z;

    this.dirLight.position.set(sunX, sunY, sunZ);
    this.dirLight.target.position.copy(this.cameraTarget);

    if (state.dayPhase === 'night') {
      this.dirLight.color.setHex(0x60a5fa);
      this.dirLight.intensity = 0.35;
      this.ambientLight.color.setHex(0x1e1b4b);
      this.ambientLight.intensity = 0.3;
      this.scene.background = new THREE.Color('#030712');
    } else if (state.dayPhase === 'dusk') {
      this.dirLight.color.setHex(0xf97316);
      this.dirLight.intensity = 1.0;
      this.ambientLight.color.setHex(0x78350f);
      this.ambientLight.intensity = 0.55;
      this.scene.background = new THREE.Color('#1c1917');
    } else if (state.dayPhase === 'dawn') {
      this.dirLight.color.setHex(0xf472b6);
      this.dirLight.intensity = 0.9;
      this.ambientLight.color.setHex(0x831843);
      this.ambientLight.intensity = 0.5;
      this.scene.background = new THREE.Color('#0f172a');
    } else {
      this.dirLight.color.setHex(0xfffbeb);
      this.dirLight.intensity = 1.4;
      this.ambientLight.color.setHex(0xffffff);
      this.ambientLight.intensity = 0.65;
      this.scene.background = new THREE.Color('#090d16');
    }
  }

  // --- SMOOTH ROTATION HELPER ---
  private smoothRotate(group: THREE.Group, targetAngle: number, delta: number, speed: number = 14) {
    let diff = targetAngle - group.rotation.y;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    group.rotation.y += diff * Math.min(1.0, speed * delta);
  }

  // --- MAIN RENDER METHOD ---
  public render(state: GameState, mouseWorldPos: { x: number; y: number } | null) {
    const now = performance.now();
    const delta = Math.min(0.1, (now - this.lastRenderTime) / 1000);
    this.lastRenderTime = now;

    this.updateCamera(state);
    this.updateDayNightLighting(state);
    this.updateFogOfWar(state);

    this.updateBuildings(state);
    this.updateLairs(state);
    this.updateTreasures(state);
    this.updateFlags(state);
    this.updateTaxCollectors(state, delta);
    this.updatePeasants(state, delta);
    this.updateHeroes(state, delta);
    this.updateMonsters(state, delta);
    this.updateCorpses(state);
    this.updateProjectiles(state);
    this.updateFloatingTexts(state);

    // Update Selection Visuals
    this.updateSelectionVisuals(state);

    // Update Placement Preview Hover Hologram
    this.updatePlacementPreview(state, mouseWorldPos);

    this.renderer.render(this.scene, this.camera);
  }

  // --- SELECTION HIGHLIGHT ---
  private currentSelectionKey: string = '';

  private updateSelectionVisuals(state: GameState) {
    if (!state.selectedEntity) {
      this.selectionGroup.visible = false;
      this.currentSelectionKey = '';
      return;
    }

    const key = `${state.selectedEntity.type}_${state.selectedEntity.id}`;
    const ts = this.gridManager.tileSize;
    const pulse = 0.75 + Math.sin(Date.now() * 0.006) * 0.2;

    if (this.currentSelectionKey !== key) {
      this.currentSelectionKey = key;
      this.selectionGroup.clear();

      if (state.selectedEntity.type === 'building' || state.selectedEntity.type === 'lair') {
        const b = state.selectedEntity.type === 'building'
          ? state.buildings.find(build => build.id === state.selectedEntity?.id)
          : state.lairs.find(l => l.id === state.selectedEntity?.id);

        if (b) {
          const bw = b.width * ts;
          const bh = b.height * ts;
          const halfW = bw / 2 + 1.5;
          const halfH = bh / 2 + 1.5;
          const colorHex = state.selectedEntity.type === 'lair' ? 0xf43f5e : 0xfbbf24;

          // 1. Soft glowing ground plane
          const glowGeo = new THREE.PlaneGeometry(bw, bh);
          glowGeo.rotateX(-Math.PI / 2);
          const glowMat = new THREE.MeshBasicMaterial({
            color: colorHex,
            transparent: true,
            opacity: 0.16,
            depthWrite: false
          });
          const glow = new THREE.Mesh(glowGeo, glowMat);
          glow.position.y = 0.5;
          this.selectionGroup.add(glow);

          // 2. Crisp perimeter line frame
          const points = [
            new THREE.Vector3(-halfW, 0.7, -halfH),
            new THREE.Vector3(halfW, 0.7, -halfH),
            new THREE.Vector3(halfW, 0.7, halfH),
            new THREE.Vector3(-halfW, 0.7, halfH)
          ];
          const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
          const lineMat = new THREE.LineBasicMaterial({ color: colorHex, linewidth: 2 });
          const lineLoop = new THREE.LineLoop(lineGeo, lineMat);
          this.selectionGroup.add(lineLoop);

          // 3. Four Elegant Corner Brackets
          const armLen = Math.min(10, halfW * 0.4);
          const corners = [
            // Top-Left
            [-halfW, -halfH, armLen, 0, 0, armLen],
            // Top-Right
            [halfW, -halfH, -armLen, 0, 0, armLen],
            // Bottom-Left
            [-halfW, halfH, armLen, 0, 0, -armLen],
            // Bottom-Right
            [halfW, halfH, -armLen, 0, 0, -armLen]
          ];

          corners.forEach(([cx, cz, dx, , , dz]) => {
            const cPoints = [
              new THREE.Vector3(cx + dx, 0.9, cz),
              new THREE.Vector3(cx, 0.9, cz),
              new THREE.Vector3(cx, 0.9, cz + dz)
            ];
            const cGeo = new THREE.BufferGeometry().setFromPoints(cPoints);
            const cMat = new THREE.LineBasicMaterial({ color: colorHex, linewidth: 3 });
            const cLine = new THREE.Line(cGeo, cMat);
            this.selectionGroup.add(cLine);
          });
        }
      } else {
        // Unit Selection (Hero, Monster, Tax Collector, Peasant)
        let colorHex = 0x38bdf8; // Default blue for hero
        let radius = 4.5;

        if (state.selectedEntity.type === 'monster') {
          const m = state.monsters.find(mon => mon.id === state.selectedEntity?.id);
          colorHex = 0xf43f5e;
          if (m?.type === 'red_dragon') radius = 18;
          else if (m?.type === 'minotaur') radius = 8;
          else if (m?.type === 'dire_wolf') radius = 5.5;
          else if (m?.type === 'giant_rat') radius = 3.2;
          else radius = 4.5;
        } else if (state.selectedEntity.type === 'tax_collector') {
          colorHex = 0xc084fc;
          radius = 4.5;
        } else if (state.selectedEntity.type === 'peasant') {
          colorHex = 0xf59e0b;
          radius = 4.2;
        }

        // Outer smooth thin ring
        const ringGeo = new THREE.RingGeometry(radius - 1.5, radius, 48);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
          color: colorHex,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.9,
          depthWrite: false
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.y = 0.7;
        this.selectionGroup.add(ring);

        // Soft inner glow disc
        const innerGeo = new THREE.CircleGeometry(radius - 1.5, 32);
        innerGeo.rotateX(-Math.PI / 2);
        const innerMat = new THREE.MeshBasicMaterial({
          color: colorHex,
          transparent: true,
          opacity: 0.18,
          depthWrite: false
        });
        const inner = new THREE.Mesh(innerGeo, innerMat);
        inner.position.y = 0.6;
        this.selectionGroup.add(inner);
      }
    }

    // Position the selection group at the entity location
    if (state.selectedEntity.type === 'building') {
      const b = state.buildings.find(build => build.id === state.selectedEntity?.id);
      if (b) {
        this.selectionGroup.position.set((b.x + b.width / 2) * ts, 0, (b.y + b.height / 2) * ts);
        this.selectionGroup.visible = true;
      }
    } else if (state.selectedEntity.type === 'lair') {
      const l = state.lairs.find(lair => lair.id === state.selectedEntity?.id);
      if (l) {
        this.selectionGroup.position.set((l.x + l.width / 2) * ts, 0, (l.y + l.height / 2) * ts);
        this.selectionGroup.visible = true;
      }
    } else if (state.selectedEntity.type === 'hero') {
      const h = state.heroes.find(hero => hero.id === state.selectedEntity?.id);
      if (h) {
        this.selectionGroup.position.set(h.x, 0, h.y);
        this.selectionGroup.visible = true;
      }
    } else if (state.selectedEntity.type === 'monster') {
      const m = state.monsters.find(mon => mon.id === state.selectedEntity?.id);
      if (m) {
        this.selectionGroup.position.set(m.x, 0, m.y);
        this.selectionGroup.visible = true;
      }
    } else if (state.selectedEntity.type === 'tax_collector') {
      const tc = state.taxCollectors.find(collector => collector.id === state.selectedEntity?.id);
      if (tc) {
        this.selectionGroup.position.set(tc.x, 0, tc.y);
        this.selectionGroup.visible = true;
      }
    } else if (state.selectedEntity.type === 'peasant') {
      const p = state.peasants.find(peasant => peasant.id === state.selectedEntity?.id);
      if (p) {
        this.selectionGroup.position.set(p.x, 0, p.y);
        this.selectionGroup.visible = true;
      }
    }
  }

  // --- PLACEMENT PREVIEW (HOVER HOLOGRAM & SHADOW) ---
  private updatePlacementPreview(state: GameState, mouseWorldPos: { x: number; y: number } | null) {
    if (!state.activePlacement || !mouseWorldPos) {
      this.placementPreviewGroup.visible = false;
      return;
    }

    const ts = this.gridManager.tileSize;
    const tileX = Math.floor(mouseWorldPos.x / ts);
    const tileY = Math.floor(mouseWorldPos.y / ts);

    if (state.activePlacement.type === 'building') {
      const bDef = BUILDING_DEFINITIONS[state.activePlacement.subType as keyof typeof BUILDING_DEFINITIONS];
      if (!bDef) return;

      const isValid = this.gridManager.canPlaceBuilding(tileX, tileY, bDef.width, bDef.height, state.buildings, state.lairs);
      const color = isValid ? 0x22c55e : 0xef4444;

      // Rebuild preview mesh if needed
      this.placementPreviewGroup.clear();

      const px = (tileX + bDef.width / 2) * ts;
      const pz = (tileY + bDef.height / 2) * ts;
      this.placementPreviewGroup.position.set(px, 0, pz);

      // 3D Bounding Hologram Box
      const boxGeo = new THREE.BoxGeometry(bDef.width * ts, 20, bDef.height * ts);
      const boxMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.45,
        wireframe: false
      });
      const box = new THREE.Mesh(boxGeo, boxMat);
      box.position.y = 10;
      this.placementPreviewGroup.add(box);

      // Wireframe Outline
      const wireMat = new THREE.MeshBasicMaterial({ color, wireframe: true });
      const wire = new THREE.Mesh(boxGeo, wireMat);
      wire.position.y = 10;
      this.placementPreviewGroup.add(wire);

      // Ground Footprint Grid
      const footprintGeo = new THREE.PlaneGeometry(bDef.width * ts, bDef.height * ts);
      footprintGeo.rotateX(-Math.PI / 2);
      const footprintMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7 });
      const footprint = new THREE.Mesh(footprintGeo, footprintMat);
      footprint.position.y = 0.6;
      this.placementPreviewGroup.add(footprint);

      this.placementPreviewGroup.visible = true;
    } else if (state.activePlacement.type === 'flag') {
      this.placementPreviewGroup.clear();
      this.placementPreviewGroup.position.set(mouseWorldPos.x, 0, mouseWorldPos.y);

      const ringGeo = new THREE.RingGeometry(2, 20, 24);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 0.8;
      this.placementPreviewGroup.add(ring);
      this.placementPreviewGroup.visible = true;
    } else if (state.activePlacement.type === 'spell') {
      this.placementPreviewGroup.clear();
      this.placementPreviewGroup.position.set(mouseWorldPos.x, 0, mouseWorldPos.y);

      const ringGeo = new THREE.RingGeometry(2, 60, 32);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xc084fc,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.5
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 0.8;
      this.placementPreviewGroup.add(ring);
      this.placementPreviewGroup.visible = true;
    }
  }

  // --- 3D BUILDINGS ---
  private updateBuildings(state: GameState) {
    const activeIds = new Set<string>();

    for (const b of state.buildings) {
      activeIds.add(b.id);
      const stateKey = `${b.id}_${b.isConstructing ? 'building' : 'done'}_lvl${b.level}`;
      let group = this.buildingsMap.get(b.id);

      if (!group || group.name !== stateKey) {
        if (group) {
          this.scene.remove(group);
        }
        group = this.create3DBuilding(b);
        group.name = stateKey;
        this.scene.add(group);
        this.buildingsMap.set(b.id, group);
      }

      const ts = this.gridManager.tileSize;
      const px = (b.x + b.width / 2) * ts;
      const pz = (b.y + b.height / 2) * ts;
      group.position.set(px, 0, pz);

      const isVisible = this.gridManager.isPixelExplored(px, pz);
      group.visible = isVisible;
    }

    for (const [id, group] of this.buildingsMap.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(group);
        this.buildingsMap.delete(id);
      }
    }
  }

  private create3DBuilding(b: Building): THREE.Group {
    const group = new THREE.Group();
    const ts = this.gridManager.tileSize;
    const w = b.width * ts;
    const h = b.height * ts;

    if (b.isConstructing) {
      // 3D Construction Site (Timber Platform, Corner Posts, Crossbeams, Foundation)
      const postMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
      const plankMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.8 });
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85 });

      // Ground Timber Foundation
      const foundationGeo = new THREE.BoxGeometry(w * 0.85, 2, h * 0.85);
      const foundation = new THREE.Mesh(foundationGeo, plankMat);
      foundation.position.y = 1;
      foundation.castShadow = true;
      group.add(foundation);

      // Rising Stone Wall Base
      const risingWallGeo = new THREE.BoxGeometry(w * 0.7, 6, h * 0.7);
      const risingWall = new THREE.Mesh(risingWallGeo, stoneMat);
      risingWall.position.y = 4;
      risingWall.castShadow = true;
      group.add(risingWall);

      // 4 Corner Timber Posts
      const postGeo = new THREE.CylinderGeometry(1.5, 1.5, 20, 6);
      const halfW = w * 0.38;
      const halfH = h * 0.38;

      const p1 = new THREE.Mesh(postGeo, postMat); p1.position.set(-halfW, 10, -halfH); p1.castShadow = true; group.add(p1);
      const p2 = new THREE.Mesh(postGeo, postMat); p2.position.set(halfW, 10, -halfH); p2.castShadow = true; group.add(p2);
      const p3 = new THREE.Mesh(postGeo, postMat); p3.position.set(-halfW, 10, halfH); p3.castShadow = true; group.add(p3);
      const p4 = new THREE.Mesh(postGeo, postMat); p4.position.set(halfW, 10, halfH); p4.castShadow = true; group.add(p4);

      // Top Framework Crossbeams
      const beamXGeo = new THREE.BoxGeometry(w * 0.8, 1.8, 1.8);
      const beamZGeo = new THREE.BoxGeometry(1.8, 1.8, h * 0.8);

      const b1 = new THREE.Mesh(beamXGeo, plankMat); b1.position.set(0, 18, -halfH); group.add(b1);
      const b2 = new THREE.Mesh(beamXGeo, plankMat); b2.position.set(0, 18, halfH); group.add(b2);
      const b3 = new THREE.Mesh(beamZGeo, plankMat); b3.position.set(-halfW, 18, 0); group.add(b3);
      const b4 = new THREE.Mesh(beamZGeo, plankMat); b4.position.set(halfW, 18, 0); group.add(b4);

      // Stacks of Lumber & Crates on site
      const crateGeo = new THREE.BoxGeometry(4, 4, 4);
      const crate = new THREE.Mesh(crateGeo, postMat);
      crate.position.set(-w * 0.25, 4, h * 0.25);
      group.add(crate);

      return group;
    }

    if (b.type === 'palace') {
      // Grand Monumental Royal Stronghold (4x4 tiles = 128x128)
      const castleBaseGeo = new THREE.BoxGeometry(w * 0.82, 26, h * 0.82);
      const castleBaseMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8 });
      const castleBase = new THREE.Mesh(castleBaseGeo, castleBaseMat);
      castleBase.position.y = 13;
      castleBase.castShadow = true;
      castleBase.receiveShadow = true;
      group.add(castleBase);

      // 4 Corner Round Bastion Turrets with Crimson Roofs
      const turretGeo = new THREE.CylinderGeometry(6, 7, 36, 12);
      const turretRoofGeo = new THREE.ConeGeometry(7.5, 16, 12);
      const turretMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.7 });
      const turretRoofMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.6 });

      const offsets = [
        [-w * 0.38, -h * 0.38],
        [w * 0.38, -h * 0.38],
        [-w * 0.38, h * 0.38],
        [w * 0.38, h * 0.38]
      ];

      offsets.forEach(([tx, tz]) => {
        const turret = new THREE.Mesh(turretGeo, turretMat);
        turret.position.set(tx, 18, tz);
        turret.castShadow = true;
        group.add(turret);

        const tRoof = new THREE.Mesh(turretRoofGeo, turretRoofMat);
        tRoof.position.set(tx, 44, tz);
        tRoof.castShadow = true;
        group.add(tRoof);
      });

      // Central Grand Imperial Throne Keep
      const keepGeo = new THREE.BoxGeometry(w * 0.44, 48, h * 0.44);
      const keep = new THREE.Mesh(keepGeo, turretMat);
      keep.position.y = 24;
      keep.castShadow = true;
      group.add(keep);

      const keepRoofGeo = new THREE.ConeGeometry(w * 0.36, 24, 4);
      const keepRoof = new THREE.Mesh(keepRoofGeo, turretRoofMat);
      keepRoof.position.y = 60;
      keepRoof.rotation.y = Math.PI / 4;
      keepRoof.castShadow = true;
      group.add(keepRoof);

      // Golden Sovereign Crown Spire
      const crownGeo = new THREE.CylinderGeometry(3.5, 4.5, 8, 8);
      const crownMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.8, roughness: 0.2 });
      const crown = new THREE.Mesh(crownGeo, crownMat);
      crown.position.y = 76;
      group.add(crown);
    } else if (b.type === 'warrior_guild') {
      // Fortified Stone Bastion with Pitched Blue Gable Roof & Training Yard (2x2 = 64x64)
      const hallBaseGeo = new THREE.BoxGeometry(w * 0.82, 22, h * 0.74);
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
      const hall = new THREE.Mesh(hallBaseGeo, stoneMat);
      hall.position.y = 11;
      hall.castShadow = true;
      group.add(hall);

      // Pitched Blue Slate Roof
      const roofGeo = new THREE.ConeGeometry(w * 0.48, 18, 4);
      const blueRoofMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.6 });
      const roof = new THREE.Mesh(roofGeo, blueRoofMat);
      roof.position.y = 31;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      group.add(roof);

      // Shield & Crossed Swords Plaque above door
      const shieldPlaqueGeo = new THREE.BoxGeometry(5, 6.5, 1);
      const shieldMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.5 });
      const shieldPlaque = new THREE.Mesh(shieldPlaqueGeo, shieldMat);
      shieldPlaque.position.set(0, 18, h * 0.38);
      group.add(shieldPlaque);

      // Wooden Training Dummy outside in yard
      const dummyPoleGeo = new THREE.CylinderGeometry(0.8, 0.8, 10, 6);
      const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f });
      const dummy = new THREE.Mesh(dummyPoleGeo, woodMat);
      dummy.position.set(w * 0.34, 5, h * 0.25);
      dummy.castShadow = true;
      group.add(dummy);

      const dummyTargetGeo = new THREE.SphereGeometry(2.4, 8, 8);
      const strawMat = new THREE.MeshStandardMaterial({ color: 0xca8a04 });
      const dummyTarget = new THREE.Mesh(dummyTargetGeo, strawMat);
      dummyTarget.position.set(w * 0.34, 10, h * 0.25);
      group.add(dummyTarget);
    } else if (b.type === 'ranger_guild') {
      // Rustic Timber Log Lodge with Forest Green Roof (2x2 = 64x64)
      const logBaseGeo = new THREE.BoxGeometry(w * 0.82, 20, h * 0.74);
      const logMat = new THREE.MeshStandardMaterial({ color: 0x542608, roughness: 0.9 });
      const cabin = new THREE.Mesh(logBaseGeo, logMat);
      cabin.position.y = 10;
      cabin.castShadow = true;
      group.add(cabin);

      const roofGeo = new THREE.ConeGeometry(w * 0.46, 17, 4);
      const greenRoofMat = new THREE.MeshStandardMaterial({ color: 0x065f46, roughness: 0.7 });
      const roof = new THREE.Mesh(roofGeo, greenRoofMat);
      roof.position.y = 28.5;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      group.add(roof);

      // 2 Archery Target Hay Bales outside
      const targetGeo = new THREE.CylinderGeometry(3.5, 3.5, 2.5, 12);
      targetGeo.rotateX(Math.PI / 2);
      const targetMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.8 });
      const t1 = new THREE.Mesh(targetGeo, targetMat);
      t1.position.set(w * 0.3, 3.5, h * 0.35);
      t1.castShadow = true;
      group.add(t1);

      const t2 = new THREE.Mesh(targetGeo, targetMat);
      t2.position.set(-w * 0.3, 3.5, h * 0.35);
      t2.castShadow = true;
      group.add(t2);
    } else if (b.type === 'rogue_guild') {
      // Dark Shadowy Hideout with Lantern (2x2 = 64x64)
      const baseGeo = new THREE.BoxGeometry(w * 0.8, 18, h * 0.72);
      const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 });
      const hideout = new THREE.Mesh(baseGeo, darkMat);
      hideout.position.y = 9;
      hideout.castShadow = true;
      group.add(hideout);

      const roofGeo = new THREE.ConeGeometry(w * 0.44, 15, 4);
      const slateMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.7 });
      const roof = new THREE.Mesh(roofGeo, slateMat);
      roof.position.y = 25.5;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      group.add(roof);

      // Hanging Iron Lantern with warm glow
      const lanternGeo = new THREE.BoxGeometry(2, 3, 2);
      const lanternMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.8 });
      const lantern = new THREE.Mesh(lanternGeo, lanternMat);
      lantern.position.set(w * 0.34, 12, h * 0.38);
      group.add(lantern);
    } else if (b.type === 'wizard_tower') {
      // Spiraling Arcane Tower with Balconies (2x2 = 64x64)
      const cylinderGeo = new THREE.CylinderGeometry(w * 0.24, w * 0.34, 52, 12);
      const towerMat = new THREE.MeshStandardMaterial({ color: 0x312e81, roughness: 0.7 });
      const tower = new THREE.Mesh(cylinderGeo, towerMat);
      tower.position.y = 26;
      tower.castShadow = true;
      group.add(tower);

      const balconyGeo = new THREE.CylinderGeometry(w * 0.32, w * 0.32, 3.5, 12);
      const balcony = new THREE.Mesh(balconyGeo, towerMat);
      balcony.position.y = 38;
      group.add(balcony);

      const coneGeo = new THREE.ConeGeometry(w * 0.3, 26, 12);
      const coneMat = new THREE.MeshStandardMaterial({ color: 0x7c3aed, roughness: 0.5 });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.y = 65;
      cone.castShadow = true;
      group.add(cone);

      // Levitating Pulsing Arcane Orb
      const orbGeo = new THREE.SphereGeometry(4.5, 12, 12);
      const orbMat = new THREE.MeshStandardMaterial({
        color: 0xc084fc,
        emissive: 0x9333ea,
        emissiveIntensity: 1.0,
        roughness: 0.2
      });
      const orb = new THREE.Mesh(orbGeo, orbMat);
      orb.position.y = 80;
      group.add(orb);
    } else if (b.type === 'cleric_temple') {
      // White Marble Cathedral with Grand Gold Dome (2x2 = 64x64)
      const cathedralBaseGeo = new THREE.BoxGeometry(w * 0.82, 24, h * 0.74);
      const cathedralMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.6 });
      const cathedral = new THREE.Mesh(cathedralBaseGeo, cathedralMat);
      cathedral.position.y = 12;
      cathedral.castShadow = true;
      group.add(cathedral);

      const domeGeo = new THREE.SphereGeometry(w * 0.34, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
      const domeMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.7, roughness: 0.2 });
      const dome = new THREE.Mesh(domeGeo, domeMat);
      dome.position.y = 24;
      group.add(dome);

      // Golden Solar Cross
      const crossVGeo = new THREE.BoxGeometry(1.4, 10, 1.4);
      const crossHGeo = new THREE.BoxGeometry(5.5, 1.4, 1.4);
      const crossV = new THREE.Mesh(crossVGeo, domeMat);
      const crossH = new THREE.Mesh(crossHGeo, domeMat);
      crossV.position.y = 41;
      crossH.position.y = 43;
      group.add(crossV);
      group.add(crossH);
    } else if (b.type === 'marketplace') {
      // Vibrant Multi-Stall Bazaar (2x2 = 64x64)
      const baseGeo = new THREE.BoxGeometry(w * 0.85, 4, h * 0.85);
      const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
      const base = new THREE.Mesh(baseGeo, woodMat);
      base.position.y = 2;
      base.castShadow = true;
      group.add(base);

      // Striped Red/White Tent Canopy
      const canopyGeo = new THREE.ConeGeometry(w * 0.46, 18, 4);
      const canopyMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.7 });
      const canopy = new THREE.Mesh(canopyGeo, canopyMat);
      canopy.position.y = 20;
      canopy.rotation.y = Math.PI / 4;
      canopy.castShadow = true;
      group.add(canopy);

      // Crates & Barrels
      const barrelGeo = new THREE.CylinderGeometry(2.5, 2.5, 5, 8);
      const barrel = new THREE.Mesh(barrelGeo, woodMat);
      barrel.position.set(w * 0.3, 4.5, h * 0.25);
      group.add(barrel);
    } else if (b.type === 'blacksmith') {
      // Brick Forge with Tall Stone Chimney & Anvil (2x2 = 64x64)
      const forgeBaseGeo = new THREE.BoxGeometry(w * 0.8, 18, h * 0.7);
      const forgeMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.8 });
      const forge = new THREE.Mesh(forgeBaseGeo, forgeMat);
      forge.position.y = 9;
      forge.castShadow = true;
      group.add(forge);

      const chimneyGeo = new THREE.BoxGeometry(7, 34, 7);
      const chimney = new THREE.Mesh(chimneyGeo, forgeMat);
      chimney.position.set(w * 0.25, 17, -h * 0.2);
      chimney.castShadow = true;
      group.add(chimney);

      // Anvil outside
      const anvilGeo = new THREE.BoxGeometry(3.5, 4.5, 5);
      const anvilMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.2 });
      const anvil = new THREE.Mesh(anvilGeo, anvilMat);
      anvil.position.set(-w * 0.25, 2.25, h * 0.25);
      group.add(anvil);
    } else if (b.type === 'royal_inn') {
      // Half-Timber Bavarian Tavern (2x2 = 64x64)
      const innBaseGeo = new THREE.BoxGeometry(w * 0.82, 22, h * 0.74);
      const innMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.8 });
      const inn = new THREE.Mesh(innBaseGeo, innMat);
      inn.position.y = 11;
      inn.castShadow = true;
      group.add(inn);

      const roofGeo = new THREE.ConeGeometry(w * 0.46, 17, 4);
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.7 });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.y = 30.5;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      group.add(roof);
    } else if (b.type === 'peasant_cottage') {
      // Realistic Thatched Peasant Cottage (1x1 tile = 32x32)
      const cottageBaseGeo = new THREE.BoxGeometry(w * 0.72, 12, h * 0.72);
      const cottageBaseMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.9 }); // Whitewashed plaster
      const cottageBase = new THREE.Mesh(cottageBaseGeo, cottageBaseMat);
      cottageBase.position.y = 6;
      cottageBase.castShadow = true;
      group.add(cottageBase);

      // High-Pitched Straw Thatched Roof
      const thatchGeo = new THREE.ConeGeometry(w * 0.48, 11, 4);
      const thatchMat = new THREE.MeshStandardMaterial({ color: 0xca8a04, roughness: 0.95 });
      const thatch = new THREE.Mesh(thatchGeo, thatchMat);
      thatch.position.y = 17.5;
      thatch.rotation.y = Math.PI / 4;
      thatch.castShadow = true;
      group.add(thatch);

      // Stone Chimney with Smoke
      const chimneyGeo = new THREE.BoxGeometry(2.5, 10, 2.5);
      const chimneyMat = new THREE.MeshStandardMaterial({ color: 0x64748b });
      const chimney = new THREE.Mesh(chimneyGeo, chimneyMat);
      chimney.position.set(w * 0.2, 17, -h * 0.2);
      group.add(chimney);

      // Wooden door
      const doorGeo = new THREE.BoxGeometry(3, 5, 0.4);
      const doorMat = new THREE.MeshStandardMaterial({ color: 0x78350f });
      const door = new THREE.Mesh(doorGeo, doorMat);
      door.position.set(0, 2.5, h * 0.36);
      group.add(door);
    } else if (b.type === 'guard_tower') {
      // Fortified Stone Watchtower (1x1 tile = 32x32)
      const towerGeo = new THREE.BoxGeometry(w * 0.5, 42, h * 0.5);
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8 });
      const tower = new THREE.Mesh(towerGeo, stoneMat);
      tower.position.y = 21;
      tower.castShadow = true;
      group.add(tower);

      const parapetGeo = new THREE.BoxGeometry(w * 0.6, 4, h * 0.6);
      const parapet = new THREE.Mesh(parapetGeo, stoneMat);
      parapet.position.y = 42;
      group.add(parapet);

      const roofGeo = new THREE.ConeGeometry(w * 0.38, 14, 4);
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x64748b });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.y = 51;
      roof.rotation.y = Math.PI / 4;
      group.add(roof);
    } else {
      // Default structure
      const baseGeo = new THREE.BoxGeometry(w * 0.75, 18, h * 0.75);
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.position.y = 9;
      base.castShadow = true;
      group.add(base);
    }

    return group;
  }

  // --- 3D MONSTER LAIRS ---
  private updateLairs(state: GameState) {
    const activeIds = new Set<string>();

    for (const lair of state.lairs) {
      activeIds.add(lair.id);
      let group = this.lairsMap.get(lair.id);

      if (!group) {
        group = this.create3DLair(lair);
        this.scene.add(group);
        this.lairsMap.set(lair.id, group);
      }

      const ts = this.gridManager.tileSize;
      const px = (lair.x + lair.width / 2) * ts;
      const pz = (lair.y + lair.height / 2) * ts;
      group.position.set(px, 0, pz);
      group.visible = this.gridManager.isPixelExplored(px, pz);
    }

    for (const [id, group] of this.lairsMap.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(group);
        this.lairsMap.delete(id);
      }
    }
  }

  private create3DLair(lair: MonsterLair): THREE.Group {
    const group = new THREE.Group();
    const ts = this.gridManager.tileSize;
    const w = lair.width * ts;
    const h = lair.height * ts;

    if (lair.type === 'sewer_grate') {
      // Grounded Street-Level Sewer Manhole / Iron Drainage Grate
      const curbGeo = new THREE.CylinderGeometry(12, 13, 0.9, 16);
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 });
      const curb = new THREE.Mesh(curbGeo, stoneMat);
      curb.position.y = 0.45;
      curb.castShadow = true;
      curb.receiveShadow = true;
      group.add(curb);

      // Deep Recessed Pitch-Black Drain Pit
      const pitGeo = new THREE.CircleGeometry(9.5, 16);
      pitGeo.rotateX(-Math.PI / 2);
      const darkMat = new THREE.MeshBasicMaterial({ color: 0x030712 });
      const pit = new THREE.Mesh(pitGeo, darkMat);
      pit.position.y = 0.5;
      group.add(pit);

      // Murky Bioluminescent Green Sewer Slime deep inside
      const slimeGeo = new THREE.CircleGeometry(8.5, 16);
      slimeGeo.rotateX(-Math.PI / 2);
      const slimeMat = new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x059669,
        emissiveIntensity: 0.8,
        roughness: 0.2
      });
      const slime = new THREE.Mesh(slimeGeo, slimeMat);
      slime.position.y = 0.52;
      group.add(slime);

      // Heavy Cast Iron Outer Ring
      const rimRingGeo = new THREE.TorusGeometry(9.5, 0.55, 6, 16);
      rimRingGeo.rotateX(Math.PI / 2);
      const ironMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.25 });
      const rimRing = new THREE.Mesh(rimRingGeo, ironMat);
      rimRing.position.y = 0.85;
      group.add(rimRing);

      // Slotted Iron Sewer Grate Bars
      const numBars = 5;
      const spacing = 14 / numBars;
      for (let i = 0; i <= numBars; i++) {
        const barGeo = new THREE.BoxGeometry(0.8, 0.6, 17);
        const bar = new THREE.Mesh(barGeo, ironMat);
        const barX = -7 + i * spacing;
        // Clip length to circle radius
        const maxLen = 2 * Math.sqrt(Math.max(1, 9.5 * 9.5 - barX * barX));
        bar.scale.z = Math.min(1, maxLen / 17);
        bar.position.set(barX, 0.9, 0);
        bar.castShadow = true;
        group.add(bar);
      }

      // Thick Central Crossbar
      const crossBarGeo = new THREE.BoxGeometry(18, 0.8, 0.8);
      const crossBar = new THREE.Mesh(crossBarGeo, ironMat);
      crossBar.position.set(0, 0.95, 0);
      group.add(crossBar);
    } else if (lair.type === 'graveyard') {
      // 3D Cursed Graveyard with Mausoleum & Headstones
      const cryptGeo = new THREE.BoxGeometry(16, 14, 20);
      const cryptMat = new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.9 });
      const crypt = new THREE.Mesh(cryptGeo, cryptMat);
      crypt.position.set(0, 7, -6);
      crypt.castShadow = true;
      group.add(crypt);

      // Crypt Roof
      const cRoofGeo = new THREE.ConeGeometry(13, 8, 4);
      const cRoofMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.8 });
      const cRoof = new THREE.Mesh(cRoofGeo, cRoofMat);
      cRoof.position.set(0, 18, -6);
      cRoof.rotation.y = Math.PI / 4;
      cRoof.castShadow = true;
      group.add(cRoof);

      // Tilted Headstones
      const stoneGeo = new THREE.BoxGeometry(4, 7, 1.5);
      const tombMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.9 });

      const t1 = new THREE.Mesh(stoneGeo, tombMat);
      t1.position.set(-w * 0.25, 3.5, h * 0.25);
      t1.rotation.z = -0.15;
      t1.castShadow = true;
      group.add(t1);

      const t2 = new THREE.Mesh(stoneGeo, tombMat);
      t2.position.set(w * 0.25, 3.5, h * 0.2);
      t2.rotation.z = 0.2;
      t2.castShadow = true;
      group.add(t2);
    } else if (lair.type === 'goblin_hut') {
      // Mud and Straw Teepee Hut with Bone Totems
      const hutGeo = new THREE.ConeGeometry(w * 0.42, 22, 6);
      const hutMat = new THREE.MeshStandardMaterial({ color: 0x713f12, roughness: 0.9 });
      const hut = new THREE.Mesh(hutGeo, hutMat);
      hut.position.y = 11;
      hut.castShadow = true;
      group.add(hut);

      // Straw Thatch trim
      const thatchGeo = new THREE.ConeGeometry(w * 0.45, 8, 6);
      const thatchMat = new THREE.MeshStandardMaterial({ color: 0xca8a04, roughness: 0.8 });
      const thatch = new THREE.Mesh(thatchGeo, thatchMat);
      thatch.position.y = 8;
      group.add(thatch);

      // Tribal Totem Pole outside
      const totemGeo = new THREE.CylinderGeometry(1, 1, 18, 6);
      const woodMat = new THREE.MeshStandardMaterial({ color: 0x451a03 });
      const totem = new THREE.Mesh(totemGeo, woodMat);
      totem.position.set(w * 0.3, 9, h * 0.25);
      totem.castShadow = true;
      group.add(totem);

      const skullGeo = new THREE.SphereGeometry(2.5, 6, 6);
      const skullMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0 });
      const skull = new THREE.Mesh(skullGeo, skullMat);
      skull.position.set(w * 0.3, 18, h * 0.25);
      group.add(skull);
    } else if (lair.type === 'wolf_den') {
      // Rocky Cave Mouth Burrow
      const caveMoundGeo = new THREE.SphereGeometry(w * 0.45, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      const caveMat = new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.9 });
      const cave = new THREE.Mesh(caveMoundGeo, caveMat);
      cave.position.y = 0;
      cave.castShadow = true;
      group.add(cave);

      // Dark Cave Mouth
      const mouthGeo = new THREE.CircleGeometry(6, 12);
      const darkMat = new THREE.MeshBasicMaterial({ color: 0x030712 });
      const mouth = new THREE.Mesh(mouthGeo, darkMat);
      mouth.position.set(0, 4, h * 0.35);
      group.add(mouth);
    } else if (lair.type === 'ancient_ruins') {
      // Crumbling Greek / Gothic Columns & Broken Lintel
      const colGeo = new THREE.CylinderGeometry(2.5, 3, 22, 8);
      const marbleMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.8 });

      const c1 = new THREE.Mesh(colGeo, marbleMat); c1.position.set(-w * 0.25, 11, -h * 0.2); c1.castShadow = true; group.add(c1);
      const c2 = new THREE.Mesh(colGeo, marbleMat); c2.position.set(w * 0.25, 11, -h * 0.2); c2.castShadow = true; group.add(c2);

      // Broken Lintel resting on top
      const lintelGeo = new THREE.BoxGeometry(w * 0.7, 4, 6);
      const lintel = new THREE.Mesh(lintelGeo, marbleMat);
      lintel.position.set(0, 23, -h * 0.2);
      lintel.rotation.z = 0.1;
      lintel.castShadow = true;
      group.add(lintel);
    } else if (lair.type === 'dragon_cavern') {
      // Volcanic Obsidian Peaks with Magma Crag
      const volcanoGeo = new THREE.ConeGeometry(w * 0.55, 36, 8);
      const volcanoMat = new THREE.MeshStandardMaterial({ color: 0x450a0a, roughness: 0.9 });
      const volcano = new THREE.Mesh(volcanoGeo, volcanoMat);
      volcano.position.y = 18;
      volcano.castShadow = true;
      group.add(volcano);

      const magmaGeo = new THREE.SphereGeometry(7, 8, 8);
      const magmaMat = new THREE.MeshStandardMaterial({ color: 0xea580c, emissive: 0xf97316, emissiveIntensity: 1.0 });
      const magma = new THREE.Mesh(magmaGeo, magmaMat);
      magma.position.y = 32;
      group.add(magma);
    } else {
      const rockGeo = new THREE.DodecahedronGeometry(w * 0.35, 0);
      const rockMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 });
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.position.y = 8;
      rock.castShadow = true;
      group.add(rock);
    }

    return group;
  }

  // --- 3D TREASURES (GOLD SACKS & CHESTS) ---
  private updateTreasures(state: GameState) {
    const activeIds = new Set<string>();
    const time = Date.now() * 0.004;

    for (const t of state.treasures) {
      activeIds.add(t.id);
      let mesh = this.treasuresMap.get(t.id);

      if (!mesh) {
        mesh = this.create3DTreasureMesh(t);
        this.scene.add(mesh);
        this.treasuresMap.set(t.id, mesh);
      }

      mesh.position.set(t.x, 0, t.y);
      mesh.visible = this.gridManager.isPixelExplored(t.x, t.y);

      // Gentle golden shimmer bob
      const shine = mesh.getObjectByName('treasureGlow');
      if (shine) {
        shine.rotation.z = time * 0.8;
      }
    }

    for (const [id, mesh] of this.treasuresMap.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(mesh);
        this.treasuresMap.delete(id);
      }
    }
  }

  private create3DTreasureMesh(t: Treasure): THREE.Group {
    const group = new THREE.Group();

    if (t.type === 'chest') {
      // Ironwood & Brass Treasure Chest
      const woodMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.85 });
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.9, roughness: 0.15 });

      const chestBaseGeo = new THREE.BoxGeometry(3.6, 1.8, 2.6);
      const chestBase = new THREE.Mesh(chestBaseGeo, woodMat);
      chestBase.position.y = 0.9;
      chestBase.castShadow = true;
      group.add(chestBase);

      // Vaulted Domed Lid
      const lidGeo = new THREE.CylinderGeometry(1.3, 1.3, 3.6, 12, 1, false, 0, Math.PI);
      lidGeo.rotateZ(Math.PI / 2);
      const lid = new THREE.Mesh(lidGeo, woodMat);
      lid.position.set(0, 1.8, 0);
      lid.castShadow = true;
      group.add(lid);

      // Brass Corner Straps & Lock
      const lockGeo = new THREE.BoxGeometry(0.6, 0.8, 0.2);
      const lock = new THREE.Mesh(lockGeo, goldMat);
      lock.position.set(0, 1.2, 1.35);
      group.add(lock);

      // Spilling Gold Coins inside
      const coinGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.1, 8);
      for (let i = 0; i < 4; i++) {
        const coin = new THREE.Mesh(coinGeo, goldMat);
        coin.position.set((Math.random() - 0.5) * 1.8, 0.1, 1.4 + Math.random() * 0.8);
        coin.rotation.x = (Math.random() - 0.5) * 0.4;
        group.add(coin);
      }
    } else {
      // Realistic Bulging Burlap/Leather Gold Sack with Gold Coins
      const sackMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.9 });
      const ropeMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.6 });
      const goldCoinMat = new THREE.MeshStandardMaterial({
        color: 0xfbbf24,
        metalness: 0.95,
        roughness: 0.1,
        emissive: 0xd97706,
        emissiveIntensity: 0.3
      });

      // Puffy Round Sack Body with flat bottom
      const bodyGeo = new THREE.SphereGeometry(1.8, 10, 8);
      const body = new THREE.Mesh(bodyGeo, sackMat);
      body.scale.set(1.2, 0.9, 1.2);
      body.position.y = 1.3;
      body.castShadow = true;
      group.add(body);

      // Tied Golden Rope Neck Cord
      const cordGeo = new THREE.TorusGeometry(0.7, 0.14, 6, 12);
      cordGeo.rotateX(Math.PI / 2);
      const cord = new THREE.Mesh(cordGeo, ropeMat);
      cord.position.y = 2.4;
      group.add(cord);

      // Gathered Pleated Top Opening
      const ruffleGeo = new THREE.ConeGeometry(1.1, 0.9, 8);
      ruffleGeo.rotateX(Math.PI);
      const ruffle = new THREE.Mesh(ruffleGeo, sackMat);
      ruffle.position.y = 2.8;
      group.add(ruffle);

      // Spilling Metallic Gold Coins around the bag
      const coinGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.1, 8);
      const coinOffsets = [
        [1.6, 0.08, 0.6, 0.2],
        [-1.5, 0.08, 0.8, -0.3],
        [0.8, 0.08, 1.6, 0.15],
        [-0.7, 0.08, 1.5, -0.2],
        [1.2, 0.16, 1.2, 0.4]
      ];

      coinOffsets.forEach(([cx, cy, cz, rotZ]) => {
        const coin = new THREE.Mesh(coinGeo, goldCoinMat);
        coin.position.set(cx, cy, cz);
        coin.rotation.z = rotZ;
        coin.castShadow = true;
        group.add(coin);
      });

      // Golden Crown Emblem on front of pouch
      const emblemGeo = new THREE.BoxGeometry(0.7, 0.5, 0.15);
      const emblem = new THREE.Mesh(emblemGeo, goldCoinMat);
      emblem.position.set(0, 1.3, 1.85);
      group.add(emblem);
    }

    // Soft Golden Loot Aura Ring on ground
    const glowGeo = new THREE.RingGeometry(2.4, 3.2, 16);
    glowGeo.rotateX(-Math.PI / 2);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.y = 0.05;
    glow.name = 'treasureGlow';
    group.add(glow);

    return group;
  }

  // --- 3D FLAGS ---
  private updateFlags(state: GameState) {
    const activeIds = new Set<string>();

    for (const f of state.flags) {
      activeIds.add(f.id);
      let flagGroup = this.flagsMap.get(f.id);

      if (!flagGroup) {
        flagGroup = new THREE.Group();
        const poleGeo = new THREE.CylinderGeometry(0.8, 0.8, 28, 6);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.8, roughness: 0.2 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.y = 14;
        pole.castShadow = true;
        flagGroup.add(pole);

        const bannerGeo = new THREE.BoxGeometry(10, 6, 0.5);
        const bannerColor = f.type === 'attack' ? 0xdc2626 : (f.type === 'explore' ? 0x2563eb : 0xeab308);
        const bannerMat = new THREE.MeshStandardMaterial({ color: bannerColor, roughness: 0.6 });
        const banner = new THREE.Mesh(bannerGeo, bannerMat);
        banner.position.set(5, 23, 0);
        flagGroup.add(banner);

        const beaconGeo = new THREE.CylinderGeometry(0.5, 4, 80, 8);
        const beaconMat = new THREE.MeshBasicMaterial({
          color: bannerColor,
          transparent: true,
          opacity: 0.35
        });
        const beacon = new THREE.Mesh(beaconGeo, beaconMat);
        beacon.position.y = 40;
        flagGroup.add(beacon);

        this.scene.add(flagGroup);
        this.flagsMap.set(f.id, flagGroup);
      }

      flagGroup.position.set(f.x, 0, f.y);
    }

    for (const [id, group] of this.flagsMap.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(group);
        this.flagsMap.delete(id);
      }
    }
  }

  // --- 3D PEASANT BUILDERS ---
  private updatePeasants(state: GameState, delta: number) {
    const activeIds = new Set<string>();
    const time = Date.now() * 0.01;

    for (const p of state.peasants) {
      if (p.hp <= 0) continue;
      activeIds.add(p.id);
      let pGroup = this.peasantsMap.get(p.id);

      if (!pGroup) {
        pGroup = this.create3DPeasantMesh(p);
        this.scene.add(pGroup);
        this.peasantsMap.set(p.id, pGroup);
      }

      pGroup.position.set(p.x, 0, p.y);
      pGroup.visible = this.gridManager.isPixelVisible(p.x, p.y);

      // Smooth Natural 360-degree Facing Direction
      let targetAngle = pGroup.rotation.y;
      if (p.path && p.path.length > 0) {
        const wp = p.path[0];
        if (Math.hypot(wp.x - p.x, wp.y - p.y) > 1.5) {
          targetAngle = Math.atan2(wp.x - p.x, wp.y - p.y);
        }
      } else {
        if (p.direction === 'left') targetAngle = -Math.PI / 2;
        else if (p.direction === 'right') targetAngle = Math.PI / 2;
        else if (p.direction === 'up') targetAngle = Math.PI;
        else if (p.direction === 'down') targetAngle = 0;
      }
      this.smoothRotate(pGroup, targetAngle, delta, 16);

      // Walk Stride
      const isMoving = p.state === 'walking_to_site' || p.state === 'fleeing';
      const legStride = isMoving ? Math.sin(time * 2.0) * 0.45 : 0;

      const leftLeg = pGroup.getObjectByName('leftLeg');
      const rightLeg = pGroup.getObjectByName('rightLeg');
      if (leftLeg) leftLeg.rotation.x = legStride;
      if (rightLeg) rightLeg.rotation.x = -legStride;

      // Smooth Realistic Hammering Swing (no high frequency jitter)
      const rightArm = pGroup.getObjectByName('rightArm');
      if (rightArm) {
        if (p.state === 'hammering_construction' || p.state === 'repairing_building') {
          const hammerPhase = (Date.now() * 0.004) % (Math.PI * 2);
          const swing = Math.sin(hammerPhase);
          rightArm.rotation.x = -0.3 - Math.max(0, swing) * 1.3;
        } else {
          rightArm.rotation.x = isMoving ? -legStride * 0.8 : 0;
        }
      }
    }

    for (const [id, group] of this.peasantsMap.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(group);
        this.peasantsMap.delete(id);
      }
    }
  }

  private create3DPeasantMesh(p: Peasant): THREE.Group {
    const group = new THREE.Group();

    // Torso (Tan Peasant Shirt & Brown Leather Apron)
    const torsoGeo = new THREE.BoxGeometry(2.6, 3.6, 1.8);
    const torsoMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.8 });
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.position.y = 4.6;
    torso.castShadow = true;
    group.add(torso);

    // Head
    const headGeo = new THREE.SphereGeometry(1.25, 8, 8);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xfed7aa, roughness: 0.8 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 7.4;
    head.castShadow = true;
    group.add(head);

    // Peasant Hair / Cap
    const hairGeo = new THREE.SphereGeometry(1.3, 8, 8, 0, Math.PI * 2, 0, Math.PI * 0.45);
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
    const hair = new THREE.Mesh(hairGeo, hairMat);
    hair.position.set(0, 7.6, -0.15);
    group.add(hair);

    // Eyes
    const eyeWhiteGeo = new THREE.SphereGeometry(0.24, 6, 6);
    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilGeo = new THREE.SphereGeometry(0.12, 6, 6);
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x1c1917 });

    const ewL = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat); ewL.position.set(-0.4, 7.55, 1.15); group.add(ewL);
    const pL = new THREE.Mesh(pupilGeo, pupilMat); pL.position.set(-0.4, 7.55, 1.32); group.add(pL);

    const ewR = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat); ewR.position.set(0.4, 7.55, 1.15); group.add(ewR);
    const pR = new THREE.Mesh(pupilGeo, pupilMat); pR.position.set(0.4, 7.55, 1.32); group.add(pR);

    // Eyebrows
    const browGeo = new THREE.BoxGeometry(0.35, 0.08, 0.1);
    const browMat = new THREE.MeshStandardMaterial({ color: 0x451a03 });
    const bL = new THREE.Mesh(browGeo, browMat); bL.position.set(-0.4, 7.88, 1.2); group.add(bL);
    const bR = new THREE.Mesh(browGeo, browMat); bR.position.set(0.4, 7.88, 1.2); group.add(bR);

    // Nose
    const noseGeo = new THREE.BoxGeometry(0.22, 0.3, 0.25);
    const noseMat = new THREE.MeshStandardMaterial({ color: 0xfca5a5, roughness: 0.8 });
    const nose = new THREE.Mesh(noseGeo, noseMat); nose.position.set(0, 7.35, 1.32); group.add(nose);

    // Smile / Mouth
    const mouthGeo = new THREE.BoxGeometry(0.42, 0.1, 0.1);
    const mouthMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.8 });
    const mouth = new THREE.Mesh(mouthGeo, mouthMat); mouth.position.set(0, 6.95, 1.22); group.add(mouth);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.9, 3.2, 0.9);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.8 });

    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.75, 1.6, 0);
    leftLeg.name = 'leftLeg';
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.75, 1.6, 0);
    rightLeg.name = 'rightLeg';
    group.add(rightLeg);

    // Left Arm
    const leftArmGeo = new THREE.BoxGeometry(0.8, 3.2, 0.8);
    const leftArm = new THREE.Mesh(leftArmGeo, torsoMat);
    leftArm.position.set(-1.7, 4.4, 0);
    leftArm.name = 'leftArm';
    group.add(leftArm);

    // Right Arm Holding Hammer
    const armGroup = new THREE.Group();
    armGroup.name = 'rightArm';
    armGroup.position.set(1.7, 5.6, 0);

    const armGeo = new THREE.BoxGeometry(0.8, 3.2, 0.8);
    const arm = new THREE.Mesh(armGeo, torsoMat);
    arm.position.y = -1.2;
    arm.castShadow = true;
    armGroup.add(arm);

    // Wooden Mallet
    const handleGeo = new THREE.CylinderGeometry(0.2, 0.2, 4.2, 6);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x78350f });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.set(0, -1.8, 1.6);
    handle.rotation.x = Math.PI / 3;
    armGroup.add(handle);

    const headMalletGeo = new THREE.BoxGeometry(1.6, 1.6, 2.4);
    const headMalletMat = new THREE.MeshStandardMaterial({ color: 0x451a03 });
    const headMallet = new THREE.Mesh(headMalletGeo, headMalletMat);
    headMallet.position.set(0, -2.8, 3.2);
    armGroup.add(headMallet);

    group.add(armGroup);
    return group;
  }

  // --- 3D HEROES & NAMEPLATES ---
  private updateHeroes(state: GameState, delta: number) {
    const activeIds = new Set<string>();
    const time = Date.now() * 0.01;

    for (const h of state.heroes) {
      if (h.isDead) continue;
      activeIds.add(h.id);
      let heroGroup = this.heroesMap.get(h.id);

      if (!heroGroup) {
        heroGroup = this.create3DHeroMesh(h);
        this.scene.add(heroGroup);
        this.heroesMap.set(h.id, heroGroup);

        // Add 3D Overhead Nameplate
        this.createHeroNameplate(h, heroGroup);
      } else {
        // Update Nameplate on HP or Level change
        this.updateHeroNameplate(h);
      }

      heroGroup.position.set(h.x, 0, h.y);
      heroGroup.visible = this.gridManager.isPixelVisible(h.x, h.y);

      // Smooth Natural 360-degree Facing Direction
      let targetAngle = heroGroup.rotation.y;
      if (h.path && h.path.length > 0) {
        const wp = h.path[0];
        if (Math.hypot(wp.x - h.x, wp.y - h.y) > 1.5) {
          targetAngle = Math.atan2(wp.x - h.x, wp.y - h.y);
        }
      } else if (h.targetX !== undefined && h.targetY !== undefined && Math.hypot(h.targetX - h.x, h.targetY - h.y) > 2) {
        targetAngle = Math.atan2(h.targetX - h.x, h.targetY - h.y);
      } else {
        if (h.direction === 'left') targetAngle = -Math.PI / 2;
        else if (h.direction === 'right') targetAngle = Math.PI / 2;
        else if (h.direction === 'up') targetAngle = Math.PI;
        else if (h.direction === 'down') targetAngle = 0;
      }
      this.smoothRotate(heroGroup, targetAngle, delta, 16);

      const isMoving = (h.state === 'wandering' || h.state === 'pursuing_flag' || h.state === 'fleeing' || h.state === 'collecting_treasure') && h.targetX !== undefined && Math.hypot(h.targetX - h.x, (h.targetY ?? h.y) - h.y) > 6;
      const legStride = isMoving ? Math.sin(time * 2.0) * 0.45 : 0;

      const leftLeg = heroGroup.getObjectByName('leftLeg');
      const rightLeg = heroGroup.getObjectByName('rightLeg');
      if (leftLeg) leftLeg.rotation.x = legStride;
      if (rightLeg) rightLeg.rotation.x = -legStride;

      const rightArm = heroGroup.getObjectByName('rightArm');
      const leftArm = heroGroup.getObjectByName('leftArm');

      if (rightArm) {
        if (h.isAttackingAnimation > 0) {
          const attackFactor = Math.sin((1 - Math.max(0, h.isAttackingAnimation) / 0.3) * Math.PI);
          rightArm.rotation.x = -attackFactor * 1.6;
        } else {
          rightArm.rotation.x = isMoving ? -legStride * 0.8 : 0;
        }
      }

      if (leftArm) {
        leftArm.rotation.x = isMoving ? legStride * 0.8 : 0;
      }
    }

    for (const [id, group] of this.heroesMap.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(group);
        this.heroesMap.delete(id);
        this.heroLabelsMap.delete(id);
      }
    }
  }

  private createHeroNameplate(hero: Hero, heroGroup: THREE.Group) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    this.drawHeroNameCanvas(ctx, hero);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(24, 6.0, 1);
    const headY = hero.heroClass === 'dwarf' ? 10.5 : 12.5;
    sprite.position.set(0, headY, 0);
    sprite.name = 'nameLabel';

    heroGroup.add(sprite);

    this.heroLabelsMap.set(hero.id, {
      canvas,
      texture,
      sprite,
      lastHp: hero.hp,
      lastLevel: hero.level
    });
  }

  private updateHeroNameplate(hero: Hero) {
    const entry = this.heroLabelsMap.get(hero.id);
    if (!entry) return;

    if (Math.abs(entry.lastHp - hero.hp) > 2 || entry.lastLevel !== hero.level) {
      entry.lastHp = hero.hp;
      entry.lastLevel = hero.level;
      const ctx = entry.canvas.getContext('2d');
      if (ctx) {
        this.drawHeroNameCanvas(ctx, hero);
        entry.texture.needsUpdate = true;
      }
    }
  }

  private drawHeroNameCanvas(ctx: CanvasRenderingContext2D, hero: Hero) {
    ctx.clearRect(0, 0, 512, 128);

    const classDef = HERO_CLASS_DEFINITIONS[hero.heroClass];
    const color = classDef.color || '#3b82f6';

    // Dark rounded high-contrast translucent pill banner
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;

    ctx.beginPath();
    ctx.roundRect(12, 12, 488, 104, 20);
    ctx.fill();
    ctx.stroke();

    // Class Color Indicator Dot
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(52, 54, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.5;
    ctx.stroke();

    // Hero Name & Level Text with subtle drop shadow
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${hero.name}  (L${hero.level})`, 82, 50);

    // Mini Health Bar along bottom of nameplate
    const hpRatio = Math.max(0, Math.min(1, hero.hp / hero.maxHp));
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(82, 78, 396, 14);

    ctx.fillStyle = hpRatio > 0.5 ? '#22c55e' : (hpRatio > 0.25 ? '#eab308' : '#ef4444');
    ctx.fillRect(82, 78, 396 * hpRatio, 14);
  }

  private create3DHeroMesh(h: Hero): THREE.Group {
    const group = new THREE.Group();
    const classDef = HERO_CLASS_DEFINITIONS[h.heroClass];
    const colorNum = parseInt(classDef.color.replace('#', '0x'), 16);
    const isDwarf = h.heroClass === 'dwarf';

    // Torso (Proportional medieval armor & tunic)
    const torsoWidth = isDwarf ? 3.2 : 2.8;
    const torsoHeight = isDwarf ? 3.0 : 3.6;
    const torsoGeo = new THREE.BoxGeometry(torsoWidth, torsoHeight, 2.0);
    const torsoMat = new THREE.MeshStandardMaterial({ color: colorNum, roughness: 0.7 });
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.position.y = isDwarf ? 3.8 : 4.6;
    torso.castShadow = true;
    group.add(torso);

    // Head
    const headY = isDwarf ? 6.2 : 7.4;
    const headGeo = new THREE.SphereGeometry(1.25, 8, 8);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xfed7aa, roughness: 0.8 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = headY;
    head.castShadow = true;
    group.add(head);

    // Expressive Eyes with Class specific iris colors
    const eyeWhiteGeo = new THREE.SphereGeometry(0.24, 6, 6);
    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const eyePupilGeo = new THREE.SphereGeometry(0.12, 6, 6);

    let pupilColor = 0x1e3a8a; // blue for warrior
    if (h.heroClass === 'wizard') pupilColor = 0x0284c7;
    else if (h.heroClass === 'ranger') pupilColor = 0x059669;
    else if (h.heroClass === 'cleric') pupilColor = 0xb45309;
    else if (h.heroClass === 'rogue') pupilColor = 0x09090b;
    else if (h.heroClass === 'dwarf') pupilColor = 0xc2410c;

    const pupilMat = new THREE.MeshBasicMaterial({ color: pupilColor });

    const ewL = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat); ewL.position.set(-0.4, headY + 0.15, 1.15); group.add(ewL);
    const pL = new THREE.Mesh(eyePupilGeo, pupilMat); pL.position.set(-0.4, headY + 0.15, 1.32); group.add(pL);

    const ewR = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat); ewR.position.set(0.4, headY + 0.15, 1.15); group.add(ewR);
    const pR = new THREE.Mesh(eyePupilGeo, pupilMat); pR.position.set(0.4, headY + 0.15, 1.32); group.add(pR);

    // Eyebrows
    const browGeo = new THREE.BoxGeometry(0.36, 0.08, 0.1);
    const browColor = h.heroClass === 'wizard' ? 0xf8fafc : (h.heroClass === 'dwarf' ? 0xc2410c : 0x451a03);
    const browMat = new THREE.MeshStandardMaterial({ color: browColor });
    const bL = new THREE.Mesh(browGeo, browMat); bL.position.set(-0.4, headY + 0.45, 1.2); group.add(bL);
    const bR = new THREE.Mesh(browGeo, browMat); bR.position.set(0.4, headY + 0.45, 1.2); group.add(bR);

    // Facial hair / Masks / Class features
    if (h.heroClass === 'wizard') {
      // Flowing White Wizard Beard & Mustache
      const beardGeo = new THREE.ConeGeometry(1.1, 3.4, 6);
      beardGeo.rotateX(Math.PI / 8);
      const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.9 });
      const beard = new THREE.Mesh(beardGeo, whiteMat);
      beard.position.set(0, headY - 1.2, 0.9);
      group.add(beard);
    } else if (h.heroClass === 'dwarf') {
      // Thick Braided Copper Dwarf Beard
      const beardGeo = new THREE.BoxGeometry(2.4, 2.2, 1.2);
      const copperMat = new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.9 });
      const beard = new THREE.Mesh(beardGeo, copperMat);
      beard.position.set(0, headY - 1.0, 0.9);
      group.add(beard);
    } else if (h.heroClass === 'rogue') {
      // Dark Bandit Face Wrap / Mask
      const maskGeo = new THREE.BoxGeometry(2.2, 1.0, 1.1);
      const maskMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.9 });
      const mask = new THREE.Mesh(maskGeo, maskMat);
      mask.position.set(0, headY - 0.4, 0.7);
      group.add(mask);
    } else {
      // Clean / Stubble mouth & nose
      const noseGeo = new THREE.BoxGeometry(0.2, 0.28, 0.22);
      const noseMat = new THREE.MeshStandardMaterial({ color: 0xfca5a5, roughness: 0.8 });
      const nose = new THREE.Mesh(noseGeo, noseMat); nose.position.set(0, headY - 0.05, 1.32); group.add(nose);

      const mouthGeo = new THREE.BoxGeometry(0.38, 0.08, 0.1);
      const mouthMat = new THREE.MeshStandardMaterial({ color: 0x991b1b });
      const mouth = new THREE.Mesh(mouthGeo, mouthMat); mouth.position.set(0, headY - 0.42, 1.22); group.add(mouth);
    }

    // Class specific Headwear
    if (h.heroClass === 'warrior') {
      const helmGeo = new THREE.CylinderGeometry(1.35, 1.4, 1.6, 8);
      const helmMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7, roughness: 0.3 });
      const helm = new THREE.Mesh(helmGeo, helmMat);
      helm.position.y = 8.0;
      group.add(helm);
    } else if (h.heroClass === 'dwarf') {
      const helmGeo = new THREE.CylinderGeometry(1.4, 1.45, 1.4, 8);
      const helmMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.6, roughness: 0.4 });
      const helm = new THREE.Mesh(helmGeo, helmMat);
      helm.position.y = 6.8;
      group.add(helm);
    } else if (h.heroClass === 'wizard') {
      const hatGeo = new THREE.ConeGeometry(2.0, 4.2, 8);
      const hatMat = new THREE.MeshStandardMaterial({ color: 0x6d28d9, roughness: 0.6 });
      const hat = new THREE.Mesh(hatGeo, hatMat);
      hat.position.y = 9.4;
      group.add(hat);
    } else if (h.heroClass === 'cleric') {
      const mitreGeo = new THREE.ConeGeometry(1.6, 3.0, 4);
      const mitreMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.5 });
      const mitre = new THREE.Mesh(mitreGeo, mitreMat);
      mitre.position.y = 8.8;
      group.add(mitre);
    }

    // Legs
    const legHeight = isDwarf ? 2.4 : 3.2;
    const legGeo = new THREE.BoxGeometry(0.9, legHeight, 0.9);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });

    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-0.8, legHeight / 2, 0);
    leftLeg.name = 'leftLeg';
    leftLeg.castShadow = true;
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(0.8, legHeight / 2, 0);
    rightLeg.name = 'rightLeg';
    rightLeg.castShadow = true;
    group.add(rightLeg);

    // Left Arm (and shield/bow)
    const leftArmGeo = new THREE.BoxGeometry(0.8, 3.2, 0.8);
    const leftArm = new THREE.Mesh(leftArmGeo, torsoMat);
    leftArm.position.set(-1.8, isDwarf ? 4.2 : 5.0, 0);
    leftArm.name = 'leftArm';
    leftArm.castShadow = true;
    group.add(leftArm);

    if (h.heroClass === 'warrior' || h.heroClass === 'cleric') {
      const shieldGeo = new THREE.BoxGeometry(1.8, 2.6, 0.4);
      const shieldMat = new THREE.MeshStandardMaterial({
        color: h.heroClass === 'cleric' ? 0xfacc15 : 0x3b82f6,
        metalness: 0.6,
        roughness: 0.3
      });
      const shield = new THREE.Mesh(shieldGeo, shieldMat);
      shield.position.set(-2.2, isDwarf ? 4.2 : 5.0, 0.8);
      shield.castShadow = true;
      group.add(shield);
    }

    // Right Arm (and weapon)
    const armGroup = new THREE.Group();
    armGroup.name = 'rightArm';
    armGroup.position.set(1.8, isDwarf ? 4.8 : 5.6, 0);

    const armGeo = new THREE.BoxGeometry(0.8, 3.2, 0.8);
    const arm = new THREE.Mesh(armGeo, torsoMat);
    arm.position.y = -1.2;
    arm.castShadow = true;
    armGroup.add(arm);

    if (h.heroClass === 'warrior') {
      const swordGeo = new THREE.BoxGeometry(0.5, 5.0, 0.2);
      const swordMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.9, roughness: 0.1 });
      const sword = new THREE.Mesh(swordGeo, swordMat);
      sword.position.set(0, -1.5, 2.2);
      sword.rotation.x = Math.PI / 3;
      sword.castShadow = true;
      armGroup.add(sword);
    } else if (h.heroClass === 'wizard') {
      const staffGeo = new THREE.CylinderGeometry(0.2, 0.2, 6.5, 6);
      const staffMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 });
      const staff = new THREE.Mesh(staffGeo, staffMat);
      staff.position.set(0, -0.6, 1.8);
      staff.rotation.x = Math.PI / 6;
      armGroup.add(staff);

      const orbGeo = new THREE.SphereGeometry(0.6, 8, 8);
      const orbMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 1.0 });
      const orb = new THREE.Mesh(orbGeo, orbMat);
      orb.position.set(0, 2.4, 2.6);
      armGroup.add(orb);
    } else if (h.heroClass === 'dwarf') {
      const axeGeo = new THREE.CylinderGeometry(0.22, 0.22, 4.5, 6);
      const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f });
      const axe = new THREE.Mesh(axeGeo, woodMat);
      axe.position.set(0, -1.2, 1.6);
      axe.rotation.x = Math.PI / 3;
      armGroup.add(axe);

      const bladeGeo = new THREE.BoxGeometry(2.0, 1.6, 0.3);
      const bladeMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 });
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.position.set(0, -2.4, 2.4);
      armGroup.add(blade);
    } else if (h.heroClass === 'cleric') {
      const maceGeo = new THREE.CylinderGeometry(0.25, 0.25, 4.5, 6);
      const metalMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.7 });
      const mace = new THREE.Mesh(maceGeo, metalMat);
      mace.position.set(0, -1.2, 1.6);
      mace.rotation.x = Math.PI / 3;
      armGroup.add(mace);
    }

    group.add(armGroup);
    return group;
  }

  // --- 3D MONSTERS WITH COMPLETE ATTACK ANIMATIONS ---
  private updateMonsters(state: GameState, delta: number) {
    const activeIds = new Set<string>();
    const time = Date.now() * 0.01;

    for (const m of state.monsters) {
      if (m.hp <= 0) continue;
      activeIds.add(m.id);
      let mGroup = this.monstersMap.get(m.id);

      if (!mGroup) {
        mGroup = this.create3DMonsterMesh(m);
        this.scene.add(mGroup);
        this.monstersMap.set(m.id, mGroup);
      }

      mGroup.position.set(m.x, 0, m.y);
      mGroup.visible = this.gridManager.isPixelVisible(m.x, m.y);

      // Smooth Natural 360-degree Facing Direction
      let targetAngle = mGroup.rotation.y;
      if (m.path && m.path.length > 0) {
        const wp = m.path[0];
        if (Math.hypot(wp.x - m.x, wp.y - m.y) > 1.5) {
          targetAngle = Math.atan2(wp.x - m.x, wp.y - m.y);
        }
      } else if (m.targetX !== undefined && m.targetY !== undefined && Math.hypot(m.targetX - m.x, m.targetY - m.y) > 2) {
        targetAngle = Math.atan2(m.targetX - m.x, m.targetY - m.y);
      } else {
        if (m.direction === 'left') targetAngle = -Math.PI / 2;
        else if (m.direction === 'right') targetAngle = Math.PI / 2;
        else if (m.direction === 'up') targetAngle = Math.PI;
        else if (m.direction === 'down') targetAngle = 0;
      }
      this.smoothRotate(mGroup, targetAngle, delta, 14);

      const isAttacking = m.isAttackingAnimation > 0;
      const attackFactor = isAttacking ? Math.sin((1 - Math.max(0, m.isAttackingAnimation) / 0.35) * Math.PI) : 0;
      const isMoving = (m.state === 'wandering' || m.state === 'raiding' || m.state === 'returning_to_lair' || (m.state === 'attacking' && !isAttacking)) && m.targetX !== undefined;
      const walkStride = isMoving ? Math.sin(time * 2.2) * 0.45 : 0;

      // Type-specific Attack & Locomotion Animations
      if (m.type === 'red_dragon') {
        const wingL = mGroup.getObjectByName('wingL');
        const wingR = mGroup.getObjectByName('wingR');
        const dragonHead = mGroup.getObjectByName('dragonHead');
        const dragonTail = mGroup.getObjectByName('dragonTail');
        const flap = Math.sin(time * 1.2) * 0.45;

        if (wingL) wingL.rotation.z = flap + (isAttacking ? attackFactor * 0.5 : 0);
        if (wingR) wingR.rotation.z = -flap - (isAttacking ? attackFactor * 0.5 : 0);

        if (dragonHead) {
          if (isAttacking) {
            dragonHead.position.z = 8 + attackFactor * 6;
            dragonHead.rotation.x = -attackFactor * 0.4;
          } else {
            dragonHead.position.z = 8;
            dragonHead.rotation.x = Math.sin(time * 1.2) * 0.1;
          }
        }

        if (dragonTail) {
          dragonTail.rotation.y = Math.sin(time * 1.5) * 0.4;
        }
      } else if (m.type === 'giant_rat') {
        const ratTail = mGroup.getObjectByName('ratTail');
        const paw1 = mGroup.getObjectByName('paw1');
        const paw2 = mGroup.getObjectByName('paw2');
        const ratHead = mGroup.getObjectByName('ratHead');
        const ratBody = mGroup.getObjectByName('ratBody');

        if (isAttacking) {
          if (ratBody) ratBody.position.z = attackFactor * 2.5;
          if (ratHead) ratHead.position.z = 2.4 + attackFactor * 3.0;
          if (paw1) paw1.rotation.x = attackFactor * 1.2;
          if (paw2) paw2.rotation.x = attackFactor * 1.2;
          if (ratTail) ratTail.rotation.y = Math.sin(time * 12) * 0.8;
        } else {
          if (ratBody) ratBody.position.z = 0;
          if (ratHead) ratHead.position.z = 2.4;
          if (paw1) paw1.rotation.x = walkStride;
          if (paw2) paw2.rotation.x = -walkStride;
          if (ratTail) ratTail.rotation.y = Math.sin(time * 3) * 0.4;
        }
      } else if (m.type === 'skeleton') {
        const rightArm = mGroup.getObjectByName('rightArm');
        const leftArm = mGroup.getObjectByName('leftArm');
        const leftLeg = mGroup.getObjectByName('leftLeg');
        const rightLeg = mGroup.getObjectByName('rightLeg');

        if (leftLeg) leftLeg.rotation.x = walkStride;
        if (rightLeg) rightLeg.rotation.x = -walkStride;

        if (rightArm) {
          if (isAttacking) {
            rightArm.rotation.x = -attackFactor * 1.8;
            rightArm.rotation.z = -attackFactor * 0.3;
          } else {
            rightArm.rotation.x = isMoving ? -walkStride * 0.7 : 0;
            rightArm.rotation.z = 0;
          }
        }
        if (leftArm) {
          leftArm.rotation.x = isAttacking ? -attackFactor * 0.6 : (isMoving ? walkStride * 0.7 : 0);
        }
      } else if (m.type === 'zombie') {
        const rightArm = mGroup.getObjectByName('rightArm');
        const leftArm = mGroup.getObjectByName('leftArm');
        const leftLeg = mGroup.getObjectByName('leftLeg');
        const rightLeg = mGroup.getObjectByName('rightLeg');

        if (leftLeg) leftLeg.rotation.x = walkStride * 0.7;
        if (rightLeg) rightLeg.rotation.x = -walkStride * 0.7;

        if (isAttacking) {
          if (rightArm) rightArm.rotation.x = -attackFactor * 1.5;
          if (leftArm) leftArm.rotation.x = -attackFactor * 1.5;
        } else {
          if (rightArm) rightArm.rotation.x = -0.4 + (isMoving ? Math.sin(time * 1.5) * 0.2 : 0);
          if (leftArm) leftArm.rotation.x = -0.4 - (isMoving ? Math.sin(time * 1.5) * 0.2 : 0);
        }
      } else if (m.type === 'goblin_spearman') {
        const rightArm = mGroup.getObjectByName('rightArm');
        const leftArm = mGroup.getObjectByName('leftArm');
        const leftLeg = mGroup.getObjectByName('leftLeg');
        const rightLeg = mGroup.getObjectByName('rightLeg');

        if (leftLeg) leftLeg.rotation.x = walkStride * 1.2;
        if (rightLeg) rightLeg.rotation.x = -walkStride * 1.2;

        if (rightArm) {
          if (isAttacking) {
            rightArm.position.z = attackFactor * 3.5;
            rightArm.rotation.x = -0.2;
          } else {
            rightArm.position.z = 0;
            rightArm.rotation.x = isMoving ? -walkStride * 0.8 : 0;
          }
        }
        if (leftArm) leftArm.rotation.x = isMoving ? walkStride * 0.8 : 0;
      } else if (m.type === 'goblin_shaman') {
        const rightArm = mGroup.getObjectByName('rightArm');
        const leftLeg = mGroup.getObjectByName('leftLeg');
        const rightLeg = mGroup.getObjectByName('rightLeg');

        if (leftLeg) leftLeg.rotation.x = walkStride;
        if (rightLeg) rightLeg.rotation.x = -walkStride;

        if (rightArm) {
          if (isAttacking) {
            rightArm.rotation.x = -1.6 - attackFactor * 0.5;
          } else {
            rightArm.rotation.x = -0.4;
          }
        }
      } else if (m.type === 'dire_wolf') {
        const wolfTail = mGroup.getObjectByName('wolfTail');
        const paw1 = mGroup.getObjectByName('paw1');
        const paw2 = mGroup.getObjectByName('paw2');
        const wolfHead = mGroup.getObjectByName('wolfHead');
        const wolfBody = mGroup.getObjectByName('wolfBody');

        if (isAttacking) {
          if (wolfBody) wolfBody.position.z = attackFactor * 3.0;
          if (wolfHead) wolfHead.rotation.x = -attackFactor * 0.6;
          if (paw1) paw1.rotation.x = attackFactor * 1.1;
          if (paw2) paw2.rotation.x = attackFactor * 1.1;
          if (wolfTail) wolfTail.rotation.y = Math.sin(time * 10) * 0.7;
        } else {
          if (wolfBody) wolfBody.position.z = 0;
          if (wolfHead) wolfHead.rotation.x = 0;
          if (paw1) paw1.rotation.x = walkStride * 1.2;
          if (paw2) paw2.rotation.x = -walkStride * 1.2;
          if (wolfTail) wolfTail.rotation.y = Math.sin(time * 2.5) * 0.35;
        }
      } else if (m.type === 'minotaur') {
        const rightArm = mGroup.getObjectByName('rightArm');
        const leftArm = mGroup.getObjectByName('leftArm');
        const leftLeg = mGroup.getObjectByName('leftLeg');
        const rightLeg = mGroup.getObjectByName('rightLeg');

        if (leftLeg) leftLeg.rotation.x = walkStride * 0.8;
        if (rightLeg) rightLeg.rotation.x = -walkStride * 0.8;

        if (rightArm) {
          if (isAttacking) {
            rightArm.rotation.x = -attackFactor * 2.2;
          } else {
            rightArm.rotation.x = isMoving ? -walkStride * 0.6 : 0;
          }
        }
        if (leftArm) leftArm.rotation.x = isMoving ? walkStride * 0.6 : 0;
      } else if (m.type === 'necromancer') {
        const rightArm = mGroup.getObjectByName('rightArm');
        const leftArm = mGroup.getObjectByName('leftArm');

        // Levitation hovering
        mGroup.position.y = Math.sin(time * 2.0) * 0.8 + (isAttacking ? attackFactor * 2.5 : 0);

        if (isAttacking) {
          if (rightArm) {
            rightArm.rotation.x = -1.6;
            rightArm.rotation.z = attackFactor * 0.6;
          }
          if (leftArm) {
            leftArm.rotation.x = -1.2;
            leftArm.rotation.z = -attackFactor * 0.6;
          }
        } else {
          if (rightArm) {
            rightArm.rotation.x = -0.5;
            rightArm.rotation.z = 0;
          }
          if (leftArm) {
            leftArm.rotation.x = -0.3;
            leftArm.rotation.z = 0;
          }
        }
      }
    }

    for (const [id, group] of this.monstersMap.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(group);
        this.monstersMap.delete(id);
      }
    }
  }

  private create3DMonsterMesh(m: Monster): THREE.Group {
    const group = new THREE.Group();
    const def = MONSTER_DEFINITIONS[m.type];
    const colorNum = parseInt(def.color.replace('#', '0x'), 16);

    if (m.type === 'red_dragon') {
      // Colossal Majestic Red Dragon Boss
      const bodyGeo = new THREE.SphereGeometry(9, 12, 12);
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.7 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 16;
      body.scale.set(1.4, 0.9, 1.1);
      body.castShadow = true;
      body.name = 'dragonBody';
      group.add(body);

      // Dragon Neck & Head
      const headGroup = new THREE.Group();
      headGroup.name = 'dragonHead';
      headGroup.position.set(0, 19, 8);

      const neckGeo = new THREE.CylinderGeometry(2.4, 3.6, 7, 8);
      neckGeo.rotateX(Math.PI / 4);
      const neck = new THREE.Mesh(neckGeo, bodyMat);
      headGroup.add(neck);

      const headGeo = new THREE.ConeGeometry(3.2, 7.5, 8);
      headGeo.rotateX(-Math.PI / 2);
      const head = new THREE.Mesh(headGeo, bodyMat);
      head.position.set(0, 3, 4);
      head.castShadow = true;
      headGroup.add(head);

      // Glowing Dragon Eyes
      const eyeGeo = new THREE.SphereGeometry(0.7, 6, 6);
      const eyeMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xf59e0b, emissiveIntensity: 1.5 });
      const eL = new THREE.Mesh(eyeGeo, eyeMat); eL.position.set(-1.8, 4.2, 4.5); headGroup.add(eL);
      const eR = new THREE.Mesh(eyeGeo, eyeMat); eR.position.set(1.8, 4.2, 4.5); headGroup.add(eR);

      // Dragon Horns
      const hornGeo = new THREE.ConeGeometry(0.8, 5.5, 6);
      hornGeo.rotateX(-Math.PI / 3);
      const hornMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.5 });
      const hL = new THREE.Mesh(hornGeo, hornMat); hL.position.set(-1.8, 5.5, 2); headGroup.add(hL);
      const hR = new THREE.Mesh(hornGeo, hornMat); hR.position.set(1.8, 5.5, 2); headGroup.add(hR);

      group.add(headGroup);

      // Massive Wings
      const wingGeo = new THREE.PlaneGeometry(22, 14);
      const wingMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, side: THREE.DoubleSide });

      const wingL = new THREE.Mesh(wingGeo, wingMat);
      wingL.position.set(-14, 20, 0);
      wingL.name = 'wingL';
      group.add(wingL);

      const wingR = new THREE.Mesh(wingGeo, wingMat);
      wingR.position.set(14, 20, 0);
      wingR.name = 'wingR';
      group.add(wingR);

      // Sinuous Spiked Tail
      const tailGeo = new THREE.CylinderGeometry(1.4, 0.4, 18, 6);
      tailGeo.rotateX(Math.PI / 2);
      const tail = new THREE.Mesh(tailGeo, bodyMat);
      tail.position.set(0, 15, -12);
      tail.name = 'dragonTail';
      group.add(tail);
    } else if (m.type === 'giant_rat') {
      // Proportional 3D Giant Sewer Rat Monster
      const bodyGeo = new THREE.SphereGeometry(2.4, 10, 8);
      const ratMat = new THREE.MeshStandardMaterial({ color: 0x44403c, roughness: 0.9 });
      const body = new THREE.Mesh(bodyGeo, ratMat);
      body.position.y = 1.8;
      body.scale.set(1.4, 0.85, 1);
      body.castShadow = true;
      body.name = 'ratBody';
      group.add(body);

      // Snout & Head
      const headGeo = new THREE.ConeGeometry(1.4, 3.2, 8);
      headGeo.rotateX(-Math.PI / 2);
      const head = new THREE.Mesh(headGeo, ratMat);
      head.position.set(0, 1.8, 2.4);
      head.castShadow = true;
      head.name = 'ratHead';
      group.add(head);

      // Pink Ears
      const earGeo = new THREE.SphereGeometry(0.65, 6, 6);
      const pinkMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e });
      const earL = new THREE.Mesh(earGeo, pinkMat); earL.position.set(-1.0, 2.8, 1.6); group.add(earL);
      const earR = new THREE.Mesh(earGeo, pinkMat); earR.position.set(1.0, 2.8, 1.6); group.add(earR);

      // Glowing Red Eyes
      const eyeGeo = new THREE.SphereGeometry(0.32, 6, 6);
      const redEyeMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 1.2 });
      const eyeL = new THREE.Mesh(eyeGeo, redEyeMat); eyeL.position.set(-0.6, 2.1, 2.8); group.add(eyeL);
      const eyeR = new THREE.Mesh(eyeGeo, redEyeMat); eyeR.position.set(0.6, 2.1, 2.8); group.add(eyeR);

      // Sinuous Whipping Tail
      const tailGeo = new THREE.CylinderGeometry(0.3, 0.1, 7.5, 6);
      tailGeo.rotateX(Math.PI / 2);
      const tail = new THREE.Mesh(tailGeo, pinkMat);
      tail.position.set(0, 1.8, -4.8);
      tail.name = 'ratTail';
      group.add(tail);

      // 4 Paws
      const pawGeo = new THREE.BoxGeometry(0.8, 1.3, 0.9);
      const p1 = new THREE.Mesh(pawGeo, pinkMat); p1.position.set(-1.3, 0.65, 1.3); p1.name = 'paw1'; group.add(p1);
      const p2 = new THREE.Mesh(pawGeo, pinkMat); p2.position.set(1.3, 0.65, 1.3); p2.name = 'paw2'; group.add(p2);
      const p3 = new THREE.Mesh(pawGeo, pinkMat); p3.position.set(-1.3, 0.65, -1.3); group.add(p3);
      const p4 = new THREE.Mesh(pawGeo, pinkMat); p4.position.set(1.3, 0.65, -1.3); group.add(p4);
    } else if (m.type === 'skeleton') {
      // 3D Skeleton Warrior with Sword & Buckler
      const boneMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.9 });
      const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });

      const torsoGeo = new THREE.BoxGeometry(2.4, 3.4, 1.6);
      const torso = new THREE.Mesh(torsoGeo, boneMat);
      torso.position.y = 4.6;
      torso.castShadow = true;
      group.add(torso);

      const skullGeo = new THREE.SphereGeometry(1.2, 8, 8);
      const skull = new THREE.Mesh(skullGeo, boneMat);
      skull.position.y = 7.4;
      skull.castShadow = true;
      group.add(skull);

      // Glowing Cyan Eye Sockets
      const eyeGeo = new THREE.SphereGeometry(0.24, 6, 6);
      const cyanEyeMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 1.5 });
      const eL = new THREE.Mesh(eyeGeo, cyanEyeMat); eL.position.set(-0.45, 7.5, 0.9); group.add(eL);
      const eR = new THREE.Mesh(eyeGeo, cyanEyeMat); eR.position.set(0.45, 7.5, 0.9); group.add(eR);

      // Bone Legs
      const legGeo = new THREE.BoxGeometry(0.7, 3.2, 0.7);
      const leftLeg = new THREE.Mesh(legGeo, boneMat); leftLeg.position.set(-0.7, 1.6, 0); leftLeg.name = 'leftLeg'; group.add(leftLeg);
      const rightLeg = new THREE.Mesh(legGeo, boneMat); rightLeg.position.set(0.7, 1.6, 0); rightLeg.name = 'rightLeg'; group.add(rightLeg);

      // Left Arm with Buckler Shield
      const armGeo = new THREE.BoxGeometry(0.7, 3.0, 0.7);
      const leftArm = new THREE.Mesh(armGeo, boneMat); leftArm.position.set(-1.6, 5.0, 0); leftArm.name = 'leftArm'; group.add(leftArm);

      const shieldGeo = new THREE.CylinderGeometry(1.4, 1.4, 0.3, 8);
      shieldGeo.rotateX(Math.PI / 2);
      const shieldMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 });
      const shield = new THREE.Mesh(shieldGeo, shieldMat);
      shield.position.set(-1.9, 5.0, 0.8);
      group.add(shield);

      // Right Arm with Jagged Iron Sword
      const armGroup = new THREE.Group();
      armGroup.name = 'rightArm';
      armGroup.position.set(1.6, 5.6, 0);

      const arm = new THREE.Mesh(armGeo, boneMat);
      arm.position.y = -1.0;
      armGroup.add(arm);

      const swordGeo = new THREE.BoxGeometry(0.4, 4.4, 0.2);
      const sword = new THREE.Mesh(swordGeo, darkMat);
      sword.position.set(0, -1.2, 1.8);
      sword.rotation.x = Math.PI / 3;
      armGroup.add(sword);

      group.add(armGroup);
    } else if (m.type === 'zombie') {
      // Rotting Zombie Ghoul with Outstretched Claw Arms
      const zombieMat = new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.9 });
      const clothMat = new THREE.MeshStandardMaterial({ color: 0x3f3f46, roughness: 0.9 });

      const torsoGeo = new THREE.BoxGeometry(2.8, 3.4, 1.8);
      const torso = new THREE.Mesh(torsoGeo, clothMat);
      torso.position.set(0, 4.4, 0.4);
      torso.rotation.x = 0.2;
      torso.castShadow = true;
      group.add(torso);

      const headGeo = new THREE.SphereGeometry(1.2, 8, 8);
      const head = new THREE.Mesh(headGeo, zombieMat);
      head.position.set(0, 6.8, 0.8);
      head.castShadow = true;
      group.add(head);

      const legGeo = new THREE.BoxGeometry(0.85, 3.0, 0.85);
      const leftLeg = new THREE.Mesh(legGeo, clothMat); leftLeg.position.set(-0.7, 1.5, 0); leftLeg.name = 'leftLeg'; group.add(leftLeg);
      const rightLeg = new THREE.Mesh(legGeo, clothMat); rightLeg.position.set(0.7, 1.5, 0); rightLeg.name = 'rightLeg'; group.add(rightLeg);

      // Outstretched Claws
      const armGeo = new THREE.BoxGeometry(0.75, 3.2, 0.75);

      const lArm = new THREE.Mesh(armGeo, zombieMat);
      lArm.position.set(-1.6, 5.0, 0.8);
      lArm.rotation.x = -0.4;
      lArm.name = 'leftArm';
      group.add(lArm);

      const rArm = new THREE.Mesh(armGeo, zombieMat);
      rArm.position.set(1.6, 5.0, 0.8);
      rArm.rotation.x = -0.4;
      rArm.name = 'rightArm';
      group.add(rArm);
    } else if (m.type === 'goblin_spearman') {
      // Crafty Green Goblin with Flint Spear
      const goblinMat = new THREE.MeshStandardMaterial({ color: 0x84cc16, roughness: 0.8 });
      const leatherMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });

      const torsoGeo = new THREE.BoxGeometry(2.2, 2.6, 1.6);
      const torso = new THREE.Mesh(torsoGeo, leatherMat);
      torso.position.y = 3.6;
      group.add(torso);

      const headGeo = new THREE.SphereGeometry(1.15, 8, 8);
      const head = new THREE.Mesh(headGeo, goblinMat);
      head.position.y = 5.8;
      group.add(head);

      // Goblin Pointed Ears
      const earGeo = new THREE.ConeGeometry(0.4, 1.4, 4);
      earGeo.rotateZ(Math.PI / 3);
      const eL = new THREE.Mesh(earGeo, goblinMat); eL.position.set(-1.4, 6.0, 0); group.add(eL);
      const eR = new THREE.Mesh(earGeo, goblinMat); eR.position.set(1.4, 6.0, 0); eR.rotation.z = -Math.PI / 1.5; group.add(eR);

      const legGeo = new THREE.BoxGeometry(0.75, 2.4, 0.75);
      const leftLeg = new THREE.Mesh(legGeo, leatherMat); leftLeg.position.set(-0.6, 1.2, 0); leftLeg.name = 'leftLeg'; group.add(leftLeg);
      const rightLeg = new THREE.Mesh(legGeo, leatherMat); rightLeg.position.set(0.6, 1.2, 0); rightLeg.name = 'rightLeg'; group.add(rightLeg);

      const leftArmGeo = new THREE.BoxGeometry(0.65, 2.4, 0.65);
      const leftArm = new THREE.Mesh(leftArmGeo, goblinMat); leftArm.position.set(-1.4, 3.8, 0); leftArm.name = 'leftArm'; group.add(leftArm);

      // Right Arm with Spear
      const armGroup = new THREE.Group();
      armGroup.name = 'rightArm';
      armGroup.position.set(1.4, 4.4, 0);

      const arm = new THREE.Mesh(leftArmGeo, goblinMat);
      arm.position.y = -0.8;
      armGroup.add(arm);

      const spearGeo = new THREE.CylinderGeometry(0.16, 0.16, 5.8, 6);
      const spearMat = new THREE.MeshStandardMaterial({ color: 0x451a03 });
      const spear = new THREE.Mesh(spearGeo, spearMat);
      spear.position.set(0, 0, 1.8);
      spear.rotation.x = Math.PI / 2;
      armGroup.add(spear);

      const tipGeo = new THREE.ConeGeometry(0.5, 1.6, 6);
      tipGeo.rotateX(Math.PI / 2);
      const tipMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 });
      const tip = new THREE.Mesh(tipGeo, tipMat);
      tip.position.set(0, 0, 4.8);
      armGroup.add(tip);

      group.add(armGroup);
    } else if (m.type === 'goblin_shaman') {
      // Goblin Shaman with Skull Staff
      const robeMat = new THREE.MeshStandardMaterial({ color: 0x7c3aed, roughness: 0.8 });
      const goblinMat = new THREE.MeshStandardMaterial({ color: 0x84cc16, roughness: 0.8 });

      const torsoGeo = new THREE.ConeGeometry(1.8, 3.4, 6);
      const torso = new THREE.Mesh(torsoGeo, robeMat);
      torso.position.y = 3.0;
      group.add(torso);

      const headGeo = new THREE.SphereGeometry(1.15, 8, 8);
      const head = new THREE.Mesh(headGeo, goblinMat);
      head.position.y = 5.6;
      group.add(head);

      const legGeo = new THREE.BoxGeometry(0.7, 2.0, 0.7);
      const leftLeg = new THREE.Mesh(legGeo, robeMat); leftLeg.position.set(-0.6, 1.0, 0); leftLeg.name = 'leftLeg'; group.add(leftLeg);
      const rightLeg = new THREE.Mesh(legGeo, robeMat); rightLeg.position.set(0.6, 1.0, 0); rightLeg.name = 'rightLeg'; group.add(rightLeg);

      // Shaman Staff
      const armGroup = new THREE.Group();
      armGroup.name = 'rightArm';
      armGroup.position.set(1.4, 4.4, 0);

      const staffGeo = new THREE.CylinderGeometry(0.2, 0.2, 5.5, 6);
      const staffMat = new THREE.MeshStandardMaterial({ color: 0x451a03 });
      const staff = new THREE.Mesh(staffGeo, staffMat);
      staff.position.set(0, 0, 1.2);
      staff.rotation.x = Math.PI / 4;
      armGroup.add(staff);

      const orbGeo = new THREE.SphereGeometry(0.7, 8, 8);
      const orbMat = new THREE.MeshStandardMaterial({ color: 0xa855f7, emissive: 0x9333ea, emissiveIntensity: 1.2 });
      const orb = new THREE.Mesh(orbGeo, orbMat);
      orb.position.set(0, 2.2, 2.8);
      armGroup.add(orb);

      group.add(armGroup);
    } else if (m.type === 'dire_wolf') {
      // Muscular Quadruped Dire Wolf
      const wolfMat = new THREE.MeshStandardMaterial({ color: 0x52525b, roughness: 0.85 });

      const bodyGeo = new THREE.SphereGeometry(2.4, 8, 8);
      const body = new THREE.Mesh(bodyGeo, wolfMat);
      body.position.y = 2.8;
      body.scale.set(1.5, 0.95, 1.0);
      body.castShadow = true;
      body.name = 'wolfBody';
      group.add(body);

      // Wolf Muzzle & Head
      const headGeo = new THREE.ConeGeometry(1.4, 3.6, 8);
      headGeo.rotateX(-Math.PI / 2);
      const head = new THREE.Mesh(headGeo, wolfMat);
      head.position.set(0, 3.4, 3.0);
      head.name = 'wolfHead';
      group.add(head);

      // Glowing Yellow Eyes
      const eyeGeo = new THREE.SphereGeometry(0.3, 6, 6);
      const yelEyeMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xeab308, emissiveIntensity: 1.4 });
      const eL = new THREE.Mesh(eyeGeo, yelEyeMat); eL.position.set(-0.65, 3.8, 3.2); group.add(eL);
      const eR = new THREE.Mesh(eyeGeo, yelEyeMat); eR.position.set(0.65, 3.8, 3.2); group.add(eR);

      // Bushy Wolf Tail
      const tailGeo = new THREE.ConeGeometry(0.75, 4.5, 6);
      tailGeo.rotateX(Math.PI / 3);
      const tail = new THREE.Mesh(tailGeo, wolfMat);
      tail.position.set(0, 2.8, -3.6);
      tail.name = 'wolfTail';
      group.add(tail);

      // 4 Running Legs
      const legGeo = new THREE.BoxGeometry(0.85, 2.4, 0.85);
      const p1 = new THREE.Mesh(legGeo, wolfMat); p1.position.set(-1.2, 1.2, 1.6); p1.name = 'paw1'; group.add(p1);
      const p2 = new THREE.Mesh(legGeo, wolfMat); p2.position.set(1.2, 1.2, 1.6); p2.name = 'paw2'; group.add(p2);
      const p3 = new THREE.Mesh(legGeo, wolfMat); p3.position.set(-1.2, 1.2, -1.6); group.add(p3);
      const p4 = new THREE.Mesh(legGeo, wolfMat); p4.position.set(1.2, 1.2, -1.6); group.add(p4);
    } else if (m.type === 'minotaur') {
      // Towering Muscular Minotaur Brute with Battleaxe
      const bullMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.85 });

      const torsoGeo = new THREE.BoxGeometry(5.2, 5.8, 3.4);
      const torso = new THREE.Mesh(torsoGeo, bullMat);
      torso.position.y = 7.5;
      torso.castShadow = true;
      group.add(torso);

      const headGeo = new THREE.BoxGeometry(2.8, 3.0, 2.8);
      const head = new THREE.Mesh(headGeo, bullMat);
      head.position.set(0, 11.6, 1.0);
      group.add(head);

      // Horns
      const hornGeo = new THREE.ConeGeometry(0.7, 4.5, 6);
      hornGeo.rotateZ(Math.PI / 3);
      const hornMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
      const hL = new THREE.Mesh(hornGeo, hornMat); hL.position.set(-2.6, 13.0, 0.8); group.add(hL);
      const hR = new THREE.Mesh(hornGeo, hornMat); hR.position.set(2.6, 13.0, 0.8); hR.rotation.z = -Math.PI / 1.5; group.add(hR);

      // Legs
      const legGeo = new THREE.BoxGeometry(1.8, 4.8, 1.8);
      const leftLeg = new THREE.Mesh(legGeo, bullMat); leftLeg.position.set(-1.4, 2.4, 0); leftLeg.name = 'leftLeg'; group.add(leftLeg);
      const rightLeg = new THREE.Mesh(legGeo, bullMat); rightLeg.position.set(1.4, 2.4, 0); rightLeg.name = 'rightLeg'; group.add(rightLeg);

      // Left Arm
      const armGeo = new THREE.BoxGeometry(1.5, 4.8, 1.5);
      const leftArm = new THREE.Mesh(armGeo, bullMat); leftArm.position.set(-3.2, 7.8, 0); leftArm.name = 'leftArm'; group.add(leftArm);

      // Right Arm with Giant Battleaxe
      const armGroup = new THREE.Group();
      armGroup.name = 'rightArm';
      armGroup.position.set(3.2, 9.0, 0);

      const arm = new THREE.Mesh(armGeo, bullMat);
      arm.position.y = -1.8;
      armGroup.add(arm);

      const axeShaftGeo = new THREE.CylinderGeometry(0.35, 0.35, 8.5, 6);
      const woodMat = new THREE.MeshStandardMaterial({ color: 0x451a03 });
      const shaft = new THREE.Mesh(axeShaftGeo, woodMat);
      shaft.position.set(0, -2.0, 2.8);
      shaft.rotation.x = Math.PI / 3;
      armGroup.add(shaft);

      const axeBladeGeo = new THREE.BoxGeometry(3.6, 2.6, 0.4);
      const bladeMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8 });
      const blade = new THREE.Mesh(axeBladeGeo, bladeMat);
      blade.position.set(0, -4.5, 4.5);
      armGroup.add(blade);

      group.add(armGroup);
    } else if (m.type === 'necromancer') {
      // Dark Necromancer Boss with Hovering Scythe & Aura
      const darkMat = new THREE.MeshStandardMaterial({ color: 0x3b0764, roughness: 0.7 });

      const torsoGeo = new THREE.CylinderGeometry(1.6, 2.8, 5.5, 8);
      const torso = new THREE.Mesh(torsoGeo, darkMat);
      torso.position.y = 5.0;
      torso.castShadow = true;
      group.add(torso);

      const hoodGeo = new THREE.SphereGeometry(1.4, 8, 8);
      const hood = new THREE.Mesh(hoodGeo, darkMat);
      hood.position.y = 8.4;
      group.add(hood);

      // Glowing Violet Skull Eyes
      const eyeGeo = new THREE.SphereGeometry(0.3, 6, 6);
      const purpEyeMat = new THREE.MeshStandardMaterial({ color: 0xc084fc, emissive: 0xa855f7, emissiveIntensity: 1.8 });
      const eL = new THREE.Mesh(eyeGeo, purpEyeMat); eL.position.set(-0.5, 8.5, 1.0); group.add(eL);
      const eR = new THREE.Mesh(eyeGeo, purpEyeMat); eR.position.set(0.5, 8.5, 1.0); group.add(eR);

      // Arms & Scythe
      const armGeo = new THREE.BoxGeometry(0.7, 3.2, 0.7);
      const leftArm = new THREE.Mesh(armGeo, darkMat); leftArm.position.set(-1.8, 5.5, 0); leftArm.name = 'leftArm'; group.add(leftArm);

      const armGroup = new THREE.Group();
      armGroup.name = 'rightArm';
      armGroup.position.set(1.8, 6.2, 0);

      const arm = new THREE.Mesh(armGeo, darkMat);
      arm.position.y = -1.0;
      armGroup.add(arm);

      const scytheGeo = new THREE.CylinderGeometry(0.2, 0.2, 7.0, 6);
      const scMat = new THREE.MeshStandardMaterial({ color: 0x18181b });
      const scythe = new THREE.Mesh(scytheGeo, scMat);
      scythe.position.set(0, -0.5, 1.8);
      scythe.rotation.x = Math.PI / 4;
      armGroup.add(scythe);

      const scBladeGeo = new THREE.BoxGeometry(3.0, 0.8, 0.2);
      const bladeMat = new THREE.MeshStandardMaterial({ color: 0x9333ea, emissive: 0x7e22ce, emissiveIntensity: 0.9 });
      const scBlade = new THREE.Mesh(scBladeGeo, bladeMat);
      scBlade.position.set(1.0, 2.5, 3.5);
      armGroup.add(scBlade);

      group.add(armGroup);
    } else {
      const bodyGeo = new THREE.BoxGeometry(3.0, 4.5, 2.0);
      const bodyMat = new THREE.MeshStandardMaterial({ color: colorNum, roughness: 0.8 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 4.0;
      body.castShadow = true;
      group.add(body);

      const headGeo = new THREE.SphereGeometry(1.4, 8, 8);
      const head = new THREE.Mesh(headGeo, bodyMat);
      head.position.y = 7.0;
      head.castShadow = true;
      group.add(head);
    }

    return group;
  }

  // --- 3D TAX COLLECTOR ---
  private updateTaxCollectors(state: GameState, delta: number) {
    const activeIds = new Set<string>();
    const time = Date.now() * 0.01;

    for (const tc of state.taxCollectors) {
      activeIds.add(tc.id);
      let tcGroup = this.taxCollectorsMap.get(tc.id);

      if (!tcGroup) {
        tcGroup = this.create3DTaxCollectorMesh(tc);
        this.scene.add(tcGroup);
        this.taxCollectorsMap.set(tc.id, tcGroup);
      }

      tcGroup.position.set(tc.x, 0, tc.y);
      tcGroup.visible = this.gridManager.isPixelVisible(tc.x, tc.y);

      // Smooth Natural 360-degree Facing Direction
      let targetAngle = tcGroup.rotation.y;
      if (tc.path && tc.path.length > 0) {
        const wp = tc.path[0];
        if (Math.hypot(wp.x - tc.x, wp.y - tc.y) > 1.5) {
          targetAngle = Math.atan2(wp.x - tc.x, wp.y - tc.y);
        }
      } else {
        if (tc.direction === 'left') targetAngle = -Math.PI / 2;
        else if (tc.direction === 'right') targetAngle = Math.PI / 2;
        else if (tc.direction === 'up') targetAngle = Math.PI;
        else if (tc.direction === 'down') targetAngle = 0;
      }
      this.smoothRotate(tcGroup, targetAngle, delta, 16);

      // Waddling gait
      const legStride = Math.sin(time * 2.0) * 0.45;
      const leftLeg = tcGroup.getObjectByName('leftLeg');
      const rightLeg = tcGroup.getObjectByName('rightLeg');
      if (leftLeg) leftLeg.rotation.x = legStride;
      if (rightLeg) rightLeg.rotation.x = -legStride;

      // Dynamic Gold Sack Expansion
      const sack = tcGroup.getObjectByName('taxSack');
      if (sack) {
        const scaleFactor = 1.0 + Math.min(1.2, tc.goldCarried / 120);
        sack.scale.setScalar(scaleFactor);
      }
    }

    for (const [id, group] of this.taxCollectorsMap.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(group);
        this.taxCollectorsMap.delete(id);
      }
    }
  }

  private create3DTaxCollectorMesh(tc: TaxCollector): THREE.Group {
    const group = new THREE.Group();

    // Royal Purple Velvet Tunic
    const bodyGeo = new THREE.BoxGeometry(2.8, 3.8, 2.0);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x6b21a8, roughness: 0.7 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 4.6;
    body.castShadow = true;
    group.add(body);

    // Head
    const headGeo = new THREE.SphereGeometry(1.25, 8, 8);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xfed7aa, roughness: 0.8 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 7.4;
    group.add(head);

    // Left eye (stern look)
    const eyeWhiteGeo = new THREE.SphereGeometry(0.24, 6, 6);
    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pupilGeo = new THREE.SphereGeometry(0.12, 6, 6);
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x1c1917 });

    const ewL = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat); ewL.position.set(-0.4, 7.55, 1.15); group.add(ewL);
    const pL = new THREE.Mesh(pupilGeo, pupilMat); pL.position.set(-0.4, 7.55, 1.32); group.add(pL);

    // Right eye: Golden Aristocratic Monocle
    const ewR = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat); ewR.position.set(0.4, 7.55, 1.15); group.add(ewR);
    const pR = new THREE.Mesh(pupilGeo, pupilMat); pR.position.set(0.4, 7.55, 1.32); group.add(pR);

    const monocleGeo = new THREE.RingGeometry(0.24, 0.38, 12);
    const monocleMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.9, roughness: 0.1 });
    const monocle = new THREE.Mesh(monocleGeo, monocleMat);
    monocle.position.set(0.4, 7.55, 1.38);
    group.add(monocle);

    // Curled Aristocratic Handlebar Mustache
    const stacheGeo = new THREE.BoxGeometry(1.4, 0.32, 0.35);
    const stacheMat = new THREE.MeshStandardMaterial({ color: 0x451a03 });
    const stache = new THREE.Mesh(stacheGeo, stacheMat);
    stache.position.set(0, 7.05, 1.25);
    group.add(stache);

    // Feathered Purple Velvet Beret Cap
    const capGeo = new THREE.CylinderGeometry(1.8, 1.8, 0.8, 8);
    const capMat = new THREE.MeshStandardMaterial({ color: 0x581c87 });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.y = 8.4;
    group.add(cap);

    // Legs
    const legGeo = new THREE.BoxGeometry(0.9, 3.2, 0.9);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x3b0764 });
    const leftLeg = new THREE.Mesh(legGeo, legMat); leftLeg.position.set(-0.75, 1.6, 0); leftLeg.name = 'leftLeg'; group.add(leftLeg);
    const rightLeg = new THREE.Mesh(legGeo, legMat); rightLeg.position.set(0.75, 1.6, 0); rightLeg.name = 'rightLeg'; group.add(rightLeg);

    // Arms
    const armGeo = new THREE.BoxGeometry(0.8, 3.2, 0.8);
    const leftArm = new THREE.Mesh(armGeo, bodyMat); leftArm.position.set(-1.7, 4.4, 0); group.add(leftArm);
    const rightArm = new THREE.Mesh(armGeo, bodyMat); rightArm.position.set(1.7, 4.4, 0); group.add(rightArm);

    // Heavy Leather Tax Sack on Back
    const sackGeo = new THREE.SphereGeometry(1.8, 8, 8);
    const sackMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.6 });
    const sack = new THREE.Mesh(sackGeo, sackMat);
    sack.position.set(0, 4.8, -1.6);
    sack.castShadow = true;
    sack.name = 'taxSack';
    group.add(sack);

    return group;
  }

  // --- 3D PROJECTILES (ARROWS, FIREBALLS, SPELLS) ---
  private updateProjectiles(state: GameState) {
    const activeIds = new Set<string>();

    for (const p of state.projectiles) {
      activeIds.add(p.id);
      let pMesh = this.projectilesMap.get(p.id);

      if (!pMesh) {
        pMesh = new THREE.Group();

        if (p.type === 'arrow') {
          // Detailed 3D Feathered Arrow with Steel Broadhead
          const shaftGeo = new THREE.CylinderGeometry(0.35, 0.35, 12, 6);
          shaftGeo.rotateX(Math.PI / 2);
          const shaftMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 });
          const shaft = new THREE.Mesh(shaftGeo, shaftMat);
          pMesh.add(shaft);

          // Steel Arrowhead
          const headGeo = new THREE.ConeGeometry(0.9, 3, 6);
          headGeo.rotateX(Math.PI / 2);
          const headMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.9, roughness: 0.1 });
          const head = new THREE.Mesh(headGeo, headMat);
          head.position.z = 6.5;
          pMesh.add(head);

          // White Feather Fletchings
          const fletchGeo = new THREE.PlaneGeometry(1.8, 3.5);
          const fletchMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc, side: THREE.DoubleSide });

          const f1 = new THREE.Mesh(fletchGeo, fletchMat);
          f1.position.z = -5;
          pMesh.add(f1);

          const f2 = new THREE.Mesh(fletchGeo, fletchMat);
          f2.position.z = -5;
          f2.rotation.z = Math.PI / 2;
          pMesh.add(f2);
        } else if (p.type === 'fireball' || p.type === 'dragon_breath') {
          // Blazing Fireball Core
          const sphereGeo = new THREE.SphereGeometry(4.5, 8, 8);
          const sphereMat = new THREE.MeshStandardMaterial({
            color: 0xf97316,
            emissive: 0xfbbf24,
            emissiveIntensity: 1.2,
            roughness: 0.3
          });
          const sphere = new THREE.Mesh(sphereGeo, sphereMat);
          pMesh.add(sphere);
        } else {
          // Magic Missile / Holy Bolt
          const boltGeo = new THREE.OctahedronGeometry(3, 0);
          const boltMat = new THREE.MeshStandardMaterial({
            color: p.type === 'holy_bolt' ? 0xfde047 : 0xc084fc,
            emissive: p.type === 'holy_bolt' ? 0xfacc15 : 0xa855f7,
            emissiveIntensity: 1.0
          });
          const bolt = new THREE.Mesh(boltGeo, boltMat);
          pMesh.add(bolt);
        }

        this.scene.add(pMesh);
        this.projectilesMap.set(p.id, pMesh);
      }

      // Compute Ballistic Flight Arc & 3D Orientation
      const totalDist = Math.hypot(p.targetX - p.startX, p.targetY - p.startY);
      const currentDist = Math.hypot(p.currentX - p.startX, p.currentY - p.startY);
      const progress = Math.max(0, Math.min(1, currentDist / Math.max(1, totalDist)));

      const arcHeight = p.type === 'arrow' ? Math.sin(progress * Math.PI) * Math.min(22, totalDist * 0.18) : 0;
      const angleY = Math.atan2(p.targetX - p.startX, p.targetY - p.startY);

      pMesh.position.set(p.currentX, 8 + arcHeight, p.currentY);
      pMesh.rotation.y = angleY;

      if (p.type === 'arrow') {
        // Pitch arrow along trajectory arc
        const pitchAngle = (0.5 - progress) * 0.8;
        pMesh.rotation.x = pitchAngle;
      }
    }

    for (const [id, mesh] of this.projectilesMap.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(mesh);
        this.projectilesMap.delete(id);
      }
    }
  }

  // --- 3D CORPSES (Fades away over time) ---
  private updateCorpses(state: GameState) {
    const activeIds = new Set<string>();

    for (const c of state.corpses) {
      activeIds.add(c.id);
      let cGroup = this.corpsesMap.get(c.id);

      if (!cGroup) {
        cGroup = this.create3DCorpseMesh(c);
        this.scene.add(cGroup);
        this.corpsesMap.set(c.id, cGroup);
      }

      cGroup.position.set(c.x, 0, c.y);
      cGroup.rotation.y = c.rotation;
      cGroup.visible = this.gridManager.isPixelExplored(c.x, c.y);

      // Smooth fade out when nearing expiration
      if (c.lifetime < 5.0) {
        const fadeAlpha = Math.max(0.1, c.lifetime / 5.0);
        cGroup.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material) {
            child.material.transparent = true;
            child.material.opacity = fadeAlpha;
          }
        });
      }
    }

    for (const [id, group] of this.corpsesMap.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(group);
        this.corpsesMap.delete(id);
      }
    }
  }

  private create3DCorpseMesh(c: Corpse): THREE.Group {
    const group = new THREE.Group();

    if (c.type === 'hero') {
      // Wooden Grave Cross with Fallen Iron Helmet & Sword
      const crossVGeo = new THREE.BoxGeometry(1.2, 8, 1.2);
      const crossHGeo = new THREE.BoxGeometry(5, 1.2, 1.2);
      const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });

      const crossV = new THREE.Mesh(crossVGeo, woodMat);
      crossV.position.y = 4;
      group.add(crossV);

      const crossH = new THREE.Mesh(crossHGeo, woodMat);
      crossH.position.y = 6;
      group.add(crossH);

      // Fallen Helmet on ground
      const helmGeo = new THREE.SphereGeometry(2, 6, 6);
      const helmMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7, roughness: 0.3 });
      const helm = new THREE.Mesh(helmGeo, helmMat);
      helm.position.set(2.5, 1.5, 2);
      group.add(helm);
    } else if (c.type === 'monster') {
      if (c.subType === 'giant_rat') {
        // Slumped Rat Carcass
        const bodyGeo = new THREE.SphereGeometry(3.5, 6, 6);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x44403c, roughness: 0.9 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 1.5;
        body.scale.set(1.4, 0.5, 0.8);
        group.add(body);
      } else if (c.subType === 'skeleton') {
        // Pile of bleached bones and skull
        const skullGeo = new THREE.SphereGeometry(2, 6, 6);
        const boneMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.9 });
        const skull = new THREE.Mesh(skullGeo, boneMat);
        skull.position.set(0, 1.5, 0);
        group.add(skull);

        const ribGeo = new THREE.BoxGeometry(4, 1, 2);
        const ribs = new THREE.Mesh(ribGeo, boneMat);
        ribs.position.set(2, 0.6, -1);
        group.add(ribs);
      } else if (c.subType === 'red_dragon') {
        // Giant Fallen Dragon Carcass
        const ribGeo = new THREE.BoxGeometry(16, 4, 10);
        const dragonBoneMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.8 });
        const ribs = new THREE.Mesh(ribGeo, dragonBoneMat);
        ribs.position.y = 3;
        group.add(ribs);
      } else {
        // Fallen monster body
        const bodyGeo = new THREE.BoxGeometry(5, 2, 4);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.9 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 1;
        group.add(body);
      }
    } else {
      // Fallen commoner/peasant/taxman
      const bodyGeo = new THREE.BoxGeometry(4, 2, 3);
      const bodyMat = new THREE.MeshStandardMaterial({ color: c.type === 'tax_collector' ? 0x6b21a8 : 0xd97706, roughness: 0.8 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 1;
      group.add(body);
    }

    return group;
  }

  // --- 3D FLOATING TRANSACTIONS & COINS ---
  private updateFloatingTexts(state: GameState) {
    const activeIds = new Set<string>();

    for (const ft of state.floatingTexts) {
      activeIds.add(ft.id);
      let sprite = this.floatingTextsMap.get(ft.id);

      if (!sprite) {
        sprite = this.createFloatingTextSprite(ft);
        this.scene.add(sprite);
        this.floatingTextsMap.set(ft.id, sprite);
      }

      // Smooth floating rise in 3D world
      const progress = 1 - Math.max(0, ft.life / Math.max(0.1, ft.maxLife));
      sprite.position.set(ft.x, 11 + progress * 20, ft.y);
      if (sprite.material) {
        sprite.material.opacity = Math.max(0, Math.min(1, ft.life / ft.maxLife));
      }
      sprite.visible = this.gridManager.isPixelExplored(ft.x, ft.y);
    }

    for (const [id, sprite] of this.floatingTextsMap.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(sprite);
        if (sprite.material.map) sprite.material.map.dispose();
        sprite.material.dispose();
        this.floatingTextsMap.delete(id);
      }
    }
  }

  private createFloatingTextSprite(ft: FloatingText): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.Sprite();

    const isGold = ft.text.includes('g') || ft.text.includes('Tax') || ft.text.includes('Treasury') || ft.text.includes('Bounty') || ft.text.includes('Loot') || ft.text.includes('Ale');

    if (isGold) {
      // 1. Draw Large 3D Shaded Metallic Sovereign Gold Coin
      const cx = 72;
      const cy = 80;
      const r = 48;

      const grad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
      grad.addColorStop(0, '#fef08a');
      grad.addColorStop(0.5, '#eab308');
      grad.addColorStop(1, '#b45309');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // Outer gold rim
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(cx, cy, r - 5, 0, Math.PI * 2);
      ctx.stroke();

      // Crown sovereign symbol
      ctx.fillStyle = '#78350f';
      ctx.font = 'bold 44px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('👑', cx, cy - 2);

      // 2. Draw Transaction Sum in Large Crisp Typography with heavy outline
      ctx.font = 'bold 54px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 10;
      ctx.strokeText(ft.text, 140, cy);

      ctx.fillStyle = '#fef08a';
      ctx.fillText(ft.text, 140, cy);
    } else {
      // Large Combat damage, healing, or level up banner
      ctx.font = 'bold 50px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 10;
      ctx.strokeText(ft.text, 256, 80);

      ctx.fillStyle = ft.color || '#ffffff';
      ctx.fillText(ft.text, 256, 80);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(isGold ? 28 : 22, isGold ? 8.75 : 6.875, 1);
    return sprite;
  }

  // Screen to 3D World Raycasting
  public screenToWorld3D(screenX: number, screenY: number): THREE.Vector3 | null {
    const rect = this.container.getBoundingClientRect();
    const x = ((screenX - rect.left) / rect.width) * 2 - 1;
    const y = -((screenY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);
    const target = new THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, target);
    return hit ? target : null;
  }
}
