'use client';

import React, { useState } from 'react';
import { Corpse, Hero } from '../game/types';
import { HERO_CLASS_DEFINITIONS } from '../game/constants';
import { Swords, ChevronDown, ChevronUp, Skull } from 'lucide-react';

interface HeroRosterBarProps {
  heroes: Hero[];
  corpses?: Corpse[];
  selectedHeroId?: string | null;
  selectedCorpseId?: string | null;
  onSelectHero: (hero: Hero) => void;
  onSelectCorpse?: (corpse: Corpse) => void;
}

export const HeroRosterBar: React.FC<HeroRosterBarProps> = ({
  heroes,
  corpses = [],
  selectedHeroId,
  selectedCorpseId,
  onSelectHero,
  onSelectCorpse
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const activeHeroes = heroes.filter((h) => !h.isDead);
  const fallenHeroCorpses = corpses.filter((c) => c.type === 'hero' && c.heroData);

  if (activeHeroes.length === 0 && fallenHeroCorpses.length === 0) return null;

  const getStateColor = (state: string) => {
    switch (state) {
      case 'attacking':
      case 'fleeing':
        return '#ef4444'; // Red for combat/danger
      case 'pursuing_flag':
      case 'collecting_treasure':
        return '#f59e0b'; // Amber for flags/treasure
      case 'resting_at_inn':
      case 'visiting_guild':
      case 'shopping':
        return '#a855f7'; // Purple for resting/services
      default:
        return '#22c55e'; // Green for patrol/ready
    }
  };

  return (
    <div className="flex flex-col items-start gap-1 select-none pointer-events-auto">
      {/* Header Pill / Toggle */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/90 border border-amber-600/70 text-amber-300 text-xs font-serif font-bold shadow-lg backdrop-blur hover:bg-slate-900 hover:border-amber-400 transition-colors cursor-pointer"
        title="Toggle Hero Roster"
      >
        <Swords className="w-3.5 h-3.5 text-amber-400" />
        <span>Heroes ({activeHeroes.length})</span>
        {fallenHeroCorpses.length > 0 && (
          <span className="flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-rose-950/90 border border-rose-700/80 text-[10px] text-rose-300">
            <Skull className="w-2.5 h-2.5" /> {fallenHeroCorpses.length} fallen
          </span>
        )}
        {isExpanded ? (
          <ChevronUp className="w-3 h-3 text-slate-400" />
        ) : (
          <ChevronDown className="w-3 h-3 text-slate-400" />
        )}
      </button>

      {/* Hero Portals Strip */}
      {isExpanded && (
        <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-950/85 border border-amber-800/60 shadow-xl backdrop-blur-md max-w-[calc(100vw-2rem)] overflow-x-auto scrollbar-none">
          {activeHeroes.map((hero) => {
            const classDef = HERO_CLASS_DEFINITIONS[hero.heroClass];
            const color = classDef.color || '#3b82f6';
            const hpPercent = Math.max(0, Math.min(100, (hero.hp / (hero.maxHp || 100)) * 100));
            const isSelected = selectedHeroId === hero.id;
            const statusDotColor = getStateColor(hero.state);

            return (
              <button
                key={hero.id}
                onClick={() => onSelectHero(hero)}
                className={`group relative flex flex-col items-center p-1 rounded-xl transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-amber-950/70 ring-2 ring-amber-400 scale-105'
                    : 'bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-600'
                }`}
                title={`${hero.name} (Lvl ${hero.level} ${classDef.name})\nHP: ${Math.round(hero.hp)}/${hero.maxHp}\nState: ${hero.state.replace('_', ' ')}\n${hero.currentThought ? `"${hero.currentThought}"` : ''}`}
              >
                {/* Hero Avatar Badge */}
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center font-serif font-black text-sm text-white relative shadow-inner overflow-hidden"
                  style={{ backgroundColor: color }}
                >
                  <span>{hero.name.charAt(0)}</span>

                  {/* Level Tag Overlay */}
                  <span className="absolute bottom-0 right-0 bg-black/80 px-1 py-0.2 rounded-tl text-[9px] font-mono font-bold text-amber-300">
                    L{hero.level}
                  </span>

                  {/* Status Indicator Dot */}
                  <span
                    className="absolute top-1 right-1 w-2 h-2 rounded-full border border-black"
                    style={{ backgroundColor: statusDotColor }}
                  />
                </div>

                {/* Slim Health Bar */}
                <div className="w-9 h-1.5 bg-slate-950 rounded-full mt-1 overflow-hidden border border-slate-700/60">
                  <div
                    className={`h-full transition-all duration-200 ${
                      hpPercent > 50
                        ? 'bg-emerald-500'
                        : hpPercent > 25
                        ? 'bg-yellow-500'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${hpPercent}%` }}
                  />
                </div>
              </button>
            );
          })}

          {/* Fallen Heroes Tombstone Badges */}
          {fallenHeroCorpses.map((corpse) => {
            const fallenHero = corpse.heroData!;
            const classDef = HERO_CLASS_DEFINITIONS[fallenHero.heroClass];
            const isSelected = selectedCorpseId === corpse.id;

            return (
              <button
                key={corpse.id}
                onClick={() => onSelectCorpse && onSelectCorpse(corpse)}
                className={`group relative flex flex-col items-center p-1 rounded-xl transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-rose-950/90 ring-2 ring-amber-400 scale-105'
                    : 'bg-slate-950/90 hover:bg-slate-900 border border-rose-900/60 hover:border-amber-600/80 opacity-85 hover:opacity-100'
                }`}
                title={`[FALLEN] Tomb of ${fallenHero.name} (Lvl ${fallenHero.level} ${classDef.name})\nClick to inspect grave and resurrect!`}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center font-serif font-black text-sm text-slate-300 relative shadow-inner overflow-hidden border border-rose-800/80"
                  style={{ backgroundColor: `${classDef.accentColor}66` }}
                >
                  <Skull className="w-4 h-4 text-amber-300" />
                  <span className="absolute bottom-0 right-0 bg-black/90 px-1 py-0.2 rounded-tl text-[8px] font-mono font-bold text-rose-300">
                    L{fallenHero.level}
                  </span>
                </div>
                <div className="w-9 text-[8px] font-bold text-amber-400 text-center truncate mt-0.5">
                  Grave
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

