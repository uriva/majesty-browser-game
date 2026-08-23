'use client';

import React from 'react';
import { Building, Hero, HeroClass } from '../game/types';
import { BUILDING_DEFINITIONS, HERO_CLASS_DEFINITIONS } from '../game/constants';
import { 
  Building as BuildingIcon, 
  Heart, 
  Coins, 
  UserPlus, 
  Sparkles, 
  X, 
  Lock,
  Users,
  Swords
} from 'lucide-react';

interface BuildingInspectorProps {
  building: Building;
  allBuildings: Building[];
  heroes?: Hero[];
  heroesCount?: number;
  treasuryGold: number;
  onClose: () => void;
  onRecruitHero: (buildingId: string, heroClass: HeroClass) => void;
  onResearchUpgrade: (buildingId: string, upgradeId: string) => void;
  onSelectHero?: (hero: Hero) => void;
}

export const BuildingInspector: React.FC<BuildingInspectorProps> = ({
  building,
  allBuildings,
  heroes = [],
  heroesCount,
  treasuryGold,
  onClose,
  onRecruitHero,
  onResearchUpgrade,
  onSelectHero
}) => {
  const bDef = BUILDING_DEFINITIONS[building.type];
  const hpPercent = Math.max(0, Math.min(100, (building.hp / building.maxHp) * 100));

  // Living heroes currently affiliated with this guild
  const livingGuildHeroes = heroes.filter(
    (h) => !h.isDead && (building.recruitedHeroIds?.includes(h.id) || h.homeGuildId === building.id)
  );
  const livingHeroCount = livingGuildHeroes.length;
  const totalActiveHeroes = heroesCount ?? heroes.filter(h => !h.isDead).length;

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
                building.constructionProgress <= 0 ? (
                  <span className="text-sky-400 font-bold ml-1.5">
                    (Blueprint - Awaiting Builder)
                  </span>
                ) : (
                  <span className="text-amber-400 font-bold ml-1.5">
                    ({Math.round(building.constructionProgress)}% Built)
                  </span>
                )
              )}
            </span>
          </div>
          <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-rose-950">
            <div
              className={`h-full transition-all duration-300 ${
                building.isConstructing
                  ? (building.constructionProgress <= 0
                      ? 'bg-gradient-to-r from-sky-500 to-cyan-400 animate-pulse'
                      : 'bg-gradient-to-r from-amber-500 to-yellow-400 animate-pulse')
                  : 'bg-rose-500'
              }`}
              style={{ width: `${building.isConstructing && building.constructionProgress <= 0 ? 100 : hpPercent}%` }}
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
              {livingHeroCount} / {building.heroSlots} Enlisted
              {building.trainingQueue && building.trainingQueue.length > 0 && (
                <span className="text-sky-400 font-bold ml-1">
                  ({building.trainingQueue.length} in training)
                </span>
              )}
            </span>
          </div>

          {/* Active Living Guild Heroes Roster */}
          {livingGuildHeroes.length > 0 && (
            <div className="mb-3 space-y-1.5 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Users className="w-3 h-3 text-amber-400" /> Active Guild Members ({livingGuildHeroes.length}):
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                {livingGuildHeroes.map((h) => {
                  const classDef = HERO_CLASS_DEFINITIONS[h.heroClass];
                  const hpPct = Math.round((h.hp / (h.maxHp || 100)) * 100);
  const totalActiveHeroes = heroesCount ?? heroes.filter(h => !h.isDead).length;

  return (
                    <button
                      key={h.id}
                      onClick={() => onSelectHero && onSelectHero(h)}
                      className="w-full flex items-center justify-between p-1.5 rounded bg-slate-950/70 hover:bg-slate-800 border border-slate-800/80 hover:border-amber-500/50 text-left transition-colors group"
                      title="Click to track hero"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-5 h-5 rounded text-[10px] font-bold font-serif flex items-center justify-center text-white"
                          style={{ backgroundColor: classDef.accentColor }}
                        >
                          {h.heroClass[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-200 group-hover:text-amber-300 transition-colors">
                            {h.name} <span className="text-[10px] text-amber-400 font-mono">Lvl {h.level}</span>
                          </div>
                          <div className="text-[9px] text-slate-400 truncate max-w-[130px]">
                            {h.state.replace('_', ' ')}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-mono text-emerald-400 font-bold">
                          {Math.round(h.hp)} HP
                        </div>
                        <div className="w-12 bg-slate-900 rounded-full h-1 overflow-hidden mt-0.5 border border-slate-800">
                          <div
                            className="bg-emerald-500 h-full"
                            style={{ width: `${hpPct}%` }}
                          />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active Training Progress Card */}
          {building.trainingQueue && building.trainingQueue.length > 0 && (
            <div
              key={building.trainingQueue[0].id || `${building.trainingQueue[0].heroClass}_${building.trainingQueue.length}`}
              className="bg-sky-950/40 border border-sky-700/60 rounded-lg p-2.5 mb-2.5"
            >
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
                  className="bg-gradient-to-r from-sky-500 to-cyan-400 h-full"
                  style={{ width: `${Math.min(100, Math.max(0, building.trainingQueue[0].progress))}%` }}
                />
              </div>
              {building.trainingQueue.length > 1 && (
                <div className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-400">
                  <span>Queued:</span>
                  {building.trainingQueue.slice(1).map((q, idx) => (
                    <span key={q.id || idx} className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 text-sky-300 font-mono">
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
              const totalQueuedAndRecruited = livingHeroCount + (building.trainingQueue?.length || 0);
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
          <div className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Guild & Palace Upgrades
            </span>
            {building.researchQueue && building.researchQueue.length > 0 && (
              <span className="text-[10px] text-purple-300 font-mono font-bold animate-pulse">
                (Upgrading...)
              </span>
            )}
          </div>

          {/* Active Research Progress */}
          {building.researchQueue && building.researchQueue.length > 0 && (
            <div
              key={building.researchQueue[0].upgradeId}
              className="bg-purple-950/40 border border-purple-800/80 rounded-xl p-2.5 mb-2.5"
            >
              <div className="flex justify-between text-xs font-semibold text-purple-200 mb-1">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                  {bDef.upgrades.find(u => u.id === building.researchQueue![0].upgradeId)?.name || 'Researching...'}
                </span>
                <span className="font-mono text-purple-300">
                  {Math.round(building.researchQueue[0].progress)}%
                </span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-purple-950">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-amber-400"
                  style={{ width: `${Math.min(100, Math.max(0, building.researchQueue[0].progress))}%` }}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            {bDef.upgrades.map((upg) => {
              const isResearched = building.researchedUpgrades.includes(upg.id);
              const isQueued = building.researchQueue?.some(r => r.upgradeId === upg.id);
              const canAfford = treasuryGold >= upg.cost;
              const isBusy = (building.researchQueue && building.researchQueue.length > 0) || false;

              // Check requirements
              const heroesMet = !upg.requiredHeroes || totalActiveHeroes >= upg.requiredHeroes;
              const buildingMet = !upg.requiredBuilding || allBuildings.some(b => b.type === upg.requiredBuilding && !b.isConstructing && b.hp > 0);
              const isConstructed = !building.isConstructing && building.hp > 0;
              const isUnlocked = heroesMet && buildingMet && isConstructed;

              let lockReason = '';
              if (!isConstructed) {
                lockReason = 'Req: Construction Complete';
              } else if (!heroesMet) {
                lockReason = `Req: ${upg.requiredHeroes}+ Active Heroes (${totalActiveHeroes}/${upg.requiredHeroes})`;
              } else if (!buildingMet && upg.requiredBuilding) {
                lockReason = `Req: ${BUILDING_DEFINITIONS[upg.requiredBuilding].name}`;
              }

              return (
                <div
                  key={upg.id}
                  className={`p-2.5 rounded-lg border text-left ${
                    isResearched
                      ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-200'
                      : isQueued
                      ? 'bg-purple-950/50 border-purple-600/80 text-purple-200'
                      : !isUnlocked
                      ? 'bg-slate-950/70 border-slate-900 opacity-70'
                      : canAfford && !isBusy
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
                    ) : isQueued ? (
                      <span className="text-[10px] bg-purple-900/80 text-purple-300 font-bold px-2 py-0.5 rounded border border-purple-600 animate-pulse">
                        In Progress
                      </span>
                    ) : !isUnlocked ? (
                      <span className="text-[10px] text-rose-400 font-bold font-mono flex items-center gap-1 bg-rose-950/60 border border-rose-800 px-2 py-0.5 rounded">
                        <Lock className="w-3 h-3" /> Locked
                      </span>
                    ) : (
                      <button
                        disabled={!canAfford || isBusy}
                        onClick={() => onResearchUpgrade(building.id, upg.id)}
                        className={`text-xs font-bold font-mono px-2.5 py-1 rounded transition-colors ${
                          canAfford && !isBusy
                            ? 'bg-amber-600 hover:bg-amber-500 text-slate-950'
                            : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                        }`}
                      >
                        Research ({upg.cost}g)
                      </button>
                    )}
                  </div>

                  {!isUnlocked && !isResearched && (
                    <div className="text-[10px] text-rose-400/90 font-mono mb-1">
                      {lockReason}
                    </div>
                  )}

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
