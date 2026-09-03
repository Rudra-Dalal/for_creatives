'use client';

import React, { useRef, useEffect } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import type { MoodboardItem, ColorItemContent } from '../types';

interface CanvasColorItemProps {
  item: MoodboardItem;
  isSelected: boolean;
  onSelect: (node: Konva.Node) => void;
  onDragStart: () => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onTransformEnd: (id: string, x: number, y: number, width: number, height: number) => void;
  onDoubleClick: (item: MoodboardItem) => void;
  isDraggable?: boolean;
}

export function CanvasColorItem({
  item,
  isSelected,
  onSelect,
  onDragStart,
  onDragEnd,
  onTransformEnd,
  onDoubleClick,
  isDraggable = true,
}: CanvasColorItemProps) {
  const groupRef = useRef<Konva.Group | null>(null);

  const content = (item.content as ColorItemContent) || {};
  const hex = content.hex || '#D97706';
  const label = content.label || hex.toUpperCase();

  useEffect(() => {
    if (isSelected && groupRef.current) {
      onSelect(groupRef.current);
    }
  }, [isSelected, onSelect]);

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    onDragEnd(item.id, node.x(), node.y());
  };

  const handleTransformEnd = () => {
    if (!groupRef.current) return;
    const node = groupRef.current;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();

    node.scaleX(1);
    node.scaleY(1);

    const newWidth = Math.max(100, Math.round(node.width() * scaleX));
    const newHeight = Math.max(100, Math.round(node.height() * scaleY));

    node.width(newWidth);
    node.height(newHeight);

    onTransformEnd(item.id, node.x(), node.y(), newWidth, newHeight);
  };

  const cornerRadius = 8;
  const swatchHeight = Math.max(40, item.height - 46);

  return (
    <Group
      ref={groupRef}
      id={item.id}
      x={item.x}
      y={item.y}
      width={item.width}
      height={item.height}
      draggable={isDraggable}
      onClick={(e) => {
        if (e.evt && e.evt.button !== 0) return;
        e.cancelBubble = true;
        if (groupRef.current) onSelect(groupRef.current);
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        if (groupRef.current) onSelect(groupRef.current);
      }}
      onDblClick={(e) => {
        e.cancelBubble = true;
        onDoubleClick(item);
      }}
      onDblTap={(e) => {
        e.cancelBubble = true;
        onDoubleClick(item);
      }}
      onDragStart={() => {
        if (groupRef.current) onSelect(groupRef.current);
        onDragStart();
      }}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
    >
      {/* Outer Card Background */}
      <Rect
        width={item.width}
        height={item.height}
        fill="#181816"
        stroke={isSelected ? '#D97706' : '#2A2A26'}
        strokeWidth={isSelected ? 1.5 : 1}
        cornerRadius={cornerRadius}
        shadowColor="black"
        shadowBlur={12}
        shadowOpacity={0.4}
        shadowOffset={{ x: 0, y: 4 }}
      />

      {/* Color Swatch Surface */}
      <Group
        clipFunc={(ctx) => {
          ctx.beginPath();
          ctx.roundRect(1, 1, item.width - 2, swatchHeight, [cornerRadius - 1, cornerRadius - 1, 0, 0]);
          ctx.closePath();
        }}
      >
        <Rect
          x={1}
          y={1}
          width={item.width - 2}
          height={swatchHeight}
          fill={hex}
        />
      </Group>

      {/* Bottom Metadata Bar */}
      <Rect
        x={1}
        y={swatchHeight}
        width={item.width - 2}
        height={item.height - swatchHeight - 1}
        fill="#181816"
      />

      {/* HEX Value Label */}
      <Text
        text={label}
        x={12}
        y={swatchHeight + 14}
        width={item.width - 24}
        fill="#EDEDEC"
        fontSize={11}
        fontFamily="monospace"
        fontStyle="bold"
        ellipsis
      />
    </Group>
  );
}
