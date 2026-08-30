'use client';

import React from 'react';
import { SaveSlotInfo } from '../game/engine/SaveLoad';
import {
  Crown,
  Play,
  FolderOpen,
  Swords,
  Coins,
  Shield,
  Home,
  Clock,
  Sparkles,
  ArrowRight,
  MapPin
} from 'lucide-react';
import { audioManager } from '../game/engine/Audio';

interface WelcomePromptModalProps {
  isOpen: boolean;
  recentSave: SaveSlotInfo | null;
  onLoadRecent: () => void;
  onOpenSaveLoadModal: () => void;
  onStartNewGame: () => void;
  onOpenScenarioModal: () => void;
}

export const WelcomePromptModal: React.FC<WelcomePromptModalProps> = ({
  isOpen,
  recentSave,
  onLoadRecent,
  onOpenSaveLoadModal,
  onStartNewGame,
  onOpenScenarioModal
}) => {
  if (!isOpen || !recentSave || !recentSave.meta) return null;

  const meta = recentSave.meta;
  const timeStr = meta.savedAt ? new Date(meta.savedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }) : 'Recorded in royal archives';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900/95 border-2 border-amber-500/80 rounded-2xl p-6 shadow-2xl max-w-lg w-full text-center relative overflow-hidden">
        {/* Luminous Royal Glow Background */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-40 bg-amber-500/20 blur-3xl rounded-full pointer-events-none" />

        {/* Crown Crest Header */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-amber-400 mb-3 shadow-lg shadow-amber-500/10">
          <Crown className="w-9 h-9 animate-pulse" />
        </div>

        <h2 className="text-2xl font-black font-serif tracking-wide text-amber-200 mb-1">
          Welcome, Your Majesty
        </h2>
        <p className="text-sm text-slate-400 mb-5">
          Royal archives from your previous reign were found. Would you like to resume your kingdom or embark on a new quest?
        </p>

        {/* Recent Save Archive Card */}
        <div className="bg-slate-950/90 border border-amber-500/40 rounded-xl p-4 mb-5 text-left shadow-inner">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold font-serif uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                {recentSave.name}
              </span>
              {meta.label && (
                <span className="text-[10px] bg-amber-950/80 text-amber-300 font-mono font-bold px-2 py-0.5 rounded border border-amber-800/80">
                  {meta.label}
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
              <Clock className="w-3 h-3 text-slate-500" />
              {timeStr}
            </span>
          </div>

          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-base font-bold text-slate-100 flex items-center gap-1.5 font-serif">
                <MapPin className="w-4 h-4 text-emerald-400" />
                {meta.scenarioName}
              </div>
              <div className="text-xs text-amber-400 font-mono font-bold mt-0.5">
                Day {meta.day} of Your Reign
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold font-mono text-amber-300 flex items-center justify-end gap-1">
                <Coins className="w-4 h-4 text-amber-400" />
                {Math.round(meta.treasuryGold)}g
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                Treasury Balance
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-900 text-xs text-slate-300">
            <div className="flex items-center gap-1.5 bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800">
              <Shield className="w-3.5 h-3.5 text-sky-400" />
              <span><strong>{meta.heroCount ?? 0}</strong> Living Heroes</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800">
              <Home className="w-3.5 h-3.5 text-amber-400" />
              <span><strong>{meta.buildingCount ?? 0}</strong> Royal Buildings</span>
            </div>
          </div>
        </div>

        {/* Primary Actions */}
        <div className="space-y-2.5">
          <button
            onClick={() => {
              audioManager.playClick();
              onLoadRecent();
            }}
            className="w-full py-3 px-4 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold text-sm rounded-xl shadow-lg shadow-amber-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer font-serif tracking-wide active:scale-[0.98]"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            Resume Reign (Day {meta.day})
            <ArrowRight className="w-4 h-4 ml-auto" />
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                audioManager.playClick();
                onStartNewGame();
              }}
              className="py-2.5 px-3 bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Swords className="w-3.5 h-3.5 text-rose-400" />
              Start New Game
            </button>

            <button
              onClick={() => {
                audioManager.playClick();
                onOpenSaveLoadModal();
              }}
              className="py-2.5 px-3 bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
            >
              <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
              All Saved Archives
            </button>
          </div>

          <button
            onClick={() => {
              audioManager.playClick();
              onOpenScenarioModal();
            }}
            className="text-xs text-slate-400 hover:text-amber-300 transition-colors pt-1 flex items-center justify-center gap-1 mx-auto"
          >
            <span>Or choose a specific scenario</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
