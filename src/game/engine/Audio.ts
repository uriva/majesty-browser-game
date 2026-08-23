class SoundManager {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;
  public volume: number = 0.5;
  public musicVolume: number = 0.4;
  private currentMusicAudio: HTMLAudioElement | null = null;
  private currentTrackName: string | null = null;
  private audioBufferCache: Map<string, AudioBuffer> = new Map();
  private isMuted: boolean = false;

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  // Play an authentic extracted WAV sound effect file with fallback to web audio synthesis
  private playAudioFile(path: string, volumeMult = 1.0, onFallback?: () => void) {
    if (!this.enabled || this.isMuted || typeof window === 'undefined') return;
    this.initCtx();

    if (!this.ctx) {
      if (onFallback) onFallback();
      return;
    }

    const cached = this.audioBufferCache.get(path);
    if (cached) {
      try {
        const source = this.ctx.createBufferSource();
        source.buffer = cached;
        const gain = this.ctx.createGain();
        gain.gain.value = this.volume * volumeMult;
        source.connect(gain);
        gain.connect(this.ctx.destination);
        source.start(0);
        return;
      } catch {
        if (onFallback) onFallback();
        return;
      }
    }

    fetch(path)
      .then(res => {
        if (!res.ok) throw new Error(`Sound not found: ${path}`);
        return res.arrayBuffer();
      })
      .then(arrayBuffer => this.ctx!.decodeAudioData(arrayBuffer))
      .then(decodedBuffer => {
        this.audioBufferCache.set(path, decodedBuffer);
        if (this.ctx) {
          const source = this.ctx.createBufferSource();
          source.buffer = decodedBuffer;
          const gain = this.ctx.createGain();
          gain.gain.value = this.volume * volumeMult;
          source.connect(gain);
          gain.connect(this.ctx.destination);
          source.start(0);
        }
      })
      .catch(() => {
        if (onFallback) onFallback();
      });
  }

  // --- BACKGROUND MUSIC ---
  public playMusic(trackName: 'GeneralTheme' | 'EarlyGame' | 'MidGame' | 'EndGame' | 'EpicQuest' = 'GeneralTheme') {
    if (typeof window === 'undefined') return;
    if (this.currentTrackName === trackName && this.currentMusicAudio && !this.currentMusicAudio.paused) {
      return;
    }

    if (this.currentMusicAudio) {
      this.currentMusicAudio.pause();
      this.currentMusicAudio = null;
    }

    try {
      const audio = new Audio(`/audio/music/${trackName}.mp3`);
      audio.loop = true;
      audio.volume = this.enabled && !this.isMuted ? this.musicVolume : 0;
      audio.play().catch(() => {
        // User hasn't interacted with page yet
      });
      this.currentMusicAudio = audio;
      this.currentTrackName = trackName;
    } catch {
      // Audio autoplay restrictions
    }
  }

  public stopMusic() {
    if (this.currentMusicAudio) {
      this.currentMusicAudio.pause();
      this.currentMusicAudio = null;
      this.currentTrackName = null;
    }
  }

  // --- SOUND EFFECTS ---
  public playCoinSound() {
    this.playAudioFile('/audio/sfx/coin.wav', 0.8, () => this.synthCoin());
  }

  public playSwordClash() {
    this.playAudioFile('/audio/sfx/sword_hit.wav', 0.7, () => this.synthSwordClash());
  }

  public playSwordSwing() {
    this.playAudioFile('/audio/sfx/sword_swing.wav', 0.6);
  }

  public playArrowShoot() {
    this.playAudioFile('/audio/sfx/bow_fire.wav', 0.75, () => this.synthArrowShoot());
  }

  public playArrowHit() {
    this.playAudioFile('/audio/sfx/arrow_hit.wav', 0.7);
  }

  public playSpellCast() {
    this.playAudioFile('/audio/sfx/lightning_spell.wav', 0.8, () => this.synthSpellCast());
  }

  public playLightningBolt() {
    this.playAudioFile('/audio/sfx/lightning_spell.wav', 0.9, () => this.synthLightning());
  }

  public playHealSound() {
    this.playAudioFile('/audio/sfx/heal_spell.wav', 0.8, () => this.synthHeal());
  }

  public playBuildingPlaced() {
    this.playAudioFile('/audio/sfx/building_placed.wav', 0.9, () => this.synthBuildingPlaced());
  }

  public playBuildingDestroyed() {
    this.playAudioFile('/audio/sfx/building_destroyed.wav', 0.9);
  }

  public playLevelUp() {
    this.playAudioFile('/audio/sfx/level_up.wav', 0.85, () => this.synthLevelUp());
  }

  public playAdvisorChime() {
    this.playAudioFile('/audio/sfx/horn.wav', 0.75, () => this.synthAdvisorChime());
  }

  public playFlagPlaced() {
    this.playAudioFile('/audio/sfx/flag_placed.wav', 0.85, () => this.synthFlagPlaced());
  }

  public playFlagCompleted() {
    this.playAudioFile('/audio/sfx/flag_completed.wav', 0.85);
  }

  public playVictoryFanfare() {
    this.playAudioFile('/audio/sfx/victory.wav', 1.0, () => this.synthVictory());
  }

  public playDefeatSound() {
    this.playAudioFile('/audio/sfx/defeat.wav', 1.0, () => this.synthDefeat());
  }

  public playPotionSound() {
    this.playAudioFile('/audio/sfx/potion.wav', 0.8);
  }

  public playChestOpen() {
    this.playAudioFile('/audio/sfx/chest_open.wav', 0.85);
  }

  public playRatAttack() {
    this.playAudioFile('/audio/sfx/rat_attack.wav', 0.7);
  }

  public playRatDeath() {
    this.playAudioFile('/audio/sfx/rat_death.wav', 0.7);
  }

  public playDragonFire() {
    this.playAudioFile('/audio/sfx/dragon_fire.wav', 0.9);
  }

  public playDragonDeath() {
    this.playAudioFile('/audio/sfx/dragon_death.wav', 0.95);
  }

  // --- CHARACTER & ADVISOR VOICE ACTING CLIPS ---
  public playVoice(voiceKey: string) {
    const path = `/audio/voices/${voiceKey}.wav`;
    this.playAudioFile(path, 0.9);
  }

  // --- SYNTHESIZED AUDIO FALLBACKS ---
  private synthCoin() {
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, now);
      osc.frequency.setValueAtTime(1318.51, now + 0.08);
      gain.gain.setValueAtTime(this.volume * 0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch {}
  }

  private synthSwordClash() {
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * 0.1;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 2400;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(this.volume * 0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start(now);
    } catch {}
  }

  private synthArrowShoot() {
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.12);
      gain.gain.setValueAtTime(this.volume * 0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.12);
    } catch {}
  }

  private synthSpellCast() {
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.3);
      gain.gain.setValueAtTime(this.volume * 0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch {}
  }

  private synthLightning() {
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * 0.4;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1800, now);
      filter.frequency.exponentialRampToValueAtTime(120, now + 0.35);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(this.volume * 0.6, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start(now);
    } catch {}
  }

  private synthHeal() {
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, i) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const startTime = now + i * 0.06;
        gain.gain.setValueAtTime(this.volume * 0.2, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.25);
      });
    } catch {}
  }

  private synthBuildingPlaced() {
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.18);
      gain.gain.setValueAtTime(this.volume * 0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    } catch {}
  }

  private synthLevelUp() {
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const notes = [440, 554.37, 659.25, 880];
      notes.forEach((freq, i) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        const startTime = now + i * 0.08;
        gain.gain.setValueAtTime(this.volume * 0.25, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.35);
      });
    } catch {}
  }

  private synthAdvisorChime() {
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const notes = [587.33, 880, 1174.66];
      notes.forEach((freq, i) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const startTime = now + i * 0.09;
        gain.gain.setValueAtTime(this.volume * 0.3, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.4);
      });
    } catch {}
  }

  private synthFlagPlaced() {
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(780, now + 0.15);
      gain.gain.setValueAtTime(this.volume * 0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    } catch {}
  }

  private synthVictory() {
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const chords = [
        [523.25, 659.25, 783.99],
        [587.33, 739.99, 880.00],
        [659.25, 830.61, 987.77],
        [783.99, 987.77, 1318.51, 1567.98]
      ];
      chords.forEach((chord, step) => {
        chord.forEach(freq => {
          if (!this.ctx) return;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.value = freq;
          const startTime = now + step * 0.2;
          const duration = step === chords.length - 1 ? 1.0 : 0.25;
          gain.gain.setValueAtTime(this.volume * 0.2, startTime);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(startTime);
          osc.stop(startTime + duration);
        });
      });
    } catch {}
  }

  private synthDefeat() {
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const notes = [392.00, 369.99, 329.63, 277.18];
      notes.forEach((freq, i) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        const startTime = now + i * 0.25;
        gain.gain.setValueAtTime(this.volume * 0.3, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.4);
      });
    } catch {}
  }
}

export const audioManager = new SoundManager();
