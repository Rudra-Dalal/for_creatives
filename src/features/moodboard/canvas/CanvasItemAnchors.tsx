'use client';

import React, { useState } from 'react';
import { Group, Circle } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { AnchorPosition, MoodboardItem } from '../types';
import { getAnchorPoint } from './connectorUtils';

interface CanvasItemAnchorsProps {
  item: MoodboardItem;
  scale?: number;
  onStartConnect: (itemId: string, anchor: AnchorPosition, startPoint: { x: number; y: number }) => void;
}

const ANCHORS: AnchorPosition[] = ['top', 'right', 'bottom', 'left'];

export function CanvasItemAnchors({
  item,
  scale = 1,
  onStartConnect,
}: CanvasItemAnchorsProps) {
  const [hoveredAnchor, setHoveredAnchor] = useState<AnchorPosition | null>(null);

  const baseRadius = 5 / Math.max(0.4, scale);
  const hoverRadius = 7 / Math.max(0.4, scale);

  return (
    <Group listening={true}>
      {ANCHORS.map((anchor) => {
        const pt = getAnchorPoint(item, anchor);
        const isHovered = hoveredAnchor === anchor;

        const handlePointerDown = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
          e.cancelBubble = true;
          onStartConnect(item.id, anchor, pt);
        };

        return (
          <Group key={anchor} x={pt.x} y={pt.y}>
            {/* Invisible larger hit target */}
            <Circle
              radius={14 / Math.max(0.4, scale)}
              fill="transparent"
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
            {/* Tactile visible anchor dot */}
            <Circle
              radius={isHovered ? hoverRadius : baseRadius}
              fill={isHovered ? '#D97706' : '#1E1E1C'}
              stroke={isHovered ? '#FFFFFF' : '#8C8A82'}
              strokeWidth={1.5 / Math.max(0.4, scale)}
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
