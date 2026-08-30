export interface GameSettings {
  runInBackground: boolean; // default: false
  muteOnBlur: boolean;      // default: true
  musicVolume: number;      // default: 0.45
  soundVolume: number;      // default: 0.50
}

export const DEFAULT_SETTINGS: GameSettings = {
  runInBackground: false,
  muteOnBlur: true,
  musicVolume: 0.45,
  soundVolume: 0.50,
};

const SETTINGS_KEY = 'majesty_game_settings_v1';

type SettingsListener = (settings: GameSettings) => void;
const listeners: Set<SettingsListener> = new Set();

let currentSettings: GameSettings = { ...DEFAULT_SETTINGS };

// Load settings from localStorage safely (SSR compatible)
export function getGameSettings(): GameSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      currentSettings = {
        runInBackground: typeof parsed.runInBackground === 'boolean' ? parsed.runInBackground : DEFAULT_SETTINGS.runInBackground,
        muteOnBlur: typeof parsed.muteOnBlur === 'boolean' ? parsed.muteOnBlur : DEFAULT_SETTINGS.muteOnBlur,
        musicVolume: typeof parsed.musicVolume === 'number' ? Math.max(0, Math.min(1, parsed.musicVolume)) : DEFAULT_SETTINGS.musicVolume,
        soundVolume: typeof parsed.soundVolume === 'number' ? Math.max(0, Math.min(1, parsed.soundVolume)) : DEFAULT_SETTINGS.soundVolume,
      };
    }
  } catch {
    currentSettings = { ...DEFAULT_SETTINGS };
  }
  return currentSettings;
}

export function saveGameSettings(partial: Partial<GameSettings>): GameSettings {
  const updated: GameSettings = {
    ...getGameSettings(),
    ...partial,
  };
  currentSettings = updated;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    } catch {}
  }
  listeners.forEach(cb => {
    try {
      cb(updated);
    } catch (err) {
      console.warn('Settings listener error:', err);
    }
  });
  return updated;
}

export function subscribeGameSettings(cb: SettingsListener): () => void {
  listeners.add(cb);
  cb(getGameSettings());
  return () => {
    listeners.delete(cb);
  };
}
