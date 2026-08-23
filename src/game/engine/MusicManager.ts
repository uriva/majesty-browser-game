export interface MusicTrack {
  id: string;
  title: string;
  composer: string;
  type: 'file' | 'synth';
  url?: string;
}

export const MUSIC_TRACKS: MusicTrack[] = [
  {
    id: 'folk_round',
    title: 'The Bustling Kingdom',
    composer: 'Kevin MacLeod (CC-BY)',
    type: 'file',
    url: '/music/folk_round.mp3'
  },
  {
    id: 'royal_court',
    title: 'Royal Court of the Sovereign',
    composer: 'Kevin MacLeod (CC-BY)',
    type: 'file',
    url: '/music/royal_court.mp3'
  },
  {
    id: 'lord_of_the_land',
    title: 'Heroes of the Realm',
    composer: 'Kevin MacLeod (CC-BY)',
    type: 'file',
    url: '/music/lord_of_the_land.mp3'
  },
  {
    id: 'celtic_impulse',
    title: 'Wilderness of Ardania',
    composer: 'Kevin MacLeod (CC-BY)',
    type: 'file',
    url: '/music/celtic_impulse.mp3'
  },
  {
    id: 'synth_bard',
    title: 'Minstrel Lute & Flute (Procedural)',
    composer: 'Royal Minstrel Synth',
    type: 'synth'
  }
];

class MusicManager {
  private audioElement: HTMLAudioElement | null = null;
  private synthInterval: NodeJS.Timeout | null = null;
  private audioCtx: AudioContext | null = null;
  public currentTrackIndex: number = 0;
  public isPlaying: boolean = false;
  public volume: number = 0.4;
  public muted: boolean = false;
  private listeners: ((state: { isPlaying: boolean; currentTrack: MusicTrack; volume: number; muted: boolean }) => void)[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      this.audioElement = new Audio();
      this.audioElement.loop = false;
      this.audioElement.volume = this.volume;

      this.audioElement.addEventListener('ended', () => {
        this.nextTrack();
      });

      this.audioElement.addEventListener('error', (e) => {
        console.warn('Audio playback error, falling back or advancing track:', e);
      });
    }
  }

  public subscribe(cb: (state: { isPlaying: boolean; currentTrack: MusicTrack; volume: number; muted: boolean }) => void) {
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
        muted: this.muted
      });
    }
  }

  public getCurrentTrack(): MusicTrack {
    return MUSIC_TRACKS[this.currentTrackIndex];
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
        this.audioElement.volume = this.muted ? 0 : this.volume;
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

  public nextTrack() {
    this.currentTrackIndex = (this.currentTrackIndex + 1) % MUSIC_TRACKS.length;
    if (this.isPlaying) {
      this.play();
    } else {
      this.notify();
    }
  }

  public prevTrack() {
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
    if (this.audioElement) {
      this.audioElement.volume = this.muted ? 0 : this.volume;
    }
    this.notify();
  }

  public toggleMute() {
    this.muted = !this.muted;
    if (this.audioElement) {
      this.audioElement.volume = this.muted ? 0 : this.volume;
    }
    this.notify();
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
      if (!this.isPlaying || this.muted || !this.audioCtx) return;

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
