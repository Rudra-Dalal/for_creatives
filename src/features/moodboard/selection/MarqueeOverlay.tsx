'use client';

import React from 'react';
import { Rect } from 'react-konva';
import type { MarqueeBox } from './selectionTypes';

export interface MarqueeOverlayProps {
  /** Active marquee box geometry in canvas coordinates. */
  selectionBox: MarqueeBox | null;
  /** Viewport scale used to keep borders and dash patterns crisp at any zoom level. */
  scale?: number;
}

/**
 * Visual-only component rendering the active marquee selection box.
 *
 * Invariant: `listening={false}` is strictly enforced so the marquee overlay
 * never intercepts pointer events or blocks underlying card hit targets.
 */
export function MarqueeOverlay({ selectionBox, scale = 1 }: MarqueeOverlayProps) {
  if (!selectionBox || !selectionBox.visible || (selectionBox.width === 0 && selectionBox.height === 0)) {
    return null;
  }

  const safeScale = Math.max(0.2, scale);
  const strokeW = 1.5 / safeScale;
  const dashPattern = [4 / safeScale, 4 / safeScale];

  return (
    <Rect
      x={selectionBox.x}
      y={selectionBox.y}
      width={selectionBox.width}
      height={selectionBox.height}
      fill="rgba(217, 119, 6, 0.12)"
      stroke="#d97706"
      strokeWidth={strokeW}
      dash={dashPattern}
      listening={false}
      perfectDrawEnabled={false}
    />
  );
}
