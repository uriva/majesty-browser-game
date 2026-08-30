'use client';

import React, { useState, useEffect, useRef } from 'react';
import { SaveMeta } from '../game/types';
import {
  listAllSaveSlots,
  saveGameToSlot,
  getRawSaveFromSlot,
  deleteSaveSlot,
  exportSaveToFile,
  importSaveFromFile,
  SaveSlotInfo
} from '../game/engine/SaveLoad';
import { GameEngine } from '../game/engine/GameEngine';
import {
  Save,
  FolderOpen,
  Trash2,
  Download,
  Upload,
  Clock,
  Coins,
  Shield,
  Home,
  CheckCircle2,
  X,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { audioManager } from '../game/engine/Audio';

interface SaveLoadModalProps {
  isOpen: boolean;
  initialTab?: 'save' | 'load';
  engine: GameEngine | null;
  onClose: () => void;
  onLoadSave: (rawSave: string, meta: SaveMeta) => void;
  onActionFeedback: (title: string, message: string, type: 'save' | 'load' | 'delete') => void;
}

export const SaveLoadModal: React.FC<SaveLoadModalProps> = ({
  isOpen,
  initialTab = 'load',
  engine,
  onClose,
  onLoadSave,
  onActionFeedback
}) => {
  const [slots, setSlots] = useState<SaveSlotInfo[]>([]);
  const [activeTab, setActiveTab] = useState<'save' | 'load'>(initialTab);
  const [selectedSlotId, setSelectedSlotId] = useState<string>('slot_1');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshSlots = () => {
    setSlots(listAllSaveSlots());
  };

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      refreshSlots();
      setActionSuccess(null);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const handleSaveToSlot = (slotId: string, customLabel?: string) => {
    if (!engine || engine.state.isGameOver) return;
    audioManager.playClick();
    const meta = saveGameToSlot(engine, slotId, customLabel);
    refreshSlots();
    setActionSuccess(`Archived to ${meta.label || slotId}!`);
    onActionFeedback(
      '👑 Kingdom Archived',
      `${meta.scenarioName} (Day ${meta.day}, ${Math.round(meta.treasuryGold)}g) recorded in royal archives.`,
      'save'
    );
    setTimeout(() => setActionSuccess(null), 3000);
  };

  const handleLoadFromSlot = (slotId: string) => {
    const raw = getRawSaveFromSlot(slotId);
    if (!raw) return;
    audioManager.playClick();
    try {
      const parsed = JSON.parse(raw);
      const meta: SaveMeta = {
        slotId,
        savedAt: parsed.savedAt || 0,
        scenarioId: parsed.scenarioId,
        scenarioName: parsed.scenarioName,
        day: parsed.day,
        treasuryGold: parsed.state?.treasuryGold || 0,
        heroCount: Array.isArray(parsed.state?.heroes) ? parsed.state.heroes.filter((h: { hp?: number }) => (h.hp ?? 0) > 0).length : 0,
        buildingCount: Array.isArray(parsed.state?.buildings) ? parsed.state.buildings.filter((b: { hp?: number }) => (b.hp ?? 0) > 0).length : 0
      };
      onLoadSave(raw, meta);
      onActionFeedback(
        '📜 Kingdom Restored',
        `${meta.scenarioName} — Resuming reign from Day ${meta.day}.`,
        'load'
      );
      onClose();
    } catch (err) {
      console.error('Failed to load slot:', err);
    }
  };

  const handleDeleteSlot = (e: React.MouseEvent, slotId: string) => {
    e.stopPropagation();
    audioManager.playClick();
    if (confirm('Are you sure you want to delete this royal archive?')) {
      deleteSaveSlot(slotId);
      refreshSlots();
      onActionFeedback('Archive Purged', `Save slot ${slotId} removed.`, 'delete');
    }
  };

  const handleExport = (e: React.MouseEvent, slotId: string) => {
    e.stopPropagation();
    audioManager.playClick();
    exportSaveToFile(slotId);
    setActionSuccess('Save file exported to device!');
    setTimeout(() => setActionSuccess(null), 3000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        const meta = importSaveFromFile(text, selectedSlotId);
        if (meta) {
          refreshSlots();
          setActionSuccess(`Imported into ${selectedSlotId}!`);
          onActionFeedback('Kingdom Imported', `${meta.scenarioName} loaded into archive.`, 'save');
        } else {
          alert('Failed to parse save file. Corrupted or invalid format.');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'Unknown date';
    try {
      const d = new Date(timestamp);
      return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return 'Recorded Archive';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border-2 border-amber-500/60 rounded-2xl shadow-2xl overflow-hidden text-slate-200 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950/90 border-b border-amber-500/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              {activeTab === 'save' ? <Save className="w-6 h-6" /> : <FolderOpen className="w-6 h-6" />}
            </div>
            <div>
              <h2 className="text-xl font-bold font-serif tracking-wide text-amber-300 flex items-center gap-2">
                {activeTab === 'save' ? 'Save Kingdom' : 'Load Kingdom'}
                <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
              </h2>
              <p className="text-xs text-slate-400 font-sans">
                {activeTab === 'save'
                  ? 'Record your current reign into the royal archives'
                  : 'Restore a previously saved realm to continue your campaign'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              audioManager.playClick();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection & Feedback */}
        <div className="flex items-center justify-between px-6 pt-4 pb-2 border-b border-slate-800 bg-slate-950/50">
          <div className="flex gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              onClick={() => {
                setActiveTab('save');
                audioManager.playClick();
              }}
              disabled={!engine || engine.state.isGameOver}
              className={`flex items-center gap-2 px-5 py-2 text-xs font-serif font-bold rounded-lg transition-all ${
                activeTab === 'save'
                  ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-slate-950 font-black shadow-lg'
                  : 'text-slate-400 hover:text-slate-200'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <Save className="w-4 h-4" />
              Save Game
            </button>
            <button
              onClick={() => {
                setActiveTab('load');
                audioManager.playClick();
              }}
              className={`flex items-center gap-2 px-5 py-2 text-xs font-serif font-bold rounded-lg transition-all ${
                activeTab === 'load'
                  ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-slate-950 font-black shadow-lg'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FolderOpen className="w-4 h-4" />
              Load Game
            </button>
          </div>

          {actionSuccess && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-950/90 border border-emerald-500/60 text-emerald-300 text-xs font-semibold rounded-lg animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              {actionSuccess}
            </div>
          )}
        </div>

        {/* Save/Load Slots List */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1">
          {slots.map((slot) => {
            const hasData = !!slot.meta;
            const isSelected = selectedSlotId === slot.slotId;

            return (
              <div
                key={slot.slotId}
                onClick={() => setSelectedSlotId(slot.slotId)}
                className={`group relative p-4 rounded-xl border-2 transition-all cursor-pointer ${
                  isSelected
                    ? 'border-amber-400 bg-slate-900/90 shadow-lg shadow-amber-950/40'
                    : 'border-slate-800 bg-slate-950/60 hover:border-slate-700 hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Left Slot Details */}
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div
                      className={`p-2.5 rounded-lg border mt-0.5 shrink-0 ${
                        hasData
                          ? 'bg-amber-950/50 border-amber-600/40 text-amber-400'
                          : 'bg-slate-900 border-slate-800 text-slate-600'
                      }`}
                    >
                      {activeTab === 'save' ? <Save className="w-5 h-5" /> : <FolderOpen className="w-5 h-5" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm font-serif text-slate-100">{slot.name}</span>
                        {slot.isQuick && (
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full">
                            Quick Save
                          </span>
                        )}
                        {slot.isAuto && (
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/40 rounded-full">
                            Auto Save
                          </span>
                        )}
                      </div>

                      {slot.meta ? (
                        <div className="mt-1.5 space-y-1">
                          <p className="text-xs font-semibold text-amber-300 font-serif">
                            {slot.meta.scenarioName} — <span className="text-amber-200 font-sans">Day {slot.meta.day}</span>
                          </p>
                          <div className="flex items-center gap-4 text-[11px] text-slate-400 flex-wrap">
                            <span className="flex items-center gap-1 text-amber-400 font-mono font-bold">
                              <Coins className="w-3.5 h-3.5" />
                              {Math.round(slot.meta.treasuryGold)}g
                            </span>
                            {slot.meta.heroCount !== undefined && (
                              <span className="flex items-center gap-1 text-sky-400">
                                <Shield className="w-3.5 h-3.5" />
                                {slot.meta.heroCount} Heroes
                              </span>
                            )}
                            {slot.meta.buildingCount !== undefined && (
                              <span className="flex items-center gap-1 text-emerald-400">
                                <Home className="w-3.5 h-3.5" />
                                {slot.meta.buildingCount} Buildings
                              </span>
                            )}
                            <span className="flex items-center gap-1 text-slate-500 ml-auto">
                              <Clock className="w-3.5 h-3.5" />
                              {formatDate(slot.meta.savedAt)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic mt-1">Empty Archive Slot — No Data</p>
                      )}
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {activeTab === 'save' ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveToSlot(slot.slotId);
                        }}
                        disabled={!engine || engine.state.isGameOver}
                        className="px-4 py-2 text-xs font-serif font-bold rounded-lg bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-slate-950 shadow transition-all flex items-center gap-1.5 disabled:opacity-40"
                      >
                        <Save className="w-3.5 h-3.5" />
                        {hasData ? 'Overwrite' : 'Save Here'}
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLoadFromSlot(slot.slotId);
                        }}
                        disabled={!hasData}
                        className="px-4 py-2 text-xs font-serif font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow transition-all flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        Load Game
                      </button>
                    )}

                    {hasData && (
                      <>
                        <button
                          onClick={(e) => handleExport(e, slot.slotId)}
                          title="Export Save (.json)"
                          className="p-2 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteSlot(e, slot.slotId)}
                          title="Delete Save Slot"
                          className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer / Import / Hotkey Hints */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950/90 border-t border-slate-800 text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              className="hidden"
            />
            <button
              onClick={() => {
                audioManager.playClick();
                fileInputRef.current?.click();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-amber-400" />
              Import File
            </button>
            <span className="text-[11px] text-slate-500 hidden sm:inline">
              Shortcuts: <span className="font-mono text-amber-400">Ctrl+S</span> (Save), <span className="font-mono text-amber-400">Ctrl+L</span> (Load)
            </span>
          </div>

          <button
            onClick={() => {
              audioManager.playClick();
              onClose();
            }}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
