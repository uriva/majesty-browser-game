'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GameEngine } from '../game/engine/GameEngine';
import { ThreeRenderer } from '../game/engine/ThreeRenderer';
import { getRawSave, readSaveMeta, saveGameToLocalStorage, saveGameToSlot, listAllSaveSlots, getRawSaveFromSlot, SaveSlotInfo } from '../game/engine/SaveLoad';
import { SCENARIOS } from '../game/scenarios';
import { BuildingType, FlagType, GameState, Hero, HeroClass, SaveMeta, Scenario } from '../game/types';
import { GameHUD } from './GameHUD';
import { Minimap } from './Minimap';
import { BuildMenu } from './BuildMenu';
import { FlagMenu } from './FlagMenu';
import { SpellMenu } from './SpellMenu';
import { HeroInspector } from './HeroInspector';
import { BuildingInspector } from './BuildingInspector';
import { MonsterInspector } from './MonsterInspector';
import { TaxCollectorInspector } from './TaxCollectorInspector';
import { PeasantInspector } from './PeasantInspector';
import { FlagInspector } from './FlagInspector';
import { HeroRosterBar } from './HeroRosterBar';
import { QuestTracker } from './QuestTracker';
import { DilemmaModal } from './DilemmaModal';
import { TombstoneInspector } from './TombstoneInspector';
import { ScenarioModal } from './ScenarioModal';
import { SaveLoadModal } from './SaveLoadModal';
import { SettingsModal } from './SettingsModal';
import { WelcomePromptModal } from './WelcomePromptModal';
import { Hammer, Coins, Zap, Eye, RotateCw, Video, Crown, Sparkles, CheckCircle2 } from 'lucide-react';
import { audioManager } from '../game/engine/Audio';
import { ModelRegistry } from '../game/engine/ModelRegistry';
import { getGameSettings, subscribeGameSettings, GameSettings } from '../game/settings';

export const GameView: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const threeRendererRef = useRef<ThreeRenderer | null>(null);
  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const bgIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastBgTimeRef = useRef<number>(0);
  const settingsRef = useRef<GameSettings>(getGameSettings());

  const [assetsReady, setAssetsReady] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [activeTab, setActiveTab] = useState<'none' | 'build' | 'flags' | 'spells'>('build');
  const [activeBuildingType, setActiveBuildingType] = useState<BuildingType | null>(null);
  const [activeFlagType, setActiveFlagType] = useState<FlagType | null>(null);
  const [bountyAmount, setBountyAmount] = useState<number>(100);
  const [activeSpellId, setActiveSpellId] = useState<string | null>(null);

  const [isScenarioModalOpen, setIsScenarioModalOpen] = useState<boolean>(false);
  const [isSaveLoadModalOpen, setIsSaveLoadModalOpen] = useState<boolean>(false);
  const [saveLoadModalTab, setSaveLoadModalTab] = useState<'save' | 'load'>('load');
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isWelcomePromptOpen, setIsWelcomePromptOpen] = useState<boolean>(false);
  const [isChronicleOpen, setIsChronicleOpen] = useState<boolean>(false);
  const [welcomeSaveSlot, setWelcomeSaveSlot] = useState<SaveSlotInfo | null>(null);
  const [archiveBanner, setArchiveBanner] = useState<{ title: string; message: string; type: 'save' | 'load' | 'delete' } | null>(null);
  const [saveMeta, setSaveMeta] = useState<SaveMeta | null>(() =>
    typeof window !== 'undefined' ? readSaveMeta() : null
  );
  const mouseWorldPosRef = useRef<{ x: number; y: number } | null>(null);
  const [cameraMode, setCameraMode] = useState<'isometric' | 'free' | 'top_down' | 'follow'>('isometric');

  const isDraggingRef = useRef<boolean>(false);
  const isRotatingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const trackingHeroIdRef = useRef<string | null>(null);
  const lastHudSyncRef = useRef<number>(0);

  // Consolidated Dialog Pause Coordinator
  const isAnyDialogOpen = Boolean(
    gameState?.activeDilemma ||
    isScenarioModalOpen ||
    isSaveLoadModalOpen ||
    isSettingsModalOpen ||
    isWelcomePromptOpen ||
    isChronicleOpen
  );
  const prevAnyDialogOpenRef = useRef<boolean>(false);
  const wasPausedBeforeAnyDialogRef = useRef<boolean>(false);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    if (isAnyDialogOpen && !prevAnyDialogOpenRef.current) {
      const wasPaused = (gameState?.activeDilemma && engine.wasPausedBeforeDilemma !== undefined)
        ? engine.wasPausedBeforeDilemma
        : engine.state.isPaused;
      wasPausedBeforeAnyDialogRef.current = wasPaused;
      engine.state.isPaused = true;
    } else if (!isAnyDialogOpen && prevAnyDialogOpenRef.current) {
      if (!wasPausedBeforeAnyDialogRef.current) {
        engine.state.isPaused = false;
      }
    }
    prevAnyDialogOpenRef.current = isAnyDialogOpen;
  }, [isAnyDialogOpen, gameState?.activeDilemma]);

  // Track asset readiness (with honest progress for the loading veil)
  const [loadProgress, setLoadProgress] = useState({ loaded: 0, total: 1, percent: 0, label: 'Waking the scribes…', deferred: false });
  useEffect(() => {
    const reg = ModelRegistry.getInstance();
    if (reg.isReady) {
      setAssetsReady(true);
      setLoadProgress(reg.getProgress());
      return;
    }
    const check = () => {
      setLoadProgress(reg.getProgress());
      if (reg.isReady) {
        setAssetsReady(true);
      }
    };
    reg.onChange(check);
  }, []);

  // Show rich banner feedback
  const triggerArchiveBanner = useCallback((title: string, message: string, type: 'save' | 'load' | 'delete') => {
    setArchiveBanner({ title, message, type });
    try {
      audioManager.playAdvisorChime();
    } catch {}
    setTimeout(() => {
      setArchiveBanner(prev => (prev?.title === title ? null : prev));
    }, 4500);
  }, []);

  // Initialize Game Engine & 3D Three.js Renderer
  const attachEngine = useCallback((engine: GameEngine) => {
    engineRef.current = engine;
    if (typeof window !== 'undefined') {
      (window as any).__majesty_engine = engine;
    }

    if (containerRef.current) {
      if (threeRendererRef.current) {
        threeRendererRef.current.renderer.dispose();
        containerRef.current.innerHTML = '';
      }
      threeRendererRef.current = new ThreeRenderer(containerRef.current, engine.gridManager, engine.state.scenario.id);
    }
    setGameState({ ...engine.state });
  }, []);

  const initEngine = useCallback((scenario: Scenario) => {
    audioManager.stopAll();
    attachEngine(new GameEngine(scenario));
  }, [attachEngine]);

  // Save / Load via localStorage
  const handleSaveGame = useCallback(() => {
    const engine = engineRef.current;
    if (!engine || engine.state.isGameOver) return;
    const meta = saveGameToLocalStorage(engine);
    triggerArchiveBanner('👑 Kingdom Archived', `${meta.scenarioName} — Day ${meta.day} recorded in royal archives.`, 'save');
    engine.addNotification('Kingdom Saved', `${meta.scenarioName} — Day ${meta.day} recorded in the royal archives.`, 'success');
    setSaveMeta(meta);
    lastHudSyncRef.current = 0;
  }, [triggerArchiveBanner]);

  const handleLoadGame = useCallback(() => {
    const raw = getRawSave();
    if (!raw) return;
    audioManager.stopAll();
    const engine = new GameEngine(engineRef.current?.state.scenario ?? SCENARIOS[0]);
    if (!engine.applySaveData(raw)) {
      engine.addNotification('Load Failed', 'The royal archives are corrupted.', 'danger');
      setGameState({ ...engine.state });
      return;
    }
    setActiveBuildingType(null);
    setActiveFlagType(null);
    setActiveSpellId(null);
    attachEngine(engine);
    const meta = readSaveMeta();
    triggerArchiveBanner('📜 Kingdom Restored', `${meta?.scenarioName || 'Realm'} — Day ${meta?.day || 1} restored. Resuming reign!`, 'load');
    engine.addNotification('Kingdom Restored', 'Your reign continues from the royal archives.', 'success');
    setSaveMeta(meta);
    lastHudSyncRef.current = 0;
  }, [attachEngine, triggerArchiveBanner]);

  const handleLoadCustomSave = useCallback((raw: string, meta: SaveMeta) => {
    audioManager.stopAll();
    const engine = new GameEngine(engineRef.current?.state.scenario ?? SCENARIOS[0]);
    if (!engine.applySaveData(raw)) {
      engine.addNotification('Load Failed', 'The royal archives are corrupted.', 'danger');
      setGameState({ ...engine.state });
      return;
    }
    setActiveBuildingType(null);
    setActiveFlagType(null);
    setActiveSpellId(null);
    attachEngine(engine);
    triggerArchiveBanner('📜 Kingdom Restored', `${meta.scenarioName} — Day ${meta.day} restored. Resuming reign!`, 'load');
    setSaveMeta(meta);
    lastHudSyncRef.current = 0;
  }, [attachEngine, triggerArchiveBanner]);

  const handleOpenSaveModal = useCallback(() => {
    setSaveLoadModalTab('save');
    setIsSaveLoadModalOpen(true);
  }, []);

  const handleOpenLoadModal = useCallback(() => {
    setSaveLoadModalTab('load');
    setIsSaveLoadModalOpen(true);
  }, []);

  const handleLoadRecentSave = useCallback(() => {
    if (!welcomeSaveSlot) return;
    const raw = getRawSaveFromSlot(welcomeSaveSlot.slotId);
    if (raw && welcomeSaveSlot.meta) {
      handleLoadCustomSave(raw, welcomeSaveSlot.meta);
    }
    setIsWelcomePromptOpen(false);
  }, [welcomeSaveSlot, handleLoadCustomSave]);

  // Check on startup if player has existing saved games in royal archives
  useEffect(() => {
    try {
      const allSlots = listAllSaveSlots().filter(s => s.meta !== null);
      if (allSlots.length > 0) {
        allSlots.sort((a, b) => (b.meta?.savedAt || 0) - (a.meta?.savedAt || 0));
        setWelcomeSaveSlot(allSlots[0]);
        setIsWelcomePromptOpen(true);
      }
    } catch (e) {
      console.warn('Startup save check error:', e);
    }
  }, []);

  // Ctrl+S / Ctrl+L shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === 's' || e.key === 'S') { e.preventDefault(); handleSaveGame(); }
      if (e.key === 'l' || e.key === 'L') { e.preventDefault(); handleOpenLoadModal(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleSaveGame, handleOpenLoadModal]);

  useEffect(() => {
    initEngine(SCENARIOS[0]);
  }, [initEngine]);

  // Subscribe to game settings
  useEffect(() => {
    return subscribeGameSettings((newSettings) => {
      settingsRef.current = newSettings;
    });
  }, []);

  // Handle visibility / background execution
  useEffect(() => {
    const handleVisibility = () => {
      const isHidden = typeof document !== 'undefined' && document.hidden;
      if (isHidden) {
        // If tab goes to background and runInBackground is enabled, start background interval ticker
        if (settingsRef.current.runInBackground) {
          if (!bgIntervalRef.current) {
            lastBgTimeRef.current = performance.now();
            bgIntervalRef.current = setInterval(() => {
              const engine = engineRef.current;
              if (engine && !engine.state.isGameOver && !engine.state.isPaused) {
                const now = performance.now();
                const delta = Math.min((now - lastBgTimeRef.current) / 1000, 0.2);
                lastBgTimeRef.current = now;
                engine.update(delta);
              }
            }, 100);
          }
        }
      } else {
        // Returned to tab / foreground: clear background interval and reset loop timestamp
        if (bgIntervalRef.current) {
          clearInterval(bgIntervalRef.current);
          bgIntervalRef.current = null;
        }
        lastTimeRef.current = performance.now();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (bgIntervalRef.current) {
        clearInterval(bgIntervalRef.current);
        bgIntervalRef.current = null;
      }
    };
  }, []);

  // Main 60 FPS Render & Simulation Loop (HUD state sync is throttled separately)
  useEffect(() => {
    const loop = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const rawDelta = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      const engine = engineRef.current;
      const renderer = threeRendererRef.current;

      const isHidden = typeof document !== 'undefined' && document.hidden;

      // If document is hidden and background execution is disabled, don't update
      if (isHidden && !settingsRef.current.runInBackground) {
        requestRef.current = requestAnimationFrame(loop);
        return;
      }

      if (engine) {
        if (!engine.state.isGameOver) {
          const delta = Math.min(rawDelta, 0.1);
          engine.update(delta);

          // Follow hero in 3D if active
          if (trackingHeroIdRef.current) {
            const hero = engine.state.heroes.find(h => h.id === trackingHeroIdRef.current);
            if (hero && !hero.isDead) {
              engine.state.camera.x = hero.x;
              engine.state.camera.y = hero.y;
            } else {
              trackingHeroIdRef.current = null;
            }
          }
        }

        // Render 3D WebGL Scene
        if (renderer) {
          renderer.render(engine.state, mouseWorldPosRef.current);
        }

        // Sync React HUD state at 8Hz (NOT every frame — full state cloning is expensive).
        // Must keep syncing after game over, otherwise the defeat/victory modal never learns.
        const now = performance.now();
        if (now - lastHudSyncRef.current > 125) {
          lastHudSyncRef.current = now;
          setGameState({
            ...engine.state,
            heroes: [...engine.state.heroes],
            buildings: engine.state.buildings.map(b => ({
              ...b,
              trainingQueue: b.trainingQueue ? b.trainingQueue.map(q => ({ ...q })) : [],
              researchQueue: b.researchQueue ? b.researchQueue.map(r => ({ ...r })) : []
            })),
            monsters: [...engine.state.monsters],
            lairs: [...engine.state.lairs],
            treasures: [...engine.state.treasures],
            taxCollectors: [...engine.state.taxCollectors],
            pointsOfInterest: [...engine.state.pointsOfInterest],
            quests: [...engine.state.quests],
            activeDilemma: engine.state.activeDilemma
          });
        }
      }

      requestRef.current = requestAnimationFrame(loop);
    };

    requestRef.current = requestAnimationFrame(loop);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // Resize Listener
  useEffect(() => {
    const handleResize = () => {
      if (threeRendererRef.current) {
        threeRendererRef.current.handleResize();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 3D Screen to World Intersection
  const get3DWorldCoords = useCallback((clientX: number, clientY: number) => {
    if (!threeRendererRef.current) return null;
    const hit = threeRendererRef.current.screenToWorld3D(clientX, clientY);
    return hit ? { x: hit.x, y: hit.z } : null;
  }, []);

  // Mouse Controls for 3D Panning, Rotating & Zooming
  // (drag state lives in refs — per-mousemove setState re-renders the whole tree and stutters the camera)
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 2 || (e.button === 0 && e.altKey)) {
      // Right Click / Alt+Click -> 3D Orbit Rotate
      isRotatingRef.current = true;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
    } else if (e.button === 0 || e.button === 1) {
      // Left Click / Middle Click -> 3D Terrain Pan
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const world = get3DWorldCoords(e.clientX, e.clientY);
    if (world) {
      mouseWorldPosRef.current = world;
    }

    const renderer = threeRendererRef.current;
    const engine = engineRef.current;

    if (isRotatingRef.current && renderer) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;

      renderer.cameraYaw -= dx * 0.008;
      renderer.cameraPitch = Math.max(0.2, Math.min(1.45, renderer.cameraPitch + dy * 0.008));
      dragStartRef.current = { x: e.clientX, y: e.clientY };
    } else if (isDraggingRef.current && engine && renderer) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;

      const panSpeed = (renderer.cameraDistance / 400) * 0.7;
      const sinYaw = Math.sin(renderer.cameraYaw);
      const cosYaw = Math.cos(renderer.cameraYaw);

      const moveX = (-dx * cosYaw - dy * sinYaw) * panSpeed;
      const moveZ = (dx * sinYaw - dy * cosYaw) * panSpeed;

      engine.state.camera.x += moveX;
      engine.state.camera.y += moveZ;

      dragStartRef.current = { x: e.clientX, y: e.clientY };
      trackingHeroIdRef.current = null;
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    isRotatingRef.current = false;
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || e.altKey) return;
    const engine = engineRef.current;
    if (!engine) return;

    const world = get3DWorldCoords(e.clientX, e.clientY);
    if (!world) return;

    const tileX = Math.floor(world.x / engine.state.tileSize);
    const tileY = Math.floor(world.y / engine.state.tileSize);

    // 1. PLACING BUILDING
    if (activeBuildingType) {
      const placed = engine.placeBuilding(activeBuildingType, tileX, tileY);
      if (placed) {
        setActiveBuildingType(null);
        engine.state.activePlacement = null;
      }
      return;
    }

    // 2. PLACING BOUNTY FLAG
    if (activeFlagType) {
      const targetMonster = engine.state.monsters.find(m => m.hp > 0 && Math.hypot(m.x - world.x, m.y - world.y) < 26);
      const targetLair = engine.state.lairs.find(l => {
        if (l.hp <= 0) return false;
        const lx = (l.x + l.width / 2) * engine.state.tileSize;
        const ly = (l.y + l.height / 2) * engine.state.tileSize;
        return Math.hypot(lx - world.x, ly - world.y) < 36;
      });

      if (activeFlagType === 'attack') {
        if (targetMonster) {
          engine.placeFlag('attack', targetMonster.x, targetMonster.y, bountyAmount, targetMonster.id, 'monster');
          setActiveFlagType(null);
          engine.state.activePlacement = null;
        } else if (targetLair) {
          const lx = (targetLair.x + targetLair.width / 2) * engine.state.tileSize;
          const ly = (targetLair.y + targetLair.height / 2) * engine.state.tileSize;
          engine.placeFlag('attack', lx, ly, bountyAmount, targetLair.id, 'lair');
          setActiveFlagType(null);
          engine.state.activePlacement = null;
        } else {
          engine.addNotification('Invalid Target', 'Attack flags can only be placed on enemy monsters or monster lairs!', 'warning');
        }
        return;
      }

      if (targetMonster) {
        engine.placeFlag(activeFlagType, targetMonster.x, targetMonster.y, bountyAmount, targetMonster.id, 'monster');
      } else if (targetLair) {
        const lx = (targetLair.x + targetLair.width / 2) * engine.state.tileSize;
        const ly = (targetLair.y + targetLair.height / 2) * engine.state.tileSize;
        engine.placeFlag(activeFlagType, lx, ly, bountyAmount, targetLair.id, 'lair');
      } else {
        engine.placeFlag(activeFlagType, world.x, world.y, bountyAmount);
      }

      setActiveFlagType(null);
      engine.state.activePlacement = null;
      return;
    }

    // 3. CASTING SOVEREIGN SPELL
    if (activeSpellId) {
      const cast = engine.castSpell(activeSpellId, world.x, world.y);
      if (cast) {
        setActiveSpellId(null);
        engine.state.activePlacement = null;
      }
      return;
    }

    // 4. ENTITY SELECTION
    const clickedFlag = engine.state.flags.find(f => Math.hypot(f.x - world.x, f.y - world.y) < 24);
    if (clickedFlag) {
      engine.state.selectedEntity = { type: 'flag', id: clickedFlag.id };
      return;
    }

    const clickedHero = engine.state.heroes.find(h => !h.isDead && Math.hypot(h.x - world.x, h.y - world.y) < 20);
    if (clickedHero) {
      engine.state.selectedEntity = { type: 'hero', id: clickedHero.id };
      return;
    }

    const clickedCorpse = engine.state.corpses.find(c => c.type === 'hero' && c.heroData && Math.hypot(c.x - world.x, c.y - world.y) < 22);
    if (clickedCorpse) {
      engine.state.selectedEntity = { type: 'corpse', id: clickedCorpse.id };
      return;
    }

    const clickedMonster = engine.state.monsters.find(m => m.hp > 0 && Math.hypot(m.x - world.x, m.y - world.y) < 24);
    if (clickedMonster) {
      engine.state.selectedEntity = { type: 'monster', id: clickedMonster.id };
      return;
    }

    const clickedTaxCollector = engine.state.taxCollectors.find(tc => Math.hypot(tc.x - world.x, tc.y - world.y) < 20);
    if (clickedTaxCollector) {
      engine.state.selectedEntity = { type: 'tax_collector', id: clickedTaxCollector.id };
      return;
    }

    const clickedPeasant = engine.state.peasants.find(p => Math.hypot(p.x - world.x, p.y - world.y) < 20);
    if (clickedPeasant) {
      engine.state.selectedEntity = { type: 'peasant', id: clickedPeasant.id };
      return;
    }

    const clickedBuilding = engine.state.buildings.find(b => {
      const px = b.x * engine.state.tileSize;
      const py = b.y * engine.state.tileSize;
      const pw = b.width * engine.state.tileSize;
      const ph = b.height * engine.state.tileSize;
      return world.x >= px && world.x <= px + pw && world.y >= py && world.y <= py + ph;
    });
    if (clickedBuilding) {
      engine.state.selectedEntity = { type: 'building', id: clickedBuilding.id };
      return;
    }

    const clickedLair = engine.state.lairs.find(l => {
      const px = l.x * engine.state.tileSize;
      const py = l.y * engine.state.tileSize;
      const pw = l.width * engine.state.tileSize;
      const ph = l.height * engine.state.tileSize;
      return world.x >= px && world.x <= px + pw && world.y >= py && world.y <= py + ph;
    });
    if (clickedLair) {
      engine.state.selectedEntity = { type: 'lair', id: clickedLair.id };
      return;
    }

    // Clicked open ground -> deselect
    engine.state.selectedEntity = null;
  };

  // Zoom with wheel (Continuous smooth interpolation)
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const renderer = threeRendererRef.current;
    const engine = engineRef.current;
    if (!renderer || !engine) return;

    const zoomFactor = Math.pow(1.0016, e.deltaY);
    const newDist = Math.max(90, Math.min(850, renderer.targetCameraDistance * zoomFactor));
    renderer.targetCameraDistance = newDist;
    engine.state.camera.zoom = 380 / newDist;
  };

  // Switch Camera Presets
  const setCameraPreset = (preset: 'isometric' | 'free' | 'top_down' | 'follow') => {
    setCameraMode(preset);
    const renderer = threeRendererRef.current;
    if (!renderer) return;

    renderer.cameraMode = preset;
    if (preset === 'isometric') {
      renderer.cameraPitch = 0.82;
      renderer.cameraYaw = Math.PI / 4;
      renderer.targetCameraDistance = 380;
    } else if (preset === 'top_down') {
      renderer.cameraPitch = 1.45;
      renderer.cameraYaw = 0.0;
      renderer.targetCameraDistance = 460;
    } else if (preset === 'free') {
      renderer.cameraPitch = 0.70;
      renderer.cameraYaw = Math.PI / 6;
      renderer.targetCameraDistance = 320;
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!engineRef.current) return;
      const engine = engineRef.current;

      if (e.code === 'Space') {
        if (isAnyDialogOpen) return;
        engine.state.isPaused = !engine.state.isPaused;
      } else if (e.code === 'Digit1') {
        if (isAnyDialogOpen) return;
        engine.state.gameSpeed = 1;
      } else if (e.code === 'Digit2') {
        if (isAnyDialogOpen) return;
        engine.state.gameSpeed = 2;
      } else if (e.code === 'Digit3' || e.code === 'Digit4') {
        if (isAnyDialogOpen) return;
        engine.state.gameSpeed = 4;
      } else if (e.code === 'Escape') {
        if (isChronicleOpen) { setIsChronicleOpen(false); return; }
        if (isSettingsModalOpen) { setIsSettingsModalOpen(false); return; }
        if (isSaveLoadModalOpen) { setIsSaveLoadModalOpen(false); return; }
        if (isScenarioModalOpen && !gameState?.isGameOver) { setIsScenarioModalOpen(false); return; }
        setActiveBuildingType(null);
        setActiveFlagType(null);
        setActiveSpellId(null);
        engine.state.activePlacement = null;
        engine.state.selectedEntity = null;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAnyDialogOpen, isChronicleOpen, isSettingsModalOpen, isSaveLoadModalOpen, isScenarioModalOpen, gameState?.isGameOver]);

  const handlePanTo = (worldX: number, worldY: number) => {
    if (engineRef.current) {
      engineRef.current.state.camera.x = worldX;
      engineRef.current.state.camera.y = worldY;
      trackingHeroIdRef.current = null;
    }
  };

  // Selected Entities
  const selectedHero = gameState?.selectedEntity?.type === 'hero'
    ? gameState.heroes.find(h => h.id === gameState.selectedEntity?.id)
    : null;

  const selectedBuilding = gameState?.selectedEntity?.type === 'building'
    ? gameState.buildings.find(b => b.id === gameState.selectedEntity?.id)
    : null;

  const selectedMonster = gameState?.selectedEntity?.type === 'monster'
    ? gameState.monsters.find(m => m.id === gameState.selectedEntity?.id)
    : null;

  const selectedLair = gameState?.selectedEntity?.type === 'lair'
    ? gameState.lairs.find(l => l.id === gameState.selectedEntity?.id)
    : null;

  const selectedTaxCollector = gameState?.selectedEntity?.type === 'tax_collector'
    ? gameState.taxCollectors.find(tc => tc.id === gameState.selectedEntity?.id)
    : null;

  const selectedPeasant = gameState?.selectedEntity?.type === 'peasant'
    ? gameState.peasants.find(p => p.id === gameState.selectedEntity?.id)
    : null;

  const selectedCorpse = gameState?.selectedEntity?.type === 'corpse'
    ? gameState.corpses.find(c => c.id === gameState.selectedEntity?.id && c.type === 'hero')
    : null;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 select-none">
      {/* Royal Sovereign Loading Screen while 3D Models & Animations Preload */}
      {!assetsReady && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-md pointer-events-auto">
          <div className="flex flex-col items-center gap-4 text-center max-w-sm px-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 flex items-center justify-center shadow-lg shadow-amber-500/20 animate-pulse">
              <Crown className="w-9 h-9 text-amber-400" />
            </div>
            <h2 className="font-serif text-2xl font-bold tracking-wider text-amber-200">
              Summoning Sovereign Realm
            </h2>
            <p className="text-xs text-slate-400 font-sans tracking-wide">
              {loadProgress.label}
            </p>
            <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-amber-500/20 mt-2">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-200"
                style={{ width: `${loadProgress.percent}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-500 font-sans tracking-widest">
              {loadProgress.loaded}/{loadProgress.total} — {loadProgress.percent}%
            </p>
          </div>
        </div>
      )}

      {/* 3D WebGL Three.js Container */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onClick={handleCanvasClick}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
        className="w-full h-full cursor-crosshair block"
      />

      {/* Top HUD */}
      {gameState && (
        <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
          <div className="pointer-events-auto">
            <GameHUD
              state={gameState}
              isAnyDialogOpen={isAnyDialogOpen}
              isChronicleOpen={isChronicleOpen}
              onToggleChronicle={() => setIsChronicleOpen(prev => !prev)}
              onSetGameSpeed={(speed) => {
                if (!isAnyDialogOpen && engineRef.current) engineRef.current.state.gameSpeed = speed;
              }}
              onTogglePause={() => {
                if (!isAnyDialogOpen && engineRef.current) engineRef.current.state.isPaused = !engineRef.current.state.isPaused;
              }}
              onSelectScenarioModal={() => setIsScenarioModalOpen(true)}
              onShowAdvisorModal={() => setIsChronicleOpen(prev => !prev)}
              onSaveGame={handleSaveGame}
              onLoadGame={handleLoadGame}
              onOpenSaveModal={handleOpenSaveModal}
              onOpenLoadModal={handleOpenLoadModal}
              onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
              saveMeta={saveMeta}
            />
          </div>
        </div>
      )}

      {/* Royal Archive Banner Notification */}
      {archiveBanner && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 pointer-events-none animate-fadeIn">
          <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-2 border-amber-400/80 shadow-2xl shadow-amber-900/50 text-slate-100">
            <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-400/50 text-amber-300">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold font-serif text-sm text-amber-300">{archiveBanner.title}</span>
                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              </div>
              <p className="text-xs text-slate-300 font-sans mt-0.5">{archiveBanner.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Top Left: Hero Roster Bar + Royal Chronicle (quests) */}
      {gameState && (
        <div className="absolute top-16 left-4 z-20 pointer-events-none flex flex-col gap-2 max-h-[calc(100vh-8rem)] overflow-y-auto">
          <HeroRosterBar
            heroes={gameState.heroes}
            corpses={gameState.corpses}
            selectedHeroId={gameState.selectedEntity?.type === 'hero' ? gameState.selectedEntity.id : null}
            selectedCorpseId={gameState.selectedEntity?.type === 'corpse' ? gameState.selectedEntity.id : null}
            onSelectHero={(hero) => {
              if (engineRef.current) {
                engineRef.current.state.selectedEntity = { type: 'hero', id: hero.id };
                engineRef.current.state.camera.x = hero.x;
                engineRef.current.state.camera.y = hero.y;
                trackingHeroIdRef.current = hero.id;
              }
            }}
            onSelectCorpse={(corpse) => {
              if (engineRef.current) {
                engineRef.current.state.selectedEntity = { type: 'corpse', id: corpse.id };
                engineRef.current.state.camera.x = corpse.x;
                engineRef.current.state.camera.y = corpse.y;
                trackingHeroIdRef.current = null;
              }
              if (threeRendererRef.current) {
                threeRendererRef.current.cameraTarget.set(corpse.x, 0, corpse.y);
              }
            }}
          />
          <QuestTracker state={gameState} />
        </div>
      )}

      {/* Bottom Left: 3D Camera Controls & Menus */}
      <div className="absolute bottom-4 left-4 z-20 flex items-end gap-3 pointer-events-none">
        {/* Navigation Tabs */}
        <div className="bg-slate-950/95 border-2 border-amber-600/80 rounded-xl p-1.5 flex flex-col gap-1.5 shadow-2xl backdrop-blur pointer-events-auto">
          <button
            onClick={() => setActiveTab(activeTab === 'build' ? 'none' : 'build')}
            className={`p-2.5 rounded-lg border flex items-center justify-center transition-all ${
              activeTab === 'build'
                ? 'bg-amber-600 border-amber-400 text-slate-950 shadow-md'
                : 'bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800'
            }`}
            title="Construction & Guilds"
          >
            <Hammer className="w-5 h-5" />
          </button>
          <button
            onClick={() => setActiveTab(activeTab === 'flags' ? 'none' : 'flags')}
            className={`p-2.5 rounded-lg border flex items-center justify-center transition-all ${
              activeTab === 'flags'
                ? 'bg-amber-600 border-amber-400 text-slate-950 shadow-md'
                : 'bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800'
            }`}
            title="Bounty Flags (Attack/Explore/Defend)"
          >
            <Coins className="w-5 h-5" />
          </button>
          <button
            onClick={() => setActiveTab(activeTab === 'spells' ? 'none' : 'spells')}
            className={`p-2.5 rounded-lg border flex items-center justify-center transition-all ${
              activeTab === 'spells'
                ? 'bg-purple-600 border-purple-400 text-white shadow-md'
                : 'bg-slate-900 border-slate-800 text-purple-400 hover:bg-slate-800'
            }`}
            title="Sovereign Spells"
          >
            <Zap className="w-5 h-5" />
          </button>

          {/* 3D Camera Preset Switcher */}
          <div className="border-t border-amber-900/60 pt-1 flex flex-col gap-1">
            <button
              onClick={() => setCameraPreset(cameraMode === 'isometric' ? 'free' : (cameraMode === 'free' ? 'top_down' : 'isometric'))}
              title={`Camera Mode: ${cameraMode.toUpperCase()} (Click to toggle)`}
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-amber-300 hover:bg-slate-800 flex items-center justify-center"
            >
              <RotateCw className="w-4 h-4 text-amber-400" />
            </button>
          </div>
        </div>

        {/* Selected Deck Drawer */}
        {gameState && activeTab === 'build' && (
          <div className="pointer-events-auto">
            <BuildMenu
              treasuryGold={gameState.treasuryGold}
              buildings={gameState.buildings}
              activeBuildingType={activeBuildingType}
              onSelectBuilding={(type) => {
                setActiveBuildingType(type);
                if (engineRef.current) {
                  engineRef.current.state.activePlacement = type
                    ? { type: 'building', subType: type }
                    : null;
                }
              }}
            />
          </div>
        )}

        {gameState && activeTab === 'flags' && (
          <div className="pointer-events-auto">
            <FlagMenu
              treasuryGold={gameState.treasuryGold}
              activeFlagType={activeFlagType}
              currentBountyAmount={bountyAmount}
              onSelectFlag={(type, amount) => {
                setActiveFlagType(type);
                setBountyAmount(amount);
                if (engineRef.current) {
                  engineRef.current.state.activePlacement = type
                    ? { type: 'flag', subType: type, bountyAmount: amount }
                    : null;
                }
              }}
            />
          </div>
        )}

        {gameState && activeTab === 'spells' && (
          <div className="pointer-events-auto">
            <SpellMenu
              spells={gameState.spells}
              buildings={gameState.buildings}
              treasuryGold={gameState.treasuryGold}
              mana={gameState.mana}
              activeSpellId={activeSpellId}
              onSelectSpell={(spellId) => {
                setActiveSpellId(spellId);
                if (engineRef.current) {
                  engineRef.current.state.activePlacement = spellId
                    ? { type: 'spell', subType: spellId }
                    : null;
                }
              }}
              onCastInstantSpell={(spellId) => {
                if (engineRef.current) {
                  const palace = engineRef.current.state.buildings.find(b => b.type === 'palace');
                  const tx = palace ? (palace.x + palace.width / 2) * engineRef.current.state.tileSize : engineRef.current.state.camera.x;
                  const ty = palace ? (palace.y + palace.height / 2) * engineRef.current.state.tileSize : engineRef.current.state.camera.y;
                  engineRef.current.castSpell(spellId, tx, ty);
                  setActiveSpellId(null);
                  engineRef.current.state.activePlacement = null;
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Bottom Right: Minimap */}
      {gameState && (
        <div className="absolute bottom-4 right-4 z-20 pointer-events-auto">
          <Minimap state={gameState} onPanTo={handlePanTo} />
        </div>
      )}

      {/* Right Drawer: Active Inspector (Hero / Building / Monster / Taxman) */}
      <div className="absolute top-20 right-4 z-20 pointer-events-auto">
        {selectedHero && (
          <HeroInspector
            hero={selectedHero}
            onClose={() => {
              if (engineRef.current) engineRef.current.state.selectedEntity = null;
            }}
            onTrackHero={(hero) => {
              trackingHeroIdRef.current = hero.id;
              setCameraPreset('follow');
            }}
          />
        )}

        {selectedBuilding && gameState && (
          <BuildingInspector
            building={selectedBuilding}
            allBuildings={gameState.buildings}
            heroes={gameState.heroes}
            heroesCount={gameState.heroes.filter(h => !h.isDead).length}
            corpses={gameState.corpses}
            treasuryGold={gameState.treasuryGold}
            onClose={() => {
              if (engineRef.current) engineRef.current.state.selectedEntity = null;
            }}
            onRecruitHero={(bId, heroClass) => {
              engineRef.current?.recruitHero(bId, heroClass);
            }}
            onResearchUpgrade={(bId, upgId) => {
              engineRef.current?.researchUpgrade(bId, upgId);
            }}
            onSelectHero={(hero) => {
              if (engineRef.current) {
                engineRef.current.state.selectedEntity = { type: 'hero', id: hero.id };
                engineRef.current.state.camera.x = hero.x;
                engineRef.current.state.camera.y = hero.y;
              }
              setCameraPreset('follow');
            }}
            onResurrectHero={(corpseId) => {
              engineRef.current?.resurrectHero(corpseId);
            }}
            onTrackPosition={(x, y) => {
              if (engineRef.current) {
                engineRef.current.state.camera.x = x;
                engineRef.current.state.camera.y = y;
                trackingHeroIdRef.current = null;
              }
              if (threeRendererRef.current) {
                threeRendererRef.current.cameraTarget.set(x, 0, y);
              }
            }}
          />
        )}

        {selectedCorpse && gameState && (
          <TombstoneInspector
            corpse={selectedCorpse}
            treasuryGold={gameState.treasuryGold}
            hasClericTemple={gameState.buildings.some(b => b.type === 'cleric_temple' && !b.isConstructing && b.hp > 0)}
            onClose={() => {
              if (engineRef.current) engineRef.current.state.selectedEntity = null;
            }}
            onResurrect={(corpseId) => {
              engineRef.current?.resurrectHero(corpseId);
            }}
            onTrackGrave={(x, y) => {
              if (engineRef.current) {
                engineRef.current.state.camera.x = x;
                engineRef.current.state.camera.y = y;
                trackingHeroIdRef.current = null;
              }
              if (threeRendererRef.current) {
                threeRendererRef.current.cameraTarget.set(x, 0, y);
              }
            }}
          />
        )}

        {selectedTaxCollector && gameState && (
          <TaxCollectorInspector
            taxCollector={selectedTaxCollector}
            buildings={gameState.buildings}
            onClose={() => {
              if (engineRef.current) engineRef.current.state.selectedEntity = null;
            }}
            onTrackTaxCollector={(tc) => {
              if (engineRef.current) {
                engineRef.current.state.camera.x = tc.x;
                engineRef.current.state.camera.y = tc.y;
              }
            }}
            onProtectTaxCollector={(tc) => {
              setActiveTab('flags');
              setActiveFlagType('defend');
              if (engineRef.current) {
                engineRef.current.placeFlag('defend', tc.x, tc.y, 80);
              }
            }}
          />
        )}

        {selectedPeasant && gameState && (
          <PeasantInspector
            peasant={selectedPeasant}
            buildings={gameState.buildings}
            onClose={() => {
              if (engineRef.current) engineRef.current.state.selectedEntity = null;
            }}
            onTrackPeasant={(p) => {
              if (engineRef.current) {
                engineRef.current.state.camera.x = p.x;
                engineRef.current.state.camera.y = p.y;
              }
            }}
          />
        )}

        {(selectedMonster || selectedLair) && (
          <MonsterInspector
            entity={selectedMonster || selectedLair!}
            isLair={!!selectedLair}
            onClose={() => {
              if (engineRef.current) engineRef.current.state.selectedEntity = null;
            }}
            onSetAttackBounty={(id, isLair) => {
              setActiveTab('flags');
              setActiveFlagType('attack');
              if (engineRef.current) {
                engineRef.current.state.activePlacement = {
                  type: 'flag',
                  subType: 'attack',
                  bountyAmount: 100
                };
              }
            }}
          />
        )}
      </div>

      {/* Royal Archives Save/Load Modal */}
      <SaveLoadModal
        isOpen={isSaveLoadModalOpen}
        initialTab={saveLoadModalTab}
        isGameOver={gameState?.isGameOver}
        onSaveToSlot={(slotId, label) => (engineRef.current ? saveGameToSlot(engineRef.current, slotId, label) : null)}
        onClose={() => setIsSaveLoadModalOpen(false)}
        onLoadSave={handleLoadCustomSave}
        onActionFeedback={triggerArchiveBanner}
      />

      {/* Kingdom Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
      />

      {/* Startup Welcome / Continue Saved Game Modal */}
      <WelcomePromptModal
        isOpen={isWelcomePromptOpen}
        recentSave={welcomeSaveSlot}
        onLoadRecent={handleLoadRecentSave}
        onOpenSaveLoadModal={() => {
          setIsWelcomePromptOpen(false);
          handleOpenLoadModal();
        }}
        onStartNewGame={() => setIsWelcomePromptOpen(false)}
        onOpenScenarioModal={() => {
          setIsWelcomePromptOpen(false);
          setIsScenarioModalOpen(true);
        }}
      />

      {/* Royal Story & Plot Event Modal */}
      {gameState?.activeDilemma && (
        <DilemmaModal
          dilemma={gameState.activeDilemma}
          treasuryGold={gameState.treasuryGold}
          mana={gameState.mana}
          onResolve={(choice) => {
            const loc = gameState.activeDilemma?.targetLocation;
            if (loc) {
              if (engineRef.current) {
                engineRef.current.state.camera.x = loc.x;
                engineRef.current.state.camera.y = loc.y;
                trackingHeroIdRef.current = null;
              }
              if (threeRendererRef.current) {
                threeRendererRef.current.cameraTarget.set(loc.x, 0, loc.y);
              }
            }
            if (engineRef.current) {
              engineRef.current.resolveDilemma(choice);
            }
          }}
        />
      )}

      {/* Scenario / Victory / Defeat Modal */}
      <ScenarioModal
        isOpen={isScenarioModalOpen || (gameState?.isGameOver ?? false)}
        isEndScreen={gameState?.isGameOver}
        gameState={gameState || undefined}
        onClose={() => setIsScenarioModalOpen(false)}
        onSelectScenario={(scen) => {
          initEngine(scen);
          setIsScenarioModalOpen(false);
        }}
        onRestartScenario={() => {
          if (gameState) initEngine(gameState.scenario);
          setIsScenarioModalOpen(false);
        }}
      />
    </div>
  );
};
