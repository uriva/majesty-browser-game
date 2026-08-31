'use client';

import React, { useState } from 'react';
import { SovereignSpell } from '../game/types';
import { Zap, HeartPulse, Eye, Swords, Coins, X, Sparkles, Crosshair } from 'lucide-react';
import { audioManager } from '../game/engine/Audio';

interface SpellMenuProps {
  spells: SovereignSpell[];
  treasuryGold: number;
  mana: number;
  activeSpellId: string | null;
  onSelectSpell: (spellId: string | null) => void;
  onCastInstantSpell?: (spellId: string) => void;
}

export const SpellMenu: React.FC<SpellMenuProps> = ({
  spells,
  treasuryGold,
  mana,
  activeSpellId,
  onSelectSpell,
  onCastInstantSpell
}) => {
  const [shakingId, setShakingId] = useState<string | null>(null);

  const iconMap: Record<string, React.ElementType> = {
    Zap,
    HeartPulse,
    Eye,
    Swords,
    Coins,
    Sparkles,
    Crosshair
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

    // Global / Non-targeted spells trigger immediately on single click
    if (spell.targetType === 'global') {
      if (onCastInstantSpell) {
        onCastInstantSpell(spell.id);
      }
      return;
    }

    // Targeted AOE spells enter placement mode
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
            <X className="w-3 h-3" /> Cancel Targeting
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
          const isInstant = spell.targetType === 'global';

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
                  className="absolute inset-0 bg-slate-950/85 flex items-center justify-center font-mono font-bold text-xs text-purple-300 z-10 backdrop-blur-[1px]"
                >
                  Cooldown: {Math.ceil(spell.currentCooldown)}s
                </div>
              )}

              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div className="w-7 h-7 rounded bg-purple-950 border border-purple-700/60 flex items-center justify-center text-purple-300 shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-xs text-purple-200 leading-tight">
                      {spell.name}
                    </span>
                    {isInstant ? (
                      <span className="px-1.5 py-0.2 rounded bg-purple-950/80 border border-purple-600/60 text-purple-300 text-[9px] font-bold flex items-center gap-0.5">
                        <Sparkles className="w-2.5 h-2.5 text-amber-400" /> Instant
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.2 rounded bg-slate-950/80 border border-slate-700 text-slate-400 text-[9px] flex items-center gap-0.5">
                        <Crosshair className="w-2.5 h-2.5 text-sky-400" /> Target Area
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 leading-snug truncate mt-0.5">
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
