import { GameEngine } from './engine/GameEngine';
import { SCENARIOS } from './scenarios';

export interface SimulationResult {
  scenarioName: string;
  simulatedTicks: number;
  simulatedSeconds: number;
  daysPassed: number;
  monstersKilled: number;
  lairsDestroyed: number;
  heroesRecruited: number;
  heroesLost: number;
  goldEarned: number;
  goldSpent: number;
  finalTreasury: number;
  gameWon: boolean;
  gameLost: boolean;
  executionTimeMs: number;
}

export function runHeadlessSimulation(scenarioIndex: number = 0, targetDays: number = 5): SimulationResult {
  const startTime = Date.now();
  const scenario = SCENARIOS[scenarioIndex];
  const engine = new GameEngine(scenario);

  const deltaPerTick = 0.1; // 100ms per simulation step (10 updates per second of in-game time)
  let ticks = 0;

  // Run autonomous sovereign decisions & kingdom simulation loop
  while (!engine.state.isGameOver && engine.state.stats.daysPassed <= targetDays && ticks < 20000) {
    ticks++;

    // Autonomous sovereign decisions for simulation:
    // 1. Build initial guilds if affordable
    if (ticks === 10) {
      engine.placeBuilding('warrior_guild', 24, 30);
    }
    if (ticks === 20) {
      engine.placeBuilding('ranger_guild', 34, 30);
    }
    if (ticks === 30) {
      engine.placeBuilding('marketplace', 30, 36);
    }

    // 2. Recruit heroes when guilds are ready
    for (const b of engine.state.buildings) {
      if (!b.isConstructing && b.recruitedHeroIds.length === 0) {
        if (b.type === 'warrior_guild') engine.recruitHero(b.id, 'warrior');
        if (b.type === 'ranger_guild') engine.recruitHero(b.id, 'ranger');
      }
    }

    // 3. Post bounties on monsters
    if (engine.state.monsters.length > 0 && engine.state.flags.length === 0 && engine.state.treasuryGold >= 100) {
      const targetMon = engine.state.monsters[0];
      engine.placeFlag('attack', targetMon.x, targetMon.y, 75, targetMon.id, 'monster');
    }

    // Advance pure game engine simulation step
    engine.update(deltaPerTick);
  }

  const executionTimeMs = Date.now() - startTime;

  return {
    scenarioName: scenario.name,
    simulatedTicks: ticks,
    simulatedSeconds: Math.round(ticks * deltaPerTick),
    daysPassed: engine.state.stats.daysPassed,
    monstersKilled: engine.state.stats.monstersKilled,
    lairsDestroyed: engine.state.stats.lairsDestroyed,
    heroesRecruited: engine.state.stats.heroesRecruited,
    heroesLost: engine.state.stats.heroesLost,
    goldEarned: Math.round(engine.state.stats.goldEarned),
    goldSpent: Math.round(engine.state.stats.goldSpent),
    finalTreasury: Math.round(engine.state.treasuryGold),
    gameWon: engine.state.gameWon,
    gameLost: engine.state.isGameOver && !engine.state.gameWon,
    executionTimeMs
  };
}

// If executed directly with bun/node
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('simulationTest')) {
  console.log('--- Running Headless Majesty Simulation ---');
  const res = runHeadlessSimulation(0, 3);
  console.log(JSON.stringify(res, null, 2));
}
