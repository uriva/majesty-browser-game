import { getGameSettings, subscribeGameSettings } from '../settings';

class SoundManager {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;
  public volume: number = 0.5;
  public musicVolume: number = 0.4;
  private currentMusicAudio: HTMLAudioElement | null = null;
  private currentTrackName: string | null = null;
  private audioBufferCache: Map<string, AudioBuffer> = new Map();
  private isMuted: boolean = false;
  private tabBlurred: boolean = false;
  private muteOnBlur: boolean = true;
  private activeSources: Set<AudioScheduledSourceNode> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      const initialSettings = getGameSettings();
      this.muteOnBlur = initialSettings.muteOnBlur;
      this.volume = initialSettings.soundVolume;

      subscribeGameSettings((settings) => {
        this.muteOnBlur = settings.muteOnBlur;
        this.volume = settings.soundVolume;
      });

      const updateFocus = () => {
        const isFocused = typeof document !== 'undefined' && !document.hidden && (typeof document.hasFocus === 'function' ? document.hasFocus() : true);
        this.tabBlurred = !isFocused;
      };

      window.addEventListener('focus', updateFocus);
      window.addEventListener('blur', updateFocus);
      document.addEventListener('visibilitychange', updateFocus);

      updateFocus();
    }
  }

  public isEffectivelyMuted(): boolean {
    return !this.enabled || this.isMuted || (this.muteOnBlur && this.tabBlurred);
  }

  // Spatial Listener World Position (synchronized to 3D Camera Target)
  public listenerX: number = 960;
  public listenerY: number = 960;

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

  public setListenerPosition(x: number, y: number) {
    this.listenerX = x;
    this.listenerY = y;
  }

  // Calculate Distance Attenuation (roll-off) & Stereo Panning based on event position
  public calculateSpatial(eventX?: number, eventY?: number): { volumeMult: number; pan: number } {
    if (eventX === undefined || eventY === undefined) {
      return { volumeMult: 1.0, pan: 0.0 };
    }

    const dx = eventX - this.listenerX;
    const dy = eventY - this.listenerY;
    const dist = Math.hypot(dx, dy);

    // Natural Quadratic Distance Roll-off:
    // Full volume within ~100px of camera center, smoothly rolling off towards viewport edge (~620px)
    const minDistance = 100;
    const maxDistance = 620;

    let volumeMult = 1.0;
    if (dist <= minDistance) {
      volumeMult = 1.0;
    } else if (dist >= maxDistance) {
      volumeMult = 0.03; // faint ambient off-screen cue
    } else {
      const t = (dist - minDistance) / (maxDistance - minDistance);
      volumeMult = Math.max(0.03, (1 - t) * (1 - t));
    }

    // Stereo Panning (-0.95 to 0.95)
    const pan = Math.max(-0.95, Math.min(0.95, dx / 340));

    return { volumeMult, pan };
  }

  // Play an authentic extracted WAV sound effect file with 3D spatial attenuation & stereo panning
  private playAudioFile(path: string, eventX?: number, eventY?: number, volumeMult = 1.0, onFallback?: () => void) {
    if (this.isEffectivelyMuted() || typeof window === 'undefined') return;
    this.initCtx();

    if (!this.ctx) {
      if (onFallback) onFallback();
      return;
    }

    const spatial = this.calculateSpatial(eventX, eventY);
    const finalVolume = this.volume * volumeMult * spatial.volumeMult;

    const playBuffer = (buffer: AudioBuffer) => {
      if (!this.ctx) return;
      try {
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        const gain = this.ctx.createGain();
        gain.gain.value = finalVolume;

        // Apply Stereo Panning if supported
        if (this.ctx.createStereoPanner) {
          const panner = this.ctx.createStereoPanner();
          panner.pan.value = spatial.pan;
          source.connect(gain);
          gain.connect(panner);
          panner.connect(this.ctx.destination);
        } else {
          source.connect(gain);
          gain.connect(this.ctx.destination);
        }

        this.activeSources.add(source);
        source.onended = () => {
          this.activeSources.delete(source);
        };

        source.start(0);
      } catch {
        if (onFallback) onFallback();
      }
    };

    const cached = this.audioBufferCache.get(path);
    if (cached) {
      playBuffer(cached);
      return;
    }

    fetch(path)
      .then(res => {
        if (!res.ok) throw new Error(`Sound not found: ${path}`);
        return res.arrayBuffer();
      })
      .then(arrayBuffer => this.ctx!.decodeAudioData(arrayBuffer))
      .then(decodedBuffer => {
        this.audioBufferCache.set(path, decodedBuffer);
        playBuffer(decodedBuffer);
      })
      .catch(() => {
        if (onFallback) onFallback();
      });
  }

  public stopAll() {
    this.activeSources.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch {}
    });
    this.activeSources.clear();
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
      audio.preload = 'none'; // don't hog bandwidth during model loading; buffer on play
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

  // --- 3D POSITIONAL SOUND EFFECTS ---
  public playCoinSound(x?: number, y?: number) {
    this.playAudioFile('/audio/sfx/coin.wav', x, y, 0.85, () => this.synthCoin(x, y));
  }

  public playSwordClash(x?: number, y?: number) {
    this.playAudioFile('/audio/sfx/sword_hit.wav', x, y, 0.75, () => this.synthSwordClash(x, y));
  }

  public playSwordSwing(x?: number, y?: number) {
    this.playAudioFile('/audio/sfx/sword_swing.wav', x, y, 0.6);
  }

  public playArrowShoot(x?: number, y?: number, isCrossbow?: boolean) {
    const bowVariations = ['/audio/sfx/bow_fire.wav', '/audio/sfx/bow_fire_2.wav', '/audio/sfx/bow_fire_3.wav'];
    const chosen = isCrossbow ? '/audio/sfx/crossbow_fire.wav' : bowVariations[Math.floor(Math.random() * bowVariations.length)];
    this.playAudioFile(chosen, x, y, 0.85, () => this.synthArrowShoot(x, y));
  }

  public playTowerBolt(x?: number, y?: number) {
    this.playAudioFile('/audio/sfx/tower_bolt.wav', x, y, 0.85, () => this.playArrowShoot(x, y, true));
  }

  public playArrowHit(x?: number, y?: number, isWood?: boolean) {
    const hitFile = isWood ? '/audio/sfx/arrow_hit_wood.wav' : '/audio/sfx/arrow_hit.wav';
    this.playAudioFile(hitFile, x, y, 0.8);
  }

  public playSpellCast(x?: number, y?: number) {
    this.playAudioFile('/audio/sfx/lightning_spell.wav', x, y, 0.85, () => this.synthSpellCast(x, y));
  }

  public playLightningBolt(x?: number, y?: number) {
    this.playAudioFile('/audio/sfx/lightning_spell.wav', x, y, 0.95, () => this.synthLightning(x, y));
  }

  public playHealSound(x?: number, y?: number) {
    this.playAudioFile('/audio/sfx/heal_spell.wav', x, y, 0.85, () => this.synthHeal(x, y));
  }

  public playBuildingPlaced(x?: number, y?: number) {
    this.playAudioFile('/audio/sfx/building_placed.wav', x, y, 0.9, () => this.synthBuildingPlaced(x, y));
  }

  public playClick(x?: number, y?: number) {
    this.playAudioFile('/audio/sfx/click.wav', x, y, 0.7);
  }

  public playBuildingDestroyed(x?: number, y?: number) {
    // 1. Primary loud building destruction collapse crash (with generous kingdom-wide audible presence)
    this.playAudioFile('/audio/sfx/building_destroyed.wav', x, y, 1.85, () => this.synthBuildingDestroyed(x, y));
    this.synthBuildingDestroyed(x, y);

    // 2. Secondary heavy stone rubble impact echo
    setTimeout(() => {
      this.playAudioFile('/audio/sfx/stone_hit.wav', x, y, 1.4);
    }, 140);
    setTimeout(() => {
      this.playAudioFile('/audio/sfx/body_fall.wav', x, y, 1.2);
    }, 280);
  }

  public playLevelUp(x?: number, y?: number) {
    this.playAudioFile('/audio/sfx/level_up.wav', x, y, 0.85, () => this.synthLevelUp(x, y));
  }

  public playAdvisorChime(x?: number, y?: number) {
    this.playAudioFile('/audio/sfx/horn.wav', x, y, 0.8, () => this.synthAdvisorChime(x, y));
  }

  public playFlagPlaced(x?: number, y?: number) {
    this.playAudioFile('/audio/sfx/flag_placed.wav', x, y, 0.85, () => this.synthFlagPlaced(x, y));
  }

  public playFlagCompleted(x?: number, y?: number) {
    this.playAudioFile('/audio/sfx/flag_completed.wav', x, y, 0.85);
  }

  public playVictoryFanfare() {
    this.playAudioFile('/audio/sfx/victory.wav', undefined, undefined, 1.0, () => this.synthVictory());
  }

  public playDefeatSound() {
    this.playAudioFile('/audio/sfx/defeat.wav', undefined, undefined, 1.0, () => this.synthDefeat());
  }

  public playPotionSound(x?: number, y?: number) {
    this.playAudioFile('/audio/sfx/potion.wav', x, y, 0.8);
  }

  public playChestOpen(x?: number, y?: number) {
    this.playAudioFile('/audio/sfx/chest_open.wav', x, y, 0.85);
  }

  public playRatAttack(x?: number, y?: number) {
    this.playAudioFile('/audio/sfx/rat_attack.wav', x, y, 0.7);
  }

  public playRatDeath(x?: number, y?: number) {
    this.playAudioFile('/audio/sfx/rat_death.wav', x, y, 0.7);
  }

  public playDragonFire(x?: number, y?: number) {
    this.playAudioFile('/audio/sfx/dragon_fire.wav', x, y, 0.9);
  }

  public playDragonDeath(x?: number, y?: number) {
    this.playAudioFile('/audio/sfx/dragon_death.wav', x, y, 0.95);
  }

  public playInsufficientGoldSound(x?: number, y?: number) {
    this.playVoice('advisor_treasury_low');
    this.synthErrorBuzz(x, y);
  }

  private voiceCooldowns: Map<string, number> = new Map();

  // --- 3D POSITIONAL CHARACTER & ADVISOR VOICE CLIPS ---
  public playVoice(voiceKey: string, x?: number, y?: number) {
    const now = Date.now();
    const lastPlayed = this.voiceCooldowns.get(voiceKey) || 0;
    // Debounce duplicate voice lines to keep soundscape authentic and clear
    if (now - lastPlayed < 3500) return;
    this.voiceCooldowns.set(voiceKey, now);

    const path = `/audio/voices/${voiceKey}.wav`;
    this.playAudioFile(path, x, y, 0.92);
  }

  // --- SYNTHESIZED AUDIO FALLBACKS WITH SPATIAL GAIN ---
  private synthCoin(x?: number, y?: number) {
    if (!this.ctx) return;
    try {
      const spatial = this.calculateSpatial(x, y);
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, now);
      osc.frequency.setValueAtTime(1318.51, now + 0.08);
      gain.gain.setValueAtTime(this.volume * 0.4 * spatial.volumeMult, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch {}
  }

  private synthSwordClash(x?: number, y?: number) {
    if (!this.ctx) return;
    try {
      const spatial = this.calculateSpatial(x, y);
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
      filter.Q.value = 3;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(this.volume * 0.3 * spatial.volumeMult, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start(now);
    } catch {}
  }

  private synthArrowShoot(x?: number, y?: number) {
    if (!this.ctx) return;
    try {
      const spatial = this.calculateSpatial(x, y);
      const now = this.ctx.currentTime;

      // 1. Sharp Bowstring Twang (Fast pitched oscillator with sharp pluck decay)
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(540, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.09);
      oscGain.gain.setValueAtTime(this.volume * 0.4 * spatial.volumeMult, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(oscGain);
      oscGain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);

      // 2. High-speed Aerodynamic Arrow Whoosh / Friction Noise Burst
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.14);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1800, now);
      filter.frequency.exponentialRampToValueAtTime(750, now + 0.14);
      filter.Q.value = 3.5;

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(this.volume * 0.3 * spatial.volumeMult, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
      noise.start(now);
    } catch {}
  }

  private synthSpellCast(x?: number, y?: number) {
    if (!this.ctx) return;
    try {
      const spatial = this.calculateSpatial(x, y);
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.3);
      gain.gain.setValueAtTime(this.volume * 0.35 * spatial.volumeMult, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch {}
  }

  private synthLightning(x?: number, y?: number) {
    if (!this.ctx) return;
    try {
      const spatial = this.calculateSpatial(x, y);
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
      gain.gain.setValueAtTime(this.volume * 0.6 * spatial.volumeMult, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start(now);
    } catch {}
  }

  private synthHeal(x?: number, y?: number) {
    if (!this.ctx) return;
    try {
      const spatial = this.calculateSpatial(x, y);
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, i) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const startTime = now + i * 0.06;
        gain.gain.setValueAtTime(this.volume * 0.2 * spatial.volumeMult, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.25);
      });
    } catch {}
  }

  private synthBuildingPlaced(x?: number, y?: number) {
    if (!this.ctx) return;
    try {
      const spatial = this.calculateSpatial(x, y);
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.18);
      gain.gain.setValueAtTime(this.volume * 0.4 * spatial.volumeMult, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    } catch {}
  }

  private synthLevelUp(x?: number, y?: number) {
    if (!this.ctx) return;
    try {
      const spatial = this.calculateSpatial(x, y);
      const now = this.ctx.currentTime;
      const notes = [440, 554.37, 659.25, 880];
      notes.forEach((freq, i) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        const startTime = now + i * 0.08;
        gain.gain.setValueAtTime(this.volume * 0.25 * spatial.volumeMult, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.35);
      });
    } catch {}
  }

  private synthAdvisorChime(x?: number, y?: number) {
    if (!this.ctx) return;
    try {
      const spatial = this.calculateSpatial(x, y);
      const now = this.ctx.currentTime;
      const notes = [587.33, 880, 1174.66];
      notes.forEach((freq, i) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const startTime = now + i * 0.09;
        gain.gain.setValueAtTime(this.volume * 0.3 * spatial.volumeMult, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.4);
      });
    } catch {}
  }

  private synthFlagPlaced(x?: number, y?: number) {
    if (!this.ctx) return;
    try {
      const spatial = this.calculateSpatial(x, y);
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(780, now + 0.15);
      gain.gain.setValueAtTime(this.volume * 0.3 * spatial.volumeMult, now);
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
        this.activeSources.add(osc);
        osc.onended = () => {
          this.activeSources.delete(osc);
        };
        osc.start(startTime);
        osc.stop(startTime + 0.4);
      });
    } catch {}
  }

  private synthBuildingDestroyed(x?: number, y?: number) {
    if (!this.ctx) return;
    try {
      const spatial = this.calculateSpatial(x, y);
      const now = this.ctx.currentTime;
      // Kingdom-wide audible presence: maintain at least 0.45 volume even off-screen
      const effectiveSpatial = Math.max(0.45, spatial.volumeMult);

      // 1. Heavy Low-Frequency Sub-Bass Earthquake Rumble (140Hz -> 28Hz)
      const subOsc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      subOsc.type = 'sawtooth';
      subOsc.frequency.setValueAtTime(140, now);
      subOsc.frequency.exponentialRampToValueAtTime(28, now + 1.2);
      subGain.gain.setValueAtTime(this.volume * 0.95 * effectiveSpatial, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
      subOsc.connect(subGain);
      subGain.connect(this.ctx.destination);
      subOsc.start(now);
      subOsc.stop(now + 1.4);

      // 2. Dense Shattering Masonry Debris Crash (White Noise swept through Low-Pass Filter)
      const bufferSize = this.ctx.sampleRate * 1.5;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200, now);
      filter.frequency.exponentialRampToValueAtTime(150, now + 1.3);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(this.volume * 0.9 * effectiveSpatial, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
      noise.start(now);

      // 3. Sharp Timber Splintering Crack
      const crackOsc = this.ctx.createOscillator();
      const crackGain = this.ctx.createGain();
      crackOsc.type = 'square';
      crackOsc.frequency.setValueAtTime(320, now);
      crackOsc.frequency.exponentialRampToValueAtTime(80, now + 0.18);
      crackGain.gain.setValueAtTime(this.volume * 0.75 * effectiveSpatial, now);
      crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      crackOsc.connect(crackGain);
      crackGain.connect(this.ctx.destination);
      crackOsc.start(now);
      crackOsc.stop(now + 0.2);
    } catch {}
  }

  private synthErrorBuzz(x?: number, y?: number) {
    if (!this.ctx) return;
    try {
      const spatial = this.calculateSpatial(x, y);
      const now = this.ctx.currentTime;
      for (let b = 0; b < 2; b++) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, now + b * 0.12);
        osc.frequency.setValueAtTime(110, now + b * 0.12 + 0.08);
        gain.gain.setValueAtTime(this.volume * 0.45 * spatial.volumeMult, now + b * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + b * 0.12 + 0.1);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + b * 0.12);
        osc.stop(now + b * 0.12 + 0.1);
      }
    } catch {}
  }
}

export const audioManager = new SoundManager();
