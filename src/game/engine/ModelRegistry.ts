import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

export type AnimState = 'idle' | 'walk' | 'run' | 'attack' | 'hammer' | 'death';

export interface CharacterAnimationController {
  mixer: THREE.AnimationMixer;
  actions: Map<AnimState, THREE.AnimationAction>;
  currentState: AnimState;
  play: (state: AnimState, fadeDuration?: number) => void;
  update: (delta: number) => void;
  dispose: () => void;
}

export class ModelRegistry {
  private static instance: ModelRegistry;
  private loader: GLTFLoader = new GLTFLoader();
  private staticTemplates: Map<string, THREE.Group> = new Map();
  private characterTemplates: Map<string, THREE.Group> = new Map();
  private sharedClips: Map<string, THREE.AnimationClip> = new Map();
  private loading: Set<string> = new Set();
  private onChangeCallbacks: (() => void)[] = [];
  public isReady: boolean = false;
  private totalExpected: number = 0;
  private totalLoaded: number = 0;

  public static getInstance(): ModelRegistry {
    if (!ModelRegistry.instance) {
      ModelRegistry.instance = new ModelRegistry();
    }
    return ModelRegistry.instance;
  }

  public onChange(callback: () => void) {
    this.onChangeCallbacks.push(callback);
    if (this.isReady) {
      try { callback(); } catch {}
    }
  }

  private notifyTimeout: ReturnType<typeof setTimeout> | null = null;

  private notify() {
    if (this.notifyTimeout) clearTimeout(this.notifyTimeout);
    this.notifyTimeout = setTimeout(() => {
      this.notifyTimeout = null;
      for (const cb of this.onChangeCallbacks) {
        try {
          cb();
        } catch (err) {
          console.warn('ModelRegistry onChange callback error:', err);
        }
      }
    }, 60);
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

    const natureModels: Record<string, string> = {
      'tree_oak': '/models/nature/tree_oak.glb',
      'tree_pine_a': '/models/nature/tree_pineTallA.glb',
      'tree_pine_b': '/models/nature/tree_pineTallB.glb',
      'tree_detailed': '/models/nature/tree_detailed.glb',
      'tree_small': '/models/nature/tree_small.glb',
      'bush': '/models/nature/plant_bush.glb',
      'bush_detailed': '/models/nature/plant_bushDetailed.glb',
      'flower_red': '/models/nature/flower_redA.glb',
      'flower_purple': '/models/nature/flower_purpleA.glb',
      'flower_yellow': '/models/nature/flower_yellowA.glb',
      'grass_tuft': '/models/nature/grass_leafs.glb',
      'mushrooms': '/models/nature/mushroom_redGroup.glb',
      'rock_large_a': '/models/nature/rock_largeA.glb',
      'rock_large_b': '/models/nature/rock_largeB.glb',
      'rock_small_a': '/models/nature/rock_smallA.glb',
      'rock_small_b': '/models/nature/rock_smallB.glb'
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

    const animationPacks: Record<string, string> = {
      'anim_movement': '/models/animations/Rig_Medium_MovementBasic.glb',
      'anim_general': '/models/animations/Rig_Medium_General.glb',
      'anim_combat': '/models/animations/Rig_Medium_CombatMelee.glb',
      'anim_tools': '/models/animations/Rig_Medium_Tools.glb'
    };

    const allStatic = { ...buildingModels, ...natureModels };
    this.totalExpected = Object.keys(allStatic).length + Object.keys(characterModels).length + Object.keys(animationPacks).length;
    this.totalLoaded = 0;

    const checkComplete = () => {
      this.totalLoaded++;
      if (this.totalLoaded >= this.totalExpected) {
        this.isReady = true;
      }
      this.notify();
    };

    // 1. Load Animation Packs
    for (const [, url] of Object.entries(animationPacks)) {
      this.loader.load(
        url,
        (gltf) => {
          if (gltf.animations) {
            for (const clip of gltf.animations) {
              this.sharedClips.set(clip.name, clip);
            }
          }
          checkComplete();
        },
        undefined,
        () => checkComplete()
      );
    }

    // 2. Load Static Models (Buildings, Trees, Rocks)
    for (const [key, url] of Object.entries(allStatic)) {
      this.loadStaticModel(key, url, checkComplete);
    }

    // 3. Load Skinned Character Models (Rigged with Skeleton)
    for (const [key, url] of Object.entries(characterModels)) {
      this.loadCharacterModel(key, url, checkComplete);
    }
  }

  private loadStaticModel(key: string, url: string, onDone: () => void) {
    if (this.staticTemplates.has(key) || this.loading.has(key)) return;
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
              if (Array.isArray(child.material)) {
                child.material.forEach((m) => { m.side = THREE.DoubleSide; });
              } else {
                child.material.side = THREE.DoubleSide;
              }
            }
          }
        });

        this.staticTemplates.set(key, root);
        this.loading.delete(key);
        onDone();
      },
      undefined,
      (err) => {
        console.warn(`Failed to load static 3D model ${key} from ${url}:`, err);
        this.loading.delete(key);
        onDone();
      }
    );
  }

  private loadCharacterModel(key: string, url: string, onDone: () => void) {
    if (this.characterTemplates.has(key) || this.loading.has(key)) return;
    this.loading.add(key);

    this.loader.load(
      url,
      (gltf) => {
        const root = gltf.scene;
        root.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            child.frustumCulled = false;
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach((m) => { m.side = THREE.DoubleSide; });
              } else {
                child.material.side = THREE.DoubleSide;
              }
            }
          }
        });

        this.characterTemplates.set(key, root);
        this.loading.delete(key);
        onDone();
      },
      undefined,
      (err) => {
        console.warn(`Failed to load character model ${key} from ${url}:`, err);
        this.loading.delete(key);
        onDone();
      }
    );
  }

  public cloneModel(key: string): THREE.Group | null {
    const template = this.staticTemplates.get(key);
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

  public getTreeModel(variant: number): THREE.Group | null {
    if (variant === 0) return this.cloneModel('tree_oak') || this.cloneModel('tree_detailed');
    if (variant === 1) return this.cloneModel('tree_pine_a') || this.cloneModel('tree_pine_b');
    return this.cloneModel('tree_detailed') || this.cloneModel('tree_small');
  }

  public getFloraModel(type: number): THREE.Group | null {
    if (type === 0) return this.cloneModel('flower_yellow');
    if (type === 1) return this.cloneModel('flower_red');
    if (type === 2) return this.cloneModel('flower_purple');
    return this.cloneModel('mushrooms') || this.cloneModel('flower_yellow');
  }

  public getBushOrGrassModel(variant: number): THREE.Group | null {
    if (variant % 2 === 0) return this.cloneModel('grass_tuft');
    return this.cloneModel('bush') || this.cloneModel('bush_detailed');
  }

  public getRockModel(variant: number): THREE.Group | null {
    const list = ['rock_large_a', 'rock_large_b', 'rock_small_a', 'rock_small_b'];
    return this.cloneModel(list[variant % list.length]);
  }

  /**
   * Instantiate an animated rigged character with independent skeleton and animation mixer
   */
  public createAnimatedCharacter(characterKey: string): { group: THREE.Group; controller: CharacterAnimationController } | null {
    const template = this.characterTemplates.get(characterKey);
    if (!template) return null;

    // Use SkeletonUtils.clone to properly duplicate the SkinnedMesh and bones
    const cloned = SkeletonUtils.clone(template) as THREE.Group;
    cloned.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = false;
      }
    });

    const mixer = new THREE.AnimationMixer(cloned);
    const actions = new Map<AnimState, THREE.AnimationAction>();

    const getClip = (preferredNames: string[]): THREE.AnimationClip | null => {
      for (const name of preferredNames) {
        const c = this.sharedClips.get(name);
        if (c) return c;
      }
      return null;
    };

    const idleClip = getClip(['Idle_A', 'Idle_B', 'T-Pose']);
    const walkClip = getClip(['Walking_A', 'Walking_B', 'Walking_C']);
    const runClip = getClip(['Running_A', 'Running_B', 'Walking_A']);
    const attackClip = getClip(['Melee_1H_Attack_Chop', 'Melee_2H_Attack_Chop', 'Melee_1H_Attack_Slice_Horizontal']);
    const hammerClip = getClip(['Hammering', 'Hammer', 'Work_A', 'Working_A']);
    const deathClip = getClip(['Death_A', 'Death_B']);

    if (idleClip) actions.set('idle', mixer.clipAction(idleClip));
    if (walkClip) actions.set('walk', mixer.clipAction(walkClip));
    if (runClip) actions.set('run', mixer.clipAction(runClip));
    if (attackClip) actions.set('attack', mixer.clipAction(attackClip));
    if (hammerClip) actions.set('hammer', mixer.clipAction(hammerClip));
    if (deathClip) actions.set('death', mixer.clipAction(deathClip));

    // Start with Idle action
    let currentState: AnimState = 'idle';
    const idleAction = actions.get('idle');
    if (idleAction) {
      idleAction.play();
    }

    const controller: CharacterAnimationController = {
      mixer,
      actions,
      currentState,
      play: (state: AnimState, fadeDuration = 0.18) => {
        if (controller.currentState === state) return;
        const prevAction = actions.get(controller.currentState);
        const nextAction = actions.get(state);

        if (prevAction && nextAction) {
          prevAction.fadeOut(fadeDuration);
          nextAction.reset().fadeIn(fadeDuration).play();
        } else if (nextAction) {
          nextAction.reset().play();
        }
        controller.currentState = state;
      },
      update: (delta: number) => {
        mixer.update(delta);
      },
      dispose: () => {
        mixer.stopAllAction();
        mixer.uncacheRoot(cloned);
      }
    };

    return { group: cloned, controller };
  }

  public createAnimatedHero(heroClass: string): { group: THREE.Group; controller: CharacterAnimationController } | null {
    let key = 'knight';
    switch (heroClass) {
      case 'warrior':
      case 'paladin':
        key = 'knight';
        break;
      case 'ranger':
      case 'elf':
        key = 'ranger';
        break;
      case 'rogue':
        key = 'rogue';
        break;
      case 'wizard':
      case 'healer':
      case 'cleric':
        key = 'mage';
        break;
      case 'barbarian':
      case 'dwarf':
      case 'monk':
        key = 'barbarian';
        break;
      default:
        key = 'knight';
    }
    return this.createAnimatedCharacter(key);
  }

  public createAnimatedCitizen(type: 'peasant' | 'tax_collector'): { group: THREE.Group; controller: CharacterAnimationController } | null {
    return this.createAnimatedCharacter('engineer');
  }

  public createAnimatedMonster(monsterType: string): { group: THREE.Group; controller: CharacterAnimationController } | null {
    let key: string | null = null;
    switch (monsterType) {
      case 'skeleton':
        key = 'skeleton_warrior';
        break;
      case 'skeleton_mage':
        key = 'skeleton_mage';
        break;
      case 'necromancer':
      case 'cultist':
        key = 'necromancer';
        break;
      case 'goblin_spearman':
      case 'goblin_archer':
      case 'goblin_shaman':
      case 'orc':
        key = 'orc_raider';
        break;
      case 'werewolf':
      case 'dire_wolf':
        key = 'werewolf';
        break;
      case 'vampire_lord':
        key = 'vampire';
        break;
      default:
        key = null;
    }
    if (!key) return null;
    return this.createAnimatedCharacter(key);
  }
}
