'use client';

import React, { useState } from 'react';
import { Group, Arrow, Rect, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { ResolvedConnection, MoodboardItem } from '../../types';
import { getAnchorPoint } from '../geometry/anchorGeometry';
import { calculateBezierCurve } from '../geometry/bezierGeometry';

export interface ConnectorLineProps {
  connection: ResolvedConnection;
  sourceItem: MoodboardItem;
  targetItem: MoodboardItem;
  isSelected?: boolean;
  scale?: number;
  onSelect?: (connectionId: string) => void;
  onDelete?: (connectionId: string) => void;
  onDoubleClick?: (connectionId: string, clientX: number, clientY: number) => void;
}

/**
 * ConnectorLine — Renders a directed cubic Bezier arrow connector between two cards.
 *
 * Performance & UX Features:
 *  - 16px transparent hit target for comfortable pointer selection at any zoom.
 *  - High-contrast directed arrowhead indicating relationship direction.
 *  - Centered midpoint relationship label tag with double-click inline editing.
 */
export function ConnectorLine({
  connection,
  sourceItem,
  targetItem,
  isSelected = false,
  scale = 1,
  onSelect,
  onDoubleClick,
}: ConnectorLineProps) {
  const [isHovered, setIsHovered] = useState(false);

  const start = getAnchorPoint(
    { x: sourceItem.x, y: sourceItem.y, width: sourceItem.width, height: sourceItem.height },
    connection.fromAnchor
  );
  const end = getAnchorPoint(
    { x: targetItem.x, y: targetItem.y, width: targetItem.width, height: targetItem.height },
    connection.toAnchor
  );
  const curve = calculateBezierCurve(start, end, connection.fromAnchor, connection.toAnchor);

  const strokeColor = isSelected
    ? '#D97706'
    : isHovered
      ? '#C2410C'
      : '#5C5A53';

  const strokeWidth = isSelected ? 2 : 1.5;
  const zoomDivisor = Math.max(0.4, scale);

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
      {/* 16px transparent hit region for reliable selection without pixel-hunting */}
      <Arrow
        points={curve.points}
        bezier={true}
        stroke="rgba(0,0,0,0.01)"
        fill="rgba(0,0,0,0.01)"
        strokeWidth={16 / zoomDivisor}
        pointerLength={10 / zoomDivisor}
        pointerWidth={8 / zoomDivisor}
        hitStrokeWidth={16 / zoomDivisor}
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

      {/* Visible directed cubic Bezier arrow */}
      <Arrow
        points={curve.points}
        bezier={true}
        stroke={strokeColor}
        strokeWidth={strokeWidth / zoomDivisor}
        fill={strokeColor}
        pointerLength={8 / zoomDivisor}
        pointerWidth={6 / zoomDivisor}
        listening={false}
      />

      {/* Optional Centered Midpoint Relationship Label */}
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
            verticalAlign="middle"
          />
        </Group>
      )}
    </Group>
  );
}
