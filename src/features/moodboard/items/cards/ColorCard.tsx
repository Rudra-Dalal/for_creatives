'use client';

import React, { useRef } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import type { MoodboardItem, ColorItemContent } from '../../types';

export interface ColorCardProps {
  item: MoodboardItem;
  isSelected: boolean;
  isDraggable: boolean;
  onPointerDown: (node: Konva.Node) => void;
  onSelect: (node: Konva.Node) => void;
  onDragStart: () => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onTransformEnd: (id: string, x: number, y: number, width: number, height: number) => void;
  onDoubleClick: (item: MoodboardItem) => void;
}

export function ColorCard({
  item,
  isSelected,
  isDraggable,
  onPointerDown,
  onSelect,
  onDragStart,
  onDragEnd,
  onTransformEnd,
  onDoubleClick,
}: ColorCardProps) {
  const groupRef = useRef<Konva.Group | null>(null);
  const content = (item.content as ColorItemContent) || {};
  const hex = content.hex || '#D97706';
  const label = content.label || hex.toUpperCase();

  const handleDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    onDragEnd(item.id, e.target.x(), e.target.y());
  };

  const handleTransformEnd = () => {
    if (!groupRef.current) return;
    const node = groupRef.current;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    const nw = Math.max(100, Math.round(node.width() * scaleX));
    const nh = Math.max(100, Math.round(node.height() * scaleY));
    node.width(nw);
    node.height(nh);
    onTransformEnd(item.id, node.x(), node.y(), nw, nh);
  };

  const cr = 8;
  const swatchH = Math.max(40, item.height - 46);

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
      onMouseDown={(e) => {
        if (e.evt && e.evt.button !== 0) return;
        e.cancelBubble = true;
        if (groupRef.current) onPointerDown(groupRef.current);
      }}
      onTouchStart={(e) => {
        e.cancelBubble = true;
        if (groupRef.current) onPointerDown(groupRef.current);
      }}
      onClick={(e) => {
        if (e.evt && e.evt.button !== 0) return;
        e.cancelBubble = true;
        if (groupRef.current) onSelect(groupRef.current);
      }}
      onTap={(e) => {
        e.cancelBubble = true;
        if (groupRef.current) onSelect(groupRef.current);
      }}
      onDblClick={(e) => { e.cancelBubble = true; onDoubleClick(item); }}
      onDblTap={(e) => { e.cancelBubble = true; onDoubleClick(item); }}
      onDragStart={onDragStart}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
    >
      <Rect
        width={item.width}
        height={item.height}
        fill="#181816"
        stroke={isSelected ? '#D97706' : '#2A2A26'}
        strokeWidth={isSelected ? 1.5 : 1}
        cornerRadius={cr}
        shadowColor="black"
        shadowBlur={12}
        shadowOpacity={0.4}
        shadowOffset={{ x: 0, y: 4 }}
      />
      <Group
        clipFunc={(ctx) => {
          ctx.beginPath();
          ctx.roundRect(1, 1, item.width - 2, swatchH, [cr - 1, cr - 1, 0, 0]);
          ctx.closePath();
        }}
      >
        <Rect x={1} y={1} width={item.width - 2} height={swatchH} fill={hex} />
      </Group>
      <Rect x={1} y={swatchH} width={item.width - 2} height={item.height - swatchH - 1} fill="#181816" />
      <Text
        text={label}
        x={12}
        y={swatchH + 14}
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
