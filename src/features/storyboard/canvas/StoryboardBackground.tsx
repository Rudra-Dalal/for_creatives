'use client';

import React, { useMemo } from 'react';
import { Layer, Rect, Shape } from 'react-konva';
import type { StoryboardViewport } from '../types';

interface StoryboardBackgroundProps {
  width: number;
  height: number;
  viewport: StoryboardViewport;
}

/**
 * StoryboardBackground — High-performance, zoom-crisp background layer.
 *
 * Renders an infinite dark surface with a crisp dotted grid.
 * Dots are calculated in screen space so they never blur or distort across zoom levels.
 */
export const StoryboardBackground = React.memo(function StoryboardBackground({
  width,
  height,
  viewport,
}: StoryboardBackgroundProps) {
  // Base grid spacing in canvas world units
  const baseSpacing = 28;

  const sceneFunc = useMemo(() => {
    return (ctx: any) => {
      if (width <= 0 || height <= 0) return;

      const nativeCtx = ctx._context as CanvasRenderingContext2D;
      const scale = viewport.scale;

      // Adaptive grid spacing to maintain visual elegance across zoom ranges
      let screenSpacing = baseSpacing * scale;
      while (screenSpacing < 18) screenSpacing *= 2;
      while (screenSpacing > 72) screenSpacing /= 2;

      const offsetX = ((viewport.x % screenSpacing) + screenSpacing) % screenSpacing;
      const offsetY = ((viewport.y % screenSpacing) + screenSpacing) % screenSpacing;

      nativeCtx.save();
      nativeCtx.fillStyle = 'rgba(255, 255, 255, 0.08)';

      nativeCtx.beginPath();
      const radius = scale < 0.4 ? 0.75 : 1.0;

      for (let x = offsetX; x < width; x += screenSpacing) {
        for (let y = offsetY; y < height; y += screenSpacing) {
          nativeCtx.moveTo(x + radius, y);
          nativeCtx.arc(x, y, radius, 0, Math.PI * 2);
        }
      }
      nativeCtx.fill();
      nativeCtx.restore();
    };
  }, [width, height, viewport.x, viewport.y, viewport.scale]);

  return (
    <Layer listening={false} name="storyboard-background-layer">
      {/* Dark background base */}
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="#121110"
        listening={false}
      />
      {/* Zoom-crisp dotted grid overlay */}
      <Shape
        sceneFunc={sceneFunc}
        listening={false}
      />
    </Layer>
  );
});
