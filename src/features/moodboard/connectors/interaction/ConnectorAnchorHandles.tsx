'use client';

import React, { useState } from 'react';
import { Group, Circle } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { AnchorPosition, MoodboardItem } from '../../types';
import type { CanvasPoint } from '../../coordinates/geometryTypes';
import { getAnchorPoint, CARDINAL_ANCHORS } from '../geometry/anchorGeometry';

export interface ConnectorAnchorHandlesProps {
  item: MoodboardItem;
  scale?: number;
  onStartConnect: (itemId: string, anchor: AnchorPosition, startPoint: CanvasPoint) => void;
}

/**
 * ConnectorAnchorHandles — Renders the 4 cardinal magnetic connection anchors (top, right, bottom, left)
 * around an actively selected card.
 *
 * Rendered through InteractionOverlayLayer above items so that anchor dots have clean hit-testing.
 * Anchors are positioned at edge midpoints, far outside the 20px corner priority zone to never
 * interfere with the 4 corner resize handles of CanvasTransformer.
 */
export function ConnectorAnchorHandles({
  item,
  scale = 1,
  onStartConnect,
}: ConnectorAnchorHandlesProps) {
  const [hoveredAnchor, setHoveredAnchor] = useState<AnchorPosition | null>(null);

  const zoomDivisor = Math.max(0.4, scale);
  const baseRadius = 5 / zoomDivisor;
  const hoverRadius = 7 / zoomDivisor;

  const bounds = { x: item.x, y: item.y, width: item.width, height: item.height };

  return (
    <Group listening={true}>
      {CARDINAL_ANCHORS.map((anchor) => {
        const pt = getAnchorPoint(bounds, anchor);
        const isHovered = hoveredAnchor === anchor;

        const handlePointerDown = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
          e.cancelBubble = true;
          onStartConnect(item.id, anchor, pt);
        };

        return (
          <Group key={anchor} x={pt.x} y={pt.y}>
            {/* Comfortable hit target (14px radius) */}
            <Circle
              radius={14 / zoomDivisor}
              fill="transparent"
              onMouseDown={handlePointerDown}
              onTouchStart={handlePointerDown}
              onPointerDown={handlePointerDown}
              onMouseEnter={() => {
                setHoveredAnchor(anchor);
                const container = window.document.querySelector('.konvajs-content') as HTMLElement;
                if (container) container.style.cursor = 'crosshair';
              }}
              onMouseLeave={() => {
                setHoveredAnchor(null);
                const container = window.document.querySelector('.konvajs-content') as HTMLElement;
                if (container) container.style.cursor = 'default';
              }}
            />
            {/* Tactile anchor dot */}
            <Circle
              radius={isHovered ? hoverRadius : baseRadius}
              fill={isHovered ? '#D97706' : '#1E1E1C'}
              stroke={isHovered ? '#FFFFFF' : '#8C8A82'}
              strokeWidth={1.5 / zoomDivisor}
              listening={false}
              shadowColor="#000000"
              shadowBlur={isHovered ? 4 : 2}
              shadowOpacity={0.6}
            />
          </Group>
        );
      })}
    </Group>
  );
}
