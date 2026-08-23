'use client';

import React from 'react';
import { Building, TaxCollector } from '../game/types';
import { Coins, Heart, Shield, Locate, X, ShieldAlert, Footprints } from 'lucide-react';

interface TaxCollectorInspectorProps {
  taxCollector: TaxCollector;
  buildings: Building[];
  onClose: () => void;
  onTrackTaxCollector: (tc: TaxCollector) => void;
  onProtectTaxCollector: (tc: TaxCollector) => void;
}

export const TaxCollectorInspector: React.FC<TaxCollectorInspectorProps> = ({
  taxCollector,
  buildings,
  onClose,
  onTrackTaxCollector,
  onProtectTaxCollector
}) => {
  const hpPercent = Math.max(0, Math.min(100, (taxCollector.hp / taxCollector.maxHp) * 100));
  const targetBuilding = buildings.find(b => b.id === taxCollector.targetBuildingId);

  return (
    <div className="w-80 bg-slate-950/95 border-2 border-purple-600/90 rounded-xl p-4 text-slate-100 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-200">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-purple-900/60 pb-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-purple-950 border-2 border-amber-400/80 flex items-center justify-center font-bold text-xl shadow-inner text-amber-300 font-serif">
            $
          </div>
          <div>
            <h3 className="font-bold font-serif text-amber-200 text-base leading-tight">
              {taxCollector.name}
            </h3>
            <p className="text-xs text-purple-300 font-medium">
              Crown Revenue Officer
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onTrackTaxCollector(taxCollector)}
            title="Track Camera"
            className="p-1.5 rounded-lg bg-purple-950/60 border border-purple-700/50 hover:bg-purple-800/60 text-purple-300 transition-colors"
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
            {Math.round(taxCollector.hp)} / {taxCollector.maxHp}
          </span>
        </div>
        <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-rose-950">
          <div
            className="bg-gradient-to-r from-emerald-600 to-green-400 h-full transition-all duration-300"
            style={{ width: `${hpPercent}%` }}
          />
        </div>
      </div>

      {/* Gold Carried in Sack */}
      <div className="bg-amber-950/40 border border-amber-800/60 rounded-xl p-3 mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-400">
            <Coins className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 font-bold uppercase">Gold in Sack</div>
            <div className="text-base font-black font-mono text-amber-300 leading-none">
              {taxCollector.goldCarried}g
            </div>
          </div>
        </div>
        <div className="text-right text-[11px] text-slate-400">
          <div className="font-semibold text-slate-300">Pace: 34 px/s</div>
          <div>Slow & Steady</div>
        </div>
      </div>

      {/* Current Assignment / Duty */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5 text-xs mb-3">
        <div className="text-[10px] text-purple-400 uppercase font-semibold flex items-center gap-1 mb-1">
          <Footprints className="w-3.5 h-3.5" /> Current Duty:
        </div>
        <div className="italic text-slate-200 text-[11px]">
          {taxCollector.state === 'seeking_building'
            ? `Walking to collect taxes from ${targetBuilding?.name || 'shops'}`
            : `Returning ${taxCollector.goldCarried}g safely to Palace Treasury`}
        </div>
      </div>

      {/* Place Defend Flag Action */}
      <button
        onClick={() => onProtectTaxCollector(taxCollector)}
        className="w-full py-2 px-3 bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-slate-950 font-bold text-xs rounded-lg shadow-md flex items-center justify-center gap-1.5 transition-all font-serif"
      >
        <ShieldAlert className="w-4 h-4" /> Place Defend Bounty on Taxman
      </button>
    </div>
  );
};
