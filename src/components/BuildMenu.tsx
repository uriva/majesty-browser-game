'use client';

import React, { useState } from 'react';
import { BUILDING_DEFINITIONS } from '../game/constants';
import { Building, BuildingType } from '../game/types';
import { audioManager } from '../game/engine/Audio';
import { 
  Shield, 
  Target, 
  Flame, 
  Sparkles, 
  Hammer, 
  ShoppingBag, 
  Beer, 
  Crown, 
  Crosshair,
  Sun,
  X,
  Lock
} from 'lucide-react';

interface BuildMenuProps {
  treasuryGold: number;
  buildings: Building[];
  activeBuildingType: BuildingType | null;
  onSelectBuilding: (type: BuildingType | null) => void;
}

export const BuildMenu: React.FC<BuildMenuProps> = ({
  treasuryGold,
  buildings,
  activeBuildingType,
  onSelectBuilding
}) => {
  const [activeCategory, setActiveCategory] = useState<'guilds' | 'economy' | 'defense'>('guilds');
  const [shakingType, setShakingType] = useState<string | null>(null);

  const palace = buildings.find(b => b.type === 'palace' && b.hp > 0);
  const palaceLevel = palace?.level || 1;

  const categories = {
    guilds: [
      { type: 'warrior_guild' as BuildingType, icon: Shield },
      { type: 'ranger_guild' as BuildingType, icon: Target },
      { type: 'rogue_guild' as BuildingType, icon: Sparkles },
      { type: 'wizard_tower' as BuildingType, icon: Flame },
      { type: 'cleric_temple' as BuildingType, icon: Sun },
      { type: 'dwarf_settlement' as BuildingType, icon: Hammer }
    ],
    economy: [
      { type: 'marketplace' as BuildingType, icon: ShoppingBag },
      { type: 'blacksmith' as BuildingType, icon: Hammer },
      { type: 'royal_inn' as BuildingType, icon: Beer }
    ],
    defense: [
      { type: 'guard_tower' as BuildingType, icon: Crosshair },
      { type: 'statue_king' as BuildingType, icon: Crown }
    ]
  };

  const handleButtonClick = (type: BuildingType, isUnlocked: boolean, canAfford: boolean, isSelected: boolean) => {
    if (!isUnlocked) return;

    if (!canAfford && !isSelected) {
      setShakingType(type);
      setTimeout(() => setShakingType(null), 450);
      audioManager.playInsufficientGoldSound();
      return;
    }

    audioManager.playClick();
    onSelectBuilding(isSelected ? null : type);
  };

  return (
    <div className="bg-slate-950/95 border-2 border-amber-600/80 rounded-xl p-2.5 shadow-2xl backdrop-blur max-w-md w-full">
      {/* Category Tabs */}
      <div className="flex items-center justify-between border-b border-amber-900/60 pb-2 mb-2">
        <div className="flex gap-1.5">
          {(['guilds', 'economy', 'defense'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-md transition-all font-serif ${
                activeCategory === cat
                  ? 'bg-amber-600 text-slate-950 shadow'
                  : 'bg-slate-900 text-slate-400 hover:text-amber-200 hover:bg-slate-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        {activeBuildingType && (
          <button
            onClick={() => onSelectBuilding(null)}
            className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 font-semibold px-2 py-0.5 bg-rose-950/50 border border-rose-800/60 rounded"
          >
            <X className="w-3 h-3" /> Cancel Placement
          </button>
        )}
      </div>

      {/* Building Buttons Grid */}
      <div className="grid grid-cols-3 gap-2">
        {categories[activeCategory].map(({ type, icon: Icon }) => {
          const def = BUILDING_DEFINITIONS[type];
          
          // Check Requirements
          const palaceReqMet = !def.requiresPalaceLevel || palaceLevel >= def.requiresPalaceLevel;
          const buildingReqMet = !def.requiresBuilding || buildings.some(b => b.type === def.requiresBuilding && !b.isConstructing && b.hp > 0);
          const isUnlocked = palaceReqMet && buildingReqMet;

          const canAfford = treasuryGold >= def.cost;
          const isSelected = activeBuildingType === type;
          const isShaking = shakingType === type;

          let lockReason = '';
          if (!palaceReqMet) {
            lockReason = `Palace Lv.${def.requiresPalaceLevel}`;
          } else if (!buildingReqMet && def.requiresBuilding) {
            lockReason = `Req: ${BUILDING_DEFINITIONS[def.requiresBuilding].name.split(' ')[1] || 'Building'}`;
          }

          return (
            <button
              key={type}
              disabled={!isUnlocked}
              onClick={() => handleButtonClick(type, isUnlocked, canAfford, isSelected)}
              title={!isUnlocked ? lockReason : !canAfford ? `Insufficient Gold (${def.cost}g required)` : def.description}
              className={`p-2 rounded-lg border flex flex-col items-center text-center transition-all relative cursor-pointer ${
                isShaking
                  ? 'animate-error-shake'
                  : isSelected
                  ? 'bg-amber-500 border-amber-300 text-slate-950 ring-2 ring-amber-400 shadow-lg'
                  : !isUnlocked
                  ? 'bg-slate-950/60 border-slate-900 text-slate-600 opacity-60 cursor-not-allowed'
                  : canAfford
                  ? 'bg-slate-900/90 border-amber-800/60 text-slate-200 hover:bg-amber-950/60 hover:border-amber-500 shadow-sm active:scale-95'
                  : 'bg-slate-900/60 border-rose-900/50 text-slate-400 hover:bg-rose-950/40 hover:border-rose-700/80 active:scale-95'
              }`}
            >
              {!isUnlocked ? (
                <Lock className="w-4 h-4 mb-1 text-slate-500" />
              ) : (
                <Icon className={`w-5 h-5 mb-1 ${canAfford ? 'text-amber-400' : 'text-amber-500/70'}`} />
              )}

              <div className="font-bold text-[11px] leading-tight line-clamp-1">
                {def.name}
              </div>

              {!isUnlocked ? (
                <div className="text-[9px] font-bold text-rose-400/90 mt-0.5 font-mono truncate max-w-full">
                  {lockReason}
                </div>
              ) : (
                <div className={`text-[10px] font-mono font-bold mt-0.5 ${canAfford ? 'text-amber-300' : 'text-rose-400'}`}>
                  {def.cost}g
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
