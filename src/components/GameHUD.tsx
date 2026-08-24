'use client';

import React, { useState } from 'react';
import { GameState, NotificationItem, SaveMeta } from '../game/types';
import { audioManager } from '../game/engine/Audio';
import { musicManager } from '../game/engine/MusicManager';
import { MusicPlayer } from './MusicPlayer';
import { 
  Crown, 
  Coins, 
  Sparkles, 
  Sun, 
  Moon, 
  Sunset, 
  Sunrise, 
  Play, 
  Pause, 
  FastForward, 
  Volume2, 
  VolumeX, 
  Bell, 
  HelpCircle,
  ShieldAlert,
  Scroll,
  Info,
  Save,
  FolderOpen
} from 'lucide-react';

interface GameHUDProps {
  state: GameState;
  onSetGameSpeed: (speed: number) => void;
  onTogglePause: () => void;
  onSelectScenarioModal: () => void;
  onShowAdvisorModal: () => void;
  onSaveGame: () => void;
  onLoadGame: () => void;
  saveMeta: SaveMeta | null;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  state,
  onSetGameSpeed,
  onTogglePause,
  onSelectScenarioModal,
  onShowAdvisorModal,
  onSaveGame,
  onLoadGame,
  saveMeta
}) => {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showLog, setShowLog] = useState(false);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    audioManager.enabled = next;
    musicManager.setMasterMuted(!next);
  };

  const dayIcons = {
    day: Sun,
    dusk: Sunset,
    night: Moon,
    dawn: Sunrise
  };
  const DayIcon = dayIcons[state.dayPhase];

  const manaPercent = Math.min(100, (state.mana / state.maxMana) * 100);

  return (
    <div className="w-full select-none">
      {/* Top Banner Bar */}
      <div className="bg-slate-950/95 border-b-2 border-amber-600/80 px-4 py-2 flex items-center justify-between shadow-2xl backdrop-blur-md">
        {/* Left: Crown & Scenario */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-600 to-yellow-500 border border-amber-300 flex items-center justify-center text-slate-950 shadow-inner">
            <Crown className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif font-black text-amber-300 text-sm tracking-wide uppercase">
                {state.scenario.name}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-950 border border-amber-700/60 text-amber-400">
                {state.scenario.difficulty}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium line-clamp-1">
              Objective: {state.scenario.objectiveText}
            </p>
          </div>
        </div>

        {/* Center: Treasury & Mana */}
        <div className="flex items-center gap-6 bg-slate-900/90 px-5 py-1.5 rounded-xl border border-amber-700/50 shadow-inner">
          {/* Gold */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-400/80 flex items-center justify-center text-amber-400">
              <Coins className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Treasury</div>
              <div className="font-mono font-black text-amber-300 text-base leading-none">
                {Math.floor(state.treasuryGold)}g
              </div>
            </div>
          </div>

          <div className="w-px h-7 bg-slate-800" />

          {/* Mana */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-purple-500/20 border border-purple-400/80 flex items-center justify-center text-purple-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Sovereign Mana</div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-black text-purple-300 text-base leading-none">
                  {Math.floor(state.mana)}
                </span>
                <span className="text-[10px] text-slate-500">/ {state.maxMana}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Time, Speed & Settings */}
        <div className="flex items-center gap-3">
          {/* Day / Night Dial */}
          <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
            <DayIcon className="w-4 h-4 text-amber-400" />
            <div>
              <div className="font-bold text-slate-200 uppercase text-[10px]">
                Day {state.stats.daysPassed}
              </div>
              <div className="text-[10px] text-slate-400 capitalize">
                {state.dayPhase}
              </div>
            </div>
          </div>

          {/* Speed Controls */}
          <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-800">
            <button
              onClick={onTogglePause}
              title="Pause Game (Space)"
              className={`p-1.5 rounded transition-colors ${
                state.isPaused
                  ? 'bg-amber-600 text-slate-950 font-bold'
                  : 'hover:bg-slate-800 text-slate-300'
              }`}
            >
              {state.isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4" />}
            </button>

            {[1, 2, 4].map((spd) => (
              <button
                key={spd}
                onClick={() => onSetGameSpeed(spd)}
                className={`px-2 py-1 text-xs font-mono font-bold rounded transition-colors ${
                  state.gameSpeed === spd && !state.isPaused
                    ? 'bg-amber-600 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          {/* Music Player */}
          <MusicPlayer />

          {/* Save / Load */}
          <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-800">
            <button
              onClick={onSaveGame}
              disabled={state.isGameOver}
              title="Save Kingdom (Ctrl+S)"
              className="p-1.5 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 text-slate-300"
            >
              <Save className="w-4 h-4" />
            </button>
            <button
              onClick={onLoadGame}
              disabled={!saveMeta}
              title={saveMeta
                ? `Load Kingdom (Ctrl+L) — ${saveMeta.scenarioName}, Day ${saveMeta.day}, ${Math.round(saveMeta.treasuryGold)}g — saved ${new Date(saveMeta.savedAt).toLocaleTimeString()}`
                : 'No saved kingdom found'}
              className="p-1.5 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 text-slate-300"
            >
              <FolderOpen className="w-4 h-4" />
            </button>
          </div>

          {/* Sound & Notifications */}
          <button
            onClick={toggleSound}
            title={soundEnabled ? 'Mute Sound' : 'Enable Sound'}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 transition-colors"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          <button
            onClick={() => setShowLog(!showLog)}
            title="Royal Advisor Chronicle"
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-amber-400 relative transition-colors"
          >
            <Scroll className="w-4 h-4" />
            {state.notifications.length > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse" />
            )}
          </button>

          <button
            onClick={onSelectScenarioModal}
            className="px-2.5 py-1.5 text-xs font-bold font-serif uppercase tracking-wider rounded-lg bg-amber-950/80 border border-amber-700/60 hover:bg-amber-800/80 text-amber-300 transition-colors"
          >
            Scenarios
          </button>
        </div>
      </div>

      {/* Latest Advisor Announcement Banner */}
      {state.notifications[0] && (
        <div className="max-w-xl mx-auto mt-2 pointer-events-auto">
          <div className="bg-slate-950/90 border border-amber-600/70 rounded-full px-4 py-1 flex items-center justify-between text-xs text-slate-200 shadow-xl backdrop-blur">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span className="font-bold text-amber-300 font-serif">Royal Advisor:</span>
              <span className="text-slate-300 text-[11px] line-clamp-1">{state.notifications[0].message}</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono ml-2">Just now</span>
          </div>
        </div>
      )}

      {/* Advisor Notification Drawer Modal */}
      {showLog && (
        <div className="fixed top-16 right-4 w-96 max-h-[70vh] bg-slate-950/95 border-2 border-amber-600/80 rounded-xl p-4 shadow-2xl backdrop-blur-md z-50 overflow-y-auto">
          <div className="flex justify-between items-center border-b border-amber-900/60 pb-2 mb-3">
            <h3 className="font-serif font-bold text-amber-300 text-sm flex items-center gap-2">
              <Scroll className="w-4 h-4" /> Kingdom Chronicle & Advisor Log
            </h3>
            <button
              onClick={() => setShowLog(false)}
              className="text-xs text-slate-400 hover:text-slate-200 px-2 py-0.5 rounded bg-slate-900"
            >
              Close
            </button>
          </div>
          <div className="space-y-2">
            {state.notifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-2.5 rounded-lg border text-xs ${
                  notif.type === 'danger'
                    ? 'bg-rose-950/40 border-rose-800 text-rose-200'
                    : notif.type === 'success'
                    ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
                    : notif.type === 'quest'
                    ? 'bg-amber-950/40 border-amber-700 text-amber-200'
                    : 'bg-slate-900/80 border-slate-800 text-slate-300'
                }`}
              >
                <div className="font-bold text-[11px] mb-0.5">{notif.title}</div>
                <div className="text-[11px] leading-snug">{notif.message}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
