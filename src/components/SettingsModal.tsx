'use client';

import React, { useState, useEffect } from 'react';
import { 
  getGameSettings, 
  saveGameSettings, 
  subscribeGameSettings,
  GameSettings,
  DEFAULT_SETTINGS 
} from '../game/settings';
import { 
  Settings, 
  X, 
  Volume2, 
  Music, 
  Cpu, 
  Sparkles, 
  RotateCcw, 
  Keyboard, 
  Check, 
  Crown
} from 'lucide-react';
import { audioManager } from '../game/engine/Audio';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<GameSettings>(() => getGameSettings());
  const [activeTab, setActiveTab] = useState<'gameplay' | 'audio' | 'controls'>('gameplay');

  useEffect(() => {
    return subscribeGameSettings((newSettings) => {
      setSettings(newSettings);
    });
  }, []);

  if (!isOpen) return null;

  const handleToggle = (key: keyof GameSettings) => {
    const updated = saveGameSettings({ [key]: !settings[key] });
    setSettings(updated);
    audioManager.playClick();
  };

  const handleVolumeChange = (key: 'musicVolume' | 'soundVolume', value: number) => {
    const updated = saveGameSettings({ [key]: value });
    setSettings(updated);
  };

  const handleReset = () => {
    const updated = saveGameSettings(DEFAULT_SETTINGS);
    setSettings(updated);
    audioManager.playClick();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-950 border-2 border-amber-600/90 rounded-2xl max-w-xl w-full text-slate-100 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
        {/* Background Royal Watermark */}
        <div className="absolute -right-8 -bottom-8 opacity-5 pointer-events-none text-amber-500">
          <Crown className="w-80 h-80" />
        </div>

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-amber-900/60 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/80 flex items-center justify-center text-amber-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif font-black text-amber-300 text-lg tracking-wide">
                Kingdom Settings
              </h2>
              <p className="text-[11px] text-slate-400">
                Configure realm simulation, audio muting, and sovereign controls
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              audioManager.playClick();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-6 pt-2 gap-2">
          <button
            onClick={() => {
              setActiveTab('gameplay');
              audioManager.playClick();
            }}
            className={`pb-2.5 px-3 text-xs font-serif font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'gameplay'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" /> Simulation & System
          </button>
          <button
            onClick={() => {
              setActiveTab('audio');
              audioManager.playClick();
            }}
            className={`pb-2.5 px-3 text-xs font-serif font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'audio'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" /> Audio & Minstrel
          </button>
          <button
            onClick={() => {
              setActiveTab('controls');
              audioManager.playClick();
            }}
            className={`pb-2.5 px-3 text-xs font-serif font-bold transition-all border-b-2 flex items-center gap-1.5 ${
              activeTab === 'controls'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Keyboard className="w-3.5 h-3.5" /> Controls Guide
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'gameplay' && (
            <div className="space-y-4">
              {/* Background Simulation Toggle */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-amber-800/60 transition-colors flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-serif font-bold text-amber-200 text-sm">
                      Continue Simulation in Background
                    </span>
                    <span className="text-[10px] uppercase tracking-wider font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      Default: Off
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Allow the kingdom to continue advancing (hero AI, tax collection, monster spawns, building construction) when this browser tab is minimized or unfocused.
                  </p>
                  <p className="text-[11px] text-amber-400/80 italic">
                    When disabled (recommended), the game safely freezes until you return to this tab.
                  </p>
                </div>

                <button
                  onClick={() => handleToggle('runInBackground')}
                  className={`w-12 h-6 rounded-full transition-colors relative shrink-0 p-0.5 focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    settings.runInBackground ? 'bg-amber-600' : 'bg-slate-700'
                  }`}
                  role="switch"
                  aria-checked={settings.runInBackground}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      settings.runInBackground ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Status Banner */}
              <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-800/40 text-[11px] text-amber-300 flex items-start gap-2">
                <Sparkles className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <span className="font-bold">Pro Tip:</span> If you want your kingdom to progress while multitasking or reading, turn on background simulation. Keep an eye on taxes and hero safety!
                </div>
              </div>
            </div>
          )}

          {activeTab === 'audio' && (
            <div className="space-y-4">
              {/* Mute on Blur Toggle */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-amber-800/60 transition-colors flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-serif font-bold text-amber-200 text-sm">
                      Mute Audio when Tab is Unfocused
                    </span>
                    <span className="text-[10px] uppercase tracking-wider font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                      Default: On
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Silences royal background music and kingdom sound effects automatically whenever you switch tabs or minimize the window.
                  </p>
                </div>

                <button
                  onClick={() => handleToggle('muteOnBlur')}
                  className={`w-12 h-6 rounded-full transition-colors relative shrink-0 p-0.5 focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                    settings.muteOnBlur ? 'bg-amber-600' : 'bg-slate-700'
                  }`}
                  role="switch"
                  aria-checked={settings.muteOnBlur}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white transition-transform ${
                      settings.muteOnBlur ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Music Volume Slider */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-serif font-bold text-amber-200 flex items-center gap-1.5">
                    <Music className="w-4 h-4 text-amber-400" /> Royal Minstrel Music
                  </span>
                  <span className="font-mono text-amber-300 font-bold">
                    {Math.round(settings.musicVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.musicVolume}
                  onChange={(e) => handleVolumeChange('musicVolume', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              {/* Sound Effects Volume Slider */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-serif font-bold text-amber-200 flex items-center gap-1.5">
                    <Volume2 className="w-4 h-4 text-amber-400" /> Sound Effects & Voices
                  </span>
                  <span className="font-mono text-amber-300 font-bold">
                    {Math.round(settings.soundVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.soundVolume}
                  onChange={(e) => handleVolumeChange('soundVolume', parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>
            </div>
          )}

          {activeTab === 'controls' && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <div className="font-serif font-bold text-amber-300">Camera Pan</div>
                  <div className="text-slate-400 font-mono text-[11px]">WASD / Arrow Keys / Right-Click Drag</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <div className="font-serif font-bold text-amber-300">Camera Rotate</div>
                  <div className="text-slate-400 font-mono text-[11px]">Q & E Keys / Middle-Click Drag</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <div className="font-serif font-bold text-amber-300">Zoom View</div>
                  <div className="text-slate-400 font-mono text-[11px]">Mouse Scroll Wheel</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <div className="font-serif font-bold text-amber-300">Simulation Speed</div>
                  <div className="text-slate-400 font-mono text-[11px]">Space (Pause), 1x, 2x, 4x</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <div className="font-serif font-bold text-amber-300">Save Kingdom</div>
                  <div className="text-slate-400 font-mono text-[11px]">Ctrl + S</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1">
                  <div className="font-serif font-bold text-amber-300">Load Kingdom</div>
                  <div className="text-slate-400 font-mono text-[11px]">Ctrl + L</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-950">
          <button
            onClick={handleReset}
            className="text-xs text-slate-400 hover:text-amber-300 flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Defaults
          </button>
          <button
            onClick={() => {
              audioManager.playClick();
              onClose();
            }}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg transition-all font-serif"
          >
            <Check className="w-4 h-4" /> Save & Close
          </button>
        </div>
      </div>
    </div>
  );
};
