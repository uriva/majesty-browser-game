'use client';

import React, { useRef, useEffect } from 'react';
import { GameState } from '../game/types';

interface MinimapProps {
  state: GameState;
  onPanTo: (worldX: number, worldY: number) => void;
}

export const Minimap: React.FC<MinimapProps> = ({ state, onPanTo }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const mapWidthPx = state.mapWidth * state.tileSize;
  const mapHeightPx = state.mapHeight * state.tileSize;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Background (unexplored)
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);

    const scaleX = w / state.mapWidth;
    const scaleY = h / state.mapHeight;

    // Draw explored terrain
    for (let y = 0; y < state.mapHeight; y++) {
      for (let x = 0; x < state.mapWidth; x++) {
        if (state.exploredMap[y] && state.exploredMap[y][x]) {
          const tile = state.grid[y][x];
          if (tile === 1) ctx.fillStyle = '#78716c'; // road
          else if (tile === 2) ctx.fillStyle = '#0284c7'; // water
          else if (tile === 3) ctx.fillStyle = '#14532d'; // trees
          else if (tile === 4) ctx.fillStyle = '#475569'; // rock
          else ctx.fillStyle = '#22543d'; // grass
          ctx.fillRect(x * scaleX, y * scaleY, Math.ceil(scaleX), Math.ceil(scaleY));
        }
      }
    }

    // Draw Buildings
    for (const b of state.buildings) {
      if (b.hp <= 0) continue;
      ctx.fillStyle = b.type === 'palace' ? '#fbbf24' : '#38bdf8';
      ctx.fillRect(b.x * scaleX, b.y * scaleY, b.width * scaleX, b.height * scaleY);
    }

    // Draw Lairs
    for (const l of state.lairs) {
      if (state.exploredMap[Math.floor(l.y)]?.[Math.floor(l.x)]) {
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(l.x * scaleX, l.y * scaleY, l.width * scaleX, l.height * scaleY);
      }
    }

    // Draw Monsters
    for (const m of state.monsters) {
      if (state.fogOfWar[Math.floor(m.y / state.tileSize)]?.[Math.floor(m.x / state.tileSize)]) {
        ctx.fillStyle = m.isBoss ? '#f43f5e' : '#ef4444';
        const mx = (m.x / state.tileSize) * scaleX;
        const my = (m.y / state.tileSize) * scaleY;
        ctx.fillRect(mx - 1.5, my - 1.5, 3, 3);
      }
    }

    // Draw Heroes
    for (const h of state.heroes) {
      if (h.isDead) continue;
      ctx.fillStyle = '#4ade80';
      const hx = (h.x / state.tileSize) * scaleX;
      const hy = (h.y / state.tileSize) * scaleY;
      ctx.fillRect(hx - 1.5, hy - 1.5, 3, 3);
    }

    // Draw Tax Collectors (Purple with Gold Center)
    for (const tc of state.taxCollectors) {
      const tcx = (tc.x / state.tileSize) * scaleX;
      const tcy = (tc.y / state.tileSize) * scaleY;
      ctx.fillStyle = '#a855f7';
      ctx.fillRect(tcx - 2, tcy - 2, 4, 4);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(tcx - 1, tcy - 1, 2, 2);
    }

    // Draw Treasures
    for (const t of state.treasures) {
      if (state.exploredMap[Math.floor(t.y / state.tileSize)]?.[Math.floor(t.x / state.tileSize)]) {
        ctx.fillStyle = '#fbbf24';
        const tx = (t.x / state.tileSize) * scaleX;
        const ty = (t.y / state.tileSize) * scaleY;
        ctx.fillRect(tx - 1, ty - 1, 2, 2);
      }
    }

    // Draw Flags
    for (const f of state.flags) {
      ctx.fillStyle = f.type === 'attack' ? '#ef4444' : (f.type === 'explore' ? '#3b82f6' : '#eab308');
      const fx = (f.x / state.tileSize) * scaleX;
      const fy = (f.y / state.tileSize) * scaleY;
      ctx.beginPath();
      ctx.arc(fx, fy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Camera view rectangle
    const viewW = (window.innerWidth / state.camera.zoom / mapWidthPx) * w;
    const viewH = (window.innerHeight / state.camera.zoom / mapHeightPx) * h;
    const camX = ((state.camera.x - window.innerWidth / (2 * state.camera.zoom)) / mapWidthPx) * w;
    const camY = ((state.camera.y - window.innerHeight / (2 * state.camera.zoom)) / mapHeightPx) * h;

    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(camX, camY, viewW, viewH);
  }, [state, mapWidthPx, mapHeightPx]);

  const handleMinimapClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const normX = clickX / canvas.width;
    const normY = clickY / canvas.height;

    onPanTo(normX * mapWidthPx, normY * mapHeightPx);
  };

  return (
    <div className="relative border-2 border-amber-600/80 bg-slate-950/90 rounded-lg p-1.5 shadow-2xl backdrop-blur">
      <div className="text-[10px] uppercase font-bold tracking-widest text-amber-400 mb-1 text-center font-serif">
        Realm Surveyor
      </div>
      <canvas
        ref={canvasRef}
        width={160}
        height={160}
        onClick={handleMinimapClick}
        className="rounded border border-amber-900/60 cursor-crosshair block"
      />
    </div>
  );
};
