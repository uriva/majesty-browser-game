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
  private grassBumpTexture: THREE.CanvasTexture;
  private cobbleTexture: THREE.CanvasTexture;
  private stoneWallTexture: THREE.CanvasTexture;
  private thatchTexture: THREE.CanvasTexture;
  private royalCastleWallTexture: THREE.CanvasTexture;
  private royalRoofSlateTexture: THREE.CanvasTexture;
  private royalCastleRoofTexture: THREE.CanvasTexture;
  private tudorWallTexture: THREE.CanvasTexture;
  private timberLogTexture: THREE.CanvasTexture;
  private stainedGlassTexture: THREE.CanvasTexture;
  private blueprintTexture: THREE.CanvasTexture;
  private tentTexture: THREE.CanvasTexture;
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
  private fogMesh: THREE.Mesh | null = null;

  // Object pools / mappings
  private terrainGroup: THREE.Group;
  private terrainFeaturesList: THREE.Object3D[] = [];
  private waterfallsGroup: THREE.Group;
  private waterfallsList: THREE.Group[] = [];
  private roadsGroup: THREE.Group;
  private streetLampsGroup: THREE.Group;
  private streetLampsList: THREE.Object3D[] = [];
  private lastRoadVersion: number = -1;
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
  public targetCameraDistance: number = 380;
  public cameraPitch: number = 0.82; // Majestic isometric 3D angle (~47 deg)
  public cameraYaw: number = Math.PI / 4; // 45-degree diagonal isometric angle
  public cameraMode: 'isometric' | 'free' | 'top_down' | 'follow' = 'isometric';
  private lastRenderTime: number = performance.now();

  constructor(container: HTMLDivElement, gridManager: GridManager) {
    this.container = container;
    this.gridManager = gridManager;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // Generate Procedural Textures
    this.grassTexture = this.createGrassTexture();
    this.grassBumpTexture = this.createGrassBumpTexture();
    this.cobbleTexture = this.createCobbleTexture();
    this.stoneWallTexture = this.createStoneWallTexture();
    this.thatchTexture = this.createThatchTexture();
    this.royalCastleWallTexture = this.createRoyalCastleWallTexture();
    this.royalRoofSlateTexture = this.createRoyalRoofSlateTexture();
    this.royalCastleRoofTexture = this.createRoyalCastleRoofTexture();
    this.tudorWallTexture = this.createTudorWallTexture();
    this.timberLogTexture = this.createTimberLogTexture();
    this.stainedGlassTexture = this.createStainedGlassTexture();
    this.blueprintTexture = this.createBlueprintTexture();
    this.tentTexture = this.createTentTexture();
    this.brickRoadTexture = this.createBrickRoadTexture();
    this.softRadialGlowTexture = this.createSoftRadialGlowTexture();
    this.riverTexture = this.createWaterFlowTexture();
    this.waterfallTexture = this.createWaterfallTexture();

    // Unified Ground Road Decal Canvas (4096x4096 high-res texture)
    this.roadCanvas = document.createElement('canvas');
    this.roadCanvas.width = 4096;
    this.roadCanvas.height = 4096;
    this.roadCtx = this.roadCanvas.getContext('2d')!;
    this.roadTexture = new THREE.CanvasTexture(this.roadCanvas);
    this.roadTexture.anisotropy = 16;
    this.roadTexture.minFilter = THREE.LinearMipmapLinearFilter;
    this.roadTexture.magFilter = THREE.LinearFilter;
    this.roadTexture.generateMipmaps = true;

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
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    container.appendChild(this.renderer.domElement);

    // Apply Maximum Hardware Anisotropic Filtering for Razor-Sharp Isometric Terrain & Roads
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.roadTexture.anisotropy = maxAniso;
    this.grassTexture.anisotropy = maxAniso;
    this.grassBumpTexture.anisotropy = maxAniso;
    this.cobbleTexture.anisotropy = maxAniso;

    // 4. Lighting
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x334155, 0.45);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xfffbeb, 1.4);
    this.dirLight.position.set(250, 400, 200);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 4096;
    this.dirLight.shadow.mapSize.height = 4096;
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

    this.scene.add(this.terrainGroup);
    this.scene.add(this.waterfallsGroup);
    this.scene.add(this.roadsGroup);
    this.scene.add(this.streetLampsGroup);
    this.scene.add(this.fogGroup);
    this.scene.add(this.selectionGroup);
    this.scene.add(this.placementPreviewGroup);

    this.buildTerrain();
    this.buildFogOfWar();
    this.buildSelectionMeshes();
  }

  // --- PROCEDURAL TEXTURE GENERATORS ---
  private createGrassTexture(): THREE.CanvasTexture {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // 1. Multi-Octave Rich Fantasy Meadow Base Gradient
    ctx.fillStyle = '#22533a';
    ctx.fillRect(0, 0, size, size);

    // Large organic tonal patches (undulating meadow lighting)
    const tones = ['#1e4620', '#2d6a4f', '#387a55', '#40916c', '#52796f', '#355834', '#4b7c59'];
    for (let i = 0; i < 48; i++) {
      const px = ((i * 197) % size);
      const py = ((i * 311) % size);
      const radius = 90 + ((i * 37) % 110);
      const grad = ctx.createRadialGradient(px, py, 0, px, py, radius);
      grad.addColorStop(0, tones[i % tones.length]);
      grad.addColorStop(0.7, tones[(i + 1) % tones.length]);
      grad.addColorStop(1, 'rgba(34, 83, 58, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Medium soft loam & moss pockets
    for (let i = 0; i < 120; i++) {
      const mx = ((i * 139) % size);
      const my = ((i * 277) % size);
      const mr = 20 + ((i * 17) % 35);
      const mossGrad = ctx.createRadialGradient(mx, my, 0, mx, my, mr);
      mossGrad.addColorStop(0, i % 2 === 0 ? '#1b3d22' : '#4d7c0f');
      mossGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = mossGrad;
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Dense Hand-Painted Organic Grass Blade Tufts (3,500 blades)
    const bladeColors = ['#1b4332', '#2d6a4f', '#40916c', '#52b788', '#74c69d', '#95d5b2', '#a7c957', '#d8f3dc'];
    for (let b = 0; b < 3600; b++) {
      const bx = ((b * 73 + (b % 17) * 41) % size);
      const by = ((b * 127 + (b % 23) * 59) % size);
      const bladeH = 6 + (b % 9);
      const curve = ((b % 7) - 3) * 1.5;
      const col = bladeColors[b % bladeColors.length];

      ctx.strokeStyle = col;
      ctx.lineWidth = 1.2 + (b % 3) * 0.4;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + curve, by - bladeH * 0.5, bx + curve * 1.4, by - bladeH);
      ctx.stroke();

      // Bright sunlit tip highlight on a fraction of blades
      if (b % 4 === 0) {
        ctx.fillStyle = '#d8f3dc';
        ctx.fillRect(bx + curve * 1.4, by - bladeH, 1.2, 1.2);
      }
    }

    // 3. Lush Clover Patches with Trifoliate Leaflets (220 clover clumps)
    for (let c = 0; c < 220; c++) {
      const cx = ((c * 241 + (c % 19) * 31) % size);
      const cy = ((c * 179 + (c % 29) * 47) % size);
      const cr = 3.5 + (c % 3);

      for (let leaf = 0; leaf < 3; leaf++) {
        const angle = (leaf * (Math.PI * 2 / 3)) + ((c % 5) * 0.3);
        const lx = cx + Math.cos(angle) * cr;
        const ly = cy + Math.sin(angle) * cr;

        // Leaf shadow
        ctx.fillStyle = '#1b4332';
        ctx.beginPath();
        ctx.arc(lx, ly, cr * 0.85, 0, Math.PI * 2);
        ctx.fill();

        // Leaf body
        ctx.fillStyle = '#40916c';
        ctx.beginPath();
        ctx.arc(lx, ly, cr * 0.7, 0, Math.PI * 2);
        ctx.fill();

        // Pale center chevron
        ctx.fillStyle = '#74c69d';
        ctx.fillRect(lx - 0.5, ly - 0.5, 1, 1);
      }
    }

    // 4. Vibrant Painterly Wildflowers (Buttercups, Poppies, Forget-Me-Nots, Daisies)
    for (let f = 0; f < 320; f++) {
      const fx = ((f * 313 + (f % 13) * 67) % size);
      const fy = ((f * 229 + (f % 31) * 83) % size);
      const type = f % 4;

      if (type === 0) {
        // Golden Buttercup / Marigold
        ctx.fillStyle = '#ca8a04';
        ctx.beginPath(); ctx.arc(fx, fy, 3.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath(); ctx.arc(fx, fy, 2.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.beginPath(); ctx.arc(fx, fy, 1.0, 0, Math.PI * 2); ctx.fill();
      } else if (type === 1) {
        // Scarlet Wild Poppy
        ctx.fillStyle = '#991b1b';
        ctx.beginPath(); ctx.arc(fx, fy, 3.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ef4444';
        ctx.beginPath(); ctx.arc(fx, fy, 2.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1c1917';
        ctx.beginPath(); ctx.arc(fx, fy, 0.9, 0, Math.PI * 2); ctx.fill();
      } else if (type === 2) {
        // Azure Alpine Forget-Me-Not
        ctx.fillStyle = '#1e40af';
        ctx.beginPath(); ctx.arc(fx, fy, 2.8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath(); ctx.arc(fx, fy, 2.0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.beginPath(); ctx.arc(fx, fy, 0.8, 0, Math.PI * 2); ctx.fill();
      } else {
        // White Meadow Daisy
        for (let p = 0; p < 5; p++) {
          const pa = p * (Math.PI * 2 / 5);
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(fx + Math.cos(pa) * 2.2, fy + Math.sin(pa) * 2.2, 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#facc15';
        ctx.beginPath(); ctx.arc(fx, fy, 1.4, 0, Math.PI * 2); ctx.fill();
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(16, 16);
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

    // Micro-grooves and blade relief
    for (let b = 0; b < 2400; b++) {
      const bx = ((b * 73 + (b % 17) * 41) % size);
      const by = ((b * 127 + (b % 23) * 59) % size);
      const bladeH = 6 + (b % 9);
      const curve = ((b % 7) - 3) * 1.5;

      // Depressed root groove
      ctx.strokeStyle = '#505050';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + curve * 0.4, by - bladeH * 0.3);
      ctx.stroke();

      // Raised blade body
      ctx.strokeStyle = '#b8b8b8';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(bx + curve * 0.4, by - bladeH * 0.3);
      ctx.lineTo(bx + curve * 1.4, by - bladeH);
      ctx.stroke();
    }

    // Raised wildflower nodes
    for (let f = 0; f < 320; f++) {
      const fx = ((f * 313 + (f % 13) * 67) % size);
      const fy = ((f * 229 + (f % 31) * 83) % size);
      ctx.fillStyle = '#d0d0d0';
      ctx.beginPath();
      ctx.arc(fx, fy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(16, 16);
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

        // Rich high-contrast ashlar stone brick palette
        const stoneColors = ['#f1f5f9', '#cbd5e1', '#94a3b8', '#e2e8f0', '#64748b', '#e2e8f0'];
        const baseColor = stoneColors[(x * 7 + y * 11) % stoneColors.length];

        ctx.fillStyle = baseColor;
        ctx.beginPath();
        ctx.roundRect(stoneX, stoneY, stoneW, stoneH, 2);
        ctx.fill();

        // 3D Chiseled top & left bevel highlight in crisp white
        ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
        ctx.fillRect(stoneX, stoneY, stoneW, 3);
        ctx.fillRect(stoneX, stoneY, 3, stoneH);

        // Deep 3D bottom & right shadow in dark slate
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(stoneX, stoneY + stoneH - 3, stoneW, 3);
        ctx.fillRect(stoneX + stoneW - 3, stoneY, 3, stoneH);

        // Weathering chiseling specks & texture grain
        for (let s = 0; s < 6; s++) {
          ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.3)';
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
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Rich dark charcoal & slate mortar base
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(0, 0, 256, 256);

    // Fine gravel & sand grit in the mortar recesses
    for (let i = 0; i < 300; i++) {
      const gx = (i * 47) % 256;
      const gy = (i * 83) % 256;
      ctx.fillStyle = (i % 2 === 0) ? '#292524' : '#0c0a09';
      ctx.fillRect(gx, gy, 1.5, 1.5);
    }

    // High-definition medieval dressed stone paver bricks
    // Across a 41.6px road on the 4096 canvas, stoneW = 14px / stoneH = 8px provides ~3-4 distinct stones across the path
    const stoneH = 8;
    const baseStoneW = 14;

    for (let y = 0; y < 256; y += stoneH) {
      const row = Math.floor(y / stoneH);
      const rowOffset = (row % 2) * (baseStoneW / 2);

      let x = -baseStoneW;
      while (x < 256 + baseStoneW) {
        // Vary stone widths slightly for organic hand-laid masonry
        const hash = Math.abs(Math.floor(x * 7.31 + y * 13.67));
        const widthVariation = (hash % 3 === 0) ? 2 : (hash % 3 === 1 ? -2 : 0);
        const curW = baseStoneW + widthVariation;

        const sx = x + rowOffset + 0.8;
        const sy = y + 0.8;
        const sw = curW - 1.6;
        const sh = stoneH - 1.6;

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
        ctx.roundRect(sx, sy, sw, sh, 1.2);
        ctx.fill();

        // 3D Top and Left chisel highlight bevel (1px crisp edge)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.fillRect(sx, sy, sw, 1);
        ctx.fillRect(sx, sy, 1, sh);

        // 3D Bottom and Right chisel drop shadow (1px crisp edge)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(sx, sy + sh - 1, sw, 1);
        ctx.fillRect(sx + sw - 1, sy, 1, sh);

        // Stone surface clefts & grain micro-texture (realistic stone detail closeup)
        const grainCount = Math.floor(sw / 3);
        for (let g = 0; g < grainCount; g++) {
          const gx = sx + 2 + ((hash + g * 5) % Math.max(1, Math.floor(sw - 4)));
          const gy = sy + 2 + ((hash * 3 + g * 7) % Math.max(1, Math.floor(sh - 4)));
          ctx.fillStyle = (g % 2 === 0) ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.22)';
          ctx.fillRect(gx, gy, 1, 1);
        }

        x += curW;
      }
    }

    return canvas;
  }

  private createRoyalCastleRoofTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Rich dark burgundy shadow underlay
    ctx.fillStyle = '#450a0a';
    ctx.fillRect(0, 0, 512, 512);

    const tileH = 14;
    const tileW = 18;

    for (let y = 0; y < 512; y += tileH) {
      const row = Math.floor(y / tileH);
      const shift = (row % 2) * (tileW / 2);
      for (let x = -tileW; x < 512 + tileW; x += tileW) {
        const tx = x + shift;
        const ty = y;

        // Majestic Sovereign Crimson & Scarlet shingle shades
        const redShades = ['#991b1b', '#b91c1c', '#dc2626', '#7f1d1d', '#b91c1c', '#ef4444'];
        const color = redShades[Math.abs(Math.floor(x * 3 + y * 7)) % redShades.length];

        ctx.fillStyle = color;
        ctx.beginPath();
        // Scalloped rounded bottom fishscale tile
        ctx.roundRect(tx + 1, ty + 1, tileW - 2, tileH - 2, [0, 0, 6, 6]);
        ctx.fill();

        // 3D Top curved highlight lip
        ctx.fillStyle = 'rgba(254, 202, 202, 0.45)';
        ctx.fillRect(tx + 2, ty + 1, tileW - 4, 2);

        // Deep 3D bottom drop shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.fillRect(tx + 2, ty + tileH - 3, tileW - 4, 2);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 6);
    return tex;
  }

  private createRoyalRoofSlateTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Deep slate base
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 512, 512);

    const tileH = 14;
    const tileW = 18;

    for (let y = 0; y < 512; y += tileH) {
      const row = Math.floor(y / tileH);
      const shift = (row % 2) * (tileW / 2);
      for (let x = -tileW; x < 512 + tileW; x += tileW) {
        const tx = x + shift;
        const ty = y;

        // Fine fishscale / diamond slate tile
        const slateColors = ['#1e3a8a', '#1e40af', '#172554', '#2563eb', '#1e293b'];
        const color = slateColors[Math.abs(Math.floor(x * 3 + y * 7)) % slateColors.length];

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.roundRect(tx + 1, ty + 1, tileW - 2, tileH - 2, [0, 0, 6, 6]);
        ctx.fill();

        // Shaded curved bottom edge
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(tx + 2, ty + 1, tileW - 4, 2);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(tx + 2, ty + tileH - 3, tileW - 4, 2);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 6);
    return tex;
  }

  private createTudorWallTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Whitewashed / cream plaster base
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(0, 0, 512, 512);

    // Subtle plaster texture
    for (let i = 0; i < 600; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255, 255, 255, 0.15)' : 'rgba(202, 138, 4, 0.08)';
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 4, 4);
    }

    // Dark Oak Timber Framework (Tudor Trusses)
    ctx.fillStyle = '#381e05';
    const beamW = 20;

    // Outer border beams
    ctx.fillRect(0, 0, 512, beamW);
    ctx.fillRect(0, 512 - beamW, 512, beamW);
    ctx.fillRect(0, 0, beamW, 512);
    ctx.fillRect(512 - beamW, 0, beamW, 512);

    // Middle horizontal and vertical beams
    ctx.fillRect(0, 256 - beamW / 2, 512, beamW);
    ctx.fillRect(256 - beamW / 2, 0, beamW, 512);

    // Diagonal cross braces
    ctx.lineWidth = beamW;
    ctx.strokeStyle = '#381e05';
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(256, 256);
    ctx.moveTo(512, 0); ctx.lineTo(256, 256);
    ctx.moveTo(0, 512); ctx.lineTo(256, 256);
    ctx.moveTo(512, 512); ctx.lineTo(256, 256);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
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

  private createStainedGlassTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 256, 256);

    // Luminous Rose Window Pattern
    const cx = 128;
    const cy = 128;
    const colors = ['#f59e0b', '#ec4899', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444'];

    for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI * 2) / 12;
      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, 100, angle, angle + (Math.PI * 2) / 12);
      ctx.closePath();
      ctx.fill();
    }

    // Lead came grid
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 6;
    for (let i = 0; i < 12; i++) {
      const angle = (i * Math.PI * 2) / 12;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * 110, cy + Math.sin(angle) * 110);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(cx, cy, 60, 0, Math.PI * 2);
    ctx.arc(cx, cy, 100, 0, Math.PI * 2);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
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

  private createTentTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Forest green weather-treated heavy canvas base
    ctx.fillStyle = '#14532d';
    ctx.fillRect(0, 0, 512, 512);

    // Canvas fabric weave texture
    for (let i = 0; i < 800; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.15)';
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 3, 3);
    }

    // Heavy stitched canvas seams & leather reinforcements
    ctx.strokeStyle = '#052e16';
    ctx.lineWidth = 14;
    ctx.strokeRect(0, 0, 512, 512);

    // Vertical canvas panels with stitching
    ctx.lineWidth = 6;
    for (let x = 64; x < 512; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x, 512);
      ctx.stroke();

      ctx.fillStyle = '#fef08a';
      for (let y = 8; y < 512; y += 16) {
        ctx.fillRect(x - 1, y, 2, 6);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
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
    return (centerX - westOffset + Math.sin(tileY * 0.13) * 5 + Math.cos(tileY * 0.05) * 3) * ts;
  }

  private getEastRiverX(worldZ: number): number {
    const ts = this.gridManager.tileSize;
    const centerX = this.gridManager.width / 2;
    const eastOffset = this.gridManager.width * 0.30;
    const tileY = worldZ / ts;
    return (centerX + eastOffset + Math.sin(tileY * 0.15 + 1.2) * 4) * ts;
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

    // Deep smooth parabolic riverbed channel for West River (width 22 units, depth 4.2 units)
    const westRiverX = this.getWestRiverX(z);
    const distWest = Math.abs(x - westRiverX);
    if (distWest < 22) {
      const t = 1.0 - (distWest / 22);
      elev -= 4.2 * (t * t);
    }

    // Deep smooth parabolic riverbed channel for East Mountain Brook (width 18 units, depth 3.6 units)
    const eastRiverX = this.getEastRiverX(z);
    const distEast = Math.abs(x - eastRiverX);
    if (distEast < 18) {
      const t = 1.0 - (distEast / 18);
      elev -= 3.6 * (t * t);
    }

    return elev;
  }

  public getRiverWaterHeight(z: number, riverType: 'west' | 'east' = 'west'): number {
    const rx = riverType === 'west' ? this.getWestRiverX(z) : this.getEastRiverX(z);
    const baseElev = this.getTerrainBaseElevation(rx, z);
    return baseElev - (riverType === 'west' ? 1.0 : 0.8);
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

      // Base lush meadow vertex tone (normalized 1.0)
      let r = 1.0, g = 1.0, b = 1.0;

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
      depthWrite: false
    });
    this.roadsMesh = new THREE.Mesh(roadDecalGeo, roadDecalMat);
    this.roadsMesh.position.set((w * ts) / 2, 0, (h * ts) / 2);
    this.roadsMesh.renderOrder = 1;
    this.roadsMesh.receiveShadow = true;
    this.scene.add(this.roadsMesh);

    // 3. Continuous Shimmering Azure Rivers
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
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
    const westRiverMesh = this.createContinuousRiverRibbon(westRiverPoints, ts * 1.8, waterMat, 'west');
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
    const eastRiverMesh = this.createContinuousRiverRibbon(eastRiverPoints, ts * 1.5, waterMat, 'east');
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
      { z: (bridgeY1 + 1) * ts, getX: (z: number) => this.getWestRiverX(z), tx: Math.floor(this.getWestRiverX((bridgeY1 + 1) * ts) / ts), ty: bridgeY1 },
      { z: (bridgeY2 + 1) * ts, getX: (z: number) => this.getWestRiverX(z), tx: Math.floor(this.getWestRiverX((bridgeY2 + 1) * ts) / ts), ty: bridgeY2 },
      { z: (bridgeY3 + 1) * ts, getX: (z: number) => this.getEastRiverX(z), tx: Math.floor(this.getEastRiverX((bridgeY3 + 1) * ts) / ts), ty: bridgeY3 }
    ];

    for (const bc of bridgeCrossings) {
      const bx = bc.getX(bc.z);
      const bz = bc.z;
      const bridge = this.create3DBridgeMesh();
      bridge.name = 'bridgeMesh';
      const bridgeY = this.getTerrainHeight(bx, bz);
      bridge.position.set(bx, bridgeY + 0.4, bz);
      bridge.userData = { tx: bc.tx, ty: bc.ty };
      this.terrainGroup.add(bridge);
      this.terrainFeaturesList.push(bridge);
      this.streetLampsList.push(bridge);
    }

    // 5. Natural Features (Trees, Rocks)
    const rockGeo = new THREE.DodecahedronGeometry(5.5, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9 });

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
          // Mountain Rock Formation
          const rock = new THREE.Mesh(rockGeo, rockMat);
          const rockY = this.getTerrainHeight(px, pz) + 3.5;
          rock.position.set(px, rockY, pz);
          rock.scale.set(1.4, 1.2, 1.3);
          rock.rotation.set((x * 0.4) % Math.PI, (y * 0.6) % Math.PI, 0.2);
          rock.castShadow = true;
          rock.receiveShadow = true;
          rock.userData = { tx: x, ty: y };
          this.terrainGroup.add(rock);
          this.terrainFeaturesList.push(rock);
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
    const spanX = 38.0;
    const spanZ = 30.0;

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

    // 1. Heavy Stone Abutment Piers on West & East Riverbanks
    const pierGeo = new THREE.BoxGeometry(6.0, 7.0, spanZ);
    const pierL = new THREE.Mesh(pierGeo, stoneMat);
    pierL.position.set(-spanX * 0.42, 0.5, 0);
    pierL.castShadow = true;
    pierL.receiveShadow = true;
    group.add(pierL);

    const pierR = new THREE.Mesh(pierGeo, stoneMat);
    pierR.position.set(spanX * 0.42, 0.5, 0);
    pierR.castShadow = true;
    pierR.receiveShadow = true;
    group.add(pierR);

    // 2. Central Stone Arch Substructure Vault (Spans across river between abutments)
    const archGeo = new THREE.BoxGeometry(spanX * 0.76, 3.2, spanZ);
    const arch = new THREE.Mesh(archGeo, stoneMat);
    arch.position.set(0, 1.2, 0);
    arch.castShadow = true;
    arch.receiveShadow = true;
    group.add(arch);

    // 3. Raised Cobblestone Roadway Deck
    const deckGeo = new THREE.BoxGeometry(spanX, 1.8, spanZ - 3.2);
    const deck = new THREE.Mesh(deckGeo, cobbleMat);
    deck.position.set(0, 2.4, 0);
    deck.castShadow = true;
    deck.receiveShadow = true;
    group.add(deck);

    // 4. Heavy Carved Stone Parapets on North & South Edges
    const parapetGeo = new THREE.BoxGeometry(spanX, 3.2, 1.6);
    const pNorth = new THREE.Mesh(parapetGeo, stoneMat);
    pNorth.position.set(0, 3.6, -spanZ / 2 + 0.8);
    pNorth.castShadow = true;
    pNorth.receiveShadow = true;
    group.add(pNorth);

    const pSouth = new THREE.Mesh(parapetGeo, stoneMat);
    pSouth.position.set(0, 3.6, spanZ / 2 - 0.8);
    pSouth.castShadow = true;
    pSouth.receiveShadow = true;
    group.add(pSouth);

    // Crenellations along North & South parapet tops
    const crenelGeo = new THREE.BoxGeometry(3.5, 1.2, 1.7);
    const numCrenels = 5;
    for (let c = 0; c < numCrenels; c++) {
      const cx = -spanX * 0.38 + c * (spanX * 0.76 / (numCrenels - 1));
      const cN = new THREE.Mesh(crenelGeo, stoneMat);
      cN.position.set(cx, 5.4, -spanZ / 2 + 0.8);
      group.add(cN);

      const cS = new THREE.Mesh(crenelGeo, stoneMat);
      cS.position.set(cx, 5.4, spanZ / 2 - 0.8);
      group.add(cS);
    }

    // 5. Four Grand Corner Stone Pedestals with Amber Lanterns
    const pedestalGeo = new THREE.BoxGeometry(2.4, 4.2, 2.4);
    const capGeo = new THREE.BoxGeometry(2.8, 0.6, 2.8);
    const bracketGeo = new THREE.CylinderGeometry(0.3, 0.45, 0.8, 6);
    const cageGeo = new THREE.BoxGeometry(1.6, 2.2, 1.6);
    const emberGeo = new THREE.SphereGeometry(0.45, 6, 6);
    const roofGeo = new THREE.ConeGeometry(1.3, 1.2, 4);
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
      pedestal.position.set(lx, 3.6, lz);
      pedestal.castShadow = true;
      group.add(pedestal);

      // Chamfered Stone Cap
      const cap = new THREE.Mesh(capGeo, stoneMat);
      cap.position.set(lx, 5.9, lz);
      group.add(cap);

      // Wrought-Iron Base
      const bracket = new THREE.Mesh(bracketGeo, ironMat);
      bracket.position.set(lx, 6.5, lz);
      group.add(bracket);

      // Amber Glass Lantern Cage
      const cage = new THREE.Mesh(cageGeo, amberGlassMat);
      cage.name = 'lanternCage';
      cage.position.set(lx, 7.8, lz);
      cage.castShadow = true;
      group.add(cage);

      // Glowing Ember
      const ember = new THREE.Mesh(emberGeo, emberMat);
      ember.name = 'lanternEmber';
      ember.position.set(lx, 7.8, lz);
      group.add(ember);

      // Iron Lantern Cap
      const roof = new THREE.Mesh(roofGeo, ironMat);
      roof.position.set(lx, 9.4, lz);
      group.add(roof);
    });

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

    return lamp;
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
    const canvasSize = 4096;

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

      for (let i = 0; i < waypoints.length; i++) {
        const wp = waypoints[i];
        const curP = {
          x: wp.x + Math.sin(wp.x * 0.06 + wp.y * 0.06) * 1.5,
          z: wp.y + Math.cos(wp.x * 0.06 - wp.y * 0.06) * 1.5
        };

        // If path comes within 10 units of ANY existing road node, snap and terminate smoothly!
        let mergedToExisting = false;
        for (const existingPt of roadNetworkNodes) {
          if (Math.hypot(curP.x - existingPt.x, curP.z - existingPt.z) < 10) {
            branchPath.push({ x: existingPt.x, z: existingPt.z });
            mergedToExisting = true;
            break;
          }
        }

        if (mergedToExisting) {
          break; // Seamless T-junction merge
        }

        if (Math.hypot(curP.x - branchPath[branchPath.length - 1].x, curP.z - branchPath[branchPath.length - 1].z) > 6) {
          branchPath.push(curP);
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
    this.streetLampsGroup.clear();
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

    // Collect all building entrance coordinates and target platform heights
    const entranceElevations: { x: number; z: number; targetY: number; radius: number }[] = [];

    for (const b of state.buildings) {
      const px = (b.x + b.width / 2) * ts;
      const pz = (b.y + b.height / 2) * ts;
      const yNW = this.getTerrainHeight(b.x * ts, b.y * ts);
      const yNE = this.getTerrainHeight((b.x + b.width) * ts, b.y * ts);
      const ySW = this.getTerrainHeight(b.x * ts, (b.y + b.height) * ts);
      const ySE = this.getTerrainHeight((b.x + b.width) * ts, (b.y + b.height) * ts);
      const yCenter = this.getTerrainHeight(px, pz);
      const maxGroundY = Math.max(yNW, yNE, ySW, ySE, yCenter);

      const platformTop = maxGroundY + (b.type === 'palace' ? 1.25 : 0.6);
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
        radius: 26.0
      });
    }

    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i) + (w * ts) / 2;
      const vz = posAttr.getZ(i) + (h * ts) / 2;
      let baseVy = this.getTerrainHeight(vx, vz) + 0.06;

      for (const ent of entranceElevations) {
        const dist = Math.hypot(vx - ent.x, vz - ent.z);
        if (dist < ent.radius) {
          // Smooth cosine curve from ambient road height up to the building platform floor
          const factor = (1 + Math.cos((dist / ent.radius) * Math.PI)) / 2; // 1 at doorstep, 0 at radius
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
    const colors = [0x2d6a4f, 0x40916c, 0x52b788, 0x74c69d];
    const col = colors[variant % colors.length];
    const mat = new THREE.MeshStandardMaterial({
      color: col,
      roughness: 0.8,
      side: THREE.DoubleSide
    });

    const bladeGeo = new THREE.PlaneGeometry(1.2, 3.5);
    bladeGeo.translate(0, 1.75, 0);

    const b1 = new THREE.Mesh(bladeGeo, mat);
    b1.rotation.y = 0;
    b1.rotation.x = 0.15;
    tuft.add(b1);

    const b2 = new THREE.Mesh(bladeGeo, mat);
    b2.rotation.y = Math.PI / 3;
    b2.rotation.x = -0.12;
    tuft.add(b2);

    const b3 = new THREE.Mesh(bladeGeo, mat);
    b3.rotation.y = (Math.PI * 2) / 3;
    b3.rotation.x = 0.18;
    tuft.add(b3);

    return tuft;
  }

  private create3DWildflowerMesh(type: number): THREE.Group {
    const group = new THREE.Group();
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x2d6a4f, roughness: 0.8 });
    const stemGeo = new THREE.CylinderGeometry(0.12, 0.15, 2.5, 5);
    stemGeo.translate(0, 1.25, 0);
    const stem = new THREE.Mesh(stemGeo, stemMat);
    group.add(stem);

    if (type === 0) {
      // Golden Buttercup
      const headMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.6 });
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.75, 6, 6), headMat);
      head.position.y = 2.6;
      group.add(head);
    } else if (type === 1) {
      // Scarlet Poppy
      const headMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.6 });
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.85, 6, 6), headMat);
      head.position.y = 2.6;
      group.add(head);
      const stamen = new THREE.Mesh(new THREE.SphereGeometry(0.3, 4, 4), new THREE.MeshStandardMaterial({ color: 0x1c1917 }));
      stamen.position.y = 2.85;
      group.add(stamen);
    } else if (type === 2) {
      // Azure Bluebell
      const headMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.6 });
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.2, 5), headMat);
      head.position.y = 2.6;
      head.rotation.x = Math.PI;
      group.add(head);
    } else {
      // White Daisy
      const petalMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.2, 7), petalMat);
      disc.position.y = 2.5;
      group.add(disc);
      const center = new THREE.Mesh(new THREE.SphereGeometry(0.4, 6, 6), new THREE.MeshStandardMaterial({ color: 0xfacc15 }));
      center.position.y = 2.65;
      group.add(center);
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

    // 1. Fill canvas with 100% solid pitch-black unexplored shroud
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // 2. Draw explored areas (semi-transparent twilight darkness: 0.52 opacity)
    ctx.fillStyle = 'rgba(9, 13, 22, 0.48)';
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (this.gridManager.explored[y]?.[x]) {
          ctx.clearRect(x * scaleX, y * scaleY, Math.ceil(scaleX), Math.ceil(scaleY));
          ctx.fillRect(x * scaleX, y * scaleY, Math.ceil(scaleX), Math.ceil(scaleY));
        }
      }
    }

    // 3. Clear active Line-of-Sight vision circles with soft radial feathering
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (this.gridManager.visible[y]?.[x]) {
          const cx = (x + 0.5) * scaleX;
          const cy = (y + 0.5) * scaleY;
          const radius = Math.max(scaleX, scaleY) * 1.55;

          const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
          grad.addColorStop(0.0, 'rgba(0, 0, 0, 1.0)');
          grad.addColorStop(0.68, 'rgba(0, 0, 0, 0.95)');
          grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.fill();
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
    // Smooth spring damping for camera zoom
    const zoomLerpSpeed = Math.min(1.0, 14.0 * delta);
    this.cameraDistance += (this.targetCameraDistance - this.cameraDistance) * zoomLerpSpeed;

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

    const camX = this.cameraTarget.x + dist * cosPitch * sinYaw;
    const camY = this.cameraTarget.y + dist * sinPitch;
    const camZ = this.cameraTarget.z + dist * cosPitch * cosYaw;

    this.camera.position.set(camX, camY, camZ);
    this.camera.lookAt(this.cameraTarget);
  }

  private dayNightKeyframes = [
    {
      t: 0.0, // Midnight (Luminous soft moonlight, clear visibility)
      sunColor: new THREE.Color(0xc7d2fe),
      sunIntensity: 0.65,
      ambientColor: new THREE.Color(0x1e293b),
      ambientIntensity: 0.46,
      hemiSky: new THREE.Color(0x334155),
      hemiGround: new THREE.Color(0x0f172a),
      skyColor: new THREE.Color('#090d16'),
      fogColor: new THREE.Color('#090d16')
    },
    {
      t: 0.16, // 3:50 AM - Soft Night
      sunColor: new THREE.Color(0xc7d2fe),
      sunIntensity: 0.68,
      ambientColor: new THREE.Color(0x1e293b),
      ambientIntensity: 0.48,
      hemiSky: new THREE.Color(0x334155),
      hemiGround: new THREE.Color(0x0f172a),
      skyColor: new THREE.Color('#090d16'),
      fogColor: new THREE.Color('#090d16')
    },
    {
      t: 0.22, // 5:15 AM - Early Dawn (Soft golden morning glow)
      sunColor: new THREE.Color(0xfde68a),
      sunIntensity: 1.05,
      ambientColor: new THREE.Color(0x78350f),
      ambientIntensity: 0.55,
      hemiSky: new THREE.Color(0xfba55d),
      hemiGround: new THREE.Color(0x334155),
      skyColor: new THREE.Color('#0f172a'),
      fogColor: new THREE.Color('#0f172a')
    },
    {
      t: 0.28, // 6:45 AM - Bright Morning Sun
      sunColor: new THREE.Color(0xfef08a),
      sunIntensity: 1.35,
      ambientColor: new THREE.Color(0xfef08a),
      ambientIntensity: 0.68,
      hemiSky: new THREE.Color(0xbae6fd),
      hemiGround: new THREE.Color(0x475569),
      skyColor: new THREE.Color('#090d16'),
      fogColor: new THREE.Color('#090d16')
    },
    {
      t: 0.35, // 8:24 AM - Radiant Morning Daylight
      sunColor: new THREE.Color(0xfffbeb),
      sunIntensity: 1.45,
      ambientColor: new THREE.Color(0xffffff),
      ambientIntensity: 0.72,
      hemiSky: new THREE.Color(0xbfdbfe),
      hemiGround: new THREE.Color(0x475569),
      skyColor: new THREE.Color('#090d16'),
      fogColor: new THREE.Color('#090d16')
    },
    {
      t: 0.50, // 12:00 PM - High Noon (Peak Daylight)
      sunColor: new THREE.Color(0xffffff),
      sunIntensity: 1.50,
      ambientColor: new THREE.Color(0xffffff),
      ambientIntensity: 0.75,
      hemiSky: new THREE.Color(0xbfdbfe),
      hemiGround: new THREE.Color(0x475569),
      skyColor: new THREE.Color('#090d16'),
      fogColor: new THREE.Color('#090d16')
    },
    {
      t: 0.68, // 4:20 PM - Warm Golden Afternoon
      sunColor: new THREE.Color(0xfef08a),
      sunIntensity: 1.40,
      ambientColor: new THREE.Color(0xfde68a),
      ambientIntensity: 0.70,
      hemiSky: new THREE.Color(0xfed7aa),
      hemiGround: new THREE.Color(0x475569),
      skyColor: new THREE.Color('#090d16'),
      fogColor: new THREE.Color('#090d16')
    },
    {
      t: 0.78, // 6:45 PM - Sunset (Warm Amber Sky)
      sunColor: new THREE.Color(0xf59e0b),
      sunIntensity: 1.15,
      ambientColor: new THREE.Color(0x78350f),
      ambientIntensity: 0.58,
      hemiSky: new THREE.Color(0xf97316),
      hemiGround: new THREE.Color(0x334155),
      skyColor: new THREE.Color('#1c1917'),
      fogColor: new THREE.Color('#1c1917')
    },
    {
      t: 0.85, // 8:24 PM - Dusk
      sunColor: new THREE.Color(0x60a5fa),
      sunIntensity: 0.80,
      ambientColor: new THREE.Color(0x1e293b),
      ambientIntensity: 0.50,
      hemiSky: new THREE.Color(0x334155),
      hemiGround: new THREE.Color(0x1e293b),
      skyColor: new THREE.Color('#090d16'),
      fogColor: new THREE.Color('#090d16')
    },
    {
      t: 0.92, // 10:00 PM - Nightfall (Clear Soft Moonlight)
      sunColor: new THREE.Color(0xc7d2fe),
      sunIntensity: 0.65,
      ambientColor: new THREE.Color(0x1e293b),
      ambientIntensity: 0.46,
      hemiSky: new THREE.Color(0x334155),
      hemiGround: new THREE.Color(0x0f172a),
      skyColor: new THREE.Color('#090d16'),
      fogColor: new THREE.Color('#090d16')
    },
    {
      t: 1.0, // Midnight Wrap
      sunColor: new THREE.Color(0xc7d2fe),
      sunIntensity: 0.65,
      ambientColor: new THREE.Color(0x1e293b),
      ambientIntensity: 0.46,
      hemiSky: new THREE.Color(0x334155),
      hemiGround: new THREE.Color(0x0f172a),
      skyColor: new THREE.Color('#090d16'),
      fogColor: new THREE.Color('#090d16')
    }
  ];

  private updateDayNightLighting(state: GameState) {
    const t = (((state.stats.dayTime % 2400) + 2400) % 2400) / 2400; // 0.0 to 1.0
    const sunAngle = (t - 0.25) * Math.PI * 2;

    const sunDist = 550;
    const sinAngle = Math.sin(sunAngle);
    const isDay = sinAngle > 0;
    const sunY = isDay ? sinAngle * sunDist : -sinAngle * sunDist * 0.85;
    const rawSunX = Math.cos(sunAngle) * sunDist;
    const rawSunZ = Math.sin(sunAngle * 0.5) * 160;

    // Shadow texel stabilization: Snap shadow target position to shadow map texel grid
    // so shadows don't shimmer or vibrate during camera movement or time passing
    const shadowD = 600;
    const texelWorldSize = (shadowD * 2) / 4096;
    const snappedTargetX = Math.round(this.cameraTarget.x / texelWorldSize) * texelWorldSize;
    const snappedTargetZ = Math.round(this.cameraTarget.z / texelWorldSize) * texelWorldSize;

    this.dirLight.target.position.set(snappedTargetX, 0, snappedTargetZ);
    if (isDay) {
      this.dirLight.position.set(rawSunX + snappedTargetX, Math.max(50, sunY), rawSunZ + snappedTargetZ);
    } else {
      this.dirLight.position.set(-rawSunX + snappedTargetX, Math.max(60, sunY), -rawSunZ + snappedTargetZ);
    }
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
    const isNightOrDusk = t > 0.76 || t < 0.25;
    for (const lamp of this.streetLampsList) {
      lamp.traverse(child => {
        if (child instanceof THREE.Mesh) {
          if (child.name === 'lanternEmber' && child.material instanceof THREE.MeshStandardMaterial) {
            child.material.emissiveIntensity = isNightOrDusk ? 3.0 + Math.sin(Date.now() * 0.005) * 0.4 : 0.2;
          } else if (child.name === 'lanternCage' && child.material instanceof THREE.MeshStandardMaterial) {
            child.material.emissiveIntensity = isNightOrDusk ? 1.4 : 0.1;
          } else if (child.name === 'lampPuddle' && child.material instanceof THREE.MeshBasicMaterial) {
            child.material.opacity = isNightOrDusk ? 0.32 : 0.0;
          }
        }
      });
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

    this.updateCamera(state, delta);
    this.updateDayNightLighting(state);
    this.updateFogOfWar(state);
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
      const splash = wf.getObjectByName('waterfallSplash');
      if (splash) {
        splash.scale.setScalar(1.0 + Math.sin(now * 0.008) * 0.12);
      }
      const mistGroup = wf.getObjectByName('mistGroup');
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
      else if (m.type === 'dire_wolf') radius = 5.5;
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
    }

    const groundY = this.getTerrainHeight(entityX, entityZ);
    this.selectionGroup.position.set(entityX, groundY, entityZ);
    this.selectionGroup.visible = true;

    const key = `${state.selectedEntity.type}_${state.selectedEntity.id}_${Math.round(entityX)}_${Math.round(entityZ)}`;
    if (this.currentSelectionKey === key) return;
    this.currentSelectionKey = key;

    this.selectionGroup.clear();

    if (isStructure) {
      // Sample the ground elevation at the 4 corners and center of structure
      const yNW = this.getTerrainHeight(entityX - halfW, entityZ - halfH);
      const yNE = this.getTerrainHeight(entityX + halfW, entityZ - halfH);
      const ySE = this.getTerrainHeight(entityX + halfW, entityZ + halfH);
      const ySW = this.getTerrainHeight(entityX - halfW, entityZ + halfH);
      const centerH = this.getTerrainHeight(entityX, entityZ);
      const maxGroundY = Math.max(yNW, yNE, ySE, ySW, centerH);

      this.selectionGroup.position.set(entityX, maxGroundY + 0.35, entityZ);

      // Relative offsets from maxGroundY (all at or slightly above the floor)
      const rNW = Math.max(0, yNW - maxGroundY) + 0.25;
      const rNE = Math.max(0, yNE - maxGroundY) + 0.25;
      const rSE = Math.max(0, ySE - maxGroundY) + 0.25;
      const rSW = Math.max(0, ySW - maxGroundY) + 0.25;

      const framePoints = [
        new THREE.Vector3(-halfW, rNW, -halfH),
        new THREE.Vector3(halfW, rNE, -halfH),
        new THREE.Vector3(halfW, rSE, halfH),
        new THREE.Vector3(-halfW, rSW, halfH)
      ];
      const frameGeo = new THREE.BufferGeometry().setFromPoints(framePoints);
      const frameMat = new THREE.LineBasicMaterial({
        color: colorHex,
        linewidth: 3,
        depthTest: true,
        depthWrite: false
      });
      const frameLoop = new THREE.LineLoop(frameGeo, frameMat);
      frameLoop.renderOrder = 3;
      this.selectionGroup.add(frameLoop);

      // 4 Elegant Corner Brackets with depthTest: true
      const armLen = Math.min(10, halfW * 0.35);
      const bracketCorners = [
        [-halfW, -halfH, armLen, 0, 0, armLen, rNW],
        [halfW, -halfH, -armLen, 0, 0, armLen, rNE],
        [-halfW, halfH, armLen, 0, 0, -armLen, rSW],
        [halfW, halfH, -armLen, 0, 0, -armLen, rSE]
      ];

      bracketCorners.forEach(([cx, cz, dx, , , dz, cy]) => {
        const cPoints = [
          new THREE.Vector3(cx + dx, cy + 0.2, cz),
          new THREE.Vector3(cx, cy + 0.2, cz),
          new THREE.Vector3(cx, cy + 0.2, cz + dz)
        ];
        const cGeo = new THREE.BufferGeometry().setFromPoints(cPoints);
        const cMat = new THREE.LineBasicMaterial({
          color: colorHex,
          linewidth: 4,
          depthTest: true,
          depthWrite: false
        });
        const cLine = new THREE.Line(cGeo, cMat);
        cLine.renderOrder = 3;
        this.selectionGroup.add(cLine);
      });
    } else {
      // 3D Conforming Unit Selection Ring (Samples terrain elevation around circle perimeter)
      const ringPoints: THREE.Vector3[] = [];
      const steps = 36;
      for (let i = 0; i <= steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const rx = Math.cos(angle) * radius;
        const rz = Math.sin(angle) * radius;
        const ry = this.getTerrainHeight(entityX + rx, entityZ + rz) - groundY + 0.35;
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
      ring.renderOrder = 3;
      this.selectionGroup.add(ring);

      // Inner faint indicator disc
      const innerPoints: THREE.Vector3[] = [];
      for (let i = 0; i <= steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        const rx = Math.cos(angle) * (radius * 0.65);
        const rz = Math.sin(angle) * (radius * 0.65);
        const ry = this.getTerrainHeight(entityX + rx, entityZ + rz) - groundY + 0.3;
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
      innerRing.renderOrder = 3;
      this.selectionGroup.add(innerRing);
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
    const time = Date.now() * 0.003;

    for (const b of state.buildings) {
      activeIds.add(b.id);
      const isBlueprint = b.isConstructing && b.constructionProgress <= 0;
      const isUpgrading = (b.researchQueue && b.researchQueue.length > 0 && b.researchQueue.some(r => r.isBuildingUpgrade)) || false;
      const stateKey = `${b.id}_${isBlueprint ? 'blueprint' : (b.isConstructing ? 'building' : (isUpgrading ? 'upgrading' : 'done'))}_lvl${b.level}`;
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

      // Animate construction crane and hoist if castle is upgrading
      const craneArm = group.getObjectByName('craneArm');
      const hoistBucket = group.getObjectByName('hoistBucket');
      if (craneArm) {
        craneArm.rotation.y = Math.sin(time * 1.2) * 0.45;
      }
      if (hoistBucket) {
        hoistBucket.position.y = -14 + Math.sin(time * 1.8) * 2.5;
      }

      // Animate smoke particles in chimneys, campfires & forges
      const smokeEmitter = group.getObjectByName('smokeEmitter');
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

      // Sample terrain elevation at the 4 footprint corners & center
      const yNW = this.getTerrainHeight(b.x * ts, b.y * ts);
      const yNE = this.getTerrainHeight((b.x + b.width) * ts, b.y * ts);
      const ySW = this.getTerrainHeight(b.x * ts, (b.y + b.height) * ts);
      const ySE = this.getTerrainHeight((b.x + b.width) * ts, (b.y + b.height) * ts);
      const yCenter = this.getTerrainHeight(px, pz);
      const maxGroundY = Math.max(yNW, yNE, ySW, ySE, yCenter);

      group.position.set(px, maxGroundY, pz);

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

  private create3DBuilding(b: Building): THREE.Group {
    const group = new THREE.Group();
    const ts = this.gridManager.tileSize;
    const w = b.width * ts;
    const h = b.height * ts;

    // Subterranean Earth-Retaining Masonry Foundation Plinth
    // Anchors deep underground so buildings never sink or float on uneven hills!
    const isCottage = b.type === 'peasant_cottage';
    const plinthDepth = 16.0;
    const plinthGeo = new THREE.BoxGeometry(isCottage ? w * 0.65 : w * 0.94, plinthDepth, isCottage ? h * 0.65 : h * 0.94);
    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      map: this.royalCastleWallTexture,
      roughness: 0.9
    });
    const plinth = new THREE.Mesh(plinthGeo, plinthMat);
    plinth.position.y = -plinthDepth / 2 + 0.6;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    group.add(plinth);

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

      // --- 2. ACTIVE CONSTRUCTION SITE (Builder Has Arrived & Begun Building) ---
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
      // Sovereign Castle Fortress (High-Contrast Ashlar Bricks, Crenellations, Royal Pennants & Throne Keep)
      const stoneWallMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: this.royalCastleWallTexture,
        roughness: 0.65
      });
      const roofSlateMat = new THREE.MeshStandardMaterial({
        color: 0xdc2626,
        map: this.royalRoofSlateTexture,
        roughness: 0.6
      });
      const tudorMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: this.tudorWallTexture,
        roughness: 0.8
      });
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.85, roughness: 0.2 });
      const woodMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
      const level = b.level || 1;
      const isUpgrading = (b.researchQueue && b.researchQueue.some(r => r.isBuildingUpgrade)) || false;

      // 1. Raised Cobblestone Ground Courtyard Plinth (On the ground level!)
      const plinthScale = level === 1 ? 0.84 : (level === 2 ? 0.9 : 0.96);
      const plinthGeo = new THREE.BoxGeometry(w * plinthScale, 2.5, h * plinthScale);
      const plinthMat = new THREE.MeshStandardMaterial({ color: 0x475569, map: this.cobbleTexture, roughness: 0.85 });
      const plinth = new THREE.Mesh(plinthGeo, plinthMat);
      plinth.position.y = 1.25;
      plinth.receiveShadow = true;
      group.add(plinth);

      // Paved Castle Ground Courtyard Floor
      const courtyardFloorGeo = new THREE.PlaneGeometry(w * plinthScale * 0.95, h * plinthScale * 0.95);
      courtyardFloorGeo.rotateX(-Math.PI / 2);
      const courtyardFloor = new THREE.Mesh(courtyardFloorGeo, plinthMat);
      courtyardFloor.position.y = 1.3;
      courtyardFloor.receiveShadow = true;
      group.add(courtyardFloor);

      // 2. Four Outer Perimeter Curtain Walls (Enclosing the ground courtyard)
      const wallHeight = level === 1 ? 18 : (level === 2 ? 24 : 28);
      const wallHalfW = w * 0.38;
      const wallHalfH = h * 0.38;
      const wallThick = 4.5;

      // North Curtain Wall
      const northWallGeo = new THREE.BoxGeometry(w * 0.76, wallHeight, wallThick);
      const northWall = new THREE.Mesh(northWallGeo, stoneWallMat);
      northWall.position.set(0, wallHeight / 2 + 1.25, -wallHalfH);
      northWall.castShadow = true;
      group.add(northWall);

      // South Curtain Wall (Flanking Left & Right of Central Gatehouse)
      const gateWidth = 18;
      const sideWallW = (w * 0.76 - gateWidth) / 2;
      const southWallLGeo = new THREE.BoxGeometry(sideWallW, wallHeight, wallThick);
      const southWallL = new THREE.Mesh(southWallLGeo, stoneWallMat);
      southWallL.position.set(-(gateWidth / 2 + sideWallW / 2), wallHeight / 2 + 1.25, wallHalfH);
      southWallL.castShadow = true;
      group.add(southWallL);

      const southWallR = new THREE.Mesh(southWallLGeo, stoneWallMat);
      southWallR.position.set(gateWidth / 2 + sideWallW / 2, wallHeight / 2 + 1.25, wallHalfH);
      southWallR.castShadow = true;
      group.add(southWallR);

      // East Curtain Wall
      const sideWallGeo = new THREE.BoxGeometry(wallThick, wallHeight, h * 0.76);
      const eastWall = new THREE.Mesh(sideWallGeo, stoneWallMat);
      eastWall.position.set(wallHalfW, wallHeight / 2 + 1.25, 0);
      eastWall.castShadow = true;
      group.add(eastWall);

      // West Curtain Wall
      const westWall = new THREE.Mesh(sideWallGeo, stoneWallMat);
      westWall.position.set(-wallHalfW, wallHeight / 2 + 1.25, 0);
      westWall.castShadow = true;
      group.add(westWall);

      // Parapet Crenellations on outer walls
      const merlonGeo = new THREE.BoxGeometry(3.5, 3.5, 3.5);
      const numMerlons = level === 1 ? 2 : 3;

      for (let i = -numMerlons; i <= numMerlons; i += 2) {
        const my = wallHeight + 2.5;
        const mNorth = new THREE.Mesh(merlonGeo, stoneWallMat); mNorth.position.set(i * (wallHalfW / numMerlons), my, -wallHalfH); group.add(mNorth);
        if (Math.abs(i) > 1) {
          const mSouth = new THREE.Mesh(merlonGeo, stoneWallMat); mSouth.position.set(i * (wallHalfW / numMerlons), my, wallHalfH); group.add(mSouth);
        }
        const mWest = new THREE.Mesh(merlonGeo, stoneWallMat); mWest.position.set(-wallHalfW, my, i * (wallHalfH / numMerlons)); group.add(mWest);
        const mEast = new THREE.Mesh(merlonGeo, stoneWallMat); mEast.position.set(wallHalfW, my, i * (wallHalfH / numMerlons)); group.add(mEast);
      }

      // 3. Arched Gatehouse & Iron Portcullis on South Wall
      const ghHeight = level === 1 ? 16 : 22;
      const gatehouseGeo = new THREE.BoxGeometry(16, ghHeight, 6);
      const gatehouse = new THREE.Mesh(gatehouseGeo, stoneWallMat);
      gatehouse.position.set(0, ghHeight / 2 + 1.25, wallHalfH + 2);
      group.add(gatehouse);

      const portcullisGeo = new THREE.BoxGeometry(9, 14, 1.2);
      const portcullisMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9, roughness: 0.2 });
      const portcullis = new THREE.Mesh(portcullisGeo, portcullisMat);
      portcullis.position.set(0, 8, wallHalfH + 4);
      group.add(portcullis);

      // Torches at gatehouse entrance
      const torchGeo = new THREE.BoxGeometry(1.2, 2.2, 1.2);
      const flameMat = new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xf59e0b, emissiveIntensity: 1.5 });
      const torchL = new THREE.Mesh(torchGeo, flameMat); torchL.position.set(-7, 14, wallHalfH + 5); group.add(torchL);
      const torchR = new THREE.Mesh(torchGeo, flameMat); torchR.position.set(7, 14, wallHalfH + 5); group.add(torchR);

      // 4. Four Round Corner Bastion Towers (Scale height & features with level)
      const turretR = level === 1 ? 6 : (level === 2 ? 7.5 : 9);
      const turretH = level === 1 ? 28 : (level === 2 ? 38 : 48);
      const turretGeo = new THREE.CylinderGeometry(turretR, turretR + 1, turretH, 12);
      const turretRoofGeo = new THREE.ConeGeometry(turretR + 1.8, level === 1 ? 14 : 18, 12);

      const offsets = [
        [-wallHalfW, -wallHalfH],
        [wallHalfW, -wallHalfH],
        [-wallHalfW, wallHalfH],
        [wallHalfW, wallHalfH]
      ];

      offsets.forEach(([tx, tz]) => {
        const turret = new THREE.Mesh(turretGeo, stoneWallMat);
        turret.position.set(tx, turretH / 2 + 1.25, tz);
        turret.castShadow = true;
        group.add(turret);

        if (level >= 2) {
          // Machicolation corbel ring
          const corbelGeo = new THREE.CylinderGeometry(turretR + 1.5, turretR + 0.5, 3.5, 12);
          const corbel = new THREE.Mesh(corbelGeo, stoneWallMat);
          corbel.position.set(tx, turretH - 2, tz);
          group.add(corbel);
        }

        const tRoof = new THREE.Mesh(turretRoofGeo, roofSlateMat);
        tRoof.position.set(tx, turretH + (level === 1 ? 7 : 9) + 1.25, tz);
        tRoof.castShadow = true;
        group.add(tRoof);

        // Royal Pennant Flag
        const flagpoleGeo = new THREE.CylinderGeometry(0.3, 0.3, 8, 4);
        const flagpole = new THREE.Mesh(flagpoleGeo, goldMat);
        flagpole.position.set(tx, turretH + 19, tz);
        group.add(flagpole);

        const pennantGeo = new THREE.BoxGeometry(5, 3, 0.2);
        const pennant = new THREE.Mesh(pennantGeo, roofSlateMat);
        pennant.position.set(tx + 2.5, turretH + 19, tz);
        group.add(pennant);
      });

      // 5. Level 2 & 3 Appended Side Wings (East & West Annexes)
      if (level >= 2) {
        const wingW = 16;
        const wingH = level === 3 ? 20 : 16;
        const wingD = 24;
        const wingGeo = new THREE.BoxGeometry(wingW, wingH, wingD);
        const wingRoofGeo = new THREE.ConeGeometry(13, 10, 4);

        // East Annex Wing
        const eastWing = new THREE.Mesh(wingGeo, tudorMat);
        eastWing.position.set(wallHalfW - 4, wingH / 2 + 1.25, 0);
        eastWing.castShadow = true;
        group.add(eastWing);

        const eastRoof = new THREE.Mesh(wingRoofGeo, roofSlateMat);
        eastRoof.position.set(wallHalfW - 4, wingH + 5, 0);
        eastRoof.rotation.y = Math.PI / 4;
        group.add(eastRoof);

        // West Annex Wing
        const westWing = new THREE.Mesh(wingGeo, tudorMat);
        westWing.position.set(-wallHalfW + 4, wingH / 2 + 1.25, 0);
        westWing.castShadow = true;
        group.add(westWing);

        const westRoof = new THREE.Mesh(wingRoofGeo, roofSlateMat);
        westRoof.position.set(-wallHalfW + 4, wingH + 5, 0);
        westRoof.rotation.y = Math.PI / 4;
        group.add(westRoof);
      }

      // 6. Level 3 Appended Outer Barbicans & Flying Buttresses
      if (level === 3) {
        // 3 Outer Barbican Midpoint Turrets
        const barbicanGeo = new THREE.BoxGeometry(10, 32, 10);
        const barbRoofGeo = new THREE.ConeGeometry(7, 10, 4);

        const midpoints = [
          [0, -wallHalfH - 2],
          [-wallHalfW - 2, 0],
          [wallHalfW + 2, 0]
        ];

        midpoints.forEach(([mx, mz]) => {
          const barb = new THREE.Mesh(barbicanGeo, stoneWallMat);
          barb.position.set(mx, 16, mz);
          barb.castShadow = true;
          group.add(barb);

          const bRoof = new THREE.Mesh(barbRoofGeo, roofSlateMat);
          bRoof.position.set(mx, 36, mz);
          bRoof.rotation.y = Math.PI / 4;
          group.add(bRoof);
        });

        // 4 Arched Flying Buttresses connecting Keep to Bastions
        offsets.forEach(([tx, tz]) => {
          const archGeo = new THREE.BoxGeometry(18, 3, 3);
          const arch = new THREE.Mesh(archGeo, stoneWallMat);
          arch.position.set(tx * 0.55, 36, tz * 0.55);
          arch.lookAt(0, 36, 0);
          group.add(arch);
        });
      }

      // 7. Central Sovereign Throne Keep
      const keepH = level === 1 ? 34 : (level === 2 ? 48 : 62);
      const keepW = level === 1 ? w * 0.36 : (level === 2 ? w * 0.44 : w * 0.48);
      const keepBaseGeo = new THREE.BoxGeometry(keepW, keepH, keepW);
      const keep = new THREE.Mesh(keepBaseGeo, stoneWallMat);
      keep.position.y = keepH / 2 + 1.25;
      keep.castShadow = true;
      group.add(keep);

      // Stained Glass Windows on Keep
      if (level >= 2) {
        const winGeo = new THREE.PlaneGeometry(level === 3 ? 10 : 6, level === 3 ? 16 : 12);
        const winMat = new THREE.MeshStandardMaterial({
          color: 0xfbbf24,
          map: this.stainedGlassTexture,
          emissive: 0xd97706,
          emissiveIntensity: 0.7
        });
        const winSouth = new THREE.Mesh(winGeo, winMat);
        winSouth.position.set(0, keepH * 0.65, (keepW / 2) + 0.5);
        group.add(winSouth);

        // Royal Golden Balcony
        const balconyFloorGeo = new THREE.BoxGeometry(14, 1.5, 4);
        const balconyFloor = new THREE.Mesh(balconyFloorGeo, woodMat);
        balconyFloor.position.set(0, keepH * 0.5, (keepW / 2) + 2);
        group.add(balconyFloor);

        const balustradeGeo = new THREE.BoxGeometry(14, 3.5, 0.8);
        const balustrade = new THREE.Mesh(balustradeGeo, goldMat);
        balustrade.position.set(0, keepH * 0.5 + 2, (keepW / 2) + 3.8);
        group.add(balustrade);
      }

      // Grand Keep Roof
      const keepRoofH = level === 1 ? 18 : (level === 2 ? 26 : 30);
      const keepRoofGeo = new THREE.ConeGeometry(keepW * 0.85, keepRoofH, 4);
      const keepRoof = new THREE.Mesh(keepRoofGeo, roofSlateMat);
      keepRoof.position.y = keepH + keepRoofH / 2 + 1.25;
      keepRoof.rotation.y = Math.PI / 4;
      keepRoof.castShadow = true;
      group.add(keepRoof);

      // Sovereign Golden Crown Spire & Arcane Sovereign Beacon (Level 2 & 3)
      if (level >= 2) {
        const crownGeo = new THREE.CylinderGeometry(4, 5.5, 9, 8);
        const crown = new THREE.Mesh(crownGeo, goldMat);
        crown.position.y = keepH + keepRoofH + 5;
        group.add(crown);

        const beaconGeo = new THREE.OctahedronGeometry(level === 3 ? 3.5 : 2.5, 0);
        const beaconMat = new THREE.MeshStandardMaterial({
          color: 0xfacc15,
          emissive: 0xf59e0b,
          emissiveIntensity: level === 3 ? 1.6 : 1.2
        });
        const beacon = new THREE.Mesh(beaconGeo, beaconMat);
        beacon.position.y = keepH + keepRoofH + 11;
        group.add(beacon);
      }

      // --- 8. ACTIVE UPGRADE SCAFFOLDING & ANIMATED CONSTRUCTION CRANE ---
      if (isUpgrading) {
        const postMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
        const plankMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.8 });

        // Scaffolding towers flanking the central keep
        const scafPositions = [
          [-wallHalfW + 6, wallHalfH - 6],
          [wallHalfW - 6, -wallHalfH + 6],
          [0, wallHalfH + 3]
        ];

        scafPositions.forEach(([sx, sz]) => {
          const scafPostGeo = new THREE.CylinderGeometry(0.8, 0.8, 36, 6);
          const sp1 = new THREE.Mesh(scafPostGeo, postMat); sp1.position.set(sx - 4, 18, sz - 4); group.add(sp1);
          const sp2 = new THREE.Mesh(scafPostGeo, postMat); sp2.position.set(sx + 4, 18, sz - 4); group.add(sp2);
          const sp3 = new THREE.Mesh(scafPostGeo, postMat); sp3.position.set(sx - 4, 18, sz + 4); group.add(sp3);
          const sp4 = new THREE.Mesh(scafPostGeo, postMat); sp4.position.set(sx + 4, 18, sz + 4); group.add(sp4);

          // Platforms at tiered heights
          [10, 20, 30].forEach((py) => {
            const platGeo = new THREE.BoxGeometry(10, 1.2, 10);
            const plat = new THREE.Mesh(platGeo, plankMat);
            plat.position.set(sx, py, sz);
            group.add(plat);
          });
        });

        // Animated Wooden Construction Crane atop East Rampart
        const craneBase = new THREE.Group();
        craneBase.position.set(wallHalfW - 2, wallHeight + 3.5, 0);

        const mastGeo = new THREE.CylinderGeometry(1.2, 1.4, 20, 6);
        const mast = new THREE.Mesh(mastGeo, postMat);
        mast.position.y = 10;
        craneBase.add(mast);

        const craneArm = new THREE.Group();
        craneArm.name = 'craneArm';
        craneArm.position.y = 19;

        const jibGeo = new THREE.BoxGeometry(22, 1.4, 1.4);
        const jib = new THREE.Mesh(jibGeo, plankMat);
        jib.position.x = 8;
        craneArm.add(jib);

        // Hanging Hoist Cable & Mortar Bucket
        const cableGeo = new THREE.CylinderGeometry(0.1, 0.1, 14, 4);
        const cableMat = new THREE.MeshBasicMaterial({ color: 0x1e293b });
        const cable = new THREE.Mesh(cableGeo, cableMat);
        cable.position.set(16, -7, 0);
        craneArm.add(cable);

        const bucketGeo = new THREE.BoxGeometry(3.5, 3.5, 3.5);
        const bucket = new THREE.Mesh(bucketGeo, postMat);
        bucket.name = 'hoistBucket';
        bucket.position.set(16, -14, 0);
        craneArm.add(bucket);

        craneBase.add(craneArm);
        group.add(craneBase);
      }

      // Palace Keep Chimney & Animated Smoke
      const palaceChimneyGeo = new THREE.BoxGeometry(4.5, 14, 4.5);
      const palaceChimney = new THREE.Mesh(palaceChimneyGeo, stoneWallMat);
      palaceChimney.position.set(8, keepH + keepRoofH - 2, -8);
      group.add(palaceChimney);
      group.add(this.createSmokeEmitter(8, keepH + keepRoofH + 6, -8, false, 5));
    } else if (b.type === 'warrior_guild') {
      // Fortified Bastion Guildhall with Heavy Stone Foundation, Timber Framing, Slate Roof & Training Yard (64x64)
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0x475569, map: this.royalCastleWallTexture, roughness: 0.8 });
      const tudorMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: this.tudorWallTexture, roughness: 0.75 });
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, map: this.royalRoofSlateTexture, roughness: 0.6 });
      const woodMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.8, roughness: 0.2 });
      const ironMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.85, roughness: 0.3 });
      const bannerMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.7 });

      // 1. Heavy Stone Base Foundation with Corner Buttresses
      const groundFloorGeo = new THREE.BoxGeometry(w * 0.82, 13, h * 0.74);
      const groundFloor = new THREE.Mesh(groundFloorGeo, stoneMat);
      groundFloor.position.y = 6.5;
      groundFloor.castShadow = true;
      group.add(groundFloor);

      // 4 Heavy Corner Stone Buttress Pillars
      const buttressGeo = new THREE.BoxGeometry(4.5, 14, 4.5);
      const bNW = new THREE.Mesh(buttressGeo, stoneMat); bNW.position.set(-w * 0.38, 7, -h * 0.34); bNW.castShadow = true; group.add(bNW);
      const bNE = new THREE.Mesh(buttressGeo, stoneMat); bNE.position.set(w * 0.38, 7, -h * 0.34); bNE.castShadow = true; group.add(bNE);
      const bSW = new THREE.Mesh(buttressGeo, stoneMat); bSW.position.set(-w * 0.38, 7, h * 0.34); bSW.castShadow = true; group.add(bSW);
      const bSE = new THREE.Mesh(buttressGeo, stoneMat); bSE.position.set(w * 0.38, 7, h * 0.34); bSE.castShadow = true; group.add(bSE);

      // 2. Second Floor Tudor Half-Timber Living Quarters (Slight Overhang)
      const secondFloorGeo = new THREE.BoxGeometry(w * 0.86, 13, h * 0.78);
      const secondFloor = new THREE.Mesh(secondFloorGeo, tudorMat);
      secondFloor.position.y = 19.5;
      secondFloor.castShadow = true;
      group.add(secondFloor);

      // Timber Corbel Ring separating floors
      const corbelRing = new THREE.Mesh(new THREE.BoxGeometry(w * 0.88, 1.2, h * 0.80), woodMat);
      corbelRing.position.y = 13;
      group.add(corbelRing);

      // 3. Pitched Blue Slate Gable Roof with Overhanging Eaves
      const roofGeo = new THREE.ConeGeometry(w * 0.50, 19, 4);
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.y = 35.5;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      group.add(roof);

      // Dormer Window on front roof slope
      const dormer = new THREE.Mesh(new THREE.BoxGeometry(6, 4.5, 4), tudorMat);
      dormer.position.set(0, 31, h * 0.28);
      group.add(dormer);
      const dormerRoof = new THREE.Mesh(new THREE.ConeGeometry(4.2, 4, 4), roofMat);
      dormerRoof.position.set(0, 34.5, h * 0.28);
      dormerRoof.rotation.y = Math.PI / 4;
      group.add(dormerRoof);

      // 4. Massive Stone Chimney with Animated Smoke
      const chimneyGeo = new THREE.BoxGeometry(5.0, 30, 5.0);
      const chimney = new THREE.Mesh(chimneyGeo, stoneMat);
      chimney.position.set(-w * 0.28, 20, -h * 0.22);
      chimney.castShadow = true;
      group.add(chimney);
      group.add(this.createSmokeEmitter(-w * 0.28, 36, -h * 0.22, false, 4));

      // 5. Ornate Gilded Shield & Crossed Swords Guild Crest
      const shieldPlaqueGeo = new THREE.BoxGeometry(6.5, 9.0, 1.2);
      const shieldMat = new THREE.MeshStandardMaterial({ color: 0x1e40af, metalness: 0.7, roughness: 0.3 });
      const shieldPlaque = new THREE.Mesh(shieldPlaqueGeo, shieldMat);
      shieldPlaque.position.set(0, 20, h * 0.39 + 0.6);
      group.add(shieldPlaque);

      const swordBladeGeo = new THREE.BoxGeometry(0.8, 12, 0.4);
      const sw1 = new THREE.Mesh(swordBladeGeo, goldMat); sw1.position.set(0, 20, h * 0.39 + 1.2); sw1.rotation.z = Math.PI / 4; group.add(sw1);
      const sw2 = new THREE.Mesh(swordBladeGeo, goldMat); sw2.position.set(0, 20, h * 0.39 + 1.2); sw2.rotation.z = -Math.PI / 4; group.add(sw2);

      // Hanging Azure Guild Banners on Facade
      const banL = new THREE.Mesh(new THREE.BoxGeometry(3.5, 11, 0.3), bannerMat);
      banL.position.set(-w * 0.25, 18, h * 0.39 + 0.4);
      group.add(banL);
      const banR = new THREE.Mesh(new THREE.BoxGeometry(3.5, 11, 0.3), bannerMat);
      banR.position.set(w * 0.25, 18, h * 0.39 + 0.4);
      group.add(banR);

      // Oak Arched Double Doors with Stone Portal
      const portalGeo = new THREE.BoxGeometry(9.5, 11.5, 1.0);
      const portal = new THREE.Mesh(portalGeo, stoneMat);
      portal.position.set(0, 5.75, h * 0.37 + 0.2);
      group.add(portal);

      const doorGeo = new THREE.BoxGeometry(7, 9.5, 0.8);
      const door = new THREE.Mesh(doorGeo, woodMat);
      door.position.set(0, 4.75, h * 0.37 + 0.6);
      group.add(door);

      // 6. Outdoor Training Yard: Two Straw Dummies & Weapon Racks
      const dummyPoleGeo = new THREE.CylinderGeometry(0.8, 0.8, 11, 6);
      const dummy1 = new THREE.Mesh(dummyPoleGeo, woodMat); dummy1.position.set(w * 0.32, 5.5, h * 0.26); dummy1.castShadow = true; group.add(dummy1);
      const strawGeo = new THREE.SphereGeometry(2.6, 8, 8);
      const strawMat = new THREE.MeshStandardMaterial({ color: 0xca8a04, roughness: 0.95 });
      const straw1 = new THREE.Mesh(strawGeo, strawMat); straw1.position.set(w * 0.32, 10.5, h * 0.26); group.add(straw1);
      const helm1 = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.0, 3.2), ironMat); helm1.position.set(w * 0.32, 12.5, h * 0.26); group.add(helm1);

      // Polished Weapon Rack with Broadswords
      const rackGeo = new THREE.BoxGeometry(8, 6, 2.2);
      const rack = new THREE.Mesh(rackGeo, woodMat);
      rack.position.set(w * 0.32, 3.0, -h * 0.15);
      group.add(rack);
      const blade1 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 8, 0.3), ironMat); blade1.position.set(w * 0.32 - 2, 4.5, -h * 0.15); group.add(blade1);
      const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 8, 0.3), ironMat); blade2.position.set(w * 0.32, 4.5, -h * 0.15); group.add(blade2);
      const blade3 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 8, 0.3), ironMat); blade3.position.set(w * 0.32 + 2, 4.5, -h * 0.15); group.add(blade3);
    } else if (b.type === 'ranger_guild') {
      // Authentic Forest Ranger Lodge & Wilderness Encampment (64x64)
      const woodMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
      const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x271306, roughness: 0.95 });
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0x475569, map: this.royalCastleWallTexture, roughness: 0.9 });
      const tentMat = new THREE.MeshStandardMaterial({ color: 0x15803d, map: this.tentTexture, roughness: 0.85 });
      const scoutTentMat = new THREE.MeshStandardMaterial({ color: 0x166534, map: this.tentTexture, roughness: 0.85 });
      const thatchMat = new THREE.MeshStandardMaterial({ color: 0x78350f, map: this.royalRoofSlateTexture, roughness: 0.85 });
      const strawMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.9 });

      // 1. Forest Clearing Earth Plinth
      const clearingGeo = new THREE.BoxGeometry(w * 0.90, 1.8, h * 0.90);
      const clearingMat = new THREE.MeshStandardMaterial({ color: 0x1b4332, map: this.grassTexture, roughness: 0.9 });
      const clearing = new THREE.Mesh(clearingGeo, clearingMat);
      clearing.position.y = 0.9;
      clearing.receiveShadow = true;
      group.add(clearing);

      // 2. Main Rustic Timber Log Hunting Lodge (West wing)
      const lodgeW = w * 0.52;
      const lodgeD = h * 0.44;
      const lodgeX = -w * 0.16;
      const lodgeZ = -h * 0.12;

      const lodgeBase = new THREE.Mesh(new THREE.BoxGeometry(lodgeW, 11, lodgeD), stoneMat);
      lodgeBase.position.set(lodgeX, 5.5, lodgeZ);
      lodgeBase.castShadow = true;
      group.add(lodgeBase);

      const lodgeRoof = new THREE.Mesh(new THREE.ConeGeometry(lodgeW * 0.65, 12, 4), thatchMat);
      lodgeRoof.position.set(lodgeX, 16.5, lodgeZ);
      lodgeRoof.rotation.y = Math.PI / 4;
      lodgeRoof.scale.set(1.2, 1.0, (lodgeD / lodgeW) * 2.0);
      lodgeRoof.castShadow = true;
      group.add(lodgeRoof);

      // Stone Chimney with Smoke
      const chimX = lodgeX - lodgeW / 2 + 2;
      const chimZ = lodgeZ - lodgeD / 2 + 2;
      const lodgeChim = new THREE.Mesh(new THREE.BoxGeometry(3.5, 18, 3.5), stoneMat);
      lodgeChim.position.set(chimX, 12, chimZ);
      group.add(lodgeChim);
      group.add(this.createSmokeEmitter(chimX, 21, chimZ, false, 4));

      // 3. High Wooden Lookout Watchtower Platform (East Wing)
      const towerX = w * 0.28;
      const towerZ = -h * 0.18;
      const postGeo = new THREE.CylinderGeometry(0.6, 0.7, 24, 6);
      const p1 = new THREE.Mesh(postGeo, darkWoodMat); p1.position.set(towerX - 4, 12, towerZ - 4); group.add(p1);
      const p2 = new THREE.Mesh(postGeo, darkWoodMat); p2.position.set(towerX + 4, 12, towerZ - 4); group.add(p2);
      const p3 = new THREE.Mesh(postGeo, darkWoodMat); p3.position.set(towerX - 4, 12, towerZ + 4); group.add(p3);
      const p4 = new THREE.Mesh(postGeo, darkWoodMat); p4.position.set(towerX + 4, 12, towerZ + 4); group.add(p4);

      // Watch Platform Floor & Railing
      const platFloor = new THREE.Mesh(new THREE.BoxGeometry(11, 1.2, 11), woodMat);
      platFloor.position.set(towerX, 22, towerZ);
      group.add(platFloor);
      const platRail = new THREE.Mesh(new THREE.BoxGeometry(11, 2.5, 11), woodMat);
      platRail.position.set(towerX, 23.5, towerZ);
      group.add(platRail);

      // Lookout Canopy Roof
      const lookRoof = new THREE.Mesh(new THREE.ConeGeometry(8, 6, 4), tentMat);
      lookRoof.position.set(towerX, 28, towerZ);
      lookRoof.rotation.y = Math.PI / 4;
      group.add(lookRoof);

      // 4. Scout Bell Tent
      const scoutGeo = new THREE.ConeGeometry(9.0, 8.5, 6);
      const scout = new THREE.Mesh(scoutGeo, scoutTentMat);
      scout.position.set(w * 0.24, 4.5, h * 0.22);
      scout.castShadow = true;
      group.add(scout);

      // 5. Central Campfire with Glowing Embers & Animated Smoke
      const firePit = new THREE.Mesh(new THREE.TorusGeometry(3.5, 0.8, 6, 12), stoneMat);
      firePit.rotation.x = Math.PI / 2;
      firePit.position.set(-w * 0.08, 1.2, h * 0.24);
      group.add(firePit);

      const embers = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 8), new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xf59e0b, emissiveIntensity: 2.2 }));
      embers.position.set(-w * 0.08, 1.8, h * 0.24);
      group.add(embers);
      group.add(this.createSmokeEmitter(-w * 0.08, 3.8, h * 0.24, false, 4));

      // 6. Archery Targets with Bullseyes
      const targetGeo = new THREE.CylinderGeometry(3.8, 3.8, 2.5, 12);
      targetGeo.rotateX(Math.PI / 2);
      const t1 = new THREE.Mesh(targetGeo, strawMat);
      t1.position.set(-w * 0.34, 4.0, h * 0.26);
      t1.castShadow = true;
      group.add(t1);

      const bullseyeGeo = new THREE.CylinderGeometry(1.4, 1.4, 2.7, 10);
      bullseyeGeo.rotateX(Math.PI / 2);
      const bRing = new THREE.Mesh(bullseyeGeo, new THREE.MeshStandardMaterial({ color: 0xdc2626 }));
      bRing.position.set(-w * 0.34, 4.0, h * 0.26);
      group.add(bRing);
    } else if (b.type === 'rogue_guild') {
      // Dark Shadowy Thieves' Guildhall with Gothic Gables, Iron Lantern & Smuggler Vaults (64x64)
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, map: this.royalCastleWallTexture, roughness: 0.95 });
      const slateMat = new THREE.MeshStandardMaterial({ color: 0x27272a, map: this.royalRoofSlateTexture, roughness: 0.7 });
      const tudorMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, map: this.tudorWallTexture, roughness: 0.85 });
      const woodMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
      const ironMat = new THREE.MeshStandardMaterial({ color: 0x09090b, metalness: 0.9, roughness: 0.2 });

      // 1. Dark Stone Lower Vault Ground Floor
      const baseGeo = new THREE.BoxGeometry(w * 0.82, 14, h * 0.74);
      const hideout = new THREE.Mesh(baseGeo, stoneMat);
      hideout.position.y = 7;
      hideout.castShadow = true;
      group.add(hideout);

      // Overhanging Upper Story with Tudor cross beams
      const upperGeo = new THREE.BoxGeometry(w * 0.86, 12, h * 0.78);
      const upper = new THREE.Mesh(upperGeo, tudorMat);
      upper.position.y = 20;
      upper.castShadow = true;
      group.add(upper);

      // 2. Steep Asymmetrical Gothic Slate Roof
      const roofGeo = new THREE.ConeGeometry(w * 0.48, 19, 4);
      const roof = new THREE.Mesh(roofGeo, slateMat);
      roof.position.y = 35;
      roof.rotation.y = Math.PI / 4 + 0.12;
      roof.castShadow = true;
      group.add(roof);

      // Jagged Dormer Attic Lookout
      const dormer = new THREE.Mesh(new THREE.BoxGeometry(5.5, 4.5, 4), tudorMat);
      dormer.position.set(-w * 0.15, 30, h * 0.28);
      group.add(dormer);
      const dormerRoof = new THREE.Mesh(new THREE.ConeGeometry(3.8, 4.5, 4), slateMat);
      dormerRoof.position.set(-w * 0.15, 34, h * 0.28);
      dormerRoof.rotation.y = Math.PI / 4;
      group.add(dormerRoof);

      // 3. Ornate Hanging Wrought-Iron Street Lantern (Warm Amber glow)
      const bracketGeo = new THREE.BoxGeometry(4, 0.4, 0.4);
      const bracket = new THREE.Mesh(bracketGeo, ironMat);
      bracket.position.set(w * 0.38, 14, h * 0.36);
      group.add(bracket);

      const lanternGeo = new THREE.BoxGeometry(2.4, 3.6, 2.4);
      const lanternMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 1.8 });
      const lantern = new THREE.Mesh(lanternGeo, lanternMat);
      lantern.position.set(w * 0.38, 11.5, h * 0.36);
      group.add(lantern);

      // 4. Secret Smuggler Strongboxes & Iron-Banded Lockboxes outside
      const chest1 = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3.2, 3.2), woodMat);
      chest1.position.set(-w * 0.32, 1.6, h * 0.26);
      chest1.castShadow = true;
      group.add(chest1);
      const chest2 = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2.8, 2.8), woodMat);
      chest2.position.set(-w * 0.32, 4.5, h * 0.26);
      chest2.castShadow = true;
      group.add(chest2);

      // Dagger target board with embedded throwing knives
      const boardGeo = new THREE.BoxGeometry(5.0, 6.5, 0.6);
      const board = new THREE.Mesh(boardGeo, woodMat);
      board.position.set(w * 0.32, 5.0, -h * 0.2);
      group.add(board);
      const daggerGeo = new THREE.BoxGeometry(0.3, 2.5, 0.3);
      const d1 = new THREE.Mesh(daggerGeo, ironMat); d1.position.set(w * 0.32 - 0.8, 5.5, -h * 0.2 + 0.5); d1.rotation.x = Math.PI / 6; group.add(d1);
      const d2 = new THREE.Mesh(daggerGeo, ironMat); d2.position.set(w * 0.32 + 0.8, 4.8, -h * 0.2 + 0.5); d2.rotation.x = -Math.PI / 8; group.add(d2);
    } else if (b.type === 'wizard_tower') {
      // Spiraling Arcane Tower with Balconies, Magical Runes & Levitating Pulsing Crystal (64x64)
      const towerMat = new THREE.MeshStandardMaterial({ color: 0x312e81, map: this.royalCastleWallTexture, roughness: 0.65 });
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x6d28d9, map: this.royalRoofSlateTexture, roughness: 0.45 });
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.9, roughness: 0.15 });
      const runeMat = new THREE.MeshStandardMaterial({ color: 0xa855f7, emissive: 0x9333ea, emissiveIntensity: 1.8 });

      // 1. Tower Foundation Base with Flying Flared Buttresses
      const baseGeo = new THREE.CylinderGeometry(w * 0.36, w * 0.42, 14, 16);
      const base = new THREE.Mesh(baseGeo, towerMat);
      base.position.y = 7;
      base.castShadow = true;
      group.add(base);

      // 2. High Arcane Shaft
      const shaftGeo = new THREE.CylinderGeometry(w * 0.26, w * 0.36, 48, 16);
      const shaft = new THREE.Mesh(shaftGeo, towerMat);
      shaft.position.y = 35;
      shaft.castShadow = true;
      group.add(shaft);

      // Glowing Arcane Rune Bands around tower
      const runeBandGeo = new THREE.TorusGeometry(w * 0.30, 0.4, 8, 24);
      runeBandGeo.rotateX(Math.PI / 2);
      const rb1 = new THREE.Mesh(runeBandGeo, runeMat); rb1.position.y = 22; group.add(rb1);
      const rb2 = new THREE.Mesh(runeBandGeo, runeMat); rb2.position.y = 44; group.add(rb2);

      // 3. Cantilevered Observation Balcony with Gilded Filigree Railing
      const balconyFloor = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.36, w * 0.36, 2.5, 16), goldMat);
      balconyFloor.position.y = 48;
      group.add(balconyFloor);

      const balustrade = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.36, w * 0.36, 3.5, 16, 1, true), goldMat);
      balustrade.position.y = 50.5;
      group.add(balustrade);

      // 4. Steep Conical Spire Roof
      const coneGeo = new THREE.ConeGeometry(w * 0.30, 28, 16);
      const cone = new THREE.Mesh(coneGeo, roofMat);
      cone.position.y = 72;
      cone.castShadow = true;
      group.add(cone);

      // 5. Levitating Pulsing Arcane Crystal with Celestial Orbital Rings
      const crystalGeo = new THREE.OctahedronGeometry(5.5, 0);
      const crystalMat = new THREE.MeshStandardMaterial({
        color: 0xc084fc,
        emissive: 0x9333ea,
        emissiveIntensity: 2.0,
        roughness: 0.15
      });
      const crystal = new THREE.Mesh(crystalGeo, crystalMat);
      crystal.position.y = 90;
      group.add(crystal);

      // Orbital Gold Ring
      const orbitRingGeo = new THREE.TorusGeometry(8.0, 0.35, 6, 24);
      const orbitRing = new THREE.Mesh(orbitRingGeo, goldMat);
      orbitRing.position.y = 90;
      orbitRing.rotation.x = Math.PI / 3;
      orbitRing.rotation.y = Math.PI / 6;
      group.add(orbitRing);
    } else if (b.type === 'cleric_temple') {
      // Monumental White Marble Cathedral with Golden Dome, Solar Cross & Incense Braziers (64x64)
      const marbleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 });
      const darkMarbleMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.45 });
      const goldDomeMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.9, roughness: 0.15 });
      const glassMat = new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        map: this.stainedGlassTexture,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.8
      });

      // 1. Grand Stepped Marble Plinth
      const plinthGeo = new THREE.BoxGeometry(w * 0.92, 3, h * 0.84);
      const plinth = new THREE.Mesh(plinthGeo, darkMarbleMat);
      plinth.position.y = 1.5;
      plinth.receiveShadow = true;
      group.add(plinth);

      // 2. Cathedral Nave & Transept Basilica
      const cathedralBaseGeo = new THREE.BoxGeometry(w * 0.82, 24, h * 0.74);
      const cathedral = new THREE.Mesh(cathedralBaseGeo, marbleMat);
      cathedral.position.y = 13.5;
      cathedral.castShadow = true;
      group.add(cathedral);

      // Grand Portico Marble Colonnade (4 Fluted Columns in front)
      const colGeo = new THREE.CylinderGeometry(1.3, 1.5, 20, 10);
      const colCoords = [-12, -6, 6, 12];
      colCoords.forEach(cx => {
        const col = new THREE.Mesh(colGeo, marbleMat);
        col.position.set(cx, 11.5, h * 0.37 + 3.5);
        col.castShadow = true;
        group.add(col);
      });

      // Triangular Pediment Gabled Portico Top
      const pedimentGeo = new THREE.ConeGeometry(16, 6, 4);
      const pediment = new THREE.Mesh(pedimentGeo, marbleMat);
      pediment.position.set(0, 23.5, h * 0.37 + 3.5);
      pediment.rotation.y = Math.PI / 4;
      pediment.scale.set(1.2, 1.0, 0.4);
      group.add(pediment);

      // Stained Glass Rose Window on West Façade
      const roseGeo = new THREE.CircleGeometry(5.0, 16);
      const rose = new THREE.Mesh(roseGeo, glassMat);
      rose.position.set(0, 16, h * 0.37 + 0.3);
      group.add(rose);

      // 3. Grand Radiant Golden Dome
      const domeGeo = new THREE.SphereGeometry(w * 0.36, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2);
      const dome = new THREE.Mesh(domeGeo, goldDomeMat);
      dome.position.y = 25.5;
      dome.castShadow = true;
      group.add(dome);

      // Gilded Solar Cross atop Dome
      const crossVGeo = new THREE.BoxGeometry(1.8, 14, 1.8);
      const crossHGeo = new THREE.BoxGeometry(7.5, 1.8, 1.8);
      const crossV = new THREE.Mesh(crossVGeo, goldDomeMat); crossV.position.y = 44.5; group.add(crossV);
      const crossH = new THREE.Mesh(crossHGeo, goldDomeMat); crossH.position.y = 47.0; group.add(crossH);

      // 4. Holy Incense Braziers with Golden Smoke
      [-w * 0.32, w * 0.32].forEach(bx => {
        const brazierGeo = new THREE.CylinderGeometry(2.0, 1.2, 5.0, 8);
        const brazier = new THREE.Mesh(brazierGeo, goldDomeMat);
        brazier.position.set(bx, 4.0, h * 0.34);
        group.add(brazier);
        group.add(this.createSmokeEmitter(bx, 7.5, h * 0.34, false, 3));
      });
    } else if (b.type === 'marketplace') {
      // Magnificent Multi-Stall Medieval Bazaar & Merchant Exchange Guildhall (64x64)
      const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 });
      const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0x475569, map: this.royalCastleWallTexture, roughness: 0.85 });
      const tudorMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: this.tudorWallTexture, roughness: 0.8 });
      const slateRoofMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, map: this.royalRoofSlateTexture, roughness: 0.6 });
      const cobbleMat = new THREE.MeshStandardMaterial({ color: 0x64748b, map: this.cobbleTexture, roughness: 0.85 });
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.9, roughness: 0.15 });

      // 1. Paved Cobblestone Market Terrace Plinth
      const baseGeo = new THREE.BoxGeometry(w * 0.92, 2.5, h * 0.92);
      const base = new THREE.Mesh(baseGeo, cobbleMat);
      base.position.y = 1.25;
      base.receiveShadow = true;
      group.add(base);

      // 2. Merchant Guildhall & Exchange House (Rear building)
      const guildhallGroundGeo = new THREE.BoxGeometry(w * 0.76, 12, h * 0.36);
      const ghGround = new THREE.Mesh(guildhallGroundGeo, stoneMat);
      ghGround.position.set(0, 7.25, -h * 0.22);
      ghGround.castShadow = true;
      group.add(ghGround);

      const guildhallUpperGeo = new THREE.BoxGeometry(w * 0.8, 12, h * 0.4);
      const ghUpper = new THREE.Mesh(guildhallUpperGeo, tudorMat);
      ghUpper.position.set(0, 18.25, -h * 0.22);
      ghUpper.castShadow = true;
      group.add(ghUpper);

      const ghRoofGeo = new THREE.ConeGeometry(w * 0.45, 15, 4);
      const ghRoof = new THREE.Mesh(ghRoofGeo, slateRoofMat);
      ghRoof.position.set(0, 30.5, -h * 0.22);
      ghRoof.rotation.y = Math.PI / 4;
      ghRoof.castShadow = true;
      group.add(ghRoof);

      // Hanging Gilded Scales of Commerce Sign
      const signBracketGeo = new THREE.BoxGeometry(4.5, 0.4, 0.4);
      const signBracket = new THREE.Mesh(signBracketGeo, darkWoodMat);
      signBracket.position.set(w * 0.34, 15, -h * 0.02);
      group.add(signBracket);

      const scaleGeo = new THREE.CylinderGeometry(1.6, 1.6, 0.2, 8);
      scaleGeo.rotateX(Math.PI / 2);
      const scaleSign = new THREE.Mesh(scaleGeo, goldMat);
      scaleSign.position.set(w * 0.34, 13.5, -h * 0.02);
      group.add(scaleSign);

      // Gilded Trade Weather Vane on Peak
      const vane = new THREE.Mesh(new THREE.OctahedronGeometry(1.5, 0), goldMat);
      vane.position.set(0, 39, -h * 0.22);
      group.add(vane);

      // 3. Front Bazaar Stalls (Alchemist & Jeweler)
      const stallLeftX = -w * 0.24;
      const stallLeftZ = h * 0.18;
      const stallCounterGeo = new THREE.BoxGeometry(12, 5, 5.5);
      const counterL = new THREE.Mesh(stallCounterGeo, woodMat);
      counterL.position.set(stallLeftX, 3.75, stallLeftZ);
      counterL.castShadow = true;
      group.add(counterL);

      const canopyMatA = new THREE.MeshStandardMaterial({ color: 0xdc2626, map: this.tentTexture, roughness: 0.7 });
      const awningGeo = new THREE.BoxGeometry(14, 0.8, 8.5);
      const awningL = new THREE.Mesh(awningGeo, canopyMatA);
      awningL.position.set(stallLeftX, 10.5, stallLeftZ);
      awningL.rotation.x = Math.PI / 12;
      awningL.castShadow = true;
      group.add(awningL);

      // Glowing Potion Bottles
      const potGeo = new THREE.SphereGeometry(0.65, 8, 8);
      const redPot = new THREE.Mesh(potGeo, new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 1.2 }));
      redPot.position.set(stallLeftX - 3.5, 6.8, stallLeftZ + 0.8);
      group.add(redPot);
      const bluePot = new THREE.Mesh(potGeo, new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x2563eb, emissiveIntensity: 1.2 }));
      bluePot.position.set(stallLeftX - 1.2, 6.8, stallLeftZ + 0.8);
      group.add(bluePot);
      const goldPot = new THREE.Mesh(potGeo, new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xf59e0b, emissiveIntensity: 1.2 }));
      goldPot.position.set(stallLeftX + 1.2, 6.8, stallLeftZ + 0.8);
      group.add(goldPot);

      // Stall B: Jeweler
      const stallRightX = w * 0.24;
      const stallRightZ = h * 0.18;
      const counterR = new THREE.Mesh(stallCounterGeo, woodMat);
      counterR.position.set(stallRightX, 3.75, stallRightZ);
      counterR.castShadow = true;
      group.add(counterR);

      const canopyMatB = new THREE.MeshStandardMaterial({ color: 0x2563eb, map: this.tentTexture, roughness: 0.7 });
      const awningR = new THREE.Mesh(awningGeo, canopyMatB);
      awningR.position.set(stallRightX, 10.5, stallRightZ);
      awningR.rotation.x = Math.PI / 12;
      awningR.castShadow = true;
      group.add(awningR);

      // 4. Central Town Square Water Basin Fountain
      const fountainGeo = new THREE.CylinderGeometry(4.5, 5.0, 2.5, 8);
      const fountainMat = new THREE.MeshStandardMaterial({ color: 0x64748b, map: this.royalCastleWallTexture, roughness: 0.8 });
      const fountain = new THREE.Mesh(fountainGeo, fountainMat);
      fountain.position.set(0, 2.5, -h * 0.02);
      fountain.castShadow = true;
      group.add(fountain);

      const waterDiscGeo = new THREE.CircleGeometry(4.2, 8);
      waterDiscGeo.rotateX(-Math.PI / 2);
      const waterDisc = new THREE.Mesh(waterDiscGeo, new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, metalness: 0.3 }));
      waterDisc.position.set(0, 3.6, -h * 0.02);
      group.add(waterDisc);
    } else if (b.type === 'blacksmith') {
      // Brick Forge with Massive Industrial Chimney, Open-Air Smithing Bay & Anvil (64x64)
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0x475569, map: this.royalCastleWallTexture, roughness: 0.85 });
      const brickMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.8 });
      const woodMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
      const slateRoofMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, map: this.royalRoofSlateTexture, roughness: 0.7 });
      const metalMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.15 });

      // 1. Heavy Stone Workshop Base
      const forgeBaseGeo = new THREE.BoxGeometry(w * 0.82, 16, h * 0.72);
      const forge = new THREE.Mesh(forgeBaseGeo, stoneMat);
      forge.position.y = 8;
      forge.castShadow = true;
      group.add(forge);

      // Pitch Slate Gable Roof over Workshop
      const forgeRoofGeo = new THREE.ConeGeometry(w * 0.48, 16, 4);
      const forgeRoof = new THREE.Mesh(forgeRoofGeo, slateRoofMat);
      forgeRoof.position.y = 24;
      forgeRoof.rotation.y = Math.PI / 4;
      forgeRoof.castShadow = true;
      group.add(forgeRoof);

      // 2. Massive Industrial Brick Chimney with Smoke
      const chimneyGeo = new THREE.BoxGeometry(8, 38, 8);
      const chimney = new THREE.Mesh(chimneyGeo, brickMat);
      chimney.position.set(w * 0.25, 19, -h * 0.2);
      chimney.castShadow = true;
      group.add(chimney);
      group.add(this.createSmokeEmitter(w * 0.25, 39, -h * 0.2, true, 6));

      // 3. Glowing Forge Hearth Firebox
      const fireboxGeo = new THREE.BoxGeometry(6, 6, 3);
      const fireboxMat = new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xef4444, emissiveIntensity: 2.5 });
      const firebox = new THREE.Mesh(fireboxGeo, fireboxMat);
      firebox.position.set(w * 0.25, 6, -h * 0.2 + 4.5);
      group.add(firebox);

      // 4. Steel Anvil on Oak Stump with Red-Hot Iron Bar
      const stumpGeo = new THREE.CylinderGeometry(2.8, 3.0, 3.5, 8);
      const stump = new THREE.Mesh(stumpGeo, woodMat);
      stump.position.set(-w * 0.24, 1.75, h * 0.22);
      stump.castShadow = true;
      group.add(stump);

      const anvilGeo = new THREE.BoxGeometry(3.8, 3.5, 5.8);
      const anvil = new THREE.Mesh(anvilGeo, metalMat);
      anvil.position.set(-w * 0.24, 4.8, h * 0.22);
      anvil.castShadow = true;
      group.add(anvil);

      // Glowing hot forged iron blade on anvil
      const hotBarGeo = new THREE.BoxGeometry(0.8, 0.4, 3.5);
      const hotBarMat = new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xef4444, emissiveIntensity: 2.0 });
      const hotBar = new THREE.Mesh(hotBarGeo, hotBarMat);
      hotBar.position.set(-w * 0.24, 6.8, h * 0.22);
      group.add(hotBar);

      // 5. Quench Tub with Water
      const tubGeo = new THREE.CylinderGeometry(2.8, 2.8, 4.2, 8);
      const tub = new THREE.Mesh(tubGeo, woodMat);
      tub.position.set(-w * 0.24, 2.1, -h * 0.12);
      group.add(tub);

      // Weapon display rack with bastard swords
      const rackGeo = new THREE.BoxGeometry(6.5, 5.5, 2.0);
      const rack = new THREE.Mesh(rackGeo, woodMat);
      rack.position.set(w * 0.32, 2.75, h * 0.22);
      group.add(rack);
    } else if (b.type === 'dwarf_settlement') {
      // Fortified Mountain-Stone Dwarf Bastion with Automated Heavy Ballista Turret & Runic Masonry (64x64)
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0x334155, map: this.royalCastleWallTexture, roughness: 0.9 });
      const metalMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.85, roughness: 0.2 });
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8, roughness: 0.25 });
      const woodMat = new THREE.MeshStandardMaterial({ color: 0x451a03 });

      // 1. Imposing Granite Block Fortress
      const baseGeo = new THREE.BoxGeometry(w * 0.86, 22, h * 0.86);
      const base = new THREE.Mesh(baseGeo, stoneMat);
      base.position.y = 11;
      base.castShadow = true;
      group.add(base);

      // Parapet Battlements with Crenellations
      const parapetGeo = new THREE.BoxGeometry(w * 0.90, 4.5, h * 0.90);
      const parapet = new THREE.Mesh(parapetGeo, stoneMat);
      parapet.position.y = 23.5;
      group.add(parapet);

      // Heavy Iron Blast Gates with Gold Dwarven Runes
      const blastGateGeo = new THREE.BoxGeometry(9.0, 11.0, 1.2);
      const blastGate = new THREE.Mesh(blastGateGeo, metalMat);
      blastGate.position.set(0, 5.5, h * 0.43 + 0.6);
      group.add(blastGate);

      const hammerEmblemGeo = new THREE.BoxGeometry(3.5, 5.5, 0.6);
      const hammerEmblem = new THREE.Mesh(hammerEmblemGeo, goldMat);
      hammerEmblem.position.set(0, 6.0, h * 0.43 + 1.3);
      group.add(hammerEmblem);

      // 2. Roof Mounted Automated Heavy Ballista Turret
      const turretBaseGeo = new THREE.CylinderGeometry(3.5, 4.0, 4.5, 8);
      const turretBase = new THREE.Mesh(turretBaseGeo, metalMat);
      turretBase.position.set(0, 26, 0);
      group.add(turretBase);

      const ballistaBowGeo = new THREE.BoxGeometry(14, 1.4, 1.4);
      const ballistaBow = new THREE.Mesh(ballistaBowGeo, woodMat);
      ballistaBow.position.set(0, 29.5, 2);
      group.add(ballistaBow);

      // 3. Forge Chimney with Smoke
      const chimneyGeo = new THREE.BoxGeometry(4.5, 20, 4.5);
      const chimney = new THREE.Mesh(chimneyGeo, stoneMat);
      chimney.position.set(w * 0.28, 20, -h * 0.24);
      group.add(chimney);
      group.add(this.createSmokeEmitter(w * 0.28, 31, -h * 0.24, false, 4));

      // 4. Stacks of Dwarven Stout Ale Barrels
      const barrelGeo = new THREE.CylinderGeometry(2, 2, 4, 8);
      const b1 = new THREE.Mesh(barrelGeo, woodMat); b1.position.set(-w * 0.32, 2, h * 0.32); group.add(b1);
      const b2 = new THREE.Mesh(barrelGeo, woodMat); b2.position.set(-w * 0.32, 2, h * 0.18); group.add(b2);
      const b3 = new THREE.Mesh(barrelGeo, woodMat); b3.position.set(-w * 0.32, 5.5, h * 0.25); group.add(b3);
    } else if (b.type === 'royal_inn') {
      // Bavarian Half-Timber Tavern with Hanging Golden Tankard Sign & Beer Garden (64x64)
      const tudorMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: this.tudorWallTexture, roughness: 0.8 });
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x78350f, map: this.royalRoofSlateTexture, roughness: 0.7 });
      const woodMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0x475569, map: this.royalCastleWallTexture });
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.8, roughness: 0.2 });

      // 1. Lower Stone Floor & Upper Half-Timber Story
      const groundFloor = new THREE.Mesh(new THREE.BoxGeometry(w * 0.82, 11, h * 0.74), stoneMat);
      groundFloor.position.y = 5.5;
      groundFloor.castShadow = true;
      group.add(groundFloor);

      const upperFloor = new THREE.Mesh(new THREE.BoxGeometry(w * 0.86, 12, h * 0.78), tudorMat);
      upperFloor.position.y = 17;
      upperFloor.castShadow = true;
      group.add(upperFloor);

      // 2. Pitched Warm Terracotta Roof with Dormer Windows
      const roofGeo = new THREE.ConeGeometry(w * 0.50, 19, 4);
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.y = 32.5;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      group.add(roof);

      // 3. Hanging Gilded Boar / Beer Mug Sign
      const signArm = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.4, 0.4), woodMat);
      signArm.position.set(-w * 0.36, 14, h * 0.34);
      group.add(signArm);

      const tankard = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.0, 2.5, 8), goldMat);
      tankard.position.set(-w * 0.36, 12, h * 0.34);
      group.add(tankard);

      // 4. Tavern Stone Chimney with Smoke
      const chimney = new THREE.Mesh(new THREE.BoxGeometry(4.5, 28, 4.5), stoneMat);
      chimney.position.set(-w * 0.26, 19, -h * 0.22);
      group.add(chimney);
      group.add(this.createSmokeEmitter(-w * 0.26, 34, -h * 0.22, false, 4));

      // 5. Beer Garden Wooden Patio Table & Benches
      const tableGeo = new THREE.BoxGeometry(7.0, 2.2, 4.0);
      const table = new THREE.Mesh(tableGeo, woodMat);
      table.position.set(w * 0.28, 1.1, h * 0.24);
      group.add(table);

      const bench1 = new THREE.Mesh(new THREE.BoxGeometry(7.0, 1.2, 1.2), woodMat);
      bench1.position.set(w * 0.28, 0.6, h * 0.24 - 3.2);
      group.add(bench1);
      const bench2 = new THREE.Mesh(new THREE.BoxGeometry(7.0, 1.2, 1.2), woodMat);
      bench2.position.set(w * 0.28, 0.6, h * 0.24 + 3.2);
      group.add(bench2);

      // Ale Barrels
      const barrelGeo = new THREE.CylinderGeometry(1.8, 1.8, 3.6, 8);
      const b1 = new THREE.Mesh(barrelGeo, woodMat); b1.position.set(w * 0.32, 1.8, -h * 0.15); group.add(b1);
      const b2 = new THREE.Mesh(barrelGeo, woodMat); b2.position.set(w * 0.32, 1.8, -h * 0.26); group.add(b2);
    } else if (b.type === 'peasant_cottage') {
      // Architectural Peasant Cottage with Distinct Shapes (Two-Story, L-Shaped, Rectangular with Dormers)
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0x57534e, map: this.royalCastleWallTexture, roughness: 0.85 });
      const thatchMat = new THREE.MeshStandardMaterial({ color: 0xca8a04, map: this.thatchTexture, roughness: 0.95 });
      const tudorMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, map: this.tudorWallTexture, roughness: 0.75 });
      const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.8 });
      const glassMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xf59e0b, emissiveIntensity: 0.4 });

      const variant = Math.abs(b.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)) % 3;

      if (variant === 0) {
        // --- VARIANT 0: Compact Two-Story Thatched Hut with Overhanging Loft & Lean-To Wood Store ---
        const houseW = w * 0.46;
        const houseD = h * 0.50;
        const houseX = -w * 0.08;
        const houseZ = 0;

        // Ground floor (Rustic Fieldstone)
        const groundFloor = new THREE.Mesh(new THREE.BoxGeometry(houseW, 8.5, houseD), stoneMat);
        groundFloor.position.set(houseX, 4.25, houseZ);
        groundFloor.castShadow = true;
        group.add(groundFloor);

        // Wooden Door & Window
        const door0 = new THREE.Mesh(new THREE.BoxGeometry(2.8, 5.0, 0.4), darkWoodMat);
        door0.position.set(houseX, 2.5, houseZ + houseD / 2 + 0.1);
        group.add(door0);

        const win0 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 0.3), glassMat);
        win0.position.set(houseX + 3.8, 4.5, houseZ + houseD / 2 + 0.1);
        group.add(win0);

        // Overhanging Second Story (Tudor Timber & Plaster)
        const loftW = houseW * 1.12;
        const loftD = houseD * 1.10;
        const loft = new THREE.Mesh(new THREE.BoxGeometry(loftW, 7.0, loftD), tudorMat);
        loft.position.set(houseX, 12.0, houseZ);
        loft.castShadow = true;
        group.add(loft);

        // Corbel support beam
        const corbel = new THREE.Mesh(new THREE.BoxGeometry(loftW + 0.4, 0.8, loftD + 0.4), darkWoodMat);
        corbel.position.set(houseX, 8.5, houseZ);
        group.add(corbel);

        const winLoft = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 0.3), glassMat);
        winLoft.position.set(houseX, 12.5, houseZ + loftD / 2 + 0.1);
        group.add(winLoft);

        // Steep Pitched Thatched Roof
        const roof = new THREE.Mesh(new THREE.ConeGeometry(loftW * 0.72, 10.5, 4), thatchMat);
        roof.position.set(houseX, 19.5, houseZ);
        roof.rotation.y = Math.PI / 4;
        roof.scale.set(1.0, 1.0, loftD / loftW);
        roof.castShadow = true;
        group.add(roof);

        // Side Lean-To Woodshed (Attached to right side)
        const shedW = w * 0.28;
        const shedD = h * 0.38;
        const shedX = houseX + houseW / 2 + shedW / 2 - 0.2;
        const shedZ = houseZ;
        const shed = new THREE.Mesh(new THREE.BoxGeometry(shedW, 5.5, shedD), stoneMat);
        shed.position.set(shedX, 2.75, shedZ);
        shed.castShadow = true;
        group.add(shed);

        const shedRoof = new THREE.Mesh(new THREE.BoxGeometry(shedW + 1.2, 0.6, shedD + 1.0), thatchMat);
        shedRoof.position.set(shedX, 5.8, shedZ);
        shedRoof.rotation.z = -Math.PI / 8;
        group.add(shedRoof);

        // Chopped Firewood logs under shed
        const log1 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, shedW * 0.8, 6), darkWoodMat);
        log1.rotation.z = Math.PI / 2;
        log1.position.set(shedX, 1.2, shedZ + 1.2);
        group.add(log1);
        const log2 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, shedW * 0.8, 6), darkWoodMat);
        log2.rotation.z = Math.PI / 2;
        log2.position.set(shedX, 2.0, shedZ + 0.6);
        group.add(log2);

        // Stone Chimney with Smoke
        const chimX = houseX - houseW / 2 + 1.5;
        const chimZ = houseZ - houseD / 2 + 1.5;
        const chim = new THREE.Mesh(new THREE.BoxGeometry(2.4, 15.0, 2.4), stoneMat);
        chim.position.set(chimX, 13.0, chimZ);
        group.add(chim);
        group.add(this.createSmokeEmitter(chimX, 21.0, chimZ, false, 3));
      } else if (variant === 1) {
        // --- VARIANT 1: One-Story Asymmetrical L-Shaped Thatched Cottage ---
        // Main Back Wing (East-West rectangular hall)
        const mainW = w * 0.56;
        const mainD = h * 0.32;
        const mainX = w * 0.02;
        const mainZ = -h * 0.12;

        const mainHall = new THREE.Mesh(new THREE.BoxGeometry(mainW, 8.0, mainD), stoneMat);
        mainHall.position.set(mainX, 4.0, mainZ);
        mainHall.castShadow = true;
        group.add(mainHall);

        // Main Wing Thatch Roof
        const mainRoof = new THREE.Mesh(new THREE.ConeGeometry(mainW * 0.62, 8.5, 4), thatchMat);
        mainRoof.position.set(mainX, 11.5, mainZ);
        mainRoof.rotation.y = Math.PI / 4;
        mainRoof.scale.set(1.25, 1.0, (mainD / mainW) * 2.2);
        mainRoof.castShadow = true;
        group.add(mainRoof);

        // Front Cross Wing (North-South forward projection, forming the 'L')
        const crossW = w * 0.30;
        const crossD = h * 0.36;
        const crossX = mainX - mainW / 2 + crossW / 2;
        const crossZ = mainZ + mainD / 2 + crossD / 2 - 0.2;

        const crossWing = new THREE.Mesh(new THREE.BoxGeometry(crossW, 7.5, crossD), tudorMat);
        crossWing.position.set(crossX, 3.75, crossZ);
        crossWing.castShadow = true;
        group.add(crossWing);

        // Cross Wing Thatch Roof
        const crossRoof = new THREE.Mesh(new THREE.ConeGeometry(crossW * 0.72, 7.5, 4), thatchMat);
        crossRoof.position.set(crossX, 10.5, crossZ);
        crossRoof.rotation.y = Math.PI / 4;
        crossRoof.scale.set(1.0, 1.0, crossD / crossW);
        crossRoof.castShadow = true;
        group.add(crossRoof);

        // Front Window on Cross Wing
        const crossWin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 0.3), glassMat);
        crossWin.position.set(crossX, 4.2, crossZ + crossD / 2 + 0.1);
        group.add(crossWin);

        // Inner Nook Door (Sheltered inside the L-junction)
        const door1 = new THREE.Mesh(new THREE.BoxGeometry(2.8, 4.8, 0.4), darkWoodMat);
        door1.position.set(mainX + 2.0, 2.4, mainZ + mainD / 2 + 0.1);
        group.add(door1);

        // Porch Awning over door
        const porchRoof = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.5, 3.0), thatchMat);
        porchRoof.position.set(mainX + 2.0, 5.2, mainZ + mainD / 2 + 1.2);
        porchRoof.rotation.x = Math.PI / 8;
        group.add(porchRoof);

        const porchPost = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 5.0, 6), darkWoodMat);
        porchPost.position.set(mainX + 3.8, 2.5, mainZ + mainD / 2 + 2.4);
        group.add(porchPost);

        // Water barrel in the garden nook
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.0, 2.4, 8), darkWoodMat);
        barrel.position.set(mainX + w * 0.22, 1.2, crossZ);
        group.add(barrel);

        // Chimney on east gable
        const chim1X = mainX + mainW / 2 - 1.2;
        const chim1Z = mainZ;
        const chim1 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 13.0, 2.2), stoneMat);
        chim1.position.set(chim1X, 8.5, chim1Z);
        group.add(chim1);
        group.add(this.createSmokeEmitter(chim1X, 15.5, chim1Z, false, 3));
      } else {
        // --- VARIANT 2: Quaint Rectangular Long-Cottage with Dormer & Bread Oven ---
        const house2W = w * 0.60;
        const house2D = h * 0.38;
        const house2X = 0;
        const house2Z = -h * 0.04;

        // Base Structure
        const base2 = new THREE.Mesh(new THREE.BoxGeometry(house2W, 8.0, house2D), stoneMat);
        base2.position.set(house2X, 4.0, house2Z);
        base2.castShadow = true;
        group.add(base2);

        // Steep Thatched Gable Roof
        const roof2 = new THREE.Mesh(new THREE.ConeGeometry(house2W * 0.60, 9.0, 4), thatchMat);
        roof2.position.set(house2X, 12.0, house2Z);
        roof2.rotation.y = Math.PI / 4;
        roof2.scale.set(1.28, 1.0, (house2D / house2W) * 2.1);
        roof2.castShadow = true;
        group.add(roof2);

        // Dormer Window protruding from front roof slope
        const dormer = new THREE.Mesh(new THREE.BoxGeometry(3.5, 3.2, 2.8), tudorMat);
        dormer.position.set(house2X - 2.5, 10.5, house2Z + house2D / 2 + 0.4);
        group.add(dormer);

        const dormerRoof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2.8, 4), thatchMat);
        dormerRoof.position.set(house2X - 2.5, 12.6, house2Z + house2D / 2 + 0.4);
        dormerRoof.rotation.y = Math.PI / 4;
        group.add(dormerRoof);

        const winDormer = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.8, 0.2), glassMat);
        winDormer.position.set(house2X - 2.5, 10.5, house2Z + house2D / 2 + 1.85);
        group.add(winDormer);

        // Front Door & Window
        const door2 = new THREE.Mesh(new THREE.BoxGeometry(2.8, 5.0, 0.4), darkWoodMat);
        door2.position.set(house2X + 3.2, 2.5, house2Z + house2D / 2 + 0.1);
        group.add(door2);

        const win2 = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 0.3), glassMat);
        win2.position.set(house2X - 4.5, 4.2, house2Z + house2D / 2 + 0.1);
        group.add(win2);

        // Stone Bread Oven on Side
        const oven = new THREE.Mesh(new THREE.SphereGeometry(2.2, 8, 8), stoneMat);
        oven.position.set(house2X - house2W / 2 - 0.6, 2.2, house2Z);
        group.add(oven);

        const chim2X = house2X - house2W / 2 + 1.2;
        const chim2Z = house2Z - house2D / 2 + 1.2;
        const chim2 = new THREE.Mesh(new THREE.BoxGeometry(2.2, 13.5, 2.2), stoneMat);
        chim2.position.set(chim2X, 9.5, chim2Z);
        group.add(chim2);
        group.add(this.createSmokeEmitter(chim2X, 16.5, chim2Z, false, 3));

        // Rustic Wooden Bench in front
        const bench = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.2, 1.4), darkWoodMat);
        bench.position.set(house2X + 4.5, 0.6, house2Z + house2D / 2 + 2.5);
        group.add(bench);
      }
    } else if (b.type === 'guard_tower') {
      // Fortified Stone Watchtower with Machicolations, Beacon Brazier & Royal Banner (32x32)
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0x475569, map: this.royalCastleWallTexture, roughness: 0.8 });
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, map: this.royalRoofSlateTexture, roughness: 0.6 });
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.8, roughness: 0.2 });
      const bannerMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.7 });

      // 1. Flared Stone Foundation Base
      const towerBaseGeo = new THREE.BoxGeometry(w * 0.58, 10, h * 0.58);
      const towerBase = new THREE.Mesh(towerBaseGeo, stoneMat);
      towerBase.position.y = 5;
      towerBase.castShadow = true;
      group.add(towerBase);

      // 2. High Tower Shaft with Arrow Slits
      const towerGeo = new THREE.BoxGeometry(w * 0.48, 36, h * 0.48);
      const tower = new THREE.Mesh(towerGeo, stoneMat);
      tower.position.y = 23;
      tower.castShadow = true;
      group.add(tower);

      // 3. Corbelled Machicolations & Parapet Battlements
      const parapetGeo = new THREE.BoxGeometry(w * 0.62, 5.5, h * 0.62);
      const parapet = new THREE.Mesh(parapetGeo, stoneMat);
      parapet.position.y = 43.5;
      parapet.castShadow = true;
      group.add(parapet);

      // 4. Steep Conical Spire Roof
      const roofGeo = new THREE.ConeGeometry(w * 0.40, 16, 4);
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.y = 53.5;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      group.add(roof);

      // Kingdom Banner Spire atop Roof
      const spireStaff = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 8, 6), goldMat);
      spireStaff.position.y = 64;
      group.add(spireStaff);

      const flag = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2.0, 0.2), bannerMat);
      flag.position.set(1.8, 65, 0);
      group.add(flag);

      // 5. Flaming Watchtower Brazier with Smoke
      const brazier = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.0, 3.0, 8), new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9 }));
      brazier.position.set(w * 0.24, 46.5, h * 0.24);
      group.add(brazier);

      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.2, 6), new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xf59e0b, emissiveIntensity: 2.5 }));
      flame.position.set(w * 0.24, 49.0, h * 0.24);
      group.add(flame);
      group.add(this.createSmokeEmitter(w * 0.24, 50.5, h * 0.24, false, 3));
    } else if (b.type === 'statue_king') {
      // Monumental Golden Sovereign Statue on Tiered Marble Plinth with Ceremonial Braziers (32x32)
      const marbleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 });
      const darkMarbleMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.5 });
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.9, roughness: 0.15 });

      // 1. Three-Tiered Stepped Marble Plinth
      const tier1 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.88, 2.5, h * 0.88), darkMarbleMat); tier1.position.y = 1.25; tier1.receiveShadow = true; group.add(tier1);
      const tier2 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, 2.5, h * 0.72), marbleMat); tier2.position.y = 3.75; tier2.receiveShadow = true; group.add(tier2);
      const tier3 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.54, 4.0, h * 0.54), darkMarbleMat); tier3.position.y = 7.0; tier3.castShadow = true; group.add(tier3);

      // 2. Majestic Gilded Sovereign Pedestal Statue
      const statueTorso = new THREE.Mesh(new THREE.BoxGeometry(4.5, 7.5, 3.5), goldMat);
      statueTorso.position.y = 13.0;
      statueTorso.castShadow = true;
      group.add(statueTorso);

      const statueCape = new THREE.Mesh(new THREE.BoxGeometry(5.2, 8.5, 1.2), new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.6 }));
      statueCape.position.set(0, 12.5, -2.0);
      group.add(statueCape);

      const statueHead = new THREE.Mesh(new THREE.SphereGeometry(1.8, 8, 8), goldMat);
      statueHead.position.y = 18.0;
      group.add(statueHead);

      const crown = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 1.8, 1.2, 8), goldMat);
      crown.position.y = 19.8;
      group.add(crown);

      // Sword Aloft in Right Hand
      const sword = new THREE.Mesh(new THREE.BoxGeometry(0.6, 12, 0.4), goldMat);
      sword.position.set(3.5, 19.0, 1.5);
      sword.rotation.z = -Math.PI / 12;
      group.add(sword);

      // 3. Four Corner Marble Pillars with Eternal Flames
      const cornerOffsets = [
        [-w * 0.36, -h * 0.36],
        [w * 0.36, -h * 0.36],
        [-w * 0.36, h * 0.36],
        [w * 0.36, h * 0.36]
      ];

      cornerOffsets.forEach(([cx, cz]) => {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.2, 9, 8), marbleMat);
        pillar.position.set(cx, 4.5, cz);
        pillar.castShadow = true;
        group.add(pillar);

        const brazier = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 0.9, 1.8, 8), goldMat);
        brazier.position.set(cx, 9.5, cz);
        group.add(brazier);

        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.8, 6), new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xf59e0b, emissiveIntensity: 2.2 }));
        flame.position.set(cx, 11.0, cz);
        group.add(flame);
      });
    } else {
      const baseGeo = new THREE.BoxGeometry(w * 0.75, 18, h * 0.75);
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x334155, map: this.royalCastleWallTexture, roughness: 0.8 });
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

      const yNW = this.getTerrainHeight(lair.x * ts, lair.y * ts);
      const yNE = this.getTerrainHeight((lair.x + lair.width) * ts, lair.y * ts);
      const ySW = this.getTerrainHeight(lair.x * ts, (lair.y + lair.height) * ts);
      const ySE = this.getTerrainHeight((lair.x + lair.width) * ts, (lair.y + lair.height) * ts);
      const yCenter = this.getTerrainHeight(px, pz);

      // For sewer grates (ground-flush street drain), use center ground height; for elevated lairs use maxGroundY
      const groundY = lair.type === 'sewer_grate' ? yCenter : Math.max(yNW, yNE, ySW, ySE, yCenter);

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

    // Subterranean Earth Base Mound for large 3D lairs
    const plinthDepth = 14.0;
    const plinthGeo = new THREE.BoxGeometry(w * 0.94, plinthDepth, h * 0.94);
    const plinthMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.95 });
    const plinth = new THREE.Mesh(plinthGeo, plinthMat);
    plinth.position.y = -plinthDepth / 2 + 0.5;
    group.add(plinth);

    if (lair.type === 'graveyard') {
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

      pGroup.position.set(p.x, this.getTerrainHeight(p.x, p.y), p.y);
      pGroup.visible = this.gridManager.isPixelVisible(p.x, p.y);

      // Night Torch illumination
      const torch = pGroup.getObjectByName('nightTorch');
      if (torch) {
        torch.visible = isNightOrDusk;
        const flame = torch.getObjectByName('torchFlame');
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

    // Night Torch in Left Hand
    const torch = this.create3DNightTorchMesh();
    torch.position.set(-1.8, 3.2, 0.6);
    group.add(torch);

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

      heroGroup.position.set(h.x, this.getTerrainHeight(h.x, h.y), h.y);
      heroGroup.visible = this.gridManager.isPixelVisible(h.x, h.y);

      // Night Torch illumination
      const torch = heroGroup.getObjectByName('nightTorch');
      if (torch) {
        torch.visible = isNightOrDusk;
        const flame = torch.getObjectByName('torchFlame');
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
    sprite.scale.set(44, 11.0, 1);
    const headY = hero.heroClass === 'dwarf' ? 11.5 : 13.5;
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

    // Night Torch / Lantern in Left Hand
    const torch = this.create3DNightTorchMesh();
    torch.position.set(-1.8, isDwarf ? 2.5 : 3.2, 0.6);
    group.add(torch);

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

      // Flight Altitude: dragons soar majestically high in the skies
      const isFlying = m.type === 'red_dragon' || m.isFlying;
      const flightAltitude = isFlying ? 24 + Math.sin(time * 0.35) * 4 : 0;
      mGroup.position.set(m.x, this.getTerrainHeight(m.x, m.y) + flightAltitude, m.y);
      mGroup.visible = this.gridManager.isPixelVisible(m.x, m.y);

      // Keep ground shadow projected on terrain beneath flying dragon
      const groundShadow = mGroup.getObjectByName('dragonShadow');
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
        const dragonBody = mGroup.getObjectByName('dragonBody');

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

      // Massive Articulated Dragon Wings with Shoulder Pivots
      const wingMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.6, side: THREE.DoubleSide });
      const boneMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.8 });

      // Left Wing (Pivoting from left shoulder)
      const wingPivotL = new THREE.Group();
      wingPivotL.position.set(-7, 18, 0);
      wingPivotL.name = 'wingL';

      const wingGeoL = new THREE.PlaneGeometry(26, 16);
      wingGeoL.translate(-13, 0, 0);
      const wingMeshL = new THREE.Mesh(wingGeoL, wingMat);
      wingMeshL.castShadow = true;
      wingPivotL.add(wingMeshL);

      const wingBoneL = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.3, 26, 6), boneMat);
      wingBoneL.rotation.z = Math.PI / 2;
      wingBoneL.position.set(-13, 7, 0);
      wingPivotL.add(wingBoneL);
      group.add(wingPivotL);

      // Right Wing (Pivoting from right shoulder)
      const wingPivotR = new THREE.Group();
      wingPivotR.position.set(7, 18, 0);
      wingPivotR.name = 'wingR';

      const wingGeoR = new THREE.PlaneGeometry(26, 16);
      wingGeoR.translate(13, 0, 0);
      const wingMeshR = new THREE.Mesh(wingGeoR, wingMat);
      wingMeshR.castShadow = true;
      wingPivotR.add(wingMeshR);

      const wingBoneR = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.3, 26, 6), boneMat);
      wingBoneR.rotation.z = -Math.PI / 2;
      wingBoneR.position.set(13, 7, 0);
      wingPivotR.add(wingBoneR);
      group.add(wingPivotR);

      // Sinuous Spiked Tail
      const tailGeo = new THREE.CylinderGeometry(1.4, 0.4, 18, 6);
      tailGeo.rotateX(Math.PI / 2);
      const tail = new THREE.Mesh(tailGeo, bodyMat);
      tail.position.set(0, 15, -12);
      tail.name = 'dragonTail';
      group.add(tail);

      // Ground Shadow Decal below Flying Dragon
      const shadowGeo = new THREE.PlaneGeometry(28, 20);
      shadowGeo.rotateX(-Math.PI / 2);
      const shadowMat = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.35,
        depthWrite: false
      });
      const dragonShadow = new THREE.Mesh(shadowGeo, shadowMat);
      dragonShadow.name = 'dragonShadow';
      dragonShadow.position.set(0, -24, 0);
      group.add(dragonShadow);
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

      tcGroup.position.set(tc.x, this.getTerrainHeight(tc.x, tc.y), tc.y);
      tcGroup.visible = this.gridManager.isPixelVisible(tc.x, tc.y);

      // Night Hand Lantern illumination
      const isNightOrDusk = state.dayPhase === 'night' || state.dayPhase === 'dusk' || state.dayPhase === 'dawn';
      const torch = tcGroup.getObjectByName('nightTorch');
      if (torch) {
        torch.visible = isNightOrDusk;
        const flame = torch.getObjectByName('torchFlame');
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

    // Night Hand Lantern
    const torch = this.create3DNightTorchMesh();
    torch.position.set(1.8, 3.2, 0.6);
    group.add(torch);

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
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0x475569, map: this.royalCastleWallTexture, roughness: 0.9 });
      const timberMat = new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.95 });
      const emberMat = new THREE.MeshStandardMaterial({
        color: 0xf97316,
        emissive: 0xd97706,
        emissiveIntensity: 1.8
      });

      // 1. Charred Crumbled Foundation Plinth
      const plinthGeo = new THREE.BoxGeometry(w * 0.92, 1.2, h * 0.92);
      const plinth = new THREE.Mesh(plinthGeo, charMat);
      plinth.position.y = 0.6;
      plinth.receiveShadow = true;
      group.add(plinth);

      // 2. Jagged Broken Stone Wall Stubs around perimeter
      const wall1Geo = new THREE.BoxGeometry(w * 0.45, 4.2, 1.8);
      const wall1 = new THREE.Mesh(wall1Geo, stoneMat);
      wall1.position.set(-w * 0.2, 2.4, -h * 0.4);
      wall1.rotation.y = 0.12;
      wall1.castShadow = true;
      group.add(wall1);

      const wall2Geo = new THREE.BoxGeometry(1.8, 3.2, h * 0.4);
      const wall2 = new THREE.Mesh(wall2Geo, stoneMat);
      wall2.position.set(w * 0.4, 2.0, -h * 0.1);
      wall2.rotation.y = -0.15;
      wall2.castShadow = true;
      group.add(wall2);

      const wall3Geo = new THREE.BoxGeometry(w * 0.35, 2.6, 1.8);
      const wall3 = new THREE.Mesh(wall3Geo, stoneMat);
      wall3.position.set(w * 0.15, 1.6, h * 0.38);
      wall3.castShadow = true;
      group.add(wall3);

      // 3. Fallen Charred Timber Roof Beams
      const beam1Geo = new THREE.BoxGeometry(w * 0.6, 0.9, 0.9);
      const beam1 = new THREE.Mesh(beam1Geo, timberMat);
      beam1.position.set(0, 1.6, 0);
      beam1.rotation.set(0.2, 0.45, 0.25);
      beam1.castShadow = true;
      group.add(beam1);

      const beam2Geo = new THREE.BoxGeometry(w * 0.45, 0.8, 0.8);
      const beam2 = new THREE.Mesh(beam2Geo, timberMat);
      beam2.position.set(-w * 0.1, 1.2, h * 0.15);
      beam2.rotation.set(-0.15, -0.6, -0.2);
      beam2.castShadow = true;
      group.add(beam2);

      // 4. Shattered Rubble / Stone Blocks
      const rubbleGeo = new THREE.DodecahedronGeometry(1.6, 0);
      const rubbleMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9 });
      for (let r = 0; r < 6; r++) {
        const rubble = new THREE.Mesh(rubbleGeo, rubbleMat);
        const rx = (Math.sin(r * 1.7) * w * 0.3);
        const rz = (Math.cos(r * 1.7) * h * 0.3);
        rubble.position.set(rx, 1.2, rz);
        rubble.rotation.set(r * 0.5, r * 0.8, 0);
        rubble.scale.set(0.8 + (r % 3) * 0.3, 0.6 + (r % 2) * 0.4, 0.8 + (r % 3) * 0.3);
        rubble.castShadow = true;
        group.add(rubble);
      }

      // 5. Glowing Embers in the Ashes
      for (let e = 0; e < 3; e++) {
        const emberGeo = new THREE.SphereGeometry(0.7, 5, 5);
        const ember = new THREE.Mesh(emberGeo, emberMat);
        ember.position.set(Math.sin(e * 2.3) * w * 0.2, 0.9, Math.cos(e * 2.3) * h * 0.2);
        group.add(ember);
      }

      // 6. Plume of Rising Smoke
      const smoke = this.createSmokeEmitter(0, 2.0, 0, true, 4);
      group.add(smoke);

      return group;
    } else if (c.type === 'hero') {
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

    // Sanitize any raw floating point fractions into clean integers (e.g. 4.000000003 -> 4)
    const displayText = ft.text.replace(/(\d+)\.\d+/g, (match) => Math.round(parseFloat(match)).toString());

    const isGold = displayText.includes('g') || displayText.includes('Tax') || displayText.includes('Treasury') || displayText.includes('Bounty') || displayText.includes('Loot') || displayText.includes('Ale');

    if (isGold) {
      // 1. Draw Large 3D Shaded Metallic Sovereign Gold Coin
      const cx = 72;
      const cy = 80;
      const r = 52;

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
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(cx, cy, r - 5, 0, Math.PI * 2);
      ctx.stroke();

      // Crown sovereign symbol
      ctx.fillStyle = '#78350f';
      ctx.font = 'bold 50px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('👑', cx, cy - 2);

      // 2. Draw Transaction Sum in Large Crisp Typography with heavy outline
      ctx.font = 'bold 64px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 12;
      ctx.strokeText(displayText, 144, cy);

      ctx.fillStyle = '#fef08a';
      ctx.fillText(displayText, 144, cy);
    } else {
      // Large Combat damage, healing, or level up banner
      ctx.font = 'bold 58px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 12;
      ctx.strokeText(displayText, 256, 80);

      ctx.fillStyle = ft.color || '#ffffff';
      ctx.fillText(displayText, 256, 80);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
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
