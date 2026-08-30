'use client';

import React, { useState } from 'react';
import { SovereignSpell } from '../game/types';
import { Zap, HeartPulse, Eye, Swords, Coins, X } from 'lucide-react';
import { audioManager } from '../game/engine/Audio';

interface SpellMenuProps {
  spells: SovereignSpell[];
  treasuryGold: number;
  mana: number;
  activeSpellId: string | null;
  onSelectSpell: (spellId: string | null) => void;
}

export const SpellMenu: React.FC<SpellMenuProps> = ({
  spells,
  treasuryGold,
  mana,
  activeSpellId,
  onSelectSpell
}) => {
  const [shakingId, setShakingId] = useState<string | null>(null);

  const iconMap: Record<string, React.ElementType> = {
    Zap,
    HeartPulse,
    Eye,
    Swords,
    Coins
  };

  const handleSpellClick = (spell: SovereignSpell, isSelected: boolean, canAfford: boolean, onCooldown: boolean) => {
    if (onCooldown) {
      audioManager.playInsufficientGoldSound();
      return;
    }
    if (!canAfford && !isSelected) {
      setShakingId(`spell_${spell.id}`);
      setTimeout(() => setShakingId(null), 450);
      audioManager.playInsufficientGoldSound();
      return;
    }
    audioManager.playClick();
    onSelectSpell(isSelected ? null : spell.id);
  };

  return (
    <div className="bg-slate-950/95 border-2 border-purple-600/80 rounded-xl p-2.5 shadow-2xl backdrop-blur max-w-sm w-full">
      <div className="flex items-center justify-between border-b border-purple-900/60 pb-2 mb-2">
        <div className="text-xs uppercase font-bold tracking-wider text-purple-400 font-serif flex items-center gap-1.5">
          <Zap className="w-4 h-4" /> Sovereign Spellbook
        </div>
        {activeSpellId && (
          <button
            onClick={() => onSelectSpell(null)}
            className="flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 font-semibold px-2 py-0.5 bg-rose-950/50 border border-rose-800/60 rounded"
          >
            <X className="w-3 h-3" /> Cancel Spell
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        {spells.map((spell) => {
          const Icon = iconMap[spell.icon] || Zap;
          const isSelected = activeSpellId === spell.id;
          const onCooldown = spell.currentCooldown > 0;
          const canAfford = treasuryGold >= spell.goldCost && mana >= spell.manaCost && !onCooldown;
          const isShaking = shakingId === `spell_${spell.id}`;

          return (
            <button
              key={spell.id}
              onClick={() => handleSpellClick(spell, isSelected, canAfford, onCooldown)}
              className={`w-full flex items-center justify-between p-2 rounded-lg border text-left transition-all relative overflow-hidden cursor-pointer ${
                isShaking
                  ? 'animate-error-shake'
                  : isSelected
                  ? 'bg-purple-900/80 border-purple-400 text-white shadow-lg ring-2 ring-purple-400'
                  : canAfford
                  ? 'bg-slate-900/80 border-purple-950 text-slate-200 hover:bg-purple-950/60 hover:border-purple-600 active:scale-95'
                  : 'bg-slate-900/60 border-rose-900/40 text-slate-400 hover:bg-rose-950/30 hover:border-rose-700/60 active:scale-95'
              }`}
            >
              {/* Cooldown overlay */}
              {onCooldown && (
                <div 
                  className="absolute inset-0 bg-slate-950/80 flex items-center justify-center font-mono font-bold text-xs text-purple-300 z-10"
                >
                  Cooldown: {Math.ceil(spell.currentCooldown)}s
                </div>
              )}

              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-purple-950 border border-purple-700/60 flex items-center justify-center text-purple-300">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-xs text-purple-200 leading-tight">
                    {spell.name}
                  </div>
                  <div className="text-[10px] text-slate-400 leading-snug">
                    {spell.description}
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0 ml-2">
                {spell.goldCost > 0 && (
                  <div className={`text-[11px] font-mono font-bold ${treasuryGold >= spell.goldCost ? 'text-amber-300' : 'text-rose-400'}`}>
                    {spell.goldCost}g
                  </div>
                )}
                {spell.manaCost > 0 && (
                  <div className={`text-[11px] font-mono font-bold ${mana >= spell.manaCost ? 'text-purple-400' : 'text-rose-400'}`}>
                    {spell.manaCost} MP
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
