'use client';

import React from 'react';
import { Hero } from '../game/types';
import { HERO_CLASS_DEFINITIONS } from '../game/constants';
import { 
  Shield, 
  Sword, 
  Heart, 
  Sparkles, 
  Coins, 
  Skull, 
  Zap, 
  Locate, 
  X,
  Cross,
  Compass,
  Smile
} from 'lucide-react';

interface HeroInspectorProps {
  hero: Hero;
  onClose: () => void;
  onTrackHero: (hero: Hero) => void;
}

export const HeroInspector: React.FC<HeroInspectorProps> = ({ hero, onClose, onTrackHero }) => {
  const classDef = HERO_CLASS_DEFINITIONS[hero.heroClass];
  const hpPercent = Math.max(0, Math.min(100, (hero.hp / hero.maxHp) * 100));
  const mpPercent = hero.maxMp > 0 ? Math.max(0, Math.min(100, (hero.mp / hero.maxMp) * 100)) : 0;
  const xpPercent = Math.max(0, Math.min(100, (hero.xp / hero.xpToNextLevel) * 100));

  return (
    <div className="w-80 bg-slate-950/95 border-2 border-amber-600/90 rounded-xl p-4 text-slate-100 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-200">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-amber-800/60 pb-3">
        <div className="flex items-center gap-3">
          <div 
            className="w-12 h-12 rounded-lg border-2 border-amber-400/80 flex items-center justify-center font-bold text-xl shadow-inner font-serif"
            style={{ backgroundColor: classDef.accentColor, color: '#ffffff' }}
          >
            {hero.heroClass[0].toUpperCase()}
          </div>
          <div>
            <h3 className="font-bold font-serif text-amber-200 text-base leading-tight">
              {hero.name}
            </h3>
            <p className="text-xs text-amber-400/90 font-medium">
              Level {hero.level} {classDef.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onTrackHero(hero)}
            title="Track Hero Camera"
            className="p-1.5 rounded-lg bg-amber-950/60 border border-amber-700/50 hover:bg-amber-800/60 text-amber-300 transition-colors"
          >
            <Locate className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Vitals (HP, MP, XP) */}
      <div className="space-y-2 my-3">
        {/* HP */}
        <div>
          <div className="flex justify-between text-xs font-semibold mb-1">
            <span className="text-rose-400 flex items-center gap-1">
              <Heart className="w-3.5 h-3.5 fill-rose-500/30" /> Health
            </span>
            <span className="text-slate-300 font-mono">
              {Math.round(hero.hp)} / {hero.maxHp}
            </span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-rose-950">
            <div
              className="bg-gradient-to-r from-rose-600 to-rose-400 h-full transition-all duration-300"
              style={{ width: `${hpPercent}%` }}
            />
          </div>
        </div>

        {/* MP */}
        {hero.maxMp > 0 && (
          <div>
            <div className="flex justify-between text-xs font-semibold mb-1">
              <span className="text-purple-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Mana
              </span>
              <span className="text-slate-300 font-mono">
                {Math.round(hero.mp)} / {hero.maxMp}
              </span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-purple-950">
              <div
                className="bg-gradient-to-r from-purple-600 to-purple-400 h-full transition-all duration-300"
                style={{ width: `${mpPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* XP */}
        <div>
          <div className="flex justify-between text-[11px] text-amber-400/90 mb-0.5">
            <span>Experience</span>
            <span className="font-mono">{hero.xp} / {hero.xpToNextLevel} XP</span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-amber-950">
            <div
              className="bg-amber-400 h-full transition-all duration-300"
              style={{ width: `${xpPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800 text-xs mb-3">
        <div className="flex items-center gap-1.5 text-orange-300">
          <Sword className="w-4 h-4 text-orange-400" />
          <div>
            <div className="text-[10px] text-slate-400">Attack</div>
            <div className="font-bold font-mono">{hero.attackPower}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-blue-300">
          <Shield className="w-4 h-4 text-blue-400" />
          <div>
            <div className="text-[10px] text-slate-400">Defense</div>
            <div className="font-bold font-mono">{hero.defense}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-amber-300">
          <Coins className="w-4 h-4 text-amber-400" />
          <div>
            <div className="text-[10px] text-slate-400">Gold</div>
            <div className="font-bold font-mono">{hero.gold}g</div>
          </div>
        </div>
      </div>

      {/* Equipment & Potions */}
      <div className="border-t border-slate-800/80 pt-2.5 mb-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400/80 mb-1.5">
          Equipped Gear
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-slate-900 border border-slate-800 rounded p-1.5 text-[11px] flex items-center gap-1.5">
            <Sword className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {hero.equipment.weaponLevel === 0 ? 'Basic Blade' : (hero.equipment.weaponLevel === 1 ? 'Iron Weapon' : (hero.equipment.weaponLevel === 2 ? 'Steel Weapon' : 'Mithril Arms'))}
            </span>
          </div>
          {hero.equipment.hasHealingPotion && (
            <div className="bg-emerald-950/80 border border-emerald-700/60 rounded px-2 py-1.5 text-[11px] text-emerald-300 flex items-center gap-1" title="Healing Potion Ready">
              <Cross className="w-3 h-3" /> Potion
            </div>
          )}
        </div>
      </div>

      {/* Personality & Quirk */}
      <div className="border-t border-slate-800/80 pt-2.5 mb-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400/80 mb-1.5 flex items-center justify-between">
          <span>Personality</span>
          <span className="text-amber-300 font-normal normal-case italic text-[11px]">
            &quot;{hero.traits.quirk}&quot;
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-300">
          <div className="flex justify-between bg-slate-900/60 px-2 py-1 rounded">
            <span>Bravery:</span>
            <span className="font-mono text-amber-300">{hero.traits.bravery}</span>
          </div>
          <div className="flex justify-between bg-slate-900/60 px-2 py-1 rounded">
            <span>Greed:</span>
            <span className="font-mono text-amber-300">{hero.traits.greed}</span>
          </div>
        </div>
      </div>

      {/* Current Thought / Mind State */}
      <div className="bg-amber-950/40 border border-amber-800/50 rounded-lg p-2 text-xs">
        <div className="text-[10px] text-amber-400 uppercase font-semibold flex items-center gap-1 mb-0.5">
          <Smile className="w-3 h-3" /> Current Intention:
        </div>
        <div className="italic text-slate-200 text-[11px]">
          &quot;{hero.currentThought}&quot;
        </div>
      </div>
    </div>
  );
};
