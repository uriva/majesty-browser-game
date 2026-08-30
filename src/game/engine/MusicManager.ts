import { getGameSettings, subscribeGameSettings } from '../settings';

export interface MusicTrack {
  id: string;
  title: string;
  composer: string;
  type: 'file' | 'synth';
  url?: string;
}

export const MUSIC_TRACKS: MusicTrack[] = [
  {
    id: 'general_theme',
    title: 'Majesty: Main Sovereign Theme',
    composer: 'Kevin Manthei (Original Majesty OST)',
    type: 'file',
    url: '/audio/music/GeneralTheme.mp3'
  },
  {
    id: 'early_game',
    title: 'The Kingdom Awakes (Early Game)',
    composer: 'Kevin Manthei (Original Majesty OST)',
    type: 'file',
    url: '/audio/music/EarlyGame.mp3'
  },
  {
    id: 'mid_game',
    title: 'Call of Ardania (Mid Game)',
    composer: 'Kevin Manthei (Original Majesty OST)',
    type: 'file',
    url: '/audio/music/MidGame.mp3'
  },
  {
    id: 'end_game',
    title: 'Clash of Realms (End Game)',
    composer: 'Kevin Manthei (Original Majesty OST)',
    type: 'file',
    url: '/audio/music/EndGame.mp3'
  },
  {
    id: 'epic_quest',
    title: 'The Sovereign Triumph (Epic Quest)',
    composer: 'Kevin Manthei (Original Majesty OST)',
    type: 'file',
    url: '/audio/music/EpicQuest.mp3'
  }
];

class MusicManager {
  private audioElement: HTMLAudioElement | null = null;
  private synthInterval: NodeJS.Timeout | null = null;
  private audioCtx: AudioContext | null = null;
  public currentTrackIndex: number = 0;
  public isPlaying: boolean = true;
  public isShuffle: boolean = true;
  public volume: number = 0.45;
  public muted: boolean = false;
  private tabBlurred: boolean = false;
  private muteOnBlur: boolean = true;
  private hasUserInteracted: boolean = false;
  private preMasterMuteState: boolean | null = null;
  private listeners: ((state: { isPlaying: boolean; currentTrack: MusicTrack; volume: number; muted: boolean; isShuffle: boolean }) => void)[] = [];

  constructor() {
    // Pick a random track on start
    this.currentTrackIndex = Math.floor(Math.random() * MUSIC_TRACKS.length);

    if (typeof window !== 'undefined') {
      const initialSettings = getGameSettings();
      this.muteOnBlur = initialSettings.muteOnBlur;
      this.volume = initialSettings.musicVolume;

      subscribeGameSettings((settings) => {
        this.muteOnBlur = settings.muteOnBlur;
        this.volume = settings.musicVolume;
        this.applyEffectiveVolume();
        this.notify();
      });

      this.audioElement = new Audio();
      this.audioElement.loop = false;
      this.audioElement.volume = this.isEffectiveMuted() ? 0 : this.volume;

      this.audioElement.addEventListener('ended', () => {
        this.nextTrack(true);
      });

      this.audioElement.addEventListener('error', (e) => {
        console.warn('Audio playback error, falling back or advancing track:', e);
      });

      // Track window/tab focus & visibility state
      const updateFocus = () => {
        const isFocused = typeof document !== 'undefined' && !document.hidden && (typeof document.hasFocus === 'function' ? document.hasFocus() : true);
        this.tabBlurred = !isFocused;
        this.applyEffectiveVolume();
      };

      window.addEventListener('focus', updateFocus);
      window.addEventListener('blur', updateFocus);
      document.addEventListener('visibilitychange', updateFocus);

      // Initial check
      updateFocus();

      // Try autoplay immediately
      this.tryPlay();

      // Listen for first interaction to unlock browser audio autoplay
      const unlockAudio = () => {
        if (!this.hasUserInteracted) {
          this.hasUserInteracted = true;
          if (this.isPlaying) {
            this.play();
          }
        }
        window.removeEventListener('click', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
        window.removeEventListener('pointerdown', unlockAudio);
      };

      window.addEventListener('click', unlockAudio, { passive: true });
      window.addEventListener('keydown', unlockAudio, { passive: true });
      window.addEventListener('pointerdown', unlockAudio, { passive: true });
    }
  }

  public isEffectiveMuted(): boolean {
    return this.muted || (this.muteOnBlur && this.tabBlurred);
  }

  private applyEffectiveVolume() {
    if (this.audioElement) {
      this.audioElement.volume = this.isEffectiveMuted() ? 0 : this.volume;
    }
  }

  private tryPlay() {
    const track = MUSIC_TRACKS[this.currentTrackIndex];
    if (track.type === 'file' && this.audioElement && track.url) {
      this.audioElement.src = track.url;
      this.audioElement.volume = this.isEffectiveMuted() ? 0 : this.volume;
      this.audioElement.play().catch(() => {
        // Will start on first user interaction via listener
      });
    }
  }

  public subscribe(cb: (state: { isPlaying: boolean; currentTrack: MusicTrack; volume: number; muted: boolean; isShuffle: boolean }) => void) {
    this.listeners.push(cb);
    this.notify();
    return () => {
      this.listeners = this.listeners.filter(l => l !== cb);
    };
  }

  private notify() {
    const currentTrack = MUSIC_TRACKS[this.currentTrackIndex];
    for (const cb of this.listeners) {
      cb({
        isPlaying: this.isPlaying,
        currentTrack,
        volume: this.volume,
        muted: this.muted,
        isShuffle: this.isShuffle
      });
    }
  }

  public getCurrentTrack(): MusicTrack {
    return MUSIC_TRACKS[this.currentTrackIndex];
  }

  public toggleShuffle() {
    this.isShuffle = !this.isShuffle;
    this.notify();
  }

  public play() {
    this.isPlaying = true;
    const track = MUSIC_TRACKS[this.currentTrackIndex];

    if (track.type === 'synth') {
      if (this.audioElement) {
        this.audioElement.pause();
      }
      this.startSynthBard();
    } else {
      this.stopSynthBard();
      if (this.audioElement && track.url) {
        this.audioElement.src = track.url;
        this.applyEffectiveVolume();
        this.audioElement.play().catch(() => {
          // Autoplay policy prevented immediate playback until interaction
        });
      }
    }
    this.notify();
  }

  public pause() {
    this.isPlaying = false;
    if (this.audioElement) {
      this.audioElement.pause();
    }
    this.stopSynthBard();
    this.notify();
  }

  public togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  public nextTrack(forceRandom?: boolean) {
    if (this.isShuffle || forceRandom) {
      let nextIdx = Math.floor(Math.random() * MUSIC_TRACKS.length);
      if (MUSIC_TRACKS.length > 1 && nextIdx === this.currentTrackIndex) {
        nextIdx = (nextIdx + 1) % MUSIC_TRACKS.length;
      }
      this.currentTrackIndex = nextIdx;
    } else {
      this.currentTrackIndex = (this.currentTrackIndex + 1) % MUSIC_TRACKS.length;
    }
    if (this.isPlaying) {
      this.play();
    } else {
      this.notify();
    }
  }

  public prevTrack() {
    if (this.isShuffle) {
      this.nextTrack(true);
      return;
    }
    this.currentTrackIndex = (this.currentTrackIndex - 1 + MUSIC_TRACKS.length) % MUSIC_TRACKS.length;
    if (this.isPlaying) {
      this.play();
    } else {
      this.notify();
    }
  }

  public selectTrack(index: number) {
    if (index >= 0 && index < MUSIC_TRACKS.length) {
      this.currentTrackIndex = index;
      if (this.isPlaying) {
        this.play();
      } else {
        this.notify();
      }
    }
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    this.applyEffectiveVolume();
    this.notify();
  }

  public toggleMute() {
    this.setMuted(!this.muted);
  }

  public setMuted(m: boolean) {
    this.muted = m;
    this.applyEffectiveVolume();
    this.notify();
  }

  // Master mute (HUD speaker): silences music but remembers whether the user
  // had muted it independently, restoring that choice on master unmute.
  public setMasterMuted(m: boolean) {
    if (m) {
      if (this.preMasterMuteState === null) {
        this.preMasterMuteState = this.muted;
      }
      this.setMuted(true);
    } else if (this.preMasterMuteState !== null) {
      const restore = this.preMasterMuteState;
      this.preMasterMuteState = null;
      this.setMuted(restore);
    }
  }

  // --- Procedural Synth Bard (Renaissance Lute & Woodwind Generator) ---
  private startSynthBard() {
    if (this.synthInterval) clearInterval(this.synthInterval);
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) this.audioCtx = new AudioCtx();
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    // Medieval Dorian mode notes (D4, E4, F4, G4, A4, B4, C5, D5)
    const scale = [293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25, 587.33];
    const bassChords = [
      [293.66, 349.23, 440.00], // D minor
      [349.23, 440.00, 523.25], // F major
      [392.00, 493.88, 587.33], // G major
      [440.00, 523.25, 659.25]  // A minor
    ];

    let step = 0;
    this.synthInterval = setInterval(() => {
      if (!this.isPlaying || this.isEffectiveMuted() || !this.audioCtx) return;

      const chord = bassChords[Math.floor(step / 8) % bassChords.length];
      const now = this.audioCtx.currentTime;

      // 1. Plucked Lute note
      const luteFreq = scale[Math.floor(Math.random() * scale.length)];
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(luteFreq, now);

      const effectiveVolume = this.volume * 0.25;
      gain.gain.setValueAtTime(effectiveVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.45);

      // 2. Drone Bass lute every 4 steps
      if (step % 4 === 0) {
        const bassOsc = this.audioCtx.createOscillator();
        const bassGain = this.audioCtx.createGain();
        bassOsc.type = 'sawtooth';
        bassOsc.frequency.setValueAtTime(chord[0] / 2, now);

        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(350, now);

        bassGain.gain.setValueAtTime(effectiveVolume * 0.5, now);
        bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);

        bassOsc.connect(filter);
        filter.connect(bassGain);
        bassGain.connect(this.audioCtx.destination);
        bassOsc.start(now);
        bassOsc.stop(now + 0.8);
      }

      step++;
    }, 280);
  }

  private stopSynthBard() {
    if (this.synthInterval) {
      clearInterval(this.synthInterval);
      this.synthInterval = null;
    }
  }
}

export const musicManager = new MusicManager();
