import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

export type AnimState = 'idle' | 'walk' | 'run' | 'attack' | 'hammer' | 'death';

export interface CharacterAnimationController {
  mixer: THREE.AnimationMixer;
  actions: Map<AnimState, THREE.AnimationAction>;
  currentState: AnimState;
  play: (state: AnimState, fadeDuration?: number) => void;
  setTimeScale: (scale: number) => void;
  update: (delta: number) => void;
  dispose: () => void;
}

// Quaternius CC0 creatures (single .glb, skinned + embedded clips).
// Loaded in a DEFERRED wave after the critical set, so the loading veil
// lifts fast — monsters pop in via the onChange rebuild when ready.
const CREATURE_MODELS: Record<string, string> = {
  'creature_dragon': '/models/creatures/dragon.glb',
  'creature_wolf': '/models/creatures/wolf.glb',
  'creature_rat': '/models/creatures/rat.glb',
  'creature_zombie': '/models/creatures/zombie.glb',
  'creature_goblin': '/models/creatures/goblin.glb',
  'creature_golem': '/models/creatures/golem.glb',
  'creature_bat': '/models/creatures/bat.glb',
  'creature_bull': '/models/creatures/bull.glb'
};

export class ModelRegistry {
  private static instance: ModelRegistry;
  private loader: GLTFLoader = new GLTFLoader();  private staticTemplates: Map<string, THREE.Group> = new Map();
  private characterTemplates: Map<string, THREE.Group> = new Map();
  // Quaternius CC0 creatures with their own embedded armature + clips
  // (dragon, wolf, rat, zombie, goblin) — see public/models/creatures/
  // bounds = bind-pose LOCAL bounds measured straight from POSITION
  // attributes (Box3.setFromObject is unreliable on skinned meshes).
  private embeddedTemplates: Map<string, { template: THREE.Group; clips: THREE.AnimationClip[]; bounds: THREE.Box3 }> = new Map();
  private sharedClips: Map<string, THREE.AnimationClip> = new Map();
  private loading: Set<string> = new Set();
  private onChangeCallbacks: (() => void)[] = [];
  public isReady: boolean = false;
  private totalExpected: number = 0;
  private totalLoaded: number = 0;
  private preloadStarted: boolean = false;
  private deferredStarted: boolean = false;
  private deferredLoaded: number = 0;
  private deferredTotal: number = 0;
  /** Last finished asset key, for honest loading screens */
  public lastLoadedKey: string = '';

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

  /** Honest loading progress for the veil: critical wave, then deferred creatures */
  public getProgress(): { loaded: number; total: number; percent: number; label: string; deferred: boolean } {
    if (!this.preloadStarted) return { loaded: 0, total: 1, percent: 0, label: 'Waking the scribes…', deferred: false };
    if (!this.isReady) {
      const total = Math.max(1, this.totalExpected);
      return {
        loaded: Math.min(this.totalLoaded, total),
        total,
        percent: Math.round((Math.min(this.totalLoaded, total) / total) * 100),
        label: this.lastLoadedKey ? `Summoning ${this.lastLoadedKey.replace(/_/g, ' ')}…` : 'Summoning the realm…',
        deferred: false
      };
    }
    const total = Math.max(1, this.deferredTotal);
    return {
      loaded: Math.min(this.deferredLoaded, total),
      total,
      percent: this.deferredTotal === 0 ? 100 : Math.round((Math.min(this.deferredLoaded, total) / total) * 100),
      label: 'Luring monsters from the wilds…',
      deferred: true
    };
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
    // Guard against re-entry: a new ThreeRenderer is constructed on every
    // save/load, and each one calls preloadAll(). Restarting the counters
    // while the first batch is still in flight stalls isReady/notify and can
    // leave buildings stuck in fallback state after a welcome-prompt load.
    if (this.preloadStarted) return;
    this.preloadStarted = true;

    const buildingModels: Record<string, string> = {
      'warrior_guild': '/models/building_barracks_blue.gltf',
      'ranger_guild': '/models/building_archeryrange_blue.gltf',
      'rogue_guild': '/models/building_windmill_blue.gltf',
      'wizard_tower': '/models/building_tower_B_blue.gltf',
      'cleric_temple': '/models/building_church_blue.gltf',
      'blacksmith': '/models/building_blacksmith_blue.gltf',
      'marketplace': '/models/building_market_blue.gltf',
      'royal_inn': '/models/building_tavern_blue.gltf',
      'guard_tower': '/models/building_tower_A_blue.gltf',
      'statue_king': '/models/building_well_blue.gltf',
      'dwarf_settlement': '/models/building_mine_blue.gltf',
      'peasant_cottage': '/models/building_home_A_blue.gltf',
      'peasant_cottage_b': '/models/building_home_B_blue.gltf',
      'lumbermill': '/models/building_lumbermill_blue.gltf',
      'fairgrounds': '/models/building_stage_A.gltf',
      'elven_lounge': '/models/building_watermill_blue.gltf',
      'temple_fervus': '/models/building_church_green.gltf',
      'temple_krypta': '/models/building_church_red.gltf',
      'temple_helia': '/models/building_church_yellow.gltf',
      'ruins': '/models/building_destroyed.gltf',
      'tent': '/models/tent.gltf',
      'weaponrack': '/models/weaponrack.gltf',
      'flag_red': '/models/flag_red.gltf',
      'crypt': '/models/crypt.gltf',
      'gravestone': '/models/gravestone.gltf',
      'tree_dead_large': '/models/tree_dead_large.gltf',
      'post_skull': '/models/post_skull.gltf',
      'skull': '/models/skull.gltf',
      'dark_castle_keep': '/models/building_church_red.gltf',
      'dark_tower': '/models/building_tower_B_blue.gltf'
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

    // Quaternius CC0 creatures load in a deferred wave (see startDeferredCreatures)
    // so the loading veil lifts as soon as the critical set is ready.
    const allStatic = { ...buildingModels, ...natureModels };
    this.totalExpected = Object.keys(allStatic).length + Object.keys(characterModels).length + Object.keys(animationPacks).length;
    this.totalLoaded = 0;

    const checkComplete = () => {
      this.totalLoaded++;
      if (this.totalLoaded >= this.totalExpected) {
        const firstReady = !this.isReady;
        this.isReady = true;
        if (firstReady) this.startDeferredCreatures();
      }
      this.notify();
    };

    // 1. Load Animation Packs
    for (const [packKey, url] of Object.entries(animationPacks)) {
      this.loader.load(
        url,
        (gltf) => {
          if (gltf.animations) {
            for (const clip of gltf.animations) {
              this.sharedClips.set(clip.name, clip);
            }
          }
          this.lastLoadedKey = packKey;
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

  /**
   * Second wave: creature GLBs start only after the critical set is ready,
   * so the loading veil lifts earlier. Each arrival notifies (monsters swap
   * from procedural fallbacks to animated GLBs via the onChange rebuild).
   */
  private startDeferredCreatures() {
    if (this.deferredStarted) return;
    this.deferredStarted = true;
    const entries = Object.entries(CREATURE_MODELS);
    this.deferredTotal = entries.length;
    if (entries.length === 0) return;
    for (const [key, url] of entries) {
      this.loadEmbeddedCreature(key, url, () => {
        this.lastLoadedKey = key;
        this.deferredLoaded++;
        this.notify();
      });
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
              const mats = Array.isArray(child.material) ? child.material : [child.material];
              mats.forEach((m) => {
                m.side = THREE.DoubleSide;
                if (m.map) {
                  m.map.colorSpace = THREE.SRGBColorSpace;
                } else {
                  const texUrl = (m.name === 'halloweenbits_texture' || key === 'crypt' || key === 'gravestone' || key === 'skull' || key === 'post_skull' || key === 'tree_dead_large')
                    ? '/models/halloweenbits_texture.png'
                    : '/models/hexagons_medieval.png';
                  new THREE.TextureLoader().load(texUrl, (loadedTex) => {
                    loadedTex.colorSpace = THREE.SRGBColorSpace;
                    loadedTex.flipY = false;
                    m.map = loadedTex;
                    m.needsUpdate = true;
                  });
                }
              });
            }
          }
        });

        this.staticTemplates.set(key, root);
        this.loading.delete(key);
        this.lastLoadedKey = key;
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
              const mats = Array.isArray(child.material) ? child.material : [child.material];
              mats.forEach((m) => {
                m.side = THREE.DoubleSide;
                if (m.map) {
                  m.map.colorSpace = THREE.SRGBColorSpace;
                }
              });
            }
          }
        });

        this.characterTemplates.set(key, root);
        this.loading.delete(key);
        this.lastLoadedKey = key;
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

  private loadEmbeddedCreature(key: string, url: string, onDone: () => void) {
    if (this.embeddedTemplates.has(key) || this.loading.has(key)) return;
    this.loading.add(key);

    this.loader.load(
      url,
      (gltf) => {
        const root = gltf.scene;
        root.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            // Skinned creatures move far from their bind pose — never cull by static bounds
            child.frustumCulled = false;
            if (child.material) {
              const mats = Array.isArray(child.material) ? child.material : [child.material];
              mats.forEach((m) => {
                m.side = THREE.DoubleSide;
                if (m.map) {
                  m.map.colorSpace = THREE.SRGBColorSpace;
                }
              });
            }
          }
        });

        // Quaternius ships a green dragon — Fryre the Red demands crimson.
        // Tint once at load (shared template materials, all dragons identical).
        if (key === 'creature_dragon') {
          const red = new THREE.Color(1.5, 0.32, 0.28);
          root.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material) {
              const mats = Array.isArray(child.material) ? child.material : [child.material];
              mats.forEach((m) => {
                if (m instanceof THREE.MeshStandardMaterial && m.color) m.color.multiply(red);
              });
            }
          });
        }

        this.embeddedTemplates.set(key, { template: root, clips: gltf.animations || [], bounds: this.measureBindBounds(root) });
        this.loading.delete(key);
        this.lastLoadedKey = key;
        onDone();
      },
      undefined,
      (err) => {
        console.warn(`Failed to load creature model ${key} from ${url}:`, err);
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
    const currentState: AnimState = 'idle';
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
      setTimeScale: (scale: number) => {
        const currentAction = actions.get(controller.currentState);
        if (currentAction) {
          currentAction.timeScale = Math.max(0.25, Math.min(3.0, scale));
        }
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

  /**
   * Bind-pose local bounds measured directly from POSITION attributes.
   * Used to scale/center embedded creatures (Box3.setFromObject misbehaves
   * on skinned meshes whose bones aren't posed yet).
   */
  private measureBindBounds(root: THREE.Group): THREE.Box3 {
    const box = new THREE.Box3(
      new THREE.Vector3(Infinity, Infinity, Infinity),
      new THREE.Vector3(-Infinity, -Infinity, -Infinity)
    );
    // Quaternius GLBs carry the real size on mesh NODES (e.g. 100x), so the
    // raw POSITION attributes must be transformed by each mesh's world matrix.
    root.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    root.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const pos = child.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
        if (!pos) return;
        for (let i = 0; i < pos.count; i++) {
          v.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(child.matrixWorld);
          if (v.x < box.min.x) box.min.x = v.x;
          if (v.y < box.min.y) box.min.y = v.y;
          if (v.z < box.min.z) box.min.z = v.z;
          if (v.x > box.max.x) box.max.x = v.x;
          if (v.y > box.max.y) box.max.y = v.y;
          if (v.z > box.max.z) box.max.z = v.z;
        }
      }
    });
    if (!isFinite(box.min.x)) {
      box.min.set(0, 0, 0);
      box.max.set(1, 1, 1);
    }
    return box;
  }

  /**
   * Instantiate a Quaternius CC0 creature: its own armature is cloned and its
   * embedded clips are mapped onto the standard controller states by keyword.
   * Returns null when the .glb hasn't finished loading (caller falls back).
   */
  public createEmbeddedCreature(creatureKey: string): { group: THREE.Group; controller: CharacterAnimationController; baseBounds: THREE.Box3 } | null {
    const entry = this.embeddedTemplates.get(creatureKey);
    if (!entry) return null;

    // Strip armature prefixes: 'RatArmature|Rat_Attack' -> 'rat_attack'
    const byName = new Map<string, THREE.AnimationClip>();
    for (const clip of entry.clips) {
      const short = (clip.name.split('|').pop() || clip.name).toLowerCase();
      if (!byName.has(short)) byName.set(short, clip);
    }
    const pick = (...keywords: string[]): THREE.AnimationClip | null => {
      for (const k of keywords) {
        const exact = byName.get(k);
        if (exact) return exact;
      }
      for (const [name, clip] of byName) {
        if (keywords.some(k => name.includes(k))) return clip;
      }
      return null;
    };

    // Per-creature clip vocabulary (Quaternius naming differs per model)
    const vocab: Record<string, Record<AnimState, string[]>> = {
      creature_dragon: {
        idle: ['flying_idle'], walk: ['fast_flying'], run: ['fast_flying'],
        attack: ['headbutt', 'punch'], hammer: ['flying_idle'], death: ['death']
      },
      creature_wolf: {
        idle: ['idle'], walk: ['walk'], run: ['run'],
        attack: ['headbutt'], hammer: ['idle'], death: ['death']
      },
      creature_rat: {
        idle: ['rat_idle'], walk: ['rat_walk'], run: ['rat_run'],
        attack: ['rat_attack'], hammer: ['rat_idle'], death: ['rat_death']
      },
      creature_zombie: {
        idle: ['idle'], walk: ['walk'], run: ['run'],
        attack: ['punch', 'idle_attack'], hammer: ['idle'], death: ['death']
      },
      creature_goblin: {
        idle: ['idle'], walk: ['walk'], run: ['run'],
        attack: ['attack'], hammer: ['idle'], death: ['death']
      },
      creature_golem: {
        idle: ['flying_idle', 'idle'], walk: ['fast_flying', 'walk'], run: ['fast_flying', 'run'],
        attack: ['punch', 'headbutt'], hammer: ['punch'], death: ['death']
      },
      creature_bat: {
        idle: ['bat_flying', 'flying'], walk: ['bat_flying', 'flying'], run: ['bat_flying', 'flying'],
        attack: ['bat_attack', 'bat_attack2', 'attack'], hammer: ['bat_flying'], death: ['bat_death', 'death']
      },
      creature_bull: {
        idle: ['idle', 'idle_2', 'idle_headlow'], walk: ['walk'], run: ['gallop', 'run'],
        attack: ['attack_headbutt', 'attack_kick'], hammer: ['idle'], death: ['death']
      }
    };
    const words = vocab[creatureKey] || {
      idle: ['idle'], walk: ['walk'], run: ['run'],
      attack: ['attack'], hammer: ['idle'], death: ['death']
    };

    // SkeletonUtils.clone keeps the SkinnedMesh/bone bindings intact
    const cloned = SkeletonUtils.clone(entry.template) as THREE.Group;
    cloned.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.frustumCulled = false;
      }
    });

    const mixer = new THREE.AnimationMixer(cloned);
    const actions = new Map<AnimState, THREE.AnimationAction>();
    (Object.keys(words) as AnimState[]).forEach((state) => {
      const clip = pick(...words[state]);
      if (clip) actions.set(state, mixer.clipAction(clip));
    });

    const idleAction = actions.get('idle') || actions.values().next().value;
    if (idleAction) idleAction.play();

    const controller: CharacterAnimationController = {
      mixer,
      actions,
      currentState: 'idle',
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
      setTimeScale: (scale: number) => {
        const currentAction = actions.get(controller.currentState);
        if (currentAction) {
          currentAction.timeScale = Math.max(0.25, Math.min(3.0, scale));
        }
      },
      update: (delta: number) => {
        mixer.update(delta);
      },
      dispose: () => {
        mixer.stopAllAction();
        mixer.uncacheRoot(cloned);
      }
    };

    return { group: cloned, controller, baseBounds: entry.bounds.clone() };
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
    // Quaternius CC0 creatures with embedded armatures (see public/models/creatures/)
    if (monsterType === 'red_dragon') return this.createEmbeddedCreature('creature_dragon');
    if (monsterType === 'dire_wolf') return this.createEmbeddedCreature('creature_wolf');
    if (monsterType === 'giant_rat') return this.createEmbeddedCreature('creature_rat');
    if (monsterType === 'zombie') return this.createEmbeddedCreature('creature_zombie');
    if (monsterType === 'goblin_spearman' || monsterType === 'goblin_archer' || monsterType === 'goblin_shaman') {
      return this.createEmbeddedCreature('creature_goblin');
    }
    if (monsterType === 'troll') return this.createEmbeddedCreature('creature_golem');
    if (monsterType === 'harpy') return this.createEmbeddedCreature('creature_bat');
    if (monsterType === 'minotaur') return this.createEmbeddedCreature('creature_bull');

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
      case 'orc':
        key = 'orc_raider';
        break;
      case 'werewolf':
        key = 'werewolf';
        break;
      case 'vampire_lord':
      case 'vampire':
        key = 'vampire';
        break;
      default:
        key = 'orc_raider';
    }
    if (!key) return null;
    return this.createAnimatedCharacter(key);
  }
}
