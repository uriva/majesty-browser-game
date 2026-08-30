'use client';

import React, { useState } from 'react';
import { FlagType } from '../game/types';
import { Target, Compass, Shield, Coins, X } from 'lucide-react';
import { audioManager } from '../game/engine/Audio';

interface FlagMenuProps {
  treasuryGold: number;
  activeFlagType: FlagType | null;
  currentBountyAmount: number;
  onSelectFlag: (type: FlagType | null, amount: number) => void;
}

export const FlagMenu: React.FC<FlagMenuProps> = ({
  treasuryGold,
  activeFlagType,
  currentBountyAmount,
  onSelectFlag
}) => {
  const [bounty, setBounty] = useState<number>(currentBountyAmount || 100);
  const [shakingId, setShakingId] = useState<string | null>(null);

  const flagOptions = [
    {
      type: 'attack' as FlagType,
      name: 'Attack Bounty',
      icon: Target,
      color: 'from-rose-700 to-red-600',
      border: 'border-rose-500',
      desc: 'Lures heroes to destroy a monster or lair.'
    },
    {
      type: 'explore' as FlagType,
      name: 'Explore Flag',
      icon: Compass,
      color: 'from-blue-700 to-sky-600',
      border: 'border-blue-500',
      desc: 'Entices scouts & rangers to unveil Fog of War.'
    },
    {
      type: 'defend' as FlagType,
      name: 'Defend Flag',
      icon: Shield,
      color: 'from-amber-600 to-yellow-500',
      border: 'border-amber-400',
      desc: 'Rallies champions to guard an area or building.'
    }
  ];

  const presets = [50, 100, 200, 500, 1000];

  const handleFlagClick = (type: FlagType, isSelected: boolean) => {
    if (treasuryGold < bounty && !isSelected) {
      setShakingId(`flag_${type}`);
      setTimeout(() => setShakingId(null), 450);
      audioManager.playInsufficientGoldSound();
      return;
    }
    audioManager.playClick();
    onSelectFlag(isSelected ? null : type, bounty);
  };

  return (
    <div className="bg-slate-950/95 border-2 border-amber-600/80 rounded-xl p-3 shadow-2xl backdrop-blur max-w-sm w-full">
      <div className="flex items-center justify-between border-b border-amber-900/60 pb-2 mb-2.5">
        <div className="text-xs uppercase font-bold tracking-wider text-amber-400 font-serif flex items-center gap-1.5">
          <Coins className="w-4 h-4" /> Royal Bounty Office
        </div>
        {activeFlagType && (
          <button
            onClick={() => onSelectFlag(null, bounty)}
            className="flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 font-semibold px-2 py-0.5 bg-rose-950/50 border border-rose-800/60 rounded"
          >
            <X className="w-3 h-3" /> Cancel Flag
          </button>
        )}
      </div>

      {/* Bounty Slider / Presets */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-slate-300 mb-1">
          <span>Bounty Reward:</span>
          <span className="font-bold font-mono text-amber-300 text-sm">{bounty}g</span>
        </div>
        <div className="flex gap-1">
          {presets.map((amt) => {
            const canAffordAmt = treasuryGold >= amt;
            return (
              <button
                key={amt}
                onClick={() => {
                  if (!canAffordAmt) {
                    setShakingId(`preset_${amt}`);
                    setTimeout(() => setShakingId(null), 450);
                    audioManager.playInsufficientGoldSound();
                    return;
                  }
                  setBounty(amt);
                  if (activeFlagType) onSelectFlag(activeFlagType, amt);
                }}
                className={`flex-1 py-1 text-xs font-mono font-bold rounded border transition-all cursor-pointer ${
                  shakingId === `preset_${amt}`
                    ? 'animate-error-shake'
                    : bounty === amt
                    ? 'bg-amber-600 border-amber-400 text-slate-950 shadow'
                    : canAffordAmt
                    ? 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-amber-300 active:scale-95'
                    : 'bg-slate-900/60 border-rose-950 text-rose-400/80 hover:border-rose-700/80 active:scale-95'
                }`}
              >
                {amt}g
              </button>
            );
          })}
        </div>
      </div>

      {/* Flag Types */}
      <div className="space-y-1.5">
        {flagOptions.map(({ type, name, icon: Icon, color, border, desc }) => {
          const isSelected = activeFlagType === type;
          const canAfford = treasuryGold >= bounty;
          const isShaking = shakingId === `flag_${type}`;

          return (
            <button
              key={type}
              onClick={() => handleFlagClick(type, isSelected)}
              className={`w-full flex items-center justify-between p-2 rounded-lg border text-left transition-all cursor-pointer ${
                isShaking
                  ? 'animate-error-shake'
                  : isSelected
                  ? `bg-gradient-to-r ${color} ${border} text-white shadow-lg ring-2 ring-amber-400`
                  : canAfford
                  ? 'bg-slate-900/80 border-slate-800 text-slate-200 hover:bg-slate-800 hover:border-amber-600 active:scale-95'
                  : 'bg-slate-900/60 border-rose-900/50 text-slate-400 hover:bg-rose-950/40 hover:border-rose-700/80 active:scale-95'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-amber-300" />
                <div>
                  <div className="font-bold text-xs">{name}</div>
                  <div className="text-[10px] text-slate-400 opacity-90">{desc}</div>
                </div>
              </div>
              <div className="text-right">
                <div className={`text-xs font-mono font-bold ${canAfford ? 'text-amber-300' : 'text-rose-400'}`}>
                  {bounty}g
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
