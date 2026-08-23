'use client';

import React, { useEffect, useState } from 'react';
import { MUSIC_TRACKS, MusicTrack, musicManager } from '../game/engine/MusicManager';
import { 
  Music, 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Volume2, 
  VolumeX, 
  ListMusic, 
  Disc3 
} from 'lucide-react';

export const MusicPlayer: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTrack, setCurrentTrack] = useState<MusicTrack>(MUSIC_TRACKS[0]);
  const [volume, setVolume] = useState<number>(0.4);
  const [muted, setMuted] = useState<boolean>(false);
  const [showTrackList, setShowTrackList] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = musicManager.subscribe((state) => {
      setIsPlaying(state.isPlaying);
      setCurrentTrack(state.currentTrack);
      setVolume(state.volume);
      setMuted(state.muted);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="relative">
      {/* Mini Player Bar */}
      <div className="bg-slate-900/90 border border-amber-800/70 rounded-lg px-2.5 py-1.5 flex items-center gap-2.5 shadow-lg backdrop-blur text-xs">
        {/* Animated Disc / Icon */}
        <button
          onClick={() => musicManager.togglePlay()}
          title={isPlaying ? 'Pause Music' : 'Play Royal Music'}
          className="p-1 rounded bg-amber-950/80 hover:bg-amber-900/80 border border-amber-600/60 text-amber-300 transition-all flex items-center justify-center shrink-0"
        >
          {isPlaying ? (
            <Disc3 className="w-4 h-4 animate-spin text-amber-400" />
          ) : (
            <Play className="w-4 h-4 text-amber-300" />
          )}
        </button>

        {/* Track Title */}
        <div 
          onClick={() => setShowTrackList(!showTrackList)}
          className="cursor-pointer hover:text-amber-200 transition-colors max-w-[140px] truncate"
        >
          <div className="font-bold text-[11px] text-amber-300 truncate font-serif leading-tight">
            {currentTrack.title}
          </div>
          <div className="text-[9px] text-slate-400 truncate">
            {currentTrack.composer}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => musicManager.prevTrack()}
            title="Previous Track"
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => musicManager.togglePlay()}
            title={isPlaying ? 'Pause' : 'Play'}
            className="p-1 rounded hover:bg-slate-800 text-amber-400"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => musicManager.nextTrack()}
            title="Next Track"
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Playlist Toggle */}
        <button
          onClick={() => setShowTrackList(!showTrackList)}
          title="Tracklist"
          className={`p-1 rounded transition-colors ${
            showTrackList
              ? 'bg-amber-600 text-slate-950 font-bold'
              : 'text-slate-400 hover:text-amber-300 hover:bg-slate-800'
          }`}
        >
          <ListMusic className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Tracklist Dropdown Menu */}
      {showTrackList && (
        <div className="absolute right-0 top-11 w-72 bg-slate-950/95 border-2 border-amber-600/90 rounded-xl p-2.5 shadow-2xl backdrop-blur-md z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400 font-serif border-b border-amber-900/60 pb-1.5 mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Music className="w-3.5 h-3.5" /> Royal Minstrel Playlist
            </span>
            <span className="text-[10px] text-slate-400 font-normal">
              {MUSIC_TRACKS.length} Tracks
            </span>
          </div>

          <div className="space-y-1 mb-2.5 max-h-48 overflow-y-auto pr-1">
            {MUSIC_TRACKS.map((track, idx) => {
              const isSelected = track.id === currentTrack.id;
              return (
                <button
                  key={track.id}
                  onClick={() => {
                    musicManager.selectTrack(idx);
                    if (!isPlaying) musicManager.play();
                    setShowTrackList(false);
                  }}
                  className={`w-full flex items-center justify-between p-1.5 rounded-lg text-left text-xs transition-all ${
                    isSelected
                      ? 'bg-amber-600 text-slate-950 font-bold'
                      : 'bg-slate-900/70 border border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-amber-200'
                  }`}
                >
                  <div className="truncate">
                    <div className="truncate text-[11px] leading-tight font-serif">
                      {idx + 1}. {track.title}
                    </div>
                    <div className={`text-[9px] truncate ${isSelected ? 'text-slate-900' : 'text-slate-400'}`}>
                      {track.composer}
                    </div>
                  </div>
                  {isSelected && isPlaying && (
                    <span className="shrink-0 w-2 h-2 rounded-full bg-slate-950 animate-ping ml-1" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Volume Slider in Playlist */}
          <div className="border-t border-slate-800/80 pt-2 flex items-center gap-2 text-xs">
            <button
              onClick={() => musicManager.toggleMute()}
              className="text-slate-400 hover:text-amber-300"
            >
              {muted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5 text-amber-400" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={muted ? 0 : volume}
              onChange={(e) => musicManager.setVolume(parseFloat(e.target.value))}
              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <span className="text-[10px] font-mono text-slate-400 w-7 text-right">
              {Math.round((muted ? 0 : volume) * 100)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
