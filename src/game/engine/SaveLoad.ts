import { GameEngine } from './GameEngine';
import { SaveData, SaveMeta } from '../types';

const SAVE_KEY = 'majesty_save_v1';

export function saveGameToLocalStorage(engine: GameEngine): SaveMeta {
  const raw = engine.serializeGame();
  const data = JSON.parse(raw) as SaveData;
  const meta: SaveMeta = {
    savedAt: data.savedAt,
    scenarioId: data.scenarioId,
    scenarioName: data.scenarioName,
    day: data.day,
    treasuryGold: data.state.treasuryGold
  };
  localStorage.setItem(SAVE_KEY, raw);
  localStorage.setItem(SAVE_KEY + '_meta', JSON.stringify(meta));
  return meta;
}

export function getRawSave(): string | null {
  return localStorage.getItem(SAVE_KEY);
}

export function readSaveMeta(): SaveMeta | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY + '_meta');
    return raw ? (JSON.parse(raw) as SaveMeta) : null;
  } catch {
    return null;
  }
}

export function hasSave(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

export function deleteSave(): void {
  localStorage.removeItem(SAVE_KEY);
  localStorage.removeItem(SAVE_KEY + '_meta');
}
