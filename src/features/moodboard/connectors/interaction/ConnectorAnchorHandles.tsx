'use client';

import React, { useState } from 'react';
import { Group, Circle } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { AnchorPosition, MoodboardItem } from '../../types';
import type { CanvasPoint } from '../../coordinates/geometryTypes';
import { getPointerCanvasPosition } from '../../coordinates/canvasCoordinates';
import { getAnchorPoint, CARDINAL_ANCHORS } from '../geometry/anchorGeometry';

export interface ConnectorAnchorHandlesProps {
  item: MoodboardItem;
  scale?: number;
  onStartConnect: (
    itemId: string,
    anchor: AnchorPosition,
    startPoint: CanvasPoint,
    pointerPos?: CanvasPoint
  ) => void;
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
  const baseRadius = 6 / zoomDivisor;
  const hoverRadius = 8 / zoomDivisor;

  const bounds = { x: item.x, y: item.y, width: item.width, height: item.height };

  return (
    <Group listening={true}>
      {CARDINAL_ANCHORS.map((anchor) => {
        const pt = getAnchorPoint(bounds, anchor);
        const isHovered = hoveredAnchor === anchor;

        const handlePointerDown = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
          e.cancelBubble = true;
          const stage = e.target.getStage();
          const pointer = stage ? getPointerCanvasPosition(stage) : pt;
          onStartConnect(item.id, anchor, pt, pointer || pt);
        };

        return (
          <Group
            key={anchor}
            x={pt.x}
            y={pt.y}
            listening={true}
            onMouseDown={handlePointerDown}
            onTouchStart={handlePointerDown}
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
          >
            {/* Comfortable hit target (18px radius local to anchor handles, non-zero alpha fill) */}
            <Circle
              radius={18 / zoomDivisor}
              fill="rgba(217, 119, 6, 0.01)"
              listening={true}
            />
            {/* Tactile high-contrast anchor dot */}
            <Circle
              radius={isHovered ? hoverRadius : baseRadius}
              fill={isHovered ? '#D97706' : '#FFFFFF'}
              stroke={isHovered ? '#FFFFFF' : '#D97706'}
              strokeWidth={2 / zoomDivisor}
              listening={true}
              shadowColor={isHovered ? '#D97706' : '#000000'}
              shadowBlur={isHovered ? 8 : 4}
              shadowOpacity={isHovered ? 0.8 : 0.6}
            />
          </Group>
        );
      })}
    </Group>
  );
}
