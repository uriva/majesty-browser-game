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
  AlertCircle
} from 'lucide-react';

interface SaveLoadModalProps {
  isOpen: boolean;
  engine: GameEngine | null;
  onClose: () => void;
  onLoadSave: (rawSave: string, meta: SaveMeta) => void;
  onActionFeedback: (title: string, message: string, type: 'save' | 'load' | 'delete') => void;
}

export const SaveLoadModal: React.FC<SaveLoadModalProps> = ({
  isOpen,
  engine,
  onClose,
  onLoadSave,
  onActionFeedback
}) => {
  const [slots, setSlots] = useState<SaveSlotInfo[]>([]);
  const [activeTab, setActiveTab] = useState<'save' | 'load'>('save');
  const [selectedSlotId, setSelectedSlotId] = useState<string>('slot_1');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshSlots = () => {
    setSlots(listAllSaveSlots());
  };

  useEffect(() => {
    if (isOpen) {
      refreshSlots();
      setActionSuccess(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveToSlot = (slotId: string, customLabel?: string) => {
    if (!engine || engine.state.isGameOver) return;
    const meta = saveGameToSlot(engine, slotId, customLabel);
    refreshSlots();
    setActionSuccess(`Saved to ${meta.label || slotId}!`);
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
    try {
      const parsed = JSON.parse(raw);
      const meta: SaveMeta = {
        slotId,
        savedAt: parsed.savedAt || Date.now(),
        scenarioId: parsed.scenarioId,
        scenarioName: parsed.scenarioName,
        day: parsed.day,
        treasuryGold: parsed.state?.treasuryGold || 0,
        heroCount: parsed.state?.heroes?.filter((h: any) => h.hp > 0).length || 0,
        buildingCount: parsed.state?.buildings?.filter((b: any) => b.hp > 0).length || 0
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
    if (confirm('Are you sure you want to delete this royal archive?')) {
      deleteSaveSlot(slotId);
      refreshSlots();
      onActionFeedback('Archive Purged', `Save slot ${slotId} removed.`, 'delete');
    }
  };

  const handleExport = (e: React.MouseEvent, slotId: string) => {
    e.stopPropagation();
    exportSaveToFile(slotId);
    setActionSuccess('Save file downloaded to device!');
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

  const formatRelativeTime = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border-2 border-amber-500/50 rounded-2xl shadow-2xl overflow-hidden text-slate-200">
        {/* Decorative Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-950/90 border-b border-amber-500/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <FolderOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-serif tracking-wide text-amber-300 flex items-center gap-2">
                Royal Kingdom Archives
                <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
              </h2>
              <p className="text-xs text-slate-400 font-sans">
                Record or restore your sovereign reign across multiple chronicles
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection & Feedback */}
        <div className="flex items-center justify-between px-6 pt-4 pb-2">
          <div className="flex gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('save')}
              disabled={!engine || engine.state.isGameOver}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'save'
                  ? 'bg-amber-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-slate-200'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <Save className="w-4 h-4" />
              Save Realm
            </button>
            <button
              onClick={() => setActiveTab('load')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === 'load'
                  ? 'bg-amber-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FolderOpen className="w-4 h-4" />
              Restore Realm
            </button>
          </div>

          {actionSuccess && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-semibold rounded-lg animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              {actionSuccess}
            </div>
          )}
        </div>

        {/* Save Slots List */}
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
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
                <div className="flex items-start justify-between">
                  {/* Left Slot Details */}
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2.5 rounded-lg border mt-0.5 ${
                        hasData
                          ? 'bg-amber-950/50 border-amber-600/40 text-amber-400'
                          : 'bg-slate-900 border-slate-800 text-slate-600'
                      }`}
                    >
                      {hasData ? <Save className="w-5 h-5" /> : <FolderOpen className="w-5 h-5" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm font-serif text-slate-100">{slot.name}</span>
                        {slot.isQuick && (
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full">
                            Quick
                          </span>
                        )}
                        {slot.isAuto && (
                          <span className="px-2 py-0.5 text-[10px] font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/40 rounded-full">
                            Auto
                          </span>
                        )}
                      </div>

                      {slot.meta ? (
                        <div className="mt-1 space-y-1">
                          <p className="text-xs font-semibold text-amber-300">
                            {slot.meta.scenarioName} — <span className="text-amber-200">Day {slot.meta.day}</span>
                          </p>
                          <div className="flex items-center gap-4 text-[11px] text-slate-400">
                            <span className="flex items-center gap-1 text-amber-400">
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
                              {formatRelativeTime(slot.meta.savedAt)} ({new Date(slot.meta.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic mt-1">Empty Royal Archive Slot</p>
                      )}
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-2">
                    {activeTab === 'save' ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveToSlot(slot.slotId);
                        }}
                        disabled={!engine || engine.state.isGameOver}
                        className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-500 text-white shadow transition-colors flex items-center gap-1.5"
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
                        className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow transition-colors flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        Restore
                      </button>
                    )}

                    {hasData && (
                      <>
                        <button
                          onClick={(e) => handleExport(e, slot.slotId)}
                          title="Export Save File (.json)"
                          className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteSlot(e, slot.slotId)}
                          title="Delete Save Slot"
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
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
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-amber-400" />
              Import File
            </button>
            <span className="text-[11px] text-slate-500 hidden sm:inline">
              Shortcuts: <span className="font-mono text-amber-400">Ctrl+S</span> (Quick Save), <span className="font-mono text-amber-400">Ctrl+L</span> (Quick Load)
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
