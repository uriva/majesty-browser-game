'use client';

import React, { useState } from 'react';
import { Corpse } from '../game/types';
import { HERO_CLASS_DEFINITIONS, getResurrectionCost } from '../game/constants';
import { audioManager } from '../game/engine/Audio';
import { 
  Heart, 
  Sparkles, 
  Coins, 
  Skull, 
  Locate, 
  X, 
  Shield, 
  Sword, 
  Hourglass,
  Award
} from 'lucide-react';

interface TombstoneInspectorProps {
  corpse: Corpse;
  treasuryGold: number;
  onClose: () => void;
  onResurrect: (corpseId: string) => void;
  onTrackGrave?: (x: number, y: number) => void;
}

export const TombstoneInspector: React.FC<TombstoneInspectorProps> = ({
  corpse,
  treasuryGold,
  onClose,
  onResurrect,
  onTrackGrave
}) => {
  const [shaking, setShaking] = useState(false);
  const hero = corpse.heroData;

  if (!hero) {
    return (
      <div className="w-80 bg-slate-950/95 border-2 border-amber-800/80 rounded-xl p-4 text-slate-100 shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-amber-900/60 pb-2">
          <div className="flex items-center gap-2 text-amber-300 font-serif font-bold">
            <Skull className="w-5 h-5 text-amber-500" /> Ancient Grave
          </div>
          <button onClick={onClose} className="p-1 rounded bg-slate-900 text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-3 italic">
          An unmarked grave rests here upon the soil.
        </p>
      </div>
    );
  }

  const classDef = HERO_CLASS_DEFINITIONS[hero.heroClass];
  const resurrectCost = getResurrectionCost(hero.level);
  const canAfford = treasuryGold >= resurrectCost;

  const handleResurrectClick = () => {
    if (!canAfford) {
      setShaking(true);
      setTimeout(() => setShaking(false), 450);
      audioManager.playInsufficientGoldSound();
      return;
    }
    audioManager.playClick();
    onResurrect(corpse.id);
  };

  const getWeaponName = (tier: number) => {
    const names = ['Standard Issue', 'Iron Forged (+5)', 'Steel Tempered (+12)', 'Mithril (+22)', 'Dragonforged (+35)'];
    return names[tier] || `Tier ${tier}`;
  };

  const getArmorName = (tier: number) => {
    const names = ['Leather / Robes', 'Chainmail (+3)', 'Plate Mail (+8)', 'Runic Plate (+15)', 'Dragonscale (+25)'];
    return names[tier] || `Tier ${tier}`;
  };

  return (
    <div className="w-84 bg-slate-950/95 border-2 border-amber-600/90 rounded-xl p-4 text-slate-100 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-200 max-h-[85vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-amber-800/60 pb-3">
        <div className="flex items-center gap-3">
          <div 
            className="w-12 h-12 rounded-lg border-2 border-amber-400/80 flex items-center justify-center font-bold text-xl shadow-inner font-serif relative"
            style={{ backgroundColor: classDef.accentColor, color: '#ffffff' }}
          >
            {hero.heroClass[0].toUpperCase()}
            <div className="absolute -bottom-1 -right-1 bg-amber-500 text-slate-950 p-0.5 rounded-full border border-black" title="Fallen Hero">
              <Skull className="w-3 h-3" />
            </div>
          </div>
          <div>
            <h3 className="font-bold font-serif text-amber-200 text-base leading-tight">
              Tomb of {hero.name}
            </h3>
            <p className="text-xs text-amber-400/90 font-medium flex items-center gap-1 mt-0.5">
              <span>Fallen Level {hero.level} {classDef.name}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onTrackGrave && (
            <button
              onClick={() => onTrackGrave(corpse.x, corpse.y)}
              title="Track Tomb Location"
              className="p-1.5 rounded-lg bg-amber-950/60 border border-amber-700/50 hover:bg-amber-800/60 text-amber-300 transition-colors"
            >
              <Locate className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Epitaph / Status Banner */}
      <div className="my-3 p-2.5 rounded-lg bg-slate-900/80 border border-amber-900/60 flex items-center gap-2.5">
        <div className="p-2 rounded-md bg-amber-950/80 border border-amber-700/60 text-amber-400">
          <Award className="w-4 h-4" />
        </div>
        <div className="text-xs leading-relaxed text-slate-300">
          <div className="font-bold text-amber-300 font-serif">Awaiting Sovereign Grace</div>
          <div className="text-[11px] text-slate-400">
            Slayed <span className="text-amber-400 font-bold">{hero.kills} beasts</span> before falling. Preserves all gear & level upon resurrection.
          </div>
        </div>
      </div>

      {/* Attributes & Gear Breakdown */}
      <div className="grid grid-cols-2 gap-2 text-xs mb-3">
        <div className="bg-slate-900/60 p-2 rounded border border-slate-800 flex items-center gap-2">
          <Heart className="w-3.5 h-3.5 text-rose-400" />
          <div>
            <div className="text-[10px] text-slate-400">Max Health</div>
            <div className="font-mono font-bold text-rose-300">{hero.maxHp} HP</div>
          </div>
        </div>
        <div className="bg-slate-900/60 p-2 rounded border border-slate-800 flex items-center gap-2">
          <Sword className="w-3.5 h-3.5 text-amber-400" />
          <div>
            <div className="text-[10px] text-slate-400">Attack Power</div>
            <div className="font-mono font-bold text-amber-300">{hero.attackPower} ATK</div>
          </div>
        </div>
        <div className="bg-slate-900/60 p-2 rounded border border-slate-800 flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-sky-400" />
          <div>
            <div className="text-[10px] text-slate-400">Armor Defense</div>
            <div className="font-mono font-bold text-sky-300">{hero.defense} DEF</div>
          </div>
        </div>
        <div className="bg-slate-900/60 p-2 rounded border border-slate-800 flex items-center gap-2">
          <Hourglass className="w-3.5 h-3.5 text-purple-400" />
          <div>
            <div className="text-[10px] text-slate-400">Experience</div>
            <div className="font-mono font-bold text-purple-300">{hero.xp} / {hero.xpToNextLevel} XP</div>
          </div>
        </div>
      </div>

      {/* Equipment Retained */}
      <div className="mb-4 bg-slate-900/40 p-2.5 rounded-lg border border-slate-800 text-xs space-y-1.5">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
          <Sparkles className="w-3 h-3 text-amber-400" /> Preserved Equipment
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-400">Weapon:</span>
          <span className="text-amber-300 font-medium">{getWeaponName(hero.equipment.weaponLevel)}</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-400">Armor:</span>
          <span className="text-sky-300 font-medium">{getArmorName(hero.equipment.armorLevel)}</span>
        </div>
        {hero.traits.quirk && (
          <div className="flex justify-between text-[11px] pt-1 border-t border-slate-800/80">
            <span className="text-slate-400">Personality:</span>
            <span className="text-amber-400 italic">&ldquo;{hero.traits.quirk}&rdquo;</span>
          </div>
        )}
      </div>

      {/* Buy-Back / Resurrect Button */}
      <button
        onClick={handleResurrectClick}
        className={`w-full py-2.5 px-3 rounded-lg font-serif font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer ${
          shaking
            ? 'animate-error-shake bg-rose-900 border-2 border-rose-500 text-rose-200'
            : canAfford
            ? 'bg-gradient-to-r from-amber-600 via-yellow-500 to-amber-600 hover:from-amber-500 hover:to-yellow-400 text-slate-950 shadow-amber-900/50 hover:shadow-amber-500/25 active:scale-95'
            : 'bg-slate-800/80 border border-rose-900/60 text-slate-400 hover:bg-rose-950/40 active:scale-95'
        }`}
      >
        <Sparkles className="w-4 h-4" />
        <span>Resurrect Champion</span>
        <span className="ml-1 px-2 py-0.5 rounded-full bg-slate-950/40 font-mono text-xs text-amber-200 flex items-center gap-1">
          <Coins className="w-3 h-3 text-amber-400" /> {resurrectCost}g
        </span>
      </button>

      {!canAfford && (
        <div className="text-[11px] text-rose-400 text-center mt-2 font-medium">
          Insufficient Treasury Gold ({treasuryGold}g / {resurrectCost}g needed)
        </div>
      )}
    </div>
  );
};
