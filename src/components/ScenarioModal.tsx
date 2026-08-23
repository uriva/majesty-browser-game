'use client';

import React from 'react';
import { SCENARIOS } from '../game/scenarios';
import { GameState, Scenario } from '../game/types';
import { Crown, Trophy, Skull, RefreshCw, ArrowRight, ShieldCheck, Flame, Compass } from 'lucide-react';
import confetti from 'canvas-confetti';

interface ScenarioModalProps {
  isOpen: boolean;
  isEndScreen?: boolean;
  gameState?: GameState;
  onClose: () => void;
  onSelectScenario: (scenario: Scenario) => void;
  onRestartScenario: () => void;
}

export const ScenarioModal: React.FC<ScenarioModalProps> = ({
  isOpen,
  isEndScreen,
  gameState,
  onClose,
  onSelectScenario,
  onRestartScenario
}) => {
  if (!isOpen) return null;

  if (isEndScreen && gameState?.gameWon) {
    // Trigger confetti on victory
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {
      // confetti error handling
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-950 border-2 border-amber-600/90 rounded-2xl max-w-2xl w-full p-6 text-slate-100 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Background Royal Watermark */}
        <div className="absolute -right-12 -bottom-12 opacity-5 pointer-events-none text-amber-500">
          <Crown className="w-96 h-96" />
        </div>

        {isEndScreen ? (
          /* Victory or Defeat View */
          <div className="text-center">
            {gameState?.gameWon ? (
              <div className="space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border-2 border-amber-400 text-amber-400 flex items-center justify-center mx-auto shadow-lg">
                  <Trophy className="w-9 h-9" />
                </div>
                <h2 className="text-3xl font-black font-serif text-amber-300 tracking-wide">
                  VICTORY, YOUR MAJESTY!
                </h2>
                <p className="text-slate-300 text-sm max-w-md mx-auto leading-relaxed">
                  Your strategic wisdom and loyal heroes have purged the realm of all threats. The kingdom rejoices in your glorious reign!
                </p>

                {/* Kingdom Stats Breakdown */}
                {gameState && (
                  <div className="grid grid-cols-3 gap-3 max-w-lg mx-auto bg-slate-900/80 p-4 rounded-xl border border-amber-800/60 my-4 text-xs">
                    <div>
                      <div className="text-slate-400">Monsters Slain</div>
                      <div className="text-base font-bold font-mono text-amber-300">
                        {gameState.stats.monstersKilled}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400">Gold Treasury Earned</div>
                      <div className="text-base font-bold font-mono text-amber-300">
                        {gameState.stats.goldEarned}g
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400">Days Ruled</div>
                      <div className="text-base font-bold font-mono text-amber-300">
                        {gameState.stats.daysPassed}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 justify-center pt-2">
                  <button
                    onClick={onRestartScenario}
                    className="py-2.5 px-5 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-200 font-bold text-xs flex items-center gap-2 transition-all"
                  >
                    <RefreshCw className="w-4 h-4" /> Play Again
                  </button>
                  <button
                    onClick={onClose}
                    className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg transition-all font-serif"
                  >
                    Select Next Scenario <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-rose-950/80 border-2 border-rose-600 text-rose-400 flex items-center justify-center mx-auto shadow-lg">
                  <Skull className="w-9 h-9" />
                </div>
                <h2 className="text-3xl font-black font-serif text-rose-400 tracking-wide">
                  YOUR REALM HAS FALLEN
                </h2>
                <p className="text-slate-300 text-sm max-w-md mx-auto leading-relaxed">
                  {gameState?.scenario.defeatText || 'The forces of chaos overwhelmed your defenses and destroyed the Royal Palace.'}
                </p>

                <div className="flex gap-3 justify-center pt-4">
                  <button
                    onClick={onRestartScenario}
                    className="py-2.5 px-6 rounded-xl bg-gradient-to-r from-rose-700 to-red-600 hover:from-rose-600 hover:to-red-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition-all"
                  >
                    <RefreshCw className="w-4 h-4" /> Retry Scenario
                  </button>
                  <button
                    onClick={onClose}
                    className="py-2.5 px-5 rounded-xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-200 font-bold text-xs transition-all"
                  >
                    Choose Another Realm
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Scenario Select View */
          <div>
            <div className="flex items-center justify-between border-b border-amber-900/60 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <Crown className="w-6 h-6 text-amber-400" />
                <h2 className="text-xl font-bold font-serif text-amber-200">
                  Select Royal Scenario
                </h2>
              </div>
              <button
                onClick={onClose}
                className="text-xs text-slate-400 hover:text-slate-200 px-2.5 py-1 rounded bg-slate-900 border border-slate-800"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {SCENARIOS.map((scen) => (
                <div
                  key={scen.id}
                  className="bg-slate-900/80 border border-amber-800/60 hover:border-amber-500 p-4 rounded-xl transition-all group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-serif font-bold text-amber-200 text-base">
                          {scen.name}
                        </h3>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                            scen.difficulty === 'Easy'
                              ? 'bg-emerald-950 border-emerald-700 text-emerald-300'
                              : scen.difficulty === 'Medium'
                              ? 'bg-amber-950 border-amber-700 text-amber-300'
                              : scen.difficulty === 'Hard'
                              ? 'bg-rose-950 border-rose-700 text-rose-300'
                              : 'bg-purple-950 border-purple-700 text-purple-300'
                          }`}
                        >
                          {scen.difficulty}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        {scen.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                    <div className="flex gap-4 text-[11px] text-slate-400">
                      <span>Starting Treasury: <strong className="text-amber-300">{scen.startingGold}g</strong></span>
                      <span>Starting Mana: <strong className="text-purple-300">{scen.startingMana}</strong></span>
                    </div>

                    <button
                      onClick={() => onSelectScenario(scen)}
                      className="py-1.5 px-4 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs rounded-lg transition-colors font-serif"
                    >
                      Begin Quest
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
