import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BUILDING_DEFINITIONS, HERO_CLASS_DEFINITIONS } from '../constants';
import { Building, Corpse, Flag, FloatingText, GameState, Hero, Monster, MonsterLair, Particle, Peasant, PointOfInterest, Projectile, TaxCollector, Treasure } from '../types';
import { GridManager } from './Grid';
import { CharacterAnimationController, ModelRegistry } from './ModelRegistry';

export class ThreeRenderer {
  private container: HTMLDivElement;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private gridManager: GridManager;
  public scenarioId: string;

  // Character Skeletal Animation Controllers
  private animControllers: Map<string, CharacterAnimationController> = new Map();
  private lastUnitPositions: Map<string, { x: number; y: number }> = new Map();

  // Lighting
  private ambientLight: THREE.AmbientLight;
  private dirLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;

  // Procedural Canvas Textures
  private grassTexture: THREE.CanvasTexture;
  private grassBumpTexture: THREE.CanvasTexture;
  private cobbleTexture: THREE.CanvasTexture;
  private royalCastleWallTexture: THREE.CanvasTexture;
  private timberLogTexture: THREE.CanvasTexture;
  private woodPlankTexture: THREE.CanvasTexture;
  private burlapTarpTexture: THREE.CanvasTexture;
  private blueprintTexture: THREE.CanvasTexture;
  private brickRoadTexture: THREE.CanvasTexture;
  private softRadialGlowTexture: THREE.CanvasTexture;
  private riverTexture: THREE.CanvasTexture;
  private waterfallTexture: THREE.CanvasTexture;

  // Unified Road Decal Canvas System
  private roadCanvas: HTMLCanvasElement;
  private roadCtx: CanvasRenderingContext2D;
  private roadTexture: THREE.CanvasTexture;
  private roadsMesh: THREE.Mesh | null = null;
  private roadPattern: CanvasPattern | null = null;

  // Continuous Dynamic Fog of War System
  private fogCanvas: HTMLCanvasElement;
  private fogCtx: CanvasRenderingContext2D;
  private fogTexture: THREE.CanvasTexture;
  private lastFogUpdate: number = 0;
  private fogMesh: THREE.Mesh | null = null;

  // Object pools / mappings
  private terrainGroup: THREE.Group;
  private terrainFeaturesList: THREE.Object3D[] = [];
  private natureScattered: boolean = false;
  private waterfallsGroup: THREE.Group;
  private waterfallsList: THREE.Group[] = [];
  private roadsGroup: THREE.Group;
  private streetLampsGroup: THREE.Group;
  private streetLampsList: THREE.Object3D[] = [];
  // Cached lamp glow materials (registered once at creation; avoids per-frame subtree traverses)
  private lampGlowMats: { root: THREE.Object3D; ember?: THREE.MeshStandardMaterial; cage?: THREE.MeshStandardMaterial; puddle?: THREE.MeshBasicMaterial }[] = [];
  private lastLampUpdate: number = 0;
  private lastRoadVersion: number = -1;
  private fogGroup: THREE.Group;
  private buildingsMap: Map<string, THREE.Group> = new Map();
  private heroesMap: Map<string, THREE.Group> = new Map();
  private monstersMap: Map<string, THREE.Group> = new Map();
  private lairsMap: Map<string, THREE.Group> = new Map();
  private taxCollectorsMap: Map<string, THREE.Group> = new Map();
  private peasantsMap: Map<string, THREE.Group> = new Map();
  private treasuresMap: Map<string, THREE.Group> = new Map();
  private poisMap: Map<string, THREE.Group> = new Map();
  private corpsesMap: Map<string, THREE.Group> = new Map();
  private flagsMap: Map<string, THREE.Group> = new Map();
  private projectilesMap: Map<string, THREE.Group> = new Map();
  private floatingTextsMap: Map<string, THREE.Sprite> = new Map();
  private heroLabelsMap: Map<string, { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture; sprite: THREE.Sprite; lastHp: number; lastLevel: number }> = new Map();
  private sleepingSpritesMap: Map<string, THREE.Sprite> = new Map();
  private sharedSleepTexture: THREE.CanvasTexture | null = null;

  // Selection & Placement Highlights
  private selectionGroup: THREE.Group;
  private placementPreviewGroup: THREE.Group;

  // Celestial Sky System (Sun, Moon, Stars)
  private celestialGroup: THREE.Group;
  private sunObject: THREE.Group | null = null;
  private sunMesh: THREE.Mesh | null = null;
  private sunCorona: THREE.Sprite | null = null;
  private moonObject: THREE.Group | null = null;
  private moonMesh: THREE.Mesh | null = null;
  private moonGlow: THREE.Sprite | null = null;
  private starsPoints: THREE.Points | null = null;
  private starTwinklePhases: Float32Array | null = null;

  // Dynamic Structure Footprint Flattening
  private groundMesh: THREE.Mesh | null = null;
  private lastStructureHash: string = '';
  private lastStructCheck: number = 0;
  private placementPreviewKey: string = '';
  private lastKnownStructures: { x: number; y: number; width: number; height: number }[] = [];
  private floatingTextTextureCache: Map<string, THREE.CanvasTexture> = new Map();

  // Raycaster for 3D mouse interaction
  public raycaster: THREE.Raycaster = new THREE.Raycaster();
  public groundPlane: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  // Camera Orbit / Target
  public cameraTarget: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public cameraDistance: number = 380;
  public targetCameraDistance: number = 380;
  public cameraPitch: number = 0.82; // Majestic isometric 3D angle (~47 deg)
  public cameraYaw: number = Math.PI / 4; // 45-degree diagonal isometric angle
  public cameraMode: 'isometric' | 'free' | 'top_down' | 'follow' = 'isometric';
  private lastRenderTime: number = performance.now();

  constructor(container: HTMLDivElement, gridManager: GridManager, scenarioId: string = 'goblin_borderlands') {
    this.container = container;
    this.gridManager = gridManager;
    this.scenarioId = scenarioId;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // Generate Procedural Textures
    this.grassTexture = this.createGrassTexture();
    this.grassBumpTexture = this.createGrassBumpTexture();
    this.cobbleTexture = this.createCobbleTexture();
    this.royalCastleWallTexture = this.createRoyalCastleWallTexture();
    this.timberLogTexture = this.createTimberLogTexture();
    this.woodPlankTexture = this.createWoodPlankTexture();
    this.burlapTarpTexture = this.createBurlapTarpTexture();
    this.blueprintTexture = this.createBlueprintTexture();
    this.brickRoadTexture = this.createBrickRoadTexture();
    this.softRadialGlowTexture = this.createSoftRadialGlowTexture();
    this.riverTexture = this.createWaterFlowTexture();
    this.waterfallTexture = this.createWaterfallTexture();

    // Unified Ground Road Decal Canvas (high-res texture, sized to map)
    const worldMax = Math.max(gridManager.width, gridManager.height) * gridManager.tileSize;
    const rcSize = worldMax > 4200 ? 8192 : 4096;
    this.roadCanvas = document.createElement('canvas');
    this.roadCanvas.width = rcSize;
    this.roadCanvas.height = rcSize;
    this.roadCtx = this.roadCanvas.getContext('2d')!;
    this.roadTexture = new THREE.CanvasTexture(this.roadCanvas);
    this.roadTexture.anisotropy = 4;
    this.roadTexture.minFilter = THREE.LinearFilter;
    this.roadTexture.magFilter = THREE.LinearFilter;
    this.roadTexture.generateMipmaps = false;

    // Pattern for road fill
    const patternCanvas = this.createCobblePatternCanvas();
    this.roadPattern = this.roadCtx.createPattern(patternCanvas, 'repeat');

    // Continuous Dynamic Fog of War Shroud Canvas (512x512 with smooth linear filtering)
    this.fogCanvas = document.createElement('canvas');
    this.fogCanvas.width = 512;
    this.fogCanvas.height = 512;
    this.fogCtx = this.fogCanvas.getContext('2d')!;
    this.fogTexture = new THREE.CanvasTexture(this.fogCanvas);
    this.fogTexture.minFilter = THREE.LinearFilter;
    this.fogTexture.magFilter = THREE.LinearFilter;

    // 1. Scene Setup & Biome Atmosphere
    this.scene = new THREE.Scene();
    if (this.scenarioId === 'cursed_graveyards') {
      this.scene.background = new THREE.Color('#151022');
      this.scene.fog = new THREE.FogExp2('#2e1f42', 0.00045);
    } else if (this.scenarioId === 'dragon_caldor') {
      this.scene.background = new THREE.Color('#2e1206');
      this.scene.fog = new THREE.FogExp2('#52270e', 0.00040);
    } else if (this.scenarioId === 'vampire_coast') {
      this.scene.background = new THREE.Color('#0b1d22');
      this.scene.fog = new THREE.FogExp2('#15323a', 0.00042);
    } else {
      this.scene.background = new THREE.Color('#0284c7');
      this.scene.fog = new THREE.FogExp2('#38bdf8', 0.00035);
    }

    // 2. Camera Setup
    this.camera = new THREE.PerspectiveCamera(45, width / height, 1, 3000);

    // 3. WebGL Renderer with Fast Optimized Shadows & Antialiasing
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    container.appendChild(this.renderer.domElement);

    // Apply Anisotropic Filtering for Razor-Sharp Isometric Terrain & Roads
    const maxAniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    this.roadTexture.anisotropy = maxAniso;
    this.grassTexture.anisotropy = maxAniso;
    this.grassBumpTexture.anisotropy = maxAniso;
    this.cobbleTexture.anisotropy = maxAniso;
    this.woodPlankTexture.anisotropy = maxAniso;
    this.burlapTarpTexture.anisotropy = maxAniso;

    // 4. Lighting
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x334155, 0.45);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xfffbeb, 1.4);
    this.dirLight.position.set(250, 400, 200);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.near = 10;
    this.dirLight.shadow.camera.far = 1500;
    const shadowD = 600;
    this.dirLight.shadow.camera.left = -shadowD;
    this.dirLight.shadow.camera.right = shadowD;
    this.dirLight.shadow.camera.top = shadowD;
    this.dirLight.shadow.camera.bottom = -shadowD;
    this.dirLight.shadow.bias = -0.0002;
    this.dirLight.shadow.normalBias = 0.03;
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);

    // 5. Groups
    this.terrainGroup = new THREE.Group();
    this.waterfallsGroup = new THREE.Group();
    this.roadsGroup = new THREE.Group();
    this.streetLampsGroup = new THREE.Group();
    this.fogGroup = new THREE.Group();
    this.selectionGroup = new THREE.Group();
    this.placementPreviewGroup = new THREE.Group();
    this.celestialGroup = new THREE.Group();

    this.scene.add(this.terrainGroup);
    this.scene.add(this.waterfallsGroup);
    this.scene.add(this.roadsGroup);
    this.scene.add(this.streetLampsGroup);
    this.scene.add(this.fogGroup);
    this.scene.add(this.selectionGroup);
    this.scene.add(this.placementPreviewGroup);
    this.scene.add(this.celestialGroup);

    this.buildTerrain();
    this.buildFogOfWar();
    this.buildSelectionMeshes();
    this.buildCelestialSystem();

    // Preload KayKit 3D Model Asset Library
    const registry = ModelRegistry.getInstance();
    registry.preloadAll();
    registry.onChange(() => {
      // Re-instantiate entities with the real GLTF models. This only ever
      // runs behind the loading veil (isReady gates it) or on save/load
      // re-attach — never as a visible swap mid-game.
      this.buildingsMap.forEach((grp) => this.scene.remove(grp));
      this.buildingsMap.clear();
      this.heroesMap.forEach((grp) => this.scene.remove(grp));
      this.heroesMap.clear();
      this.monstersMap.forEach((grp) => this.scene.remove(grp));
      this.monstersMap.clear();
      this.peasantsMap.forEach((grp) => this.scene.remove(grp));
      this.peasantsMap.clear();
      this.taxCollectorsMap.forEach((grp) => this.scene.remove(grp));
      this.taxCollectorsMap.clear();
      this.lairsMap.forEach((grp) => this.scene.remove(grp));
      this.lairsMap.clear();
      this.corpsesMap.forEach((grp) => this.scene.remove(grp));
      this.corpsesMap.clear();
    });
  }

  // --- PROCEDURAL TEXTURE GENERATORS ---
  private createGrassTexture(): THREE.CanvasTexture {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // 1. Seamless Multi-Tonal Micro-Turf Baseline (No large high-contrast spots)
    ctx.fillStyle = '#28583b';
    ctx.fillRect(0, 0, size, size);

    // Micro-fibers & dense fine grass blades (6,000 fine strokes creating velvet turf)
    const bladeTones = ['#1e4620', '#2d6a4f', '#387a55', '#40916c', '#4d8c60', '#5c9c6f', '#316345', '#245237'];
    for (let b = 0; b < 6500; b++) {
      const bx = ((b * 137 + (b % 31) * 23) % size);
      const by = ((b * 229 + (b % 47) * 37) % size);
      const len = 3.5 + (b % 5);
      const curve = ((b % 5) - 2) * 0.8;

      ctx.strokeStyle = bladeTones[b % bladeTones.length];
      ctx.lineWidth = 1.0 + (b % 3) * 0.3;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + curve, by - len);
      ctx.stroke();

      // Subtle seamless border wrap
      if (bx + curve > size) {
        ctx.beginPath(); ctx.moveTo(bx - size, by); ctx.lineTo(bx - size + curve, by - len); ctx.stroke();
      }
      if (by - len < 0) {
        ctx.beginPath(); ctx.moveTo(bx, by + size); ctx.lineTo(bx + curve, by + size - len); ctx.stroke();
      }
    }

    // Micro-clover triplets (Small, subtle, dense)
    for (let c = 0; c < 450; c++) {
      const cx = ((c * 173 + (c % 19) * 41) % size);
      const cy = ((c * 281 + (c % 29) * 53) % size);
      const cr = 1.8 + (c % 2) * 0.6;

      for (let leaf = 0; leaf < 3; leaf++) {
        const angle = (leaf * (Math.PI * 2 / 3));
        const lx = cx + Math.cos(angle) * cr;
        const ly = cy + Math.sin(angle) * cr;
        ctx.fillStyle = c % 2 === 0 ? '#387a55' : '#40916c';
        ctx.beginPath();
        ctx.arc(lx, ly, cr * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    // Set repeat frequency based on world units so each repeat is small and seamless (micro-texture)
    tex.repeat.set(48, 48);
    return tex;
  }

  private createGrassBumpTexture(): THREE.CanvasTexture {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Neutral gray baseline
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, size, size);

    // Micro-relief blade strokes
    for (let b = 0; b < 4500; b++) {
      const bx = ((b * 137 + (b % 31) * 23) % size);
      const by = ((b * 229 + (b % 47) * 37) % size);
      const len = 3.5 + (b % 5);
      const curve = ((b % 5) - 2) * 0.8;

      ctx.strokeStyle = b % 2 === 0 ? '#989898' : '#686868';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + curve, by - len);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(48, 48);
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



  private createRoyalCastleWallTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Deep dark stone mortar base
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 512, 512);

    const blockH = 28;
    const blockW = 60;

    for (let y = 0; y < 512; y += blockH) {
      const row = Math.floor(y / blockH);
      const shift = (row % 2) * (blockW / 2);
      for (let x = -blockW; x < 512 + blockW; x += blockW) {
        const stoneX = x + shift + 3;
        const stoneY = y + 3;
        const stoneW = blockW - 6;
        const stoneH = blockH - 6;

        // Rich authentic granite & fortress ashlar stone palette (natural stone hues)
        const stoneColors = ['#64748b', '#475569', '#334155', '#4b5563', '#6b7280', '#52525b'];
        const baseColor = stoneColors[(x * 7 + y * 11) % stoneColors.length];

        ctx.fillStyle = baseColor;
        ctx.beginPath();
        ctx.roundRect(stoneX, stoneY, stoneW, stoneH, 2);
        ctx.fill();

        // 3D Chiseled top & left bevel highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.fillRect(stoneX, stoneY, stoneW, 2.5);
        ctx.fillRect(stoneX, stoneY, 2.5, stoneH);

        // Deep 3D bottom & right shadow in dark slate
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.fillRect(stoneX, stoneY + stoneH - 2.5, stoneW, 2.5);
        ctx.fillRect(stoneX + stoneW - 2.5, stoneY, 2.5, stoneH);

        // Weathering chiseling specks & texture grain
        for (let s = 0; s < 5; s++) {
          ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.3)';
          ctx.fillRect(stoneX + Math.random() * (stoneW - 6) + 3, stoneY + Math.random() * (stoneH - 6) + 3, 2, 2);
        }
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    return tex;
  }

  private createCobblePatternCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Rich dark charcoal & slate mortar base
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(0, 0, 512, 512);

    // Fine gravel & sand grit in the mortar recesses
    for (let i = 0; i < 1200; i++) {
      const gx = (i * 47) % 512;
      const gy = (i * 83) % 512;
      ctx.fillStyle = (i % 2 === 0) ? '#292524' : '#0c0a09';
      ctx.fillRect(gx, gy, 1.5, 1.5);
    }

    // High-definition medieval dressed stone paver bricks
    // Across a 41.6px road on the 4096 canvas, stoneW = 7.5px / stoneH = 4.5px provides ~5-6 distinct stones across the path
    const stoneH = 4.5;
    const baseStoneW = 7.5;

    for (let y = 0; y < 512; y += stoneH) {
      const row = Math.floor(y / stoneH);
      const rowOffset = (row % 2) * (baseStoneW / 2);

      let x = -baseStoneW;
      while (x < 512 + baseStoneW) {
        // Vary stone widths slightly for organic hand-laid masonry
        const hash = Math.abs(Math.floor(x * 7.31 + y * 13.67));
        const widthVariation = (hash % 3 === 0) ? 1.4 : (hash % 3 === 1 ? -1.4 : 0);
        const curW = baseStoneW + widthVariation;

        const sx = x + rowOffset + 0.6;
        const sy = y + 0.5;
        const sw = curW - 1.2;
        const sh = stoneH - 1.0;

        // Rich, realistic weathered medieval stone palette
        const stonePalette = [
          '#e2e8f0', // Crisp light limestone
          '#cbd5e1', // Slate paver
          '#d6d3d1', // Warm sandstone
          '#a8a29e', // Weathered riverstone
          '#94a3b8', // Ashlar slate
          '#78716c', // Granite paver
          '#64748b', // Blue slate
          '#57534e', // Basalt cobble
          '#e7e5e4', // Pale chalkstone
          '#475569'  // Dark slate
        ];
        const baseColor = stonePalette[hash % stonePalette.length];

        ctx.fillStyle = baseColor;
        ctx.beginPath();
        ctx.roundRect(sx, sy, sw, sh, 1.0);
        ctx.fill();

        // 3D Top and Left chisel highlight bevel (sub-pixel crisp edge)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillRect(sx, sy, sw, 0.8);
        ctx.fillRect(sx, sy, 0.8, sh);

        // 3D Bottom and Right chisel drop shadow (sub-pixel crisp edge)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.fillRect(sx, sy + sh - 0.8, sw, 0.8);
        ctx.fillRect(sx + sw - 0.8, sy, 0.8, sh);

        // Stone surface clefts & grain micro-texture (realistic stone detail closeup)
        const grainCount = Math.floor(sw / 4);
        for (let g = 0; g < grainCount; g++) {
          const gx = sx + 1.5 + ((hash + g * 5) % Math.max(1, Math.floor(sw - 3)));
          const gy = sy + 1.5 + ((hash * 3 + g * 7) % Math.max(1, Math.floor(sh - 3)));
          ctx.fillStyle = (g % 2 === 0) ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.22)';
          ctx.fillRect(gx, gy, 1, 1);
        }

        x += curW;
      }
    }

    return canvas;
  }




  private createTimberLogTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#451a03';
    ctx.fillRect(0, 0, 512, 512);

    const logH = 32;
    for (let y = 0; y < 512; y += logH) {
      // Rounded log gradient
      const grad = ctx.createLinearGradient(0, y, 0, y + logH);
      grad.addColorStop(0, '#78350f');
      grad.addColorStop(0.5, '#9a3412');
      grad.addColorStop(1, '#381e05');

      ctx.fillStyle = grad;
      ctx.fillRect(0, y + 2, 512, logH - 4);

      // Deep groove between logs
      ctx.fillStyle = '#1c0d02';
      ctx.fillRect(0, y, 512, 2);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  private createWoodPlankTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Rich warm oak timber background
    ctx.fillStyle = '#78350f';
    ctx.fillRect(0, 0, 512, 512);

    const plankH = 32;
    const tones = ['#92400e', '#78350f', '#b45309', '#a16207', '#854d0e'];

    for (let y = 0; y < 512; y += plankH) {
      const pIdx = Math.floor(y / plankH);
      ctx.fillStyle = tones[pIdx % tones.length];
      ctx.fillRect(0, y + 2, 512, plankH - 4);

      // Wood grain fibers and curves
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.16)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const lineY = y + 5 + i * 7 + (Math.sin(pIdx * 2.5 + i) * 2);
        ctx.beginPath();
        ctx.moveTo(0, lineY);
        ctx.bezierCurveTo(140, lineY + 1.5, 360, lineY - 1.5, 512, lineY);
        ctx.stroke();
      }

      // Dark shadow crevice between planks & top bevel highlight
      ctx.fillStyle = '#1c0d02';
      ctx.fillRect(0, y, 512, 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(0, y + 2, 512, 1);

      // Iron nail studs at staggered joint intervals
      const nailX1 = 28 + ((pIdx * 89) % 55);
      const nailX2 = 250 + ((pIdx * 127) % 65);
      const nailX3 = 485 - ((pIdx * 67) % 45);
      [nailX1, nailX2, nailX3].forEach((nx) => {
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(nx, y + plankH / 2, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.beginPath();
        ctx.arc(nx - 0.6, y + plankH / 2 - 0.6, 0.8, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  private createBurlapTarpTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Weathered royal blue canvas
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(0, 0, 256, 256);

    // Crosshatch burlap weave
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 256; i += 4) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
    }

    // Shadow & fold gradient
    const grad = ctx.createLinearGradient(0, 0, 256, 256);
    grad.addColorStop(0, 'rgba(30, 58, 138, 0.4)');
    grad.addColorStop(0.5, 'rgba(59, 130, 246, 0.15)');
    grad.addColorStop(1, 'rgba(15, 23, 42, 0.6)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    // Reinforced perimeter stitched hem
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(6, 6, 244, 244);

    // Brass corner grommets
    [[10, 10], [246, 10], [10, 246], [246, 246], [128, 6], [128, 250]].forEach(([gx, gy]) => {
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath(); ctx.arc(gx, gy, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath(); ctx.arc(gx, gy, 1.8, 0, Math.PI * 2); ctx.fill();
    });

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }


  private createBlueprintTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Rich Prussian blueprint blue background
    ctx.fillStyle = '#0369a1';
    ctx.fillRect(0, 0, 512, 512);

    // Fine grid (32px intervals)
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.2)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= 512; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x, 512);
      ctx.stroke();
    }
    for (let y = 0; y <= 512; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y); ctx.lineTo(512, y);
      ctx.stroke();
    }

    // Major grid lines (128px intervals)
    ctx.strokeStyle = 'rgba(224, 242, 254, 0.55)';
    ctx.lineWidth = 2.5;
    for (let x = 0; x <= 512; x += 128) {
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x, 512);
      ctx.stroke();
    }
    for (let y = 0; y <= 512; y += 128) {
      ctx.beginPath();
      ctx.moveTo(0, y); ctx.lineTo(512, y);
      ctx.stroke();
    }

    // Outer double border
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 6;
    ctx.strokeRect(12, 12, 488, 488);
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, 472, 472);

    // Corner surveyor crosshair marks
    const drawCrosshair = (cx: number, cy: number) => {
      ctx.strokeStyle = '#7dd3fc';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - 16, cy); ctx.lineTo(cx + 16, cy);
      ctx.moveTo(cx, cy - 16); ctx.lineTo(cx, cy + 16);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.stroke();
    };

    drawCrosshair(48, 48);
    drawCrosshair(464, 48);
    drawCrosshair(48, 464);
    drawCrosshair(464, 464);

    // Architectural diagonal guide lines
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.35)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(32, 32); ctx.lineTo(480, 480);
    ctx.moveTo(480, 32); ctx.lineTo(32, 480);
    ctx.stroke();
    ctx.setLineDash([]);

    // Blueprint Title Banner in center
    ctx.fillStyle = 'rgba(8, 47, 73, 0.9)';
    ctx.fillRect(100, 224, 312, 64);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.strokeRect(100, 224, 312, 64);

    ctx.fillStyle = '#f0f9ff';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('📐 BLUEPRINT PLAN', 256, 246);

    ctx.fillStyle = '#7dd3fc';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('Awaiting Builder', 256, 268);

    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }


  private createSmokeEmitter(x: number, y: number, z: number, isDark = false, count = 4): THREE.Group {
    const group = new THREE.Group();
    group.name = 'smokeEmitter';
    group.position.set(x, y, z);

    const smokeGeo = new THREE.SphereGeometry(1.2, 6, 6);
    const colorNum = isDark ? 0x475569 : 0xf1f5f9;

    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: colorNum,
        transparent: true,
        opacity: 0.4,
        depthWrite: false
      });
      const puff = new THREE.Mesh(smokeGeo, mat);
      puff.userData = { phase: i * (3.0 / count) };
      puff.position.y = (i * (3.0 / count)) * 4.5;
      group.add(puff);
    }

    return group;
  }

  private createBrickRoadTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Transparent gradient edge background
    ctx.clearRect(0, 0, 512, 512);

    // Soft dark earth/mortar base in center
    const grad = ctx.createLinearGradient(0, 0, 512, 0);
    grad.addColorStop(0, 'rgba(41, 37, 36, 0.0)');
    grad.addColorStop(0.12, 'rgba(41, 37, 36, 0.85)');
    grad.addColorStop(0.5, 'rgba(28, 25, 23, 0.95)');
    grad.addColorStop(0.88, 'rgba(41, 37, 36, 0.85)');
    grad.addColorStop(1, 'rgba(41, 37, 36, 0.0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    const brickW = 44;
    const brickH = 22;

    // Organic cobblestone & flagstone paving
    for (let y = 0; y < 512; y += brickH) {
      const row = Math.floor(y / brickH);
      const shift = (row % 2) * (brickW / 2);
      for (let x = 32; x < 480; x += brickW) {
        const bx = x + shift + 2;
        const by = y + 2;
        const bw = brickW - 4;
        const bh = brickH - 4;

        if (bx < 40 || bx + bw > 472) continue;

        // Varied aged cobblestone & stone brick colors
        const brickColors = ['#d6d3d1', '#a8a29e', '#78716c', '#e7e5e4', '#57534e', '#cbd5e1'];
        const color = brickColors[(x * 5 + y * 13) % brickColors.length];

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 4);
        ctx.fill();

        // 3D Bevel highlight (top & left)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.fillRect(bx, by, bw, 2);
        ctx.fillRect(bx, by, 2, bh);

        // 3D Shadow (bottom & right)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(bx, by + bh - 2, bw, 2);
        ctx.fillRect(bx + bw - 2, by, 2, bh);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 4);
    return tex;
  }

  private createSoftRadialGlowTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Radial gradient from warm golden center to transparent outer edge
    const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0.0, 'rgba(254, 240, 138, 0.95)'); // warm golden-white core
    grad.addColorStop(0.18, 'rgba(251, 191, 36, 0.75)'); // amber lantern glow
    grad.addColorStop(0.42, 'rgba(245, 158, 11, 0.40)'); // warm flame light
    grad.addColorStop(0.70, 'rgba(217, 119, 6, 0.15)'); // soft ambient illumination
    grad.addColorStop(1.0, 'rgba(180, 83, 9, 0.0)');   // smoothly fades to 0 at edge

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }

  private createWaterFlowTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Base deep crystalline azure blue
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(0, 0, 512, 512);

    // River caustics, wave ripples, and foam currents
    for (let i = 0; i < 320; i++) {
      const rx = Math.random() * 512;
      const ry = Math.random() * 512;
      const rw = Math.random() * 60 + 20;
      const rh = Math.random() * 8 + 3;

      const alpha = Math.random() * 0.35 + 0.15;
      ctx.fillStyle = Math.random() > 0.4 ? `rgba(56, 189, 248, ${alpha})` : `rgba(224, 242, 254, ${alpha * 0.8})`;
      ctx.beginPath();
      ctx.ellipse(rx, ry, rw / 2, rh / 2, (Math.random() - 0.5) * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // River foam stream lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    for (let l = 0; l < 24; l++) {
      const sx = Math.random() * 512;
      const sy = Math.random() * 512;
      const len = Math.random() * 80 + 40;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.bezierCurveTo(sx + 10, sy + len * 0.3, sx - 10, sy + len * 0.7, sx, sy + len);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 8);
    return tex;
  }

  private createWaterfallTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Azure and crystal turquoise rushing gradient
    const grad = ctx.createLinearGradient(0, 0, 256, 0);
    grad.addColorStop(0, '#0284c7');
    grad.addColorStop(0.25, '#38bdf8');
    grad.addColorStop(0.5, '#f0f9ff');
    grad.addColorStop(0.75, '#38bdf8');
    grad.addColorStop(1, '#0284c7');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 512);

    // High velocity vertical white foam streaks & tumbling currents
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    for (let i = 0; i < 200; i++) {
      const sx = Math.random() * 256;
      const sy = Math.random() * 512;
      const sw = Math.random() * 6 + 2;
      const sh = Math.random() * 80 + 35;
      ctx.fillRect(sx, sy, sw, sh);
    }

    // Aerated splash mist bubbles
    for (let b = 0; b < 240; b++) {
      const bx = Math.random() * 256;
      const by = Math.random() * 512;
      const br = Math.random() * 3.5 + 1;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 2);
    return tex;
  }

  public handleResize() {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private getWestRiverX(worldZ: number): number {
    const ts = this.gridManager.tileSize;
    const centerX = this.gridManager.width / 2;
    const westOffset = this.gridManager.width * 0.26;
    const tileY = worldZ / ts;
    const rx = Math.floor(centerX - westOffset + Math.sin(tileY * 0.13) * 5 + Math.cos(tileY * 0.05) * 3);
    return (rx + 1.0) * ts;
  }

  private getEastRiverX(worldZ: number): number {
    const ts = this.gridManager.tileSize;
    const centerX = this.gridManager.width / 2;
    const eastOffset = this.gridManager.width * 0.30;
    const tileY = worldZ / ts;
    const rx = Math.floor(centerX + eastOffset + Math.sin(tileY * 0.15 + 1.2) * 4);
    return (rx + 1.0) * ts;
  }

  public getTerrainBaseElevation(x: number, z: number): number {
    const ts = this.gridManager.tileSize;
    const mapW = this.gridManager.width * ts;
    const mapH = this.gridManager.height * ts;
    const centerX = mapW / 2;
    const centerZ = mapH / 2;

    const distToCenter = Math.hypot(x - centerX, z - centerZ);
    const townFactor = Math.min(1.0, Math.max(0, (distToCenter - 130) / 110));

    const wave1 = Math.sin(x * 0.008 + 0.5) * Math.cos(z * 0.008 + 0.3) * 14.0;
    const wave2 = Math.sin(x * 0.02 + z * 0.015) * 6.0;
    const wave3 = Math.cos(x * 0.045 - z * 0.035) * 2.2;

    let baseElevation = (wave1 + wave2 + wave3) * townFactor;

    const tx = Math.floor(x / ts);
    const ty = Math.floor(z / ts);
    if (this.gridManager.isValid(tx, ty)) {
      const tile = this.gridManager.grid[ty][tx];
      if (tile === 4) {
        baseElevation += 5.5 * townFactor; // elevated rocky crag
      }
    }

    return baseElevation;
  }

  public getTerrainHeight(x: number, z: number): number {
    let elev = this.getTerrainBaseElevation(x, z);
    const baseElevation = elev;
    const ts = this.gridManager.tileSize;
    const tx = Math.floor(x / ts);
    const ty = Math.floor(z / ts);

    // If unit or position is on a stone bridge deck (tile 5), return elevated bridge height
    if (this.gridManager.isValid(tx, ty) && this.gridManager.grid[ty][tx] === 5) {
      return baseElevation + 2.2;
    }

    // Carve deep clean riverbed channels so ground never pokes through water
    const westRiverX = this.getWestRiverX(z);
    const distWest = Math.abs(x - westRiverX);
    const riverBedRadiusW = 34.0;
    if (distWest < riverBedRadiusW) {
      const channelDepth = 5.2;
      if (distWest < 22.0) {
        elev = Math.min(elev, baseElevation - channelDepth);
      } else {
        const t = (distWest - 22.0) / (riverBedRadiusW - 22.0);
        const smoothT = t * t * (3 - 2 * t);
        const bankElev = THREE.MathUtils.lerp(baseElevation - channelDepth, baseElevation, smoothT);
        elev = Math.min(elev, bankElev);
      }
    }

    const eastRiverX = this.getEastRiverX(z);
    const distEast = Math.abs(x - eastRiverX);
    const riverBedRadiusE = 32.0;
    if (distEast < riverBedRadiusE) {
      const channelDepth = 4.8;
      if (distEast < 20.0) {
        elev = Math.min(elev, baseElevation - channelDepth);
      } else {
        const t = (distEast - 20.0) / (riverBedRadiusE - 20.0);
        const smoothT = t * t * (3 - 2 * t);
        const bankElev = THREE.MathUtils.lerp(baseElevation - channelDepth, baseElevation, smoothT);
        elev = Math.min(elev, bankElev);
      }
    }

    // Smooth terrain leveling directly under building footprints with curved ease apron
    const blendMargin = 12.0; // ~0.75 tile smooth transition

    for (let i = 0; i < this.lastKnownStructures.length; i++) {
      const s = this.lastKnownStructures[i];
      const minX = s.x * ts;
      const maxX = (s.x + s.width) * ts;
      const minZ = s.y * ts;
      const maxZ = (s.y + s.height) * ts;
      const cx = (minX + maxX) / 2;
      const cz = (minZ + maxZ) / 2;

      const dx = Math.max(0, Math.abs(x - cx) - (maxX - minX) / 2);
      const dz = Math.max(0, Math.abs(z - cz) - (maxZ - minZ) / 2);
      const dist = Math.hypot(dx, dz);

      if (dist < blendMargin) {
        const targetElev = this.getTerrainBaseElevation(cx, cz);
        if (dist <= 0.001) {
          elev = targetElev;
        } else {
          const t = dist / blendMargin;
          const w = t * t * (3 - 2 * t); // smooth hermite curve
          elev = THREE.MathUtils.lerp(targetElev, elev, w);
        }
        break;
      }
    }

    return elev;
  }

  public updateTerrainMeshHeights() {
    if (!this.groundMesh) return;
    const posAttr = this.groundMesh.geometry.attributes.position;
    const w = this.gridManager.width;
    const h = this.gridManager.height;
    const ts = this.gridManager.tileSize;

    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i) + (w * ts) / 2;
      const vz = posAttr.getZ(i) + (h * ts) / 2;
      posAttr.setY(i, this.getTerrainHeight(vx, vz));
    }
    posAttr.needsUpdate = true;
    this.groundMesh.geometry.computeVertexNormals();

    if (this.roadsMesh) {
      const roadPos = this.roadsMesh.geometry.attributes.position;
      for (let i = 0; i < roadPos.count; i++) {
        const vx = roadPos.getX(i) + (w * ts) / 2;
        const vz = roadPos.getZ(i) + (h * ts) / 2;
        roadPos.setY(i, this.getTerrainHeight(vx, vz) + 0.06);
      }
      roadPos.needsUpdate = true;
      this.roadsMesh.geometry.computeVertexNormals();
    }

    if (this.fogMesh) {
      const fogPos = this.fogMesh.geometry.attributes.position;
      for (let i = 0; i < fogPos.count; i++) {
        const vx = fogPos.getX(i) + (w * ts) / 2;
        const vz = fogPos.getZ(i) + (h * ts) / 2;
        fogPos.setY(i, this.getTerrainHeight(vx, vz) + 1.2);
      }
      fogPos.needsUpdate = true;
      this.fogMesh.geometry.computeVertexNormals();
    }
  }

  public getRiverWaterHeight(z: number, riverType: 'west' | 'east' = 'west'): number {
    const rx = riverType === 'west' ? this.getWestRiverX(z) : this.getEastRiverX(z);
    const baseElev = this.getTerrainBaseElevation(rx, z);
    return baseElev - (riverType === 'west' ? 1.2 : 1.0);
  }

  // --- BUILD 3D TERRAIN ---
  private buildTerrain() {
    const ts = this.gridManager.tileSize;
    const w = this.gridManager.width;
    const h = this.gridManager.height;

    // 1. Base Ground Plane (Grass with 3D rolling hills & multi-biome vertex coloring)
    const segmentsX = w * 2;
    const segmentsZ = h * 2;
    const groundGeo = new THREE.PlaneGeometry(w * ts, h * ts, segmentsX, segmentsZ);
    groundGeo.rotateX(-Math.PI / 2);

    const posAttr = groundGeo.attributes.position;
    const colorAttr = new Float32Array(posAttr.count * 3);

    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i) + (w * ts) / 2;
      const vz = posAttr.getZ(i) + (h * ts) / 2;
      const vy = this.getTerrainHeight(vx, vz);
      posAttr.setY(i, vy);

      // Base biome vertex tone (adapts to scenario realm)
      let r = 1.0, g = 1.0, b = 1.0;
      if (this.scenarioId === 'cursed_graveyards') {
        r = 0.72; g = 0.65; b = 0.82; // ashen misty moorland
      } else if (this.scenarioId === 'dragon_caldor') {
        r = 1.25; g = 0.72; b = 0.58; // scorched volcanic basalt
      } else if (this.scenarioId === 'vampire_coast') {
        r = 0.68; g = 0.82; b = 0.72; // murky peat marsh
      }

      // Elevation tint (Hills and rocky crags are warmer/sunnier or rockier)
      if (vy > 3.0) {
        const hFactor = Math.min(1.0, (vy - 3.0) / 12.0);
        r += hFactor * 0.14;
        g += hFactor * 0.10;
        b -= hFactor * 0.08;
      }

      // River proximity shading (Moist dark moss & peat near waterlines)
      const distW = Math.abs(vx - this.getWestRiverX(vz));
      const distE = Math.abs(vx - this.getEastRiverX(vz));
      const minRiverDist = Math.min(distW, distE);
      if (minRiverDist < 40) {
        const moist = 1.0 - (minRiverDist / 40);
        r -= moist * 0.25;
        g -= moist * 0.12;
        b -= moist * 0.20;
      }

      // Forest grove shading
      const tx = Math.floor(vx / ts);
      const ty = Math.floor(vz / ts);
      if (this.gridManager.isValid(tx, ty) && this.gridManager.grid[ty][tx] === 3) {
        r -= 0.18;
        g -= 0.10;
        b -= 0.14;
      }

      // Subtle macro-tonal variation wave
      const wave = Math.sin(vx * 0.008) * Math.cos(vz * 0.008) * 0.08;
      r += wave;
      g += wave * 0.8;
      b += wave * 0.5;

      colorAttr[i * 3] = Math.max(0.25, Math.min(1.2, r));
      colorAttr[i * 3 + 1] = Math.max(0.25, Math.min(1.2, g));
      colorAttr[i * 3 + 2] = Math.max(0.25, Math.min(1.2, b));
    }

    groundGeo.setAttribute('color', new THREE.BufferAttribute(colorAttr, 3));
    groundGeo.computeVertexNormals();

    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.grassTexture,
      bumpMap: this.grassBumpTexture,
      bumpScale: 0.45,
      vertexColors: true,
      roughness: 0.82,
      metalness: 0.04
    });

    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.position.set((w * ts) / 2, 0, (h * ts) / 2);
    groundMesh.receiveShadow = true;
    this.groundMesh = groundMesh;
    this.terrainGroup.add(groundMesh);

    // 2. Unified Ground Road Decal Mesh (Follows rolling hills contour)
    const roadDecalGeo = new THREE.PlaneGeometry(w * ts, h * ts, segmentsX, segmentsZ);
    roadDecalGeo.rotateX(-Math.PI / 2);

    const roadPosAttr = roadDecalGeo.attributes.position;
    for (let i = 0; i < roadPosAttr.count; i++) {
      const vx = roadPosAttr.getX(i) + (w * ts) / 2;
      const vz = roadPosAttr.getZ(i) + (h * ts) / 2;
      const vy = this.getTerrainHeight(vx, vz) + 0.06;
      roadPosAttr.setY(i, vy);
    }
    roadDecalGeo.computeVertexNormals();

    const roadDecalMat = new THREE.MeshStandardMaterial({
      map: this.roadTexture,
      transparent: true,
      opacity: 0.98,
      roughness: 0.75,
      depthWrite: false,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: -2.0,
      polygonOffsetUnits: -2.0
    });
    this.roadsMesh = new THREE.Mesh(roadDecalGeo, roadDecalMat);
    this.roadsMesh.position.set((w * ts) / 2, 0, (h * ts) / 2);
    this.roadsMesh.renderOrder = 1;
    this.roadsMesh.receiveShadow = true;
    this.scene.add(this.roadsMesh);

    // 3. Continuous Scenario-Specific Shimmering Rivers
    const waterColor = this.scenarioId === 'dragon_caldor'
      ? 0xf97316 // Volcanic molten runoff / lava-amber
      : (this.scenarioId === 'cursed_graveyards'
          ? 0x2e1065 // Dark cursed night-purple
          : (this.scenarioId === 'vampire_coast' ? 0x064e3b : 0x0284c7));

    const waterMat = new THREE.MeshStandardMaterial({
      color: waterColor,
      roughness: 0.1,
      metalness: 0.35,
      map: this.riverTexture,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    // Extrude Continuous Western River Ribbon
    const numRiverSteps = Math.floor(h * 3);
    const westRiverPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= numRiverSteps; i++) {
      const rz = (i / numRiverSteps) * (h * ts);
      const rx = this.getWestRiverX(rz);
      const ry = this.getRiverWaterHeight(rz, 'west');
      westRiverPoints.push(new THREE.Vector3(rx, ry, rz));
    }
    const westRiverMesh = this.createContinuousRiverRibbon(westRiverPoints, ts * 2.2, waterMat, 'west');
    westRiverMesh.renderOrder = 2;
    this.terrainGroup.add(westRiverMesh);

    // Extrude Continuous Eastern Mountain Brook Ribbon
    const eastRiverPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= numRiverSteps; i++) {
      const rz = (i / numRiverSteps) * (h * ts);
      const rx = this.getEastRiverX(rz);
      const ry = this.getRiverWaterHeight(rz, 'east');
      eastRiverPoints.push(new THREE.Vector3(rx, ry, rz));
    }
    const eastRiverMesh = this.createContinuousRiverRibbon(eastRiverPoints, ts * 2.0, waterMat, 'east');
    eastRiverMesh.renderOrder = 2;
    this.terrainGroup.add(eastRiverMesh);

    // 3.5. Place Spectacular Cascading Waterfalls along Mountain Brook
    this.waterfallsGroup.clear();
    this.waterfallsList = [];

    const wf1Z = (h * ts) * 0.22;
    const wf1X = this.getEastRiverX(wf1Z);
    const wf1TopY = this.getTerrainBaseElevation(wf1X, wf1Z) + 4.5;
    const wf1BotY = this.getRiverWaterHeight(wf1Z, 'east');
    const wf1 = this.create3DWaterfall(wf1X, wf1TopY, wf1BotY, wf1Z, 18);
    this.waterfallsGroup.add(wf1);
    this.waterfallsList.push(wf1);

    const wf2Z = (h * ts) * 0.62;
    const wf2X = this.getEastRiverX(wf2Z);
    const wf2TopY = this.getTerrainBaseElevation(wf2X, wf2Z) + 3.8;
    const wf2BotY = this.getRiverWaterHeight(wf2Z, 'east');
    const wf2 = this.create3DWaterfall(wf2X, wf2TopY, wf2BotY, wf2Z, 16);
    this.waterfallsGroup.add(wf2);
    this.waterfallsList.push(wf2);

    // 4. Place Grand 3D Stone Arch Bridges at the 3 Crossing Points
    this.terrainFeaturesList = [];
    const bridgeY1 = Math.floor(h * 0.28);
    const bridgeY2 = Math.floor(h * 0.72);
    const bridgeY3 = Math.floor(h * 0.48);

    const bridgeCrossings = [
      { z: (bridgeY1 + 1.0) * ts, getX: (z: number) => this.getWestRiverX(z), tx: Math.floor(this.getWestRiverX((bridgeY1 + 1.0) * ts) / ts), ty: bridgeY1 },
      { z: (bridgeY2 + 1.0) * ts, getX: (z: number) => this.getWestRiverX(z), tx: Math.floor(this.getWestRiverX((bridgeY2 + 1.0) * ts) / ts), ty: bridgeY2 },
      { z: (bridgeY3 + 1.0) * ts, getX: (z: number) => this.getEastRiverX(z), tx: Math.floor(this.getEastRiverX((bridgeY3 + 1.0) * ts) / ts), ty: bridgeY3 }
    ];

    for (const bc of bridgeCrossings) {
      const bx = bc.getX(bc.z);
      const bz = bc.z;
      const bridge = this.create3DBridgeMesh();
      bridge.name = 'bridgeMesh';
      const baseElev = this.getTerrainBaseElevation(bx, bz);
      bridge.position.set(bx, baseElev + 0.1, bz);
      bridge.userData = { tx: bc.tx, ty: bc.ty };
      this.terrainGroup.add(bridge);
      this.terrainFeaturesList.push(bridge);
      this.streetLampsList.push(bridge);
    }

    // 5. Natural Features (Trees, Rocks, Flora) — good GLTF models only.
    // Scattered once the registry is ready (behind the loading veil), so
    // no procedural stand-ins ever flash on screen.
    if (ModelRegistry.getInstance().isReady) {
      this.scatterNatureAndMerge();
    } else {
      ModelRegistry.getInstance().onChange(() => this.scatterNatureAndMerge());
    }
  }

  /** One-shot scatter of GLTF nature + static merge. Guarded: onChange fires per model. */
  private scatterNatureAndMerge(): void {
    if (this.natureScattered || !ModelRegistry.getInstance().isReady) return;
    this.natureScattered = true;
    // 5. Natural Features (Trees, Rocks)
    const ts = this.gridManager.tileSize;
    const w = this.gridManager.width;
    const h = this.gridManager.height;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const tile = this.gridManager.grid[y][x];
        const px = (x + 0.5) * ts;
        const pz = (y + 0.5) * ts;

        if (tile === 3) {
          // Organic Medieval Forest Grove scattering
          const hash1 = (((x * 127 + y * 311) % 1000) + 1000) % 1000 / 1000;
          const hash2 = (((x * 269 + y * 183) % 1000) + 1000) % 1000 / 1000;
          const hash3 = (((x * 359 + y * 491) % 1000) + 1000) % 1000 / 1000;

          const variant = (x * 7 + y * 13) % 3;
          const tree = this.create3DTreeMesh(variant);
          const scale = 0.75 + hash1 * 0.5;
          tree.scale.set(scale, scale, scale);
          tree.rotation.y = hash2 * Math.PI * 2;
          
          const offsetX = (hash1 - 0.5) * 20;
          const offsetZ = (hash2 - 0.5) * 20;
          const treeY = this.getTerrainHeight(px + offsetX, pz + offsetZ);
          tree.position.set(px + offsetX, treeY, pz + offsetZ);
          tree.userData = { tx: x, ty: y };
          this.terrainGroup.add(tree);
          this.terrainFeaturesList.push(tree);

          if (hash3 > 0.58) {
            const variant2 = (variant + 1) % 3;
            const tree2 = this.create3DTreeMesh(variant2);
            const scale2 = 0.5 + (1.0 - hash3) * 0.45;
            tree2.scale.set(scale2, scale2, scale2);
            tree2.rotation.y = hash3 * Math.PI * 2;
            const tree2Y = this.getTerrainHeight(px - offsetX * 0.75, pz - offsetZ * 0.75);
            tree2.position.set(px - offsetX * 0.75, tree2Y, pz - offsetZ * 0.75);
            tree2.userData = { tx: x, ty: y };
            this.terrainGroup.add(tree2);
            this.terrainFeaturesList.push(tree2);
          }
        } else if (tile === 4) {
          // Mountain Rock Formation (Kenney 3D Boulders / Crags only)
          const gltfRock = ModelRegistry.getInstance().getRockModel(x + y);
          if (!gltfRock) continue;
          const box = new THREE.Box3().setFromObject(gltfRock);
          const size = new THREE.Vector3(); box.getSize(size);
          const center = new THREE.Vector3(); box.getCenter(center);
          const targetH = 12.0;
          const scale = size.y > 0 ? targetH / size.y : 1.0;
          gltfRock.scale.set(scale, scale, scale);
          gltfRock.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
          const rockObj = new THREE.Group();
          rockObj.add(gltfRock);
          const rockY = this.getTerrainHeight(px, pz) + 0.2;
          rockObj.position.set(px, rockY, pz);
          rockObj.rotation.set(0, (x * 0.4 + y * 0.6) % (Math.PI * 2), 0);
          rockObj.userData = { tx: x, ty: y };
          this.terrainGroup.add(rockObj);
          this.terrainFeaturesList.push(rockObj);
        } else if (tile === 0) {
          // Open meadow flora scattering (Wildflowers, Grass tufts, River pebbles)
          const hash = (((x * 283 + y * 439) % 1000) + 1000) % 1000 / 1000;
          const hashB = (((x * 179 + y * 337) % 1000) + 1000) % 1000 / 1000;
          const distW = Math.abs(px - this.getWestRiverX(pz));
          const distE = Math.abs(px - this.getEastRiverX(pz));
          const minRiver = Math.min(distW, distE);

          if (minRiver > 18 && minRiver < 36 && hash > 0.68) {
            // Riverbank mossy pebbles
            const pebble = this.create3DRiverPebbleMesh();
            const pebY = this.getTerrainHeight(px, pz);
            pebble.position.set(px + (hash - 0.5) * 12, pebY, pz + (hashB - 0.5) * 12);
            pebble.rotation.y = hash * Math.PI * 2;
            pebble.userData = { tx: x, ty: y };
            this.terrainGroup.add(pebble);
            this.terrainFeaturesList.push(pebble);
          } else if (hash > 0.48 && Math.hypot(px - (w * ts) / 2, pz - (h * ts) / 2) > 100) {
            if (hashB > 0.52) {
              // 3D Wildflower patch (Poppies, Buttercups, Bluebells, Daisies)
              const flowerType = (x * 3 + y * 7) % 4;
              const flower = this.create3DWildflowerMesh(flowerType);
              const flowerY = this.getTerrainHeight(px + (hash - 0.5) * 14, pz + (hashB - 0.5) * 14);
              flower.position.set(px + (hash - 0.5) * 14, flowerY, pz + (hashB - 0.5) * 14);
              flower.scale.set(0.9 + hashB * 0.35, 0.9 + hashB * 0.35, 0.9 + hashB * 0.35);
              flower.userData = { tx: x, ty: y };
              this.terrainGroup.add(flower);
              this.terrainFeaturesList.push(flower);
            } else {
              // 3D Swaying Grass Tuft
              const tuft = this.create3DGrassTuftMesh((x + y) % 4);
              const tuftY = this.getTerrainHeight(px + (hashB - 0.5) * 14, pz + (hash - 0.5) * 14);
              tuft.position.set(px + (hashB - 0.5) * 14, tuftY, pz + (hash - 0.5) * 14);
              tuft.scale.set(0.85 + hash * 0.35, 0.85 + hash * 0.35, 0.85 + hash * 0.35);
              tuft.userData = { tx: x, ty: y };
              this.terrainGroup.add(tuft);
              this.terrainFeaturesList.push(tuft);
            }
          }
        }
      }
    }

    // PERF: collapse thousands of static decor meshes (trees, rocks, flora) into a
    // handful of merged geometries per material. Fog-of-war per-object hiding is
    // replaced by a shader fade sampling the shroud texture.
    this.mergeStaticTerrainDecor();
  }

  private mergeStaticTerrainDecor(): void {
    const candidates = this.terrainFeaturesList.filter(f => f.name !== 'bridgeMesh');
    if (candidates.length === 0 || typeof document === 'undefined') return;

    this.terrainGroup.updateMatrixWorld(true);

    const ts = this.gridManager.tileSize;
    const chunkTiles = 8;
    const chunkWorld = chunkTiles * ts;

    interface DecorBucket {
      geos: THREE.BufferGeometry[];
      material: THREE.Material;
      castShadow: boolean;
    }
    const buckets = new Map<string, DecorBucket>();
    const protoMaterials = new Map<string, THREE.Material>();

    for (const feat of candidates) {
      const ud = feat.userData as { tx?: number; ty?: number };
      const cx = Math.floor((ud.tx ?? 0) / chunkTiles);
      const cy = Math.floor((ud.ty ?? 0) / chunkTiles);
      const chunkKey = `${cx}_${cy}`;

      feat.traverse(obj => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        const srcMat = mesh.material as THREE.MeshStandardMaterial;
        if (!srcMat) return;

        // Bake material color into vertex colors so each chunk needs only ONE
        // shared material (map/transparent materials get their own bucket).
        const bucketVariant = srcMat.map ? `map_${srcMat.map.uuid}` : (srcMat.transparent ? 'transparent' : 'plain');
        const key = `${chunkKey}|${bucketVariant}`;

        let mat = protoMaterials.get(key);
        if (!mat) {
          mat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            vertexColors: bucketVariant === 'plain',
            roughness: 0.85,
            metalness: 0.0,
            map: srcMat.map ?? null,
            transparent: srcMat.transparent,
            alphaTest: srcMat.transparent ? 0.35 : 0.0,
            side: THREE.FrontSide
          });
          this.injectShroudFadeShader(mat);
          protoMaterials.set(key, mat);
        }

        const geo = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
        geo.applyMatrix4(mesh.matrixWorld);

        if (bucketVariant === 'plain') {
          const col = srcMat.color ?? new THREE.Color(1, 1, 1);
          const count = geo.attributes.position.count;
          const colors = new Float32Array(count * 3);
          for (let i = 0; i < count; i++) {
            colors[i * 3] = col.r;
            colors[i * 3 + 1] = col.g;
            colors[i * 3 + 2] = col.b;
          }
          geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        }

        let bucket = buckets.get(key);
        if (!bucket) {
          bucket = { geos: [], material: mat, castShadow: true };
          buckets.set(key, bucket);
        }
        bucket.geos.push(geo);
      });
    }

    for (const [key, bucket] of buckets) {
      if (bucket.geos.length === 0) continue;
      let merged: THREE.BufferGeometry | null = null;
      try {
        merged = mergeGeometries(bucket.geos, false);
      } catch {
        merged = null;
      }
      bucket.geos.forEach(g => g.dispose());
      if (!merged) continue;

      // Re-center geometry on its chunk so frustum culling stays effective
      const keyParts = key.split('|')[0].split('_');
      const cx = parseInt(keyParts[0], 10);
      const cy = parseInt(keyParts[1], 10);
      const originX = cx * chunkWorld + chunkWorld / 2;
      const originZ = cy * chunkWorld + chunkWorld / 2;
      merged.translate(-originX, 0, -originZ);

      const mesh = new THREE.Mesh(merged, bucket.material);
      mesh.name = `mergedDecor_${key}`;
      mesh.castShadow = bucket.castShadow;
      mesh.receiveShadow = true;
      mesh.position.set(originX, 0, originZ);
      mesh.updateMatrix();
      mesh.matrixAutoUpdate = false;
      this.terrainGroup.add(mesh);
    }

    for (const feat of candidates) {
      this.terrainGroup.remove(feat);
      feat.traverse(obj => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) mesh.geometry.dispose();
      });
    }
    this.terrainFeaturesList = this.terrainFeaturesList.filter(f => f.name === 'bridgeMesh');
  }

  // Fades merged static decor under the fog-of-war shroud by sampling the live
  // shroud canvas texture in the VERTEX shader (per-fragment discard/texture
  // fetches are catastrophically slow on software rasterizers).
  private injectShroudFadeShader(mat: THREE.Material): void {
    const fogTexture = this.fogTexture;
    const worldW = this.gridManager.width * this.gridManager.tileSize;
    const worldH = this.gridManager.height * this.gridManager.tileSize;

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.shroudTex = { value: fogTexture };
      shader.uniforms.shroudWorldSize = { value: new THREE.Vector2(worldW, worldH) };

      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vShroudVis;\nuniform vec2 shroudWorldSize;\nuniform sampler2D shroudTex;')
        .replace('#include <begin_vertex>', [
          '#include <begin_vertex>',
          'vec4 shroudWorldPos = modelMatrix * vec4(transformed, 1.0);',
          'vec2 shroudUv = shroudWorldPos.xz / shroudWorldSize;',
          'float shroudA = texture2D(shroudTex, shroudUv).a;',
          'vShroudVis = clamp(1.0 - shroudA * 1.6, 0.0, 1.0);'
        ].join('\n'));

      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vShroudVis;')
        .replace('#include <dithering_fragment>', [
          '#include <dithering_fragment>',
          'gl_FragColor.rgb *= vShroudVis;'
        ].join('\n'));
    };
  }

  private createContinuousRiverRibbon(points: THREE.Vector3[], riverWidth: number, mat: THREE.Material, riverType: 'west' | 'east'): THREE.Mesh {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);
    const segments = Math.max(80, points.length * 3);
    const curvePoints = curve.getPoints(segments);

    const vertices: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= segments; i++) {
      const p = curvePoints[i];
      const t = curve.getTangent(i / segments);
      const nx = -t.z;
      const nz = t.x;
      const len = Math.hypot(nx, nz) || 1;
      const normX = (nx / len) * (riverWidth / 2);
      const normZ = (nz / len) * (riverWidth / 2);

      const waterY = this.getRiverWaterHeight(p.z, riverType);

      vertices.push(p.x - normX, waterY, p.z - normZ);
      uvs.push(0, i / 3);

      vertices.push(p.x + normX, waterY, p.z + normZ);
      uvs.push(1, i / 3);

      if (i < segments) {
        const baseIdx = i * 2;
        indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
        indices.push(baseIdx + 1, baseIdx + 3, baseIdx + 2);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    return mesh;
  }

  private create3DWaterfall(topX: number, topY: number, bottomY: number, topZ: number, width: number): THREE.Group {
    const group = new THREE.Group();
    const dropHeight = Math.max(5.0, topY - bottomY);

    // 1. Curved Cascading Water Curtain Sheet
    const cascadeGeo = new THREE.PlaneGeometry(width, dropHeight, 8, 12);
    const pos = cascadeGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const v = (pos.getY(i) + dropHeight / 2) / dropHeight; // 0 at bottom, 1 at top
      const forwardArc = Math.sin((1 - v) * Math.PI) * 2.5;
      pos.setZ(i, pos.getZ(i) + forwardArc);
    }
    cascadeGeo.computeVertexNormals();

    const cascadeMat = new THREE.MeshStandardMaterial({
      map: this.waterfallTexture,
      transparent: true,
      opacity: 0.95,
      roughness: 0.05,
      metalness: 0.15,
      side: THREE.DoubleSide
    });
    const cascade = new THREE.Mesh(cascadeGeo, cascadeMat);
    cascade.position.set(topX, (topY + bottomY) / 2, topZ);
    cascade.rotation.y = Math.PI; // Face downstream
    group.add(cascade);

    // 2. Flanking Giant Mossy Granite Gorge Boulders
    const rockGeo = new THREE.DodecahedronGeometry(4.8, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 });

    const rockL = new THREE.Mesh(rockGeo, rockMat);
    rockL.position.set(topX - width / 2 - 2.5, (topY + bottomY) / 2, topZ);
    rockL.scale.set(1.2, 1.5, 1.3);
    rockL.castShadow = true;
    group.add(rockL);

    const rockR = new THREE.Mesh(rockGeo, rockMat);
    rockR.position.set(topX + width / 2 + 2.5, (topY + bottomY) / 2, topZ);
    rockR.scale.set(1.2, 1.5, 1.3);
    rockR.castShadow = true;
    group.add(rockR);

    // Top Crest Rocky Shelf
    const shelfGeo = new THREE.BoxGeometry(width + 6, 2.0, 4.0);
    const shelf = new THREE.Mesh(shelfGeo, rockMat);
    shelf.position.set(topX, topY - 1.0, topZ - 2);
    shelf.castShadow = true;
    group.add(shelf);

    // 3. Foaming Splash Basin at Bottom
    const splashGeo = new THREE.RingGeometry(1.0, width * 0.9, 16);
    splashGeo.rotateX(-Math.PI / 2);
    const splashMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide
    });
    const splash = new THREE.Mesh(splashGeo, splashMat);
    splash.name = 'waterfallSplash';
    splash.position.set(topX, bottomY + 0.3, topZ + 2.5);
    group.add(splash);

    // 4. Mist Spray Puffs
    const mistGroup = new THREE.Group();
    mistGroup.name = 'mistGroup';
    mistGroup.position.set(topX, bottomY + 0.5, topZ + 2.5);

    const mistGeo = new THREE.SphereGeometry(1.8, 6, 6);
    for (let m = 0; m < 4; m++) {
      const mistMat = new THREE.MeshBasicMaterial({
        color: 0xf0fdf4,
        transparent: true,
        opacity: 0.35,
        depthWrite: false
      });
      const puff = new THREE.Mesh(mistGeo, mistMat);
      puff.position.set((Math.random() - 0.5) * width * 0.6, m * 1.5, (Math.random() - 0.5) * 3);
      mistGroup.add(puff);
    }
    group.add(mistGroup);

    return group;
  }

  private create3DBridgeMesh(): THREE.Group {
    const group = new THREE.Group();
    const spanX = 76.0; // Spans across the 64-unit river channel onto the solid riverbanks
    const spanZ = 64.0; // Spans both bridge road tiles (2 * 32 = 64 units)

    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x475569, map: this.royalCastleWallTexture, roughness: 0.85 });
    const cobbleMat = new THREE.MeshStandardMaterial({ color: 0x64748b, map: this.cobbleTexture, roughness: 0.8 });
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.25 });
    const amberGlassMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.85
    });
    const emberMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 2.0
    });

    // 1. Heavy Stone Abutment Piers on West & East Riverbanks (anchored into dry terrain)
    const pierGeo = new THREE.BoxGeometry(9.0, 9.0, spanZ * 0.96);
    const pierL = new THREE.Mesh(pierGeo, stoneMat);
    pierL.position.set(-spanX * 0.44, 0.5, 0);
    pierL.castShadow = true;
    pierL.receiveShadow = true;
    group.add(pierL);

    const pierR = new THREE.Mesh(pierGeo, stoneMat);
    pierR.position.set(spanX * 0.44, 0.5, 0);
    pierR.castShadow = true;
    pierR.receiveShadow = true;
    group.add(pierR);

    // 2. Central Stone Arch Substructure Vault (Gracefully arched above water surface)
    const archGeo = new THREE.BoxGeometry(spanX * 0.78, 3.8, spanZ * 0.94);
    const arch = new THREE.Mesh(archGeo, stoneMat);
    arch.position.set(0, 1.2, 0);
    arch.castShadow = true;
    arch.receiveShadow = true;
    group.add(arch);

    // 3. Raised Cobblestone Roadway Deck (Slightly elevated above the river)
    const deckGeo = new THREE.BoxGeometry(spanX, 1.8, spanZ - 4.0);
    const deck = new THREE.Mesh(deckGeo, cobbleMat);
    deck.position.set(0, 2.2, 0);
    deck.castShadow = true;
    deck.receiveShadow = true;
    group.add(deck);

    // Approach ramps connecting elevated bridge deck to ground roads
    const rampGeo = new THREE.BoxGeometry(7.0, 1.4, spanZ - 4.0);
    const rampL = new THREE.Mesh(rampGeo, cobbleMat);
    rampL.position.set(-spanX * 0.46, 1.2, 0);
    rampL.rotation.z = -0.12;
    group.add(rampL);

    const rampR = new THREE.Mesh(rampGeo, cobbleMat);
    rampR.position.set(spanX * 0.46, 1.2, 0);
    rampR.rotation.z = 0.12;
    group.add(rampR);

    // 4. Heavy Carved Stone Parapets on North & South Edges
    const parapetGeo = new THREE.BoxGeometry(spanX, 3.4, 2.2);
    const pNorth = new THREE.Mesh(parapetGeo, stoneMat);
    pNorth.position.set(0, 3.8, -spanZ / 2 + 1.1);
    pNorth.castShadow = true;
    pNorth.receiveShadow = true;
    group.add(pNorth);

    const pSouth = new THREE.Mesh(parapetGeo, stoneMat);
    pSouth.position.set(0, 3.8, spanZ / 2 - 1.1);
    pSouth.castShadow = true;
    pSouth.receiveShadow = true;
    group.add(pSouth);

    // Crenellations along North & South parapet tops
    const crenelGeo = new THREE.BoxGeometry(4.2, 1.4, 2.3);
    const numCrenels = 7;
    for (let c = 0; c < numCrenels; c++) {
      const cx = -spanX * 0.40 + c * (spanX * 0.80 / (numCrenels - 1));
      const cN = new THREE.Mesh(crenelGeo, stoneMat);
      cN.position.set(cx, 5.8, -spanZ / 2 + 1.1);
      group.add(cN);

      const cS = new THREE.Mesh(crenelGeo, stoneMat);
      cS.position.set(cx, 5.8, spanZ / 2 - 1.1);
      group.add(cS);
    }

    // 5. Four Grand Corner Stone Pedestals with Amber Lanterns
    const pedestalGeo = new THREE.BoxGeometry(3.2, 5.0, 3.2);
    const capGeo = new THREE.BoxGeometry(3.6, 0.8, 3.6);
    const bracketGeo = new THREE.CylinderGeometry(0.35, 0.55, 0.9, 6);
    const cageGeo = new THREE.BoxGeometry(1.8, 2.4, 1.8);
    const emberGeo = new THREE.SphereGeometry(0.5, 6, 6);
    const roofGeo = new THREE.ConeGeometry(1.5, 1.4, 4);
    roofGeo.rotateY(Math.PI / 4);

    const cornerCoords = [
      [-spanX * 0.46, -spanZ * 0.46],
      [spanX * 0.46, -spanZ * 0.46],
      [-spanX * 0.46, spanZ * 0.46],
      [spanX * 0.46, spanZ * 0.46]
    ];

    cornerCoords.forEach(([lx, lz]) => {
      // Stone Pedestal Pillar
      const pedestal = new THREE.Mesh(pedestalGeo, stoneMat);
      pedestal.position.set(lx, 4.2, lz);
      pedestal.castShadow = true;
      group.add(pedestal);

      // Chamfered Stone Cap
      const cap = new THREE.Mesh(capGeo, stoneMat);
      cap.position.set(lx, 6.8, lz);
      group.add(cap);

      // Wrought-Iron Base
      const bracket = new THREE.Mesh(bracketGeo, ironMat);
      bracket.position.set(lx, 7.5, lz);
      group.add(bracket);

      // Amber Glass Lantern Cage
      const cage = new THREE.Mesh(cageGeo, amberGlassMat);
      cage.name = 'lanternCage';
      cage.position.set(lx, 8.8, lz);
      cage.castShadow = true;
      group.add(cage);

      // Glowing Ember
      const ember = new THREE.Mesh(emberGeo, emberMat);
      ember.name = 'lanternEmber';
      ember.position.set(lx, 8.8, lz);
      group.add(ember);

      // Iron Lantern Cap
      const roof = new THREE.Mesh(roofGeo, ironMat);
      roof.position.set(lx, 10.5, lz);
      group.add(roof);
    });

    this.registerLampGlow(group);
    return group;
  }

  private create3DNightTorchMesh(): THREE.Group {
    const torch = new THREE.Group();
    torch.name = 'nightTorch';

    // Wooden torch handle
    const shaftGeo = new THREE.CylinderGeometry(0.18, 0.22, 3.2, 6);
    const shaftMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    shaft.position.y = 1.6;
    torch.add(shaft);

    // Iron wire-wrapped torch head with charred pitch
    const headGeo = new THREE.CylinderGeometry(0.35, 0.25, 0.8, 6);
    const headMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.8 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 3.2;
    torch.add(head);

    // Glowing flame ember cone with dynamic animated pulse
    const flameGeo = new THREE.ConeGeometry(0.45, 1.2, 6);
    const flameMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xf59e0b,
      emissiveIntensity: 2.5,
      roughness: 0.2
    });
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.name = 'torchFlame';
    flame.position.y = 4.0;
    torch.add(flame);

    // Soft luminous radial aura glow
    const haloGeo = new THREE.SphereGeometry(1.2, 8, 8);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.35,
      depthWrite: false
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.name = 'torchHalo';
    halo.position.y = 4.0;
    torch.add(halo);

    torch.visible = false;
    return torch;
  }

  private create3DStreetLampMesh(): THREE.Group {
    const lamp = new THREE.Group();
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.25 });
    const amberGlassMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xd97706,
      emissiveIntensity: 0.5,
      transparent: true,
      opacity: 0.85
    });

    // Subterranean Stone Footing
    const baseGeo = new THREE.CylinderGeometry(0.9, 1.2, 2.5, 6);
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 });
    const base = new THREE.Mesh(baseGeo, stoneMat);
    base.position.y = 0.5;
    lamp.add(base);

    // Slender Wrought-Iron Lamp Post
    const postGeo = new THREE.CylinderGeometry(0.3, 0.45, 13, 6);
    const post = new THREE.Mesh(postGeo, ironMat);
    post.position.y = 7.0;
    post.castShadow = true;
    lamp.add(post);

    // Ornate Curved Bracket Arm
    const bracketGeo = new THREE.BoxGeometry(2.8, 0.4, 0.4);
    const bracket = new THREE.Mesh(bracketGeo, ironMat);
    bracket.position.set(1.0, 13.0, 0);
    lamp.add(bracket);

    // Suspended Amber Glass Lantern Cage
    const cageGeo = new THREE.BoxGeometry(1.6, 2.4, 1.6);
    const cage = new THREE.Mesh(cageGeo, amberGlassMat);
    cage.name = 'lanternCage';
    cage.position.set(2.0, 11.5, 0);
    cage.castShadow = true;
    lamp.add(cage);

    // Glowing Flame Core inside
    const emberGeo = new THREE.SphereGeometry(0.5, 8, 8);
    const emberMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.5
    });
    const ember = new THREE.Mesh(emberGeo, emberMat);
    ember.name = 'lanternEmber';
    ember.position.set(2.0, 11.5, 0);
    lamp.add(ember);

    // Warm street puddle illumination disc on the ground
    const puddleGeo = new THREE.CircleGeometry(4.5, 16);
    puddleGeo.rotateX(-Math.PI / 2);
    const puddleMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      transparent: true,
      opacity: 0.25,
      depthWrite: false
    });
    const puddle = new THREE.Mesh(puddleGeo, puddleMat);
    puddle.name = 'lampPuddle';
    puddle.position.set(2.0, 0.15, 0);
    lamp.add(puddle);

    this.registerLampGlow(lamp);
    return lamp;
  }

  /** Traverse a lamp/bridge once at creation and cache its glow materials. */
  private registerLampGlow(root: THREE.Object3D) {
    const entry: { root: THREE.Object3D; ember?: THREE.MeshStandardMaterial; cage?: THREE.MeshStandardMaterial; puddle?: THREE.MeshBasicMaterial } = { root };
    root.traverse(child => {
      if (child instanceof THREE.Mesh) {
        if (child.name === 'lanternEmber' && child.material instanceof THREE.MeshStandardMaterial) {
          entry.ember = child.material;
        } else if (child.name === 'lanternCage' && child.material instanceof THREE.MeshStandardMaterial) {
          entry.cage = child.material;
        } else if (child.name === 'lampPuddle' && child.material instanceof THREE.MeshBasicMaterial) {
          entry.puddle = child.material;
        }
      }
    });
    this.lampGlowMats.push(entry);
  }

  private disposeObjectTree(root: THREE.Object3D) {
    root.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        const mat = child.material as THREE.Material | THREE.Material[];
        if (Array.isArray(mat)) mat.forEach(m => m.dispose());
        else if (mat) mat.dispose();
      }
    });
  }

  // --- UNIFIED ROAD NETWORK GENERATOR (Computed all at once from all building locations) ---
  private updateTerrainRoads(state: GameState) {
    if (this.lastRoadVersion === this.gridManager.roadVersion) return;
    this.lastRoadVersion = this.gridManager.roadVersion;

    const ts = this.gridManager.tileSize;
    const palace = state.buildings.find(b => b.type === 'palace');
    const palaceCenterX = palace ? (palace.x + palace.width / 2) * ts : (this.gridManager.width * ts) / 2;
    const palaceGateZ = palace ? (palace.y + palace.height) * ts + 4 : (this.gridManager.height * ts) / 2;

    const mapW = this.gridManager.width * ts;
    const mapH = this.gridManager.height * ts;

    const canvas = this.roadCanvas;
    const ctx = this.roadCtx;
    const canvasSize = canvas.width;

    ctx.clearRect(0, 0, canvasSize, canvasSize);

    const toCanvasX = (worldX: number) => (worldX / mapW) * canvasSize;
    const toCanvasY = (worldZ: number) => (worldZ / mapH) * canvasSize;
    const scaleDist = (d: number) => (d / mapW) * canvasSize;

    // 1. Define Road Network Graph Nodes: Start with Royal High Street Spine
    const roadNetworkNodes: { x: number; z: number }[] = [];
    const allPolylines: { x: number; z: number }[][] = [];

    // Grand Avenue from Palace Gatehouse heading south
    const rawAvenuePoints = [
      { x: palaceCenterX, z: palaceGateZ + 4 },
      { x: palaceCenterX, z: palaceGateZ + 20 },
      { x: palaceCenterX, z: palaceGateZ + 38 },
      { x: palaceCenterX, z: palaceGateZ + 58 },
    ];
    const avenuePoints: { x: number; z: number }[] = [];
    for (const p of rawAvenuePoints) {
      if (!this.gridManager.isWalkablePosition(p.x, p.z, state.buildings, state.lairs, palace?.id, 6)) {
        break;
      }
      avenuePoints.push(p);
    }
    if (avenuePoints.length >= 2) {
      allPolylines.push(avenuePoints);
    }
    avenuePoints.forEach(p => roadNetworkNodes.push(p));

    // Also register bridge crossing approach points
    for (let y = 0; y < this.gridManager.height; y++) {
      for (let x = 0; x < this.gridManager.width; x++) {
        if (this.gridManager.grid[y][x] === 5) {
          roadNetworkNodes.push({ x: (x + 0.5) * ts, z: (y + 0.5) * ts });
        }
      }
    }

    // 2. Sort completed non-palace buildings by distance to Palace so closer buildings connect first and form branches
    const nonPalaceBuildings = state.buildings
      .filter(b => b.type !== 'palace' && !b.isConstructing)
      .sort((a, b) => {
        const da = Math.hypot((a.x + a.width / 2) * ts - palaceCenterX, (a.y + a.height / 2) * ts - (palaceGateZ + 20));
        const db = Math.hypot((b.x + b.width / 2) * ts - palaceCenterX, (b.y + b.height / 2) * ts - (palaceGateZ + 20));
        return da - db;
      });

    const buildingAprons: { x: number; z: number; w: number; h: number }[] = [];

    for (const b of nonPalaceBuildings) {
      const centerBx = (b.x + b.width / 2) * ts;
      const centerBz = (b.y + b.height / 2) * ts;
      const halfW = (b.width * ts) / 2;
      const halfH = (b.height * ts) / 2;

      // Find closest existing point on the road network
      let closestPoint = roadNetworkNodes[0];
      let minPointDist = Infinity;
      for (const pt of roadNetworkNodes) {
        const d = Math.hypot(pt.x - centerBx, pt.z - centerBz);
        if (d < minPointDist) {
          minPointDist = d;
          closestPoint = pt;
        }
      }

      // Determine doorstep facing closest road node
      let facing = b.facing;
      if (!facing) {
        const dxToRoad = closestPoint.x - centerBx;
        const dzToRoad = closestPoint.z - centerBz;
        if (Math.abs(dzToRoad) >= Math.abs(dxToRoad)) {
          facing = dzToRoad < 0 ? 'north' : 'south';
        } else {
          facing = dxToRoad < 0 ? 'west' : 'east';
        }
        b.facing = facing;
      }

      let entranceX = centerBx;
      let entranceZ = centerBz + halfH + 2;

      if (facing === 'north') {
        entranceZ = centerBz - halfH - 2;
      } else if (facing === 'south') {
        entranceZ = centerBz + halfH + 2;
      } else if (facing === 'east') {
        entranceX = centerBx + halfW + 2;
        entranceZ = centerBz;
      } else if (facing === 'west') {
        entranceX = centerBx - halfW - 2;
        entranceZ = centerBz;
      }

      const isHorizontal = facing === 'east' || facing === 'west';
      buildingAprons.push({
        x: entranceX,
        z: entranceZ,
        w: isHorizontal ? 8 : 14,
        h: isHorizontal ? 14 : 8
      });

      // Find path from building doorstep to the road network (Treats all buildings as solid obstacles)
      const waypoints = this.gridManager.findPath(
        entranceX,
        entranceZ,
        closestPoint.x,
        closestPoint.z,
        state.buildings,
        state.lairs
      );

      const branchPath: { x: number; z: number }[] = [{ x: entranceX, z: entranceZ }];

      // Point-to-segment projection (for merging onto existing road centerlines)
      const distToSegment = (px: number, pz: number, a: { x: number; z: number }, b: { x: number; z: number }) => {
        const abx = b.x - a.x, abz = b.z - a.z;
        const len2 = abx * abx + abz * abz;
        let t = len2 > 0 ? ((px - a.x) * abx + (pz - a.z) * abz) / len2 : 0;
        t = Math.max(0, Math.min(1, t));
        const cx = a.x + abx * t, cz = a.z + abz * t;
        return { d: Math.hypot(px - cx, pz - cz), x: cx, z: cz };
      };

      let mergedToExisting = false;
      for (let i = 0; i < waypoints.length; i++) {
        const wp = waypoints[i];
        const curP = {
          x: wp.x + Math.sin(wp.x * 0.06 + wp.y * 0.06) * 1.5,
          z: wp.y + Math.cos(wp.x * 0.06 - wp.y * 0.06) * 1.5
        };

        // If path comes within 10 units of ANY existing road node, snap and terminate smoothly!
        for (const existingPt of roadNetworkNodes) {
          if (Math.hypot(curP.x - existingPt.x, curP.z - existingPt.z) < 10) {
            branchPath.push({ x: existingPt.x, z: existingPt.z });
            mergedToExisting = true;
            break;
          }
        }

        // Also merge onto road SEGMENTS (not just sparse nodes) so parallel streets T-junction instead of running alongside
        if (!mergedToExisting) {
          for (const poly of allPolylines) {
            for (let s = 0; s < poly.length - 1; s++) {
              const hit = distToSegment(curP.x, curP.z, poly[s], poly[s + 1]);
              if (hit.d < 9) {
                branchPath.push({ x: hit.x, z: hit.z });
                roadNetworkNodes.push({ x: hit.x, z: hit.z });
                mergedToExisting = true;
                break;
              }
            }
            if (mergedToExisting) break;
          }
        }

        if (mergedToExisting) {
          break; // Seamless T-junction merge
        }

        if (Math.hypot(curP.x - branchPath[branchPath.length - 1].x, curP.z - branchPath[branchPath.length - 1].z) > 6) {
          branchPath.push(curP);
        }
      }

      // Guarantee the road physically touches BOTH ends: A* snaps to tile centers which can stop
      // half a tile short of the doorstep and the network node — pin them exactly.
      if (!mergedToExisting) {
        const last = branchPath[branchPath.length - 1];
        if (Math.hypot(last.x - closestPoint.x, last.z - closestPoint.z) > 3) {
          branchPath.push({ x: closestPoint.x, z: closestPoint.z });
        }
      }

      if (branchPath.length >= 2) {
        allPolylines.push(branchPath);
        // Register intermediate nodes so subsequent buildings can connect into this street
        for (let k = 0; k < branchPath.length; k += 2) {
          roadNetworkNodes.push(branchPath[k]);
        }
      }
    }

    // 3. Render Unified Road Network onto Canvas (Zero overlap seams, zero gaps!)
    const roadWidthPx = scaleDist(13.0);
    const plazaW = scaleDist(46);
    const plazaH = scaleDist(26);
    const plazaX = toCanvasX(palaceCenterX) - plazaW / 2;
    const plazaY = toCanvasY(palaceGateZ - 2);

    // Trace smooth rounded spline curves through waypoints (smooth fillets at all corners!)
    const traceCurvedRoad = (poly: { x: number; z: number }[]) => {
      if (poly.length < 2) return;
      ctx.moveTo(toCanvasX(poly[0].x), toCanvasY(poly[0].z));
      if (poly.length === 2) {
        ctx.lineTo(toCanvasX(poly[1].x), toCanvasY(poly[1].z));
        return;
      }
      for (let i = 1; i < poly.length - 1; i++) {
        const xc = (toCanvasX(poly[i].x) + toCanvasX(poly[i + 1].x)) / 2;
        const yc = (toCanvasY(poly[i].z) + toCanvasY(poly[i + 1].z)) / 2;
        ctx.quadraticCurveTo(toCanvasX(poly[i].x), toCanvasY(poly[i].z), xc, yc);
      }
      ctx.lineTo(toCanvasX(poly[poly.length - 1].x), toCanvasY(poly[poly.length - 1].z));
    };

    // --- PASS 1: Dark Slate Curb & Mortar Outlines ---
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = roadWidthPx + scaleDist(4.0);

    // Palace Courtyard Plaza Outline
    ctx.fillStyle = '#1c1917';
    ctx.beginPath();
    ctx.roundRect(plazaX - scaleDist(2), plazaY - scaleDist(2), plazaW + scaleDist(4), plazaH + scaleDist(4), scaleDist(4));
    ctx.fill();

    // Building Doorstep Apron Outlines
    for (const ap of buildingAprons) {
      const aw = scaleDist(ap.w + 3);
      const ah = scaleDist(ap.h + 3);
      ctx.beginPath();
      ctx.roundRect(toCanvasX(ap.x) - aw / 2, toCanvasY(ap.z) - ah / 2, aw, ah, scaleDist(3));
      ctx.fill();
    }

    // Road Polylines Outer Stroke
    for (const poly of allPolylines) {
      if (poly.length < 2) continue;
      ctx.beginPath();
      traceCurvedRoad(poly);
      ctx.stroke();
    }

    // --- PASS 2: Stone Bed Foundation Fill ---
    ctx.strokeStyle = '#44403c';
    ctx.lineWidth = roadWidthPx;

    ctx.fillStyle = '#44403c';
    ctx.beginPath();
    ctx.roundRect(plazaX, plazaY, plazaW, plazaH, scaleDist(3));
    ctx.fill();

    for (const ap of buildingAprons) {
      const aw = scaleDist(ap.w);
      const ah = scaleDist(ap.h);
      ctx.beginPath();
      ctx.roundRect(toCanvasX(ap.x) - aw / 2, toCanvasY(ap.z) - ah / 2, aw, ah, scaleDist(2));
      ctx.fill();
    }

    for (const poly of allPolylines) {
      if (poly.length < 2) continue;
      ctx.beginPath();
      traceCurvedRoad(poly);
      ctx.stroke();
    }

    // --- PASS 3: Seamless High-Definition Dressed Cobblestone Pavers Fill ---
    if (this.roadPattern) {
      ctx.strokeStyle = this.roadPattern;
      ctx.lineWidth = roadWidthPx - scaleDist(1.2);

      ctx.fillStyle = this.roadPattern;
      ctx.beginPath();
      ctx.roundRect(plazaX + scaleDist(1), plazaY + scaleDist(1), plazaW - scaleDist(2), plazaH - scaleDist(2), scaleDist(2));
      ctx.fill();

      for (const ap of buildingAprons) {
        const aw = scaleDist(ap.w - 1.5);
        const ah = scaleDist(ap.h - 1.5);
        ctx.beginPath();
        ctx.roundRect(toCanvasX(ap.x) - aw / 2, toCanvasY(ap.z) - ah / 2, aw, ah, scaleDist(2));
        ctx.fill();
      }

      for (const poly of allPolylines) {
        if (poly.length < 2) continue;
        ctx.beginPath();
        traceCurvedRoad(poly);
        ctx.stroke();
      }

      // --- PASS 4: Crisp Hewn Curbstone Edge Highlights & Definition ---
      // Subtle top/inner crisp edge highlight
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = roadWidthPx - scaleDist(1.6);
      for (const poly of allPolylines) {
        if (poly.length < 2) continue;
        ctx.beginPath();
        traceCurvedRoad(poly);
        ctx.stroke();
      }

      // Plaza crisp perimeter border
      ctx.strokeStyle = 'rgba(28, 25, 23, 0.9)';
      ctx.lineWidth = scaleDist(1.0);
      ctx.strokeRect(plazaX + scaleDist(0.5), plazaY + scaleDist(0.5), plazaW - scaleDist(1), plazaH - scaleDist(1));
    }

    // --- PASS 5: Erase Road Canvas Beneath All Solid Structures ---
    // Guarantees zero road textures or curb outlines ever pass beneath any building or lair
    for (const b of state.buildings) {
      if (b.type === 'marketplace' || b.type === 'statue_king') continue;
      const marginPx = scaleDist(0.5);
      const bx = toCanvasX(b.x * ts) + marginPx;
      const by = toCanvasY(b.y * ts) + marginPx;
      const bw = scaleDist(b.width * ts) - marginPx * 2;
      const bh = scaleDist(b.height * ts) - marginPx * 2;
      if (bw > 0 && bh > 0) {
        ctx.clearRect(bx, by, bw, bh);
      }
    }
    for (const l of state.lairs) {
      const marginPx = scaleDist(0.5);
      const lx = toCanvasX(l.x * ts) + marginPx;
      const ly = toCanvasY(l.y * ts) + marginPx;
      const lw = scaleDist(l.width * ts) - marginPx * 2;
      const lh = scaleDist(l.height * ts) - marginPx * 2;
      if (lw > 0 && lh > 0) {
        ctx.clearRect(lx, ly, lw, lh);
      }
    }

    // 4. Update Street Lamps along roads, plazas, and building entrances
    // Dispose removed lamps (frees GPU memory) and drop their cached glow materials.
    // Bridge lanterns live in terrainGroup and persist — keep those entries.
    for (const child of [...this.streetLampsGroup.children]) {
      this.streetLampsGroup.remove(child);
      this.disposeObjectTree(child);
    }
    this.lampGlowMats = this.lampGlowMats.filter(e => e.root.parent !== this.streetLampsGroup && e.root.parent !== null);
    this.streetLampsList = [];

    // Re-register bridge lanterns for dynamic day/night illumination
    for (const feat of this.terrainFeaturesList) {
      if (feat.name === 'bridgeMesh') {
        this.streetLampsList.push(feat);
      }
    }

    const lampCoords: [number, number][] = [
      // Palace Plaza 4 corners
      [palaceCenterX - 24, palaceGateZ],
      [palaceCenterX + 24, palaceGateZ],
      [palaceCenterX - 24, palaceGateZ + 24],
      [palaceCenterX + 24, palaceGateZ + 24],
      // Royal Avenue lanterns
      [palaceCenterX + 9, palaceGateZ + 42],
      [palaceCenterX - 9, palaceGateZ + 58]
    ];

    // Building entrance doorstep lanterns
    for (const ap of buildingAprons) {
      lampCoords.push([ap.x + 7, ap.z]);
    }

    for (const [lx, lz] of lampCoords) {
      const lamp = this.create3DStreetLampMesh();
      const ly = this.getTerrainHeight(lx, lz);
      lamp.position.set(lx, ly, lz);
      this.streetLampsGroup.add(lamp);
      this.streetLampsList.push(lamp);
    }

    this.roadTexture.needsUpdate = true;

    // Gradually elevate and ramp the 3D road mesh surface as paths lead into building platform entrances
    this.updateRoadMeshElevation(state);
  }

  private updateRoadMeshElevation(state: GameState) {
    if (!this.roadsMesh) return;
    const posAttr = this.roadsMesh.geometry.attributes.position;
    const ts = this.gridManager.tileSize;
    const w = this.gridManager.width;
    const h = this.gridManager.height;

    // Collect all building entrance coordinates and target floor heights
    const entranceElevations: { x: number; z: number; targetY: number; radius: number }[] = [];

    for (const b of state.buildings) {
      const px = (b.x + b.width / 2) * ts;
      const pz = (b.y + b.height / 2) * ts;
      const groundY = this.getTerrainHeight(px, pz);
      const platformTop = groundY + 0.1;
      const halfW = (b.width * ts) / 2;
      const halfH = (b.height * ts) / 2;

      let entranceX = px;
      let entranceZ = pz + halfH + 2;
      const facing = b.facing || 'south';
      if (facing === 'north') entranceZ = pz - halfH - 2;
      else if (facing === 'east') { entranceX = px + halfW + 2; entranceZ = pz; }
      else if (facing === 'west') { entranceX = px - halfW - 2; entranceZ = pz; }

      entranceElevations.push({
        x: entranceX,
        z: entranceZ,
        targetY: platformTop,
        radius: 20.0
      });
    }

    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i) + (w * ts) / 2;
      const vz = posAttr.getZ(i) + (h * ts) / 2;
      let baseVy = this.getTerrainHeight(vx, vz) + 0.06;

      for (const ent of entranceElevations) {
        const dist = Math.hypot(vx - ent.x, vz - ent.z);
        if (dist < ent.radius) {
          // Smooth cosine curve from ambient road height up to the building doorstep
          const factor = (1 + Math.cos((dist / ent.radius) * Math.PI)) / 2;
          baseVy = THREE.MathUtils.lerp(baseVy, ent.targetY, factor);
        }
      }

      posAttr.setY(i, baseVy);
    }

    posAttr.needsUpdate = true;
    this.roadsMesh.geometry.computeVertexNormals();
  }

  private create3DGrassTuftMesh(variant: number): THREE.Group {
    const tuft = new THREE.Group();

    // Try loading Kenney 3D Grass / Bush Model
    const gltfBush = ModelRegistry.getInstance().getBushOrGrassModel(variant);
    if (gltfBush) {
      const box = new THREE.Box3().setFromObject(gltfBush);
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);

      const targetHeight = 3.6;
      const scale = size.y > 0 ? targetHeight / size.y : 1.0;

      gltfBush.scale.set(scale, scale, scale);
      gltfBush.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
      tuft.add(gltfBush);
      return tuft;
    }
    return tuft;
  }

  private create3DWildflowerMesh(type: number): THREE.Group {
    const group = new THREE.Group();

    // Try loading Kenney 3D Flower / Mushroom Model
    const gltfFlora = ModelRegistry.getInstance().getFloraModel(type);
    if (gltfFlora) {
      const box = new THREE.Box3().setFromObject(gltfFlora);
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);

      const targetHeight = 3.2;
      const scale = size.y > 0 ? targetHeight / size.y : 1.0;

      gltfFlora.scale.set(scale, scale, scale);
      gltfFlora.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
      group.add(gltfFlora);
      return group;
    }
    return group;
  }

  private create3DRiverPebbleMesh(): THREE.Group {
    const group = new THREE.Group();
    const pebbleMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.7 });
    const mossMat = new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.9 });

    const p1 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2, 0), pebbleMat);
    p1.scale.set(1.4, 0.7, 1.1);
    p1.position.set(0, 0.4, 0);
    group.add(p1);

    const p2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8, 0), mossMat);
    p2.scale.set(1.2, 0.6, 1.0);
    p2.position.set(1.2, 0.3, 0.6);
    group.add(p2);

    return group;
  }

  private create3DTreeMesh(variant: number): THREE.Group {
    const tree = new THREE.Group();

    // Try loading Kenney 3D Tree Model
    const gltfTree = ModelRegistry.getInstance().getTreeModel(variant);
    if (gltfTree) {
      const box = new THREE.Box3().setFromObject(gltfTree);
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);

      const targetHeight = variant === 1 ? 24.0 : 20.0;
      const scale = size.y > 0 ? targetHeight / size.y : 1.0;

      gltfTree.scale.set(scale, scale, scale);
      gltfTree.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
      tree.add(gltfTree);
      return tree;
    }

    return tree;
  }

  // --- BUILD SELECTION HIGHLIGHT MESHES ---
  private buildSelectionMeshes() {
    this.selectionGroup.clear();
    this.selectionGroup.visible = false;
  }

  // --- PROCEDURAL CELESTIAL TEXTURES ---
  private createSunCoronaTexture(): THREE.CanvasTexture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const center = size / 2;

    const grad = ctx.createRadialGradient(center, center, 0, center, center, center);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.2, 'rgba(254, 240, 138, 0.85)');
    grad.addColorStop(0.5, 'rgba(245, 158, 11, 0.45)');
    grad.addColorStop(0.8, 'rgba(234, 88, 12, 0.12)');
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }

  private createMoonGlowTexture(): THREE.CanvasTexture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const center = size / 2;

    const grad = ctx.createRadialGradient(center, center, 0, center, center, center);
    grad.addColorStop(0.0, 'rgba(240, 246, 255, 1.0)');
    grad.addColorStop(0.25, 'rgba(199, 210, 254, 0.75)');
    grad.addColorStop(0.55, 'rgba(129, 140, 248, 0.35)');
    grad.addColorStop(0.85, 'rgba(99, 102, 241, 0.08)');
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }

  // --- BUILD CELESTIAL SYSTEM (Sun, Moon, Twinkling Starfield) ---
  private buildCelestialSystem() {
    this.celestialGroup.clear();

    // 1. Radiant Glowing Sun
    this.sunObject = new THREE.Group();
    const sunGeo = new THREE.SphereGeometry(38, 24, 24);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfffbeb, fog: false });
    this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
    this.sunObject.add(this.sunMesh);

    const sunCoronaTex = this.createSunCoronaTexture();
    const sunCoronaMat = new THREE.SpriteMaterial({
      map: sunCoronaTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false
    });
    this.sunCorona = new THREE.Sprite(sunCoronaMat);
    this.sunCorona.scale.set(220, 220, 1);
    this.sunObject.add(this.sunCorona);
    this.celestialGroup.add(this.sunObject);

    // 2. Luminous Silver Moon
    this.moonObject = new THREE.Group();
    const moonGeo = new THREE.SphereGeometry(30, 24, 24);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xe0e7ff, fog: false });
    this.moonMesh = new THREE.Mesh(moonGeo, moonMat);
    this.moonObject.add(this.moonMesh);

    const moonGlowTex = this.createMoonGlowTexture();
    const moonGlowMat = new THREE.SpriteMaterial({
      map: moonGlowTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false
    });
    this.moonGlow = new THREE.Sprite(moonGlowMat);
    this.moonGlow.scale.set(170, 170, 1);
    this.moonObject.add(this.moonGlow);
    this.celestialGroup.add(this.moonObject);

    // 3. Glittering Night Starfield Dome (800 Stars)
    const starCount = 800;
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    this.starTwinklePhases = new Float32Array(starCount);

    const starPalettes = [
      new THREE.Color(0xffffff),
      new THREE.Color(0xfef08a),
      new THREE.Color(0x93c5fd),
      new THREE.Color(0xc4b5fd),
      new THREE.Color(0x6ee7b7)
    ];

    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2; // azimuth
      const phi = 0.08 + Math.random() * (Math.PI * 0.44); // elevation above horizon
      const radius = 1700 + Math.random() * 400;

      const x = radius * Math.cos(theta) * Math.sin(phi);
      const y = radius * Math.cos(phi);
      const z = radius * Math.sin(theta) * Math.sin(phi);

      starPositions[i * 3] = x;
      starPositions[i * 3 + 1] = y;
      starPositions[i * 3 + 2] = z;

      const col = starPalettes[Math.floor(Math.random() * starPalettes.length)];
      starColors[i * 3] = col.r;
      starColors[i * 3 + 1] = col.g;
      starColors[i * 3 + 2] = col.b;

      this.starTwinklePhases[i] = Math.random() * Math.PI * 2;
    }

    const starsGeo = new THREE.BufferGeometry();
    starsGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starsGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    const starsMat = new THREE.PointsMaterial({
      size: 4.5,
      vertexColors: true,
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false
    });

    this.starsPoints = new THREE.Points(starsGeo, starsMat);
    this.celestialGroup.add(this.starsPoints);
  }

  // --- BUILD 3D FOG OF WAR SHROUD (Continuous Displaced Mesh with Smooth Alpha Texture) ---
  private buildFogOfWar() {
    const ts = this.gridManager.tileSize;
    const w = this.gridManager.width;
    const h = this.gridManager.height;
    const segmentsX = w * 2;
    const segmentsZ = h * 2;

    const fogGeo = new THREE.PlaneGeometry(w * ts, h * ts, segmentsX, segmentsZ);
    fogGeo.rotateX(-Math.PI / 2);

    const posAttr = fogGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i) + (w * ts) / 2;
      const vz = posAttr.getZ(i) + (h * ts) / 2;
      const vy = this.getTerrainHeight(vx, vz) + 1.2;
      posAttr.setY(i, vy);
    }
    fogGeo.computeVertexNormals();

    const fogMat = new THREE.MeshBasicMaterial({
      map: this.fogTexture,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide
    });

    this.fogMesh = new THREE.Mesh(fogGeo, fogMat);
    this.fogMesh.position.set((w * ts) / 2, 0, (h * ts) / 2);
    this.fogMesh.renderOrder = 999;
    this.fogGroup.add(this.fogMesh);
  }

  private updateFogOfWar(state: GameState) {
    const ctx = this.fogCtx;
    const canvasSize = 512;
    const w = this.gridManager.width;
    const h = this.gridManager.height;
    const scaleX = canvasSize / w;
    const scaleY = canvasSize / h;
    const cellW = Math.ceil(scaleX);
    const cellH = Math.ceil(scaleY);

    // 1. Fill canvas with 100% solid pitch-black unexplored shroud
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // 2. Draw explored (but not currently visible) areas in a single pass.
    // Explored + visible tiles are skipped here and punched out in step 3.
    ctx.fillStyle = 'rgba(9, 13, 22, 0.48)';
    const explored = this.gridManager.explored;
    const visible = this.gridManager.visible;
    for (let y = 0; y < h; y++) {
      const expRow = explored[y];
      const visRow = visible[y];
      if (!expRow) continue;
      for (let x = 0; x < w; x++) {
        if (expRow[x] && !(visRow && visRow[x])) {
          ctx.fillRect(x * scaleX, y * scaleY, cellW, cellH);
        }
      }
    }

    // 3. Punch out currently-visible tiles. Plain rects (no per-tile radial gradients:
    // thousands of gradient allocations per repaint was the bottleneck); the texture
    // is sampled with linear filtering so edges stay soft on the 3D shroud.
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000000';
    for (let y = 0; y < h; y++) {
      const visRow = visible[y];
      if (!visRow) continue;
      for (let x = 0; x < w; x++) {
        if (visRow[x]) {
          ctx.fillRect(x * scaleX, y * scaleY, cellW, cellH);
        }
      }
    }
    ctx.restore();

    this.fogTexture.needsUpdate = true;

    // 4. Update terrain feature visibility (trees, rocks, bridges, street lamps)
    for (const feat of this.terrainFeaturesList) {
      const { tx, ty } = feat.userData;
      feat.visible = (this.gridManager.explored[ty]?.[tx]) || false;
    }

    for (const lamp of this.streetLampsList) {
      const tx = Math.floor(lamp.position.x / this.gridManager.tileSize);
      const ty = Math.floor(lamp.position.z / this.gridManager.tileSize);
      lamp.visible = (this.gridManager.explored[ty]?.[tx]) || false;
    }
  }

  private updateCamera(state: GameState, delta: number = 0.016) {
    // Smooth responsive spring damping for camera zoom
    const zoomLerpSpeed = Math.min(1.0, 20.0 * delta);
    this.cameraDistance += (this.targetCameraDistance - this.cameraDistance) * zoomLerpSpeed;
    if (Math.abs(this.targetCameraDistance - this.cameraDistance) < 0.1) {
      this.cameraDistance = this.targetCameraDistance;
    }

    if (this.cameraMode === 'follow' && state.selectedEntity?.type === 'hero') {
      const hero = state.heroes.find(h => h.id === state.selectedEntity?.id);
      if (hero) {
        const hy = this.getTerrainHeight(hero.x, hero.y);
        this.cameraTarget.set(hero.x, hy, hero.y);
      }
    } else {
      const cy = this.getTerrainHeight(state.camera.x, state.camera.y);
      this.cameraTarget.set(state.camera.x, cy, state.camera.y);
    }

    const cosPitch = Math.cos(this.cameraPitch);
    const sinPitch = Math.sin(this.cameraPitch);
    const sinYaw = Math.sin(this.cameraYaw);
    const cosYaw = Math.cos(this.cameraYaw);

    const dist = this.cameraDistance;
    state.camera.zoom = 380 / dist;
    state.camera.yaw = this.cameraYaw;
    state.camera.pitch = this.cameraPitch;

    const camX = this.cameraTarget.x + dist * cosPitch * sinYaw;
    const camY = this.cameraTarget.y + dist * sinPitch;
    const camZ = this.cameraTarget.z + dist * cosPitch * cosYaw;

    this.camera.position.set(camX, camY, camZ);
    this.camera.lookAt(this.cameraTarget);
  }

  private dayNightKeyframes = [
    {
      t: 0.0, // Midnight (Luminous soft moonlight, starry sky)
      sunColor: new THREE.Color(0xc7d2fe),
      sunIntensity: 0.65,
      ambientColor: new THREE.Color(0x1e293b),
      ambientIntensity: 0.46,
      hemiSky: new THREE.Color(0x334155),
      hemiGround: new THREE.Color(0x0f172a),
      skyColor: new THREE.Color('#070b14'),
      fogColor: new THREE.Color('#070b14')
    },
    {
      t: 0.16, // 3:50 AM - Soft Night
      sunColor: new THREE.Color(0xc7d2fe),
      sunIntensity: 0.68,
      ambientColor: new THREE.Color(0x1e293b),
      ambientIntensity: 0.48,
      hemiSky: new THREE.Color(0x334155),
      hemiGround: new THREE.Color(0x0f172a),
      skyColor: new THREE.Color('#0a1020'),
      fogColor: new THREE.Color('#0a1020')
    },
    {
      t: 0.22, // 5:15 AM - Early Dawn (Soft golden & lavender morning glow)
      sunColor: new THREE.Color(0xfde68a),
      sunIntensity: 1.05,
      ambientColor: new THREE.Color(0x78350f),
      ambientIntensity: 0.55,
      hemiSky: new THREE.Color(0xfba55d),
      hemiGround: new THREE.Color(0x334155),
      skyColor: new THREE.Color('#1e1b4b'),
      fogColor: new THREE.Color('#2e1065')
    },
    {
      t: 0.28, // 6:45 AM - Bright Morning Sun
      sunColor: new THREE.Color(0xfef08a),
      sunIntensity: 1.35,
      ambientColor: new THREE.Color(0xfef08a),
      ambientIntensity: 0.68,
      hemiSky: new THREE.Color(0xbae6fd),
      hemiGround: new THREE.Color(0x475569),
      skyColor: new THREE.Color('#1e40af'),
      fogColor: new THREE.Color('#38bdf8')
    },
    {
      t: 0.35, // 8:24 AM - Radiant Morning Daylight
      sunColor: new THREE.Color(0xfffbeb),
      sunIntensity: 1.45,
      ambientColor: new THREE.Color(0xffffff),
      ambientIntensity: 0.72,
      hemiSky: new THREE.Color(0xbfdbfe),
      hemiGround: new THREE.Color(0x475569),
      skyColor: new THREE.Color('#0284c7'),
      fogColor: new THREE.Color('#7dd3fc')
    },
    {
      t: 0.50, // 12:00 PM - High Noon (Peak Daylight)
      sunColor: new THREE.Color(0xffffff),
      sunIntensity: 1.50,
      ambientColor: new THREE.Color(0xffffff),
      ambientIntensity: 0.75,
      hemiSky: new THREE.Color(0xbfdbfe),
      hemiGround: new THREE.Color(0x475569),
      skyColor: new THREE.Color('#0284c7'),
      fogColor: new THREE.Color('#38bdf8')
    },
    {
      t: 0.68, // 4:20 PM - Warm Golden Afternoon
      sunColor: new THREE.Color(0xfef08a),
      sunIntensity: 1.40,
      ambientColor: new THREE.Color(0xfde68a),
      ambientIntensity: 0.70,
      hemiSky: new THREE.Color(0xfed7aa),
      hemiGround: new THREE.Color(0x475569),
      skyColor: new THREE.Color('#0369a1'),
      fogColor: new THREE.Color('#60a5fa')
    },
    {
      t: 0.78, // 6:45 PM - Sunset (Warm Amber / Crimson Sky)
      sunColor: new THREE.Color(0xf59e0b),
      sunIntensity: 1.15,
      ambientColor: new THREE.Color(0x78350f),
      ambientIntensity: 0.58,
      hemiSky: new THREE.Color(0xf97316),
      hemiGround: new THREE.Color(0x334155),
      skyColor: new THREE.Color('#7c2d12'),
      fogColor: new THREE.Color('#9a3412')
    },
    {
      t: 0.85, // 8:24 PM - Dusk / Twilight
      sunColor: new THREE.Color(0x60a5fa),
      sunIntensity: 0.80,
      ambientColor: new THREE.Color(0x1e293b),
      ambientIntensity: 0.50,
      hemiSky: new THREE.Color(0x334155),
      hemiGround: new THREE.Color(0x1e293b),
      skyColor: new THREE.Color('#1e1b4b'),
      fogColor: new THREE.Color('#172554')
    },
    {
      t: 0.92, // 10:00 PM - Nightfall (Clear Soft Moonlight)
      sunColor: new THREE.Color(0xc7d2fe),
      sunIntensity: 0.65,
      ambientColor: new THREE.Color(0x1e293b),
      ambientIntensity: 0.46,
      hemiSky: new THREE.Color(0x334155),
      hemiGround: new THREE.Color(0x0f172a),
      skyColor: new THREE.Color('#070b14'),
      fogColor: new THREE.Color('#070b14')
    },
    {
      t: 1.0, // Midnight Wrap
      sunColor: new THREE.Color(0xc7d2fe),
      sunIntensity: 0.65,
      ambientColor: new THREE.Color(0x1e293b),
      ambientIntensity: 0.46,
      hemiSky: new THREE.Color(0x334155),
      hemiGround: new THREE.Color(0x0f172a),
      skyColor: new THREE.Color('#070b14'),
      fogColor: new THREE.Color('#070b14')
    }
  ];

  private updateDayNightLighting(state: GameState) {
    const t = (((state.stats.dayTime % 2400) + 2400) % 2400) / 2400; // 0.0 to 1.0
    const sunAngle = (t - 0.25) * Math.PI * 2;
    const sinAngle = Math.sin(sunAngle);

    // 1. Celestial Sky Spheres & Orbits (Sun, Moon, Stars)
    const skyRadius = 1600;
    const skyHeight = 1200;
    const skyDepth = 480;

    const sunX = Math.cos(sunAngle) * skyRadius;
    const sunY = sinAngle * skyHeight;
    const sunZ = Math.sin(sunAngle * 0.5) * skyDepth;

    const moonX = -sunX;
    const moonY = -sunY;
    const moonZ = -sunZ;

    // Anchor celestial dome directly above camera target so it covers the sky
    this.celestialGroup.position.set(this.cameraTarget.x, this.cameraTarget.y, this.cameraTarget.z);

    if (this.sunObject) {
      this.sunObject.position.set(sunX, sunY, sunZ);
      this.sunObject.visible = sunY > -180;
      if (this.sunCorona) {
        this.sunCorona.material.opacity = Math.max(0, Math.min(1.0, (sunY + 120) / 320));
      }
    }

    if (this.moonObject) {
      this.moonObject.position.set(moonX, moonY, moonZ);
      this.moonObject.visible = moonY > -180;
      if (this.moonGlow) {
        this.moonGlow.material.opacity = Math.max(0, Math.min(1.0, (moonY + 120) / 320));
      }
    }

    if (this.starsPoints) {
      const starOpacity = Math.max(0, Math.min(1.0, (180 - sunY) / 450));
      (this.starsPoints.material as THREE.PointsMaterial).opacity = starOpacity;
    }

    // 2. Smooth Continuous Directional Light Orbit (Zero Discontinuous Flips)
    const sunLightDist = 650;
    const rawSunX = Math.cos(sunAngle) * sunLightDist;
    const rawSunY = sinAngle * sunLightDist;
    const rawSunZ = Math.sin(sunAngle * 0.5) * 180;

    // Smooth day/night blend factor across horizon (-0.12 to +0.12)
    const dayBlend = THREE.MathUtils.smoothstep(sinAngle, -0.12, 0.12);

    const sunLightX = rawSunX;
    const sunLightY = Math.max(70, rawSunY);
    const sunLightZ = rawSunZ;

    const moonLightX = -rawSunX;
    const moonLightY = Math.max(75, -rawSunY);
    const moonLightZ = -rawSunZ;

    const lightPosX = THREE.MathUtils.lerp(moonLightX, sunLightX, dayBlend);
    const lightPosY = THREE.MathUtils.lerp(moonLightY, sunLightY, dayBlend);
    const lightPosZ = THREE.MathUtils.lerp(moonLightZ, sunLightZ, dayBlend);

    const shadowD = 600;
    const texelWorldSize = (shadowD * 2) / 4096;
    const snappedTargetX = Math.round(this.cameraTarget.x / texelWorldSize) * texelWorldSize;
    const snappedTargetZ = Math.round(this.cameraTarget.z / texelWorldSize) * texelWorldSize;

    this.dirLight.target.position.set(snappedTargetX, 0, snappedTargetZ);
    this.dirLight.position.set(lightPosX + snappedTargetX, lightPosY, lightPosZ + snappedTargetZ);
    this.dirLight.target.updateMatrixWorld();
    this.dirLight.updateMatrixWorld();

    // Find bounding keyframes
    const kfs = this.dayNightKeyframes;
    let k1 = kfs[0];
    let k2 = kfs[kfs.length - 1];
    for (let i = 0; i < kfs.length - 1; i++) {
      if (t >= kfs[i].t && t <= kfs[i + 1].t) {
        k1 = kfs[i];
        k2 = kfs[i + 1];
        break;
      }
    }

    const range = k2.t - k1.t;
    const alpha = range > 0.0001 ? (t - k1.t) / range : 0;

    // Smooth continuous color & intensity interpolation
    this.dirLight.color.copy(k1.sunColor).lerp(k2.sunColor, alpha);
    this.dirLight.intensity = THREE.MathUtils.lerp(k1.sunIntensity, k2.sunIntensity, alpha);

    this.ambientLight.color.copy(k1.ambientColor).lerp(k2.ambientColor, alpha);
    this.ambientLight.intensity = THREE.MathUtils.lerp(k1.ambientIntensity, k2.ambientIntensity, alpha);

    this.hemiLight.color.copy(k1.hemiSky).lerp(k2.hemiSky, alpha);
    this.hemiLight.groundColor.copy(k1.hemiGround).lerp(k2.hemiGround, alpha);

    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.copy(k1.skyColor).lerp(k2.skyColor, alpha);
    }
    if (this.scene.fog) {
      this.scene.fog.color.copy(k1.fogColor).lerp(k2.fogColor, alpha);
    }

    // Dynamic Street & Bridge Lamps Illumination at Dusk & Night
    // Lamp glow uses cached materials (no per-frame subtree traverses) and updates at
    // ~5Hz — emissive flicker doesn't need 60fps precision.
    const nowMs = performance.now();
    if (nowMs - this.lastLampUpdate > 200) {
      this.lastLampUpdate = nowMs;
      const isNightOrDusk = t > 0.76 || t < 0.25;
      const flicker = Math.sin(nowMs * 0.005) * 0.4;
      for (const entry of this.lampGlowMats) {
        if (entry.ember) entry.ember.emissiveIntensity = isNightOrDusk ? 3.0 + flicker : 0.2;
        if (entry.cage) entry.cage.emissiveIntensity = isNightOrDusk ? 1.4 : 0.1;
        if (entry.puddle) entry.puddle.opacity = isNightOrDusk ? 0.32 : 0.0;
      }
    }
  }

  /**
   * Cached child lookup. getObjectByName() traverses the whole subtree, and the per-frame
   * update methods were calling it several times per entity per frame (hundreds of
   * traversals at 60fps). Results are cached per group; groups are recreated (not mutated)
   * when their structure changes, so the cache never goes stale.
   */
  private getPart(group: THREE.Object3D, name: string): THREE.Object3D | undefined {
    const userData = group.userData as { partCache?: Map<string, THREE.Object3D | undefined> };
    let cache = userData.partCache;
    if (!cache) {
      cache = new Map();
      userData.partCache = cache;
    }
    if (!cache.has(name)) {
      cache.set(name, group.getObjectByName(name));
    }
    return cache.get(name) ?? undefined;
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

    this.updateCamera(state, delta);
    this.updateDayNightLighting(state);

    // Fog of war only repaints at ~7Hz — vision changes slowly and a full grid
    // repaint + 512px texture upload every frame is pure waste.
    if (now - this.lastFogUpdate > 140) {
      this.lastFogUpdate = now;
      this.updateFogOfWar(state);
    }

    // Update curved terrain under buildings whenever structures change (only when added/removed).
    // The hash string is rebuilt at ~4Hz instead of every frame (string allocs at 60fps).
    if (now - this.lastStructCheck > 250) {
      this.lastStructCheck = now;
      const structHash = state.buildings.map(b => `${b.id}_${b.x}_${b.y}_${b.width}_${b.height}_${b.hp > 0}`).join('|') + ';' + state.lairs.map(l => `${l.id}_${l.x}_${l.y}_${l.width}_${l.height}_${l.hp > 0}`).join('|');
      if (structHash !== this.lastStructureHash) {
        this.lastStructureHash = structHash;
        this.lastKnownStructures = [
          ...state.buildings.filter(b => b.hp > 0),
          ...state.lairs.filter(l => l.hp > 0 && l.type !== 'sewer_grate')
        ];
        this.updateTerrainMeshHeights();
      }
    }

    this.updateTerrainRoads(state);

    // Real-Time Flowing Water & Cascading Waterfall Animation
    if (this.riverTexture) {
      this.riverTexture.offset.y -= delta * 0.45;
      this.riverTexture.offset.x = Math.sin(now * 0.002) * 0.03;
    }
    if (this.waterfallTexture) {
      this.waterfallTexture.offset.y -= delta * 1.85;
    }

    // Animate waterfall splash foam & rising mist spray
    for (const wf of this.waterfallsList) {
      const splash = this.getPart(wf, 'waterfallSplash');
      if (splash) {
        splash.scale.setScalar(1.0 + Math.sin(now * 0.008) * 0.12);
      }
      const mistGroup = this.getPart(wf, 'mistGroup');
      if (mistGroup) {
        mistGroup.children.forEach((puff, idx) => {
          if (puff instanceof THREE.Mesh) {
            const phase = (now * 0.003 + idx * 0.8) % 2.0;
            puff.position.y = phase * 3.5;
            puff.position.x = Math.sin(phase * 3.0 + idx) * 2.0;
            puff.scale.setScalar(0.8 + phase * 0.8);
            if (puff.material instanceof THREE.Material) {
              puff.material.opacity = Math.max(0, 0.35 * (1.0 - phase / 2.0));
            }
          }
        });
      }
    }

    this.updateBuildings(state);
    this.updateLairs(state);
    this.updatePointsOfInterest(state);
    this.updateTreasures(state);
    this.updateFlags(state);
    this.updateTaxCollectors(state, delta);
    this.updatePeasants(state, delta);
    this.updateHeroes(state, delta);
    this.updateMonsters(state, delta);
    this.updateCorpses(state);
    this.updateProjectiles(state);
    this.updateFloatingTexts(state);
    this.updateSleepingAnimations(state, delta);

    // Update Selection Visuals
    this.updateSelectionVisuals(state);

    // Update Placement Preview Hover Hologram
    this.updatePlacementPreview(state, mouseWorldPos);

    // Update active skeletal character animation mixers
    for (const ctrl of this.animControllers.values()) {
      ctrl.update(delta);
    }

    this.renderer.render(this.scene, this.camera);
  }

  // --- SELECTION HIGHLIGHT (Conforms smoothly to 3D uneven ground contours) ---
  private currentSelectionKey: string = '';

  private updateSelectionVisuals(state: GameState) {
    if (!state.selectedEntity) {
      this.selectionGroup.visible = false;
      this.currentSelectionKey = '';
      return;
    }

    const ts = this.gridManager.tileSize;
    let entityX = 0;
    let entityZ = 0;
    let colorHex = 0x38bdf8;
    let isStructure = false;
    let halfW = 10;
    let halfH = 10;
    let radius = 4.5;

    if (state.selectedEntity.type === 'building') {
      const b = state.buildings.find(build => build.id === state.selectedEntity?.id);
      if (!b) return;
      entityX = (b.x + b.width / 2) * ts;
      entityZ = (b.y + b.height / 2) * ts;
      halfW = (b.width * ts) / 2 + 1.2;
      halfH = (b.height * ts) / 2 + 1.2;
      colorHex = 0xfbbf24;
      isStructure = true;
    } else if (state.selectedEntity.type === 'lair') {
      const l = state.lairs.find(lair => lair.id === state.selectedEntity?.id);
      if (!l) return;
      entityX = (l.x + l.width / 2) * ts;
      entityZ = (l.y + l.height / 2) * ts;
      halfW = (l.width * ts) / 2 + 1.2;
      halfH = (l.height * ts) / 2 + 1.2;
      colorHex = 0xf43f5e;
      isStructure = true;
    } else if (state.selectedEntity.type === 'hero') {
      const h = state.heroes.find(hero => hero.id === state.selectedEntity?.id);
      if (!h) return;
      entityX = h.x;
      entityZ = h.y;
      colorHex = 0x38bdf8;
      radius = 4.5;
    } else if (state.selectedEntity.type === 'monster') {
      const m = state.monsters.find(mon => mon.id === state.selectedEntity?.id);
      if (!m) return;
      entityX = m.x;
      entityZ = m.y;
      colorHex = 0xf43f5e;
      if (m.type === 'red_dragon') radius = 18;
      else if (m.type === 'minotaur') radius = 8;
      else if (m.type === 'vampire_lord') radius = 9;
      else if (m.type === 'troll') radius = 8;
      else if (m.type === 'dire_wolf') radius = 5.5;
      else if (m.type === 'werewolf') radius = 6.5;
      else if (m.type === 'giant_rat') radius = 3.2;
      else radius = 4.5;
    } else if (state.selectedEntity.type === 'tax_collector') {
      const tc = state.taxCollectors.find(collector => collector.id === state.selectedEntity?.id);
      if (!tc) return;
      entityX = tc.x;
      entityZ = tc.y;
      colorHex = 0xc084fc;
      radius = 4.5;
    } else if (state.selectedEntity.type === 'peasant') {
      const p = state.peasants.find(peasant => peasant.id === state.selectedEntity?.id);
      if (!p) return;
      entityX = p.x;
      entityZ = p.y;
      colorHex = 0xf59e0b;
      radius = 4.2;
    } else if (state.selectedEntity.type === 'corpse') {
      const c = state.corpses.find(corpse => corpse.id === state.selectedEntity?.id);
      if (!c) return;
      entityX = c.x;
      entityZ = c.y;
      colorHex = 0xf59e0b;
      radius = 5.2;
    }

    const groundY = this.getTerrainHeight(entityX, entityZ);
    this.selectionGroup.position.set(entityX, groundY, entityZ);
    this.selectionGroup.visible = true;

    const key = `${state.selectedEntity.type}_${state.selectedEntity.id}_${Math.round(entityX)}_${Math.round(entityZ)}`;
    if (this.currentSelectionKey === key) return;
    this.currentSelectionKey = key;

    for (const child of [...this.selectionGroup.children]) {
      this.selectionGroup.remove(child);
      this.disposeObjectTree(child);
    }

    if (isStructure) {
      // Densely sample perimeter elevation at 64 points along the 4 edges so the aura strictly hugs the terrain
      const samplePointsPerEdge = 16;
      const outerPoints: THREE.Vector3[] = [];
      const innerPoints: THREE.Vector3[] = [];
      const innerScale = 0.88;

      const addPerimeterPoints = (wHalf: number, hHalf: number, targetArr: THREE.Vector3[], yOffset: number) => {
        // 1. North Edge: (-wHalf, -hHalf) -> (+wHalf, -hHalf)
        for (let i = 0; i < samplePointsPerEdge; i++) {
          const t = i / samplePointsPerEdge;
          const lx = -wHalf + t * (wHalf * 2);
          const lz = -hHalf;
          const ry = this.getTerrainHeight(entityX + lx, entityZ + lz) - groundY + yOffset;
          targetArr.push(new THREE.Vector3(lx, ry, lz));
        }
        // 2. East Edge: (+wHalf, -hHalf) -> (+wHalf, +hHalf)
        for (let i = 0; i < samplePointsPerEdge; i++) {
          const t = i / samplePointsPerEdge;
          const lx = wHalf;
          const lz = -hHalf + t * (hHalf * 2);
          const ry = this.getTerrainHeight(entityX + lx, entityZ + lz) - groundY + yOffset;
          targetArr.push(new THREE.Vector3(lx, ry, lz));
        }
        // 3. South Edge: (+wHalf, +hHalf) -> (-wHalf, +hHalf)
        for (let i = 0; i < samplePointsPerEdge; i++) {
          const t = i / samplePointsPerEdge;
          const lx = wHalf - t * (wHalf * 2);
          const lz = hHalf;
          const ry = this.getTerrainHeight(entityX + lx, entityZ + lz) - groundY + yOffset;
          targetArr.push(new THREE.Vector3(lx, ry, lz));
        }
        // 4. West Edge: (-wHalf, +hHalf) -> (-wHalf, -hHalf)
        for (let i = 0; i < samplePointsPerEdge; i++) {
          const t = i / samplePointsPerEdge;
          const lx = -wHalf;
          const lz = hHalf - t * (hHalf * 2);
          const ry = this.getTerrainHeight(entityX + lx, entityZ + lz) - groundY + yOffset;
          targetArr.push(new THREE.Vector3(lx, ry, lz));
        }
      };

      addPerimeterPoints(halfW, halfH, outerPoints, 0.45);
      addPerimeterPoints(halfW * innerScale, halfH * innerScale, innerPoints, 0.42);

      const outerGeo = new THREE.BufferGeometry().setFromPoints(outerPoints);
      const outerMat = new THREE.LineBasicMaterial({
        color: colorHex,
        linewidth: 3,
        depthTest: true,
        depthWrite: false
      });
      const outerLoop = new THREE.LineLoop(outerGeo, outerMat);
      outerLoop.renderOrder = 999;
      this.selectionGroup.add(outerLoop);

      const innerGeo = new THREE.BufferGeometry().setFromPoints(innerPoints);
      const innerMat = new THREE.LineBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.5,
        linewidth: 2,
        depthTest: true,
        depthWrite: false
      });
      const innerLoop = new THREE.LineLoop(innerGeo, innerMat);
      innerLoop.renderOrder = 999;
      this.selectionGroup.add(innerLoop);

      // 4 Elegant Corner L-Brackets that also conform to ground elevation
      const armLen = Math.min(10, halfW * 0.35);
      const cornerDefs = [
        { cx: -halfW, cz: -halfH, dx: 1, dz: 1 },
        { cx: halfW, cz: -halfH, dx: -1, dz: 1 },
        { cx: -halfW, cz: halfH, dx: 1, dz: -1 },
        { cx: halfW, cz: halfH, dx: -1, dz: -1 }
      ];

      cornerDefs.forEach(({ cx, cz, dx, dz }) => {
        const cPoints: THREE.Vector3[] = [];
        const bracketSteps = 6;
        for (let s = bracketSteps; s >= 0; s--) {
          const lx = cx + dx * (s / bracketSteps) * armLen;
          const lz = cz;
          const ry = this.getTerrainHeight(entityX + lx, entityZ + lz) - groundY + 0.55;
          cPoints.push(new THREE.Vector3(lx, ry, lz));
        }
        for (let s = 1; s <= bracketSteps; s++) {
          const lx = cx;
          const lz = cz + dz * (s / bracketSteps) * armLen;
          const ry = this.getTerrainHeight(entityX + lx, entityZ + lz) - groundY + 0.55;
          cPoints.push(new THREE.Vector3(lx, ry, lz));
        }
        const cGeo = new THREE.BufferGeometry().setFromPoints(cPoints);
        const cMat = new THREE.LineBasicMaterial({
          color: colorHex,
          linewidth: 4,
          depthTest: true,
          depthWrite: false
        });
        const cLine = new THREE.Line(cGeo, cMat);
        cLine.renderOrder = 999;
        this.selectionGroup.add(cLine);
      });
    } else {
      // 3D Conforming Unit Selection Ring (48 sample points around circle perimeter)
      const ringPoints: THREE.Vector3[] = [];
      const steps = 48;
      for (let i = 0; i <= steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const rx = Math.cos(angle) * radius;
        const rz = Math.sin(angle) * radius;
        const ry = this.getTerrainHeight(entityX + rx, entityZ + rz) - groundY + 0.45;
        ringPoints.push(new THREE.Vector3(rx, ry, rz));
      }

      const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPoints);
      const ringMat = new THREE.LineBasicMaterial({
        color: colorHex,
        linewidth: 3,
        depthTest: true,
        depthWrite: false
      });
      const ring = new THREE.LineLoop(ringGeo, ringMat);
      ring.renderOrder = 999;
      this.selectionGroup.add(ring);

      // Inner faint indicator disc
      const innerPoints: THREE.Vector3[] = [];
      for (let i = 0; i <= steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const rx = Math.cos(angle) * (radius * 0.68);
        const rz = Math.sin(angle) * (radius * 0.68);
        const ry = this.getTerrainHeight(entityX + rx, entityZ + rz) - groundY + 0.40;
        innerPoints.push(new THREE.Vector3(rx, ry, rz));
      }
      const innerGeo = new THREE.BufferGeometry().setFromPoints(innerPoints);
      const innerMat = new THREE.LineBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.45,
        depthTest: true,
        depthWrite: false
      });
      const innerRing = new THREE.LineLoop(innerGeo, innerMat);
      innerRing.renderOrder = 999;
      this.selectionGroup.add(innerRing);
    }
  }

  // --- PLACEMENT PREVIEW (HOVER HOLOGRAM & SHADOW) ---
  private clearPreviewGroup() {
    for (const child of [...this.placementPreviewGroup.children]) {
      this.placementPreviewGroup.remove(child);
      this.disposeObjectTree(child);
    }
  }

  private updatePlacementPreview(state: GameState, mouseWorldPos: { x: number; y: number } | null) {
    if (!state.activePlacement || !mouseWorldPos) {
      this.placementPreviewGroup.visible = false;
      this.placementPreviewKey = '';
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

      const px = (tileX + bDef.width / 2) * ts;
      const pz = (tileY + bDef.height / 2) * ts;
      this.placementPreviewGroup.position.set(px, 0, pz);

      // Rebuild preview meshes only when tile/type/validity changes (was: every frame,
      // allocating + uploading new geometries 60×/sec and leaking the old ones).
      const key = `b_${state.activePlacement.subType}_${tileX}_${tileY}_${isValid}`;
      if (key !== this.placementPreviewKey) {
        this.placementPreviewKey = key;
        this.clearPreviewGroup();

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
      }

      this.placementPreviewGroup.visible = true;
    } else if (state.activePlacement.type === 'flag') {
      const flagType = state.activePlacement.subType;
      let targetPos = { x: mouseWorldPos.x, y: mouseWorldPos.y };
      let isValidTarget = true;

      if (flagType === 'attack') {
        const targetMonster = state.monsters.find(m => m.hp > 0 && Math.hypot(m.x - mouseWorldPos.x, m.y - mouseWorldPos.y) < 26);
        const targetLair = state.lairs.find(l => {
          const lx = (l.x + l.width / 2) * ts;
          const ly = (l.y + l.height / 2) * ts;
          return Math.hypot(lx - mouseWorldPos.x, ly - mouseWorldPos.y) < 36;
        });

        if (targetMonster) {
          targetPos = { x: targetMonster.x, y: targetMonster.y };
          isValidTarget = true;
        } else if (targetLair) {
          const lx = (targetLair.x + targetLair.width / 2) * ts;
          const ly = (targetLair.y + targetLair.height / 2) * ts;
          targetPos = { x: lx, y: ly };
          isValidTarget = true;
        } else {
          isValidTarget = false;
        }
      }

      this.placementPreviewGroup.position.set(targetPos.x, 0, targetPos.y);

      const color = flagType === 'attack'
        ? (isValidTarget ? 0xef4444 : 0x475569)
        : (flagType === 'explore' ? 0x3b82f6 : 0xfbbf24);

      const key = `f_${flagType}_${isValidTarget}`;
      if (key !== this.placementPreviewKey) {
        this.placementPreviewKey = key;
        this.clearPreviewGroup();

        const ringGeo = new THREE.RingGeometry(isValidTarget ? 2 : 8, 20, 24);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
          color,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: isValidTarget ? 0.75 : 0.35
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.y = 0.8;
        this.placementPreviewGroup.add(ring);
      }
      this.placementPreviewGroup.visible = true;
    } else if (state.activePlacement.type === 'spell') {
      this.placementPreviewGroup.position.set(mouseWorldPos.x, 0, mouseWorldPos.y);

      const key = `s_${state.activePlacement.subType}`;
      if (key !== this.placementPreviewKey) {
        this.placementPreviewKey = key;
        this.clearPreviewGroup();

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
      }
      this.placementPreviewGroup.visible = true;
    }
  }

  // --- 3D BUILDINGS ---
  private updateBuildings(state: GameState) {
    const activeIds = new Set<string>();
    const time = Date.now() * 0.003;

    for (const b of state.buildings) {
      activeIds.add(b.id);
      const isBlueprint = b.isConstructing && b.constructionProgress <= 0;
      const isUpgrading = (b.researchQueue && b.researchQueue.length > 0 && b.researchQueue.some(r => r.isBuildingUpgrade)) || false;
      const constrStage = isBlueprint ? 0 : Math.min(3, Math.max(1, Math.ceil(b.constructionProgress / 33.3)));
      const stateKey = `${b.id}_${isBlueprint ? 'blueprint' : (b.isConstructing ? `building_s${constrStage}` : (isUpgrading ? 'upgrading' : 'done'))}_lvl${b.level}`;
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

      // Animate construction crane and hoist if castle is upgrading or site is under construction
      const craneArm = this.getPart(group, 'craneArm');
      const hoistBucket = this.getPart(group, 'hoistBucket');
      if (craneArm) {
        craneArm.rotation.y = Math.sin(time * 1.2) * 0.45;
      }
      if (hoistBucket) {
        const baseY = hoistBucket.userData.baseY !== undefined ? hoistBucket.userData.baseY : -14;
        hoistBucket.position.y = baseY + Math.sin(time * 1.8) * 2.0;
      }

      // Animate hovering beacon crystal on upgraded Palace
      const beacon = this.getPart(group, 'beaconCrystal');
      if (beacon) {
        beacon.rotation.y = time * 1.8;
        const baseY = beacon.userData.baseY || beacon.position.y;
        beacon.position.y = baseY + Math.sin(time * 2.2) * 0.9;
      }

      // Animate smoke particles in chimneys, campfires & forges
      const smokeEmitter = this.getPart(group, 'smokeEmitter');
      if (smokeEmitter) {
        const smokeTime = Date.now() * 0.0018;
        smokeEmitter.children.forEach((puff, idx) => {
          if (puff instanceof THREE.Mesh) {
            const initialPhase = puff.userData.phase !== undefined ? puff.userData.phase : idx * 0.75;
            const cycle = (smokeTime + initialPhase) % 3.0; // 0 to 3s cycle
            puff.position.y = cycle * 5.2;
            puff.position.x = Math.sin(cycle * 2.5 + idx) * (0.6 + cycle * 0.4);
            puff.position.z = Math.cos(cycle * 2.0 + idx) * (0.5 + cycle * 0.3);
            puff.scale.setScalar(0.6 + cycle * 0.75);
            if (puff.material instanceof THREE.Material) {
              puff.material.opacity = Math.max(0, 0.45 * (1.0 - cycle / 3.0));
            }
          }
        });
      }

      const ts = this.gridManager.tileSize;
      const px = (b.x + b.width / 2) * ts;
      const pz = (b.y + b.height / 2) * ts;
      const groundY = this.getTerrainHeight(px, pz);

      group.position.set(px, groundY, pz);

      // Rotate building facade so its front entrance physically faces its road doorstep apron
      const facing = b.facing || 'south';
      group.rotation.y = facing === 'north' ? Math.PI : (facing === 'east' ? Math.PI / 2 : (facing === 'west' ? -Math.PI / 2 : 0));

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
  private createConstructionSiteModel(b: Building, progress: number): THREE.Group {
    const group = new THREE.Group();
    const ts = this.gridManager.tileSize;
    const w = b.width * ts;
    const h = b.height * ts;
    const isPalace = b.type === 'palace';
    const isTower = b.type === 'wizard_tower' || b.type === 'guard_tower';
    const isCottage = b.type === 'peasant_cottage';

    const stage = Math.min(3, Math.max(1, Math.ceil(progress / 33.3)));
    const targetHeight = isPalace ? 28 : (isTower ? 34 : (isCottage ? 14 : 20));

    // Shared authentic textured materials
    const earthMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.95 });
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      map: this.royalCastleWallTexture,
      roughness: 0.85
    });
    const plankMat = new THREE.MeshStandardMaterial({
      color: 0xb45309,
      map: this.woodPlankTexture,
      roughness: 0.75
    });
    const poleMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      map: this.timberLogTexture,
      roughness: 0.85
    });
    const tarpMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a8a,
      map: this.burlapTarpTexture,
      roughness: 0.8,
      side: THREE.DoubleSide
    });
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.75, roughness: 0.35 });
    const mortarMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.95 });

    // 1. Excavated Compacted Ground Earth Plinth
    const earthGeo = new THREE.BoxGeometry(w * 0.94, 0.4, h * 0.94);
    const earth = new THREE.Mesh(earthGeo, earthMat);
    earth.position.y = 0.2;
    earth.receiveShadow = true;
    group.add(earth);

    // 2. Stepped Ashlar Stone Foundation Footing
    const footingH = stage === 1 ? 3.0 : 3.8;
    const footingGeo = new THREE.BoxGeometry(w * 0.86, footingH, h * 0.86);
    const footing = new THREE.Mesh(footingGeo, stoneMat);
    footing.position.y = footingH / 2 + 0.2;
    footing.castShadow = true;
    footing.receiveShadow = true;
    group.add(footing);

    // 3. Rising Masonry Walls & Timber Framing by Stage
    const halfW = w * 0.38;
    const halfH = h * 0.38;

    if (stage === 1) {
      // --- STAGE 1 (1 - 33%): Foundation Footings, Timber Sills & Course Laying ---
      const sillWGeo = new THREE.BoxGeometry(w * 0.78, 1.2, 1.2);
      const sillDGeo = new THREE.BoxGeometry(1.2, 1.2, h * 0.78);
      const s1 = new THREE.Mesh(sillWGeo, plankMat); s1.position.set(0, footingH + 0.6, -halfH); group.add(s1);
      const s2 = new THREE.Mesh(sillWGeo, plankMat); s2.position.set(0, footingH + 0.6, halfH); group.add(s2);
      const s3 = new THREE.Mesh(sillDGeo, plankMat); s3.position.set(-halfW, footingH + 0.6, 0); group.add(s3);
      const s4 = new THREE.Mesh(sillDGeo, plankMat); s4.position.set(halfW, footingH + 0.6, 0); group.add(s4);

      // Low masonry wall blocks showing active bricklaying
      const lowWallGeo = new THREE.BoxGeometry(w * 0.74, 3.2, h * 0.74);
      const lowWall = new THREE.Mesh(lowWallGeo, stoneMat);
      lowWall.position.y = footingH + 1.8;
      lowWall.castShadow = true;
      group.add(lowWall);

      // Staggered ashlar stone blocks waiting to be mortared
      const blockGeo = new THREE.BoxGeometry(4.2, 2.2, 3.2);
      for (let i = 0; i < 4; i++) {
        const blk = new THREE.Mesh(blockGeo, stoneMat);
        blk.position.set(-halfW + 6 + i * 8, footingH + 4.2, -halfH + (i % 2 === 0 ? 0.4 : -0.4));
        blk.rotation.y = (i * 0.08);
        blk.castShadow = true;
        group.add(blk);
      }
    } else if (stage === 2) {
      // --- STAGE 2 (34 - 66%): Half-Height Walls, Arched Doorway & Window Voids ---
      const wallH = targetHeight * 0.55;
      
      const doorW = Math.max(6, w * 0.22);
      const sideWallW = (w * 0.76 - doorW) / 2;
      const sideWallGeo = new THREE.BoxGeometry(sideWallW, wallH, 3.5);
      
      const swLeft = new THREE.Mesh(sideWallGeo, stoneMat);
      swLeft.position.set(-w * 0.38 + sideWallW / 2, footingH + wallH / 2, halfH);
      swLeft.castShadow = true;
      group.add(swLeft);

      const swRight = new THREE.Mesh(sideWallGeo, stoneMat);
      swRight.position.set(w * 0.38 - sideWallW / 2, footingH + wallH / 2, halfH);
      swRight.castShadow = true;
      group.add(swRight);

      // Heavy timber door lintel header
      const lintelGeo = new THREE.BoxGeometry(doorW + 4, 1.8, 4.0);
      const lintel = new THREE.Mesh(lintelGeo, plankMat);
      lintel.position.set(0, footingH + wallH * 0.75, halfH);
      lintel.castShadow = true;
      group.add(lintel);

      // North, East and West walls
      const northWall = new THREE.Mesh(new THREE.BoxGeometry(w * 0.76, wallH, 3.5), stoneMat);
      northWall.position.set(0, footingH + wallH / 2, -halfH);
      northWall.castShadow = true;
      group.add(northWall);

      const sideWallE = new THREE.Mesh(new THREE.BoxGeometry(3.5, wallH, h * 0.74), stoneMat);
      sideWallE.position.set(halfW, footingH + wallH / 2, 0);
      sideWallE.castShadow = true;
      group.add(sideWallE);

      const sideWallWMesh = new THREE.Mesh(new THREE.BoxGeometry(3.5, wallH, h * 0.74), stoneMat);
      sideWallWMesh.position.set(-halfW, footingH + wallH / 2, 0);
      sideWallWMesh.castShadow = true;
      group.add(sideWallWMesh);
    } else {
      // --- STAGE 3 (67 - 99%): Full-Height Walls, Exposed Timber Roof Framing ---
      const wallH = targetHeight * 0.82;
      const fullWalls = new THREE.Mesh(new THREE.BoxGeometry(w * 0.76, wallH, h * 0.76), stoneMat);
      fullWalls.position.y = footingH + wallH / 2;
      fullWalls.castShadow = true;
      group.add(fullWalls);

      // Top timber wall-plates (eave beams)
      const eavePlateGeo = new THREE.BoxGeometry(w * 0.8, 1.4, 1.4);
      const ep1 = new THREE.Mesh(eavePlateGeo, plankMat); ep1.position.set(0, footingH + wallH + 0.7, -halfH); group.add(ep1);
      const ep2 = new THREE.Mesh(eavePlateGeo, plankMat); ep2.position.set(0, footingH + wallH + 0.7, halfH); group.add(ep2);

      // Exposed Timber Roof Trusses (A-frame rafters, tie beams, king posts, ridge beam)
      const roofRise = Math.max(6, Math.min(w, h) * 0.32);
      const ridgeGeo = new THREE.BoxGeometry(1.6, 1.6, h * 0.78);
      const ridgeBeam = new THREE.Mesh(ridgeGeo, plankMat);
      ridgeBeam.position.set(0, footingH + wallH + roofRise, 0);
      ridgeBeam.castShadow = true;
      group.add(ridgeBeam);

      // 3 A-frame timber trusses spaced along depth
      const rafterLen = Math.hypot(halfW, roofRise);
      const rafterAngle = Math.atan2(roofRise, halfW);
      const rafterGeo = new THREE.BoxGeometry(rafterLen, 1.2, 1.2);

      [-halfH * 0.8, 0, halfH * 0.8].forEach((zPos) => {
        const tie = new THREE.Mesh(new THREE.BoxGeometry(w * 0.76, 1.0, 1.0), plankMat);
        tie.position.set(0, footingH + wallH + 0.6, zPos);
        group.add(tie);

        const king = new THREE.Mesh(new THREE.BoxGeometry(1.2, roofRise, 1.2), plankMat);
        king.position.set(0, footingH + wallH + roofRise / 2, zPos);
        group.add(king);

        const rLeft = new THREE.Mesh(rafterGeo, plankMat);
        rLeft.position.set(-halfW / 2, footingH + wallH + roofRise / 2, zPos);
        rLeft.rotation.z = rafterAngle;
        rLeft.castShadow = true;
        group.add(rLeft);

        const rRight = new THREE.Mesh(rafterGeo, plankMat);
        rRight.position.set(halfW / 2, footingH + wallH + roofRise / 2, zPos);
        rRight.rotation.z = -rafterAngle;
        rRight.castShadow = true;
        group.add(rRight);
      });

      // Canvas weather tarpaulin draped over one rafter slope
      const tarpGeo = new THREE.PlaneGeometry(halfW * 1.1, h * 0.72);
      const tarpMesh = new THREE.Mesh(tarpGeo, tarpMat);
      tarpMesh.position.set(halfW / 2 + 0.2, footingH + wallH + roofRise / 2 + 0.5, 0);
      tarpMesh.rotation.z = -rafterAngle;
      tarpMesh.rotation.x = Math.PI / 2;
      group.add(tarpMesh);

      // Royal heraldic pennant fluttering atop the front roof apex
      const pennantStaff = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 8, 6), poleMat);
      pennantStaff.position.set(0, footingH + wallH + roofRise + 4, halfH * 0.8);
      group.add(pennantStaff);

      const pennantGeo = new THREE.BoxGeometry(4.5, 2.2, 0.2);
      const pennant = new THREE.Mesh(pennantGeo, new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.5 }));
      pennant.position.set(2.4, footingH + wallH + roofRise + 6.5, halfH * 0.8);
      group.add(pennant);
    }

    // 4. Timber Scaffolding with Authentic Medieval Diagonal X-Bracing
    const scaffoldH = stage === 1 ? 10 : (stage === 2 ? 18 : Math.max(22, targetHeight * 0.95));
    const scHalfW = halfW + 3.8;
    const scHalfH = halfH + 3.8;

    // Upright vertical poles
    const poleGeo = new THREE.CylinderGeometry(0.7, 0.85, scaffoldH, 8);
    const polePositions: [number, number][] = [
      [-scHalfW, -scHalfH], [scHalfW, -scHalfH],
      [-scHalfW, scHalfH], [scHalfW, scHalfH]
    ];
    if (w > 60) {
      polePositions.push([0, -scHalfH], [0, scHalfH]);
    }
    if (h > 60) {
      polePositions.push([-scHalfW, 0], [scHalfW, 0]);
    }

    polePositions.forEach(([px, pz]) => {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(px, scaffoldH / 2, pz);
      pole.castShadow = true;
      group.add(pole);
    });

    // Helper: build an authentic diagonal X-brace between two posts
    const addXBrace = (p1: [number, number], p2: [number, number], yBottom: number, yTop: number) => {
      const dx = p2[0] - p1[0];
      const dz = p2[1] - p1[1];
      const dy = yTop - yBottom;
      const diagLen = Math.hypot(dx, dy, dz);
      if (diagLen <= 0.001) return;

      const up = new THREE.Vector3(0, 1, 0);

      // Strut 1: (p1, yBottom) -> (p2, yTop)
      const dir1 = new THREE.Vector3(dx, dy, dz).normalize();
      const strut1 = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, diagLen, 6), poleMat);
      strut1.position.set((p1[0] + p2[0]) / 2, (yBottom + yTop) / 2, (p1[1] + p2[1]) / 2);
      strut1.quaternion.setFromUnitVectors(up, dir1);
      group.add(strut1);

      // Strut 2: (p1, yTop) -> (p2, yBottom)
      const dir2 = new THREE.Vector3(dx, -dy, dz).normalize();
      const strut2 = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, diagLen, 6), poleMat);
      strut2.position.set((p1[0] + p2[0]) / 2, (yBottom + yTop) / 2, (p1[1] + p2[1]) / 2);
      strut2.quaternion.setFromUnitVectors(up, dir2);
      group.add(strut2);
    };

    const tier1Y = 7.5;
    addXBrace([-scHalfW, -scHalfH], [scHalfW, -scHalfH], 0.5, tier1Y);
    addXBrace([-scHalfW, -scHalfH], [-scHalfW, scHalfH], 0.5, tier1Y);
    addXBrace([scHalfW, -scHalfH], [scHalfW, scHalfH], 0.5, tier1Y);

    if (stage >= 2) {
      const tier2Y = Math.min(scaffoldH - 1, 15.5);
      addXBrace([-scHalfW, -scHalfH], [scHalfW, -scHalfH], tier1Y, tier2Y);
      addXBrace([-scHalfW, -scHalfH], [-scHalfW, scHalfH], tier1Y, tier2Y);
      addXBrace([scHalfW, -scHalfH], [scHalfW, scHalfH], tier1Y, tier2Y);
    }

    // Scaffold Plank Walkway Decks
    const addDeck = (deckY: number, width: number, depth: number) => {
      const deckE = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.6, depth * 0.95), plankMat);
      deckE.position.set(width / 2, deckY, 0);
      deckE.castShadow = true;
      group.add(deckE);

      const deckN = new THREE.Mesh(new THREE.BoxGeometry(width * 0.95, 0.6, 4.2), plankMat);
      deckN.position.set(0, deckY, -depth / 2);
      deckN.castShadow = true;
      group.add(deckN);

      const railE = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, depth * 0.95), plankMat);
      railE.position.set(width / 2 + 1.8, deckY + 3.0, 0);
      group.add(railE);
    };

    addDeck(tier1Y, scHalfW * 2, scHalfH * 2);
    if (stage >= 2) {
      addDeck(Math.min(scaffoldH - 1, 15.5), scHalfW * 2, scHalfH * 2);
    }

    // 5. Authentic Leaning Wooden Ladder with Individual Rungs
    const addLadder = (bottomX: number, bottomY: number, bottomZ: number, topX: number, topY: number, topZ: number) => {
      const dx = topX - bottomX;
      const dy = topY - bottomY;
      const dz = topZ - bottomZ;
      const len = Math.hypot(dx, dy, dz);
      if (len <= 0.001) return;

      const ladderGroup = new THREE.Group();
      ladderGroup.position.set((bottomX + topX) / 2, (bottomY + topY) / 2, (bottomZ + topZ) / 2);
      const dir = new THREE.Vector3(dx, dy, dz).normalize();
      ladderGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

      const stringerGeo = new THREE.BoxGeometry(0.4, len, 0.4);
      const leftS = new THREE.Mesh(stringerGeo, plankMat); leftS.position.x = -1.1; ladderGroup.add(leftS);
      const rightS = new THREE.Mesh(stringerGeo, plankMat); rightS.position.x = 1.1; ladderGroup.add(rightS);

      const rungs = 7;
      const rungGeo = new THREE.BoxGeometry(2.2, 0.35, 0.35);
      for (let i = 0; i < rungs; i++) {
        const rung = new THREE.Mesh(rungGeo, plankMat);
        rung.position.y = -len / 2 + (i + 1) * (len / (rungs + 1));
        ladderGroup.add(rung);
      }

      ladderGroup.castShadow = true;
      group.add(ladderGroup);
    };

    addLadder(-scHalfW - 3.5, 0, -scHalfH * 0.4, -scHalfW, tier1Y, -scHalfH * 0.4);
    if (stage >= 2) {
      addLadder(scHalfW, tier1Y, scHalfH * 0.2, scHalfW, Math.min(scaffoldH - 1, 15.5), scHalfH * 0.6);
    }

    // 6. Medieval Derrick Crane & Pulley Hoist (Stage 2 & 3)
    if (stage >= 2) {
      const craneBase = new THREE.Group();
      craneBase.position.set(scHalfW, Math.min(scaffoldH - 1, 15.5), -scHalfH);

      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 13, 6), poleMat);
      mast.position.y = 6.5;
      craneBase.add(mast);

      const knee = new THREE.Mesh(new THREE.BoxGeometry(0.8, 6, 0.8), plankMat);
      knee.position.set(-2, 3.5, 0);
      knee.rotation.z = Math.PI / 4;
      craneBase.add(knee);

      const craneArm = new THREE.Group();
      craneArm.name = 'craneArm';
      craneArm.position.y = 12.5;

      const jib = new THREE.Mesh(new THREE.BoxGeometry(15, 1.2, 1.2), plankMat);
      jib.position.x = -6.5;
      craneArm.add(jib);

      const pulley = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.4, 8), ironMat);
      pulley.position.set(-13, 0, 0);
      pulley.rotation.x = Math.PI / 2;
      craneArm.add(pulley);

      const cableH = 9;
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, cableH, 4), ironMat);
      cable.position.set(-13, -cableH / 2, 0);
      craneArm.add(cable);

      const cargoGeo = stage === 2 ? new THREE.BoxGeometry(3.6, 2.4, 2.8) : new THREE.BoxGeometry(3.2, 3.2, 3.2);
      const cargo = new THREE.Mesh(cargoGeo, stage === 2 ? stoneMat : plankMat);
      cargo.name = 'hoistBucket';
      cargo.userData.baseY = -cableH - 1.2;
      cargo.position.set(-13, cargo.userData.baseY, 0);
      cargo.castShadow = true;
      craneArm.add(cargo);

      craneBase.add(craneArm);
      group.add(craneBase);
    }

    // 7. Worksite Details: Cross-Stacked Lumber, Stone Pallets, Mortar Trough, Sawhorse, Barrels
    const lumberGroup = new THREE.Group();
    lumberGroup.position.set(-w * 0.32, 0.4, h * 0.34);
    const boardGeo = new THREE.BoxGeometry(6.5, 0.5, 1.4);
    for (let layer = 0; layer < 3; layer++) {
      const isRotated = layer % 2 === 1;
      [-1.4, 1.4].forEach((offset) => {
        const board = new THREE.Mesh(boardGeo, plankMat);
        board.position.set(isRotated ? offset : 0, layer * 0.65 + 0.3, isRotated ? 0 : offset);
        if (isRotated) board.rotation.y = Math.PI / 2;
        board.castShadow = true;
        lumberGroup.add(board);
      });
    }
    group.add(lumberGroup);

    const stonePallet = new THREE.Group();
    stonePallet.position.set(w * 0.32, 0.4, h * 0.32);
    const cutStoneGeo = new THREE.BoxGeometry(2.8, 1.8, 2.2);
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 2; c++) {
        const cs = new THREE.Mesh(cutStoneGeo, stoneMat);
        cs.position.set((r - 0.5) * 3.2, 0.9, (c - 0.5) * 2.6);
        cs.castShadow = true;
        stonePallet.add(cs);
      }
    }
    group.add(stonePallet);

    const troughGroup = new THREE.Group();
    troughGroup.position.set(-w * 0.15, 0.4, h * 0.38);
    const troughBox = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.4, 3.2), plankMat);
    troughBox.position.y = 0.7;
    troughGroup.add(troughBox);
    const wetMortar = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.2, 2.6), mortarMat);
    wetMortar.position.y = 1.3;
    troughGroup.add(wetMortar);
    const hoeHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 5.0, 4), poleMat);
    hoeHandle.position.set(1.5, 2.2, 0.5);
    hoeHandle.rotation.z = Math.PI / 3;
    troughGroup.add(hoeHandle);
    group.add(troughGroup);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.4, 3.6, 8), poleMat);
    barrel.position.set(w * 0.36, 1.8, -h * 0.36);
    barrel.castShadow = true;
    group.add(barrel);

    const sawhorse = new THREE.Group();
    sawhorse.position.set(-w * 0.36, 0.4, -h * 0.34);
    const shBar = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.6, 0.6), plankMat);
    shBar.position.y = 2.4;
    sawhorse.add(shBar);
    const shLegGeo = new THREE.CylinderGeometry(0.25, 0.25, 2.8, 4);
    [-2, 2].forEach((lx) => {
      const legL = new THREE.Mesh(shLegGeo, poleMat); legL.position.set(lx, 1.2, -0.8); legL.rotation.x = -0.35; sawhorse.add(legL);
      const legR = new THREE.Mesh(shLegGeo, poleMat); legR.position.set(lx, 1.2, 0.8); legR.rotation.x = 0.35; sawhorse.add(legR);
    });
    const woodLog = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 6.0, 6), poleMat);
    woodLog.position.set(0, 3.0, 0);
    woodLog.rotation.z = Math.PI / 2;
    sawhorse.add(woodLog);
    group.add(sawhorse);

    return group;
  }

  private create3DBuilding(b: Building): THREE.Group {
    const group = new THREE.Group();
    const ts = this.gridManager.tileSize;
    const w = b.width * ts;
    const h = b.height * ts;
    const isCottage = b.type === 'peasant_cottage';

    if (b.isConstructing) {
      if (b.constructionProgress <= 0) {
        // --- 1. ARCHITECTURAL BLUEPRINT (Before Builder Arrives) ---
        // Translucent Blueprint Ground Plinth
        const bpGroundGeo = new THREE.PlaneGeometry(isCottage ? w * 0.72 : w * 0.94, isCottage ? h * 0.72 : h * 0.94);
        bpGroundGeo.rotateX(-Math.PI / 2);
        const bpGroundMat = new THREE.MeshStandardMaterial({
          map: this.blueprintTexture,
          transparent: true,
          opacity: 0.9,
          roughness: 0.5,
          emissive: 0x0284c7,
          emissiveIntensity: 0.35,
          side: THREE.DoubleSide
        });
        const bpGround = new THREE.Mesh(bpGroundGeo, bpGroundMat);
        bpGround.position.y = 0.2;
        group.add(bpGround);

        // 4 Surveyor Wooden Corner Stakes with Blue Ribbon Flags
        const stakeGeo = new THREE.CylinderGeometry(0.5, 0.3, 8, 6);
        const stakeMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
        const ribbonMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.6 });

        const halfW = w * 0.44;
        const halfH = h * 0.44;
        const corners = [
          [-halfW, -halfH],
          [halfW, -halfH],
          [-halfW, halfH],
          [halfW, halfH]
        ];

        corners.forEach(([cx, cz]) => {
          const stake = new THREE.Mesh(stakeGeo, stakeMat);
          stake.position.set(cx, 3.5, cz);
          group.add(stake);

          // Surveyor Blue Ribbon Flag atop stake
          const ribbonGeo = new THREE.BoxGeometry(2.5, 1.2, 0.2);
          const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
          ribbon.position.set(cx + 1, 7, cz);
          group.add(ribbon);
        });

        // Surveyor Boundary Perimeter Tape
        const tapeMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.8 });
        const tapeXGeo = new THREE.BoxGeometry(w * 0.88, 0.3, 0.3);
        const tapeZGeo = new THREE.BoxGeometry(0.3, 0.3, h * 0.88);

        const t1 = new THREE.Mesh(tapeXGeo, tapeMat); t1.position.set(0, 5, -halfH); group.add(t1);
        const t2 = new THREE.Mesh(tapeXGeo, tapeMat); t2.position.set(0, 5, halfH); group.add(t2);
        const t3 = new THREE.Mesh(tapeZGeo, tapeMat); t3.position.set(-halfW, 5, 0); group.add(t3);
        const t4 = new THREE.Mesh(tapeZGeo, tapeMat); t4.position.set(halfW, 5, 0); group.add(t4);

        // Holographic Blueprint Wireframe Structure Outline
        const estHeight = (b.type === 'palace' || b.type === 'wizard_tower' || b.type === 'guard_tower') ? 28 : 16;
        const wireGeo = new THREE.BoxGeometry(w * 0.78, estHeight, h * 0.78);
        const wireMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          wireframe: true,
          transparent: true,
          opacity: 0.65
        });
        const wireBox = new THREE.Mesh(wireGeo, wireMat);
        wireBox.position.y = estHeight / 2;
        group.add(wireBox);

        return group;
      }

      // --- 2. ACTIVE CONSTRUCTION SITE (Authentic Medieval Timber Scaffolding & Masons) ---
      return this.createConstructionSiteModel(b, b.constructionProgress);
    }

    // Single-model path: the GLTF is the one and only finished look for every
    // building, palace included (building_castle_blue, scaled up per level).
    // While models stream in behind the loading veil this returns an empty
    // placeholder; a still-missing model after that means a failed download,
    // which is warned about instead of covered up with a stand-in.
    {
      const gltfBuilding = ModelRegistry.getInstance().getBuildingModel(b.type);
      if (!gltfBuilding) {
        if (ModelRegistry.getInstance().isReady) console.warn(`Missing building model: ${b.type}`);
        return group;
      }
      const box = new THREE.Box3().setFromObject(gltfBuilding);
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);

      const levelScale = b.type === 'palace' ? (b.level >= 3 ? 1.18 : b.level === 2 ? 1.0 : 0.85) : 1.0;
      const maxDim = Math.max(size.x, size.z);
      const targetDim = Math.min(w, h) * (isCottage ? 0.85 : 0.95) * levelScale;
      const scale = maxDim > 0 ? targetDim / maxDim : 1.0;

      gltfBuilding.scale.set(scale, scale, scale);
      gltfBuilding.position.set(-center.x * scale, -box.min.y * scale + 0.1, -center.z * scale);
      group.add(gltfBuilding);
      return group;
    }
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
      const groundY = this.getTerrainHeight(px, pz);

      group.position.set(px, groundY, pz);
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
      // Subterranean Stone Masonry Shaft Collar (Deep underground casing prevents hovering on any slope)
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0x475569, map: this.royalCastleWallTexture, roughness: 0.85 });
      const shaftGeo = new THREE.CylinderGeometry(10.2, 10.8, 14.0, 16);
      const shaft = new THREE.Mesh(shaftGeo, stoneMat);
      shaft.position.y = -7.0 + 0.3;
      shaft.receiveShadow = true;
      group.add(shaft);

      // Flush Street-Level Dressed Stone Curb Rim
      const curbGeo = new THREE.CylinderGeometry(9.6, 10.4, 0.6, 16);
      const curb = new THREE.Mesh(curbGeo, stoneMat);
      curb.position.y = 0.3;
      curb.castShadow = true;
      curb.receiveShadow = true;
      group.add(curb);

      // Deep Recessed Drain Opening
      const pitGeo = new THREE.CircleGeometry(8.2, 16);
      pitGeo.rotateX(-Math.PI / 2);
      const darkMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
      const pit = new THREE.Mesh(pitGeo, darkMat);
      pit.position.y = 0.2;
      group.add(pit);

      // Murky Bioluminescent Green Sewer Slime inside
      const slimeGeo = new THREE.CircleGeometry(7.2, 16);
      slimeGeo.rotateX(-Math.PI / 2);
      const slimeMat = new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x059669,
        emissiveIntensity: 0.8,
        roughness: 0.2
      });
      const slime = new THREE.Mesh(slimeGeo, slimeMat);
      slime.position.y = 0.22;
      group.add(slime);

      // Heavy Cast Iron Outer Ring
      const rimRingGeo = new THREE.TorusGeometry(8.2, 0.45, 6, 16);
      rimRingGeo.rotateX(Math.PI / 2);
      const ironMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.25 });
      const rimRing = new THREE.Mesh(rimRingGeo, ironMat);
      rimRing.position.y = 0.38;
      group.add(rimRing);

      // Slotted Iron Sewer Grate Bars
      const numBars = 5;
      const spacing = 12 / numBars;
      for (let i = 0; i <= numBars; i++) {
        const barGeo = new THREE.BoxGeometry(0.7, 0.5, 15);
        const bar = new THREE.Mesh(barGeo, ironMat);
        const barX = -6 + i * spacing;
        const maxLen = 2 * Math.sqrt(Math.max(1, 8.2 * 8.2 - barX * barX));
        bar.scale.z = Math.min(1, maxLen / 15);
        bar.position.set(barX, 0.42, 0);
        bar.castShadow = true;
        group.add(bar);
      }

      // Thick Central Crossbar
      const crossBarGeo = new THREE.BoxGeometry(15, 0.6, 0.6);
      const crossBar = new THREE.Mesh(crossBarGeo, ironMat);
      crossBar.position.set(0, 0.46, 0);
      group.add(crossBar);
      return group;
    }

    if (lair.type === 'graveyard') {
      // Authentic 3D Cursed Graveyard with KayKit Crypt Mausoleum, Tombstones & Twisted Dead Trees
      const gltfCrypt = ModelRegistry.getInstance().cloneModel('crypt');
      if (gltfCrypt) {
        const box = new THREE.Box3().setFromObject(gltfCrypt);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);

        const maxDim = Math.max(size.x, size.z);
        const targetDim = Math.min(w, h) * 0.58;
        const scale = maxDim > 0 ? targetDim / maxDim : 1.0;

        gltfCrypt.scale.set(scale, scale, scale);
        gltfCrypt.position.set(-center.x * scale, -box.min.y * scale + 0.2, -center.z * scale - h * 0.16);
        group.add(gltfCrypt);
      } else {
        const cryptGeo = new THREE.BoxGeometry(16, 14, 20);
        const cryptMat = new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.9 });
        const crypt = new THREE.Mesh(cryptGeo, cryptMat);
        crypt.position.set(0, 7, -6);
        group.add(crypt);
      }

      // Authentic Dead Twisted Tree
      const deadTree = ModelRegistry.getInstance().cloneModel('tree_dead_large');
      if (deadTree) {
        deadTree.scale.set(1.3, 1.3, 1.3);
        deadTree.position.set(w * 0.36, 0.2, h * 0.3);
        group.add(deadTree);
      }

      // Authentic Gravestones
      for (let g = 0; g < 4; g++) {
        const stone = ModelRegistry.getInstance().cloneModel('gravestone');
        if (stone) {
          stone.scale.set(1.3, 1.3, 1.3);
          const gx = (g % 2 === 0 ? -w * 0.28 : w * 0.18) + (g >= 2 ? 6 : -4);
          const gz = (g >= 2 ? h * 0.26 : h * 0.08);
          stone.position.set(gx, 0.2, gz);
          stone.rotation.y = (g * 0.3) - 0.2;
          stone.rotation.z = Math.sin(g * 1.7) * 0.08;
          group.add(stone);
        }
      }

      // Authentic Skull Post
      const skullPost = ModelRegistry.getInstance().cloneModel('post_skull');
      if (skullPost) {
        skullPost.scale.set(1.3, 1.3, 1.3);
        skullPost.position.set(-w * 0.38, 0.2, -h * 0.28);
        group.add(skullPost);
      }

      // Wrought-Iron Fence Posts along the front edge
      const fenceMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.7, roughness: 0.45 });
      const postCount = 7;
      for (let fp = 0; fp < postCount; fp++) {
        const fx = -w * 0.42 + (fp / (postCount - 1)) * w * 0.84;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 5.5, 5), fenceMat);
        post.position.set(fx, 2.75, h * 0.48);
        group.add(post);
        const finial = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.9, 5), fenceMat);
        finial.position.set(fx, 5.95, h * 0.48);
        group.add(finial);
      }
      const rail = new THREE.Mesh(new THREE.BoxGeometry(w * 0.86, 0.22, 0.22), fenceMat);
      rail.position.set(0, 4.4, h * 0.48);
      group.add(rail);
    } else if (lair.type === 'goblin_hut') {
      // Authentic Goblin War Encampment with Tribal Tent, Weapon Racks, Skull Totems & Campfire
      const gltfTent = ModelRegistry.getInstance().cloneModel('tent');
      if (gltfTent) {
        const box = new THREE.Box3().setFromObject(gltfTent);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);

        const maxDim = Math.max(size.x, size.z);
        const targetDim = Math.min(w, h) * 0.72;
        const scale = maxDim > 0 ? targetDim / maxDim : 1.0;

        gltfTent.scale.set(scale, scale, scale);
        gltfTent.position.set(-center.x * scale - w * 0.1, -box.min.y * scale + 0.2, -center.z * scale - h * 0.08);
        gltfTent.rotation.y = 0.35;
        group.add(gltfTent);
      }

      // Authentic Weapon Rack with spears & blades
      const weaponRack = ModelRegistry.getInstance().cloneModel('weaponrack');
      if (weaponRack) {
        weaponRack.scale.set(1.4, 1.4, 1.4);
        weaponRack.position.set(w * 0.32, 0.4, -h * 0.2);
        weaponRack.rotation.y = -0.4;
        group.add(weaponRack);
      }

      // Authentic Red War Flag / Banner
      const redFlag = ModelRegistry.getInstance().cloneModel('flag_red');
      if (redFlag) {
        redFlag.scale.set(1.5, 1.5, 1.5);
        redFlag.position.set(-w * 0.36, 0.2, -h * 0.32);
        group.add(redFlag);
      }

      // Skull Totem Posts
      const skullPost = ModelRegistry.getInstance().cloneModel('post_skull');
      if (skullPost) {
        skullPost.scale.set(1.4, 1.4, 1.4);
        skullPost.position.set(w * 0.34, 0.2, h * 0.28);
        group.add(skullPost);
      }

      // Crackle-Fire Camp Ring with embers
      const fireRingMat = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 1.0 });
      for (let fr = 0; fr < 7; fr++) {
        const ang = (fr / 7) * Math.PI * 2;
        const ringStone = new THREE.Mesh(new THREE.DodecahedronGeometry(1.0, 0), fireRingMat);
        ringStone.position.set(w * 0.08 + Math.cos(ang) * 4.2, 0.6, h * 0.26 + Math.sin(ang) * 4.2);
        group.add(ringStone);
      }
      const emberMat = new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xdc2626, emissiveIntensity: 2.0 });
      for (let fe = 0; fe < 4; fe++) {
        const ember = new THREE.Mesh(new THREE.SphereGeometry(0.7, 6, 6), emberMat);
        ember.position.set(w * 0.08 + (fe - 1.5) * 1.3, 0.7, h * 0.26 + Math.sin(fe * 2) * 1.0);
        group.add(ember);
      }
    } else if (lair.type === 'wolf_den') {
      // Natural Rocky Predator Cavern diorama built from textured KayKit boulders, gnarled deadwood & bones
      const r1 = ModelRegistry.getInstance().cloneModel('rock_large_a') || ModelRegistry.getInstance().getRockModel(0);
      if (r1) {
        r1.scale.set(1.8, 1.6, 1.8);
        r1.position.set(-w * 0.28, 0, -h * 0.1);
        r1.rotation.set(0.2, 0.4, 0.1);
        group.add(r1);
      }
      const r2 = ModelRegistry.getInstance().cloneModel('rock_large_b') || ModelRegistry.getInstance().getRockModel(1);
      if (r2) {
        r2.scale.set(1.7, 1.8, 1.7);
        r2.position.set(w * 0.28, 0, -h * 0.12);
        r2.rotation.set(-0.1, -0.6, -0.15);
        group.add(r2);
      }
      const r3 = ModelRegistry.getInstance().cloneModel('rock_large_a') || ModelRegistry.getInstance().getRockModel(2);
      if (r3) {
        r3.scale.set(2.1, 1.3, 1.8);
        r3.position.set(0, 8.5, -h * 0.15);
        r3.rotation.set(0.35, 1.2, 0.2);
        group.add(r3);
      }
      const r4 = ModelRegistry.getInstance().cloneModel('rock_small_a') || ModelRegistry.getInstance().getRockModel(0);
      if (r4) {
        r4.scale.set(1.6, 1.6, 1.6);
        r4.position.set(-w * 0.35, 0, h * 0.25);
        group.add(r4);
      }
      const r5 = ModelRegistry.getInstance().cloneModel('rock_small_b') || ModelRegistry.getInstance().getRockModel(1);
      if (r5) {
        r5.scale.set(1.8, 1.8, 1.8);
        r5.position.set(w * 0.32, 0, h * 0.28);
        group.add(r5);
      }

      // Dark Cave Interior Abyss Cavity
      const interiorMat = new THREE.MeshBasicMaterial({ color: 0x050404 });
      const caveInterior = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 8.0, 10, 8), interiorMat);
      caveInterior.position.set(0, 5, -h * 0.12);
      caveInterior.rotation.x = Math.PI / 2;
      group.add(caveInterior);

      // Glowing Amber Predator Eyes in the dark cavity
      const eyesMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 2.5
      });
      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.35, 4, 4), eyesMat);
      eyeL.position.set(-1.1, 4.2, -h * 0.05);
      group.add(eyeL);
      const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.35, 4, 4), eyesMat);
      eyeR.position.set(1.1, 4.2, -h * 0.05);
      group.add(eyeR);

      // Gnarled Dead Tree root arching over the cave
      const deadTree = ModelRegistry.getInstance().cloneModel('tree_dead_large');
      if (deadTree) {
        deadTree.scale.set(1.2, 1.2, 1.2);
        deadTree.position.set(-w * 0.22, 1.0, -h * 0.25);
        deadTree.rotation.y = 0.8;
        deadTree.rotation.z = -0.15;
        group.add(deadTree);
      }

      // Fresh-Kill Bone Pile & Skulls
      const skull = ModelRegistry.getInstance().cloneModel('skull');
      if (skull) {
        skull.scale.set(1.4, 1.4, 1.4);
        skull.position.set(-3.2, 0.5, h * 0.22);
        skull.rotation.set(0.2, 0.5, -0.3);
        group.add(skull);
      }
      const skullPost = ModelRegistry.getInstance().cloneModel('post_skull');
      if (skullPost) {
        skullPost.scale.set(1.2, 1.2, 1.2);
        skullPost.position.set(w * 0.38, 0, -h * 0.2);
        group.add(skullPost);
      }

      // Strewn Rib Bones
      const boneMat = new THREE.MeshStandardMaterial({ color: 0xdedbd2, roughness: 0.75 });
      for (let bIdx = 0; bIdx < 5; bIdx++) {
        const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 2.8, 4), boneMat);
        const bx = -2.5 + bIdx * 1.3;
        const bz = h * 0.18 + Math.sin(bIdx * 1.5) * 2.2;
        bone.position.set(bx, 0.3, bz);
        bone.rotation.set(Math.PI / 2, 0.4 * bIdx, 0.3);
        group.add(bone);
      }

      // Wild Thorns & Poisonous Mushroom clusters
      const bush = ModelRegistry.getInstance().cloneModel('bush_detailed') || ModelRegistry.getInstance().getBushOrGrassModel(1);
      if (bush) {
        bush.scale.set(1.1, 1.1, 1.1);
        bush.position.set(w * 0.35, 0.2, 0);
        group.add(bush);
      }
      const shrooms = ModelRegistry.getInstance().cloneModel('mushrooms') || ModelRegistry.getInstance().getFloraModel(3);
      if (shrooms) {
        shrooms.scale.set(1.6, 1.6, 1.6);
        shrooms.position.set(-w * 0.32, 0.2, h * 0.12);
        group.add(shrooms);
      }
    } else if (lair.type === 'ancient_ruins') {
      // Grand Ancient Ruined Citadel & Mystical Dark Arcane Altar
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x475569, map: this.cobbleTexture, roughness: 0.9 });
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0x64748b, map: this.royalCastleWallTexture, roughness: 0.85 });
      const mossMat = new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 1.0 });
      const altarMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.6, metalness: 0.3 });
      const arcaneGlowMat = new THREE.MeshStandardMaterial({
        color: 0xc084fc,
        emissive: 0x9333ea,
        emissiveIntensity: 2.2,
        roughness: 0.15,
        metalness: 0.1
      });

      // 1. Raised Stepped Stone Dais
      const daisGeo = new THREE.BoxGeometry(w * 0.92, 1.4, h * 0.92);
      const dais = new THREE.Mesh(daisGeo, baseMat);
      dais.position.y = 0.7;
      dais.receiveShadow = true;
      group.add(dais);

      // 2. High-Quality KayKit Medieval Destroyed Building Structure (Authentic assets)
      const gltfRuins = ModelRegistry.getInstance().cloneModel('ruins');
      if (gltfRuins) {
        const box = new THREE.Box3().setFromObject(gltfRuins);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);

        const maxDim = Math.max(size.x, size.z);
        const targetDim = Math.min(w, h) * 0.78;
        const scale = maxDim > 0 ? targetDim / maxDim : 1.0;

        gltfRuins.scale.set(scale, scale, scale);
        gltfRuins.position.set(-center.x * scale - w * 0.08, -box.min.y * scale + 1.2, -center.z * scale - h * 0.08);
        group.add(gltfRuins);
      }

      // 3. Ancient Weathered Stone Pillars & Broken Arch
      const colGeo = new THREE.CylinderGeometry(2.4, 2.9, 20, 8);
      const c1 = new THREE.Mesh(colGeo, stoneMat);
      c1.position.set(-w * 0.34, 10, -h * 0.32);
      c1.castShadow = true;
      group.add(c1);

      const c2 = new THREE.Mesh(colGeo, stoneMat);
      c2.position.set(-w * 0.34, 10, h * 0.28);
      c2.castShadow = true;
      group.add(c2);

      // Broken Lintel
      const lintelGeo = new THREE.BoxGeometry(4.2, 3.4, h * 0.65);
      const lintel = new THREE.Mesh(lintelGeo, stoneMat);
      lintel.position.set(-w * 0.34, 20.8, -h * 0.02);
      lintel.rotation.x = 0.08;
      lintel.castShadow = true;
      group.add(lintel);

      // Broken Stump & Toppled Column Segment
      const cStump = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.8, 7.5, 8), stoneMat);
      cStump.position.set(w * 0.32, 4.5, h * 0.32);
      cStump.rotation.z = 0.12;
      group.add(cStump);

      const fallenCol = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 13, 8), stoneMat);
      fallenCol.rotation.z = Math.PI / 2;
      fallenCol.rotation.y = 0.6;
      fallenCol.position.set(w * 0.24, 2.4, -h * 0.28);
      fallenCol.castShadow = true;
      group.add(fallenCol);

      // Mossy caps on pillars
      for (const [cx, cz] of [[-w * 0.34, -h * 0.32], [-w * 0.34, h * 0.28]] as const) {
        const mossCap = new THREE.Mesh(new THREE.SphereGeometry(2.2, 7, 5), mossMat);
        mossCap.scale.set(1, 0.4, 1);
        mossCap.position.set(cx, 20.8, cz);
        group.add(mossCap);
      }

      // 4. Central Corrupted Arcane Altar & Glowing Crystal Spire
      const altarBase = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 5.2, 2.8, 8), altarMat);
      altarBase.position.set(w * 0.12, 2.4, h * 0.06);
      altarBase.castShadow = true;
      group.add(altarBase);

      const altarRunicRing = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.4, 6, 12), arcaneGlowMat);
      altarRunicRing.rotation.x = Math.PI / 2;
      altarRunicRing.position.set(w * 0.12, 3.9, h * 0.06);
      group.add(altarRunicRing);

      // Floating / Jutting Dark Arcane Spire Crystal
      const crystalGeo = new THREE.OctahedronGeometry(3.2, 0);
      const crystal = new THREE.Mesh(crystalGeo, arcaneGlowMat);
      crystal.scale.set(0.7, 2.2, 0.7);
      crystal.position.set(w * 0.12, 8.5, h * 0.06);
      crystal.castShadow = true;
      group.add(crystal);

      // 5. Authentic KayKit Nature Props: Boulders, Bushes, Mushrooms
      const rock1 = ModelRegistry.getInstance().cloneModel('rock_large_a') || ModelRegistry.getInstance().getRockModel(0);
      if (rock1) {
        rock1.scale.set(1.4, 1.4, 1.4);
        rock1.position.set(w * 0.36, 0.8, -h * 0.12);
        group.add(rock1);
      }
      const rock2 = ModelRegistry.getInstance().cloneModel('rock_small_b') || ModelRegistry.getInstance().getRockModel(3);
      if (rock2) {
        rock2.scale.set(1.6, 1.6, 1.6);
        rock2.position.set(-w * 0.28, 0.8, h * 0.36);
        group.add(rock2);
      }
      const bush = ModelRegistry.getInstance().cloneModel('bush_detailed') || ModelRegistry.getInstance().getBushOrGrassModel(1);
      if (bush) {
        bush.scale.set(1.3, 1.3, 1.3);
        bush.position.set(w * 0.32, 0.8, h * 0.18);
        group.add(bush);
      }
      const shrooms = ModelRegistry.getInstance().cloneModel('mushrooms') || ModelRegistry.getInstance().getFloraModel(3);
      if (shrooms) {
        shrooms.scale.set(1.8, 1.8, 1.8);
        shrooms.position.set(-w * 0.18, 0.8, -h * 0.36);
        group.add(shrooms);
      }
    } else if (lair.type === 'dragon_cavern') {
      // Jagged Volcanic Caldera & Molten Wyrm Peak (Layered organic rock formations)
      const r1 = ModelRegistry.getInstance().cloneModel('rock_large_a') || ModelRegistry.getInstance().getRockModel(0);
      if (r1) {
        r1.scale.set(2.8, 3.2, 2.8);
        r1.position.set(-w * 0.24, 0, -h * 0.2);
        r1.rotation.set(0.1, 0.5, 0.2);
        group.add(r1);
      }
      const r2 = ModelRegistry.getInstance().cloneModel('rock_large_b') || ModelRegistry.getInstance().getRockModel(1);
      if (r2) {
        r2.scale.set(2.6, 3.4, 2.6);
        r2.position.set(w * 0.24, 0, -h * 0.18);
        r2.rotation.set(-0.15, -0.8, -0.1);
        group.add(r2);
      }
      const r3 = ModelRegistry.getInstance().cloneModel('rock_large_a') || ModelRegistry.getInstance().getRockModel(2);
      if (r3) {
        r3.scale.set(2.7, 3.0, 2.7);
        r3.position.set(0, 0, -h * 0.34);
        group.add(r3);
      }
      const r4 = ModelRegistry.getInstance().cloneModel('rock_small_a') || ModelRegistry.getInstance().getRockModel(0);
      if (r4) {
        r4.scale.set(2.2, 2.2, 2.2);
        r4.position.set(-w * 0.38, 0, h * 0.22);
        group.add(r4);
      }
      const r5 = ModelRegistry.getInstance().cloneModel('rock_small_b') || ModelRegistry.getInstance().getRockModel(1);
      if (r5) {
        r5.scale.set(2.4, 2.4, 2.4);
        r5.position.set(w * 0.38, 0, h * 0.24);
        group.add(r5);
      }

      // Molten Glowing Magma Caldera & Crag Maw
      const magmaMat = new THREE.MeshStandardMaterial({
        color: 0xea580c,
        emissive: 0xf97316,
        emissiveIntensity: 2.8,
        roughness: 0.2
      });
      const magmaPool = new THREE.Mesh(new THREE.CylinderGeometry(8, 9, 3, 10), magmaMat);
      magmaPool.position.set(0, 1.5, 0);
      group.add(magmaPool);

      // Glowing lava fissures extending outward
      const fissureMat = new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xdc2626, emissiveIntensity: 2.2 });
      for (let cr = 0; cr < 6; cr++) {
        const ang = (cr / 6) * Math.PI * 2;
        const fissure = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 8), fissureMat);
        fissure.position.set(Math.cos(ang) * (w * 0.32), 0.3, Math.sin(ang) * (h * 0.32));
        fissure.rotation.y = ang + Math.PI / 2;
        group.add(fissure);
      }

      // Dragon Hoard Gold Piles
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.9, roughness: 0.2 });
      for (let g = 0; g < 4; g++) {
        const ang = (g / 4) * Math.PI * 2 + 0.4;
        const goldPile = new THREE.Mesh(new THREE.DodecahedronGeometry(1.8, 0), goldMat);
        goldPile.position.set(Math.cos(ang) * 9, 0.8, Math.sin(ang) * 9);
        group.add(goldPile);
      }

      const deadTree = ModelRegistry.getInstance().cloneModel('tree_dead_large');
      if (deadTree) {
        deadTree.scale.set(1.3, 1.3, 1.3);
        deadTree.position.set(w * 0.36, 0.2, -h * 0.32);
        group.add(deadTree);
      }

      const skullPost = ModelRegistry.getInstance().cloneModel('post_skull');
      if (skullPost) {
        skullPost.scale.set(1.5, 1.5, 1.5);
        skullPost.position.set(-w * 0.36, 0.2, h * 0.32);
        group.add(skullPost);
      }

      // Continuous Sulfurous Smoke Emitter
      const craterSmoke = this.createSmokeEmitter(0, 18, -h * 0.15, true, 5);
      group.add(craterSmoke);
    } else if (lair.type === 'harpy_roost') {
      // Jagged Cliff Pinnacle with Deadwood Tree Roost & Talon Nest
      const r1 = ModelRegistry.getInstance().cloneModel('rock_large_a') || ModelRegistry.getInstance().getRockModel(0);
      if (r1) {
        r1.scale.set(2.2, 2.8, 2.2);
        r1.position.set(0, 0, 0);
        group.add(r1);
      }
      const r2 = ModelRegistry.getInstance().cloneModel('rock_large_b') || ModelRegistry.getInstance().getRockModel(1);
      if (r2) {
        r2.scale.set(1.8, 2.2, 1.8);
        r2.position.set(-w * 0.22, 0, h * 0.15);
        group.add(r2);
      }
      const r3 = ModelRegistry.getInstance().cloneModel('rock_small_a') || ModelRegistry.getInstance().getRockModel(0);
      if (r3) {
        r3.scale.set(1.8, 1.8, 1.8);
        r3.position.set(w * 0.25, 0, -h * 0.18);
        group.add(r3);
      }

      // Dead Twisted Tree atop the peak
      const deadTree = ModelRegistry.getInstance().cloneModel('tree_dead_large');
      if (deadTree) {
        deadTree.scale.set(1.5, 1.6, 1.5);
        deadTree.position.set(0, 10, 0);
        group.add(deadTree);
      }

      // Woven Talon Nest with skull trophies & bones
      const nestMat = new THREE.MeshStandardMaterial({ color: 0x44403c, roughness: 1.0 });
      const nest = new THREE.Mesh(new THREE.TorusGeometry(4.2, 1.2, 6, 10), nestMat);
      nest.rotation.x = Math.PI / 2;
      nest.position.set(0, 24, 0);
      nest.castShadow = true;
      group.add(nest);

      // Skull in the nest
      const skull = ModelRegistry.getInstance().cloneModel('skull');
      if (skull) {
        skull.scale.set(1.2, 1.2, 1.2);
        skull.position.set(1.2, 24.8, 0.8);
        group.add(skull);
      }

      // Red war ribbon banner
      const redFlag = ModelRegistry.getInstance().cloneModel('flag_red');
      if (redFlag) {
        redFlag.scale.set(1.3, 1.3, 1.3);
        redFlag.position.set(-w * 0.3, 0.2, h * 0.25);
        group.add(redFlag);
      }
    } else if (lair.type === 'troll_bridge') {
      // Ancient Mossy Bridge Encampment with boulders, toll totem & fire
      const r1 = ModelRegistry.getInstance().cloneModel('rock_large_a') || ModelRegistry.getInstance().getRockModel(0);
      if (r1) {
        r1.scale.set(1.8, 1.6, 1.8);
        r1.position.set(-w * 0.35, 0, 0);
        group.add(r1);
      }
      const r2 = ModelRegistry.getInstance().cloneModel('rock_large_b') || ModelRegistry.getInstance().getRockModel(1);
      if (r2) {
        r2.scale.set(1.8, 1.6, 1.8);
        r2.position.set(w * 0.35, 0, 0);
        group.add(r2);
      }

      // Stone Bridge Arch Lair Structure
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0x475569, map: this.royalCastleWallTexture, roughness: 0.9 });
      const arch = new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, 5, h * 0.5), stoneMat);
      arch.position.set(0, 6, 0);
      arch.castShadow = true;
      group.add(arch);

      const weaponRack = ModelRegistry.getInstance().cloneModel('weaponrack');
      if (weaponRack) {
        weaponRack.scale.set(1.3, 1.3, 1.3);
        weaponRack.position.set(w * 0.28, 0.2, h * 0.28);
        group.add(weaponRack);
      }

      const skullPost = ModelRegistry.getInstance().cloneModel('post_skull');
      if (skullPost) {
        skullPost.scale.set(1.4, 1.4, 1.4);
        skullPost.position.set(-w * 0.32, 0.2, h * 0.28);
        group.add(skullPost);
      }

      // Troll Firepit
      const fireRingMat = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 1.0 });
      for (let fr = 0; fr < 6; fr++) {
        const ang = (fr / 6) * Math.PI * 2;
        const ringStone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8, 0), fireRingMat);
        ringStone.position.set(Math.cos(ang) * 3.2, 0.5, h * 0.22 + Math.sin(ang) * 3.2);
        group.add(ringStone);
      }
      const emberMat = new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xdc2626, emissiveIntensity: 2.0 });
      const ember = new THREE.Mesh(new THREE.SphereGeometry(0.9, 6, 6), emberMat);
      ember.position.set(0, 0.6, h * 0.22);
      group.add(ember);
    } else if (lair.type === 'dark_castle') {
      // Authentic Dark Sovereign Gothic Keep
      const gltfCastle = ModelRegistry.getInstance().cloneModel('dark_castle_keep');
      if (gltfCastle) {
        const box = new THREE.Box3().setFromObject(gltfCastle);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);

        const maxDim = Math.max(size.x, size.z);
        const targetDim = Math.min(w, h) * 0.88;
        const scale = maxDim > 0 ? targetDim / maxDim : 1.0;

        gltfCastle.scale.set(scale, scale, scale);
        gltfCastle.position.set(-center.x * scale, -box.min.y * scale + 0.1, -center.z * scale);
        group.add(gltfCastle);
      }

      const redFlag = ModelRegistry.getInstance().cloneModel('flag_red');
      if (redFlag) {
        redFlag.scale.set(1.6, 1.6, 1.6);
        redFlag.position.set(w * 0.38, 0.2, h * 0.38);
        group.add(redFlag);
      }
      const skullPost = ModelRegistry.getInstance().cloneModel('post_skull');
      if (skullPost) {
        skullPost.scale.set(1.5, 1.5, 1.5);
        skullPost.position.set(-w * 0.38, 0.2, h * 0.38);
        group.add(skullPost);
      }
      const deadTree = ModelRegistry.getInstance().cloneModel('tree_dead_large');
      if (deadTree) {
        deadTree.scale.set(1.3, 1.3, 1.3);
        deadTree.position.set(w * 0.36, 0.2, -h * 0.32);
        group.add(deadTree);
      }
      const tomb = ModelRegistry.getInstance().cloneModel('gravestone');
      if (tomb) {
        tomb.scale.set(1.4, 1.4, 1.4);
        tomb.position.set(-w * 0.34, 0.2, -h * 0.28);
        group.add(tomb);
      }
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

  // --- 3D POINTS OF INTEREST (SHRINES, GOLD MINES, ANCIENT VAULTS) ---
  private updatePointsOfInterest(state: GameState) {
    if (!state.pointsOfInterest) return;
    const activeIds = new Set<string>();
    const time = Date.now() * 0.003;

    for (const poi of state.pointsOfInterest) {
      activeIds.add(poi.id);
      let group = this.poisMap.get(poi.id);

      if (!group) {
        group = this.create3DPOIMesh(poi);
        this.scene.add(group);
        this.poisMap.set(poi.id, group);
      }

      const ts = this.gridManager.tileSize;
      const px = (poi.x + poi.width / 2) * ts;
      const pz = (poi.y + poi.height / 2) * ts;
      const groundY = this.getTerrainHeight(px, pz);

      group.position.set(px, groundY, pz);
      group.visible = this.gridManager.isPixelExplored(px, pz);

      // Animate hovering shrine crystal or rune glow
      const crystal = group.getObjectByName('shrineCrystal');
      if (crystal) {
        crystal.rotation.y = time * 1.5;
        crystal.position.y = 12.0 + Math.sin(time * 2.0) * 1.2;
      }
      const runeLight = group.getObjectByName('vaultRuneLight');
      if (runeLight && runeLight instanceof THREE.Mesh && runeLight.material instanceof THREE.MeshStandardMaterial) {
        runeLight.material.emissiveIntensity = 1.0 + Math.sin(time * 3.0) * 0.5;
      }
    }

    for (const [id, group] of this.poisMap.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(group);
        this.poisMap.delete(id);
      }
    }
  }

  private create3DPOIMesh(poi: PointOfInterest): THREE.Group {
    const group = new THREE.Group();
    const ts = this.gridManager.tileSize;
    const w = poi.width * ts;
    const h = poi.height * ts;

    if (poi.type === 'healing_shrine') {
      // Holy Colonnade Fountain: circular marble plinth, 4 columns, blue holy water pool, floating cyan crystal
      const marbleMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.35 });
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.85, roughness: 0.2 });
      const waterMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.8, roughness: 0.1 });

      const plinth = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.42, w * 0.46, 2.0, 16), marbleMat);
      plinth.position.y = 1.0;
      plinth.receiveShadow = true;
      group.add(plinth);

      const pool = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.32, w * 0.32, 0.4, 16), waterMat);
      pool.position.y = 2.1;
      group.add(pool);

      const numCols = 4;
      for (let i = 0; i < numCols; i++) {
        const ang = (i / numCols) * Math.PI * 2 + Math.PI / 4;
        const cx = Math.cos(ang) * (w * 0.34);
        const cz = Math.sin(ang) * (h * 0.34);
        const col = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.4, 11, 8), marbleMat);
        col.position.set(cx, 6.5, cz);
        col.castShadow = true;
        group.add(col);

        const cap = new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.0, 3.0), goldMat);
        cap.position.set(cx, 12.5, cz);
        group.add(cap);
      }

      // Floating Sacred Cyan Healing Crystal
      const crystalGeo = new THREE.OctahedronGeometry(3.2, 0);
      const crystalMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0ea5e9,
        emissiveIntensity: 1.8,
        roughness: 0.15
      });
      const crystal = new THREE.Mesh(crystalGeo, crystalMat);
      crystal.name = 'shrineCrystal';
      crystal.position.y = 12.0;
      group.add(crystal);

      return group;
    }

    if (poi.type === 'gold_mine') {
      // Abandoned Gold Mine: KayKit mine model + gold ore piles
      const gltfMine = ModelRegistry.getInstance().getBuildingModel('dwarf_settlement');
      if (gltfMine) {
        const box = new THREE.Box3().setFromObject(gltfMine);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.z);
        const scale = maxDim > 0 ? (w * 0.85) / maxDim : 1.0;
        gltfMine.scale.set(scale, scale, scale);
        gltfMine.position.set(0, -box.min.y * scale + 0.1, 0);
        group.add(gltfMine);
      }

      const goldMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.9, roughness: 0.2 });
      for (let g = 0; g < 5; g++) {
        const ang = (g / 5) * Math.PI * 2;
        const nugget = new THREE.Mesh(new THREE.DodecahedronGeometry(1.6, 0), goldMat);
        nugget.position.set(Math.cos(ang) * (w * 0.32), 1.0, Math.sin(ang) * (h * 0.32));
        nugget.castShadow = true;
        group.add(nugget);
      }

      return group;
    }

    // Default / ancient_vault / sanctuary_altar
    const gltfCrypt = ModelRegistry.getInstance().cloneModel('crypt') || ModelRegistry.getInstance().cloneModel('ruins');
    if (gltfCrypt) {
      const box = new THREE.Box3().setFromObject(gltfCrypt);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDim = Math.max(size.x, size.z);
      const scale = maxDim > 0 ? (w * 0.88) / maxDim : 1.0;
      gltfCrypt.scale.set(scale, scale, scale);
      gltfCrypt.position.set(0, -box.min.y * scale + 0.2, 0);
      group.add(gltfCrypt);
    }

    const runeMat = new THREE.MeshStandardMaterial({
      color: 0xc084fc,
      emissive: 0x9333ea,
      emissiveIntensity: 1.5,
      roughness: 0.2
    });
    const rune = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.5, 8), runeMat);
    rune.name = 'vaultRuneLight';
    rune.position.set(0, 5, h * 0.36);
    group.add(rune);

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
      const shine = this.getPart(mesh, 'treasureGlow');
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

      flagGroup.position.set(f.x, this.getTerrainHeight(f.x, f.y), f.y);
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
    const isNightOrDusk = state.dayPhase === 'night' || state.dayPhase === 'dusk' || state.dayPhase === 'dawn';

    for (const p of state.peasants) {
      if (p.hp <= 0) continue;
      activeIds.add(p.id);
      let pGroup = this.peasantsMap.get(p.id);

      if (!pGroup) {
        pGroup = this.create3DPeasantMesh(p);
        this.scene.add(pGroup);
        this.peasantsMap.set(p.id, pGroup);
      }

      pGroup.visible = this.gridManager.isPixelVisible(p.x, p.y);

      // Night Torch illumination
      const torch = this.getPart(pGroup, 'nightTorch');
      if (torch) {
        torch.visible = isNightOrDusk;
        const flame = this.getPart(torch, 'torchFlame');
        if (flame) {
          flame.scale.y = 1.0 + Math.sin(time * 8.0) * 0.2;
        }
      }

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

      const prevPos = this.lastUnitPositions.get(p.id);
      const movedDist = prevPos ? Math.hypot(p.x - prevPos.x, p.y - prevPos.y) : 0;
      this.lastUnitPositions.set(p.id, { x: p.x, y: p.y });

      const isMoving = (movedDist > 0.04 || p.state === 'walking_to_site' || p.state === 'fleeing') && p.state !== 'idle_at_palace';
      const peasantBaseSpeed = p.state === 'fleeing' ? 60 : (p.speed || 35);
      const calculatedSpeed = movedDist > 0.02 ? (movedDist / Math.max(0.001, delta)) : peasantBaseSpeed;
      const peasantSpeed = Math.max(peasantBaseSpeed * 0.8, Math.min(peasantBaseSpeed * 1.5, calculatedSpeed));
      const strideFreq = (peasantSpeed / 35) * 3.5;

      // Update Skeletal Animation Controller if present
      const controller = this.animControllers.get(p.id);
      if (controller) {
        if (p.hp <= 0) {
          controller.play('death', 0.15);
        } else if (p.state === 'hammering_construction' || p.state === 'repairing_building') {
          controller.play('hammer', 0.15);
          controller.setTimeScale(1.0);
        } else if (isMoving) {
          const isRun = p.state === 'fleeing';
          controller.play(isRun ? 'run' : 'walk', 0.15);
          controller.setTimeScale(Math.max(1.0, isRun ? peasantSpeed / 23.0 : peasantSpeed / 16.5));
        } else {
          controller.play('idle', 0.22);
          controller.setTimeScale(1.0);
        }
      }

      // Natural gait kinematics for citizen locomotion
      const stepBob = isMoving ? Math.abs(Math.sin(time * strideFreq)) * 0.65 : 0;
      const bodySway = isMoving ? Math.sin(time * strideFreq * 0.5) * 0.04 : 0;
      const legStride = isMoving ? Math.sin(time * strideFreq) * 0.6 : 0;

      pGroup.position.set(p.x, this.getTerrainHeight(p.x, p.y) + stepBob, p.y);
      pGroup.rotation.z = bodySway;

      if (!controller) {
        const leftLeg = this.getPart(pGroup,'leftLeg');
        const rightLeg = this.getPart(pGroup,'rightLeg');
        if (leftLeg) leftLeg.rotation.x = legStride;
        if (rightLeg) rightLeg.rotation.x = -legStride;

        // Smooth Realistic Hammering Swing (no high frequency jitter)
        const rightArm = this.getPart(pGroup,'rightArm');
        if (rightArm) {
          if (p.state === 'hammering_construction' || p.state === 'repairing_building') {
            const hammerPhase = (Date.now() * 0.005) % (Math.PI * 2);
            const swing = Math.sin(hammerPhase);
            rightArm.rotation.x = -0.4 - Math.max(0, swing) * 1.5;
          } else {
            rightArm.rotation.x = isMoving ? -legStride * 0.75 : 0;
          }
        }
      }
    }

    for (const [id, group] of this.peasantsMap.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(group);
        this.peasantsMap.delete(id);
        this.lastUnitPositions.delete(id);
        const ctrl = this.animControllers.get(id);
        if (ctrl) {
          ctrl.dispose();
          this.animControllers.delete(id);
        }
      }
    }
  }

  private create3DPeasantMesh(p: Peasant): THREE.Group {
    const group = new THREE.Group();

    // Try loading animated 3D citizen model
    const animated = ModelRegistry.getInstance().createAnimatedCitizen('peasant');
    if (animated) {
      this.animControllers.set(p.id, animated.controller);
      const { group: gltfPeasant } = animated;
      const box = new THREE.Box3().setFromObject(gltfPeasant);
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);

      const targetHeight = 11.5;
      const scale = size.y > 0 ? targetHeight / size.y : 1.0;

      gltfPeasant.scale.set(scale, scale, scale);
      gltfPeasant.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
      group.add(gltfPeasant);
      return group;
    }

    return group;
  }

  // --- 3D HEROES & NAMEPLATES ---
  private updateHeroes(state: GameState, delta: number) {
    const activeIds = new Set<string>();
    const time = Date.now() * 0.01;
    const isNightOrDusk = state.dayPhase === 'night' || state.dayPhase === 'dusk' || state.dayPhase === 'dawn';

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

      heroGroup.visible = this.gridManager.isPixelVisible(h.x, h.y);

      // Night Torch illumination
      const torch = this.getPart(heroGroup, 'nightTorch');
      if (torch) {
        torch.visible = isNightOrDusk;
        const flame = this.getPart(torch, 'torchFlame');
        if (flame) {
          flame.scale.y = 1.0 + Math.sin(time * 8.0) * 0.2;
        }
      }

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

      const prevPos = this.lastUnitPositions.get(h.id);
      const movedDist = prevPos ? Math.hypot(h.x - prevPos.x, h.y - prevPos.y) : 0;
      this.lastUnitPositions.set(h.id, { x: h.x, y: h.y });

      const hasActivePath = Boolean(h.path && h.path.length > 0);
      const hasTargetDist = h.targetX !== undefined && Math.hypot(h.targetX - h.x, (h.targetY ?? h.y) - h.y) > 2.5;
      const isTravelingState = (
        h.state === 'wandering' ||
        h.state === 'pursuing_flag' ||
        h.state === 'fleeing' ||
        h.state === 'collecting_treasure' ||
        h.state === 'visiting_marketplace' ||
        h.state === 'visiting_blacksmith' ||
        h.state === 'visiting_inn' ||
        h.state === 'resting_at_guild' ||
        h.state === 'healing_ally' ||
        (h.state === 'attacking_target' && h.isAttackingAnimation <= 0)
      );

      const isMoving = (movedDist > 0.04 || hasActivePath || (hasTargetDist && isTravelingState)) && h.state !== 'idle' && h.isAttackingAnimation <= 0;
      const gameSpeedMult = state.isPaused ? 0 : Math.max(1, state.gameSpeed || 1);
      const heroNominalSpeed = (h.speed || 32) * gameSpeedMult;
      const observedSpeed = movedDist > 0.01 ? (movedDist / Math.max(0.001, delta)) : heroNominalSpeed;
      const heroActualSpeed = Math.max(heroNominalSpeed * 0.75, Math.min(heroNominalSpeed * 1.5, observedSpeed));
      
      // KayKit walk stride cycle is ~16 units per 2-step loop. Running stride is ~24 units.
      // Scaling cadence to translation speed ensures foot plants solidly without sliding or gliding.
      const isRunning = h.state === 'fleeing' || heroActualSpeed > 58;
      const walkCadence = Math.max(1.0, Math.min(3.6, isRunning ? heroActualSpeed / 23.0 : heroActualSpeed / 16.5));
      const strideFreq = walkCadence * Math.PI * 2;

      // Update Skeletal Animation Controller if present
      const controller = this.animControllers.get(h.id);
      if (controller) {
        if (h.isDead) {
          controller.play('death', 0.15);
        } else if (h.isAttackingAnimation > 0) {
          controller.play('attack', 0.12);
          controller.setTimeScale(1.0);
        } else if (isMoving) {
          controller.play(isRunning ? 'run' : 'walk', 0.15);
          // Scale leg playback rate accurately to ground translation speed
          controller.setTimeScale(walkCadence);
        } else {
          controller.play('idle', 0.22);
          controller.setTimeScale(1.0);
        }
      }

      // Natural human gait kinematics: vertical center-of-mass bobbing and subtle lateral weight shift
      // This eliminates the stiff "gliding on ice" look of flat root translation
      const stepBob = isMoving ? Math.abs(Math.sin(time * strideFreq)) * 0.7 : 0;
      const bodySway = isMoving ? Math.sin(time * strideFreq * 0.5) * 0.045 : 0;
      const legStride = isMoving ? Math.sin(time * strideFreq) * 0.65 : 0;

      const heroGroundY = this.getTerrainHeight(h.x, h.y);
      heroGroup.position.set(h.x, heroGroundY + stepBob, h.y);
      heroGroup.rotation.z = bodySway;

      if (!controller) {
        const leftLeg = this.getPart(heroGroup,'leftLeg');
        const rightLeg = this.getPart(heroGroup,'rightLeg');
        if (leftLeg) leftLeg.rotation.x = legStride;
        if (rightLeg) rightLeg.rotation.x = -legStride;

        const rightArm = this.getPart(heroGroup,'rightArm');
        const leftArm = this.getPart(heroGroup,'leftArm');

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
    }

    for (const [id, group] of this.heroesMap.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(group);
        this.heroesMap.delete(id);
        this.lastUnitPositions.delete(id);
        const ctrl = this.animControllers.get(id);
        if (ctrl) {
          ctrl.dispose();
          this.animControllers.delete(id);
        }
        const labelEntry = this.heroLabelsMap.get(id);
        if (labelEntry) {
          labelEntry.texture.dispose();
          labelEntry.sprite.material.dispose();
          this.heroLabelsMap.delete(id);
        }
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
      depthTest: false,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(38, 9.5, 1);
    const headY = hero.heroClass === 'dwarf' ? 18.0 : 21.0;
    sprite.position.set(0, headY, 0);
    sprite.name = 'nameLabel';
    sprite.renderOrder = 1000;

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

    // Throttle nameplate redraws to significant HP shifts (> 4% HP), full health recovery, or level up
    const hpDiff = Math.abs(entry.lastHp - hero.hp);
    const maxHp = hero.maxHp || 100;
    const isLevelChanged = entry.lastLevel !== hero.level;
    const isMajorHpChange = hpDiff >= Math.max(6, maxHp * 0.04);
    const isFullRecovery = hero.hp >= maxHp && entry.lastHp < maxHp;
    const isZeroHp = hero.hp <= 0 && entry.lastHp > 0;

    if (isMajorHpChange || isLevelChanged || isFullRecovery || isZeroHp) {
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
    ctx.fillStyle = 'rgba(10, 15, 29, 0.92)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;

    ctx.beginPath();
    ctx.roundRect(14, 14, 484, 100, 22);
    ctx.fill();
    ctx.stroke();

    // Class Color Indicator Gem
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(54, 54, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Hero Name & Level Text (Bold, High-Contrast)
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${hero.name} (L${hero.level})`, 86, 50);

    // Mini Health Bar along bottom of nameplate
    const hpRatio = Math.max(0, Math.min(1, hero.hp / (hero.maxHp || 100)));
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(86, 80, 396, 16);

    ctx.fillStyle = hpRatio > 0.5 ? '#22c55e' : (hpRatio > 0.25 ? '#eab308' : '#ef4444');
    ctx.fillRect(86, 80, 396 * hpRatio, 16);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(86, 80, 396, 16);
  }

  private create3DHeroMesh(h: Hero): THREE.Group {
    const group = new THREE.Group();

    // Load the high-quality KayKit 3D GLTF animated hero character model
    const animated = ModelRegistry.getInstance().createAnimatedHero(h.heroClass);
    if (animated) {
      this.animControllers.set(h.id, animated.controller);
      const { group: gltfHero } = animated;
      const box = new THREE.Box3().setFromObject(gltfHero);
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);

      const isDwarf = h.heroClass === 'dwarf';
      const targetHeight = isDwarf ? 10.0 : 12.8;
      const scale = size.y > 0 ? targetHeight / size.y : 1.0;

      gltfHero.scale.set(scale, scale, scale);
      gltfHero.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
      group.add(gltfHero);
      return group;
    }

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

      // Flight Altitude: dragons soar majestically high, harpies swoop low
      const isFlying = m.type === 'red_dragon' || m.isFlying;
      const flightBase = m.type === 'harpy' ? 11 : 24;
      const flightAltitude = isFlying ? flightBase + Math.sin(time * 0.35) * 4 : 0;

      const isAttacking = m.isAttackingAnimation > 0;
      const attackFactor = isAttacking ? Math.sin((1 - Math.max(0, m.isAttackingAnimation) / 0.35) * Math.PI) : 0;

      const prevPos = this.lastUnitPositions.get(m.id);
      const movedDist = prevPos ? Math.hypot(m.x - prevPos.x, m.y - prevPos.y) : 0;
      this.lastUnitPositions.set(m.id, { x: m.x, y: m.y });

      const hasActivePath = Boolean(m.path && m.path.length > 0);
      const isMoving = (movedDist > 0.04 || hasActivePath || ((m.state === 'wandering' || m.state === 'raiding' || m.state === 'returning_to_lair' || (m.state === 'attacking' && !isAttacking)) && m.targetX !== undefined)) && !isAttacking;
      const monsterBaseSpeed = m.speed || 40;
      const calculatedSpeed = movedDist > 0.02 ? (movedDist / Math.max(0.001, delta)) : monsterBaseSpeed;
      const monsterSpeed = Math.max(monsterBaseSpeed * 0.8, Math.min(monsterBaseSpeed * 1.5, calculatedSpeed));
      const strideFreq = (monsterSpeed / 40) * 3.5;
      const walkStride = isMoving ? Math.sin(time * strideFreq) * 0.55 : 0;

      // Update Skeletal Animation Controller if present
      const controller = this.animControllers.get(m.id);
      if (controller) {
        if (m.hp <= 0) {
          controller.play('death', 0.15);
        } else if (isAttacking) {
          controller.play('attack', 0.12);
          controller.setTimeScale(1.0);
        } else if (isMoving) {
          const isRun = monsterSpeed > 58;
          controller.play(isRun ? 'run' : 'walk', 0.18);
          controller.setTimeScale(isRun ? monsterSpeed / 65 : monsterSpeed / 38);
        } else {
          controller.play('idle', 0.22);
          controller.setTimeScale(1.0);
        }
      }

      const stepBob = !controller && !isFlying && isMoving ? Math.abs(Math.sin(time * strideFreq)) * 0.9 : 0;
      mGroup.position.set(m.x, this.getTerrainHeight(m.x, m.y) + flightAltitude + stepBob, m.y);
      if (!isFlying) {
        mGroup.rotation.z = !controller && isMoving ? Math.sin(time * strideFreq) * 0.08 : 0;
      }
      mGroup.visible = this.gridManager.isPixelVisible(m.x, m.y);

      // Keep ground shadow projected on terrain beneath flying dragon
      const groundShadow = this.getPart(mGroup,'dragonShadow');
      if (groundShadow) {
        groundShadow.position.y = -flightAltitude + 0.2;
      }

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

      // Type-specific Attack & Locomotion Animations
      if (m.type === 'red_dragon') {
        const wingL = this.getPart(mGroup,'wingL');
        const wingR = this.getPart(mGroup,'wingR');
        const dragonHead = this.getPart(mGroup,'dragonHead');
        const dragonTail = this.getPart(mGroup,'dragonTail');
        const dragonBody = this.getPart(mGroup,'dragonBody');

        // Dynamic Soaring & Wing Flap: vigorous wing beat when moving/attacking, steady soaring glide when hovering
        const flapRate = isMoving ? 0.95 : 0.45;
        const flap = Math.sin(time * flapRate) * 0.65;

        if (wingL) {
          wingL.rotation.z = flap + (isAttacking ? attackFactor * 0.4 : 0);
          wingL.rotation.y = Math.cos(time * flapRate) * 0.15;
        }
        if (wingR) {
          wingR.rotation.z = -flap - (isAttacking ? attackFactor * 0.4 : 0);
          wingR.rotation.y = -Math.cos(time * flapRate) * 0.15;
        }

        if (dragonHead) {
          if (isAttacking) {
            dragonHead.position.z = 8 + attackFactor * 6;
            dragonHead.rotation.x = -attackFactor * 0.4;
          } else {
            dragonHead.position.z = 8;
            dragonHead.rotation.x = Math.sin(time * 0.4) * 0.15;
          }
        }

        if (dragonTail) {
          dragonTail.rotation.y = Math.sin(time * 0.6) * 0.45;
          dragonTail.rotation.x = Math.cos(time * 0.3) * 0.1;
        }

        if (dragonBody) {
          // Slight banking / pitch when swooping
          dragonBody.rotation.x = isAttacking ? -0.2 : Math.sin(time * 0.4) * 0.06;
        }
      } else if (m.type === 'giant_rat') {
        const ratTail = this.getPart(mGroup,'ratTail');
        const paw1 = this.getPart(mGroup,'paw1');
        const paw2 = this.getPart(mGroup,'paw2');
        const ratHead = this.getPart(mGroup,'ratHead');
        const ratBody = this.getPart(mGroup,'ratBody');

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
        const rightArm = this.getPart(mGroup,'rightArm');
        const leftArm = this.getPart(mGroup,'leftArm');
        const leftLeg = this.getPart(mGroup,'leftLeg');
        const rightLeg = this.getPart(mGroup,'rightLeg');

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
        const rightArm = this.getPart(mGroup,'rightArm');
        const leftArm = this.getPart(mGroup,'leftArm');
        const leftLeg = this.getPart(mGroup,'leftLeg');
        const rightLeg = this.getPart(mGroup,'rightLeg');

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
        const rightArm = this.getPart(mGroup,'rightArm');
        const leftArm = this.getPart(mGroup,'leftArm');
        const leftLeg = this.getPart(mGroup,'leftLeg');
        const rightLeg = this.getPart(mGroup,'rightLeg');

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
        const rightArm = this.getPart(mGroup,'rightArm');
        const leftLeg = this.getPart(mGroup,'leftLeg');
        const rightLeg = this.getPart(mGroup,'rightLeg');

        if (leftLeg) leftLeg.rotation.x = walkStride;
        if (rightLeg) rightLeg.rotation.x = -walkStride;

        if (rightArm) {
          if (isAttacking) {
            rightArm.rotation.x = -1.6 - attackFactor * 0.5;
          } else {
            rightArm.rotation.x = -0.4;
          }
        }
      } else if (m.type === 'dire_wolf' || m.type === 'werewolf' || m.type === 'troll') {
        const wolfTail = this.getPart(mGroup,'wolfTail');
        const paw1 = this.getPart(mGroup,'paw1');
        const paw2 = this.getPart(mGroup,'paw2');
        const wolfHead = this.getPart(mGroup,'wolfHead');
        const wolfBody = this.getPart(mGroup,'wolfBody');

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
        const rightArm = this.getPart(mGroup,'rightArm');
        const leftArm = this.getPart(mGroup,'leftArm');
        const leftLeg = this.getPart(mGroup,'leftLeg');
        const rightLeg = this.getPart(mGroup,'rightLeg');

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
      } else if (m.type === 'necromancer' || m.type === 'vampire_lord') {
        const rightArm = this.getPart(mGroup,'rightArm');
        const leftArm = this.getPart(mGroup,'leftArm');

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
      } else if (m.type === 'harpy') {
        const wingL = this.getPart(mGroup,'wingL');
        const wingR = this.getPart(mGroup,'wingR');
        const flap = Math.sin(time * (isMoving ? 9 : 5)) * 0.55;
        if (wingL) wingL.rotation.z = flap;
        if (wingR) wingR.rotation.z = -flap;
        if (isAttacking) {
          mGroup.position.y += attackFactor * 2.0;
        }
      }
    }

    for (const [id, group] of this.monstersMap.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(group);
        this.monstersMap.delete(id);
        this.lastUnitPositions.delete(id);
        const ctrl = this.animControllers.get(id);
        if (ctrl) {
          ctrl.dispose();
          this.animControllers.delete(id);
        }
      }
    }
  }

  private create3DMonsterMesh(m: Monster): THREE.Group {
    const group = new THREE.Group();

    // Check if high-quality 3D animated model exists for this monster
    // (KayKit humanoids via shared Rig_Medium clips, Quaternius creatures
    // via their own embedded clips — both expose the same controller)
    {
      const animated = ModelRegistry.getInstance().createAnimatedMonster(m.type);
      if (!animated && ModelRegistry.getInstance().isReady) console.warn(`Missing monster model: ${m.type}`);
      if (animated) {
        this.animControllers.set(m.id, animated.controller);
        const { group: gltfMonster } = animated;
        // Embedded Quaternius creatures carry exact bind-pose bounds measured
        // from POSITION attributes (Box3 misreads unposed skinned meshes).
        const embedded = animated as typeof animated & { baseBounds?: THREE.Box3 };
        const box = embedded.baseBounds ? embedded.baseBounds.clone() : new THREE.Box3().setFromObject(gltfMonster);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);

        let targetHeight = 12.0;
        if (m.type === 'werewolf') targetHeight = 16.0;
        else if (m.type === 'dire_wolf') targetHeight = 15.0;
        else if (m.type === 'vampire_lord') targetHeight = 18.0;
        else if (m.type === 'necromancer') targetHeight = 14.0;
        else if (m.type === 'troll') targetHeight = 18.0;
        else if (m.type === 'minotaur') targetHeight = 17.0;
        else if (m.type === 'harpy') targetHeight = 12.0;
        else if (m.type === 'red_dragon') targetHeight = 24.0;
        else if (m.type === 'giant_rat') targetHeight = 7.0;
        else if (m.type === 'zombie') targetHeight = 13.0;
        else if (m.type === 'goblin_spearman' || m.type === 'goblin_shaman') targetHeight = 11.0;

        const scale = size.y > 0 ? targetHeight / size.y : 1.0;

        gltfMonster.scale.set(scale, scale, scale);
        gltfMonster.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
        group.add(gltfMonster);
        return group;
      }
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

      tcGroup.position.set(tc.x, this.getTerrainHeight(tc.x, tc.y), tc.y);
      tcGroup.visible = this.gridManager.isPixelVisible(tc.x, tc.y);

      // Night Hand Lantern illumination
      const isNightOrDusk = state.dayPhase === 'night' || state.dayPhase === 'dusk' || state.dayPhase === 'dawn';
      const torch = this.getPart(tcGroup, 'nightTorch');
      if (torch) {
        torch.visible = isNightOrDusk;
        const flame = this.getPart(torch, 'torchFlame');
        if (flame) {
          flame.scale.y = 1.0 + Math.sin(time * 8.0) * 0.2;
        }
      }

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

      const prevPos = this.lastUnitPositions.get(tc.id);
      const movedDist = prevPos ? Math.hypot(tc.x - prevPos.x, tc.y - prevPos.y) : 0;
      this.lastUnitPositions.set(tc.id, { x: tc.x, y: tc.y });

      const hasActivePath = Boolean(tc.path && tc.path.length > 0);
      const isMoving = movedDist > 0.04 || hasActivePath || tc.state === 'seeking_building' || tc.state === 'returning_to_palace' || tc.state === 'fleeing';
      const tcBaseSpeed = tc.state === 'fleeing' ? 68 : (tc.speed || 42);
      const calculatedSpeed = movedDist > 0.02 ? (movedDist / Math.max(0.001, delta)) : tcBaseSpeed;
      const tcSpeed = Math.max(tcBaseSpeed * 0.8, Math.min(tcBaseSpeed * 1.5, calculatedSpeed));
      const strideFreq = (tcSpeed / 40) * 3.5;

      // Update Skeletal Animation Controller if present
      const controller = this.animControllers.get(tc.id);
      if (controller) {
        if (tc.hp <= 0) {
          controller.play('death', 0.15);
        } else if (isMoving) {
          const isRun = tc.state === 'fleeing';
          controller.play(isRun ? 'run' : 'walk', 0.15);
          controller.setTimeScale(Math.max(1.0, isRun ? tcSpeed / 23.0 : tcSpeed / 16.5));
        } else {
          controller.play('idle', 0.22);
          controller.setTimeScale(1.0);
        }
      }

      // Natural gait kinematics for tax collector locomotion
      const stepBob = isMoving ? Math.abs(Math.sin(time * strideFreq)) * 0.65 : 0;
      const bodySway = isMoving ? Math.sin(time * strideFreq * 0.5) * 0.04 : 0;
      const legStride = isMoving ? Math.sin(time * strideFreq) * 0.55 : 0;

      tcGroup.position.set(tc.x, this.getTerrainHeight(tc.x, tc.y) + stepBob, tc.y);
      tcGroup.rotation.z = bodySway;

      if (!controller) {
        const leftLeg = this.getPart(tcGroup,'leftLeg');
        const rightLeg = this.getPart(tcGroup,'rightLeg');
        if (leftLeg) leftLeg.rotation.x = legStride;
        if (rightLeg) rightLeg.rotation.x = -legStride;
      }

      // Dynamic Gold Sack Expansion
      const sack = this.getPart(tcGroup,'taxSack');
      if (sack) {
        const scaleFactor = 1.0 + Math.min(1.2, tc.goldCarried / 120);
        sack.scale.setScalar(scaleFactor);
      }
    }

    for (const [id, group] of this.taxCollectorsMap.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(group);
        this.taxCollectorsMap.delete(id);
        this.lastUnitPositions.delete(id);
        const ctrl = this.animControllers.get(id);
        if (ctrl) {
          ctrl.dispose();
          this.animControllers.delete(id);
        }
      }
    }
  }

  private create3DTaxCollectorMesh(tc: TaxCollector): THREE.Group {
    const group = new THREE.Group();

    // Try loading animated 3D citizen model
    const animated = ModelRegistry.getInstance().createAnimatedCitizen('tax_collector');
    if (animated) {
      this.animControllers.set(tc.id, animated.controller);
      const { group: gltfTC } = animated;
      const box = new THREE.Box3().setFromObject(gltfTC);
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);

      const targetHeight = 11.5;
      const scale = size.y > 0 ? targetHeight / size.y : 1.0;

      gltfTC.scale.set(scale, scale, scale);
      gltfTC.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
      group.add(gltfTC);
      return group;
    }

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

    if (c.type === 'building_ruin') {
      const ts = this.gridManager.tileSize;
      const w = (c.width || 3) * ts;
      const h = (c.height || 3) * ts;

      const charMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.95 });
      const emberMat = new THREE.MeshStandardMaterial({
        color: 0xf97316,
        emissive: 0xd97706,
        emissiveIntensity: 1.8
      });

      // 1. Charred Crumbled Foundation Plinth
      const plinthGeo = new THREE.BoxGeometry(w * 0.94, 1.2, h * 0.94);
      const plinth = new THREE.Mesh(plinthGeo, charMat);
      plinth.position.y = 0.6;
      plinth.receiveShadow = true;
      group.add(plinth);

      // 2. High-Quality Authentic KayKit 3D Ruins Model
      const gltfRuins = ModelRegistry.getInstance().cloneModel('ruins');
      if (gltfRuins) {
        const box = new THREE.Box3().setFromObject(gltfRuins);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);

        const maxDim = Math.max(size.x, size.z);
        const targetDim = Math.min(w, h) * 0.92;
        const scale = maxDim > 0 ? targetDim / maxDim : 1.0;

        gltfRuins.scale.set(scale, scale, scale);
        gltfRuins.position.set(-center.x * scale, -box.min.y * scale + 0.8, -center.z * scale);
        group.add(gltfRuins);
      }

      // 3. Glowing Embers in the Ashes
      for (let e = 0; e < 4; e++) {
        const emberGeo = new THREE.SphereGeometry(0.7, 5, 5);
        const ember = new THREE.Mesh(emberGeo, emberMat);
        ember.position.set(Math.sin(e * 2.3) * w * 0.25, 1.0, Math.cos(e * 2.3) * h * 0.25);
        group.add(ember);
      }

      // 4. Plume of Rising Smoke
      const smoke = this.createSmokeEmitter(0, 3.0, 0, true, 4);
      group.add(smoke);

      return group;
    } else if (c.type === 'hero') {
      // Wooden Grave Cross with Fallen Iron Helmet, Sword & Divine Memorial Glow
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

      // Holy memorial candle / subtle golden aura
      const auraGeo = new THREE.CylinderGeometry(4.5, 4.5, 0.2, 12);
      const auraMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24, transparent: true, opacity: 0.22 });
      const aura = new THREE.Mesh(auraGeo, auraMat);
      aura.position.y = 0.1;
      group.add(aura);
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
        sprite.material.dispose();
        this.floatingTextsMap.delete(id);
      }
    }
  }

  private createFloatingTextSprite(ft: FloatingText): THREE.Sprite {
    // Sanitize any raw floating point fractions into clean integers (e.g. 4.000000003 -> 4)
    const displayText = ft.text.replace(/(\d+)\.\d+/g, (match) => Math.round(parseFloat(match)).toString());
    const isGold = displayText.includes('g') || displayText.includes('Tax') || displayText.includes('Treasury') || displayText.includes('Bounty') || displayText.includes('Loot') || displayText.includes('Ale');
    const cacheKey = `${displayText}_${ft.color || '#ffffff'}_${isGold}`;

    let texture = this.floatingTextTextureCache.get(cacheKey);
    if (!texture) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 80;
      const ctx = canvas.getContext('2d');
      if (!ctx) return new THREE.Sprite();

      if (isGold) {
        // 1. Draw Large 3D Shaded Metallic Sovereign Gold Coin
        const cx = 36;
        const cy = 40;
        const r = 26;

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
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
        ctx.stroke();

        // Crown sovereign symbol
        ctx.fillStyle = '#78350f';
        ctx.font = 'bold 24px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('👑', cx, cy - 1);

        // 2. Draw Transaction Sum in Large Crisp Typography with outline
        ctx.font = 'bold 32px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 6;
        ctx.strokeText(displayText, 72, cy);

        ctx.fillStyle = '#fef08a';
        ctx.fillText(displayText, 72, cy);
      } else {
        // Combat damage, healing, or level up banner
        ctx.font = 'bold 30px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 6;
        ctx.strokeText(displayText, 128, 40);

        ctx.fillStyle = ft.color || '#ffffff';
        ctx.fillText(displayText, 128, 40);
      }

      texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      this.floatingTextTextureCache.set(cacheKey, texture);
    }

    const spriteMat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(isGold ? 48 : 38, isGold ? 15.0 : 11.875, 1);
    sprite.renderOrder = 1001;
    return sprite;
  }

  // --- 3D SLEEPING "ZZZ" DRIFTING ANIMATION SYSTEM (HIGH-PERFORMANCE GPU FLOATING) ---
  private getOrCreateSleepTexture(): THREE.CanvasTexture {
    if (this.sharedSleepTexture) return this.sharedSleepTexture;
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    // Soft celestial glow shadow
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 10;

    // Dark outline for readability
    ctx.strokeStyle = '#030712';
    ctx.lineWidth = 4.5;

    // Draw 3 ascending Z's
    const zList = [
      { char: 'z', size: 20, x: 38, y: 92, color: '#38bdf8' },
      { char: 'Z', size: 28, x: 58, y: 64, color: '#7dd3fc' },
      { char: 'Z', size: 36, x: 84, y: 34, color: '#e0f2fe' }
    ];

    for (const item of zList) {
      ctx.font = `bold ${item.size}px "Comic Sans MS", "Segoe UI", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeText(item.char, item.x, item.y);
      ctx.fillStyle = item.color;
      ctx.fillText(item.char, item.x, item.y);
    }

    this.sharedSleepTexture = new THREE.CanvasTexture(canvas);
    this.sharedSleepTexture.minFilter = THREE.LinearFilter;
    return this.sharedSleepTexture;
  }

  private updateSleepingAnimations(state: GameState, delta: number) {
    const activeSleepingIds = new Set<string>();
    const time = Date.now() * 0.001;
    const isDeadOfNight = state.stats.dayTime >= 2300 || state.stats.dayTime < 350;

    // 1. Heroes resting / sleeping at Guild or Inn (must have arrived and NOT currently moving/walking!)
    for (const h of state.heroes) {
      if (h.isDead) continue;
      const isRestingState = h.state === 'resting_at_guild' || h.state === 'visiting_inn';
      // Never render Zzz while walking/traveling toward the guild or inn
      const isWalking = h.targetX !== undefined || (h.path && h.path.length > 0);
      const isResting = isRestingState && !isWalking;
      if (isResting) {
        const id = `sleep_${h.id}`;
        activeSleepingIds.add(id);
        this.renderUnitSleepZzz(id, h.x, h.y, 22, time, this.gridManager.isPixelVisible(h.x, h.y));
      }
    }

    // 2. Peasants / Builders sleeping during the Dead of Night (must be resting at palace, not walking)
    if (isDeadOfNight) {
      for (const p of state.peasants) {
        if (p.hp <= 0) continue;
        const isWalking = (p.path && p.path.length > 0) || p.state === 'walking_to_site' || p.state === 'fleeing';
        if (p.state === 'idle_at_palace' && !isWalking) {
          const id = `sleep_${p.id}`;
          activeSleepingIds.add(id);
          this.renderUnitSleepZzz(id, p.x, p.y, 14, time, this.gridManager.isPixelVisible(p.x, p.y));
        }
      }
    }

    // Clean up inactive sleep sprites
    for (const [id, sprite] of this.sleepingSpritesMap.entries()) {
      if (!activeSleepingIds.has(id)) {
        this.scene.remove(sprite);
        sprite.material.dispose();
        this.sleepingSpritesMap.delete(id);
      }
    }
  }

  private renderUnitSleepZzz(id: string, worldX: number, worldY: number, baseHeight: number, time: number, isVisible: boolean) {
    let sprite = this.sleepingSpritesMap.get(id);
    if (!sprite) {
      const texture = this.getOrCreateSleepTexture();
      const spriteMat = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false
      });
      sprite = new THREE.Sprite(spriteMat);
      sprite.renderOrder = 1000;
      this.scene.add(sprite);
      this.sleepingSpritesMap.set(id, sprite);
    }

    sprite.visible = isVisible;
    if (!isVisible) return;

    // Smooth GPU-side floating animation (0 CPU redraws, 0 texture uploads!)
    const loopPhase = (time * 0.6) % 1.0;
    const driftX = Math.sin(time * 2.2) * 2.5;
    const floatY = loopPhase * 7.0;
    const pulseOpacity = Math.sin(loopPhase * Math.PI) * 0.95;
    const scale = 11 + Math.sin(time * 2.0) * 1.0;

    sprite.scale.set(scale, scale, 1);
    if (sprite.material) {
      sprite.material.opacity = Math.max(0, Math.min(1, pulseOpacity));
    }

    const terrainH = this.getTerrainHeight(worldX, worldY);
    sprite.position.set(worldX + 3 + driftX, terrainH + baseHeight + floatY, worldY);
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
