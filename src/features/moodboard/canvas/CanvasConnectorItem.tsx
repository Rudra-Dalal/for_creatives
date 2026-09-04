'use client';

import React, { useState } from 'react';
import { Group, Arrow, Rect, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { ResolvedConnection, MoodboardItem } from '../types';
import { getAnchorPoint, calculateBezierCurve } from './connectorUtils';

interface CanvasConnectorItemProps {
  connection: ResolvedConnection;
  sourceItem: MoodboardItem;
  targetItem: MoodboardItem;
  isSelected?: boolean;
  scale?: number;
  onSelect?: (connectionId: string) => void;
  onDelete?: (connectionId: string) => void;
  onDoubleClick?: (connectionId: string, clientX: number, clientY: number) => void;
}

export function CanvasConnectorItem({
  connection,
  sourceItem,
  targetItem,
  isSelected = false,
  scale = 1,
  onSelect,
  onDelete,
  onDoubleClick,
}: CanvasConnectorItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  const start = getAnchorPoint(sourceItem, connection.fromAnchor);
  const end = getAnchorPoint(targetItem, connection.toAnchor);
  const curve = calculateBezierCurve(start, end, connection.fromAnchor, connection.toAnchor);

  const strokeColor = isSelected
    ? '#D97706'
    : isHovered
      ? '#C2410C'
      : '#5C5A53';

  const strokeWidth = isSelected ? 2 : 1.5;

  const handleClick = (e: KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    onSelect?.(connection.id);
  };

  const handleDblClick = (e: KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition() || { x: curve.midpoint.x, y: curve.midpoint.y };
    onDoubleClick?.(connection.id, pos.x, pos.y);
  };

  return (
    <Group>
      {/* Invisible wider hit region for reliable selection */}
      <Arrow
        points={curve.points}
        bezier={true}
        stroke="transparent"
        strokeWidth={18 / Math.max(0.4, scale)}
        pointerLength={10 / Math.max(0.4, scale)}
        pointerWidth={8 / Math.max(0.4, scale)}
        hitStrokeWidth={20 / Math.max(0.4, scale)}
        onClick={handleClick}
        onTap={handleClick}
        onDblClick={handleDblClick}
        onDblTap={handleDblClick}
        onMouseEnter={() => {
          setIsHovered(true);
          const container = window.document.querySelector('.konvajs-content') as HTMLElement;
          if (container) container.style.cursor = 'pointer';
        }}
        onMouseLeave={() => {
          setIsHovered(false);
          const container = window.document.querySelector('.konvajs-content') as HTMLElement;
          if (container) container.style.cursor = 'default';
        }}
      />

      {/* Visible directed connector arrow */}
      <Arrow
        points={curve.points}
        bezier={true}
        stroke={strokeColor}
        strokeWidth={strokeWidth / Math.max(0.4, scale)}
        fill={strokeColor}
        pointerLength={8 / Math.max(0.4, scale)}
        pointerWidth={6 / Math.max(0.4, scale)}
        listening={false}
      />

      {/* Optional Midpoint Label */}
      {connection.label && (
        <Group
          x={curve.midpoint.x}
          y={curve.midpoint.y}
          onClick={handleClick}
          onDblClick={handleDblClick}
        >
          <Rect
            x={-(connection.label.length * 3.2 + 8)}
            y={-9}
            width={connection.label.length * 6.4 + 16}
            height={18}
            fill="#181816"
            stroke={isSelected ? '#D97706' : '#2A2A26'}
            strokeWidth={1}
            cornerRadius={4}
          />
          <Text
            text={connection.label}
            x={-(connection.label.length * 3.2 + 4)}
            y={-5}
            fontSize={10}
            fontFamily="sans-serif"
            fill={isSelected ? '#D97706' : '#E6E4DF'}
            align="center"
          />
        </Group>
      )}
    </Group>
  );
}
