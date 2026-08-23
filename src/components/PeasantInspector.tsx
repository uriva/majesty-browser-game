'use client';

import React from 'react';
import { Building, Peasant } from '../game/types';
import { Hammer, Heart, Locate, X, Footprints, Wrench } from 'lucide-react';

interface PeasantInspectorProps {
  peasant: Peasant;
  buildings: Building[];
  onClose: () => void;
  onTrackPeasant: (p: Peasant) => void;
}

export const PeasantInspector: React.FC<PeasantInspectorProps> = ({
  peasant,
  buildings,
  onClose,
  onTrackPeasant
}) => {
  const hpPercent = Math.max(0, Math.min(100, (peasant.hp / peasant.maxHp) * 100));
  const targetBuilding = buildings.find(b => b.id === peasant.targetBuildingId);

  return (
    <div className="w-80 bg-slate-950/95 border-2 border-amber-600/90 rounded-xl p-4 text-slate-100 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-200">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-amber-800/60 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-amber-950 border-2 border-amber-400/80 flex items-center justify-center font-bold text-xl shadow-inner text-amber-300">
            <Hammer className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold font-serif text-amber-200 text-base leading-tight">
              {peasant.name}
            </h3>
            <p className="text-xs text-amber-400/90 font-medium">
              Royal Laborer & Craftsman
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onTrackPeasant(peasant)}
            title="Track Camera"
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

      {/* Health Bar */}
      <div className="my-3 space-y-1">
        <div className="flex justify-between text-xs font-semibold">
          <span className="text-rose-400 flex items-center gap-1">
            <Heart className="w-3.5 h-3.5 fill-rose-500/30" /> Vitality
          </span>
          <span className="text-slate-300 font-mono">
            {Math.round(peasant.hp)} / {peasant.maxHp}
          </span>
        </div>
        <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-rose-950">
          <div
            className="bg-gradient-to-r from-emerald-600 to-green-400 h-full transition-all duration-300"
            style={{ width: `${hpPercent}%` }}
          />
        </div>
      </div>

      {/* Current Task / Duty */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5 text-xs mb-3">
        <div className="text-[10px] text-amber-400 uppercase font-semibold flex items-center gap-1 mb-1">
          <Wrench className="w-3.5 h-3.5" /> Current Duty:
        </div>
        <div className="italic text-slate-200 text-[11px]">
          {peasant.state === 'walking_to_site'
            ? `Walking to work at ${targetBuilding?.name || 'construction site'}`
            : (peasant.state === 'hammering_construction'
            ? `Hammering & building ${targetBuilding?.name || 'structure'}!`
            : (peasant.state === 'repairing_building'
            ? `Repairing damaged masonry at ${targetBuilding?.name}`
            : `Resting at the Palace, awaiting new royal construction orders.`))}
        </div>
      </div>

      <div className="bg-amber-950/30 border border-amber-900/50 rounded-lg p-2 text-[11px] text-slate-300 leading-snug">
        Peasants physically construct all placed foundations and repair damaged structures. Protect them from roaming monsters!
      </div>
    </div>
  );
};
