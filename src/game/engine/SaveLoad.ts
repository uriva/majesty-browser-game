import { GameEngine } from './GameEngine';
import { SaveData, SaveMeta } from '../types';

const SAVE_KEY = 'majesty_save_v1';
const SLOT_PREFIX = 'majesty_save_slot_';

export interface SaveSlotInfo {
  slotId: string;
  name: string;
  meta: SaveMeta | null;
  isQuick?: boolean;
  isAuto?: boolean;
}

export function saveGameToSlot(engine: GameEngine, slotId: string = 'quick', label?: string): SaveMeta {
  const raw = engine.serializeGame();
  const data = JSON.parse(raw) as SaveData;
  const meta: SaveMeta = {
    slotId,
    savedAt: data.savedAt,
    scenarioId: data.scenarioId,
    scenarioName: data.scenarioName,
    day: data.day,
    treasuryGold: data.state.treasuryGold,
    heroCount: data.state.heroes.filter(h => h.hp > 0).length,
    buildingCount: data.state.buildings.filter(b => b.hp > 0).length,
    label: label || (slotId === 'quick' ? 'Quick Save' : slotId === 'auto' ? 'Auto Save' : `Royal Archive ${slotId.replace('slot_', '')}`)
  };

  // Save to specific slot
  const storageKey = slotId === 'quick' ? SAVE_KEY : `${SLOT_PREFIX}${slotId}`;
  localStorage.setItem(storageKey, raw);
  localStorage.setItem(storageKey + '_meta', JSON.stringify(meta));

  // Also sync default quick save for legacy shortcuts
  if (slotId !== 'quick') {
    localStorage.setItem(SAVE_KEY + '_meta', JSON.stringify(meta));
  }

  return meta;
}

export function saveGameToLocalStorage(engine: GameEngine): SaveMeta {
  return saveGameToSlot(engine, 'quick');
}

export function getRawSaveFromSlot(slotId: string = 'quick'): string | null {
  const storageKey = slotId === 'quick' ? SAVE_KEY : `${SLOT_PREFIX}${slotId}`;
  return localStorage.getItem(storageKey);
}

export function getRawSave(): string | null {
  return getRawSaveFromSlot('quick');
}

export function readSaveMetaFromSlot(slotId: string = 'quick'): SaveMeta | null {
  try {
    const storageKey = slotId === 'quick' ? SAVE_KEY : `${SLOT_PREFIX}${slotId}`;
    const raw = localStorage.getItem(storageKey + '_meta');
    return raw ? (JSON.parse(raw) as SaveMeta) : null;
  } catch {
    return null;
  }
}

export function readSaveMeta(): SaveMeta | null {
  return readSaveMetaFromSlot('quick');
}

export function hasSave(slotId: string = 'quick'): boolean {
  const storageKey = slotId === 'quick' ? SAVE_KEY : `${SLOT_PREFIX}${slotId}`;
  return localStorage.getItem(storageKey) !== null;
}

export function deleteSaveSlot(slotId: string = 'quick'): void {
  const storageKey = slotId === 'quick' ? SAVE_KEY : `${SLOT_PREFIX}${slotId}`;
  localStorage.removeItem(storageKey);
  localStorage.removeItem(storageKey + '_meta');
}

export function deleteSave(): void {
  deleteSaveSlot('quick');
}

export function listAllSaveSlots(): SaveSlotInfo[] {
  const defaultSlots = [
    { slotId: 'quick', name: 'Quick Save (Ctrl+S)', isQuick: true },
    { slotId: 'slot_1', name: 'Royal Archive I' },
    { slotId: 'slot_2', name: 'Royal Archive II' },
    { slotId: 'slot_3', name: 'Royal Archive III' },
    { slotId: 'slot_4', name: 'Royal Archive IV' },
    { slotId: 'auto', name: 'Auto Save', isAuto: true }
  ];

  return defaultSlots.map(slot => ({
    ...slot,
    meta: readSaveMetaFromSlot(slot.slotId)
  }));
}

export function exportSaveToFile(slotId: string = 'quick'): void {
  const raw = getRawSaveFromSlot(slotId);
  const meta = readSaveMetaFromSlot(slotId);
  if (!raw) return;

  const blob = new Blob([raw], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const stamp = meta ? `${meta.scenarioName.replace(/\s+/g, '_')}_Day${meta.day}` : 'majesty_save';
  a.download = `${stamp}_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function importSaveFromFile(fileContent: string, targetSlotId: string = 'slot_1'): SaveMeta | null {
  try {
    const data = JSON.parse(fileContent) as SaveData;
    if (!data.scenarioId || !data.state || !data.grid) {
      throw new Error('Invalid save structure');
    }
    const meta: SaveMeta = {
      slotId: targetSlotId,
      savedAt: data.savedAt || Date.now(),
      scenarioId: data.scenarioId,
      scenarioName: data.scenarioName || 'Restored Kingdom',
      day: data.day || 1,
      treasuryGold: data.state.treasuryGold || 0,
      heroCount: data.state.heroes?.filter(h => h.hp > 0).length || 0,
      buildingCount: data.state.buildings?.filter(b => b.hp > 0).length || 0,
      label: `Imported (${new Date().toLocaleDateString()})`
    };

    const storageKey = targetSlotId === 'quick' ? SAVE_KEY : `${SLOT_PREFIX}${targetSlotId}`;
    localStorage.setItem(storageKey, fileContent);
    localStorage.setItem(storageKey + '_meta', JSON.stringify(meta));
    return meta;
  } catch (err) {
    console.error('Failed to import save:', err);
    return null;
  }
}
