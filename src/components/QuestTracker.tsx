'use client';

import React, { useState } from 'react';
import { Scroll, ChevronDown, ChevronUp, CheckCircle2, Swords } from 'lucide-react';
import { GameState } from '../game/types';
import { bossIdFor, evaluateObjective, getQuestChain } from '../game/quests';

interface QuestTrackerProps {
  state: GameState;
}

export const QuestTracker: React.FC<QuestTrackerProps> = ({ state }) => {
  const [collapsed, setCollapsed] = useState(false);
  const chain = getQuestChain(state.scenario.id);
  if (chain.length === 0) return null;

  const active = state.quests.filter(q => q.status === 'active');
  const doneCount = state.quests.filter(q => q.status === 'complete').length;
  if (active.length === 0 && doneCount === 0) return null;

  return (
    <div className="bg-slate-950/95 border-2 border-amber-600/80 rounded-xl shadow-2xl backdrop-blur w-64 pointer-events-auto">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
        title={collapsed ? 'Show quests' : 'Hide quests'}
      >
        <Scroll className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="font-serif text-xs font-bold tracking-widest text-amber-300 uppercase flex-1">
          Royal Chronicle
        </span>
        {doneCount > 0 && (
          <span className="text-[10px] font-sans text-emerald-300 bg-emerald-900/50 border border-emerald-700/60 rounded px-1.5 py-0.5">
            {doneCount} done
          </span>
        )}
        {collapsed ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
      </button>

      {!collapsed && (
        <div className="px-3 pb-3 flex flex-col gap-2.5 max-h-72 overflow-y-auto">
          {active.map(progress => {
            const def = chain.find(q => q.id === progress.questId);
            if (!def) return null;
            const stage = def.stages[progress.stageIndex];
            if (!stage) return null;
            const bossId = bossIdFor(def.id, progress.stageIndex);
            const bossAlive = progress.bossSpawned && state.monsters.some(m => m.id === bossId && m.hp > 0);
            return (
              <div key={progress.questId} className="rounded-lg bg-slate-900/80 border border-slate-800 p-2">
                <div className="text-[10px] uppercase font-bold tracking-widest text-purple-300 font-sans">
                  {def.act}
                </div>
                <div className="font-serif text-sm font-bold text-slate-100 leading-tight">
                  {stage.title}
                </div>
                <div className="mt-1 flex flex-col gap-1">
                  {stage.objectives.map((o, i) => {
                    const p = evaluateObjective(state, progress, o, bossAlive);
                    return (
                      <div key={i} className="flex items-center gap-1.5 text-xs font-sans">
                        {p.done ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <Swords className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        )}
                        <span className={p.done ? 'text-slate-500 line-through' : 'text-slate-300'}>
                          {o.description}
                        </span>
                        {!p.done && p.target > 1 && (
                          <span className="ml-auto text-[10px] text-amber-300 tabular-nums">
                            {p.current}/{p.target}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {(stage.rewardGold || stage.rewardMana) && (
                  <div className="mt-1 text-[10px] font-sans text-amber-400/90">
                    Reward: {[stage.rewardGold ? `+${stage.rewardGold}g` : null, stage.rewardMana ? `+${stage.rewardMana} mana` : null].filter(Boolean).join(' ')}
                  </div>
                )}
              </div>
            );
          })}
          {active.length === 0 && doneCount > 0 && (
            <div className="text-xs font-sans text-emerald-300 px-1">
              All chronicles fulfilled. The realm prospers! 👑
            </div>
          )}
        </div>
      )}
    </div>
  );
};
