'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GameEngine } from '../game/engine/GameEngine';
import { CanvasRenderer } from '../game/engine/Renderer';
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
import { ScenarioModal } from './ScenarioModal';
import { Hammer, Coins, Zap, MapPin } from 'lucide-react';

export const GameView: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [activeTab, setActiveTab] = useState<'none' | 'build' | 'flags' | 'spells'>('build');
  const [activeBuildingType, setActiveBuildingType] = useState<BuildingType | null>(null);
  const [activeFlagType, setActiveFlagType] = useState<FlagType | null>(null);
  const [bountyAmount, setBountyAmount] = useState<number>(100);
  const [activeSpellId, setActiveSpellId] = useState<string | null>(null);

  const [isScenarioModalOpen, setIsScenarioModalOpen] = useState<boolean>(false);
  const [mouseWorldPos, setMouseWorldPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [trackingHeroId, setTrackingHeroId] = useState<string | null>(null);

  // Initialize Game Engine
  const initEngine = useCallback((scenario: Scenario) => {
    const engine = new GameEngine(scenario);
    engineRef.current = engine;
    setGameState({ ...engine.state });

    if (canvasRef.current) {
      rendererRef.current = new CanvasRenderer(canvasRef.current, engine.gridManager);
    }
  }, []);

  useEffect(() => {
    initEngine(SCENARIOS[0]);
  }, [initEngine]);

  // Main Render & Game Loop
  useEffect(() => {
    const loop = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const rawDelta = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      const engine = engineRef.current;
      if (engine && !engine.state.isGameOver) {
        // Delta clamp for tab switches
        const delta = Math.min(rawDelta, 0.1);
        engine.update(delta);

        // Follow tracked hero if active
        if (trackingHeroId) {
          const hero = engine.state.heroes.find(h => h.id === trackingHeroId);
          if (hero && !hero.isDead) {
            engine.state.camera.x = hero.x;
            engine.state.camera.y = hero.y;
          } else {
            setTrackingHeroId(null);
          }
        }

        // Render Canvas
        if (rendererRef.current) {
          rendererRef.current.render(engine.state, mouseWorldPos);
        }

        // Sync react state with fresh arrays for reactive inspectors
        setGameState({
          ...engine.state,
          heroes: [...engine.state.heroes],
          buildings: [...engine.state.buildings],
          monsters: [...engine.state.monsters],
          lairs: [...engine.state.lairs]
        });
      } else if (engine && engine.state.isGameOver && rendererRef.current) {
        rendererRef.current.render(engine.state, mouseWorldPos);
      }

      requestRef.current = requestAnimationFrame(loop);
    };

    requestRef.current = requestAnimationFrame(loop);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [mouseWorldPos, trackingHeroId]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Screen to World Coordinate Conversion
  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine) return { x: 0, y: 0 };

    const cam = engine.state.camera;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    const worldX = (screenX - centerX) / cam.zoom + cam.x;
    const worldY = (screenY - centerY) / cam.zoom + cam.y;

    return { x: worldX, y: worldY };
  }, []);

  // Mouse & Touch Controls
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 1 || e.button === 2 || (!activeBuildingType && !activeFlagType && !activeSpellId && e.button === 0)) {
      // Start camera drag
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const world = screenToWorld(e.clientX, e.clientY);
    setMouseWorldPos(world);

    if (isDragging && engineRef.current) {
      const dx = (e.clientX - dragStart.x) / engineRef.current.state.camera.zoom;
      const dy = (e.clientY - dragStart.y) / engineRef.current.state.camera.zoom;

      engineRef.current.state.camera.x -= dx;
      engineRef.current.state.camera.y -= dy;
      setDragStart({ x: e.clientX, y: e.clientY });
      setTrackingHeroId(null);
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      setIsDragging(false);
      return;
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const engine = engineRef.current;
    if (!engine) return;

    const world = screenToWorld(e.clientX, e.clientY);
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
      // Check if clicked directly on a monster or lair
      let targetMonster = engine.state.monsters.find(m => Math.hypot(m.x - world.x, m.y - world.y) < 24);
      let targetLair = engine.state.lairs.find(l => {
        const lx = (l.x + l.width / 2) * engine.state.tileSize;
        const ly = (l.y + l.height / 2) * engine.state.tileSize;
        return Math.hypot(lx - world.x, ly - world.y) < 32;
      });

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
    // Check heroes
    const clickedHero = engine.state.heroes.find(h => !h.isDead && Math.hypot(h.x - world.x, h.y - world.y) < 18);
    if (clickedHero) {
      engine.state.selectedEntity = { type: 'hero', id: clickedHero.id };
      return;
    }

    // Check monsters
    const clickedMonster = engine.state.monsters.find(m => Math.hypot(m.x - world.x, m.y - world.y) < 20);
    if (clickedMonster) {
      engine.state.selectedEntity = { type: 'monster', id: clickedMonster.id };
      return;
    }

    // Check buildings
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

    // Check lairs
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

    // Check tax collectors
    const clickedTaxCollector = engine.state.taxCollectors.find(tc => Math.hypot(tc.x - world.x, tc.y - world.y) < 18);
    if (clickedTaxCollector) {
      engine.state.selectedEntity = { type: 'tax_collector', id: clickedTaxCollector.id };
      return;
    }

    // Clicked empty ground -> clear selection
    engine.state.selectedEntity = null;
  };

  // Zoom with wheel
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!engineRef.current) return;
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.max(0.5, Math.min(2.2, engineRef.current.state.camera.zoom * zoomFactor));
    engineRef.current.state.camera.zoom = newZoom;
  };

  // Keyboard controls
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
      setTrackingHeroId(null);
    }
  };

  // Selected Entity references
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

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 select-none">
      {/* Canvas Viewport */}
      <canvas
        ref={canvasRef}
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

      {/* Bottom Control Deck */}
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
        </div>

        {/* Selected Deck Drawer */}
        {gameState && activeTab === 'build' && (
          <div className="pointer-events-auto">
            <BuildMenu
              treasuryGold={gameState.treasuryGold}
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

      {/* Right Drawer: Active Inspector (Hero / Building / Monster) */}
      <div className="absolute top-20 right-4 z-20 pointer-events-auto">
        {selectedHero && (
          <HeroInspector
            hero={selectedHero}
            onClose={() => {
              if (engineRef.current) engineRef.current.state.selectedEntity = null;
            }}
            onTrackHero={(hero) => setTrackingHeroId(hero.id)}
          />
        )}

        {selectedBuilding && gameState && (
          <BuildingInspector
            building={selectedBuilding}
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
