'use client';

import React from 'react';
import { Flag, GameState } from '../game/types';
import { Flag as FlagIcon, X, Coins, ShieldAlert, CheckCircle2, Ban } from 'lucide-react';

interface FlagInspectorProps {
  flag: Flag;
  gameState: GameState;
  onClose: () => void;
  onCancelFlag: (flagId: string) => void;
}

export const FlagInspector: React.FC<FlagInspectorProps> = ({
  flag,
  gameState,
  onClose,
  onCancelFlag
}) => {
  const nearDist = 120;
  const hasNearbyFriendly =
    gameState.heroes.some(h => !h.isDead && Math.hypot(h.x - flag.x, h.y - flag.y) < nearDist) ||
    gameState.peasants.some(p => p.hp > 0 && Math.hypot(p.x - flag.x, p.y - flag.y) < nearDist) ||
    gameState.taxCollectors.some(tc => tc.hp > 0 && Math.hypot(tc.x - flag.x, tc.y - flag.y) < nearDist);

  const flagColor =
    flag.type === 'attack'
      ? 'border-rose-600/90 text-rose-400 bg-rose-950/80'
      : flag.type === 'explore'
      ? 'border-blue-600/90 text-blue-400 bg-blue-950/80'
      : 'border-amber-600/90 text-amber-400 bg-amber-950/80';

  let targetDescription = 'Area Ground Target';
  if (flag.targetEntityType === 'monster') {
    const monster = gameState.monsters.find(m => m.id === flag.targetEntityId);
    targetDescription = monster ? `Enemy: ${monster.name} (${Math.round(monster.hp)}/${monster.maxHp} HP)` : 'Enemy Monster';
  } else if (flag.targetEntityType === 'lair') {
    const lair = gameState.lairs.find(l => l.id === flag.targetEntityId);
    targetDescription = lair ? `Enemy Lair: ${lair.name}` : 'Monster Lair';
  }

  return (
    <div className="w-80 bg-slate-950/95 border-2 border-amber-600/90 rounded-xl p-4 text-slate-100 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-200">
      <div className="flex items-start justify-between border-b border-amber-900/60 pb-3">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-lg border-2 flex items-center justify-center ${flagColor}`}>
            <FlagIcon className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold font-serif text-amber-200 text-base leading-tight capitalize">
              {flag.type} Bounty Flag
            </h3>
            <p className="text-xs text-amber-400/90 font-mono flex items-center gap-1 mt-0.5">
              <Coins className="w-3.5 h-3.5 text-amber-400" /> {flag.goldReward}g Posted Bounty
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

      <div className="my-3 p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs space-y-1.5">
        <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Target Assignment</div>
        <div className="text-slate-200 font-semibold">{targetDescription}</div>
      </div>

      {/* Engagement Status */}
      <div className="mb-3 p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs">
        <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-1">Friendly Engagement</div>
        {hasNearbyFriendly ? (
          <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
            <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
            <span>Heroes are nearby (cannot cancel)</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>No friendly heroes nearby (safe to cancel)</span>
          </div>
        )}
      </div>

      {/* Cancel Action */}
      <button
        onClick={() => onCancelFlag(flag.id)}
        disabled={hasNearbyFriendly}
        className={`w-full py-2.5 px-3 font-bold text-xs rounded-lg shadow-lg border flex items-center justify-center gap-2 transition-all ${
          hasNearbyFriendly
            ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed opacity-60'
            : 'bg-gradient-to-r from-red-700 to-rose-600 hover:from-red-600 hover:to-rose-500 text-white border-red-400/40 cursor-pointer'
        }`}
      >
        <Ban className="w-4 h-4" /> Cancel Bounty & Refund {flag.goldReward}g
      </button>
    </div>
  );
};
