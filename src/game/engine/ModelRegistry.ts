import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class ModelRegistry {
  private static instance: ModelRegistry;
  private loader: GLTFLoader = new GLTFLoader();
  private templates: Map<string, THREE.Group> = new Map();
  private loading: Set<string> = new Set();
  private onChangeCallbacks: (() => void)[] = [];
  public isReady: boolean = false;

  public static getInstance(): ModelRegistry {
    if (!ModelRegistry.instance) {
      ModelRegistry.instance = new ModelRegistry();
    }
    return ModelRegistry.instance;
  }

  public onChange(callback: () => void) {
    this.onChangeCallbacks.push(callback);
  }

  private notify() {
    for (const cb of this.onChangeCallbacks) {
      try {
        cb();
      } catch (err) {
        console.warn('ModelRegistry onChange callback error:', err);
      }
    }
  }

  public preloadAll() {
    if (typeof window === 'undefined') return;

    const buildingModels: Record<string, string> = {
      'palace': '/models/building_castle_blue.gltf',
      'warrior_guild': '/models/building_barracks_blue.gltf',
      'ranger_guild': '/models/building_archeryrange_blue.gltf',
      'rogue_guild': '/models/building_tavern_blue.gltf',
      'blacksmith': '/models/building_blacksmith_blue.gltf',
      'marketplace': '/models/building_market_blue.gltf',
      'royal_inn': '/models/building_tavern_blue.gltf',
      'cleric_temple': '/models/building_church_blue.gltf',
      'peasant_cottage': '/models/building_home_A_blue.gltf',
      'peasant_cottage_b': '/models/building_home_B_blue.gltf',
      'dwarf_settlement': '/models/building_mine_blue.gltf',
      'lumbermill': '/models/building_lumbermill_blue.gltf'
    };

    const characterModels: Record<string, string> = {
      'knight': '/models/Knight.glb',
      'ranger': '/models/Ranger.glb',
      'rogue': '/models/Rogue.glb',
      'mage': '/models/Mage.glb',
      'barbarian': '/models/Barbarian.glb',
      'engineer': '/models/Engineer.glb',
      'skeleton_warrior': '/models/Skeleton_Warrior.glb',
      'skeleton_mage': '/models/Skeleton_Mage.glb',
      'necromancer': '/models/Necromancer.glb',
      'orc_raider': '/models/OrcRaider.glb',
      'werewolf': '/models/Werewolf_Wolf.glb',
      'vampire': '/models/Vampire.glb'
    };

    const all = { ...buildingModels, ...characterModels };
    let remaining = Object.keys(all).length;

    for (const [key, url] of Object.entries(all)) {
      this.loadModel(key, url, () => {
        remaining--;
        if (remaining <= 0) {
          this.isReady = true;
        }
        this.notify();
      });
    }
  }

  private loadModel(key: string, url: string, onDone?: () => void) {
    if (this.templates.has(key) || this.loading.has(key)) return;
    this.loading.add(key);

    this.loader.load(
      url,
      (gltf) => {
        const root = gltf.scene;
        root.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) {
              child.material.side = THREE.FrontSide;
              if ('roughness' in child.material) {
                child.material.roughness = 0.85;
              }
            }
          }
        });

        this.templates.set(key, root);
        this.loading.delete(key);
        if (onDone) onDone();
      },
      undefined,
      (err) => {
        console.warn(`Failed to load 3D model ${key} from ${url}:`, err);
        this.loading.delete(key);
        if (onDone) onDone();
      }
    );
  }

  public hasModel(key: string): boolean {
    return this.templates.has(key);
  }

  public cloneModel(key: string): THREE.Group | null {
    const template = this.templates.get(key);
    if (!template) return null;
    return template.clone(true);
  }

  public getBuildingModel(type: string): THREE.Group | null {
    if (type === 'peasant_cottage') {
      const variant = Math.random() > 0.5 ? 'peasant_cottage' : 'peasant_cottage_b';
      return this.cloneModel(variant) || this.cloneModel('peasant_cottage');
    }
    return this.cloneModel(type);
  }

  public getHeroModel(heroClass: string): THREE.Group | null {
    switch (heroClass) {
      case 'warrior':
      case 'paladin':
        return this.cloneModel('knight');
      case 'ranger':
      case 'elf':
        return this.cloneModel('ranger');
      case 'rogue':
        return this.cloneModel('rogue');
      case 'wizard':
      case 'healer':
      case 'cleric':
        return this.cloneModel('mage');
      case 'barbarian':
      case 'dwarf':
      case 'monk':
        return this.cloneModel('barbarian');
      default:
        return this.cloneModel('knight');
    }
  }

  public getCitizenModel(type: 'peasant' | 'tax_collector'): THREE.Group | null {
    return this.cloneModel('engineer');
  }

  public getMonsterModel(monsterType: string): THREE.Group | null {
    switch (monsterType) {
      case 'skeleton':
        return this.cloneModel('skeleton_warrior');
      case 'skeleton_mage':
        return this.cloneModel('skeleton_mage');
      case 'necromancer':
      case 'cultist':
        return this.cloneModel('necromancer');
      case 'goblin_spearman':
      case 'goblin_archer':
      case 'goblin_shaman':
      case 'orc':
        return this.cloneModel('orc_raider');
      case 'werewolf':
      case 'dire_wolf':
        return this.cloneModel('werewolf');
      case 'vampire_lord':
        return this.cloneModel('vampire');
      default:
        return null;
    }
  }
}
