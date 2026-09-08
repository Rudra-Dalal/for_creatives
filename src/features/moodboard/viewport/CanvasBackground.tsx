'use client';

import React, { useState, useEffect } from 'react';
import { Rect } from 'react-konva';

interface CanvasBackgroundProps {
  scale: number;
}

/**
 * Renders an infinite dotted background on the Konva canvas.
 * Redraws the offscreen pattern canvas at current zoom scale and device pixel ratio (DPR)
 * so that background grid dots remain crisp at any zoom level without blur.
 */
export function CanvasBackground({ scale }: CanvasBackgroundProps) {
  const [patternCanvas, setPatternCanvas] = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const scaleFactor = Math.max(0.2, scale) * dpr;
    const baseGrid = 28;
    const tileSize = Math.max(4, Math.round(baseGrid * scaleFactor));

    const canvas = document.createElement('canvas');
    canvas.width = tileSize;
    canvas.height = tileSize;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.fillStyle = '#121211';
      ctx.fillRect(0, 0, tileSize, tileSize);

      // Dot radius scales smoothly with zoom to ensure crisp sub-pixel alignment
      const dotRadius = Math.max(0.8, 1.2 * scaleFactor);
      ctx.fillStyle = '#262622';
      ctx.beginPath();
      ctx.arc(tileSize / 2, tileSize / 2, dotRadius, 0, Math.PI * 2);
      ctx.fill();

      setPatternCanvas(canvas);
    }
  }, [scale]);

  if (!patternCanvas) {
    return (
      <Rect
        name="canvas-background"
        x={-50000}
        y={-50000}
        width={100000}
        height={100000}
        fill="#121211"
        listening={true}
      />
    );
  }

  return (
    <Rect
      name="canvas-background"
      x={-50000}
      y={-50000}
      width={100000}
      height={100000}
      fillPatternImage={patternCanvas as unknown as HTMLImageElement}
      fillPatternRepeat="repeat"
      fillPatternScale={{
        x: 28 / patternCanvas.width,
        y: 28 / patternCanvas.height,
      }}
      listening={true}
    />
  );
}
