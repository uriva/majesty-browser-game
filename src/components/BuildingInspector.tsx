'use client';

import React from 'react';
import { Building, HeroClass } from '../game/types';
import { BUILDING_DEFINITIONS, HERO_CLASS_DEFINITIONS } from '../game/constants';
import { 
  Building as BuildingIcon, 
  Heart, 
  Coins, 
  UserPlus, 
  Sparkles, 
  X, 
  Wrench,
  Shield,
  ArrowUpCircle
} from 'lucide-react';

interface BuildingInspectorProps {
  building: Building;
  treasuryGold: number;
  onClose: () => void;
  onRecruitHero: (buildingId: string, heroClass: HeroClass) => void;
  onResearchUpgrade: (buildingId: string, upgradeId: string) => void;
}

export const BuildingInspector: React.FC<BuildingInspectorProps> = ({
  building,
  treasuryGold,
  onClose,
  onRecruitHero,
  onResearchUpgrade
}) => {
  const bDef = BUILDING_DEFINITIONS[building.type];
  const hpPercent = Math.max(0, Math.min(100, (building.hp / building.maxHp) * 100));

  return (
    <div className="w-84 bg-slate-950/95 border-2 border-amber-600/90 rounded-xl p-4 text-slate-100 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-200 max-h-[85vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-amber-800/60 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg bg-amber-950/80 border-2 border-amber-500/80 flex items-center justify-center text-amber-300">
            <BuildingIcon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold font-serif text-amber-200 text-base leading-tight">
              {building.name}
            </h3>
            <p className="text-xs text-slate-400">
              Level {building.level} Structure
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Description */}
      <p className="text-xs text-slate-300 my-2.5 leading-relaxed italic">
        {bDef.description}
      </p>

      {/* Health & Revenue */}
      <div className="space-y-2 mb-4 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
        <div>
          <div className="flex justify-between text-xs font-semibold mb-1">
            <span className="text-rose-400 flex items-center gap-1">
              <Heart className="w-3.5 h-3.5 fill-rose-500/30" /> Integrity
            </span>
            <span className="text-slate-300 font-mono">
              {Math.round(building.hp)} / {building.maxHp} HP
              {building.isConstructing && (
                <span className="text-amber-400 font-bold ml-1.5">
                  ({Math.round(building.constructionProgress)}% Built)
                </span>
              )}
            </span>
          </div>
          <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-rose-950">
            <div
              className={`h-full transition-all duration-300 ${
                building.isConstructing
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-400 animate-pulse'
                  : 'bg-rose-500'
              }`}
              style={{ width: `${hpPercent}%` }}
            />
          </div>
        </div>

        {building.goldStored !== undefined && (
          <div className="flex justify-between items-center text-xs text-amber-300 pt-1">
            <span className="flex items-center gap-1 text-slate-400">
              <Coins className="w-3.5 h-3.5 text-amber-400" /> Uncollected Taxes:
            </span>
            <span className="font-bold font-mono text-amber-400">
              {Math.floor(building.goldStored)}g
            </span>
          </div>
        )}
      </div>

      {/* Hero Recruitment */}
      {bDef.recruits && bDef.recruits.length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5" /> Recruit Heroes
            </span>
            <span className="text-[11px] text-slate-400 font-normal">
              {building.recruitedHeroIds.length} / {building.heroSlots} Enlisted
              {building.trainingQueue && building.trainingQueue.length > 0 && (
                <span className="text-sky-400 font-bold ml-1">
                  ({building.trainingQueue.length} in training)
                </span>
              )}
            </span>
          </div>

          {/* Active Training Progress Card */}
          {building.trainingQueue && building.trainingQueue.length > 0 && (
            <div className="bg-sky-950/40 border border-sky-700/60 rounded-lg p-2.5 mb-2.5">
              <div className="flex justify-between items-center text-xs mb-1">
                <span className="text-sky-300 font-bold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                  Training {HERO_CLASS_DEFINITIONS[building.trainingQueue[0].heroClass].name}...
                </span>
                <span className="font-mono text-[11px] text-sky-400">
                  {Math.round(building.trainingQueue[0].progress)}%
                </span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-sky-950">
                <div
                  className="bg-gradient-to-r from-sky-500 to-cyan-400 h-full transition-all duration-150"
                  style={{ width: `${Math.min(100, Math.max(0, building.trainingQueue[0].progress))}%` }}
                />
              </div>
              {building.trainingQueue.length > 1 && (
                <div className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-400">
                  <span>Queued:</span>
                  {building.trainingQueue.slice(1).map((q, idx) => (
                    <span key={idx} className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 text-sky-300 font-mono">
                      {HERO_CLASS_DEFINITIONS[q.heroClass].name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            {bDef.recruits.map((heroClass) => {
              const classDef = HERO_CLASS_DEFINITIONS[heroClass];
              const cost = bDef.heroRecruitCost?.[heroClass] || 150;
              const canAfford = treasuryGold >= cost;
              const totalQueuedAndRecruited = building.recruitedHeroIds.length + (building.trainingQueue?.length || 0);
              const isFull = totalQueuedAndRecruited >= building.heroSlots;

              return (
                <button
                  key={heroClass}
                  disabled={!canAfford || isFull}
                  onClick={() => onRecruitHero(building.id, heroClass)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-lg border text-left transition-all ${
                    canAfford && !isFull
                      ? 'bg-amber-950/40 hover:bg-amber-900/60 border-amber-700/60 text-amber-100 hover:border-amber-500 shadow-sm'
                      : 'bg-slate-900/50 border-slate-800 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div 
                      className="w-7 h-7 rounded border border-amber-400/50 flex items-center justify-center font-bold text-xs font-serif"
                      style={{ backgroundColor: classDef.accentColor, color: '#fff' }}
                    >
                      {heroClass[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold text-xs text-slate-200">
                        {classDef.name}
                        <span className="text-[10px] text-slate-400 font-normal ml-1.5">
                          ({classDef.trainingTime}s training)
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {classDef.description}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold font-mono text-amber-300">
                      {cost}g
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Researched & Available Upgrades */}
      {bDef.upgrades && bDef.upgrades.length > 0 && (
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Guild & Shop Upgrades
          </div>

          <div className="space-y-2">
            {bDef.upgrades.map((upg) => {
              const isResearched = building.researchedUpgrades.includes(upg.id);
              const canAfford = treasuryGold >= upg.cost;

              return (
                <div
                  key={upg.id}
                  className={`p-2.5 rounded-lg border text-left ${
                    isResearched
                      ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-200'
                      : canAfford
                      ? 'bg-slate-900/80 border-slate-700 hover:border-amber-500'
                      : 'bg-slate-900/40 border-slate-800 text-slate-500'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <div className="font-semibold text-xs text-amber-200">
                      {upg.name}
                    </div>
                    {isResearched ? (
                      <span className="text-[10px] bg-emerald-900/80 text-emerald-300 font-bold px-2 py-0.5 rounded border border-emerald-600">
                        Researched
                      </span>
                    ) : (
                      <button
                        disabled={!canAfford}
                        onClick={() => onResearchUpgrade(building.id, upg.id)}
                        className={`text-xs font-bold font-mono px-2.5 py-1 rounded transition-colors ${
                          canAfford
                            ? 'bg-amber-600 hover:bg-amber-500 text-slate-950'
                            : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                        }`}
                      >
                        Research ({upg.cost}g)
                      </button>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 leading-snug">
                    {upg.description}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
