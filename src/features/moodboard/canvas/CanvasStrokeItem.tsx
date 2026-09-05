'use client';

import React, { useRef } from 'react';
import { Group, Line, Rect } from 'react-konva';
import type Konva from 'konva';
import type { MoodboardItem, StrokeItemContent } from '../types';

interface CanvasStrokeItemProps {
  item: MoodboardItem;
  isSelected: boolean;
  isDraggable?: boolean;
  onSelect: (node: Konva.Node) => void;
  onPointerDown?: (node: Konva.Node) => void;
  onDragStart?: () => void;
  onDragEnd: (id: string, x: number, y: number) => void;
}

export function CanvasStrokeItem({
  item,
  isSelected,
  isDraggable = true,
  onSelect,
  onPointerDown,
  onDragStart,
  onDragEnd,
}: CanvasStrokeItemProps) {
  const groupRef = useRef<Konva.Group | null>(null);

  const content = (item.content as StrokeItemContent) || {};
  const points = content.points || [];
  const color = content.color || '#D97706';
  const strokeWidth = content.strokeWidth || 4;

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    onDragEnd(item.id, node.x(), node.y());
  };

  return (
    <Group
      ref={groupRef}
      id={item.id}
      name="moodboard-item"
      x={item.x}
      y={item.y}
      width={item.width}
      height={item.height}
      draggable={isDraggable}
      onPointerDown={(e) => {
        onPointerDown?.(e.currentTarget);
      }}
      onClick={(e) => {
        onSelect(e.currentTarget);
      }}
      onTap={(e) => {
        onSelect(e.currentTarget);
      }}
      onDragStart={onDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* Selected bounding indicator / subtle editorial dashed outline */}
      {isSelected && (
        <Rect
          x={-6}
          y={-6}
          width={item.width + 12}
          height={item.height + 12}
          stroke="#D97706"
          strokeWidth={1}
          dash={[4, 4]}
          cornerRadius={4}
          listening={false}
          opacity={0.75}
        />
      )}

      {/* Freehand Vector Stroke Line with Konva curve smoothing */}
      <Line
        points={points}
        stroke={color}
        strokeWidth={strokeWidth}
        tension={content.tension ?? 0.5}
        lineCap="round"
        lineJoin="round"
        hitStrokeWidth={Math.max(16, strokeWidth + 10)}
        perfectDrawEnabled={false}
      />
    </Group>
  );
}
