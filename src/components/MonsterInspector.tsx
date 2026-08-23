'use client';

import React from 'react';
import { Flag, Monster, MonsterLair } from '../game/types';
import { MONSTER_DEFINITIONS } from '../game/constants';
import { Skull, Heart, Sword, Shield, Coins, X, Target, Ban, ShieldAlert } from 'lucide-react';

interface MonsterInspectorProps {
  entity: Monster | MonsterLair;
  isLair: boolean;
  existingFlag?: Flag;
  hasNearbyFriendly?: boolean;
  onClose: () => void;
  onSetAttackBounty: (entityId: string, isLair: boolean) => void;
  onCancelAttackBounty?: (flagId: string) => void;
}

export const MonsterInspector: React.FC<MonsterInspectorProps> = ({
  entity,
  isLair,
  existingFlag,
  hasNearbyFriendly,
  onClose,
  onSetAttackBounty,
  onCancelAttackBounty
}) => {
  const hpPercent = Math.max(0, Math.min(100, (entity.hp / entity.maxHp) * 100));

  return (
    <div className="w-80 bg-slate-950/95 border-2 border-rose-700/90 rounded-xl p-4 text-slate-100 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-200">
      <div className="flex items-start justify-between border-b border-rose-900/60 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg bg-rose-950/80 border-2 border-rose-600/80 flex items-center justify-center text-rose-400">
            <Skull className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold font-serif text-rose-200 text-base leading-tight">
              {entity.name}
            </h3>
            <p className="text-xs text-rose-400/90">
              {isLair ? 'Monster Lair / Spawner' : ((entity as Monster).isBoss ? 'Epic Boss Monster' : 'Hostile Monster')}
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

      {/* HP Bar */}
      <div className="my-3 space-y-1">
        <div className="flex justify-between text-xs font-semibold">
          <span className="text-rose-400 flex items-center gap-1">
            <Heart className="w-3.5 h-3.5 fill-rose-500/30" /> Vitality
          </span>
          <span className="text-slate-300 font-mono">
            {Math.round(entity.hp)} / {entity.maxHp}
          </span>
        </div>
        <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-rose-950">
          <div
            className="bg-gradient-to-r from-rose-700 to-rose-500 h-full transition-all duration-300"
            style={{ width: `${hpPercent}%` }}
          />
        </div>
      </div>

      {!isLair && (
        <div className="grid grid-cols-2 gap-2 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 text-xs mb-3">
          <div className="flex items-center gap-1.5 text-orange-300">
            <Sword className="w-4 h-4 text-orange-400" />
            <div>
              <div className="text-[10px] text-slate-400">Attack Power</div>
              <div className="font-bold font-mono">{(entity as Monster).attackPower}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-blue-300">
            <Shield className="w-4 h-4 text-blue-400" />
            <div>
              <div className="text-[10px] text-slate-400">Armor Defense</div>
              <div className="font-bold font-mono">{(entity as Monster).defense}</div>
            </div>
          </div>
        </div>
      )}

      {/* Attack Bounty Actions */}
      {existingFlag ? (
        <div className="space-y-2 mt-2">
          <div className="p-2 bg-rose-950/70 rounded-lg border border-rose-800/80 flex items-center justify-between text-xs font-semibold text-amber-300">
            <span className="flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-amber-400" /> Active Bounty:
            </span>
            <span className="font-mono text-amber-200">{existingFlag.goldReward}g</span>
          </div>

          <button
            onClick={() => onCancelAttackBounty && onCancelAttackBounty(existingFlag.id)}
            disabled={hasNearbyFriendly}
            className={`w-full py-2.5 px-3 font-bold text-xs rounded-lg shadow-lg border flex items-center justify-center gap-2 transition-all ${
              hasNearbyFriendly
                ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed opacity-60'
                : 'bg-gradient-to-r from-red-700 to-rose-600 hover:from-red-600 hover:to-rose-500 text-white border-red-400/40 cursor-pointer'
            }`}
          >
            <Ban className="w-4 h-4" /> Cancel Bounty & Refund {existingFlag.goldReward}g
          </button>
          {hasNearbyFriendly && (
            <p className="text-[10px] text-amber-400/90 text-center flex items-center justify-center gap-1">
              <ShieldAlert className="w-3 h-3 text-amber-400" /> Heroes nearby (cannot cancel)
            </p>
          )}
        </div>
      ) : (
        <button
          onClick={() => onSetAttackBounty(entity.id, isLair)}
          className="w-full mt-2 py-2.5 px-3 bg-gradient-to-r from-rose-700 to-red-600 hover:from-rose-600 hover:to-red-500 text-white font-bold text-xs rounded-lg shadow-lg border border-rose-400/40 flex items-center justify-center gap-2 transition-all"
        >
          <Target className="w-4 h-4" /> Place Attack Bounty Flag
        </button>
      )}
    </div>
  );
};
