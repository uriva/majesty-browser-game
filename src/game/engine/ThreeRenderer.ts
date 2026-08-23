import * as THREE from 'three';
import { BUILDING_DEFINITIONS, HERO_CLASS_DEFINITIONS, MONSTER_DEFINITIONS } from '../constants';
import { Building, Flag, FloatingText, GameState, Hero, Monster, MonsterLair, Particle, Projectile, TaxCollector, Treasure } from '../types';
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

  // Object pools / mappings
  private terrainGroup: THREE.Group;
  private fogGroup: THREE.Group;
  private buildingsMap: Map<string, THREE.Group> = new Map();
  private heroesMap: Map<string, THREE.Group> = new Map();
  private monstersMap: Map<string, THREE.Group> = new Map();
  private lairsMap: Map<string, THREE.Group> = new Map();
  private taxCollectorsMap: Map<string, THREE.Group> = new Map();
  private treasuresMap: Map<string, THREE.Group> = new Map();
  private flagsMap: Map<string, THREE.Group> = new Map();
  private projectilesMap: Map<string, THREE.Group> = new Map();
  private previewMesh: THREE.Mesh | null = null;

  // Raycaster for 3D mouse interaction
  public raycaster: THREE.Raycaster = new THREE.Raycaster();
  public groundPlane: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  // Camera Orbit / Target
  public cameraTarget: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public cameraDistance: number = 380;
  public cameraPitch: number = 0.85; // Angle above horizon (~50 deg)
  public cameraYaw: number = 0.0;    // Rotation around Y axis
  public cameraMode: 'isometric' | 'free' | 'top_down' | 'follow' = 'isometric';

  constructor(container: HTMLDivElement, gridManager: GridManager) {
    this.container = container;
    this.gridManager = gridManager;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

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
    this.dirLight.shadow.bias = -0.0005;
    this.scene.add(this.dirLight);

    // 5. Groups
    this.terrainGroup = new THREE.Group();
    this.fogGroup = new THREE.Group();
    this.scene.add(this.terrainGroup);
    this.scene.add(this.fogGroup);

    this.buildTerrain();
    this.buildFogOfWar();
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
      color: 0x285e46,
      roughness: 0.85,
      metalness: 0.05
    });

    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.position.set((w * ts) / 2, 0, (h * ts) / 2);
    groundMesh.receiveShadow = true;
    this.terrainGroup.add(groundMesh);

    // Natural features (trees, rocks, roads, water)
    const treeGeo = new THREE.ConeGeometry(8, 22, 5);
    const trunkGeo = new THREE.CylinderGeometry(2, 2.5, 8, 5);
    const treeMat = new THREE.MeshStandardMaterial({ color: 0x064e3b, roughness: 0.8 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x542608, roughness: 0.9 });
    const rockGeo = new THREE.DodecahedronGeometry(6, 0);
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
          const roadMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.8 });
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
          // Pine Tree
          const tree = new THREE.Group();
          const trunk = new THREE.Mesh(trunkGeo, trunkMat);
          trunk.position.y = 4;
          trunk.castShadow = true;
          trunk.receiveShadow = true;
          tree.add(trunk);

          const canopy1 = new THREE.Mesh(treeGeo, treeMat);
          canopy1.position.y = 15;
          canopy1.castShadow = true;
          tree.add(canopy1);

          const canopy2 = new THREE.Mesh(treeGeo, treeMat);
          canopy2.position.y = 20;
          canopy2.scale.set(0.7, 0.7, 0.7);
          canopy2.castShadow = true;
          tree.add(canopy2);

          tree.position.set(px, 0, pz);
          this.terrainGroup.add(tree);
        } else if (tile === 4) {
          // Mountain Rock Formation
          const rock = new THREE.Mesh(rockGeo, rockMat);
          rock.position.set(px, 4, pz);
          rock.scale.set(1.4, 1.2, 1.3);
          rock.rotation.set(Math.random(), Math.random(), Math.random());
          rock.castShadow = true;
          rock.receiveShadow = true;
          this.terrainGroup.add(rock);
        }
      }
    }
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
          mat.opacity = 0.48; // Explored shadow
          fogTile.visible = true;
        } else {
          fogTile.visible = false; // Fully visible area
        }
      }
    }
  }

  // --- MAIN RENDER CYCLE ---
  public render(state: GameState, mouseWorldPos: { x: number; y: number } | null) {
    // 1. Update Camera Position & Target
    this.updateCamera(state);

    // 2. Day / Night Atmosphere Lighting
    this.updateDayNightLighting(state);

    // 3. Update Fog of War
    this.updateFogOfWar(state);

    // 4. Update Buildings
    this.updateBuildings(state);

    // 5. Update Monster Lairs
    this.updateLairs(state);

    // 6. Update Treasures
    this.updateTreasures(state);

    // 7. Update Flags
    this.updateFlags(state);

    // 8. Update Tax Collectors
    this.updateTaxCollectors(state);

    // 9. Update Heroes
    this.updateHeroes(state);

    // 10. Update Monsters
    this.updateMonsters(state);

    // 11. Update Projectiles
    this.updateProjectiles(state);

    // 12. Render 3D Scene
    this.renderer.render(this.scene, this.camera);
  }

  private updateCamera(state: GameState) {
    // Follow active hero if in follow mode
    if (this.cameraMode === 'follow' && state.selectedEntity?.type === 'hero') {
      const hero = state.heroes.find(h => h.id === state.selectedEntity?.id);
      if (hero) {
        this.cameraTarget.set(hero.x, 0, hero.y);
      }
    } else {
      this.cameraTarget.set(state.camera.x, 0, state.camera.y);
    }

    // Convert spherical coordinates (pitch, yaw, distance) to 3D position
    const cosPitch = Math.cos(this.cameraPitch);
    const sinPitch = Math.sin(this.cameraPitch);
    const sinYaw = Math.sin(this.cameraYaw);
    const cosYaw = Math.cos(this.cameraYaw);

    const dist = this.cameraDistance / state.camera.zoom;

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

  // --- 3D BUILDINGS ---
  private updateBuildings(state: GameState) {
    const activeIds = new Set<string>();

    for (const b of state.buildings) {
      activeIds.add(b.id);
      let group = this.buildingsMap.get(b.id);

      if (!group) {
        group = this.create3DBuilding(b);
        this.scene.add(group);
        this.buildingsMap.set(b.id, group);
      }

      // Position in 3D (Z is depth in Three.js)
      const ts = this.gridManager.tileSize;
      const px = (b.x + b.width / 2) * ts;
      const pz = (b.y + b.height / 2) * ts;
      group.position.set(px, 0, pz);

      // Check visibility in fog
      const isVisible = this.gridManager.isPixelExplored(px, pz);
      group.visible = isVisible;
    }

    // Cleanup destroyed buildings
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

    if (b.type === 'palace') {
      // Grand Royal Castle Keep
      const castleBaseGeo = new THREE.BoxGeometry(w * 0.85, 24, h * 0.85);
      const castleBaseMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8 });
      const castleBase = new THREE.Mesh(castleBaseGeo, castleBaseMat);
      castleBase.position.y = 12;
      castleBase.castShadow = true;
      castleBase.receiveShadow = true;
      group.add(castleBase);

      // Central Grand Tower & Red Roof
      const towerGeo = new THREE.BoxGeometry(w * 0.45, 36, h * 0.45);
      const towerMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.7 });
      const tower = new THREE.Mesh(towerGeo, towerMat);
      tower.position.y = 18;
      tower.castShadow = true;
      group.add(tower);

      const roofGeo = new THREE.ConeGeometry(w * 0.38, 20, 4);
      const roofMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.6 });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.y = 46;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      group.add(roof);

      // Golden Sovereign Crown Spire
      const crownGeo = new THREE.CylinderGeometry(3, 4, 6, 8);
      const crownMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.6, roughness: 0.2 });
      const crown = new THREE.Mesh(crownGeo, crownMat);
      crown.position.y = 59;
      group.add(crown);
    } else if (b.type === 'wizard_tower') {
      // Tall Cylindrical Arcane Tower
      const cylinderGeo = new THREE.CylinderGeometry(w * 0.3, w * 0.36, 42, 12);
      const towerMat = new THREE.MeshStandardMaterial({ color: 0x312e81, roughness: 0.7 });
      const tower = new THREE.Mesh(cylinderGeo, towerMat);
      tower.position.y = 21;
      tower.castShadow = true;
      group.add(tower);

      const coneGeo = new THREE.ConeGeometry(w * 0.34, 22, 12);
      const coneMat = new THREE.MeshStandardMaterial({ color: 0x7c3aed, roughness: 0.5 });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.y = 53;
      cone.castShadow = true;
      group.add(cone);

      // Rotating Glowing Arcane Orb
      const orbGeo = new THREE.SphereGeometry(5, 12, 12);
      const orbMat = new THREE.MeshStandardMaterial({
        color: 0xc084fc,
        emissive: 0x9333ea,
        emissiveIntensity: 0.8,
        roughness: 0.2
      });
      const orb = new THREE.Mesh(orbGeo, orbMat);
      orb.position.y = 67;
      group.add(orb);
    } else if (b.type === 'marketplace') {
      // Marketplace Stalls with Striped Canvas
      const stallBaseGeo = new THREE.BoxGeometry(w * 0.8, 8, h * 0.8);
      const stallMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
      const stall = new THREE.Mesh(stallBaseGeo, stallMat);
      stall.position.y = 4;
      stall.castShadow = true;
      group.add(stall);

      // Canopy
      const canopyGeo = new THREE.ConeGeometry(w * 0.45, 12, 4);
      const canopyMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.7 });
      const canopy = new THREE.Mesh(canopyGeo, canopyMat);
      canopy.position.y = 16;
      canopy.rotation.y = Math.PI / 4;
      canopy.castShadow = true;
      group.add(canopy);
    } else if (b.type === 'blacksmith') {
      // Stone Forge with Chimney
      const forgeBaseGeo = new THREE.BoxGeometry(w * 0.8, 14, h * 0.7);
      const forgeMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.8 });
      const forge = new THREE.Mesh(forgeBaseGeo, forgeMat);
      forge.position.y = 7;
      forge.castShadow = true;
      group.add(forge);

      const chimneyGeo = new THREE.BoxGeometry(8, 26, 8);
      const chimney = new THREE.Mesh(chimneyGeo, forgeMat);
      chimney.position.set(w * 0.25, 13, -h * 0.2);
      chimney.castShadow = true;
      group.add(chimney);
    } else if (b.type === 'peasant_cottage') {
      // Cozy Thatched Cottage
      const cottageBaseGeo = new THREE.BoxGeometry(w * 0.75, 10, h * 0.75);
      const cottageBaseMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9 });
      const cottageBase = new THREE.Mesh(cottageBaseGeo, cottageBaseMat);
      cottageBase.position.y = 5;
      cottageBase.castShadow = true;
      group.add(cottageBase);

      const roofGeo = new THREE.ConeGeometry(w * 0.45, 10, 4);
      const roofMat = new THREE.MeshStandardMaterial({ color: 0xca8a04, roughness: 0.8 });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.y = 15;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      group.add(roof);
    } else {
      // Standard Guild / Building
      const baseGeo = new THREE.BoxGeometry(w * 0.8, 16, h * 0.8);
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8 });
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.position.y = 8;
      base.castShadow = true;
      group.add(base);

      const roofGeo = new THREE.ConeGeometry(w * 0.45, 14, 4);
      const roofMat = new THREE.MeshStandardMaterial({
        color: b.type.includes('ranger') ? 0x065f46 : (b.type.includes('warrior') ? 0x1e3a8a : 0xb45309),
        roughness: 0.7
      });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.y = 23;
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      group.add(roof);
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

    if (lair.type === 'dragon_cavern') {
      const volcanoGeo = new THREE.ConeGeometry(w * 0.6, 32, 8);
      const volcanoMat = new THREE.MeshStandardMaterial({ color: 0x450a0a, roughness: 0.9 });
      const volcano = new THREE.Mesh(volcanoGeo, volcanoMat);
      volcano.position.y = 16;
      volcano.castShadow = true;
      group.add(volcano);

      const magmaGeo = new THREE.SphereGeometry(6, 8, 8);
      const magmaMat = new THREE.MeshStandardMaterial({ color: 0xea580c, emissive: 0xf97316, emissiveIntensity: 0.9 });
      const magma = new THREE.Mesh(magmaGeo, magmaMat);
      magma.position.y = 28;
      group.add(magma);
    } else {
      const rockGeo = new THREE.DodecahedronGeometry(w * 0.35, 0);
      const rockMat = new THREE.MeshStandardMaterial({
        color: lair.type === 'graveyard' ? 0x292524 : (lair.type === 'goblin_hut' ? 0x713f12 : 0x1e293b),
        roughness: 0.9
      });
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.position.y = 8;
      rock.castShadow = true;
      group.add(rock);
    }

    return group;
  }

  // --- 3D TREASURES ---
  private updateTreasures(state: GameState) {
    const activeIds = new Set<string>();

    for (const t of state.treasures) {
      activeIds.add(t.id);
      let mesh = this.treasuresMap.get(t.id);

      if (!mesh) {
        mesh = new THREE.Group();
        const chestGeo = new THREE.BoxGeometry(8, 6, 6);
        const chestMat = new THREE.MeshStandardMaterial({ color: 0xb45309, metalness: 0.5, roughness: 0.3 });
        const cMesh = new THREE.Mesh(chestGeo, chestMat);
        cMesh.position.y = 3;
        cMesh.castShadow = true;
        mesh.add(cMesh);

        this.scene.add(mesh);
        this.treasuresMap.set(t.id, mesh);
      }

      mesh.position.set(t.x, 0, t.y);
      mesh.visible = this.gridManager.isPixelExplored(t.x, t.y);
    }

    for (const [id, mesh] of this.treasuresMap.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(mesh);
        this.treasuresMap.delete(id);
      }
    }
  }

  // --- 3D FLAGS ---
  private updateFlags(state: GameState) {
    const activeIds = new Set<string>();

    for (const f of state.flags) {
      activeIds.add(f.id);
      let flagGroup = this.flagsMap.get(f.id);

      if (!flagGroup) {
        flagGroup = new THREE.Group();
        // Pole
        const poleGeo = new THREE.CylinderGeometry(0.8, 0.8, 28, 6);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.8, roughness: 0.2 });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.y = 14;
        pole.castShadow = true;
        flagGroup.add(pole);

        // Banner
        const bannerGeo = new THREE.BoxGeometry(10, 6, 0.5);
        const bannerColor = f.type === 'attack' ? 0xdc2626 : (f.type === 'explore' ? 0x2563eb : 0xeab308);
        const bannerMat = new THREE.MeshStandardMaterial({ color: bannerColor, roughness: 0.6 });
        const banner = new THREE.Mesh(bannerGeo, bannerMat);
        banner.position.set(5, 23, 0);
        flagGroup.add(banner);

        // Glowing Beacon Column
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

  // --- 3D HEROES (ANIMATED LIMBS & WEAPONS) ---
  private updateHeroes(state: GameState) {
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
      }

      heroGroup.position.set(h.x, 0, h.y);
      heroGroup.visible = this.gridManager.isPixelVisible(h.x, h.y);

      // Direction rotation
      if (h.direction === 'left') heroGroup.rotation.y = -Math.PI / 2;
      else if (h.direction === 'right') heroGroup.rotation.y = Math.PI / 2;
      else if (h.direction === 'up') heroGroup.rotation.y = Math.PI;
      else heroGroup.rotation.y = 0;

      // Animated Walk Strides
      const isMoving = h.state === 'wandering' || h.state === 'pursuing_flag' || h.state === 'fleeing' || h.state === 'collecting_treasure';
      const legStride = isMoving ? Math.sin(time * 1.4) * 0.45 : 0;

      const leftLeg = heroGroup.getObjectByName('leftLeg');
      const rightLeg = heroGroup.getObjectByName('rightLeg');
      if (leftLeg) leftLeg.rotation.x = legStride;
      if (rightLeg) rightLeg.rotation.x = -legStride;

      // Animated Attack Swing
      const rightArm = heroGroup.getObjectByName('rightArm');
      if (rightArm) {
        if (h.isAttackingAnimation > 0) {
          rightArm.rotation.x = -Math.sin(h.isAttackingAnimation * 15) * 1.5;
        } else {
          rightArm.rotation.x = isMoving ? -legStride * 0.8 : 0;
        }
      }
    }

    for (const [id, group] of this.heroesMap.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(group);
        this.heroesMap.delete(id);
      }
    }
  }

  private create3DHeroMesh(h: Hero): THREE.Group {
    const group = new THREE.Group();
    const classDef = HERO_CLASS_DEFINITIONS[h.heroClass];
    const colorNum = parseInt(classDef.color.replace('#', '0x'), 16);

    // Torso
    const torsoGeo = new THREE.BoxGeometry(5, 7, 3.5);
    const torsoMat = new THREE.MeshStandardMaterial({ color: colorNum, roughness: 0.7 });
    const torso = new THREE.Mesh(torsoGeo, torsoMat);
    torso.position.y = 8.5;
    torso.castShadow = true;
    group.add(torso);

    // Head
    const headGeo = new THREE.SphereGeometry(2.5, 8, 8);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xfed7aa, roughness: 0.8 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 14;
    head.castShadow = true;
    group.add(head);

    // Helmet / Hat
    if (h.heroClass === 'warrior' || h.heroClass === 'dwarf') {
      const helmGeo = new THREE.CylinderGeometry(2.6, 2.7, 2.5, 8);
      const helmMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7, roughness: 0.3 });
      const helm = new THREE.Mesh(helmGeo, helmMat);
      helm.position.y = 15;
      group.add(helm);
    } else if (h.heroClass === 'wizard') {
      const hatGeo = new THREE.ConeGeometry(3.5, 7, 8);
      const hatMat = new THREE.MeshStandardMaterial({ color: 0x6d28d9, roughness: 0.6 });
      const hat = new THREE.Mesh(hatGeo, hatMat);
      hat.position.y = 18;
      group.add(hat);
    }

    // Legs
    const legGeo = new THREE.BoxGeometry(1.8, 6, 1.8);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });

    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(-1.4, 3, 0);
    leftLeg.name = 'leftLeg';
    leftLeg.castShadow = true;
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(1.4, 3, 0);
    rightLeg.name = 'rightLeg';
    rightLeg.castShadow = true;
    group.add(rightLeg);

    // Right Arm & Weapon
    const armGroup = new THREE.Group();
    armGroup.name = 'rightArm';
    armGroup.position.set(3.2, 10.5, 0);

    const armGeo = new THREE.BoxGeometry(1.6, 6, 1.6);
    const arm = new THREE.Mesh(armGeo, torsoMat);
    arm.position.y = -2;
    arm.castShadow = true;
    armGroup.add(arm);

    // Weapon
    if (h.heroClass === 'warrior') {
      const swordGeo = new THREE.BoxGeometry(1, 12, 0.4);
      const swordMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.9, roughness: 0.1 });
      const sword = new THREE.Mesh(swordGeo, swordMat);
      sword.position.set(0, -3, 5);
      sword.rotation.x = Math.PI / 3;
      sword.castShadow = true;
      armGroup.add(sword);
    } else if (h.heroClass === 'wizard') {
      const staffGeo = new THREE.CylinderGeometry(0.5, 0.5, 16, 6);
      const staffMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 });
      const staff = new THREE.Mesh(staffGeo, staffMat);
      staff.position.set(0, -1, 4);
      staff.rotation.x = Math.PI / 6;
      armGroup.add(staff);
    }

    group.add(armGroup);
    return group;
  }

  // --- 3D MONSTERS ---
  private updateMonsters(state: GameState) {
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

      // Dragon Wing Flapping Animation
      if (m.type === 'red_dragon') {
        const wingL = mGroup.getObjectByName('wingL');
        const wingR = mGroup.getObjectByName('wingR');
        const flap = Math.sin(time * 0.8) * 0.5;
        if (wingL) wingL.rotation.z = flap;
        if (wingR) wingR.rotation.z = -flap;
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
      // Big Boss Red Dragon
      const bodyGeo = new THREE.SphereGeometry(14, 12, 12);
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.7 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 16;
      body.scale.set(1.4, 1, 1);
      body.castShadow = true;
      group.add(body);

      // Wings
      const wingGeo = new THREE.PlaneGeometry(28, 18);
      const wingMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, side: THREE.DoubleSide });

      const wingL = new THREE.Mesh(wingGeo, wingMat);
      wingL.position.set(-18, 22, 0);
      wingL.name = 'wingL';
      group.add(wingL);

      const wingR = new THREE.Mesh(wingGeo, wingMat);
      wingR.position.set(18, 22, 0);
      wingR.name = 'wingR';
      group.add(wingR);
    } else if (m.type === 'giant_rat') {
      const ratGeo = new THREE.SphereGeometry(5, 8, 8);
      const ratMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.9 });
      const rat = new THREE.Mesh(ratGeo, ratMat);
      rat.position.y = 4;
      rat.scale.set(1.5, 0.8, 1);
      rat.castShadow = true;
      group.add(rat);
    } else {
      // Bipedal humanoid monster
      const bodyGeo = new THREE.BoxGeometry(6, 9, 4);
      const bodyMat = new THREE.MeshStandardMaterial({ color: colorNum, roughness: 0.8 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 7;
      body.castShadow = true;
      group.add(body);

      const headGeo = new THREE.SphereGeometry(3, 8, 8);
      const head = new THREE.Mesh(headGeo, bodyMat);
      head.position.y = 13;
      head.castShadow = true;
      group.add(head);
    }

    return group;
  }

  // --- 3D TAX COLLECTOR ---
  private updateTaxCollectors(state: GameState) {
    const activeIds = new Set<string>();
    const time = Date.now() * 0.01;

    for (const tc of state.taxCollectors) {
      activeIds.add(tc.id);
      let tcGroup = this.taxCollectorsMap.get(tc.id);

      if (!tcGroup) {
        tcGroup = new THREE.Group();
        // Body (Purple Doublet)
        const bodyGeo = new THREE.BoxGeometry(5.5, 8, 4);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x6b21a8, roughness: 0.7 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 8;
        body.castShadow = true;
        tcGroup.add(body);

        // Head & Feathered Cap
        const headGeo = new THREE.SphereGeometry(2.5, 8, 8);
        const headMat = new THREE.MeshStandardMaterial({ color: 0xfed7aa, roughness: 0.8 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 13.5;
        tcGroup.add(head);

        const capGeo = new THREE.CylinderGeometry(3.5, 3.5, 1.5, 8);
        const capMat = new THREE.MeshStandardMaterial({ color: 0x581c87 });
        const cap = new THREE.Mesh(capGeo, capMat);
        cap.position.y = 15.5;
        tcGroup.add(cap);

        // Heavy Gold Coin Sack on Back
        const sackGeo = new THREE.SphereGeometry(4.5, 8, 8);
        const sackMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.6 });
        const sack = new THREE.Mesh(sackGeo, sackMat);
        sack.position.set(0, 9, -3.5);
        sack.castShadow = true;
        tcGroup.add(sack);

        this.scene.add(tcGroup);
        this.taxCollectorsMap.set(tc.id, tcGroup);
      }

      tcGroup.position.set(tc.x, 0, tc.y);
      tcGroup.visible = this.gridManager.isPixelVisible(tc.x, tc.y);
    }

    for (const [id, group] of this.taxCollectorsMap.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(group);
        this.taxCollectorsMap.delete(id);
      }
    }
  }

  // --- 3D PROJECTILES ---
  private updateProjectiles(state: GameState) {
    const activeIds = new Set<string>();

    for (const p of state.projectiles) {
      activeIds.add(p.id);
      let pMesh = this.projectilesMap.get(p.id);

      if (!pMesh) {
        pMesh = new THREE.Group();
        const sphereGeo = new THREE.SphereGeometry(p.type === 'fireball' ? 4 : 2, 8, 8);
        const sphereMat = new THREE.MeshBasicMaterial({
          color: p.type === 'fireball' ? 0xf97316 : (p.type === 'magic_missile' ? 0xc084fc : 0xfde047)
        });
        const sphere = new THREE.Mesh(sphereGeo, sphereMat);
        pMesh.add(sphere);

        this.scene.add(pMesh);
        this.projectilesMap.set(p.id, pMesh);
      }

      pMesh.position.set(p.currentX, 10, p.currentY);
    }

    for (const [id, mesh] of this.projectilesMap.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(mesh);
        this.projectilesMap.delete(id);
      }
    }
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
