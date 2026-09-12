'use client';

import React from 'react';
import { Rect } from 'react-konva';
import type { StoryboardBounds } from '../types';

export interface StoryboardMarqueeProps {
  bounds: StoryboardBounds | null;
}

export function StoryboardMarquee({ bounds }: StoryboardMarqueeProps) {
  if (!bounds) return null;

  const minX = Math.min(bounds.x, bounds.x + bounds.width);
  const minY = Math.min(bounds.y, bounds.y + bounds.height);
  const width = Math.abs(bounds.width);
  const height = Math.abs(bounds.height);

  if (width < 2 && height < 2) return null;

  return (
    <Rect
      x={minX}
      y={minY}
      width={width}
      height={height}
      fill="rgba(217, 119, 6, 0.08)"
      stroke="#D97706"
      strokeWidth={1}
      dash={[4, 4]}
      cornerRadius={2}
      listening={false}
    />
  );
}
