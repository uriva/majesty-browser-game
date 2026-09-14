'use client';

import React, { useState, useRef } from 'react';
import { GameState, SaveMeta } from '../game/types';
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
  Volume2, 
  VolumeX, 
  Scroll, 
  Save, 
  FolderOpen, 
  Settings, 
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Locate
} from 'lucide-react';

interface GameHUDProps {
  state: GameState;
  onSetGameSpeed: (speed: number) => void;
  onTogglePause: () => void;
  onSelectScenarioModal: () => void;
  onShowAdvisorModal: () => void;
  onSaveGame: () => void;
  onLoadGame: () => void;
  onOpenSaveModal?: () => void;
  onOpenLoadModal?: () => void;
  onOpenSaveLoadModal?: () => void;
  onOpenSettingsModal?: () => void;
  onPanTo?: (x: number, y: number) => void;
  saveMeta: SaveMeta | null;
  isChronicleOpen?: boolean;
  onToggleChronicle?: () => void;
  isAnyDialogOpen?: boolean;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  state,
  onSetGameSpeed,
  onTogglePause,
  onSelectScenarioModal,
  onShowAdvisorModal,
  onSaveGame,
  onLoadGame,
  onOpenSaveModal,
  onOpenLoadModal,
  onOpenSaveLoadModal,
  onOpenSettingsModal,
  saveMeta,
  onPanTo,
  isChronicleOpen,
  onToggleChronicle,
  isAnyDialogOpen
}) => {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showLogInternal, setShowLogInternal] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [notifIndex, setNotifIndex] = useState<number>(0);
  const latestSeenIdRef = useRef<string | null>(null);

  const activeNotifs = state.notifications.filter(n => !dismissedIds.has(n.id));

  // Automatically show newest notification when a fresh one arrives
  const newestNotif = activeNotifs[0];
  if (newestNotif && newestNotif.id !== latestSeenIdRef.current) {
    latestSeenIdRef.current = newestNotif.id;
    if (notifIndex !== 0) {
      setNotifIndex(0);
    }
  }

  const safeIndex = Math.min(notifIndex, Math.max(0, activeNotifs.length - 1));
  const currentNotif = activeNotifs[safeIndex];

  const formatTimeAgo = (timestamp?: number) => {
    if (!timestamp) return 'Just now';
    const sec = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
    if (sec < 10) return 'Just now';
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    return `${Math.floor(min / 60)}h ago`;
  };

  const showLog = isChronicleOpen !== undefined ? isChronicleOpen : showLogInternal;
  const handleToggleLog = onToggleChronicle || (() => setShowLogInternal(prev => !prev));
  const [justSaved, setJustSaved] = useState(false);

  const handleQuickSave = () => {
    if (state.isGameOver) return;
    onSaveGame();
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2400);
  };

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
              onClick={() => {
                if (!isAnyDialogOpen) onTogglePause();
              }}
              disabled={isAnyDialogOpen}
              title={isAnyDialogOpen ? 'Simulation paused while royal dialog is open' : (state.isPaused ? 'Resume Game (Space)' : 'Pause Game (Space)')}
              className={`p-1.5 rounded transition-colors ${
                state.isPaused
                  ? 'bg-amber-600 text-slate-950 font-bold'
                  : 'hover:bg-slate-800 text-slate-300'
              } ${isAnyDialogOpen ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {state.isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4" />}
            </button>

            {[1, 2, 4].map((spd) => (
              <button
                key={spd}
                disabled={isAnyDialogOpen}
                onClick={() => {
                  if (!isAnyDialogOpen) onSetGameSpeed(spd);
                }}
                className={`px-2 py-1 text-xs font-mono font-bold rounded transition-colors ${
                  state.gameSpeed === spd && !state.isPaused
                    ? 'bg-amber-600 text-slate-950'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                } ${isAnyDialogOpen ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                {spd}x
              </button>
            ))}
          </div>

          {/* Music Player */}
          <MusicPlayer />

          {/* Save / Load Royal Archives */}
          <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-800">
            <button
              onClick={handleQuickSave}
              disabled={state.isGameOver}
              title={justSaved ? 'Kingdom Saved! ✓' : 'Quick Save (Ctrl+S)'}
              className={`p-1.5 rounded transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                justSaved
                  ? 'bg-emerald-950/90 border border-emerald-500 text-emerald-300 scale-105'
                  : 'hover:bg-slate-800 text-slate-300 hover:text-amber-400'
              }`}
            >
              {justSaved ? <Check className="w-4 h-4 text-emerald-400 animate-pulse" /> : <Save className="w-4 h-4" />}
            </button>
            <button
              onClick={() => {
                if (onOpenLoadModal) {
                  onOpenLoadModal();
                } else if (onOpenSaveLoadModal) {
                  onOpenSaveLoadModal();
                } else {
                  onLoadGame();
                }
              }}
              title={saveMeta
                ? `Royal Archives — ${saveMeta.scenarioName}, Day ${saveMeta.day}, ${Math.round(saveMeta.treasuryGold)}g (Ctrl+L)`
                : 'Royal Archives / Load Game (Ctrl+L)'}
              className="p-1.5 rounded transition-colors hover:bg-slate-800 text-slate-300 hover:text-amber-400"
            >
              <FolderOpen className="w-4 h-4" />
            </button>
          </div>

          {/* Sound & Settings */}
          <button
            onClick={toggleSound}
            title={soundEnabled ? 'Mute Sound' : 'Enable Sound'}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 transition-colors"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          {onOpenSettingsModal && (
            <button
              onClick={onOpenSettingsModal}
              title="Kingdom Settings (Background Simulation, Audio, Controls)"
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-amber-400 transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={handleToggleLog}
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
      {currentNotif && (
        <div className="max-w-2xl mx-auto mt-2 pointer-events-auto px-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div
            onClick={handleToggleLog}
            className={`group cursor-pointer rounded-2xl px-4 py-2.5 flex items-start justify-between gap-3 text-xs shadow-2xl backdrop-blur-md border transition-all duration-200 ${
              currentNotif.type === 'danger'
                ? 'bg-slate-950/95 border-rose-600/80 text-rose-100 shadow-rose-950/50 hover:border-rose-500'
                : currentNotif.type === 'warning'
                ? 'bg-slate-950/95 border-amber-600/80 text-amber-100 shadow-amber-950/50 hover:border-amber-400'
                : currentNotif.type === 'success'
                ? 'bg-slate-950/95 border-emerald-600/80 text-emerald-100 shadow-emerald-950/50 hover:border-emerald-400'
                : currentNotif.type === 'quest'
                ? 'bg-slate-950/95 border-purple-500/80 text-purple-100 shadow-purple-950/50 hover:border-purple-400'
                : 'bg-slate-950/95 border-amber-600/70 text-slate-200 shadow-amber-950/40 hover:border-amber-400'
            }`}
          >
            <div className="flex items-start gap-2.5 flex-1 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shrink-0 mt-1" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-amber-300 font-serif tracking-wide text-xs">Royal Advisor:</span>
                  <span className="font-bold text-amber-200 text-xs font-serif leading-tight">
                    {currentNotif.title}
                  </span>
                </div>
                <p className="text-slate-200 text-xs leading-relaxed mt-1 break-words font-sans selection:bg-amber-500/30">
                  {currentNotif.message}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
              {activeNotifs.length > 1 && (
                <div className="flex items-center gap-1 bg-slate-900/90 border border-amber-500/40 rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setNotifIndex((safeIndex - 1 + activeNotifs.length) % activeNotifs.length);
                    }}
                    className="p-1 rounded text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Previous message"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] font-mono font-bold text-amber-300 px-1 select-none">
                    {safeIndex + 1}/{activeNotifs.length}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setNotifIndex((safeIndex + 1) % activeNotifs.length);
                    }}
                    className="p-1 rounded text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Next message"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <span className="text-[10px] text-slate-400 font-mono select-none">
                {formatTimeAgo(currentNotif.timestamp)}
              </span>

              {currentNotif.targetPos && onPanTo && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (currentNotif.targetPos) onPanTo(currentNotif.targetPos.x, currentNotif.targetPos.y);
                  }}
                  className="p-1 rounded-lg text-amber-400 hover:text-amber-200 hover:bg-amber-950/60 transition-colors cursor-pointer"
                  title="Focus camera on event"
                >
                  <Locate className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setDismissedIds(prev => new Set(prev).add(currentNotif.id));
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition-colors cursor-pointer"
                title="Dismiss message"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
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
              onClick={handleToggleLog}
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
