'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GameEngine } from '../game/engine/GameEngine';
import { ThreeRenderer } from '../game/engine/ThreeRenderer';
import { SCENARIOS } from '../game/scenarios';
import { BuildingType, FlagType, GameState, Hero, HeroClass, Scenario } from '../game/types';
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
import { ScenarioModal } from './ScenarioModal';
import { Hammer, Coins, Zap, Eye, RotateCw, Video } from 'lucide-react';

export const GameView: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const threeRendererRef = useRef<ThreeRenderer | null>(null);
  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [activeTab, setActiveTab] = useState<'none' | 'build' | 'flags' | 'spells'>('build');
  const [activeBuildingType, setActiveBuildingType] = useState<BuildingType | null>(null);
  const [activeFlagType, setActiveFlagType] = useState<FlagType | null>(null);
  const [bountyAmount, setBountyAmount] = useState<number>(100);
  const [activeSpellId, setActiveSpellId] = useState<string | null>(null);

  const [isScenarioModalOpen, setIsScenarioModalOpen] = useState<boolean>(false);
  const mouseWorldPosRef = useRef<{ x: number; y: number } | null>(null);
  const [cameraMode, setCameraMode] = useState<'isometric' | 'free' | 'top_down' | 'follow'>('isometric');

  const isDraggingRef = useRef<boolean>(false);
  const isRotatingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const trackingHeroIdRef = useRef<string | null>(null);
  const lastHudSyncRef = useRef<number>(0);

  // Initialize Game Engine & 3D Three.js Renderer
  const initEngine = useCallback((scenario: Scenario) => {
    const engine = new GameEngine(scenario);
    engineRef.current = engine;
    setGameState({ ...engine.state });

    if (containerRef.current) {
      if (threeRendererRef.current) {
        threeRendererRef.current.renderer.dispose();
        containerRef.current.innerHTML = '';
      }
      threeRendererRef.current = new ThreeRenderer(containerRef.current, engine.gridManager);
    }
  }, []);

  useEffect(() => {
    initEngine(SCENARIOS[0]);
  }, [initEngine]);

  // Main 60 FPS Render & Simulation Loop (HUD state sync is throttled separately)
  useEffect(() => {
    const loop = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const rawDelta = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      const engine = engineRef.current;
      const renderer = threeRendererRef.current;

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
            taxCollectors: [...engine.state.taxCollectors]
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
      let targetMonster = engine.state.monsters.find(m => m.hp > 0 && Math.hypot(m.x - world.x, m.y - world.y) < 26);
      let targetLair = engine.state.lairs.find(l => {
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

    const normalizedDelta = Math.max(-60, Math.min(60, e.deltaY));
    const zoomMultiplier = 1 + normalizedDelta * 0.0016;
    const newDist = Math.max(100, Math.min(850, renderer.targetCameraDistance * zoomMultiplier));
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
        engine.state.isPaused = !engine.state.isPaused;
      } else if (e.code === 'Digit1') {
        engine.state.gameSpeed = 1;
      } else if (e.code === 'Digit2') {
        engine.state.gameSpeed = 2;
      } else if (e.code === 'Digit3' || e.code === 'Digit4') {
        engine.state.gameSpeed = 4;
      } else if (e.code === 'Escape') {
        setActiveBuildingType(null);
        setActiveFlagType(null);
        setActiveSpellId(null);
        engine.state.activePlacement = null;
        engine.state.selectedEntity = null;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 select-none">
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
              onSetGameSpeed={(speed) => {
                if (engineRef.current) engineRef.current.state.gameSpeed = speed;
              }}
              onTogglePause={() => {
                if (engineRef.current) engineRef.current.state.isPaused = !engineRef.current.state.isPaused;
              }}
              onSelectScenarioModal={() => setIsScenarioModalOpen(true)}
              onShowAdvisorModal={() => {}}
            />
          </div>
        </div>
      )}

      {/* Top Left: Hero Roster Bar */}
      {gameState && (
        <div className="absolute top-16 left-4 z-20 pointer-events-none">
          <HeroRosterBar
            heroes={gameState.heroes}
            selectedHeroId={gameState.selectedEntity?.type === 'hero' ? gameState.selectedEntity.id : null}
            onSelectHero={(hero) => {
              if (engineRef.current) {
                engineRef.current.state.selectedEntity = { type: 'hero', id: hero.id };
                engineRef.current.state.camera.x = hero.x;
                engineRef.current.state.camera.y = hero.y;
                trackingHeroIdRef.current = hero.id;
              }
            }}
          />
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
