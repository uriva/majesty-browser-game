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

    const canvasW = canvas.width;
    const canvasH = canvas.height;

    // Background (unexplored)
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, canvasW, canvasH);

    const scaleX = canvasW / state.mapWidth;
    const scaleY = canvasH / state.mapHeight;

    // Draw explored terrain
    for (let y = 0; y < state.mapHeight; y++) {
      for (let x = 0; x < state.mapWidth; x++) {
        if (state.exploredMap[y]?.[x]) {
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
      ctx.fillStyle = b.type === 'palace' ? '#fbbf24' : (b.type === 'peasant_cottage' ? '#fde047' : '#38bdf8');
      ctx.fillRect(b.x * scaleX, b.y * scaleY, Math.max(2, b.width * scaleX), Math.max(2, b.height * scaleY));
    }

    // Draw Lairs
    for (const l of state.lairs) {
      if (state.exploredMap[Math.floor(l.y)]?.[Math.floor(l.x)]) {
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(l.x * scaleX, l.y * scaleY, Math.max(2, l.width * scaleX), Math.max(2, l.height * scaleY));
      }
    }

    // Draw Treasures
    for (const t of state.treasures) {
      const tx = Math.floor(t.x / state.tileSize);
      const ty = Math.floor(t.y / state.tileSize);
      if (state.exploredMap[ty]?.[tx]) {
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(tx * scaleX, ty * scaleY, 2, 2);
      }
    }

    // Draw Monsters (only if in visible range)
    for (const m of state.monsters) {
      const mx = Math.floor(m.x / state.tileSize);
      const my = Math.floor(m.y / state.tileSize);
      if (state.fogOfWar[my]?.[mx]) {
        ctx.fillStyle = m.isBoss ? '#f43f5e' : '#ef4444';
        ctx.fillRect(mx * scaleX - 1, my * scaleY - 1, 3, 3);
      }
    }

    // Draw Heroes
    for (const hero of state.heroes) {
      if (hero.isDead) continue;
      const hx = (hero.x / mapWidthPx) * canvasW;
      const hy = (hero.y / mapHeightPx) * canvasH;
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(hx - 1.5, hy - 1.5, 3, 3);
    }

    // Draw Tax Collectors (Amethyst Purple)
    for (const tc of state.taxCollectors) {
      const tcx = (tc.x / mapWidthPx) * canvasW;
      const tcy = (tc.y / mapHeightPx) * canvasH;
      ctx.fillStyle = '#c084fc';
      ctx.fillRect(tcx - 1.5, tcy - 1.5, 3, 3);
    }

    // Draw Peasants (Amber)
    for (const p of state.peasants) {
      const px = (p.x / mapWidthPx) * canvasW;
      const py = (p.y / mapHeightPx) * canvasH;
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(px - 1, py - 1, 2, 2);
    }

    // Draw Flags
    for (const f of state.flags) {
      const fx = (f.x / mapWidthPx) * canvasW;
      const fy = (f.y / mapHeightPx) * canvasH;
      ctx.fillStyle = f.type === 'attack' ? '#ef4444' : (f.type === 'explore' ? '#3b82f6' : '#eab308');
      ctx.beginPath();
      ctx.arc(fx, fy, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Camera Viewport Box (Scaled correctly to actual visible 3D world frustum)
    const visibleWorldSize = 420 / state.camera.zoom;
    const viewW = (visibleWorldSize / mapWidthPx) * canvasW;
    const viewH = (visibleWorldSize * 0.75 / mapHeightPx) * canvasH;
    const camCenterX = (state.camera.x / mapWidthPx) * canvasW;
    const camCenterY = (state.camera.y / mapHeightPx) * canvasH;

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(camCenterX - viewW / 2, camCenterY - viewH / 2, viewW, viewH);

    // Subtle corner tick marks on viewport box
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    const halfW = viewW / 2;
    const halfH = viewH / 2;
    const left = camCenterX - halfW;
    const right = camCenterX + halfW;
    const top = camCenterY - halfH;
    const bottom = camCenterY + halfH;

    ctx.strokeRect(left, top, 3, 3);
    ctx.strokeRect(right - 3, top, 3, 3);
    ctx.strokeRect(left, bottom - 3, 3, 3);
    ctx.strokeRect(right - 3, bottom - 3, 3, 3);
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
