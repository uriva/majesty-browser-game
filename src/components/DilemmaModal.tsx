'use client';

import React from 'react';
import { Crown, Scroll, Coins, Sparkles, XCircle } from 'lucide-react';
import { DilemmaChoice, RoyalDilemma } from '../game/types';

interface DilemmaModalProps {
  dilemma: RoyalDilemma | null;
  treasuryGold: number;
  mana: number;
  onResolve: (choice: DilemmaChoice) => void;
}

export const DilemmaModal: React.FC<DilemmaModalProps> = ({
  dilemma,
  treasuryGold,
  mana,
  onResolve
}) => {
  if (!dilemma) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fadeIn pointer-events-auto">
      <div className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 border-2 border-amber-500/90 rounded-2xl shadow-2xl shadow-amber-950/60 p-6 overflow-hidden">
        {/* Decorative corner flourishes */}
        <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-amber-400" />
        <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-amber-400" />
        <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-amber-400" />
        <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-amber-400" />

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-amber-500/30 pb-4">
          <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-400/60 text-amber-300">
            <Crown className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-sans font-bold uppercase tracking-widest text-amber-400/90">
              Royal Petition • {dilemma.sender}
            </div>
            <h2 className="font-serif text-xl font-bold text-amber-100 tracking-wide">
              {dilemma.title}
            </h2>
          </div>
        </div>

        {/* Narrative Description */}
        <div className="my-5 p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-200 text-sm font-serif leading-relaxed italic">
          "{dilemma.description}"
        </div>

        {/* Choices */}
        <div className="flex flex-col gap-3">
          {dilemma.choices.map((c, idx) => {
            const cantAffordGold = (c.goldCost ?? 0) > treasuryGold;
            const cantAffordMana = (c.manaCost ?? 0) > mana;
            const disabled = cantAffordGold || cantAffordMana;

            return (
              <button
                key={c.actionId || idx}
                disabled={disabled}
                onClick={() => onResolve(c)}
                className={`w-full text-left p-4 rounded-xl border transition-all flex flex-col gap-1.5 ${
                  disabled
                    ? 'opacity-40 cursor-not-allowed bg-slate-900 border-slate-800 text-slate-500'
                    : 'bg-slate-900/90 hover:bg-slate-800/90 border-amber-600/60 hover:border-amber-400 text-slate-100 shadow-lg hover:shadow-amber-950/40 cursor-pointer'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-serif font-bold text-sm text-amber-200">
                    {c.text}
                  </span>
                  <div className="flex items-center gap-2 text-xs font-sans">
                    {c.goldCost && (
                      <span className="text-red-400 font-semibold">-{c.goldCost}g</span>
                    )}
                    {c.goldGain && (
                      <span className="text-amber-300 font-semibold">+{c.goldGain}g</span>
                    )}
                    {c.manaGain && (
                      <span className="text-purple-300 font-semibold">+{c.manaGain} Mana</span>
                    )}
                  </div>
                </div>
                <div className="text-xs text-slate-400 font-sans">
                  {c.effectDescription}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
